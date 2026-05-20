import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, Phone, MapPin, ZoomIn, ZoomOut, RotateCcw, Shield, Users, Briefcase, Activity, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const HierarchyDemo = () => {
    const [orgId, setOrgId] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [hierarchyData, setHierarchyData] = useState({
        executives: [],
        managers: [],
        teamLeads: [],
        employees: []
    });
    const [loading, setLoading] = useState(true);
    const [scale, setScale] = useState(0.85);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
    const [collapsedSections, setCollapsedSections] = useState({});
    const [showOverview, setShowOverview] = useState(false);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.3, 0.3));
    const handleReset = () => {
        setScale(0.85);
        if (containerRef.current) {
            containerRef.current.scrollLeft = 0;
            containerRef.current.scrollTop = 0;
        }
    };

    const toggleSection = (key) => {
        setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Fetch org_id from current user
    useEffect(() => {
        const fetchOrgId = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('org_id')
                        .eq('id', user.id)
                        .single();

                    if (profile?.org_id) {
                        setOrgId(profile.org_id);
                    }
                }
            } catch (error) {
                // silently fail
            }
        };
        fetchOrgId();
    }, []);

    useEffect(() => {
        if (orgId) {
            fetchHierarchy();
        }
    }, [orgId]);

    const fetchHierarchy = async () => {
        try {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .eq('org_id', orgId)
                .eq('is_active', true)
                .order('full_name');

            if (profiles) {
                const getRole = (p) => p.role ? p.role.toLowerCase().trim() : '';

                const executives = profiles.filter(p => getRole(p) === 'executive');
                const managers = profiles.filter(p => getRole(p) === 'manager');
                const teamLeads = profiles.filter(p => getRole(p) === 'team_lead');
                const employees = profiles.filter(p => getRole(p) === 'employee');

                setHierarchyData({ executives, managers, teamLeads, employees });
            }
        } catch (error) {
            // silently fail
        } finally {
            setLoading(false);
        }
    };

    // Measure canvas natural size
    useEffect(() => {
        if (!canvasRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                setCanvasSize({ w: entry.contentRect.width, h: entry.contentRect.height });
            }
        });
        ro.observe(canvasRef.current);
        return () => ro.disconnect();
    }, [loading, hierarchyData]);

    // Compact Employee Node
    const EmployeeNode = ({ data, color, roleLabel, compact = false }) => (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                position: 'relative'
            }}
            onClick={() => setSelectedEmployee(data)}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
                const card = e.currentTarget.querySelector('.node-card');
                if (card) {
                    card.style.borderColor = color;
                    card.style.boxShadow = `0 12px 28px -6px ${color}35`;
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                const card = e.currentTarget.querySelector('.node-card');
                if (card) {
                    card.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                    card.style.boxShadow = '0 4px 12px -2px rgba(0, 0, 0, 0.06)';
                }
            }}
        >
            {/* Role Chip */}
            <div style={{
                backgroundColor: color,
                color: 'white',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.5rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '-8px',
                zIndex: 2,
                boxShadow: `0 2px 8px ${color}30`
            }}>
                {roleLabel || data.role}
            </div>

            {/* Node Card */}
            <div className="node-card" style={{
                padding: compact ? '14px 10px' : '16px 14px',
                backgroundColor: 'white',
                border: '1.5px solid rgba(226, 232, 240, 0.8)',
                borderRadius: '16px',
                boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.06)',
                width: compact ? '130px' : '160px',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
            }}>
                <div style={{
                    width: compact ? '40px' : '48px',
                    height: compact ? '40px' : '48px',
                    borderRadius: '14px',
                    backgroundColor: 'white',
                    padding: '3px',
                    boxShadow: `0 4px 10px -2px ${color}18`,
                    border: `1.5px solid ${color}20`
                }}>
                    <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '11px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f8fafc'
                    }}>
                        {data.avatar_url ? (
                            <img src={data.avatar_url} alt={data.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ fontSize: compact ? '1rem' : '1.2rem', fontWeight: '800', color: color }}>{data.full_name?.charAt(0)}</span>
                        )}
                    </div>
                </div>

                <div style={{ minWidth: 0, width: '100%' }}>
                    <p style={{
                        fontWeight: '700',
                        fontSize: compact ? '0.72rem' : '0.8rem',
                        color: '#0f172a',
                        margin: 0,
                        letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {data.full_name || 'N/A'}
                    </p>
                    <p style={{
                        fontSize: '0.6rem',
                        color: '#94a3b8',
                        fontWeight: '600',
                        marginTop: '2px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {data.job_title || 'Member'}
                    </p>
                </div>
            </div>
        </div>
    );

    const SectionHeader = ({ color, label, icon: Icon, count, sectionKey }) => {
        const isCollapsed = collapsedSections[sectionKey];
        return (
            <div
                onClick={() => toggleSection(sectionKey)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: 'white',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    border: `1px solid ${color}20`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    marginBottom: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    userSelect: 'none'
                }}
            >
                <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: `${color}12`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon size={15} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
                    {label}
                </span>
                <span style={{
                    backgroundColor: `${color}12`,
                    color: color,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: '800'
                }}>
                    {count}
                </span>
                {isCollapsed ? <ChevronRight size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
            </div>
        );
    };

    // Connector line between levels
    const LevelConnector = ({ color = '#cbd5e1' }) => (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '8px'
        }}>
            <div style={{
                width: '2px',
                height: '32px',
                background: `linear-gradient(to bottom, ${color}60, ${color}20)`,
                borderRadius: '1px'
            }} />
        </div>
    );

    if (loading) return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: '36px', height: '36px', border: '3px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
                <p style={{ fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>Projecting Hierarchy...</p>
            </div>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );

    // Compute spacer dimensions
    const spacerW = canvasSize.w ? canvasSize.w * scale + 120 : '100%';
    const spacerH = canvasSize.h ? canvasSize.h * scale + 120 : '100%';

    const allTeamLeadsAndEmployees = [...hierarchyData.teamLeads, ...hierarchyData.employees];

    return (
        <div style={{
            height: '100%',
            width: '100%',
            position: 'relative',
            backgroundColor: '#f8fafc',
            backgroundImage: `radial-gradient(circle at 2px 2px, #e2e8f0 0.5px, transparent 0)`,
            backgroundSize: '32px 32px',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 0 24px', zIndex: 10 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.04em', marginBottom: '4px' }}>
                    Org <span style={{ color: '#7c3aed' }}>Visualizer</span>
                </h1>
                <p style={{ color: '#64748b', fontWeight: '600', fontSize: '0.85rem' }}>Strategic workforce alignment and reporting lines.</p>
            </div>

            {/* Scroll area */}
            <div style={{ position: 'absolute', top: '76px', left: 0, right: 0, bottom: 0 }}>
                <div
                    className="premium-scrollbar"
                    ref={containerRef}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        overflow: 'auto'
                    }}
                >
                    <div style={{
                        width: spacerW,
                        height: spacerH,
                        minWidth: '100%',
                        minHeight: '100%',
                        position: 'relative'
                    }}>
                        <div
                            ref={canvasRef}
                            style={{
                                display: 'inline-block',
                                textAlign: 'center',
                                padding: '24px 60px 80px 60px',
                                transformOrigin: 'top center',
                                transform: `translateX(-50%) scale(${scale})`,
                                transition: 'transform 0.3s ease',
                                position: 'absolute',
                                top: 0,
                                left: '50%',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {(!hierarchyData.executives.length && !hierarchyData.managers.length && !allTeamLeadsAndEmployees.length) ? (
                                <div style={{ padding: '48px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: '360px', whiteSpace: 'normal' }}>
                                    <Users size={40} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>Empty Hierarchy</h3>
                                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No organizational structure found.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'inline-block', textAlign: 'center', whiteSpace: 'normal' }}>
                                    {/* Level 1: Executives */}
                                    {hierarchyData.executives.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <SectionHeader color="#7c3aed" label="Executive Board" icon={Shield} count={hierarchyData.executives.length} sectionKey="executives" />
                                            {!collapsedSections.executives && (
                                                <>
                                                    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        {hierarchyData.executives.map(exec => (
                                                            <EmployeeNode key={exec.id} data={exec} color="#7c3aed" roleLabel="Executive" />
                                                        ))}
                                                    </div>
                                                    <LevelConnector color="#7c3aed" />
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Level 2: Managers */}
                                    {hierarchyData.managers.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <SectionHeader color="#2563eb" label="Operations Management" icon={Users} count={hierarchyData.managers.length} sectionKey="managers" />
                                            {!collapsedSections.managers && (
                                                <>
                                                    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        {hierarchyData.managers.map(manager => (
                                                            <EmployeeNode key={manager.id} data={manager} color="#2563eb" roleLabel="Manager" />
                                                        ))}
                                                    </div>
                                                    <LevelConnector color="#2563eb" />
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Level 3: Team Leads */}
                                    {hierarchyData.teamLeads.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <SectionHeader color="#10b981" label="Team Leads" icon={Briefcase} count={hierarchyData.teamLeads.length} sectionKey="teamLeads" />
                                            {!collapsedSections.teamLeads && (
                                                <>
                                                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '900px' }}>
                                                        {hierarchyData.teamLeads.map(tl => (
                                                            <EmployeeNode key={tl.id} data={tl} color="#10b981" roleLabel="Team Lead" compact />
                                                        ))}
                                                    </div>
                                                    <LevelConnector color="#10b981" />
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Level 4: Employees */}
                                    {hierarchyData.employees.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <SectionHeader color="#64748b" label="Workforce" icon={Activity} count={hierarchyData.employees.length} sectionKey="employees" />
                                            {!collapsedSections.employees && (
                                                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '1000px' }}>
                                                    {hierarchyData.employees.map(emp => (
                                                        <EmployeeNode key={emp.id} data={emp} color="#64748b" roleLabel="Employee" compact />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Stats Panel Toggle */}
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '12px'
                }}>
                    <button 
                        onClick={() => setShowOverview(!showOverview)}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(226, 232, 240, 0.8)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.color = '#7c3aed';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.color = showOverview ? '#7c3aed' : '#64748b';
                        }}
                        title="Org Overview"
                    >
                        {showOverview ? <X size={20} /> : <Info size={20} />}
                    </button>

                    {/* Quick Stats Panel Content */}
                    {showOverview && (
                        <div style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(10px)',
                            padding: '16px',
                            borderRadius: '16px',
                            border: '1px solid rgba(226, 232, 240, 0.8)',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            width: '200px',
                            animation: 'modalSlideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>Org Overview</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {[
                                    { label: 'Leadership', count: hierarchyData.executives.length, color: '#7c3aed' },
                                    { label: 'Management', count: hierarchyData.managers.length, color: '#2563eb' },
                                    { label: 'Team Leads', count: hierarchyData.teamLeads.length, color: '#10b981' },
                                    { label: 'Workforce', count: hierarchyData.employees.length, color: '#64748b' }
                                ].map(stat => (
                                    <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>{stat.label}</span>
                                        <span style={{ backgroundColor: `${stat.color}12`, color: stat.color, padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800' }}>{stat.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Zoom Controls */}
                <div style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: '6px 14px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                    zIndex: 100,
                    color: 'white'
                }}>
                    <button onClick={handleZoomOut} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}><ZoomOut size={18} /></button>
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', height: '16px' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', minWidth: '40px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', height: '16px' }}></div>
                    <button onClick={handleZoomIn} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}><ZoomIn size={18} /></button>
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', height: '16px' }}></div>
                    <button onClick={handleReset} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}><RotateCcw size={16} /></button>
                </div>

                {/* Profile Modal */}
                {selectedEmployee && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: '24px'
                    }} onClick={() => setSelectedEmployee(null)}>
                        <div style={{
                            backgroundColor: '#ffffff', width: '480px', borderRadius: '24px',
                            overflow: 'hidden', boxShadow: '0 32px 80px -16px rgba(0,0,0,0.3)',
                            animation: 'modalSlideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ height: '120px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', position: 'relative' }}>
                                <button onClick={() => setSelectedEmployee(null)}
                                    style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={16} />
                                </button>
                                <div style={{ position: 'absolute', bottom: '-32px', left: '32px', width: '72px', height: '72px', borderRadius: '20px', backgroundColor: 'white', padding: '4px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                                        {selectedEmployee.avatar_url ? (
                                            <img src={selectedEmployee.avatar_url} alt={selectedEmployee.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: '800', color: '#64748b' }}>
                                                {selectedEmployee.full_name?.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '44px 32px 28px' }}>
                                <div style={{ marginBottom: '24px' }}>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>{selectedEmployee.full_name}</h2>
                                    <p style={{ fontSize: '0.85rem', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedEmployee.job_title}</p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
                                    {[
                                        { icon: Mail, label: 'Email', value: selectedEmployee.email },
                                        { icon: Phone, label: 'Phone', value: selectedEmployee.phone || 'N/A' },
                                        { icon: MapPin, label: 'Location', value: selectedEmployee.location || 'Remote' },
                                        { icon: Activity, label: 'Status', value: 'Active' }
                                    ].map((info, i) => (
                                        <div key={i} style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '6px' }}>
                                                <info.icon size={12} />
                                                <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>{info.label}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setSelectedEmployee(null)}
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.3s ease' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0f172a'}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <style>{`
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .premium-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: #94a3b8 #f1f5f9;
                }
                .premium-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .premium-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                }
                .premium-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .premium-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .premium-scrollbar::-webkit-scrollbar-corner {
                    background: #f1f5f9;
                }
            `}</style>
            </div>
        </div>
    );
};

export default HierarchyDemo;
