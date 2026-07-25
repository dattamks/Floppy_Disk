import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

export default function CategoryChip({ V, cat }) {
  return (
    <React.Fragment>
      {' '}
      <button
        onClick={cat.onClick}
        style={{
          flex: '0 0 auto',
          border: `1px solid ${cat.active ? theme.brand : theme.border}`,
          background: cat.active ? theme.brand : theme.white,
          color: cat.active ? theme.white : theme.textMuted,
          borderRadius: '20px',
          padding: '7px 14px',
          fontSize: '12.5px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: "'IBM Plex Sans',sans-serif",
        }}
      >
        {cat.label}
      </button>{' '}
    </React.Fragment>
  );
}
