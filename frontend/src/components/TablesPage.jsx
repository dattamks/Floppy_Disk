import React from 'react';
import { theme } from '../lib/theme';
import { api, firstError } from '../api';
import TableGrid, { plainValue } from './TableGrid';

// Tables: a first-class full-page surface. Shows the list of tables, and opens
// one into the hand-built grid. Owns optimistic row/field state, sorting,
// selection, an undo stack, and persistence; the grid is presentational.

const TYPES = [
  ['text', 'Text'], ['long_text', 'Long text'], ['number', 'Number'],
  ['checkbox', 'Checkbox'], ['single_select', 'Select'], ['date', 'Date'],
];
const NUMERIC = new Set(['number', 'currency', 'percent', 'rating']);

function choiceName(field, id) {
  return (field.options?.choices || []).find((c) => c.id === id)?.name || '';
}
function compareRows(field, a, b) {
  const va = a.data?.[field.id]; const vb = b.data?.[field.id];
  const ea = va === undefined || va === null || va === ''; const eb = vb === undefined || vb === null || vb === '';
  if (ea && eb) return 0; if (ea) return 1; if (eb) return -1;   // empties sort last
  if (NUMERIC.has(field.type)) return Number(va) - Number(vb);
  if (field.type === 'checkbox') return (va ? 1 : 0) - (vb ? 1 : 0);
  if (field.type === 'single_select') return choiceName(field, va).localeCompare(choiceName(field, vb));
  return String(va).localeCompare(String(vb));
}

