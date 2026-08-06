import React from 'react';
import { theme } from '../lib/theme';

// A hand-built spreadsheet grid tuned to the app's design system: windowed rows
// (smooth at thousands), full keyboard nav, per-type inline editors, column
// resize + sort, row multi-select (click / shift-click / drag), bulk delete,
// copy (Ctrl/Cmd+C) and undo (Ctrl/Cmd+Z). Presentational: all writes and the
// undo history are owned by the parent; rows arrive already sorted for display.

const ROW_H = 36;
const HEADER_H = 40;
const GUTTER_W = 58;
const DEFAULT_W = 180;
const OVERSCAN = 6;

const TYPE_LABEL = {
  text: 'Text', long_text: 'Long text', number: 'Number', checkbox: 'Checkbox',
  single_select: 'Select', multi_select: 'Multi-select', date: 'Date',
  url: 'URL', email: 'Email', rating: 'Rating', currency: 'Currency', percent: 'Percent',
};

function choiceOf(field, id) {
  return (field.options?.choices || []).find((c) => c.id === id) || null;
}
function fmtNum(field, value) {
  if (field.type === 'currency') return `${field.options?.symbol || '$'}${value}`;
  if (field.type === 'percent') return `${value}%`;
  return String(value);
}

// Plain-text rendering of a cell value (for copy/TSV).
export function plainValue(field, value) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return '';
  if (field.type === 'checkbox') return value ? 'true' : 'false';
  if (field.type === 'single_select') { const c = choiceOf(field, value); return c ? c.name : ''; }
  if (field.type === 'multi_select') return (value || []).map((id) => choiceOf(field, id)?.name || '').filter(Boolean).join(', ');
  if (field.type === 'currency' || field.type === 'percent') return fmtNum(field, value);
  return String(value);
}

function Pill({ c }) {
  return <span style={{ fontSize: '12px', fontWeight: 600, color: theme.text, background: c.color || theme.surface2, borderRadius: '999px', padding: '2px 10px', whiteSpace: 'nowrap' }}>{c.name}</span>;
}

function CellValue({ field, value }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return null;
  const t = field.type;
  if (t === 'checkbox') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" fill={theme.brand} />
        <path d="M7 12.5l3.2 3.2L17 8.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (t === 'single_select') { const c = choiceOf(field, value); return c ? <Pill c={c} /> : null; }
  if (t === 'multi_select') {
    return (
      <span style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
        {(value || []).map((id) => { const c = choiceOf(field, id); return c ? <Pill key={id} c={c} /> : null; })}
      </span>
    );
  }
  if (t === 'url' || t === 'email') {
    const href = t === 'email' ? `mailto:${value}` : (/^https?:\/\//.test(value) ? value : `https://${value}`);
    return <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: theme.brand, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(value)}</a>;
  }
  if (t === 'currency' || t === 'percent') return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtNum(field, value)}</span>;
  return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(value)}</span>;
}

