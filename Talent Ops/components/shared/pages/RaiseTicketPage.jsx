import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
    Ticket,
    Send,
    AlertCircle,
    CheckCircle2,
    Paperclip,
    X,
    Loader2,
    Bug,
    Clock,
    HelpCircle,
    Zap,
    MessageSquare,
    ChevronRight,
    Shield
} from 'lucide-react';
import DocumentViewer from '../DocumentViewer';

const RaiseTicketPage = () => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [files, setFiles] = useState([]);
    const [ticketType, setTicketType] = useState('bug'); // 'bug', 'feature', 'support'
    const [recentTickets, setRecentTickets] = useState([]);
    const [allTickets, setAllTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketComments, setTicketComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Document Viewer state
    const [previewUrl, setPreviewUrl] = useState('');
    const [showPreview, setShowPreview] = useState(false);

    const [formData, setFormData] = useState({
        subject: '',
        category: 'platform_bug',
        priority: 'medium',
        description: ''
    });

    const categories = [
        { value: 'platform_bug', label: 'Platform Bug', icon: <Bug size={18} />, desc: 'Report a technical issue' },
        { value: 'feature_request', label: 'Feature Request', icon: <Zap size={18} />, desc: 'Suggest an improvement' },
        { value: 'account_billing', label: 'Account & Billing', icon: <Shield size={18} />, desc: 'Payment or access issues' },
        { value: 'tech_support', label: 'Technical Help', icon: <HelpCircle size={18} />, desc: 'General help using the app' }
    ];

    const priorities = [
        { value: 'low', label: 'Low', color: '#10b981', bg: '#ecfdf5' },
        { value: 'medium', label: 'Medium', color: '#f59e0b', bg: '#fffbeb' },
        { value: 'high', label: 'High', color: '#ef4444', bg: '#fef2f2' }
    ];

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('role, org_id, full_name')
                .eq('id', user.id)
                .single();

            if (data) {
                setUserProfile(data);
                const role = data.role?.toLowerCase();
                setIsAdmin(role === 'superadmin');
            }
        };
        fetchProfile();
    }, []);

    // Fetch tickets based on role
    useEffect(() => {
        const fetchTickets = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !userProfile) return;

            let query = supabase.from('tickets').select('*');

            if (userProfile.role === 'superadmin') {
                // SuperAdmin sees everything from all orgs
                query = query.order('created_at', { ascending: false });
            } else {
                // Clients see only their own
                query = query.eq('user_id', user.id).order('created_at', { ascending: false });
            }

            const { data } = await query;
            if (data) setAllTickets(data);
        };
        fetchTickets();
    }, [userProfile, success, showTicketModal]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFiles([...files, ...Array.from(e.target.files)]);
        }
    };

    const removeFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found');

            // 1. Upload files if any
            const uploadedUrls = [];
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `support-tickets/${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('ticket-attachments')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('ticket-attachments')
                    .getPublicUrl(filePath);

                if (publicUrl) uploadedUrls.push(publicUrl);
            }

            // 2. Insert ticket
            const { error } = await supabase
                .from('tickets')
                .insert([{
                    user_id: user.id,
                    org_id: userProfile?.org_id,
                    type: ticketType,
                    category: formData.category,
                    priority: formData.priority,
                    subject: formData.subject,
                    description: formData.description,
                    status: 'open',
                    attachments: uploadedUrls,
                    metadata: {
                        reporter_name: userProfile?.full_name,
                        platform: 'TalentOps'
                    }
                }]);

            if (error) throw error;

            setSuccess(true);
            setFormData({
                subject: '',
                category: 'platform_bug',
                priority: 'medium',
                description: ''
            });
            setFiles([]);
            setTimeout(() => setSuccess(false), 5000);

        } catch (error) {
            console.error('Error submitting support ticket:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !selectedTicket) return;

        try {
            const { error } = await supabase
                .from('ticket_comments')
                .insert([{
                    ticket_id: selectedTicket.id,
                    user_id: userProfile.id,
                    comment: newComment
                }]);

            if (error) throw error;
            setNewComment('');
            fetchComments(selectedTicket.id);
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const fetchComments = async (ticketId) => {
        const { data } = await supabase
            .from('ticket_comments')
            .select('*, profiles(full_name, role)')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
        
        if (data) setTicketComments(data);
    };

    const handleResolveTicket = async (ticketId) => {
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ status: 'resolved' })
                .eq('id', ticketId);

            if (error) throw error;
            setShowTicketModal(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error resolving ticket:', error);
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'open': return { bg: '#eff6ff', color: '#3b82f6', label: 'Under Review' };
            case 'in_progress': return { bg: '#fffbeb', color: '#d97706', label: 'Processing' };
            case 'resolved': return { bg: '#f0fdf4', color: '#16a34a', label: 'Fixed' };
            default: return { bg: '#f8fafc', color: '#64748b', label: 'Ticket Sent' };
        }
    };

    return (
        <>
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '12px', color: 'white' }}>
                            <HelpCircle size={24} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                                {isAdmin ? 'TalentOps Support Dashboard' : 'TalentOps Support'}
                            </h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                                    {isAdmin ? 'Manage all incoming platform tickets and requests.' : 'Report issues or request platform features directly to the developers.'}
                                </p>
                                {userProfile && (
                                    <span style={{ 
                                        fontSize: '0.65rem', 
                                        fontWeight: '800', 
                                        backgroundColor: isAdmin ? '#0f172a' : '#f1f5f9', 
                                        color: isAdmin ? 'white' : '#64748b', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        Role: {userProfile.role}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {isAdmin ? (
                    /* SUPERADMIN VIEW: LIST OF ALL TICKETS */
                    <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '24px', color: '#0f172a' }}>All Platform Tickets</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                                        <th style={{ padding: '16px', fontSize: '0.85rem', color: '#64748b' }}>STATUS</th>
                                        <th style={{ padding: '16px', fontSize: '0.85rem', color: '#64748b' }}>TICKET</th>
                                        <th style={{ padding: '16px', fontSize: '0.85rem', color: '#64748b' }}>CATEGORY</th>
                                        <th style={{ padding: '16px', fontSize: '0.85rem', color: '#64748b' }}>SUBMITTED BY</th>
                                        <th style={{ padding: '16px', fontSize: '0.85rem', color: '#64748b' }}>DATE</th>
                                        <th style={{ padding: '16px', fontSize: '0.85rem', color: '#64748b' }}>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allTickets.map(ticket => (
                                        <tr key={ticket.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: getStatusStyles(ticket.status).color, background: getStatusStyles(ticket.status).bg, padding: '4px 8px', borderRadius: '6px' }}>
                                                    {getStatusStyles(ticket.status).label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px', fontWeight: '600', color: '#0f172a' }}>{ticket.subject}</td>
                                            <td style={{ padding: '16px', color: '#64748b', fontSize: '0.9rem', textTransform: 'capitalize' }}>{ticket.category.replace('_', ' ')}</td>
                                            <td style={{ padding: '16px', color: '#0f172a', fontWeight: '500' }}>{ticket.metadata?.reporter_name || 'Anonymous'}</td>
                                            <td style={{ padding: '16px', color: '#64748b', fontSize: '0.85rem' }}>{new Date(ticket.created_at).toLocaleDateString()}</td>
                                            <td style={{ padding: '16px' }}>
                                                <button 
                                                    onClick={() => { setSelectedTicket(ticket); fetchComments(ticket.id); setShowTicketModal(true); }}
                                                    style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', color: '#0f172a', fontWeight: '600', cursor: 'pointer' }}
                                                >
                                                    View & Reply
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* CLIENT VIEW: RAISE FORM & RECENT */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px' }}>
                    {/* Main Form */}
                    <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                        {success ? (
                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                <div style={{ width: '80px', height: '80px', backgroundColor: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                    <CheckCircle2 size={40} color="#16a34a" />
                                </div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>Ticket Received!</h2>
                                <p style={{ color: '#64748b', marginBottom: '32px' }}>Our technical team has been notified. We will review your issue and get back to you shortly.</p>
                                <button 
                                    onClick={() => setSuccess(false)}
                                    style={{ padding: '12px 24px', backgroundColor: '#0f172a', color: 'white', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                                >
                                    Raise Another Issue
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                {/* Category Grid */}
                                <div style={{ marginBottom: '32px' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#334155', marginBottom: '16px' }}>Issue Type</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                        {categories.map(cat => (
                                            <div 
                                                key={cat.value}
                                                onClick={() => setFormData({ ...formData, category: cat.value })}
                                                style={{
                                                    padding: '16px',
                                                    borderRadius: '16px',
                                                    border: formData.category === cat.value ? '2px solid #0f172a' : '1px solid #e2e8f0',
                                                    backgroundColor: formData.category === cat.value ? '#f8fafc' : 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ color: formData.category === cat.value ? '#0f172a' : '#64748b', marginBottom: '8px' }}>{cat.icon}</div>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0f172a', marginBottom: '4px' }}>{cat.label}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{cat.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '20px', marginBottom: '24px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Subject</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                            placeholder="Briefly describe the issue"
                                            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Severity</label>
                                        <select 
                                            value={formData.priority}
                                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }}
                                        >
                                            {priorities.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Detailed Description</label>
                                    <textarea 
                                        rows="6"
                                        required
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Please provide as much detail as possible. Steps to reproduce, expected vs actual behavior..."
                                        style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', resize: 'none' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '32px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', border: '2px dashed #e2e8f0', borderRadius: '16px', cursor: 'pointer', justifyContent: 'center', color: '#64748b' }}>
                                        <Paperclip size={18} />
                                        <span style={{ fontWeight: '600' }}>Attach Screenshots or Logs</span>
                                        <input type="file" multiple hidden onChange={handleFileChange} />
                                    </label>
                                    {files.length > 0 && (
                                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {files.map((f, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                                                    <span>{f.name}</span>
                                                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => removeFile(i)} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    style={{ width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', borderRadius: '12px', border: 'none', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Submit Issue to Developers</>}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div>
                        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '20px' }}>Your Recent Tickets</h3>
                            {allTickets.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {allTickets.slice(0, 5).map(ticket => (
                                        <div 
                                            key={ticket.id} 
                                            onClick={() => { setSelectedTicket(ticket); fetchComments(ticket.id); setShowTicketModal(true); }}
                                            style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: getStatusStyles(ticket.status).color, textTransform: 'uppercase', background: getStatusStyles(ticket.status).bg, padding: '2px 8px', borderRadius: '4px' }}>
                                                    {getStatusStyles(ticket.status).label}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.subject}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>No recent support history.</p>
                            )}
                        </div>


                        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '24px', padding: '32px', color: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <Shield size={20} color="#22d3ee" />
                                <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Developer Response</h3>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>Our developers review all platform issues within 24-48 hours. Urgent bugs are prioritized immediately.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>

        {/* Modal */}
        {showTicketModal && selectedTicket && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '90%', maxWidth: '600px', padding: '32px', position: 'relative' }}>
                        <button onClick={() => setShowTicketModal(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                            <X size={24} />
                        </button>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '24px' }}>Ticket Details</h2>
                        <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '16px', marginBottom: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>SUBJECT</label>
                                    <p style={{ fontWeight: '700' }}>{selectedTicket.subject}</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>STATUS</label>
                                    <p style={{ fontWeight: '700', color: getStatusStyles(selectedTicket.status).color }}>{getStatusStyles(selectedTicket.status).label}</p>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>DESCRIPTION</label>
                            <p style={{ marginTop: '8px', lineHeight: 1.6, fontSize: '0.95rem' }}>{selectedTicket.description}</p>
                        </div>

                        {/* Threaded Comments */}
                        <div style={{ marginBottom: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '16px', display: 'block' }}>CONVERSATION HISTORY</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px', marginBottom: '16px' }}>
                                {ticketComments.length > 0 ? ticketComments.map(comment => (
                                    <div key={comment.id} style={{ alignSelf: comment.profiles?.role === 'superadmin' ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: comment.profiles?.role === 'superadmin' ? '#0f172a' : '#f1f5f9', color: comment.profiles?.role === 'superadmin' ? 'white' : '#1e293b', padding: '12px 16px', borderRadius: '16px', fontSize: '0.85rem' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: '700', marginBottom: '4px', opacity: 0.8 }}>{comment.profiles?.full_name} ({comment.profiles?.role})</div>
                                        {comment.comment}
                                    </div>
                                )) : <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>No comments yet.</p>}
                            </div>

                            {/* Add Comment Form */}
                            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                    type="text" 
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Type your reply..."
                                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.85rem' }}
                                />
                                <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#0f172a', color: 'white', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Reply</button>
                            </form>
                        </div>

                        {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>ATTACHMENTS</label>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    {selectedTicket.attachments.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#3b82f6', textDecoration: 'underline' }}>View #{i + 1}</a>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setShowTicketModal(false)} style={{ flex: 1, padding: '14px', backgroundColor: '#f1f5f9', color: '#0f172a', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Close View</button>
                            {isAdmin && selectedTicket.status !== 'resolved' && (
                                <button onClick={() => handleResolveTicket(selectedTicket.id)} style={{ flex: 1, padding: '14px', backgroundColor: '#16a34a', color: 'white', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Mark as Resolved</button>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </>
    );
};

export default RaiseTicketPage;
