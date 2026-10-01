import { CalDavCalendarData } from './types';

export interface MergeIcsOptions {
  calendarName?: string;
  defaultTimezone?: string;
  refreshIntervalHours?: number;
}

/**
 * Extracts top-level VCALENDAR subcomponents (VTIMEZONE, VEVENT, VTODO, VJOURNAL, etc.)
 * respecting nesting (e.g. VALARM inside VEVENT, STANDARD/DAYLIGHT inside VTIMEZONE).
 */
export function extractCalendarComponents(icsText: string): {
  timezones: Map<string, string>;
  eventsAndTodos: string[];
  calendarProps: Map<string, string>;
} {
  const timezones = new Map<string, string>();
  const eventsAndTodos: string[] = [];
  const calendarProps = new Map<string, string>();

  // Normalize line breaks to \n for easier processing
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let inComponent = false;
  let currentComponentType = '';
  let componentLines: string[] = [];
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('BEGIN:VCALENDAR')) {
      continue;
    }
    if (trimmed.startsWith('END:VCALENDAR')) {
      continue;
    }

    if (trimmed.startsWith('BEGIN:')) {
      const type = trimmed.substring(6).trim().toUpperCase();
      if (depth === 0) {
        inComponent = true;
        currentComponentType = type;
        componentLines = [line];
        depth = 1;
      } else {
        depth++;
        componentLines.push(line);
      }
      continue;
    }

    if (trimmed.startsWith('END:')) {
      const type = trimmed.substring(4).trim().toUpperCase();
      depth--;
      componentLines.push(line);

      if (depth === 0 && inComponent) {
        const fullComponent = componentLines.join('\r\n');

        if (currentComponentType === 'VTIMEZONE') {
          // Extract TZID to deduplicate
          const tzidMatch = fullComponent.match(/\r\nTZID(?::|;[^:]*:)([^\r\n]+)/i) ||
                            fullComponent.match(/^TZID(?::|;[^:]*:)([^\r\n]+)/im);
          const tzid = tzidMatch ? tzidMatch[1].trim() : `tz_${timezones.size}`;
          if (!timezones.has(tzid)) {
            timezones.set(tzid, fullComponent);
          }
        } else if (
          currentComponentType === 'VEVENT' ||
          currentComponentType === 'VTODO' ||
          currentComponentType === 'VJOURNAL' ||
          currentComponentType === 'VFREEBUSY'
        ) {
          eventsAndTodos.push(fullComponent);
        }

        inComponent = false;
        currentComponentType = '';
        componentLines = [];
      }
      continue;
    }

    if (inComponent) {
      componentLines.push(line);
    } else if (trimmed.length > 0) {
      // Top-level VCALENDAR property (e.g., X-WR-CALNAME, X-WR-TIMEZONE, etc.)
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).split(';')[0].trim().toUpperCase();
        const val = line.substring(colonIdx + 1).trim();
        if (!calendarProps.has(key)) {
          calendarProps.set(key, val);
        }
      }
    }
  }

  return { timezones, eventsAndTodos, calendarProps };
}

/**
 * Combines multiple CalDAV calendar entries into a single valid RFC 5545 iCalendar stream
 */
export function mergeCalendarData(
  calendarDataList: CalDavCalendarData[],
  options: MergeIcsOptions = {}
): string {
  const mergedTimezones = new Map<string, string>();
  const mergedEvents: string[] = [];
  let detectedCalName: string | undefined;
  let detectedTz: string | undefined;

  // Deduplicate events by UID + RECURRENCE-ID
  const seenEventKeys = new Set<string>();

  for (const item of calendarDataList) {
    if (!item.calendarData) continue;

    const { timezones, eventsAndTodos, calendarProps } = extractCalendarComponents(item.calendarData);

    if (!detectedCalName && calendarProps.has('X-WR-CALNAME')) {
      detectedCalName = calendarProps.get('X-WR-CALNAME');
    }
    if (!detectedTz && calendarProps.has('X-WR-TIMEZONE')) {
      detectedTz = calendarProps.get('X-WR-TIMEZONE');
    }

    // Add unique timezones
    for (const [tzid, tzBlock] of timezones.entries()) {
      if (!mergedTimezones.has(tzid)) {
        mergedTimezones.set(tzid, tzBlock);
      }
    }

    // Add events and deduplicate exact duplicate components
    for (const eventBlock of eventsAndTodos) {
      const uidMatch = eventBlock.match(/\r\nUID(?::|;[^:]*:)([^\r\n]+)/i) ||
                       eventBlock.match(/^UID(?::|;[^:]*:)([^\r\n]+)/im);
      const recurMatch = eventBlock.match(/\r\nRECURRENCE-ID(?::|;[^:]*:)([^\r\n]+)/i) ||
                         eventBlock.match(/^RECURRENCE-ID(?::|;[^:]*:)([^\r\n]+)/im);

      const uid = uidMatch ? uidMatch[1].trim() : '';
      const recurId = recurMatch ? recurMatch[1].trim() : '';
      const eventKey = `${uid}__${recurId}`;

      if (!uid || !seenEventKeys.has(eventKey)) {
        if (uid) seenEventKeys.add(eventKey);
        mergedEvents.push(eventBlock);
      }
    }
  }

  const finalCalName = options.calendarName || detectedCalName || 'Subscribed Calendar';
  const finalTz = options.defaultTimezone || detectedTz;
  const refreshInterval = options.refreshIntervalHours || 1;

  const headerLines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalDAV-to-iCal-Proxy//Cloudflare Worker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${finalCalName}`,
  ];

  if (finalTz) {
    headerLines.push(`X-WR-TIMEZONE:${finalTz}`);
  }

  // Refresh rate recommendations for clients (RFC 7986 and extensions)
  headerLines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${refreshInterval}H`);
  headerLines.push(`X-PUBLISHED-TTL:PT${refreshInterval}H`);

  const parts: string[] = [headerLines.join('\r\n')];

  // Append timezones
  for (const tz of mergedTimezones.values()) {
    parts.push(tz);
  }

  // Append events
  for (const ev of mergedEvents) {
    parts.push(ev);
  }

  parts.push('END:VCALENDAR\r\n');

  return parts.join('\r\n');
}
