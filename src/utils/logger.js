import chalk from 'chalk';
import ora from 'ora';

/**
 * Log levels
 */
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  SUCCESS: 'success',
  DEBUG: 'debug'
};

/**
 * Create a spinner
 */
export function createSpinner(text) {
  return ora(text);
}

/**
 * Log an error message
 */
export function error(message, error) {
  console.error(chalk.red('❌ ' + message));
  if (error && error.message) {
    console.error(chalk.red('   ' + error.message));
  }
}

/**
 * Log a warning message
 */
export function warn(message) {
  console.warn(chalk.yellow('⚠️  ' + message));
}

/**
 * Log an info message
 */
export function info(message) {
  console.log(chalk.blue('ℹ️  ' + message));
}

/**
 * Log a success message
 */
export function success(message) {
  console.log(chalk.green('✅ ' + message));
}

/**
 * Log a debug message (only in verbose mode)
 */
export function debug(message, verbose = false) {
  if (verbose) {
    console.log(chalk.gray('🔍 ' + message));
  }
}

/**
 * Print a section header
 */
export function header(text) {
  console.log(chalk.bold('\n' + text + '\n'));
}

/**
 * Print a separator line
 */
export function separator(char = '━', length = 50) {
  console.log(char.repeat(length));
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Create a progress bar
 */
export function createProgressBar(total) {
  let current = 0;
  
  return {
    update(value) {
      current = value;
      const percentage = Math.round((current / total) * 100);
      const filled = Math.round((current / total) * 40);
      const bar = '█'.repeat(filled) + '░'.repeat(40 - filled);
      
      process.stdout.write(`\r[${bar}] ${current}/${total} (${percentage}%)`);
    },
    
    stop() {
      process.stdout.write('\n');
    }
  };
}
