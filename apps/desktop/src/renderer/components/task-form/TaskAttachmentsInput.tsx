import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Upload, X } from 'lucide-react';

import type { TaskAttachment, TaskAttachmentKind } from '../../../shared/types';
import { cn } from '../../lib/utils';
import { formatFileSize, resolveFilename } from '../ImageUpload';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { TaskAttachmentPreview } from './TaskAttachmentPreview';

const MAX_TASK_ATTACHMENT_BYTES = 512 * 1024;

const ATTACHMENT_KINDS_BY_EXTENSION: Record<string, TaskAttachmentKind> = {
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

const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_KINDS_BY_EXTENSION).join(',');

interface TaskAttachmentsInputProps {
  attachments: TaskAttachment[];
  onAttachmentsChange: (attachments: TaskAttachment[]) => void;
  disabled?: boolean;
  className?: string;
}

function createAttachmentId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.slice(lastDot).toLowerCase();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function TaskAttachmentsInput({
  attachments,
  onAttachmentsChange,
  disabled = false,
  className,
}: TaskAttachmentsInputProps) {
  const { t } = useTranslation(['tasks']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (selectedFiles.length === 0 || disabled) return;

    setError(null);
    const nextAttachments: TaskAttachment[] = [];
    const existingFilenames = attachments.map((attachment) => attachment.filename);

    for (const file of selectedFiles) {
      const kind = ATTACHMENT_KINDS_BY_EXTENSION[getExtension(file.name)];
      if (!kind) {
        setError(t('tasks:attachments.errors.invalidType'));
        continue;
      }

      if (file.size > MAX_TASK_ATTACHMENT_BYTES) {
        setError(t('tasks:attachments.errors.tooLarge'));
        continue;
      }

      const filename = resolveFilename(file.name, [
        ...existingFilenames,
        ...nextAttachments.map((attachment) => attachment.filename),
      ]);
      const [data, text] = await Promise.all([fileToBase64(file), fileToText(file)]);

      nextAttachments.push({
        id: createAttachmentId(),
        filename,
        mimeType: file.type || 'text/plain',
        size: file.size,
        kind,
        data,
        previewText: text.slice(0, 16 * 1024),
      });
    }

    if (nextAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...nextAttachments]);
    }
  };

  const removeAttachment = (attachmentId: string) => {
    onAttachmentsChange(attachments.filter((attachment) => attachment.id !== attachmentId));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            {t('tasks:attachments.title')}
          </Label>
          <p className="text-xs text-muted-foreground">{t('tasks:attachments.description')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 gap-1.5"
        >
          <Upload className="h-4 w-4" />
          {t('tasks:attachments.add')}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={handleFilesSelected}
        disabled={disabled}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative">
              <TaskAttachmentPreview attachment={attachment} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7"
                onClick={() => removeAttachment(attachment.id)}
                disabled={disabled}
                aria-label={t('tasks:attachments.removeAriaLabel', { filename: attachment.filename })}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatFileSize(attachment.size)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          {t('tasks:attachments.empty')}
        </div>
      )}
    </div>
  );
}
