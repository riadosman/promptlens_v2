export interface DashboardUrlState {
  readonly query: string;
  readonly projectId: string;
  readonly platform: string;
  readonly model: string;
  readonly minScore: string;
  readonly userId: string;
  readonly promptId: string | null;
}

export function readDashboardUrlState(queryString: string): DashboardUrlState {
  const parameters = new URLSearchParams(queryString);
  return {
    query: parameters.get('q') ?? '',
    projectId: parameters.get('projectId') ?? '',
    platform: parameters.get('platform') ?? '',
    model: parameters.get('model') ?? '',
    minScore: parameters.get('minScore') ?? '',
    userId: parameters.get('userId') ?? '',
    promptId: parameters.get('promptId'),
  };
}

export function writeDashboardUrlState(
  queryString: string,
  state: DashboardUrlState,
  allowUserFilter: boolean,
): string {
  const parameters = new URLSearchParams(queryString);
  const values: ReadonlyArray<readonly [string, string | null]> = [
    ['q', state.query],
    ['projectId', state.projectId],
    ['platform', state.platform],
    ['model', state.model],
    ['minScore', state.minScore],
    ['userId', allowUserFilter ? state.userId : ''],
    ['promptId', state.promptId],
  ];

  for (const [name, value] of values) {
    if (value) parameters.set(name, value);
    else parameters.delete(name);
  }
  return parameters.toString();
}
