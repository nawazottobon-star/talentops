import React, { useState, useEffect, useRef } from 'react';
import {
    getConversationsByCategory,
    getConversationMessages,
    sendMessage,
    subscribeToConversation,
    unsubscribeFromConversation,
    getUserDetails,
    getOrgUsers,
    createDMConversation,
    createTeamConversation,
    getOrCreateOrgConversation,
    isConversationAdmin,
    getConversationMembers,
    addMemberToConversation,
    removeMemberFromConversation,
    promoteMemberToAdmin,
    demoteMemberFromAdmin,
    renameConversation,
    deleteConversation,
    leaveConversation,
    sendMessageWithReply,
    toggleReaction,
    getReactionSummary,
    uploadAttachment,
    sendPoll,
    voteInPoll,
    getPollVotes,
    // New imports
    fetchCurrentUserWithProfile,
    subscribeToAuthChanges,
    hydrateMessage,
    deleteMessageForEveryone,
    deleteMessageForMe,
    getConversationMemberIds,
    editMessage,
    updateConversationIndex
} from '../../services/messageService';
import { sendNotification, sendBulkNotifications } from '../../services/notificationService';
import { useMessages } from './context/MessageContext';
import { supabase } from '../../lib/supabaseClient';
import './MessagingHub.css';

// Child components
import Sidebar from './messaging/Sidebar';
import ChatWindow from './messaging/ChatWindow';
import Composer from './messaging/Composer';

const READ_RECEIPT_SKEW_MS = 5000;

