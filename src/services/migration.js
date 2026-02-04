/**
 * Migration Service
 * Main orchestrator for Basecamp to Fizzy migration
 */

import * as logger from '../utils/logger.js';
import { mapColumns, getColumnMappingSummary } from './column-mapper.js';
import { mapUsers, getUnmappedUsers, formatUserMappings } from './user-mapper.js';
import { mapCard, mapComment } from '../mappers/card-mapper.js';
import {
  createMigrationState,
  saveMigrationState,
  updateProgress,
  completeMigration,
  addFailedItem,
  addWarning,
  getMigrationSummary
} from '../state/migration-state.js';

/**
 * Run full migration from Basecamp to Fizzy
 * @param {Object} clients - API clients
 * @param {Object} clients.basecampClient - Basecamp client
 * @param {Object} clients.fizzyClient - Fizzy client
 * @param {Object} source - Source information
 * @param {string} source.projectId - Basecamp project ID
 * @param {string} source.projectName - Basecamp project name
 * @param {string} source.cardTableId - Basecamp card table ID
 * @param {Object} target - Target information
 * @param {string} target.accountSlug - Fizzy account slug
 * @param {string} target.boardId - Fizzy board ID
 * @param {Object} options - Migration options
 * @returns {Promise<Object>} Migration result
 */
