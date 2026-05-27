import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Trash2, Activity, CheckCircle, MoreVertical, AlertTriangle, Users } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { useProject } from '../context/ProjectContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import StatusDemo from '../components/Demo/StatusDemo';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import ProjectDocuments from './ProjectDocuments';
import DocumentViewer from '../../shared/DocumentViewer';
import { usePolicies } from '../../shared/hooks/usePolicies';
import PoliciesFeature from '../../shared/features/PoliciesFeature';
import { useEmployees } from '../../shared/hooks/useEmployees';
import EmployeesFeature from '../../shared/features/EmployeesFeature';
import { useLeaves } from '../../shared/hooks/useLeaves';
import LeavesFeature from '../../shared/features/LeavesFeature';
import ApplyLeaveModal from '../../shared/Leaves/ApplyLeaveModal';
import LeaveDetailsModal from '../../shared/Leaves/LeaveDetailsModal';
import PayslipsPage from '../../shared/PayslipsPage';
import UserAvatar from '../../shared/UserAvatar';



const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { currentTeam, userName, userId, teamId, orgId, userRole } = useUser();
    const { projectRole, currentProject, refreshProjects } = useProject(); // Destructure refreshProjects

    // Shared Employees Hook
    const { 
        employees: sharedEmployees, 
        refetch: refetchEmployees 
    } = useEmployees(orgId);

    const activeEmployeesMode = (type === 'team_members' || type === 'status' || type === 'workforce')
        ? sharedEmployees.filter(emp => emp.assignedProjects.some(p => p.id === currentProject?.id))
        : sharedEmployees;

    const [activeMenuId, setActiveMenuId] = useState(null);

    // State for Handover Modal
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [selectedMemberForHandover, setSelectedMemberForHandover] = useState(null);

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);

    // State for Apply Leave modal
    const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);

    // State for Realtime Updates
    // Leave data fetching is now completely handled by the useLeaves hook
    const { leaves: sharedLeaves, leaveStats: sharedLeaveStats, remainingLeaves: sharedRemainingLeaves, refetch: refetchLeaves } = useLeaves(orgId, userId, 'personal');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    // Shared Policies Hook




    // Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel('employee-module-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
                setRefreshTrigger(prev => prev + 1); // For team status updates
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, () => {
                console.log('Project members updated, refreshing...');
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Shared Policies Data
    const { 
        policies: sharedPolicies, 
        isLoadingPolicies: sharedIsLoadingPolicies, 
        policyError: sharedPolicyError 
    } = usePolicies(orgId, addToast);    
    // State for Employee Details modal
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);




    const initiatHandover = (member) => {
        setSelectedMemberForHandover(member);
        setShowHandoverModal(true);
    };

    const confirmHandover = async () => {
        if (!currentProject || !selectedMemberForHandover) return;

        try {
            const { error } = await supabase.rpc('handover_project_role', {
                project_id_input: currentProject.id,
                target_user_id_input: selectedMemberForHandover.id
            });

            if (error) throw error;

            addToast('Role handover successful! You are now an employee.', 'success');
            setShowHandoverModal(false);
            setSelectedMemberForHandover(null);

            // Refresh permissions and project data
            if (refreshProjects) await refreshProjects();

            // Refresh table
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Handover failed:', error);
            addToast(error.message || 'Handover failed', 'error');
        }
    };

    const handleAction = async (action, item) => {
        if (action === 'Apply Leave') {
            setShowApplyLeaveModal(true);
        } else if (action === 'View Leave') {
            setSelectedLeaveRequest(item);
            setShowLeaveDetailsModal(true);
        } else if (action === 'Delete Leave') {
            if (window.confirm('Are you sure you want to delete this leave request?')) {
                try {
                    const { error } = await supabase
                        .from('leaves')
                        .delete()
                        .eq('id', item.id)
                        .eq('employee_id', userId);

                    if (error) throw error;
                    addToast('Leave request deleted successfully', 'success');
                    refetchLeaves();
                } catch (error) {
                    console.error('Error deleting leave:', error);
                    addToast(error.message || 'Failed to delete leave', 'error');
                }
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
    if (type === 'analytics') return <AnalyticsDemo />;
    if (type === 'tasks') return <TaskLifecyclePage userRole={userRole} userId={userId} addToast={addToast} projectRole={projectRole} currentProjectId={currentProject?.id} teamId={teamId} orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'status') return <StatusDemo />;
    if (type === 'project-documents') return <ProjectDocuments />;
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
                            <UserAvatar
                                user={{ name: row.name, avatar_url: row.avatar_url }}
                                size={32}
                                style={{ border: '1px solid #e2e8f0' }}
                            />

                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <p style={{ fontWeight: 500 }}>{row.name}</p>
                                    {(() => {
                                        const assignment = row.assignedProjects?.find(p => p.id === currentProject?.id);
                                        const roleLabel = assignment?.role === 'team_lead' ? 'Team Lead' 
                                                       : (assignment?.role === 'manager' || assignment?.role === 'project_manager') ? 'Project Manager' 
                                                       : null;
                                        
                                        return roleLabel && (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: '700',
                                                color: '#fff',
                                                backgroundColor: roleLabel === 'Team Lead' ? '#3b82f6' : '#8b5cf6',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                            }}>
                                                {roleLabel}
                                            </span>
                                        );
                                    })()}
                                </div>
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
                                borderRadius: '6px',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                            {/* More Actions Menu (Kebab) - Only for PM/TL and not for self */}
                            {((projectRole === 'manager' || projectRole === 'project_manager' || projectRole === 'team_lead') && row.id !== userId) && (
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setActiveMenuId(activeMenuId === row.id ? null : row.id)}
                                        style={{
                                            padding: '6px',
                                            borderRadius: '6px',
                                            border: '1px solid #e2e8f0',
                                            backgroundColor: 'white',
                                            cursor: 'pointer',
                                            color: '#64748b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <MoreVertical size={14} />
                                    </button>

                                    {activeMenuId === row.id && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            marginTop: '4px',
                                            backgroundColor: 'white',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                            border: '1px solid #f3f4f6',
                                            width: '180px',
                                            zIndex: 50,
                                            overflow: 'hidden',
                                            padding: '4px'
                                        }}>
                                            <button
                                                onClick={() => { initiatHandover(row); setActiveMenuId(null); }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '10px 12px',
                                                    fontSize: '0.8rem',
                                                    color: '#d97706',
                                                    backgroundColor: 'white',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    borderRadius: '6px'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fffbeb'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                            >
                                                <Users size={14} /> Handover Role
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                },
            ],

            data: activeEmployeesMode
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

            data: filterData([]).filter(item => item.name === userName)
        },
        recruitment: {
            columns: [
                { header: 'Candidate', accessor: 'name' },
                { header: 'Applied For', accessor: 'role' },
                {
                    header: 'Stage', accessor: 'stage', render: (row) => (
                        <span style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
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
            data: [].filter(item => item.name === userName)
        },
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
                addToast={addToast}
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Premium Header with Mesh Background */}
            <div style={{
                position: 'relative',
                padding: '20px 24px',
                borderRadius: '8px',
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
                            <span>Dashboard</span>
                            <span>/</span>
                            <span style={{ color: '#38bdf8' }}>{title}</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                            {title}
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
                            {type === 'leaves' ? 'Manage your time off and track your leave allowance.' : `Management portal for your organizational ${title.toLowerCase()}`}
                        </p>
                    </div>

                    {type === 'leaves' && (
                        <button
                            onClick={() => handleAction('Apply Leave')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 24px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: '800',
                                fontSize: '0.9rem',
                                boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)',
                                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(56, 189, 248, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(56, 189, 248, 0.3)';
                            }}
                        >
                            <Plus size={20} strokeWidth={3} /> Apply for Leave
                        </button>
                    )}

                </div>
            </div>


            {/* Render KanbanDemo for tasks, DataTable for others */}
            {/* Render appropriate Demo/Component */}
            {
                (type === 'leaves') ? (
                    <LeavesFeature
                        type={type}
                        title={title}
                        leaves={sharedLeaves}
                        leaveStats={sharedLeaveStats}
                        remainingLeaves={sharedRemainingLeaves}
                        onAction={handleAction}
                        orgId={orgId}
                        userId={userId}
                        refetch={refetchLeaves}
                    />
                ) : type === 'tasks' ? (
                    <KanbanDemo />
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
                )
            }

            {/* Employee Details Modal */}
            {
                showEmployeeModal && selectedEmployee && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '8px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                            {/* Header */}
                            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Team Member Details</h3>
                                <button onClick={() => setShowEmployeeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Employee Info */}
                            <div style={{ padding: '32px' }}>
                                {/* Profile Section */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                                    <UserAvatar
                                        user={{ name: selectedEmployee.name, avatar_url: selectedEmployee.avatar_url }}
                                        size={80}
                                        style={{ fontSize: '2rem', border: '1px solid #e2e8f0' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '4px' }}>{selectedEmployee.name}</h4>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>{selectedEmployee.role}</p>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            backgroundColor: selectedEmployee.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                            color: selectedEmployee.status === 'Active' ? '#166534' : '#991b1b'
                                        }}>
                                            {selectedEmployee.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Contact Information</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Mail size={18} color="#075985" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Email</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.email}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Phone size={18} color="#075985" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Phone</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <MapPin size={18} color="#075985" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Location</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.location || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Calendar size={18} color="#075985" />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Join Date</p>
                                                <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedEmployee.joinDate}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Work Information */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Work Information</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Department</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.department_display || 'Unassigned'}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Role</p>
                                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedEmployee.role}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Performance Metrics */}
                                <div>
                                    <h5 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Performance Metrics</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                        <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '6px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '4px', fontWeight: 600 }}>PERFORMANCE</p>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534' }}>{selectedEmployee.performance || 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: '#e0f2fe', borderRadius: '6px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#075985', marginBottom: '4px', fontWeight: 600 }}>PROJECTS</p>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#075985' }}>{selectedEmployee.projects || 0}</p>
                                        </div>
                                        <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '6px', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#b45309', marginBottom: '4px', fontWeight: 600 }}>TASKS DONE</p>
                                            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#b45309' }}>{selectedEmployee.tasksCompleted || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowEmployeeModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Candidate Details Modal */}
            {showCandidateModal && selectedCandidate && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="no-scrollbar" style={{ backgroundColor: 'var(--surface)', borderRadius: '8px', width: '650px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                        {/* Header */}
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Candidate Details</h3>
                            <button onClick={() => setShowCandidateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Candidate Info */}
                        <div style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: '#b45309' }}>
                                    {selectedCandidate.name.charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '4px' }}>{selectedCandidate.name}</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>Applied for: {selectedCandidate.role}</p>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            backgroundColor: '#e0f2fe',
                                            color: '#075985'
                                        }}>
                                            {selectedCandidate.stage}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info (Simplified) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Email</p>
                                    <p style={{ fontWeight: 500 }}>{selectedCandidate.email}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Phone</p>
                                    <p style={{ fontWeight: 500 }}>{selectedCandidate.phone}</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button
                                    onClick={() => setShowCandidateModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Handover Confirmation Modal */}
            {showHandoverModal && selectedMemberForHandover && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '32px',
                        borderRadius: '8px',
                        width: '480px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#b91c1c' }}>
                            <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#fef2f2' }}>
                                <AlertTriangle size={32} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Confirm Role Handover</h3>
                        </div>

                        <p style={{ color: '#4b5563', lineHeight: 1.6, marginTop: '8px' }}>
                            You are about to transfer your <strong>{projectRole === 'manager' ? 'Project Manager' : 'Team Lead'}</strong> role to <strong>{selectedMemberForHandover.name}</strong>.
                        </p>

                        <div style={{ backgroundColor: '#fffba0', padding: '12px 16px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '0.9rem', color: '#854d0e', display: 'flex', gap: '10px' }}>
                            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                            <div>
                                <strong>Warning:</strong> You will lose your current administrative privileges for this project immediately after this action.
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                            <button
                                onClick={() => { setShowHandoverModal(false); setSelectedMemberForHandover(null); }}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '6px',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: 'white',
                                    color: '#374151',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmHandover}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                                }}
                            >
                                Confirm Handover
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Handover Confirmation Modal */}
            {showHandoverModal && selectedMemberForHandover && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '32px',
                        borderRadius: '8px',
                        width: '480px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#b91c1c' }}>
                            <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#fef2f2' }}>
                                <AlertTriangle size={32} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Confirm Role Handover</h3>
                        </div>

                        <p style={{ color: '#4b5563', lineHeight: 1.6, marginTop: '8px' }}>
                            You are about to transfer your <strong>{(projectRole === 'manager' || projectRole === 'project_manager') ? 'Project Manager' : 'Team Lead'}</strong> role to <strong>{selectedMemberForHandover.name}</strong>.
                        </p>

                        <div style={{ backgroundColor: '#fffba0', padding: '12px 16px', borderRadius: '6px', border: '1px solid #fde047', fontSize: '0.9rem', color: '#854d0e', display: 'flex', gap: '10px' }}>
                            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                            <div>
                                <strong>Warning:</strong> You will lose your current administrative privileges for this project immediately after this action.
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                            <button
                                onClick={() => { setShowHandoverModal(false); setSelectedMemberForHandover(null); }}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '6px',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: 'white',
                                    color: '#374151',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmHandover}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                                }}
                            >
                                Confirm Handover
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Apply Leave Modal */}
            {showApplyLeaveModal && (
                <ApplyLeaveModal
                    onClose={() => setShowApplyLeaveModal(false)}
                    onSuccess={() => {
                        setShowApplyLeaveModal(false);
                        refetchLeaves();
                    }}
                    remainingLeaves={sharedRemainingLeaves}
                />
            )}

            {/* Leave Details Modal */}
            {showLeaveDetailsModal && selectedLeaveRequest && (
                <LeaveDetailsModal
                    selectedLeaveRequest={selectedLeaveRequest}
                    onClose={() => setShowLeaveDetailsModal(false)}
                    orgId={orgId}
                />
            )}
        </div>
    );
};

export default ModulePage;
