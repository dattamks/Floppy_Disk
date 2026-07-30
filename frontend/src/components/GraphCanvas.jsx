import React from 'react';
import { theme } from '../lib/theme';

// Interactive force-directed knowledge graph rendered to <canvas> (scales to
// hundreds/thousands of nodes; no external libs). Physics: many-body repulsion +
// link springs + centering gravity over a cooling schedule, with auto-fit.
// Interactions: wheel-zoom, drag-pan, drag a node, hover-highlight neighbors,
// click (delegated to onNodeClick). Supports type filters, a local-graph focus
// with adjustable depth, color-by-folder groups, and search highlighting — all
// applied at draw time over a stable layout (no jarring re-simulation).

const FOLDER_RING = '#ffffff';
const INFERRED = '#E8912D';
const EXTRACTED = '#C2C8D2';
const TEXT = theme.text || '#15171C';
const DIM = '#C9CED6';
// Distinct, legible group palette (color-by-folder).
const PALETTE = [
  '#5145E5', '#2F9E6E', '#E5484D', '#E8912D', '#4C82F7',
  '#9C4DCC', '#0E9BA6', '#C2410C', '#7C8B1B', '#B4235E',
];

const LINK_DIST = 80;
const CHARGE = 2600;
const CENTER = 0.02;
const DAMP = 0.82;
const ALPHA_MIN = 0.004;
const ALPHA_DECAY = 0.965;

