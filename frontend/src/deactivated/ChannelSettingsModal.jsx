import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isChannelSettingsModal is set.
export default function ChannelSettingsModal(V) {
  return V.isChannelSettingsModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Channel settings
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: V.csColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.white,
            fontWeight: '700',
            fontSize: '18px',
            fontFamily: "'Space Grotesk',sans-serif",
          }}
        >
          {V.csInitials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', fontSize: '14px' }}>{V.csName}</span>
          <span style={{ fontSize: '11.5px', color: theme.textFaint }}>{V.csSubs} subscribers</span>
        </div>
      </div>{' '}
      <label style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
        Channel name
        <input
          value={V.csNameInput}
          onInput={V.setCsName}
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
        Description
        <textarea
          value={V.csDesc}
          onInput={V.setCsDesc}
          rows="2"
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
          Who can post
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={V.setPostAdmins}
            style={{
              flex: '1',
              background: V.postAdminsBg,
              color: V.postAdminsColor,
              border: `1px solid ${V.postAdminsBorder}`,
              borderRadius: '9px',
              padding: '9px',
              fontSize: '12.5px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Admins only
          </button>
          <button
            onClick={V.setPostEveryone}
            style={{
              flex: '1',
              background: V.postEveryoneBg,
              color: V.postEveryoneColor,
              border: `1px solid ${V.postEveryoneBorder}`,
              borderRadius: '9px',
              padding: '9px',
              fontSize: '12.5px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Everyone
          </button>
        </div>
      </div>{' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: '500' }}>Notifications</span>
          <span style={{ fontSize: '11.5px', color: theme.textFaint }}>
            Notify subscribers of new posts
          </span>
        </div>
        <button
          onClick={V.toggleChNotif}
          style={{
            width: '42px',
            height: '24px',
            borderRadius: '20px',
            border: 'none',
            cursor: 'pointer',
            background: V.chNotifBg,
            position: 'relative',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: `${V.chNotifX}px`,
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
        onClick={V.saveChannel}
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
        Save changes
      </button>{' '}
      <button
        onClick={V.leaveChannel}
        style={{
          background: theme.white,
          color: theme.danger,
          border: `1px solid ${theme.dangerBorder}`,
          borderRadius: '9px',
          padding: '11px',
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
        }}
      >
        Leave channel
      </button>{' '}
    </React.Fragment>
  ) : null;
}
