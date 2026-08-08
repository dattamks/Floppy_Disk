import React from 'react';
import { theme } from '../lib/theme';

// Shows a file's neighbors in the knowledge graph (containing folder,
// shared-token siblings, references) - each edge explained. Renders when
// V.isRelatedModal is set. Data comes from GET /graph/related/<file_id>.
const REL_LABEL = {
  contains: 'in folder',
  references: 'references',
  shared_token: 'related name',
};

export default function RelatedModal(V) {
  if (!V.isRelatedModal) return null;
  const items = V.relatedList || [];
  return (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Related to “{V.relatedForName}”
        </span>
        <button
          onClick={V.closeModal}
          aria-label="Close"
          title="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted2 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>{' '}
      <span style={{ fontSize: '12px', color: theme.textFaint }}>
        From the deterministic knowledge graph - every link is explained, nothing guessed.
      </span>{' '}
      {V.relatedLoading ? (
        <div style={{ color: theme.textMuted, fontSize: '13.5px', padding: '18px 2px' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '13.5px', padding: '18px 2px' }}>
          Nothing related yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {items.map((it, ix) => (
            <div
              key={ix}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '13.5px',
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.node.label}
                </span>
                <span style={{ fontSize: '11.5px', color: theme.textMuted }}>{it.reason}</span>
              </div>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: '600',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: it.provenance === 'inferred' ? theme.warnBg : theme.brandBg,
                  color: it.provenance === 'inferred' ? theme.warnDark : theme.brand,
                  flex: '0 0 auto',
                }}
              >
                {REL_LABEL[it.rel] || it.rel}
              </span>
            </div>
          ))}
        </div>
      )}{' '}
    </React.Fragment>
  );
}
