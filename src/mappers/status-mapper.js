/**
 * Status Mapper
 * Maps Basecamp columns and colors to Fizzy actions and colors
 */

/**
 * Basecamp color to Fizzy color variable mapping
 */
export const BASECAMP_TO_FIZZY_COLORS = {
  'purple': 'var(--color-card-7)',
  'orange': 'var(--color-card-3)',
  'blue': 'var(--color-card-default)',
  'gray': 'var(--color-card-1)',
  'pink': 'var(--color-card-8)',
  'yellow': 'var(--color-card-2)',
  'green': 'var(--color-card-4)',
  'red': 'var(--color-card-5)',
  'default': 'var(--color-card-default)'
};

/**
 * Basecamp column types
 */
export const BASECAMP_COLUMN_TYPES = {
  TRIAGE: 'Kanban::Triage',
  NOT_NOW: 'Kanban::NotNowColumn',
  DONE: 'Kanban::DoneColumn',
  REGULAR: 'Kanban::Column'
};

/**
 * Fizzy action types for column placement
 */
export const FIZZY_ACTIONS = {
  KEEP_TRIAGE: 'keep_triage',        // Stay in "Maybe?" (triage)
  NOT_NOW: 'not_now',                 // Move to "Not Now"
  CLOSE: 'close',                     // Close the card
  TRIAGE_TO_COLUMN: 'triage_to_column' // Move to specific column
};

/**
 * Map Basecamp color to Fizzy color variable
 * @param {string} basecampColor - Basecamp color name
 * @returns {string} Fizzy CSS color variable
 */
export function mapBasecampColorToFizzy(basecampColor) {
  if (!basecampColor) {
    return BASECAMP_TO_FIZZY_COLORS.default;
  }
  
  const color = basecampColor.toLowerCase();
  return BASECAMP_TO_FIZZY_COLORS[color] || BASECAMP_TO_FIZZY_COLORS.default;
}

/**
 * Determine Fizzy action based on Basecamp column type
 * @param {string} columnType - Basecamp column type (e.g., 'Kanban::Triage')
 * @param {string} columnId - Column ID for regular columns
 * @returns {Object} Action object with type and target
 */
export function getColumnAction(columnType, columnId = null) {
  switch (columnType) {
    case BASECAMP_COLUMN_TYPES.TRIAGE:
      return {
        type: FIZZY_ACTIONS.KEEP_TRIAGE,
        target: null
      };
    
    case BASECAMP_COLUMN_TYPES.NOT_NOW:
      return {
        type: FIZZY_ACTIONS.NOT_NOW,
        target: null
      };
    
    case BASECAMP_COLUMN_TYPES.DONE:
      return {
        type: FIZZY_ACTIONS.CLOSE,
        target: null
      };
    
    case BASECAMP_COLUMN_TYPES.REGULAR:
    default:
      return {
        type: FIZZY_ACTIONS.TRIAGE_TO_COLUMN,
        target: columnId
      };
  }
}

/**
 * Detect if a column is a special type based on its name and type
 * @param {Object} column - Basecamp column object
 * @returns {string} Column type
 */
export function detectColumnType(column) {
  if (!column) {
    return BASECAMP_COLUMN_TYPES.REGULAR;
  }

  // Check explicit type first
  if (column.type) {
    return column.type;
  }

  // Fallback: detect by name
  const name = (column.title || column.name || '').toLowerCase();
  
  if (name.includes('triage') || name.includes('maybe')) {
    return BASECAMP_COLUMN_TYPES.TRIAGE;
  }
  
  if (name.includes('not now') || name.includes('later')) {
    return BASECAMP_COLUMN_TYPES.NOT_NOW;
  }
  
  if (name.includes('done') || name.includes('completed')) {
    return BASECAMP_COLUMN_TYPES.DONE;
  }

  return BASECAMP_COLUMN_TYPES.REGULAR;
}

/**
 * Check if a Fizzy column matches a Basecamp column by name
 * @param {string} basecampColumnName - Basecamp column name
 * @param {string} fizzyColumnTitle - Fizzy column title
 * @returns {boolean} True if names match (case-insensitive, trimmed)
 */
export function columnsMatch(basecampColumnName, fizzyColumnTitle) {
  if (!basecampColumnName || !fizzyColumnTitle) {
    return false;
  }

  const bcName = basecampColumnName.toLowerCase().trim();
  const fzName = fizzyColumnTitle.toLowerCase().trim();

  return bcName === fzName;
}
