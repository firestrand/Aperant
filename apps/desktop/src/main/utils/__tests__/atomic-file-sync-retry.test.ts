/**
 * Tests for synchronous atomic-file retry behavior with mocked transient rename errors.
 *
 * Separated from atomic-file.test.ts because vi.mock() is hoisted and would affect
 * integration tests that use real filesystem operations.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

let renameSyncCallCount = 0;
let writeFileSyncCallPaths: string[] = [];
let renameErrorCode: string | null = null;
let renameFailuresRemaining = 0;
let renameAlwaysFails = false;

vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return {
    ...original,
    renameSync: (from: string, to: string) => {
      renameSyncCallCount++;
      if (renameErrorCode && (renameAlwaysFails || renameFailuresRemaining > 0)) {
        if (renameFailuresRemaining > 0) {
          renameFailuresRemaining--;
        }
        const error = new Error(`${renameErrorCode}: mocked filesystem error`) as NodeJS.ErrnoException;
        error.code = renameErrorCode;
        throw error;
      }
      return original.renameSync(from, to);
    },
    writeFileSync: (...args: Parameters<typeof original.writeFileSync>) => {
      writeFileSyncCallPaths.push(String(args[0]));
      return original.writeFileSync(...args);
    },
  };
});

import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import path from 'path';
import { AtomicFileError, writeFileAtomicSyncWithRetry } from '../atomic-file';

const TEST_DIR = path.join(__dirname, '.test-atomic-sync-retry');

describe('writeFileAtomicSyncWithRetry', () => {
  beforeEach(() => {
    renameSyncCallCount = 0;
    writeFileSyncCallPaths = [];
    renameErrorCode = null;
    renameFailuresRemaining = 0;
    renameAlwaysFails = false;

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  it('retries transient rename errors and reports atomic success when retry succeeds', () => {
    const filePath = path.join(TEST_DIR, 'retry-success.txt');
    renameErrorCode = 'EBUSY';
    renameFailuresRemaining = 1;

    const result = writeFileAtomicSyncWithRetry(filePath, 'retry content', { retryDelay: 0 });

    expect(result).toEqual({ atomic: true });
    expect(renameSyncCallCount).toBe(2);
    expect(readFileSync(filePath, 'utf-8')).toBe('retry content');
  });

  it('uses direct-write fallback after transient rename retries are exhausted', () => {
    const filePath = path.join(TEST_DIR, 'fallback.txt');
    renameErrorCode = 'EPERM';
    renameAlwaysFails = true;

    const result = writeFileAtomicSyncWithRetry(filePath, 'fallback content', {
      maxRetries: 1,
      retryDelay: 0,
    });

    expect(result).toEqual({ atomic: false });
    expect(renameSyncCallCount).toBe(2);
    expect(writeFileSyncCallPaths.at(-1)).toBe(path.resolve(filePath));
    expect(readFileSync(filePath, 'utf-8')).toBe('fallback content');
  });

  it('does not fallback for non-transient rename errors', () => {
    const filePath = path.join(TEST_DIR, 'non-transient.txt');
    renameErrorCode = 'EINVAL';
    renameAlwaysFails = true;

    expect(() => writeFileAtomicSyncWithRetry(filePath, 'content', { retryDelay: 0 })).toThrow(AtomicFileError);

    expect(renameSyncCallCount).toBe(1);
    expect(existsSync(filePath)).toBe(false);
  });
});
