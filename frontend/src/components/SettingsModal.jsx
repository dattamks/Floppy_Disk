import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';
import ApiKeysPanel from './ApiKeysPanel';

// Extracted from the design view; renders when V.isSettingsModal is set.
export default function SettingsModal(V) {
  return V.isSettingsModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Settings
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
      <div
        style={{
          display: 'flex',
          background: theme.surface3,
          borderRadius: '9px',
          padding: '3px',
          gap: '2px',
        }}
      >
        {' '}
        <button
          onClick={V.setSettingsProfile}
          style={{
            flex: '1',
            border: 'none',
            borderRadius: '7px',
            padding: '7px',
            fontSize: '12.5px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
            background: V.stProfileBg,
            color: V.stProfileColor,
          }}
        >
          Profile
        </button>{' '}
        <button
          onClick={V.setSettingsAccount}
          style={{
            flex: '1',
            border: 'none',
            borderRadius: '7px',
            padding: '7px',
            fontSize: '12.5px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
            background: V.stAccountBg,
            color: V.stAccountColor,
          }}
        >
          Account
        </button>{' '}
        <button
          onClick={V.setSettingsSecurity}
          style={{
            flex: '1',
            border: 'none',
            borderRadius: '7px',
            padding: '7px',
            fontSize: '12.5px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
            background: V.stSecurityBg,
            color: V.stSecurityColor,
          }}
        >
          Security
        </button>{' '}
        <button
          onClick={V.setSettingsDeveloper}
          style={{
            flex: '1',
            border: 'none',
            borderRadius: '7px',
            padding: '7px',
            fontSize: '12.5px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
            background: V.stDeveloperBg,
            color: V.stDeveloperColor,
          }}
        >
          Developer
        </button>{' '}
      </div>{' '}
      {V.stIsProfile ? (
        <React.Fragment>
          {' '}
          <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
            <div
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '50%',
                background: theme.brand,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.white,
                fontFamily: "'Space Grotesk',sans-serif",
                fontWeight: '700',
                fontSize: '22px',
              }}
            >
              A
            </div>
            <button
              onClick={V.toastPhoto}
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: '9px',
                padding: '9px 14px',
                fontSize: '12.5px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Change photo
            </button>
          </div>{' '}
          <label style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
            Display name
            <input
              value={V.profileName}
              onInput={V.setProfileName}
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
            Username
            <input
              value={V.profileUsername}
              onInput={V.setProfileUsername}
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
            Bio
            <textarea
              value={V.profileBio}
              onInput={V.setProfileBio}
              rows="3"
              style={{
                width: '100%',
                marginTop: '5px',
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: '9px',
                padding: '10px 12px',
                fontSize: '13.5px',
                outline: 'none',
                resize: 'none',
                fontFamily: "'IBM Plex Sans',sans-serif",
              }}
            />
          </label>{' '}
          <button
            onClick={V.saveProfile}
            style={{
              background: theme.brand,
              color: theme.white,
              border: 'none',
              borderRadius: '9px',
              padding: '11px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Save profile
          </button>{' '}
        </React.Fragment>
      ) : null}{' '}
      {V.stIsAccount ? (
        <React.Fragment>
          {' '}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
              Email
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  flex: '1',
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '9px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {V.accountEmail}
              </div>
              {V.emailVerified ? (
                <React.Fragment>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: theme.success,
                      fontSize: '11.5px',
                      fontWeight: '600',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke={theme.success}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Verified
                  </span>
                </React.Fragment>
              ) : null}
              {V.emailNotVerified ? (
                <React.Fragment>
                  <button
                    onClick={V.resendVerification}
                    style={{
                      background: theme.brand,
                      color: theme.white,
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Resend email
                  </button>
                </React.Fragment>
              ) : null}
            </div>
          </div>{' '}
          <label style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
            Language
            <select
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
                cursor: 'pointer',
              }}
            >
              <option>English (US)</option>
              <option>Hindi</option>
              <option>Español</option>
            </select>
          </label>{' '}
          <button
            onClick={V.toastDelete}
            style={{
              background: theme.white,
              color: theme.danger,
              border: `1px solid ${theme.dangerBorder}`,
              borderRadius: '9px',
              padding: '11px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              marginTop: '2px',
            }}
          >
            Delete account
          </button>{' '}
        </React.Fragment>
      ) : null}{' '}
      {V.stIsSecurity ? (
        <React.Fragment>
          {' '}
          <span style={{ fontWeight: '600', fontSize: '13.5px' }}>Change password</span>{' '}
          <input
            value={V.pwCurrent}
            onInput={V.setPwCurrent}
            type="password"
            placeholder="Current password"
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '9px',
              padding: '10px 12px',
              fontSize: '13.5px',
              outline: 'none',
              fontFamily: "'IBM Plex Sans',sans-serif",
            }}
          />{' '}
          <input
            value={V.pwNew}
            onInput={V.setPwNew}
            type="password"
            placeholder="New password"
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '9px',
              padding: '10px 12px',
              fontSize: '13.5px',
              outline: 'none',
              fontFamily: "'IBM Plex Sans',sans-serif",
            }}
          />{' '}
          <input
            value={V.pwConfirm}
            onInput={V.setPwConfirm}
            type="password"
            placeholder="Confirm new password"
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '9px',
              padding: '10px 12px',
              fontSize: '13.5px',
              outline: 'none',
              fontFamily: "'IBM Plex Sans',sans-serif",
            }}
          />{' '}
          <button
            onClick={V.updatePassword}
            style={{
              background: theme.brand,
              color: theme.white,
              border: 'none',
              borderRadius: '9px',
              padding: '11px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Update password
          </button>{' '}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 0',
              borderTop: `1px solid ${theme.surface}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Two-factor authentication</span>
              <span style={{ fontSize: '11.5px', color: theme.textFaint }}>
                Extra security at sign-in
              </span>
            </div>
            <button
              onClick={V.toggle2fa}
              style={{
                width: '42px',
                height: '24px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                background: V.twofaBg,
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: `${V.twofaX}px`,
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: theme.white,
                  transition: 'left .15s',
                }}
              />
            </button>
          </div>{' '}
          <button
            onClick={V.toastSessions}
            style={{
              background: theme.white,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '9px',
              padding: '11px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Sign out of all other sessions
          </button>{' '}
        </React.Fragment>
      ) : null}{' '}
      {V.stIsDeveloper ? ApiKeysPanel(V) : null}{' '}
    </React.Fragment>
  ) : null;
}
