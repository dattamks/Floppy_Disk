import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isUploadModal is set.
export default function UploadModal(V) {
  return V.isUploadModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Upload files
        </span>
        <button
          onClick={V.closeModal}
          aria-label="Close"
          title="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted2 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 5l14 14M19 5L5 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>{' '}
      <div
        onClick={V.browseFiles}
        role="button"
        tabIndex={0}
        aria-label="Choose files to upload"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            V.browseFiles();
          }
        }}
        style={{
          border: `1.5px dashed ${theme.brandBorder}`,
          borderRadius: '13px',
          padding: '30px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '9px',
          cursor: 'pointer',
          background: theme.brandBgSoft,
        }}
        {...hov({ borderColor: theme.brand, background: theme.brandBgSoft2 })}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 16V4M7 9l5-5 5 5M4 20h16"
            stroke={theme.brand}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: '13.5px', color: theme.text, fontWeight: '500' }}>
          Drag & drop files here
        </span>
        <span style={{ fontSize: '12px', color: theme.textFaint }}>
          or click to browse your device
        </span>
      </div>{' '}
      <input
        ref={V.fileInputRef}
        onChange={V.onFilesPicked}
        type="file"
        multiple
        style={{ display: 'none' }}
      />{' '}
      {(V.uploadQueueView || []).map((u, $index) => (
        <React.Fragment key={$index}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: theme.text,
              }}
            >
              <span>{u.name}</span>
              <span style={{ color: theme.textFaint }}>{u.progress}%</span>
            </div>
            <div
              style={{
                height: '6px',
                borderRadius: '6px',
                background: theme.border,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: theme.brand,
                  width: `${u.progress}%`,
                  borderRadius: '6px',
                }}
              />
            </div>
          </div>
        </React.Fragment>
      ))}{' '}
    </React.Fragment>
  ) : null;
}
