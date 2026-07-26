import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

export default function SubscribedChip({ V, ch }) {
  return (
    <React.Fragment>
      {' '}
      <div
        onClick={ch.onView}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          flex: '0 0 auto',
          width: '60px',
          cursor: 'pointer',
        }}
      >
        {' '}
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: ch.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.white,
            fontFamily: "'Space Grotesk',sans-serif",
            fontWeight: '700',
            fontSize: '15px',
            position: 'relative',
          }}
        >
          {ch.initials}
          {ch.live ? (
            <React.Fragment>
              <span
                style={{
                  position: 'absolute',
                  bottom: '-3px',
                  background: theme.danger,
                  color: theme.white,
                  fontSize: '7px',
                  fontWeight: '700',
                  borderRadius: '4px',
                  padding: '1px 4px',
                  border: `2px solid ${theme.appBg}`,
                }}
              >
                LIVE
              </span>
            </React.Fragment>
          ) : null}
        </div>{' '}
        <span
          style={{
            fontSize: '10.5px',
            color: theme.textMuted,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '60px',
          }}
        >
          {ch.name}
        </span>{' '}
      </div>{' '}
    </React.Fragment>
  );
}
