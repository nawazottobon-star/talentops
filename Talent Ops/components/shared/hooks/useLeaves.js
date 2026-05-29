import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export const isWeekday = (dateString) => {
    try {
        if (!dateString) return false;
        const date = new Date(dateString);
        const day = date.getDay();
        return day !== 0 && day !== 6;
    } catch (e) { return false; }
};

export const calculateWeekdayDuration = (startDate, endDate) => {
    try {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        
        let count = 0;
        const cur = new Date(start);
        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) count++;
            cur.setDate(cur.getDate() + 1);
            if (count > 365) break; // Absolute safety against infinite loops
        }
        return count;
    } catch (e) { return 0; }
};

export const useLeaves = (orgId, userId, viewMode = 'personal') => {
    const [leaves, setLeaves] = useState([]);
    const [leaveStats, setLeaveStats] = useState({
        monthlyUsed: 0,
        yearlyUsed: 0,
        monthlyQuota: 1,
        annualQuota: 12,
        leaveYear: new Date().getFullYear()
    });
    const [remainingLeaves, setRemainingLeaves] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchLeaves = useCallback(async () => {
        if (!orgId) return;
        
        setIsLoading(true);
        try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const fullYearQuota = 12;

            const computeAnnualQuotaForYear = (joinDateStr, year) => {
                if (!joinDateStr) return fullYearQuota;
                const joinDate = new Date(joinDateStr);
                if (Number.isNaN(joinDate.getTime())) return fullYearQuota;

                const joinYear = joinDate.getFullYear();
                const joinMonth = joinDate.getMonth(); // Jan=0

                if (joinYear < year) return fullYearQuota;
                if (joinYear > year) return 0;

                // Joined in target year: Jan => 12, Feb => 11, ... Dec => 1
                return Math.max(0, fullYearQuota - joinMonth);
            };

            if (viewMode === 'personal' && userId) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('join_date, created_at')
                    .eq('id', userId)
                    .maybeSingle();
                if (profileError) throw profileError;

                const userJoinAnchor = profileData?.join_date || profileData?.created_at || null;
                const annualQuota = computeAnnualQuotaForYear(userJoinAnchor, currentYear);

                // Personal fetch
                const { data: leavesData, error: leavesError } = await supabase
                    .from('leaves')
                    .select('*')
                    .eq('employee_id', userId)
                    .eq('org_id', orgId);

                if (leavesError) throw leavesError;

                let tempMonthlyUsed = 0;
                let tempYearlyUsed = 0;

                if (leavesData && Array.isArray(leavesData)) {
                    leavesData.forEach(leave => {
                        try {
                            const status = (leave.status || '').toLowerCase().trim();
                            const isApproved = status.includes('approv');
                            const isPending = status.includes('pend');
                            
                            // Basic stats aggregation
                            const duration = leave.duration_weekdays || calculateWeekdayDuration(leave.from_date, leave.to_date) || 1;
                            const lop = leave.lop_days || 0;
                            const paidDays = Math.max(0, duration - lop);

                            const leaveDate = new Date(leave.from_date);
                            if (isNaN(leaveDate.getTime())) return;

                            // Use string-based checks to avoid timezone shifts
                            const dateStr = leave.from_date || '';
                            const yearMatch = dateStr.startsWith(currentYear.toString());
                            const monthMatch = dateStr.includes(`-${String(currentMonth + 1).padStart(2, '0')}-`);

                            if (isApproved) {
                                // Year check
                                if (yearMatch) {
                                    tempYearlyUsed += paidDays;
                                }
                                // Month check
                                if (monthMatch && yearMatch) {
                                    tempMonthlyUsed += paidDays;
                                }
                            } else if (isPending) {
                                // Pending requests are tracked in the table/list
                                // but do NOT deduct available leave balance.
                            }
                        } catch (e) {
                            console.error("Error in leave loop:", e);
                        }
                    });

                    // Map leaves for UI
                    const mappedLeaves = leavesData.map(leave => {
                        const diffDays = leave.duration_weekdays || calculateWeekdayDuration(leave.from_date, leave.to_date || leave.from_date) || 1;
                        let typeText = leave.leave_type || 'Leave';
                        
                        const formatDate = (dStr) => {
                            if (!dStr) return '';
                            const d = new Date(dStr);
                            if (isNaN(d.getTime())) return dStr;
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        };
                        const datesStr = leave.to_date && leave.to_date !== leave.from_date
                            ? `${formatDate(leave.from_date)} - ${formatDate(leave.to_date)}`
                            : formatDate(leave.from_date);
                        
                        return {
                            ...leave,
                            id: leave.id,
                            type: typeText,
                            startDate: leave.from_date,
                            endDate: leave.to_date,
                            dates: datesStr,
                            duration: `${diffDays} Days`,
                            status: leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending',
                            created_at: leave.created_at
                        };
                    });

                    mappedLeaves.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                    setLeaves(mappedLeaves);
                }

                setLeaveStats({
                    monthlyUsed: tempMonthlyUsed,
                    yearlyUsed: tempYearlyUsed,
                    monthlyQuota: 1,
                    annualQuota,
                    leaveYear: currentYear
                });
                setRemainingLeaves(Math.max(0, annualQuota - tempYearlyUsed));

            } else if (viewMode === 'manager' || viewMode === 'org') {
                // Fetch organizational leaves for managers and executives
                const { data: leavesData, error: leavesError } = await supabase
                    .from('leaves')
                    .select('*')
                    .eq('org_id', orgId);

                if (leavesError) throw leavesError;

                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, total_leaves_balance, join_date, created_at')
                    .eq('org_id', orgId);

                if (profilesError) throw profilesError;

                const profileMap = {};
                if (profilesData) {
                    profilesData.forEach(p => { profileMap[p.id] = p.full_name; });
                }

                if (leavesData) {
                    const mappedLeaves = leavesData.map(leave => {
                        const diffDays = leave.duration_weekdays || calculateWeekdayDuration(leave.from_date, leave.to_date || leave.from_date) || 1;
                        let typeText = leave.leave_type || 'Leave';
                        
                        const formatDate = (dStr) => {
                            if (!dStr) return '';
                            const d = new Date(dStr);
                            if (isNaN(d.getTime())) return dStr;
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        };
                        const datesStr = leave.to_date && leave.to_date !== leave.from_date
                            ? `${formatDate(leave.from_date)} - ${formatDate(leave.to_date)}`
                            : formatDate(leave.from_date);

                        return {
                            ...leave,
                            name: profileMap[leave.employee_id] || 'Unknown',
                            id: leave.id,
                            type: typeText,
                            startDate: leave.from_date,
                            endDate: leave.to_date,
                            dates: datesStr,
                            duration: `${diffDays} Days`,
                            status: leave.status ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1).toLowerCase() : 'Pending'
                        };
                    });
                    mappedLeaves.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                    setLeaves(mappedLeaves);
                }

                if (viewMode === 'org' && profilesData && leavesData) {
                    const stats = profilesData.map(profile => {
                        const empLeaves = leavesData.filter(l => l.employee_id === profile.id && l.status?.toLowerCase().includes('approv'));
                        const paid = empLeaves.reduce((sum, l) => sum + (l.duration_weekdays || 0), 0);
                        const lop = empLeaves.reduce((sum, l) => sum + (l.lop_days || 0), 0);
                        const annualQuota = computeAnnualQuotaForYear(profile.join_date || profile.created_at, currentYear);
                        const usedThisYear = empLeaves
                            .filter(l => (l.from_date || '').startsWith(String(currentYear)))
                            .reduce((sum, l) => sum + Math.max(0, (l.duration_weekdays || 0) - (l.lop_days || 0)), 0);
                        return {
                            id: profile.id,
                            name: profile.full_name,
                            total_taken: `${paid + lop} Days`,
                            paid_leaves: `${paid} Days`,
                            lop_days: `${lop} Days`,
                            leaves_left: `${Math.max(0, annualQuota - usedThisYear)} / ${annualQuota}`
                        };
                    });
                    setLeaveStats(stats);
                }
            }

        } catch (err) {
            console.error('Error in useLeaves hook:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [orgId, userId, viewMode]);

    useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

    useEffect(() => {
        if (!orgId) return;
        
        // Use a unique channel name per instance to prevent "cannot add callbacks after subscribe" error
        const instanceId = Math.random().toString(36).substring(2, 9);
        const channel = supabase
            .channel(`leaves-changes-${orgId}-${instanceId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, (payload) => {
                console.log('Realtime leave update received:', payload);
                fetchLeaves();
            })
            .subscribe();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [orgId, fetchLeaves]);

    return { leaves, leaveStats, remainingLeaves, isLoading, error, refetch: fetchLeaves };
};
