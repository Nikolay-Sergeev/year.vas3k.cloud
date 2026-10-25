# Nikolai Calendar

A LAN-hosted fork of [vas3k/year.vas3k.cloud](https://github.com/vas3k/year.vas3k.cloud), retaining its year planner, colors, textures, notes, three views, printing, and JSON export/import.

Open **https://calendar.nikolai-server.lan/** and enter your existing username/password on the sign-in page. This device stays signed in for 30 days, including after closing the browser. Use **Sign out** at the bottom to end this device’s session. HTTPS uses the existing server’s internal Caddy CA. Devices must trust that CA, as with the other LAN services.

## Saving and multiple devices

The server is the source of truth. The app loads the saved calendar before enabling editing and automatically saves changes after 500 ms. “Saved on server” at the bottom of the page confirms a successful disk write. Other open devices refresh every 15 seconds and on window focus while they have no unsaved edits.

Every save includes the revision it was based on. If another device saved first, the app keeps your draft and asks you to export it before reloading; it cannot silently overwrite the newer calendar. Failed saves retain a recovery draft in this browser and provide retry/export controls. A recovered draft requires explicit confirmation before replacing the displayed server calendar.

Import replaces the whole calendar, including all years and view settings. Export downloads a JSON file compatible with the original planner. Date keys retain the upstream **zero-based month** convention. Do not adjust dates during migration.

## Storage and authentication

- `/home/nikolai/calendar/data/calendar.json`: live calendar, outside the image.
- `data/backups/`: previous 100 changed versions, captured before atomic replacement. These protect against accidental edits; copy `data/` to separate storage for disaster recovery.
- `data/import-2026-10-25.json`: original imported document, preserved separately.
- `secrets/auth.json`: username and salted scrypt password hash, mounted read-only. No plaintext password is stored on the server.
- `data/session-key`: private signing key that preserves remembered logins across server restarts. A signed cookie expires 30 days after sign-in and uses Secure, HttpOnly, and SameSite=Strict attributes. The password is never stored in browser storage. Rotating credentials invalidates existing sessions.
- Authentication covers the app, static assets, and calendar API. `/healthz` exposes only health/version. HTTP redirects to HTTPS. The app publishes no host ports; edge Caddy restricts access to private source addresses.
- Runtime state, secrets, backups, and deployment receipts are excluded from Git and the Docker build context. No personal calendar data belongs in the public fork.

To rotate a password, use a private stdin input with `node server/create-auth.cjs nikolai`, write its output to `secrets/auth.json` with permissions `0600`, then recreate only the calendar service under the shared lock. Save the generated password separately.

## Build and verify

Requires Node 24 or newer:

```sh
npm ci
npm test
GENERATE_SOURCEMAP=false npm run build
```

The Docker build pins its Node base image by digest. The runtime includes the built frontend and a Node standard-library HTTP server, with **no node_modules or npm application dependencies**. The inherited React Scripts toolchain is build-only and has legacy dependency audit findings; it is excluded from the runtime image. There is no GitHub Pages deployment for this server-backed fork.

API tests start a real server against temporary files and exercise password protection, 30-day session expiry, browser logout, credential rotation, Unicode/multiple-year round trips, durable writes across restart, backups, stale revisions, lost-response retries, malformed requests, size limits, and cross-site writes.

## Deployment

Sources live at `/home/nikolai/calendar`. Create private `data/` and `secrets/` directories owned by UID 1000, import a valid calendar, and install the password hash before first startup. The server deliberately refuses to start with missing or invalid calendar data. Source updates must exclude `data`, `secrets`, and `backups`; never overwrite the live calendar during an application update.

```sh
docker compose build
python3 ops/deploy.py
```

`ops/deploy.py` acquires `/tmp/double-tt-verification.lock` without blocking, snapshots existing container identities, backs up Caddy’s configuration, validates the candidate, starts only the calendar, and waits for health. It preserves the edge file’s bind-mounted inode and reloads Caddy. A reload failure restores the original configuration. `deployment.json` records health, image identity, and changes to unrelated containers. Docker builds occur before taking the deployment lock.

OpenWrt has a dedicated `dhcp.nikolai_calendar` domain entry mapping `calendar.nikolai-server.lan` to `192.168.1.201`. No public DNS or WAN forwarding is required.

To roll back the route, restore a saved `backups/<timestamp>/Caddyfile` into `/srv/home-server/caddy/Caddyfile` while preserving its inode, validate, and reload Caddy under the shared lock. Stop only `nikolai-calendar` if needed; retain its data and secrets. To restore data, stop only this calendar service, copy the chosen JSON backup over `data/calendar.json` with UID 1000 and mode `0600`, and restart it. Reload browsers after recovery.

## Interface

The interface uses [Hallmark](https://github.com/nutlope/hallmark)’s Grid theme, adapted to a minimal utilitarian calendar: local Radio Canada fonts, restrained surfaces, muted date colors, and compact controls. Fonts and their Open Font Licenses live in `public/theme/fonts`; rendering makes no request to a font service. Shared tokens style both the calendar and sign-in page.

Color labels are Work (red), Holidays (green), Vacation (pink), Personal (blue), Days off (purple), Visitors (yellow), Appointments (orange), and Sport (teal). Vacation covers trips; leave covers time off without a named trip. Labels appear in both pickers and phone day details; existing date colors and JSON identifiers stay unchanged. Notes stay inside their day cell; select a note to edit its full contents. Dates remain visible on days with notes. Focus a day and press Space to paint it with the selected color or texture. The calendar supports all three views and printing; phones have a dedicated month grid and an agenda with full note text. The compact phone header combines month/year navigation with Today and view controls. Month arrows continue across year boundaries in both directions. In month view, tapping a date shows its note in a small area below the grid; Edit opens the full note, color, and texture editor. Agenda rows open that editor directly. Touch scrolling never paints a date. Month and agenda preferences stay on the current device and do not change the desktop view. Save status, Settings, and Sign out stay together at the bottom. Settings contains export, import, Clean All, saving/backup information, and the project link.

To run the phone interaction checks after building: `npx playwright install chromium`, then `npm run test:browser`. Use the bundled Chromium so local and CI gesture checks run against the same browser. CI installs a matching Chromium and runs these checks automatically. They cover scrolling without accidental edits, no sideways phone scrolling, touch target sizes, local month/view preferences, note and appearance saves, short viewports, touch scrolling within long previews, six-week months with the selected-day preview visible, the Today shortcut, leap years, and desktop printing.
