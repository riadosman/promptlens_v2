import { describe, expect, it } from 'vitest';
import { readDashboardUrlState, writeDashboardUrlState } from './dashboard-url';

describe('dashboard URL state', () => {
  it('restores shareable filters and prompt selection', () => {
    expect(
      readDashboardUrlState(
        'q=onboarding&projectId=project-1&minScore=50&maxScore=79&userId=user-1&promptId=prompt-1',
      ),
    ).toMatchObject({
      query: 'onboarding',
      projectId: 'project-1',
      minScore: '50',
      maxScore: '79',
      userId: 'user-1',
      promptId: 'prompt-1',
    });
  });

  it('removes privileged user filters for non-admin views', () => {
    const query = writeDashboardUrlState(
      'demo=1&userId=other-user',
      {
        query: '',
        projectId: 'project-1',
        platform: '',
        model: '',
        minScore: '',
        maxScore: '',
        userId: 'other-user',
        promptId: null,
      },
      false,
    );

    expect(query).toBe('demo=1&projectId=project-1');
  });

  it('uses empty defaults for an unfiltered dashboard', () => {
    expect(readDashboardUrlState('')).toEqual({
      query: '',
      projectId: '',
      platform: '',
      model: '',
      minScore: '',
      maxScore: '',
      userId: '',
      promptId: null,
    });
  });

  it('writes every supported admin filter and selection', () => {
    expect(
      writeDashboardUrlState(
        '',
        {
          query: 'launch plan',
          projectId: 'project-1',
          platform: 'codex',
          model: 'model-1',
          minScore: '75',
          maxScore: '90',
          userId: 'user-1',
          promptId: 'prompt-1',
        },
        true,
      ),
    ).toBe(
      'q=launch+plan&projectId=project-1&platform=codex&model=model-1&minScore=75&maxScore=90&userId=user-1&promptId=prompt-1',
    );
  });
});
