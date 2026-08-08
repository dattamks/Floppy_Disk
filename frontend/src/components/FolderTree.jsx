import React from 'react';
import { theme } from '../lib/theme';

// The My Files secondary sidebar: a collapsible folder tree built client-side
// from folders already in memory. Expand/collapse all + per-node, persisted by
// the parent. Clicking a node navigates the grid to that folder.

const rowBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  width: '100%',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontFamily: "'IBM Plex Sans',sans-serif",
  fontSize: '13px',
  color: theme.text,
  padding: '5px 6px',
  borderRadius: 7,
  textAlign: 'left',
};

function Node({ node, depth, V }) {
  const expanded = V.treeExpanded.has(node.id);
  const active = V.treeCurrentId === node.id;
  const children = expanded ? V.treeByParent[node.id] || [] : [];
  return (
    <div>
      <div
        data-testid="folder-tree-node"
        data-folder-id={node.id}
        style={{
          ...rowBase,
          paddingLeft: 6 + depth * 14,
          background: active ? theme.brandBg : 'transparent',
          color: active ? theme.brand : theme.text,
          fontWeight: active ? 600 : 500,
        }}
      >
        {node.hasChildren ? (
          <button
            onClick={() => V.onTreeToggle(node.id)}
            data-testid="folder-tree-toggle"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 2, color: theme.textMuted }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}>
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span style={{ width: 16, flex: '0 0 16px' }} />
        )}
        <button
          onClick={() => V.onTreeOpen(node.id)}
          data-testid="folder-tree-open"
          title={node.name}
          style={{ ...rowBase, padding: 0, color: 'inherit', fontWeight: 'inherit', flex: 1, minWidth: 0 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 15px' }}>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        </button>
      </div>
      {children.map((c) => (
        <Node key={c.id} node={c} depth={depth + 1} V={V} />
      ))}
    </div>
  );
}

export default function FolderTree({ V, mobile }) {
  const roots = V.treeByParent.root || [];
  const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 };
  return (
    <div
      data-testid={mobile ? 'folder-tree-mobile' : 'folder-tree'}
      style={{
        width: mobile ? '100%' : 232,
        flex: mobile ? '1 1 auto' : '0 0 auto',
        background: mobile ? 'transparent' : theme.surface2,
        borderRight: mobile ? 'none' : `1px solid ${theme.border}`,
        borderTop: mobile ? `1px solid ${theme.border}` : 'none',
        marginTop: mobile ? 6 : 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 12px 8px' }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '14px', color: theme.text, flex: 1 }}>My Files</span>
        <button onClick={V.onTreeExpandAll} data-testid="folder-tree-expand-all" title="Expand all" style={iconBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8 10l4 4 4-4M8 4l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button onClick={V.onTreeCollapseAll} data-testid="folder-tree-collapse-all" title="Collapse all" style={iconBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8 14l4-4 4 4M8 20l4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div style={{ overflowY: 'auto', padding: '2px 8px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <button
          onClick={() => V.onTreeOpen(null)}
          data-testid="folder-tree-root"
          style={{ ...rowBase, background: V.treeAtRoot ? theme.brandBg : 'transparent', color: V.treeAtRoot ? theme.brand : theme.text, fontWeight: V.treeAtRoot ? 600 : 500 }}
        >
          <span style={{ width: 16, flex: '0 0 16px' }} />
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 15px' }}>
            <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          All files
        </button>
        {roots.map((n) => (
          <Node key={n.id} node={n} depth={0} V={V} />
        ))}
        {roots.length === 0 ? (
          <div style={{ padding: '10px 8px', fontSize: '12px', color: theme.textFaint }}>No folders yet.</div>
        ) : null}
      </div>
    </div>
  );
}
