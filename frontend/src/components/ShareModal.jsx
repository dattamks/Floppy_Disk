import React from 'react';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isShareModal is set.
export default function ShareModal(V) {
  return V.isShareModal ? (
    <React.Fragment>
      {' '}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontWeight: '600',
            fontSize: '16px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Share "{V.activeFile.name}"
        </span>
        {V.shareLinkUrl ? (
          <input
            readOnly
            value={V.shareLinkUrl}
            aria-label="Share link"
            onFocus={(e) => e.target.select()}
            style={{
              marginLeft: '8px',
              fontSize: '11px',
              padding: '4px 8px',
              border: '1px solid #E5E7EC',
              borderRadius: '6px',
              maxWidth: '170px',
              color: '#5145E5',
            }}
          />
        ) : null}
        <button
          onClick={V.closeModal}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#8A909B',
            flex: '0 0 auto',
          }}
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
      <div style={{ display: 'flex', gap: '8px' }}>
        {' '}
        <button
          onClick={V.saveToCloud}
          style={{
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '7px',
            background: '#F7F8FA',
            border: '1px solid #E5E7EC',
            borderRadius: '11px',
            padding: '13px 6px',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 18 18H7Z"
              stroke="#5145E5"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M12 11v5m0-5l-2 2m2-2l2 2"
              stroke="#5145E5"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '500', color: '#15171C' }}>
            Save to cloud
          </span>
        </button>{' '}
        <button
          onClick={V.downloadDevice}
          style={{
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '7px',
            background: '#F7F8FA',
            border: '1px solid #E5E7EC',
            borderRadius: '11px',
            padding: '13px 6px',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"
              stroke="#5145E5"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '500', color: '#15171C' }}>Download</span>
        </button>{' '}
        <button
          onClick={V.copyLink}
          style={{
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '7px',
            background: '#F7F8FA',
            border: '1px solid #E5E7EC',
            borderRadius: '11px',
            padding: '13px 6px',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 15l6-6M10.5 6.5l1-1a4 4 0 0 1 6 6l-1 1M13.5 17.5l-1 1a4 4 0 0 1-6-6l1-1"
              stroke="#5145E5"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '500', color: '#15171C' }}>
            {V.copyLabel}
          </span>
        </button>{' '}
      </div>{' '}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div
          style={{
            flex: '1',
            minWidth: '0',
            background: '#F1F2F5',
            border: '1px solid #E5E7EC',
            borderRadius: '9px',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#656B76',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {V.activeFile.shareUrl}
        </div>
        <button
          onClick={V.copyLink}
          style={{
            background: '#5145E5',
            color: '#fff',
            border: 'none',
            borderRadius: '9px',
            padding: '0 16px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          {V.copyLabel}
        </button>
      </div>{' '}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={V.setAccessRestricted}
          style={{
            flex: '1',
            background: V.restrictedBg,
            color: V.restrictedColor,
            border: `1px solid ${V.restrictedBorder}`,
            borderRadius: '9px',
            padding: '9px',
            fontSize: '12.5px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Restricted
        </button>
        <button
          onClick={V.setAccessAnyone}
          style={{
            flex: '1',
            background: V.anyoneBg,
            color: V.anyoneColor,
            border: `1px solid ${V.anyoneBorder}`,
            borderRadius: '9px',
            padding: '9px',
            fontSize: '12.5px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Anyone with link
        </button>
      </div>{' '}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={V.setPermView}
          style={{
            flex: '1',
            background: V.viewBg,
            color: V.viewColor,
            border: `1px solid ${V.viewBorder}`,
            borderRadius: '9px',
            padding: '9px',
            fontSize: '12.5px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Can view
        </button>
        <button
          onClick={V.setPermEdit}
          style={{
            flex: '1',
            background: V.editBg,
            color: V.editColor,
            border: `1px solid ${V.editBorder}`,
            borderRadius: '9px',
            padding: '9px',
            fontSize: '12.5px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Can edit
        </button>
      </div>{' '}
      <input
        value={V.shareEmailInput}
        onChange={V.setEmailInput}
        onKeyDown={V.addEmail}
        placeholder="Add people by email, press Enter"
        style={{
          background: '#F1F2F5',
          border: '1px solid #E5E7EC',
          borderRadius: '9px',
          padding: '10px 12px',
          fontSize: '12.5px',
          color: '#15171C',
          outline: 'none',
          fontFamily: "'IBM Plex Sans',sans-serif",
        }}
      />{' '}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
        {(V.shareEmailChips || []).map((chip, $index) => (
          <React.Fragment key={$index}>
            <div
              style={{
                background: '#EEF0F4',
                border: '1px solid #E5E7EC',
                borderRadius: '20px',
                padding: '5px 7px 5px 11px',
                fontSize: '11.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {chip.email}
              <button
                onClick={chip.onRemove}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9AA1AC',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: '2px',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
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
        ))}
      </div>{' '}
      <button
        onClick={V.closeModal}
        style={{
          background: '#5145E5',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '11px',
          fontSize: '13.5px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
        {...hov({ background: '#4238CC' })}
      >
        Done
      </button>{' '}
    </React.Fragment>
  ) : null;
}
