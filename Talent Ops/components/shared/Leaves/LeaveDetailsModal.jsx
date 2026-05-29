import React, { useState, useEffect } from 'react';
import { X, Briefcase, Activity } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { calculateRemainingLeaves } from '../../../utils/payrollCalculations';

export const LeaveDetailsModal = ({ 
    selectedLeaveRequest, 
    onClose, 
    onApprove, 
    onReject,
    orgId 
}) => {
    const [employeeTasks, setEmployeeTasks] = useState([]);
    const [pendingTasks, setPendingTasks] = useState([]);
    const [evalBalance, setEvalBalance] = useState(0);
    const [evalPendingPaid, setEvalPendingPaid] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!selectedLeaveRequest || !orgId) return;
            setIsLoading(true);
            try {
                // Fetch tasks for the employee during leave dates
                const { data: tasksData } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('assigned_to', selectedLeaveRequest.employee_id)
                    .eq('org_id', orgId)
                    .lte('start_date', selectedLeaveRequest.endDate)
                    .gte('due_date', selectedLeaveRequest.startDate);
                
                setEmployeeTasks(tasksData || []);

                // Fetch pending tasks
                const { data: pendingTasksData } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('assigned_to', selectedLeaveRequest.employee_id)
                    .eq('org_id', orgId)
                    .eq('status', 'Todo')
                    .lt('due_date', selectedLeaveRequest.startDate);
                
                setPendingTasks(pendingTasksData || []);

                // Fetch dynamic annual remaining balance, subtracting pending leaves of this year
                const currentYear = new Date().getFullYear();
                const firstOfYear = `${currentYear}-01-01`;
                const lastOfYear = `${currentYear}-12-31`;

                // Fetch other pending leaves (excluding the current one) in the current year to show impact
                const { data: pending } = await supabase
                    .from('leaves')
                    .select('duration_weekdays')
                    .eq('employee_id', selectedLeaveRequest.employee_id)
                    .eq('org_id', orgId)
                    .eq('status', 'pending')
                    .neq('id', selectedLeaveRequest.id)
                    .gte('from_date', firstOfYear)
                    .lte('from_date', lastOfYear);

                const remainingBalance = await calculateRemainingLeaves(selectedLeaveRequest.employee_id, orgId);
                
                setEvalBalance(remainingBalance);
                setEvalPendingPaid(pending?.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0) || 0);

            } catch (error) {
                console.error("Error fetching leave details:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [selectedLeaveRequest, orgId]);

    if (!selectedLeaveRequest) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div className="no-scrollbar" style={{ backgroundColor: 'white', borderRadius: '32px', padding: '40px', width: '1000px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border)', position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', zIndex: 10 }}
                >
                    <X size={20} />
                </button>

                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Leave Request Details</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: '500' }}>Review the details and status of this leave request</p>
                </div>

                <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
                        Employee Information
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Name</p>
                            <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.name}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Leave Type</p>
                            <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.type}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Duration</p>
                            <p style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedLeaveRequest.duration}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Breakdown</p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                                    Paid: {selectedLeaveRequest.duration_weekdays || 0} days
                                </span>
                                <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}>
                                    Weekends: {(() => {
                                        const start = new Date(selectedLeaveRequest.startDate);
                                        const end = new Date(selectedLeaveRequest.endDate);
                                        let weekendCount = 0;
                                        let current = new Date(start);
                                        while (current <= end) {
                                            const dayOfWeek = current.getDay();
                                            if (dayOfWeek === 0 || dayOfWeek === 6) weekendCount++;
                                            current.setDate(current.getDate() + 1);
                                        }
                                        return weekendCount;
                                    })()} days
                                </span>
                                <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                                    LOP: {selectedLeaveRequest.lop_days || 0} days
                                </span>
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status</p>
                            <span style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                backgroundColor: selectedLeaveRequest.status === 'Approved' ? '#dcfce7' :
                                    selectedLeaveRequest.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                                color: selectedLeaveRequest.status === 'Approved' ? '#166534' :
                                    selectedLeaveRequest.status === 'Pending' ? '#b45309' : '#991b1b'
                            }}>
                                {selectedLeaveRequest.status}
                            </span>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason</p>
                            <p style={{ fontSize: '1rem', fontWeight: 600, lineHeight: '1.5' }}>{selectedLeaveRequest.reason}</p>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>
                        Day-wise Breakdown
                    </h4>
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: (() => {
                            const start = new Date(selectedLeaveRequest.startDate);
                            const end = new Date(selectedLeaveRequest.endDate);
                            let dayCount = 0;
                            let current = new Date(start);
                            while (current <= end) {
                                dayCount++;
                                current.setDate(current.getDate() + 1);
                            }
                            return dayCount <= 7 ? 'none' : '294px';
                        })(), overflowY: 'auto'
                    }} className="no-scrollbar">
                        {(() => {
                            const start = new Date(selectedLeaveRequest.startDate);
                            const end = new Date(selectedLeaveRequest.endDate);
                            const days = [];
                            let current = new Date(start);
                            let paidDaysLeft = (selectedLeaveRequest.duration_weekdays !== null && selectedLeaveRequest.duration_weekdays !== undefined)
                                ? selectedLeaveRequest.duration_weekdays
                                : (() => {
                                    const s = new Date(selectedLeaveRequest.startDate);
                                    const e = new Date(selectedLeaveRequest.endDate);
                                    let c = 0;
                                    let curr = new Date(s);
                                    while (curr <= e) {
                                        if (curr.getDay() !== 0 && curr.getDay() !== 6) c++;
                                        curr.setDate(curr.getDate() + 1);
                                    }
                                    return c;
                                })();

                            while (current <= end) {
                                const dateStr = current.toLocaleDateString('en-US', { month: 'short', day: '2-digit', weekday: 'short' });
                                const dayOfWeek = current.getDay();
                                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                                let status = 'Leave';
                                let color = 'var(--text-primary)';
                                let bgColor = 'white';
                                let borderColor = '#e2e8f0';

                                if (isWeekend) {
                                    status = 'Weekend';
                                    color = '#64748b';
                                    bgColor = '#f1f5f9';
                                    borderColor = '#cbd5e1';
                                } else {
                                    if (paidDaysLeft > 0) {
                                        status = 'Paid Leave';
                                        color = '#15803d';
                                        bgColor = '#dcfce7';
                                        borderColor = '#bbf7d0';
                                        paidDaysLeft--;
                                    } else {
                                        status = 'Loss of Pay';
                                        color = '#b91c1c';
                                        bgColor = '#fee2e2';
                                        borderColor = '#fca5a5';
                                    }
                                }
                                days.push({ date: dateStr, status, color, bgColor, borderColor });
                                current.setDate(current.getDate() + 1);
                            }

                            return days.map((day, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: day.bgColor, borderRadius: '8px', border: `1px solid ${day.borderColor}`, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{day.date}</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: day.color }}>
                                        {day.status}
                                    </span>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {selectedLeaveRequest.status === 'Pending' && (
                    <div style={{ marginTop: '24px', padding: '24px', borderRadius: '20px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: '#0369a1' }}>
                            <Activity size={20} />
                            <h4 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>Live Approval Preview</h4>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '14px', border: '1px solid #e0f2fe' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>AVAILABLE CL BALANCE</p>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>{evalBalance} Days</div>
                            </div>

                            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '14px', border: '1px solid #e0f2fe' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Leave Applied For</p>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
                                    {(selectedLeaveRequest.duration_weekdays || 0) + (selectedLeaveRequest.lop_days || 0)} Days
                                </div>
                            </div>

                            <div style={{ backgroundColor: '#0369a1', padding: '16px', borderRadius: '14px', color: 'white', gridColumn: 'span 1' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', marginBottom: '8px' }}>Effective Balance if Accepted</p>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                                    {(() => {
                                        const effectiveCurrent = Math.max(0, evalBalance - evalPendingPaid);
                                        const totalRequested = (selectedLeaveRequest.duration_weekdays || 0) + (selectedLeaveRequest.lop_days || 0);
                                        const paidAmountForCurrent = Math.min(totalRequested, effectiveCurrent);
                                        return Math.max(0, effectiveCurrent - paidAmountForCurrent);
                                    })()} Days
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0ea5e9' }}></div>
                            {(() => {
                                const effectiveCurrent = Math.max(0, evalBalance - evalPendingPaid);
                                const totalReq = (selectedLeaveRequest.duration_weekdays || 0) + (selectedLeaveRequest.lop_days || 0);
                                const willBePaid = Math.min(totalReq, effectiveCurrent);
                                const willBeLop = totalReq - willBePaid;
                                return `Total Leave Days: ${totalReq}, Loss of Pay Days: ${willBeLop}`;
                            })()}
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '24px' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Briefcase size={20} color="var(--primary)" /> Tasks During Leave Period
                        </h4>
                        {isLoading ? <p>Loading...</p> : employeeTasks.length > 0 ? (
                            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead style={{ backgroundColor: '#f8fafc' }}>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 700 }}>Task Title</th>
                                            <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 700 }}>Due Date</th>
                                            <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 700 }}>Priority</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employeeTasks.map(task => (
                                            <tr key={task.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '12px', fontWeight: 600 }}>{task.title}</td>
                                                <td style={{ padding: '12px' }}>{new Date(task.due_date).toLocaleDateString()}</td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: task.priority === 'High' ? '#fee2e2' : '#f0f9ff', color: task.priority === 'High' ? '#ef4444' : '#0ea5e9' }}>
                                                        {task.priority || 'Medium'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                No tasks scheduled during this leave period
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={20} color="var(--primary)" /> Pending Tasks
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {isLoading ? <p>Loading...</p> : pendingTasks.length > 0 ? pendingTasks.map(task => (
                                <div key={task.id} style={{ padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{task.title}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: task.priority === 'High' ? '#ef4444' : 'var(--primary)', textTransform: 'uppercase' }}>{task.priority}</span>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ padding: '20px', textAlign: 'center', borderRadius: '12px', background: '#f8fafc', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No pending tasks!</div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer' }}
                    >
                        Close Details
                    </button>
                    {selectedLeaveRequest.status === 'Pending' && onApprove && onReject && (
                        <>
                            <button
                                onClick={() => onReject(selectedLeaveRequest)}
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', cursor: 'pointer' }}
                            >
                                Reject Request
                            </button>
                            <button
                                onClick={() => onApprove(selectedLeaveRequest)}
                                style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 700, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                            >
                                Approve Request
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaveDetailsModal;
