#!/usr/bin/env node

const command = process.argv[2] ?? 'help';

if (command === 'doctor') {
  console.log(JSON.stringify({ node: process.version, platform: process.platform, status: 'ok' }));
} else {
  console.log('PromptLens CLI\n\nCommands:\n  doctor  Check the local runtime');
}
