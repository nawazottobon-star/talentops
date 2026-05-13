import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Image, File, AlertCircle, Download, ExternalLink, X, Eye, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';

/**
 * DocumentViewer Component
 * Adaptive-themed document preview that inherits the app's CSS variables.
 * Handles images (with zoom), PDFs, and links-based fallback for other types.
 * Supports single strings, JSON-encoded arrays, or comma-separated URLs.
 */
const DocumentViewer = ({ url, fileName, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [imageZoom, setImageZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Normalize URL: handle string, JSON string, or array
    let urls = [];
    if (Array.isArray(url)) {
        urls = url;
    } else if (typeof url === 'string') {
        const trimmedUrl = url.trim();
        if (trimmedUrl.startsWith('[') && trimmedUrl.endsWith(']')) {
            try {
                urls = JSON.parse(trimmedUrl);
            } catch (e) {
                urls = [trimmedUrl];
            }
        } else if (trimmedUrl.includes(',') && trimmedUrl.includes('http')) {
            urls = trimmedUrl.split(',').map(u => u.trim()).filter(Boolean);
        } else if (trimmedUrl) {
            urls = [trimmedUrl];
        }
    }

    const currentUrl = urls[activeIndex];
    const totalFiles = urls.length;
    const currentFileName = totalFiles > 1 ? `${fileName || 'Document'} (${activeIndex + 1}/${totalFiles})` : (fileName || 'Document');

    // ESC key handler
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose?.();
            if (e.key === 'ArrowLeft' && activeIndex > 0) {
                setActiveIndex(i => i - 1); setLoading(true); setError(false);
            }
            if (e.key === 'ArrowRight' && activeIndex < totalFiles - 1) {
                setActiveIndex(i => i + 1); setLoading(true); setError(false);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [activeIndex, totalFiles, onClose]);

    if (!currentUrl || urls.length === 0) return null;

    // Detect file type
    const getFileType = (fileUrl) => {
        if (!fileUrl) return 'other';
        // Remove query params and brackets before checking extension
        const cleanUrl = fileUrl.split('?')[0].replace(/[\[\]"]/g, '');
        const lower = cleanUrl.toLowerCase();
        
        if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(lower)) return 'image';
        if (/\.pdf$/i.test(lower)) return 'pdf';
        if (/\.(doc|docx)$/i.test(lower)) return 'word';
        if (/\.(xls|xlsx)$/i.test(lower)) return 'excel';
        if (/\.(ppt|pptx)$/i.test(lower)) return 'powerpoint';
        if (/\.(txt|md|csv|log|json)$/i.test(lower)) return 'text';
        if (/\.(zip|rar|7z|tar|gz)$/i.test(lower)) return 'archive';
        return 'other';
    };

    const fileType = getFileType(currentUrl);

    const getFileTypeLabel = () => {
        const labels = {
            image: 'Image Preview', pdf: 'PDF Document', word: 'Word Document',
            excel: 'Excel Spreadsheet', powerpoint: 'Presentation',
            text: 'Text File', archive: 'Archive', other: 'File'
        };
        return labels[fileType] || 'File';
    };

    const getFileIcon = () => {
        if (fileType === 'image') return <Image size={22} />;
        return <FileText size={22} />;
    };

    const getAccentColor = () => {
        const colors = {
            image: '#10b981', pdf: '#ef4444', word: '#3b82f6',
            excel: '#22c55e', powerpoint: '#f97316', text: '#8b5cf6',
            archive: '#eab308', other: '#6b7280'
        };
        return colors[fileType] || '#6b7280';
    };

    const accent = getAccentColor();

    const navigateFile = (direction) => {
        const newIndex = activeIndex + direction;
        if (newIndex >= 0 && newIndex < totalFiles) {
            setActiveIndex(newIndex);
            setLoading(true);
            setError(false);
            setImageZoom(1);
        }
    };

    const handleDownloadBtnClick = async (e) => {
        if (e) e.preventDefault();
        try {
            const response = await fetch(currentUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            
            // Make sure it has an extension
            let downloadName = currentFileName || 'download';
            if (!downloadName.includes('.')) {
                const ext = fileType === 'pdf' ? '.pdf' : 
                            fileType === 'word' ? '.docx' : 
                            fileType === 'excel' ? '.xlsx' : '';
                downloadName = downloadName + ext;
            }
            a.download = downloadName;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Download failed, falling back to new tab:', err);
            // Fallback: Use a direct link download if possible, else new tab
            const link = document.createElement('a');
            link.href = currentUrl;
            link.target = '_blank';
            link.download = currentFileName || '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const renderContent = () => {
        if (error) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100%', gap: '20px', padding: '40px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid rgba(239,68,68,0.2)'
                    }}>
                        <AlertCircle size={36} color="#ef4444" />
                    </div>
                    <div>
                        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                            Unable to preview this file
                        </p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.6 }}>
                            This file may be private or the preview service is unavailable. Please download it to view.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button onClick={handleDownloadBtnClick}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '12px 24px', borderRadius: '12px',
                                background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                                color: 'white', textDecoration: 'none', fontWeight: 600,
                                fontSize: '0.9rem', transition: 'all 0.2s', border: 'none', cursor: 'pointer',
                                boxShadow: `0 4px 14px ${accent}40`
                            }}>
                            <Download size={18} /> Download File
                        </button>
                        <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '12px 24px', borderRadius: '12px',
                                border: '1px solid var(--border)', color: 'var(--text-primary)',
                                textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
                                backgroundColor: 'var(--background)', transition: 'all 0.2s'
                            }}>
                            <ExternalLink size={18} /> Open in New Tab
                        </a>
                    </div>
                </div>
            );
        }

        // Loading overlay
        const loadingOverlay = loading ? (
            <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--background)', zIndex: 5
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '40px', height: '40px', border: `3px solid var(--border)`,
                        borderTopColor: accent, borderRadius: '50%',
                        animation: 'docViewerSpin 0.8s linear infinite'
                    }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        Loading preview...
                    </span>
                    <button 
                        onClick={() => { setLoading(false); setError(true); }}
                        style={{ fontSize: '0.75rem', color: accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Skip preview & download
                    </button>
                </div>
            </div>
        ) : null;

        if (fileType === 'image') {
            return (
                <div style={{
                    width: '100%', height: '100%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    overflow: 'auto', position: 'relative',
                    backgroundColor: 'var(--background)'
                }}>
                    {loadingOverlay}
                    <img
                        key={currentUrl}
                        src={currentUrl}
                        alt={currentFileName}
                        style={{
                            maxWidth: `${100 * imageZoom}%`,
                            maxHeight: `${100 * imageZoom}%`,
                            objectFit: 'contain',
                            display: loading ? 'none' : 'block',
                            transition: 'max-width 0.3s, max-height 0.3s',
                            borderRadius: '8px'
                        }}
                        onLoad={() => setLoading(false)}
                        onError={() => { setError(true); setLoading(false); }}
                    />
                </div>
            );
        }

        if (fileType === 'pdf') {
            // Use Google Docs Viewer for reliable inline PDF rendering
            // NOTE: This only works for public URLs. 
            const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(currentUrl)}&embedded=true`;
            return (
                <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: 'var(--background)' }}>
                    {loadingOverlay}
                    <iframe
                        key={currentUrl}
                        src={googleDocsUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="PDF Preview"
                        onLoad={() => {
                            // If it stays "loading" for too long, it might be a private URL issue
                            setTimeout(() => setLoading(false), 2000);
                        }}
                        onError={() => { setError(true); setLoading(false); }}
                    />
                </div>
            );
        }

        // For Word/Excel/PowerPoint — try Microsoft Office Online viewer first,
        // fallback to Google Docs Viewer
        if (['word', 'excel', 'powerpoint'].includes(fileType)) {
            const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(currentUrl)}`;
            return (
                <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: 'var(--background)' }}>
                    {loadingOverlay}
                    <iframe
                        key={currentUrl}
                        src={officeUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Document Preview"
                        onLoad={() => {
                            setTimeout(() => setLoading(false), 2500);
                        }}
                        onError={() => {
                            // Fallback — try Google Docs viewer
                            setError(true);
                            setLoading(false);
                        }}
                    />
                </div>
            );
        }

        // For all other file types — show a clean download/open prompt
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: '24px', padding: '40px'
            }}>
                <div style={{
                    width: '100px', height: '100px', borderRadius: '24px',
                    background: `linear-gradient(135deg, ${accent}15, ${accent}08)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${accent}30`
                }}>
                    <File size={44} color={accent} />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        {getFileTypeLabel()}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        This file type cannot be previewed in the browser. Download it to view.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleDownloadBtnClick}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '14px 28px', borderRadius: '12px',
                            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                            color: 'white', textDecoration: 'none', fontWeight: 600,
                            fontSize: '0.95rem', boxShadow: `0 4px 14px ${accent}40`,
                            border: 'none', cursor: 'pointer'
                        }}>
                        <Download size={18} /> Download
                    </button>
                    <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '14px 28px', borderRadius: '12px',
                            border: '1px solid var(--border)', color: 'var(--text-primary)',
                            textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem',
                            backgroundColor: 'var(--surface)'
                        }}>
                        <ExternalLink size={18} /> Open in Tab
                    </a>
                </div>
            </div>
        );
    };

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 3000, backdropFilter: 'blur(8px)',
                animation: 'docViewerFadeIn 0.2s ease-out'
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <style>{`
                @keyframes docViewerSpin { to { transform: rotate(360deg); } }
                @keyframes docViewerFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes docViewerSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <div style={{
                backgroundColor: 'var(--surface)',
                borderRadius: isFullscreen ? '0' : '20px',
                width: isFullscreen ? '100%' : '92%',
                height: isFullscreen ? '100%' : '90%',
                maxWidth: isFullscreen ? '100%' : '1200px',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: isFullscreen ? 'none' : '0 25px 60px rgba(0, 0, 0, 0.3)',
                border: isFullscreen ? 'none' : '1px solid var(--border)',
                animation: 'docViewerSlideUp 0.25s ease-out',
                transition: 'all 0.3s ease'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: 'var(--surface)',
                    minHeight: '64px'
                }}>
                    {/* Left: File info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '12px',
                            background: `linear-gradient(135deg, ${accent}18, ${accent}08)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: accent, flexShrink: 0,
                            border: `1px solid ${accent}25`
                        }}>
                            {getFileIcon()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{
                                fontSize: '1rem', fontWeight: 700, margin: 0,
                                color: 'var(--text-primary)', letterSpacing: '-0.01em',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                                {currentFileName}
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {getFileTypeLabel()}
                            </span>
                        </div>
                    </div>

                    {/* Center: Pagination */}
                    {totalFiles > 1 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            backgroundColor: 'var(--background)', padding: '4px 6px',
                            borderRadius: '10px', border: '1px solid var(--border)'
                        }}>
                            <button
                                onClick={() => navigateFile(-1)}
                                disabled={activeIndex === 0}
                                style={{
                                    background: 'none', border: 'none',
                                    color: activeIndex === 0 ? 'var(--text-secondary)' : accent,
                                    cursor: activeIndex === 0 ? 'default' : 'pointer',
                                    padding: '6px', borderRadius: '8px', display: 'flex',
                                    opacity: activeIndex === 0 ? 0.4 : 1,
                                    transition: 'all 0.15s'
                                }}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span style={{
                                fontSize: '0.85rem', fontWeight: 600,
                                color: 'var(--text-primary)', minWidth: '50px', textAlign: 'center'
                            }}>
                                {activeIndex + 1} / {totalFiles}
                            </span>
                            <button
                                onClick={() => navigateFile(1)}
                                disabled={activeIndex === totalFiles - 1}
                                style={{
                                    background: 'none', border: 'none',
                                    color: activeIndex === totalFiles - 1 ? 'var(--text-secondary)' : accent,
                                    cursor: activeIndex === totalFiles - 1 ? 'default' : 'pointer',
                                    padding: '6px', borderRadius: '8px', display: 'flex',
                                    opacity: activeIndex === totalFiles - 1 ? 0.4 : 1,
                                    transition: 'all 0.15s'
                                }}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginLeft: '16px' }}>
                        {/* Zoom controls for images */}
                        {fileType === 'image' && !loading && !error && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '2px',
                                backgroundColor: 'var(--background)', padding: '4px',
                                borderRadius: '10px', border: '1px solid var(--border)'
                            }}>
                                <button
                                    onClick={() => setImageZoom(z => Math.max(0.5, z - 0.25))}
                                    disabled={imageZoom <= 0.5}
                                    style={{
                                        background: 'none', border: 'none', padding: '6px',
                                        borderRadius: '6px', display: 'flex', cursor: 'pointer',
                                        color: 'var(--text-secondary)', transition: 'all 0.15s'
                                    }}
                                >
                                    <ZoomOut size={16} />
                                </button>
                                <span style={{
                                    fontSize: '0.78rem', fontWeight: 600,
                                    color: 'var(--text-primary)', minWidth: '36px', textAlign: 'center'
                                }}>
                                    {Math.round(imageZoom * 100)}%
                                </span>
                                <button
                                    onClick={() => setImageZoom(z => Math.min(3, z + 0.25))}
                                    disabled={imageZoom >= 3}
                                    style={{
                                        background: 'none', border: 'none', padding: '6px',
                                        borderRadius: '6px', display: 'flex', cursor: 'pointer',
                                        color: 'var(--text-secondary)', transition: 'all 0.15s'
                                    }}
                                >
                                    <ZoomIn size={16} />
                                </button>
                            </div>
                        )}

                        {/* Fullscreen toggle */}
                        <button
                            onClick={() => setIsFullscreen(f => !f)}
                            style={{
                                background: 'none', border: '1px solid var(--border)',
                                padding: '8px', borderRadius: '10px', display: 'flex',
                                cursor: 'pointer', color: 'var(--text-secondary)',
                                backgroundColor: 'var(--background)', transition: 'all 0.15s'
                            }}
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>

                        {/* Download */}
                        <button
                            onClick={handleDownloadBtnClick}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px', borderRadius: '10px',
                                background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                                color: 'white', textDecoration: 'none',
                                fontSize: '0.85rem', fontWeight: 600,
                                boxShadow: `0 2px 8px ${accent}30`,
                                transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                            }}
                        >
                            <Download size={16} /> Download
                        </button>

                        {/* Close */}
                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px', borderRadius: '10px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--background)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer', display: 'flex',
                                transition: 'all 0.15s'
                            }}
                            title="Close (ESC)"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div style={{
                    flex: 1, overflow: 'hidden', position: 'relative',
                    backgroundColor: 'var(--background)'
                }}>
                    {/* Lateral Navigation Overlay */}
                    {totalFiles > 1 && (
                        <>
                            {activeIndex > 0 && (
                                <div style={{
                                    position: 'absolute', left: '16px', top: '50%',
                                    transform: 'translateY(-50%)', zIndex: 10
                                }}>
                                    <button
                                        onClick={() => navigateFile(-1)}
                                        style={{
                                            width: '44px', height: '44px', borderRadius: '50%',
                                            backgroundColor: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                </div>
                            )}
                            {activeIndex < totalFiles - 1 && (
                                <div style={{
                                    position: 'absolute', right: '16px', top: '50%',
                                    transform: 'translateY(-50%)', zIndex: 10
                                }}>
                                    <button
                                        onClick={() => navigateFile(1)}
                                        style={{
                                            width: '44px', height: '44px', borderRadius: '50%',
                                            backgroundColor: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {renderContent()}
                    </div>
                </div>



            </div>
        </div>
    );
};

export default DocumentViewer;
