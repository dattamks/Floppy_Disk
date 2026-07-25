import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.ctxMenuView is set.
export default function ContextMenu(V) {
  return V.ctxMenuView ? (
    <React.Fragment>
      <div
        onClick={V.closeCtxMenu}
        onContextMenu={(e) => {
          e.preventDefault();
          V.closeCtxMenu();
        }}
        style={{ position: 'fixed', inset: '0', zIndex: '70' }}
      />{' '}
      <div
        style={{
          position: 'fixed',
          left: `${V.ctxMenuView.x}px`,
          top: `${V.ctxMenuView.y}px`,
          zIndex: '71',
          width: '188px',
          background: theme.white,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(16,24,40,0.18)',
          padding: '6px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: theme.textFaint,
            padding: '6px 10px 4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {V.ctxMenuView.name}
        </div>
        {V.ctxMenuView.items.map((it, ix) => (
          <button
            key={ix}
            onClick={() => {
              V.closeCtxMenu();
              it.fn();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              fontSize: '13px',
              color: it.danger ? theme.danger : theme.text,
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 10px',
              cursor: 'pointer',
            }}
            {...hov({ background: theme.surface })}
          >
            {it.label}
          </button>
        ))}
      </div>
    </React.Fragment>
  ) : null;
}
