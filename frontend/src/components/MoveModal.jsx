import React from 'react';
import { theme } from '../lib/theme';

// Pick a destination folder for a file/folder move. Renders when V.isMoveModal
// is set. Destinations come from V.moveDestOptions (root + folders, indented by
// depth, with the moved item's own subtree already excluded).
export default function MoveModal(V) {
  return V.isMoveModal ? (
    <React.Fragment>
      {' '}
      <span
        style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
      >
        Move “{V.moveTargetName}” to…
      </span>{' '}
      <div
        style={{
          maxHeight: '300px',
          overflowY: 'auto',
          border: `1px solid ${theme.border}`,
          borderRadius: '11px',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {(V.moveDestOptions || []).map((o, i) => (
          <button
            key={i}
            onClick={() => V.setMoveDest(o.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              textAlign: 'left',
              padding: '9px 11px',
              paddingLeft: `${11 + o.depth * 16}px`,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              background: o.active ? theme.brandBg : 'transparent',
              color: o.active ? theme.brand : theme.text,
              fontSize: '13.5px',
              fontWeight: o.active ? '600' : '400',
              fontFamily: "'IBM Plex Sans',sans-serif",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
            {o.name}
          </button>
        ))}
      </div>{' '}
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
          onClick={V.submitMove}
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
          Move here
        </button>
      </div>{' '}
    </React.Fragment>
  ) : null;
}
