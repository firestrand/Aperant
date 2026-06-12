/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PRReviewFinding } from '../useGitHubPRs';
import { useFindingSelection } from '../useFindingSelection';
import type { SeverityGroup } from '../../constants/severity-config';

function finding(id: string, severity: SeverityGroup): PRReviewFinding {
  return {
    id,
    severity,
    category: 'quality',
    title: id,
    description: `${id} description`,
    file: 'src/example.ts',
    line: 1,
    fixable: false,
  };
}

function grouped(findings: PRReviewFinding[]): Record<SeverityGroup, PRReviewFinding[]> {
  return {
    critical: findings.filter((item) => item.severity === 'critical'),
    high: findings.filter((item) => item.severity === 'high'),
    medium: findings.filter((item) => item.severity === 'medium'),
    low: findings.filter((item) => item.severity === 'low'),
  };
}

type SelectionChange = (selectedIds: Set<string>) => void;

type SelectionChangeMock = ReturnType<typeof vi.fn<SelectionChange>>;

function idsFrom(onSelectionChange: SelectionChangeMock): string[] {
  return Array.from(onSelectionChange.mock.calls[0]?.[0] ?? new Set<string>()).sort();
}

describe('GitHub useFindingSelection', () => {
  it('preserves disputed selections when selecting all active findings', () => {
    const findings = [finding('active-1', 'medium')];
    const onSelectionChange = vi.fn<SelectionChange>();
    const { result } = renderHook(() => useFindingSelection({
      findings,
      groupedFindings: grouped(findings),
      selectedIds: new Set(['disputed-1']),
      onSelectionChange,
    }));

    result.current.selectAll();

    expect(idsFrom(onSelectionChange)).toEqual(['active-1', 'disputed-1']);
  });

  it('preserves disputed selections when selecting important findings', () => {
    const findings = [finding('critical-1', 'critical'), finding('low-1', 'low')];
    const onSelectionChange = vi.fn<SelectionChange>();
    const { result } = renderHook(() => useFindingSelection({
      findings,
      groupedFindings: grouped(findings),
      selectedIds: new Set(['disputed-1']),
      onSelectionChange,
    }));

    result.current.selectImportant();

    expect(idsFrom(onSelectionChange)).toEqual(['critical-1', 'disputed-1']);
  });
});
