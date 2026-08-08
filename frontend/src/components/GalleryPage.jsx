import React from 'react';
import { theme } from '../lib/theme';
import { api, firstError } from '../api';

// Gallery: all of the owner's photos, videos and audio, in categories. Click a
// tile to open it full-size: a video or audio track plays inline (Esc to close);
// an image opens in a viewer you can page through forward/backward. Each tile has
// a context menu (info / download / move to trash). Read-only-ish lens over the
// file store - scope-safe (a folder-scoped key sees only its subtree); delete
// goes to Trash.

const FILTERS = [['all', 'All'], ['image', 'Photos'], ['video', 'Videos'], ['audio', 'Audio']];

function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDuration(sec) {
  if (!sec && sec !== 0) return '';
  const s = Math.round(sec); const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
// A human date bucket for grouping (Today / Yesterday / This week / This month /
// "Month YYYY" for older).
function dateBucket(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'This month';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
// Group an (already newest-first) list into ordered date buckets, keeping each
// item's original index so the lightbox can page through the whole category.
function bucketize(arr) {
  const groups = []; const idx = {};
  arr.forEach((f, i) => {
    const label = dateBucket(f.created_at);
    if (idx[label] === undefined) { idx[label] = groups.length; groups.push({ label, items: [] }); }
    groups[idx[label]].items.push({ f, i });
  });
  return groups;
}

export default function GalleryPage({ V }) {
  const toast = V?.showToast || (() => {});
  const [media, setMedia] = React.useState(null);
  const [error, setError] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [groupByDate, setGroupByDate] = React.useState(true);
  const [view, setView] = React.useState(null);   // lightbox: { list:'image'|'video', index }
  const [menu, setMenu] = React.useState(null);    // context menu: { file, x, y }
  const [info, setInfo] = React.useState(null);    // info panel: file

  const load = React.useCallback(() => {
    setError(false);
    api.listMedia().then((m) => setMedia(m || [])).catch(() => { setMedia([]); setError(true); });
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const photos = React.useMemo(() => (media || []).filter((f) => f.kind === 'image'), [media]);
  const videos = React.useMemo(() => (media || []).filter((f) => f.kind === 'video'), [media]);
  const audios = React.useMemo(() => (media || []).filter((f) => f.kind === 'audio'), [media]);
  const listFor = React.useCallback((kind) => (kind === 'video' ? videos : kind === 'audio' ? audios : photos), [photos, videos, audios]);

  const openAt = (kind, index) => setView({ list: kind, index });
  const close = React.useCallback(() => setView(null), []);
  const step = React.useCallback((dir) => {
    setView((v) => {
      if (!v) return v;
      const arr = listFor(v.list);
      const next = v.index + dir;
      return (next < 0 || next >= arr.length) ? v : { ...v, index: next };
    });
  }, [listFor]);

  React.useEffect(() => {
    if (!view) return undefined;
    const onKey = (e) => {
      if (info) return;                 // info panel (on top) owns Escape while open
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, close, step, info]);

  // Info panel closes on Escape (it can sit on its own or on top of the lightbox).
  React.useEffect(() => {
    if (!info) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setInfo(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info]);

  // Close the context menu on any outside click / Escape.
  React.useEffect(() => {
    if (!menu) return undefined;
    const onDown = () => setMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  const activeArr = view ? listFor(view.list) : [];
  const active = view ? activeArr[view.index] : null;

  const openMenu = (file, x, y) => setMenu({ file, x: Math.min(x, window.innerWidth - 180), y: Math.min(y, window.innerHeight - 150) });

  const download = (f) => {
    const a = document.createElement('a');
    a.href = api.fileRawUrl(f.id); a.download = f.name || 'download'; a.rel = 'noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  };
  const remove = (f) => {
    setMenu(null); setInfo(null);
    setMedia((m) => (m || []).filter((x) => x.id !== f.id)); // optimistic
    if (active && active.id === f.id) setView(null);
    api.deleteFile(f.id)
      .then(() => toast('Moved to trash', { label: 'Undo', fn: () => api.restoreFile(f.id).then(load).catch(() => { toast('Could not undo'); load(); }) }))
      .catch((e) => { toast(firstError(e, 'Could not delete')); load(); });
  };

  const page = { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, padding: '20px 22px', gap: '14px', overflow: 'hidden' };

  const Tile = (f, kind, index) => {
    const src = kind === 'video' ? (f.poster_url || null) : kind === 'audio' ? null : api.fileRawUrl(f.id);
    return (
      <div key={f.id} className="fd-gtile" style={{ position: 'relative' }}>
        <button onClick={() => openAt(kind, index)} onContextMenu={(e) => { e.preventDefault(); openMenu(f, e.clientX, e.clientY); }}
          data-testid="gallery-tile" data-kind={kind} title={f.name}
          style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', background: kind === 'audio' ? theme.brandBgSoft : theme.surface2, padding: 0, display: 'block' }}>
          {src ? (
            <img src={src} alt={f.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: kind === 'audio' ? theme.brand : theme.textFaint }}>
              {kind === 'audio' ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" /><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" /></svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              )}
            </div>
          )}
          {kind === 'video' ? (
            <span style={{ position: 'absolute', left: 7, top: 7, padding: '1px 6px', borderRadius: '6px', background: 'rgba(10,12,20,0.6)', color: '#fff', fontSize: '10.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>{fmtDuration(f.duration_seconds) || 'Video'}
            </span>
          ) : null}
          {kind === 'audio' ? (
            <span style={{ position: 'absolute', left: 7, top: 7, padding: '1px 6px', borderRadius: '6px', background: 'rgba(10,12,20,0.55)', color: '#fff', fontSize: '10.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l10-2v13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="2.4" stroke="#fff" strokeWidth="2" /><circle cx="16" cy="16" r="2.4" stroke="#fff" strokeWidth="2" /></svg>{fmtDuration(f.duration_seconds) || 'Audio'}
            </span>
          ) : null}
          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 8px 6px', background: 'linear-gradient(transparent, rgba(10,12,20,0.62))', color: '#fff', fontSize: '11px', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
        </button>
        {/* Kebab - appears on hover; opens the same menu. */}
        <button className="fd-gkebab" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); openMenu(f, r.left - 150, r.bottom + 4); }}
          data-testid="gallery-tile-menu" aria-label={`Actions for ${f.name}`}
          style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 7, border: 'none', background: 'rgba(10,12,20,0.5)', color: '#fff', cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="19" r="1.6" fill="currentColor" /></svg>
        </button>
      </div>
    );
  };

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' };
  const Section = (label, kind, arr) => {
    const groups = groupByDate ? bucketize(arr) : [{ label: null, items: arr.map((f, i) => ({ f, i })) }];
    return (
      <div data-testid={`gallery-section-${kind}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '15px', color: theme.text }}>{label}</span>
          <span style={{ fontSize: '12px', color: theme.textFaint }}>{arr.length}</span>
        </div>
        {groups.map((g) => (
          <div key={g.label || 'all'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.label ? (
              <div data-testid="gallery-date-group" style={{ display: 'flex', alignItems: 'baseline', gap: 7, position: 'sticky', top: 0, zIndex: 1, background: theme.appBg, padding: '3px 0 4px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: theme.textMuted }}>{g.label}</span>
                <span style={{ fontSize: '11px', color: theme.textFaint }}>{g.items.length}</span>
              </div>
            ) : null}
            <div style={grid}>{g.items.map(({ f, i }) => Tile(f, kind, i))}</div>
          </div>
        ))}
      </div>
    );
  };

  const menuItem = { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 11px', fontSize: '13px', color: theme.text, borderRadius: '7px', fontFamily: 'inherit' };

  return (
    <div style={page} data-testid="gallery-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '22px', color: theme.text }}>Gallery</span>
        <div style={{ display: 'inline-flex', border: `1px solid ${theme.border}`, borderRadius: '9px', overflow: 'hidden' }} role="tablist" aria-label="Media category">
          {FILTERS.map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)} data-testid={`gallery-filter-${v}`} aria-selected={filter === v}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px', fontWeight: 600, padding: '6px 13px', background: filter === v ? theme.brand : theme.white, color: filter === v ? theme.white : theme.textMuted }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setGroupByDate((v) => !v)} data-testid="gallery-group-toggle" aria-pressed={groupByDate}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${groupByDate ? (theme.brandBorder || theme.brand) : theme.border}`, background: groupByDate ? theme.brandBg : theme.white, color: groupByDate ? theme.brand : theme.textMuted, borderRadius: '8px', padding: '6px 11px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" /></svg>
          Group by date
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '12.5px', color: theme.textFaint }}>{media ? `${photos.length} photo${photos.length === 1 ? '' : 's'} · ${videos.length} video${videos.length === 1 ? '' : 's'} · ${audios.length} audio` : ''}</span>
      </div>

      {media === null ? (
        <div style={{ color: theme.textFaint, fontSize: '13.5px', padding: '20px 2px' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: theme.textMuted, fontSize: '13.5px' }}>Couldn’t load media. <button onClick={load} style={retryBtn}>Retry</button></div>
      ) : photos.length === 0 && videos.length === 0 && audios.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', color: theme.textMuted, textAlign: 'center' }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke={theme.borderStrong2 || theme.border} strokeWidth="1.6" /><circle cx="9" cy="10" r="1.7" fill={theme.border} /><path d="M4 17l4.5-4.5 3 3L15 11l5 6" stroke={theme.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text }}>No photos, videos or audio yet</div>
          <div style={{ fontSize: '13.5px' }}>Images, videos and audio you upload will show up here.</div>
        </div>
      ) : (
        <div style={{ overflowY: 'auto', paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {(filter === 'all' || filter === 'image') && photos.length > 0 ? Section('Photos', 'image', photos) : null}
          {(filter === 'all' || filter === 'video') && videos.length > 0 ? Section('Videos', 'video', videos) : null}
          {(filter === 'all' || filter === 'audio') && audios.length > 0 ? Section('Audio', 'audio', audios) : null}
          {filter === 'image' && photos.length === 0 ? <div style={{ color: theme.textFaint, fontSize: '13.5px' }}>No photos yet.</div> : null}
          {filter === 'video' && videos.length === 0 ? <div style={{ color: theme.textFaint, fontSize: '13.5px' }}>No videos yet.</div> : null}
          {filter === 'audio' && audios.length === 0 ? <div style={{ color: theme.textFaint, fontSize: '13.5px' }}>No audio yet.</div> : null}
        </div>
      )}

      {/* Context menu */}
      {menu ? (
        <div data-testid="gallery-menu" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 70, minWidth: 168, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: '11px', padding: '5px', boxShadow: '0 16px 44px rgba(16,24,40,0.24)' }}>
          <button onClick={() => { setInfo(menu.file); setMenu(null); }} data-testid="gallery-menu-info" style={menuItem}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Info
          </button>
          <button onClick={() => { download(menu.file); setMenu(null); }} data-testid="gallery-menu-download" style={menuItem}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Download
          </button>
          <button onClick={() => remove(menu.file)} data-testid="gallery-menu-delete" style={{ ...menuItem, color: theme.danger }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            Move to trash
          </button>
        </div>
      ) : null}

      {/* Info panel */}
      {info ? (
        <div role="dialog" aria-label="Media info" data-testid="gallery-info" onClick={() => setInfo(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(16,20,28,0.35)', display: 'flex', justifyContent: 'flex-end', zIndex: 65 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 320, maxWidth: '92%', height: '100%', background: theme.white, borderLeft: `1px solid ${theme.border}`, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '-14px 0 40px rgba(16,24,40,0.16)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '15px', color: theme.text, flex: 1 }}>Info</span>
              <button onClick={() => setInfo(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex', padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div style={{ aspectRatio: '4 / 3', borderRadius: 10, overflow: 'hidden', background: info.kind === 'audio' ? theme.brandBgSoft : theme.surface2, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {info.kind === 'audio' ? (
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ color: theme.brand }}><path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" /><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
              ) : (
                <img src={info.kind === 'video' ? (info.poster_url || api.fileRawUrl(info.id)) : api.fileRawUrl(info.id)} alt={info.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            {[
              ['Name', info.name],
              ['Type', info.kind === 'video' ? 'Video' : info.kind === 'audio' ? 'Audio' : 'Photo'],
              ['Size', fmtBytes(info.size_bytes)],
              info.width && info.height ? ['Dimensions', `${info.width} × ${info.height}`] : null,
              (info.kind === 'video' || info.kind === 'audio') && info.duration_seconds ? ['Duration', fmtDuration(info.duration_seconds)] : null,
              ['Added', fmtDate(info.created_at)],
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 10, fontSize: '13px' }}>
                <span style={{ color: theme.textFaint, width: 92, flex: '0 0 92px' }}>{k}</span>
                <span style={{ color: theme.text, wordBreak: 'break-word' }}>{v}</span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => download(info)} style={{ ...ghostBtn, flex: 1 }}>Download</button>
              <button onClick={() => remove(info)} style={{ ...ghostBtn, color: theme.danger, borderColor: theme.dangerBorder2 || theme.border }}>Trash</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lightbox */}
      {active ? (
        <div role="dialog" aria-label="Media viewer" data-testid="gallery-lightbox" onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,16,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}>
          <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8, zIndex: 2 }}>
            <button onClick={(e) => { e.stopPropagation(); setInfo(active); }} aria-label="Info" data-testid="lightbox-info" style={topBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); download(active); }} aria-label="Download" data-testid="lightbox-download" style={topBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); remove(active); }} aria-label="Move to trash" data-testid="lightbox-delete" style={topBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            </button>
            <button onClick={close} aria-label="Close" style={topBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
            </button>
          </div>

          {activeArr.length > 1 ? (
            <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous" data-testid="gallery-prev" disabled={view.index <= 0}
              style={{ ...sideBtn('left'), opacity: view.index <= 0 ? 0.3 : 1 }}>
              <svg width="22" height="22" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : null}
          {activeArr.length > 1 ? (
            <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next" data-testid="gallery-next" disabled={view.index >= activeArr.length - 1}
              style={{ ...sideBtn('right'), opacity: view.index >= activeArr.length - 1 ? 0.3 : 1 }}>
              <svg width="22" height="22" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : null}

          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {view.list === 'video' ? (
              <video key={active.id} src={api.fileRawUrl(active.id)} poster={active.poster_url || undefined} controls autoPlay
                style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 10, background: '#000' }} onError={() => toast(firstError(null, 'Could not play this video'))} />
            ) : view.list === 'audio' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '40px 32px', minWidth: 'min(460px, 82vw)', background: 'rgba(255,255,255,0.06)', borderRadius: 16 }}>
                <div style={{ width: 116, height: 116, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" /><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
                </div>
                <audio key={active.id} src={api.fileRawUrl(active.id)} controls autoPlay
                  style={{ width: 'min(420px, 78vw)' }} onError={() => toast(firstError(null, 'Could not play this audio'))} />
              </div>
            ) : (
              <img key={active.id} src={api.fileRawUrl(active.id)} alt={active.name} style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 10, objectFit: 'contain' }} />
            )}
            <div style={{ color: '#fff', fontSize: '13px', opacity: 0.9, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span data-testid="gallery-counter">{view.index + 1} / {activeArr.length}</span>
              <span style={{ opacity: 0.55 }}>·</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw' }}>{active.name}</span>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        [data-testid="gallery-page"] .fd-gtile:hover .fd-gkebab { display: flex !important; }
      `}</style>
    </div>
  );
}

const retryBtn = { background: theme.white, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '4px 10px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn = { background: theme.white, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const topBtn = { background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const sideBtn = (side) => ({ position: 'absolute', [side]: 14, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 });
