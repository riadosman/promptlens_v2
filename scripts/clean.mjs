import { rm } from 'node:fs/promises';

await Promise.all(['.turbo', 'coverage'].map((path) => rm(path, { recursive: true, force: true })));
