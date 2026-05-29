// Payroll Calculation Utilities
import { supabase } from '../lib/supabaseClient';

/**
 * Get total calendar days in a month
 */
export const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
};

/**
 * Get total working days in a month (excluding Saturdays and Sundays)
 */
export const getWorkingDaysInMonth = (month, year) => {
    const totalDays = getDaysInMonth(month, year);
    let workingDays = 0;

    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month - 1, day); // month is 1-indexed
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

        // Count only Monday (1) to Friday (5)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays++;
        }
    }

    return workingDays;
};


/**
 * Count organization holidays that fall on weekdays (Mon-Fri) in a given month and year
 */
export const getHolidayWeekdaysCount = async (month, year, orgId) => {
    try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${getDaysInMonth(month, year)}`;

        const { data, error } = await supabase
            .from('organization_holidays')
            .select('holiday_date')
            .eq('org_id', orgId)
            .gte('holiday_date', startDate)
            .lte('holiday_date', endDate);

        let holidaysList = [];

        if (!error && data && data.length > 0) {
            holidaysList = data.map(h => h.holiday_date);
        } else {
            // Fallback to standard 2026 weekday public holidays if database is empty
            const standardizedHolidays = [
                '2026-01-01', // New Year
                '2026-01-26', // Republic Day
                '2026-05-01', // May Day / Labor Day
                '2026-10-02', // Gandhi Jayanti
                '2026-12-25', // Christmas
            ];
            holidaysList = standardizedHolidays.filter(h => {
                const parts = h.split('-');
                return parseInt(parts[0]) === year && parseInt(parts[1]) === month;
            });
        }

        let weekdayHolidaysCount = 0;
        const uniqueDates = new Set(holidaysList);
        uniqueDates.forEach(dateStr => {
            const date = new Date(dateStr);
            const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                weekdayHolidaysCount++;
            }
        });

        return weekdayHolidaysCount;
    } catch (error) {
        console.error('Error calculating holiday weekdays count:', error);
        return 0;
    }
};


/**
 * Calculate present days from attendance records for a given month
 */
export const calculatePresentDays = async (employeeId, month, year, orgId) => {
    try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${getDaysInMonth(month, year)}`;

        const { data, error } = await supabase
            .from('attendance')
            .select('date')
            .eq('employee_id', employeeId)
            .eq('org_id', orgId)
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Error fetching attendance:', error);
            return 0;
        }

        // Count unique dates (in case there are duplicates)
        const uniqueDates = new Set(data.map(record => record.date));
        return uniqueDates.size;
    } catch (error) {
        console.error('Error calculating present days:', error);
        return 0;
    }
};

/**
 * Calculate approved leave days for a given month (Paid Leaves only, capped at quota)
 */
export const calculateApprovedLeaveDays = async (employeeId, month, year, orgId) => {
    try {
        const startDate = new Date(year, month - 1, 1); // month is 1-indexed
        const endDate = new Date(year, month - 1, getDaysInMonth(month, year));

        // 1. Fetch Approved Leaves
        const { data: leavesData, error: leavesError } = await supabase
            .from('leaves')
            .select('from_date, to_date, reason, leave_type, duration_weekdays, lop_days')
            .eq('employee_id', employeeId)
            .eq('status', 'approved')
            .eq('org_id', orgId);

        if (leavesError) {
            console.error('Error fetching leaves:', leavesError);
            return 0;
        }

        // 2. Process overlap with the target month


        if (!leavesData || leavesData.length === 0) return 0;
 
        let regularLeaveDays = 0;
 
        leavesData.forEach(leave => {
            // Skip "Loss of Pay" leaves entirely
            const type = (leave.leave_type || '').toLowerCase();
            const reason = (leave.reason || '').toLowerCase();
            if (type.includes('loss of pay') || reason.includes('loss of pay')) {
                return;
            }
 
            const leaveStart = new Date(leave.from_date);
            const leaveEnd = new Date(leave.to_date);
 
            const totalWeekdays = leave.duration_weekdays || 0;
            const lopWeekdays = leave.lop_days || 0;
            let paidWeekdaysLeft = Math.max(0, totalWeekdays - lopWeekdays);

            // Step through every day of the leave request chronologically
            let current = new Date(leaveStart);
            while (current <= leaveEnd) {
                const day = current.getDay();
                if (day !== 0 && day !== 6) { // It's a weekday
                    const isPaid = paidWeekdaysLeft > 0;
                    if (isPaid) {
                        paidWeekdaysLeft--;
                    }
                    
                    // Only count if this day falls within our target month
                    if (current >= startDate && current <= endDate) {
                        if (isPaid) {
                            regularLeaveDays++;
                        }
                    }
                }
                current.setDate(current.getDate() + 1);
            }
        });
 
        // Return total regular leave days in the month (no monthly cap)
        return regularLeaveDays;


    } catch (error) {
        console.error('Error calculating leave days:', error);
        return 0;
    }
};

