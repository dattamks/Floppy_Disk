import { describe, it, expect } from 'vitest';
import { humanSize, fmtStorage, fmtDuration, extOf, previewKindOf } from './ui';

describe('humanSize', () => {
  it('shows KB under a megabyte and MB above', () => {
    expect(humanSize(512)).toBe('1 KB'); // rounds up, min 1
    expect(humanSize(2048)).toBe('2 KB');
    expect(humanSize(1572864)).toBe('1.5 MB');
  });

  it('shows GB at/above a gigabyte and guards bad input', () => {
    expect(humanSize(2 * 1073741824)).toBe('2.0 GB');
    expect(humanSize(1610612736)).toBe('1.5 GB');
    expect(humanSize(0)).toBe('0 KB');
    expect(humanSize(undefined)).toBe('0 KB');
    expect(humanSize(NaN)).toBe('0 KB');
  });
});

describe('fmtStorage', () => {
  it('formats GB, sub-GB as MB, and >=1024 GB as TB', () => {
    expect(fmtStorage(0)).toBe('0 GB');
    expect(fmtStorage(0.5)).toBe('512 MB');
    expect(fmtStorage(4.6)).toBe('4.6 GB');
    expect(fmtStorage(2048)).toBe('2 TB');
  });
});

describe('fmtDuration', () => {
  it('renders M:SS and H:MM:SS, empty for bad input', () => {
    expect(fmtDuration(0)).toBe('0:00');
    expect(fmtDuration(9)).toBe('0:09');
    expect(fmtDuration(75)).toBe('1:15');
    expect(fmtDuration(3661)).toBe('1:01:01');
    expect(fmtDuration(null)).toBe('');
    expect(fmtDuration(-5)).toBe('');
  });
});

describe('extOf', () => {
  it('returns the lowercased extension or empty', () => {
    expect(extOf('Report.PDF')).toBe('pdf');
    expect(extOf('archive.tar.gz')).toBe('gz');
    expect(extOf('noext')).toBe('');
    expect(extOf('')).toBe('');
  });
});

describe('previewKindOf', () => {
  it('maps by extension first, then by coarse kind', () => {
    expect(previewKindOf('a.png', 'file')).toBe('image');
    expect(previewKindOf('clip.mkv', 'file')).toBe('video');
    expect(previewKindOf('song.mp3', 'file')).toBe('audio');
    expect(previewKindOf('doc.pdf', 'doc')).toBe('pdf');
    expect(previewKindOf('notes.md', 'doc')).toBe('markdown');
    expect(previewKindOf('data.JSON', 'doc')).toBe('json');
    expect(previewKindOf('conf.yaml', 'doc')).toBe('yaml');
    expect(previewKindOf('script.py', 'doc')).toBe('text');
    expect(previewKindOf('unknown.xyz', 'doc')).toBe('doc');
  });

  it('honors the coarse kind when the name has no telling extension', () => {
    expect(previewKindOf('somefile', 'image')).toBe('image');
    expect(previewKindOf('somefile', 'video')).toBe('video');
    expect(previewKindOf('somefile', 'audio')).toBe('audio');
  });
});
