import { describe, it, expect } from 'vitest';
import { fileType } from './fileType';

describe('fileType', () => {
  it('classifies common document types', () => {
    expect(fileType('report.pdf').key).toBe('pdf');
    expect(fileType('budget.xlsx').key).toBe('sheet');
    expect(fileType('data.csv').key).toBe('sheet');
    expect(fileType('deck.pptx').key).toBe('slides');
    expect(fileType('letter.docx').key).toBe('word');
    expect(fileType('notes.md').key).toBe('text');
  });

  it('classifies code and archives', () => {
    expect(fileType('app.py').key).toBe('code');
    expect(fileType('index.tsx').key).toBe('code');
    expect(fileType('config.yaml').key).toBe('code');
    expect(fileType('release.zip').key).toBe('archive');
    expect(fileType('backup.tar.gz').key).toBe('archive');
  });

  it('is case-insensitive and exposes an uppercase label', () => {
    expect(fileType('IMG.PDF').key).toBe('pdf');
    expect(fileType('IMG.PDF').ext).toBe('PDF');
  });

  it('falls back to a neutral file for unknown/extensionless names', () => {
    expect(fileType('mystery.xyz')).toEqual({ key: 'file', color: '#64748B', ext: 'XYZ' });
    expect(fileType('README').key).toBe('file');
    expect(fileType('README').ext).toBe('FILE');
  });
});
