import React from 'react';
import { theme, CUSTOM_ACCENT, normalizeHex } from '../lib/theme';
import { hov } from '../lib/ui';
import ApiKeysPanel from './ApiKeysPanel';
import StoragePanel from './StoragePanel';

// Settings is a full page (not a modal) with its own secondary sidebar. Renders
// in place of the file browser when V.isSettingsPage is set; the primary app
// sidebar + top bar stay put around it. Sections: Profile, Account, Security,
// Developer, Storage (owner only), and Links (share-link management, moved here
// from the old standalone "Manage links" modal).
const inputStyle = {
  width: '100%',
  marginTop: '5px',
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: theme.radius,
  padding: '10px 12px',
  fontSize: '13.5px',
  outline: 'none',
  fontFamily: "'IBM Plex Sans',sans-serif",
};
const label = { fontSize: '12px', color: theme.textMuted, fontWeight: '500' };
const primaryBtn = {
  background: theme.brand,
  color: theme.onAccent,
  border: 'none',
  borderRadius: theme.radius,
  padding: '11px',
  fontSize: '13.5px',
  fontWeight: '600',
  cursor: 'pointer',
};

// Theme mode (Light / Dark / System) + primary accent color. Both apply live.
function Appearance(V) {
  const modes = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
  ];
  const seg = (active) => ({
    padding: '9px 16px',
    borderRadius: '8px',
    border: 'none',
    background: active ? theme.white : 'transparent',
    color: active ? theme.text : theme.textMuted,
    fontSize: '13.5px',
    fontWeight: active ? '600' : '500',
    cursor: 'pointer',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.14)' : 'none',
    fontFamily: "'IBM Plex Sans',sans-serif",
  });
  return (
    <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '26px' }}>
      <div>
        <div style={{ ...label, marginBottom: '9px' }}>Theme</div>
        <div style={{ display: 'inline-flex', gap: '3px', padding: '3px', borderRadius: '10px', background: theme.surface, border: `1px solid ${theme.border}` }}>
          {modes.map((m) => (
            <button key={m.id} data-testid={`theme-${m.id}`} onClick={() => V.setThemeChoice(m.id)} style={seg(V.themeChoice === m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: theme.textFaint, marginTop: '8px' }}>
          System follows your device’s appearance setting.
        </div>
      </div>
      <AccentPicker V={V} />
    </div>
  );
}

// Preset color dots + a custom-color swatch (opens the OS color picker) + a hex
// input. Everything applies live and works on both light and dark grounds.
function AccentPicker({ V }) {
  const custom = V.accent === CUSTOM_ACCENT;
  const [hex, setHex] = React.useState(normalizeHex(V.customHex) || '#7c5cff');
  React.useEffect(() => { setHex(normalizeHex(V.customHex) || '#7c5cff'); }, [V.customHex]);
  const commit = (val) => {
    setHex(val);
    const norm = normalizeHex(val);
    if (norm && V.setCustomAccent) V.setCustomAccent(norm);
  };
  const dot = (active, bg) => ({
    width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', background: bg,
    border: active ? `2px solid ${theme.text}` : `2px solid ${theme.border}`,
    boxShadow: active ? `0 0 0 3px ${theme.appBg2}, 0 0 0 4px ${bg}` : 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
  });
  const check = <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  const wheel = 'conic-gradient(from 90deg, #e23d6d, #dd8305, #0e9e6e, #2e6df0, #5145e5, #e23d6d)';
  const swatchHex = normalizeHex(hex) || '#7c5cff';
  return (
    <div>
      <div style={{ ...label, marginBottom: '10px' }}>Primary color</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        {(V.accents || []).map((a) => {
          const active = !custom && V.accent === a.id;
          return (
            <button key={a.id} data-testid={`accent-${a.id}`} onClick={() => V.setAccent(a.id)}
              title={a.label} aria-label={a.label} aria-pressed={active} data-round style={dot(active, a.base)}>
              {active ? check : null}
            </button>
          );
        })}
        {/* Custom color: the label opens the native picker; keeps the chosen hue. */}
        <label data-testid="accent-custom" data-round title="Custom color" aria-label="Custom color"
          style={{ ...dot(custom, custom ? swatchHex : wheel), border: custom ? `2px solid ${theme.text}` : `2px dashed ${theme.borderStrong2 || theme.borderStrong}` }}>
          {custom ? check : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
          )}
          <input type="color" value={swatchHex} onInput={(e) => commit(e.target.value)} onChange={(e) => commit(e.target.value)}
            data-testid="accent-color-input" aria-label="Pick a custom color"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }} />
        </label>
      </div>
      {/* Hex entry — a live preview square + a normalized #rrggbb field. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
        <span aria-hidden style={{ width: '26px', height: '26px', borderRadius: '7px', flex: '0 0 auto', background: swatchHex, border: `1px solid ${theme.border}` }} />
        <input value={hex} spellCheck={false} data-testid="accent-hex-input" aria-label="Custom color hex"
          placeholder="#7C5CFF" onChange={(e) => commit(e.target.value)}
          onBlur={() => setHex(normalizeHex(hex) || normalizeHex(V.customHex) || '#7c5cff')}
          style={{ width: '128px', background: theme.surface, border: `1px solid ${custom ? (theme.brandBorder || theme.border) : theme.border}`, borderRadius: theme.radius, padding: '9px 11px', fontSize: '13px', outline: 'none', color: theme.text, fontFamily: "'IBM Plex Mono','SFMono-Regular',Menlo,monospace", textTransform: 'uppercase' }} />
        <span style={{ fontSize: '12px', color: theme.textFaint }}>or enter a hex code</span>
      </div>
      <div style={{ fontSize: '12px', color: theme.textFaint, marginTop: '10px' }}>
        Applies across the app and works with both light and dark themes.
      </div>
    </div>
  );
}

function Profile(V) {
  const initial = ((V.profileName || V.accountEmail || 'A').trim()[0] || 'A').toUpperCase();
  return (
    <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
        {V.avatarUrl ? (
          <img
            src={V.avatarUrl}
            alt="Profile photo"
            style={{ width: '58px', height: '58px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              background: theme.brand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.onAccent,
              fontFamily: "'Space Grotesk',sans-serif",
              fontWeight: '700',
              fontSize: '22px',
            }}
          >
            {initial}
          </div>
        )}
        <input
          ref={V.avatarInputRef}
          onChange={V.onAvatarPicked}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif,.heic,.heif"
          style={{ display: 'none' }}
          aria-hidden="true"
        />
        <button
          onClick={V.changePhoto}
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius,
            padding: '9px 14px',
            fontSize: '12.5px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Change photo
        </button>
        {V.avatarUrl ? (
          <button
            onClick={V.removePhoto}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textMuted,
              fontSize: '12.5px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <label style={label}>
        Display name
        <input value={V.profileName} onInput={V.setProfileName} style={inputStyle} />
      </label>
      <label style={label}>
        Username
        <input value={V.profileUsername} onInput={V.setProfileUsername} style={inputStyle} />
      </label>
      <label style={label}>
        Bio
        <textarea
          value={V.profileBio}
          onInput={V.setProfileBio}
          rows="3"
          style={{ ...inputStyle, resize: 'none' }}
        />
      </label>
      <button onClick={V.saveProfile} style={{ ...primaryBtn, alignSelf: 'flex-start', padding: '11px 18px' }}>
        Save profile
      </button>
    </React.Fragment>
  );
}

function Account(V) {
  return (
    <React.Fragment>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <span style={label}>Email</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              flex: '1',
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
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
          ) : null}
          {V.emailNotVerified ? (
            <button
              onClick={V.resendVerification}
              style={{
                background: theme.brand,
                color: theme.onAccent,
                border: 'none',
                borderRadius: theme.radius,
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Resend email
            </button>
          ) : null}
        </div>
      </div>
      <label style={label}>
        Language
        <select
          value={V.profileLanguage || 'en'}
          onChange={V.setLanguage}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="en">English (US)</option>
          <option value="hi">Hindi</option>
          <option value="es">Español</option>
        </select>
      </label>
      <button
        onClick={V.toastDelete}
        style={{
          background: theme.white,
          color: theme.danger,
          border: `1px solid ${theme.dangerBorder}`,
          borderRadius: theme.radius,
          padding: '11px 18px',
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        Delete account
      </button>
    </React.Fragment>
  );
}

function Security(V) {
  const pw = { ...inputStyle, marginTop: 0 };
  return (
    <React.Fragment>
      <span style={{ fontWeight: '600', fontSize: '13.5px' }}>Change password</span>
      <input value={V.pwCurrent} onInput={V.setPwCurrent} type="password" placeholder="Current password" style={pw} />
      <input value={V.pwNew} onInput={V.setPwNew} type="password" placeholder="New password" style={pw} />
      <input value={V.pwConfirm} onInput={V.setPwConfirm} type="password" placeholder="Confirm new password" style={pw} />
      <button onClick={V.updatePassword} style={{ ...primaryBtn, alignSelf: 'flex-start', padding: '11px 18px' }}>
        Update password
      </button>
      <button
        onClick={V.toastSessions}
        style={{
          background: theme.white,
          color: theme.text,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius,
          marginTop: '4px',
          padding: '11px 18px',
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        Sign out of all other sessions
      </button>
    </React.Fragment>
  );
}

// Share-link management, moved under Settings. Data is V.linksView (same shape
// the old modal used), so copy/revoke behaviour is unchanged.
function Links(V) {
  if (V.linksLoading) {
    return <div style={{ padding: '30px', textAlign: 'center', color: theme.textMuted }}>Loading…</div>;
  }
  if (V.linksEmpty) {
    return (
      <div
        style={{
          padding: '34px 20px',
          textAlign: 'center',
          color: theme.textMuted,
          border: `1px dashed ${theme.border}`,
          borderRadius: theme.radiusCard,
        }}
      >
        No active share links yet. Use “Share link” on a file to create one.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {V.linksView.map((l) => (
        <div
          key={l.id}
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radiusCard,
            padding: '11px 13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontWeight: '600',
                fontSize: '13.5px',
                flex: '1',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {l.name}
            </span>
            {l.hasPassword ? (
              <span
                style={{
                  fontSize: '10.5px',
                  color: theme.brand,
                  background: theme.brandBg,
                  borderRadius: theme.radiusBadge,
                  padding: '1px 6px',
                }}
              >
                Password
              </span>
            ) : null}
            {l.expiresLabel ? (
              <span style={{ fontSize: '11px', color: theme.textFaint }}>Expires {l.expiresLabel}</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                flex: '1',
                fontSize: '11.5px',
                color: theme.textMuted,
                fontFamily: "'IBM Plex Mono',monospace",
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {l.url}
            </span>
            <button
              onClick={l.onCopy}
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: theme.radius,
                padding: '5px 11px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Copy
            </button>
            <button
              onClick={l.onRevoke}
              style={{
                background: theme.dangerBgSoft,
                border: `1px solid ${theme.dangerBorder2}`,
                color: theme.danger,
                borderRadius: theme.radius,
                padding: '5px 11px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Revoke
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage(V) {
  if (!V.isSettingsPage) return null;

  const items = [
    { key: 'profile', label: 'Profile', onClick: V.setSettingsProfile, active: V.stIsProfile },
    { key: 'account', label: 'Account', onClick: V.setSettingsAccount, active: V.stIsAccount },
    { key: 'security', label: 'Security', onClick: V.setSettingsSecurity, active: V.stIsSecurity },
    { key: 'appearance', label: 'Appearance', onClick: V.setSettingsAppearance, active: V.stIsAppearance },
    { key: 'developer', label: 'Developer', onClick: V.setSettingsDeveloper, active: V.stIsDeveloper },
    ...(V.isOwner
      ? [{ key: 'storage', label: 'Storage', onClick: V.setSettingsStorage, active: V.stIsStorage }]
      : []),
    { key: 'links', label: 'Links', onClick: V.setSettingsLinks, active: V.stIsLinks },
  ];

  const navBtn = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '9px 12px',
    borderRadius: theme.radius,
    border: 'none',
    background: active ? theme.brandBg : 'transparent',
    color: active ? theme.brand : theme.textMuted,
    fontSize: '13.5px',
    fontWeight: active ? '600' : '500',
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    fontFamily: "'IBM Plex Sans',sans-serif",
  });

  const nav = items.map((it) => (
    <button key={it.key} onClick={it.onClick} style={navBtn(it.active)} {...hov(it.active ? {} : { background: theme.surface })}>
      {it.label}
    </button>
  ));

  const body = V.stIsProfile
    ? Profile(V)
    : V.stIsAccount
      ? Account(V)
      : V.stIsSecurity
        ? Security(V)
        : V.stIsAppearance
          ? Appearance(V)
        : V.stIsDeveloper
          ? ApiKeysPanel(V)
          : V.stIsStorage
            ? StoragePanel(V)
            : V.stIsLinks
              ? Links(V)
              : null;

  const activeLabel = (items.find((it) => it.active) || {}).label || 'Settings';

  const secondaryNavDesktop = (
    <div
      style={{
        width: '210px',
        flex: '0 0 auto',
        borderRight: `1px solid ${theme.border}`,
        background: theme.white,
        padding: '18px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflowY: 'auto',
      }}
    >
      <span
        style={{
          fontFamily: "'Space Grotesk',sans-serif",
          fontWeight: '700',
          fontSize: '16px',
          padding: '2px 10px 12px',
        }}
      >
        Settings
      </span>
      {nav}
    </div>
  );

  const secondaryNavMobile = (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        padding: '2px 0 4px',
        borderBottom: `1px solid ${theme.border}`,
      }}
      className="fd-carousel"
    >
      {nav}
    </div>
  );

  const content = (
    <div
      style={{
        flex: '1',
        overflowY: 'auto',
        minWidth: '0',
        padding: V.isDesktop ? '24px 26px 40px' : '16px 16px 90px',
      }}
    >
      {/* A single centered column holds the header + section body, so every
          settings page is aligned to the middle of the content area. */}
      <div style={{ width: '100%', maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header: current section + a way back to files. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '18px' }}>
          {activeLabel}
        </span>
        <button
          onClick={V.closeSettings}
          aria-label="Back to files"
          title="Back to files"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: theme.white,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius,
            padding: '7px 12px',
            fontSize: '12.5px',
            fontWeight: '500',
            color: theme.textMuted,
            cursor: 'pointer',
          }}
          {...hov({ background: theme.surface })}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to files
        </button>
      </div>
      {!V.isDesktop ? secondaryNavMobile : null}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '13px',
        }}
      >
        {body}
      </div>
      </div>
    </div>
  );

  return (
    <div style={{ flex: '1', display: 'flex', minWidth: '0', minHeight: '0', overflow: 'hidden' }}>
      {V.isDesktop ? secondaryNavDesktop : null}
      {content}
    </div>
  );
}
