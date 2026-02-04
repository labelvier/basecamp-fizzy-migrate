/**
 * User Mapper Service
 * Interactive user mapping with auto-matching and caching
 */

import inquirer from 'inquirer';
import * as logger from '../utils/logger.js';

/**
 * Map Basecamp users to Fizzy users
 * @param {Array} basecampUsers - Array of Basecamp user objects
 * @param {Array} fizzyUsers - Array of Fizzy user objects
 * @param {Object} existingMappings - Existing user mappings from config
 * @param {Object} options - Options
 * @param {boolean} options.interactive - If false, only auto-match
 * @param {boolean} options.skipUnmatched - If true, skip unmapped users without prompting
 * @returns {Promise<Object>} User mappings
 */
export async function mapUsers(basecampUsers, fizzyUsers, existingMappings = {}, options = {}) {
  const { interactive = true, skipUnmatched = false } = options;
  
  const mappings = { ...existingMappings };
  const stats = {
    total: basecampUsers.length,
    existing: 0,
    autoMatched: 0,
    manuallyMapped: 0,
    skipped: 0
  };

  logger.info(`\n👥 Mapping ${basecampUsers.length} Basecamp users to Fizzy users...`);
  logger.info(`   Available Fizzy users: ${fizzyUsers.length}\n`);

  for (const bcUser of basecampUsers) {
    const bcId = bcUser.id.toString();
    
    // Check if already mapped
    if (mappings[bcId] && mappings[bcId].fizzy_id) {
      logger.info(`  ✓ ${bcUser.name} (${bcUser.email_address}) - already mapped`);
      stats.existing++;
      continue;
    }

    // Try auto-match by email
    const autoMatch = findUserByEmail(bcUser.email_address, fizzyUsers);
    
    if (autoMatch) {
      if (interactive) {
        // Ask for confirmation
        const confirmed = await confirmAutoMatch(bcUser, autoMatch);
        if (confirmed) {
          mappings[bcId] = createMapping(bcUser, autoMatch);
          logger.success(`  ✓ Auto-matched: ${bcUser.name} → ${autoMatch.name}`);
          stats.autoMatched++;
          continue;
        }
      } else {
        // Non-interactive: accept auto-match
        mappings[bcId] = createMapping(bcUser, autoMatch);
        logger.success(`  ✓ Auto-matched: ${bcUser.name} → ${autoMatch.name}`);
        stats.autoMatched++;
        continue;
      }
    }

    // No auto-match found
    if (!interactive || skipUnmatched) {
      logger.warn(`  ⊘ ${bcUser.name} (${bcUser.email_address}) - skipped (no match)`);
      stats.skipped++;
      continue;
    }

    // Interactive manual mapping
    const manualMatch = await promptForManualMapping(bcUser, fizzyUsers);
    
    if (manualMatch) {
      mappings[bcId] = createMapping(bcUser, manualMatch);
      logger.success(`  ✓ Manually mapped: ${bcUser.name} → ${manualMatch.name}`);
      stats.manuallyMapped++;
    } else {
      logger.warn(`  ⊘ ${bcUser.name} - skipped by user`);
      stats.skipped++;
    }
  }

  // Print summary
  logger.info(`\n✓ User mapping complete:`);
  logger.info(`  - Total users: ${stats.total}`);
  logger.info(`  - Already mapped: ${stats.existing}`);
  logger.info(`  - Auto-matched: ${stats.autoMatched}`);
  logger.info(`  - Manually mapped: ${stats.manuallyMapped}`);
  logger.info(`  - Skipped: ${stats.skipped}`);

  return {
    mappings,
    stats
  };
}

/**
 * Find Fizzy user by email
 * @param {string} email - Email to search for
 * @param {Array} fizzyUsers - Array of Fizzy users
 * @returns {Object|null} Matching Fizzy user or null
 */
function findUserByEmail(email, fizzyUsers) {
  if (!email) return null;
  
  const normalizedEmail = email.toLowerCase().trim();
  return fizzyUsers.find(user => {
    // Try multiple possible email fields
    const userEmail = user.email || user.email_address || user.emailAddress;
    return userEmail && userEmail.toLowerCase().trim() === normalizedEmail;
  }) || null;
}

