import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isAuth is set.
export default function AuthScreen(V) {
  return V.isAuth ? (
    <React.Fragment>
      {' '}
      <div
        style={{
          flex: '1',
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        {' '}
        <div
          style={{
            width: '100%',
            maxWidth: '360px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {' '}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
          >
            {' '}
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="4" fill={theme.brand} />
              <path
                d="M8 3v5h6.5M8.5 20v-6h7v6"
                stroke={theme.white}
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <rect x="10" y="4" width="3" height="3.5" rx="0.5" fill={theme.white} />
            </svg>{' '}
            <span
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontWeight: '700',
                fontSize: '20px',
              }}
            >
              {V.authTitle}
            </span>{' '}
            <span style={{ fontSize: '13px', color: theme.textMuted, textAlign: 'center' }}>
              {V.authSubtitle}
            </span>{' '}
          </div>{' '}
          {V.verifyBanner ? (
            <div
              style={{
                background: V.verifyBanner === 'ok' ? theme.surface : theme.dangerBg,
                border: `1px solid ${V.verifyBanner === 'ok' ? theme.border : theme.dangerBorder3}`,
                color: V.verifyBanner === 'ok' ? theme.text : theme.dangerDark,
                borderRadius: '9px',
                padding: '10px 12px',
                fontSize: '12.5px',
                textAlign: 'center',
              }}
            >
              {V.verifyBanner === 'ok'
                ? 'Email verified — you can sign in.'
                : 'This verification link is invalid or has expired.'}
            </div>
          ) : null}{' '}
          {V.authIsRegister ? (
            <React.Fragment>
              {' '}
              <input
                value={V.authName}
                onInput={V.setAuthName}
                placeholder="Full name"
                style={{
                  background: theme.white,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
              />{' '}
              <input
                value={V.authDob}
                onInput={V.setAuthDob}
                type="date"
                aria-label="Date of birth"
                title="Date of birth (must be 18+)"
                style={{
                  background: theme.white,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  color: theme.textMuted,
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
              />{' '}
            </React.Fragment>
          ) : null}{' '}
          {V.authNeedsEmail ? (
            <React.Fragment>
              {' '}
              <input
                value={V.authEmail}
                onInput={V.setAuthEmail}
                placeholder="Email address"
                style={{
                  background: theme.white,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
              />{' '}
            </React.Fragment>
          ) : null}{' '}
          {V.authNeedsPassword ? (
            <React.Fragment>
              {' '}
              <input
                value={V.authPassword}
                onInput={V.setAuthPassword}
                type="password"
                placeholder="Password"
                style={{
                  background: theme.white,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
              />{' '}
            </React.Fragment>
          ) : null}{' '}
          {V.authIsReset ? (
            <React.Fragment>
              {' '}
              <input
                value={V.authPassword}
                onInput={V.setAuthPassword}
                type="password"
                placeholder="New password"
                autoFocus
                style={{
                  background: theme.white,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
              />{' '}
              <input
                value={V.authPassword2}
                onInput={V.setAuthPassword2}
                type="password"
                placeholder="Confirm new password"
                style={{
                  background: theme.white,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
              />{' '}
            </React.Fragment>
          ) : null}{' '}
          {V.hasAuthError ? (
            <React.Fragment>
              <div
                style={{
                  background: theme.dangerBg,
                  border: `1px solid ${theme.dangerBorder3}`,
                  color: theme.dangerDark,
                  borderRadius: '9px',
                  padding: '9px 12px',
                  fontSize: '12.5px',
                }}
              >
                {V.authError}
              </div>
            </React.Fragment>
          ) : null}{' '}
          <button
            onClick={V.authPrimary}
            style={{
              background: theme.brand,
              color: theme.white,
              border: 'none',
              borderRadius: '10px',
              padding: '13px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans',sans-serif",
            }}
            {...hov({ background: theme.brandDark })}
          >
            {V.authPrimaryLabel}
          </button>{' '}
          {V.authIsLogin ? (
            <React.Fragment>
              {' '}
              {V.showDemoCreds ? (
                <div
                  style={{
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    padding: '8px 11px',
                    fontSize: '11.5px',
                    color: theme.textMuted,
                    textAlign: 'center',
                  }}
                >
                  Demo: <strong style={{ color: theme.text }}>aiden.rivera@floppy.disk</strong> /{' '}
                  <strong style={{ color: theme.text }}>password</strong>
                </div>
              ) : null}{' '}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                {' '}
                <button
                  onClick={V.gotoForgot}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.textMuted,
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '13px',
                  }}
                >
                  Forgot password?
                </button>{' '}
                <button
                  onClick={V.gotoRegister}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.brand,
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                >
                  Create account
                </button>{' '}
              </div>{' '}
            </React.Fragment>
          ) : null}{' '}
          {V.authIsForgot || V.authIsReset ? (
            <React.Fragment>
              {' '}
              <div style={{ textAlign: 'center', fontSize: '13px', color: theme.textMuted }}>
                Remembered it?{' '}
                <button
                  onClick={V.gotoLogin}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.brand,
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                >
                  Back to sign in
                </button>
              </div>{' '}
            </React.Fragment>
          ) : null}{' '}
          {V.authIsRegister ? (
            <React.Fragment>
              {' '}
              <div style={{ textAlign: 'center', fontSize: '13px', color: theme.textMuted }}>
                Already have an account?{' '}
                <button
                  onClick={V.gotoLogin}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.brand,
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                >
                  Sign in
                </button>
              </div>{' '}
            </React.Fragment>
          ) : null}{' '}
        </div>{' '}
      </div>{' '}
    </React.Fragment>
  ) : null;
}
