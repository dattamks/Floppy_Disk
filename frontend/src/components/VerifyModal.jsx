import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isVerifyModal is set.
export default function VerifyModal(V) {
  return V.isVerifyModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Verify {V.verifyType}
        </span>
        <button
          onClick={V.backToSettings}
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
      <span style={{ fontSize: '13px', color: theme.textMuted }}>
        Enter the 6-digit code we sent to{' '}
        <strong style={{ color: theme.text }}>{V.verifyTarget}</strong>.
      </span>{' '}
      <input
        value={V.verifyCode}
        onInput={V.setVerifyCode}
        placeholder="6-digit code"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '10px',
          padding: '13px',
          fontSize: '17px',
          letterSpacing: '5px',
          textAlign: 'center',
          outline: 'none',
          fontFamily: "'Space Grotesk',sans-serif",
        }}
      />{' '}
      <button
        onClick={V.confirmVerify}
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
        Verify
      </button>{' '}
      <button
        onClick={V.toastResend}
        style={{
          background: 'none',
          border: 'none',
          color: theme.textMuted,
          cursor: 'pointer',
          fontSize: '12.5px',
        }}
      >
        Resend code
      </button>{' '}
    </React.Fragment>
  ) : null;
}
