import React from 'react';
import { theme } from '../lib/theme';
import { Pill, Stars } from './TableGrid';
import { COMPUTED_TYPES } from '../lib/tableCompute';

// An expanded, focused view of a single row: every field as a labeled editor
// (not squeezed into a grid cell), with prev/next navigation across the rows.
// Presentational + optimistic like the grid - all writes flow through the same
// onEditCell the grid uses, so undo, persistence, and the graph stay in sync.

const NUMERIC_INPUT = new Set(['number', 'currency', 'percent']);

// A text/number/date editor with a local draft, committed on blur or Enter so
// we don't fire a save per keystroke. Remounts (via the body key) on row change.
function TextEditor({ field, value, onCommit }) {
  const [draft, setDraft] = React.useState(value ?? '');
  const type = NUMERIC_INPUT.has(field.type) ? 'number' : field.type === 'date' ? 'date' : 'text';
  const commit = () => { const norm = draft === '' ? '' : draft; if (String(norm) !== String(value ?? '')) onCommit(draft); };
  return (
    <input type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      inputMode={NUMERIC_INPUT.has(field.type) ? 'decimal' : undefined}
      placeholder={field.type === 'url' ? 'https://…' : field.type === 'email' ? 'name@example.com' : ''}
      style={inputStyle} aria-label={field.name} />
  );
}

function LongTextEditor({ field, value, onCommit }) {
  const [draft, setDraft] = React.useState(value ?? '');
  return (
    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== (value ?? '')) onCommit(draft); }}
      rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 84, lineHeight: 1.5 }} aria-label={field.name} />
  );
}

