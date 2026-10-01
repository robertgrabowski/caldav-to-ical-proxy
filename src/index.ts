import { extractConfigFromRequest } from './auth';
import { fetchCalDavEvents } from './caldav';
import { mergeCalendarData } from './ics';
import { renderGeneratorHtml } from './ui';

export interface Env {
  DEFAULT_CALDAV_URL?: string;
  DEFAULT_USERNAME?: string;
  DEFAULT_PASSWORD?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cache-Control',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'caldav-to-ical-proxy' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Attempt to extract configuration from request
    let config = extractConfigFromRequest(request);

    // If config didn't have URL, check if environment defaults exist
    if (!config && env.DEFAULT_CALDAV_URL) {
      config = {
        caldavUrl: env.DEFAULT_CALDAV_URL,
        username: env.DEFAULT_USERNAME,
        password: env.DEFAULT_PASSWORD,
      };
    }

    // If root path and no config provided, show generator Web UI
    if (!config && (url.pathname === '/' || url.pathname === '/ui' || url.pathname === '/generator')) {
      return new Response(renderGeneratorHtml(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    if (!config || !config.caldavUrl) {
      return new Response(
        `Error: Missing CalDAV collection URL.\n\nUsage:\n1. Open ${url.origin} in your browser to generate subscription links\n2. Or subscribe via /calendar.ics?url=<caldav_url>&user=<username>&pass=<password>\n3. Or subscribe via /subscribe/<base64_token>.ics\n`,
        {
          status: 400,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    try {
      // Fetch events from CalDAV server
      const queryResult = await fetchCalDavEvents(config);

      // Merge components into unified RFC 5545 iCalendar data
      const icsData = mergeCalendarData(queryResult.calendarDataList, {
        calendarName: config.calendarName || queryResult.calendarName,
      });

      const ttl = config.cacheTtl !== undefined ? config.cacheTtl : 300; // default 5 minutes
      const cacheControl =
        config.bypassCache || ttl <= 0
          ? 'no-store, no-cache, must-revalidate'
          : `public, max-age=${ttl}, stale-while-revalidate=60`;

      return new Response(icsData, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'inline; filename="calendar.ics"',
          'Cache-Control': cacheControl,
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      let status = 502;

      if (errorMessage.includes('401')) {
        status = 401;
      } else if (errorMessage.includes('403')) {
        status = 403;
      } else if (errorMessage.includes('404')) {
        status = 404;
      } else if (errorMessage.includes('Invalid date format')) {
        status = 400;
      }

      return new Response(`CalDAV Proxy Error: ${errorMessage}\n`, {
        status,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
