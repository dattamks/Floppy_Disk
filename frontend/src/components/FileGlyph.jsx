import React from 'react';

// A distinct icon per file type, tinted with the type colour, plus the short
// extension label underneath. Used on document cards/rows in place of the old
// single generic doc icon.
export default function FileGlyph({ kind, color, ext, size = 30 }) {
  const s = size;
  const stroke = { stroke: color, strokeWidth: 1.7, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  let body;
  if (kind === 'sheet') {
    body = (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" {...stroke} />
        <path d="M3.5 9.5h17M3.5 14.5h17M9 4.5v15M15 4.5v15" {...stroke} strokeWidth="1.3" />
      </svg>
    );
  } else if (kind === 'slides') {
    body = (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <rect x="3.5" y="4.5" width="17" height="12" rx="2" {...stroke} />
        <path d="M12 16.5v3M8.5 19.5h7M7 8.5h6M7 11.5h9" {...stroke} strokeWidth="1.4" />
      </svg>
    );
  } else if (kind === 'code') {
    body = (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M8.5 8.5 4.5 12l4 3.5M15.5 8.5 19.5 12l-4 3.5M13.5 6.5l-3 11" {...stroke} strokeWidth="1.9" />
      </svg>
    );
  } else if (kind === 'archive') {
    body = (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z" {...stroke} />
        <path d="M12 4v16M12 8.5l4-1.8" {...stroke} strokeWidth="1.4" />
      </svg>
    );
  } else {
    // Document page (pdf / word / text / unknown) - folded corner + lines.
    body = (
      <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M6.5 3.5h7l4 4v13a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" {...stroke} />
        <path d="M13.5 3.5v4h4" {...stroke} />
        <path d="M9 12.5h6M9 15.5h4" {...stroke} strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      {body}
      {ext ? (
        <span
          style={{
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.4px',
            color,
            fontFamily: "'IBM Plex Mono','IBM Plex Sans',monospace",
          }}
        >
          {ext}
        </span>
      ) : null}
    </div>
  );
}
