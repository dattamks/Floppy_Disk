import React from 'react';
import { theme } from '../lib/theme';

// Interactive force-directed knowledge graph (no external libs).
// Physics: many-body repulsion + link springs + mild centering gravity, settled
// over a cooling schedule (d3-force style). Interactions: wheel-zoom, drag-pan,
// drag-a-node, hover-to-highlight-neighbors, click-a-file-to-open. Nodes are
// sized by degree; labels stay a constant screen size and appear on hover / when
// zoomed. Simulation stops when cool and only re-runs on interaction, so the
// view is crisp and cheap once settled.

const FOLDER_COLOR = theme.brand || '#5145E5';
const FILE_COLOR = '#4C82F7';
const INFERRED = '#E8912D';
const EXTRACTED = '#B7BDC7';
const TEXT = theme.text || '#15171C';

const LINK_DIST = 78;
const CHARGE = 2600; // repulsion strength
const CENTER = 0.02; // gravity toward middle
const DAMP = 0.82; // velocity decay
const ALPHA_MIN = 0.004;
const ALPHA_DECAY = 0.965;

export default class GraphCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.wrapRef = React.createRef();
    this.state = { k: 1, tx: 0, ty: 0, hover: null, w: 900, h: 560, tick: 0 };
    this._init(props);
    this._pan = null;
    this._drag = null;
    this._downAt = null;
  }

  componentDidMount() {
    this._measure();
    this._onResize = () => this._measure();
    window.addEventListener('resize', this._onResize);
    this.alpha = 1;
    this._start();
  }

  componentDidUpdate(prev) {
    if (prev.data !== this.props.data) {
      this._init(this.props);
      this.alpha = 1;
      this._userMoved = false;
      this.setState({ k: 1, tx: 0, ty: 0, hover: null });
      this._start();
    }
  }

  componentWillUnmount() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
  }

  _measure() {
    const el = this.wrapRef.current;
    if (el) this.setState({ w: el.clientWidth || 900, h: el.clientHeight || 560 });
  }

  _init(props) {
    const data = props.data || {};
    const rawNodes = (data.nodes || []).slice(0, 250);
    const idset = new Set(rawNodes.map((n) => n.id));
    const deg = {};
    (data.edges || []).forEach((e) => {
      if (idset.has(e.source) && idset.has(e.target)) {
        deg[e.source] = (deg[e.source] || 0) + 1;
        deg[e.target] = (deg[e.target] || 0) + 1;
      }
    });
    // Seed positions on a spread-out spiral so the sim untangles quickly.
    this.nodes = rawNodes.map((n, i) => {
      const a = i * 2.399963; // golden angle
      const r = 12 * Math.sqrt(i);
      return {
        id: n.id,
        node: n,
        deg: deg[n.id] || 0,
        x: r * Math.cos(a),
        y: r * Math.sin(a),
        vx: 0,
        vy: 0,
        fixed: false,
      };
    });
    this.byId = {};
    this.nodes.forEach((n) => (this.byId[n.id] = n));
    this.edges = (data.edges || [])
      .filter((e) => this.byId[e.source] && this.byId[e.target])
      .map((e) => ({ ...e, s: this.byId[e.source], t: this.byId[e.target] }));
    this.adj = {};
    this.nodes.forEach((n) => (this.adj[n.id] = new Set()));
    this.edges.forEach((e) => {
      this.adj[e.source].add(e.target);
      this.adj[e.target].add(e.source);
    });
  }

  radius(n) {
    return 4.5 + Math.min(9, Math.sqrt(n.deg) * 2.2);
  }

  _start() {
    cancelAnimationFrame(this._raf);
    const step = () => {
      this._simTick();
      // Obsidian-style: keep the whole graph framed as it settles (until the
      // user takes over with a pan/zoom/drag).
      const fit = this._userMoved || this._drag ? null : this._fitTransform();
      this.setState((s) => ({ tick: s.tick + 1, ...(fit || {}) }));
      const busy = this.alpha > ALPHA_MIN || this._drag;
      if (busy) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  _fitTransform() {
    if (!this.nodes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }
    const { w, h } = this.state;
    const pad = 96;
    const gw = maxX - minX || 1;
    const gh = maxY - minY || 1;
    const k = Math.min(2.2, Math.max(0.3, Math.min((w - pad) / gw, (h - pad) / gh)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { k, tx: -cx * k, ty: -cy * k };
  }

  _reheat(a = 0.5) {
    this.alpha = Math.max(this.alpha, a);
    this._start();
  }

  _simTick() {
    const nodes = this.nodes;
    const a = this.alpha;
    // Repulsion (O(n^2); n capped at 250).
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const nj = nodes[j];
        let dx = ni.x - nj.x;
        let dy = ni.y - nj.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          d2 = dx * dx + dy * dy;
        }
        const f = (CHARGE * a) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        ni.vx += fx;
        ni.vy += fy;
        nj.vx -= fx;
        nj.vy -= fy;
      }
    }
    // Link springs.
    for (const e of this.edges) {
      const dx = e.t.x - e.s.x;
      const dy = e.t.y - e.s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = ((d - LINK_DIST) / d) * a * 0.5;
      const fx = dx * f;
      const fy = dy * f;
      e.s.vx += fx;
      e.s.vy += fy;
      e.t.vx -= fx;
      e.t.vy -= fy;
    }
    // Centering gravity + integrate.
    for (const n of nodes) {
      if (n === this._drag) continue;
      n.vx -= n.x * CENTER * a;
      n.vy -= n.y * CENTER * a;
      n.vx *= DAMP;
      n.vy *= DAMP;
      n.x += n.vx;
      n.y += n.vy;
    }
    this.alpha *= ALPHA_DECAY;
  }

  // --- interaction ---------------------------------------------------------
  _toSim(clientX, clientY) {
    const el = this.wrapRef.current.getBoundingClientRect();
    const { k, tx, ty, w, h } = this.state;
    return {
      x: (clientX - el.left - w / 2 - tx) / k,
      y: (clientY - el.top - h / 2 - ty) / k,
    };
  }

  _hitNode(clientX, clientY) {
    const p = this._toSim(clientX, clientY);
    let best = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const d = dx * dx + dy * dy;
      const r = this.radius(n) + 6;
      if (d < r * r && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  onWheel = (e) => {
    e.preventDefault();
    this._userMoved = true;
    const { k, tx, ty, w, h } = this.state;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nk = Math.min(4, Math.max(0.25, k * factor));
    const el = this.wrapRef.current.getBoundingClientRect();
    const cx = e.clientX - el.left - w / 2;
    const cy = e.clientY - el.top - h / 2;
    // Keep the point under the cursor fixed while zooming.
    this.setState({ k: nk, tx: cx - ((cx - tx) * nk) / k, ty: cy - ((cy - ty) * nk) / k });
  };

  onPointerDown = (e) => {
    e.target.setPointerCapture?.(e.pointerId);
    this._downAt = { x: e.clientX, y: e.clientY, moved: false };
    const hit = this._hitNode(e.clientX, e.clientY);
    if (hit) {
      this._userMoved = true;
      hit.fixed = true;
      this._drag = hit;
      this._reheat(0.3);
    } else {
      this._userMoved = true;
      this._pan = { x: e.clientX, y: e.clientY, tx: this.state.tx, ty: this.state.ty };
    }
  };

  onPointerMove = (e) => {
    if (this._downAt) {
      const dd = Math.abs(e.clientX - this._downAt.x) + Math.abs(e.clientY - this._downAt.y);
      if (dd > 3) this._downAt.moved = true;
    }
    if (this._drag) {
      const p = this._toSim(e.clientX, e.clientY);
      this._drag.x = p.x;
      this._drag.y = p.y;
      this._drag.vx = 0;
      this._drag.vy = 0;
      return;
    }
    if (this._pan) {
      this.setState({
        tx: this._pan.tx + (e.clientX - this._pan.x),
        ty: this._pan.ty + (e.clientY - this._pan.y),
      });
      return;
    }
    const hit = this._hitNode(e.clientX, e.clientY);
    const id = hit ? hit.id : null;
    if (id !== this.state.hover) this.setState({ hover: id });
  };

  onPointerUp = (e) => {
    if (this._drag) {
      this._drag.fixed = false;
      this._drag = null;
      this._reheat(0.1);
    }
    // A click (no drag) on a file node opens it.
    if (this._downAt && !this._downAt.moved) {
      const hit = this._hitNode(e.clientX, e.clientY);
      if (hit && hit.node.file_id && this.props.onOpenFile) this.props.onOpenFile(hit.node.file_id);
    }
    this._pan = null;
    this._downAt = null;
  };

  render() {
    const { k, tx, ty, hover, w, h } = this.state;
    const nodes = this.nodes;
    const edges = this.edges;
    const neigh = hover ? this.adj[hover] : null;
    const dim = (id) => hover && id !== hover && !(neigh && neigh.has(id));
    const showAllLabels = nodes.length <= 26 || k > 1.7;
    const fontSize = 11 / k;

    return (
      <div
        ref={this.wrapRef}
        onWheel={this.onWheel}
        onPointerDown={this.onPointerDown}
        onPointerMove={this.onPointerMove}
        onPointerUp={this.onPointerUp}
        onPointerLeave={() => this.setState({ hover: null })}
        style={{
          width: '100%',
          height: '62vh',
          minHeight: '360px',
          background: theme.surface2 || '#F6F7F9',
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          overflow: 'hidden',
          cursor: this._pan ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <svg width={w} height={h} style={{ display: 'block' }}>
          <g transform={`translate(${w / 2 + tx}, ${h / 2 + ty}) scale(${k})`}>
            {edges.map((e, i) => {
              const inferred = e.provenance === 'inferred';
              const active = hover && (e.source === hover || e.target === hover);
              const faded = hover && !active;
              return (
                <line
                  key={i}
                  x1={e.s.x}
                  y1={e.s.y}
                  x2={e.t.x}
                  y2={e.t.y}
                  stroke={inferred ? INFERRED : EXTRACTED}
                  strokeWidth={(active ? 2 : 1) / k}
                  strokeDasharray={inferred ? `${4 / k} ${3 / k}` : undefined}
                  opacity={faded ? 0.12 : 0.7}
                />
              );
            })}
            {nodes.map((n) => {
              const isFolder = n.node.kind === 'folder';
              const r = this.radius(n);
              const faded = dim(n.id);
              const active = n.id === hover;
              return (
                <g key={n.id} opacity={faded ? 0.25 : 1}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill={isFolder ? FOLDER_COLOR : FILE_COLOR}
                    stroke={active ? TEXT : '#fff'}
                    strokeWidth={(active ? 2 : 1) / k}
                  />
                  {showAllLabels || active || (neigh && neigh.has(n.id)) ? (
                    <text
                      x={n.x + r + 3 / k}
                      y={n.y + fontSize * 0.35}
                      fontSize={fontSize}
                      fill={TEXT}
                      fontFamily="'IBM Plex Sans',sans-serif"
                      style={{ pointerEvents: 'none' }}
                    >
                      {n.node.label.length > 22 ? n.node.label.slice(0, 21) + '…' : n.node.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    );
  }
}
