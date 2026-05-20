import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export const useEmployees = (orgId) => {
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [projects, setProjects] = useState([]);
    const [teams, setTeams] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEmployees = useCallback(async () => {
        if (!orgId) return;
        
        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch metadata (Departments, Projects, Teams)
            const [deptRes, projRes, teamsRes] = await Promise.all([
                supabase.from('departments').select('id, department_name').eq('org_id', orgId),
                supabase.from('projects').select('id, name').eq('org_id', orgId).order('name'),
                supabase.from('teams').select('id, team_name').eq('org_id', orgId)
            ]);

            const deptsData = deptRes.data || [];
            const projsData = projRes.data || [];
            const teamsData = teamsRes.data || [];

            setDepartments(deptsData);
            setProjects(projsData);
            setTeams(teamsData);

            // 2. Fetch Employees and Team Assignments
            const [profilesRes, membersRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, email, role, department, job_title, join_date, avatar_url, team_id, created_at, employment_type, is_paid, is_active').eq('org_id', orgId),
                supabase.from('project_members').select('user_id, project_id, role, projects:project_id(name)').eq('org_id', orgId)
            ]);

            if (profilesRes.error) throw profilesRes.error;
            const profilesData = profilesRes.data || [];
            const teamMembersData = membersRes.data || [];

            // 3. Map Project Members
            const projectMap = {};
            teamMembersData.forEach(member => {
                if (!projectMap[member.user_id]) projectMap[member.user_id] = [];
                if (member.projects?.name) {
                    let roleDisplay = member.role || 'Member';
                    if (roleDisplay === 'team_lead') roleDisplay = 'Team Lead';
                    else if (roleDisplay === 'employee') roleDisplay = 'Employee';
                    else roleDisplay = roleDisplay.charAt(0).toUpperCase() + roleDisplay.slice(1);

                    projectMap[member.user_id].push({
                        id: member.project_id,
                        name: member.projects.name,
                        role: member.role || 'employee', // Keep raw role for filtering logic
                        roleDisplay: roleDisplay        // Display version
                    });
                }
            });

            // 4. Fetch Today's Attendance & Leaves for Live Status
            const today = new Date().toISOString().split('T')[0];
            const [attendanceRes, leavesRes] = await Promise.all([
                supabase.from('attendance').select('employee_id, clock_in, clock_out, date, current_task').eq('date', today).eq('org_id', orgId),
                supabase.from('leaves').select('employee_id').eq('status', 'approved').eq('org_id', orgId).lte('from_date', today).gte('to_date', today)
            ]);

            const attendanceData = attendanceRes.data || [];
            const leavesData = leavesRes.data || [];

            const attendanceMap = {};
            attendanceData.forEach(record => {
                attendanceMap[record.employee_id] = record;
            });

            const leaveSet = new Set(leavesData.map(l => l.employee_id));

            // 5. Transform Employees
            const transformedEmployees = profilesData.map(emp => {
                const attendance = attendanceMap[emp.id];
                let availability = 'Offline';
                let lastActive = 'N/A';

                if (attendance) {
                    if (attendance.clock_in && !attendance.clock_out) {
                        availability = 'Online';
                        lastActive = `Clocked in at ${attendance.clock_in.slice(0, 5)}`;
                    } else if (attendance.clock_out) {
                        availability = 'Offline';
                        lastActive = `Left at ${attendance.clock_out.slice(0, 5)}`;
                    }
                }

                if (availability === 'Offline' && leaveSet.has(emp.id)) {
                    availability = 'On Leave';
                }

                const currentTask = (availability === 'Online' && attendance?.current_task) 
                    ? attendance.current_task 
                    : (availability === 'Online') ? 'Available' : '-';

                // We return raw assigned projects data - UI components can handle rendering the display
                const assignedProjects = projectMap[emp.id] || [];

                const matchedDept = deptsData.find(d => d.id === emp.department);
                const departmentNameDisplay = matchedDept ? matchedDept.department_name : 'Unassigned';

                return {
                    id: emp.id,
                    name: emp.full_name || 'N/A',
                    email: emp.email || 'N/A',
                    role: emp.role || 'N/A',
                    job_title: emp.job_title,
                    employment_type: emp.employment_type || 'Full-Time',
                    team_id: emp.team_id,
                    isProjectManager: assignedProjects.some(p => p.role === 'manager' || p.role === 'project_manager' || p.role === 'team_lead'),
                    assignedProjects: assignedProjects, // Export projects array directly
                    department_display: departmentNameDisplay,
                    status: emp.is_active === false ? 'Inactive' : 'Active',
                    is_active: emp.is_active !== false,
                    availability: availability,
                    task: currentTask,
                    lastActive: lastActive,
                    joinDate: emp.join_date ? new Date(emp.join_date).toLocaleDateString() : (emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A'),
                    performance: 'N/A',
                    projects: assignedProjects.length,
                    tasksCompleted: 0,
                    avatar_url: emp.avatar_url,
                    is_paid: emp.is_paid,
                    department: emp.department // Keep raw ID for form editing
                };
            });

            setEmployees(transformedEmployees);

        } catch (err) {
            console.error('Error fetching employees:', err);
            setError(err.message || 'Failed to load employees');
        } finally {
            setIsLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // Real-time synchronization
    useEffect(() => {
        if (!orgId) return;

        // Use a unique channel name per instance to prevent "cannot add callbacks after subscribe" error
        const instanceId = Math.random().toString(36).substring(2, 9);
        const subscription = supabase
            .channel(`employees-all-${orgId}-${instanceId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('Real-time attendance change detected!', payload);
                fetchEmployees();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
                 console.log('Real-time profile change detected!', payload);
                 fetchEmployees();
            })
            .subscribe();

        return () => {
            if (subscription) {
                supabase.removeChannel(subscription);
            }
        };
    }, [orgId, fetchEmployees]);

    return { 
        employees, 
        departments, 
        projects, 
        teams, 
        isLoading, 
        error, 
        refetch: fetchEmployees 
    };
};
