export interface ProxyConfig {
  caldavUrl?: string;
  caldavUrls?: string[];
  username?: string;
  password?: string;
  calendarName?: string;
  pastDays?: number;
  futureDays?: number;
  startDate?: string; // ISO 8601 string or YYYYMMDDTHHMMSSZ
  endDate?: string;   // ISO 8601 string or YYYYMMDDTHHMMSSZ
  fetchAll?: boolean;
  cacheTtl?: number;  // in seconds
  bypassCache?: boolean;
}

export function getCaldavUrls(config: ProxyConfig): string[] {
  if (config.caldavUrls && config.caldavUrls.length > 0) {
    return config.caldavUrls;
  }
  if (config.caldavUrl) {
    return [config.caldavUrl];
  }
  return [];
}

export interface CalDavCalendarData {
  href?: string;
  etag?: string;
  calendarData: string;
}

export interface CalDavQueryResult {
  calendarDataList: CalDavCalendarData[];
  calendarName?: string;
}

export interface ExtractedComponent {
  type: string;
  content: string;
  id?: string;
}
