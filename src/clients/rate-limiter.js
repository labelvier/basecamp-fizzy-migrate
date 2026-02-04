import { sleep } from '../utils/validators.js';

/**
 * Token bucket rate limiter
 * Ensures we don't exceed API rate limits
 */
export class RateLimiter {
  constructor(requestsPerSecond = 5) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond; // tokens per second
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token (wait if necessary)
   */
  async acquire() {
    // Refill tokens based on time elapsed
    this.refill();

    // Wait until a token is available
    while (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await sleep(Math.ceil(waitTime));
      this.refill();
    }

    // Consume a token
    this.tokens -= 1;
  }

  /**
   * Refill tokens based on elapsed time
   */
  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Throttle a request (convenience method)
   */
  async throttle() {
    await this.acquire();
  }
}

/**
 * Wrap an API call with retry logic and rate limit handling
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (error.response) {
        const status = error.response.status;
        
        // Don't retry 4xx errors except 429
        if (status >= 400 && status < 500 && status !== 429) {
          throw error;
        }

        // Handle rate limiting (429)
        if (status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '5');
          const delayMs = retryAfter * 1000;
          
          if (onRetry) {
            onRetry(attempt, delayMs, error);
          }

          if (attempt < maxRetries) {
            await sleep(delayMs);
            continue;
          }
        }
      }

      // Last attempt, throw
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff for other errors
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      
      if (onRetry) {
        onRetry(attempt, delay, error);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}
