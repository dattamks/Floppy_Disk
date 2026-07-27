import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isNewFolderModal is set.
export default function NewFolderModal(V) {
  return V.isNewFolderModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          New folder
        </span>
        <button
          onClick={V.closeModal}
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
      <input
        value={V.newFolderName}
        onInput={V.setNewFolderName}
        placeholder="Folder name"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '9px',
          padding: '11px 13px',
          fontSize: '13.5px',
          outline: 'none',
          fontFamily: "'IBM Plex Sans',sans-serif",
        }}
      />{' '}
      <button
        onClick={V.createFolder}
        style={{
          background: theme.brand,
          color: theme.white,
          border: 'none',
          borderRadius: '10px',
          padding: '12px',
          fontSize: '13.5px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Create folder
      </button>{' '}
    </React.Fragment>
  ) : null;
}
