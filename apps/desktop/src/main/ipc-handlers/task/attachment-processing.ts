import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { TaskAttachment, TaskAttachmentKind } from '../../../shared/types';

const MAX_TASK_ATTACHMENT_BYTES = 512 * 1024;
const PREVIEW_BYTES = 16 * 1024;

const ALLOWED_ATTACHMENT_EXTENSIONS: Record<string, TaskAttachmentKind> = {
  '.txt': 'text',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.ts': 'code',
  '.tsx': 'code',
  '.js': 'code',
  '.jsx': 'code',
  '.json': 'config',
  '.yaml': 'config',
  '.yml': 'config',
  '.toml': 'config',
};

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/json',
  'application/x-yaml',
  'text/yaml',
]);

export function classifyTaskAttachment(filename: string, mimeType: string): TaskAttachmentKind | null {
  const extension = path.extname(filename).toLowerCase();
  const kind = ALLOWED_ATTACHMENT_EXTENSIONS[extension];
  if (!kind) {
    return null;
  }

  if (mimeType && !mimeType.startsWith('text/') && !ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    return null;
  }

  return kind;
}

function isSafeStoredAttachmentPath(attachmentPath: string, resolvedAttachmentsDir: string): boolean {
  if (path.isAbsolute(attachmentPath)) {
    return false;
  }

  const normalized = path.normalize(attachmentPath);
  if (!normalized.startsWith(`attachments${path.sep}`)) {
    return false;
  }

  const resolvedPath = path.resolve(path.dirname(resolvedAttachmentsDir), normalized);
  return resolvedPath.startsWith(resolvedAttachmentsDir + path.sep);
}

function isTextLikeBuffer(buffer: Buffer): boolean {
  if (buffer.includes(0)) {
    return false;
  }

  return !buffer.toString('utf-8').includes('\uFFFD');
}

export function processTaskAttachments(
  attachments: TaskAttachment[] | undefined,
  specDir: string,
  enabled: boolean
): TaskAttachment[] {
  if (!enabled || !attachments?.length) {
    return [];
  }

  const attachmentsDir = path.join(specDir, 'attachments');
  mkdirSync(attachmentsDir, { recursive: true });
  const resolvedAttachmentsDir = path.resolve(attachmentsDir);
  const saved: TaskAttachment[] = [];

  for (const attachment of attachments) {
    if (attachment.path && !attachment.data) {
      if (isSafeStoredAttachmentPath(attachment.path, resolvedAttachmentsDir)) {
        saved.push(attachment);
      }
      continue;
    }

    if (!attachment.data || attachment.size > MAX_TASK_ATTACHMENT_BYTES) {
      continue;
    }

    const kind = classifyTaskAttachment(attachment.filename, attachment.mimeType);
    if (!kind) {
      continue;
    }

    const sanitizedFilename = path.basename(attachment.filename);
    if (sanitizedFilename !== attachment.filename || !sanitizedFilename || sanitizedFilename === '.' || sanitizedFilename === '..') {
      continue;
    }

    const destination = path.join(attachmentsDir, sanitizedFilename);
    const resolvedDestination = path.resolve(destination);
    if (!resolvedDestination.startsWith(resolvedAttachmentsDir + path.sep)) {
      continue;
    }

    const buffer = Buffer.from(attachment.data, 'base64');
    if (buffer.byteLength > MAX_TASK_ATTACHMENT_BYTES) {
      continue;
    }

    if (!isTextLikeBuffer(buffer)) {
      continue;
    }

    writeFileSync(destination, buffer);
    saved.push({
      id: attachment.id,
      filename: sanitizedFilename,
      mimeType: attachment.mimeType,
      size: buffer.byteLength,
      kind,
      path: `attachments/${sanitizedFilename}`,
      previewText: buffer.toString('utf-8', 0, Math.min(buffer.byteLength, PREVIEW_BYTES)),
    });
  }

  return saved;
}
