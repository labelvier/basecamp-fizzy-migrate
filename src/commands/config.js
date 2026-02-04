import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, resetConfig } from '../config/config-manager.js';
import * as logger from '../utils/logger.js';

/**
 * Handle config command
 * @param {string} action - 'show' or 'reset'
 */
export async function configCommand(action) {
  try {
    const normalizedAction = action.toLowerCase();

    switch (normalizedAction) {
      case 'show':
        await showConfig();
        break;
      case 'reset':
        await resetConfigCommand();
        break;
      default:
        logger.error(`Unknown action: ${action}`);
        logger.info('Valid actions: show, reset');
        process.exit(1);
    }
  } catch (error) {
    logger.error('Config command failed', error);
    process.exit(1);
  }
}

/**
 * Show current configuration
 */
async function showConfig() {
  logger.header('⚙️  Configuration');

  const config = await loadConfig();

  // Mask sensitive data
  const displayConfig = JSON.parse(JSON.stringify(config));
  
  if (displayConfig.basecamp?.access_token) {
    displayConfig.basecamp.access_token = maskToken(displayConfig.basecamp.access_token);
  }
  if (displayConfig.basecamp?.refresh_token) {
    displayConfig.basecamp.refresh_token = maskToken(displayConfig.basecamp.refresh_token);
  }
  if (displayConfig.fizzy?.access_token) {
    displayConfig.fizzy.access_token = maskToken(displayConfig.fizzy.access_token);
  }

  console.log(JSON.stringify(displayConfig, null, 2));
  console.log('');

  logger.info(chalk.gray(`Config location: ~/.bc-fizzy-migrate/config.json`));
  console.log('');
}

/**
 * Reset configuration to defaults
 */
async function resetConfigCommand() {
  logger.warn('⚠️  This will delete all configuration including:');
  logger.warn('  - Authentication tokens');
  logger.warn('  - User mappings');
  logger.warn('  - Column mappings');
  logger.warn('  - Migration history');
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to reset the configuration?',
      default: false
    }
  ]);

  if (!confirm) {
    logger.info('Reset cancelled.');
    return;
  }

  await resetConfig();
  logger.success('✓ Configuration reset to defaults.');
  logger.info('Run authentication commands to set up again.\n');
}

/**
 * Mask token for display
 * @param {string} token - Token to mask
 * @returns {string} Masked token
 */
function maskToken(token) {
  if (!token || token.length < 8) {
    return '****';
  }
  return token.substring(0, 4) + '****' + token.substring(token.length - 4);
}
