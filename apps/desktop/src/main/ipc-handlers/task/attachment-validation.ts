import { ALLOWED_IMAGE_TYPES } from '../../../shared/constants';

export function isAllowedTaskImageMimeType(mimeType: string | undefined): boolean {
  return Boolean(
    mimeType && ALLOWED_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_TYPES)[number])
  );
}
