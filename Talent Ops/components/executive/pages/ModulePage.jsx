import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Eye, Mail, Phone, MapPin, Calendar, Briefcase, Download, Edit, Users, Clock, Activity, Target, TrendingUp, ChevronRight, LayoutGrid, List, Search, Map as MapIcon, CheckCircle, Trash2 } from 'lucide-react';
import DataTable from '../components/UI/DataTable';
import { useToast } from '../context/ToastContext';
import AnalyticsDemo from '../components/Demo/AnalyticsDemo';
import KanbanDemo from '../components/Demo/KanbanDemo';
import TaskLifecyclePage from '../../shared/TaskLifecyclePage';
import AllTasksView from '../../shared/AllTasksView';
import HierarchyDemo from '../components/Demo/HierarchyDemo';
import SettingsDemo from '../components/Demo/SettingsDemo';
import AuditLogsDemo from '../components/Demo/AuditLogsDemo';
import { AddEmployeeModal } from '../../shared/AddEmployeeModal';
import { EditEmployeeModal } from '../../shared/EditEmployeeModal';
import { supabase } from '../../../lib/supabaseClient';
import PayslipsPage from '../../shared/PayslipsPage';
import PayrollPage from '../../shared/PayrollPage';
import AnnouncementsPage from '../../shared/AnnouncementsPage';
import ProjectHierarchyDemo from '../../shared/ProjectHierarchyDemo';
import InvoiceGenerator from '../components/Invoice/InvoiceGenerator';
import { AddPolicyModal } from '../../shared/AddPolicyModal';
import { EditPolicyModal } from '../../shared/EditPolicyModal';
import { useUser } from '../context/UserContext';
import EmployeeDetailsModal from '../../shared/EmployeeDetailsModal';
import CandidateDetailsModal from '../../shared/CandidateDetailsModal';
import ApplyLeaveModal from '../../shared/Leaves/ApplyLeaveModal';
import LeaveDetailsModal from '../../shared/Leaves/LeaveDetailsModal';
import ProjectAnalytics from '../../shared/ProjectAnalytics/ProjectAnalytics';
import DocumentViewer from '../../shared/DocumentViewer';
import { usePolicies } from '../../shared/hooks/usePolicies';
import PoliciesFeature from '../../shared/features/PoliciesFeature';
import { useEmployees } from '../../shared/hooks/useEmployees';
import EmployeesFeature from '../../shared/features/EmployeesFeature';
import { useLeaves } from '../../shared/hooks/useLeaves';
import LeavesFeature from '../../shared/features/LeavesFeature';
import { calculateRemainingLeaves } from '../../../utils/payrollCalculations';


