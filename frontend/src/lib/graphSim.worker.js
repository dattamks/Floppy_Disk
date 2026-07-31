/* Graph force simulation in a Web Worker (Vite-bundled, client-side - no server
 * or deployment impact). Runs the Barnes-Hut O(n log n) physics OFF the main
 * thread so the UI stays at 60fps while a large graph settles. The main thread
 * owns rendering + interaction; this worker owns positions.
 *
 * Protocol
 *   in:  {type:'init', xs, ys, edges, params}   // xs/ys seed positions, edges = flat [s0,t0,...]
 *        {type:'params', charge, linkDist, center}
 *        {type:'drag', i, x, y} / {type:'dragEnd'}
 *   out: {type:'tick', pos, alpha}               // pos = Float32Array [x0,y0,x1,y1,...]
 */
const DAMP = 0.82;
const ALPHA_MIN = 0.004;
const ALPHA_DECAY = 0.965;
const THETA2 = 0.81;

let P = [];
let E = [];
let params = { charge: 2600, linkDist: 80, center: 0.02 };
let alpha = 0;
let dragI = -1;
let timer = null;

function makeCell(x, y, size) {
  return { x, y, size, mass: 0, cx: 0, cy: 0, node: null, children: null };
}
function qtInsert(cell, n) {
  const m = cell.mass;
  cell.cx = (cell.cx * m + n.x) / (m + 1);
  cell.cy = (cell.cy * m + n.y) / (m + 1);
  cell.mass = m + 1;
  if (m === 0) {
    cell.node = n;
    return;
  }
  if (!cell.children) {
    if (cell.size < 0.5) return;
    cell.children = [null, null, null, null];
    const old = cell.node;
    cell.node = null;
    qtPlace(cell, old);
  }
  qtPlace(cell, n);
}
function qtPlace(cell, n) {
  const half = cell.size / 2;
  const qx = n.x >= cell.x + half ? 1 : 0;
  const qy = n.y >= cell.y + half ? 1 : 0;
  const idx = qy * 2 + qx;
  if (!cell.children[idx]) cell.children[idx] = makeCell(cell.x + qx * half, cell.y + qy * half, half);
  qtInsert(cell.children[idx], n);
}
function qtBuild(nodes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    if (n.x < x0) x0 = n.x;
    if (n.y < y0) y0 = n.y;
    if (n.x > x1) x1 = n.x;
    if (n.y > y1) y1 = n.y;
  }
  if (!isFinite(x0)) return null;
  const root = makeCell(x0, y0, Math.max(x1 - x0, y1 - y0, 1) + 1);
  for (const n of nodes) qtInsert(root, n);
  return root;
}
function qtForce(cell, n, a, charge) {
  if (!cell || cell.mass === 0) return;
  let dx = cell.cx - n.x;
  let dy = cell.cy - n.y;
  let d2 = dx * dx + dy * dy;
  const leaf = !cell.children;
  if (leaf && cell.node === n) return;
  if (leaf || cell.size * cell.size < THETA2 * d2) {
    if (d2 < 0.01) {
      dx = (Math.random() - 0.5) * 0.1;
      dy = (Math.random() - 0.5) * 0.1;
      d2 = dx * dx + dy * dy + 0.01;
    }
    const d = Math.sqrt(d2);
    const f = (charge * a * cell.mass) / d2;
    n.vx += (-dx / d) * f;
    n.vy += (-dy / d) * f;
    return;
  }
  for (let i = 0; i < 4; i++) qtForce(cell.children[i], n, a, charge);
}

function step() {
  const a = alpha;
  const { charge, linkDist, center } = params;
  const root = qtBuild(P);
  for (let i = 0; i < P.length; i++) {
    if (i !== dragI) qtForce(root, P[i], a, charge);
  }
  for (const e of E) {
    const ns = P[e[0]];
    const nt = P[e[1]];
    const dx = nt.x - ns.x;
    const dy = nt.y - ns.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const f = ((d - linkDist) / d) * a * 0.5;
    ns.vx += dx * f;
    ns.vy += dy * f;
    nt.vx -= dx * f;
    nt.vy -= dy * f;
  }
  for (let i = 0; i < P.length; i++) {
    if (i === dragI) continue;
    const n = P[i];
    n.vx -= n.x * center * a;
    n.vy -= n.y * center * a;
    n.vx *= DAMP;
    n.vy *= DAMP;
    n.x += n.vx;
    n.y += n.vy;
  }
  alpha *= ALPHA_DECAY;

  const pos = new Float32Array(P.length * 2);
  for (let i = 0; i < P.length; i++) {
    pos[i * 2] = P[i].x;
    pos[i * 2 + 1] = P[i].y;
  }
  self.postMessage({ type: 'tick', pos, alpha }, [pos.buffer]);
}

function run() {
  if (timer) return;
  const loop = () => {
    step();
    if (alpha > ALPHA_MIN || dragI >= 0) timer = setTimeout(loop, 16);
    else timer = null;
  };
  timer = setTimeout(loop, 0);
}

self.addEventListener('message', (e) => {
  const m = e.data;
  if (m.type === 'init') {
    P = [];
    for (let i = 0; i < m.xs.length; i++) P.push({ x: m.xs[i], y: m.ys[i], vx: 0, vy: 0 });
    E = [];
    for (let i = 0; i < m.edges.length; i += 2) E.push([m.edges[i], m.edges[i + 1]]);
    if (m.params) params = m.params;
    alpha = 1;
    dragI = -1;
    run();
  } else if (m.type === 'params') {
    params = { charge: m.charge, linkDist: m.linkDist, center: m.center };
    alpha = Math.max(alpha, 0.5);
    run();
  } else if (m.type === 'drag') {
    dragI = m.i;
    if (P[m.i]) {
      P[m.i].x = m.x;
      P[m.i].y = m.y;
      P[m.i].vx = 0;
      P[m.i].vy = 0;
    }
    alpha = Math.max(alpha, 0.3);
    run();
  } else if (m.type === 'dragEnd') {
    dragI = -1;
    alpha = Math.max(alpha, 0.1);
    run();
  }
});
