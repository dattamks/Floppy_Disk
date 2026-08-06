import React from 'react';
import { theme } from '../lib/theme';

// A hand-built spreadsheet grid tuned to the app's design system: windowed rows
// (stays smooth at thousands of rows), full keyboard navigation, per-type inline
// editors, column resize, and add row/column. Presentational only - all writes
// go up through callbacks so the parent owns optimistic state + persistence.

const ROW_H = 36;
const HEADER_H = 40;
const GUTTER_W = 52;
const DEFAULT_W = 180;
const OVERSCAN = 6;

const TYPE_LABEL = {
  text: 'Text', long_text: 'Long text', number: 'Number',
  checkbox: 'Checkbox', single_select: 'Select', date: 'Date',
};

function choiceOf(field, id) {
  return (field.options?.choices || []).find((c) => c.id === id) || null;
}

// Read-only rendering of a cell's value for a given field type.
function CellValue({ field, value }) {
  if (value === undefined || value === null || value === '') return null;
  if (field.type === 'checkbox') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" fill={theme.brand} />
        <path d="M7 12.5l3.2 3.2L17 8.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (field.type === 'single_select') {
    const c = choiceOf(field, value);
    if (!c) return null;
    return (
      <span style={{
        fontSize: '12px', fontWeight: 600, color: theme.text,
        background: c.color || theme.surface2, borderRadius: '999px', padding: '2px 10px',
        whiteSpace: 'nowrap',
      }}>{c.name}</span>
    );
  }
  return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(value)}</span>;
}

