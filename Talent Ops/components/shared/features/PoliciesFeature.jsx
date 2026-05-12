import React, { useState } from 'react';
import { Eye, Download, Edit, Trash2, FileCheck, AlertCircle } from 'lucide-react';
import DataTable from '../../manager/components/UI/DataTable'; // Or the correct shared path for DataTable
import { supabase } from '../../../lib/supabaseClient';
import DocumentViewer from '../DocumentViewer';

const PoliciesFeature = ({ 
    policies, 
    isLoadingPolicies, 
    policyError,
    userRole,
    onDeletePolicy,
    onEditPolicy,
    onAddPolicy,
    addToast
}) => {
    
    // Viewer State
    const [showPolicyPreview, setShowPolicyPreview] = useState(false);
    const [policyPreviewUrl, setPolicyPreviewUrl] = useState('');
    const [policyPreviewFileName, setPolicyPreviewFileName] = useState('');
    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

    const handlePolicyView = async (policy) => {
        try {
            if (!policy.file_url) {
                addToast('No document available to view', 'error');
                return;
            }

            addToast('Opening document...', 'info');

            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                filePath = policy.file_url.split('/').pop();
            }

            // Valid for 1 hour to give enough time to view and download
            const { data, error } = await supabase.storage
                .from('policies')
                .createSignedUrl(filePath, 3600);

            if (error) throw error;
            
            if (data?.signedUrl) {
                setPolicyPreviewUrl(data.signedUrl);
                setPolicyPreviewFileName(policy.name || 'Document');
                setShowPolicyPreview(true);
            } else {
                throw new Error('No signed URL returned');
            }
        } catch (error) {
            console.error('View error:', error);
            addToast(`Could not view document: ${error.message}`, 'error');
        }
    };

    const handlePolicyDownload = async (policy) => {
        try {
            if (!policy.file_url) {
                addToast('No document available to download', 'error');
                return;
            }

            addToast('Preparing download...', 'info');

            let filePath;
            if (policy.file_url.includes('/policies/')) {
                filePath = policy.file_url.split('/policies/')[1];
            } else {
                filePath = policy.file_url.split('/').pop();
            }

            const { data, error } = await supabase.storage
                .from('policies')
                .download(filePath);

            if (error) throw error;

            if (data) {
                const url = window.URL.createObjectURL(data);
                const a = document.createElement('a');
                a.href = url;
                const fileName = policy.name ? `${policy.name}.pdf` : filePath.split('/').pop() || 'policy-document';
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                addToast('Download started', 'success');
            }
        } catch (error) {
            console.error('Download error:', error);
            addToast(`Could not download document: ${error.message}`, 'error');
        }
    };

    const policiesColumns = [
        { header: 'Title', accessor: 'name', sortable: true },
        { header: 'Category', accessor: 'category', sortable: true },
        { header: 'Effective Date', accessor: 'effectiveDate', sortable: true },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => (
                <span style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    backgroundColor: row.status === 'Active' ? '#dcfce7' : '#fee2e2',
                    color: row.status === 'Active' ? '#15803d' : '#b91c1c',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                }}>
                    {row.status}
                </span>
            )
        },
        {
            header: 'View',
            accessor: 'view',
            render: (row) => (
                <button
                    onClick={() => handlePolicyView(row)}
                    style={{
                        padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600,
                        backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#bae6fd'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e0f2fe'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <Eye size={16} /> View
                </button>
            )
        },
        {
            header: 'Download',
            accessor: 'download',
            render: (row) => (
                <button
                    onClick={() => handlePolicyDownload(row)}
                    style={{
                        padding: '8px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600,
                        backgroundColor: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#6d28d9'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#7c3aed'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    <Download size={16} /> Download
                </button>
            )
        }
    ];

    // Conditionally Add Edit/Delete based on Role
    if (userRole === 'executive' || userRole === 'manager') {
        policiesColumns.push({
            header: 'Edit',
            accessor: 'edit',
            render: (row) => (
                <button
                    onClick={() => onEditPolicy && onEditPolicy(row.raw)}
                    style={{
                        padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                        backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fde68a'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fef3c7'; }}
                >
                    <Edit size={14} /> Edit
                </button>
            )
        });
        
        policiesColumns.push({
            header: 'Delete',
            accessor: 'delete',
            render: (row) => (
                <button
                    onClick={() => {
                        setConfirmModal({
                            show: true,
                            title: 'Delete Policy',
                            message: `Are you sure you want to delete the policy "${row.name}"? This action cannot be undone.`,
                            onConfirm: () => onDeletePolicy && onDeletePolicy(row)
                        });
                    }}
                    style={{
                        padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                        backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fecaca'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                >
                    <Trash2 size={14} /> Delete
                </button>
            )
        });
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Premium Header with Mesh Background */}
            <div style={{
                position: 'relative',
                padding: '20px 24px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                marginBottom: '16px',
                overflow: 'hidden',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            }}>
                {/* Decorative Mesh Grid */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                    opacity: 0.5
                }}></div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                            <FileCheck size={14} />
                            <span>Dashboard</span>
                            <span>/</span>
                            <span style={{ color: '#38bdf8' }}>Policies</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                            Policies
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
                            Management portal for your organizational policies
                        </p>
                    </div>

                    {onAddPolicy && (userRole === 'executive' || userRole === 'hr') && (
                        <button
                            onClick={() => onAddPolicy()}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '12px',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#2563eb';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#3b82f6';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                            }}
                        >
                            + Add Policy
                        </button>
                    )}
                </div>
            </div>

            <div style={{
                backgroundColor: 'white', borderRadius: '16px', padding: '24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '400px'
            }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Policies List</h3>
                
                {policyError && (
                    <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '12px', fontSize: '14px' }}>
                        Error loading policies: {policyError}
                    </div>
                )}

                {isLoadingPolicies ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                        <div className="spinner">Loading policies...</div>
                    </div>
                ) : (
                    <DataTable data={policies} columns={policiesColumns} itemsPerPage={8} hoverable striped />
                )}
            </div>

            {/* Document Viewer Modal */}
            {showPolicyPreview && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ width: '95vw', height: '95vh' }}>
                        <DocumentViewer
                            url={policyPreviewUrl}
                            fileName={policyPreviewFileName}
                            onClose={() => {
                                setShowPolicyPreview(false);
                                setPolicyPreviewUrl('');
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Premium Confirmation Modal */}
            {confirmModal.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
                    backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{ 
                        backgroundColor: 'white', 
                        padding: '32px', 
                        borderRadius: '24px', 
                        width: '400px', 
                        maxWidth: '90%', 
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center'
                    }}>
                        <div style={{ 
                            width: '64px', 
                            height: '64px', 
                            borderRadius: '20px', 
                            backgroundColor: '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto'
                        }}>
                            <AlertCircle size={32} color="#ef4444" />
                        </div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>{confirmModal.title}</h3>
                        <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.5', marginBottom: '32px' }}>{confirmModal.message}</p>
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                style={{
                                    flex: 1,
                                    padding: '14px', 
                                    borderRadius: '14px', 
                                    backgroundColor: '#f1f5f9',
                                    color: '#0f172a',
                                    border: '1px solid #e2e8f0', 
                                    cursor: 'pointer', 
                                    fontWeight: 700,
                                    transition: 'all 0.2s'
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    if (confirmModal.onConfirm) confirmModal.onConfirm();
                                    setConfirmModal({ ...confirmModal, show: false });
                                }}
                                style={{
                                    flex: 1,
                                    padding: '14px', 
                                    borderRadius: '14px',
                                    backgroundColor: '#ef4444',
                                    color: 'white', 
                                    border: 'none', 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                                }}
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PoliciesFeature;
