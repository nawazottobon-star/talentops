import { supabase } from '../lib/supabaseClient';

/**
 * Message Service
 * Handles all messaging-related operations with Supabase
 */

const READ_RECEIPT_SKEW_MS = 5000;

// ══════════════════════════════════════════════
//  AUTH & PROFILE HELPERS
// ══════════════════════════════════════════════

/**
 * Fetch current user and their profile with role fallback
 * @returns {Promise<{user: object, profile: object, orgId: string, role: string}>}
 */
export const fetchCurrentUserWithProfile = async () => {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return null;

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('org_id, role')
            .eq('id', user.id)
            .single();

        // Fallback if profile doesn't exist or error
        const orgId = profile?.org_id || null;
        let role = profile?.role?.toLowerCase();
        if (!role || profileError) {
            role = 'executive'; // Default fallback from MessagingHub logic
        }

        return { user, profile, orgId, role };
    } catch (error) {
        console.error('Error in fetchCurrentUserWithProfile:', error);
        return null;
    }
};

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Function called with (event, session)
 * @returns {Object} Subscription object
 */
export const subscribeToAuthChanges = (callback) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
};

/**
 * Get conversations for a user filtered by category
 * @param {string} userId - Current user's ID
 * @param {string} category - 'myself' (DMs), 'team', or 'organization'
 * @returns {Promise<Array>} List of conversations
 */
