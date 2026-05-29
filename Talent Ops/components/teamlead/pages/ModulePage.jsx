import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Trash2, CheckCircle, Activity } from 'lucide-react';

const APPLIER_RESPONSIBILITIES = [
    "Complete high-priority current tasks",
    "Handover pending tasks to a teammate",
    "Update status/progress on all active tasks",
    "Ensure relevant documentation is accessible"
];

const APPROVER_RESPONSIBILITIES = [
    "Review applier's workload during leave period",
    "Check own pending tasks for bottlenecks",
    "Coordinate task reallocation with team",
    "Ensure project deadlines are not compromised"
];
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import TeamTasks from '../components/TeamTasks';
import PayslipsPage from '../../shared/PayslipsPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import DocumentViewer from '../../shared/DocumentViewer';
import { usePolicies } from '../../shared/hooks/usePolicies';
import PoliciesFeature from '../../shared/features/PoliciesFeature';
import { useEmployees } from '../../shared/hooks/useEmployees';
import EmployeesFeature from '../../shared/features/EmployeesFeature';
import { useLeaves } from '../../shared/hooks/useLeaves';
import LeavesFeature from '../../shared/features/LeavesFeature';
import ApplyLeaveModal from '../../shared/Leaves/ApplyLeaveModal';
import LeaveDetailsModal from '../../shared/Leaves/LeaveDetailsModal';
import { Users, Briefcase as BriefcaseIcon, Mail as MailIcon, Phone as PhoneIcon, Calendar as CalendarIcon, MapPin as MailIcon2, Search, Filter, MoreVertical, Check, ChevronDown, Clock } from 'lucide-react';
import { calculateRemainingLeaves } from '../../../utils/payrollCalculations';

