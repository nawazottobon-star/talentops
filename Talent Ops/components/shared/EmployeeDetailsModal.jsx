import React from 'react';
import { X, Mail, Phone, MapPin, Calendar, Briefcase, User, TrendingUp, Layers, CheckCircle2, DollarSign, ShieldCheck, Info, IndianRupee } from 'lucide-react';
import UserAvatar from './UserAvatar';

const EmployeeDetailsModal = ({ 
    selectedEmployee, 
    onClose 
}) => {
    if (!selectedEmployee) return null;

    const isIntern = (
        selectedEmployee.employment_type?.toLowerCase() === 'intern' || 
        selectedEmployee.job_title?.toLowerCase() === 'intern' || 
        selectedEmployee.role?.toLowerCase() === 'intern'
    );

    // Tightened logic: Paid means they have a positive stipend
    const isPaidIntern = isIntern && (selectedEmployee.stipend > 0);

    // Reuseable Detail Card Component
    const DetailCard = ({ icon: Icon, label, value, color = "#7c3aed", bgColor = "#f5f3ff" }) => (
        <div style={{ 
            padding: '16px', 
            backgroundColor: 'white', 
            borderRadius: '16px', 
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
            <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '12px', 
                backgroundColor: bgColor, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: color
            }}>
                <Icon size={20} />
            </div>
            <div>
                <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
                <p style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', margin: '2px 0 0 0' }}>{value}</p>
            </div>
        </div>
    );

    // Small Metric Card for Performance
    const MetricCard = ({ icon: Icon, label, value, color }) => (
        <div style={{ 
            padding: '20px', 
            backgroundColor: '#ffffff', 
            borderRadius: '20px', 
            border: '1px solid #f1f5f9',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
        }}>
            <div style={{ color: color, marginBottom: '4px' }}>
                <Icon size={24} />
            </div>
            <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>{label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1e293b', margin: 0 }}>{value}</p>
        </div>
    );

    return (
        <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(10, 10, 11, 0.6)', 
            backdropFilter: 'blur(10px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000 
        }} onClick={onClose}>
            <div 
                className="no-scrollbar" 
                style={{ 
                    backgroundColor: 'white', 
                    borderRadius: '32px', 
                    width: '750px', 
                    maxWidth: '95%', 
                    maxHeight: '90vh', 
                    overflowY: 'auto', 
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    position: 'relative',
                    animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <style>
                    {`
                        @keyframes modalSlideUp {
                            from { transform: translateY(30px); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                    `}
                </style>

                {/* Header Section */}
                <div style={{ 
                    padding: '32px 32px 24px 32px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start'
                }}>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <UserAvatar
                            user={{ full_name: selectedEmployee.name, avatar_url: selectedEmployee.avatar_url }}
                            size={92}
                            style={{ 
                                borderRadius: '30px', 
                                border: '4px solid white',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                background: '#f1f5f9'
                            }}
                        />
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                <h3 style={{ fontSize: '2rem', fontWeight: '900', color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>{selectedEmployee.name}</h3>
                                <div style={{ 
                                    padding: '4px 12px', 
                                    borderRadius: '10px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: '800', 
                                    backgroundColor: selectedEmployee.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                                    color: selectedEmployee.status === 'Active' ? '#15803d' : '#64748b',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {selectedEmployee.status}
                                </div>
                            </div>
                            <p style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: '600', margin: 0 }}>{selectedEmployee.job_title || selectedEmployee.role}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ 
                            width: '44px', 
                            height: '44px', 
                            borderRadius: '14px', 
                            backgroundColor: '#f8fafc', 
                            border: 'none', 
                            cursor: 'pointer', 
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '0 32px 40px 32px' }}>
                    {/* Contact Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                        <DetailCard icon={Mail} label="Email" value={selectedEmployee.email} bgColor="#edf2ff" color="#4338ca" />
                        <DetailCard icon={Phone} label="Phone" value={selectedEmployee.phone || 'N/A'} bgColor="#f0fdf4" color="#15803d" />
                        <DetailCard icon={Briefcase} label="Department" value={selectedEmployee.department_display || 'Unassigned'} bgColor="#fff7ed" color="#c2410c" />
                        <DetailCard icon={Calendar} label="Join Date" value={selectedEmployee.joinDate || 'N/A'} bgColor="#fdf2f8" color="#be185d" />
                    </div>

                    {/* Financial section */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ width: '32px', height: '2px', backgroundColor: '#f1f5f9' }} />
                            <h5 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
                                Financial Details
                            </h5>
                            <div style={{ flex: 1, height: '2px', backgroundColor: '#f1f5f9' }} />
                        </div>

                        {isIntern ? (
                            <div style={{ 
                                backgroundColor: isPaidIntern ? '#f0fdf4' : '#f8fafc', 
                                borderRadius: '24px', 
                                padding: '32px',
                                border: `1.5px solid ${isPaidIntern ? '#dcfce7' : '#e2e8f0'}`,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <IndianRupee size={20} color={isPaidIntern ? '#16a34a' : '#64748b'} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: isPaidIntern ? '#16a34a' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            INTERNSHIP STATUS
                                        </span>
                                    </div>
                                    <h4 style={{ fontSize: '2.2rem', fontWeight: '900', color: '#1e293b', margin: 0 }}>
                                        {isPaidIntern ? `₹${selectedEmployee.stipend?.toLocaleString('en-IN')}` : 'UNPAID INTERN'}
                                    </h4>
                                    <p style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: '600', margin: '4px 0 0 0' }}>
                                        {isPaidIntern ? 'Monthly Stipend' : 'No compensation program'}
                                    </p>
                                </div>
                                <div style={{ 
                                    padding: '12px 24px', 
                                    borderRadius: '14px', 
                                    backgroundColor: isPaidIntern ? 'rgba(22, 163, 74, 0.1)' : 'rgba(100, 116, 139, 0.1)', 
                                    color: isPaidIntern ? '#16a34a' : '#64748b', 
                                    fontWeight: '800', 
                                    fontSize: '0.8rem',
                                    letterSpacing: '0.05em',
                                    border: `1px solid ${isPaidIntern ? 'rgba(22, 163, 74, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`,
                                    textTransform: 'uppercase'
                                }}>
                                    {isPaidIntern ? 'Compensated' : 'Non-Compensated'}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                    <div style={{ padding: '20px', borderRadius: '20px', border: '1.5px solid #f1f5f9', backgroundColor: 'white' }}>
                                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Basic Salary</p>
                                        <p style={{ fontSize: '1.3rem', fontWeight: '800', color: '#1e293b', margin: '4px 0 0 0' }}>₹{selectedEmployee.basic_salary?.toLocaleString('en-IN') || '0'}</p>
                                    </div>
                                    <div style={{ padding: '20px', borderRadius: '20px', border: '1.5px solid #f1f5f9', backgroundColor: 'white' }}>
                                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>HRA</p>
                                        <p style={{ fontSize: '1.3rem', fontWeight: '800', color: '#1e293b', margin: '4px 0 0 0' }}>₹{selectedEmployee.hra?.toLocaleString('en-IN') || '0'}</p>
                                    </div>
                                    <div style={{ padding: '20px', borderRadius: '20px', border: '1.5px solid #f1f5f9', backgroundColor: 'white' }}>
                                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>Allowances</p>
                                        <p style={{ fontSize: '1.3rem', fontWeight: '800', color: '#1e293b', margin: '4px 0 0 0' }}>₹{selectedEmployee.allowances?.toLocaleString('en-IN') || '0'}</p>
                                    </div>
                                </div>
                                <div style={{ 
                                    padding: '24px 32px', 
                                    borderRadius: '24px', 
                                    backgroundColor: '#17141f', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)'
                                }}>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Net Salary</p>
                                        <h4 style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', margin: '4px 0 0 0', letterSpacing: '-0.01em' }}>
                                            ₹{((selectedEmployee.gross_salary || 0) - (selectedEmployee.professional_tax || 0)).toLocaleString('en-IN')}
                                        </h4>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '8px', 
                                            color: '#fb7185', 
                                            fontSize: '0.9rem', 
                                            fontWeight: '800',
                                            marginBottom: '4px',
                                            justifyContent: 'flex-end'
                                        }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fb7185' }} />
                                            Professional Tax: ₹{selectedEmployee.professional_tax?.toLocaleString('en-IN') || '0'}
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', margin: 0 }}>Final Disbursement Amount</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metrics Section */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        <MetricCard icon={TrendingUp} label="PERFORMANCE" value={selectedEmployee.performance || 'N/A'} color="#7c3aed" />
                        <MetricCard icon={Layers} label="PROJECTS" value={selectedEmployee.projects || '0'} color="#0891b2" />
                        <MetricCard icon={CheckCircle2} label="TASKS DONE" value={selectedEmployee.tasksCompleted || '0'} color="#059669" />
                    </div>
                </div>

                {/* Footer Controls */}
                <div style={{ 
                    padding: '24px 32px', 
                    borderTop: '1px solid #f8fafc', 
                    display: 'flex', 
                    justifyContent: 'flex-end',
                    backgroundColor: '#ffffff',
                    borderRadius: '0 0 32px 32px'
                }}>
                    <button 
                        onClick={onClose}
                        style={{ 
                            padding: '14px 40px', 
                            borderRadius: '18px', 
                            backgroundColor: '#1e293b', 
                            color: 'white', 
                            border: 'none', 
                            fontWeight: '900', 
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0f172a'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetailsModal;
