import React from 'react';
import { theme } from '../lib/theme';
import { api, firstError } from '../api';
import TableGrid, { plainValue } from './TableGrid';
import RowDetailModal from './RowDetailModal';
import KanbanBoard from './KanbanBoard';
import { computeCell, COMPUTED_TYPES } from '../lib/tableCompute';
import { filterRows, opsForType, opNeedsValue, OP_LABELS } from '../lib/tableFilter';
import { groupRows, isGroupable } from '../lib/tableGroup';

// Tables: a first-class full-page surface. Shows the list of tables, and opens
// one into the hand-built grid. Owns optimistic row/field state, sorting,
// selection, an undo stack, and persistence; the grid is presentational.

const TYPES = [
  ['text', 'Text'], ['long_text', 'Long text'], ['number', 'Number'],
  ['checkbox', 'Checkbox'], ['single_select', 'Select'], ['multi_select', 'Multi-select'],
  ['date', 'Date'], ['url', 'URL'], ['email', 'Email'], ['rating', 'Rating'],
  ['currency', 'Currency'], ['percent', 'Percent'], ['attachment', 'Attachment'],
  ['relation', 'Relation'], ['formula', 'Formula'], ['lookup', 'Lookup'], ['rollup', 'Rollup'],
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
  const [filters, setFilters] = React.useState([]);       // [{ field, op, value }]
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [groupBy, setGroupBy] = React.useState(null);     // fieldId | null
  const [groupMenu, setGroupMenu] = React.useState(false);
  const [collapsedGroups, setCollapsedGroups] = React.useState(new Set());
  const [activeViewId, setActiveViewId] = React.useState(null); // which saved view is open
  const [kanbanField, setKanbanField] = React.useState(null); // single_select fieldId for board columns
  const [addViewMenu, setAddViewMenu] = React.useState(false);
  const [cardsMenu, setCardsMenu] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set());
  const [expandedId, setExpandedId] = React.useState(null); // row id shown in the detail modal
  const [files, setFiles] = React.useState([]);           // owner's files, for attachment cells
  const [relLabels, setRelLabels] = React.useState({});   // {targetTableId: {rowId: label}} for relation cells
  const [relRows, setRelRows] = React.useState({});       // {targetTableId: {rowId: data}} for lookups/rollups
  const [relFields, setRelFields] = React.useState({});   // {targetTableId: [fields]}
  const [openTabs, setOpenTabs] = React.useState([]);     // [tableId,...] — open tabs, in order
  const cacheRef = React.useRef({});                      // {id: {table, rows}} for instant tab switch
  const activeIdRef = React.useRef(null);                 // guards async refresh against fast tab switches
  const undoRef = React.useRef([]);
  const controlsRef = React.useRef(null);

  const loadFiles = () => api.listFiles().then((fs) => setFiles(fs || [])).catch(() => {});
  // For each relation field, load the target table's rows so we can show/pick
  // them by their primary label.
  const loadRelTargets = (fields) => {
    const ids = [...new Set((fields || []).filter((f) => f.type === 'relation').map((f) => f.options?.table_id).filter(Boolean))];
    ids.forEach((tid) => {
      Promise.all([api.getTable(tid), api.tableRows(tid)]).then(([t, rws]) => {
        const primary = t.fields.find((f) => f.is_primary);
        const labels = {}; const data = {};
        rws.forEach((r, i) => {
          labels[r.id] = (primary && String(r.data?.[primary.id] || '').trim()) || `Row ${i + 1}`;
          data[r.id] = r.data || {};
        });
        setRelLabels((prev) => ({ ...prev, [tid]: labels }));
        setRelRows((prev) => ({ ...prev, [tid]: data }));
        setRelFields((prev) => ({ ...prev, [tid]: t.fields }));
      }).catch(() => {});
    });
  };

  const loadList = React.useCallback(() => {
    setListError(false);
    api.listTables().then(setTables).catch(() => { setTables([]); setListError(true); });
  }, []);
  React.useEffect(() => { loadList(); }, [loadList]);

  const resetOpenState = () => { setSelected(new Set()); setExpandedId(null); setCollapsedGroups(new Set()); setGroupMenu(false); setFilterOpen(false); setAddViewMenu(false); setCardsMenu(false); undoRef.current = []; };

  // Load a saved view's config into the working state. The view's kind (grid /
  // kanban) drives the layout; its config carries filters/sort/group/widths so
  // each view is independent.
  const applyViewState = (view) => {
    const cfg = view?.config || {};
    setWidths(cfg.widths || {});
    setSort(cfg.sort || null);
    setFilters(cfg.filters || []);
    setGroupBy(cfg.groupBy || null);
    setKanbanField(cfg.kanbanField || null);
    setCollapsedGroups(new Set());
  };

  // Snapshot the active table's live state so switching back to its tab is
  // instant (no refetch) and doesn't lose unsaved-to-cache edits.
  const snapshotActive = () => {
    if (!open) return;
    flushWidths();  // persist a pending column resize before we leave this table
    // Bake the live widths into the cached table so an instant switch-back shows
    // them immediately (the background refetch confirms them shortly after).
    const av = activeView;
    const table = av
      ? { ...open, views: (open.views || []).map((v) => (v.id === av.id ? { ...v, config: { ...(v.config || {}), widths } } : v)) }
      : open;
    cacheRef.current[open.id] = { table, rows };
  };
  // Activate a table's data + its first saved view. View config (widths / sort /
  // filters / group / kanban field) is carried on the table object and applied
  // via applyViewState, so a cached table restores its full working state.
  const applyTable = (t, rws) => {
    setOpen(t); setRows(rws); resetOpenState();
    setActiveViewId(t.views?.[0]?.id || null);
    applyViewState(t.views?.[0]);
    loadRelTargets(t.fields);
  };

  // Open a table in a tab and make it active. Instant from cache when possible,
  // with a background refresh; otherwise fetch.
  const openTable = (id) => {
    if (open?.id === id) return;
    snapshotActive();
    activeIdRef.current = id;
    setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]));
    loadFiles(); loadList();
    const cached = cacheRef.current[id];
    if (cached) {
      applyTable(cached.table, cached.rows);
    } else {
      setLoadingTable(true);
    }
    Promise.all([api.getTable(id), api.tableRows(id)])
      .then(([t, rws]) => {
        cacheRef.current[id] = { table: t, rows: rws };
        if (activeIdRef.current === id) applyTable(t, rws);
      })
      .catch((e) => { if (!cached) toast(firstError(e, 'Could not open table')); })
      .finally(() => setLoadingTable(false));
  };

  const newTable = () => {
    loadFiles(); loadList();
    api.createTable({ name: 'Untitled table' })
      .then((t) => {
        snapshotActive();
        activeIdRef.current = t.id;
        setOpenTabs((tabs) => [...tabs, t.id]);
        cacheRef.current[t.id] = { table: t, rows: [] };
        setOpen(t); resetOpenState();
        setActiveViewId(t.views?.[0]?.id || null);
        applyViewState(t.views?.[0]);
        loadList();  // refresh the sidebar list now that the new table exists
        return api.tableRows(t.id).then((rws) => { if (cacheRef.current[t.id]) cacheRef.current[t.id].rows = rws; if (activeIdRef.current === t.id) setRows(rws); });
      })
      .catch((e) => toast(firstError(e, 'Could not create table')));
  };
  // Re-fetch the active table from the server (used to recover after a failed
  // optimistic edit); openTable() early-returns for the active id, so this is
  // the explicit refresh path.
  const refreshActive = () => {
    const id = open?.id;
    if (!id) return;
    Promise.all([api.getTable(id), api.tableRows(id)]).then(([t, rws]) => {
      cacheRef.current[id] = { table: t, rows: rws };
      if (activeIdRef.current === id) applyTable(t, rws);
    }).catch(() => {});
  };
  // Deactivate (show the tables list) without closing any tab.
  const backToList = () => { snapshotActive(); activeIdRef.current = null; setOpen(null); setRows([]); resetOpenState(); loadList(); };
  // Close a tab; if it was active, fall back to the neighbouring tab.
  const closeTab = (id) => {
    delete cacheRef.current[id];
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== id);
      if (open?.id === id) {
        const idx = tabs.indexOf(id);
        const neighbour = next[idx] || next[idx - 1] || null;
        if (neighbour) setTimeout(() => openTable(neighbour), 0);
        else { activeIdRef.current = null; setOpen(null); setRows([]); resetOpenState(); }
      }
      return next;
    });
  };

  const renameTable = (name) => {
    if (!open || !name.trim() || name === open.name) return;
    const prev = open.name; const nm = name.trim();
    const id = open.id;
    setOpen((o) => ({ ...o, name: nm }));
    if (cacheRef.current[id]) cacheRef.current[id].table = { ...cacheRef.current[id].table, name: nm };
    setTables((ts) => (ts || []).map((t) => (t.id === id ? { ...t, name: nm } : t)));  // keep sidebar + tabs live
    api.updateTable(id, { name: nm }).catch((e) => {
      setOpen((o) => ({ ...o, name: prev }));
      setTables((ts) => (ts || []).map((t) => (t.id === id ? { ...t, name: prev } : t)));
      toast(firstError(e, 'Could not rename'));
    });
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

  // Dismiss the filter / group / add-view popovers on an outside click or Escape.
  React.useEffect(() => {
    if (!filterOpen && !groupMenu && !addViewMenu && !cardsMenu) return undefined;
    const close = () => { setFilterOpen(false); setGroupMenu(false); setAddViewMenu(false); setCardsMenu(false); };
    const onDown = (e) => { if (controlsRef.current && !controlsRef.current.contains(e.target) && !e.target.closest?.('[data-testid="view-tabs"]')) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [filterOpen, groupMenu, addViewMenu, cardsMenu]);

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
      // Reconcile only the field we wrote (using the server's coerced value), so
      // an out-of-order response can't clobber another cell edited concurrently.
      .then((saved) => setRows((rs) => rs.map((r) => {
        if (r.id !== rowId) return r;
        const data = { ...(r.data || {}) };
        if (saved.data && Object.prototype.hasOwnProperty.call(saved.data, fieldId)) data[fieldId] = saved.data[fieldId];
        else delete data[fieldId];
        return { ...r, data };
      })))
      .catch((e) => toast(firstError(e, 'Could not save cell')));
  };

  const addRow = (preset = {}, record = true) => {
    api.createRow(open.id, preset).then((row) => {
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
    call.catch((e) => { toast(firstError(e, 'Could not delete rows')); refreshActive(); });
  };

  // ---- fields ----
  const submitAddField = () => {
    const body = { name: (addField.name || 'Field').trim() || 'Field', type: addField.type };
    if (body.type === 'single_select' || body.type === 'multi_select') {
      body.options = { choices: [
        { id: 'o1', name: 'Option 1', color: '#DBEAFE' },
        { id: 'o2', name: 'Option 2', color: '#DCFCE7' },
        { id: 'o3', name: 'Option 3', color: '#FEF3C7' },
      ] };
    } else if (body.type === 'rating') {
      body.options = { max: 5 };
    } else if (body.type === 'currency') {
      body.options = { symbol: '$' };
    } else if (body.type === 'relation') {
      const target = addField.tableId || (tables && tables[0] && tables[0].id) || open.id;
      body.options = { table_id: target };
    } else if (body.type === 'formula') {
      body.options = { expr: addField.expr || '' };
    } else if (body.type === 'lookup' || body.type === 'rollup') {
      const rel = addField.relation || (open.fields.find((f) => f.type === 'relation') || {}).id;
      body.options = { relation: rel, field: addField.targetField };
      if (body.type === 'rollup') body.options.agg = addField.agg || 'sum';
    }
    api.createField(open.id, body).then((f) => { setOpen((o) => ({ ...o, fields: [...o.fields, f] })); loadRelTargets([f]); setAddField(null); })
      .catch((e) => toast(firstError(e, 'Could not add column')));
  };
  const renameField = (fieldId, name) => {
    setOpen((o) => ({ ...o, fields: o.fields.map((f) => (f.id === fieldId ? { ...f, name } : f)) }));
    api.updateField(fieldId, { name }).catch((e) => toast(firstError(e, 'Could not rename column')));
  };
  const deleteField = (fieldId) => {
    setOpen((o) => ({ ...o, fields: o.fields.filter((f) => f.id !== fieldId) }));
    if (filters.some((f) => f.field === fieldId)) updateFilters(filters.filter((f) => f.field !== fieldId));
    if (sort && sort.field === fieldId) { setSort(null); persistSort(null); }
    if (groupBy === fieldId) updateGroupBy(null);
    api.deleteField(fieldId).catch((e) => { toast(firstError(e, 'Could not delete column')); refreshActive(); });
  };

  const viewsList = open?.views || [];
  const activeView = viewsList.find((v) => v.id === activeViewId) || viewsList[0] || null;
  const isKanban = activeView?.kind === 'kanban';

  // Latest active-view config, always fresh (updated every render). patchViewConfig
  // merges onto THIS, not a captured closure, so a debounced writer (e.g. the
  // widths save) can't clobber a sort/filter/group change made after it was
  // scheduled.
  const viewConfigRef = React.useRef({});
  React.useEffect(() => { viewConfigRef.current = activeView?.config || {}; });

  // Merge a patch into the ACTIVE view's config, updating local state and
  // persisting. One writer for sort / filters / group / kanbanField / widths, so
  // they compound instead of each clobbering the others - scoped to this view so
  // sibling views keep their own config.
  const patchViewConfig = (patch) => {
    const view = activeView;
    if (!view) return;
    const config = { ...(viewConfigRef.current || {}), ...patch };
    viewConfigRef.current = config; // compound back-to-back patches before re-render
    setOpen((o) => (o ? { ...o, views: (o.views || []).map((v) => (v.id === view.id ? { ...v, config } : v)) } : o));
    api.updateView(view.id, { config }).catch(() => {});
  };

  // ---- saved views (Notion-style tabs over one table) ----
  const switchView = (viewId) => {
    const v = viewsList.find((x) => x.id === viewId);
    if (!v || viewId === activeViewId) return;
    flushWidths();  // persist a pending resize onto the view we're leaving
    setActiveViewId(viewId);
    setSelected(new Set()); setExpandedId(null); setFilterOpen(false); setGroupMenu(false); setCardsMenu(false);
    applyViewState(v);
  };
  const createView = (kind) => {
    setAddViewMenu(false);
    const name = kind === 'kanban' ? 'Board' : 'Grid';
    api.createView(open.id, { kind, name, config: {} })
      .then((v) => { setOpen((o) => ({ ...o, views: [...(o.views || []), v] })); setActiveViewId(v.id); applyViewState(v); })
      .catch((e) => toast(firstError(e, 'Could not add view')));
  };
  const renameView = (viewId, name) => {
    const nm = (name || '').trim();
    if (!nm) return;
    setOpen((o) => ({ ...o, views: (o.views || []).map((v) => (v.id === viewId ? { ...v, name: nm } : v)) }));
    api.updateView(viewId, { name: nm }).catch((e) => toast(firstError(e, 'Could not rename view')));
  };
  const deleteView = (viewId) => {
    if (viewsList.length <= 1) return;
    const remaining = viewsList.filter((v) => v.id !== viewId);
    setOpen((o) => ({ ...o, views: remaining }));
    if (viewId === activeViewId && remaining[0]) { setActiveViewId(remaining[0].id); applyViewState(remaining[0]); }
    api.deleteView(viewId).catch((e) => { toast(firstError(e, 'Could not delete view')); openTable(open.id); });
  };

  // ---- filtering ----
  const updateFilters = (next) => { setFilters(next); patchViewConfig({ filters: next }); };

  // ---- grouping ----
  const updateGroupBy = (fieldId) => { setGroupBy(fieldId); setCollapsedGroups(new Set()); setGroupMenu(false); patchViewConfig({ groupBy: fieldId }); };
  const toggleGroup = (key) => setCollapsedGroups((prev) => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s; });

  // ---- kanban column field (per board view) ----
  const updateKanbanField = (fieldId) => { setKanbanField(fieldId); patchViewConfig({ kanbanField: fieldId }); };

  // ---- sorting ----
  const persistSort = (next) => patchViewConfig({ sort: next });
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
    if (!open) return rows;
    const fieldsById = {};
    open.fields.forEach((f) => { fieldsById[f.id] = f; });
    let out = filterRows(rows, filters, fieldsById);
    if (sort) {
      const field = open.fields.find((f) => f.id === sort.field);
      if (field) { out = out.slice().sort((a, b) => compareRows(field, a, b)); if (sort.dir === 'desc') out.reverse(); }
    }
    return out;
  }, [rows, sort, filters, open]);

  // Group the (filtered + sorted) rows for display. Returns the visible rows in
  // group order (collapsed groups excluded) plus a group descriptor for the grid
  // to draw collapsible header bands. Null groups => flat, ungrouped rendering.
  const grouped = React.useMemo(() => {
    if (!open || !groupBy) return { rows: displayRows, groups: null };
    const field = open.fields.find((f) => f.id === groupBy);
    if (!field || !isGroupable(field.type)) return { rows: displayRows, groups: null };
    const buckets = groupRows(displayRows, field);
    const rowsOut = [];
    const groups = buckets.map((g) => {
      const collapsed = collapsedGroups.has(g.key);
      if (!collapsed) rowsOut.push(...g.rows);
      return { key: g.key, label: g.label, count: g.count, collapsed };
    });
    return { rows: rowsOut, groups };
  }, [open, groupBy, displayRows, collapsedGroups]);
  const visibleRows = grouped.rows;

  // Compute display values for formula/lookup/rollup cells on the client.
  const computed = React.useMemo(() => {
    if (!open) return () => '';
    const fieldById = {}; const fieldByName = {};
    open.fields.forEach((f) => { fieldById[f.id] = f; fieldByName[f.name] = f; });
    const ctx = {
      fieldById, fieldByName,
      linkedRows: (relId, row) => {
        const rel = fieldById[relId];
        if (!rel || rel.type !== 'relation') return [];
        const map = relRows[rel.options?.table_id] || {};
        return ((row.data || {})[relId] || []).map((id) => map[id]).filter(Boolean);
      },
      relFieldsFor: (relId) => { const rel = fieldById[relId]; return rel ? (relFields[rel.options?.table_id] || []) : []; },
    };
    return (field, row) => computeCell(field, row, ctx);
  }, [open, relRows, relFields]);

  // ---- resize persistence ----
  // Column resizes are debounced (600ms) to avoid a write per pixel. `dirty`
  // marks a real user resize so loading a view's widths doesn't trigger a
  // needless write, and `timer` is tracked so a tab/view switch can flush the
  // pending save instead of the effect cleanup silently dropping it.
  const widthsDirtyRef = React.useRef(false);
  const widthsTimerRef = React.useRef(null);
  const resize = (fieldId, w) => { widthsDirtyRef.current = true; setWidths((x) => ({ ...x, [fieldId]: w })); };
  React.useEffect(() => {
    if (!open?.views?.[0] || !widthsDirtyRef.current) return undefined;
    widthsTimerRef.current = setTimeout(() => {
      widthsTimerRef.current = null; widthsDirtyRef.current = false;
      patchViewConfig({ widths });
    }, 600);
    return () => { if (widthsTimerRef.current) { clearTimeout(widthsTimerRef.current); widthsTimerRef.current = null; } };
  }, [widths]); // eslint-disable-line react-hooks/exhaustive-deps
  // Persist a pending resize immediately (called before leaving the active
  // table/view) so a resize made within the debounce window survives the switch.
  const flushWidths = () => {
    if (widthsTimerRef.current) { clearTimeout(widthsTimerRef.current); widthsTimerRef.current = null; }
    if (widthsDirtyRef.current) { widthsDirtyRef.current = false; patchViewConfig({ widths }); }
  };

  const copySelected = () => {
    if (!selected.size) return;
    const chosen = visibleRows.filter((r) => selected.has(r.id));
    const head = open.fields.map((f) => f.name).join('\t');
    const body = chosen.map((r) => open.fields.map((f) => plainValue(f, r.data?.[f.id])).join('\t')).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(`${head}\n${body}`).then(() => toast(`Copied ${chosen.length} row${chosen.length === 1 ? '' : 's'}`)).catch(() => {});
  };

  const page = { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, padding: '20px 22px', gap: '14px', overflow: 'hidden' };

  const singleSelectFields = open ? open.fields.filter((f) => f.type === 'single_select') : [];
  const kanbanFieldObj = open ? (open.fields.find((f) => f.id === kanbanField && f.type === 'single_select') || singleSelectFields[0] || null) : null;

  const addCard = (choiceId) => {
    if (!kanbanFieldObj) return;
    addRow(choiceId ? { [kanbanFieldObj.id]: choiceId } : {});
  };

  // Which fields a board's cards show (per-view "card curation"). Candidates are
  // every non-primary field except the one that forms the columns; if the view
  // hasn't been curated yet, default to the first few.
  const cardCandidates = open ? open.fields.filter((f) => !f.is_primary && f.id !== (kanbanFieldObj && kanbanFieldObj.id)) : [];
  const configuredCardFields = activeView?.config?.cardFields;
  const boardCardFieldIds = Array.isArray(configuredCardFields)
    ? configuredCardFields.filter((id) => open?.fields.some((f) => f.id === id))
    : cardCandidates.slice(0, 3).map((f) => f.id);
  const toggleCardField = (id) => {
    const next = boardCardFieldIds.includes(id) ? boardCardFieldIds.filter((x) => x !== id) : [...boardCardFieldIds, id];
    patchViewConfig({ cardFields: next });
  };

  // The open-table surface (grid or board), captured as a value so the tab-strip
  // layout can compose it beside the tables sidebar.
  const tableView = open ? (
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

        {/* View tabs: one source table, many saved views (grid / board). */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${theme.border}`, paddingBottom: 0, overflowX: 'auto' }} role="tablist" aria-label="Views" data-testid="view-tabs">
          {viewsList.map((v) => {
            const on = v.id === activeViewId;
            return (
              <div key={v.id} data-testid="view-tab" data-view-kind={v.kind} onClick={() => switchView(v.id)}
                onDoubleClick={() => { const nm = window.prompt('Rename view', v.name); if (nm) renameView(v.id, nm); }}
                role="tab" aria-selected={on} title={v.name}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: `2px solid ${on ? theme.brand : 'transparent'}`, color: on ? theme.text : theme.textMuted, fontSize: '13px', fontWeight: on ? 700 : 500 }}>
                {v.kind === 'kanban' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="5" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6" /><rect x="10" y="4" width="5" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" /><rect x="17" y="4" width="4" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 9.5h17M9 9.5v10" stroke="currentColor" strokeWidth="1.3" /></svg>
                )}
                {v.name}
                {on && viewsList.length > 1 ? (
                  <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete the "${v.name}" view?`)) deleteView(v.id); }} data-testid="view-delete" aria-label={`Delete ${v.name} view`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textFaint, display: 'flex', padding: 0, marginLeft: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
                  </button>
                ) : null}
              </div>
            );
          })}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAddViewMenu((v) => !v)} data-testid="add-view" aria-label="Add view" title="Add view"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', padding: '7px 8px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            {addViewMenu ? (
              <div role="dialog" aria-label="Add view" data-testid="add-view-menu" onClick={(e) => e.stopPropagation()}
                style={{ position: 'absolute', top: 34, left: 0, zIndex: 38, minWidth: 150, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '5px', boxShadow: '0 16px 40px rgba(16,24,40,0.2)' }}>
                <button onClick={() => createView('grid')} data-testid="add-view-grid" style={groupItem}>Grid view</button>
                <button onClick={() => createView('kanban')} data-testid="add-view-kanban" style={groupItem}>Board view</button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Controls strip: filter, and group / kanban-columns. */}
        <div ref={controlsRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', rowGap: '8px' }}>
          <button onClick={() => setFilterOpen((v) => !v)} data-testid="filter-button" aria-label="Filter"
            style={{ ...barBtn, display: 'inline-flex', alignItems: 'center', gap: 7, color: filters.length ? theme.brand : theme.text, borderColor: filters.length ? (theme.brandBorder || theme.brand) : theme.border, background: filters.length ? theme.brandBg : theme.white }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
            Filter{filters.length ? ` · ${filters.length}` : ''}
          </button>
          {filterOpen ? (
            <FilterPanel
              fields={open.fields}
              filters={filters}
              onChange={updateFilters}
              onClose={() => setFilterOpen(false)}
            />
          ) : null}

          {!isKanban ? (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setGroupMenu((v) => !v)} data-testid="group-button" aria-label="Group"
                style={{ ...barBtn, display: 'inline-flex', alignItems: 'center', gap: 7, color: groupBy ? theme.brand : theme.text, borderColor: groupBy ? (theme.brandBorder || theme.brand) : theme.border, background: groupBy ? theme.brandBg : theme.white }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h13M10 18h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                {groupBy ? `Grouped by ${(open.fields.find((f) => f.id === groupBy) || {}).name || '—'}` : 'Group'}
              </button>
              {groupMenu ? (
                <div role="dialog" aria-label="Group by" data-testid="group-menu" onClick={(e) => e.stopPropagation()}
                  style={{ position: 'absolute', top: 40, left: 0, zIndex: 38, minWidth: 190, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '11px', padding: '5px', boxShadow: '0 16px 40px rgba(16,24,40,0.2)' }}>
                  <button onClick={() => updateGroupBy(null)} style={{ ...groupItem, color: groupBy ? theme.textMuted : theme.brand }}>No grouping</button>
                  {open.fields.filter((f) => isGroupable(f.type)).map((f) => (
                    <button key={f.id} onClick={() => updateGroupBy(f.id)} style={{ ...groupItem, color: groupBy === f.id ? theme.brand : theme.text, fontWeight: groupBy === f.id ? 700 : 500 }}>{f.name}</button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : singleSelectFields.length > 0 ? (
            <React.Fragment>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12.5px', color: theme.textMuted }}>
                Columns:
                <select value={kanbanFieldObj ? kanbanFieldObj.id : ''} onChange={(e) => updateKanbanField(e.target.value)} data-testid="kanban-field" aria-label="Board columns field" style={fSelect}>
                  {singleSelectFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setCardsMenu((v) => !v)} data-testid="cards-button" aria-label="Customize cards" style={{ ...barBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M4 10h16" stroke="currentColor" strokeWidth="1.4" /></svg>
                  Cards
                </button>
                {cardsMenu ? (
                  <div role="dialog" aria-label="Card fields" data-testid="cards-menu" onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 40, left: 0, zIndex: 38, minWidth: 200, maxHeight: 280, overflowY: 'auto', background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '11px', padding: '6px', boxShadow: '0 16px 40px rgba(16,24,40,0.2)' }}>
                    <div style={{ fontSize: '11.5px', color: theme.textFaint, padding: '4px 8px 6px' }}>Fields shown on cards</div>
                    {cardCandidates.length === 0 ? (
                      <div style={{ fontSize: '12.5px', color: theme.textFaint, padding: '4px 8px 8px' }}>Add more columns to show them on cards.</div>
                    ) : cardCandidates.map((f) => {
                      const on = boardCardFieldIds.includes(f.id);
                      return (
                        <button key={f.id} onClick={() => toggleCardField(f.id)} data-testid="card-field-toggle"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 8px', fontSize: '13px', borderRadius: '7px', fontFamily: 'inherit' }}>
                          <span style={{ width: 14, display: 'inline-flex', color: theme.brand }}>{on ? '✓' : ''}</span>
                          <span style={{ color: on ? theme.text : theme.textMuted }}>{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          ) : null}

          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '12px', color: theme.textFaint }} data-testid="row-count">{displayRows.length}{displayRows.length !== rows.length ? ` of ${rows.length}` : ''} row{rows.length === 1 ? '' : 's'}</span>
        </div>

        {!isKanban && selected.size > 0 ? (
          <div data-testid="row-selection-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: theme.brandBg, border: `1px solid ${theme.brandBorder || theme.border}` }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: theme.brand }}>{selected.size} selected</span>
            <div style={{ flex: 1 }} />
            <button onClick={copySelected} style={barBtn}>Copy</button>
            <button onClick={() => deleteRows([...selected])} data-testid="bulk-delete" style={{ ...barBtn, color: theme.danger, borderColor: theme.dangerBorder2 || theme.border }}>Delete</button>
            <button onClick={() => setSelected(new Set())} style={barBtn}>Clear</button>
          </div>
        ) : null}

        {isKanban ? (
          kanbanFieldObj ? (
            <KanbanBoard
              fields={open.fields}
              rows={displayRows}
              field={kanbanFieldObj}
              files={files}
              relLabels={relLabels}
              computed={computed}
              cardFieldIds={boardCardFieldIds}
              onSetColumn={(rowId, choiceId) => editCell(rowId, kanbanFieldObj.id, choiceId)}
              onOpenRow={setExpandedId}
              onAddCard={addCard}
            />
          ) : (
            <div data-testid="kanban-empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: theme.textMuted, textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text }}>The board needs a Select column</div>
              <div style={{ fontSize: '13.5px', maxWidth: 340 }}>Board columns come from a single-select field. Add one in Grid view, then switch back.</div>
              <button onClick={() => { const g = viewsList.find((v) => v.kind === 'grid'); if (g) switchView(g.id); else createView('grid'); }} style={btnPrimary}>Back to Grid</button>
            </div>
          )
        ) : (
          <TableGrid
            fields={open.fields}
            rows={visibleRows}
            groups={grouped.groups}
            onToggleGroup={toggleGroup}
            widths={widths}
            onResize={resize}
            sort={sort}
            onSortToggle={onSortToggle}
            selectedIds={selected}
            onSelectionChange={setSelected}
            files={files}
            relLabels={relLabels}
            computed={computed}
            onEditCell={editCell}
            onAddRow={() => addRow()}
            onDeleteRows={(ids) => deleteRows(ids)}
            onAddField={() => setAddField({ name: '', type: 'text' })}
            onRenameField={renameField}
            onDeleteField={deleteField}
            onUndo={doUndo}
            onExpandRow={setExpandedId}
          />
        )}

        {(() => {
          const idx = visibleRows.findIndex((r) => r.id === expandedId);
          if (idx < 0) return null;
          const go = (dir) => { const n = idx + dir; if (n >= 0 && n < visibleRows.length) setExpandedId(visibleRows[n].id); };
          return (
            <RowDetailModal
              row={visibleRows[idx]}
              fields={open.fields}
              index={idx}
              total={visibleRows.length}
              files={files}
              relLabels={relLabels}
              computed={computed}
              onEditCell={editCell}
              onDeleteRow={() => { deleteRows([expandedId]); setExpandedId(null); }}
              onNavigate={go}
              onClose={() => setExpandedId(null)}
            />
          );
        })()}

        {addField ? (
          <div role="dialog" aria-label="Add column" style={overlay} onClick={() => setAddField(null)}>
            <div onClick={(e) => e.stopPropagation()} style={popover}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '15px' }}>New column</span>
              <input autoFocus placeholder="Column name" value={addField.name} onChange={(e) => setAddField((a) => ({ ...a, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') submitAddField(); }} style={input} aria-label="Column name" />
              <select value={addField.type} onChange={(e) => setAddField((a) => ({ ...a, type: e.target.value }))} style={input} aria-label="Column type">
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {addField.type === 'relation' ? (
                <select value={addField.tableId || (tables && tables[0] && tables[0].id) || open.id} onChange={(e) => setAddField((a) => ({ ...a, tableId: e.target.value }))} style={input} aria-label="Linked table">
                  {(tables || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  {!(tables || []).some((t) => t.id === open.id) ? <option value={open.id}>{open.name} (this table)</option> : null}
                </select>
              ) : null}
              {addField.type === 'formula' ? (
                <input placeholder="Expression, e.g. {Price} * {Qty}" value={addField.expr || ''}
                  onChange={(e) => setAddField((a) => ({ ...a, expr: e.target.value }))} style={{ ...input, fontFamily: 'monospace' }} aria-label="Formula expression" />
              ) : null}
              {(addField.type === 'lookup' || addField.type === 'rollup') ? (() => {
                const relFieldsList = open.fields.filter((f) => f.type === 'relation');
                const relId = addField.relation || (relFieldsList[0] || {}).id;
                const relField = open.fields.find((f) => f.id === relId);
                const targetFields = relField ? (relFields[relField.options?.table_id] || []) : [];
                return (
                  <React.Fragment>
                    <select value={relId || ''} onChange={(e) => setAddField((a) => ({ ...a, relation: e.target.value }))} style={input} aria-label="Via relation">
                      {relFieldsList.length === 0 ? <option value="">Add a relation column first</option>
                        : relFieldsList.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <select value={addField.targetField || (targetFields[0] || {}).id || ''} onChange={(e) => setAddField((a) => ({ ...a, targetField: e.target.value }))} style={input} aria-label="Target field">
                      {targetFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    {addField.type === 'rollup' ? (
                      <select value={addField.agg || 'sum'} onChange={(e) => setAddField((a) => ({ ...a, agg: e.target.value }))} style={input} aria-label="Aggregate">
                        {['sum', 'avg', 'min', 'max', 'count'].map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    ) : null}
                  </React.Fragment>
                );
              })() : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setAddField(null)} style={btnGhost}>Cancel</button>
                <button onClick={submitAddField} style={btnPrimary}>Add column</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    ) : null;

  const listView = (
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

  // Sidebar list = server tables ∪ any open tabs not yet in that list (a freshly
  // created table appears instantly, before the list GET returns).
  const listIds = new Set((tables || []).map((t) => t.id));
  const extraTabs = openTabs
    .filter((id) => !listIds.has(id))
    .map((id) => ({ id, name: (open?.id === id ? open.name : cacheRef.current[id]?.table?.name) || 'Untitled table', row_count: open?.id === id ? rows.length : (cacheRef.current[id]?.rows?.length || 0) }));
  const sidebarTables = [...(tables || []), ...extraTabs];

  // Secondary sidebar: the list of tables (each expandable to its views once
  // opened) + New table. Mirrors the Settings / My Files secondary sidebars.
  const tablesSidebar = (
    <div data-testid="tables-sidebar" style={{ width: 232, flex: '0 0 auto', background: theme.surface2, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 12px 8px' }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '14px', color: theme.text, flex: 1 }}>Tables</span>
        <button onClick={newTable} data-testid="tables-sidebar-new" title="New table" style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.brand, display: 'flex', padding: 4, borderRadius: 6 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div style={{ overflowY: 'auto', padding: '2px 8px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sidebarTables.map((t) => {
          const active = open?.id === t.id;
          const cached = cacheRef.current[t.id];
          const views = active ? open.views : cached?.table?.views;
          const nm = (active ? open.name : cached?.table?.name) || t.name;  // live name (rename may outrun the list refetch)
          return (
            <div key={t.id}>
              <button
                onClick={() => openTable(t.id)}
                data-testid="tables-sidebar-item"
                title={nm}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: active ? theme.brandBg : 'transparent', color: active ? theme.brand : theme.text, fontWeight: active ? 600 : 500, cursor: 'pointer', fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '13px', padding: '7px 8px', borderRadius: 7, textAlign: 'left' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 15px' }}><rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M3.5 9.5h17M9 9.5v10" stroke="currentColor" strokeWidth="1.4" /></svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{nm}</span>
                <span style={{ fontSize: '11px', color: theme.textFaint }}>{active ? rows.length : t.row_count}</span>
              </button>
              {active && (views || []).length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 8 }}>
                  {views.map((v) => (
                    <div key={v.id} data-testid="tables-sidebar-view" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px 4px 16px', fontSize: '12px', color: theme.textMuted }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 12px' }}><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M4 9h16M9 9v11" stroke="currentColor" strokeWidth="1.3" /></svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name || 'Grid'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {sidebarTables.length === 0 ? <div style={{ padding: '10px 8px', fontSize: '12px', color: theme.textFaint }}>No tables yet.</div> : null}
      </div>
    </div>
  );

  // Tab strip for the open tables — instant switch, close per tab.
  const tabName = (id) => (open?.id === id ? open.name : cacheRef.current[id]?.table?.name) || (tables || []).find((t) => t.id === id)?.name || 'Table';
  const tabStrip = openTabs.length ? (
    <div data-testid="tables-tabstrip" style={{ display: 'flex', alignItems: 'stretch', gap: 4, padding: '8px 12px 0', borderBottom: `1px solid ${theme.border}`, overflowX: 'auto', flex: '0 0 auto' }}>
      {openTabs.map((id) => {
        const active = open?.id === id;
        return (
          <div key={id} data-testid="tables-tab" data-active={active ? 'true' : 'false'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 9px 7px 11px', borderRadius: '9px 9px 0 0', border: `1px solid ${active ? theme.border : 'transparent'}`, borderBottom: active ? `1px solid ${theme.white}` : '1px solid transparent', marginBottom: -1, background: active ? theme.white : 'transparent', cursor: 'pointer' }}>
            <button onClick={() => openTable(id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: active ? 600 : 500, color: active ? theme.text : theme.textMuted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tabName(id)}</button>
            <button onClick={() => closeTab(id)} data-testid="tables-tab-close" aria-label={`Close ${tabName(id)}`} style={{ border: 'none', background: 'none', cursor: 'pointer', color: theme.textFaint, display: 'flex', padding: 1, borderRadius: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden' }} data-testid="tables-page">
      {V?.isDesktop ? tablesSidebar : null}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: theme.white }}>
        {tabStrip}
        {open ? tableView : listView}
      </div>
    </div>
  );
}

const iconBtn = { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.white, color: theme.textMuted, cursor: 'pointer', flex: '0 0 auto' };
const barBtn = { background: theme.white, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '6px 13px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnPrimary = { background: theme.brand, color: theme.onAccent, border: 'none', borderRadius: '9px', padding: '9px 16px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { background: theme.white, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 14px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const overlay = { position: 'absolute', inset: 0, background: 'rgba(20,23,28,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 };
const popover = { width: 320, maxWidth: '92%', background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '11px', boxShadow: '0 24px 60px rgba(16,24,40,0.28)' };
const input = { width: '100%', boxSizing: 'border-box', border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '9px 11px', fontSize: '13.5px', color: theme.text, background: theme.white, outline: 'none', fontFamily: 'inherit' };
const filterPanelStyle = { position: 'absolute', top: 40, left: 0, zIndex: 38, width: 460, maxWidth: '94vw', background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '13px', padding: '13px', boxShadow: '0 18px 44px rgba(16,24,40,0.2)' };
const fSelect = { border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '6px 8px', fontSize: '12.5px', color: theme.text, background: theme.white, outline: 'none', fontFamily: 'inherit', maxWidth: 150 };
const fInput = { border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '6px 9px', fontSize: '12.5px', color: theme.text, background: theme.white, outline: 'none', fontFamily: 'inherit', minWidth: 0 };
const iconBtnSm = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.white, color: theme.textMuted, cursor: 'pointer', flex: '0 0 auto' };
const groupItem = { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 10px', fontSize: '13px', borderRadius: '7px', fontFamily: 'inherit' };

function FilterValue({ field, value, onChange }) {
  const type = field ? field.type : 'text';
  if (type === 'single_select' || type === 'multi_select') {
    const choices = field.options?.choices || [];
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label="Filter value" style={{ ...fSelect, flex: 1, maxWidth: 'none' }}>
        <option value="">Select…</option>
        {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    );
  }
  const inputType = ['number', 'currency', 'percent', 'rating'].includes(type) ? 'number' : type === 'date' ? 'date' : 'text';
  return <input type={inputType} value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label="Filter value" placeholder="Value" style={{ ...fInput, flex: 1 }} />;
}

function FilterPanel({ fields, filters, onChange, onClose }) {
  const filterable = fields.filter((f) => !COMPUTED_TYPES.has(f.type));
  const fieldById = {};
  fields.forEach((f) => { fieldById[f.id] = f; });

  const addFilter = () => {
    const f = filterable[0];
    if (!f) return;
    onChange([...filters, { field: f.id, op: opsForType(f.type)[0], value: '' }]);
  };
  const update = (i, patch) => onChange(filters.map((flt, j) => (j === i ? { ...flt, ...patch } : flt)));
  const remove = (i) => onChange(filters.filter((_, j) => j !== i));
  const onFieldChange = (i, fieldId) => onChange(filters.map((flt, j) => (j === i ? { field: fieldId, op: opsForType(fieldById[fieldId].type)[0], value: '' } : flt)));

  return (
    <div role="dialog" aria-label="Filters" data-testid="filter-panel" style={filterPanelStyle} onClick={(e) => e.stopPropagation()}>
      {filters.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: theme.textFaint, padding: '2px 2px 10px' }}>No filters yet — add one to narrow the rows.</div>
      ) : filters.map((flt, i) => {
        const field = fieldById[flt.field] || filterable[0];
        const ftype = field ? field.type : 'text';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
            <span style={{ fontSize: '11.5px', color: theme.textFaint, width: 30, flex: '0 0 30px' }}>{i === 0 ? 'Where' : 'and'}</span>
            <select value={flt.field} onChange={(e) => onFieldChange(i, e.target.value)} aria-label="Filter field" style={fSelect}>
              {filterable.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={flt.op} onChange={(e) => update(i, { op: e.target.value, value: opNeedsValue(e.target.value) ? flt.value : '' })} aria-label="Filter operator" style={fSelect}>
              {opsForType(ftype).map((op) => <option key={op} value={op}>{OP_LABELS[op] || op}</option>)}
            </select>
            {opNeedsValue(flt.op) ? <FilterValue field={field} value={flt.value} onChange={(v) => update(i, { value: v })} /> : <span style={{ flex: 1 }} />}
            <button onClick={() => remove(i)} aria-label="Remove filter" style={iconBtnSm}>
              <svg width="13" height="13" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
            </button>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
        <button onClick={addFilter} data-testid="filter-add" style={{ ...btnGhost, padding: '6px 12px' }}>+ Add filter</button>
        {filters.length ? <button onClick={() => onChange([])} data-testid="filter-clear" style={{ ...btnGhost, padding: '6px 12px', color: theme.textMuted }}>Clear all</button> : null}
        <span style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...btnPrimary, padding: '6px 14px' }}>Done</button>
      </div>
    </div>
  );
}
