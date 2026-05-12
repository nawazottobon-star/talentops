import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export const usePolicies = (orgId, addToast) => {
    const [policies, setPolicies] = useState([]);
    const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
    const [policyError, setPolicyError] = useState(null);

    const fetchPolicies = useCallback(async () => {
        if (!orgId) return;

        try {
            console.log('Fetching policies from Supabase...');
            setIsLoadingPolicies(true);
            setPolicyError(null);

            const { data, error } = await supabase
                .from('policies')
                .select('*')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching policies:', error);
                setPolicyError(error.message);
                return;
            }

            if (data) {
                const transformedPolicies = data.map(policy => ({
                    id: policy.id,
                    name: policy.title || 'Untitled Policy',
                    category: policy.category || 'General',
                    effectiveDate: policy.effective_date ? new Date(policy.effective_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A',
                    status: policy.status || 'Active',
                    file_url: policy.file_url,
                    raw: policy
                }));
                setPolicies(transformedPolicies);
            }
        } catch (err) {
            console.error('Unexpected error fetching policies:', err);
            setPolicyError(err.message);
        } finally {
            setIsLoadingPolicies(false);
        }
    }, [orgId]);

    useEffect(() => {
        fetchPolicies();
    }, [fetchPolicies]);

    const handleDeletePolicy = async (policy) => {
        try {
            const filePathStart = policy.file_url.indexOf('/policies/');
            if (filePathStart === -1) throw new Error("Invalid file URL format.");
            const filePath = window.decodeURIComponent(policy.file_url.substring(filePathStart + '/policies/'.length));

            const { error: storageError } = await supabase.storage.from('policies').remove([filePath]);
            if (storageError) throw new Error('Failed to delete policy document from storage.');

            const { error: dbError } = await supabase
                .from('policies')
                .delete()
                .eq('id', policy.id)
                .eq('org_id', orgId);
            if (dbError) throw new Error('Failed to delete policy record from database.');

            setPolicies(prev => prev.filter(p => p.id !== policy.id));
            addToast('Policy deleted successfully', 'success');
        } catch (error) {
            console.error('Delete policy error:', error);
            addToast(`Error deleting policy: ${error.message}`, 'error');
        }
    };

    return {
        policies,
        isLoadingPolicies,
        policyError,
        fetchPolicies,
        handleDeletePolicy
    };
};
