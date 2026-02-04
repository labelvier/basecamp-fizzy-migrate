import { loadConfig, isBasecampAuthenticated, isFizzyAuthenticated, saveConfig } from '../config/config-manager.js';
import { BasecampClient } from '../clients/basecamp-client.js';
import { FizzyClient } from '../clients/fizzy-client.js';
import { mapUsers, formatUserMappings } from '../services/user-mapper.js';
import * as logger from '../utils/logger.js';

/**
 * Handle map-users command
 * @param {Object} options - Command options
 */
export async function mapUsersCommand(options) {
  try {
    logger.header('👥 User Mapping');
    
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
    
    const projectId = options.project;
    const accountSlug = options.account;
    
    // Initialize API clients
    const basecampClient = new BasecampClient(config.basecamp);
    const fizzyClient = new FizzyClient(config.fizzy);
    
    // Fetch users
    logger.info('Fetching Basecamp project members...');
    const basecampUsers = await basecampClient.getPeople(projectId);
    logger.success(`✓ Found ${basecampUsers.length} Basecamp users`);
    
    logger.info('Fetching Fizzy users...');
    const fizzyUsers = await fizzyClient.getUsers(accountSlug);
    logger.success(`✓ Found ${fizzyUsers.length} Fizzy users\n`);
    
    // Load existing mappings from config
    const existingMappings = config.mappings?.users || {};
    
    // Run interactive mapping
    const result = await mapUsers(
      basecampUsers,
      fizzyUsers,
      existingMappings,
      { interactive: true, skipUnmatched: false }
    );
    
    // Save mappings to config
    if (!config.mappings) {
      config.mappings = {};
    }
    config.mappings.users = result.mappings;
    await saveConfig(config);
    
    logger.success('\n✓ User mappings saved to config');
    logger.info(formatUserMappings(result.mappings));
    
  } catch (error) {
    logger.error('User mapping failed', error);
    process.exit(1);
  }
}
