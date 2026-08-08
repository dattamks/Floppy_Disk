import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { theme } from '../lib/theme';

// React node view for images: drag-to-resize, left/center/right alignment, an
// optional caption, and an expand button that opens the shared lightbox. Plain
// (untouched) images stay clean `![](…)` Markdown; these controls only kick the
// image into its HTML form when actually used (see richimage.js).
const AlignIcon = ({ a }) => {
  const lines = a === 'center'
    ? [[6, 16], [3, 12], [7, 8]].map(([x, w]) => ({ x, w }))
    : a === 'right'
      ? [[8, 12], [4, 16], [8, 12]].map(([x, w]) => ({ x, w }))
      : [[4, 12], [4, 16], [4, 12]].map(([x, w]) => ({ x, w }));
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      {lines.map((l, i) => (
        <rect key={i} x={l.x} y={5 + i * 5} width={l.w} height="2.4" rx="1.2" fill="currentColor" />
      ))}
    </svg>
  );
};

export default function NoteImageView({ node, updateAttributes, selected, editor }) {
  const { src, alt, width, align, caption } = node.attrs;
  const imgRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const editable = editor.isEditable;
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = imgRef.current ? imgRef.current.offsetWidth : (width || 320);
    const maxW = wrapRef.current ? wrapRef.current.offsetWidth : 760;
    const onMove = (ev) => {
      const w = Math.max(80, Math.min(maxW, Math.round(startW + (ev.clientX - startX))));
      updateAttributes({ width: w });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const openLightbox = () => {
    const fn = editor.storage.image && editor.storage.image.openLightbox;
    if (fn) fn(src, alt);
  };

  const btn = {
    minWidth: 26, height: 26, padding: '0 5px', border: 'none', borderRadius: 6, cursor: 'pointer',
    color: '#fff', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <NodeViewWrapper as="div" className="note-figure" data-align={align || 'left'}
      style={{ display: 'flex', flexDirection: 'column', alignItems: justify, margin: '0.7em 0' }}>
      <div ref={wrapRef} style={{ width: '100%', display: 'flex', justifyContent: justify }}>
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 }}>
          <img ref={imgRef} src={src} alt={alt || ''} draggable={false}
            style={{ width: width ? `${width}px` : 'auto', maxWidth: '100%', borderRadius: 10, display: 'block',
              outline: selected ? `2px solid ${theme.brand}` : 'none', outlineOffset: 2, cursor: editable ? 'default' : 'zoom-in' }}
            onClick={() => { if (!editable) openLightbox(); }} />
          {editable && selected ? (
            <React.Fragment>
              <span data-testid="note-image-resize" title="Drag to resize" onMouseDown={startResize}
                style={{ position: 'absolute', right: -6, bottom: -6, width: 15, height: 15, borderRadius: 5,
                  background: theme.brand, border: `2px solid ${theme.white}`, cursor: 'nwse-resize' }} />
              <div contentEditable={false} onMouseDown={(e) => e.preventDefault()}
                style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex',
                  gap: 2, padding: 4, background: theme.toastBg, borderRadius: 9, boxShadow: '0 8px 22px rgba(0,0,0,0.3)', zIndex: 5 }}>
                {['left', 'center', 'right'].map((a) => (
                  <button key={a} data-testid={`note-image-align-${a}`} title={`Align ${a}`} onClick={() => updateAttributes({ align: a })}
                    style={{ ...btn, background: (align || 'left') === a ? theme.brand : 'transparent' }}><AlignIcon a={a} /></button>
                ))}
                <span style={{ width: 1, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
                <button data-testid="note-image-caption-toggle" title="Caption" onClick={() => updateAttributes({ caption: caption == null ? '' : null })}
                  style={{ ...btn, background: caption != null ? theme.brand : 'transparent' }}>❝</button>
                <button data-testid="note-image-expand" title="View full screen" onClick={openLightbox} style={btn}>⤢</button>
                <button data-testid="note-image-reset" title="Reset size" onClick={() => updateAttributes({ width: null })} style={btn}>↺</button>
              </div>
            </React.Fragment>
          ) : null}
        </div>
      </div>
      {caption != null ? (
        editable && selected ? (
          <input data-testid="note-image-caption" value={caption} placeholder="Add a caption…"
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ marginTop: 6, border: 'none', outline: 'none', background: 'transparent', textAlign: 'center',
              color: theme.textMuted, fontSize: 13, fontStyle: 'italic', width: width ? `${width}px` : '80%', maxWidth: '100%', fontFamily: 'inherit' }} />
        ) : (caption ? (
          <figcaption style={{ marginTop: 6, color: theme.textMuted, fontSize: 13, fontStyle: 'italic', textAlign: 'center', maxWidth: width ? `${width}px` : '80%' }}>{caption}</figcaption>
        ) : null)
      ) : null}
    </NodeViewWrapper>
  );
}
