import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { defaults } from './defaults.js';

const CONFIG_DIR = path.join(os.homedir(), '.bc-fizzy-migrate');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Get the config directory path
 */
export function getConfigDir() {
  return CONFIG_DIR;
}

/**
 * Get the config file path
 */
export function getConfigPath() {
  return CONFIG_FILE;
}

/**
 * Ensure config directory exists
 */
async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Load configuration from file
 */
export async function loadConfig() {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Config file doesn't exist, return default structure
      return createDefaultConfig();
    }
    throw error;
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(config) {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Update configuration with partial data
 */
export async function updateConfig(updates) {
  const config = await loadConfig();
  const merged = deepMerge(config, updates);
  await saveConfig(merged);
  return merged;
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig() {
  const config = createDefaultConfig();
  await saveConfig(config);
  return config;
}

/**
 * Create default configuration structure
 */
function createDefaultConfig() {
  return {
    version: '1.0.0',
    basecamp: {
      account_id: null,
      access_token: null,
      refresh_token: null,
      token_expires_at: null
    },
    fizzy: {
      access_token: null,
      default_account: null
    },
    context: {
      project_id: null,
      project_name: null,
      cardtable_id: null,
      board_id: null,
      account_slug: null
    },
    mappings: {
      users: {},
      columns: {}
    },
    migrations: []
  };
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  
  return output;
}

/**
 * Check if Basecamp is authenticated
 */
export function isBasecampAuthenticated(config) {
  return !!(config?.basecamp?.access_token);
}

/**
 * Check if Fizzy is authenticated
 */
export function isFizzyAuthenticated(config) {
  return !!(config?.fizzy?.access_token);
}

/**
 * Get Basecamp configuration merged with defaults
 */
export function getBasecampConfig(config) {
  return {
    ...defaults.basecamp,
    ...config?.basecamp
  };
}

/**
 * Get Fizzy configuration merged with defaults
 */
export function getFizzyConfig(config) {
  return {
    ...defaults.fizzy,
    ...config?.fizzy
  };
}

/**
 * Set current project context
 */
export async function setProjectContext(projectId, projectName) {
  await updateConfig({
    context: {
      project_id: projectId,
      project_name: projectName
    }
  });
}

/**
 * Set current cardtable context
 */
export async function setCardTableContext(cardTableId) {
  await updateConfig({
    context: {
      cardtable_id: cardTableId
    }
  });
}

/**
 * Set current board context
 */
export async function setBoardContext(boardId) {
  await updateConfig({
    context: {
      board_id: boardId
    }
  });
}

/**
 * Set current account context
 */
export async function setAccountContext(accountSlug) {
  await updateConfig({
    context: {
      account_slug: accountSlug
    }
  });
}

/**
 * Clear all context
 */
export async function clearContext() {
  await updateConfig({
    context: {
      project_id: null,
      project_name: null,
      cardtable_id: null,
      board_id: null,
      account_slug: null
    }
  });
}

/**
 * Get current context
 */
export function getContext(config) {
  return config?.context || {};
}
