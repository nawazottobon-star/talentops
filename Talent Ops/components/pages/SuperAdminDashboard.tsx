import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    Building2,
    Users,
    ShieldCheck,
    Activity,
    Plus,
    Search,
    MoreVertical,
    Settings2,
    FileText,
    AlertCircle,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
    Clock,
    Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SuperAdminDashboard = () => {
    const navigate = useNavigate();
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'tenants' | 'requests'>('requests');
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        org_name: '',
        org_slug: '',
        exec_email: '',
        exec_password: ''
    });

    const [stats, setStats] = useState({
        totalOrgs: 0,
        totalUsers: 0,
        activeSystems: 0
    });

    useEffect(() => {
        // Force scroll enablement on mount
        document.body.style.overflow = 'auto';
        document.body.style.height = 'auto';
        document.documentElement.style.overflow = 'auto';
        document.documentElement.style.height = 'auto';
        
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Fetch live orgs
            const { data: orgsData, error: orgsError } = await supabase
                .from('orgs')
                .select('*')
                .order('created_at', { ascending: false });

            if (orgsError) throw orgsError;
            setOrgs(orgsData);

            // Fetch pending requests
            const { data: requestsData, error: requestsError } = await supabase
                .from('onboarding_requests')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (requestsError) throw requestsError;
            setPendingRequests(requestsData);

            const { count: orgCount } = await supabase.from('orgs').select('*', { count: 'exact', head: true });
            const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

            setStats({
                totalOrgs: orgCount || 0,
                totalUsers: userCount || 0,
                activeSystems: orgsData.filter(o => o.is_active).length
            });
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request: any) => {
        setIsSubmitting(true);
        try {
            // 1. Trigger the Edge Function to provision the environment
            // Note: The Edge Function should be updated to handle invitation flow as per Pillar 4
            const { data, error: funcError } = await supabase.functions.invoke('create-tenant-org', {
                body: {
                    org_name: request.org_name,
                    org_slug: request.org_slug,
                    exec_email: request.admin_email,
                    enabled_modules: request.selected_modules.reduce((acc: any, mod: string) => {
                        acc[mod] = true;
                        return acc;
                    }, {}),
                    is_invitation_flow: true // Tell the function to use invitation instead of manual password
                }
            });

            if (funcError) throw funcError;

            // 2. Update request status in database
            const { error: updateError } = await supabase
                .from('onboarding_requests')
                .update({ status: 'approved' })
                .eq('id', request.id);

            if (updateError) throw updateError;

            alert(`Request for ${request.org_name} approved and provisioning started!`);
            setIsReviewModalOpen(false);
            fetchData();
        } catch (error: any) {
            console.error('Approval error:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async (requestId: string) => {
        if (!confirm('Are you sure you want to reject this request?')) return;
        
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('onboarding_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId);

            if (error) throw error;

            alert('Request rejected.');
            setIsReviewModalOpen(false);
            fetchData();
        } catch (error: any) {
            console.error('Rejection error:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProvision = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { data, error: funcError } = await supabase.functions.invoke('create-tenant-org', {
                body: {
                    ...formData,
                    enabled_modules: {
                        tasks: true,
                        messages: true,
                        payroll: true,
                        leaves: true,
                        performance: true,
                        hiring: true,
                        workforce: true,
                        announcements: true
                    }
                }
            });

            if (funcError) throw funcError;

            alert('Organization and Executive account provisioned successfully!');
            setIsModalOpen(false);
            setFormData({ 
                org_name: '', 
                org_slug: '', 
                exec_email: '', 
                exec_password: '' 
            });
            fetchData();
        } catch (error: any) {
            console.error('Provisioning error:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-screen bg-[#FDFBF7] p-8 overflow-y-auto">
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                        Control <span className="text-orange-600">Center</span>
                    </h1>
                    <p className="text-slate-500 font-medium">SaaS Global Administration & Monitoring</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:scale-105 transition-all shadow-xl shadow-slate-200"
                >
                    <Plus size={20} /> Provision New Org
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                {[
                    { label: 'Total Organizations', value: stats.totalOrgs, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Platform Users', value: stats.totalUsers, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Active Systems', value: stats.activeSystems, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Pending Requests', value: pendingRequests.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-6`}>
                            <stat.icon size={28} />
                        </div>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-1">{stat.label}</p>
                        <h3 className="text-4xl font-black text-slate-900">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="flex gap-4 mb-8">
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'requests' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                >
                    Pending Requests ({pendingRequests.length})
                </button>
                <button 
                    onClick={() => setActiveTab('tenants')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'tenants' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                >
                    Live Tenants ({orgs.length})
                </button>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-bottom border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                        {activeTab === 'tenants' ? (
                            <><Activity className="text-orange-500" /> Live Tenants</>
                        ) : (
                            <><Clock className="text-amber-500" /> Onboarding Requests</>
                        )}
                    </h2>
                    <div className="flex gap-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                placeholder={activeTab === 'tenants' ? "Search partitions..." : "Search requests..."}
                                className="bg-white border-none rounded-xl pl-12 pr-6 py-3 text-sm focus:ring-2 focus:ring-orange-500 w-64 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {activeTab === 'tenants' ? (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organization</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shard ID</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {orgs.map((org) => (
                                    <tr key={org.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-all font-bold">
                                                    {org.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{org.name}</p>
                                                    <p className="text-xs text-slate-400 font-mono">/{org.slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{org.id.split('-')[0]}...</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${org.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                                <span className={`text-xs font-bold ${org.is_active ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                    {org.is_active ? 'HEALTHY' : 'SUSPENDED'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm text-slate-500 font-medium">
                                                {new Date(org.created_at).toLocaleDateString()}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex gap-2">
                                                <button className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-slate-900 shadow-sm border border-transparent hover:border-slate-200">
                                                    <Settings2 size={18} />
                                                </button>
                                                <button className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-slate-900 shadow-sm border border-transparent hover:border-slate-200">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Info</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin Contact</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuration</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Submitted</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vetting</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {pendingRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 transition-all font-bold">
                                                    <Building2 size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{req.org_name}</p>
                                                    <p className="text-xs text-slate-400 font-mono">/{req.org_slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm font-bold text-slate-900">{req.admin_email}</p>
                                            <p className="text-xs text-slate-400">{req.industry} • {req.company_size} pax</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex gap-2">
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                                                    {req.selected_modules?.length || 0} Modules
                                                </span>
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                                                    {req.enabled_features?.length || 0} Features
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm text-slate-500 font-medium">
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <button 
                                                onClick={() => {
                                                    setSelectedRequest(req);
                                                    setIsReviewModalOpen(true);
                                                }}
                                                className="bg-slate-900 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition-all flex items-center gap-2"
                                            >
                                                Review Request <ArrowUpRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {pendingRequests.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                                                    <Clock size={32} />
                                                </div>
                                                <p className="text-slate-400 font-medium">No pending onboarding requests.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Review Request Modal */}
            {isReviewModalOpen && selectedRequest && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100">
                        <div className="p-10">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Review Onboarding Request</h2>
                                    <p className="text-slate-500 text-sm">Vett organization details and security configuration before provisioning.</p>
                                </div>
                                <div className="bg-amber-50 text-amber-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
                                    <Clock size={14} /> PENDING VETTING
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mb-10">
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Organization</label>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <p className="font-bold text-slate-900">{selectedRequest.org_name}</p>
                                            <p className="text-xs text-slate-500 font-mono">/{selectedRequest.org_slug}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Administrative Contact</label>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <p className="font-bold text-slate-900">{selectedRequest.admin_email}</p>
                                            <p className="text-xs text-slate-500">Executive Account Holder</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Industry & Scale</label>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <p className="font-bold text-slate-900">{selectedRequest.industry}</p>
                                            <p className="text-xs text-slate-500">{selectedRequest.company_size} Employees</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Selected Capabilities</label>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {selectedRequest.selected_modules?.map((mod: string) => (
                                                <span key={mod} className="text-[9px] font-bold bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-md capitalize">
                                                    {mod}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl mb-10 flex gap-4">
                                <ShieldCheck className="text-blue-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-blue-900 mb-1">Secure Invitation Flow Enabled</p>
                                    <p className="text-xs text-blue-700 leading-relaxed">
                                        Approving this request will trigger an automated environment deployment and send a secure invitation link to <span className="font-bold">{selectedRequest.admin_email}</span>. No passwords will be sent in transit.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsReviewModalOpen(false)}
                                    className="px-8 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
                                >
                                    Close
                                </button>
                                <div className="flex-1 flex gap-4 justify-end">
                                    <button
                                        onClick={() => handleReject(selectedRequest.id)}
                                        disabled={isSubmitting}
                                        className="px-8 py-4 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all border border-red-100 flex items-center gap-2"
                                    >
                                        <XCircle size={18} /> Reject Request
                                    </button>
                                    <button
                                        onClick={() => handleApprove(selectedRequest)}
                                        disabled={isSubmitting}
                                        className="bg-slate-900 text-white px-10 py-4 rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-slate-200"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Activity className="animate-spin" size={18} /> Deploying...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={18} /> Approve & Provision
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;