export const getConversationsByCategory = async (userId, category, orgId) => {
    try {
        // Check if user is authenticated
        if (!userId) {
            console.warn('No user ID provided for getConversationsByCategory');
            return [];
        }

        // Step 1: Get user's conversation memberships first
        const { data: memberships, error: memberError } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', userId);

        if (memberError) {
            console.error('Error fetching conversation memberships:', memberError);
            return [];
        }

        if (!memberships || memberships.length === 0) {
            console.log('No conversations found for user');
            return [];
        }

        const conversationIds = memberships.map(m => m.conversation_id);

        // Step 2: Get conversations the user is a member of
        let query = supabase
            .from('conversations')
            .select('*')
            .in('id', conversationIds);

        // Filter by org_id strictly
        if (orgId) {
            query = query.eq('org_id', orgId);
        }

        // Filter by conversation type based on category
        if (category === 'myself') {
            query = query.eq('type', 'dm');
        } else if (category === 'team') {
            query = query.eq('type', 'team');
        } else if (category === 'organization') {
            query = query.eq('type', 'everyone');
        }

        const { data: conversations, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }

        if (!conversations || conversations.length === 0) {
            return [];
        }

        // Step 3: Fetch conversation indexes for these conversations
        const { data: indexes, error: indexError } = await supabase
            .from('conversation_indexes')
            .select('*')
            .in('conversation_id', conversations.map(c => c.id));

        if (indexError) {
            console.error('Error fetching conversation indexes:', indexError);
            // Return conversations without indexes rather than failing completely
            return conversations;
        }

        // Step 4: Merge indexes into conversations
        const conversationsWithIndexes = conversations.map(conv => {
            const index = indexes?.find(idx => idx.conversation_id === conv.id);
            return {
                ...conv,
                conversation_indexes: index ? [index] : []
            };
        });

        // Step 4.5: Sort by last_message_at (most recent first)
        conversationsWithIndexes.sort((a, b) => {
            const aTime = a.conversation_indexes?.[0]?.last_message_at;
            const bTime = b.conversation_indexes?.[0]?.last_message_at;

            if (!aTime && !bTime) return 0;
            if (!aTime) return 1;  // No message goes to bottom
            if (!bTime) return -1;

            return new Date(bTime) - new Date(aTime); // Newest first
        });

        // Step 5: Self-healing for missing message previews
        // If we have a timestamp but no message content, fetch it
        const brokenConversations = conversationsWithIndexes.filter(c => {
            const idx = c.conversation_indexes?.[0];
            return idx && idx.last_message_at && !idx.last_message;
        });

        if (brokenConversations.length > 0) {
            await Promise.all(brokenConversations.map(async (conv) => {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('content, created_at, sender_user_id, attachments(id)')
                    .eq('conversation_id', conv.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (msgs && msgs.length > 0) {
                    const msg = msgs[0];
                    const content = msg.content || (msg.attachments && msg.attachments.length > 0 ? '📎 Attachment' : '');
                    
                    // Update local object immediately so UI shows it
                    if (conv.conversation_indexes[0]) {
                        conv.conversation_indexes[0].last_message = content;
                        conv.conversation_indexes[0].last_message_at = msg.created_at;
                        conv.conversation_indexes[0].last_sender_id = msg.sender_user_id;
                    }

                    // Background repair: Persist this fix to the DB index
                    updateConversationIndex(conv.id, content, msg.sender_user_id, msg.created_at).catch(err =>
                        console.error('Failed to auto-repair conversation index:', err)
                    );
                }
            }));
        }

        // Step 6: Enrich with read status
        try {
            // Fetch members and their last_read_at for all these conversations
            const { data: allMembers } = await supabase
                .from('conversation_members')
                .select('conversation_id, user_id, last_read_at')
                .in('conversation_id', conversationsWithIndexes.map(c => c.id));

            conversationsWithIndexes.forEach(conv => {
                const lastMsgAt = conv.conversation_indexes?.[0]?.last_message_at;
                const lastSenderId = conv.conversation_indexes?.[0]?.last_sender_id;

                if (lastMsgAt && lastSenderId === userId) {
                    // For DMs and Teams, check if ANYONE ELSE has read up to lastMsgAt
                    // (Skip for 'everyone' chat to avoid performance issues/noise)
                    if (conv.type !== 'everyone') {
                        const othersRead = allMembers?.filter(m => 
                            m.conversation_id === conv.id && 
                            m.user_id !== userId && 
                            m.last_read_at && 
                            (new Date(m.last_read_at).getTime() + READ_RECEIPT_SKEW_MS >= new Date(lastMsgAt).getTime())
                        );
                        conv.last_message_read_by_others = (othersRead && othersRead.length > 0);
                    } else {
                        conv.last_message_read_by_others = false;
                    }
                } else {
                    conv.last_message_read_by_others = false;
                }
            });

            // Step 7: Fetch exact unread counts
            await Promise.all(conversationsWithIndexes.map(async (conv) => {
                const myMember = allMembers?.find(m => m.conversation_id === conv.id && m.user_id === userId);
                const lastRead = myMember?.last_read_at ? new Date(myMember.last_read_at).getTime() : 0;
                const lastMsgTime = conv.conversation_indexes?.[0]?.last_message_at ? new Date(conv.conversation_indexes[0].last_message_at).getTime() : 0;
                
                if (lastMsgTime > lastRead && conv.conversation_indexes?.[0]?.last_sender_id !== userId) {
                    const { count } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('conversation_id', conv.id)
                        .gt('created_at', new Date(lastRead).toISOString())
                        .neq('sender_user_id', userId);
                    conv.unread_count = count || 0;
                } else {
                    conv.unread_count = 0;
                }
            }));

        } catch (enrichError) {
            console.error('Error enriching conversations with read status:', enrichError);
            conversationsWithIndexes.forEach(conv => {
                conv.last_message_read_by_others = false;
                conv.unread_count = 0;
            });
        }

        return conversationsWithIndexes;
    } catch (error) {
        console.error('Error in getConversationsByCategory:', error);
        return [];
    }
};

/**
 * Get all messages for a specific conversation
 * @param {string} conversationId - ID of the conversation
 * @returns {Promise<Array>} List of messages
 */
export const getConversationMessages = async (conversationId, orgId = null) => {
    try {
        const resolvedOrgId = orgId || localStorage.getItem('org_id');
        
        // 1. Fetch messages
        let query = supabase
            .from('messages')
            .select(`
                *,
                replied_to:messages!reply_to (
                    id,
                    content,
                    sender_id:sender_user_id
                ),
                attachments(*),
                message_reactions (
                    id,
                    reaction,
                    user_id
                )
            `)
            .eq('conversation_id', conversationId);
        
        if (resolvedOrgId) {
            query = query.eq('org_id', resolvedOrgId);
        }
        
        const { data: messages, error } = await query.order('created_at', { ascending: true });
        if (error) throw error;

        // 2. Fetch members and their last_read_at timestamps to calculate "Seen by"
        const { data: members } = await supabase
            .from('conversation_members')
            .select('user_id, last_read_at, profiles(full_name)')
            .eq('conversation_id', conversationId);

        // 3. Enrich messages with read status metadata
        const enrichedMessages = messages.map(msg => {
            const eligibleReaders = (members || []).filter(m => m.user_id !== msg.sender_user_id);
            const requiredReadersCount = eligibleReaders.length;

            const seenBy = eligibleReaders
                .filter(m => m.last_read_at && (new Date(m.last_read_at).getTime() + READ_RECEIPT_SKEW_MS >= new Date(msg.created_at).getTime()))
                .map(m => ({
                    user_id: m.user_id,
                    name: m.profiles?.full_name || 'User',
                    seen_at: m.last_read_at
                }));

            return {
                ...msg,
                seen_by: seenBy,
                required_readers_count: requiredReadersCount,
                is_read_by_others: seenBy.length > 0,
                is_read_by_all: requiredReadersCount > 0 && seenBy.length >= requiredReadersCount
            };
        });

        return enrichedMessages;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
};

/**
 * Send a new message
 * @param {string} conversationId - ID of the conversation
 * @param {string} userId - ID of the sender
 * @param {string} content - Message content
 * @param {Array} files - Optional array of files to attach
 * @returns {Promise<Object>} Created message
 */
export const sendMessage = async (conversationId, userId, content, files = [], orgId = null) => {
    try {
        // Fix: Allow sending files/documents without mandatory text (Issue 6)
        if (!content && (!files || files.length === 0)) {
            throw new Error('Message content or files required');
        }

        // Insert the message
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_user_id: userId,
                sender_type: 'human',
                message_type: 'chat',
                content: content || '',
                org_id: orgId
            })
            .select()
            .single();

        if (messageError) throw messageError;

        // Upload attachments if any
        if (files && files.length > 0) {
            for (const file of files) {
                await uploadAttachment(file, conversationId, message.id, orgId);
            }
        }

        // Update conversation index
        const indexMessage = content || (files && files.length > 0 ? '📎 Attachment' : '');
        await updateConversationIndex(conversationId, indexMessage, userId);

        // Message notifications are handled by the database trigger.
        // Keeping client-side inserts here causes duplicate notifications.

        return message;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

/**
 * Upload a file attachment to Supabase Storage
 * @param {File} file - File to upload
 * @param {string} conversationId - ID of the conversation
 * @param {string} messageId - ID of the message
 * @returns {Promise<Object>} Attachment metadata
 */
export const uploadAttachment = async (file, conversationId, messageId, orgId = null) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${conversationId}/${fileName}`;

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('message-attachments')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(filePath);

        // Insert attachment metadata
        const { data: attachment, error: attachmentError } = await supabase
            .from('attachments')
            .insert({
                message_id: messageId,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size,
                storage_path: filePath,
                url: publicUrl,
                org_id: orgId
            })
            .select()
            .single();

        if (attachmentError) throw attachmentError;

        return attachment;
    } catch (error) {
        console.error('Error uploading attachment:', error);
        throw error;
    }
};

/**
 * Update conversation index with last message
 * @param {string} conversationId - ID of the conversation
 * @param {string} lastMessage - Last message content
 * @param {string} lastSenderId - ID of the sender (Issue: Blue ticks outside)
 */
export const updateConversationIndex = async (conversationId, lastMessage, lastSenderId, lastMessageAt = null) => {
    try {
        const { error } = await supabase
            .from('conversation_indexes')
            .upsert(
                {
                    conversation_id: conversationId,
                    last_message: lastMessage,
                    last_sender_id: lastSenderId,
                    last_message_at: lastMessageAt || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: 'conversation_id',
                    ignoreDuplicates: false
                }
            );

        if (error) throw error;
    } catch (error) {
        console.error('Error updating conversation index:', error);
        throw error;
    }
};

/**
 * Create a new DM conversation
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Created conversation
 */
export const createDMConversation = async (userId1, userId2, orgId) => {
    try {
        // Strategy: Find existing DM between these two users regardless of org_id or context

        // 1. Get all conversation IDs for User 1
        const { data: user1Convs } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', userId1);

        const candidateIds = user1Convs?.map(c => c.conversation_id) || [];

        if (candidateIds.length > 0) {
            // 2. Search for a DM conversation in these candidates that ALSO includes User 2
            const { data: existingDM } = await supabase
                .from('conversations')
                .select(`
                    *,
                    conversation_members!inner(user_id)
                `)
                .in('id', candidateIds) // Must be one of User 1's conversations
                .eq('type', 'dm')       // Must be a DM
                .eq('conversation_members.user_id', userId2) // Must include User 2 (inner join filters for this)
                .maybeSingle();

            if (existingDM) {
                console.log('Found existing DM:', existingDM.id);
                return existingDM;
            }
        }

        console.log('Creating new DM conversation...');

        // Create new DM conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'dm',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add both users as members
        const { error: membersError } = await supabase
            .from('conversation_members')
            .insert([
                { conversation_id: conversation.id, user_id: userId1 },
                { conversation_id: conversation.id, user_id: userId2 }
            ]);

        if (membersError) throw membersError;

        return conversation;
    } catch (error) {
        console.error('Error creating DM conversation:', error);
        throw error;
    }
};

/**
 * Create a Team conversation
 * @param {string} creatorId - User creating the team chat
 * @param {Array} memberIds - Array of user IDs to add to team
 * @param {string} teamName - Name of the team chat
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Created conversation
 */
export const createTeamConversation = async (creatorId, memberIds, teamName, orgId) => {
    try {
        // Create team conversation with creator tracking
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'team',
                name: teamName,
                created_by: creatorId,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add all members including creator
        const allMembers = [...new Set([creatorId, ...memberIds])];
        const memberInserts = allMembers.map(userId => ({
            conversation_id: conversation.id,
            user_id: userId,
            is_admin: userId === creatorId // Creator is automatically admin
        }));

        const { error: membersError } = await supabase
            .from('conversation_members')
            .insert(memberInserts);

        if (membersError) throw membersError;

        return conversation;
    } catch (error) {
        console.error('Error creating team conversation:', error);
        throw error;
    }
};

/**
 * Get or create organization-wide conversation
 * @param {string} userId - Current user's ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Organization conversation
 */
export const getOrCreateOrgConversation = async (userId, orgId) => {
    try {
        // Check if org conversation exists
        const { data: existing } = await supabase
            .from('conversations')
            .select('*')
            .eq('type', 'everyone')
            .eq('org_id', orgId)
            .maybeSingle();

        if (existing) {
            // Make sure user is a member
            const { data: membership } = await supabase
                .from('conversation_members')
                .select('id')
                .eq('conversation_id', existing.id)
                .eq('user_id', userId)
                .maybeSingle();

            if (!membership) {
                await supabase
                    .from('conversation_members')
                    .insert({ conversation_id: existing.id, user_id: userId });
            }

            return existing;
        }

        // Create new org-wide conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                org_id: orgId,
                type: 'everyone',
                name: 'Company Chat',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (convError) throw convError;

        // Add creator as first member
        await supabase
            .from('conversation_members')
            .insert({ conversation_id: conversation.id, user_id: userId });

        return conversation;
    } catch (error) {
        console.error('Error getting/creating org conversation:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time updates for a conversation
 * @param {string} conversationId - ID of the conversation
 * @param {Function} callback - Callback function for new messages
 * @returns {Object} Subscription object
 */
export const subscribeToConversation = (conversationId, callbacks) => {
    const { onMessage, onReaction, onPollUpdate, onPresence } = typeof callbacks === 'function'
        ? { onMessage: callbacks }
        : callbacks;

    // Use a more robust channel and subscribe to all postgres changes for the messages table
    const subscription = supabase
        .channel(`conversation:${conversationId}`, {
            config: {
                presence: {
                    key: conversationId,
                },
            },
        })
        .on(
            'postgres_changes',
            {
                event: '*', // Listen to INSERT, UPDATE, DELETE 
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            },
            async (payload) => {
                if (payload.eventType === 'INSERT') {
                    if (onMessage) onMessage(payload.new);
                } else if (payload.eventType === 'UPDATE') {
                    // Handle message edits/deletes in real-time
                    if (callbacks.onMessageUpdate) callbacks.onMessageUpdate(payload.new);
                }
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'message_reactions'
            },
            (payload) => {
                if (onReaction) onReaction(payload.new || payload.old);
            }
        )
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'poll_votes'
            },
            (payload) => {
                if (onPollUpdate) onPollUpdate(payload.new || payload.old);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'conversation_members',
                filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
                if (callbacks.onReadReceipt) callbacks.onReadReceipt(payload.new);
            }
        );

    // Support for Presence 
    if (onPresence) {
        subscription.on('presence', { event: 'sync' }, () => {
            const state = subscription.presenceState();
            onPresence(state);
        });
    }

    subscription.subscribe();
    return subscription;
};

/**
 * Unsubscribe from real-time updates
 * @param {Object} subscription - Subscription object to unsubscribe
 */
export const unsubscribeFromConversation = async (subscription) => {
    if (subscription) {
        await supabase.removeChannel(subscription);
    }
};

/**
 * Get user details for conversation display
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User details
 */
export const getUserDetails = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, full_name, avatar_url')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching user details:', error);
        return null;
    }
};

/**
 * Get all users in the organization for starting new DMs
 * @param {string} orgId - Organization ID
 * @returns {Promise<Array>} List of users
 */
export const getOrgUsers = async (orgId) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, role')
            .eq('org_id', orgId)
            .order('full_name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching org users:', error);
        return [];
    }
};

/**
 * ============================================
 * GROUP ADMIN FUNCTIONS
 * ============================================
 */

/**
 * Check if a user is an admin of a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user is admin
 */
export const isConversationAdmin = async (conversationId, userId) => {
    try {
        const { data, error } = await supabase
            .from('conversation_members')
            .select('is_admin')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data?.is_admin || false;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

/**
 * Get all members of a conversation with their admin status
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array>} List of members with admin status
 */
export const getConversationMembers = async (conversationId) => {
    try {
        const { data: memberData, error: memberError } = await supabase
            .from('conversation_members')
            .select('user_id, is_admin')
            .eq('conversation_id', conversationId);

        if (memberError) throw memberError;

        if (!memberData || memberData.length === 0) return [];

        const userIds = memberData.map(m => m.user_id);
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, role')
            .in('id', userIds);

        if (profileError) throw profileError;

        return memberData.map(member => {
            const profile = profileData.find(p => p.id === member.user_id) || {};
            return {
                id: member.user_id,
                user_id: member.user_id,
                is_admin: member.is_admin || false,
                email: profile.email || '',
                full_name: profile.full_name || 'Unknown User',
                avatar_url: profile.avatar_url || null,
                role: profile.role || ''
            };
        });
    } catch (error) {
        console.error('Error in getConversationMembers:', error);
        return [];
    }
};

/**
 * Get conversation members IDs only
 */
export const getConversationMemberIds = async (conversationId) => {
    try {
        const { data, error } = await supabase
            .from('conversation_members')
            .select('user_id')
            .eq('conversation_id', conversationId);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching member IDs:', error);
        return [];
    }
};

/**
 * Add member to conversation
 */
export const addMemberToConversation = async (conversationId, userId, adminId) => {
    try {
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) throw new Error('Only admins can add members');

        const { data, error } = await supabase
            .from('conversation_members')
            .insert({ conversation_id: conversationId, user_id: userId, is_admin: false })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding member:', error);
        throw error;
    }
};

/**
 * Promote member to admin
 */
export const promoteMemberToAdmin = async (conversationId, userIdToPromote, adminId) => {
    try {
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) throw new Error('Only admins can promote members');

        const { error } = await supabase
            .from('conversation_members')
            .update({ is_admin: true })
            .eq('conversation_id', conversationId)
            .eq('user_id', userIdToPromote);

        if (error) throw error;
    } catch (error) {
        console.error('Error promoting member:', error);
        throw error;
    }
};

/**
 * Demote member from admin
 */
export const demoteMemberFromAdmin = async (conversationId, userIdToDemote, adminId) => {
    try {
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) throw new Error('Only admins can demote members');

        const { error } = await supabase
            .from('conversation_members')
            .update({ is_admin: false })
            .eq('conversation_id', conversationId)
            .eq('user_id', userIdToDemote);

        if (error) throw error;
    } catch (error) {
        console.error('Error demoting member:', error);
        throw error;
    }
};

/**
 * Remove member from conversation
 */
export const removeMemberFromConversation = async (conversationId, userIdToRemove, adminId) => {
    try {
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) throw new Error('Only admins can remove members');

        const { error } = await supabase
            .from('conversation_members')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', userIdToRemove);

        if (error) throw error;
    } catch (error) {
        console.error('Error removing member:', error);
        throw error;
    }
};

/**
 * Rename conversation
 */
export const renameConversation = async (conversationId, newName, adminId) => {
    try {
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) throw new Error('Only admins can rename');

        const { error } = await supabase
            .from('conversations')
            .update({ name: newName.trim() })
            .eq('id', conversationId);

        if (error) throw error;
    } catch (error) {
        console.error('Error renaming conversation:', error);
        throw error;
    }
};

/**
 * Delete conversation
 */
export const deleteConversation = async (conversationId, adminId) => {
    try {
        const isAdmin = await isConversationAdmin(conversationId, adminId);
        if (!isAdmin) throw new Error('Only admins can delete');

        // Clean up everything child-first
        const { data: messages } = await supabase.from('messages').select('id').eq('conversation_id', conversationId);
        const ids = messages?.map(m => m.id) || [];
        
        if (ids.length > 0) {
            await supabase.from('poll_votes').delete().in('message_id', ids);
            await supabase.from('message_reactions').delete().in('message_id', ids);
            await supabase.from('attachments').delete().in('message_id', ids);
            await supabase.from('messages').update({ reply_to: null }).in('id', ids);
            await supabase.from('messages').delete().eq('conversation_id', conversationId);
        }

        await supabase.from('conversation_members').delete().eq('conversation_id', conversationId);
        await supabase.from('conversation_indexes').delete().eq('conversation_id', conversationId);
        const { error } = await supabase.from('conversations').delete().eq('id', conversationId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting conversation:', error);
        throw error;
    }
};

/**
 * Leave conversation
 */
export const leaveConversation = async (conversationId, userId) => {
    try {
        const { error } = await supabase
            .from('conversation_members')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
        if (error) throw error;
    } catch (error) {
        console.error('Error leaving conversation:', error);
        throw error;
    }
};

/**
 * ============================================
 * MESSAGE REPLIES & REACTIONS FUNCTIONS
 * ============================================
 */

/**
 * Send a message with optional reply
 */
export const sendMessageWithReply = async (conversationId, content, senderId, replyToId = null, repliedContent = null, repliedSender = null, orgId = null) => {
    try {
        const { data: message, error } = await supabase
            .from('messages')
            .insert([{
                conversation_id: conversationId,
                content: content,
                sender_user_id: senderId,
                reply_to: replyToId,
                replied_message_content: repliedContent,
                replied_message_sender_name: repliedSender,
                org_id: orgId
            }])
            .select()
            .single();

        if (error) throw error;
        await updateConversationIndex(conversationId, content || '📎 Attachment', senderId);
        return message;
    } catch (error) {
        console.error('Error sending message with reply:', error);
        throw error;
    }
};

/**
 * Extract mentions from content
 */
export const extractMentions = (content, members = []) => {
    if (!content) return [];
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)|@\[([^\]]+)\]|@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
        if (match[2]) mentions.push(match[2]);
        else if (match[3]) {
            const m = members.find(m => (m.full_name || '').toLowerCase() === match[3].toLowerCase());
            if (m) mentions.push(m.id);
        }
    }
    return [...new Set(mentions)];
};

/**
 * Hydrate message details
 */
export const hydrateMessage = async (messageId) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select(`*, replied_to:messages!reply_to (id, content, sender_id:sender_user_id), attachments(*), message_reactions (id, reaction, user_id)`)
            .eq('id', messageId)
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error hydrating message:', error);
        throw error;
    }
};

/**
 * Delete message for everyone
 */
export const deleteMessageForEveryone = async (messageId) => {
    try {
        const { error } = await supabase
            .from('messages')
            .update({ content: 'This message was deleted', is_deleted: true })
            .eq('id', messageId);
        if (error) throw error;
        await supabase.from('attachments').delete().eq('message_id', messageId);
    } catch (error) {
        console.error('Error deleting message for everyone:', error);
        throw error;
    }
};

/**
 * Delete message for me
 */
export const deleteMessageForMe = async (messageId, userId) => {
    try {
        const { data: currentMsg } = await supabase.from('messages').select('deleted_for').eq('id', messageId).single();
        const currentDeletedFor = currentMsg?.deleted_for || [];
        if (!currentDeletedFor.includes(userId)) {
            await supabase.from('messages').update({ deleted_for: [...currentDeletedFor, userId] }).eq('id', messageId);
        }
    } catch (error) {
        console.error('Error deleting message for me:', error);
        throw error;
    }
};

/**
 * Mark as read
 */
export const markAsReadInDB = async (conversationId, userId, timestampStr = null) => {
    try {
        const timeToSet = timestampStr || new Date().toISOString();
        const { error } = await supabase
            .from('conversation_members')
            .update({ last_read_at: timeToSet })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId);
        if (error) throw error;
    } catch (error) {
        console.error('Error marking read:', error);
    }
};

/**
 * Get message with reply context
 */
export const getMessageWithReply = async (messageId) => {
    try {
        const { data, error } = await supabase.rpc('get_message_with_reply', { message_id: messageId });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching message with reply:', error);
        return null;
    }
};

/**
 * Add reaction
 */
export const addReaction = async (messageId, userId, reaction, orgId = null) => {
    try {
        const insertData = { message_id: messageId, user_id: userId, reaction };
        if (orgId) insertData.org_id = orgId;
        const { data, error } = await supabase.from('message_reactions').insert([insertData]).select().single();
        if (error && error.code !== '23505') throw error;
        return data;
    } catch (error) {
        console.error('Error adding reaction:', error);
        throw error;
    }
};

/**
 * Remove reaction
 */
export const removeReaction = async (messageId, userId, reaction, orgId = null) => {
    try {
        let query = supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId).eq('reaction', reaction);
        if (orgId) query = query.eq('org_id', orgId);
        const { error } = await query;
        if (error) throw error;
    } catch (error) {
        console.error('Error removing reaction:', error);
        throw error;
    }
};

/**
 * Toggle reaction
 */
export const toggleReaction = async (messageId, userId, reaction, orgId = null) => {
    try {
        let query = supabase.from('message_reactions').select('id').eq('message_id', messageId).eq('user_id', userId).eq('reaction', reaction);
        if (orgId) query = query.eq('org_id', orgId);
        const { data } = await query.maybeSingle();
        if (data) {
            await removeReaction(messageId, userId, reaction, orgId);
            return { action: 'removed' };
        } else {
            await addReaction(messageId, userId, reaction, orgId);
            return { action: 'added' };
        }
    } catch (error) {
        console.error('Error toggling reaction:', error);
        throw error;
    }
};

/**
 * Edit message
 */
export const editMessage = async (messageId, newContent, userId) => {
    try {
        const { data: msg } = await supabase.from('messages').select('sender_user_id, created_at').eq('id', messageId).single();
        if (msg.sender_user_id !== userId) throw new Error('Not owner');
        const { data, error } = await supabase.from('messages').update({ content: newContent, is_edited: true, updated_at: new Date().toISOString() }).eq('id', messageId).select().single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error editing message:', error);
        throw error;
    }
};

/**
 * Typing status
 */
export const sendTypingStatus = async (channel, userId, isTyping) => {
    if (!channel) return;
    try {
        await channel.track({ user_id: userId, is_typing: isTyping, online_at: new Date().toISOString() });
    } catch (error) {
        console.error('Error tracking typing status:', error);
    }
};

/**
 * User status
 */
export const updateUserStatus = async (userId, status) => {
    try {
        const statusMap = { available: 'Green', break: 'Orange', absent: 'Red' };
        await supabase.from('profiles').update({ online_status: statusMap[status] || 'Green', last_seen_at: new Date().toISOString() }).eq('id', userId);
    } catch (error) {
        console.error('Error updating status:', error);
    }
};

/**
 * Get reactions
 */
export const getMessageReactions = async (messageId) => {
    try {
        const { data, error } = await supabase.from('message_reactions').select(`id, reaction, user_id, created_at, profiles:user_id (full_name, email, avatar_url)`).eq('message_id', messageId).order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching reactions:', error);
        return [];
    }
};

/**
 * Reaction summary
 */
export const getReactionSummary = async (messageId) => {
    try {
        const reactions = await getMessageReactions(messageId);
        const summary = {};
        reactions.forEach(r => {
            if (!summary[r.reaction]) summary[r.reaction] = { count: 0, users: [] };
            summary[r.reaction].count++;
            summary[r.reaction].users.push({ user_id: r.user_id, name: r.profiles?.full_name || 'Unknown' });
        });
        return summary;
    } catch (error) {
        console.error('Error getting reaction summary:', error);
        return {};
    }
};

/**
 * Poll functions
 */
export const sendPoll = async (conversationId, senderId, question, options, allowMultiple = false, orgId = null) => {
    try {
        const { data, error } = await supabase.from('messages').insert([{ conversation_id: conversationId, sender_user_id: senderId, content: question, message_type: 'poll', is_poll: true, poll_question: question, poll_options: options, allow_multiple_answers: allowMultiple, org_id: orgId }]).select().single();
        if (error) throw error;
        await updateConversationIndex(conversationId, `📊 Poll: ${question}`);
        return data;
    } catch (error) {
        console.error('Error sending poll:', error);
        throw error;
    }
};

export const voteInPoll = async (messageId, userId, optionIndex, allowMultiple = false, orgId = null) => {
    try {
        if (!allowMultiple) {
            await supabase.from('poll_votes').delete().eq('message_id', messageId).eq('user_id', userId);
        }
        const { data: existing } = await supabase.from('poll_votes').select('id').eq('message_id', messageId).eq('user_id', userId).eq('option_index', optionIndex).maybeSingle();
        if (existing) await supabase.from('poll_votes').delete().eq('id', existing.id);
        else await supabase.from('poll_votes').insert([{ message_id: messageId, user_id: userId, option_index: optionIndex, org_id: orgId }]);
    } catch (error) {
        console.error('Error voting:', error);
        throw error;
    }
};

export const getPollVotes = async (messageId, orgId = null) => {
    try {
        let query = supabase.from('poll_votes').select(`*, profiles:user_id (full_name, email, avatar_url)`).eq('message_id', messageId);
        if (orgId) query = query.eq('org_id', orgId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching votes:', error);
        return [];
    }
};