export default function TablesPage({ V }) {
  const toast = V?.showToast || (() => {});
  const [tables, setTables] = React.useState(null);
  const [listError, setListError] = React.useState(false);
  const [open, setOpen] = React.useState(null);
  const [rows, setRows] = React.useState([]);
  const [loadingTable, setLoadingTable] = React.useState(false);
  const [widths, setWidths] = React.useState({});
  const [addField, setAddField] = React.useState(null);
  const [sort, setSort] = React.useState(null);           // { field, dir }
  const [selected, setSelected] = React.useState(new Set());
  const undoRef = React.useRef([]);

  const loadList = React.useCallback(() => {
    setListError(false);
    api.listTables().then(setTables).catch(() => { setTables([]); setListError(true); });
  }, []);
  React.useEffect(() => { loadList(); }, [loadList]);

  const resetOpenState = () => { setSelected(new Set()); undoRef.current = []; };

  const openTable = (id) => {
    setLoadingTable(true);
    Promise.all([api.getTable(id), api.tableRows(id)])
      .then(([t, rws]) => {
        setOpen(t); setRows(rws); resetOpenState();
        setWidths(t.views?.[0]?.config?.widths || {});
        setSort(t.views?.[0]?.config?.sort || null);
      })
      .catch((e) => toast(firstError(e, 'Could not open table')))
      .finally(() => setLoadingTable(false));
  };

  const newTable = () => {
    api.createTable({ name: 'Untitled table' })
      .then((t) => { setOpen(t); setWidths({}); setSort(null); resetOpenState(); return api.tableRows(t.id).then(setRows); })
      .catch((e) => toast(firstError(e, 'Could not create table')));
  };
  const backToList = () => { setOpen(null); setRows([]); resetOpenState(); loadList(); };

  const renameTable = (name) => {
    if (!open || !name.trim() || name === open.name) return;
    const prev = open.name;
    setOpen((o) => ({ ...o, name }));
    api.updateTable(open.id, { name: name.trim() }).catch((e) => { setOpen((o) => ({ ...o, name: prev })); toast(firstError(e, 'Could not rename')); });
  };
  const deleteTable = () => {
    if (!open || !window.confirm(`Move "${open.name}" to trash?`)) return;
    const id = open.id; backToList();
    api.deleteTable(id).then(() => toast('Table moved to trash')).catch((e) => { toast(firstError(e, 'Could not delete')); loadList(); });
  };

  // ---- undo stack ----
  const pushUndo = (fn) => { undoRef.current.push(fn); if (undoRef.current.length > 50) undoRef.current.shift(); };
  const doUndo = () => { const fn = undoRef.current.pop(); if (fn) Promise.resolve(fn()).catch(() => {}); };

  // Ctrl/Cmd+Z undoes the last table edit - handled on the page so it works even
  // after focus left the grid (e.g. clicking the bulk-delete bar). Ignored while
  // typing in a field so native input undo still works there.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const t = e.target;
      const tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- cell / row edits (optimistic, undoable) ----
  const editCell = (rowId, fieldId, value, record = true) => {
    const prevRow = rows.find((r) => r.id === rowId);
    const prev = prevRow ? prevRow.data?.[fieldId] : undefined;
    setRows((rs) => rs.map((r) => {
      if (r.id !== rowId) return r;
      const data = { ...(r.data || {}) };
      if (value === '' || value === null || value === undefined) delete data[fieldId]; else data[fieldId] = value;
      return { ...r, data };
    }));
    if (record) pushUndo(() => editCell(rowId, fieldId, prev === undefined ? '' : prev, false));
    api.updateRow(rowId, { [fieldId]: value })
      .then((saved) => setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, data: saved.data } : r))))
      .catch((e) => toast(firstError(e, 'Could not save cell')));
  };

  const addRow = (record = true) => {
    api.createRow(open.id, {}).then((row) => {
      setRows((rs) => [...rs, row]);
      if (record) pushUndo(() => deleteRows([row.id], false));
    }).catch((e) => toast(firstError(e, 'Could not add row')));
  };

  const deleteRows = (ids, record = true) => {
    const removed = rows.filter((r) => ids.includes(r.id));
    setRows((rs) => rs.filter((r) => !ids.includes(r.id)));
    setSelected(new Set());
    // Record the inverse up front so Ctrl+Z is available immediately (not only
    // after the network round-trip).
    if (record) {
      pushUndo(async () => {
        for (const r of removed.slice().sort((a, b) => a.position - b.position)) {
          const nr = await api.createRow(open.id, r.data);
          setRows((rs) => [...rs, nr]);
        }
      });
    }
    const call = ids.length === 1 ? api.deleteRow(ids[0]) : api.bulkDeleteRows(open.id, ids);
    call.catch((e) => { toast(firstError(e, 'Could not delete rows')); openTable(open.id); });
  };

  // ---- fields ----
  const submitAddField = () => {
    const body = { name: (addField.name || 'Field').trim() || 'Field', type: addField.type };
    if (body.type === 'single_select') {
      body.options = { choices: [
        { id: 'o1', name: 'Option 1', color: '#DBEAFE' },
        { id: 'o2', name: 'Option 2', color: '#DCFCE7' },
      ] };
    }
    api.createField(open.id, body).then((f) => { setOpen((o) => ({ ...o, fields: [...o.fields, f] })); setAddField(null); })
      .catch((e) => toast(firstError(e, 'Could not add column')));
  };
  const renameField = (fieldId, name) => {
    setOpen((o) => ({ ...o, fields: o.fields.map((f) => (f.id === fieldId ? { ...f, name } : f)) }));
    api.updateField(fieldId, { name }).catch((e) => toast(firstError(e, 'Could not rename column')));
  };
  const deleteField = (fieldId) => {
    setOpen((o) => ({ ...o, fields: o.fields.filter((f) => f.id !== fieldId) }));
    api.deleteField(fieldId).catch((e) => { toast(firstError(e, 'Could not delete column')); openTable(open.id); });
  };

  // ---- sorting ----
  const persistSort = (next) => {
    if (open?.views?.[0]) api.updateView(open.views[0].id, { config: { ...(open.views[0].config || {}), sort: next } }).catch(() => {});
  };
  const onSortToggle = (fieldId, forceDir) => {
    setSort((prev) => {
      let next;
      if (forceDir) next = { field: fieldId, dir: forceDir };
      else if (!prev || prev.field !== fieldId) next = { field: fieldId, dir: 'asc' };
      else if (prev.dir === 'asc') next = { field: fieldId, dir: 'desc' };
      else next = null;
      persistSort(next);
      return next;
    });
  };
  const displayRows = React.useMemo(() => {
    if (!sort || !open) return rows;
    const field = open.fields.find((f) => f.id === sort.field);
    if (!field) return rows;
    const sorted = rows.slice().sort((a, b) => compareRows(field, a, b));
    return sort.dir === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sort, open]);

  // ---- resize persistence ----
  const resize = (fieldId, w) => setWidths((x) => ({ ...x, [fieldId]: w }));
  React.useEffect(() => {
    if (!open?.views?.[0]) return undefined;
    const t = setTimeout(() => { api.updateView(open.views[0].id, { config: { ...(open.views[0].config || {}), widths } }).catch(() => {}); }, 600);
    return () => clearTimeout(t);
  }, [widths]); // eslint-disable-line react-hooks/exhaustive-deps

  const copySelected = () => {
    if (!selected.size) return;
    const chosen = displayRows.filter((r) => selected.has(r.id));
    const head = open.fields.map((f) => f.name).join('\t');
    const body = chosen.map((r) => open.fields.map((f) => plainValue(f, r.data?.[f.id])).join('\t')).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(`${head}\n${body}`).then(() => toast(`Copied ${chosen.length} row${chosen.length === 1 ? '' : 's'}`)).catch(() => {});
  };

  const page = { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, padding: '20px 22px', gap: '14px', overflow: 'hidden' };

  if (open) {
    return (
      <div style={page} data-testid="table-open">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={backToList} aria-label="Back to tables" style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <input defaultValue={open.name} key={open.id} onBlur={(e) => renameTable(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Table name"
            style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '20px', color: theme.text, border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 0 }} />
          <span style={{ fontSize: '12.5px', color: theme.textFaint }}>{rows.length} row{rows.length === 1 ? '' : 's'}</span>
          <button onClick={deleteTable} style={{ ...iconBtn, color: theme.danger }} aria-label="Delete table" title="Delete table">
            <svg width="17" height="17" viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" /></svg>
          </button>
        </div>

        {selected.size > 0 ? (
          <div data-testid="row-selection-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: theme.brandBg, border: `1px solid ${theme.brandBorder || theme.border}` }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: theme.brand }}>{selected.size} selected</span>
            <div style={{ flex: 1 }} />
            <button onClick={copySelected} style={barBtn}>Copy</button>
            <button onClick={() => deleteRows([...selected])} data-testid="bulk-delete" style={{ ...barBtn, color: theme.danger, borderColor: theme.dangerBorder2 || theme.border }}>Delete</button>
            <button onClick={() => setSelected(new Set())} style={barBtn}>Clear</button>
          </div>
        ) : null}

        <TableGrid
          fields={open.fields}
          rows={displayRows}
          widths={widths}
          onResize={resize}
          sort={sort}
          onSortToggle={onSortToggle}
          selectedIds={selected}
          onSelectionChange={setSelected}
          onEditCell={editCell}
          onAddRow={() => addRow()}
          onDeleteRows={(ids) => deleteRows(ids)}
          onAddField={() => setAddField({ name: '', type: 'text' })}
          onRenameField={renameField}
          onDeleteField={deleteField}
          onUndo={doUndo}
        />

        {addField ? (
          <div role="dialog" aria-label="Add column" style={overlay} onClick={() => setAddField(null)}>
            <div onClick={(e) => e.stopPropagation()} style={popover}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '15px' }}>New column</span>
              <input autoFocus placeholder="Column name" value={addField.name} onChange={(e) => setAddField((a) => ({ ...a, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') submitAddField(); }} style={input} aria-label="Column name" />
              <select value={addField.type} onChange={(e) => setAddField((a) => ({ ...a, type: e.target.value }))} style={input} aria-label="Column type">
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setAddField(null)} style={btnGhost}>Cancel</button>
                <button onClick={submitAddField} style={btnPrimary}>Add column</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={page} data-testid="tables-list">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '22px', color: theme.text }}>Tables</span>
        <div style={{ flex: 1 }} />
        <button onClick={newTable} data-testid="new-table" style={btnPrimary}>
          <svg width="15" height="15" viewBox="0 0 24 24" style={{ marginRight: 6, verticalAlign: '-2px' }}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          New table
        </button>
      </div>
      {tables === null ? (
        <div style={{ color: theme.textFaint, fontSize: '13.5px', padding: '20px 2px' }}>Loading tables…</div>
      ) : listError ? (
        <div style={{ color: theme.textMuted, fontSize: '13.5px' }}>Couldn’t load tables. <button onClick={loadList} style={{ ...btnGhost, padding: '4px 10px' }}>Retry</button></div>
      ) : tables.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', color: theme.textMuted, textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke={theme.borderStrong2 || theme.border} strokeWidth="1.6" /><path d="M3.5 9.5h17M9 9.5v10" stroke={theme.border} strokeWidth="1.4" /></svg>
          <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text }}>No tables yet</div>
          <div style={{ fontSize: '13.5px' }}>Create a table to track anything — tasks, inventory, a CRM.</div>
          <button onClick={newTable} style={btnPrimary}>New table</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px', overflowY: 'auto', paddingBottom: 8 }}>
          {tables.map((t) => (
            <button key={t.id} onClick={() => openTable(t.id)} data-testid="table-card" style={{ textAlign: 'left', background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 92 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: theme.brandBg, color: theme.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M3.5 9.5h17M9 9.5v10" stroke="currentColor" strokeWidth="1.4" /></svg>
                </span>
                <span style={{ fontWeight: 600, fontSize: '14.5px', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              </div>
              <span style={{ fontSize: '12px', color: theme.textFaint }}>{t.row_count} row{t.row_count === 1 ? '' : 's'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtn = { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.white, color: theme.textMuted, cursor: 'pointer', flex: '0 0 auto' };
const barBtn = { background: theme.white, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '6px 13px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnPrimary = { background: theme.brand, color: theme.white, border: 'none', borderRadius: '9px', padding: '9px 16px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { background: theme.white, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 14px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const overlay = { position: 'absolute', inset: 0, background: 'rgba(20,23,28,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 };
const popover = { width: 320, maxWidth: '92%', background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '11px', boxShadow: '0 24px 60px rgba(16,24,40,0.28)' };
const input = { width: '100%', boxSizing: 'border-box', border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 11px', fontSize: '13.5px', color: theme.text, background: theme.white, outline: 'none', fontFamily: 'inherit' };