/**
 * Calculate approved LOP (unpaid) leave days for a given month from leave requests
 */
export const calculateApprovedLOPDays = async (employeeId, month, year, orgId) => {
    try {
        const startDate = new Date(year, month - 1, 1); // month is 1-indexed
        const endDate = new Date(year, month - 1, getDaysInMonth(month, year));

        // Fetch Approved Leaves
        const { data: leavesData, error: leavesError } = await supabase
            .from('leaves')
            .select('from_date, to_date, reason, leave_type, duration_weekdays, lop_days')
            .eq('employee_id', employeeId)
            .eq('status', 'approved')
            .eq('org_id', orgId);

        if (leavesError) {
            console.error('Error fetching leaves for LOP calculation:', leavesError);
            return 0;
        }

        if (!leavesData || leavesData.length === 0) return 0;

        let totalLOPDays = 0;

        leavesData.forEach(leave => {
            const leaveStart = new Date(leave.from_date);
            const leaveEnd = new Date(leave.to_date);

            const type = (leave.leave_type || '').toLowerCase();
            const reason = (leave.reason || '').toLowerCase();
            const isExplicitLOP = type.includes('loss of pay') || reason.includes('loss of pay');

            const totalWeekdays = leave.duration_weekdays || 0;
            const lopWeekdays = leave.lop_days || 0;

            // If explicitly LOP, 0 weekdays are paid. Otherwise, split paid days.
            let paidWeekdaysLeft = isExplicitLOP ? 0 : Math.max(0, totalWeekdays - lopWeekdays);

            // Step through every day of the leave request chronologically
            let current = new Date(leaveStart);
            while (current <= leaveEnd) {
                const day = current.getDay();
                if (day !== 0 && day !== 6) { // It's a weekday
                    const isPaid = paidWeekdaysLeft > 0;
                    if (isPaid) {
                        paidWeekdaysLeft--;
                    }
                    
                    // Only count if this day falls within our target month
                    if (current >= startDate && current <= endDate) {
                        if (!isPaid) {
                            totalLOPDays++;
                        }
                    }
                }
                current.setDate(current.getDate() + 1);
            }
        });

        return totalLOPDays;
    } catch (error) {
        console.error('Error calculating LOP days:', error);
        return 0;
    }
};


/**
 * Dynamically compute an employee's annual remaining casual leaves
 */
export const calculateRemainingLeaves = async (employeeId, orgId) => {
    try {
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('join_date, created_at')
            .eq('id', employeeId)
            .eq('org_id', orgId)
            .single();

        if (profileErr) return 12;

        const now = new Date();
        const currentYear = now.getFullYear();
        const fullYearQuota = 12;

        const joinAnchor = profile.join_date || profile.created_at;
        const joinDate = joinAnchor ? new Date(joinAnchor) : null;
        const annualQuota = (() => {
            if (!joinDate || Number.isNaN(joinDate.getTime())) return fullYearQuota;
            const joinYear = joinDate.getFullYear();
            const joinMonth = joinDate.getMonth();
            if (joinYear < currentYear) return fullYearQuota;
            if (joinYear > currentYear) return 0;
            return Math.max(0, fullYearQuota - joinMonth);
        })();

        const firstOfYear = `${currentYear}-01-01`;
        const lastOfYear = `${currentYear}-12-31`;

        const { data: yearlyLeaves } = await supabase
            .from('leaves')
            .select('duration_weekdays, lop_days, status')
            .eq('employee_id', employeeId)
            .eq('org_id', orgId)
            .gte('from_date', firstOfYear)
            .lte('from_date', lastOfYear);

        const usedThisYear = yearlyLeaves ? yearlyLeaves.reduce((sum, leave) => {
            if (leave.status === 'approved') {
                const paidDuration = Math.max(0, (leave.duration_weekdays || 1) - (leave.lop_days || 0));
                return sum + paidDuration;
            }
            return sum;
        }, 0) : 0;

        return Math.max(0, annualQuota - usedThisYear);
    } catch (e) {
        console.error('Error calculating remaining leaves:', e);
        return 12;
    }
};


/**
 * Fetch active employee finance data
 */
