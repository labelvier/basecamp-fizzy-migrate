/**
 * HTML Converter
 * Processes HTML content from Basecamp to Fizzy format
 * 
 * Version 1: Pass-through implementation
 * Fizzy will sanitize HTML on their end
 */

/**
 * Convert Basecamp HTML to Fizzy HTML
 * @param {string} html - Basecamp HTML content
 * @returns {string} Fizzy-compatible HTML
 */
export function convertBasecampToFizzyHTML(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // v1: Return as-is, let Fizzy handle sanitization
  // Future versions could implement:
  // - Link transformation
  // - Image URL validation
  // - HTML sanitization
  // - Markdown conversion
  
  return html.trim();
}
