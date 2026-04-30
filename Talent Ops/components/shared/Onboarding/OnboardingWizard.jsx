import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Shield, Briefcase, Calendar, ClipboardList, BarChart3, 
    Settings, Rocket, Building2, Layout, Database, CheckCircle2, 
    Mail, Zap, ArrowRight, ArrowLeft, ShieldCheck, CreditCard, UserCheck, 
    Bell, FileText, ChevronRight, ChevronLeft, Clock, Monitor, Check,
    Megaphone, MessageSquare, GitGraph, LifeBuoy, UserPlus, Receipt,
    Trophy, FolderOpen, Activity, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
// import AuroraBackground from './AuroraBackground';
import { useOnboardingPersistence } from './useOnboardingPersistence';
import './OnboardingWizard.css';

const STEPS = [
    { title: "Dashboard", icon: <Layout />, label: "Setup Progress" },
    { title: "Organization", icon: <Building2 />, label: "Workspace Name" },
    { title: "Modules", icon: <Zap />, label: "Platform Capabilities" },
    { title: "Features", icon: <Bell />, label: "Extra Add-ons" },
    { title: "Permissions", icon: <Shield />, label: "Role Controls" },
    { title: "Review", icon: <CheckCircle2 />, label: "Final Launch" }
];

const MODULE_CATEGORIES = [
    {
        name: "HR & Organization",
        modules: [
            { id: 'employees', title: 'Employees', desc: 'Centralized personnel database', icon: <Users size={20} /> },
            { id: 'hierarchy', title: 'Org Hierarchy', desc: 'Visual reporting structure', icon: <GitGraph size={20} /> },
            { id: 'policies', title: 'Policies', desc: 'Internal documents & compliance', icon: <FileText size={20} /> },
            { id: 'status', title: 'Employee Status', desc: 'Real-time availability tracking', icon: <Activity size={20} /> }
        ]
    },
    {
        name: "Workforce",
        modules: [
            { id: 'attendance', title: 'Attendance', desc: 'Time logs & clock-in logic', icon: <Calendar size={20} /> },
            { id: 'payroll', title: 'Payroll', desc: 'Salary & tax processing', icon: <CreditCard size={20} /> },
            { id: 'leaves', title: 'Leave Management', desc: 'Absence & vacation flow', icon: <Briefcase size={20} /> }
        ]
    },
    {
        name: "Communications",
        modules: [
            { id: 'announcements', title: 'Announcements', desc: 'Company-wide broadcasts', icon: <Megaphone size={20} /> },
            { id: 'messages', title: 'Direct Messages', desc: 'Secure internal chat', icon: <MessageSquare size={20} /> }
        ]
    },
    {
        name: "Operations",
        modules: [
            { id: 'projects', title: 'Projects', desc: 'High-level project tracking', icon: <Building2 size={20} /> },
            { id: 'tasks', title: 'Tasks', desc: 'Granular task management', icon: <ClipboardList size={20} /> },
            { id: 'helpdesk', title: 'Helpdesk', desc: 'Raise & manage support tickets', icon: <LifeBuoy size={20} /> }
        ]
    },
    {
        name: "Talent & Finance",
        modules: [
            { id: 'hiring', title: 'Hiring Portal', desc: 'Recruitment & pipeline fuel', icon: <UserPlus size={20} /> },
            { id: 'invoice', title: 'Invoicing', desc: 'Client billing & payments', icon: <Receipt size={20} /> }
        ]
    },
    {
        name: "Intelligence",
        modules: [
            { id: 'analytics', title: 'Analytics', desc: 'Advanced workforce insights', icon: <BarChart3 size={20} /> },
            { id: 'review', title: 'Performance', desc: 'Employee review cycles', icon: <UserCheck size={20} /> },
            { id: 'ranking', title: 'Ranking', desc: 'Gamified performance boards', icon: <Trophy size={20} /> }
        ]
    }
];

