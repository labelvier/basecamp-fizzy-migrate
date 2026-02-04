/**
 * Migration State Management
 * Handles persistence and recovery of migration state
 */

import fs from 'fs/promises';
import path from 'path';
import { getConfigDir } from '../config/config-manager.js';

const MIGRATIONS_DIR = path.join(getConfigDir(), 'migrations');

/**
 * Ensure migrations directory exists
 */
async function ensureMigrationsDir() {
  try {
    await fs.mkdir(MIGRATIONS_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists, ignore
  }
}

/**
 * Create a new migration state object
 * @param {Object} options - Migration options
 * @returns {Object} Migration state
 */
export function createMigrationState(options) {
  const {
    projectId,
    projectName,
    cardTableId,
    cardTableName,
    accountSlug,
    boardId,
    boardName,
    totalCards,
    migrateComments,
    updateExisting,
    dryRun,
    batchSize
  } = options;

  const migrationId = `mig_${Date.now()}`;

  return {
    migration_id: migrationId,
    version: '1.0.0',
    status: 'in_progress',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    
    source: {
      project_id: projectId,
      project_name: projectName,
      cardtable_id: cardTableId,
      cardtable_name: cardTableName,
      total_cards: totalCards
    },
    
    target: {
      account_slug: accountSlug,
      board_id: boardId,
      board_name: boardName
    },
    
    options: {
      migrate_comments: migrateComments || false,
      update_existing: updateExisting || false,
      dry_run: dryRun || false,
      batch_size: batchSize || 10
    },
    
    progress: {
      processed_cards: 0,
      successful_cards: 0,
      failed_cards: 0,
      skipped_cards: 0,
      current_phase: 'initialization'
    },
    
    metadata: {
      comments_migrated: 0,
      steps_migrated: 0,
      columns_created: 0,
      users_mapped: 0
    },
    
    user_mappings: {},
    column_mappings: {},
    existing_cards: {},  // Map of basecamp_id -> fizzy_card_number
    
    failed_items: [],
    warnings: []
  };
}

/**
 * Save migration state to disk
 * @param {Object} migration - Migration state object
 * @returns {Promise<void>}
 */
export async function saveMigrationState(migration) {
  await ensureMigrationsDir();
  
  migration.updated_at = new Date().toISOString();
  
  const filePath = path.join(MIGRATIONS_DIR, `${migration.migration_id}.json`);
  await fs.writeFile(filePath, JSON.stringify(migration, null, 2));
}

/**
 * Load migration state from disk
 * @param {string} migrationId - Migration ID
 * @returns {Promise<Object>} Migration state
 */
export async function loadMigrationState(migrationId) {
  const filePath = path.join(MIGRATIONS_DIR, `${migrationId}.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * List all migrations
 * @returns {Promise<Array>} Array of migration metadata
 */
export async function listMigrations() {
  await ensureMigrationsDir();
  
  const files = await fs.readdir(MIGRATIONS_DIR);
  const migrations = [];
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    try {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const data = await fs.readFile(filePath, 'utf-8');
      const migration = JSON.parse(data);
      
      migrations.push({
        migration_id: migration.migration_id,
        status: migration.status,
        started_at: migration.started_at,
        completed_at: migration.completed_at,
        source_project: migration.source.project_name,
        target_board: migration.target.board_name,
        progress: migration.progress
      });
    } catch (error) {
      // Skip invalid files
      continue;
    }
  }
  
  // Sort by started_at descending
  migrations.sort((a, b) => 
    new Date(b.started_at) - new Date(a.started_at)
  );
  
  return migrations;
}

/**
 * Update migration progress
 * @param {Object} migration - Migration state
 * @param {Object} updates - Progress updates
 */
export function updateProgress(migration, updates) {
  migration.progress = {
    ...migration.progress,
    ...updates
  };
}

/**
 * Mark migration as completed
 * @param {Object} migration - Migration state
 * @param {string} status - Final status ('completed', 'failed', 'partial')
 */
export function completeMigration(migration, status = 'completed') {
  migration.status = status;
  migration.completed_at = new Date().toISOString();
  migration.progress.current_phase = 'completed';
}

/**
 * Add a failed item to the migration state
 * @param {Object} migration - Migration state
 * @param {string} type - Item type ('card', 'comment', 'step')
 * @param {Object} item - Item details
 * @param {Error} error - Error object
 */
export function addFailedItem(migration, type, item, error) {
  migration.failed_items.push({
    type: type,
    basecamp_id: item.id || item.basecamp_id,
    title: item.title || item.name || 'Unknown',
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Add a warning to the migration state
 * @param {Object} migration - Migration state
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
export function addWarning(migration, message, context = {}) {
  migration.warnings.push({
    message: message,
    context: context,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get migration summary for display
 * @param {Object} migration - Migration state
 * @returns {string} Formatted summary
 */
export function getMigrationSummary(migration) {
  const duration = migration.completed_at 
    ? new Date(migration.completed_at) - new Date(migration.started_at)
    : new Date() - new Date(migration.started_at);
  
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  let summary = '\n';
  summary += '═══════════════════════════════════════════\n';
  summary += '           MIGRATION SUMMARY\n';
  summary += '═══════════════════════════════════════════\n\n';
  
  summary += `Migration ID: ${migration.migration_id}\n`;
  summary += `Status: ${migration.status}\n`;
  summary += `Duration: ${minutes}m ${seconds}s\n\n`;
  
  summary += `Source: ${migration.source.project_name}\n`;
  summary += `        Card Table: ${migration.source.cardtable_name || migration.source.cardtable_id}\n`;
  summary += `Target: ${migration.target.board_name}\n`;
  summary += `        Account: ${migration.target.account_slug}\n\n`;
  
  summary += '───────────────────────────────────────────\n';
  summary += '                 PROGRESS\n';
  summary += '───────────────────────────────────────────\n\n';
  
  const p = migration.progress;
  summary += `Total Cards: ${migration.source.total_cards}\n`;
  summary += `Processed: ${p.processed_cards}\n`;
  summary += `✓ Successful: ${p.successful_cards}\n`;
  summary += `✗ Failed: ${p.failed_cards}\n`;
  summary += `⊘ Skipped: ${p.skipped_cards}\n\n`;
  
  summary += '───────────────────────────────────────────\n';
  summary += '                METADATA\n';
  summary += '───────────────────────────────────────────\n\n';
  
  const m = migration.metadata;
  summary += `Comments Migrated: ${m.comments_migrated}\n`;
  summary += `Steps Migrated: ${m.steps_migrated}\n`;
  summary += `Columns Created: ${m.columns_created}\n`;
  summary += `Users Mapped: ${m.users_mapped}\n\n`;
  
  if (migration.warnings.length > 0) {
    summary += '───────────────────────────────────────────\n';
    summary += `             WARNINGS (${migration.warnings.length})\n`;
    summary += '───────────────────────────────────────────\n\n';
    
    for (const warning of migration.warnings.slice(0, 5)) {
      summary += `⚠ ${warning.message}\n`;
    }
    
    if (migration.warnings.length > 5) {
      summary += `\n... and ${migration.warnings.length - 5} more warnings\n`;
    }
    summary += '\n';
  }
  
  if (migration.failed_items.length > 0) {
    summary += '───────────────────────────────────────────\n';
    summary += `            FAILED ITEMS (${migration.failed_items.length})\n`;
    summary += '───────────────────────────────────────────\n\n';
    
    for (const item of migration.failed_items.slice(0, 10)) {
      summary += `✗ ${item.type}: ${item.title}\n`;
      summary += `  Error: ${item.error}\n\n`;
    }
    
    if (migration.failed_items.length > 10) {
      summary += `... and ${migration.failed_items.length - 10} more failures\n`;
      summary += `\nRun 'bf resume ${migration.migration_id}' to retry failed items\n\n`;
    }
  }
  
  summary += '═══════════════════════════════════════════\n';
  
  return summary;
}

/**
 * Delete a migration file
 * @param {string} migrationId - Migration ID
 * @returns {Promise<void>}
 */
export async function deleteMigration(migrationId) {
  const filePath = path.join(MIGRATIONS_DIR, `${migrationId}.json`);
  await fs.unlink(filePath);
}
