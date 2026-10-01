import { describe, it, expect } from 'vitest';
import { extractCalendarComponents, mergeCalendarData } from '../src/ics';

describe('iCalendar handling', () => {
  it('extracts top-level components and handles nested VALARM inside VEVENT', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
X-WR-CALNAME:Work Calendar
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:event-123
SUMMARY:Important Meeting
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;

    const { timezones, eventsAndTodos, calendarProps } = extractCalendarComponents(ics);

    expect(calendarProps.get('X-WR-CALNAME')).toBe('Work Calendar');
    expect(timezones.has('Europe/Berlin')).toBe(true);
    expect(timezones.get('Europe/Berlin')).toContain('BEGIN:DAYLIGHT');
    expect(eventsAndTodos.length).toBe(1);
    expect(eventsAndTodos[0]).toContain('SUMMARY:Important Meeting');
    expect(eventsAndTodos[0]).toContain('BEGIN:VALARM');
    expect(eventsAndTodos[0]).toContain('END:VALARM');
  });

  it('deduplicates identical VTIMEZONE blocks across multiple calendar entries', () => {
    const cal1 = {
      calendarData: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:e1
SUMMARY:Event 1
END:VEVENT
END:VCALENDAR`,
    };

    const cal2 = {
      calendarData: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:e2
SUMMARY:Event 2
END:VEVENT
END:VCALENDAR`,
    };

    const merged = mergeCalendarData([cal1, cal2], { calendarName: 'Merged' });

    // Should only contain one VTIMEZONE block for Europe/Berlin
    const tzOccurrences = (merged.match(/BEGIN:VTIMEZONE/g) || []).length;
    expect(tzOccurrences).toBe(1);

    // Should contain both events
    expect(merged).toContain('SUMMARY:Event 1');
    expect(merged).toContain('SUMMARY:Event 2');
    expect(merged).toContain('X-WR-CALNAME:Merged');
    expect(merged).toContain('BEGIN:VCALENDAR');
    expect(merged).toContain('END:VCALENDAR');
  });

  it('preserves recurring event exceptions with the same UID and different RECURRENCE-ID', () => {
    const recurring = {
      calendarData: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:recurring-1
RRULE:FREQ=WEEKLY
SUMMARY:Weekly Sync
END:VEVENT
BEGIN:VEVENT
UID:recurring-1
RECURRENCE-ID:20261005T090000Z
SUMMARY:Weekly Sync (Moved)
END:VEVENT
END:VCALENDAR`,
    };

    const merged = mergeCalendarData([recurring]);
    const eventOccurrences = (merged.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventOccurrences).toBe(2);
    expect(merged).toContain('Weekly Sync (Moved)');
  });
});
