import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { classifyTaskAttachment, processTaskAttachments } from '../attachment-processing';
import type { TaskAttachment } from '../../../../shared/types';

function attachment(overrides: Partial<TaskAttachment> = {}): TaskAttachment {
  return {
    id: 'attachment-1',
    filename: 'notes.md',
    mimeType: 'text/markdown',
    size: 12,
    kind: 'markdown',
    data: Buffer.from('# Notes').toString('base64'),
    ...overrides,
  };
}

describe('classifyTaskAttachment', () => {
  it('allows conservative text, markdown, code, and config files', () => {
    expect(classifyTaskAttachment('notes.md', 'text/markdown')).toBe('markdown');
    expect(classifyTaskAttachment('config.json', 'application/json')).toBe('config');
    expect(classifyTaskAttachment('index.ts', 'text/plain')).toBe('code');
  });

  it('rejects SVG, HTML, and binary-like types', () => {
    expect(classifyTaskAttachment('icon.svg', 'image/svg+xml')).toBeNull();
    expect(classifyTaskAttachment('page.html', 'text/html')).toBeNull();
    expect(classifyTaskAttachment('archive.zip', 'application/zip')).toBeNull();
  });
});

describe('processTaskAttachments', () => {
  it('bypasses ingestion when the rollout setting is disabled', async () => {
    const specDir = await mkdtemp(join(tmpdir(), 'aperant-attachment-disabled-'));

    expect(processTaskAttachments([attachment()], specDir, false)).toEqual([]);
  });

  it('copies approved attachments into the spec attachments directory with preview text', async () => {
    const specDir = await mkdtemp(join(tmpdir(), 'aperant-attachment-enabled-'));
    await mkdir(specDir, { recursive: true });

    const saved = processTaskAttachments([attachment()], specDir, true);

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      filename: 'notes.md',
      kind: 'markdown',
      path: 'attachments/notes.md',
      previewText: '# Notes',
    });
    await expect(readFile(join(specDir, 'attachments', 'notes.md'), 'utf-8')).resolves.toBe('# Notes');
  });

  it('rejects path traversal filenames and SVG attachments', async () => {
    const specDir = await mkdtemp(join(tmpdir(), 'aperant-attachment-reject-'));

    const saved = processTaskAttachments([
      attachment({ filename: '../notes.md' }),
      attachment({ filename: 'icon.svg', mimeType: 'image/svg+xml' }),
    ], specDir, true);

    expect(saved).toEqual([]);
  });

  it('rejects binary-like payloads disguised as allowed attachment extensions', async () => {
    const specDir = await mkdtemp(join(tmpdir(), 'aperant-attachment-binary-'));

    const saved = processTaskAttachments([
      attachment({
        filename: 'payload.txt',
        mimeType: 'text/plain',
        data: Buffer.from([0, 1, 2, 3]).toString('base64'),
      }),
    ], specDir, true);

    expect(saved).toEqual([]);
  });

  it('enforces the size limit on decoded bytes instead of trusting renderer metadata', async () => {
    const specDir = await mkdtemp(join(tmpdir(), 'aperant-attachment-oversize-'));

    const saved = processTaskAttachments([
      attachment({
        filename: 'large.txt',
        mimeType: 'text/plain',
        size: 1,
        data: Buffer.alloc((512 * 1024) + 1, 'a').toString('base64'),
      }),
    ], specDir, true);

    expect(saved).toEqual([]);
  });

  it('preserves previously processed attachments that already have a safe stored path', async () => {
    const specDir = await mkdtemp(join(tmpdir(), 'aperant-attachment-existing-'));
    const existing = attachment({
      data: undefined,
      path: 'attachments/notes.md',
      previewText: '# Notes',
    });

    expect(processTaskAttachments([existing], specDir, true)).toEqual([existing]);
  });

  it('rejects previously processed attachments with unsafe stored paths', async () => {
    const specDir = await mkdtemp(join(tmpdir(), 'aperant-attachment-existing-unsafe-'));

    const saved = processTaskAttachments([
      attachment({ data: undefined, path: '../notes.md' }),
      attachment({ data: undefined, path: 'attachments/../notes.md' }),
      attachment({ data: undefined, path: '/tmp/notes.md' }),
    ], specDir, true);

    expect(saved).toEqual([]);
  });
});
