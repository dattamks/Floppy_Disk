import React from 'react';
import { hov } from '../lib/ui';

export default function ChannelRow({ V, ch }) {
  return (
    <React.Fragment>
      {' '}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#FFFFFF',
          border: '1px solid #E5E7EC',
          borderRadius: '14px',
          padding: '12px 14px',
          boxShadow: '0 1px 2px rgba(16,24,40,0.03)',
        }}
      >
        {' '}
        <div
          onClick={ch.onView}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: ch.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: "'Space Grotesk',sans-serif",
            fontWeight: '700',
            fontSize: '14px',
            flex: '0 0 auto',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          {ch.initials}
          {ch.live ? (
            <React.Fragment>
              <span
                style={{
                  position: 'absolute',
                  bottom: '-4px',
                  background: '#E5484D',
                  color: '#fff',
                  fontSize: '7px',
                  fontWeight: '700',
                  borderRadius: '4px',
                  padding: '1px 4px',
                  border: '2px solid #FFF',
                }}
              >
                LIVE
              </span>
            </React.Fragment>
          ) : null}
        </div>{' '}
        <div
          onClick={ch.onView}
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: '0',
            flex: '1',
            gap: '2px',
            cursor: 'pointer',
          }}
        >
          {' '}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' }}>
            {' '}
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: '600',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ch.name}
            </span>{' '}
            {ch.isNew ? (
              <React.Fragment>
                <span
                  style={{
                    background: '#ECEBFD',
                    color: '#5145E5',
                    fontSize: '9px',
                    fontWeight: '700',
                    borderRadius: '4px',
                    padding: '1px 5px',
                    flex: '0 0 auto',
                  }}
                >
                  NEW
                </span>
              </React.Fragment>
            ) : null}{' '}
          </div>{' '}
          <span
            style={{
              fontSize: '11px',
              color: '#9AA1AC',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {ch.handle} · {ch.subs} subscribers · {ch.category}
          </span>{' '}
        </div>{' '}
        <button
          onClick={ch.onToggle}
          style={{
            flex: '0 0 auto',
            border: `1px solid ${ch.subBorder}`,
            background: ch.subBg,
            color: ch.subColor,
            borderRadius: '8px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',sans-serif",
          }}
        >
          {ch.subLabel}
        </button>{' '}
        {ch.isAdmin ? (
          <React.Fragment>
            <button
              onClick={ch.onSettings}
              style={{
                width: '34px',
                height: '34px',
                flex: '0 0 auto',
                border: '1px solid #E5E7EC',
                background: '#F7F8FA',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="#656B76" strokeWidth="1.7" />
                <path
                  d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"
                  stroke="#656B76"
                  strokeWidth="1.3"
                />
              </svg>
            </button>
          </React.Fragment>
        ) : null}{' '}
      </div>{' '}
    </React.Fragment>
  );
}
