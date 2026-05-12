import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Calendar, Clock, MapPin, Users, User, X, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

const ViewAnnouncementModal = ({
    selectedEvent,
    onClose,
    viewMode,
    activeTab,
    canManageEvents,
    canMarkCompleted,
    onDelete,
    onUpdateStatus,
    orgId
}) => {
    const [eventParticipants, setEventParticipants] = useState({ loading: false, names: [], type: '' });
    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });

    // Fetch Participants for Selected Event
    useEffect(() => {
        const fetchParticipants = async () => {
            if (!selectedEvent) return;

            setEventParticipants({ loading: true, names: [], type: selectedEvent.event_for });

            try {
                if (selectedEvent.event_for === 'all') {
                    setEventParticipants({ loading: false, names: ['All Employees'], type: 'all' });
                    return;
                }

                if (selectedEvent.event_for === 'team') {
                    let teamIds = [];
                    try {
                        teamIds = typeof selectedEvent.teams === 'string' ? JSON.parse(selectedEvent.teams) : (selectedEvent.teams || []);
                    } catch (e) { console.error("Error parsing teams", e); }

                    if (teamIds.length > 0) {
                        const { data: teams } = await supabase
                            .from('projects')
                            .select('name')
                            .in('id', teamIds)
                            .eq('org_id', orgId);

                        if (teams) {
                            setEventParticipants({
                                loading: false,
                                names: teams.map(t => t.name),
                                type: 'team'
                            });
                        }
                    } else {
                        setEventParticipants({ loading: false, names: [], type: 'team' });
                    }
                } else if (selectedEvent.event_for === 'employee' || selectedEvent.event_for === 'specific') {
                    let empIds = [];
                    try {
                        empIds = typeof selectedEvent.employees === 'string' ? JSON.parse(selectedEvent.employees) : (selectedEvent.employees || []);
                    } catch (e) { console.error("Error parsing employees", e); }

                    if (empIds.length > 0) {
                        const { data: profiles } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .in('id', empIds)
                            .eq('org_id', orgId);

                        if (profiles) {
                            setEventParticipants({
                                loading: false,
                                names: profiles.map(p => p.full_name),
                                type: 'employee'
                            });
                        }
                    } else {
                        setEventParticipants({ loading: false, names: [], type: 'employee' });
                    }
                }

            } catch (err) {
                console.error("Error fetching participants", err);
                setEventParticipants({ loading: false, names: ['Error loading participants'], type: 'error' });
            }
        };

        fetchParticipants();
    }, [selectedEvent, orgId]);

    const handleDelete = (e) => {
        e.stopPropagation();
        if (!onDelete) return;
        setConfirmModal({
            show: true,
            title: 'Delete Event',
            message: 'Are you sure you want to delete this event? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                await onDelete(selectedEvent.id);
                onClose();
            }
        });
    };

    const handleUpdate = (e, newStatus) => {
        e.stopPropagation();
        if (!onUpdateStatus) return;
        setConfirmModal({
            show: true,
            title: 'Update Event Status',
            message: `Are you sure you want to mark this event as ${newStatus}?`,
            type: 'info',
            onConfirm: async () => {
                await onUpdateStatus(selectedEvent.id, newStatus);
                onClose();
            }
        });
    };

    if (!selectedEvent) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            padding: '24px'
        }} onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    width: '560px',
                    maxWidth: '100%',
                    boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.25)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                {/* Status Brand Bar */}
                <div style={{
                    height: '8px',
                    background: viewMode === 'announcements'
                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                        : activeTab === 'active' ? 'linear-gradient(90deg, #10b981, #34d399)' : activeTab === 'upcoming' ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : '#cbd5e1',
                    width: '100%'
                }}></div>

                <div style={{ padding: '40px', overflowY: 'auto', maxHeight: '85vh' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    backgroundColor: '#f8fafc',
                                    color: '#64748b',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    {selectedEvent.location === 'Broadcast' ? 'Official Announcement' : 'Company Event'}
                                </span>
                            </div>
                            <h2 style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.03em' }}>{selectedEvent.title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: '#f1f5f9', border: 'none', borderRadius: '6px',
                                width: '40px', height: '40px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#64748b', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e1e7ef'; e.currentTarget.style.color = '#0f172a'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: '#3b82f610', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Calendar size={18} color="#3b82f6" />
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Date</span>
                                <span style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.95rem' }}>
                                    {new Date(selectedEvent.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '20px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f59e0b10', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Clock size={18} color="#f59e0b" />
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Time</span>
                                <span style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.95rem' }}>{selectedEvent.event_time}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#ef444410', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                                <MapPin size={14} color="#ef4444" />
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Location</span>
                                <span style={{ color: '#334155', fontWeight: '600' }}>{selectedEvent.location}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#64748b10', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                                <Users size={14} color="#64748b" />
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Intended For</span>
                                <span style={{ color: '#334155', fontWeight: '600' }}>
                                    {selectedEvent.event_for === 'all'
                                        ? 'All Organization Members'
                                        : (selectedEvent.event_for === 'team' ? 'Selected Departments' : 'Specific Target Audience')}
                                </span>
                                {eventParticipants.loading ? (
                                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px' }}>Updating attendee list...</p>
                                ) : (
                                    eventParticipants.names.length > 0 && selectedEvent.event_for !== 'all' && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                                            {eventParticipants.names.map((name, idx) => (
                                                <span key={idx} style={{
                                                    fontSize: '0.75rem',
                                                    backgroundColor: '#f1f5f9',
                                                    color: '#475569',
                                                    padding: '4px 10px',
                                                    borderRadius: '8px',
                                                    fontWeight: '600'
                                                }}>
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {selectedEvent.message && (
                            <div style={{ marginTop: '12px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Message</span>
                                <div style={{
                                    color: '#475569',
                                    lineHeight: 1.7,
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '1.05rem',
                                    backgroundColor: '#f8fafc',
                                    padding: '24px',
                                    borderRadius: '20px',
                                    border: '1px solid #f1f5f9'
                                }}>
                                    {selectedEvent.message}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {canManageEvents && (
                                <button
                                    onClick={(e) => handleDelete(e)}
                                    style={{
                                        padding: '12px 20px', borderRadius: '14px', border: '1px solid #fee2e2',
                                        backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: '700', fontSize: '0.85rem',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                >
                                    <Trash2 size={16} /> Delete Event
                                </button>
                            )}
                            {canMarkCompleted && (activeTab === 'active' || activeTab === 'upcoming') && selectedEvent.status !== 'completed' && (
                                <button
                                    onClick={(e) => handleUpdate(e, 'completed')}
                                    style={{
                                        padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0',
                                        backgroundColor: 'white', color: '#64748b', fontWeight: '700', fontSize: '0.85rem',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
                                >
                                    Complete Event
                                </button>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                padding: '14px 32px',
                                backgroundColor: '#0f172a',
                                color: 'white',
                                fontWeight: '800',
                                borderRadius: '16px',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.2)',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#1e293b'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = '#0f172a'; }}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>

            {/* Premium Confirmation Modal */}
            {confirmModal.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
                    backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{ 
                        backgroundColor: 'white', 
                        padding: '32px', 
                        borderRadius: '24px', 
                        width: '400px', 
                        maxWidth: '90%', 
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center'
                    }}>
                        <div style={{ 
                            width: '64px', 
                            height: '64px', 
                            borderRadius: '20px', 
                            backgroundColor: confirmModal.type === 'danger' ? '#fee2e2' : '#e0f2fe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto'
                        }}>
                            {confirmModal.type === 'danger' ? (
                                <AlertCircle size={32} color="#ef4444" />
                            ) : (
                                <CheckCircle2 size={32} color="#0ea5e9" />
                            )}
                        </div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>{confirmModal.title}</h3>
                        <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.5', marginBottom: '32px' }}>{confirmModal.message}</p>
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                style={{
                                    flex: 1,
                                    padding: '14px', 
                                    borderRadius: '14px', 
                                    backgroundColor: '#f1f5f9',
                                    color: '#0f172a',
                                    border: '1px solid #e2e8f0', 
                                    cursor: 'pointer', 
                                    fontWeight: 700,
                                    transition: 'all 0.2s'
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    confirmModal.onConfirm();
                                    setConfirmModal({ ...confirmModal, show: false });
                                }}
                                style={{
                                    flex: 1,
                                    padding: '14px', 
                                    borderRadius: '14px',
                                    backgroundColor: confirmModal.type === 'danger' ? '#ef4444' : '#0ea5e9',
                                    color: 'white', 
                                    border: 'none', 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: confirmModal.type === 'danger' ? '0 4px 12px rgba(239, 68, 68, 0.2)' : '0 4px 12px rgba(14, 165, 233, 0.2)'
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewAnnouncementModal;