/**
 * Create a user mapping object
 * @param {Object} basecampUser - Basecamp user
 * @param {Object} fizzyUser - Fizzy user
 * @returns {Object} Mapping object
 */
function createMapping(basecampUser, fizzyUser) {
  // Try multiple possible email fields
  const fizzyEmail = fizzyUser.email || fizzyUser.email_address || fizzyUser.emailAddress;
  
  return {
    basecamp_id: basecampUser.id.toString(),
    basecamp_email: basecampUser.email_address,
    basecamp_name: basecampUser.name,
    fizzy_id: fizzyUser.id,
    fizzy_email: fizzyEmail,
    fizzy_name: fizzyUser.name,
    mapped_at: new Date().toISOString()
  };
}

/**
 * Prompt user to confirm auto-match
 * @param {Object} basecampUser - Basecamp user
 * @param {Object} fizzyUser - Fizzy user
 * @returns {Promise<boolean>} True if confirmed
 */
async function confirmAutoMatch(basecampUser, fizzyUser) {
  const fizzyEmail = fizzyUser.email || fizzyUser.email_address || fizzyUser.emailAddress || 'no email';
  
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Match "${basecampUser.name}" (${basecampUser.email_address}) → "${fizzyUser.name}" (${fizzyEmail})?`,
      default: true
    }
  ]);

  return answer.confirm;
}

/**
 * Prompt user to manually select a Fizzy user
 * @param {Object} basecampUser - Basecamp user
 * @param {Array} fizzyUsers - Array of Fizzy users
 * @returns {Promise<Object|null>} Selected Fizzy user or null if skipped
 */
async function promptForManualMapping(basecampUser, fizzyUsers) {
  logger.warn(`\n  No automatic match for: ${basecampUser.name} (${basecampUser.email_address})`);
  
  const choices = [
    { name: '[ Skip this user ]', value: null },
    new inquirer.Separator(),
    ...fizzyUsers.map(user => {
      const userEmail = user.email || user.email_address || user.emailAddress || 'no email';
      return {
        name: `${user.name} (${userEmail})`,
        value: user
      };
    })
  ];

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'user',
      message: 'Select a Fizzy user to map to:',
      choices: choices,
      pageSize: 15
    }
  ]);

  return answer.user;
}

/**
 * Get list of unmapped Basecamp users from card data
 * @param {Array} cards - Array of Basecamp cards
 * @param {Object} userMappings - Existing user mappings
 * @returns {Array} Array of unique unmapped user objects
 */
export function getUnmappedUsers(cards, userMappings) {
  const unmappedSet = new Map();

  for (const card of cards) {
    // Check card assignees
    if (card.assignees) {
      for (const assignee of card.assignees) {
        const id = assignee.id.toString();
        if (!userMappings[id] && !unmappedSet.has(id)) {
          unmappedSet.set(id, {
            id: assignee.id,
            name: assignee.name,
            email_address: assignee.email_address
          });
        }
      }
    }

    // Check step assignees
    if (card.steps) {
      for (const step of card.steps) {
        if (step.assignee) {
          const id = step.assignee.id.toString();
          if (!userMappings[id] && !unmappedSet.has(id)) {
            unmappedSet.set(id, {
              id: step.assignee.id,
              name: step.assignee.name,
              email_address: step.assignee.email_address
            });
          }
        }
      }
    }
  }

  return Array.from(unmappedSet.values());
}

/**
 * Format user mappings for display
 * @param {Object} mappings - User mappings
 * @returns {string} Formatted string
 */
export function formatUserMappings(mappings) {
  const mapped = Object.values(mappings).filter(m => m.fizzy_id);
  
  if (mapped.length === 0) {
    return '  No user mappings';
  }

  let output = '\n👥 User Mappings:\n\n';
  for (const mapping of mapped) {
    output += `  ${mapping.basecamp_name} → ${mapping.fizzy_name}\n`;
  }
  
  return output;
}
