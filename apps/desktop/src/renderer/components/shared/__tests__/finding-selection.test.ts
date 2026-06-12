import { describe, expect, it, vi } from 'vitest';
import {
  createFindingSelectionActions,
  type FindingSelectionSeverityGroup,
  type GroupedFindings,
} from '../finding-selection';

interface TestFinding {
  id: string;
  severity: FindingSelectionSeverityGroup;
}

function finding(id: string, severity: FindingSelectionSeverityGroup): TestFinding {
  return { id, severity };
}

const findings = [
  finding('critical-1', 'critical'),
  finding('high-1', 'high'),
  finding('medium-1', 'medium'),
  finding('low-1', 'low'),
];

function groupFindings(items: TestFinding[]): GroupedFindings<TestFinding> {
  return {
    critical: items.filter((item) => item.severity === 'critical'),
    high: items.filter((item) => item.severity === 'high'),
    medium: items.filter((item) => item.severity === 'medium'),
    low: items.filter((item) => item.severity === 'low'),
  };
}

function createActions({
  selectedIds = [],
  preserveDisputedSelections = false,
  groupedFindings = groupFindings(findings),
}: {
  selectedIds?: string[];
  preserveDisputedSelections?: boolean;
  groupedFindings?: GroupedFindings<TestFinding>;
} = {}) {
  const onSelectionChange = vi.fn<(selectedIds: Set<string>) => void>();
  const actions = createFindingSelectionActions({
    findings,
    selectedIds: new Set(selectedIds),
    groupedFindings,
    preserveDisputedSelections,
    onSelectionChange,
  });

  return { actions, onSelectionChange };
}

function selectedIdsFrom(onSelectionChange: ReturnType<typeof createActions>['onSelectionChange']): string[] {
  const selectedIds = onSelectionChange.mock.calls[0]?.[0] ?? new Set<string>();
  return Array.from(selectedIds).sort();
}

describe('createFindingSelectionActions', () => {
  it('toggles an existing finding on and off', () => {
    const add = createActions();
    add.actions.toggleFinding('critical-1');
    expect(selectedIdsFrom(add.onSelectionChange)).toEqual(['critical-1']);

    const remove = createActions({ selectedIds: ['critical-1'] });
    remove.actions.toggleFinding('critical-1');
    expect(selectedIdsFrom(remove.onSelectionChange)).toEqual([]);
  });

  it('toggles unknown IDs without validating against active findings', () => {
    const add = createActions();
    add.actions.toggleFinding('unknown-id');
    expect(selectedIdsFrom(add.onSelectionChange)).toEqual(['unknown-id']);

    const remove = createActions({ selectedIds: ['unknown-id'] });
    remove.actions.toggleFinding('unknown-id');
    expect(selectedIdsFrom(remove.onSelectionChange)).toEqual([]);
  });

  it('selects all active findings and optionally preserves disputed selections', () => {
    const dropsDisputed = createActions({ selectedIds: ['disputed-id'], preserveDisputedSelections: false });
    dropsDisputed.actions.selectAll();
    expect(selectedIdsFrom(dropsDisputed.onSelectionChange)).toEqual([
      'critical-1',
      'high-1',
      'low-1',
      'medium-1',
    ]);

    const preservesDisputed = createActions({ selectedIds: ['disputed-id'], preserveDisputedSelections: true });
    preservesDisputed.actions.selectAll();
    expect(selectedIdsFrom(preservesDisputed.onSelectionChange)).toEqual([
      'critical-1',
      'disputed-id',
      'high-1',
      'low-1',
      'medium-1',
    ]);
  });

  it('clears all selections', () => {
    const { actions, onSelectionChange } = createActions({ selectedIds: ['critical-1', 'disputed-id'] });
    actions.selectNone();
    expect(selectedIdsFrom(onSelectionChange)).toEqual([]);
  });

  it('selects critical and high findings and applies the disputed selection policy', () => {
    const dropsDisputed = createActions({ selectedIds: ['disputed-id'], preserveDisputedSelections: false });
    dropsDisputed.actions.selectImportant();
    expect(selectedIdsFrom(dropsDisputed.onSelectionChange)).toEqual(['critical-1', 'high-1']);

    const preservesDisputed = createActions({ selectedIds: ['disputed-id'], preserveDisputedSelections: true });
    preservesDisputed.actions.selectImportant();
    expect(selectedIdsFrom(preservesDisputed.onSelectionChange)).toEqual(['critical-1', 'disputed-id', 'high-1']);
  });

  it('selects and deselects an entire severity group', () => {
    const selectGroup = createActions();
    selectGroup.actions.toggleSeverityGroup('critical');
    expect(selectedIdsFrom(selectGroup.onSelectionChange)).toEqual(['critical-1']);

    const deselectGroup = createActions({ selectedIds: ['critical-1', 'medium-1'] });
    deselectGroup.actions.toggleSeverityGroup('critical');
    expect(selectedIdsFrom(deselectGroup.onSelectionChange)).toEqual(['medium-1']);
  });

  it('reports fully and partially selected groups', () => {
    const fullySelected = createActions({ selectedIds: ['critical-1'] });
    expect(fullySelected.actions.isGroupFullySelected('critical')).toBe(true);
    expect(fullySelected.actions.isGroupPartiallySelected('critical')).toBe(false);

    const groupedWithTwoHighFindings = groupFindings([
      ...findings,
      finding('high-2', 'high'),
    ]);
    const partiallySelected = createActions({
      selectedIds: ['high-1'],
      groupedFindings: groupedWithTwoHighFindings,
    });
    expect(partiallySelected.actions.isGroupFullySelected('high')).toBe(false);
    expect(partiallySelected.actions.isGroupPartiallySelected('high')).toBe(true);
  });

  it('does not report empty groups as fully or partially selected', () => {
    const groupedWithEmptyMedium = groupFindings(findings.filter((item) => item.severity !== 'medium'));
    const { actions } = createActions({ groupedFindings: groupedWithEmptyMedium });

    expect(actions.isGroupFullySelected('medium')).toBe(false);
    expect(actions.isGroupPartiallySelected('medium')).toBe(false);
  });
});
