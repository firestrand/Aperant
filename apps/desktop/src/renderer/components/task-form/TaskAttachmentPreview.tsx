import { useTranslation } from 'react-i18next';

import type { TaskAttachment } from '../../../shared/types';

interface TaskAttachmentPreviewProps {
  attachment: TaskAttachment;
}

export function TaskAttachmentPreview({ attachment }: TaskAttachmentPreviewProps) {
  const { t } = useTranslation(['tasks']);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm font-medium text-foreground">{attachment.filename}</div>
        <div className="shrink-0 text-xs text-muted-foreground">{t(`tasks:attachments.kinds.${attachment.kind}`)}</div>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-background p-3 text-xs text-foreground">
        {attachment.previewText ?? ''}
      </pre>
    </div>
  );
}
