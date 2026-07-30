import React from 'react';
import { theme } from '../lib/theme';
import GraphCanvas from './GraphCanvas';

// Whole-storage knowledge graph, force-directed and interactive (GraphCanvas).
// Renders when V.isGraphModal is set; data from GET /graph/.
const FOLDER_COLOR = theme.brand || '#5145E5';
const FILE_COLOR = '#4C82F7';
const INFERRED = '#E8912D';
const EXTRACTED = '#B7BDC7';

export default function GraphModal(V) {
  if (!V.isGraphModal) return null;
  const g = V.graphData;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}>
        Knowledge graph
      </span>
      <button
        onClick={V.closeModal}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted2 }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );

  if (V.graphLoading) {
    return (
      <React.Fragment>
        {header}
        <div style={{ color: theme.textMuted, fontSize: '13.5px', padding: '18px 2px' }}>Loading…</div>
      </React.Fragment>
    );
  }

  const nodes = (g && g.nodes) || [];
  if (nodes.length === 0) {
    return (
      <React.Fragment>
        {header}
        <div style={{ color: theme.textMuted, fontSize: '13.5px', padding: '18px 2px' }}>
          The graph is empty — upload some files and it builds itself.
        </div>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {header}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '12px', color: theme.textFaint }}>
          {g.counts.nodes} nodes · {g.counts.edges} edges{g.scoped ? ' · scoped to your folder' : ''} ·
          drag to pan, scroll to zoom, drag a node, hover to focus, click a file to open
        </span>
        <div style={{ display: 'flex', gap: '13px', fontSize: '11.5px', color: theme.textMuted, flexWrap: 'wrap' }}>
          <Legend color={FOLDER_COLOR} label="folder" />
          <Legend color={FILE_COLOR} label="file" />
          <Legend color={EXTRACTED} label="extracted" line />
          <Legend color={INFERRED} label="inferred" line dashed />
        </div>
      </div>
      <GraphCanvas data={g} onOpenFile={V.openGraphFile} />
    </React.Fragment>
  );
}

function Legend({ color, label, line, dashed }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      {line ? (
        <svg width="16" height="8">
          <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray={dashed ? '4 3' : undefined} />
        </svg>
      ) : (
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, display: 'inline-block' }} />
      )}
      {label}
    </span>
  );
}
