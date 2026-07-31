import React from 'react';
import { theme } from '../lib/theme';

// Owner-only "Storage" tab in Settings. Where uploaded files live: this server's
// disk or Cloudflare R2. Reads everything from V.storage (assembled in App.jsx).
export default function StoragePanel(V) {
  const S = V.storage || {};
  const cfg = S.config;
  const label = { fontSize: '12px', color: theme.textMuted, fontWeight: '500' };
  const input = {
    width: '100%',
    marginTop: '5px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '9px',
    padding: '10px 12px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: "'IBM Plex Mono','IBM Plex Sans',monospace",
    boxSizing: 'border-box',
  };
  const chip = (bg, color, brd, text) => (
    <span
      style={{
        fontSize: '11px',
        fontWeight: '600',
        padding: '3px 9px',
        borderRadius: '999px',
        background: bg,
        color,
        border: `1px solid ${brd}`,
      }}
    >
      {text}
    </span>
  );

  if (!cfg) {
    return <div style={{ color: theme.textMuted, fontSize: '13px' }}>Loading storage…</div>;
  }

  const isR2 = cfg.effective_backend === 'r2';
  const backendChip = isR2
    ? chip(theme.tealBg, '#0F766E', '#99E7DF', '☁ Cloudflare R2')
    : chip(theme.warnBg, theme.warnDark, theme.warnBorder, '🖥 This server’s disk');

  return (
    <React.Fragment>
      {/* Current backend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: theme.surface2,
          border: `1px solid ${theme.border}`,
          borderRadius: '11px',
          padding: '13px 15px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>Files are stored on</span>
          <span style={{ fontSize: '12px', color: theme.textMuted }}>
            {isR2
              ? `New uploads go to your R2 bucket "${cfg.r2.bucket}".`
              : 'Durable only if this server’s disk is a persistent volume.'}
          </span>
        </div>
        {backendChip}
      </div>

      {cfg.env_managed ? (
        <div
          style={{
            background: theme.brandBgSoft,
            border: `1px solid ${theme.brandBorder}`,
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12.5px',
            color: theme.textSoft,
          }}
        >
          Storage is set through this server’s environment variables, so it can’t be
          changed here. Ask whoever deployed the app to adjust the R2 settings.
        </div>
      ) : (
        <React.Fragment>
          <div style={{ fontSize: '13.5px', fontWeight: '600', marginTop: '2px' }}>
            Connect Cloudflare R2
          </div>
          <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '-4px' }}>
            From your Cloudflare dashboard → R2. We never show the secret again after saving.
          </div>

          <label style={label}>
            Account endpoint
            <input
              value={S.endpoint}
              onInput={S.setEndpoint}
              placeholder="https://<account-id>.r2.cloudflarestorage.com"
              style={input}
              data-testid="r2-endpoint"
            />
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <label style={{ ...label, flex: 1 }}>
              Access Key ID
              <input value={S.accessKey} onInput={S.setAccessKey} style={input} data-testid="r2-access" />
            </label>
            <label style={{ ...label, flex: 1 }}>
              Secret Access Key
              <input
                value={S.secret}
                onInput={S.setSecret}
                type="password"
                placeholder={cfg.r2.secret_set ? '•••••••• (saved)' : ''}
                style={input}
                data-testid="r2-secret"
              />
            </label>
          </div>
          <label style={label}>
            Bucket name
            <input value={S.bucket} onInput={S.setBucket} style={input} data-testid="r2-bucket" />
          </label>

          {/* Test + result */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', flexWrap: 'wrap' }}>
            <button
              onClick={S.test}
              disabled={S.testState === 'testing'}
              style={{
                background: theme.white,
                border: `1px solid ${theme.borderStrong}`,
                borderRadius: '9px',
                padding: '9px 14px',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              data-testid="r2-test"
            >
              {S.testState === 'testing' ? 'Testing…' : 'Test connection'}
            </button>
            {S.testState === 'ok' ? (
              <span style={{ color: theme.success, fontSize: '12.5px', fontWeight: '600' }}>
                ✓ Connected - bucket reachable
              </span>
            ) : null}
            {S.testState === 'error' ? (
              <span style={{ color: theme.danger, fontSize: '12.5px', fontWeight: '600' }}>
                ✕ {S.testMsg}
              </span>
            ) : null}
          </div>

          <button
            onClick={S.save}
            disabled={S.busy}
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
            data-testid="r2-save"
          >
            {S.busy ? 'Saving…' : 'Save & switch to R2'}
          </button>
        </React.Fragment>
      )}

      {/* Migration card */}
      {isR2 && (cfg.local_blobs.count > 0 || S.migration) ? (
        <MigrationCard V={V} />
      ) : null}
    </React.Fragment>
  );
}

function MigrationCard({ V }) {
  const S = V.storage;
  const cfg = S.config;
  const m = S.migration;
  const running = m && (m.status === 'running' || m.status === 'pending');
  const pct = m && m.total ? Math.round((m.done / m.total) * 100) : 0;
  const mib = (n) => `${(n / (1024 * 1024)).toFixed(1)} MiB`;

  return (
    <div
      style={{
        marginTop: '4px',
        background: theme.surface2,
        border: `1px solid ${theme.border}`,
        borderRadius: '11px',
        padding: '14px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
      data-testid="migration-card"
    >
      <div style={{ fontSize: '13px', fontWeight: '600' }}>
        {m && m.status === 'done'
          ? 'Your earlier files are in R2'
          : running
            ? 'Moving your earlier files to R2'
            : `Move your ${cfg.local_blobs.count} earlier file${cfg.local_blobs.count === 1 ? '' : 's'} to R2`}
      </div>

      {m && running ? (
        <React.Fragment>
          <div
            style={{
              height: '10px',
              borderRadius: '999px',
              background: theme.surface3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: theme.brand,
                borderRadius: '999px',
                transition: 'width .4s',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: theme.textMuted,
            }}
          >
            <span>
              {m.done} / {m.total} moved · {mib(m.bytes_moved)}
              {m.skipped ? ` · ${m.skipped} skipped` : ''}
            </span>
            <button
              onClick={S.pauseMigration}
              style={{
                background: 'none',
                border: 'none',
                color: theme.textMuted,
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Pause
            </button>
          </div>
        </React.Fragment>
      ) : m && m.status === 'done' ? (
        <div style={{ fontSize: '12.5px', color: theme.success, fontWeight: '600' }}>
          ✓ {m.done} moved · {mib(m.bytes_moved)}
          {m.skipped ? ` · ${m.skipped} already there` : ''}
        </div>
      ) : (
        <React.Fragment>
          <label
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              fontSize: '12.5px',
              color: theme.textMuted,
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={!!S.deleteLocal} onChange={S.toggleDeleteLocal} />
            Delete each local copy after it’s safely in R2
          </label>
          <button
            onClick={S.startMigration}
            disabled={S.busy}
            style={{
              background: theme.brand,
              color: theme.white,
              border: 'none',
              borderRadius: '9px',
              padding: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              alignSelf: 'flex-start',
              paddingLeft: '16px',
              paddingRight: '16px',
            }}
            data-testid="migration-start"
          >
            Move {cfg.local_blobs.count} file{cfg.local_blobs.count === 1 ? '' : 's'} now
          </button>
          {m && (m.status === 'paused' || m.status === 'failed') ? (
            <span style={{ fontSize: '12px', color: theme.textMuted }}>
              {m.status === 'paused' ? 'Paused' : 'Stopped'} at {m.done}/{m.total}. Click to
              resume - already-moved files are skipped.
            </span>
          ) : null}
        </React.Fragment>
      )}
    </div>
  );
}
