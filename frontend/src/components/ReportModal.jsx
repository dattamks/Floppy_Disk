import React from 'react';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isReportModal is set.
export default function ReportModal(V) {
  return V.isReportModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Report post
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
      <span style={{ fontSize: '13px', color: '#656B76' }}>Why are you reporting this post?</span>{' '}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {(V.reportReasonChips || []).map((r, $index) => (
          <React.Fragment key={$index}>
            <button
              onClick={r.onClick}
              style={{
                textAlign: 'left',
                border: `1px solid ${r.active ? '#C7C3F5' : '#E5E7EC'}`,
                background: r.active ? '#ECEBFD' : '#FFFFFF',
                color: r.active ? '#5145E5' : '#15171C',
                borderRadius: '10px',
                padding: '11px 13px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans',sans-serif",
              }}
            >
              {r.label}
            </button>
          </React.Fragment>
        ))}
      </div>{' '}
      <button
        onClick={V.submitReport}
        style={{
          background: '#E5484D',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '12px',
          fontSize: '13.5px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Submit report
      </button>{' '}
    </React.Fragment>
  ) : null;
}
