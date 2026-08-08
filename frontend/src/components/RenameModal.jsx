import React from 'react';
import { theme } from '../lib/theme';

// Rename a file or folder. Renders when V.isRenameModal is set.
export default function RenameModal(V) {
  return V.isRenameModal ? (
    <React.Fragment>
      {' '}
      <span
        style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
      >
        Rename {V.renameIsFolder ? 'folder' : 'file'}
      </span>{' '}
      <input
        value={V.renameName}
        onInput={V.setRenameName}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') V.submitRename();
        }}
        placeholder="Name"
        style={{
          width: '100%',
          padding: '11px 13px',
          border: `1px solid ${theme.border}`,
          borderRadius: '10px',
          fontSize: '14px',
          fontFamily: "'IBM Plex Sans',sans-serif",
          color: theme.text,
          outline: 'none',
        }}
      />{' '}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px' }}>
        <button
          onClick={V.closeModal}
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            color: theme.text,
            borderRadius: '9px',
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={V.submitRename}
          style={{
            background: theme.brand,
            color: theme.onAccent,
            border: 'none',
            borderRadius: '9px',
            padding: '9px 17px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Rename
        </button>
      </div>{' '}
    </React.Fragment>
  ) : null;
}
