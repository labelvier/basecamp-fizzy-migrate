import { loadConfig, isBasecampAuthenticated, isFizzyAuthenticated } from '../config/config-manager.js';
import { BasecampClient } from '../clients/basecamp-client.js';
import { FizzyClient } from '../clients/fizzy-client.js';
import { loadMigrationState, getMigrationSummary } from '../state/migration-state.js';
import * as logger from '../utils/logger.js';
import inquirer from 'inquirer';

/**
 * Handle resume command
 * @param {string} migrationId - Migration ID to resume
 */
export async function resumeCommand(migrationId) {
  try {
    logger.header('🔄 Resume Migration');
    
    const config = await loadConfig();
    
    // Check authentication
    if (!isBasecampAuthenticated(config)) {
      logger.error('Not authenticated with Basecamp');
      logger.info('Run: bf auth basecamp');
      process.exit(1);
    }
    
    if (!isFizzyAuthenticated(config)) {
      logger.error('Not authenticated with Fizzy');
      logger.info('Run: bf auth fizzy');
      process.exit(1);
    }
    
    // Load migration state
    logger.info('Loading migration state...');
    const migration = await loadMigrationState(migrationId);
    logger.success(`✓ Loaded migration: ${migration.migration_id}\n`);
    
    // Show current status
    logger.info(getMigrationSummary(migration));
    
    // Check if already completed
    if (migration.status === 'completed') {
      logger.info('This migration is already completed.');
      process.exit(0);
    }
    
    // Check if there are failed items
    if (migration.failed_items.length === 0) {
      logger.info('No failed items to retry.');
      process.exit(0);
    }
    
    // Confirm resume
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Retry ${migration.failed_items.length} failed items?`,
        default: true
      }
    ]);
    
    if (!answer.confirm) {
      logger.info('Resume cancelled');
      process.exit(0);
    }
    
    logger.warn('\n⚠️  Resume functionality is not yet fully implemented');
    logger.info('To retry this migration, run the migrate command again with --update-existing flag:\n');
    logger.info(`bf migrate --project=${migration.source.project_id} --cardtable=${migration.source.cardtable_id} --account=${migration.target.account_slug} --board=${migration.target.board_id} --update-existing\n`);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.error(`Migration ${migrationId} not found`);
      logger.info('Run: bf list to see available migrations');
    } else {
      logger.error('Resume failed', error);
    }
    process.exit(1);
  }
}
