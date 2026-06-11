import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectAgentOverrides } from '../../shared/types/project';

const { getFeatureSettingsMock, createSimpleClientMock, streamTextMock, generateTextMock } = vi.hoisted(() => ({
  getFeatureSettingsMock: vi.fn(),
  createSimpleClientMock: vi.fn(),
  streamTextMock: vi.fn(),
  generateTextMock: vi.fn(),
}));

vi.mock('../ipc-handlers/feature-settings-helper', () => ({
  getActiveProviderFeatureSettings: getFeatureSettingsMock,
}));

vi.mock('../ai/client/factory', () => ({
  createSimpleClient: createSimpleClientMock,
}));

vi.mock('ai', () => ({
  streamText: streamTextMock,
  generateText: generateTextMock,
}));

vi.mock('../sentry', () => ({
  safeBreadcrumb: vi.fn(),
  safeCaptureException: vi.fn(),
}));

describe('project-aware naming generators', () => {
  const projectOverrides: ProjectAgentOverrides = {
    provider: 'google',
    featureModels: {
      insights: 'project-insights',
      ideation: 'project-ideation',
      roadmap: 'project-roadmap',
      githubIssues: 'project-github-issues',
      githubPrs: 'project-github-prs',
      utility: 'project-utility',
      naming: 'project-naming',
    },
    featureThinking: {
      insights: 'medium',
      ideation: 'medium',
      roadmap: 'medium',
      githubIssues: 'medium',
      githubPrs: 'medium',
      utility: 'low',
      naming: 'high',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getFeatureSettingsMock.mockReturnValue({ model: 'project-naming', thinkingLevel: 'high' });
    createSimpleClientMock.mockResolvedValue({
      model: 'mock-model',
      systemPrompt: 'system',
      resolvedModelId: 'project-naming',
    });
    streamTextMock.mockReturnValue({ text: Promise.resolve('Generated Title') });
    generateTextMock.mockResolvedValue({ text: 'Terminal Name' });
  });

  it('passes project overrides to task title naming settings', async () => {
    const { TitleGenerator } = await import('../title-generator');
    const generator = new TitleGenerator();

    await generator.generateTitle('implement project-aware title naming', projectOverrides);

    expect(getFeatureSettingsMock).toHaveBeenCalledWith('naming', projectOverrides);
    expect(createSimpleClientMock).toHaveBeenCalledWith(expect.objectContaining({
      modelShorthand: 'project-naming',
      thinkingLevel: 'high',
    }));
  });

  it('passes project overrides to terminal naming settings', async () => {
    const { TerminalNameGenerator } = await import('../terminal-name-generator');
    const generator = new TerminalNameGenerator();

    await generator.generateName('npm test', '/tmp/project', projectOverrides);

    expect(getFeatureSettingsMock).toHaveBeenCalledWith('naming', projectOverrides);
    expect(createSimpleClientMock).toHaveBeenCalledWith(expect.objectContaining({
      modelShorthand: 'project-naming',
      thinkingLevel: 'high',
    }));
  });
});