function Stars({ value, max, onSet }) {
  const v = Number(value) || 0;
  return (
    <span style={{ display: 'flex', gap: 1 }} onMouseDown={(e) => e.stopPropagation()}>
      {Array.from({ length: max }).map((_, i) => (
        <button key={i} aria-label={`Rate ${i + 1}`} data-filled={i < v ? '1' : undefined} onClick={(e) => { e.stopPropagation(); onSet(i + 1 === v ? 0 : i + 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: i < v ? theme.star : (theme.borderStrong2 || theme.border) }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={i < v ? theme.star : 'none'}><path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </button>
      ))}
    </span>
  );
}

export default function TableGrid({
  fields, rows, widths, onResize, sort, onSortToggle,
  selectedIds, onSelectionChange,
  onEditCell, onAddRow, onAddField, onDeleteRows, onRenameField, onDeleteField, onUndo,
}) {
  const scrollRef = React.useRef(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewH, setViewH] = React.useState(480);
  const [sel, setSel] = React.useState({ r: 0, c: 0 });
  const [editing, setEditing] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const [menuField, setMenuField] = React.useState(null);
  const [selectOpen, setSelectOpen] = React.useState(false);
  const dragAnchorRef = React.useRef(null);  // where a drag-select began (display index)
  const selAnchorRef = React.useRef(null);   // last clicked row, for shift-click ranges
  const movedRef = React.useRef(false);      // did the mouse drag across rows?
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setViewH(el.clientHeight || 480);
    measure();
    const up = () => { draggingRef.current = false; };
    window.addEventListener('resize', measure);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('mouseup', up); };
  }, []);

  const colW = (f) => widths[f.id] || (f.is_primary ? 220 : DEFAULT_W);
  const totalW = GUTTER_W + fields.reduce((a, f) => a + colW(f), 0) + 44;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);
  const visible = rows.slice(start, end);
  const cellVal = (row, field) => row.data?.[field.id];
  const selCount = selectedIds ? selectedIds.size : 0;

  // ---- row selection ----
  const rangeIds = (i, j) => {
    const [a, b] = i < j ? [i, j] : [j, i];
    return rows.slice(a, b + 1).map((r) => r.id);
  };
  // Selection is click-driven (single / shift-range / cmd-toggle); a mouse drag
  // across the gutter paints a range. Click and drag are kept separate so a
  // plain click can never be mistaken for a range.
  const gutterDown = (e, i) => { e.preventDefault(); dragAnchorRef.current = i; draggingRef.current = true; movedRef.current = false; };
  const gutterEnter = (i) => {
    if (draggingRef.current && dragAnchorRef.current != null && i !== dragAnchorRef.current) {
      movedRef.current = true;
      onSelectionChange(new Set(rangeIds(dragAnchorRef.current, i)));
    }
  };
  const gutterClick = (e, i, id) => {
    if (movedRef.current) { movedRef.current = false; selAnchorRef.current = i; return; } // a drag, already applied
    if (e.shiftKey && selAnchorRef.current != null) {
      onSelectionChange(new Set(rangeIds(selAnchorRef.current, i)));
    } else if (e.metaKey || e.ctrlKey) {
      const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id);
      onSelectionChange(s); selAnchorRef.current = i;
    } else {
      onSelectionChange(new Set([id])); selAnchorRef.current = i;
    }
  };
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleAll = () => onSelectionChange(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  // ---- copy ----
  const doCopy = () => {
    let text = '';
    if (selCount) {
      const chosen = rows.filter((r) => selectedIds.has(r.id));
      const head = fields.map((f) => f.name).join('\t');
      const body = chosen.map((r) => fields.map((f) => plainValue(f, cellVal(r, f))).join('\t')).join('\n');
      text = `${head}\n${body}`;
    } else {
      const f = fields[sel.c]; const r = rows[sel.r];
      if (f && r) text = plainValue(f, cellVal(r, f));
    }
    if (text && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  };

  // ---- editing ----
  const startEdit = (r, c, seed) => {
    const field = fields[c];
    if (!field || field.type === 'checkbox' || field.type === 'rating') return;
    if (field.type === 'single_select' || field.type === 'multi_select') { setSel({ r, c }); setSelectOpen(true); return; }
    setEditing({ r, c });
    setDraft(seed !== undefined ? seed : (rows[r]?.data?.[field.id] ?? ''));
  };
  const commit = (move) => {
    if (!editing) return;
    const field = fields[editing.c]; const row = rows[editing.r];
    if (field && row) onEditCell(row.id, field.id, draft);
    setEditing(null);
    if (move) moveSel(move.dr, move.dc);
  };
  const moveSel = (dr, dc) => setSel((s) => ({
    r: Math.max(0, Math.min(rows.length - 1, s.r + dr)),
    c: Math.max(0, Math.min(fields.length - 1, s.c + dc)),
  }));
  const toggleCheckbox = (r, c) => {
    const field = fields[c]; const row = rows[r];
    if (field && row) onEditCell(row.id, field.id, !cellVal(row, field));
  };

  const onKeyDown = (e) => {
    if (editing || selectOpen) return;
    const k = e.key.toLowerCase();
    // Undo is handled at the page level (works even when focus left the grid).
    if ((e.metaKey || e.ctrlKey) && k === 'c') { e.preventDefault(); doCopy(); return; }
    if ((e.metaKey || e.ctrlKey) && k === 'a') { e.preventDefault(); onSelectionChange(new Set(rows.map((r) => r.id))); return; }
    if (selCount && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); onDeleteRows([...selectedIds]); return; }
    if (e.key === 'Escape' && selCount) { onSelectionChange(new Set()); return; }
    const { r, c } = sel;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1, 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1, 0); }
    else if (e.key === 'ArrowRight' || e.key === 'Tab') { e.preventDefault(); moveSel(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSel(0, -1); }
    else if (e.key === 'Enter') { e.preventDefault(); const f = fields[c]; if (f?.type === 'checkbox') toggleCheckbox(r, c); else startEdit(r, c); }
    else if (e.key === ' ' && fields[c]?.type === 'checkbox') { e.preventDefault(); toggleCheckbox(r, c); }
    else if (fields[c]?.type === 'rating' && /^[0-9]$/.test(e.key)) { e.preventDefault(); const row = rows[r]; if (row) onEditCell(row.id, fields[c].id, Number(e.key) || ''); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { const f = fields[c]; const row = rows[r]; if (f && row && f.type !== 'checkbox') onEditCell(row.id, f.id, ''); }
    else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) startEdit(r, c, e.key);
  };

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = sel.r * ROW_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_H > el.scrollTop + el.clientHeight - HEADER_H) el.scrollTop = top + ROW_H - el.clientHeight + HEADER_H;
  }, [sel.r]);

  // ---- column resize ----
  const dragRef = React.useRef(null);
  const onResizeDown = (field, e) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { id: field.id, startX: e.clientX, startW: colW(field) };
    const move = (ev) => { const d = dragRef.current; if (d) onResize(d.id, Math.max(80, d.startW + (ev.clientX - d.startX))); };
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  const sortArrow = (fid) => {
    if (!sort || sort.field !== fid) return null;
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" style={{ flex: '0 0 auto' }}>
        <path d={sort.dir === 'asc' ? 'M12 8l5 6H7z' : 'M12 16l-5-6h10z'} fill={theme.brand} />
      </svg>
    );
  };

  const headerCell = (field, c) => (
    <div key={field.id} style={{ position: 'relative', width: colW(field), flex: `0 0 ${colW(field)}px`, height: HEADER_H, display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', borderRight: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.surface2 }}>
      <button onClick={() => onSortToggle(field.id)} title={`Sort by ${field.name}`} aria-label={`Sort by ${field.name}`}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, minWidth: 0, flex: 1, textAlign: 'left' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${field.name} · ${TYPE_LABEL[field.type] || field.type}`}>{field.name}</span>
        {sortArrow(field.id)}
      </button>
      <button onClick={() => setMenuField(menuField === field.id ? null : field.id)} aria-label={`${field.name} column menu`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textFaint, display: 'flex', padding: '2px', flex: '0 0 auto' }}>
        <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg>
      </button>
      {menuField === field.id ? (
        <div style={{ position: 'absolute', top: HEADER_H - 2, right: 4, zIndex: 30, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '9px', boxShadow: '0 10px 30px rgba(16,24,40,0.16)', padding: '5px', minWidth: '160px' }}>
          <button onClick={() => { onSortToggle(field.id, 'asc'); setMenuField(null); }} style={menuItem}>Sort ascending</button>
          <button onClick={() => { onSortToggle(field.id, 'desc'); setMenuField(null); }} style={menuItem}>Sort descending</button>
          <button onClick={() => { const name = window.prompt('Rename column', field.name); if (name) onRenameField(field.id, name.trim()); setMenuField(null); }} style={menuItem}>Rename</button>
          {!field.is_primary ? (<button onClick={() => { onDeleteField(field.id); setMenuField(null); }} style={{ ...menuItem, color: theme.danger }}>Delete column</button>) : null}
        </div>
      ) : null}
      <div onMouseDown={(e) => onResizeDown(field, e)} style={{ position: 'absolute', top: 0, right: -3, width: '7px', height: '100%', cursor: 'col-resize', zIndex: 5 }} />
    </div>
  );

  const renderCell = (row, r, field, c) => {
    const isSel = sel.r === r && sel.c === c;
    const isEditing = editing && editing.r === r && editing.c === c;
    const w = colW(field);
    const base = { width: w, flex: `0 0 ${w}px`, height: ROW_H, boxSizing: 'border-box', borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: '13px', color: theme.text, position: 'relative', outline: isSel ? `2px solid ${theme.brand}` : 'none', outlineOffset: '-2px', background: isSel ? theme.white : 'transparent' };
    if (isEditing) {
      const commonKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit({ dr: 1, dc: 0 }); }
        else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
        else if (e.key === 'Tab') { e.preventDefault(); commit({ dr: 0, dc: e.shiftKey ? -1 : 1 }); }
      };
      const inputStyle = { width: '100%', height: '100%', border: 'none', outline: 'none', background: theme.white, fontSize: '13px', color: theme.text, fontFamily: 'inherit' };
      return (
        <div key={field.id} data-r={r} data-c={c} style={{ ...base, padding: field.type === 'long_text' ? 0 : base.padding, outline: `2px solid ${theme.brand}`, background: theme.white }}>
          {field.type === 'long_text' ? (
            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit()} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit({ dr: 1, dc: 0 }); }} style={{ ...inputStyle, resize: 'none', padding: '8px 10px', position: 'absolute', inset: 0, minHeight: '84px', zIndex: 20, borderRadius: '4px', boxShadow: '0 6px 20px rgba(16,24,40,0.18)' }} />
          ) : (
            <input autoFocus type={['number', 'currency', 'percent'].includes(field.type) ? 'number' : field.type === 'date' ? 'date' : 'text'} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit()} onKeyDown={commonKey} style={inputStyle} />
          )}
        </div>
      );
    }
    return (
      <div key={field.id} data-r={r} data-c={c} style={base} onMouseDown={() => setSel({ r, c })} onDoubleClick={() => (field.type === 'checkbox' ? toggleCheckbox(r, c) : startEdit(r, c))}>
        {field.type === 'checkbox' ? (
          <button onClick={() => toggleCheckbox(r, c)} aria-label="Toggle" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            {cellVal(row, field) ? <CellValue field={field} value /> : <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.6px solid ${theme.borderStrong2 || theme.border}`, display: 'block' }} />}
          </button>
        ) : field.type === 'rating' ? (
          <Stars value={cellVal(row, field)} max={field.options?.max || 5} onSet={(v) => onEditCell(row.id, field.id, v || '')} />
        ) : (<CellValue field={field} value={cellVal(row, field)} />)}
        {isSel && selectOpen && field.type === 'single_select' ? (
          <div style={{ position: 'absolute', top: ROW_H - 2, left: 0, zIndex: 30, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '9px', boxShadow: '0 10px 30px rgba(16,24,40,0.18)', padding: '5px', minWidth: w }}>
            {(field.options?.choices || []).map((ch) => (
              <button key={ch.id} onClick={() => { onEditCell(row.id, field.id, ch.id); setSelectOpen(false); }} style={menuItem}><Pill c={ch} /></button>
            ))}
            <button onClick={() => { onEditCell(row.id, field.id, ''); setSelectOpen(false); }} style={{ ...menuItem, color: theme.textMuted }}>Clear</button>
          </div>
        ) : null}
        {isSel && selectOpen && field.type === 'multi_select' ? (
          <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: ROW_H - 2, left: 0, zIndex: 30, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '9px', boxShadow: '0 10px 30px rgba(16,24,40,0.18)', padding: '5px', minWidth: w }}>
            {(field.options?.choices || []).map((ch) => {
              const arr = Array.isArray(cellVal(row, field)) ? cellVal(row, field) : [];
              const on = arr.includes(ch.id);
              return (
                <button key={ch.id} onClick={() => { const next = on ? arr.filter((x) => x !== ch.id) : [...arr, ch.id]; onEditCell(row.id, field.id, next.length ? next : ''); }} style={menuItem}>
                  <span style={{ width: 14, display: 'inline-flex', color: theme.brand }}>{on ? '✓' : ''}</span><Pill c={ch} />
                </button>
              );
            })}
            <button onClick={() => setSelectOpen(false)} style={{ ...menuItem, color: theme.textMuted, justifyContent: 'center' }}>Done</button>
          </div>
        ) : null}
      </div>
    );
  };

  const checkboxIcon = (on) => (
    on ? (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" fill={theme.brand} /><path d="M7 12.5l3.2 3.2L17 8.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) : (
      <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.6px solid ${theme.borderStrong2 || theme.border}`, display: 'block' }} />
    )
  );

  return (
    <div ref={scrollRef} tabIndex={0} onKeyDown={onKeyDown} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} onClick={() => { if (menuField) setMenuField(null); }} data-testid="table-grid"
      style={{ flex: 1, overflow: 'auto', outline: 'none', border: `1px solid ${theme.border}`, borderRadius: '10px', background: theme.white, position: 'relative' }}>
      <div style={{ minWidth: totalW }}>
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ width: GUTTER_W, flex: `0 0 ${GUTTER_W}px`, height: HEADER_H, background: theme.surface2, borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={toggleAll} aria-label={allSelected ? 'Clear selection' : 'Select all rows'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>{checkboxIcon(allSelected)}</button>
          </div>
          {fields.map((f, c) => (<React.Fragment key={f.id}>{headerCell(f, c)}</React.Fragment>))}
          <button onClick={onAddField} title="Add column" aria-label="Add column" style={{ width: 44, flex: '0 0 44px', height: HEADER_H, background: theme.surface2, border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ position: 'relative', height: rows.length * ROW_H }}>
          {visible.map((row, i) => {
            const r = start + i;
            const rowSelected = selectedIds.has(row.id);
            return (
              <div key={row.id} className={`fd-row${rowSelected ? ' fd-sel-on' : ''}`} style={{ position: 'absolute', top: r * ROW_H, left: 0, display: 'flex', height: ROW_H, background: rowSelected ? theme.brandBg : 'transparent' }}>
                <div data-gutter-r={r} onMouseDown={(e) => gutterDown(e, r)} onMouseEnter={() => gutterEnter(r)} onClick={(e) => gutterClick(e, r, row.id)}
                  style={{ width: GUTTER_W, flex: `0 0 ${GUTTER_W}px`, height: ROW_H, borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: theme.textFaint, fontSize: '11px', background: rowSelected ? theme.brandBg : theme.white, cursor: 'pointer', userSelect: 'none' }}>
                  <span className="fd-check" style={{ display: rowSelected ? 'flex' : 'none' }}>{checkboxIcon(rowSelected)}</span>
                  <span className="fd-num" style={{ display: rowSelected ? 'none' : 'block' }}>{r + 1}</span>
                </div>
                {fields.map((f, c) => renderCell(row, r, f, c))}
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={onAddRow} data-testid="add-row" style={{ position: 'sticky', bottom: 0, left: 0, width: '100%', height: 34, background: theme.white, borderTop: `1px solid ${theme.border}`, cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', fontSize: '13px', fontWeight: 600, zIndex: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        New row
      </button>
      <style>{`
        [data-testid="table-grid"] .fd-row:hover .fd-num { display: none !important; }
        [data-testid="table-grid"] .fd-row:hover .fd-check { display: flex !important; }
      `}</style>
    </div>
  );
}

const menuItem = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  background: 'none', border: 'none', cursor: 'pointer', padding: '7px 9px',
  fontSize: '13px', color: theme.text, borderRadius: '6px', fontFamily: 'inherit',
};
