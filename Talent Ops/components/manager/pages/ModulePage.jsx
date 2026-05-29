import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Edit, Users, Clock, Activity, Target, TrendingUp, ChevronRight, LayoutGrid, List, Search, CheckCircle, MoreVertical, AlertTriangle, Trash2 } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import AllTasksView from '../../shared/AllTasksView';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import { AddEmployeeModal } from '../../shared/AddEmployeeModal';
import { EditEmployeeModal } from '../../shared/EditEmployeeModal';
import { supabase } from '../../../lib/supabaseClient';
import PayslipsPage from '../../shared/PayslipsPage';
import PayrollPage from '../../shared/PayrollPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import { AddPolicyModal } from '../../shared/AddPolicyModal';
import { useUser } from '../context/UserContext';
import { useProject } from '../../employee/context/ProjectContext';
import ProjectDocuments from '../../employee/pages/ProjectDocuments';
import DocumentViewer from '../../shared/DocumentViewer';
import { usePolicies } from '../../shared/hooks/usePolicies';
import PoliciesFeature from '../../shared/features/PoliciesFeature';
import { useEmployees } from '../../shared/hooks/useEmployees';
import EmployeesFeature from '../../shared/features/EmployeesFeature';
import { useLeaves } from '../../shared/hooks/useLeaves';
import ApplyLeaveModal from '../../shared/Leaves/ApplyLeaveModal';
import LeaveDetailsModal from '../../shared/Leaves/LeaveDetailsModal';
import LeavesFeature from '../../shared/features/LeavesFeature';
import EmployeeDetailsModal from '../../shared/EmployeeDetailsModal';
import CandidateDetailsModal from '../../shared/CandidateDetailsModal';
import HandoverModal from '../../shared/HandoverModal';
import { calculateRemainingLeaves } from '../../../utils/payrollCalculations';



