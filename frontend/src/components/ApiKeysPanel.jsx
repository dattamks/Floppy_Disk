import React from 'react';
import { theme } from '../lib/theme';

// Developer tab: manage programmatic / MCP API keys, including folder-scoped
// keys. Rendered by SettingsModal when the Developer tab is active.
export default function ApiKeysPanel(V) {
  const folders = V.keyFolders || [];
  const folderName = (id) => {
    const f = folders.find((x) => String(x.id) === String(id));
    return f ? f.name : 'a folder';
  };
  return (
    <React.Fragment>
      {' '}
      <span style={{ fontSize: '12.5px', color: theme.textMuted }}>
        Keys let automation tools and LLMs (over MCP) act on your storage. Scope a
        key to a single folder to give one assistant access to just that folder —
        its search and knowledge graph are limited to that subtree too.
      </span>{' '}
      {V.newKeyToken ? (
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.brand}`,
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: '600', color: theme.text }}>
            Copy your key now — it won’t be shown again
          </span>
          <code
            style={{
              fontSize: '12.5px',
              wordBreak: 'break-all',
              background: theme.surface2,
              borderRadius: '7px',
              padding: '8px 10px',
              fontFamily: 'monospace',
            }}
          >
            {V.newKeyToken}
          </code>
          <button
            onClick={V.dismissNewKeyToken}
            style={{
              alignSelf: 'flex-start',
              background: 'none',
              border: 'none',
              color: theme.brand,
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              padding: '0',
            }}
          >
            Done
          </button>
        </div>
      ) : null}{' '}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px',
          background: theme.surface2,
          border: `1px solid ${theme.border}`,
          borderRadius: '10px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Create a key</span>
        <input
          value={V.newKeyName}
          onInput={V.setNewKeyName}
          placeholder="Name (e.g. local-llm, n8n)"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '9px',
            padding: '10px 12px',
            fontSize: '13px',
            outline: 'none',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        />
        <label style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '500' }}>
          Access
          <select
            value={V.newKeyFolder}
            onChange={V.setNewKeyFolder}
            style={{
              width: '100%',
              marginTop: '5px',
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '9px',
              padding: '10px 12px',
              fontSize: '13px',
              outline: 'none',
              fontFamily: "'IBM Plex Sans',sans-serif",
              cursor: 'pointer',
            }}
          >
            <option value="">Full storage (all folders)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                Limit to “{f.name}”
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            color: theme.textMuted,
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={V.newKeyReadOnly} onChange={V.toggleNewKeyReadOnly} />
          Read-only (can fetch, can’t modify)
        </label>
        <button
          onClick={V.createApiKey}
          style={{
            background: theme.brand,
            color: theme.white,
            border: 'none',
            borderRadius: '9px',
            padding: '10px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Create key
        </button>
      </div>{' '}
      {V.apiKeysLoading ? (
        <span style={{ fontSize: '12.5px', color: theme.textMuted }}>Loading…</span>
      ) : (V.apiKeys || []).length === 0 ? (
        <span style={{ fontSize: '12.5px', color: theme.textFaint }}>No API keys yet.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(V.apiKeys || []).map((k) => (
            <div
              key={k.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: '9px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1', minWidth: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>{k.name || 'Untitled key'}</span>
                <span style={{ fontSize: '11.5px', color: theme.textFaint, fontFamily: 'monospace' }}>
                  {k.prefix}…
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: '600',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      background: theme.surface2,
                      color: theme.textMuted,
                    }}
                  >
                    {k.scopes === 'read' ? 'Read-only' : 'Read + write'}
                  </span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: '600',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      background: k.root_folder ? '#EEF2FF' : theme.surface2,
                      color: k.root_folder ? theme.brand : theme.textMuted,
                    }}
                  >
                    {k.root_folder ? `Folder: ${folderName(k.root_folder)}` : 'Full access'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => V.revokeApiKey(k.id)}
                style={{
                  background: theme.white,
                  color: theme.danger,
                  border: `1px solid ${theme.dangerBorder}`,
                  borderRadius: '8px',
                  padding: '7px 11px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flex: '0 0 auto',
                }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}{' '}
    </React.Fragment>
  );
}