export default class GraphCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.wrapRef = React.createRef();
    this.canvasRef = React.createRef();
    this.k = 1;
    this.tx = 0;
    this.ty = 0;
    this.hover = null;
    this.w = 900;
    this.h = 560;
    this._userMoved = false;
    this._init(props);
  }

  componentDidMount() {
    this._measure();
    this._onResize = () => {
      this._measure();
      this._draw();
    };
    window.addEventListener('resize', this._onResize);
    this.alpha = 1;
    this._start();
  }

  componentDidUpdate(prev) {
    if (prev.data !== this.props.data) {
      this._init(this.props);
      this.alpha = 1;
      this._userMoved = false;
      this.k = 1;
      this.tx = 0;
      this.ty = 0;
      this.hover = null;
      this._start();
      return;
    }
    // Filters / focus / query changed: keep layout, re-fit visible, redraw.
    this._visibleCache = null;
    if (!this._userMoved) this._applyFit();
    this._draw();
  }

  componentWillUnmount() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
  }

  // Public: re-frame the graph (Reset view button).
  resetView() {
    this._userMoved = false;
    this._applyFit();
    this._draw();
  }

  _measure() {
    const el = this.wrapRef.current;
    const cv = this.canvasRef.current;
    if (!el || !cv) return;
    this.w = el.clientWidth || 900;
    this.h = el.clientHeight || 560;
    this.dpr = window.devicePixelRatio || 1;
    cv.width = this.w * this.dpr;
    cv.height = this.h * this.dpr;
    cv.style.width = this.w + 'px';
    cv.style.height = this.h + 'px';
  }

  _init(props) {
    const data = props.data || {};
    const rawNodes = data.nodes || [];
    const idset = new Set(rawNodes.map((n) => n.id));
    const deg = {};
    (data.edges || []).forEach((e) => {
      if (idset.has(e.source) && idset.has(e.target)) {
        deg[e.source] = (deg[e.source] || 0) + 1;
        deg[e.target] = (deg[e.target] || 0) + 1;
      }
    });
    // Folder-group colors: a file and its folder share the folder id.
    const groups = new Map();
    const groupColor = (n) => {
      const key = n.kind === 'folder' ? n.folder_id || n.id : n.folder_id || 'root';
      if (!groups.has(key)) groups.set(key, PALETTE[groups.size % PALETTE.length]);
      return groups.get(key);
    };
    this.nodes = rawNodes.map((n, i) => {
      const a = i * 2.399963;
      const r = 12 * Math.sqrt(i);
      return {
        id: n.id,
        node: n,
        deg: deg[n.id] || 0,
        color: groupColor(n),
        x: r * Math.cos(a),
        y: r * Math.sin(a),
        vx: 0,
        vy: 0,
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
    this._visibleCache = null;
  }

  filterKind(n) {
    if (n.node.kind === 'folder') return 'folder';
    const t = n.node.type;
    return ['doc', 'image', 'video', 'audio'].includes(t) ? t : 'file';
  }

  radius(n) {
    return 4.5 + Math.min(10, Math.sqrt(n.deg) * 2.3);
  }

  // Set of visible node ids given type filters + local-graph focus/depth.
  _visible() {
    if (this._visibleCache) return this._visibleCache;
    const { kinds, focusId, depth } = this.props;
    let allowed = new Set(this.nodes.map((n) => n.id));
    if (focusId && this.byId[focusId]) {
      allowed = new Set([focusId]);
      let frontier = [focusId];
      for (let d = 0; d < (depth || 1); d++) {
        const next = [];
        for (const id of frontier) {
          for (const nb of this.adj[id]) {
            if (!allowed.has(nb)) {
              allowed.add(nb);
              next.push(nb);
            }
          }
        }
        frontier = next;
      }
    }
    const vis = new Set();
    for (const n of this.nodes) {
      if (!allowed.has(n.id)) continue;
      if (kinds && !kinds[this.filterKind(n)]) continue;
      vis.add(n.id);
    }
    this._visibleCache = vis;
    return vis;
  }

  _start() {
    cancelAnimationFrame(this._raf);
    const step = () => {
      this._simTick();
      if (!this._userMoved && !this._drag) this._applyFit();
      this._draw();
      const busy = this.alpha > ALPHA_MIN || this._drag;
      if (busy) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  _reheat(a = 0.4) {
    this.alpha = Math.max(this.alpha, a);
    this._start();
  }

  _applyFit() {
    const vis = this._visible();
    const pts = this.nodes.filter((n) => vis.has(n.id));
    if (!pts.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of pts) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }
    const pad = 96;
    const gw = maxX - minX || 1;
    const gh = maxY - minY || 1;
    this.k = Math.min(2.4, Math.max(0.15, Math.min((this.w - pad) / gw, (this.h - pad) / gh)));
    this.tx = -((minX + maxX) / 2) * this.k;
    this.ty = -((minY + maxY) / 2) * this.k;
  }

  _simTick() {
    const nodes = this.nodes;
    const a = this.alpha;
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
    for (const e of this.edges) {
      const dx = e.t.x - e.s.x;
      const dy = e.t.y - e.s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = ((d - LINK_DIST) / d) * a * 0.5;
      e.s.vx += dx * f;
      e.s.vy += dy * f;
      e.t.vx -= dx * f;
      e.t.vy -= dy * f;
    }
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

  // --- drawing -------------------------------------------------------------
  _draw() {
    const cv = this.canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const { w, h, k, tx, ty, dpr = 1 } = this;
    const vis = this._visible();
    const q = (this.props.query || '').trim().toLowerCase();
    const hover = this.hover;
    const neigh = hover ? this.adj[hover] : null;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (w / 2 + tx), dpr * (h / 2 + ty));

    // edges
    for (const e of this.edges) {
      if (!vis.has(e.source) || !vis.has(e.target)) continue;
      const active = hover && (e.source === hover || e.target === hover);
      const faded = hover && !active;
      ctx.beginPath();
      ctx.moveTo(e.s.x, e.s.y);
      ctx.lineTo(e.t.x, e.t.y);
      ctx.strokeStyle = e.provenance === 'inferred' ? INFERRED : EXTRACTED;
      ctx.globalAlpha = faded ? 0.1 : 0.7;
      ctx.lineWidth = (active ? 2 : 1) / k;
      if (e.provenance === 'inferred') ctx.setLineDash([4 / k, 3 / k]);
      else ctx.setLineDash([]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // nodes
    const showAll = vis.size <= 40 || k > 1.7;
    ctx.font = `${11 / k}px 'IBM Plex Sans',sans-serif`;
    ctx.textBaseline = 'middle';
    for (const n of this.nodes) {
      if (!vis.has(n.id)) continue;
      const r = this.radius(n);
      const isFolder = n.node.kind === 'folder';
      const active = n.id === hover;
      const isNeighbor = neigh && neigh.has(n.id);
      const match = q && n.node.label.toLowerCase().includes(q);
      const faded = (hover && !active && !isNeighbor) || (q && !match);
      ctx.globalAlpha = faded ? 0.2 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = this.props.colorByFolder ? n.color : isFolder ? PALETTE[0] : '#4C82F7';
      ctx.fill();
      ctx.lineWidth = (active || match ? 2.2 : 1.4) / k;
      ctx.strokeStyle = active ? TEXT : match ? '#E5484D' : FOLDER_RING;
      ctx.stroke();
      if (showAll || active || isNeighbor || match) {
        ctx.globalAlpha = faded ? 0.3 : 1;
        ctx.fillStyle = TEXT;
        const label = n.node.label.length > 24 ? n.node.label.slice(0, 23) + '…' : n.node.label;
        ctx.fillText(label, n.x + r + 3 / k, n.y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- interaction ---------------------------------------------------------
  _toSim(clientX, clientY) {
    const el = this.wrapRef.current.getBoundingClientRect();
    return {
      x: (clientX - el.left - this.w / 2 - this.tx) / this.k,
      y: (clientY - el.top - this.h / 2 - this.ty) / this.k,
    };
  }

  _hitNode(clientX, clientY) {
    const p = this._toSim(clientX, clientY);
    const vis = this._visible();
    let best = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      if (!vis.has(n.id)) continue;
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
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nk = Math.min(4, Math.max(0.2, this.k * factor));
    const el = this.wrapRef.current.getBoundingClientRect();
    const cx = e.clientX - el.left - this.w / 2;
    const cy = e.clientY - el.top - this.h / 2;
    this.tx = cx - ((cx - this.tx) * nk) / this.k;
    this.ty = cy - ((cy - this.ty) * nk) / this.k;
    this.k = nk;
    this._draw();
  };

  onPointerDown = (e) => {
    e.target.setPointerCapture?.(e.pointerId);
    this._downAt = { x: e.clientX, y: e.clientY, moved: false };
    const hit = this._hitNode(e.clientX, e.clientY);
    if (hit) {
      this._userMoved = true;
      this._drag = hit;
      this._reheat(0.3);
    } else {
      this._userMoved = true;
      this._pan = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty };
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
      this.tx = this._pan.tx + (e.clientX - this._pan.x);
      this.ty = this._pan.ty + (e.clientY - this._pan.y);
      this._draw();
      return;
    }
    const hit = this._hitNode(e.clientX, e.clientY);
    const id = hit ? hit.id : null;
    if (id !== this.hover) {
      this.hover = id;
      const cv = this.canvasRef.current;
      if (cv) cv.style.cursor = id ? 'pointer' : 'grab';
      this._draw();
    }
  };

  onPointerUp = (e) => {
    if (this._drag) {
      this._drag = null;
      this._reheat(0.08);
    }
    if (this._downAt && !this._downAt.moved) {
      const hit = this._hitNode(e.clientX, e.clientY);
      if (hit && this.props.onNodeClick) this.props.onNodeClick(hit.node);
    }
    this._pan = null;
    this._downAt = null;
  };

  render() {
    return (
      <div
        ref={this.wrapRef}
        onWheel={this.onWheel}
        onPointerDown={this.onPointerDown}
        onPointerMove={this.onPointerMove}
        onPointerUp={this.onPointerUp}
        onPointerLeave={() => {
          if (this.hover) {
            this.hover = null;
            this._draw();
          }
        }}
        style={{
          width: '100%',
          height: '60vh',
          minHeight: '340px',
          background: theme.surface2 || '#F6F7F9',
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          overflow: 'hidden',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <canvas ref={this.canvasRef} style={{ display: 'block' }} />
      </div>
    );
  }
}
