import React, { useState, useEffect } from 'react';
import { X, Briefcase, Calendar, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { useLeaves } from '../hooks/useLeaves';

const ApplyLeaveModal = ({ onClose, onSuccess }) => {
    const { addToast } = useToast();
    const { userId, orgId } = useUser();

    // Use the robust centralized hook
    const { leaveStats, remainingLeaves, refetch: refetchLeaves } = useLeaves(orgId, userId, 'personal');

    const [selectedCategory, setSelectedCategory] = useState('Casual Leave');
    const [leaveFormData, setLeaveFormData] = useState({
        leaveType: 'Vacation',
        startDate: '',
        endDate: '',
        reason: ''
    });

    // Multiple discrete dates approach
    const [selectedDates, setSelectedDates] = useState([]);
    const [dateToAdd, setDateToAdd] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isCasualExhausted = (remainingLeaves ?? 0) <= 0;

    // If casual becomes exhausted while Casual Leave is selected,
    // move selection to another visible option (submission still enforces LOP).
    useEffect(() => {
        if (isCasualExhausted && selectedCategory === 'Casual Leave') {
            setSelectedCategory('Sick Leave');
            setLeaveFormData(prev => ({ ...prev, leaveType: 'Sick Leave' }));
        }
    }, [isCasualExhausted, selectedCategory]);


    // Safety guard: if we don't have user info, don't crash, just show a friendly message or nothing
    if (!orgId || !userId) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>Loading session...</div>
            </div>
        );
    }

    const addSelectedDate = (date) => {
        if (!date) return;
        setSelectedDates(prev => {
            const set = new Set(prev);
            if (set.has(date)) return prev;
            set.add(date);
            return Array.from(set).sort();
        });
    };

    const removeSelectedDate = (date) => {
        setSelectedDates(prev => prev.filter(d => d !== date));
    };

    // Robust duration calculator
    const calculateBreakdown = () => {
        try {
            let totalDays = 0;
            if (selectedDates.length > 0) {
                totalDays = selectedDates.length;
            } else if (leaveFormData.startDate && leaveFormData.endDate) {
                const start = new Date(leaveFormData.startDate);
                const end = new Date(leaveFormData.endDate);
                let count = 0;
                const cur = new Date(start);
                while (cur <= end) {
                    const day = cur.getDay();
                    if (day !== 0 && day !== 6) count++;
                    cur.setDate(cur.getDate() + 1);
                    if (count > 365) break; // Emergency break
                }
                totalDays = count;
            }

            const safeRemaining = typeof remainingLeaves === 'number' ? remainingLeaves : 0;
            const paid = Math.min(totalDays, safeRemaining);
            const lop = Math.max(0, totalDays - paid);
            
            return { total: totalDays, paid, lop };
        } catch (e) {
            return { total: 0, paid: 0, lop: 0 };
        }
    };

    const breakdown = calculateBreakdown();

    const handleApplyLeave = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { total, paid, lop } = breakdown;
            
            if (total <= 0) {
                addToast('Please select valid dates', 'error');
                setIsSubmitting(false);
                return;
            }

            const activeStartDate = selectedDates.length > 0 ? selectedDates[0] : leaveFormData.startDate;
            const activeEndDate = selectedDates.length > 0 ? selectedDates[selectedDates.length - 1] : leaveFormData.endDate;

            // 7-day advance notice validation (except Sick Leave)
            const selectedType = leaveFormData.leaveType || selectedCategory;
            const isSickLeave = (selectedType || '').toLowerCase().includes('sick');

            if (!isSickLeave) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const minAdvanceDate = new Date(today);
                minAdvanceDate.setDate(today.getDate() + 7);
                
                const requestStart = new Date(activeStartDate);
                requestStart.setHours(0, 0, 0, 0);
                
                if (requestStart < minAdvanceDate) {
                    addToast('All leave requests (except Sick Leave) must be submitted at least 7 days in advance.', 'error');
                    setIsSubmitting(false);
                    return;
                }
            }

            const effectiveLeaveType = isCasualExhausted ? 'Loss of Pay' : leaveFormData.leaveType;

            const { error: insertError } = await supabase
                .from('leaves')
                .insert({
                    employee_id: userId,
                    org_id: orgId,
                    leave_type: effectiveLeaveType,
                    from_date: activeStartDate,
                    to_date: activeEndDate,
                    reason: leaveFormData.reason,
                    status: 'pending',
                    duration_weekdays: paid,
                    lop_days: lop,
                    // `created_at` is the "applied on" timestamp (when the request is submitted).
                    // `from_date` / `to_date` represent the leave period.
                    created_at: new Date().toISOString()
                });

            if (insertError) throw insertError;

            addToast('Leave request submitted successfully', 'success');
            if (onSuccess) onSuccess();
            if (onClose) onClose();
        } catch (err) {
            console.error('Submission error:', err);
            addToast(err.message || 'Failed to submit leave', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Ensure leaveStats exists before rendering
    const stats = leaveStats || { annualQuota: 12, monthlyUsed: 0, yearlyUsed: 0, leaveYear: new Date().getFullYear() };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div className="no-scrollbar" style={{ backgroundColor: 'var(--surface)', padding: '40px', borderRadius: '32px', width: '1000px', maxWidth: '95%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                >
                    <X size={20} />
                </button>

                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)' }}>Request Leave</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Submit your leave details for approval</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '48px' }}>
                    <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px' }}>Leave Category</label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        const cat = e.target.value;
                                        setSelectedCategory(cat);
                                        if (cat === 'Casual Leave') {
                                            setLeaveFormData({ ...leaveFormData, leaveType: 'Vacation' });
                                        } else {
                                            setLeaveFormData({ ...leaveFormData, leaveType: cat });
                                        }
                                    }}
                                    style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                    required
                                >
                                    <option value="Casual Leave" disabled={isCasualExhausted}>Casual Leave</option>
                                    <option value="Sick Leave">Sick Leave</option>
                                    <option value="Loss of Pay">Loss of Pay Leaves</option>
                                </select>
                            </div>

                            {selectedCategory === 'Casual Leave' && (
                                <div style={{ marginTop: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px' }}>Casual Leave Sub-option</label>
                                    <select
                                        value={leaveFormData.leaveType}
                                        onChange={(e) => setLeaveFormData({ ...leaveFormData, leaveType: e.target.value })}
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        required
                                    >
                                        <option value="Vacation">Vacation Leaves</option>
                                        <option value="Personal Leave">Personal Leave</option>
                                    </select>
                                </div>
                            )}

                            {isCasualExhausted && (
                                <p style={{ marginTop: '8px', fontSize: '0.8rem', color: '#b91c1c', fontWeight: 600 }}>
                                    Casual Leave is exhausted. You may choose any leave type, but this request will be processed as Loss of Pay.
                                </p>
                            )}
                        </div>


                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px' }}>Discrete Dates (Optional)</label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <input
                                    type="date"
                                    value={dateToAdd}
                                    onChange={(e) => setDateToAdd(e.target.value)}
                                    style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => { if (dateToAdd) { addSelectedDate(dateToAdd); setDateToAdd(''); } }}
                                    style={{ padding: '0 20px', borderRadius: '12px', backgroundColor: 'var(--surface-active)', color: 'var(--primary)', fontWeight: 700 }}
                                >
                                    Add
                                </button>
                            </div>
                            {selectedDates.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    {selectedDates.map(d => (
                                        <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}>
                                            <span>{d}</span>
                                            <X size={14} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => removeSelectedDate(d)} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedDates.length === 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px' }}>Start Date</label>
                                    <input
                                        type="date"
                                        value={leaveFormData.startDate}
                                        onChange={(e) => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })}
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        required={selectedDates.length === 0}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px' }}>End Date</label>
                                    <input
                                        type="date"
                                        value={leaveFormData.endDate}
                                        onChange={(e) => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                                        min={leaveFormData.startDate}
                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                        required={selectedDates.length === 0}
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '8px' }}>Detailed Reason</label>
                            <textarea
                                value={leaveFormData.reason}
                                onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                                rows="3"
                                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
                                placeholder="Please provide specific details..."
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button type="button" onClick={onClose} style={{ padding: '14px 28px', borderRadius: '12px', fontWeight: '700', border: '1px solid var(--border)' }}>Cancel</button>
                            <button type="submit" disabled={isSubmitting} style={{ padding: '14px 32px', borderRadius: '12px', fontWeight: '800', backgroundColor: 'var(--primary)', color: 'white' }}>
                                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </form>

                    <div style={{ padding: '32px', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="#0284c7" /> Leave Summary
                            </h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 700, color: '#64748b' }}>Annual Allowance</span>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{stats.annualQuota ?? stats.monthlyQuota ?? 12}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 700, color: '#64748b' }}>Used This Year</span>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{stats.yearlyUsed}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(2, 132, 199, 0.05)', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                                    <span style={{ fontWeight: 700, color: '#0284c7' }}>Balance ({stats.leaveYear || new Date().getFullYear()})</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>{remainingLeaves} / {stats.annualQuota ?? stats.monthlyQuota ?? 12}</span>
                                </div>
                            </div>
                        </div>

                        {breakdown.total > 0 && (
                            <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', marginBottom: '16px' }}>Current Request</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#64748b' }}>Duration</span>
                                        <span style={{ fontWeight: 700 }}>{breakdown.total} Days</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#64748b' }}>Paid Attribution</span>
                                        <span style={{ fontWeight: 700, color: '#10b981' }}>{breakdown.paid} Days</span>
                                    </div>
                                    {breakdown.lop > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Loss of Pay</span>
                                            <span style={{ fontWeight: 700, color: '#ef4444' }}>{breakdown.lop} Days</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplyLeaveModal;