const MessagingHub = () => {
    // ══════════════════════════════════════════════
    //  SHARED STATE – stays in orchestrator
    // ══════════════════════════════════════════════
    const [activeCategory, setActiveCategory] = useState('myself');
    const [conversations, setConversations] = useState([]);
    const [conversationCache, setConversationCache] = useState({});
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [currentUserOrgId, setCurrentUserOrgId] = useState(null);
    const [orgUsers, setOrgUsers] = useState([]);
    const [errorMessage, setErrorMessage] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const { markAsRead, lastReadTimes, lastIncomingMessage, lastMemberReadUpdate } = useMessages();
    const [currentMembers, setCurrentMembers] = useState([]);
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);

    // Reply & Reaction shared state (needed by both ChatWindow and Composer)
    const [replyingTo, setReplyingTo] = useState(null);
    const [messageReactions, setMessageReactions] = useState({});
    const [allPollVotes, setAllPollVotes] = useState({});
    const isReacting = useRef(false);

    // ══════════════════════════════════════════════
    //  AUTH & DATA LOADING
    // ══════════════════════════════════════════════

    const loadOrgUsers = async (orgId) => {
        try {
            const users = await getOrgUsers(orgId);
            setOrgUsers(users);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    // Get current user from Supabase auth
    useEffect(() => {
        const fetchCurrentUser = async () => {
            setAuthLoading(true);
            try {
                const result = await fetchCurrentUserWithProfile();
                if (result) {
                    const { user, orgId, role } = result;
                    setCurrentUserId(user.id);
                    setCurrentUserOrgId(orgId);
                    setCurrentUserRole(role);
                    loadOrgUsers(orgId);
                }
            } catch (err) {
                console.error('Error fetching current user:', err);
            } finally {
                setAuthLoading(false);
            }
        };

        fetchCurrentUser();

        const subscription = subscribeToAuthChanges((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) fetchCurrentUser();
            else if (event === 'SIGNED_OUT') {
                setCurrentUserId(null);
                setCurrentUserRole(null);
                setCurrentUserOrgId(null);
            }
        });
        return () => subscription?.unsubscribe();
    }, []);

    // Reload conversations on global incoming message
    const selectedConversationRef = useRef(selectedConversation);
    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    const isReadAtOrAfterMessage = (readAt, messageAt) => {
        if (!readAt || !messageAt) return false;
        return new Date(readAt).getTime() + READ_RECEIPT_SKEW_MS >= new Date(messageAt).getTime();
    };

    const syncConversationReadState = (conversationId, readerId, readAt) => {
        setConversations(prevConvs => prevConvs.map(c => {
            if (c.id !== conversationId) return c;

            const index = c.conversation_indexes?.[0];
            const isLastMessageMine = index?.last_sender_id === currentUserIdRef.current;
            const wasRead = isLastMessageMine && readerId !== currentUserIdRef.current && isReadAtOrAfterMessage(readAt, index?.last_message_at);

            return {
                ...c,
                last_message_read_by_others: wasRead
            };
        }));
    };

    const syncVisibleMessageReadState = (conversationId, readerId, readAt) => {
        setMessages(prevMessages => prevMessages.map(msg => {
            if (selectedConversationRef.current?.id !== conversationId) return msg;
            if (msg.sender_user_id !== currentUserIdRef.current) return msg;

            const wasRead = readerId !== currentUserIdRef.current && isReadAtOrAfterMessage(readAt, msg.created_at);
            if (!wasRead) return msg;

            const existingSeenBy = Array.isArray(msg.seen_by) ? msg.seen_by : [];
            const alreadyTracked = existingSeenBy.some(seen => seen.user_id === readerId);
            const nextSeenBy = alreadyTracked
                ? existingSeenBy.map(seen => seen.user_id === readerId ? { ...seen, seen_at: readAt } : seen)
                : [...existingSeenBy, { user_id: readerId, name: 'Seen', seen_at: readAt }];

            return {
                ...msg,
                is_read_by_others: true,
                seen_by: nextSeenBy
            };
        }));
    };

    const syncSelectedConversationMessages = async (conversationId) => {
        try {
            const msgs = await getConversationMessages(conversationId, currentUserOrgId);
            setMessages(msgs);

            const latestMessage = msgs[msgs.length - 1];
            if (latestMessage?.sender_user_id === currentUserIdRef.current) {
                setConversations(prevConvs => prevConvs.map(c =>
                    c.id === conversationId
                        ? { ...c, last_message_read_by_others: Boolean(latestMessage.is_read_by_others) }
                        : c
                ));
            }
        } catch (err) {
            console.error('Failed to sync active chat:', err);
        }
    };

    useEffect(() => {
        if (lastIncomingMessage && currentUserId) {
            setConversationCache(prev => {
                const newCache = { ...prev };
                delete newCache[activeCategory];
                return newCache;
            });
            loadConversations();

            // INSTANT SYNC: If the message belongs to the current chat window, fetch the messages
            const activeConv = selectedConversationRef.current;
            if (activeConv && activeConv.id === lastIncomingMessage.conversation_id) {
                // If the message is from current user, we already have it.
                // If it's from someone else, we likely got it from onMessage realtime already.
                // We only refetch if the current state doesn't have it to minimize jumping.
                setMessages(prev => {
                    const hasIt = prev.some(m => m.id === lastIncomingMessage.id);
                    if (!hasIt) {
                        syncSelectedConversationMessages(activeConv.id);
                    }
                    return prev;
                });
                markAsRead(activeConv.id);
            }
        }
    }, [lastIncomingMessage]);

    // Load conversations when category changes
    useEffect(() => {
        if (currentUserId) loadConversations();
    }, [activeCategory, currentUserId]);

    // Re-resolve conversation names once orgUsers finishes loading
    // (fixes race condition where loadConversations runs before orgUsers is populated)
    useEffect(() => {
        if (currentUserId && orgUsers.length > 0) {
            setConversationCache({});  // invalidate all cached names
            loadConversations();
        }
    }, [orgUsers]);

    // ── Poll for read receipts: check if receiver has seen messages in the open chat ──
    // This is required because Supabase filtered realtime subscriptions on conversation_members
    // require REPLICA IDENTITY FULL which may not be configured.
    useEffect(() => {
        if (!selectedConversation?.id || !currentUserId) return;

        const convId = selectedConversation.id;
        let lastKnownReadAt = null;

        const checkReadStatus = async () => {
            try {
                const { data: members } = await supabase
                    .from('conversation_members')
                    .select('user_id, last_read_at')
                    .eq('conversation_id', convId)
                    .neq('user_id', currentUserId);

                if (!members || members.length === 0) return;

                // Find the latest read timestamp among all OTHER members
                const latestRead = members.reduce((max, m) => {
                    if (!m.last_read_at) return max;
                    const t = new Date(m.last_read_at).getTime();
                    return t > max ? t : max;
                }, 0);

                // Only refresh messages if the read timestamp has advanced since last check
                if (latestRead > 0 && latestRead !== lastKnownReadAt) {
                    lastKnownReadAt = latestRead;
                    await syncSelectedConversationMessages(convId);

                    const readerWithLatestTimestamp = members.find(m => new Date(m.last_read_at || 0).getTime() === latestRead);
                    if (readerWithLatestTimestamp?.user_id) {
                        syncConversationReadState(convId, readerWithLatestTimestamp.user_id, readerWithLatestTimestamp.last_read_at);
                        syncVisibleMessageReadState(convId, readerWithLatestTimestamp.user_id, readerWithLatestTimestamp.last_read_at);
                    }
                }
            } catch (err) {
                console.error('Error polling read status:', err);
            }
        };

        // Poll every 5 seconds while this conversation is open
        const interval = setInterval(checkReadStatus, 5000);
        // Also run immediately when conversation opens
        checkReadStatus();

        return () => clearInterval(interval);
    }, [selectedConversation?.id, currentUserId]);

    useEffect(() => {
        if (!lastMemberReadUpdate?.conversation_id || !selectedConversation?.id) return;
        if (lastMemberReadUpdate.conversation_id !== selectedConversation.id) return;
        if (lastMemberReadUpdate.user_id === currentUserId) return;

        syncConversationReadState(
            lastMemberReadUpdate.conversation_id,
            lastMemberReadUpdate.user_id,
            lastMemberReadUpdate.last_read_at
        );
        syncVisibleMessageReadState(
            lastMemberReadUpdate.conversation_id,
            lastMemberReadUpdate.user_id,
            lastMemberReadUpdate.last_read_at
        );
        syncSelectedConversationMessages(lastMemberReadUpdate.conversation_id);
    }, [lastMemberReadUpdate, selectedConversation?.id, currentUserId]);

    // Subscribe to real-time updates for selected conversation
    const currentUserIdRef = useRef(currentUserId);
    currentUserIdRef.current = currentUserId;
    const selectedConvIdRef = useRef(null);

    useEffect(() => {
        let subscription = null;
        const convId = selectedConversation?.id;

        // Only re-subscribe if the conversation ID actually changed
        if (convId && convId !== selectedConvIdRef.current) {
            selectedConvIdRef.current = convId;
        }

        if (convId) {
            subscription = subscribeToConversation(convId, {
                onMessage: async (newMessage) => {
                    // Skip messages sent by current user — already added by handleSendMessage
                    if (newMessage.sender_user_id === currentUserIdRef.current) return;
                    try {
                        const fullMsg = await hydrateMessage(newMessage.id);
                        if (fullMsg) {
                            setMessages(prev => {
                                if (prev.some(msg => msg.id === fullMsg.id)) return prev;
                                const newMessages = [...prev, fullMsg];
                                // Sort by created_at then ID
                                return newMessages.sort((a, b) => {
                                    // Use string comparison for perfect microsecond precision
                                    const timeCompare = (a.created_at || '').localeCompare(b.created_at || '');
                                    if (timeCompare !== 0) return timeCompare;
                                    return (a.id || '').localeCompare(b.id || '');
                                });
                            });
                            setConversations(prevConvs => {
                                const updated = prevConvs.map(c => {
                                    if (c.id === convId) {
                                        return {
                                            ...c,
                                            conversation_indexes: [{
                                                ...(c.conversation_indexes?.[0] || {}),
                                                last_message: fullMsg.content || 'Attachment',
                                                last_message_at: fullMsg.created_at,
                                                last_sender_id: fullMsg.sender_user_id
                                            }],
                                            last_message_read_by_others: false
                                        };
                                    }
                                    return c;
                                });
                                return updated.sort((a, b) => {
                                    const tA = a.conversation_indexes?.[0]?.last_message_at;
                                    const tB = b.conversation_indexes?.[0]?.last_message_at;
                                    if (!tA && !tB) return 0;
                                    if (!tA) return 1;
                                    if (!tB) return -1;
                                    return new Date(tB).getTime() - new Date(tA).getTime();
                                });
                            });
                            markAsRead(convId);
                        }
                    } catch (err) {
                        console.error('Error handling realtime message:', err);
                    }
                },
                onMessageUpdate: (updatedMessage) => {
                    setMessages(prev => prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m));
                    if (updatedMessage.is_deleted) {
                         setConversations(prevConvs => prevConvs.map(c => {
                             if (c.id === updatedMessage.conversation_id) {
                                 return { ...c, conversation_indexes: [{ last_message: 'This message was deleted', last_message_at: updatedMessage.updated_at || updatedMessage.created_at }] };
                             }
                             return c;
                         }));
                    }
                },
                onReaction: async (payload) => {
                    const msgId = payload?.message_id;
                    const userId = payload?.user_id;
                    if (userId === currentUserIdRef.current && isReacting.current) return;
                    if (msgId) {
                        try {
                            const summary = await getReactionSummary(msgId);
                            setMessageReactions(prev => ({ ...prev, [msgId]: summary }));
                        } catch (err) {
                            console.error('Error handling realtime reaction:', err);
                        }
                    }
                },
                onPollUpdate: (payload) => {
                    if (payload.message_id) fetchPollVotes(payload.message_id);
                },
                onReadReceipt: (payload) => {
                    console.log('Realtime read receipt received:', payload);
                    if (payload.user_id !== currentUserIdRef.current) {
                        syncConversationReadState(convId, payload.user_id, payload.last_read_at);
                        syncVisibleMessageReadState(convId, payload.user_id, payload.last_read_at);
                        syncSelectedConversationMessages(convId);
                    }
                },
                onPresence: (presenceState) => {
                    const typingUsers = [];
                    Object.values(presenceState).forEach(presences => {
                        presences.forEach(p => {
                            if (p.is_typing && p.user_id !== currentUserIdRef.current) {
                                typingUsers.push(p.user_id);
                            }
                        });
                    });
                    // You could set state here to show "X is typing..."
                }
            });
        }
        return () => {
            if (subscription) unsubscribeFromConversation(subscription);
            selectedConvIdRef.current = null;
        };
    }, [selectedConversation?.id]);

    // ══════════════════════════════════════════════
    //  CORE DATA FUNCTIONS
    // ══════════════════════════════════════════════

    const loadIdRef = useRef(0);
    const loadConversations = async () => {
        if (!currentUserId) return;
        const thisLoadId = ++loadIdRef.current;
        if (conversationCache[activeCategory]) {
            // Sort cached data too, to ensure correct order
            const cached = [...conversationCache[activeCategory]].sort((a, b) => {
                const tA = a.conversation_indexes?.[0]?.last_message_at;
                const tB = b.conversation_indexes?.[0]?.last_message_at;
                if (!tA && !tB) return 0;
                if (!tA) return 1;
                if (!tB) return -1;
                return new Date(tB).getTime() - new Date(tA).getTime();
            });
            setConversations(cached);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const convs = await getConversationsByCategory(currentUserId, activeCategory, currentUserOrgId);
            if (thisLoadId !== loadIdRef.current) return; // Stale call, discard
            let finalConvs = convs;
            if (activeCategory === 'myself') {
                const convsWithNames = await Promise.all(convs.map(async (conv) => {
                    if (conv.type === 'dm' && !conv.name) {
                        const members = await getConversationMemberIds(conv.id);
                        const otherUserId = members?.find(m => m.user_id !== currentUserId)?.user_id;
                        if (otherUserId) {
                            const otherUser = orgUsers.find(u => u.id === otherUserId);
                            if (otherUser) return { ...conv, name: otherUser.full_name || otherUser.email, avatar_url: otherUser.avatar_url };
                            try {
                                const userDetails = await getUserDetails(otherUserId);
                                return { ...conv, name: userDetails?.full_name || userDetails?.email || 'Unknown User', avatar_url: userDetails?.avatar_url };
                            } catch { return { ...conv, name: 'Unknown User' }; }
                        }
                    }
                    return conv;
                }));
                finalConvs = convsWithNames;
            }
            if (thisLoadId !== loadIdRef.current) return; // Stale call, discard
            // Sort by most recent message first
            finalConvs.sort((a, b) => {
                const tA = a.conversation_indexes?.[0]?.last_message_at;
                const tB = b.conversation_indexes?.[0]?.last_message_at;
                if (!tA && !tB) return 0;
                if (!tA) return 1;
                if (!tB) return -1;
                return new Date(tB).getTime() - new Date(tA).getTime();
            });
            setConversations(finalConvs);
            setConversationCache(prev => ({ ...prev, [activeCategory]: finalConvs }));
        } catch (error) {
            console.error('Error loading conversations:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (conversation) => {
        setSelectedConversation(conversation);
        setLoading(true);
        markAsRead(conversation.id);
        try {
            const msgs = await getConversationMessages(conversation.id, currentUserOrgId);
            setMessages(msgs);
            const latestMessage = msgs[msgs.length - 1];
            if (latestMessage?.sender_user_id === currentUserId) {
                setConversations(prevConvs => prevConvs.map(c =>
                    c.id === conversation.id
                        ? { ...c, last_message_read_by_others: Boolean(latestMessage.is_read_by_others) }
                        : c
                ));
            }
            msgs.filter(m => m.is_poll).forEach(m => fetchPollVotes(m.id));
            const reactionsMap = {};
            msgs.forEach(msg => {
                if (msg.message_reactions?.length > 0) {
                    const summary = {};
                    msg.message_reactions.forEach(r => {
                        if (!summary[r.reaction]) summary[r.reaction] = { count: 0, users: [] };
                        summary[r.reaction].count++;
                        const user = orgUsers.find(u => u.id === r.user_id);
                        summary[r.reaction].users.push({ user_id: r.user_id, name: user?.full_name || user?.email || 'Unknown User' });
                    });
                    reactionsMap[msg.id] = summary;
                }
            });
            setMessageReactions(reactionsMap);

            // Fetch conversation members for notifications
            try {
                if (conversation.type === 'everyone') {
                    setCurrentMembers(orgUsers.map(u => ({ ...u, is_admin: false })));
                } else {
                    const members = await getConversationMembers(conversation.id);
                    setCurrentMembers(members);
                }
            } catch (memErr) {
                console.error('Error fetching members:', memErr);
            }

            if (conversation.type === 'team' && currentUserId) {
                setIsCurrentUserAdmin(await isConversationAdmin(conversation.id, currentUserId));
            } else {
                setIsCurrentUserAdmin(false);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPollVotes = async (messageId) => {
        try {
            const votes = await getPollVotes(messageId, currentUserOrgId);
            setAllPollVotes(prev => ({ ...prev, [messageId]: votes }));
        } catch (error) {
            console.error('Error fetching poll votes:', error);
        }
    };

    const fetchConversationMembers = async () => {
        if (!selectedConversation) return;
        if (selectedConversation.type === 'everyone') {
            setCurrentMembers(orgUsers.map(u => ({ ...u, is_admin: false })));
            return;
        }
        try {
            const members = await getConversationMembers(selectedConversation.id);
            setCurrentMembers(members);
        } catch (err) {
            console.error('Error fetching members:', err);
            alert('Error loading members: ' + err.message);
        }
    };

    // ══════════════════════════════════════════════
    //  MESSAGE HANDLERS
    // ══════════════════════════════════════════════

    const handleEditMessage = async (messageId, newContent) => {
        try {
            const updated = await editMessage(messageId, newContent, currentUserId);
            setMessages(prev => prev.map(m => m.id === messageId ? updated : m));
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(`Failed to edit message: ${error.message}`);
        }
    };

    const handleSendMessage = async (content, attachmentFiles) => {
        if (!content.trim() && attachmentFiles.length === 0) return;
        if (!selectedConversation || !currentUserId) return;

        try {
            let targetConversationId = selectedConversation.id;

            if (selectedConversation.temp) {
                try {
                    const newConv = await createDMConversation(currentUserId, selectedConversation.otherUser.id, currentUserOrgId);
                    targetConversationId = newConv.id;
                    setSelectedConversation({
                        ...newConv, name: selectedConversation.name, avatar_url: selectedConversation.avatar_url,
                        otherUser: selectedConversation.otherUser, type: 'dm', temp: false
                    });
                } catch (err) {
                    setErrorMessage('Failed to create conversation. Please try again.');
                    return;
                }
            }

            let newMessage = await sendMessageWithReply(
                targetConversationId, content.trim(), currentUserId,
                replyingTo?.id || null, replyingTo?.content || null, replyingTo?.sender_name || null,
                currentUserOrgId
            );

            if (attachmentFiles.length > 0) {
                try {
                    await Promise.all(attachmentFiles.map(file => uploadAttachment(file, targetConversationId, newMessage.id, currentUserOrgId)));
                    // Re-hydrate message to include the uploaded attachments
                    const hydrated = await hydrateMessage(newMessage.id);
                    if (hydrated) newMessage = hydrated;
                    if (!content.trim()) {
                        await updateConversationIndex(targetConversationId, 'Attachment', currentUserId, newMessage?.created_at);
                    }
                } catch (attachmentError) {
                    console.error('Error uploading attachments:', attachmentError);
                }
            }



            setReplyingTo(null);
            setMessages(prev => {
                const newMessages = [...prev, newMessage];
                return newMessages.sort((a, b) => {
                    const timeCompare = (a.created_at || '').localeCompare(b.created_at || '');
                    if (timeCompare !== 0) return timeCompare;
                    return (a.id || '').localeCompare(b.id || '');
                });
            });

            // Mark as read since we just sent a message in this conversation
            markAsRead(targetConversationId);

            // Move this conversation to top of sidebar
            setConversations(prevConvs => {
                const updated = prevConvs.map(c => {
                    if (c.id === targetConversationId) {
                        return { 
                            ...c,
                            conversation_indexes: [{ 
                                ...(c.conversation_indexes?.[0] || {}),
                                last_message: content.trim() || '📎 Attachment', 
                                last_message_at: newMessage?.created_at || new Date().toISOString(),
                                last_sender_id: currentUserId
                            }],
                            last_message_read_by_others: false 
                        };
                    }
                    return c;
                });
                return updated.sort((a, b) => {
                    const tA = a.conversation_indexes?.[0]?.last_message_at;
                    const tB = b.conversation_indexes?.[0]?.last_message_at;
                    if (!tA && !tB) return 0;
                    if (!tA) return 1;
                    if (!tB) return -1;
                    return new Date(tB).getTime() - new Date(tA).getTime();
                });
            });
            setConversationCache(prev => { const c = { ...prev }; delete c[activeCategory]; return c; });
        } catch (error) {
            console.error('Error sending message:', error);
            setErrorMessage(`Failed to send message: ${error.message || 'Unknown error'}`);
        }
    };

    const handleSendPoll = async (question, options, allowMultiple) => {
        try {
            setLoading(true);
            const newMessage = await sendPoll(selectedConversation.id, currentUserId, question.trim(), options, allowMultiple, currentUserOrgId);
            setMessages(prev => [...prev, newMessage]);
            loadConversations();
        } catch (error) {
            console.error('Error sending poll:', error);
            alert('Failed to send poll: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (messageId, optionIndex, allowMultiple) => {
        try {
            await voteInPoll(messageId, currentUserId, optionIndex, allowMultiple, currentUserOrgId);
            fetchPollVotes(messageId);
        } catch (error) {
            console.error('Error voting:', error);
        }
    };

    const handleReaction = async (messageId, reaction) => {
        if (!currentUserId) return;
        isReacting.current = true;

        // Optimistic update
        setMessageReactions(prev => {
            const currentSummary = prev[messageId] || {};
            let oldReactionEmoji = null;
            Object.entries(currentSummary).forEach(([emoji, data]) => {
                if (data.users.some(u => u.user_id === currentUserId)) oldReactionEmoji = emoji;
            });
            const newSummary = JSON.parse(JSON.stringify(currentSummary));
            if (oldReactionEmoji) {
                if (newSummary[oldReactionEmoji]) {
                    newSummary[oldReactionEmoji].users = newSummary[oldReactionEmoji].users.filter(u => u.user_id !== currentUserId);
                    newSummary[oldReactionEmoji].count = Math.max(0, newSummary[oldReactionEmoji].count - 1);
                    if (newSummary[oldReactionEmoji].count === 0) delete newSummary[oldReactionEmoji];
                }
            }
            if (oldReactionEmoji !== reaction) {
                if (!newSummary[reaction]) newSummary[reaction] = { count: 0, users: [] };
                newSummary[reaction].users.push({ user_id: currentUserId, name: 'You' });
                newSummary[reaction].count += 1;
            }
            return { ...prev, [messageId]: newSummary };
        });

        try {
            await toggleReaction(messageId, currentUserId, reaction, currentUserOrgId);
        } catch (error) {
            console.error('Error toggling reaction:', error);
            const summary = await getReactionSummary(messageId);
            setMessageReactions(prev => ({ ...prev, [messageId]: summary }));
        } finally {
            setTimeout(() => { isReacting.current = false; }, 1000);
        }
    };

    // ══════════════════════════════════════════════
    //  DELETE HANDLERS
    // ══════════════════════════════════════════════

    const handleDeleteForEveryone = async (messageId) => {
        const msg = messages.find(m => m.id === messageId);
        if (msg && (new Date() - new Date(msg.created_at)) / (1000 * 60) > 5) {
            alert('Messages can only be deleted within 5 minutes of sending.');
            return;
        }
        if (!confirm('Are you sure you want to delete this message for everyone?')) return;
        try {
            await deleteMessageForEveryone(messageId);
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: 'This message was deleted', is_deleted: true, attachments: [] } : m));
        } catch (err) {
            alert(`Failed to delete message: ${err.message || 'Unknown error'}`);
        }
    };

    const handleDeleteForMe = async (messageId) => {
        const msg = messages.find(m => m.id === messageId);
        if (msg && (new Date() - new Date(msg.created_at)) / (1000 * 60) > 5) {
            alert('Messages can only be deleted within 5 minutes of sending.');
            return;
        }
        try {
            await deleteMessageForMe(messageId, currentUserId);
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            alert(`Failed to delete message: ${err.message || 'Unknown error'}`);
        }
    };

    // ══════════════════════════════════════════════
    //  ADMIN HANDLERS
    // ══════════════════════════════════════════════

    const handleAddMember = async (userId) => {
        try {
            await addMemberToConversation(selectedConversation.id, userId, currentUserId);
            setErrorMessage(null);
            await fetchConversationMembers();
            alert('Member added successfully!');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (userId, userName) => {
        if (!confirm(`Remove ${userName} from this group?`)) return;
        try {
            await removeMemberFromConversation(selectedConversation.id, userId, currentUserId);
            setErrorMessage(null);
            await fetchConversationMembers();
            alert('Member removed successfully!');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to remove member');
        }
    };

    const handlePromoteToAdmin = async (userId, userName) => {
        if (!confirm(`Make ${userName} an admin of this group?`)) return;
        try {
            await promoteMemberToAdmin(selectedConversation.id, userId, currentUserId);
            setErrorMessage(null);
            await fetchConversationMembers();
            alert(`${userName} is now an admin!`);
        } catch (error) {
            setErrorMessage(error.message || 'Failed to promote member');
        }
    };

    const handleDemoteFromAdmin = async (userId, userName) => {
        if (!confirm(`Remove admin privileges from ${userName}?`)) return;
        try {
            await demoteMemberFromAdmin(selectedConversation.id, userId, currentUserId);
            setErrorMessage(null);
            await fetchConversationMembers();
            alert(`${userName} is no longer an admin`);
        } catch (error) {
            setErrorMessage(error.message || 'Failed to demote admin');
        }
    };

    const handleRenameGroup = async (newName) => {
        try {
            await renameConversation(selectedConversation.id, newName, currentUserId);
            setErrorMessage(null);
            setSelectedConversation(prev => ({ ...prev, name: newName }));
            setConversationCache(prev => { const c = { ...prev }; delete c[activeCategory]; return c; });
            loadConversations();
            alert('Group renamed successfully!');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to rename group');
        }
    };

    const handleDeleteGroup = async () => {
        if (!confirm('Are you sure you want to delete this group? This action cannot be undone and all messages will be lost.')) return;
        try {
            await deleteConversation(selectedConversation.id, currentUserId);
            setSelectedConversation(null);
            setMessages([]);
            setErrorMessage(null);
            setConversationCache(prev => { const c = { ...prev }; delete c[activeCategory]; return c; });
            loadConversations();
            alert('Group deleted successfully');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to delete group');
        }
    };

    const handleLeaveGroup = async () => {
        if (!confirm('Are you sure you want to leave this group?')) return;
        try {
            await leaveConversation(selectedConversation.id, currentUserId);
            setSelectedConversation(null);
            setMessages([]);
            setErrorMessage(null);
            setConversationCache(prev => { const c = { ...prev }; delete c[activeCategory]; return c; });
            loadConversations();
            alert('You have left the group');
        } catch (error) {
            setErrorMessage(error.message || 'Failed to leave group');
        }
    };

    // ══════════════════════════════════════════════
    //  SIDEBAR CALLBACKS
    // ══════════════════════════════════════════════

    const handleSelectConversation = (conv) => {
        loadMessages(conv);
    };

    const handleJoinOrganizationChat = async () => {
        try {
            setLoading(true);
            const conversation = await getOrCreateOrgConversation(currentUserId, currentUserOrgId);
            setErrorMessage(null);
            setConversationCache(prev => { const c = { ...prev }; delete c['organization']; return c; });
            loadConversations();
            loadMessages(conversation);
        } catch (error) {
            setErrorMessage(`Failed to join organization chat: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleStartChatWithUser = (user) => {
        setSelectedUser(user);
        setSelectedConversation({
            id: `temp_${user.id}`, type: 'dm',
            name: user.full_name || user.email, temp: true, otherUser: user
        });
        setMessages([]);
    };

    const handleCreateTeamChat = async (teamName, memberIds) => {
        try {
            setLoading(true);
            const conversation = await createTeamConversation(currentUserId, memberIds, teamName, currentUserOrgId);
            setErrorMessage(null);
            setConversationCache(prev => { const c = { ...prev }; delete c['team']; return c; });
            loadConversations();
            loadMessages(conversation);
        } catch (error) {
            setErrorMessage(`Failed to create team chat: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // ══════════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════════

    const groupActions = {
        onFetchMembers: fetchConversationMembers,
        onAddMember: handleAddMember,
        onRemoveMember: handleRemoveMember,
        onPromoteToAdmin: handlePromoteToAdmin,
        onDemoteFromAdmin: handleDemoteFromAdmin,
        onRenameGroup: handleRenameGroup,
        onDeleteGroup: handleDeleteGroup,
        onLeaveGroup: handleLeaveGroup
    };

    return (
        <div className="messaging-hub" style={{ margin: 0, padding: 0, display: 'grid' }}>
            <Sidebar
                authLoading={authLoading}
                currentUserId={currentUserId}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                conversations={conversations}
                selectedConversation={selectedConversation}
                loading={loading}
                onSelectConversation={handleSelectConversation}
                onJoinOrganizationChat={handleJoinOrganizationChat}

                onStartChatWithUser={handleStartChatWithUser}
                onCreateTeamChat={handleCreateTeamChat}
                orgUsers={orgUsers}
                lastReadTimes={lastReadTimes}
                errorMessage={errorMessage}
                setErrorMessage={setErrorMessage}
            />

            {/* Column 3: ChatWindow + Composer stacked vertically */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '100%', overflow: 'hidden' }}>
                <ChatWindow
                    selectedConversation={selectedConversation}
                    messages={messages}
                    currentUserId={currentUserId}
                    orgUsers={orgUsers}
                    isCurrentUserAdmin={isCurrentUserAdmin}
                    currentMembers={currentMembers}
                    messageReactions={messageReactions}
                    allPollVotes={allPollVotes}
                    loading={loading}
                    errorMessage={errorMessage}
                    setErrorMessage={setErrorMessage}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    onReaction={handleReaction}
                    onVote={handleVote}
                    onDeleteForMe={handleDeleteForMe}
                    onDeleteForEveryone={handleDeleteForEveryone}
                    groupActions={groupActions}
                />

                {selectedConversation && (
                    <Composer
                        replyingTo={replyingTo}
                        setReplyingTo={setReplyingTo}
                        errorMessage={errorMessage}
                        setErrorMessage={setErrorMessage}
                        loading={loading}
                        selectedConversation={selectedConversation}
                        orgUsers={orgUsers}
                        currentMembers={currentMembers}
                        currentUserId={currentUserId}
                        onSendMessage={handleSendMessage}
                        onSendPoll={handleSendPoll}
                    />
                )}
            </div>
        </div>
    );
};

export default MessagingHub;


