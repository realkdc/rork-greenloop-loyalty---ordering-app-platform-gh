/**
 * Parse magic link token from various input formats
 * Supports full URLs, raw key= strings, and handles query parameters
 */
export function parseMagicLink(input: string): { token: string } | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  try {
    // Decode URI components first
    const decoded = decodeURIComponent(input);
    
    // Try to extract key from URL parameters
    const urlMatch = decoded.match(/[?&]key=([^&]+)/);
    if (urlMatch) {
      return { token: urlMatch[1] };
    }
    
    // Try to extract key from raw key= format
    const rawMatch = decoded.match(/key=([^&\s]+)/);
    if (rawMatch) {
      return { token: rawMatch[1] };
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to parse magic link:', error);
    return null;
  }
}
