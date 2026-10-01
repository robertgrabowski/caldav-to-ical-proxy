import { describe, it, expect } from 'vitest';
import {
  formatCalDavDate,
  parseToCalDavDate,
  buildCalendarQueryXml,
  parseCalDavResponse,
  fetchCalDavEvents,
} from '../src/caldav';

describe('CalDAV utility functions', () => {
  it('formats dates to CalDAV UTC format YYYYMMDDTHHMMSSZ', () => {
    const d = new Date(Date.UTC(2026, 8, 30, 15, 30, 45)); // Month is 0-indexed, 8 = Sept
    expect(formatCalDavDate(d)).toBe('20260930T153045Z');
  });

  it('parses valid ISO string or already formatted string', () => {
    expect(parseToCalDavDate('20260930T153045Z')).toBe('20260930T153045Z');
    expect(parseToCalDavDate('2026-09-30T15:30:45Z')).toBe('20260930T153045Z');
  });

  it('throws on invalid date string', () => {
    expect(() => parseToCalDavDate('invalid-date')).toThrow('Invalid date format');
  });

  it('builds calendar-query XML with rolling time window', () => {
    const xml = buildCalendarQueryXml({
      caldavUrl: 'https://example.com/dav',
      pastDays: 10,
      futureDays: 100,
    });
    expect(xml).toContain('<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">');
    expect(xml).toContain('<C:comp-filter name="VEVENT">');
    expect(xml).toContain('<C:time-range');
  });

  it('builds calendar-query XML with fetchAll=true', () => {
    const xml = buildCalendarQueryXml({
      caldavUrl: 'https://example.com/dav',
      fetchAll: true,
    });
    expect(xml).toContain('<C:comp-filter name="VCALENDAR"/>');
    expect(xml).not.toContain('<C:time-range');
  });

  it('parses Multi-Status XML response correctly', () => {
    const sampleXml = `<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/dav/calendars/user/home/event1.ics</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"tag1"</D:getetag>
        <C:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1@example.com
SUMMARY:Team Meeting
END:VEVENT
END:VCALENDAR</C:calendar-data>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/calendars/user/home/event2.ics</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"tag2"</D:getetag>
        <C:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-2@example.com
SUMMARY:Dentist
END:VEVENT
END:VCALENDAR</C:calendar-data>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

    const parsed = parseCalDavResponse(sampleXml);
    expect(parsed.length).toBe(2);
    expect(parsed[0].href).toBe('/dav/calendars/user/home/event1.ics');
    expect(parsed[0].etag).toBe('"tag1"');
    expect(parsed[0].calendarData).toContain('UID:event-1@example.com');
    expect(parsed[1].href).toBe('/dav/calendars/user/home/event2.ics');
    expect(parsed[1].calendarData).toContain('UID:event-2@example.com');
  });

  it('handles custom namespace prefixes (e.g. d: and cal:)', () => {
    const customPrefixXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <d:response>
    <d:href>/cal/e1.ics</d:href>
    <d:propstat>
      <d:prop>
        <cal:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:e1
SUMMARY:Project Demo
END:VEVENT
END:VCALENDAR</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

    const parsed = parseCalDavResponse(customPrefixXml);
    expect(parsed.length).toBe(1);
    expect(parsed[0].calendarData).toContain('UID:e1');
  });

  it('throws an error immediately when REPORT returns 405 without GET fallback', async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: { url: string; method?: string }[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({
        url: typeof input === 'string' ? input : input.toString(),
        method: init?.method,
      });
      return new Response('Method Not Allowed', { status: 405, statusText: 'Method Not Allowed' });
    }) as any;

    try {
      await expect(
        fetchCalDavEvents({
          caldavUrl: 'https://caldav.example.com/collection/',
        })
      ).rejects.toThrow('CalDAV server rejected REPORT method with status 405');

      // Verify that no secondary GET request was made
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0].method).toBe('REPORT');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws an error immediately when REPORT returns 501', async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: { url: string; method?: string }[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({
        url: typeof input === 'string' ? input : input.toString(),
        method: init?.method,
      });
      return new Response('Not Implemented', { status: 501, statusText: 'Not Implemented' });
    }) as any;

    try {
      await expect(
        fetchCalDavEvents({
          caldavUrl: 'https://caldav.example.com/collection/',
        })
      ).rejects.toThrow('CalDAV server rejected REPORT method with status 501');

      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0].method).toBe('REPORT');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
