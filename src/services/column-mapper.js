/**
 * Column Mapper Service
 * Maps Basecamp columns to Fizzy columns and creates missing ones
 */

import {
  detectColumnType,
  getColumnAction,
  mapBasecampColorToFizzy,
  columnsMatch,
  BASECAMP_COLUMN_TYPES
} from '../mappers/status-mapper.js';
import * as logger from '../utils/logger.js';

/**
 * Map Basecamp columns to Fizzy columns and create missing ones
 * @param {Array} basecampColumns - Array of Basecamp column objects
 * @param {Array} fizzyColumns - Array of existing Fizzy column objects
 * @param {Object} fizzyClient - Fizzy API client
 * @param {string} accountSlug - Fizzy account slug
 * @param {string} boardId - Fizzy board ID
 * @param {Object} options - Options
 * @param {boolean} options.dryRun - If true, don't create columns
 * @returns {Promise<Object>} Column mappings and actions
 */
export async function mapColumns(basecampColumns, fizzyColumns, fizzyClient, accountSlug, boardId, options = {}) {
  const { dryRun = false } = options;
  
  const mappings = {};
  const actions = [];
  const created = [];
  
  logger.info(`\n📊 Mapping ${basecampColumns.length} Basecamp columns...`);

  for (const bcColumn of basecampColumns) {
    const columnType = detectColumnType(bcColumn);
    const columnName = bcColumn.title || bcColumn.name;
    const columnId = bcColumn.id;

    logger.info(`\n  Processing: ${columnName} (${columnType})`);

    // Handle special column types
    if (columnType === BASECAMP_COLUMN_TYPES.TRIAGE) {
      const action = getColumnAction(columnType);
      mappings[columnId] = action;
      actions.push({
        basecamp_id: columnId,
        basecamp_name: columnName,
        action: action
      });
      logger.success(`    → Will keep cards in "Maybe?" (triage)`);
      continue;
    }

    if (columnType === BASECAMP_COLUMN_TYPES.NOT_NOW) {
      const action = getColumnAction(columnType);
      mappings[columnId] = action;
      actions.push({
        basecamp_id: columnId,
        basecamp_name: columnName,
        action: action
      });
      logger.success(`    → Will move cards to "Not Now"`);
      continue;
    }

    if (columnType === BASECAMP_COLUMN_TYPES.DONE) {
      const action = getColumnAction(columnType);
      mappings[columnId] = action;
      actions.push({
        basecamp_id: columnId,
        basecamp_name: columnName,
        action: action
      });
      logger.success(`    → Will close cards`);
      continue;
    }

    // Regular column - find or create in Fizzy
    let fizzyColumn = findMatchingColumn(columnName, fizzyColumns);

    if (fizzyColumn) {
      logger.success(`    → Found existing Fizzy column: ${fizzyColumn.name || fizzyColumn.title}`);
    } else {
      // Create new column
      if (dryRun) {
        logger.warn(`    → Would create new column: ${columnName} (dry run)`);
        fizzyColumn = {
          id: `dry-run-${columnId}`,
          name: columnName
        };
      } else {
        logger.info(`    → Creating new Fizzy column: ${columnName}`);
        try {
          const color = mapBasecampColorToFizzy(bcColumn.color);
          fizzyColumn = await fizzyClient.createColumn(accountSlug, boardId, {
            name: columnName,
            color: color
          });
          created.push(fizzyColumn);
          logger.success(`    ✓ Created column: ${fizzyColumn.name || fizzyColumn.title}`);
        } catch (error) {
          logger.error(`    ✗ Failed to create column: ${error.message}`);
          throw error;
        }
      }
    }

    // Create action mapping
    const action = getColumnAction(BASECAMP_COLUMN_TYPES.REGULAR, fizzyColumn.id);
    mappings[columnId] = action;
    actions.push({
      basecamp_id: columnId,
      basecamp_name: columnName,
      fizzy_column_id: fizzyColumn.id,
      fizzy_column_title: fizzyColumn.name || fizzyColumn.title,
      action: action
    });
  }

  logger.info(`\n✓ Column mapping complete`);
  logger.info(`  - Mapped: ${actions.length} columns`);
  logger.info(`  - Created: ${created.length} new columns`);

  return {
    mappings,        // Map of basecamp_column_id -> action object
    actions,         // Array of action details for reporting
    created          // Array of newly created Fizzy columns
  };
}

/**
 * Find a matching Fizzy column by name
 * @param {string} basecampColumnName - Basecamp column name
 * @param {Array} fizzyColumns - Array of Fizzy columns
 * @returns {Object|null} Matching Fizzy column or null
 */
function findMatchingColumn(basecampColumnName, fizzyColumns) {
  return fizzyColumns.find(fzColumn => 
    columnsMatch(basecampColumnName, fzColumn.name || fzColumn.title)
  ) || null;
}

/**
 * Get summary of column mappings for display
 * @param {Array} actions - Array of action details
 * @returns {string} Formatted summary
 */
export function getColumnMappingSummary(actions) {
  let summary = '\n📊 Column Mapping Summary:\n\n';
  
  for (const action of actions) {
    const bcName = action.basecamp_name;
    const actionType = action.action.type;
    
    switch (actionType) {
      case 'keep_triage':
        summary += `  ${bcName} → Keep in "Maybe?"\n`;
        break;
      case 'not_now':
        summary += `  ${bcName} → Move to "Not Now"\n`;
        break;
      case 'close':
        summary += `  ${bcName} → Close card\n`;
        break;
      case 'triage_to_column':
        summary += `  ${bcName} → ${action.fizzy_column_title}\n`;
        break;
    }
  }
  
  return summary;
}
