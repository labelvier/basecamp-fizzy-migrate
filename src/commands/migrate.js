import { loadConfig, getContext, isBasecampAuthenticated, isFizzyAuthenticated } from '../config/config-manager.js';
import { showContextBanner } from '../utils/context-helper.js';
import { BasecampClient } from '../clients/basecamp-client.js';
import { FizzyClient } from '../clients/fizzy-client.js';
import { runMigration } from '../services/migration.js';
import * as logger from '../utils/logger.js';
import inquirer from 'inquirer';

/**
 * Handle migrate command
 * @param {Object} options - Command options
 */
export async function migrateCommand(options) {
  try {
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
    
    const context = options.context === false ? {} : getContext(config);
    
    // Show context banner (only if using context)
    if (options.context !== false) {
      showContextBanner(context);
    }
    
    // Apply context defaults
    const migrationOptions = {
      project: options.project || context.project_id,
      projectName: context.project_name,
      cardtable: options.cardtable || context.cardtable_id,
      account: options.account || context.account_slug,
      board: options.board || context.board_id,
      createBoard: options.createBoard,
      migrateComments: options.migrateComments,
      updateExisting: options.updateExisting,
      dryRun: options.dryRun,
      batchSize: options.batchSize || 10,
      skipUserMapping: options.skipUserMapping,
      yes: options.yes
    };
    
    // Validate required options
    if (!migrationOptions.project) {
      logger.error('--project <id> is required (or set with: bf use project <id>)');
      process.exit(1);
    }
    if (!migrationOptions.cardtable) {
      logger.error('--cardtable <id> is required (or set with: bf use cardtable <id>)');
      process.exit(1);
    }
    if (!migrationOptions.account) {
      logger.error('--account <slug> is required (or set with: bf use account <slug>)');
      process.exit(1);
    }
    if (!migrationOptions.board && !migrationOptions.createBoard) {
      logger.error('Either --board <id> or --create-board <name> is required');
      process.exit(1);
    }
    
    // Create board if requested
    if (migrationOptions.createBoard) {
      const boardName = migrationOptions.createBoard;
      logger.info(`Creating new Fizzy board: ${boardName}...`);
      
      const fizzyClient = new FizzyClient(config.fizzy);
      const board = await fizzyClient.createBoard(migrationOptions.account, {
        name: boardName
      });
      
      migrationOptions.board = board.id;
      logger.success(`✓ Board created: ${board.name} (${board.id})\n`);
    }
    
    // Confirm before proceeding (unless dry run or --yes flag)
    if (!migrationOptions.dryRun && !migrationOptions.yes) {
      const confirmed = await confirmMigration(migrationOptions);
      if (!confirmed) {
        logger.info('Migration cancelled');
        process.exit(0);
      }
    } else if (migrationOptions.yes) {
      logger.info('⚡ Skipping confirmation (--yes flag)');
    }
    
    // Initialize API clients
    const basecampClient = new BasecampClient(config.basecamp);
    const fizzyClient = new FizzyClient(config.fizzy);
    
    // Get project name if not in context
    if (!migrationOptions.projectName) {
      const project = await basecampClient.getProject(migrationOptions.project);
      migrationOptions.projectName = project.name;
    }
    
    // Run migration
    const migration = await runMigration(
      { basecampClient, fizzyClient },
      {
        projectId: migrationOptions.project,
        projectName: migrationOptions.projectName,
        cardTableId: migrationOptions.cardtable
      },
      {
        accountSlug: migrationOptions.account,
        boardId: migrationOptions.board
      },
      {
        migrateComments: migrationOptions.migrateComments,
        updateExisting: migrationOptions.updateExisting,
        dryRun: migrationOptions.dryRun,
        batchSize: migrationOptions.batchSize,
        skipUserMapping: migrationOptions.skipUserMapping
      }
    );
    
    // Exit with appropriate code
    if (migration.status === 'failed') {
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  }
}

/**
 * Confirm migration with user
 */
async function confirmMigration(options) {
  logger.warn('\n⚠️  You are about to start a migration');
  logger.info(`   From: Basecamp project ${options.project}, card table ${options.cardtable}`);
  logger.info(`   To:   Fizzy board ${options.board} (${options.account})`);
  
  if (options.migrateComments) {
    logger.info('   Comments: Will be migrated');
  }
  if (options.updateExisting) {
    logger.warn('   Update existing: Cards will be updated if they exist');
  }
  
  console.log('');
  
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to continue?',
      default: false
    }
  ]);
  
  return answer.confirm;
}
