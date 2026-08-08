import React from 'react';

// Full-screen image viewer. Click the backdrop, the ✕, or press Esc to close.
// Used from the note editor and the note preview so images open large.
export default function Lightbox({ src, alt, onClose }) {
  React.useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div
      data-testid="note-lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, cursor: 'zoom-out',
        background: 'rgba(8,8,10,0.88)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 4vw',
        animation: 'fd-lb-in .14s ease-out',
      }}
    >
      <style>{'@keyframes fd-lb-in{from{opacity:0}to{opacity:1}}'}</style>
      <img
        src={src}
        alt={alt || ''}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12, boxShadow: '0 30px 90px rgba(0,0,0,0.55)', cursor: 'default' }}
      />
      <button
        aria-label="Close preview"
        onClick={onClose}
        style={{
          position: 'fixed', top: 18, right: 20, width: 40, height: 40, borderRadius: 11, border: 'none',
          background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  );
}
