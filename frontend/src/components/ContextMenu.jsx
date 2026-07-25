import React from 'react';
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
          background: '#FFFFFF',
          border: '1px solid #E5E7EC',
          borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(16,24,40,0.18)',
          padding: '6px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#9AA1AC',
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
              color: it.danger ? '#E5484D' : '#15171C',
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 10px',
              cursor: 'pointer',
            }}
            {...hov({ background: '#F1F2F5' })}
          >
            {it.label}
          </button>
        ))}
      </div>
    </React.Fragment>
  ) : null;
}
