import React, { useState, useEffect } from 'react';
import {
    X, Upload, Send, AlertTriangle, CheckCircle2, Clock, Calendar,
    User, FileText, MessageSquare, ChevronRight, ArrowLeft, Star,
    Link as LinkIcon, ExternalLink, Check, Circle, Trash2, Award,
    StickyNote, ThumbsUp, ThumbsDown, Eye, FileCheck, CloudOff, Paperclip, Play,
    FileUp, ArrowRight, AlertCircle
} from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { taskService } from '../../../../services/modules/task';
import TaskNotesModal from '../../../shared/TaskNotesModal';
import DocumentViewer from '../../../shared/DocumentViewer';


const TaskDetailOverlay = ({
    isOpen,
    onClose,
    task,
    onRefresh,
    addToast,
    userId,
    userRole,
    orgId,
    onApprovePhase,
    onRejectPhase,
    onShowAccessRequest,
    onShowAccessReview
}) => {
    const [showNotesModal, setShowNotesModal] = useState(false);

    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [submittingNote, setSubmittingNote] = useState(false);

    // Proof submission state - supports multiple files
    const [proofFiles, setProofFiles] = useState([]);
    const [proofText, setProofText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Issue state
    const [issueText, setIssueText] = useState('');
    const [submittingIssue, setSubmittingIssue] = useState(false);

    // Task Steps state
    const [taskSteps, setTaskSteps] = useState([]);
    const [loadingSteps, setLoadingSteps] = useState(false);
    const [newStepTitle, setNewStepTitle] = useState('');
    const [newStepHours, setNewStepHours] = useState(2);
    const [addingStep, setAddingStep] = useState(false);
    const [editingStepId, setEditingStepId] = useState(null);
    const [editingStepTitle, setEditingStepTitle] = useState('');
    const [skipModalStep, setSkipModalStep] = useState(null);
    const [skipReason, setSkipReason] = useState('');

    // Preview state
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewTitle, setPreviewTitle] = useState('Submitted Proof');
    const [showPreview, setShowPreview] = useState(false);

    // Task Status Indicators
    const isTaskOverdue = (() => {
        if (!task?.due_date) return false;
        const curTime = new Date();
        const datePart = task.due_date;
        const timePart = task.due_time || '23:59:00';
        return curTime > new Date(`${datePart}T${timePart}`);
    })();

    const isTaskLocked = (task?.is_locked || isTaskOverdue || task?.status === 'delayed') &&
        task?.status !== 'completed' &&
        task?.access_status !== 'approved';

    const isAccessPending = task?.access_requested && task?.access_status === 'pending';

    useEffect(() => {
        if (isOpen && task?.id) {
            fetchNotes();
            fetchTaskSteps();
        }
    }, [isOpen, task?.id]);

    const fetchNotes = async () => {
        if (!task?.id) return;
        setLoadingNotes(true);
        try {
            const { data, error } = await supabase
                .from('task_notes')
                .select('*, profiles:author_id(full_name, avatar_url)')
                .eq('task_id', task.id)
                .eq('org_id', orgId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setNotes(data || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !task?.id) return;
        setSubmittingNote(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('task_notes').insert({
                task_id: task.id,
                author_id: user.id,
                note_text: newNote.trim(),
                org_id: orgId
            });
            if (error) throw error;
            setNewNote('');
            fetchNotes();
            addToast?.('Note added successfully', 'success');
        } catch (err) {
            addToast?.('Failed to add note', 'error');
        } finally {
            setSubmittingNote(false);
        }
    };

    // ========== TASK STEPS FUNCTIONS ==========
    const fetchTaskSteps = async () => {
        if (!task?.id) return;
        setLoadingSteps(true);
        try {
            const { data, error } = await supabase
                .from('task_steps')
                .select('*')
                .eq('task_id', task.id)
                .eq('org_id', orgId)
                .order('order_index', { ascending: true });

            if (error) throw error;
            setTaskSteps(data || []);
        } catch (err) {
            console.error('Error fetching task steps:', err);
            setTaskSteps([]);
        } finally {
            setLoadingSteps(false);
        }
    };

    const handleAddStep = async () => {
        if (isTaskLocked) {
            addToast?.('Task is locked.', 'error');
            return;
        }
        if (isAccessPending) {
            addToast?.('Access request pending approval', 'error');
            return;
        }
        if (!newStepTitle.trim() || !task?.id) return;
        setAddingStep(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const currentPhase = task.lifecycle_state || 'requirement_refiner';
            const maxOrder = taskSteps.filter(s => s.stage_id === currentPhase).length;

            const { error } = await supabase.from('task_steps').insert({
                org_id: orgId,
                task_id: task.id,
                stage_id: currentPhase,
                step_title: newStepTitle.trim(),
                order_index: maxOrder,
                status: 'pending',
                created_by: user?.id,
                created_by_role: 'employee',
                estimated_hours: parseFloat(newStepHours) || 2
            });

            if (error) throw error;
            setNewStepTitle('');
            setNewStepHours(2);
            fetchTaskSteps();
            addToast?.('Step added', 'success');
        } catch (err) {
            console.error('Error adding step:', err);
            addToast?.('Failed to add step', 'error');
        } finally {
            setAddingStep(false);
        }
    };

    const handleToggleStepComplete = async (step) => {
        if (isTaskLocked) {
            addToast?.('Task is locked.', 'error');
            return;
        }
        if (isAccessPending) {
            addToast?.('Access request pending approval', 'error');
            return;
        }
        if (step.status === 'skipped') return; // Cannot toggle skipped steps
        const newStatus = step.status === 'completed' ? 'pending' : 'completed';
        try {
            const { error } = await supabase
                .from('task_steps')
                .update({
                    status: newStatus,
                    completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', step.id)
                .eq('org_id', orgId);

            if (error) throw error;
            fetchTaskSteps();
        } catch (err) {
            addToast?.('Failed to update step', 'error');
        }
    };

    const handleSkipStep = async () => {
        if (!skipModalStep || !skipReason.trim()) {
            addToast?.('Please provide a reason for skipping', 'error');
            return;
        }
        try {
            const { error } = await supabase
                .from('task_steps')
                .update({
                    status: 'skipped',
                    skipped_reason: skipReason.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', skipModalStep.id)
                .eq('org_id', orgId);

            if (error) throw error;
            setSkipModalStep(null);
            setSkipReason('');
            fetchTaskSteps();
            addToast?.('Step skipped', 'success');
        } catch (err) {
            addToast?.('Failed to skip step', 'error');
        }
    };

    const handleUpdateStepTitle = async (stepId) => {
        if (!editingStepTitle.trim()) return;
        try {
            const { error } = await supabase
                .from('task_steps')
                .update({
                    step_title: editingStepTitle.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', stepId)
                .eq('org_id', orgId);

            if (error) throw error;
            setEditingStepId(null);
            setEditingStepTitle('');
            fetchTaskSteps();
        } catch (err) {
            addToast?.('Failed to update step', 'error');
        }
    };

    const handleDeleteStep = async (stepId) => {
        try {
            const { error } = await supabase
                .from('task_steps')
                .delete()
                .eq('id', stepId)
                .eq('org_id', orgId);

            if (error) throw error;
            fetchTaskSteps();
            addToast?.('Step deleted', 'success');
        } catch (err) {
            addToast?.('Failed to delete step', 'error');
        }
    };

    // Check if current phase has pending steps (for submission lock)
    // Default to first active phase if lifecycle_state is not set or not in active phases
    const activePhases = task?.phase_validations?.active_phases || ['requirement_refiner'];
    const defaultPhase = activePhases[0] || 'requirement_refiner';
    const currentPhase = (task?.lifecycle_state && activePhases.includes(task.lifecycle_state))
        ? task.lifecycle_state
        : defaultPhase;
    const currentPhaseSteps = taskSteps.filter(s => s.stage_id === currentPhase);
    const hasPendingSteps = currentPhaseSteps.some(s => s.status === 'pending');

    // Calculate hours for current phase
    const totalPhaseHours = currentPhaseSteps.reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);
    const completedPhaseHours = currentPhaseSteps
        .filter(s => s.status === 'completed' || s.status === 'skipped')
        .reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);

    // Calculate total hours for the entire task (all phases)
    const totalTaskHours = taskSteps.reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);
    const totalCompletedHours = taskSteps
        .filter(s => s.status === 'completed' || s.status === 'skipped')
        .reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);

    // Permission helper: Can edit/delete step?
    const canEditStep = (step) => {
        // If created by employee and current user is that employee, they can edit
        if (step.created_by === userId && step.created_by_role === 'employee') return true;
        // Managers can edit any step (we assume if role is not employee, they have higher authority)
        // For now, we allow editing own steps only from employee view
        return step.created_by === userId;
    };

    // Linkify helper
    const linkify = (text) => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    // Helper to safely parse proof URLs (handles JSON arrays or comma-separated strings)
    const getProofUrls = (urlField) => {
        if (!urlField) return [];
        if (Array.isArray(urlField)) return urlField;
        
        const trimmed = urlField.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                return Array.isArray(parsed) ? parsed : [trimmed];
            } catch (e) {
                return [trimmed];
            }
        }
        
        if (trimmed.includes('http')) {
            return trimmed.split(',').map(u => u.trim()).filter(Boolean);
        }
        
        return trimmed ? [trimmed] : [];
    };

    const handleSubmitProof = async () => {
        if (isTaskLocked) {
            addToast?.('Task is locked.', 'error');
            return;
        }
        if (isAccessPending) {
            addToast?.('Access request pending approval', 'error');
            return;
        }
        if (!proofText.trim() && proofFiles.length === 0) {
            addToast?.('Please provide proof text or upload files', 'error');
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const result = await taskService.submitTaskProof({
                task,
                user,
                proofFiles,
                proofText,
                orgId,
                onProgress: setUploadProgress
            });

            const msg = (proofFiles.length > 0 || proofText.includes('http'))
                ? 'Proof submitted successfully'
                : 'Notes added successfully';

            if (result?.pointData?.final_points) {
                addToast?.(`${msg}! Earned: ${result.pointData.final_points} Points`, 'success');
            } else {
                addToast?.(msg, 'success');
            }

            // Explicit log for debugging
            console.log('Proof submission successful:', result);

            setProofFiles([]);
            setProofText('');
            onRefresh?.();
        } catch (err) {
            console.error('Upload error:', err);
            addToast?.('Failed to submit proof: ' + err.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        setProofFiles(prev => [...prev, ...files]);
    };

    const removeFile = (index) => {
        setProofFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Handler to delete a proof file from a phase
    const handleDeleteProof = async (phaseKey, fileUrl) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const phaseVal = task.phase_validations?.[phaseKey];
            if (!phaseVal) return;

            // Parse existing URLs using our safe helper
            const existingUrls = getProofUrls(phaseVal.proof_url);

            // Remove the specified URL
            const updatedUrls = existingUrls.filter(url => url !== fileUrl);

            // Extract file path from URL for storage deletion
            try {
                const urlObj = new URL(fileUrl);
                const pathParts = urlObj.pathname.split('/task-proofs/');
                if (pathParts.length > 1) {
                    const filePath = pathParts[1];
                    // Delete from storage
                    await supabase.storage.from('task-proofs').remove([filePath]);
                }
            } catch (err) {
                console.warn('Could not delete from storage:', err);
            }

            // Update phase_validations
            const updatedValidations = {
                ...(task.phase_validations || {}),
                [phaseKey]: {
                    ...phaseVal,
                    proof_url: updatedUrls.length > 0 ? JSON.stringify(updatedUrls) : null,
                    updated_at: new Date().toISOString()
                }
            };

            // If no files left and no text, remove the phase validation
            if (updatedUrls.length === 0 && !phaseVal.proof_text) {
                delete updatedValidations[phaseKey];
            }

            // Build the update payload
            const updatePayload = {
                phase_validations: updatedValidations,
                updated_at: new Date().toISOString()
            };

            // Revert lifecycle_state if the deleted phase is behind or at the current phase
            const PHASES_ORDER = ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment'];
            const deletedPhaseIndex = PHASES_ORDER.indexOf(phaseKey);
            const currentPhaseIndex = PHASES_ORDER.indexOf(task.lifecycle_state);

            if (deletedPhaseIndex !== -1) {
                if (currentPhaseIndex > deletedPhaseIndex) {
                    // Current phase is ahead of the deleted phase — revert back
                    updatePayload.lifecycle_state = phaseKey;
                    updatePayload.sub_state = 'in_progress';
                } else if (currentPhaseIndex === deletedPhaseIndex) {
                    // Same phase — just reset sub_state
                    updatePayload.sub_state = 'in_progress';
                }
            }

            // Update task in database
            const { error } = await supabase
                .from('tasks')
                .update(updatePayload)
                .eq('id', task.id)
                .eq('org_id', orgId);

            if (error) throw error;

            addToast?.('File deleted successfully', 'success');
            onRefresh?.(); // Refresh the task to show updated data
        } catch (err) {
            console.error('Error deleting proof:', err);
            addToast?.('Failed to delete file', 'error');
        }
    };

    const handleSubmitIssue = async () => {
        if (!issueText.trim()) return;
        setSubmittingIssue(true);
        try {
            const currentIssues = task.issues || '';
            const timestamp = new Date().toLocaleString();
            const newIssue = `[${timestamp}] ${issueText.trim()}`;
            const updatedIssues = currentIssues ? `${currentIssues}\n---\n${newIssue}` : newIssue;

            const { error } = await supabase
                .from('tasks')
                .update({ issues: updatedIssues })
                .eq('id', task.id)
                .eq('org_id', orgId);

            if (error) throw error;
            addToast?.('Issue reported successfully', 'success');
            setIssueText('');
            onRefresh?.();
        } catch (err) {
            addToast?.('Failed to report issue', 'error');
        } finally {
            setSubmittingIssue(false);
        }
    };

    const handleResolveIssues = async () => {
        setSubmittingIssue(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();

            const userName = profile?.full_name || 'Manager';
            const timestamp = new Date().toLocaleString();
            const resolutionEntry = `\n\n[${timestamp}] RESOLVED by ${userName}`;
            const updatedIssues = (task.issues || '') + resolutionEntry;

            const { error } = await supabase
                .from('tasks')
                .update({
                    issues: updatedIssues,
                    updated_at: new Date().toISOString()
                })
                .eq('id', task.id)
                .eq('org_id', orgId);

            if (error) throw error;
            addToast?.('Issues marked as resolved', 'success');
            onRefresh?.();
        } catch (err) {
            console.error('Error resolving issues:', err);
            addToast?.('Failed to resolve issues', 'error');
        } finally {
            setSubmittingIssue(false);
        }
    };

    if (!isOpen || !task) return null;

    const getPriorityColor = (priority) => {
        const colors = {
            critical: { bg: '#fef2f2', text: '#ef4444', border: '#fecaca', iconColor: '#ef4444' },
            high: { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3', iconColor: '#e11d48' },
            medium: { bg: '#fffbeb', text: '#d97706', border: '#fef3c7', iconColor: '#d97706' },
            low: { bg: '#f0fdf4', text: '#16a34a', border: '#dcfce7', iconColor: '#16a34a' }
        };
        return colors[priority?.toLowerCase()] || colors.medium;
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
            in_progress: { bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
            completed: { bg: '#f0fdf4', text: '#166534', dot: '#10b981' },
            on_hold: { bg: '#f5f3ff', text: '#5b21b6', dot: '#8b5cf6' },
            delayed: { bg: '#fff1f2', text: '#9f1239', dot: '#e11d48' }
        };
        return colors[status?.toLowerCase()] || colors.pending;
    };

    const priorityStyle = getPriorityColor(task.priority);

    // Parse requirements from description or use phase_validations
    const requirements = task.phase_validations ? Object.entries(task.phase_validations).map(([key, val]) => ({
        id: key,
        text: val.specs || key.replace(/_/g, ' '),
        completed: val.validated || false
    })) : [];

    // Phase validations for the progress bar - Using original lifecycle phases
    // Filter to show only the phases that are active for this task
    const allPhases = [
        { key: 'requirement_refiner', label: 'Requirement Refiner' },
        { key: 'design_guidance', label: 'Design Guidance' },
        { key: 'build_guidance', label: 'Build Guidance' },
        { key: 'acceptance_criteria', label: 'Acceptance Criteria' },
        { key: 'deployment', label: 'Deployment' }
    ];

    // Get active phases from task - default to all if not specified
    const activePhaseKeys = task.phase_validations?.active_phases || allPhases.map(p => p.key);
    const phases = allPhases.filter(phase => activePhaseKeys.includes(phase.key));

    const getPhaseStatus = (phaseKey) => {
        const validations = task.phase_validations || {};
        const phaseVal = validations[phaseKey];

        if (phaseVal?.validated) return 'completed';
        // Only return 'pending_validation' if there's actually proof submitted
        if (phaseVal?.status === 'pending' && (phaseVal?.proof_url || phaseVal?.proof_text)) return 'pending_validation';
        if (task.lifecycle_state === phaseKey) return 'in_progress';
        return 'pending';
    };

    return (
        <div
            className="no-scrollbar"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#f8fafc',
                zIndex: 1000,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Premium Header */}
            <div style={{
                padding: '16px 40px',
                backgroundColor: 'white',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div
                        onClick={onClose}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        <ArrowLeft size={18} />
                    </div>
                    <div style={{ height: '24px', width: '1px', backgroundColor: '#e2e8f0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
                        <span style={{ color: '#0f172a' }}>Tasks</span>
                        <ChevronRight size={14} />
                        <span>{task.project_name || 'Project'}</span>
                        <ChevronRight size={14} />
                        <span style={{ color: '#0f172a' }}>{task.title?.length > 30 ? task.title.slice(0, 30) + '...' : task.title}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor(task.status).dot }}></div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: getStatusColor(task.status).text, textTransform: 'uppercase' }}>
                            {task.status?.replace('_', ' ')}
                        </span>
                    </div>

                    <button
                        onClick={() => setShowNotesModal(true)}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white',
                            color: '#0f172a',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    >
                        <MessageSquare size={16} /> Task Notes
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#0f172a',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 10px 20px rgba(15, 23, 42, 0.15)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                        Done <X size={16} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                backgroundColor: '#f8fafc',
                padding: '40px 40px',
                backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
                backgroundSize: '24px 24px'
            }}>
                <div style={{
                    maxWidth: '1440px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 400px',
                    gap: '40px',
                    alignItems: 'start'
                }}>
                {/* Left Column - Product Hero & Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    {/* PDP Hero Section */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '48px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
                        border: '1px solid white',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Decorative background element */}
                        <div style={{
                            position: 'absolute',
                            top: '-50px',
                            right: '-50px',
                            width: '200px',
                            height: '200px',
                            borderRadius: '50%',
                            backgroundColor: priorityStyle.bg,
                            opacity: 0.3,
                            filter: 'blur(60px)',
                            zIndex: 0
                        }} />

                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    backgroundColor: '#f1f5f9',
                                    color: '#64748b',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {task.project_name || 'Project Category'}
                                </div>
                                <div style={{
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    backgroundColor: priorityStyle.bg,
                                    color: priorityStyle.text,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <Star size={12} fill="currentColor" /> {task.priority || 'Medium'} Priority
                                </div>
                            </div>

                            <h1 style={{
                                fontSize: '2.5rem',
                                fontWeight: 800,
                                color: '#0f172a',
                                margin: 0,
                                lineHeight: 1.1,
                                letterSpacing: '-0.02em'
                            }}>
                                {task.title}
                            </h1>

                            <div style={{ 
                                marginTop: '24px', 
                                padding: '24px', 
                                backgroundColor: '#f8fafc', 
                                borderRadius: '8px',
                                border: '1px solid #f1f5f9'
                            }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overview</h3>
                                <p style={{
                                    color: '#475569',
                                    lineHeight: 1.6,
                                    fontSize: '1rem',
                                    margin: 0
                                }}>
                                    {task.description || 'This task does not have a detailed description yet.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Time Details Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '16px',
                        marginBottom: '32px'
                    }}>
                        {/* Start Time */}
                        <div style={{ padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Start Date & Time</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontWeight: 600, fontSize: '0.95rem' }}>
                                    <Calendar size={16} strokeWidth={2.5} color="#3b82f6" />
                                    {task?.start_date ? new Date(task.start_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not set'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem', paddingLeft: '24px' }}>
                                    {task?.start_time ? task.start_time.slice(0, 5) : '--:--'}
                                </div>
                            </div>
                        </div>

                        {/* Due Time */}
                        <div style={{ padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Due Date & Time</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontWeight: 600, fontSize: '0.95rem' }}>
                                    <Calendar size={16} strokeWidth={2.5} color="#ef4444" />
                                    {task?.due_date ? new Date(task.due_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not set'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem', paddingLeft: '24px' }}>
                                    {task?.due_time ? task.due_time.slice(0, 5) : '--:--'}
                                </div>
                            </div>
                        </div>

                        {/* Duration */}
                        <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Wait Time</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                {task?.allocated_hours || 0}
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#60a5fa' }}>hrs</span>
                            </div>
                        </div>
                    </div>

                    {/* Reassignment Info */}
                    {(task.reassigned_from || task.reassigned_to || task.access_reason === 'Reassigned by manager') && (
                        <div style={{
                            padding: '16px',
                            backgroundColor: '#fff7ed',
                            borderRadius: '8px',
                            border: '1px solid #fed7aa',
                            marginBottom: '32px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', marginBottom: '8px' }}>
                                <ArrowLeft size={16} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reassignment Info</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#7c2d12', lineHeight: 1.5 }}>
                                {task.reassigned_from && <div><strong>From:</strong> {task.reassigned_from_name || 'Unknown'}</div>}
                                {task.reassigned_to && <div><strong>To:</strong> {task.reassigned_to_name || 'Unknown'}</div>}
                                {!task.reassigned_from && !task.reassigned_to && task.access_reason === 'Reassigned by manager' && <div><strong>Status:</strong> Reassigned by manager</div>}
                                {task.reassigned_at && <div><strong>On:</strong> {new Date(task.reassigned_at).toLocaleString()}</div>}
                            </div>
                        </div>
                    )}

                    {/* Overdue/Locked Info */}
                    {(isTaskLocked || task.access_requested) && (
                        <div style={{
                            padding: '16px',
                            backgroundColor: isTaskLocked ? '#fee2e2' : '#f0f9ff',
                            borderRadius: '8px',
                            border: `1px solid ${isTaskLocked ? '#fecaca' : '#bae6fd'}`,
                            marginBottom: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <p style={{ fontWeight: 700, color: isTaskLocked ? '#991b1b' : '#0369a1', margin: 0 }}>
                                    {isTaskLocked ? 'Task Locked - Overdue' : 'Access Request Pending'}
                                </p>
                                <p style={{ fontSize: '0.85rem', color: isTaskLocked ? '#7f1d1d' : '#075985', margin: '4px 0 0 0' }}>
                                    {isTaskLocked
                                        ? (task.access_requested ? 'Access request is pending approval.' : 'This task is locked because the deadline has passed.')
                                        : `Access requested for: ${task.access_reason || 'N/A'}`
                                    }
                                </p>
                            </div>
                            {isTaskLocked && !task.access_requested && (
                                <button
                                    onClick={() => onShowAccessRequest?.(task)}
                                    style={{ padding: '8px 16px', backgroundColor: '#991b1b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Request Access
                                </button>
                            )}
                            {task.access_requested && (userRole === 'manager' || userRole === 'team_lead') && task.access_status === 'pending' && (
                                <button
                                    onClick={() => onShowAccessReview?.(task)}
                                    style={{ padding: '8px 16px', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Review Request
                                </button>
                            )}
                        </div>
                    )}



                    {/* Execution Steps - Replaces old Requirements */}
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                📝 Execution Steps
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: '#64748b',
                                    backgroundColor: '#f1f5f9',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                }}>
                                    Full Task Overview
                                </span>
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {totalTaskHours > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '100px', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${(totalCompletedHours / totalTaskHours) * 100}%`,
                                                height: '100%',
                                                backgroundColor: '#3b82f6',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                                {totalCompletedHours}/{totalTaskHours}h Total
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Overall Progress</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {loadingSteps ? (
                                <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading steps...</p>
                                </div>
                            ) : phases.map((phase) => {
                                const phaseSteps = taskSteps.filter(s => s.stage_id === phase.key);
                                const isCurrentPhase = phase.key === currentPhase;
                                const phaseTotalHours = phaseSteps.reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);
                                const phaseCompletedHours = phaseSteps
                                    .filter(s => s.status === 'completed' || s.status === 'skipped')
                                    .reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);

                                return (
                                    <div key={phase.key} style={{
                                        backgroundColor: isCurrentPhase ? '#ffffff' : '#f8fafc',
                                        borderRadius: '8px',
                                        border: `1px solid ${isCurrentPhase ? '#3b82f6' : '#e2e8f0'}`,
                                        padding: '16px',
                                        boxShadow: isCurrentPhase ? '0 4px 6px -1px rgba(59, 130, 246, 0.1)' : 'none'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: isCurrentPhase ? '#2563eb' : '#475569', margin: 0 }}>
                                                    {phase.label}
                                                </h4>
                                                {isCurrentPhase && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', backgroundColor: '#3b82f6', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Active</span>
                                                )}
                                            </div>
                                            {phaseTotalHours > 0 && (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                                    {phaseCompletedHours}/{phaseTotalHours}h
                                                </span>
                                            )}
                                        </div>

                                        {/* Show Phase Guidance/Notes if available */}
                                        {task.phase_validations?.[phase.key]?.description && (
                                            <div style={{
                                                backgroundColor: '#f8fafc',
                                                padding: '10px 12px',
                                                borderRadius: '4px',
                                                marginBottom: '12px',
                                                fontSize: '0.85rem',
                                                color: '#334155',
                                                whiteSpace: 'pre-wrap',
                                                borderLeft: '3px solid #94a3b8'
                                            }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes / Requirements</div>
                                                {linkify(task.phase_validations[phase.key].description)}
                                            </div>
                                        )}

                                        {task.phase_validations?.[phase.key]?.guidance_doc_url && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: '#eff6ff',
                                                padding: '10px 12px',
                                                borderRadius: '4px',
                                                border: '1px solid #bfdbfe',
                                                marginBottom: '12px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                    <FileText size={16} color="#3b82f6" />
                                                    <span style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {task.phase_validations[phase.key].guidance_doc_name || 'Guidance Document'}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setPreviewUrl(task.phase_validations[phase.key].guidance_doc_url);
                                                        setPreviewTitle(`${phase.label} Guidance`);
                                                        setShowPreview(true);
                                                    }}
                                                    style={{
                                                        fontSize: '0.8rem',
                                                        color: '#2563eb',
                                                        fontWeight: 600,
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                                    onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                                >
                                                    View Spec <Eye size={14} />
                                                </button>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {phaseSteps.length > 0 ? (
                                                phaseSteps.map((step, idx) => (
                                                    <div key={step.id} style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '10px',
                                                        padding: '8px 10px',
                                                        backgroundColor: step.status === 'completed' ? '#ecfdf5' : step.status === 'skipped' ? '#f1f5f9' : (isCurrentPhase ? '#ffffff' : '#f8fafc'),
                                                        borderRadius: '4px',
                                                        border: `1px solid ${step.status === 'completed' ? '#a7f3d0' : step.status === 'skipped' ? '#cbd5e1' : (isCurrentPhase ? '#e2e8f0' : 'transparent')}`
                                                    }}>
                                                        {/* Status Toggle */}
                                                        <div
                                                            onClick={() => !isTaskLocked && isCurrentPhase && step.status !== 'skipped' && handleToggleStepComplete(step)}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '5px',
                                                                backgroundColor: step.status === 'completed' ? '#10b981' : step.status === 'skipped' ? '#94a3b8' : '#e2e8f0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0,
                                                                cursor: (!isTaskLocked && isCurrentPhase && step.status !== 'skipped') ? 'pointer' : 'default',
                                                                opacity: (!isTaskLocked && isCurrentPhase) ? 1 : 0.6
                                                            }}
                                                        >
                                                            {step.status === 'completed' && <Check size={12} color="white" />}
                                                            {step.status === 'skipped' && <X size={12} color="white" />}
                                                        </div>

                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                                <span style={{
                                                                    color: step.status === 'completed' ? '#64748b' : step.status === 'skipped' ? '#94a3b8' : '#1e293b',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 500,
                                                                    textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
                                                                    opacity: isCurrentPhase ? 1 : 0.8
                                                                }}>
                                                                    {step.step_title}
                                                                </span>
                                                                {step.created_by_role === 'manager' && (
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#8b5cf6', backgroundColor: '#ede9fe', padding: '1px 4px', borderRadius: '3px' }}>M</span>
                                                                )}
                                                                {parseFloat(step.estimated_hours) > 0 && (
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>
                                                                        {step.estimated_hours}h
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {step.status === 'skipped' && step.skipped_reason && (
                                                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', fontStyle: 'italic', marginBottom: 0 }}>
                                                                    Reason: {step.skipped_reason}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {isCurrentPhase && step.status === 'pending' && canEditStep(step) && editingStepId !== step.id && !isTaskLocked && !isAccessPending && (
                                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                                <button
                                                                    onClick={() => { setEditingStepId(step.id); setEditingStepTitle(step.step_title); }}
                                                                    style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, color: '#3b82f6', backgroundColor: '#eff6ff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                                                >Edit</button>
                                                                <button
                                                                    onClick={() => { setSkipModalStep(step); setSkipReason(''); }}
                                                                    style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, color: '#f59e0b', backgroundColor: '#fef3c7', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                                                >Skip</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>No steps for this phase.</p>
                                            )}

                                            {isCurrentPhase && !isTaskLocked && !isAccessPending && (
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                                    <input
                                                        type="text"
                                                        value={newStepTitle}
                                                        onChange={(e) => setNewStepTitle(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStep()}
                                                        placeholder="+ Add step to active phase..."
                                                        style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8rem', outline: 'none' }}
                                                    />
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                        <input
                                                            type="number"
                                                            value={newStepHours}
                                                            onChange={(e) => setNewStepHours(e.target.value)}
                                                            min="0.5"
                                                            step="0.5"
                                                            style={{ width: '45px', padding: '6px 4px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                                                        />
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>h</span>
                                                    </div>
                                                    <button
                                                        onClick={handleAddStep}
                                                        disabled={addingStep || !newStepTitle.trim()}
                                                        style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
                                                    >Add</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Progress Timeline */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '32px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
                        border: '1px solid white'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Workflow Timeline</h3>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                                {phases.filter(p => getPhaseStatus(p.key) === 'completed').length} / {phases.length} Phases Completed
                            </div>
                        </div>

                        <div style={{ display: 'flex', position: 'relative', paddingBottom: '20px', overflowX: 'auto', gap: '8px' }} className="no-scrollbar">
                            {/* Track line */}
                            <div style={{
                                position: 'absolute',
                                top: '24px',
                                left: '40px',
                                right: '40px',
                                height: '2px',
                                backgroundColor: '#f1f5f9',
                                zIndex: 0
                            }} />

                            {phases.map((phase, index) => {
                                const status = getPhaseStatus(phase.key);
                                const isCurrent = task.lifecycle_state === phase.key;
                                
                                return (
                                    <div key={phase.key} style={{
                                        flex: 1,
                                        minWidth: '160px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '16px',
                                        position: 'relative',
                                        zIndex: 1,
                                        opacity: status === 'pending' ? 0.6 : 1
                                    }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '50%',
                                            backgroundColor: status === 'completed' ? '#10b981' : (isCurrent ? '#3b82f6' : 'white'),
                                            border: `2px solid ${status === 'completed' ? '#10b981' : (isCurrent ? '#3b82f6' : '#e2e8f0')}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: (status === 'completed' || isCurrent) ? 'white' : '#94a3b8',
                                            boxShadow: isCurrent ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
                                            transition: 'all 0.3s'
                                        }}>
                                            {status === 'completed' ? <Check size={20} strokeWidth={3} /> : (isCurrent ? <Play size={18} fill="white" /> : <Circle size={10} fill="#e2e8f0" />)}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{
                                                fontSize: '0.85rem',
                                                fontWeight: 800,
                                                color: isCurrent ? '#3b82f6' : '#0f172a',
                                                margin: 0,
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {phase.label}
                                            </p>
                                            <p style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                color: status === 'completed' ? '#10b981' : (isCurrent ? '#3b82f6' : '#94a3b8'),
                                                marginTop: '4px',
                                                textTransform: 'uppercase',
                                                textAlign: 'center'
                                            }}>
                                                {status.replace('_', ' ')}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Validation Proofs - "Specifications" Area */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '32px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
                        border: '1px solid white'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                                <FileCheck size={24} />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Verified Submissions</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {Object.entries(task.phase_validations || {}).filter(([k, v]) => v.proof_url || v.proof_text).length > 0 ? (
                                Object.entries(task.phase_validations || {}).map(([key, val]) => {
                                    if (!val.proof_url && !val.proof_text) return null;
                                    const phase = phases.find(p => p.key === key) || { label: key };
                                    
                                    return (
                                        <div key={key} style={{
                                            padding: '24px',
                                            backgroundColor: '#f8fafc',
                                            borderRadius: '8px',
                                            border: '1px solid #f1f5f9',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: val.validated ? '#10b981' : '#f59e0b' }} />
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{phase.label}</span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', backgroundColor: 'white', padding: '4px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                    {val.validated ? 'VERIFIED' : 'AWAITING REVIEW'}
                                                </span>
                                            </div>

                                            {val.proof_url && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {getProofUrls(val.proof_url).map((url, i) => (
                                                        <div 
                                                            key={i} 
                                                            onClick={() => { 
                                                                const fileName = url.split('/').pop().split('?')[0];
                                                                setPreviewUrl(url); 
                                                                setPreviewTitle(fileName); 
                                                                setShowPreview(true); 
                                                            }}
                                                            style={{
                                                                padding: '12px 16px',
                                                                backgroundColor: 'white',
                                                                borderRadius: '6px',
                                                                border: '1px solid #e2e8f0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none'; }}
                                                        >
                                                            <Paperclip size={14} color="#3b82f6" />
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>View Attachment</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {val.proof_text && (
                                                <div style={{ 
                                                    padding: '16px', 
                                                    backgroundColor: 'white', 
                                                    borderRadius: '6px', 
                                                    border: '1px solid #e2e8f0',
                                                    fontSize: '0.85rem',
                                                    color: '#334155',
                                                    lineHeight: 1.6,
                                                    whiteSpace: 'pre-wrap'
                                                }}>
                                                    {val.proof_text}
                                                </div>
                                            )}

                                            {(userRole === 'manager' || userRole === 'team_lead' || userRole === 'org_admin') && val.status === 'pending' && (
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                                    <button
                                                        onClick={() => onRejectPhase?.(key)}
                                                        style={{
                                                            flex: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '6px',
                                                            padding: '12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #fee2e2',
                                                            backgroundColor: 'white',
                                                            color: '#ef4444',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <ThumbsDown size={14} /> Reject
                                                    </button>
                                                    <button
                                                        onClick={() => onApprovePhase?.(key)}
                                                        style={{
                                                            flex: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '6px',
                                                            padding: '12px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            backgroundColor: '#10b981',
                                                            color: 'white',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <ThumbsUp size={14} /> Approve
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '48px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
                                    <CloudOff size={40} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                                    <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500, margin: 0 }}>No submissions verified yet.</p>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Submit your work in the right sidebar to start the review process.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Actions Sidebar */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '32px',
                    border: '1px solid white',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.04)',
                    height: 'fit-content',
                    position: 'sticky',
                    top: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}>
                    {/* Primary Status Card */}
                    <div style={{
                        padding: '20px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>EXPECTED TIME</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{task.estimated_hours || 0}h</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>SPENT TIME</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#3b82f6' }}>{task.spent_hours || 0}h</span>
                        </div>
                    </div>

                    {/* Submit Work Section */}
                    {(userId === task.assigned_to || userRole === 'manager' || userRole === 'org_admin' || userRole === 'team_lead') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Upload size={20} strokeWidth={2.5} /> Submission Hub
                            </h3>

                            {isAccessPending || isTaskLocked ? (
                                <div style={{
                                    padding: '24px',
                                    backgroundColor: isAccessPending ? '#f0f9ff' : '#fff1f2',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    border: `1px solid ${isAccessPending ? '#bae6fd' : '#fecdd3'}`
                                }}>
                                    {isTaskLocked ? <Clock size={32} color="#e11d48" style={{ margin: '0 auto 12px auto' }} /> : <AlertTriangle size={32} color="#0369a1" style={{ margin: '0 auto 12px auto' }} />}
                                    <p style={{ fontSize: '1rem', fontWeight: 800, color: isAccessPending ? '#0c4a6e' : '#9f1239', margin: 0 }}>
                                        {isTaskLocked ? 'Task Locked' : 'Pending Access'}
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: isAccessPending ? '#0369a1' : '#be123c', marginTop: '8px', lineHeight: 1.5 }}>
                                        {isTaskLocked
                                            ? 'The submission window has closed. Need more time? Request access extension.'
                                            : 'Your access to this task is currently under review.'}
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* Upload Dropzone */}
                                    <div
                                        onClick={() => document.getElementById('proofFileInput').click()}
                                        style={{
                                            border: '2px dashed #e2e8f0',
                                            borderRadius: '8px',
                                            padding: '32px 20px',
                                            textAlign: 'center',
                                            backgroundColor: '#fafafa',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = '#fafafa'; }}
                                    >
                                        <input id="proofFileInput" type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '6px',
                                            backgroundColor: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 12px auto',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                            color: '#3b82f6'
                                        }}>
                                            <FileUp size={24} />
                                        </div>
                                        <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Select Files</p>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>PDF, ZIP, Images (Max 50MB)</p>
                                    </div>

                                    {/* File List */}
                                    {proofFiles.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {proofFiles.map((f, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #dbeafe' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                                        <FileText size={16} color="#3b82f6" />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e40af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{f.name}</span>
                                                    </div>
                                                    <X size={16} color="#3b82f6" style={{ cursor: 'pointer' }} onClick={() => removeFile(i)} />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <textarea
                                        value={proofText}
                                        onChange={(e) => setProofText(e.target.value)}
                                        placeholder="Add a comment or link your repo..."
                                        style={{
                                            width: '100%',
                                            padding: '16px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.9rem',
                                            resize: 'none',
                                            minHeight: '100px',
                                            backgroundColor: '#f8fafc',
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                        onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                                        onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    />

                                    <button
                                        onClick={handleSubmitProof}
                                        disabled={uploading || hasPendingSteps || (!proofText.trim() && proofFiles.length === 0)}
                                        style={{
                                            width: '100%',
                                            padding: '16px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: (!hasPendingSteps && (proofText.trim() || proofFiles.length > 0)) ? '#0f172a' : '#e2e8f0',
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: '1rem',
                                            cursor: (!hasPendingSteps && (proofText.trim() || proofFiles.length > 0)) ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '12px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { if (e.currentTarget.style.cursor === 'pointer') e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                                    >
                                        {uploading ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                                Sending...
                                            </div>
                                        ) : hasPendingSteps ? '🔒 Finish Active Steps' : (
                                            <>Submit for Review <ArrowRight size={18} /></>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ height: '1px', backgroundColor: '#f1f5f9' }} />

                    {/* Team Insights & Issues */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={20} color="#f59e0b" /> Issues & Blockers
                            </h3>
                            {task.issues && <span style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>ACTIVE</span>}
                        </div>

                        {task.issues ? (
                            <div style={{ padding: '16px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                                <p style={{ fontSize: '0.85rem', color: '#9f1239', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>{task.issues}</p>
                                {['manager', 'team_lead', 'org_admin'].includes(userRole) && !task.issues.includes('RESOLVED') && (
                                    <button 
                                        onClick={handleResolveIssues}
                                        style={{ marginTop: '12px', width: '100%', padding: '8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        Mark as Resolved
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>No blockers reported yet.</p>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                value={issueText}
                                onChange={e => setIssueText(e.target.value)}
                                placeholder="Any blockers?"
                                style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none' }}
                                onFocus={e => e.currentTarget.style.borderColor = '#f59e0b'}
                                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                            />
                            <button 
                                onClick={handleSubmitIssue}
                                disabled={!issueText.trim() || submittingIssue}
                                style={{ padding: '12px 20px', borderRadius: '6px', border: 'none', backgroundColor: issueText.trim() ? '#f59e0b' : '#e2e8f0', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                            >
                                Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

            {/* Skip Reason Modal */}
            {
                skipModalStep && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000
                    }}>
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '24px',
                            width: '400px',
                            maxWidth: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                        }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                                Skip Step
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
                                Please provide a reason for skipping: <strong>"{skipModalStep.step_title}"</strong>
                            </p>
                            <textarea
                                value={skipReason}
                                onChange={(e) => setSkipReason(e.target.value)}
                                placeholder="e.g., Out of scope for this sprint..."
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    resize: 'vertical',
                                    marginBottom: '16px',
                                    outline: 'none'
                                }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setSkipModalStep(null); setSkipReason(''); }}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#f1f5f9',
                                        color: '#64748b',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSkipStep}
                                    disabled={!skipReason.trim()}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: skipReason.trim() ? '#f59e0b' : '#e2e8f0',
                                        color: skipReason.trim() ? 'white' : '#94a3b8',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        border: 'none',
                                        cursor: skipReason.trim() ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    Confirm Skip
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Task Notes Modal */}
            <TaskNotesModal
                isOpen={showNotesModal}
                onClose={() => setShowNotesModal(false)}
                task={task}
                userId={userId}
                userRole={userRole}
                orgId={orgId}
                addToast={addToast}
                canAddNote={
                    ['manager', 'team_lead', 'executive', 'org_admin'].includes(userRole) ||
                    task?.assigned_to === userId
                }
            />

            {/* Proof Preview Overlay */}
            {
                showPreview && previewUrl && (
                    <DocumentViewer
                        url={previewUrl}
                        fileName={previewTitle}
                        onClose={() => { setShowPreview(false); setPreviewUrl(null); }}
                    />
                )
            }
        </div >
    );
};


export default TaskDetailOverlay;
