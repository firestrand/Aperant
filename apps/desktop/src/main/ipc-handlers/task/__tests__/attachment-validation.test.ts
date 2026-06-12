import { describe, expect, it } from 'vitest';

import { isAllowedTaskImageMimeType } from '../attachment-validation';

describe('isAllowedTaskImageMimeType', () => {
  it('allows raster image types supported by shared constants', () => {
    expect(isAllowedTaskImageMimeType('image/png')).toBe(true);
    expect(isAllowedTaskImageMimeType('image/jpeg')).toBe(true);
    expect(isAllowedTaskImageMimeType('image/webp')).toBe(true);
  });

  it('rejects SVG and missing MIME types until sandboxed sanitization exists', () => {
    expect(isAllowedTaskImageMimeType('image/svg+xml')).toBe(false);
    expect(isAllowedTaskImageMimeType(undefined)).toBe(false);
  });
});
