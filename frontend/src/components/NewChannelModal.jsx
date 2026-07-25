import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isNewChannelModal is set.
export default function NewChannelModal(V) {
  return V.isNewChannelModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Create channel
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
      <label style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
        Channel name
        <input
          value={V.newChName}
          onInput={V.setNewChName}
          placeholder="e.g. Product Design"
          style={{
            width: '100%',
            marginTop: '5px',
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '9px',
            padding: '10px 12px',
            fontSize: '13.5px',
            outline: 'none',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        />
      </label>{' '}
      <label style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
        Handle
        <input
          value={V.newChHandle}
          onInput={V.setNewChHandle}
          placeholder="@handle (optional)"
          style={{
            width: '100%',
            marginTop: '5px',
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '9px',
            padding: '10px 12px',
            fontSize: '13.5px',
            outline: 'none',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        />
      </label>{' '}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
          Category
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {(V.newChCatChips || []).map((cat, $index) => (
            <React.Fragment key={$index}>
              <button
                onClick={cat.onClick}
                style={{
                  border: `1px solid ${cat.active ? theme.brand : theme.border}`,
                  background: cat.active ? theme.brand : theme.white,
                  color: cat.active ? theme.white : theme.textMuted,
                  borderRadius: '20px',
                  padding: '6px 13px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
              >
                {cat.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>{' '}
      <button
        onClick={V.createChannel}
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
        Create channel
      </button>{' '}
    </React.Fragment>
  ) : null;
}