export async function runMigration(clients, source, target, options = {}) {
  const {
    migrateComments = false,
    updateExisting = false,
    dryRun = false,
    batchSize = 10,
    skipUserMapping = false
  } = options;

  const { basecampClient, fizzyClient } = clients;
  
  logger.info('\n╔═══════════════════════════════════════════╗');
  logger.info('║    BASECAMP → FIZZY MIGRATION TOOL        ║');
  logger.info('╚═══════════════════════════════════════════╝\n');

  if (dryRun) {
    logger.warn('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // ===== PHASE 1: DISCOVERY & VALIDATION =====
  logger.info('━━━ PHASE 1: Discovery & Validation ━━━\n');
  
  const migration = await phase1_discovery(
    basecampClient,
    fizzyClient,
    source,
    target,
    { migrateComments, updateExisting, dryRun, batchSize }
  );

  await saveMigrationState(migration);
  logger.success(`✓ Migration state created: ${migration.migration_id}\n`);

  // ===== PHASE 2: COLUMN SETUP =====
  logger.info('\n━━━ PHASE 2: Column Mapping & Setup ━━━\n');
  updateProgress(migration, { current_phase: 'column_mapping' });
  
  await phase2_columns(basecampClient, fizzyClient, migration, target, dryRun);
  await saveMigrationState(migration);
  
  logger.info(getColumnMappingSummary(migration.column_actions));

  // ===== PHASE 3: USER MAPPING =====
  logger.info('\n━━━ PHASE 3: User Mapping ━━━\n');
  updateProgress(migration, { current_phase: 'user_mapping' });
  
  if (!skipUserMapping) {
    await phase3_users(basecampClient, fizzyClient, migration, target, dryRun);
    await saveMigrationState(migration);
    
    logger.info(formatUserMappings(migration.user_mappings));
  } else {
    logger.warn('⊘ Skipping user mapping (--skip-user-mapping)\n');
  }

  // ===== PHASE 4: CARD MIGRATION (MAIN WORK) =====
  logger.info('\n━━━ PHASE 4: Card Migration ━━━\n');
  updateProgress(migration, { current_phase: 'card_migration' });
  
  await phase4_cards(basecampClient, fizzyClient, migration, source, target, options);
  await saveMigrationState(migration);

  // ===== PHASE 5: FINALIZATION =====
  logger.info('\n━━━ PHASE 5: Finalization ━━━\n');
  updateProgress(migration, { current_phase: 'finalization' });
  
  await phase5_finalize(migration);
  await saveMigrationState(migration);

  // Print final summary
  logger.info(getMigrationSummary(migration));

  return migration;
}

/**
 * Phase 1: Discovery & Validation
 */
async function phase1_discovery(basecampClient, fizzyClient, source, target, options) {
  logger.info('Fetching card table details...');
  const cardTable = await basecampClient.getCardTable(source.projectId, source.cardTableId);
  logger.success(`✓ Card Table: ${cardTable.title}`);

  logger.info('Fetching board details...');
  const board = await fizzyClient.getBoard(target.accountSlug, target.boardId);
  logger.success(`✓ Board: ${board.name}`);

  logger.info('Counting cards in all columns...');
  let totalCards = 0;
  const columnCounts = {};
  
  for (const column of cardTable.lists || []) {
    const cards = await basecampClient.getAllCardsFromColumn(source.projectId, column.id);
    columnCounts[column.id] = cards.length;
    totalCards += cards.length;
    logger.info(`  - ${column.title}: ${cards.length} cards`);
  }

  logger.success(`✓ Total cards to migrate: ${totalCards}\n`);

  const migration = createMigrationState({
    projectId: source.projectId,
    projectName: source.projectName,
    cardTableId: source.cardTableId,
    cardTableName: cardTable.title,
    accountSlug: target.accountSlug,
    boardId: target.boardId,
    boardName: board.name,
    totalCards: totalCards,
    ...options
  });

  migration.cardTable = cardTable;
  migration.board = board;
  migration.column_counts = columnCounts;

  return migration;
}

/**
 * Phase 2: Column Mapping & Setup
 */
async function phase2_columns(basecampClient, fizzyClient, migration, target, dryRun) {
  const cardTable = migration.cardTable;
  const basecampColumns = cardTable.lists || [];

  logger.info('Fetching existing Fizzy columns...');
  const fizzyColumns = await fizzyClient.getColumns(target.accountSlug, target.boardId);
  logger.success(`✓ Found ${fizzyColumns.length} existing columns\n`);

  const result = await mapColumns(
    basecampColumns,
    fizzyColumns,
    fizzyClient,
    target.accountSlug,
    target.boardId,
    { dryRun }
  );

  migration.column_mappings = result.mappings;
  migration.column_actions = result.actions;
  migration.metadata.columns_created = result.created.length;
}

/**
 * Phase 3: User Mapping
 */
async function phase3_users(basecampClient, fizzyClient, migration, target, dryRun) {
  logger.info('Fetching Basecamp project members...');
  const basecampUsers = await basecampClient.getPeople(migration.source.project_id);
  logger.success(`✓ Found ${basecampUsers.length} Basecamp users`);

  logger.info('Fetching Fizzy users...');
  const fizzyUsers = await fizzyClient.getUsers(target.accountSlug);
  logger.success(`✓ Found ${fizzyUsers.length} Fizzy users\n`);

  const result = await mapUsers(
    basecampUsers,
    fizzyUsers,
    migration.user_mappings,
    { interactive: !dryRun, skipUnmatched: false }
  );

  migration.user_mappings = result.mappings;
  migration.metadata.users_mapped = Object.keys(result.mappings).length;
}

/**
 * Phase 4: Card Migration (Main Work)
 */
async function phase4_cards(basecampClient, fizzyClient, migration, source, target, options) {
  const { migrateComments, updateExisting, dryRun, batchSize } = options;

  // First, scan for existing migrated cards
  logger.info('Scanning for previously migrated cards...');
  const existingCards = await findExistingMigratedCards(fizzyClient, target.accountSlug, target.boardId);
  migration.existing_cards = existingCards;
  logger.info(`✓ Found ${Object.keys(existingCards).length} previously migrated cards\n`);

  const cardTable = migration.cardTable;
  const columns = cardTable.lists || [];

  let processedCount = 0;

  for (const column of columns) {
    logger.info(`\n📋 Processing column: ${column.title}`);
    
    const cards = await basecampClient.getAllCardsFromColumn(source.projectId, column.id);
    logger.info(`   ${cards.length} cards to process\n`);

    // Process cards in batches
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      logger.info(`   Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cards.length / batchSize)}`);

      for (const card of batch) {
        try {
          await migrateCard(
            card,
            basecampClient,
            fizzyClient,
            migration,
            source,
            target,
            { migrateComments, updateExisting, dryRun }
          );
          
          migration.progress.successful_cards++;
          logger.success(`   ✓ ${card.title}`);
        } catch (error) {
          migration.progress.failed_cards++;
          addFailedItem(migration, 'card', card, error);
          logger.error(`   ✗ ${card.title}: ${error.message}`);
        }

        processedCount++;
        migration.progress.processed_cards = processedCount;
      }

      // Save state after each batch
      await saveMigrationState(migration);
    }
  }
}

/**
 * Migrate a single card
 */
async function migrateCard(card, basecampClient, fizzyClient, migration, source, target, options) {
  const { migrateComments, updateExisting, dryRun } = options;
  const basecampId = card.id.toString();

  // Check if already migrated
  if (migration.existing_cards[basecampId]) {
    if (!updateExisting) {
      migration.progress.skipped_cards++;
      return;
    }
  }

  if (dryRun) {
    return; // Skip actual migration in dry run
  }

  // Transform card data
  const mappedCard = mapCard(card, {
    userMappings: migration.user_mappings,
    columnMappings: migration.column_mappings
  });

  // Create card in Fizzy
  const fizzyCard = await fizzyClient.createCard(target.accountSlug, target.boardId, mappedCard.card);

  // Store in migration state (basecamp ID is already in description as HTML comment)
  migration.existing_cards[basecampId] = fizzyCard.number;

  // Place card in column
  await placeCardInColumn(fizzyClient, fizzyCard, mappedCard.metadata.column_action, target);

  // Assign users
  for (const assigneeId of mappedCard.metadata.assignee_ids) {
    try {
      await fizzyClient.assignUser(target.accountSlug, fizzyCard.number, assigneeId);
    } catch (error) {
      addWarning(migration, `Failed to assign user ${assigneeId} to card ${fizzyCard.number}`, { error: error.message });
    }
  }

  // Add steps
  for (const step of mappedCard.metadata.steps) {
    try {
      await fizzyClient.createStep(target.accountSlug, fizzyCard.number, step);
      migration.metadata.steps_migrated++;
    } catch (error) {
      addWarning(migration, `Failed to create step for card ${fizzyCard.number}`, { error: error.message });
    }
  }

  // Close if completed
  if (mappedCard.metadata.completed) {
    await fizzyClient.closeCard(target.accountSlug, fizzyCard.number);
  }

  // Migrate comments (optional)
  if (migrateComments && mappedCard.metadata.comments_count > 0) {
    await migrateComments_forCard(card, fizzyCard, basecampClient, fizzyClient, migration, source, target);
  }

  // Log unmapped assignees
  if (mappedCard.metadata.unmapped_assignees.length > 0) {
    for (const assignee of mappedCard.metadata.unmapped_assignees) {
      addWarning(migration, `Unmapped assignee: ${assignee.name} (${assignee.email})`, { card_id: card.id });
    }
  }
}

/**
 * Place card in appropriate column based on action
 */
async function placeCardInColumn(fizzyClient, fizzyCard, columnAction, target) {
  if (!columnAction) return;

  const { type, target: targetColumnId } = columnAction;

  switch (type) {
    case 'keep_triage':
      // Card is already in Maybe? by default
      break;
    
    case 'not_now':
      await fizzyClient.notNowCard(target.accountSlug, fizzyCard.number);
      break;
    
    case 'close':
      await fizzyClient.closeCard(target.accountSlug, fizzyCard.number);
      break;
    
    case 'triage_to_column':
      if (targetColumnId) {
        await fizzyClient.triageCard(target.accountSlug, fizzyCard.number, targetColumnId);
      }
      break;
  }
}

/**
 * Migrate comments for a card
 */
async function migrateComments_forCard(basecampCard, fizzyCard, basecampClient, fizzyClient, migration, source, target) {
  try {
    const comments = await basecampClient.getComments(source.projectId, basecampCard.id);
    
    for (const comment of comments) {
      try {
        const mappedComment = mapComment(comment, migration.user_mappings);
        await fizzyClient.createComment(target.accountSlug, fizzyCard.number, {
          body: mappedComment.body
        });
        migration.metadata.comments_migrated++;
      } catch (error) {
        addWarning(migration, `Failed to migrate comment for card ${fizzyCard.number}`, { error: error.message });
      }
    }
  } catch (error) {
    addWarning(migration, `Failed to fetch comments for card ${basecampCard.id}`, { error: error.message });
  }
}

/**
 * Find existing migrated cards by scanning descriptions for basecamp ID markers
 */
async function findExistingMigratedCards(fizzyClient, accountSlug, boardId) {
  const existingCards = {};
  
  try {
    // Fetch all cards from the board
    const result = await fizzyClient.getCards(accountSlug, {
      board_ids: [boardId]
    });
    
    if (result.data && result.data.length > 0) {
      // Search for basecamp ID markers in descriptions
      for (const card of result.data) {
        if (card.description) {
          // Look for format: #basecamp-id-{id}
          const match = card.description.match(/#basecamp-id-(\d+)/);
          if (match) {
            const basecampId = match[1];
            existingCards[basecampId] = card.number;
          }
        }
      }
    }
  } catch (error) {
    // If fetching cards fails, continue without existing card detection
    logger.warn(`⚠ Could not scan for existing cards: ${error.message}`);
  }
  
  return existingCards;
}

/**
 * Phase 5: Finalization
 */
async function phase5_finalize(migration) {
  const hasFailures = migration.progress.failed_cards > 0;
  const status = hasFailures ? 'partial' : 'completed';
  
  completeMigration(migration, status);
  
  if (hasFailures) {
    logger.warn(`\n⚠ Migration completed with ${migration.progress.failed_cards} failures`);
    logger.info(`Run 'bf resume ${migration.migration_id}' to retry failed items\n`);
  } else {
    logger.success('\n✓ Migration completed successfully!\n');
  }
}