const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { currentTeam, userName, userId, teamId, orgId, userRole } = useUser();

    // Shared Leaves Data
    const { leaves: sharedLeaves, leaveStats: sharedLeaveStats, remainingLeaves: sharedRemainingLeaves, refetch: refetchLeaves } = useLeaves(orgId, userId, type === 'my-leaves' ? 'personal' : type === 'employee-leave-info' ? 'org' : 'manager');

    // State for Leaf Modals
    const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);


    // Shared Employees Hook
    const { 
        employees: sharedEmployees, 
        refetch: refetchEmployees 
    } = useEmployees(orgId);

    const activeEmployeesMode = (type === 'team_members' || type === 'status')
        ? sharedEmployees.filter(emp => emp.assignedProjects.some(p => p.id === teamId))
        : sharedEmployees;

    // Shared Policies Data
    const { 
        policies: sharedPolicies, 
        isLoadingPolicies: sharedIsLoadingPolicies, 
        policyError: sharedPolicyError 
    } = usePolicies(orgId, addToast);

    // State for Apply Leave modal
    const handleViewLeave = (leaveRequest) => {
        setSelectedLeaveRequest(leaveRequest);
        setShowLeaveDetailsModal(true);
    };

    const handleAction = async (action, item) => {
        if (type === 'leaves' && action === 'Apply for Leave') {
            setShowApplyLeaveModal(true);
        } else if (action === 'View Leave') {
            handleViewLeave(item);
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            try {
                const dbStatus = action === 'Approve' ? 'approved' : 'rejected';

                const { data: profileData, error: profileFetchError } = await supabase
                    .from('profiles')
                    .select('leaves_taken_this_month, total_leaves_balance')
                    .eq('id', item.employee_id)
                    .eq('org_id', orgId)
                    .single();

                if (profileFetchError) throw profileFetchError;

                let finalPaid = item.duration_weekdays || 0;
                let finalLop = item.lop_days || 0;

                if (action === 'Approve') {
                    // Re-calculate the split based on the CURRENT month's approved leaves
                    const totalRequestedDays = (item.duration_weekdays || 0) + (item.lop_days || 0);
                    
                    // Fetch all approved leaves for this month for this employee to get a clean count
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0,0,0,0);
                    
                    const { data: monthApproved } = await supabase
                        .from('leaves')
                        .select('duration_weekdays')
                        .eq('employee_id', item.employee_id)
                        .eq('status', 'approved')
                        .gte('from_date', startOfMonth.toISOString().split('T')[0]);

                    const alreadyTaken = monthApproved?.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0) || 0;
                    // Dynamically calculate the employee's YTD remaining leaves balance
                    const remainingBalance = await calculateRemainingLeaves(item.employee_id, orgId);

                    finalPaid = Math.max(0, Math.min(totalRequestedDays, remainingBalance));
                    finalLop = totalRequestedDays - finalPaid;

                    const { error: leaveUpdateError } = await supabase
                        .from('leaves')
                        .update({
                            status: dbStatus,
                            duration_weekdays: finalPaid,
                            lop_days: finalLop
                        })
                        .eq('id', item.id)
                        .eq('org_id', orgId);

                    if (leaveUpdateError) throw leaveUpdateError;

                    const { error: profileUpdateError } = await supabase
                        .from('profiles')
                        .update({
                            leaves_taken_this_month: alreadyTaken + finalPaid
                        })
                        .eq('id', item.employee_id)
                        .eq('org_id', orgId);

                    if (profileUpdateError) throw profileUpdateError;

                } else {
                    const { error: rejectError } = await supabase
                        .from('leaves')
                        .update({ status: dbStatus })
                        .eq('id', item.id)
                        .eq('org_id', orgId);

                    if (rejectError) throw rejectError;
                }

                // Send Notification to the Employee
                const { data: { user } } = await supabase.auth.getUser();
                if (user && item.employee_id) {
                    const actionWord = action === 'Approve' ? 'Approved' : 'Rejected';
                    let notificationMessage = `Your leave request for ${item.dates} has been ${actionWord}.`;

                    if (action === 'Approve' && finalLop > 0) {
                        notificationMessage += ` (Partial LOP: ${finalLop} days)`;
                    }

                    await supabase.from('notifications').insert({
                        receiver_id: item.employee_id,
                        sender_id: user.id,
                        org_id: orgId,
                        sender_name: 'Management',
                        message: notificationMessage,
                        type: 'leave_status',
                        is_read: false,
                        created_at: new Date().toISOString()
                    });
                }

                addToast(`Leave request ${action.toLowerCase()}d for ${item.name}`, 'success');
                refetchLeaves();
            } catch (error) {
                console.error('Error updating leave request:', error);
                addToast(`Failed to ${action.toLowerCase()} leave request`, 'error');
            }
        } else if (action === 'View Team Member') {
            setSelectedEmployee(item);
            setShowEmployeeModal(true);
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    // Render specific demos for certain types
    if (type === 'team_tasks') return <TeamTasks orgId={orgId} />;
    if (type === 'analytics') return <AnalyticsDemo />;
    if (type === 'tasks') return <TaskLifecyclePage userRole={userRole} userId={userId} addToast={addToast} teamId={teamId} orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;

    // Helper to filter data by team
    const filterData = (data) => {
        if (!currentTeam || currentTeam === 'All') return data;
        return data.filter(item => item.dept === currentTeam || item.department === currentTeam);
    };

    // Mock Data Configurations
    const configs = {
        workforce: {
            columns: [
                {
                    header: 'Team Member Name', accessor: 'name', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {row.name.charAt(0)}
                            </div>
                            <div>
                                <p style={{ fontWeight: 500 }}>{row.name}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.email}</p>
                            </div>
                        </div>
                    )
                },
                { header: 'Role', accessor: 'role' },
                { header: 'Department', accessor: 'department_display' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: row.status === 'Active' ? '#dcfce7' : '#fee2e2',
                            color: row.status === 'Active' ? '#166534' : '#991b1b'
                        }}>
                            {row.status}
                        </span>
                    )
                },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <button
                            onClick={() => handleAction('View Team Member', row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#075985',
                                border: '1px solid #7dd3fc',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                        >
                            <Eye size={14} />
                            View
                        </button>
                    )
                },
            ],

            data: filterData([])
        },
        team_members: {
            columns: [
                {
                    header: 'Team Member Name', accessor: 'name', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {row.name.charAt(0)}
                            </div>
                            <div>
                                <p style={{ fontWeight: 500 }}>{row.name}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.email}</p>
                            </div>
                        </div>
                    )
                },
                { header: 'Role', accessor: 'role' },
                { header: 'Department', accessor: 'department_display' },
                {
                    header: 'Status', accessor: 'status', render: (row) => {
                        let bgColor, textColor;
                        if (row.status === 'Active') {
                            bgColor = '#dcfce7'; textColor = '#166534';
                        } else if (row.status === 'On Leave') {
                            bgColor = '#fef3c7'; textColor = '#b45309';
                        } else {
                            bgColor = '#f1f5f9'; textColor = '#64748b';
                        }
                        return (
                            <span style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: bgColor,
                                color: textColor
                            }}>
                                {row.status}
                            </span>
                        );
                    }
                },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <button
                            onClick={() => handleAction('View Team Member', row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#075985',
                                border: '1px solid #7dd3fc',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                        >
                            <Eye size={14} />
                            View
                        </button>
                    )
                },
            ],

            data: teamMembers
        },
        status: {
            columns: [
                { header: 'Team Member', accessor: 'name' },
                { header: 'Department', accessor: 'department_display' },
                {
                    header: 'Availability', accessor: 'availability', render: (row) => (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: row.availability === 'Online' ? 'var(--success)' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)',
                            fontWeight: 600
                        }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: row.availability === 'Online' ? 'var(--success)' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)'
                            }}></span>
                            {row.availability}
                        </span>
                    )
                },
                { header: 'Current Task', accessor: 'task' },
                { header: 'Last Active', accessor: 'lastActive' },
            ],

            data: []
        },
        recruitment: {
            columns: [
                { header: 'Candidate', accessor: 'name' },
                { header: 'Applied For', accessor: 'role' },
                {
                    header: 'Stage', accessor: 'stage', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: '#e0f2fe',
                            color: '#075985'
                        }}>
                            {row.stage}
                        </span>
                    )
                },
                {
                    header: 'Score', accessor: 'score', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', width: '60px' }}>
                                <div style={{ width: `${row.score}%`, height: '100%', backgroundColor: row.score > 80 ? 'var(--success)' : 'var(--warning)', borderRadius: '3px' }}></div>
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{row.score}%</span>
                        </div>
                    )
                },
                { header: 'Source', accessor: 'source' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <button
                            onClick={() => handleAction('View Candidate', row)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#075985',
                                border: '1px solid #7dd3fc',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                        >
                            <Eye size={14} />
                            View
                        </button>
                    )
                },
            ],
            data: []
        },
        leaves: {
            columns: [
                { header: 'Team Member', accessor: 'name' },
                { header: 'Type', accessor: 'type' },
                { header: 'Duration', accessor: 'duration' },
                { header: 'Dates', accessor: 'dates' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: row.status === 'Approved' ? '#dcfce7' : row.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                            color: row.status === 'Approved' ? '#166534' : row.status === 'Pending' ? '#b45309' : '#991b1b'
                        }}>
                            {row.status}
                        </span>
                    )
                },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => handleViewLeave(row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#e0f2fe',
                                    color: '#075985',
                                    border: '1px solid #7dd3fc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bae6fd'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                            >
                                <Eye size={14} />
                                View
                            </button>
                            {row.status === 'Pending' && row.employee_id !== userId && (
                                <>
                                    <button
                                        onClick={() => handleAction('Approve', row)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            backgroundColor: '#dcfce7',
                                            color: '#166534',
                                            border: '1px solid #86efac',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bbf7d0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleAction('Reject', row)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            backgroundColor: '#fee2e2',
                                            color: '#991b1b',
                                            border: '1px solid #fca5a5',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                            {row.status === 'Pending' && row.employee_id === userId && (
                                <button
                                    onClick={() => handleDeleteLeave(row)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b',
                                        border: '1px solid #fca5a5',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                >
                                    <Trash2 size={14} />
                                    Delete
                                </button>
                            )}
                        </div>
                    )
                },

            ],
            data: sharedLeaves
        },
        payroll: {
            columns: [
                { header: 'Team Member', accessor: 'name' },
                { header: 'Month', accessor: 'month' },
                { header: 'Net Salary', accessor: 'salary' },
                {
                    header: 'Status', accessor: 'status', render: (row) => (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.status}</span>
                    )
                },
                { header: 'Payslip', accessor: 'action', render: () => <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>Download</span> }
            ],
            data: []
        },
        // leave team_tasks config removed as it uses custom component now
        // Default fallback for other modules
        // Default fallback for other modules
        default: {
            columns: [
                { header: 'Item Name', accessor: 'name' },
                { header: 'Description', accessor: 'desc' },
                { header: 'Date', accessor: 'date' },
                { header: 'Status', accessor: 'status' },
            ],
            data: []
        }
    };

    const config = configs[type] || configs.default;

    if (type === 'policies') {
        return (
            <PoliciesFeature 
                policies={sharedPolicies}
                isLoadingPolicies={sharedIsLoadingPolicies}
                policyError={sharedPolicyError}
                userRole={userRole}
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Premium Header with Mesh Background */}
            <div style={{
                position: 'relative',
                padding: '20px 24px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                marginBottom: '16px',
                overflow: 'hidden',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            }}>
                {/* Decorative Mesh Grid */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                    opacity: 0.5
                }}></div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                            <Calendar size={14} />
                            <span>Team Lead</span>
                            <span>/</span>
                            <span style={{ color: '#38bdf8' }}>{title}</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                            {title}
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
                            {type === 'leaves' ? 'Manage your personal leave requests and track available balance.' :
                                `Management portal for organizational ${title.toLowerCase()}`}
                        </p>
                    </div>

                    {type === 'leaves' && (
                        <button
                            onClick={() => handleAction('Apply for Leave')}
                            style={{
                                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                                color: 'white',
                                padding: '14px 28px',
                                borderRadius: '16px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(56, 189, 248, 0.4)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(56, 189, 248, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(56, 189, 248, 0.4)';
                            }}
                        >
                            <Plus size={22} />
                            Apply for Leave
                        </button>
                    )}
                </div>
            </div>

            {/* Remaining Leaves Card */}
            {type === 'leaves' && (
                <div style={{
                    background: 'white',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0284c7',
                        border: '1px solid #bae6fd'
                    }}>
                        <Briefcase size={32} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            LEAVE BALANCE
                        </p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a' }}>{sharedRemainingLeaves}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#94a3b8' }}>Days Remaining</span>
                        </div>
                    </div>
                </div>
            )}

            {(type === 'leaves' || type === 'employee-leave-info' || type === 'my-leaves') ? (
                <LeavesFeature 
                    leaves={sharedLeaves} 
                    type={type} 
                    title={title} 
                    onAction={handleAction} 
                    userId={userId} 
                    projectRole={userRole}
                />
            ) : (type === 'team_members' || type === 'status') ? (
                <EmployeesFeature 
                    employees={activeEmployeesMode} 
                    type={type === 'team_members' ? 'workforce' : 'status'} 
                    title={title} 
                    onAction={handleAction} 
                />
            ) : (
                <DataTable
                    title={`${title} List`}
                    columns={config.columns}
                    data={config.data}
                    onAction={handleAction}
                />
            )}

            {showApplyLeaveModal && (
                <ApplyLeaveModal
                    onClose={() => setShowApplyLeaveModal(false)}
                    userId={userId}
                    orgId={orgId}
                    teamId={teamId}
                    remainingLeaves={sharedRemainingLeaves}
                    onSuccess={() => {
                        setShowApplyLeaveModal(false);
                        refetchLeaves();
                    }}
                />
            )}

            {showLeaveDetailsModal && (
                <LeaveDetailsModal
                    selectedLeaveRequest={selectedLeaveRequest}
                    onClose={() => setShowLeaveDetailsModal(false)}
                    onApprove={type === 'leaves' ? handleAction.bind(null, 'Approve') : null}
                    onReject={type === 'leaves' ? handleAction.bind(null, 'Reject') : null}
                    orgId={orgId}
                />
            )}

            {/* Employee Details Modal */}
            {showEmployeeModal && selectedEmployee && ( <EmployeeDetailsModal selectedEmployee={selectedEmployee} onClose={() => setShowEmployeeModal(false)} /> )}
            {/* Candidate Details Modal */}
            {showCandidateModal && selectedCandidate && ( <CandidateDetailsModal selectedCandidate={selectedCandidate} onClose={() => setShowCandidateModal(false)} /> )}
        </div>
    );
};

export default ModulePage;