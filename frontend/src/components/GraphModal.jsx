import React from 'react';
import { theme } from '../lib/theme';

// Whole-storage knowledge graph as an SVG node-link diagram (no external libs).
// Nodes on a circle; edges colored by provenance (extracted vs inferred).
// Renders when V.isGraphModal is set; data from GET /graph/.
const MAX_NODES = 60; // keep the picture readable
const SIZE = 620;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 70;

const FOLDER_COLOR = theme.brand || '#5145E5';
const FILE_COLOR = '#5B8DEF';
const INFERRED = '#E8912D';
const EXTRACTED = theme.textFaint || '#9AA1AC';

function truncate(s, n = 16) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s || '';
}

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
  const edges = (g && g.edges) || [];
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

  const shown = nodes.slice(0, MAX_NODES);
  const pos = {};
  shown.forEach((n, i) => {
    const a = (2 * Math.PI * i) / shown.length - Math.PI / 2;
    pos[n.id] = { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a), a, node: n };
  });
  const visibleEdges = edges.filter((e) => pos[e.source] && pos[e.target]);

  return (
    <React.Fragment>
      {header}
      <span style={{ fontSize: '12px', color: theme.textFaint }}>
        {g.counts.nodes} nodes · {g.counts.edges} edges{g.scoped ? ' · scoped to your folder' : ''}
        {nodes.length > MAX_NODES ? ` · showing first ${MAX_NODES}` : ''}
      </span>
      <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px', color: theme.textMuted, flexWrap: 'wrap' }}>
        <Legend color={FOLDER_COLOR} label="folder" />
        <Legend color={FILE_COLOR} label="file" />
        <Legend color={EXTRACTED} label="extracted edge" line />
        <Legend color={INFERRED} label="inferred edge" line dashed />
      </div>
      <div style={{ width: '100%', overflow: 'auto' }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', maxWidth: '620px', display: 'block', margin: '0 auto' }}>
          {visibleEdges.map((e, i) => {
            const s = pos[e.source];
            const t = pos[e.target];
            const inferred = e.provenance === 'inferred';
            return (
              <line
                key={`e${i}`}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={inferred ? INFERRED : EXTRACTED}
                strokeWidth={inferred ? 1.2 : 1}
                strokeDasharray={inferred ? '4 3' : undefined}
                opacity="0.55"
              />
            );
          })}
          {shown.map((n) => {
            const p = pos[n.id];
            const isFolder = n.kind === 'folder';
            const color = isFolder ? FOLDER_COLOR : FILE_COLOR;
            // Anchor labels left/right depending on which half of the circle.
            const rightSide = Math.cos(p.a) >= 0;
            return (
              <g key={n.id}>
                <circle cx={p.x} cy={p.y} r={isFolder ? 6.5 : 4.5} fill={color} />
                <text
                  x={p.x + (rightSide ? 9 : -9)}
                  y={p.y + 3.5}
                  fontSize="10.5"
                  fill={theme.text || '#15171C'}
                  textAnchor={rightSide ? 'start' : 'end'}
                  fontFamily="'IBM Plex Sans',sans-serif"
                >
                  {truncate(n.label)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
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
