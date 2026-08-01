import React from 'react';
import { theme } from '../lib/theme';
import GraphCanvas from './GraphCanvas';

// Whole-storage knowledge graph, force-directed + interactive, with controls:
// search, type filters, local-graph focus (adjustable depth), color-by-folder,
// reset view. GraphModal(V) returns the stateful GraphView (invoked as a
// function in AppView, so it returns an element, not a class instance).
const KIND_CHIPS = [
  ['folder', 'Folders'],
  ['doc', 'Docs'],
  ['image', 'Images'],
  ['video', 'Video'],
  ['audio', 'Audio'],
  ['file', 'Other'],
];
const INFERRED = '#E8912D';
const EXTRACTED = '#C2C8D2';

export default function GraphModal(V) {
  if (!V.isGraphModal) return null;
  return <GraphView V={V} />;
}

class GraphView extends React.Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.state = {
      q: '',
      kinds: { folder: true, doc: true, image: true, video: true, audio: true, file: true },
      local: false,
      focusId: null,
      depth: 1,
      showForces: false,
      charge: 2600, // repulsion
      linkDist: 80,
      center: 0.02, // gravity
    };
  }

  toggleKind(k) {
    this.setState((s) => ({ kinds: { ...s.kinds, [k]: !s.kinds[k] } }));
  }

  onNodeClick = (node) => {
    if (this.state.local) {
      this.setState({ focusId: node.id });
    } else if (node.file_id && this.props.V.openGraphFile) {
      this.props.V.openGraphFile(node.file_id);
    }
  };

  render() {
    const V = this.props.V;
    const g = V.graphData;
    const { q, kinds, local, focusId, depth } = this.state;

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
            The graph is empty - upload some files and it builds itself.
          </div>
        </React.Fragment>
      );
    }

    const focusLabel = focusId ? (nodes.find((n) => n.id === focusId) || {}).label : null;

    return (
      <React.Fragment>
        {header}
        {/* controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <input
            value={q}
            onInput={(e) => this.setState({ q: e.target.value })}
            placeholder="Search nodes…"
            style={{
              flex: '1 1 150px',
              minWidth: '120px',
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              padding: '7px 10px',
              fontSize: '12.5px',
              outline: 'none',
              fontFamily: "'IBM Plex Sans',sans-serif",
            }}
          />
          {KIND_CHIPS.map(([k, label]) => (
            <button key={k} onClick={() => this.toggleKind(k)} style={chip(kinds[k])}>
              {label}
            </button>
          ))}
          <button
            onClick={() => this.setState((s) => ({ local: !s.local, focusId: s.local ? null : s.focusId }))}
            style={chip(local)}
          >
            Local graph
          </button>
          {local ? (
            <React.Fragment>
              <span style={{ fontSize: '12px', color: theme.textMuted }}>depth</span>
              {[1, 2].map((d) => (
                <button key={d} onClick={() => this.setState({ depth: d })} style={chip(depth === d)}>
                  {d}
                </button>
              ))}
            </React.Fragment>
          ) : null}
          <button onClick={() => this.setState((s) => ({ showForces: !s.showForces }))} style={chip(this.state.showForces)}>
            Forces
          </button>
          <button onClick={() => this.canvasRef.current && this.canvasRef.current.resetView()} style={chip(false)}>
            Reset view
          </button>
        </div>
        {this.state.showForces ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              padding: '8px 12px',
              background: theme.surface2,
              border: `1px solid ${theme.border}`,
              borderRadius: '10px',
            }}
          >
            <Slider label="Repulsion" min={500} max={8000} step={100} value={this.state.charge}
                    onChange={(v) => this.setState({ charge: v })} />
            <Slider label="Link distance" min={30} max={220} step={5} value={this.state.linkDist}
                    onChange={(v) => this.setState({ linkDist: v })} />
            <Slider label="Gravity" min={0} max={0.12} step={0.005} value={this.state.center}
                    onChange={(v) => this.setState({ center: v })} />
          </div>
        ) : null}
        {/* status line */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: theme.textFaint }}>
            {g.counts.nodes} nodes · {g.counts.edges} edges{g.scoped ? ' · scoped to your folder' : ''}
            {local && focusLabel ? ` · focused on “${focusLabel}” (depth ${depth})` : ''}
          </span>
          <div style={{ display: 'flex', gap: '13px', fontSize: '11.5px', color: theme.textMuted, flexWrap: 'wrap' }}>
            <Legend color={EXTRACTED} label="extracted" line />
            <Legend color={INFERRED} label="inferred" line dashed />
            <span style={{ color: theme.textFaint }}>· node color = folder · size = links</span>
          </div>
        </div>
        {local && focusId ? (
          <button
            onClick={() => this.setState({ focusId: null })}
            style={{ alignSelf: 'flex-start', ...chip(false), color: theme.brand }}
          >
            ← clear focus
          </button>
        ) : null}
        <GraphCanvas
          ref={this.canvasRef}
          data={g}
          kinds={kinds}
          query={q}
          colorByFolder
          focusId={local ? focusId : null}
          depth={depth}
          charge={this.state.charge}
          linkDist={this.state.linkDist}
          center={this.state.center}
          onNodeClick={this.onNodeClick}
        />
      </React.Fragment>
    );
  }
}

function chip(active) {
  return {
    background: active ? theme.brand : theme.surface,
    color: active ? theme.white : theme.textMuted,
    border: `1px solid ${active ? theme.brand : theme.border}`,
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'IBM Plex Sans',sans-serif",
  };
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11.5px', color: theme.textMuted }}>
      <span>
        {label}: <strong style={{ color: theme.text }}>{value}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '150px' }}
      />
    </label>
  );
}

function Legend({ color, label, line, dashed }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <svg width="16" height="8">
        <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      {label}
    </span>
  );
}