export const fetchEmployeeFinance = async (employeeId, orgId) => {
    try {
        const { data, error } = await supabase
            .from('employee_finance')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('is_active', true)
            .eq('org_id', orgId)
            .single();

        if (error) {
            console.error('Error fetching employee finance:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in fetchEmployeeFinance:', error);
        return null;
    }
};

/**
 * Calculate LOP days
 */
export const calculateLOPDays = (totalWorkingDays, presentDays, leaveDays) => {
    const calculatedLOP = totalWorkingDays - (presentDays + leaveDays);
    return Math.max(0, calculatedLOP); // LOP can't be negative
};

/**
 * Calculate LOP amount based on Gross Salary
 */
export const calculateLOPAmount = (basicSalary, hra, allowances, totalDays, lopDays) => {
    if (lopDays === 0 || totalDays === 0) return 0;
    const grossSalary = Number(basicSalary) + Number(hra) + Number(allowances);
    const perDaySalary = grossSalary / totalDays;
    return Math.round(perDaySalary * lopDays);
};

/**
 * Calculate net salary
 */
export const calculateNetSalary = (basicSalary, hra, allowances, professionalTax, additionalDeductions, lopAmount, bonus = 0) => {
    const grossSalary = Number(basicSalary) + Number(hra) + Number(allowances);
    const totalDeductions = Number(professionalTax) + Number(additionalDeductions) + Number(lopAmount);
    return Math.round((grossSalary - totalDeductions) + Number(bonus));
};


/**
 * Check if payroll already exists for employee and month
 */
export const checkPayrollExists = async (employeeId, monthYear, orgId) => {
    try {
        const { data, error } = await supabase
            .from('payroll')
            .select('id')
            .eq('employee_id', employeeId)
            .eq('month', monthYear)
            .eq('org_id', orgId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
            console.error('Error checking payroll existence:', error);
            return false;
        }

        return !!data; // Returns true if data exists
    } catch (error) {
        console.error('Error in checkPayrollExists:', error);
        return false;
    }
};

/**
 * Format month and year to string
 */
export const formatMonthYear = (month, year) => {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[month - 1]} ${year}`;
};

/**
 * Generate payroll record for a single employee
 */
export const generatePayrollRecord = async (employeeId, month, year, additionalDeductions, generatedBy, orgId) => {
    try {
        const monthYear = formatMonthYear(month, year);

        // Check if payroll already exists
        const exists = await checkPayrollExists(employeeId, monthYear, orgId);
        if (exists) {
            throw new Error('Payroll already exists for this employee and month');
        }

        // Get employee finance data
        const financeData = await fetchEmployeeFinance(employeeId, orgId);
        if (!financeData) {
            throw new Error('No active salary data found for employee');
        }

        // Calculate working days (M-F) for LOP days calculation
        // but use total calendar days for the per-day salary divisor
        const totalWorkingDaysRaw = getWorkingDaysInMonth(month, year);
        const holidayWeekdays = await getHolidayWeekdaysCount(month, year, orgId);
        const totalWorkingDays = Math.max(0, totalWorkingDaysRaw - holidayWeekdays);
        const totalCalendarDays = getDaysInMonth(month, year);
        const presentDays = await calculatePresentDays(employeeId, month, year, orgId);
        const leaveDays = await calculateApprovedLeaveDays(employeeId, month, year, orgId);

        // Calculate LOP strictly based on leave requests
        const lopDays = await calculateApprovedLOPDays(employeeId, month, year, orgId);
        // Use total calendar days as divisor for dynamic per-day rate
        const lopAmount = calculateLOPAmount(financeData.basic_salary, financeData.hra, financeData.allowances, totalCalendarDays, lopDays);

        // Calculate net salary
        const netSalary = calculateNetSalary(
            financeData.basic_salary,
            financeData.hra,
            financeData.allowances,
            financeData.professional_tax || 0,
            additionalDeductions,
            lopAmount
        );

        // Insert payroll record
        const { data, error } = await supabase
            .from('payroll')
            .insert({
                employee_id: employeeId,
                month: monthYear,
                basic_salary: financeData.basic_salary,
                hra: financeData.hra,
                allowances: financeData.allowances,
                professional_tax: financeData.professional_tax || 0,
                deductions: additionalDeductions,
                lop_days: lopDays,
                net_salary: netSalary,
                generated_by: generatedBy,
                status: 'generated',
                org_id: orgId
            })
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            data,
            calculations: {
                totalWorkingDays,
                presentDays,
                leaveDays,
                lopDays,
                lopAmount,
                netSalary
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};
