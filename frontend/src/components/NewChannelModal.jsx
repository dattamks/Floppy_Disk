import React from 'react';
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
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A909B' }}
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
      <label style={{ fontSize: '12px', color: '#656B76', fontWeight: '500' }}>
        Channel name
        <input
          value={V.newChName}
          onInput={V.setNewChName}
          placeholder="e.g. Product Design"
          style={{
            width: '100%',
            marginTop: '5px',
            background: '#F1F2F5',
            border: '1px solid #E5E7EC',
            borderRadius: '9px',
            padding: '10px 12px',
            fontSize: '13.5px',
            outline: 'none',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        />
      </label>{' '}
      <label style={{ fontSize: '12px', color: '#656B76', fontWeight: '500' }}>
        Handle
        <input
          value={V.newChHandle}
          onInput={V.setNewChHandle}
          placeholder="@handle (optional)"
          style={{
            width: '100%',
            marginTop: '5px',
            background: '#F1F2F5',
            border: '1px solid #E5E7EC',
            borderRadius: '9px',
            padding: '10px 12px',
            fontSize: '13.5px',
            outline: 'none',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        />
      </label>{' '}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <span style={{ fontSize: '12px', color: '#656B76', fontWeight: '500' }}>Category</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {(V.newChCatChips || []).map((cat, $index) => (
            <React.Fragment key={$index}>
              <button
                onClick={cat.onClick}
                style={{
                  border: `1px solid ${cat.active ? '#5145E5' : '#E5E7EC'}`,
                  background: cat.active ? '#5145E5' : '#FFFFFF',
                  color: cat.active ? '#fff' : '#656B76',
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
          background: '#5145E5',
          color: '#fff',
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