const ModulePage = ({ title, type }) => {
    const { addToast } = useToast();
    const { userId, userRole, orgId } = useUser();
    const { currentProject, projectRole } = useProject();
    const navigate = useNavigate();

    // State for view controls
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useState('grid');
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [availabilityFilter, setAvailabilityFilter] = useState('all');

    // State for leave requests
    // State for leave requests
    const [leaveRequests, setLeaveRequests] = useState([]);

    // ... (rest of states remain same)

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);

    // State for Apply Leave modal
    const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);

    // State for Employee Details modal
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);

    // State for Handover Modal
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [selectedMemberForHandover, setSelectedMemberForHandover] = useState(null);

    // State for Edit Employee modal
    const [employeeToEdit, setEmployeeToEdit] = useState(null);
    const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    // Shared Employees Hook
    const { 
        employees: sharedEmployees, 
        refetch: refetchEmployees 
    } = useEmployees(orgId);

    const activeEmployeesMode = type === 'project-members'
        ? sharedEmployees.filter(emp => emp.assignedProjects.some(p => p.id === currentProject?.id))
        : sharedEmployees;

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Hook for Policies
    const { policies: sharedPolicies, isLoadingPolicies: sharedIsLoadingPolicies, policyError: sharedPolicyError, handleDeletePolicy: sharedHandleDeletePolicy } = usePolicies(type === 'policies' ? orgId : null, addToast);
    
    // Hook for Leaves
    const { leaves: sharedLeaves, leaveStats: sharedLeaveStats, remainingLeaves: sharedRemainingLeaves, refetch: refetchLeaves } = useLeaves(orgId, userId, type === 'my-leaves' ? 'personal' : type === 'employee-leave-info' ? 'org' : 'manager');

    const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
    const [showPolicyPreview, setShowPolicyPreview] = useState(false);
    const [policyPreviewUrl, setPolicyPreviewUrl] = useState('');
    const [policyPreviewFileName, setPolicyPreviewFileName] = useState('');


    // Left blank natively - Policies, Employees, and Leaves are handled by respective hooks.


    // Real-time Subscription for Live Status & Data
    React.useEffect(() => {
        const sub = supabase
            .channel('manager-module-complete-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, []);

    const fetchPendingTasks = async (employeeId, beforeDate) => {
        try {
            let query = supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .eq('org_id', orgId)
                .not('status', 'in', '("completed","closed")');

            if (beforeDate) {
                query = query.lt('due_date', beforeDate);
            }

            const { data, error } = await query
                .order('due_date', { ascending: true })
                .limit(5);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching pending tasks:', error);
            return [];
        }
    };

    const handleViewLeave = (leaveRequest) => {
        setSelectedLeaveRequest(leaveRequest);
        setShowLeaveDetailsModal(true);
    };


    const handlePolicySuccess = (newPolicy) => {
        // Refresh the policies list
        setRefreshTrigger(prev => prev + 1);
        addToast(`Policy "${newPolicy.title}" created successfully!`, 'success');
    };

    const handleAction = async (action, item) => {
        if ((type === 'leaves' || type === 'my-leaves') && action === 'Apply for Leave') {
            setShowApplyLeaveModal(true);
        } else if (action === 'View Leave') {
            handleViewLeave(item);
        } else if (type === 'leaves' && (action === 'Approve' || action === 'Reject')) {
            try {
                // Database update (Lowercase for DB)
                const dbStatus = action === 'Approve' ? 'approved' : 'rejected';

                // Fetch latest profile status for the employee
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

                    // Update leave record with final split and status
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

                    // Update profile simple counter (for other parts of system that might use it)
                    const { error: profileUpdateError } = await supabase
                        .from('profiles')
                        .update({
                            leaves_taken_this_month: alreadyTaken + finalPaid
                        })
                        .eq('id', item.employee_id)
                        .eq('org_id', orgId);

                    if (profileUpdateError) throw profileUpdateError;
                    console.log(`Approved: Allocated ${finalPaid} paid days in current month.`);

                } else {
                    // For Rejection, we just update status. 
                    // No refund logic needed because balance was never deducted upfront.
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
        } else if (action === 'View Employee' || action === 'View Status') {
            // Fetch additional financial details for the employee
            try {
                const { data: financeData, error: financeError } = await supabase
                    .from('employee_finance')
                    .select('*')
                    .eq('employee_id', item.id)
                    .eq('org_id', orgId)
                    .eq('is_active', true)
                    .order('effective_from', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // Fetch task completion count
                const { data: tasksData } = await supabase
                    .from('tasks')
                    .select('id, status')
                    .eq('assigned_to', item.id)
                    .eq('org_id', orgId);

                const completedTasks = tasksData?.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length || 0;
                const totalTasks = tasksData?.length || 0;

                // Calculate gross salary (basic + hra + allowances)
                const basicSalary = financeData?.basic_salary || 0;
                const hra = financeData?.hra || 0;
                const allowances = financeData?.allowances || 0;
                const grossSalary = basicSalary + hra + allowances;

                // Merge finance data with employee data
                const enrichedEmployee = {
                    ...item,
                    // Financial details from employee_finance
                    basic_salary: basicSalary,
                    hra: hra,
                    allowances: allowances,
                    gross_salary: grossSalary,
                    effective_from: financeData?.effective_from || null,
                    effective_to: financeData?.effective_to || null,
                    // Task metrics
                    tasksCompleted: completedTasks,
                    totalTasks: totalTasks,
                    // Calculate performance if not already present
                    performance: item.performance || (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 'N/A')
                };

                setSelectedEmployee(enrichedEmployee);
                setShowEmployeeModal(true);
            } catch (error) {
                console.error('Error fetching employee details:', error);
                // Still show modal with basic data if fetch fails
                setSelectedEmployee({
                    ...item,
                    basic_salary: 0,
                    hra: 0,
                    allowances: 0,
                    gross_salary: 0,
                    tasksCompleted: 0,
                    totalTasks: 0,
                    performance: item.performance || 'N/A'
                });
                setShowEmployeeModal(true);
            }
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else if (type === 'policies' && action === 'Add Policy') {
            setShowAddPolicyModal(true);
        } else if (action === 'Edit Employee') {
            setEmployeeToEdit(item);
            setShowEditEmployeeModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    const initiatHandover = (member) => {
        setSelectedMemberForHandover(member);
        setShowHandoverModal(true);
    };

    const confirmHandover = async () => {
        if (!currentProject || !selectedMemberForHandover) return;

        try {
            const { error } = await supabase.rpc('handover_project_role', {
                project_id_input: currentProject.id,
                target_user_id_input: selectedMemberForHandover.id // Use .id from employees row
            });

            if (error) throw error;

            addToast('Role handover successful! You are now an employee.', 'success');
            setShowHandoverModal(false);
            setSelectedMemberForHandover(null);

            // Refresh
            setRefreshTrigger(prev => prev + 1);
            // Ideally navigate away or refresh full app context if privileges are lost
        } catch (error) {
            console.error('Handover failed:', error);
            addToast(error.message || 'Handover failed', 'error');
        }
    };



    // Render specific demos for certain types
    if (type === 'analytics') return <AnalyticsDemo currentProject={currentProject} projectRole={projectRole} userId={userId} />;
    if (type === 'tasks') return <AllTasksView key="team-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="team_tasks" orgId={orgId} />;
    if (type === 'global-tasks') return <AllTasksView key="global-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="global_tasks" orgId={orgId} />;
    if (type === 'personal-tasks') return <AllTasksView key="personal-tasks" userRole={userRole} projectRole={projectRole} userId={userId} addToast={addToast} viewMode="my_tasks" orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') {
        return (
            <div style={{ height: 'calc(100vh - 200px)', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <HierarchyDemo />
            </div>
        );
    }
    if (title === 'Project Hierarchy') {
        return (
            <div style={{ height: 'calc(100vh - 200px)', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <ProjectHierarchyDemo />
            </div>
        );
    }
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (type === 'payroll-generation') return <PayrollPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (type === 'documents') return <ProjectDocuments />;

    // Mock Data Configurations
    const configs = {
        workforce: {
            columns: [
                {
                    header: 'Employee Name', accessor: 'name', render: (row) => (
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
                { header: 'Project', accessor: 'department_display' },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => handleAction('View Employee', row)}
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
                            {((projectRole === 'project_manager' || projectRole === 'team_lead') && row.id !== userId) && (
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
                                            width: '160px',
                                            zIndex: 50,
                                            overflow: 'hidden',
                                            padding: '4px'
                                        }}>
                                            <button
                                                onClick={() => { initiatHandover(row); setActiveMenuId(null); }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '8px 12px',
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
                { header: 'Employee', accessor: 'name' },
                { header: 'Project', accessor: 'department_display' },
                {
                    header: 'Availability', accessor: 'availability', render: (row) => (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: row.availability === 'Online' ? 'var(--success)' : row.availability === 'On Leave' ? '#d97706' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)',
                            fontWeight: 600
                        }}>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                backgroundColor: row.availability === 'Online' ? 'var(--success)' : row.availability === 'On Leave' ? '#d97706' : row.availability === 'Away' ? 'var(--warning)' : 'var(--text-secondary)'
                            }}></span>
                            {row.availability}
                        </span>
                    )
                },
                { header: 'Current Task', accessor: 'task' },
                { header: 'Last Active', accessor: 'lastActive' },
            ],
            data: activeEmployeesMode
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
        payroll: {
            columns: [
                { header: 'Employee', accessor: 'name' },
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

    console.log('Current type:', type);
    console.log('Available configs:', Object.keys(configs));
    const config = configs[type] || configs.default;
    console.log('Selected config:', config);

    if (type === 'policies') {
        return (
            <PoliciesFeature 
                policies={sharedPolicies}
                isLoadingPolicies={sharedIsLoadingPolicies}
                policyError={sharedPolicyError}
                userRole={userRole}
                onDeletePolicy={sharedHandleDeletePolicy}
                onEditPolicy={() => addToast('Editing capabilities are not fully wired yet.', 'info')}
                addToast={addToast}
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Premium Header - Reusing the Dashboard Aesthetic */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '32px 40px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                marginBottom: '16px'
            }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-module" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-module)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)' }}>Management</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', fontWeight: '600' }}>{title}</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                            {title}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                            {type === 'leaves' ? 'Review and manage team leave requests and attendance balance.' :
                                type === 'my-leaves' ? 'Track your personal leave history and available balance.' :
                                    type === 'employee-leave-info' ? 'Detailed breakdown of employee leave balance and history.' :
                                        `Management portal for organizational ${title ? title.toLowerCase() : 'modules'}`}
                        </p>
                    </div>

                    {(type === 'leaves' || type === 'my-leaves' || type === 'employee-leave-info') && (
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(12px)',
                            padding: '16px 24px',
                            borderRadius: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px'
                        }}>
                            {type === 'leaves' && (
                                <button
                                    onClick={() => navigate('/manager-dashboard/leaves/employee-info')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 24px',
                                        borderRadius: '14px',
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        cursor: 'pointer',
                                        fontWeight: '800',
                                        fontSize: '0.9rem',
                                        backdropFilter: 'blur(4px)',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                >
                                    <Users size={20} strokeWidth={3} /> Leave Info
                                </button>
                            )}

                            {type === 'employee-leave-info' && (
                                <button
                                    onClick={() => navigate('/manager-dashboard/leaves')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 24px',
                                        borderRadius: '14px',
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        cursor: 'pointer',
                                        fontWeight: '800',
                                        fontSize: '0.9rem',
                                        backdropFilter: 'blur(4px)',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                >
                                    <ChevronRight size={20} strokeWidth={3} style={{ transform: 'rotate(180deg)' }} /> Back to Requests
                                </button>
                            )}

                            {(type === 'my-leaves') && (
                                <button
                                    onClick={() => handleAction('Apply for Leave')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 24px',
                                        borderRadius: '14px',
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
                    )}
                </div>
            </div>

            {/* Quick Stats Summary for Status & Workforce */}
            {(type === 'status' || type === 'workforce' || type === 'project-members') && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '24px',
                    marginBottom: '8px'
                }}>
                    {[
                        { label: 'Total Workforce', value: activeEmployeesMode.length, icon: <Users size={20} />, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' },
                        { label: 'Active Now', value: activeEmployeesMode.filter(e => e.availability === 'Online').length, icon: <CheckCircle size={20} />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
                        { label: 'On Leave', value: activeEmployeesMode.filter(e => e.availability === 'On Leave').length, icon: <Clock size={20} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
                        { label: 'Peak Engagement', value: '92%', icon: <Activity size={20} />, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.1)' }
                    ].map((stat, i) => (
                        <div key={i} style={{
                            backgroundColor: 'var(--card-bg)',
                            borderRadius: '24px',
                            padding: '24px',
                            border: '1px solid var(--card-border)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px'
                        }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                backgroundColor: stat.bg,
                                color: stat.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {stat.icon}
                            </div>
                            <div>
                                <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--card-subtext)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.02em' }}>{stat.label}</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--card-text)' }}>{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Search and Filters Bar for Status, Workforce & Project Members */}
            {(type === 'status' || type === 'workforce' || type === 'project-members') ? (
                <EmployeesFeature 
                    employees={activeEmployeesMode} 
                    type={type} 
                    title={title} 
                    onAction={handleAction} 
                />
            ) : (type === 'leaves' || type === 'employee-leave-info' || type === 'my-leaves') ? (
                <LeavesFeature 
                    leaves={type === 'employee-leave-info' ? sharedLeaveStats : sharedLeaves}
                    type={type}
                    title={title}
                    onAction={handleAction}
                    userId={userId}
                    projectRole={projectRole || userRole}
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
                    onSuccess={() => refetchLeaves()}
                    remainingLeaves={sharedRemainingLeaves}
                />
            )}

            {/* Employee Details Modal */}
            {showEmployeeModal && (
                <EmployeeDetailsModal selectedEmployee={selectedEmployee} onClose={() => setShowEmployeeModal(false)} />
            )}

            {/* Candidate Details Modal */}
            {showCandidateModal && (
                <CandidateDetailsModal selectedCandidate={selectedCandidate} onClose={() => setShowCandidateModal(false)} onScheduleInterview={() => { addToast(`Action for ${selectedCandidate.name}`, 'info'); setShowCandidateModal(false); }} />
            )}

            {/* Leave Details Modal */}
            {showLeaveDetailsModal && selectedLeaveRequest && (
                <LeaveDetailsModal
                    selectedLeaveRequest={selectedLeaveRequest}
                    onClose={() => setShowLeaveDetailsModal(false)}
                    onApprove={(req) => {
                        handleAction('Approve', req);
                        setShowLeaveDetailsModal(false);
                    }}
                    onReject={(req) => {
                        handleAction('Reject', req);
                        setShowLeaveDetailsModal(false);
                    }}
                    orgId={orgId}
                />
            )}
            {/* Handover Confirmation Modal */}
            {showHandoverModal && (
                <HandoverModal selectedMemberForHandover={selectedMemberForHandover} projectRole={projectRole} onClose={() => { setShowHandoverModal(false); setSelectedMemberForHandover(null); }} onConfirm={confirmHandover} />
            )}

            {/* Add Policy Modal */}
            <AddPolicyModal
                isOpen={showAddPolicyModal}
                onClose={() => setShowAddPolicyModal(false)}
                onSuccess={handlePolicySuccess}
                orgId={orgId}
            />

            {showEditEmployeeModal && (
                <EditEmployeeModal
                    isOpen={showEditEmployeeModal}
                    onClose={() => setShowEditEmployeeModal(false)}
                    onSuccess={() => {
                        setRefreshTrigger(prev => prev + 1);
                        setShowEditEmployeeModal(false);
                        addToast('Employee updated successfully', 'success');
                    }}
                    employee={employeeToEdit}
                    orgId={orgId}
                />
            )}

            {/* Document Preview Modal */}
            {
                showPolicyPreview && policyPreviewUrl && (
                    <DocumentViewer
                        url={policyPreviewUrl}
                        fileName={policyPreviewFileName || "Document"}
                        onClose={() => { setShowPolicyPreview(false); setPolicyPreviewUrl(''); setPolicyPreviewFileName(''); }}
                    />
                )
            }
        </div>
    );
};

export default ModulePage;
