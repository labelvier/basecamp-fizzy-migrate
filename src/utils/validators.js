/**
 * Input validation utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Basecamp project ID
 */
export function isValidProjectId(id) {
  return /^\d+$/.test(id);
}

/**
 * Validate Fizzy account slug
 */
export function isValidAccountSlug(slug) {
  return /^\/?\d{7,}$/.test(slug);
}

/**
 * Normalize Fizzy account slug (ensure it starts with /)
 */
export function normalizeAccountSlug(slug) {
  if (!slug) return null;
  return slug.startsWith('/') ? slug : `/${slug}`;
}

/**
 * Validate access token format
 */
export function isValidToken(token) {
  return typeof token === 'string' && token.length > 20;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse Link header for pagination
 */
export function parseLinkHeader(header) {
  if (!header) return {};
  
  const links = {};
  const parts = header.split(',');
  
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const [, url, rel] = match;
      links[rel] = url;
    }
  }
  
  return links;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry = null
  } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      
      if (onRetry) {
        onRetry(attempt, delay, error);
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}