const ModulePage = ({ title, type }) => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { userId, orgId, userRole } = useUser();
    const [searchTerm, setSearchTerm] = useState('');

    // Shared Leaves Data
    const { leaves: sharedLeaves, leaveStats: sharedLeaveStats, remainingLeaves: sharedRemainingLeaves, refetch: refetchLeaves } = useLeaves(orgId, userId, type === 'my-leaves' ? 'personal' : type === 'employee-leave-info' ? 'org' : 'manager');

    // State for Leave Details modal
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
    const [showLeaveDetailsModal, setShowLeaveDetailsModal] = useState(false);

    // State for Apply Leave modal
    const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);

    // State for Employee Details modal
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [employeeSalary, setEmployeeSalary] = useState(null);

    // State for Candidate Details modal
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showCandidateModal, setShowCandidateModal] = useState(false);

    // State for Candidates
    const [candidates, setCandidates] = useState([]);

    // Temporary variables to prevent ReferenceErrors in unremoved legacy JSX
    const [employeeTasks, setEmployeeTasks] = useState([]);
    const [pendingTasks, setPendingTasks] = useState([]);
    const [evalBalance, setEvalBalance] = useState(0);
    const [evalPendingPaid, setEvalPendingPaid] = useState(0);
    const [leaveFormData, setLeaveFormData] = useState({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
    const [selectedDates, setSelectedDates] = useState([]);
    const [dateToAdd, setDateToAdd] = useState('');

    const [showCandidateFormModal, setShowCandidateFormModal] = useState(false);
    const [isEditingCandidate, setIsEditingCandidate] = useState(false);
    const [candidateFormData, setCandidateFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: '',
        stage: 'Screening',
        score: 0,
        source: '',
        appliedDate: new Date().toISOString().split('T')[0],
        experience: '',
        education: '',
        location: '',
        expectedSalary: '',
        availability: '',
        skills: '',
        notes: ''
    });

    // Shared Employees Hook
    const { 
        employees: sharedEmployees, 
        departments, 
        projects, 
        teams: teamOptions, 
        refetch: refetchEmployees 
    } = useEmployees(orgId);

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
    const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);

    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
    const [selectedProjectsForAdd, setSelectedProjectsForAdd] = useState([]); // For multi-project selection
    const [addEmployeeFormData, setAddEmployeeFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: '',
        department_id: '',
        phone: '',
        location: '',
        joinDate: new Date().toISOString().split('T')[0],
        basic_salary: '',
        hra: '',
        allowances: '',
    });

    // State for Policies Modals (Data handled by shared hook)
    const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
    const [showEditPolicyModal, setShowEditPolicyModal] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState(null);





    // Shared Policies Hook
    const { 
        policies: sharedPolicies, 
        isLoadingPolicies: sharedIsLoadingPolicies, 
        policyError: sharedPolicyError,
        fetchPolicies,
        handleDeletePolicy 
    } = usePolicies(orgId, addToast);


    // Real-time Subscription for Live Status
    React.useEffect(() => {
        if (type !== 'status' && type !== 'workforce') return;

        const sub = supabase
            .channel('executive_attendance_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `org_id=eq.${orgId}` }, (payload) => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [type]);

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

    const fetchEmployeeTasks = async (employeeId, startDate, endDate) => {
        try {
            // Overlap logic: Task Start <= Leave End AND Task End >= Leave Start
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', employeeId)
                .eq('org_id', orgId)
                .lte('start_date', endDate)
                .gte('due_date', startDate);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    };

    const fetchEmployeeSalary = async (employeeId) => {
        try {
            const { data, error } = await supabase
                .from('employee_finance')
                .select('*')
                .eq('employee_id', employeeId)
                .eq('is_active', true)
                .eq('org_id', orgId)
                .single();

            if (error) {
                console.log('No active salary record found:', error);
                setEmployeeSalary(null);
                return;
            }

            setEmployeeSalary(data);
        } catch (error) {
            console.error('Error fetching employee salary:', error);
            setEmployeeSalary(null);
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();

        try {
            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                addToast('You must be logged in to add employees', 'error');
                return;
            }

            console.log('Adding employee with data:', addEmployeeFormData);

            // Call the Supabase Edge Function to add employee
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-employee`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        full_name: addEmployeeFormData.name,
                        email: addEmployeeFormData.email,
                        password: addEmployeeFormData.password,
                        role: addEmployeeFormData.role.toLowerCase(),
                        project_id: selectedProjectsForAdd[0] || null,
                        department_id: addEmployeeFormData.department_id || null,
                        monthly_leave_quota: 3,
                        basic_salary: parseFloat(addEmployeeFormData.basic_salary),
                        hra: parseFloat(addEmployeeFormData.hra),
                        allowances: parseFloat(addEmployeeFormData.allowances) || 0,
                        org_id: orgId
                    }),
                }
            );

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            console.log('Edge Function response:', result);

            if (!response.ok) {
                console.error('Edge Function error:', result);
                throw new Error(result.error || result.message || `Server error: ${response.status}`);
            }

            // Get the user_id - either from the response or by querying
            let userId = result.user_id;

            if (!userId) {
                // Query for the newly created user by email
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', addEmployeeFormData.email)
                    .eq('org_id', orgId)
                    .single();

                if (profileError) {
                    console.error('Error fetching user profile:', profileError);
                } else {
                    userId = profileData?.id;
                }
            }

            if (userId) {
                // Update profile with department if selected
                if (addEmployeeFormData.department_id) {
                    console.log('Updating profile with department ID:', addEmployeeFormData.department_id);
                    await supabase
                        .from('profiles')
                        .update({ department: addEmployeeFormData.department_id })
                        .eq('id', userId)
                        .eq('org_id', orgId);
                }

                // If a project was selected, add the user to project_members
                if (selectedProjectsForAdd && selectedProjectsForAdd.length > 0) {
                    console.log('Adding to project:', selectedProjectsForAdd[0]);
                    // Insert into project_members table
                    const { error: projectMemberError } = await supabase
                        .from('project_members')
                        .insert({
                            project_id: selectedProjectsForAdd[0],
                            user_id: userId,
                            org_id: orgId,
                            role: addEmployeeFormData.role.toLowerCase()
                        });

                    if (projectMemberError) {
                        console.error('Error adding to project_members:', projectMemberError);
                    } else {
                        console.log('Successfully added to project_members');
                    }

                    // Insert into team_members table (using project_id as team_id)
                    const { error: teamMemberError } = await supabase
                        .from('team_members')
                        .insert({
                            team_id: selectedProjectsForAdd[0],
                            profile_id: userId,
                            org_id: orgId,
                            role_in_project: addEmployeeFormData.role.toLowerCase()
                        });

                    if (teamMemberError) {
                        console.error('Error adding to team_members:', teamMemberError);
                    } else {
                        console.log('Successfully added to team_members');
                    }

                    // Update profiles.team_id for dashboard compatibility
                    const { error: profileTeamIdError } = await supabase
                        .from('profiles')
                        .update({ team_id: selectedProjectsForAdd[0] })
                        .eq('id', userId)
                        .eq('org_id', orgId);

                    if (profileTeamIdError) {
                        console.error('Error updating team_id in profiles:', profileTeamIdError);
                    } else {
                        console.log('Successfully updated team_id in profiles');
                    }
                }
            } else {
                console.error('Could not determine user_id for project mapping');
            }

            // Reset form
            setAddEmployeeFormData({
                name: '',
                email: '',
                password: '',
                role: '',
                project_id: '',
                department_id: '',
                phone: '',
                location: '',
                joinDate: new Date().toISOString().split('T')[0],
                basic_salary: '',
                hra: '',
                allowances: '',
            });

            setShowAddEmployeeModal(false);
            addToast('Employee added successfully!', 'success');
            setRefreshTrigger(prev => prev + 1); // Refresh the employee list
        } catch (err) {
            console.error('Error adding employee:', err);
            addToast(err.message || 'Failed to add employee', 'error');
        }
    };

    const handleViewLeave = (leaveRequest) => {
        setSelectedLeaveRequest(leaveRequest);
        setShowLeaveDetailsModal(true);
    };



    const handlePolicySuccess = (newPolicy) => {
        // Refresh the policies list
        setRefreshTrigger(prev => prev + 1);
        fetchPolicies();
        addToast(`Policy "${newPolicy.title}" created successfully!`, 'success');
    };

    const handleEditPolicy = (policy) => {
        setSelectedPolicy(policy);
        setShowEditPolicyModal(true);
    };



    const handleAction = async (action, item) => {
        if (type === 'leaves' && action === 'Apply for Leave') {
            setSelectedDates([]);
            setDateToAdd('');
            setShowApplyLeaveModal(true);
        } else if (type === 'workforce' && action === 'Add Employee') {
            setShowAddEmployeeModal(true);
        } else if (type === 'recruitment' && action === 'Add Candidate') {
            setIsEditingCandidate(false);
            setCandidateFormData({
                name: '',
                email: '',
                phone: '',
                role: '',
                stage: 'Screening',
                score: 0,
                source: '',
                appliedDate: new Date().toISOString().split('T')[0],
                experience: '',
                education: '',
                location: '',
                expectedSalary: '',
                availability: '',
                skills: '',
                notes: ''
            });
            setShowCandidateFormModal(true);
        } else if (type === 'policies' && action === 'Add Policy') {
            setShowAddPolicyModal(true);
        } else if (type === 'recruitment' && action === 'Edit Candidate') {
            setIsEditingCandidate(true);
            setCandidateFormData({
                ...item,
                skills: item.skills ? item.skills.join(', ') : ''
            });
            setShowCandidateFormModal(true);
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
                        .eq('org_id', orgId)
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

                    // Update profile for sync
                    const { error: profileUpdateError } = await supabase
                        .from('profiles')
                        .update({
                            leaves_taken_this_month: alreadyTaken+ finalPaid
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
        } else if (action === 'View Employee' || action === 'View Status') {
            // Fetch additional details for the employee
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
                    professional_tax: financeData?.professional_tax || 0,
                    stipend: financeData?.stipend || 0,
                    is_paid: item.is_paid, // From profile
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

                // Also set employeeSalary for the compensation section
                if (financeData) {
                    setEmployeeSalary({
                        ...financeData,
                        is_paid: item.is_paid
                    });
                }
            } catch (error) {
                console.error('Error fetching employee details:', error);
                // Still show modal with basic data if fetch fails
                setSelectedEmployee({
                    ...item,
                    basic_salary: 0,
                    hra: 0,
                    allowances: 0,
                    gross_salary: 0,
                    professional_tax: 0,
                    tasksCompleted: 0,
                    totalTasks: 0,
                    performance: item.performance || 'N/A'
                });
                setShowEmployeeModal(true);
                setEmployeeSalary(null);
            }
        } else if (action === 'Edit Employee') {
            setSelectedEmployeeForEdit(item);
            setShowEditEmployeeModal(true);
        } else if (action === 'View Candidate') {
            setSelectedCandidate(item);
            setShowCandidateModal(true);
        } else {
            addToast(`${action} clicked${item ? ` for ${item.name || item.id}` : ''}`, 'info');
        }
    };

    const openApplyLeaveModal = async () => {
        try {
            // Fetch pending tasks for the applier (Current Executive)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const tasks = await fetchPendingTasks(user.id);
                setPendingTasks(tasks);
            }

            setShowApplyLeaveModal(true);
        } catch (error) {
            console.error('Error opening apply leave modal:', error);
            setShowApplyLeaveModal(true);
        }
    };

    const handleApplyLeave = (e) => {
        e.preventDefault();

        const useSpecificDates = selectedDates.length > 0;
        const datesToApply = useSpecificDates
            ? Array.from(new Set(selectedDates)).sort()
            : [];

        if (useSpecificDates && datesToApply.length === 0) {
            addToast('Please select at least one leave date.', 'error');
            return;
        }

        if (!useSpecificDates && (!leaveFormData.startDate || !leaveFormData.endDate || leaveFormData.endDate < leaveFormData.startDate)) {
            addToast('End date must be the same or after the start date.', 'error');
            return;
        }

        // 7-day advance notice validation (except Sick Leave)
        const selectedType = leaveFormData.leaveType;
        const isSickLeave = (selectedType || '').toLowerCase().includes('sick');

        if (!isSickLeave) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const minAdvanceDate = new Date(today);
            minAdvanceDate.setDate(today.getDate() + 7);
            
            const activeStartDate = useSpecificDates ? datesToApply[0] : leaveFormData.startDate;
            const requestStart = new Date(activeStartDate);
            requestStart.setHours(0, 0, 0, 0);
            
            if (requestStart < minAdvanceDate) {
                addToast('All leave requests (except Sick Leave) must be submitted at least 7 days in advance.', 'error');
                return;
            }
        }

        // Calculate duration
        const start = new Date(leaveFormData.startDate);
        const end = new Date(leaveFormData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const requestedDays = useSpecificDates ? datesToApply.length : diffDays;
        const duration = requestedDays === 1 ? '1 Day' : `${requestedDays} Days`;

        // Format dates
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        };
        const dates = useSpecificDates
            ? datesToApply.map(formatDate).join(', ')
            : (leaveFormData.startDate === leaveFormData.endDate
                ? formatDate(leaveFormData.startDate)
                : `${formatDate(leaveFormData.startDate)} - ${formatDate(leaveFormData.endDate)}`);

        // Insert leave request(s)
        const submitToDb = async () => {
            try {
                // Calculate dynamic annual remaining balance, subtracting pending leaves of this year
                const currentYear = new Date().getFullYear();
                const firstOfYear = `${currentYear}-01-01`;
                const lastOfYear = `${currentYear}-12-31`;

                const { data: pendingLeaves } = await supabase
                    .from('leaves')
                    .select('duration_weekdays')
                    .eq('employee_id', userId)
                    .eq('status', 'pending')
                    .gte('from_date', firstOfYear)
                    .lte('from_date', lastOfYear);

                const pendingPaid = pendingLeaves?.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0) || 0;
                
                const remainingBalance = await calculateRemainingLeaves(userId, orgId);
                const effectiveBalance = Math.max(0, remainingBalance - pendingPaid);

                const leaveReason = `${leaveFormData.leaveType}: ${leaveFormData.reason}` +
                    (useSpecificDates ? ` (Dates: ${datesToApply.join(', ')})` : '');

                const leaveRows = useSpecificDates
                    ? datesToApply.map((date, idx) => {
                        const isPaid = idx < effectiveBalance;
                        return {
                            employee_id: userId,
                            org_id: orgId,
                            from_date: date,
                            to_date: date,
                            reason: leaveReason,
                            status: 'pending',
                            duration_weekdays: isPaid ? 1 : 0,
                            lop_days: isPaid ? 0 : 1
                        };
                    })
                    : (() => {
                        const paidDays = Math.min(requestedDays, effectiveBalance);
                        const lopDays = requestedDays - paidDays;
                        return [{
                            employee_id: userId,
                            org_id: orgId,
                            from_date: leaveFormData.startDate,
                            to_date: leaveFormData.endDate,
                            reason: leaveReason,
                            status: 'pending',
                            duration_weekdays: paidDays,
                            lop_days: lopDays
                        }];
                    })();

                const { error: insertError } = await supabase
                    .from('leaves')
                    .insert(leaveRows);

                if (insertError) throw insertError;

                addToast('Leave application submitted successfully', 'success');
                setShowApplyLeaveModal(false);
                setLeaveFormData({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
                setSelectedDates([]);
                setDateToAdd('');
                setRefreshTrigger(prev => prev + 1); // Refresh list
            } catch (error) {
                console.error('Error applying leave:', error);
                addToast('Failed to submit leave request', 'error');
            }
        };

        submitToDb();
    };

    const handleSaveCandidate = (e) => {
        e.preventDefault();
        const skillsArray = candidateFormData.skills.split(',').map(skill => skill.trim()).filter(skill => skill !== '');

        if (isEditingCandidate) {
            setCandidates(prevCandidates => prevCandidates.map(cand =>
                cand.id === candidateFormData.id
                    ? { ...candidateFormData, skills: skillsArray }
                    : cand
            ));
            addToast('Candidate updated successfully', 'success');
        } else {
            const newCandidate = {
                id: candidates.length + 1,
                ...candidateFormData,
                skills: skillsArray
            };
            setCandidates([...candidates, newCandidate]);
            addToast('Candidate added successfully', 'success');
        }
        setShowCandidateFormModal(false);
    };

    // Render specific demos for certain types
    if (type === 'analytics') return <AnalyticsDemo />;
    if (type === 'tasks') return <AllTasksView userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (title === 'Team Hierarchy' || title === 'Organizational Hierarchy' || title === 'Hierarchy') return <HierarchyDemo />;
    if (title === 'Project Hierarchy') return <ProjectHierarchyDemo isEditingEnabled={true} />;
    if (title === 'Settings') return <SettingsDemo />;
    if (title === 'Announcements') return <AnnouncementsPage userRole={userRole} userId={userId} orgId={orgId} />;
    if (type === 'payroll') return <PayslipsPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (type === 'payroll-generation') return <PayrollPage userRole={userRole} userId={userId} addToast={addToast} orgId={orgId} />;
    if (type === 'invoice') return <InvoiceGenerator orgId={orgId} />;
    if (type === 'project-analytics') return <ProjectAnalytics userRole="executive" dashboardPrefix="/executive-dashboard" orgId={orgId} />;

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

                { header: 'Job Title', accessor: 'job_title' },
                { header: 'Department', accessor: 'department_display' },
                { header: 'Project', accessor: 'department_display' },
                { header: 'Join Date', accessor: 'joinDate' },
                {
                    header: 'Actions', accessor: 'actions', render: (row) => (
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                            <button
                                onClick={() => handleAction('Edit Employee', row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fcd34d',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                            >
                                Edit
                            </button>
                        </div>
                    )
                },
            ],
            data: sharedEmployees
        },
        status: {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Department', accessor: 'department_display' },
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
            data: sharedEmployees
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
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                            <button
                                onClick={() => handleAction('Edit Candidate', row)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fcd34d',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                            >
                                Edit
                            </button>
                        </div>
                    )
                },
            ],
            data: candidates
        },
        leaves: {
            columns: [
                { header: 'Employee', accessor: 'name' },
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
                        row.status === 'Pending' && row.employee_id !== userId ? (
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
                                <button
                                    onClick={() => handleViewLeave(row)}
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
                                    onClick={() => handleViewLeave(row)}
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
                            </div>
                        ) : (
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
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>-</span>
                            </div>
                        )
                    )
                },
            ],
            data: sharedLeaves
        },
        'employee-leave-info': {
            columns: [
                { header: 'Employee', accessor: 'name' },
                { header: 'Total Leaves Taken', accessor: 'total_taken' },
                { header: 'Paid Leaves', accessor: 'paid_leaves' },
                { header: 'Loss of Pay Days', accessor: 'lop_days' },
                { header: 'Leaves Left', accessor: 'leaves_left' }
            ],
            data: sharedLeaves
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

    const config = configs[type] || configs.default;

    if (type === 'policies') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', paddingBottom: '40px' }}>
                <PoliciesFeature 
                    policies={sharedPolicies}
                    isLoadingPolicies={sharedIsLoadingPolicies}
                    policyError={sharedPolicyError}
                    userRole={userRole}
                    onEditPolicy={handleEditPolicy}
                    onDeletePolicy={handleDeletePolicy}
                    onAddPolicy={() => setShowAddPolicyModal(true)}
                />

                {/* Add Policy Modal */}
                <AddPolicyModal
                    isOpen={showAddPolicyModal}
                    onClose={() => setShowAddPolicyModal(false)}
                    onSuccess={handlePolicySuccess}
                    orgId={orgId}
                />

                {/* Edit Policy Modal */}
                <EditPolicyModal
                    isOpen={showEditPolicyModal}
                    onClose={() => setShowEditPolicyModal(false)}
                    onSuccess={handlePolicySuccess}
                    policy={selectedPolicy}
                    orgId={orgId}
                />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '40px' }}>
            {/* Premium Header - Reusing the Dashboard Aesthetic */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '20px 24px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
                marginBottom: '4px'
            }}>
                {/* Mesh Grid Background */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
                    backgroundSize: '40px 40px',
                    opacity: 0.4
                }}></div>

                {/* Animated Glow Orbs */}
                <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', bottom: '-150px', left: '-50px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(129, 140, 248, 0.08) 0%, transparent 70%)', borderRadius: '50%' }}></div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Executive Control</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: '700' }}>{title} Hub</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '4px', letterSpacing: '-0.04em', lineHeight: 1 }}>
                            {title.split(' ').map((word, i) => i === title.split(' ').length - 1 ? <span key={i} style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{word}</span> : word + ' ')}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.4 }}>
                            {type === 'workforce' ? `Managing and scaling your talent network. ${sharedEmployees.length} active profiles monitored.` :
                                type === 'status' ? `Real-time visibility into peak performance and workforce engagement.` :
                                    `Systematic overview of organizational ${title.toLowerCase()} and operational assets.`}
                        </p>
                    </div>

                    {(type === 'leaves' || type === 'employee-leave-info') && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {type === 'leaves' && (
                                <button
                                    onClick={() => navigate('/executive-dashboard/leaves/employee-info')}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        backdropFilter: 'blur(10px)',
                                        color: 'white',
                                        padding: '18px 24px',
                                        borderRadius: '24px',
                                        fontWeight: '800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        fontSize: '1rem',
                                        letterSpacing: '-0.02em',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                    }}
                                >
                                    <Users size={24} strokeWidth={3} />
                                    Leave Info
                                </button>
                            )}

                            {type === 'employee-leave-info' && (
                                <button
                                    onClick={() => navigate('/executive-dashboard/leaves')}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        backdropFilter: 'blur(10px)',
                                        color: 'white',
                                        padding: '18px 24px',
                                        borderRadius: '24px',
                                        fontWeight: '800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        fontSize: '1rem',
                                        letterSpacing: '-0.02em',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                    }}
                                >
                                    <ChevronRight size={24} strokeWidth={3} style={{ transform: 'rotate(180deg)' }} />
                                    Back to Requests
                                </button>
                            )}

                            {type === 'leaves' && (
                                <button
                                    onClick={() => openApplyLeaveModal()}
                                    style={{
                                        background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
                                        color: 'white',
                                        padding: '18px 36px',
                                        borderRadius: '24px',
                                        fontWeight: '800',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 25px -5px rgba(56, 189, 248, 0.4)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        fontSize: '1.1rem',
                                        letterSpacing: '-0.02em',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                        e.currentTarget.style.boxShadow = '0 20px 30px -5px rgba(56, 189, 248, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(56, 189, 248, 0.4)';
                                    }}
                                >
                                    <Plus size={24} strokeWidth={3} />
                                    Apply Leave
                                </button>
                            )}
                        </div>
                    )}
                    {(type === 'workforce' || type === 'recruitment' || type === 'policies') && (
                        <button
                            onClick={() => {
                                handleAction(type === 'workforce' ? 'Add Employee' : type === 'recruitment' ? 'Add Candidate' : 'Add Policy');
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
                                color: 'white',
                                padding: '18px 36px',
                                borderRadius: '24px',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 25px -5px rgba(56, 189, 248, 0.4)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                fontSize: '1.1rem',
                                letterSpacing: '-0.02em'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 20px 30px -5px rgba(56, 189, 248, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(56, 189, 248, 0.4)';
                            }}
                        >
                            <Plus size={24} strokeWidth={3} />
                            {type === 'workforce' ? 'Add Employee' : type === 'recruitment' ? 'Add Candidate' : 'Add Policy'}
                        </button>
                    )}

                    {/* Employee Lifecycle Button on Workforce Page */}
                    {type === 'workforce' && (
                        <button
                            onClick={() => navigate('/executive-dashboard/lifecycle')}
                            style={{
                                background: 'white',
                                color: 'var(--primary)',
                                padding: '18px 36px',
                                borderRadius: '24px',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                fontSize: '1.1rem',
                                letterSpacing: '-0.02em'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 20px 30px -5px rgba(0,0,0,0.15)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)';
                            }}
                        >
                            <TrendingUp size={24} strokeWidth={3} />
                            Manage Lifecycle
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats Summary */}
            {(type === 'workforce' || type === 'status') && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '24px',
                    marginBottom: '8px'
                }}>
                    {[
                        { label: 'Total Workforce', value: sharedEmployees.length, icon: <Users size={20} />, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' },
                        { label: 'Active Now', value: sharedEmployees.filter(e => e.availability === 'Online').length, icon: <CheckCircle size={20} />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
                        { label: 'On Leave', value: sharedEmployees.filter(e => e.availability === 'On Leave').length, icon: <Clock size={20} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
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

            {/* Premium Representation for Workforce/Status/Leaves */}
            {(type === 'leaves' || type === 'employee-leave-info' || type === 'my-leaves') ? (
                <LeavesFeature 
                    leaves={sharedLeaves} 
                    type={type} 
                    title={title} 
                    onAction={handleAction} 
                    userId={userId} 
                    projectRole={userRole}
                />
            ) : (type === 'workforce' || type === 'status') ? (
                <EmployeesFeature 
                    employees={sharedEmployees} 
                    type={type} 
                    title={title} 
                    onAction={handleAction} 
                />
            ) : (
                <DataTable
                    title={`${title} List`}
                    columns={config.columns}
                    data={config.data.filter(item => {
                        const searchStr = searchTerm.toLowerCase();
                        return (
                            (item.name && typeof item.name === 'string' && item.name.toLowerCase().includes(searchStr)) ||
                            (item.job_title && typeof item.job_title === 'string' && item.job_title.toLowerCase().includes(searchStr)) ||
                            (item.department_display && typeof item.department_display === 'string' && item.department_display.toLowerCase().includes(searchStr)) ||
                            (item.role && typeof item.role === 'string' && item.role.toLowerCase().includes(searchStr))
                        );
                    })}
                    onAction={handleAction}
                />
            )}

            {showApplyLeaveModal && (
                <ApplyLeaveModal
                    onClose={() => setShowApplyLeaveModal(false)}
                    userId={userId}
                    orgId={orgId}
                    teamId={null} // Executive usually doesn't have a single teamId for this context
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
                    onApprove={['leaves', 'employee-leave-info'].includes(type) ? handleAction.bind(null, 'Approve') : null}
                    onReject={['leaves', 'employee-leave-info'].includes(type) ? handleAction.bind(null, 'Reject') : null}
                    orgId={orgId}
                />
            )}


            {/* Employee Details Modal */}
            {showEmployeeModal && selectedEmployee && (
                <EmployeeDetailsModal
                    selectedEmployee={selectedEmployee}
                    onClose={() => setShowEmployeeModal(false)}
                />
            )}

            {/* Candidate Details Modal */}
            {showCandidateModal && selectedCandidate && (
                <CandidateDetailsModal
                    selectedCandidate={selectedCandidate}
                    onClose={() => setShowCandidateModal(false)}
                />
            )}

            {/* Add Employee Modal */}
            <AddEmployeeModal
                isOpen={showAddEmployeeModal}
                onClose={() => setShowAddEmployeeModal(false)}
                orgId={orgId}
                onSuccess={() => {
                    addToast('Employee added successfully', 'success');
                    if (type === 'workforce' || type === 'status') {
                        refetchEmployees();
                    }
                }}
            />

            {/* Edit Employee Modal */}
            <EditEmployeeModal
                isOpen={showEditEmployeeModal}
                onClose={() => {
                    setShowEditEmployeeModal(false);
                    setSelectedEmployeeForEdit(null);
                }}
                employee={selectedEmployeeForEdit}
                orgId={orgId}
                onSuccess={() => {
                    addToast('Employee updated successfully', 'success');
                    if (type === 'workforce' || type === 'status') {
                        refetchEmployees();
                    }
                }}
            />
        </div>
    );
};

export default ModulePage;
