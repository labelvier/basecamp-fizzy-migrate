#!/usr/bin/env node

/**
 * bc-fizzy-migrate CLI
 * Main entry point for the Basecamp to Fizzy migration tool
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config/config-manager.js';
import * as logger from './utils/logger.js';

const program = new Command();

program
  .name('bc-fizzy-migrate')
  .alias('bf')
  .description('Migrate Basecamp card tables to Fizzy boards')
  .version('1.0.0');

// Auth command
program
  .command('auth [service]')
  .description('Authenticate with Basecamp or Fizzy, or show authentication status')
  .action(async (service) => {
    const { authCommand } = await import('./commands/auth.js');
    await authCommand(service);
  });

// List command
program
  .command('list <resource>')
  .description('List projects, boards, cardtables, columns, or migrations')
  .option('--project <id>', 'Basecamp project ID')
  .option('--cardtable <id>', 'Basecamp card table ID')
  .option('--account <slug>', 'Fizzy account slug (e.g., /897362094)')
  .option('--board <id>', 'Fizzy board ID')
  .option('--no-context', 'Ignore current context')
  .action(async (resource, options) => {
    const { listCommand } = await import('./commands/list.js');
    await listCommand(resource, options);
  });

// Map users command
program
  .command('map-users')
  .description('Interactively map Basecamp users to Fizzy users')
  .requiredOption('--project <id>', 'Basecamp project ID')
  .requiredOption('--account <slug>', 'Fizzy account slug')
  .action(async (options) => {
    const { mapUsersCommand } = await import('./commands/map-users.js');
    await mapUsersCommand(options);
  });

// Use command for context management
program
  .command('use [resource] [id]')
  .description('Set or show current working context (project, board, etc)')
  .action(async (resource, id) => {
    const { useCommand } = await import('./commands/use.js');
    await useCommand(resource, id);
  });

// Migrate command
program
  .command('migrate')
  .description('Migrate a Basecamp card table to a Fizzy board')
  .option('--project <id>', 'Basecamp project ID (or use context)')
  .option('--cardtable <id>', 'Basecamp card table ID (or use context)')
  .option('--account <slug>', 'Fizzy account slug (or use context)')
  .option('--board <id>', 'Existing Fizzy board ID (or use context)')
  .option('--create-board <name>', 'Create a new board with this name')
  .option('--migrate-comments', 'Migrate card comments (slower)', false)
  .option('--update-existing', 'Update cards that were previously migrated', false)
  .option('--skip-user-mapping', 'Skip interactive user mapping', false)
  .option('-y, --yes', 'Skip confirmation prompts', false)
  .option('--dry-run', 'Show what would be migrated without making changes', false)
  .option('--batch-size <number>', 'Number of cards to process in parallel', '10')
  .option('--no-context', 'Ignore current context')
  .action(async (options) => {
    const { migrateCommand } = await import('./commands/migrate.js');
    await migrateCommand(options);
  });

// Resume command
program
  .command('resume <migrationId>')
  .description('Resume a failed or interrupted migration')
  .action(async (migrationId) => {
    const { resumeCommand } = await import('./commands/resume.js');
    await resumeCommand(migrationId);
  });

// Config command
program
  .command('config <action>')
  .description('Manage configuration (show, reset)')
  .action(async (action, options) => {
    const { configCommand } = await import('./commands/config.js');
    await configCommand(action, options);
  });

// Global error handler
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled error occurred', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n');
  logger.warn('Operation cancelled by user');
  process.exit(0);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
