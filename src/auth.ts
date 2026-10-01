import { ProxyConfig } from './types';

/**
 * Encodes a ProxyConfig object into a URL-safe Base64 string
 */
export function encodeConfigToken(config: Partial<ProxyConfig>): string {
  const jsonStr = JSON.stringify(config);
  // Convert UTF-8 to base64
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  // URL safe Base64
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 string back into a ProxyConfig object
 */
export function decodeConfigToken(token: string): Partial<ProxyConfig> {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error('Invalid or corrupted configuration token.');
  }
}

/**
 * Extracts ProxyConfig from Request (Query params, Basic Auth header, Path token)
 */
export function extractConfigFromRequest(request: Request): ProxyConfig | null {
  const url = new URL(request.url);

  let tokenConfig: Partial<ProxyConfig> = {};

  // Check if token is in path (e.g. /subscribe/:token.ics or /export/:token)
  const subscribeMatch = url.pathname.match(/^\/(?:subscribe|feed|calendar)\/([^/]+?)(?:\.ics)?$/i);
  if (subscribeMatch) {
    const rawToken = subscribeMatch[1];
    tokenConfig = decodeConfigToken(rawToken);
  } else if (url.searchParams.has('token')) {
    tokenConfig = decodeConfigToken(url.searchParams.get('token')!);
  }

  // Query parameters take precedence or fill in missing fields
  const caldavUrl =
    url.searchParams.get('caldav_url') ||
    url.searchParams.get('url') ||
    tokenConfig.caldavUrl;

  if (!caldavUrl) {
    return null;
  }

  // Parse basic auth from Authorization header if present
  let headerUsername: string | undefined;
  let headerPassword: string | undefined;

  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
    try {
      const base64Part = authHeader.substring(6).trim();
      const decoded = atob(base64Part);
      const colonIdx = decoded.indexOf(':');
      if (colonIdx >= 0) {
        headerUsername = decoded.substring(0, colonIdx);
        headerPassword = decoded.substring(colonIdx + 1);
      }
    } catch {
      // Ignore header decode error, fallback to params
    }
  }

  const username =
    url.searchParams.get('username') ||
    url.searchParams.get('user') ||
    headerUsername ||
    tokenConfig.username;

  const password =
    url.searchParams.get('password') ||
    url.searchParams.get('pass') ||
    headerPassword ||
    tokenConfig.password;

  const calendarName =
    url.searchParams.get('calendar_name') ||
    url.searchParams.get('name') ||
    tokenConfig.calendarName;

  const pastDaysParam = url.searchParams.get('past_days');
  const pastDays = pastDaysParam !== null ? parseInt(pastDaysParam, 10) : tokenConfig.pastDays;

  const futureDaysParam = url.searchParams.get('future_days');
  const futureDays = futureDaysParam !== null ? parseInt(futureDaysParam, 10) : tokenConfig.futureDays;

  const startDate =
    url.searchParams.get('start') ||
    url.searchParams.get('start_date') ||
    tokenConfig.startDate;

  const endDate =
    url.searchParams.get('end') ||
    url.searchParams.get('end_date') ||
    tokenConfig.endDate;

  const allParam = url.searchParams.get('all') || url.searchParams.get('all_events');
  const fetchAll =
    allParam !== null
      ? allParam === '1' || allParam.toLowerCase() === 'true'
      : tokenConfig.fetchAll;

  const cacheTtlParam = url.searchParams.get('cache_ttl') || url.searchParams.get('ttl');
  const cacheTtl = cacheTtlParam !== null ? parseInt(cacheTtlParam, 10) : tokenConfig.cacheTtl;

  const bypassCacheParam = url.searchParams.get('bypass_cache') || url.searchParams.get('no_cache');
  const cacheControlHeader = request.headers.get('Cache-Control');
  const bypassCache =
    bypassCacheParam === '1' ||
    bypassCacheParam?.toLowerCase() === 'true' ||
    cacheControlHeader?.includes('no-cache') ||
    tokenConfig.bypassCache;

  return {
    caldavUrl,
    username,
    password,
    calendarName,
    pastDays: pastDays !== undefined && !isNaN(pastDays) ? pastDays : undefined,
    futureDays: futureDays !== undefined && !isNaN(futureDays) ? futureDays : undefined,
    startDate,
    endDate,
    fetchAll,
    cacheTtl: cacheTtl !== undefined && !isNaN(cacheTtl) ? cacheTtl : undefined,
    bypassCache,
  };
}
