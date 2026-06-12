/**
 * Custom hook for managing GitLab MR finding selection state and actions
 */

import { useMemo } from 'react';
import { createFindingSelectionActions } from '../../shared/finding-selection';
import type { GitLabMRReviewFinding } from './useGitLabMRs';
import type { SeverityGroup } from '../constants/severity-config';

interface UseFindingSelectionProps {
  findings: GitLabMRReviewFinding[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  groupedFindings: Record<SeverityGroup, GitLabMRReviewFinding[]>;
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
    preserveDisputedSelections: false,
  }), [findings, selectedIds, onSelectionChange, groupedFindings]);
}
