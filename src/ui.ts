export function renderGeneratorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CalDAV-to-iCal Proxy</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --bg: #0f172a;
      --surface: #1e293b;
      --surface-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    header h1 {
      font-size: 2.2rem;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.025em;
      margin-bottom: 0.5rem;
    }
    header p {
      color: var(--text-muted);
      font-size: 1.1rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 1.25rem;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
      color: var(--text);
    }
    .help {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }
    input[type="text"], input[type="password"], input[type="number"], select {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #0b1120;
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus, input[type="password"]:focus, input[type="number"]:focus {
      border-color: var(--accent);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 600px) {
      .grid { grid-template-columns: 1fr; }
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    .checkbox-group input {
      width: 1.1rem;
      height: 1.1rem;
      accent-color: var(--primary);
    }
    .result-box {
      margin-top: 1rem;
    }
    .url-display {
      position: relative;
      background: #090d16;
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      padding: 0.75rem 4rem 0.75rem 1rem;
      word-break: break-all;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      color: var(--accent);
    }
    .btn-copy {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-copy:hover {
      background: var(--primary-hover);
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: background 0.2s;
    }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary { background: #334155; color: #fff; }
    .btn-secondary:hover { background: #475569; }
    .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.85rem; }
    .url-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .url-row input {
      flex: 1;
    }
    .btn-remove-url {
      background: #334155;
      color: #f87171;
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      width: 42px;
      font-size: 1.25rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .btn-remove-url:hover {
      background: #7f1d1d;
      color: #fff;
    }
    .guide-step {
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--surface-border);
    }
    .guide-step:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .guide-step h3 {
      font-size: 1rem;
      color: #fff;
      margin-bottom: 0.25rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>CalDAV-to-iCal Proxy</h1>
      <p>Convert any CalDAV calendar into an iCal (ICS) subscription feed</p>
    </header>

    <div class="card">
      <h2>CalDAV Server Credentials</h2>
      <div class="form-group">
        <label>CalDAV Collection URL(s) *</label>
        <div id="urlContainer">
          <div class="url-row">
            <input type="text" class="caldav-url-input" placeholder="https://caldav.example.com/dav/calendars/user/work/" />
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" style="margin-top: 0.25rem;" onclick="addUrlRow()">+ Add another calendar URL</button>
        <div class="help">The direct WebDAV/CalDAV path(s) to your calendar collection(s). Add multiple URLs to merge several calendars into a single feed. All URLs must share the same username and password.</div>
      </div>

      <div class="grid">
        <div class="form-group">
          <label for="username">Username</label>
          <input type="text" id="username" placeholder="alice@example.com" />
        </div>
        <div class="form-group">
          <label for="password">Password / App Token</label>
          <input type="password" id="password" placeholder="••••••••••••" />
        </div>
      </div>

      <div class="form-group">
        <label for="calendarName">Calendar Display Name (optional)</label>
        <input type="text" id="calendarName" placeholder="My Synced Calendar" />
      </div>

      <div class="grid">
        <div class="form-group">
          <label for="pastDays">Past Days Window</label>
          <input type="number" id="pastDays" value="30" min="0" max="3650" />
        </div>
        <div class="form-group">
          <label for="futureDays">Future Days Window</label>
          <input type="number" id="futureDays" value="365" min="1" max="3650" />
        </div>
      </div>

      <div class="form-group">
        <label class="checkbox-group">
          <input type="checkbox" id="fetchAll" />
          <span>Fetch all events (disable rolling time-range filter)</span>
        </label>
      </div>

      <div class="form-group">
        <label for="cacheTtl">Cache Duration (seconds)</label>
        <input type="number" id="cacheTtl" value="300" min="0" max="86400" />
        <div class="help">How long Cloudflare edge caches the generated feed (default 300s = 5m).</div>
      </div>
    </div>

    <div class="card">
      <h2>Generated Subscription URLs</h2>
      
      <div class="result-box">
        <label>1. Clean Encoded URL (Recommended for all clients)</label>
        <div class="url-display">
          <span id="encodedUrl">Fill in CalDAV collection URL above</span>
          <button class="btn-copy" onclick="copyText('encodedUrl')">Copy</button>
        </div>
      </div>

      <div class="result-box" style="margin-top: 1.25rem;">
        <label>2. One-Click Webcal Subscription Link (Apple Calendar / macOS)</label>
        <div class="url-display">
          <span id="webcalUrl">Fill in CalDAV collection URL above</span>
          <button class="btn-copy" onclick="copyText('webcalUrl')">Copy</button>
        </div>
      </div>

      <div class="result-box" style="margin-top: 1.25rem;">
        <label>3. Explicit Query Parameter URL</label>
        <div class="url-display">
          <span id="queryUrl">Fill in CalDAV collection URL above</span>
          <button class="btn-copy" onclick="copyText('queryUrl')">Copy</button>
        </div>
      </div>

      <div class="actions">
        <a id="btnTest" href="#" target="_blank" class="btn btn-primary">Test & Download ICS</a>
        <a id="btnSubscribe" href="#" class="btn btn-secondary">Open in Calendar App</a>
      </div>
    </div>

    <div class="card">
      <h2>Subscription Instructions</h2>
      <div class="guide-step">
        <h3>Apple Calendar (macOS & iOS)</h3>
        <p class="help">In Calendar, go to <strong>File &gt; New Calendar Subscription...</strong>, paste the URL above, and choose your refresh frequency.</p>
      </div>
      <div class="guide-step">
        <h3>Google Calendar</h3>
        <p class="help">Go to calendar.google.com, click the <strong>+</strong> next to "Other calendars", select <strong>From URL</strong>, paste the subscription URL, and click Add Calendar.</p>
      </div>
      <div class="guide-step">
        <h3>Microsoft Outlook</h3>
        <p class="help">In Outlook on the web or desktop, click <strong>Add Calendar &gt; Subscribe from web</strong>, paste the URL, and save.</p>
      </div>
    </div>
  </div>

  <script>
    function getCaldavUrls() {
      const inputs = document.querySelectorAll('.caldav-url-input');
      const urls = [];
      inputs.forEach(input => {
        const v = input.value.trim();
        if (v) urls.push(v);
      });
      return urls;
    }

    function addUrlRow() {
      const container = document.getElementById('urlContainer');
      const row = document.createElement('div');
      row.className = 'url-row';
      row.innerHTML = '<input type="text" class="caldav-url-input" placeholder="https://caldav.example.com/dav/calendars/user/personal/" /><button type="button" class="btn-remove-url" onclick="removeUrlRow(this)" title="Remove">&times;</button>';
      container.appendChild(row);
      const newInput = row.querySelector('input');
      newInput.addEventListener('input', updateUrls);
      newInput.addEventListener('change', updateUrls);
      newInput.focus();
      updateUrls();
    }

    function removeUrlRow(btn) {
      const row = btn.closest('.url-row');
      row.remove();
      updateUrls();
    }

    function updateUrls() {
      const origin = window.location.origin;
      const caldavUrls = getCaldavUrls();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const calendarName = document.getElementById('calendarName').value.trim();
      const pastDays = document.getElementById('pastDays').value.trim();
      const futureDays = document.getElementById('futureDays').value.trim();
      const fetchAll = document.getElementById('fetchAll').checked;
      const cacheTtl = document.getElementById('cacheTtl').value.trim();

      if (caldavUrls.length === 0) {
        document.getElementById('encodedUrl').textContent = 'Please enter at least one CalDAV Collection URL above';
        document.getElementById('webcalUrl').textContent = 'Please enter at least one CalDAV Collection URL above';
        document.getElementById('queryUrl').textContent = 'Please enter at least one CalDAV Collection URL above';
        document.getElementById('btnTest').removeAttribute('href');
        document.getElementById('btnSubscribe').removeAttribute('href');
        return;
      }

      const config = {};
      if (caldavUrls.length === 1) {
        config.caldavUrl = caldavUrls[0];
      } else {
        config.caldavUrls = caldavUrls;
      }
      if (username) config.username = username;
      if (password) config.password = password;
      if (calendarName) config.calendarName = calendarName;
      if (fetchAll) {
        config.fetchAll = true;
      } else {
        if (pastDays && pastDays !== '30') config.pastDays = parseInt(pastDays, 10);
        if (futureDays && futureDays !== '365') config.futureDays = parseInt(futureDays, 10);
      }
      if (cacheTtl && cacheTtl !== '300') config.cacheTtl = parseInt(cacheTtl, 10);

      // Base64 token
      const jsonStr = JSON.stringify(config);
      const bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');

      const encodedUrl = \`\${origin}/subscribe/\${b64}.ics\`;
      const webcalUrl = encodedUrl.replace(/^https?:/, 'webcal:');

      // Query param URL
      const qParams = new URLSearchParams();
      caldavUrls.forEach(u => qParams.append('url', u));
      if (username) qParams.set('user', username);
      if (password) qParams.set('pass', password);
      if (calendarName) qParams.set('name', calendarName);
      if (fetchAll) qParams.set('all', '1');
      if (pastDays && pastDays !== '30') qParams.set('past_days', pastDays);
      if (futureDays && futureDays !== '365') qParams.set('future_days', futureDays);
      if (cacheTtl && cacheTtl !== '300') qParams.set('cache_ttl', cacheTtl);

      const queryUrl = \`\${origin}/calendar.ics?\${qParams.toString()}\`;

      document.getElementById('encodedUrl').textContent = encodedUrl;
      document.getElementById('webcalUrl').textContent = webcalUrl;
      document.getElementById('queryUrl').textContent = queryUrl;

      document.getElementById('btnTest').setAttribute('href', encodedUrl);
      document.getElementById('btnSubscribe').setAttribute('href', webcalUrl);
    }

    function copyText(elemId) {
      const text = document.getElementById(elemId).textContent;
      if (text.startsWith('http') || text.startsWith('webcal')) {
        navigator.clipboard.writeText(text).then(() => {
          const btn = event.target;
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = orig, 1500);
        });
      }
    }

    document.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', updateUrls);
      input.addEventListener('change', updateUrls);
    });

    updateUrls();
  </script>
</body>
</html>`;
}