const FEATURES = [
    { id: 'payslip_gen', title: 'Payslip Generator', desc: 'Auto-generate PDF slips', module: 'payroll' },
    { id: 'self_service', title: 'Employee Self Service', desc: 'Profile management portal', module: 'employees' },
    { id: 'expense_claims', title: 'Expense Claims', desc: 'Digital reimbursement flow', module: 'payroll' },
    { id: 'perf_reviews', title: '360° Feedback', desc: 'Comprehensive review system', module: 'review' },
    { id: 'proj_docs', title: 'Project Documents', desc: 'Shared document storage', module: 'projects' },
    { id: 'reports_plus', title: 'Reports & Analytics', desc: 'Advanced dataset visualization', module: 'analytics' }
];

const ROLES = ["Executive", "Manager", "Team Lead", "Employee"];
const ACTIONS = ["View", "Create", "Approve", "Manage"];

// --- Sub-Components (Memoized) ---

const WelcomeSection = memo(({ template, onSelectTemplate, onNext }) => (
    <div className="flex flex-col justify-start pt-4 pb-8">
        <div className="time-badge">
            <Clock size={14} /> Estimated setup time: 2 minutes
        </div>
        <div className="title-aurora-container mb-6">
            <h1 className="wizard-title">Welcome to TalentOps</h1>
        </div>
        <p className="wizard-description max-w-lg">
            Let's configure your workforce intelligence platform. Your workspace will be optimized for standard operations in seconds.
        </p>
        <div className="template-grid">
            {[
                { id: 'startup', title: 'Startup Setup', desc: 'Fast scaling & hiring focus', icon: <Rocket size={20} /> },
                { id: 'enterprise', title: 'Enterprise Setup', desc: 'Governance & complex levels', icon: <Building2 size={20} /> },
                { id: 'hr', title: 'HR Only Setup', desc: 'Core personnel management', icon: <Users size={20} /> },
                { id: 'full', title: 'Full Platform', desc: 'All modules integrated', icon: <Monitor size={20} /> }
            ].map((tpl) => (
                <div 
                    key={tpl.id}
                    className={`card-item cursor-pointer flex gap-4 hover:shadow-lg transition-all ${template === tpl.id ? 'selected' : ''}`}
                    onClick={() => onSelectTemplate(tpl.id)}
                >
                    <div className="brand-icon opacity-80">{tpl.icon}</div>
                    <div>
                        <h4 className="text-sm font-bold text-[#1f2937]">{tpl.title}</h4>
                        <p className="text-[11px] text-slate-500">{tpl.desc}</p>
                    </div>
                </div>
            ))}
        </div>
        <div className="mt-12 h-4" />
    </div>
));

const OrgSetupSection = memo(({ data, onChange }) => (
    <div className="space-y-6">
        <h1 className="wizard-title text-3xl">Set Up Your Organization</h1>
        <p className="wizard-description text-sm mb-12">These details define your unique workspace identifier.</p>
        <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="input-group">
                    <label className="input-label text-slate-500">Organization Name</label>
                    <input className="custom-input" placeholder="e.g. Ottobon Labs" value={data.orgName} onChange={e => onChange('orgName', e.target.value)} />
                </div>
                <div className="input-group">
                    <label className="input-label">Organization ID</label>
                    <div className="relative">
                        <input 
                            className={`custom-input pr-10 ${data.slugStatus === 'invalid' ? 'border-red-500/50' : data.slugStatus === 'valid' ? 'border-emerald-500/50' : ''}`} 
                            placeholder="ottobon-labs" 
                            value={data.orgId} 
                            onChange={e => onChange('orgId', e.target.value.toLowerCase().trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, ''))} 
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                            {data.slugStatus === 'checking' && <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />}
                            {data.slugStatus === 'valid' && <CheckCircle2 size={16} className="text-emerald-500" />}
                            {data.slugStatus === 'invalid' && <AlertCircle size={16} className="text-red-500" />}
                        </div>
                    </div>
                    {data.slugStatus === 'invalid' && <p className="text-[10px] text-red-500 mt-1 font-medium">This ID is already taken.</p>}
                    {data.slugStatus === 'valid' && <p className="text-[10px] text-emerald-500 mt-1 font-medium">Workspace ID is available!</p>}
                </div>
                <div className="input-group">
                    <label className="input-label">Admin Email</label>
                    <div className="relative">
                        <input 
                            className="custom-input pr-10" 
                            placeholder="name@company.com"
                            value={data.adminEmail} 
                            onChange={e => onChange('adminEmail', e.target.value)}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Mail size={16} className="text-slate-400" />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium italic">We'll send your workspace credentials here</p>
                </div>
            </div>
            <div className="space-y-6">
                <div className="input-group">
                    <label className="input-label">Industry</label>
                    <select className="custom-input" value={data.industry} onChange={e => onChange('industry', e.target.value)}>
                        <option>Technology</option><option>Healthcare</option><option>Finance</option>
                    </select>
                </div>
                <div className="input-group">
                    <label className="input-label">Company Size</label>
                    <select className="custom-input" value={data.companySize} onChange={e => onChange('companySize', e.target.value)}>
                        <option>1-50</option><option>51-200</option><option>201-1000</option>
                    </select>
                </div>
            </div>
        </div>
    </div>
));

