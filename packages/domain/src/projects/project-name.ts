const MAX_PROJECT_NAME_LENGTH = 120;

export class ProjectName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(input: string): ProjectName {
    const value = input.trim();

    if (value.length === 0 || value.length > MAX_PROJECT_NAME_LENGTH) {
      throw new Error(
        `Project name must contain between 1 and ${MAX_PROJECT_NAME_LENGTH} characters.`,
      );
    }

    return new ProjectName(value);
  }
}
