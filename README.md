# CalDAV-to-iCal Proxy (Cloudflare Worker)

A TypeScript Cloudflare Worker that proxies CalDAV calendars to an iCal / ICS (`text/calendar`) subscription feed. It allows any software that supports iCal subscriptions (such as Apple Calendar, Google Calendar, Microsoft Outlook, and Mozilla Thunderbird) to subscribe to a CalDAV calendar.

## Features

- **Standard CalDAV Client**: Queries collections using RFC 4791 `REPORT` with `calendar-query` payloads.
- **Unified ICS Aggregation**: Merges multiple calendar items, deduplicates `VTIMEZONE` blocks by `TZID`, preserves recurring event exceptions (`RECURRENCE-ID`), and outputs valid RFC 5545 format with CRLF line breaks.
- **Flexible Time Window**: Defaults to a rolling time window (past 30 days to next 365 days) to avoid memory/rate limit issues, with options to customize window or fetch all events.
- **Workers Cache (Edge Caching)**: Leverages Cloudflare Workers Cache (`[cache] enabled = true`) to serve cached ICS responses directly from Cloudflare's edge without executing Worker code on cache hits, protecting the CalDAV server and saving CPU time. Configurable TTL (default: 5 minutes / 300s) with support for `stale-while-revalidate`.
- **Interactive Web Generator**: Accessing the root URL in a browser displays an interactive UI to test credentials, configure parameters, and generate ready-to-use subscription links with one-click copy.
- **Multiple Integration Formats**:
  - **Clean Token URL**: `/subscribe/<base64_token>.ics` (clean single URL with no query parameters)
  - **Query Parameters**: `/calendar.ics?url=...&user=...&pass=...`
  - **HTTP Basic Auth**: Forwards client `Authorization: Basic ...` credentials directly.
  - **Webcal**: `webcal://...` for direct one-click subscribing on macOS & iOS.

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Locally

```bash
npm run dev
```

Visit `http://localhost:8787` in your browser to access the interactive link generator.

### 3. Run Tests and Typecheck

```bash
npm test
npm run typecheck
```

### 4. Deploy to Cloudflare

```bash
npm run deploy
```

---

## URL Formats & Usage

### 1. Clean Token URL (Recommended)

Generate a URL-safe Base64 token encoding your CalDAV settings:

```text
https://<worker-subdomain>.workers.dev/subscribe/<TOKEN>.ics
```

Or open directly in calendar apps via Webcal:

```text
webcal://<worker-subdomain>.workers.dev/subscribe/<TOKEN>.ics
```

### 2. Query Parameter URL

```text
https://<worker-subdomain>.workers.dev/calendar.ics?url=<CALDAV_COLLECTION_URL>&user=<USERNAME>&pass=<PASSWORD>
```

#### Supported Query Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `url` / `caldav_url` | `string` | *(Required)* | URL to the CalDAV calendar collection |
| `user` / `username` | `string` | optional | HTTP Basic Auth username |
| `pass` / `password` | `string` | optional | HTTP Basic Auth password / app token |
| `name` / `calendar_name` | `string` | `Subscribed Calendar` | Custom calendar display name (`X-WR-CALNAME`) |
| `past_days` | `number` | `30` | Number of days in the past to query |
| `future_days` | `number` | `365` | Number of days in the future to query |
| `start` / `start_date` | `string` | optional | Explicit start date (`ISO 8601` or `YYYYMMDDTHHMMSSZ`) |
| `end` / `end_date` | `string` | optional | Explicit end date (`ISO 8601` or `YYYYMMDDTHHMMSSZ`) |
| `all` | `boolean` | `false` | Set to `1` or `true` to fetch all events without date filtering |
| `cache_ttl` / `ttl` | `number` | `300` | Cache lifetime at the edge in seconds |
| `bypass_cache` | `boolean` | `false` | Set to `1` or pass `Cache-Control: no-cache` to force live fetch |

---

## Subscribing in Calendar Applications

### Apple Calendar (macOS / iOS)
1. In Calendar on Mac, choose **File > New Calendar Subscription...** (or click the generated `webcal://` link).
2. Enter the generated proxy URL and click **Subscribe**.
3. Choose your refresh frequency (e.g. "Every hour" or "Every day").

### Google Calendar
1. Open [Google Calendar](https://calendar.google.com).
2. Next to "Other calendars", click **+ > From URL**.
3. Paste the generated proxy URL and click **Add calendar**.

### Microsoft Outlook
1. Open Outlook on the web or desktop.
2. Select **Add calendar > Subscribe from web**.
3. Paste the generated proxy URL and save.

---

## License

MIT
