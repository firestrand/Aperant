export type FindingSelectionSeverityGroup = 'critical' | 'high' | 'medium' | 'low';

export interface FindingSelectionItem {
  id: string;
}

export type GroupedFindings<T extends FindingSelectionItem> = Record<FindingSelectionSeverityGroup, T[]>;

export interface FindingSelectionOptions<T extends FindingSelectionItem> {
  findings: T[];
  selectedIds: Set<string>;
  groupedFindings: GroupedFindings<T>;
  preserveDisputedSelections: boolean;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

export interface FindingSelectionActions {
  toggleFinding: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectImportant: () => void;
  toggleSeverityGroup: (severity: FindingSelectionSeverityGroup) => void;
  isGroupFullySelected: (severity: FindingSelectionSeverityGroup) => boolean;
  isGroupPartiallySelected: (severity: FindingSelectionSeverityGroup) => boolean;
}

function preserveDisputedIds<T extends FindingSelectionItem>(
  nextIds: Set<string>,
  findings: T[],
  selectedIds: Set<string>,
): Set<string> {
  const activeIds = new Set(findings.map((finding) => finding.id));

  for (const id of selectedIds) {
    if (!activeIds.has(id)) {
      nextIds.add(id);
    }
  }

  return nextIds;
}

function applyDisputedSelectionPolicy<T extends FindingSelectionItem>(
  nextIds: Set<string>,
  options: Pick<FindingSelectionOptions<T>, 'findings' | 'selectedIds' | 'preserveDisputedSelections'>,
): Set<string> {
  if (!options.preserveDisputedSelections) {
    return nextIds;
  }

  return preserveDisputedIds(nextIds, options.findings, options.selectedIds);
}

export function createFindingSelectionActions<T extends FindingSelectionItem>({
  findings,
  selectedIds,
  groupedFindings,
  preserveDisputedSelections,
  onSelectionChange,
}: FindingSelectionOptions<T>): FindingSelectionActions {
  return {
    toggleFinding(id) {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
    },

    selectAll() {
      const activeIds = new Set(findings.map((finding) => finding.id));
      onSelectionChange(applyDisputedSelectionPolicy(activeIds, {
        findings,
        selectedIds,
        preserveDisputedSelections,
      }));
    },

    selectNone() {
      onSelectionChange(new Set());
    },

    selectImportant() {
      const important = [...groupedFindings.critical, ...groupedFindings.high];
      const importantIds = new Set(important.map((finding) => finding.id));
      onSelectionChange(applyDisputedSelectionPolicy(importantIds, {
        findings,
        selectedIds,
        preserveDisputedSelections,
      }));
    },

    toggleSeverityGroup(severity) {
      const groupFindings = groupedFindings[severity];
      const allSelected = groupFindings.every((finding) => selectedIds.has(finding.id));

      const next = new Set(selectedIds);
      if (allSelected) {
        for (const finding of groupFindings) {
          next.delete(finding.id);
        }
      } else {
        for (const finding of groupFindings) {
          next.add(finding.id);
        }
      }
      onSelectionChange(next);
    },

    isGroupFullySelected(severity) {
      const groupFindings = groupedFindings[severity];
      return groupFindings.length > 0 && groupFindings.every((finding) => selectedIds.has(finding.id));
    },

    isGroupPartiallySelected(severity) {
      const groupFindings = groupedFindings[severity];
      const selectedCount = groupFindings.filter((finding) => selectedIds.has(finding.id)).length;
      return selectedCount > 0 && selectedCount < groupFindings.length;
    },
  };
}
