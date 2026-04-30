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
    const [tickets, setTickets] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'tenants' | 'requests' | 'tickets'>('tickets');
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [ticketComments, setTicketComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
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
        
        const checkSecurity = async () => {
            try {
                setAuthChecking(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/login');
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                const role = profile.role?.toLowerCase();
                if (!profile || (role !== 'superadmin' && role !== 'super_admin')) {
                    setAuthError(profile?.role || 'No Role Assigned');
                    setAuthChecking(false);
                    return;
                }

                await fetchData();
                setAuthChecking(false);
            } catch (error) {
                console.error('Security check error:', error);
                setAuthError('Authentication Error');
                setAuthChecking(false);
            }
        };

        checkSecurity();
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

            // Fetch platform tickets
            const { data: ticketsData, error: ticketsError } = await supabase
                .from('tickets')
                .select('*')
                .order('created_at', { ascending: false });

            if (ticketsError) throw ticketsError;
            setTickets(ticketsData);

            const { count: orgCount } = await supabase.from('orgs').select('*', { count: 'exact', head: true });
            const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

            setStats({
                totalOrgs: orgCount || 0,
                totalUsers: userCount || 0,
                activeSystems: orgsData?.filter((o: any) => o.is_active).length || 0
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

    const handleResolveTicket = async (ticketId: string) => {
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ status: 'resolved' })
                .eq('id', ticketId);

            if (error) throw error;
            fetchData();
            // Keep modal open to show the "Close" option
            const updatedTicket = tickets.find(t => t.id === ticketId);
            if (updatedTicket) setSelectedTicket({...updatedTicket, status: 'resolved'});
        } catch (error: any) {
            console.error('Resolution error:', error);
        }
    };

    const handleCloseTicket = async (ticketId: string) => {
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ status: 'closed' })
                .eq('id', ticketId);

            if (error) throw error;
            setIsTicketModalOpen(false);
            fetchData();
        } catch (error: any) {
            console.error('Closing error:', error);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !selectedTicket || isSubmittingComment) return;

        try {
            setIsSubmittingComment(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found');

            const { error } = await supabase
                .from('ticket_comments')
                .insert([{
                    ticket_id: selectedTicket.id,
                    user_id: user.id,
                    comment: newComment
                }]);

            if (error) throw error;
            setNewComment('');
            await fetchComments(selectedTicket.id);
        } catch (error: any) {
            console.error('Comment error:', error);
            alert('Failed to add comment: ' + (error.message || 'Check your permissions'));
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const fetchComments = async (ticketId: string) => {
        const { data } = await supabase
            .from('ticket_comments')
            .select('*, profiles(full_name, role)')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
        
        if (data) setTicketComments(data);
    };

    if (authChecking) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center">
                <Activity className="animate-spin text-orange-500 mb-4" size={40} />
                <p className="text-slate-500 font-bold animate-pulse">Verifying Security Clearance...</p>
            </div>
        );
    }

    if (authError) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[32px] flex items-center justify-center mb-8">
                    <ShieldCheck size={40} />
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-4">Access Denied</h1>
                <p className="text-slate-500 max-w-md mb-8">
                    Your account is currently identified as <span className="text-rose-600 font-bold uppercase tracking-widest text-xs bg-rose-50 px-2 py-1 rounded-md">{authError}</span>. 
                    This dashboard is restricted to the Platform SuperAdmin only.
                </p>
                <button 
                    onClick={() => navigate('/login')}
                    className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 cursor-pointer active:scale-95"
                >
                    Return to Login
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] p-8 overflow-y-auto relative">
            {loading && (
                <div className="fixed top-4 right-4 z-[100] bg-white/80 backdrop-blur-md border border-slate-100 px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
                    <Activity className="animate-spin text-orange-500" size={16} />
                    <span className="text-xs font-bold text-slate-600">Syncing Data...</span>
                </div>
            )}
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                        Control <span className="text-orange-600">Center</span>
                    </h1>
                    <p className="text-slate-500 font-medium">SaaS Global Administration & Monitoring</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-200 cursor-pointer"
                >
                    <Plus size={20} /> Provision New Org
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                {[
                    { label: 'Total Organizations', value: stats.totalOrgs, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Platform Users', value: stats.totalUsers, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Active Systems', value: stats.activeSystems, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Pending Tickets', value: tickets.filter(t => t.status === 'open').length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' }
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
                    onClick={() => setActiveTab('tickets')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all cursor-pointer active:scale-95 ${activeTab === 'tickets' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                >
                    Support Tickets ({tickets.filter(t => t.status !== 'closed').length})
                </button>
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all cursor-pointer active:scale-95 ${activeTab === 'requests' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                >
                    Onboarding ({pendingRequests.length})
                </button>
                <button 
                    onClick={() => setActiveTab('tenants')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all cursor-pointer active:scale-95 ${activeTab === 'tenants' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
                >
                    Live Tenants ({orgs.length})
                </button>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-bottom border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                        {activeTab === 'tenants' ? (
                            <><Activity className="text-orange-500" /> Live Tenants</>
                        ) : activeTab === 'requests' ? (
                            <><Clock className="text-amber-500" /> Onboarding Requests</>
                        ) : (
                            <><AlertCircle className="text-rose-500" /> Support Tickets</>
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
                    ) : activeTab === 'requests' ? (
                        <table className="w-full text-left">
                            {/* ... requests table headers ... */}
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
                                                className="bg-slate-900 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-orange-600 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                                            >
                                                Review Request <ArrowUpRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        /* TICKETS VIEW */
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issue</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reporter</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {tickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                                                ticket.status === 'closed' ? 'bg-slate-100 text-slate-500' :
                                                ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                            }`}>
                                                {ticket.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="font-bold text-slate-900">{ticket.subject}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{new Date(ticket.created_at).toLocaleString()}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm font-bold text-slate-900">{ticket.metadata?.reporter_name || 'System User'}</p>
                                        </td>
                                        <td className="px-8 py-6 text-sm text-slate-500 capitalize">
                                            {ticket.category.replace('_', ' ')}
                                        </td>
                                        <td className="px-8 py-6">
                                            <button 
                                                onClick={() => {
                                                    setSelectedTicket(ticket);
                                                    fetchComments(ticket.id);
                                                    setIsTicketModalOpen(true);
                                                }}
                                                className="bg-slate-100 text-slate-900 text-xs px-4 py-2 rounded-lg font-bold hover:bg-slate-900 hover:text-white active:scale-95 transition-all cursor-pointer"
                                            >
                                                Manage Ticket
                                            </button>
                                        </td>
                                    </tr>
                                ))}
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
            {/* Ticket Management Modal */}
            {isTicketModalOpen && selectedTicket && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100">
                        <div className="p-10">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedTicket.subject}</h2>
                                    <p className="text-slate-500 text-sm">Platform Support Ticket from {selectedTicket.metadata?.reporter_name}</p>
                                </div>
                                <div className={`px-4 py-2 rounded-full text-xs font-bold ${
                                    selectedTicket.status === 'resolved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                    {selectedTicket.status.toUpperCase()}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Issue Description</label>
                                <p className="text-slate-700 text-sm leading-relaxed">{selectedTicket.description}</p>
                            </div>

                            <div className="mb-8">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Conversation History</label>
                                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-4 mb-6">
                                    {ticketComments.length > 0 ? ticketComments.map((comment: any) => (
                                        <div key={comment.id} className={`flex flex-col ${comment.profiles?.role === 'superadmin' ? 'items-end' : 'items-start'}`}>
                                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                                                comment.profiles?.role === 'superadmin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                <p className="text-[9px] font-black opacity-60 mb-1 uppercase tracking-tight">
                                                    {comment.profiles?.full_name} ({comment.profiles?.role})
                                                </p>
                                                {comment.comment}
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-center text-slate-400 text-xs py-4 italic">No conversation history yet.</p>
                                    )}
                                </div>

                                <form onSubmit={handleAddComment} className="flex gap-3">
                                    <input 
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Type your official response..."
                                        className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-900 shadow-sm"
                                    />
                                        <button 
                                            type="submit" 
                                            disabled={isSubmittingComment}
                                            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all text-sm cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            {isSubmittingComment ? 'Adding...' : 'Add Comment'}
                                        </button>
                                </form>
                            </div>

                            <div className="flex gap-4 border-t border-slate-100 pt-8">
                                <button
                                    onClick={() => setIsTicketModalOpen(false)}
                                    className="px-8 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <div className="flex-1 flex justify-end gap-3">
                                    {selectedTicket.status === 'open' && (
                                        <button
                                            onClick={() => handleResolveTicket(selectedTicket.id)}
                                            className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 cursor-pointer active:scale-95"
                                        >
                                            <CheckCircle2 size={18} /> Mark as Resolved
                                        </button>
                                    )}
                                    {selectedTicket.status === 'resolved' && (
                                        <button
                                            onClick={() => handleCloseTicket(selectedTicket.id)}
                                            className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-slate-100 flex items-center gap-2 cursor-pointer active:scale-95"
                                        >
                                            <XCircle size={18} /> Close Ticket Permanently
                                        </button>
                                    )}
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
