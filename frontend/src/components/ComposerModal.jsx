import React from 'react';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isComposerModal is set.
export default function ComposerModal(V) {
  return V.isComposerModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          New post
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: V.composerColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: '700',
            fontSize: '12.5px',
            fontFamily: "'Space Grotesk',sans-serif",
          }}
        >
          {V.composerInitials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>{V.composerChannelName}</span>
          <span style={{ fontSize: '11px', color: '#9AA1AC' }}>Posting as admin</span>
        </div>
      </div>{' '}
      <textarea
        value={V.composerText}
        onInput={V.setComposerText}
        rows="4"
        placeholder="Share an update with your subscribers…"
        style={{
          background: '#F1F2F5',
          border: '1px solid #E5E7EC',
          borderRadius: '10px',
          padding: '12px',
          fontSize: '13.5px',
          outline: 'none',
          resize: 'none',
          fontFamily: "'IBM Plex Sans',sans-serif",
        }}
      />{' '}
      {V.composerHasAttach ? (
        <React.Fragment>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              background: '#ECEBFD',
              border: '1px solid #C7C3F5',
              borderRadius: '9px',
              padding: '9px 12px',
              fontSize: '12.5px',
              color: '#5145E5',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="#5145E5" strokeWidth="1.6" />
              <path d="M3 16l5-4 4 3 3-2 6 5" stroke="#5145E5" strokeWidth="1.6" />
            </svg>
            {V.composerAttachLabel} attached
            <button
              onClick={V.clearAttach}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#5145E5',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 5l14 14M19 5L5 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </React.Fragment>
      ) : null}{' '}
      <div style={{ display: 'flex', gap: '8px' }}>
        {' '}
        <button
          onClick={V.attachPhoto}
          style={{
            flex: '1',
            background: '#F7F8FA',
            border: '1px solid #E5E7EC',
            borderRadius: '9px',
            padding: '9px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="#656B76" strokeWidth="1.6" />
            <circle cx="8.5" cy="9" r="1.5" stroke="#656B76" strokeWidth="1.6" />
            <path d="M3 16l5-4 4 3 3-2 6 5" stroke="#656B76" strokeWidth="1.6" />
          </svg>
          Photo
        </button>{' '}
        <button
          onClick={V.attachVideo}
          style={{
            flex: '1',
            background: '#F7F8FA',
            border: '1px solid #E5E7EC',
            borderRadius: '9px',
            padding: '9px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="6" width="14" height="12" rx="2" stroke="#656B76" strokeWidth="1.6" />
            <path
              d="M17 10l4-3v10l-4-3"
              stroke="#656B76"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          Video
        </button>{' '}
        <button
          onClick={V.attachFile}
          style={{
            flex: '1',
            background: '#F7F8FA',
            border: '1px solid #E5E7EC',
            borderRadius: '9px',
            padding: '9px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
              stroke="#656B76"
              strokeWidth="1.5"
            />
          </svg>
          File
        </button>{' '}
      </div>{' '}
      <button
        onClick={V.submitPost}
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
        Post
      </button>{' '}
    </React.Fragment>
  ) : null;
}