export default function TableGrid({
  fields, rows, widths, onResize,
  onEditCell, onAddRow, onAddField, onDeleteRow, onRenameField, onDeleteField,
}) {
  const scrollRef = React.useRef(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewH, setViewH] = React.useState(480);
  const [sel, setSel] = React.useState({ r: 0, c: 0 });          // selected cell
  const [editing, setEditing] = React.useState(null);            // {r,c} or null
  const [draft, setDraft] = React.useState('');
  const [menuField, setMenuField] = React.useState(null);        // header menu open for field id
  const [selectOpen, setSelectOpen] = React.useState(false);     // single-select popover

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setViewH(el.clientHeight || 480);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const colW = (f) => widths[f.id] || (f.is_primary ? 220 : DEFAULT_W);
  const totalW = GUTTER_W + fields.reduce((a, f) => a + colW(f), 0) + 44;

  // Windowing: only render the rows near the viewport.
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);
  const visible = rows.slice(start, end);

  const cellVal = (row, field) => row.data?.[field.id];

  const startEdit = (r, c, seed) => {
    const field = fields[c];
    if (!field || field.type === 'checkbox') return;
    if (field.type === 'single_select') { setSel({ r, c }); setSelectOpen(true); return; }
    setEditing({ r, c });
    setDraft(seed !== undefined ? seed : (rows[r]?.data?.[field.id] ?? ''));
  };
  const commit = (move) => {
    if (!editing) return;
    const field = fields[editing.c];
    const row = rows[editing.r];
    if (field && row) onEditCell(row.id, field.id, draft);
    setEditing(null);
    if (move) moveSel(move.dr, move.dc);
  };
  const moveSel = (dr, dc) => {
    setSel((s) => ({
      r: Math.max(0, Math.min(rows.length - 1, s.r + dr)),
      c: Math.max(0, Math.min(fields.length - 1, s.c + dc)),
    }));
  };

  const toggleCheckbox = (r, c) => {
    const field = fields[c]; const row = rows[r];
    if (field && row) onEditCell(row.id, field.id, !cellVal(row, field));
  };

  const onKeyDown = (e) => {
    if (editing || selectOpen) return; // editors handle their own keys
    const { r, c } = sel;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1, 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1, 0); }
    else if (e.key === 'ArrowRight' || e.key === 'Tab') { e.preventDefault(); moveSel(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSel(0, -1); }
    else if (e.key === 'Enter') { e.preventDefault(); const f = fields[c]; if (f?.type === 'checkbox') toggleCheckbox(r, c); else startEdit(r, c); }
    else if (e.key === ' ' && fields[c]?.type === 'checkbox') { e.preventDefault(); toggleCheckbox(r, c); }
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      const f = fields[c]; const row = rows[r];
      if (f && row && f.type !== 'checkbox') onEditCell(row.id, f.id, '');
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      startEdit(r, c, e.key); // type-to-edit
    }
  };

  // Keep the selected cell scrolled into view vertically.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = sel.r * ROW_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_H > el.scrollTop + el.clientHeight - HEADER_H) el.scrollTop = top + ROW_H - el.clientHeight + HEADER_H;
  }, [sel.r]);

  // ---- column resize (drag the header's right edge) ----
  const dragRef = React.useRef(null);
  const onResizeDown = (field, e) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { id: field.id, startX: e.clientX, startW: colW(field) };
    const move = (ev) => {
      const d = dragRef.current;
      if (d) onResize(d.id, Math.max(80, d.startW + (ev.clientX - d.startX)));
    };
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const headerCell = (field, c) => (
    <div key={field.id} style={{
      position: 'relative', width: colW(field), flex: `0 0 ${colW(field)}px`, height: HEADER_H,
      display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px',
      borderRight: `1px solid ${theme.border}`, boxSizing: 'border-box', background: theme.surface2,
    }}>
      <span style={{ fontSize: '12.5px', fontWeight: 600, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={`${field.name} · ${TYPE_LABEL[field.type] || field.type}`}>
        {field.name}
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={() => setMenuField(menuField === field.id ? null : field.id)} aria-label={`${field.name} column menu`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textFaint, display: 'flex', padding: '2px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg>
      </button>
      {menuField === field.id ? (
        <div style={{ position: 'absolute', top: HEADER_H - 2, right: 4, zIndex: 30, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '9px', boxShadow: '0 10px 30px rgba(16,24,40,0.16)', padding: '5px', minWidth: '150px' }}>
          <button onClick={() => { const name = window.prompt('Rename column', field.name); if (name) onRenameField(field.id, name.trim()); setMenuField(null); }}
            style={menuItem}>Rename</button>
          {!field.is_primary ? (
            <button onClick={() => { onDeleteField(field.id); setMenuField(null); }} style={{ ...menuItem, color: theme.danger }}>Delete column</button>
          ) : null}
        </div>
      ) : null}
      <div onMouseDown={(e) => onResizeDown(field, e)}
        style={{ position: 'absolute', top: 0, right: -3, width: '7px', height: '100%', cursor: 'col-resize', zIndex: 5 }} />
    </div>
  );

  const renderCell = (row, r, field, c) => {
    const isSel = sel.r === r && sel.c === c;
    const isEditing = editing && editing.r === r && editing.c === c;
    const w = colW(field);
    const base = {
      width: w, flex: `0 0 ${w}px`, height: ROW_H, boxSizing: 'border-box',
      borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`,
      padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: '13px',
      color: theme.text, cursor: 'default', position: 'relative',
      outline: isSel ? `2px solid ${theme.brand}` : 'none', outlineOffset: '-2px',
      background: isSel ? theme.white : 'transparent',
    };
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
            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit()}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit({ dr: 1, dc: 0 }); }}
              style={{ ...inputStyle, resize: 'none', padding: '8px 10px', position: 'absolute', inset: 0, minHeight: '84px', zIndex: 20, borderRadius: '4px', boxShadow: '0 6px 20px rgba(16,24,40,0.18)' }} />
          ) : (
            <input autoFocus type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit()} onKeyDown={commonKey} style={inputStyle} />
          )}
        </div>
      );
    }
    return (
      <div key={field.id} data-r={r} data-c={c} style={base}
        onMouseDown={() => setSel({ r, c })}
        onDoubleClick={() => (field.type === 'checkbox' ? toggleCheckbox(r, c) : startEdit(r, c))}>
        {field.type === 'checkbox' ? (
          <button onClick={() => toggleCheckbox(r, c)} aria-label="Toggle" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            {cellVal(row, field) ? <CellValue field={field} value={true} /> : <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.6px solid ${theme.borderStrong2 || theme.border}`, display: 'block' }} />}
          </button>
        ) : (
          <CellValue field={field} value={cellVal(row, field)} />
        )}
        {isSel && selectOpen && field.type === 'single_select' ? (
          <div style={{ position: 'absolute', top: ROW_H - 2, left: 0, zIndex: 30, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '9px', boxShadow: '0 10px 30px rgba(16,24,40,0.18)', padding: '5px', minWidth: w }}>
            {(field.options?.choices || []).map((ch) => (
              <button key={ch.id} onClick={() => { onEditCell(row.id, field.id, ch.id); setSelectOpen(false); }} style={menuItem}>
                <span style={{ fontSize: '12px', fontWeight: 600, background: ch.color || theme.surface2, borderRadius: '999px', padding: '2px 10px' }}>{ch.name}</span>
              </button>
            ))}
            <button onClick={() => { onEditCell(row.id, field.id, ''); setSelectOpen(false); }} style={{ ...menuItem, color: theme.textMuted }}>Clear</button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onClick={() => { if (menuField) setMenuField(null); }}
      data-testid="table-grid"
      style={{ flex: 1, overflow: 'auto', outline: 'none', border: `1px solid ${theme.border}`, borderRadius: '10px', background: theme.white, position: 'relative' }}
    >
      <div style={{ minWidth: totalW }}>
        {/* Header */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ width: GUTTER_W, flex: `0 0 ${GUTTER_W}px`, height: HEADER_H, background: theme.surface2, borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }} />
          {fields.map((f, c) => (
            <React.Fragment key={f.id}>{headerCell(f, c)}</React.Fragment>
          ))}
          <button onClick={onAddField} title="Add column" aria-label="Add column"
            style={{ width: 44, flex: '0 0 44px', height: HEADER_H, background: theme.surface2, border: 'none', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        {/* Body (windowed) */}
        <div style={{ position: 'relative', height: rows.length * ROW_H }}>
          {visible.map((row, i) => {
            const r = start + i;
            return (
              <div key={row.id} style={{ position: 'absolute', top: r * ROW_H, left: 0, display: 'flex', height: ROW_H }}>
                <div data-gutter-r={r} style={{ width: GUTTER_W, flex: `0 0 ${GUTTER_W}px`, height: ROW_H, borderRight: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: theme.textFaint, fontSize: '11px', background: theme.white }}
                  className="fd-row-gutter">
                  <span className="fd-row-num">{r + 1}</span>
                  <button onClick={() => onDeleteRow(row.id)} aria-label={`Delete row ${r + 1}`} className="fd-row-del"
                    style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: theme.textFaint, padding: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
                  </button>
                </div>
                {fields.map((f, c) => renderCell(row, r, f, c))}
              </div>
            );
          })}
        </div>
      </div>
      {/* Add-row bar pinned under the body */}
      <button onClick={onAddRow} data-testid="add-row"
        style={{ position: 'sticky', bottom: 0, left: 0, width: '100%', height: 34, background: theme.white, borderTop: `1px solid ${theme.border}`, cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', fontSize: '13px', fontWeight: 600, zIndex: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        New row
      </button>
      <style>{`
        [data-testid="table-grid"] .fd-row-gutter:hover .fd-row-num { display: none; }
        [data-testid="table-grid"] .fd-row-gutter:hover .fd-row-del { display: flex !important; }
      `}</style>
    </div>
  );
}

const menuItem = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  background: 'none', border: 'none', cursor: 'pointer', padding: '7px 9px',
  fontSize: '13px', color: theme.text, borderRadius: '6px', fontFamily: 'inherit',
};
