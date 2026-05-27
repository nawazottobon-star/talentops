import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const UserAvatar = ({ user, size = 40, showStatus = false, isTyping = false, style = {} }) => {
    // Handle cases where user object might have different shapes (e.g. from profiles join vs flat object)
    const avatarUrl = user?.avatar_url || user?.profiles?.avatar_url || user?.avatar;
    const fullName = user?.full_name || user?.profiles?.full_name || user?.name || user?.email || user?.profiles?.email || '?';

    // Safely get initials
    const initials = (fullName[0] || '?').toUpperCase();

    const [resolvedUrl, setResolvedUrl] = useState('');
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let active = true;
        setHasError(false); // Reset error state when avatar changes
        const resolve = async () => {
            if (!avatarUrl || typeof avatarUrl !== 'string') {
                if (active) setResolvedUrl('');
                return;
            }

            const supabaseUrlMarker = '/storage/v1/object/public/';
            if (!avatarUrl.includes(supabaseUrlMarker)) {
                if (active) setResolvedUrl(avatarUrl);
                return;
            }

            try {
                const parts = avatarUrl.split(supabaseUrlMarker);
                if (parts.length < 2) {
                    if (active) setResolvedUrl(avatarUrl);
                    return;
                }

                const bucketAndPath = parts[1];
                const firstSlashIndex = bucketAndPath.indexOf('/');
                if (firstSlashIndex === -1) {
                    if (active) setResolvedUrl(avatarUrl);
                    return;
                }

                const bucket = bucketAndPath.substring(0, firstSlashIndex);
                const encodedPath = bucketAndPath.substring(firstSlashIndex + 1);
                const path = decodeURIComponent(encodedPath);

                const { data, error } = await supabase.storage
                    .from(bucket)
                    .createSignedUrl(path, 3600); // 1 hour expiry

                if (error) {
                    console.warn('Failed to sign avatar URL (non-fatal):', error.message);
                    if (active) setResolvedUrl(avatarUrl);
                    return;
                }

                if (active) setResolvedUrl(data.signedUrl);
            } catch (e) {
                console.error('Error signing avatar URL:', e);
                if (active) setResolvedUrl(avatarUrl);
            }
        };

        resolve();
        return () => { active = false; };
    }, [avatarUrl]);

    return (
        <div
            className="user-avatar"
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                borderRadius: '50%',
                background: user?.is_admin ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(10, Math.floor(size * 0.4)) + 'px',
                fontWeight: '600',
                color: user?.is_admin ? 'white' : '#64748b',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
                ...style
            }}
        >
            {resolvedUrl && !hasError ? (
                <img
                    src={resolvedUrl}
                    alt={fullName}
                    onError={() => setHasError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                initials
            )}

            {showStatus && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: Math.max(8, Math.floor(size * 0.25)) + 'px',
                    height: Math.max(8, Math.floor(size * 0.25)) + 'px',
                    borderRadius: '50%',
                    background: user?.status === 'online' ? '#22c55e' : '#9ca3af',
                    border: '2px solid white'
                }} />
            )}
        </div>
    );
};

export default UserAvatar;
