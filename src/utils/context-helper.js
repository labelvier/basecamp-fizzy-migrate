import chalk from 'chalk';

/**
 * Format context info for display in command headers
 * @param {Object} context - Current context
 * @returns {string} Formatted context string
 */
export function formatContextInfo(context) {
  const parts = [];
  
  if (context.project_name) {
    parts.push(`📁 ${chalk.cyan(context.project_name)}`);
  }
  
  if (context.cardtable_id) {
    parts.push(`📊 Card Table ${chalk.cyan(context.cardtable_id)}`);
  }
  
  if (context.board_id) {
    parts.push(`📋 Board ${chalk.cyan(context.board_id)}`);
  }
  
  if (context.account_slug) {
    parts.push(`🏢 ${chalk.cyan(context.account_slug)}`);
  }
  
  return parts.length > 0 ? `[${parts.join(' | ')}]` : '';
}

/**
 * Show context banner if context is set
 * @param {Object} context - Current context
 */
export function showContextBanner(context) {
  const contextInfo = formatContextInfo(context);
  if (contextInfo) {
    console.log(chalk.gray(contextInfo));
    console.log('');
  }
}

/**
 * Check if any context is set
 * @param {Object} context - Current context
 * @returns {boolean} True if any context is set
 */
export function hasContext(context) {
  return !!(
    context.project_id ||
    context.cardtable_id ||
    context.board_id ||
    context.account_slug
  );
}
