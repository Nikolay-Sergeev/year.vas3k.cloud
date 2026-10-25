// Real browser coverage for mobile-specific risks the HTTP tests cannot reach:
// scrolling must not paint dates, browsing must not change desktop preferences,
// and the day editor must preserve note/color data through server saves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

test('phone planning is touch safe, saves full notes, and keeps browsing preferences local', { timeout: 90000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-mobile-'));
  const seed = {
    selectedYear: 2027, selectedView: 'Linear', selectedColorTexture: 'purple',
    dateCells: { '2027-0-1': { color: 'green', customText: 'New Year’s Day' }, '2026-9-25': { color: 'pink', customText: 'Existing plan' }, '2027-4-31': { color: 'blue', customText: 'End of month review\n'.repeat(20) } },
  };
  const password = crypto.randomBytes(24).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(path.join(root, 'calendar.json'), JSON.stringify(seed));
  fs.writeFileSync(path.join(root, 'auth.json'), JSON.stringify({ username: 'nikolai', salt, hash: crypto.scryptSync(password, salt, 32).toString('hex') }));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.resolve(__dirname, '../server/index.cjs')], {
    env: { ...process.env, PORT: String(port), DATA_DIR: root, AUTH_FILE: path.join(root, 'auth.json'), PUBLIC_DIR: path.resolve(__dirname, '../build'), APP_ORIGIN: url },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverErrors = '';
  child.stderr.on('data', value => { serverErrors += value; });
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
    fs.rmSync(root, { recursive: true, force: true });
  });
  const stored = () => JSON.parse(fs.readFileSync(path.join(root, 'calendar.json'), 'utf8'));
  const until = async (check, message) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await check()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error(message);
  };
  await until(async () => { try { return (await fetch(url + '/healthz')).ok; } catch { if (child.exitCode !== null) throw Error(serverErrors); return false; } }, 'Server did not start');
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let writes = 0;
  page.on('request', request => { if (request.method() === 'PUT' && request.url().endsWith('/api/calendar')) writes++; });
  await page.goto(url);
  await page.getByLabel('Username', { exact: true }).fill('nikolai');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.locator('.mobile-month-grid').waitFor();
  await page.getByLabel('Month', { exact: true }).selectOption('0');
  assert.equal(await page.getByRole('button', { name: 'Previous month' }).isDisabled(), true);

  for (const width of [320, 375, 390, 430, 767]) {
    await page.setViewportSize({ width, height: 740 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}px`);
    const bounds = await page.locator('.mobile-day').evaluateAll(days => days.map(day => { const box = day.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, height: box.height }; }));
    assert.equal(bounds.length, 31);
    assert.ok(bounds.every(box => box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= width + 1), `Day target or clipping at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 740 });
  const touch = await context.newCDPSession(page);
  const box = await page.locator('.mobile-day[data-date="2027-0-15"]').boundingBox();
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  for (let step = 1; step <= 8; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 - step * 24 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.locator('.save-status-label').innerText(), 'Saved on server', 'Touch scrolling created an unsaved edit');
  assert.equal(writes, 0, 'Touch scrolling issued a calendar write');
  assert.equal(await page.locator('.mobile-day[data-date="2027-0-1"]').getAttribute('aria-pressed'), 'true', 'Touch scrolling selected a different day');
  assert.deepEqual(stored(), seed);

  await page.getByLabel('Month', { exact: true }).selectOption('1');
  assert.equal(await page.locator('.mobile-day').count(), 28);
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByText('No plans in February yet.', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('No plans in February yet.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Month', { exact: true }).inputValue(), '1');
  assert.equal(writes, 0, 'Mobile month/view browsing changed server preferences');
  assert.deepEqual(stored(), seed);
  await page.getByRole('button', { name: 'Choose a date', exact: true }).click();
  await page.getByLabel('Month', { exact: true }).selectOption('0');
  await page.locator('.mobile-day[data-date="2027-0-1"]').tap();
  const summary = page.getByRole('region', { name: 'Selected day', exact: true });
  await summary.getByText('New Year’s Day', { exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0, 'Selecting a date blocked the month with an editor');
  await page.locator('.mobile-day[data-date="2027-0-2"]').tap();
  await summary.getByText('No plans for this day.', { exact: true }).waitFor();
  assert.equal(await page.locator('.mobile-day[data-date="2027-0-2"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.mobile-day[data-date="2027-0-1"]').getAttribute('aria-pressed'), 'false');
  assert.equal(writes, 0, 'Selecting a day changed its data');
  assert.deepEqual(stored(), seed);
  await summary.getByRole('button', { name: 'Edit selected day', exact: true }).tap();
  const editor = page.getByRole('dialog');
  await editor.waitFor();
  assert.equal(writes, 0, 'Opening a day changed its data');
  assert.ok(await editor.evaluate(dialog => dialog.contains(document.activeElement)), 'Day editor did not receive focus');
  const note = 'Πλάνο / План 🚵\n' + 'A longer note remains readable on a phone. '.repeat(12);
  await editor.getByLabel('Note', { exact: true }).fill(note);
  await editor.getByRole('button', { name: 'green', exact: true }).tap();
  await until(() => stored().dateCells['2027-0-2']?.customText === note && stored().dateCells['2027-0-2']?.color === 'green', 'Note and color did not save together');
  await editor.getByRole('button', { name: 'diagonal stripes', exact: true }).tap();
  await until(() => stored().dateCells['2027-0-2']?.texture === 'diagonal-stripes' && !stored().dateCells['2027-0-2']?.color, 'Texture did not replace the color');
  assert.equal(stored().dateCells['2027-0-2'].customText, note);
  await editor.getByRole('button', { name: 'No color or texture', exact: true }).tap();
  await until(() => !stored().dateCells['2027-0-2']?.texture, 'Appearance was not cleared');
  assert.equal(stored().dateCells['2027-0-2'].customText, note);
  await editor.getByRole('button', { name: 'Done', exact: true }).tap();
  await editor.waitFor({ state: 'detached' });
  assert.equal(await summary.locator('.mobile-summary-note').innerText(), note, 'Saved note did not update below the month');
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Saturday, 2 January', exact: true }).waitFor();
  assert.equal(await page.locator('.mobile-agenda-note').filter({ hasText: 'Πλάνο / План' }).innerText(), note);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Edit Saturday, 2 January', exact: true }).tap();
  assert.equal(await editor.getByLabel('Note', { exact: true }).inputValue(), note);
  await page.setViewportSize({ width: 320, height: 500 });
  const sheet = await editor.boundingBox();
  assert.ok(sheet.x >= 0 && sheet.y >= 0 && sheet.width <= 320 && sheet.y + sheet.height <= 501, 'Editor is outside the small viewport');
  await editor.getByLabel('Note', { exact: true }).fill('');
  await page.keyboard.press('Escape');
  await until(() => !stored().dateCells['2027-0-2'], 'Clearing a note did not remove its empty entry');
  assert.deepEqual(stored().dateCells, seed.dateCells);
  assert.equal(stored().selectedView, 'Linear');
  assert.equal(stored().selectedColorTexture, 'purple');

  // Even six-week months leave the selected date and preview on screen together.
  await page.setViewportSize({ width: 320, height: 667 });
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.getByLabel('Month', { exact: true }).selectOption('4');
  await page.locator('.mobile-day[data-date="2027-4-31"]').tap();
  await summary.getByRole('heading', { name: 'Monday, 31 May', exact: true }).waitFor();
  const grid = await page.locator('.mobile-month-grid').boundingBox();
  const preview = await summary.boundingBox();
  assert.equal(await summary.locator('.mobile-summary-note').textContent(), seed.dateCells['2027-4-31'].customText);
  assert.ok(await summary.locator('.mobile-summary-note').evaluate(element => element.scrollHeight > element.clientHeight), 'Long note cannot scroll inside the small preview');
  assert.ok(grid.y >= 0 && grid.y + grid.height <= preview.y && preview.y + preview.height <= 667, 'Six-week month and day preview do not fit together');
  await summary.locator('.mobile-summary-note').scrollIntoViewIfNeeded();
  const noteBox = await summary.locator('.mobile-summary-note').boundingBox();
  const noteTouch = { x: noteBox.x + noteBox.width / 2, y: noteBox.y + noteBox.height - 12 };
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [noteTouch] });
  for (let step = 1; step <= 8; step++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: noteTouch.x, y: noteTouch.y - step * 8 }] });
    await new Promise(resolve => setTimeout(resolve, 16)); // A swipe spans rendered frames.
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await until(async () => await summary.locator('.mobile-summary-note').evaluate(element => element.scrollTop > 0), 'Long note cannot be read by touch scrolling the preview');
  const writesBeforeBrowsing = writes;
  await page.getByRole('button', { name: 'Previous month' }).click();
  await summary.getByRole('heading', { name: 'Thursday, 1 April', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByLabel('Month', { exact: true }).selectOption('11');
  assert.equal(await page.getByRole('button', { name: 'Next month' }).isDisabled(), true);
  assert.equal(writes, writesBeforeBrowsing, 'Date preview navigation wrote to the calendar');

  const currentYear = new Date().getFullYear();
  const leapYear = Array.from({ length: 7 }, (_, index) => currentYear - 1 + index).find(year => new Date(year, 1, 29).getMonth() === 1);
  await page.getByLabel('Calendar year', { exact: true }).selectOption(String(leapYear));
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.getByLabel('Month', { exact: true }).selectOption('1');
  assert.equal(await page.locator('.mobile-day').count(), 29, 'Leap-year February is incomplete');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  const today = new Date();
  await until(async () => await page.getByLabel('Calendar year', { exact: true }).inputValue() === String(today.getFullYear()), 'Today did not restore the current year');
  assert.equal(await page.getByLabel('Month', { exact: true }).inputValue(), String(today.getMonth()));
  assert.equal(await page.locator(`.mobile-day[data-date="${today.getFullYear()}-${today.getMonth()}-${today.getDate()}"]`).getAttribute('aria-pressed'), 'true');
  await page.getByLabel('Calendar year', { exact: true }).selectOption(String(leapYear));
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.mobile-planner').evaluate(element => getComputedStyle(element).display), 'none');
  assert.notEqual(await page.locator('.desktop-calendar').evaluate(element => getComputedStyle(element).display), 'none');
  await until(async () => await page.locator(`.desktop-calendar .day[data-date^="${leapYear}-"]`).count() === 366, 'Phone printing did not render the full year');
  await page.emulateMedia({ media: null });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.calendar-toolbar').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Linear', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.locator('.mobile-planner').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.mobile-planner').count(), 0);
  assert.deepEqual(errors, []);
});
