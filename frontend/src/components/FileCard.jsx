import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// One card in the grid/carousel. Receives the view-model V and its item.
export default function FileCard({ V, file }) {
  return (
    <React.Fragment>
      {' '}
      <div
        onClick={file.onOpen}
        onContextMenu={file.onCtxMenu}
        style={{
          position: 'relative',
          background: theme.white,
          border: `1px solid ${theme.border}`,
          borderRadius: '15px',
          padding: '11px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px',
          minWidth: '0',
          boxShadow: '0 1px 2px rgba(16,24,40,0.03)',
          transition: 'box-shadow .15s, border-color .15s',
        }}
        {...hov({
          borderColor: theme.brandBorder,
          boxShadow: '0 6px 18px -6px rgba(81,69,229,0.25)',
        })}
      >
        {' '}
        <button
          onClick={file.onCtxMenu}
          aria-label="More actions"
          title="More actions"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.92)',
            border: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: '2',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="12" r="1.5" fill={theme.textMuted} />
            <circle cx="12" cy="12" r="1.5" fill={theme.textMuted} />
            <circle cx="19" cy="12" r="1.5" fill={theme.textMuted} />
          </svg>
        </button>{' '}
        <button
          onClick={file.onShare}
          style={{
            position: 'absolute',
            top: '8px',
            right: '40px',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.92)',
            border: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: '2',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <circle cx="7" cy="12" r="2.4" stroke={theme.textMuted} strokeWidth="1.8" />
            <circle cx="17" cy="6" r="2.4" stroke={theme.textMuted} strokeWidth="1.8" />
            <circle cx="17" cy="18" r="2.4" stroke={theme.textMuted} strokeWidth="1.8" />
            <path
              d="M9.2 10.8 14.8 7.2M9.2 13.2l5.6 3.6"
              stroke={theme.textMuted}
              strokeWidth="1.8"
            />
          </svg>
        </button>{' '}
        {file.isFolder ? (
          <React.Fragment>
            <div
              style={{
                height: `${V.d.thumbH}px`,
                borderRadius: '11px',
                background: theme.surface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                  fill={theme.brandBgSoft3}
                  stroke={theme.brand}
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </React.Fragment>
        ) : null}{' '}
        {file.showThumb ? (
          <React.Fragment>
            {' '}
            <div
              style={{
                position: 'relative',
                height: `${V.d.thumbH}px`,
                borderRadius: '11px',
                overflow: 'hidden',
                background: theme.surface4,
              }}
            >
              {' '}
              <img
                ref={file.imgRef}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />{' '}
              {file.isVideo ? (
                <React.Fragment>
                  <div
                    style={{
                      position: 'absolute',
                      inset: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      background: 'rgba(10,12,20,0.12)',
                    }}
                  >
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.92)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={theme.text}>
                        <path d="M6 4l14 8-14 8V4Z" />
                      </svg>
                    </div>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      right: '6px',
                      background: 'rgba(10,12,20,0.72)',
                      borderRadius: '5px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      color: theme.white,
                      pointerEvents: 'none',
                    }}
                  >
                    {file.duration}
                  </div>
                </React.Fragment>
              ) : null}{' '}
            </div>{' '}
          </React.Fragment>
        ) : null}{' '}
        {file.isDocOrAudio ? (
          <React.Fragment>
            <div
              style={{
                height: `${V.d.thumbH}px`,
                borderRadius: '11px',
                background: file.tileBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {file.isDoc ? (
                <React.Fragment>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
                      fill={theme.white}
                      stroke={theme.danger}
                      strokeWidth="1.4"
                    />
                    <path d="M14 3v4h4" stroke={theme.danger} strokeWidth="1.4" />
                    <path
                      d="M9 12.5h6M9 15.5h4"
                      stroke={theme.danger}
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </React.Fragment>
              ) : null}
              {file.isAudio ? (
                <React.Fragment>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 15V9m4 9V6m4 12V4m4 14v-7m4 5v-3"
                      stroke={theme.teal}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </React.Fragment>
              ) : null}
            </div>
          </React.Fragment>
        ) : null}{' '}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' }}>
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: '1',
              minWidth: '0',
            }}
          >
            {file.name}
          </span>
          <button
            onClick={file.onToggleStar}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              flex: '0 0 auto',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={file.starFill}>
              <path
                d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6L12 3Z"
                stroke={file.starStroke}
                strokeWidth="1.3"
              />
            </svg>
          </button>
        </div>{' '}
        <div
          style={{
            fontSize: '11px',
            color: theme.textFaint,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.metaLine}
        </div>{' '}
        {file.isTrashed ? (
          <React.Fragment>
            <div
              style={{
                display: 'flex',
                gap: '7px',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginTop: '1px',
              }}
            >
              <span
                style={{
                  fontSize: '10.5px',
                  color: theme.warn,
                  flex: '1 0 100%',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.retentionLabel}
              </span>
              <button
                onClick={file.onRestore}
                style={{
                  fontSize: '10.5px',
                  background: theme.surface,
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                  borderRadius: '7px',
                  padding: '4px 9px',
                  cursor: 'pointer',
                }}
              >
                Restore
              </button>
              <button
                onClick={file.onDeleteForever}
                style={{
                  fontSize: '10.5px',
                  background: theme.white,
                  border: `1px solid ${theme.dangerBorder}`,
                  color: theme.danger,
                  borderRadius: '7px',
                  padding: '4px 9px',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </React.Fragment>
        ) : null}{' '}
      </div>{' '}
    </React.Fragment>
  );
}
