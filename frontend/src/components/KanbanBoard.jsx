import React from 'react';
import { theme } from '../lib/theme';
import { Pill, CellValue } from './TableGrid';
import { COMPUTED_TYPES } from '../lib/tableCompute';

// A Kanban board over a single-select field: one column per choice (plus an
// "Uncategorized" column for empty), cards you drag between columns to change
// that field. Cards open the same row-detail modal the grid uses; every write
// flows through the same onEditCell, so undo / persistence / graph stay in sync.

function CardValue({ field, value, relLabels }) {
  const t = field.type;
  if (['single_select', 'multi_select', 'checkbox', 'url', 'email', 'currency', 'percent'].includes(t)) {
    return <CellValue field={field} value={value} />;
  }
  if (t === 'rating') return <span>{`${value}/${field.options?.max || 5}`}</span>;
  if (t === 'attachment') return <span>{`${(value || []).length} file${(value || []).length === 1 ? '' : 's'}`}</span>;
  if (t === 'relation') {
    const map = relLabels[field.options?.table_id] || {};
    const names = (value || []).map((id) => map[id]).filter(Boolean);
    return <span>{names.length ? names.join(', ') : `${(value || []).length} linked`}</span>;
  }
  return <span>{String(value)}</span>;
}

export default function KanbanBoard({ fields, rows, field, files = [], relLabels = {}, computed = () => '', cardFieldIds = null, onSetColumn, onOpenRow, onAddCard }) {
  const [dragId, setDragId] = React.useState(null);
  const [overKey, setOverKey] = React.useState(null);
  const choices = field.options?.choices || [];

  const columns = [
    ...choices.map((c) => ({ key: c.id, name: c.name, color: c.color })),
    { key: '', name: 'Uncategorized', color: null },
  ];
  const byCol = {};
  columns.forEach((col) => { byCol[col.key] = []; });
  rows.forEach((row) => {
    const v = row.data?.[field.id];
    const k = v && choices.some((c) => c.id === v) ? v : '';
    byCol[k].push(row);
  });

  const primary = fields.find((f) => f.is_primary) || fields[0];
  // Which fields show on a card is a per-board choice (card curation). The parent
  // supplies the id list (already defaulted); render them in that order.
  const previewFields = (cardFieldIds || []).map((id) => fields.find((f) => f.id === id)).filter(Boolean);

  const drop = (colKey) => { if (dragId != null) onSetColumn(dragId, colKey); setDragId(null); setOverKey(null); };

  return (
    <div data-testid="kanban-board" style={{ flex: 1, display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden', padding: '2px 2px 6px', minHeight: 0 }}>
      {columns.map((col) => {
        const active = overKey === col.key;
        return (
          <div key={col.key} data-kanban-col={col.key}
            onDragOver={(e) => { e.preventDefault(); if (overKey !== col.key) setOverKey(col.key); }}
            onDrop={(e) => { e.preventDefault(); drop(col.key); }}
            style={{ width: 272, flex: '0 0 272px', display: 'flex', flexDirection: 'column', minHeight: 0, background: active ? theme.brandBg : theme.surface2, border: `1px solid ${active ? (theme.brandBorder || theme.brand) : theme.border}`, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px 8px' }}>
              {col.key ? <Pill c={{ name: col.name, color: col.color }} /> : <span style={{ fontSize: '12.5px', fontWeight: 700, color: theme.textMuted }}>{col.name}</span>}
              <span style={{ fontSize: '11.5px', color: theme.textFaint }}>{byCol[col.key].length}</span>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byCol[col.key].map((row) => (
                <div key={row.id} data-kanban-card={row.id} draggable
                  onDragStart={() => setDragId(row.id)} onDragEnd={() => { setDragId(null); setOverKey(null); }}
                  onClick={() => onOpenRow(row.id)}
                  style={{ background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 11px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(16,24,40,0.05)', opacity: dragId === row.id ? 0.5 : 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text, marginBottom: previewFields.length ? 6 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(row.data?.[primary?.id] || '').trim() || <span style={{ color: theme.textFaint }}>Untitled</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {previewFields.map((f) => {
                      const v = row.data?.[f.id];
                      const isComputed = COMPUTED_TYPES.has(f.type);
                      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
                      if (!isComputed && empty) return null;
                      return (
                        <div key={f.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '11.5px', color: theme.textMuted, minWidth: 0 }}>
                          <span style={{ color: theme.textFaint, flex: '0 0 auto' }}>{f.name}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {isComputed ? (computed(f, row) || '—') : <CardValue field={f} value={v} relLabels={relLabels} />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button data-kanban-add={col.key} onClick={() => onAddCard(col.key)} aria-label={`Add card to ${col.name}`}
                style={{ background: 'none', border: `1px dashed ${theme.borderStrong2 || theme.border}`, borderRadius: 9, padding: '7px', fontSize: '12px', fontWeight: 600, color: theme.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add card
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
