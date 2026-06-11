/**
 * Custom hook for managing finding selection state and actions
 */

import { useMemo } from 'react';
import { createFindingSelectionActions } from '../../shared/finding-selection';
import type { PRReviewFinding } from './useGitHubPRs';
import type { SeverityGroup } from '../constants/severity-config';

interface UseFindingSelectionProps {
  findings: PRReviewFinding[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  groupedFindings: Record<SeverityGroup, PRReviewFinding[]>;
}

export function useFindingSelection({
  findings,
  selectedIds,
  onSelectionChange,
  groupedFindings,
}: UseFindingSelectionProps) {
  return useMemo(() => createFindingSelectionActions({
    findings,
    selectedIds,
    onSelectionChange,
    groupedFindings,
    preserveDisputedSelections: true,
  }), [findings, selectedIds, onSelectionChange, groupedFindings]);
}
