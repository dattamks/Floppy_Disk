import React from 'react';
import { hov } from '../lib/ui';

// Extracted from AppShell; renders when V.isEmpty is set.
export default function EmptyState(V) {
  return V.isEmpty ? (
    <React.Fragment>
      <div
        style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          color: '#B4B9C2',
          padding: '48px 0',
        }}
      >
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            stroke="#CBD0D8"
            strokeWidth="1.6"
          />
        </svg>
        <span style={{ fontSize: '13.5px' }}>{V.emptyMessage}</span>
      </div>
    </React.Fragment>
  ) : null;
}
