import { XMLParser } from 'fast-xml-parser';
import { CalDavCalendarData, CalDavQueryResult, ProxyConfig } from './types';

/**
 * Formats a Date into CalDAV UTC time format: YYYYMMDDTHHMMSSZ
 */
export function formatCalDavDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Parses user-provided date string (ISO 8601 or YYYYMMDDTHHMMSSZ) into CalDAV UTC string
 */
export function parseToCalDavDate(input: string): string {
  if (/^\d{8}T\d{6}Z$/.test(input)) {
    return input;
  }
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date format: "${input}". Expected ISO-8601 or YYYYMMDDTHHMMSSZ`);
  }
  return formatCalDavDate(parsed);
}

/**
 * Builds the CalDAV calendar-query REPORT XML body
 */
export function buildCalendarQueryXml(config: ProxyConfig): string {
  let filterInner = '';

  if (config.fetchAll) {
    // Query without time-range filter
    filterInner = '<C:comp-filter name="VCALENDAR"/>';
  } else {
    let startStr: string;
    let endStr: string;

    const now = new Date();
    if (config.startDate) {
      startStr = parseToCalDavDate(config.startDate);
    } else {
      const pastDays = config.pastDays !== undefined ? config.pastDays : 30;
      const startDate = new Date(now.getTime() - pastDays * 24 * 60 * 60 * 1000);
      startStr = formatCalDavDate(startDate);
    }

    if (config.endDate) {
      endStr = parseToCalDavDate(config.endDate);
    } else {
      const futureDays = config.futureDays !== undefined ? config.futureDays : 365;
      const endDate = new Date(now.getTime() + futureDays * 24 * 60 * 60 * 1000);
      endStr = formatCalDavDate(endDate);
    }

    filterInner = `
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startStr}" end="${endStr}"/>
      </C:comp-filter>
    </C:comp-filter>`;
  }

  return `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>${filterInner}
  </C:filter>
</C:calendar-query>`.trim();
}

/**
 * Extracts calendar data chunks from CalDAV XML response
 */
export function parseCalDavResponse(xmlText: string): CalDavCalendarData[] {
  const results: CalDavCalendarData[] = [];

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      trimValues: false,
    });
    const parsed = parser.parse(xmlText);

    const multistatus = parsed.multistatus || parsed['multistatus'];
    if (multistatus && multistatus.response) {
      const responses = Array.isArray(multistatus.response)
        ? multistatus.response
        : [multistatus.response];

      for (const resp of responses) {
        const href = typeof resp.href === 'string' ? resp.href : undefined;
        let etag: string | undefined;
        let calData: string | undefined;

        const propstats = Array.isArray(resp.propstat)
          ? resp.propstat
          : resp.propstat
          ? [resp.propstat]
          : [];

        for (const propstat of propstats) {
          const prop = propstat.prop;
          if (prop) {
            if (prop.getetag && typeof prop.getetag === 'string') {
              etag = prop.getetag;
            }
            if (prop['calendar-data'] && typeof prop['calendar-data'] === 'string') {
              calData = prop['calendar-data'];
            }
          }
        }

        // Direct prop under response
        if (!calData && resp.prop && resp.prop['calendar-data']) {
          calData = resp.prop['calendar-data'];
        }

        if (calData && calData.trim()) {
          results.push({
            href,
            etag,
            calendarData: calData.trim(),
          });
        }
      }
    }
  } catch (err) {
    // If XML parser throws, fall back to regex extraction
    console.warn('XML parser error, trying regex fallback:', err);
  }

  // Regex fallback if structured parsing found no items or failed
  if (results.length === 0) {
    const regex = /<(?:\w+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:\w+:)?calendar-data>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xmlText)) !== null) {
      let rawData = match[1];
      // Decode XML entities if any
      rawData = rawData
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();

      if (rawData.startsWith('BEGIN:VCALENDAR')) {
        results.push({ calendarData: rawData });
      }
    }
  }

  return results;
}

/**
 * Executes the CalDAV query against the server
 */
export async function fetchCalDavEvents(config: ProxyConfig): Promise<CalDavQueryResult> {
  const url = new URL(config.caldavUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Depth': '1',
    'User-Agent': 'Mozilla/5.0 (compatible; CalDAV-to-iCal-Proxy/1.0)',
  };

  const username = config.username || (url.username ? decodeURIComponent(url.username) : undefined);
  const password = config.password || (url.password ? decodeURIComponent(url.password) : undefined);

  if (username && password !== undefined) {
    const creds = btoa(`${username}:${password}`);
    headers['Authorization'] = `Basic ${creds}`;
  }

  // Clean url (remove embedded credentials for fetch URL)
  url.username = '';
  url.password = '';
  const cleanUrl = url.toString();

  const reportXml = buildCalendarQueryXml(config);

  const response = await fetch(cleanUrl, {
    method: 'REPORT',
    headers,
    body: reportXml,
    redirect: 'follow',
  });

  if (response.status === 401) {
    throw new Error('CalDAV authentication failed (401 Unauthorized). Please check username and password.');
  }

  if (response.status === 403) {
    throw new Error('CalDAV access forbidden (403 Forbidden). You may lack permission for this calendar.');
  }

  if (response.status === 404) {
    throw new Error(`CalDAV calendar collection not found (404 Not Found) at URL: ${cleanUrl}`);
  }

  if (response.status === 405 || response.status === 501) {
    throw new Error(`CalDAV server rejected REPORT method with status ${response.status}. Ensure the URL points to a valid CalDAV calendar collection.`);
  }

  if (!response.ok && response.status !== 207) {
    const errText = await response.text().catch(() => '');
    throw new Error(`CalDAV request failed with status ${response.status}: ${errText.slice(0, 300)}`);
  }

  const responseXml = await response.text();
  const calendarDataList = parseCalDavResponse(responseXml);

  return {
    calendarDataList,
  };
}