const ModulesSection = memo(({ selected, onToggle }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
        <div>
            <h1 className="wizard-title text-3xl">Select Capabilities</h1>
            <p className="wizard-description text-sm">Modules group related features and workflows.</p>
        </div>
        <div className="space-y-8">
            {MODULE_CATEGORIES.map((cat) => (
                <div key={cat.name} className="space-y-4">
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-muted">{cat.name}</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {cat.modules.map(mod => (
                            <div 
                                key={mod.id}
                                className={`card-item cursor-pointer flex items-center gap-4 transition-all duration-100 ${selected.includes(mod.id) ? 'selected' : ''}`}
                                onClick={() => onToggle(mod.id)}
                            >
                                <div className={`p-2 rounded-lg ${selected.includes(mod.id) ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-muted'}`}>{mod.icon}</div>
                                <div className="flex-1">
                                    <h5 className="text-sm font-bold text-[#1f2937]">{mod.title}</h5>
                                    <p className="text-[10px] text-slate-500">{mod.desc}</p>
                                </div>
                                {selected.includes(mod.id) && <CheckCircle2 size={16} className="text-[#3b82f6]" />}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </motion.div>
));

const FeaturesSection = memo(({ enabled, onToggle }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
        <h1 className="wizard-title text-3xl">Extra Features</h1>
        <div className="space-y-3">
            {FEATURES.map(feat => (
                <div 
                    key={feat.id} 
                    className={`card-item flex items-center justify-between py-4 ${enabled.includes(feat.id) ? 'selected' : ''}`}
                    onClick={() => onToggle(feat.id)}
                >
                    <div>
                        <h5 className="text-sm font-bold text-[#1f2937]">{feat.title}</h5>
                        <p className="text-[11px] text-slate-500">{feat.desc}</p>
                    </div>
                    <div className={`matrix-toggle ${enabled.includes(feat.id) ? 'on' : ''}`}>
                        <div className="toggle-dot" />
                    </div>
                </div>
            ))}
        </div>
    </motion.div>
));

const PermissionsSection = memo(({ permissions, onToggle }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
        <h1 className="wizard-title text-3xl">Permissions Matrix</h1>
        <div className="mt-8 overflow-hidden rounded-xl border border-[#dadada] bg-[#fafafa]">
            <table className="matrix-table">
                <thead>
                    <tr>
                        <th>Roles</th>
                        {ACTIONS.map(a => <th key={a} className="p-2">{a}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {ROLES.map(role => (
                        <tr key={role}>
                            <td className="text-sm font-bold p-2">{role}</td>
                            {ACTIONS.map(action => (
                                <td key={action} className="p-2 text-center">
                                    <div 
                                        className={`matrix-toggle ${permissions[role]?.includes(action) ? 'on' : ''}`}
                                        onClick={() => onToggle(role, action)}
                                    >
                                        <div className="toggle-dot" />
                                    </div>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </motion.div>
));

const ReviewSection = memo(({ data, modules, features }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
        <h1 className="wizard-title text-3xl">Review and Submit</h1>
        <p className="wizard-description text-sm">Your configuration is ready for review. Submit it to our team for approval and workspace provisioning.</p>
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }} className="grid grid-cols-2 gap-6">
            {[
                { label: "Organization", val: data.orgName || 'Not Set', color: 'text-indigo-600' },
                { label: "Admin Account", val: data.adminEmail || 'Not Set', color: 'text-blue-600' },
                { label: "Active Modules", val: `${modules.length} enabled`, color: 'text-sky-600' },
                { label: "Features", val: `${features.length} enabled`, color: 'text-indigo-600' }
            ].map(item => (
                <motion.div key={item.label} variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }} className="card-item bg-[#fafafa]">
                    <span className="text-[10px] uppercase font-black text-muted tracking-widest">{item.label}</span>
                    <h4 className={`text-lg font-bold mt-1 ${item.color}`}>{item.val}</h4>
                </motion.div>
            ))}
        </motion.div>
        
        <div className="mt-12 p-6 bg-[#fafafa] rounded-2xl border border-[#dadada]">
            <label className="flex items-start gap-4 cursor-pointer group">
                <div className="relative mt-1">
                    <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={data.agreedToTerms} 
                        onChange={e => data.onAgreedToTermsChange(e.target.checked)} 
                    />
                    <div className="w-5 h-5 border-2 border-white/20 rounded-md bg-white/5 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                        <Check size={12} className="text-white scale-0 peer-checked:scale-100 transition-transform" />
                    </div>
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium text-[#1f2937] leading-relaxed">
                        I agree to the <span className="text-[#3b82f6] hover:underline">Terms of Service</span> and <span className="text-[#3b82f6] hover:underline">Privacy Policy</span>.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        By submitting this request, you agree to TalentOps' professional service guidelines and data processing agreement.
                    </p>
                </div>
            </label>
        </div>
    </motion.div>
));

export default function OnboardingWizard() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    const [formData, setFormData] = useState({
        orgName: '', orgId: '', industry: 'Technology', companySize: '1-50', adminEmail: '',
        agreedToTerms: false
    });

    // Handle scroll lock for onboarding only
    useEffect(() => {
        document.body.classList.add('wizard-container-active');
        document.documentElement.style.overflow = 'hidden';
        
        return () => {
            document.body.classList.remove('wizard-container-active');
            document.documentElement.style.overflow = 'auto';
            document.body.style.overflow = 'auto';
        };
    }, []);

    const [selectedModules, setSelectedModules] = useState(['employees', 'attendance']);
    const [enabledFeatures, setEnabledFeatures] = useState(['self_service']);
    const [slugStatus, setSlugStatus] = useState(null); // null, 'checking', 'valid', 'invalid'
    const [permissions, setPermissions] = useState({
        Executive: ["View", "Create", "Approve", "Manage"],
        Manager: ["View", "Create", "Approve"],
        TeamLead: ["View", "Create"],
        Employee: ["View"]
    });



    // --- Persistence Logic ---
    const { clearStorage } = useOnboardingPersistence({
        currentStep, setCurrentStep,
        formData, setFormData,
        selectedModules, setSelectedModules,
        enabledFeatures, setEnabledFeatures,
        permissions, setPermissions
    });

    // --- Slug Validation Effect ---
    useEffect(() => {
        if (!formData.orgId) {
            setSlugStatus(null);
            return;
        }

        const timer = setTimeout(async () => {
            setSlugStatus('checking');
            try {
                // Check if slug exists in 'orgs' table
                const { data, error } = await supabase
                    .from('orgs')
                    .select('slug')
                    .eq('slug', formData.orgId)
                    .maybeSingle();

                if (error) throw error;
                setSlugStatus(data ? 'invalid' : 'valid');
            } catch (err) {
                console.error('Slug validation error:', err);
                setSlugStatus(null); // Silent fail
            }
        }, 600); // 600ms debounce

        return () => clearTimeout(timer);
    }, [formData.orgId]);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const { error } = await supabase
                .from('onboarding_requests')
                .insert({
                    org_name: formData.orgName,
                    org_slug: formData.orgId,
                    admin_email: formData.adminEmail,
                    industry: formData.industry,
                    company_size: formData.companySize,
                    selected_modules: selectedModules,
                    enabled_features: enabledFeatures,
                    status: 'pending'
                });

            if (error) throw error;
            
            // PRODUCTION: Trigger Welcome Email via Supabase Edge Function
            try {
                await supabase.functions.invoke('send-onboarding-welcome', {
                    body: { 
                        email: formData.adminEmail, 
                        orgName: formData.orgName 
                    }
                });
            } catch (emailErr) {
                console.error('Production Welcome email failed:', emailErr);
                // Non-blocking: we still want to show the success screen
            }


            setIsCompleted(true);
            clearStorage();
        } catch (err) {
            console.error('Submission error:', err);
            setSubmitError(err.message || 'Failed to submit request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = useCallback(() => {
        if (currentStep === 6) {
            handleSubmit();
        }
        else setCurrentStep(prev => prev + 1);
    }, [currentStep, formData, selectedModules, enabledFeatures]);

    const handleBack = useCallback(() => {
        if (currentStep > 1) setCurrentStep(prev => prev - 1);
    }, [currentStep]);

    const handleOrgChange = useCallback((field, val) => {
        setFormData(prev => ({ ...prev, [field]: val }));
    }, []);

    const handleTemplateSelect = useCallback((id) => {
        setFormData(prev => ({ ...prev, template: id }));
    }, []);

    const toggleModule = useCallback((id) => {
        setSelectedModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
    }, []);

    const toggleFeature = useCallback((id) => {
        setEnabledFeatures(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
    }, []);

    const togglePermission = useCallback((role, action) => {
        setPermissions(prev => {
            const current = prev[role] || [];
            const updated = current.includes(action) ? current.filter(a => a !== action) : [...current, action];
            return { ...prev, [role]: updated };
        });
    }, []);

    const successContent = useMemo(() => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F8F7F4]/90 backdrop-blur-xl p-6">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="wizard-wrapper flex-col p-16 text-center items-center justify-center max-w-2xl h-auto border-[#3b82f6]/20 bg-white"
            >
                <div className="w-24 h-24 bg-[#3b82f6]/10 rounded-full flex items-center justify-center mb-10 border border-[#3b82f6]/40 relative">
                    <div className="absolute inset-0 bg-[#3b82f6]/10 rounded-full animate-ping"></div>
                    <ShieldCheck size={48} className="text-[#3b82f6] z-10" />
                </div>
                <h1 className="text-4xl font-serif font-bold mb-4 text-[#1f2937]">Request Submitted</h1>
                <p className="text-[#1f2937]/60 mb-8 text-lg">Your TalentOps workspace request for <span className="text-[#3b82f6] font-bold">{formData.orgName}</span> has been successfully submitted for review.</p>
                <div className="space-y-4 mb-12">
                    <p className="text-[#1f2937]/50 text-sm px-8">Our team will review your configuration and activate your organization shortly. You will receive an email once your workspace has been approved.</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-full text-[12px] font-bold text-[#3b82f6]">
                        <Clock size={14} /> Estimated approval time: 24 hours
                    </div>
                </div>
                <button onClick={() => navigate('/')} className="bg-[#111111] text-white hover:bg-black px-12 py-5 shadow-2xl font-bold flex items-center gap-2 rounded-xl">
                    Back to Home <ArrowRight size={20} />
                </button>
            </motion.div>
        </div>
    ), [formData.orgName, navigate]);

    if (isCompleted) return (
        <div className="wizard-container bg-[#F8F7F4]">
            <div className="relative z-10 w-full flex items-center justify-center">
                {successContent}
            </div>
        </div>
    );


    return (
        <div className="onboarding-page min-h-screen">
            <div className="wizard-container bg-[#F8F7F4]">
                <div className="wizard-wrapper relative z-10 shadow-2xl bg-white border-[#dadada]">
                    <aside className="wizard-sidebar">
                        <div className="sidebar-brand mb-10">
                            <div className="brand-icon bg-[#3b82f6] shadow-none"><Rocket size={18} className="text-white" /></div>
                            <span className="brand-name text-[#1f2937]">TalentOps</span>
                        </div>


                    <div className="flex flex-col gap-2">
                        <span className="text-[#3b82f6] font-bold tracking-[0.2em] uppercase text-[10px]">Phase {currentStep}</span>
                        <h2 className="text-5xl font-serif font-bold text-[#1f2937] leading-tight mb-8">
                            {STEPS[currentStep - 1].title}
                        </h2>
                    </div>

                    <nav className="sidebar-nav">
                        {STEPS.map((s, idx) => {
                            const stepNum = idx + 1;
                            const isActive = currentStep === stepNum;
                            const isPast = currentStep > stepNum;
                            return (
                                <div key={s.title} className={`nav-item ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''}`}>
                                    {isActive && <motion.div layoutId="active-indicator" className="active-bar" />}
                                    <div className="w-6 flex items-center justify-center">
                                        {isPast ? <Check size={18} className="text-[#3b82f6]" /> : s.icon}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] uppercase font-bold tracking-widest text-[#1f2937]/30 leading-tight">{s.label}</span>
                                        <span className={`text-[13px] ${isActive ? 'text-[#3b82f6] font-bold' : 'text-slate-500 font-medium'}`}>{s.title}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </nav>
                </aside>
                <main className="wizard-main relative">
                    <header className="wizard-top-header">
                        <div className="header-inner">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase font-black tracking-widest text-[#1f2937]/30 mb-2">Progress</span>
                                <div className="w-48 h-1 bg-[#f3f4f6] rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-[#3b82f6]" 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(currentStep / 6) * 100}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </header>
                    <div className="wizard-body">                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div 
                                key={currentStep} 
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="wizard-body-content"
                            >
                                {currentStep === 1 && <WelcomeSection template={formData.template} onSelectTemplate={handleTemplateSelect} onNext={handleNext} />}
                                {currentStep === 2 && <OrgSetupSection data={{ ...formData, slugStatus }} onChange={handleOrgChange} />}
                                {currentStep === 3 && <ModulesSection selected={selectedModules} onToggle={toggleModule} />}
                                {currentStep === 4 && <FeaturesSection enabled={enabledFeatures} onToggle={toggleFeature} />}
                                {currentStep === 5 && <PermissionsSection permissions={permissions} onToggle={togglePermission} />}
                                {currentStep === 6 && <ReviewSection data={{ ...formData, onAgreedToTermsChange: (val) => handleOrgChange('agreedToTerms', val) }} modules={selectedModules} features={enabledFeatures} />}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <footer className="wizard-footer">
                        <div className="footer-inner">
                            {currentStep === 1 ? (
                                <button className="btn-back" onClick={() => navigate('/')}>
                                    <ArrowLeft size={18} /> Back to Home
                                </button>
                            ) : (
                                <button className="btn-back" onClick={handleBack}>
                                    <ChevronLeft size={18} /> Back
                                </button>
                            )}
                            <div className="flex flex-col items-end gap-2">
                                {submitError && (
                                    <p className="text-[11px] text-red-500 font-medium animate-pulse">{submitError}</p>
                                )}
                                <button 
                                    onClick={handleNext} 
                                    disabled={(currentStep === 2 && slugStatus !== 'valid') || isSubmitting || (currentStep === 6 && !formData.agreedToTerms)}
                                    className={`px-10 py-4 rounded-xl font-bold flex items-center gap-2 transition-all ${
                                        (currentStep === 2 && slugStatus !== 'valid') || isSubmitting || (currentStep === 6 && !formData.agreedToTerms)
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                        : 'bg-[#3b82f6] text-white hover:bg-[#2563eb] shadow-xl shadow-[#3b82f6]/20'
                                    }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            {currentStep === 6 ? 'Submit for Approval' : currentStep === 1 ? 'Start Setup Now' : 'Continue to Next Step'} <ChevronRight size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </footer>

                </main>
            </div>
        </div>
    </div>
    );
}
