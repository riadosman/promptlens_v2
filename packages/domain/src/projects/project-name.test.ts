import { describe, expect, it } from 'vitest';
import { ProjectName } from './project-name.js';

describe('ProjectName', () => {
  it('normalizes surrounding whitespace', () => {
    expect(ProjectName.create('  Platform  ').value).toBe('Platform');
  });

  it('rejects an empty name', () => {
    expect(() => ProjectName.create('   ')).toThrow(/between 1 and 120/);
  });
});
