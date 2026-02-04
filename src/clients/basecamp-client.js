import axios from 'axios';
import { RateLimiter, withRetry } from './rate-limiter.js';
import { defaults } from '../config/defaults.js';
import { ApiError, AuthenticationError } from '../utils/errors.js';
import { parseLinkHeader } from '../utils/validators.js';

/**
 * Basecamp API Client
 */
export class BasecampClient {
  constructor(config) {
    this.config = config;
    this.accountId = config.account_id;
    this.accessToken = config.access_token;
    this.refreshToken = config.refresh_token;
    this.baseUrl = defaults.basecamp.apiUrl;
    
    // Rate limiter
    this.rateLimiter = new RateLimiter(defaults.basecamp.rateLimit);
    
    // Create axios instance
    this.client = axios.create({
      baseURL: `${this.baseUrl}/${this.accountId}`,
      headers: {
        'User-Agent': 'bc-fizzy-migrate/1.0.0',
        'Accept': 'application/json'
      }
    });

    // Request interceptor for auth and rate limiting
    this.client.interceptors.request.use(async (config) => {
      // Rate limiting
      await this.rateLimiter.throttle();
      
      // Add authorization header
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401 && this.refreshToken) {
          // Try to refresh token
          try {
            await this.refreshAccessToken();
            // Retry the original request
            error.config.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.client.request(error.config);
          } catch (refreshError) {
            throw new AuthenticationError('Failed to refresh Basecamp token', refreshError);
          }
        }
        
        throw new ApiError(
          error.message,
          error.response?.status,
          error.response?.data
        );
      }
    );
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken() {
    const response = await axios.post(defaults.basecamp.tokenUrl, {
      type: 'refresh',
      refresh_token: this.refreshToken,
      client_id: defaults.basecamp.clientId,
      client_secret: defaults.basecamp.clientSecret
    });

    this.accessToken = response.data.access_token;
    this.refreshToken = response.data.refresh_token;

    // Update config (caller should save this)
    this.config.access_token = this.accessToken;
    this.config.refresh_token = this.refreshToken;
    
    return response.data;
  }

  /**
   * Make a GET request with retry logic
   */
  async get(path) {
    return withRetry(() => this.client.get(path));
  }

  /**
   * Make a POST request with retry logic
   */
  async post(path, data) {
    return withRetry(() => this.client.post(path, data));
  }

  /**
   * Get all projects (Basecamps) with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Array>} All projects across all pages
   */
  async getProjects(options = {}) {
    const projects = [];
    let nextUrl = '/projects.json';
    
    // Add query parameters if provided
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (params.toString()) {
      nextUrl += '?' + params.toString();
    }
    
    while (nextUrl) {
      const response = await this.get(nextUrl);
      projects.push(...response.data);
      
      // Check for next page in Link header
      const linkHeader = response.headers.link;
      if (linkHeader) {
        const links = parseLinkHeader(linkHeader);
        nextUrl = links.next ? links.next.replace(this.client.defaults.baseURL, '') : null;
      } else {
        nextUrl = null;
      }
    }
    
    return projects;
  }

  /**
   * Get a single project
   */
  async getProject(projectId) {
    const response = await this.get(`/projects/${projectId}.json`);
    return response.data;
  }

  /**
   * Get a card table
   */
  async getCardTable(projectId, cardTableId) {
    const response = await this.get(`/buckets/${projectId}/card_tables/${cardTableId}.json`);
    return response.data;
  }

  /**
   * Get cards from a column (list)
   */
  async getCards(projectId, columnId, options = {}) {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.get(`/buckets/${projectId}/card_tables/lists/${columnId}/cards.json${query}`);
    
    return {
      data: response.data,
      nextPage: this._extractNextPage(response.headers.link)
    };
  }

  /**
   * Get a single card with all details
   */
  async getCard(projectId, cardId) {
    const response = await this.get(`/buckets/${projectId}/card_tables/cards/${cardId}.json`);
    return response.data;
  }

  /**
   * Get comments for a card
   */
  async getComments(projectId, cardId) {
    const response = await this.get(`/buckets/${projectId}/recordings/${cardId}/comments.json`);
    return response.data;
  }

  /**
   * Get people in a project
   */
  async getPeople(projectId) {
    const response = await this.get(`/projects/${projectId}/people.json`);
    return response.data;
  }

  /**
   * Paginate through cards in a column
   * Returns an async generator
   */
  async *paginateCards(projectId, columnId) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getCards(projectId, columnId, { page });
      
      yield result.data;
      
      hasMore = !!result.nextPage;
      page++;
    }
  }

  /**
   * Fetch ALL cards from a column (convenience method)
   */
  async getAllCardsFromColumn(projectId, columnId) {
    const allCards = [];
    
    for await (const page of this.paginateCards(projectId, columnId)) {
      allCards.push(...page);
    }
    
    return allCards;
  }

  /**
   * Extract next page URL from Link header
   */
  _extractNextPage(linkHeader) {
    if (!linkHeader) return null;
    const links = parseLinkHeader(linkHeader);
    return links.next || null;
  }
}
