import React, { useState } from 'react';
import { Search, Filter, Grid, List as ListIcon, Activity, Eye, Edit, Briefcase, Users, ChevronRight, LayoutGrid } from 'lucide-react';

const EmployeesFeature = ({ employees, type, title, onAction }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [availabilityFilter, setAvailabilityFilter] = useState('all');
    const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
    const [statusFilter, setStatusFilter] = useState('Active'); // Defaults strictly to Active

    const filteredEmployees = employees.filter(emp => {
        // Search filter
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.department_display?.toLowerCase().includes(searchTerm.toLowerCase());

        // Availability filter
        const matchesAvailability =
            availabilityFilter === 'all' ||
            (availabilityFilter === 'online' && emp.availability === 'Online') ||
            (availabilityFilter === 'offline' && emp.availability === 'Offline') ||
            (availabilityFilter === 'on-leave' && emp.availability === 'On Leave');
 
        // Status filter (Active/Inactive/All)
        const matchesStatus = statusFilter === 'All' ||
            (statusFilter === 'Active' && emp.is_active !== false) ||
            (statusFilter === 'Inactive' && emp.is_active === false);
 
        return matchesSearch && matchesAvailability && matchesStatus;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Premium Header Container */}
            <div style={{
                background: 'var(--surface)',
                borderRadius: '24px',
                padding: '24px 32px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                {/* Search and Filters Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    
                    {/* Search Input */}
                    <div style={{ flex: '1', minWidth: '280px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, designation, or team..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '14px 16px 14px 44px',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.95rem',
                                backgroundColor: '#f8fafc',
                                color: '#0f172a',
                                fontWeight: '500',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                outline: 'none'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#38bdf8';
                                e.target.style.backgroundColor = '#ffffff';
                                e.target.style.boxShadow = '0 0 0 4px rgba(56, 189, 248, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#e2e8f0';
                                e.target.style.backgroundColor = '#f8fafc';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Filters & View Toggles */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        
                        {/* Live Status Filter (Only prominent on Status view, but helpful everywhere) */}
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Filter size={16} />
                                <span style={{ width: '1px', height: '14px', backgroundColor: '#e2e8f0', margin: '0 4px' }}></span>
                            </div>
                            <select
                                value={availabilityFilter}
                                onChange={(e) => setAvailabilityFilter(e.target.value)}
                                style={{
                                    padding: '12px 36px 12px 42px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    color: '#475569',
                                    backgroundColor: '#ffffff',
                                    cursor: 'pointer',
                                    appearance: 'none',
                                    outline: 'none',
                                    minWidth: '140px'
                                }}
                            >
                                <option value="all">All Status</option>
                                <option value="online">● Online Now</option>
                                <option value="offline">○ Offline</option>
                                <option value="on-leave">⨯ On Leave</option>
                            </select>
                            {/* Custom Select Arrow */}
                            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>

                        {/* Workforce Status Filter */}
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Filter size={16} />
                                <span style={{ width: '1px', height: '14px', backgroundColor: '#e2e8f0', margin: '0 4px' }}></span>
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{
                                    padding: '12px 36px 12px 42px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    color: '#475569',
                                    backgroundColor: '#ffffff',
                                    cursor: 'pointer',
                                    appearance: 'none',
                                    outline: 'none',
                                    minWidth: '160px'
                                }}
                            >
                                <option value="Active">🟢 Active Personnel</option>
                                <option value="Inactive">🔴 Former Personnel</option>
                                <option value="All">⚪ All Workforce</option>
                            </select>
                            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                            <button
                                onClick={() => setViewMode('grid')}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                                    color: viewMode === 'grid' ? '#0f172a' : '#64748b',
                                    boxShadow: viewMode === 'grid' ? '0 2px 4px rgba(0,0,0,0.04)' : 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Grid View"
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: viewMode === 'list' ? '#ffffff' : 'transparent',
                                    color: viewMode === 'list' ? '#0f172a' : '#64748b',
                                    boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.04)' : 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="List View"
                            >
                                <ListIcon size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>
                    Showing <span style={{ color: '#0f172a' }}>{filteredEmployees.length}</span> personnel
                </div>
                {type === 'status' && (
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                            {employees.filter(e => e.availability === 'Online').length} Online
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                            {employees.filter(e => e.availability === 'On Leave').length} On Leave
                        </div>
                    </div>
                )}
            </div>

            {/* Data Rendering */}
            {viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                    {filteredEmployees.map((emp) => (
                        <div
                            key={emp.id}
                            style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '16px',
                                padding: '16px',
                                border: (type === 'status' && emp.availability === 'Online') ? '2px solid #22c55e' : '1px solid #f1f5f9',
                                boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px)';
                                e.currentTarget.style.borderColor = (type === 'status' && emp.availability === 'Online') ? '#22c55e' : '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.06)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = (type === 'status' && emp.availability === 'Online') ? '#22c55e' : '#f1f5f9';
                                e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.02)';
                            }}
                            onClick={() => type === 'workforce' ? onAction('View Employee', emp) : onAction('View Status', emp)}
                        >
                            {/* Profile Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                                        {emp.avatar_url ? (
                                            <img src={emp.avatar_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#64748b' }}>{emp.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', marginBottom: '2px', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {emp.name}
                                            {emp.is_active === false && (
                                                <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', fontSize: '0.65rem', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>FORMER</span>
                                            )}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.department_display}</span>
                                            <span style={{ color: '#cbd5e1', flexShrink: 0 }}>•</span>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: emp.availability === 'Online' ? '#22c55e' : emp.availability === 'On Leave' ? '#ef4444' : '#94a3b8' }}></span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: emp.availability === 'Online' ? '#16a34a' : emp.availability === 'On Leave' ? '#dc2626' : '#64748b' }}>{emp.availability}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 10, flexShrink: 0, marginLeft: 'auto' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onAction(type === 'workforce' ? 'View Employee' : 'View Status', emp); }}
                                        style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid #f1f5f9', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onAction('Edit Employee', emp); }}
                                        style={{ width: '36px', height: '36px', borderRadius: '12px', border: '1px solid #f1f5f9', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                    >
                                        <Edit size={18} />
                                    </button>
                                </div>
                            </div>

                            {type === 'status' ? (
                                <>
                                    {/* Activity Pulse Section */}
                                    <div style={{
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '16px',
                                        padding: '16px',
                                        border: '1px solid #f1f5f9'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Activity size={14} style={{ color: '#38bdf8' }} />
                                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Active Intent</span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b' }}>{emp.lastActive}</span>
                                        </div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                                            {emp.task !== '-' ? emp.task : 'System Idle / Standby'}
                                        </div>
                                        <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: emp.availability === 'Online' ? '100%' : '0%',
                                                height: '100%',
                                                backgroundColor: '#38bdf8',
                                                borderRadius: '2px',
                                                boxShadow: '0 0 8px rgba(56, 189, 248, 0.5)'
                                            }}></div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: '700' }}>
                                                {emp.role}
                                            </span>
                                            <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: '#f5f3ff', color: '#6d28d9', fontSize: '0.7rem', fontWeight: '700' }}>
                                                {emp.job_title}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onAction('View Status', emp); }}
                                            style={{ color: '#3182ce', fontSize: '0.8rem', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            Live Intel <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Info Grid for Workforce */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ padding: '16px', borderRadius: '20px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', minWidth: 0 }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Briefcase size={12} /> Job Title
                                            </div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.job_title || 'N/A'}</div>
                                        </div>
                                        <div style={{ padding: '16px', borderRadius: '20px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', minWidth: 0 }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Users size={12} /> Department
                                            </div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.department_display || 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {emp.projects > 0 ? (
                                            <span style={{ padding: '6px 12px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #d1fae5' }}>
                                                Active on {emp.projects} Projects
                                            </span>
                                        ) : (
                                            <span style={{ padding: '6px 12px', borderRadius: '10px', backgroundColor: '#fff7ed', color: '#d97706', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #ffedd5' }}>
                                                Awaiting Project
                                            </span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Premium List View Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: type === 'status' ? 'minmax(300px, 1.5fr) 1fr 1.5fr 1fr 120px' : 'minmax(300px, 1.5fr) 1fr 1fr 1fr 120px',
                        padding: '12px 32px',
                        color: '#64748b',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <div>{type === 'status' ? 'Live Operator' : 'Employee Details'}</div>
                        <div>{type === 'status' ? 'Department' : 'Designation'}</div>
                        <div>{type === 'status' ? 'Live Activity / Presence' : 'Organization / Team'}</div>
                        <div>{type === 'status' ? 'Last Signal' : 'Employment Status'}</div>
                        <div style={{ textAlign: 'right' }}>Actions</div>
                    </div>

                    {/* Premium List Rows */}
                    {filteredEmployees.map((emp) => (
                        <div
                            key={emp.id}
                            style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '20px',
                                padding: '16px 32px',
                                border: '1px solid #f1f5f9',
                                display: 'grid',
                                gridTemplateColumns: type === 'status' ? 'minmax(300px, 1.5fr) 1fr 1.5fr 1fr 120px' : 'minmax(300px, 1.5fr) 1fr 1fr 1fr 120px',
                                alignItems: 'center',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.04)';
                                e.currentTarget.style.transform = 'scale(1.005)';
                                e.currentTarget.style.zIndex = 10;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#f1f5f9';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.01)';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.zIndex = 1;
                            }}
                            onClick={() => type === 'workforce' ? onAction('View Employee', emp) : onAction('View Status', emp)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    border: '1px solid #e2e8f0',
                                    position: 'relative'
                                }}>
                                    {emp.avatar_url ? (
                                        <img src={emp.avatar_url} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontSize: '1rem', fontWeight: '800', color: '#64748b' }}>{emp.name.charAt(0)}</span>
                                    )}
                                    {type === 'status' && (
                                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: emp.availability === 'Online' ? '#22c55e' : '#cbd5e1', border: '2px solid white' }}></div>
                                    )}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {emp.name}
                                        {emp.is_active === false && (
                                            <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', fontSize: '0.65rem', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>FORMER</span>
                                        )}
                                    </h4>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{emp.job_title}</p>
                                </div>
                            </div>

                            <div style={{ color: '#334155', fontWeight: '600', fontSize: '0.9rem' }}>
                                {emp.department_display || 'Main Office'}
                            </div>

                            {type === 'status' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>{emp.task !== '-' ? emp.task : 'Active Standby'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                            <div style={{ width: '60px', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: emp.availability === 'Online' ? '80%' : '0%', height: '100%', backgroundColor: '#22c55e' }}></div>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8' }}>LIVE</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ color: '#64748b', fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></div>
                                    {emp.role}
                                </div>
                            )}

                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: emp.is_active === false ? '#ef4444' : '#475569' }}>
                                    {type === 'status' ? emp.lastActive : (emp.is_active === false ? 'Left Organization' : emp.availability)}
                                </div>
                                {type === 'status' && (
                                    <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Session Lock</div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAction(type === 'status' ? 'View Status' : 'View Employee', emp); }}
                                    style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                >
                                    <Eye size={18} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAction('Edit Employee', emp); }}
                                    style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' }}
                                >
                                    <Edit size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EmployeesFeature;
