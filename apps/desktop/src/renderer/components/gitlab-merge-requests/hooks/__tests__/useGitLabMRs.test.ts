/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitLabMergeRequest, GitLabMRReviewResult } from '../../../../../shared/types';
import { useMRReviewStore } from '../../../../stores/gitlab';
import { useGitLabMRs } from '../useGitLabMRs';

function mergeRequest(overrides: Partial<GitLabMergeRequest> = {}): GitLabMergeRequest {
  return {
    id: 1,
    iid: 42,
    title: 'Test MR',
    description: 'Test MR description',
    state: 'opened',
    webUrl: 'https://gitlab.example.com/project/-/merge_requests/42',
    author: { username: 'author' },
    assignees: [],
    labels: [],
    sourceBranch: 'feature',
    targetBranch: 'main',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    mergeStatus: 'can_be_merged',
    ...overrides,
  };
}

function reviewResult(overrides: Partial<GitLabMRReviewResult> = {}): GitLabMRReviewResult {
  return {
    mrIid: 42,
    project: 'group/project',
    success: true,
    findings: [],
    summary: 'Looks good',
    overallStatus: 'approve',
    reviewedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function setElectronApi(overrides: Partial<typeof window.electronAPI>) {
  window.electronAPI = {
    ...(window.electronAPI ?? {}),
    ...overrides,
  } as typeof window.electronAPI;
}

describe('useGitLabMRs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMRReviewStore.setState({ mrReviews: {} });
  });

  it('checks connection, fetches merge requests with the state filter, and preloads disk reviews', async () => {
    const mr = mergeRequest();
    const diskReview = reviewResult();
    const checkGitLabConnection = vi.fn().mockResolvedValue({
      success: true,
      data: { connected: true, projectPathWithNamespace: 'group/project' },
    });
    const getGitLabMergeRequests = vi.fn().mockResolvedValue({ success: true, data: [mr] });
    const getGitLabMRReview = vi.fn().mockResolvedValue(diskReview);
    setElectronApi({ checkGitLabConnection, getGitLabMergeRequests, getGitLabMRReview });

    const { result } = renderHook(() => useGitLabMRs('project-1', { stateFilter: 'merged' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(useMRReviewStore.getState().getMRReviewState('project-1', 42)?.result).toEqual(diskReview));

    expect(checkGitLabConnection).toHaveBeenCalledWith('project-1');
    expect(getGitLabMergeRequests).toHaveBeenCalledWith('project-1', 'merged');
    expect(getGitLabMRReview).toHaveBeenCalledWith('project-1', 42);
    expect(result.current.mergeRequests).toEqual([mr]);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.projectPath).toBe('group/project');
  });

  it('selects an MR and loads disk review when the store does not already have a result', async () => {
    const mr = mergeRequest();
    const diskReview = reviewResult();
    setElectronApi({
      checkGitLabConnection: vi.fn().mockResolvedValue({ success: true, data: { connected: true } }),
      getGitLabMergeRequests: vi.fn().mockResolvedValue({ success: true, data: [mr] }),
      getGitLabMRReview: vi.fn().mockResolvedValue(diskReview),
    });

    const { result } = renderHook(() => useGitLabMRs('project-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.selectMR(42);
    });

    await waitFor(() => expect(result.current.selectedMRIid).toBe(42));
    await waitFor(() => expect(useMRReviewStore.getState().getMRReviewState('project-1', 42)?.result).toEqual(diskReview));
  });
});
