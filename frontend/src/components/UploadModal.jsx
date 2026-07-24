import React from 'react';
import { hov } from '../lib/ui';

// Extracted from the design view; renders when V.isUploadModal is set.
export default function UploadModal(V) {
  return V.isUploadModal ? (
    <React.Fragment>
      {' '}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: '600', fontSize: '16px' }}
        >
          Upload files
        </span>
        <button
          onClick={V.closeModal}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A909B' }}
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
        onClick={V.browseFiles}
        style={{
          border: '1.5px dashed #C7C3F5',
          borderRadius: '13px',
          padding: '30px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '9px',
          cursor: 'pointer',
          background: '#F7F7FE',
        }}
        {...hov({ borderColor: '#5145E5', background: '#F1F0FD' })}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 16V4M7 9l5-5 5 5M4 20h16"
            stroke="#5145E5"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: '13.5px', color: '#15171C', fontWeight: '500' }}>
          Drag & drop files here
        </span>
        <span style={{ fontSize: '12px', color: '#9AA1AC' }}>or click to browse your device</span>
      </div>{' '}
      <input
        ref={V.fileInputRef}
        onChange={V.onFilesPicked}
        type="file"
        multiple
        style={{ display: 'none' }}
      />{' '}
      <button
        onClick={V.simulateUpload}
        style={{
          background: 'none',
          border: 'none',
          color: '#9AA1AC',
          fontSize: '11.5px',
          cursor: 'pointer',
          alignSelf: 'center',
        }}
      >
        or add sample files
      </button>{' '}
      {(V.uploadQueueView || []).map((u, $index) => (
        <React.Fragment key={$index}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#15171C',
              }}
            >
              <span>{u.name}</span>
              <span style={{ color: '#9AA1AC' }}>{u.progress}%</span>
            </div>
            <div
              style={{
                height: '6px',
                borderRadius: '6px',
                background: '#E5E7EC',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#5145E5',
                  width: `${u.progress}%`,
                  borderRadius: '6px',
                }}
              />
            </div>
          </div>
        </React.Fragment>
      ))}{' '}
    </React.Fragment>
  ) : null;
}