function FieldEditor({ field, row, files, relLabels, computed, onEditCell }) {
  const value = row.data?.[field.id];
  const set = (v) => onEditCell(row.id, field.id, v);

  if (COMPUTED_TYPES.has(field.type)) {
    const out = computed(field, row);
    return <div style={{ ...readOnlyBox }}>{out !== '' && out != null ? out : <span style={{ color: theme.textFaint }}>—</span>}</div>;
  }
  if (field.type === 'checkbox') {
    return (
      <button onClick={() => set(!value)} aria-label={field.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>
        {value ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" fill={theme.brand} /><path d="M7 12.5l3.2 3.2L17 8.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <span style={{ width: 20, height: 20, borderRadius: 5, border: `1.7px solid ${theme.borderStrong2 || theme.border}`, display: 'block' }} />
        )}
        <span style={{ fontSize: '13px', color: theme.textMuted }}>{value ? 'Checked' : 'Unchecked'}</span>
      </button>
    );
  }
  if (field.type === 'rating') {
    return <Stars value={value} max={field.options?.max || 5} onSet={(v) => set(v || '')} />;
  }
  if (field.type === 'long_text') {
    return <LongTextEditor field={field} value={value} onCommit={set} />;
  }
  if (field.type === 'single_select') {
    const choices = field.options?.choices || [];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {choices.map((ch) => {
          const on = value === ch.id;
          return (
            <button key={ch.id} onClick={() => set(on ? '' : ch.id)} aria-label={ch.name}
              style={{ ...chipBtn, outline: on ? `2px solid ${theme.brand}` : 'none', outlineOffset: 1, opacity: on || !value ? 1 : 0.55 }}>
              <Pill c={ch} />
            </button>
          );
        })}
      </div>
    );
  }
  if (field.type === 'multi_select') {
    const choices = field.options?.choices || [];
    const arr = Array.isArray(value) ? value : [];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {choices.map((ch) => {
          const on = arr.includes(ch.id);
          return (
            <button key={ch.id} onClick={() => { const next = on ? arr.filter((x) => x !== ch.id) : [...arr, ch.id]; set(next.length ? next : ''); }} aria-label={ch.name}
              style={{ ...chipBtn, outline: on ? `2px solid ${theme.brand}` : 'none', outlineOffset: 1, opacity: on ? 1 : 0.55 }}>
              <Pill c={ch} />
            </button>
          );
        })}
      </div>
    );
  }
  if (field.type === 'attachment') {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div style={pickList}>
        {files.length === 0 ? <div style={emptyPick}>No files to attach yet.</div> : files.map((f) => {
          const on = arr.includes(f.id);
          return (
            <button key={f.id} onClick={() => { const next = on ? arr.filter((x) => x !== f.id) : [...arr, f.id]; set(next.length ? next : ''); }} style={pickItem}>
              <span style={{ width: 14, color: theme.brand, flex: '0 0 14px' }}>{on ? '✓' : ''}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            </button>
          );
        })}
      </div>
    );
  }
  if (field.type === 'relation') {
    const map = relLabels[field.options?.table_id] || {};
    const arr = Array.isArray(value) ? value : [];
    const entries = Object.entries(map);
    return (
      <div style={pickList}>
        {entries.length === 0 ? <div style={emptyPick}>No rows to link.</div> : entries.map(([rid, label]) => {
          const on = arr.includes(rid);
          return (
            <button key={rid} onClick={() => { const next = on ? arr.filter((x) => x !== rid) : [...arr, rid]; set(next.length ? next : ''); }} style={pickItem}>
              <span style={{ width: 14, color: theme.brand, flex: '0 0 14px' }}>{on ? '✓' : ''}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return <TextEditor field={field} value={value} onCommit={set} />;
}

export default function RowDetailModal({ row, fields, index, total, files = [], relLabels = {}, computed = () => '', onEditCell, onDeleteRow, onNavigate, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => {
      const t = e.target; const tag = t && t.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable);
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (typing) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); onNavigate(-1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); onNavigate(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate]);

  const primary = fields.find((f) => f.is_primary) || fields[0];
  const title = (primary && String(row.data?.[primary.id] || '').trim()) || 'Untitled';

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-label="Row detail" data-testid="row-detail">
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '16px', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} data-testid="row-detail-title">{title}</span>
          <span style={{ fontSize: '12px', color: theme.textFaint, whiteSpace: 'nowrap' }}>Row {index + 1} of {total}</span>
          <button onClick={() => onNavigate(-1)} disabled={index <= 0} aria-label="Previous row" style={{ ...navBtn, opacity: index <= 0 ? 0.4 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={() => onNavigate(1)} disabled={index >= total - 1} aria-label="Next row" style={{ ...navBtn, opacity: index >= total - 1 ? 0.4 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={onClose} aria-label="Close" style={navBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div style={body} key={row.id}>
          {fields.map((f) => (
            <div key={f.id} style={fieldRow}>
              <label style={fieldLabel} title={f.name}>{f.name}</label>
              <div style={{ minWidth: 0 }}>
                <FieldEditor field={f} row={row} files={files} relLabels={relLabels} computed={computed} onEditCell={onEditCell} />
              </div>
            </div>
          ))}
        </div>

        <div style={footer}>
          <button onClick={onDeleteRow} data-testid="row-detail-delete" style={{ ...ghostBtn, color: theme.danger, borderColor: theme.dangerBorder2 || theme.border }}>Delete row</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} data-testid="row-detail-done" style={primaryBtn}>Done</button>
        </div>
      </div>
    </div>
  );
}

const overlay = { position: 'absolute', inset: 0, background: 'rgba(20,23,28,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 45, padding: 16 };
const card = { width: 560, maxWidth: '96%', maxHeight: '88%', background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(16,24,40,0.3)', overflow: 'hidden' };
const header = { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: `1px solid ${theme.border}` };
const body = { padding: '8px 18px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column' };
const fieldRow = { display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, alignItems: 'start', padding: '11px 0', borderBottom: `1px solid ${theme.surface2}` };
const fieldLabel = { fontSize: '12.5px', fontWeight: 600, color: theme.textMuted, paddingTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const footer = { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: `1px solid ${theme.border}` };
const inputStyle = { width: '100%', boxSizing: 'border-box', border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '8px 11px', fontSize: '13.5px', color: theme.text, background: theme.white, outline: 'none', fontFamily: 'inherit' };
const readOnlyBox = { padding: '8px 0', fontSize: '13.5px', color: theme.textMuted };
const chipBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: '999px', display: 'inline-flex', fontFamily: 'inherit' };
const pickList = { border: `1px solid ${theme.border}`, borderRadius: '10px', maxHeight: 180, overflowY: 'auto', padding: 4 };
const pickItem = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 8px', fontSize: '13px', color: theme.text, borderRadius: '7px', fontFamily: 'inherit' };
const emptyPick = { padding: '10px', fontSize: '12.5px', color: theme.textFaint };
const navBtn = { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.white, color: theme.textMuted, cursor: 'pointer', flex: '0 0 auto' };
const primaryBtn = { background: theme.brand, color: theme.white, border: 'none', borderRadius: '9px', padding: '8px 16px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn = { background: theme.white, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
