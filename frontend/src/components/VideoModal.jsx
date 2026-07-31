import React from 'react';
import { theme } from '../lib/theme';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isVideoModal is set.
export default function VideoModal(V) {
  return V.isVideoModal ? (
    <React.Fragment>
      {' '}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
          <span
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontWeight: '600',
              fontSize: '16px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: V.vTextColor,
            }}
          >
            {V.activeFile.name}
          </span>
          <span style={{ fontSize: '11.5px', color: V.vMutedColor }}>
            {V.activeFile.channelLine}
          </span>
        </div>
        <button
          onClick={V.closeModal}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: V.vMutedColor,
            flex: '0 0 auto',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 5l14 14M19 5L5 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>{' '}
      <div
        style={{
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          background: theme.black,
          flex: V.vVideoFlex,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '0',
        }}
      >
        {' '}
        <video
          ref={V.videoRef}
          playsInline
          style={{
            width: '100%',
            maxHeight: V.vVideoMaxH,
            display: 'block',
            background: theme.black,
          }}
        />{' '}
        <button
          onClick={V.toggleVideoPlay}
          style={{
            position: 'absolute',
            inset: '0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {V.videoNotPlaying ? (
            <React.Fragment>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.92)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={theme.text}>
                  <path d="M6 4l14 8-14 8V4Z" />
                </svg>
              </div>
            </React.Fragment>
          ) : null}
        </button>{' '}
        {V.videoLoading ? (
          <React.Fragment>
            <div
              style={{
                position: 'absolute',
                inset: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.35)',
                  borderTopColor: theme.white,
                  animation: 'fdspin 0.8s linear infinite',
                }}
              />
            </div>
          </React.Fragment>
        ) : null}{' '}
      </div>{' '}
      <div
        onClick={V.scrubVideo}
        style={{
          height: '6px',
          borderRadius: '6px',
          background: V.vTrackBg,
          cursor: 'pointer',
          overflow: 'hidden',
          flex: '0 0 auto',
        }}
      >
        <div
          style={{
            height: '100%',
            background: theme.brand,
            width: `${V.videoProgress}%`,
            borderRadius: '6px',
          }}
        />
      </div>{' '}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          position: 'relative',
          flex: '0 0 auto',
        }}
      >
        {' '}
        <button
          onClick={V.toggleVideoPlay}
          style={{
            background: 'none',
            border: 'none',
            color: V.vTextColor,
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          {V.videoPlaying ? (
            <React.Fragment>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </React.Fragment>
          ) : null}
          {V.videoNotPlaying ? (
            <React.Fragment>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4l14 8-14 8V4Z" />
              </svg>
            </React.Fragment>
          ) : null}
        </button>{' '}
        <span
          style={{ fontSize: '11.5px', color: V.vMutedColor, fontVariantNumeric: 'tabular-nums' }}
        >
          {V.videoTimeLabel}
        </span>{' '}
        <button
          onClick={V.toggleMute}
          style={{
            background: 'none',
            border: 'none',
            color: V.vTextColor,
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 9v6h4l5 4V5L8 9H4Z"
              stroke={V.volumeColor}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {V.videoMuted ? (
              <React.Fragment>
                <path
                  d="M17 9l4 6M21 9l-4 6"
                  stroke={theme.danger}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </React.Fragment>
            ) : null}
          </svg>
        </button>{' '}
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={V.videoVolume}
          onInput={V.setVolume}
          style={{ width: '64px', accentColor: theme.brand, cursor: 'pointer' }}
        />{' '}
        <button
          onClick={V.cycleRate}
          title="Playback speed"
          style={{
            background: V.sdBg,
            border: `1px solid ${V.sdBorder}`,
            color: V.vTextColor,
            fontSize: '10.5px',
            fontWeight: '600',
            borderRadius: '6px',
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          {V.rateLabel}
        </button>{' '}
        <div style={{ flex: '1' }} />{' '}
        <button
          onClick={V.toggleCC}
          style={{
            background: 'none',
            fontSize: '10.5px',
            fontWeight: '700',
            borderRadius: '6px',
            padding: '4px 7px',
            color: V.ccColor,
            border: `1px solid ${V.ccBorder}`,
            cursor: 'pointer',
          }}
        >
          CC
        </button>{' '}
        {/* DEACTIVATED (Drive-focus pivot): SD/HD tier selector - see docs/deactivated-features.md */}
        <button
          onClick={V.toggleTheater}
          style={{
            background: 'none',
            border: 'none',
            color: V.vTextColor,
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          {V.videoFullscreen ? (
            <React.Fragment>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </React.Fragment>
          ) : null}
          {V.videoNotFullscreen ? (
            <React.Fragment>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </React.Fragment>
          ) : null}
        </button>{' '}
      </div>{' '}
      {/* DEACTIVATED (Drive-focus pivot): HD-upgrade hint + pre-roll ad slot -
          see docs/deactivated-features.md */}
    </React.Fragment>
  ) : null;
}
