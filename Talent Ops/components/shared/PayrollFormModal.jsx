import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    getDaysInMonth,
    getWorkingDaysInMonth,
    calculatePresentDays,
    calculateApprovedLeaveDays,
    fetchEmployeeFinance,
    calculateLOPDays,
    calculateLOPAmount,
    calculateNetSalary,
    formatMonthYear,
    checkPayrollExists,
    getHolidayWeekdaysCount,
    calculateApprovedLOPDays
} from '../../utils/payrollCalculations';
import { X, FileText, CheckSquare, Square, Calculator, AlertTriangle, Search, MessageSquare, Info, Activity, Calendar, ArrowLeft, ArrowRight, User, Briefcase, CheckCircle2, Trash2, Plus, AlertCircle } from 'lucide-react';
import './payslip/PayslipFormModal.css';

const OVERRIDE_REASONS = [
    "Forgot to Check-In",
    "Manual Approval (Proof provided)",
    "Approved Leave (Adjusted)",
    "Late-Mark Adjustment",
    "On-Duty / Client Visit",
    "Other (Please Specify)"
];

const PayrollFormModal = ({ isOpen, onClose, onSuccess, orgId }) => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [searchTerm, setSearchTerm] = useState('');

    // Form state
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Calculation preview data
    const [payrollPreview, setPayrollPreview] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [activeOverrides, setActiveOverrides] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setSelectedEmployees([]);
        setSelectAll(false);
        setSelectedMonth('');
        setSelectedYear(new Date().getFullYear());
        setPayrollPreview([]);
        setShowPreview(false);
        setActiveOverrides([]);
        setError('');
        setSearchTerm('');
        setProgress({ current: 0, total: 0 });
    };

    const fetchEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, employment_type')
                .eq('org_id', orgId)
                .eq('is_active', true)
                .order('full_name');

            if (error) {
                console.error('Error fetching employees:', error);
                setError('Failed to load employees: ' + error.message);
                return;
            }

            if (data) {
                // Filter out employees who are NOT interns (only full-time/part-time for this payroll)
                // Also fetch job_title and other profile details needed for calculation transparency
                const filteredEmployees = data.filter(emp => emp.employment_type !== 'intern');
                setEmployees(filteredEmployees);
            }
        } catch (err) {
            console.error('Unexpected error fetching employees:', err);
            setError('Failed to load employees');
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedEmployees([]);
        } else {
            // If searching, only select filtered. If not searching, select all.
            const targetEmployees = searchTerm ? filteredEmployees : employees;
            setSelectedEmployees(targetEmployees.map(emp => emp.id));
        }
        setSelectAll(!selectAll);
    };

    const handleEmployeeToggle = (employeeId) => {
        setSelectedEmployees(prev => {
            const newSelection = prev.includes(employeeId)
                ? prev.filter(id => id !== employeeId)
                : [...prev, employeeId];

            setSelectAll(newSelection.length === employees.length);
            return newSelection;
        });
    };

    const handleCalculatePreview = async () => {
        if (selectedEmployees.length === 0) {
            setError('Please select at least one employee');
            return;
        }

        if (!selectedMonth) {
            setError('Please select a month');
            return;
        }

        setCalculating(true);
        setError('');
        setPayrollPreview([]);

        const preview = [];
        const warnings = [];
        const monthYear = formatMonthYear(parseInt(selectedMonth), selectedYear);

        for (const employeeId of selectedEmployees) {
            const employee = employees.find(e => e.id === employeeId);

            try {
                // Check if payroll already exists
                const exists = await checkPayrollExists(employeeId, monthYear, orgId);
                if (exists) {
                    warnings.push(`${employee.full_name}: Payroll already exists for ${monthYear}`);
                    continue;
                }

                // Fetch finance data
                const financeData = await fetchEmployeeFinance(employeeId, orgId);
                if (!financeData) {
                    warnings.push(`${employee.full_name}: No active salary data found`);
                    continue;
                }

                // Fetch extra profile data (job_title)
                const { data: profileExtra } = await supabase
                    .from('profiles')
                    .select('job_title')
                    .eq('id', employeeId)
                    .single();

                // Calculate working days (M-F pool) and total calendar days (salary divisor)
                const workingDaysPoolRaw = getWorkingDaysInMonth(parseInt(selectedMonth), selectedYear);
                const holidayWeekdays = await getHolidayWeekdaysCount(parseInt(selectedMonth), selectedYear, orgId);
                const workingDaysPool = Math.max(0, workingDaysPoolRaw - holidayWeekdays);
                const totalCalendarDays = getDaysInMonth(parseInt(selectedMonth), selectedYear);

                const presentDays = await calculatePresentDays(employeeId, parseInt(selectedMonth), selectedYear, orgId);
                const leaveDays = await calculateApprovedLeaveDays(employeeId, parseInt(selectedMonth), selectedYear, orgId);

                // Calculate LOP strictly based on leave requests
                const lopDays = await calculateApprovedLOPDays(employeeId, parseInt(selectedMonth), selectedYear, orgId);

                // Use total calendar days as divisor for dynamic per-day amount
                const lopAmount = calculateLOPAmount(financeData.basic_salary, financeData.hra, financeData.allowances, totalCalendarDays, lopDays);

                // Add to preview with default deductions
                preview.push({
                    employee_id: employeeId,
                    employee_name: employee.full_name,
                    job_title: profileExtra?.job_title || 'Employee',
                    basic_salary: financeData.basic_salary,
                    hra: financeData.hra,
                    allowances: financeData.allowances,
                    professional_tax: financeData.professional_tax || 0,
                    total_working_days: workingDaysPool, // BASIS: Match the logic (Working Days)
                    calendar_days: totalCalendarDays, // REFERENCE: Total days in month
                    present_days: presentDays,
                    leave_days: leaveDays,
                    lop_days: lopDays,
                    lop_amount: lopAmount,
                    additional_deductions: 0, // User input
                    bonus: 0,
                    waiver_credit: 0, // Initial Credit
                    exceptions: [], // New Granular Exceptions Array
                    net_salary: calculateNetSalary(
                        financeData.basic_salary,
                        financeData.hra,
                        financeData.allowances,
                        financeData.professional_tax || 0,
                        0,
                        lopAmount,
                        0 // Initial Bonus
                    ),
                    original_values: {
                        present_days: presentDays,
                        leave_days: leaveDays,
                        lop_days: lopDays,
                        total_working_days: workingDaysPool
                    },
                    reasons: {
                        present_days: '',
                        leave_days: '',
                        lop_days: '',
                        total_working_days: '',
                        bonus: '',
                        exceptions: '' // Summary log for all exceptions
                    }
                });
            } catch (error) {
                console.error(`Error calculating for ${employee.full_name}:`, error);
                warnings.push(`${employee.full_name}: ${error.message}`);
            }
        }

        if (preview.length === 0) {
            setError(warnings.join('\n') || 'No valid employees to process. Please check salary data.');
            setCalculating(false);
            return;
        }

        if (warnings.length > 0) {
            setError('⚠️ Warnings:\n' + warnings.join('\n'));
        }

        setPayrollPreview(preview);
        setShowPreview(true);
        setCalculating(false);
    };

    const recalculateRow = (item, updatedFields = {}) => {
        const newItem = { ...item, ...updatedFields };

        // 1. Calculate base LOP Amount (from potentially overridden lop_days)
        const lopAmount = calculateLOPAmount(
            newItem.basic_salary,
            newItem.hra,
            newItem.allowances,
            newItem.calendar_days,
            newItem.lop_days
        );

        // 2. Calculate Waiver Credits (from exceptions array)
        const dailyRate = (newItem.basic_salary + newItem.hra + newItem.allowances) / newItem.calendar_days;
        const totalWaivedDays = newItem.exceptions
            .filter(ex => ex.type === 'waive_lop' || ex.type === 'attendance_waiver')
            .reduce((sum, ex) => sum + (parseFloat(ex.days) || 0), 0);

        const waiverCredit = Math.round(dailyRate * totalWaivedDays);

        // 3. Financial aggregates
        const totalBonus = waiverCredit;

        // 4. Final Net
        const netSalary = calculateNetSalary(
            newItem.basic_salary,
            newItem.hra,
            newItem.allowances,
            newItem.professional_tax,
            newItem.additional_deductions,
            lopAmount,
            totalBonus
        );

        return {
            ...newItem,
            lop_amount: lopAmount,
            bonus: totalBonus,
            net_salary: netSalary
        };
    };

    const handleDeductionChange = (employeeId, value) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                return recalculateRow(item, { additional_deductions: parseFloat(value) || 0 });
            }
            return item;
        }));
    };

    const handleBonusChange = (employeeId, value) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                return recalculateRow(item, { bonus: parseFloat(value) || 0 });
            }
            return item;
        }));
    };

    const handleExceptionAdd = (employeeId, type = 'attendance_waiver') => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                const newException = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: type,
                    startDate: '',
                    endDate: '',
                    days: 1,
                    reason: ''
                };
                return recalculateRow(item, { exceptions: [...item.exceptions, newException] });
            }
            return item;
        }));
    };

    const handleExceptionDelete = (employeeId, exceptionId) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                return recalculateRow(item, { exceptions: item.exceptions.filter(e => e.id !== exceptionId) });
            }
            return item;
        }));
    };

    const handleExceptionChange = (employeeId, exceptionId, field, value) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                const updatedExceptions = item.exceptions.map(ex => {
                    if (ex.id === exceptionId) {
                        const updated = { ...ex, [field]: value };

                        // Auto-calculate days if dates are changed
                        if (field === 'startDate' || field === 'endDate') {
                            if (updated.startDate && updated.endDate) {
                                const start = new Date(updated.startDate);
                                const end = new Date(updated.endDate);
                                if (!isNaN(start) && !isNaN(end) && end >= start) {
                                    updated.days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                                }
                            }
                        }
                        return updated;
                    }
                    return ex;
                });

                return recalculateRow(item, {
                    exceptions: updatedExceptions
                });
            }
            return item;
        }));
    };

    const handleReasonChange = (employeeId, field, reason) => {
        setPayrollPreview(prev => prev.map(item => {
            if (item.employee_id === employeeId) {
                return {
                    ...item,
                    reasons: {
                        ...item.reasons,
                        [field]: reason
                    }
                };
            }
            return item;
        }));
    };

    const handleGeneratePayroll = async () => {
        if (payrollPreview.length === 0) {
            setError('Please calculate preview first');
            return;
        }

        setLoading(true);
        setError('');
        setProgress({ current: 0, total: payrollPreview.length });

        const monthYear = formatMonthYear(parseInt(selectedMonth), selectedYear);
        let successCount = 0;
        const failures = [];

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        for (let i = 0; i < payrollPreview.length; i++) {
            const item = payrollPreview[i];
            setProgress({ current: i + 1, total: payrollPreview.length });

            try {
                const { error } = await supabase
                    .from('payroll')
                    .insert({
                        employee_id: item.employee_id,
                        month: monthYear,
                        basic_salary: item.basic_salary,
                        hra: item.hra,
                        allowances: item.allowances,
                        professional_tax: item.professional_tax,
                        deductions: item.additional_deductions,
                        lop_days: item.lop_days,
                        net_salary: item.net_salary,
                        present_days: item.present_days,
                        leave_days: item.leave_days,
                        total_working_days: item.total_working_days,
                        generated_by: user?.id,
                        status: 'generated',
                        org_id: orgId,
                        bonus: item.bonus || 0,
                        // Save the audit trail of waivers (metadata only)
                        adjustment_log: {
                            exceptions: item.exceptions || [],
                            summary_reason: item.reasons['exceptions'] || ''
                        }
                    });

                if (error) throw error;

                // Send Payslip Notification
                const notificationMessage = `Your payslip for ${monthYear} has been generated.`;
                await supabase.from('notifications').insert({
                    receiver_id: item.employee_id,
                    sender_id: user?.id,
                    sender_name: 'Finance Department',
                    message: notificationMessage,
                    type: 'payslip',
                    is_read: false,
                    created_at: new Date().toISOString(),
                    org_id: orgId
                });

                successCount++;
            } catch (error) {
                console.error(`Error generating payroll for ${item.employee_name}:`, error);
                failures.push(`${item.employee_name}: ${error.message}`);
            }
        }

        setLoading(false);
        setProgress({ current: 0, total: 0 });

        const message = `Successfully generated payroll for ${successCount} out of ${payrollPreview.length} employee(s)`
            + (failures.length > 0 ? `\n\nFailed:\n${failures.join('\n')}` : '');

        if (onSuccess) {
            onSuccess(message);
        }

        if (successCount > 0) {
            handleClose();
        } else {
            setError('Failed to generate any payroll records:\n' + failures.join('\n'));
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' }
    ];

    const years = Array.from({ length: 11 }, (_, i) => 2030 - i);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease-out'
        }} onClick={handleClose}>
            <div
                style={{
                    maxWidth: showPreview ? '1600px' : '1100px',
                    width: '95%',
                    backgroundColor: 'white',
                    borderRadius: '28px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '95vh'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '24px 32px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Generate Payroll</h2>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>Financial Processing Engine v2.0</p>
                        </div>
                    </div>
                    <button onClick={handleClose} style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '32px', overflowY: 'auto' }}>
                    {/* Error Alert */}
                    {error && (
                        <div style={{
                            whiteSpace: 'pre-line',
                            backgroundColor: '#fff1f2',
                            border: '1px solid #fecaca',
                            color: '#e11d48',
                            padding: '16px',
                            borderRadius: '16px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            fontSize: '0.9rem',
                            fontWeight: 500
                        }}>
                            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Progress Indicator */}
                    {loading && progress.total > 0 && (
                        <div style={{
                            padding: '20px',
                            backgroundColor: '#f5f3ff',
                            borderRadius: '16px',
                            marginBottom: '24px',
                            border: '1px solid #ddd6fe'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <p style={{ fontWeight: 700, color: '#5b21b6', fontSize: '0.95rem' }}>
                                    Generating Financial Records...
                                </p>
                                <span style={{ fontWeight: 700, color: '#7c3aed' }}>{progress.current} / {progress.total}</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '10px',
                                backgroundColor: '#ede9fe',
                                borderRadius: '10px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${(progress.current / progress.total) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#7c3aed',
                                    borderRadius: '10px',
                                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
                                    backgroundSize: '40px 40px'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    {!showPreview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', animation: 'fadeIn 0.3s' }}>
                            {/* Hub Header Card */}
                            <div style={{
                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                padding: '32px',
                                borderRadius: '24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
                            }}>
                                <div style={{ display: 'flex', gap: '40px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Processing Month</label>
                                        <select
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(e.target.value)}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                                padding: '12px 20px',
                                                color: '#f8fafc',
                                                fontWeight: 700,
                                                fontSize: '1rem',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                width: '200px'
                                            }}
                                        >
                                            <option value="">Select Month</option>
                                            {months.map(m => (
                                                <option key={m.value} value={m.value} style={{ background: '#1e293b' }}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fiscal Year</label>
                                        <select
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                                padding: '12px 20px',
                                                color: '#f8fafc',
                                                fontWeight: 700,
                                                fontSize: '1rem',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {years.map(y => (
                                                <option key={y} value={y} style={{ background: '#1e293b' }}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse 2s infinite' }} />
                                        SYSTEM READY
                                    </div>
                                    <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: 'white' }}>{employees.length}</h2>
                                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Active Records</p>
                                </div>
                            </div>

                            {/* Main Selection Area */}
                            <div style={{ display: 'flex', gap: '32px' }}>
                                {/* Left Column: Selection Hub */}
                                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Selection Hub</h3>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                <input
                                                    type="text"
                                                    placeholder="Search personnel..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    style={{
                                                        padding: '10px 14px 10px 40px',
                                                        borderRadius: '12px',
                                                        border: '2px solid #e2e8f0',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 600,
                                                        width: '240px',
                                                        outline: 'none',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                                                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                                />
                                            </div>
                                            <button
                                                onClick={handleSelectAll}
                                                style={{
                                                    padding: '10px 20px',
                                                    borderRadius: '12px',
                                                    backgroundColor: selectedEmployees.length === filteredEmployees.length ? '#f5f3ff' : 'white',
                                                    border: '2px solid #4f46e5',
                                                    color: '#4f46e5',
                                                    fontWeight: 800,
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {selectedEmployees.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                        gap: '12px',
                                        maxHeight: '400px',
                                        overflowY: 'auto',
                                        padding: '4px'
                                    }}>
                                        {filteredEmployees.map(emp => (
                                            <div
                                                key={emp.id}
                                                onClick={() => handleEmployeeToggle(emp.id)}
                                                style={{
                                                    padding: '16px',
                                                    borderRadius: '16px',
                                                    backgroundColor: selectedEmployees.includes(emp.id) ? '#f5f3ff' : 'white',
                                                    border: `2px solid ${selectedEmployees.includes(emp.id) ? '#4f46e5' : '#e2e8f0'}`,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }}
                                            >
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    backgroundColor: selectedEmployees.includes(emp.id) ? '#4f46e5' : '#f1f5f9',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: selectedEmployees.includes(emp.id) ? 'white' : '#64748b'
                                                }}>
                                                    {selectedEmployees.includes(emp.id) ? <CheckSquare size={20} /> : <User size={20} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.full_name}</p>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{emp.job_title}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Column: Summary & Actions */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '24px',
                                        padding: '24px',
                                        border: '1px solid #e2e8f0'
                                    }}>
                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calculation Summary</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Targeted Personnel</span>
                                                <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 800 }}>{selectedEmployees.length}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Processing Basis</span>
                                                <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 800 }}>Calendar Days</span>
                                            </div>
                                            <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '12px', border: '1px solid #dbeafe' }}>
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, lineHeight: 1.5 }}>
                                                    Initialize preview to verify attendance, working days, and manual adjustments before final record generation.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <button
                                            type="button"
                                            onClick={handleCalculatePreview}
                                            disabled={calculating || selectedEmployees.length === 0 || !selectedMonth}
                                            style={{
                                                padding: '18px',
                                                borderRadius: '16px',
                                                backgroundColor: '#4f46e5',
                                                backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                                color: 'white',
                                                border: 'none',
                                                fontWeight: 900,
                                                fontSize: '1rem',
                                                cursor: (calculating || selectedEmployees.length === 0 || !selectedMonth) ? 'not-allowed' : 'pointer',
                                                boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '12px',
                                                opacity: (calculating || selectedEmployees.length === 0 || !selectedMonth) ? 0.6 : 1,
                                                transition: 'all 0.3s'
                                            }}
                                            onMouseEnter={(e) => { if (selectedEmployees.length > 0) e.target.style.transform = 'translateY(-2px)'; }}
                                            onMouseLeave={(e) => { if (selectedEmployees.length > 0) e.target.style.transform = 'translateY(0)'; }}
                                        >
                                            <Calculator size={20} />
                                            {calculating ? 'Processing Logic...' : 'Initialize Preview'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            style={{
                                                padding: '16px',
                                                borderRadius: '16px',
                                                backgroundColor: 'transparent',
                                                color: '#64748b',
                                                border: '2px solid #e2e8f0',
                                                fontWeight: 800,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                        >
                                            Cancel & Exit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Elite Preview Screen
                        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                            {/* Premium Month Banner */}
                            <div style={{
                                background: '#1e293b',
                                padding: '24px 32px',
                                borderRadius: '24px',
                                marginBottom: '32px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{
                                        padding: '16px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        borderRadius: '16px',
                                        color: 'white',
                                        boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)'
                                    }}>
                                        <Calendar size={28} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Processing Cycle</p>
                                        <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                                            {formatMonthYear(parseInt(selectedMonth), selectedYear)}
                                        </h3>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    <div style={{ textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '24px' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>Batch Size</p>
                                        <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', margin: 0 }}>{payrollPreview.length} Personnel</p>
                                    </div>
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        style={{
                                            padding: '12px 20px',
                                            borderRadius: '14px',
                                            fontSize: '0.9rem',
                                            fontWeight: 700,
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#cbd5e1',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1'; }}
                                    >
                                        <ArrowLeft size={18} /> Modify Selection
                                    </button>
                                </div>
                            </div>

                            {/* Elite Preview Body */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <style>{`
                                    .preview-tooltip-container:hover .preview-tooltip-overlay {
                                        opacity: 1 !important;
                                        visibility: visible !important;
                                    }
                                `}</style>

                                {payrollPreview.map((row) => {
                                    const isEditing = activeOverrides.includes(row.employee_id);

                                    return (
                                        <div key={row.employee_id} style={{
                                            backgroundColor: 'white',
                                            borderRadius: '24px',
                                            padding: '32px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '24px',
                                            position: 'relative'
                                        }}>
                                            {isEditing ? (
                                                <>
                                                    {/* Top Header Card */}
                                                    <div style={{ display: 'flex', gap: '20px' }}>
                                                        {/* Employee Info Card */}
                                                        <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                            <div style={{
                                                                width: '48px',
                                                                height: '48px',
                                                                borderRadius: '50%',
                                                                backgroundColor: '#eef2ff',
                                                                color: '#4f46e5',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 800,
                                                                fontSize: '1.2rem',
                                                            }}>
                                                                {row.employee_name.charAt(0)}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{row.employee_name}</h3>
                                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                                    ID: {row.employee_id.substring(0, 8).toUpperCase()} <span style={{ margin: '0 8px' }}>•</span> {row.job_title}
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right', paddingLeft: '16px', borderLeft: '1px solid #e2e8f0' }}>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Payroll Period</div>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                                                                    {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Validation Alert Card */}
                                                        <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
                                                            <CheckCircle2 size={24} color="#16a34a" />
                                                            <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.5, flex: 1 }}>
                                                                Calculations adhere to regulatory formulas.<br />
                                                                Manual overrides are active for this preview.
                                                            </div>
                                                            <button
                                                                onClick={() => setActiveOverrides(prev => prev.filter(id => id !== row.employee_id))}
                                                                style={{ padding: '8px 16px', backgroundColor: '#1e293b', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                                            >
                                                                Save Override
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <h3 style={{ margin: '0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Payroll Adjustments & Exceptions</h3>

                                                    <div style={{ display: 'flex', gap: '24px' }}>
                                                        {/* Step 1: Attendance Correction Ledger */}
                                                        <div style={{ flex: 1.5, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>STEP 1: ATTENDANCE CORRECTION LEDGER</div>
                                                                <button
                                                                    onClick={() => handleExceptionAdd(row.employee_id, 'attendance_waiver')}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                                                >
                                                                    <Plus size={14} /> Add Correction
                                                                </button>
                                                            </div>

                                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>LOGGED ATTENDANCE (Static DB)</div>
                                                            <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'row', gap: '16px', padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                                <span>Present: <span style={{ fontWeight: 800 }}>{row.original_values.present_days}</span></span>
                                                                <span style={{ color: '#cbd5e1' }}>|</span>
                                                                <span>Absent/LOP: <span style={{ fontWeight: 800 }}>{row.original_values.lop_days}</span></span>
                                                            </div>

                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                {row.exceptions.filter(ex => ex.type === 'attendance_waiver').length === 0 ? (
                                                                    <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                                                        <AlertCircle size={20} />
                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>No attendance corrections.</span>
                                                                    </div>
                                                                ) : (
                                                                    row.exceptions.filter(ex => ex.type === 'attendance_waiver').map((ex) => (
                                                                        <div key={ex.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', position: 'relative' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Attendance Waiver</span>
                                                                                <button
                                                                                    onClick={() => handleExceptionDelete(row.employee_id, ex.id)}
                                                                                    style={{ color: '#ef4444', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </div>

                                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                <input
                                                                                    type="date"
                                                                                    value={ex.startDate}
                                                                                    onChange={(e) => handleExceptionChange(row.employee_id, ex.id, 'startDate', e.target.value)}
                                                                                    style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                                                                                />
                                                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>→</span>
                                                                                <input
                                                                                    type="date"
                                                                                    value={ex.endDate}
                                                                                    onChange={(e) => handleExceptionChange(row.employee_id, ex.id, 'endDate', e.target.value)}
                                                                                    style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                                                                                />
                                                                            </div>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                                                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Impact: <span style={{ color: '#0f172a', fontWeight: 800 }}>{ex.days} Days</span></span>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Step 2: LOP Waiver Ledger */}
                                                        <div style={{ flex: 1.5, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>STEP 2: LOP WAIVER LEDGER</div>
                                                                <button
                                                                    onClick={() => handleExceptionAdd(row.employee_id, 'waive_lop')}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                                                >
                                                                    <Plus size={14} /> Add Waiver
                                                                </button>
                                                            </div>

                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                {row.exceptions.filter(ex => ex.type === 'waive_lop').length === 0 ? (
                                                                    <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                                                                        <AlertCircle size={20} />
                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>No LOP waivers.</span>
                                                                    </div>
                                                                ) : (
                                                                    row.exceptions.filter(ex => ex.type === 'waive_lop').map((ex) => (
                                                                        <div key={ex.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', position: 'relative' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Financial LOP Waiver</span>
                                                                                <button
                                                                                    onClick={() => handleExceptionDelete(row.employee_id, ex.id)}
                                                                                    style={{ color: '#ef4444', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </div>

                                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                <input
                                                                                    type="date"
                                                                                    value={ex.startDate}
                                                                                    onChange={(e) => handleExceptionChange(row.employee_id, ex.id, 'startDate', e.target.value)}
                                                                                    style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                                                                                />
                                                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>→</span>
                                                                                <input
                                                                                    type="date"
                                                                                    value={ex.endDate}
                                                                                    onChange={(e) => handleExceptionChange(row.employee_id, ex.id, 'endDate', e.target.value)}
                                                                                    style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', outline: 'none' }}
                                                                                />
                                                                            </div>

                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                                                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Impact: <span style={{ color: '#0f172a', fontWeight: 800 }}>{ex.days} Days</span></span>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Step 3: Record Reason */}
                                                        <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>STEP 3: LOG REASON</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#0f172a' }}>Mandatory internal context for auditing these adjustments.</div>
                                                            <textarea
                                                                value={row.reasons['exceptions'] || ''}
                                                                onChange={(e) => handleReasonChange(row.employee_id, 'exceptions', e.target.value)}
                                                                placeholder="e.g. Scanner error on 12th, Manager approved travel waiver for 15-17th..."
                                                                style={{ flex: 1, width: '100%', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', color: '#0f172a', outline: 'none', resize: 'none' }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* UNIFIED WAIVER AUDIT RECEIPT */}
                                                    <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                                                            <Calculator size={20} style={{ color: '#2563eb' }} />
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unified Waiver Audit Receipt</span>
                                                        </div>

                                                        <div style={{ backgroundColor: '#1e293b', color: '#f8fafc', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', display: 'flex', gap: '32px' }}>
                                                            {/* Part A: Rate Breakdown */}
                                                            <div style={{ flex: 1, borderRight: '1px solid #334155', paddingRight: '32px' }}>
                                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase' }}>Daily Rate Calculation</div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    <div style={{ fontSize: '1rem', fontFamily: 'monospace', color: '#e2e8f0' }}>₹{(row.basic_salary + row.hra + row.allowances).toLocaleString()} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>/ {row.calendar_days} Days</span></div>
                                                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24' }}>= ₹{Math.round((row.basic_salary + row.hra + row.allowances) / row.calendar_days).toLocaleString()}<span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}> / Day</span></div>
                                                                </div>
                                                            </div>

                                                            {/* Part B: Unified Impact */}
                                                            <div style={{ flex: 1.2, borderRight: '1px solid #334155', paddingRight: '32px' }}>
                                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase' }}>Consolidated Waiver Impact</div>
                                                                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                                                                    <div style={{ flex: 1, backgroundColor: '#334155', padding: '8px 12px', borderRadius: '8px' }}>
                                                                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>ATTENDANCE</div>
                                                                        <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>+{row.exceptions.filter(ex => ex.type === 'attendance_waiver').reduce((sum, ex) => sum + (ex.days || 0), 0)} Days</div>
                                                                    </div>
                                                                    <div style={{ flex: 1, backgroundColor: '#334155', padding: '8px 12px', borderRadius: '8px' }}>
                                                                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: '2px' }}>LOP WAIVER</div>
                                                                        <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>+{row.exceptions.filter(ex => ex.type === 'waive_lop').reduce((sum, ex) => sum + (ex.days || 0), 0)} Days</div>
                                                                    </div>
                                                                </div>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0' }}>
                                                                    Total: <span style={{ color: '#60a5fa' }}>{row.exceptions.reduce((sum, ex) => sum + (ex.days || 0), 0)} Days</span> Adjusted
                                                                </div>
                                                            </div>

                                                            {/* Part C: Final Result */}
                                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
                                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 800, marginBottom: '4px' }}>TOTAL WAIVED CREDIT</div>
                                                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#4ade80', letterSpacing: '-0.02em' }}>
                                                                    +₹{(Math.round((row.basic_salary + row.hra + row.allowances) / row.calendar_days) * row.exceptions.reduce((sum, ex) => sum + (ex.days || 0), 0)).toLocaleString()}
                                                                </div>
                                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>(Added as Bonus)</div>
                                                            </div>
                                                        </div>
                                                    </div>


                                                    {/* Adjusted Payroll Preview Card */}
                                                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>ADJUSTED PAYROLL PREVIEW (RECALCULATED)</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>Final Net Payable</h2>
                                                            <div style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '6px 16px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '1.5rem', fontWeight: 800 }}>
                                                                ₹{row.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                                            </div>
                                                            <div style={{ marginLeft: '12px', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center' }}>
                                                                (Gross {(row.basic_salary + row.hra + row.allowances) / 1000}k {row.bonus > 0 && `+ Bonus ${row.bonus / 1000}k `}- Total Ded {(row.professional_tax + row.lop_amount + row.additional_deductions)} = {row.net_salary})
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                                                            <span style={{ fontWeight: 600 }}>Gross ₹{(row.basic_salary + row.hra + row.allowances).toLocaleString('en-IN')}</span> |
                                                            {row.bonus > 0 && <span style={{ fontWeight: 600, color: '#16a34a' }}> Bonus +₹{row.bonus.toLocaleString('en-IN')} | </span>}
                                                            <span> LOP ({row.lop_days} days) -₹{row.lop_amount.toLocaleString('en-IN')} | </span>
                                                            <span> PT -₹{row.professional_tax.toLocaleString('en-IN')}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Default Ledger View */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                            <div style={{
                                                                width: '64px',
                                                                height: '64px',
                                                                borderRadius: '20px',
                                                                backgroundColor: '#f8fafc',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: '#3b26d9',
                                                                fontWeight: 800,
                                                                fontSize: '1.5rem',
                                                                border: '1px solid #eef2ff'
                                                            }}>
                                                                {row.employee_name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{row.employee_name}</h3>
                                                                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                                                                    {row.job_title} <span style={{ margin: '0 4px' }}>•</span> ID: {row.employee_id.substring(0, 8).toUpperCase()}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                            <button
                                                                onClick={() => setActiveOverrides(prev => [...prev, row.employee_id])}
                                                                style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#475569', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                            >
                                                                Manual Override ⚙️
                                                            </button>

                                                            <div style={{
                                                                backgroundColor: '#dcfce7',
                                                                padding: '16px 24px',
                                                                borderRadius: '20px',
                                                                textAlign: 'right',
                                                                border: '1px solid #bbf7d0'
                                                            }}>
                                                                <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FINAL NET PAYABLE</p>
                                                                <h2 style={{ margin: '4px 0 0 0', fontSize: '2rem', fontWeight: 900, color: '#15803d' }}>
                                                                    ₹{row.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                                                </h2>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Gray Ledger Block */}
                                                    <div style={{
                                                        backgroundColor: '#f8fafc',
                                                        borderRadius: '20px',
                                                        padding: '24px',
                                                        display: 'flex',
                                                        gap: '30px',
                                                        border: '1px solid #f1f5f9',
                                                        position: 'relative'
                                                    }}>
                                                        {/* Left Column: Earnings */}
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
                                                                <span style={{ fontSize: '0.7rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EARNINGS LEDGER</span>
                                                                <span style={{ fontSize: '1rem', color: '#0f172a' }}>₹{(row.basic_salary + row.hra + row.allowances).toLocaleString('en-IN')}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                                                                    <span>Basic Salary</span>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{row.basic_salary.toLocaleString('en-IN')}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                                                                    <span>HRA</span>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{row.hra.toLocaleString('en-IN')}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                                                                    <span>Special Allowances</span>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{row.allowances.toLocaleString('en-IN')}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Divider */}
                                                        <div style={{ width: '1px', backgroundColor: '#e2e8f0', borderLeft: '1px dashed #cbd5e1' }}></div>

                                                        {/* Middle Column: Bonus/Adjustments */}
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
                                                                <span style={{ fontSize: '0.7rem', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BONUS LEDGER</span>
                                                                <span style={{ fontSize: '1rem', color: '#047857' }}>₹{(row.bonus || 0).toLocaleString('en-IN')}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <span>Bonus Amount</span>
                                                                        <Info size={12} color="#059669" />
                                                                    </div>
                                                                    <span style={{ fontWeight: 800 }}>+₹{(row.bonus || 0).toLocaleString('en-IN')}</span>
                                                                </div>
                                                                <div style={{ marginTop: 'auto', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #dcfce7', fontSize: '0.75rem', color: '#166534', lineHeight: 1.5 }}>
                                                                    This total reflects consolidated attendance and LOP waivers for this period.
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Divider */}
                                                        <div style={{ width: '1px', backgroundColor: '#e2e8f0', borderLeft: '1px dashed #cbd5e1' }}></div>

                                                        {/* Right Column: Deductions */}
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
                                                                <span style={{ fontSize: '0.7rem', color: '#7f1d1d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DEDUCTIONS LEDGER</span>
                                                                <span style={{ fontSize: '1rem', color: '#7f1d1d' }}>-₹{(row.professional_tax + row.lop_amount + row.additional_deductions).toLocaleString('en-IN')}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                                                                    <span>Professional Tax</span>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>-₹{row.professional_tax.toLocaleString('en-IN')}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#475569', position: 'relative' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <span>Loss of Pay ({row.lop_days}d)</span>
                                                                        <div className="preview-tooltip-container" style={{ display: 'flex', alignItems: 'center' }}>
                                                                            <Info size={14} color="#94a3b8" style={{ cursor: 'help' }} />
                                                                            <div className="preview-tooltip-overlay" style={{
                                                                                position: 'absolute',
                                                                                top: '24px',
                                                                                left: '0',
                                                                                backgroundColor: 'white',
                                                                                border: '1px solid #e2e8f0',
                                                                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                                                                padding: '10px 14px',
                                                                                borderRadius: '8px',
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: 600,
                                                                                color: '#1e293b',
                                                                                zIndex: 10,
                                                                                whiteSpace: 'nowrap',
                                                                                opacity: 0,
                                                                                visibility: 'hidden',
                                                                                transition: 'all 0.2s'
                                                                            }}>
                                                                                (₹{(row.basic_salary + row.hra + row.allowances).toLocaleString('en-IN')} Gross ÷ {row.calendar_days} days) * {row.lop_days} days = ₹{row.lop_amount.toLocaleString('en-IN')}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>-₹{row.lop_amount.toLocaleString('en-IN')}</span>
                                                                </div>

                                                                {/* Additional Adjustment Input */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                                    <span style={{ color: '#475569' }}>Additional Ded.</span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', border: '1px solid #fecaca', borderRadius: '8px', padding: '4px 8px', width: '80px' }}>
                                                                        <span style={{ color: '#fca5a5', fontSize: '0.75rem', marginRight: '2px' }}>₹</span>
                                                                        <input
                                                                            type="number"
                                                                            value={row.additional_deductions}
                                                                            onChange={(e) => handleDeductionChange(row.employee_id, e.target.value)}
                                                                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 800, color: '#7f1d1d', fontSize: '0.8rem', outline: 'none' }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Footer Row */}
                                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontSize: '0.75rem', fontWeight: 800 }}>
                                                            <CheckCircle2 size={16} />
                                                            SYSTEM CALCULATED & VERIFIED ACCORDING TO ATTENDANCE POLICY
                                                        </div>
                                                        <div className="preview-tooltip-container" style={{ position: 'relative' }}>
                                                            <Info size={16} color="#94a3b8" style={{ cursor: 'help' }} />
                                                            <div className="preview-tooltip-overlay" style={{
                                                                position: 'absolute',
                                                                bottom: '30px',
                                                                right: '0',
                                                                backgroundColor: 'white',
                                                                border: '1px solid #e2e8f0',
                                                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                                                                padding: '12px 16px',
                                                                borderRadius: '8px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 500,
                                                                color: '#334155',
                                                                zIndex: 10,
                                                                whiteSpace: 'nowrap',
                                                                opacity: 0,
                                                                visibility: 'hidden',
                                                                transition: 'all 0.2s',
                                                                textAlign: 'left',
                                                                lineHeight: 1.5
                                                            }}>
                                                                Calculations adhere to regulatory formulas.<br />
                                                                Manual overrides are active for this preview.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Floating Action Bar */}
                            <div style={{
                                marginTop: '40px',
                                padding: '24px 32px',
                                background: '#f8fafc',
                                borderRadius: '24px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.05)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '16px',
                                        backgroundColor: '#eff6ff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#3b82f6',
                                        border: '1px solid #dbeafe'
                                    }}>
                                        <Info size={28} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>Ready for Generation</p>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                            Confirming {payrollPreview.length} records totaling ₹{payrollPreview.reduce((sum, row) => sum + row.net_salary, 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={handleGeneratePayroll}
                                        disabled={loading || payrollPreview.some(row =>
                                            row.exceptions.length > 0 && !row.reasons['exceptions']
                                        )}
                                        style={{
                                            padding: '16px 32px',
                                            borderRadius: '16px',
                                            fontWeight: 900,
                                            fontSize: '1rem',
                                            border: 'none',
                                            background: (loading || payrollPreview.some(row =>
                                                row.exceptions.length > 0 && !row.reasons['exceptions']
                                            )) ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                            color: 'white',
                                            cursor: (loading || payrollPreview.some(row =>
                                                row.exceptions.length > 0 && !row.reasons['exceptions']
                                            )) ? 'not-allowed' : 'pointer',
                                            boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.4)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(0)'; }}
                                    >
                                        <CheckSquare size={20} />
                                        {loading ? `Processing...` : `Finalize & Generate Records`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayrollFormModal;
