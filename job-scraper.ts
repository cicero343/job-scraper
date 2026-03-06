import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as readline from 'readline';
import { execSync } from 'child_process';

chromium.use(StealthPlugin());

// ─────────────────────────────────────────────
// ASCII ART + DISCLAIMER
// ─────────────────────────────────────────────

function printBanner() {
  console.log(`
   _       _                                     _
  (_)     | |                                   | |
   _  ___ | |__     ___  ___ _ __ __ _ _ __   ___ _ __
  | |/ _ \\| '_ \\   / __|/ __| '__/ _\` | '_ \\ / _ \\ '__|
  | | (_) | |_) |  \\__ \\ (__| | | (_| | |_) |  __/ |
  | |\\___/|_.__/   |___/\\___|_|  \\__,_| .__/ \\___|_|
 _/ |                                  | |
|__/                                   |_|

  ⚠  This tool is for educational purposes only.
  ⚠  It demonstrates browser automation and scraping techniques.
  ⚠  Some sites may return limited or no results without authentication.
  ⚠  A valid session cookie file (.json) may be required for certain sites.
  ⚠  Please respect the terms of service of any site you interact with.
`);
}

// ─────────────────────────────────────────────
// DEPENDENCY CHECK
// ─────────────────────────────────────────────

function isInstalled(pkg: string): boolean {
  try {
    require.resolve(pkg);
    return true;
  } catch {
    return false;
  }
}

function checkDependencies() {
  const required = ['playwright-extra', 'puppeteer-extra-plugin-stealth'];
  for (const pkg of required) {
    if (!isInstalled(pkg)) {
      console.log(`📦 ${pkg} not found.`);
      const answer = prompt(`Install ${pkg}? (y/n): `);
      if (answer?.toLowerCase() === 'y') {
        execSync(`npm install ${pkg}`, { stdio: 'inherit' });
      } else {
        console.log(`Skipping ${pkg} — script may not work correctly.`);
      }
    }
  }
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  easyApply?: boolean;
}

interface SiteResult {
  site: string;
  jobs: Job[];
  error?: string;
}

interface Config {
  lastIndeedCookieFile?: string;
  lastTotalJobsCookieFile?: string;
}

// ─────────────────────────────────────────────
// CONFIG (cookie persistence only)
// ─────────────────────────────────────────────

const CONFIG_FILE = 'job-scraper-config.json';

function loadConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config: Config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ─────────────────────────────────────────────
// SEEN JOBS (keyed by keyword)
// ─────────────────────────────────────────────

function seenJobsFile(keyword: string): string {
  const slug = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `seen-${slug}.json`;
}

function loadSeenJobs(keyword: string): Set<string> {
  try {
    return new Set(JSON.parse(fs.readFileSync(seenJobsFile(keyword), 'utf-8')));
  } catch {
    return new Set();
  }
}

function saveSeenJobs(keyword: string, seen: Set<string>) {
  fs.writeFileSync(seenJobsFile(keyword), JSON.stringify([...seen], null, 2));
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomViewport() {
  const widths = [1280, 1366, 1440, 1536, 1920];
  const heights = [720, 768, 800, 864, 900, 1080];
  return {
    width: widths[Math.floor(Math.random() * widths.length)],
    height: heights[Math.floor(Math.random() * heights.length)],
  };
}

function randomUserAgent(): string {
  const agents = [
    // Windows Chrome
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    // Mac Chrome
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

async function simulateHuman(page: any) {
  // Random mouse movement
  const x1 = randomBetween(100, 800);
  const y1 = randomBetween(100, 500);
  const x2 = randomBetween(100, 800);
  const y2 = randomBetween(100, 500);
  await page.mouse.move(x1, y1, { steps: randomBetween(10, 20) });
  await page.waitForTimeout(randomBetween(200, 500));
  await page.mouse.move(x2, y2, { steps: randomBetween(10, 20) });
  await page.waitForTimeout(randomBetween(200, 400));

  // Random scroll
  const scrollAmount = randomBetween(300, 800);
  await page.evaluate((amount: number) => window.scrollBy(0, amount), scrollAmount);
  await page.waitForTimeout(randomBetween(500, 1200));
  await page.evaluate((amount: number) => window.scrollBy(0, -amount / 2), scrollAmount);
  await page.waitForTimeout(randomBetween(300, 700));
}

function isCaptchaPage(html: string): boolean {
  const indicators = [
    'captcha',
    'are you a robot',
    'verify you are human',
    'unusual traffic',
    'access denied',
    'please verify',
    'security check',
  ];
  const lower = html.toLowerCase();
  return indicators.some(i => lower.includes(i));
}

// ─────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────

async function getCookieFile(
  rl: readline.Interface,
  siteName: string,
  lastFile?: string
): Promise<string | null> {
  console.log(`\n  A session cookie file (.json) may be required for ${siteName}.`);
  console.log('  Press Enter to skip (results may be limited or unavailable).');

  if (lastFile) {
    const useLast = await ask(rl, `  Use last cookie file? (${lastFile}) (y/n or Enter to skip): `);
    const trimmed = useLast.trim().toLowerCase();
    if (trimmed === 'y') {
      if (fs.existsSync(lastFile)) {
        console.log(`  Using: ${lastFile}`);
        return lastFile;
      } else {
        console.log('  ⚠  Last cookie file no longer exists — please enter a new path.');
      }
    } else if (trimmed === '' || trimmed === 'n' && !lastFile) {
      return null;
    }
  }

  const input = await ask(rl, '  Cookie file path (or Enter to skip): ');
  const cleaned = input.trim().replace(/^['"]|['"]$/g, '');
  if (!cleaned) return null;
  if (!fs.existsSync(cleaned)) {
    console.log('  ⚠  File not found — proceeding without cookies.');
    return null;
  }
  return cleaned;
}

async function getSiteChoice(rl: readline.Interface): Promise<string> {
  console.log('\n  Select a site to search:\n');
  console.log('  [1] Reed          ✓ no login needed  (default)');
  console.log('  [2] Indeed        ⚠ cookie recommended  (may be slow)');
  console.log('  [3] TotalJobs     ⚠ cookie recommended');
  console.log('  [4] All sites     ⚠ cookie recommended for Indeed + TotalJobs');
  console.log('');

  while (true) {
    const input = await ask(rl, '  Choice (1/2/3/4) or Enter for default: ');
    const trimmed = input.trim();
    if (trimmed === '' || trimmed === '1') return '1';
    if (['2', '3', '4'].includes(trimmed)) return trimmed;
    console.log('  Please enter 1, 2, 3, or 4.');
  }
}

async function getSharedParams(rl: readline.Interface) {
  console.log('');

  // Keyword
  let keyword = '';
  while (!keyword) {
    const input = await ask(rl, 'Job title keywords: ');
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      console.log('Please enter at least one keyword.');
    } else if (trimmed.length > 50) {
      console.log('Too long — please keep it under 50 characters.');
    } else {
      keyword = trimmed;
    }
  }

  // Location
  let location = '';
  while (!location) {
    const input = await ask(rl, 'Location (town or postcode): ');
    const trimmed = input.trim();
    if (trimmed.length < 2) {
      console.log('Please enter a valid location.');
    } else if (trimmed.length > 50) {
      console.log('Too long — please keep it under 50 characters.');
    } else {
      location = trimmed;
    }
  }

  // Radius
  console.log('Radius options: 5, 10, 20, 30');
  let radius = '';
  while (!radius) {
    const input = await ask(rl, 'Radius in miles: ');
    if (!['5', '10', '20', '30'].includes(input.trim())) {
      console.log('Please enter one of: 5, 10, 20, 30');
    } else {
      radius = input.trim();
    }
  }

  // Minimum salary
  console.log('Minimum salary options: 30000, 40000, any');
  let salary = '';
  while (!salary) {
    const input = await ask(rl, 'Minimum salary (30000 / 40000 / any): ');
    if (!['30000', '40000', 'any'].includes(input.trim())) {
      console.log('Please enter 30000, 40000, or any');
    } else {
      salary = input.trim();
    }
  }

  // Date posted
  console.log('Date posted options: 1, 3, 7, 14, any');
  let fromage = '';
  while (!fromage) {
    const input = await ask(rl, 'Posted within (days): ');
    if (!['1', '3', '7', '14', 'any'].includes(input.trim())) {
      console.log('Please enter 1, 3, 7, 14, or any');
    } else {
      fromage = input.trim();
    }
  }

  // Exclude keywords
  console.log('Title keywords to exclude (comma separated, or press Enter to skip)');
  const excludeInput = await ask(rl, 'Exclude keywords: ');
  const exclude = excludeInput.trim() === ''
    ? []
    : excludeInput.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);

  if (exclude.length > 0) console.log(`Excluding: ${exclude.join(', ')}`);
  else console.log('No exclusions set.');

  return { keyword, location, radius, salary, fromage, exclude };
}

// ─────────────────────────────────────────────
// REED SCRAPER
// ─────────────────────────────────────────────

const REED_FROMAGE_MAP: Record<string, string> = {
  '1': 'today',
  '3': 'lastthreedays',
  '7': 'lastweek',
  '14': 'lasttwoweeks',
  'any': 'anytime',
};

function toSlug(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function scrapeReed(
  page: any,
  keyword: string,
  location: string,
  radius: string,
  salary: string,
  fromage: string,
  exclude: string[]
): Promise<SiteResult> {
  const jobs: Job[] = [];

  try {
    await page.goto('https://www.reed.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const acceptBtn = page.getByRole('button', { name: 'Accept All' });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }

    let pageNum = 1;

    while (true) {
      const path = `https://www.reed.co.uk/jobs/${toSlug(keyword)}-jobs-in-${toSlug(location)}`;
      const params = new URLSearchParams({ proximity: radius });
      if (salary !== 'any') params.set('salaryFrom', salary);
      if (fromage !== 'any') params.set('dateCreatedOffSet', REED_FROMAGE_MAP[fromage]);
      if (pageNum > 1) params.set('pageno', String(pageNum));

      console.log(`  [Reed] Scraping page ${pageNum}...`);
      await page.goto(`${path}?${params.toString()}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);

      const pageJobs: Job[] = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('article[data-qa="job-card"]'));
        return cards.map((card: any) => {
          const id = card.getAttribute('data-id') ?? '';
          const titleLink = card.querySelector('a[data-qa="job-card-title"]');
          const title = titleLink?.textContent?.trim() ?? '';
          const href = titleLink?.getAttribute('href') ?? '';
          const url = href ? `https://www.reed.co.uk${href}` : '';
          const companyLink = card.querySelector('[data-qa="job-posted-by"] a');
          const company = companyLink?.textContent?.trim() ?? '';
          const easyApply = !!card.querySelector('span[data-qa="badge-0-easyApply"]');
          return { id, title, company, url, easyApply };
        }).filter((j: any) => j.id !== '');
      });

      if (pageJobs.length === 0) break;

      jobs.push(...pageJobs.filter(j =>
        !exclude.some(kw => j.title.toLowerCase().includes(kw))
      ));

      const nextLink = page.locator('a[aria-label="Next page"]');
      const isVisible = await nextLink.isVisible({ timeout: 2000 }).catch(() => false);
      if (!isVisible) break;
      const isDisabled = await nextLink.evaluate((el: Element) =>
        el.closest('li')?.classList.contains('disabled') ?? false
      );
      if (isDisabled) break;

      pageNum++;
      await page.waitForTimeout(1000);
    }

    console.log(`  [Reed] Complete — ${jobs.length} jobs found`);
    return { site: 'Reed', jobs };

  } catch (err: any) {
    console.log(`  [Reed] ⚠ Error: ${err.message}`);
    return { site: 'Reed', jobs, error: err.message };
  }
}

// ─────────────────────────────────────────────
// INDEED SCRAPER (maximum stealth mode)
// ─────────────────────────────────────────────

const INDEED_CONTEXT_FILE = 'indeed-browser-context.json';

async function scrapeIndeed(
  browser: any,
  keyword: string,
  location: string,
  radius: string,
  salary: string,
  fromage: string,
  exclude: string[],
  cookieFile: string | null
): Promise<SiteResult> {
  const jobs: Job[] = [];
  let context: any = null;
  let page: any = null;

  try {
    const viewport = randomViewport();
    const userAgent = randomUserAgent();

    // Try to restore saved browser context for returning-user simulation
    if (fs.existsSync(INDEED_CONTEXT_FILE)) {
      try {
        context = await browser.newContext({
          storageState: INDEED_CONTEXT_FILE,
          userAgent,
          viewport,
          locale: 'en-GB',
          timezoneId: 'Europe/London',
          extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
        });
        console.log('  [Indeed] Restored saved browser context.');
      } catch {
        console.log('  [Indeed] Could not restore context — starting fresh.');
        context = null;
      }
    }

    if (!context) {
      context = await browser.newContext({
        userAgent,
        viewport,
        locale: 'en-GB',
        timezoneId: 'Europe/London',
        extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
      });
    }

    // Load cookies if provided
    if (cookieFile) {
      try {
        const rawCookies = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
        const cookies = rawCookies.map((c: any) => ({
          ...c,
          sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax',
        }));
        await context.addCookies(cookies);
      } catch {
        console.log('  [Indeed] ⚠ Could not load cookie file — proceeding without.');
      }
    }

    page = await context.newPage();

    // Fingerprint masking — runs before page load, purely additive and safe
    await page.addInitScript(() => {
      // Suppress automation signals
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });

      // Hardware fingerprint — match common real device values
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

      // WebGL fingerprint masking
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      };

      // Canvas fingerprint — add subtle noise to canvas output
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
        const context = this.getContext('2d');
        if (context) {
          const imageData = context.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 100) {
            imageData.data[i] = imageData.data[i] ^ 1;
          }
          context.putImageData(imageData, 0, 0);
        }
        return toDataURL.call(this, type);
      };
    });

    // Randomise keyword encoding — alternates between + and %20 to vary the URL fingerprint
    const usePlus = Math.random() > 0.5;
    const q = usePlus
      ? keyword.trim().replace(/\s+/g, '+')
      : encodeURIComponent(keyword);
    const l = usePlus
      ? location.trim().replace(/\s+/g, '+')
      : encodeURIComponent(location);

    // Randomise salary encoding between percent-encoded and literal forms
    const useLiteralSalary = Math.random() > 0.5;
    const salaryParam = salary === '30000'
      ? (useLiteralSalary ? '&salaryType=£30,000+' : '&salaryType=%C2%A330%2C000%2B')
      : salary === '40000'
        ? (useLiteralSalary ? '&salaryType=£40,000+' : '&salaryType=%C2%A340%2C000%2B')
        : '';
    const fromageParam = fromage !== 'any' ? `&fromage=${fromage}` : '';

    // Randomise parameter order — removes consistent URL fingerprint
    const coreParams: string[] = [];
    const paramParts = [
      ['q', q],
      ['l', l],
      ['radius', radius],
    ];
    // Shuffle the core params
    for (let i = paramParts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [paramParts[i], paramParts[j]] = [paramParts[j], paramParts[i]];
    }
    paramParts.forEach(([k, v]) => coreParams.push(`${k}=${v}`));
    const baseUrl = `https://uk.indeed.com/jobs?${coreParams.join('&')}${fromageParam}${salaryParam}`;

    // Navigate directly to Indeed with a realistic referer header
    console.log('  [Indeed] Loading Indeed...');
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.google.co.uk/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Upgrade-Insecure-Requests': '1',
    });
    await page.goto(`${baseUrl}&start=0`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(randomBetween(2000, 4000));
    await simulateHuman(page);

    // Check for CAPTCHA — if detected, try once more with a fresh context
    const htmlAfterLoad = await page.content();
    if (isCaptchaPage(htmlAfterLoad)) {
      console.log('  [Indeed] ⚠ CAPTCHA detected on first attempt — retrying with fresh context...');

      await page.close().catch(() => null);
      await context.close().catch(() => null);
      page = null;
      context = null;

      // Fresh context with different viewport and user agent — pause before retry
      await new Promise(r => setTimeout(r, randomBetween(4000, 8000)));
      const retryViewport = randomViewport();
      const retryUserAgent = randomUserAgent();
      context = await browser.newContext({
        userAgent: retryUserAgent,
        viewport: retryViewport,
        locale: 'en-GB',
        timezoneId: 'Europe/London',
        extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
      });

      if (cookieFile) {
        try {
          const rawCookies = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
          const cookies = rawCookies.map((c: any) => ({
            ...c,
            sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax',
          }));
          await context.addCookies(cookies);
        } catch { /* non-fatal */ }
      }

      page = await context.newPage();

      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
          if (parameter === 37445) return 'Intel Inc.';
          if (parameter === 37446) return 'Intel Iris OpenGL Engine';
          return getParameter.call(this, parameter);
        };
        const toDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
          const context = this.getContext('2d');
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 100) {
              imageData.data[i] = imageData.data[i] ^ 1;
            }
            context.putImageData(imageData, 0, 0);
          }
          return toDataURL.call(this, type);
        };
      });

      await page.setExtraHTTPHeaders({
        'Referer': 'https://www.google.co.uk/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
      });

      console.log('  [Indeed] Retrying...');
      await page.goto(`${baseUrl}&start=0`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(randomBetween(4000, 7000));
      await simulateHuman(page);

      const retryHtml = await page.content();
      if (isCaptchaPage(retryHtml)) {
        console.log('  [Indeed] ⚠ CAPTCHA on retry — skipping Indeed.');
        return { site: 'Indeed', jobs, error: 'CAPTCHA or access block detected after retry' };
      }

      console.log('  [Indeed] Retry successful — continuing.');
    }

    // Accept cookie banner if present
    const cookieBanner = page.getByRole('button', { name: 'Accept All Cookies' });
    if (await cookieBanner.isVisible({ timeout: 4000 }).catch(() => false)) {
      await cookieBanner.click();
      await page.waitForTimeout(randomBetween(1000, 2000));
    }

    // Save context for next run
    try {
      await context.storageState({ path: INDEED_CONTEXT_FILE });
    } catch {
      // Non-fatal
    }

    let start = 0;

    while (true) {
      if (start > 0) {
        console.log(`  [Indeed] Scraping page ${start / 10 + 1}...`);
        await page.goto(`${baseUrl}&start=${start}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomBetween(2500, 5000));
        await simulateHuman(page);

        // Check for CAPTCHA on subsequent pages
        const pageHtml = await page.content();
        if (isCaptchaPage(pageHtml)) {
          console.log(`  [Indeed] ⚠ CAPTCHA detected on page ${start / 10 + 1} — stopping pagination with ${jobs.length} jobs collected so far.`);
          break;
        }
      } else {
        console.log('  [Indeed] Scraping page 1...');
      }

      await page.waitForSelector('a[data-jk]', { timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(randomBetween(1000, 2000));

      const closeButton = page.locator('button[aria-label="close"]');
      if (await closeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(randomBetween(500, 1200));
      }

      const pageJobs: Job[] = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[data-jk]')).map((a: any) => {
          const id = a.getAttribute('data-jk') ?? '';
          const title = a.querySelector('span[title]')?.getAttribute('title')?.trim() ?? a.textContent?.trim() ?? '';
          const card = a.closest('.job_seen_beacon');
          const company = card?.querySelector('span[data-testid="company-name"]')?.textContent?.trim() ?? '';
          return { id, title, company, url: `https://uk.indeed.com/viewjob?jk=${id}` };
        }).filter((j: any) => j.id !== '');
      });

      if (pageJobs.length === 0) {
        console.log('  [Indeed] No jobs found on this page — stopping.');
        break;
      }

      jobs.push(...pageJobs.filter(j =>
        !exclude.some(kw => j.title.toLowerCase().includes(kw))
      ));

      const hasNext = await page.locator('[data-testid="pagination-page-next"]').isVisible({ timeout: 3000 }).catch(() => false);
      if (!hasNext) break;

      start += 10;

      // Occasional longer "reading" pause to mimic human behaviour
      const longPause = Math.random() > 0.7;
      if (longPause) {
        console.log('  [Indeed] Taking a short break...');
        await page.waitForTimeout(randomBetween(8000, 15000));
      } else {
        await page.waitForTimeout(randomBetween(3000, 6000));
      }
    }

    // Save updated context
    try {
      await context.storageState({ path: INDEED_CONTEXT_FILE });
    } catch {
      // Non-fatal
    }

    console.log(`  [Indeed] Complete — ${jobs.length} jobs found`);
    return { site: 'Indeed', jobs };

  } catch (err: any) {
    console.log(`  [Indeed] ⚠ Error: ${err.message}`);
    return { site: 'Indeed', jobs, error: err.message };
  } finally {
    if (page) await page.close().catch(() => null);
    if (context) await context.close().catch(() => null);
  }
}

// ─────────────────────────────────────────────
// TOTALJOBS SCRAPER
// ─────────────────────────────────────────────

const TOTALJOBS_DATE_MAP: Record<string, string> = {
  '1': 'Last 24 hours',
  '3': 'Last 3 days',
  '7': 'Last 7 days',
  '14': 'Last 14 days',
};

async function dismissTotalJobsCookieBanner(page: any) {
  try {
    const acceptAll = page.locator('#ccmgt_explicit_accept');
    if (await acceptAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptAll.click();
      await page.locator('#GDPRConsentManagerContainer').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(500);
      return;
    }
    const justNecessary = page.locator('#ccmgt_explicit_preferences');
    if (await justNecessary.isVisible({ timeout: 1000 }).catch(() => false)) {
      await justNecessary.click();
      await page.locator('#GDPRConsentManagerContainer').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(500);
    }
  } catch {
    // Banner not present
  }
}

async function scrapeTotalJobs(
  page: any,
  keyword: string,
  location: string,
  radius: string,
  salary: string,
  fromage: string,
  exclude: string[],
  cookieFile: string | null
): Promise<SiteResult> {
  const jobs: Job[] = [];

  try {
    if (cookieFile) {
      try {
        const rawCookies = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
        const cookies = rawCookies.map((c: any) => ({
          ...c,
          sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax',
        }));
        await page.context().addCookies(cookies);
      } catch {
        console.log('  [TotalJobs] ⚠ Could not load cookie file — proceeding without.');
      }
    }

    console.log('  [TotalJobs] Loading homepage...');
    await page.goto('https://www.totaljobs.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000 + Math.random() * 1000);
    await dismissTotalJobsCookieBanner(page);

    await page.locator('[data-at="searchbar-keyword-input"]').click();
    await page.locator('[data-at="searchbar-keyword-input"]').fill(keyword);
    await page.waitForTimeout(500);
    await page.locator('[data-at="searchbar-location-input"]').click();
    await page.locator('[data-at="searchbar-location-input"]').fill(location);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await dismissTotalJobsCookieBanner(page);

    await page.getByRole('menuitem', { name: 'select radius' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('menuitemradio', { name: `${radius} miles` }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await dismissTotalJobsCookieBanner(page);

    if (salary !== 'any') {
      const salaryLabel = `at least £${Number(salary).toLocaleString()}`;
      await page.getByRole('link', { name: salaryLabel }).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      await dismissTotalJobsCookieBanner(page);
    }

    if (fromage !== 'any') {
      await page.getByRole('link', { name: TOTALJOBS_DATE_MAP[fromage] }).click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      await dismissTotalJobsCookieBanner(page);
    }

    let pageNum = 1;

    while (true) {
      console.log(`  [TotalJobs] Scraping page ${pageNum}...`);
      await page.waitForSelector('article[data-testid="job-item"]', { timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(2000);

      const pageJobs: Job[] = await page.evaluate(() => {
        const excludedIds = new Set<string>();
        const excludedPhrases = [
          'these jobs might also interest you',
          'exact matches jobs are outside your preferred location',
        ];
        document.querySelectorAll('h4[data-genesis-element="TEXT"]').forEach((h: any) => {
          if (excludedPhrases.some(p => h.textContent?.toLowerCase().includes(p))) {
            const container = h.closest('div[data-genesis-element="BASE"]');
            container?.querySelectorAll('article[data-testid="job-item"]').forEach((el: any) => {
              const id = (el.getAttribute('id') ?? '').replace('job-item-', '');
              if (id) excludedIds.add(id);
            });
          }
        });

        return Array.from(document.querySelectorAll('article[data-testid="job-item"]'))
          .filter((card: any) => {
            const id = (card.getAttribute('id') ?? '').replace('job-item-', '');
            return id && !excludedIds.has(id);
          })
          .map((card: any) => {
            const id = (card.getAttribute('id') ?? '').replace('job-item-', '');
            const titleLink = card.querySelector('a[data-testid="job-item-title"]');
            const title = titleLink?.querySelector('div.res-ewgtgq')?.textContent?.trim() ?? '';
            const href = titleLink?.getAttribute('href') ?? '';
            const url = href ? `https://www.totaljobs.com${href}` : '';
            const company = card.querySelector('span[data-at="job-item-company-name"] div.res-ewgtgq')?.textContent?.trim() ?? '';
            return { id, title, company, url };
          });
      });

      if (pageJobs.length === 0) break;

      jobs.push(...pageJobs.filter(j =>
        !exclude.some(kw => j.title.toLowerCase().includes(kw))
      ));

      const nextPage = page.getByRole('link', { name: 'Next' });
      if (!await nextPage.isVisible({ timeout: 3000 }).catch(() => false)) break;

      await nextPage.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      await dismissTotalJobsCookieBanner(page);
      pageNum++;
    }

    console.log(`  [TotalJobs] Complete — ${jobs.length} jobs found`);
    return { site: 'TotalJobs', jobs };

  } catch (err: any) {
    console.log(`  [TotalJobs] ⚠ Error: ${err.message}`);
    return { site: 'TotalJobs', jobs, error: err.message };
  }
}

// ─────────────────────────────────────────────
// HTML REPORT
// ─────────────────────────────────────────────

const FLAG_THRESHOLD = 4;

function generateReport(
  keyword: string,
  siteResults: SiteResult[],
  seenJobs: Set<string>
): string {
  const seenThisRun = new Set<string>();

  // Count occurrences of each title+company combination across all sites
  const occurrenceMap = new Map<string, number>();
  siteResults.forEach(({ jobs }) => {
    jobs.forEach(j => {
      const key = `${j.title.toLowerCase()}||${j.company.toLowerCase()}`;
      occurrenceMap.set(key, (occurrenceMap.get(key) ?? 0) + 1);
    });
  });

  // Identify flagged keys (4+ occurrences) and collect one representative per key
  const flaggedKeys = new Set<string>();
  const flaggedRepresentatives = new Map<string, Job & { site: string; count: number }>();
  occurrenceMap.forEach((count, key) => {
    if (count >= FLAG_THRESHOLD) flaggedKeys.add(key);
  });

  siteResults.forEach(({ site, jobs }) => {
    jobs.forEach(j => {
      const key = `${j.title.toLowerCase()}||${j.company.toLowerCase()}`;
      if (flaggedKeys.has(key) && !flaggedRepresentatives.has(key)) {
        flaggedRepresentatives.set(key, { ...j, site, count: occurrenceMap.get(key) ?? 0 });
      }
    });
  });

  // Filter flagged jobs out of each site's results before rendering
  const filteredResults = siteResults.map(r => ({
    ...r,
    jobs: r.jobs.filter(j => {
      const key = `${j.title.toLowerCase()}||${j.company.toLowerCase()}`;
      return !flaggedKeys.has(key);
    }),
  }));

  const renderCountMap = new Map<string, number>();
  let globalIndex = 0;

  const siteSections = filteredResults.map(({ site, jobs, error }) => {
    if (error && jobs.length === 0) {
      return `
        <div style="margin-top:2rem;">
          <h3 style="border-bottom:2px solid #333;padding-bottom:0.5rem;">${site}</h3>
          <p style="color:#c0392b;">⚠ Unable to retrieve results — ${error}</p>
        </div>`;
    }

    if (jobs.length === 0) {
      return `
        <div style="margin-top:2rem;">
          <h3 style="border-bottom:2px solid #333;padding-bottom:0.5rem;">${site}</h3>
          <p style="color:#888;">No results found.</p>
        </div>`;
    }

    // Stable sort by company name — groups same-company listings together
    // whilst preserving original order within each company (recency/relevance intact)
    const sortedJobs = [...jobs].sort((a, b) => {
      const ca = a.company.toLowerCase();
      const cb = b.company.toLowerCase();
      if (!ca && !cb) return 0;
      if (!ca) return 1;  // no company goes to bottom
      if (!cb) return -1;
      return ca.localeCompare(cb);
    });

    const rows = sortedJobs.map(j => {
      globalIndex++;
      const isPreviouslySeen = seenJobs.has(j.id);
      const isDuplicateThisRun = !isPreviouslySeen && seenThisRun.has(j.id);
      seenThisRun.add(j.id);

      const key = `${j.title.toLowerCase()}||${j.company.toLowerCase()}`;
      const renderCount = (renderCountMap.get(key) ?? 0) + 1;
      renderCountMap.set(key, renderCount);
      const totalOccurrences = occurrenceMap.get(key) ?? 1;
      const occurrenceSuffix = totalOccurrences > 1
        ? ` <span style="color:#999;font-size:0.8rem;">(${renderCount}/${totalOccurrences})</span>`
        : '';

      let badges = '';
      if (isPreviouslySeen) {
        badges += '<span style="background:#e67e22;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">SEEN BEFORE</span>';
      } else if (isDuplicateThisRun) {
        badges += '<span style="background:#8e44ad;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">DUPLICATE</span>';
      }
      if (j.easyApply) {
        badges += '<span style="background:#e91e8c;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">⚡ EASY APPLY</span>';
      }

      const titleEl = site === 'Reed'
        ? `<a href="${j.url}" style="font-weight:bold;color:#1a1a1a;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${j.title}</a>`
        : `<strong>${j.title}</strong>`;

      return `
        <div style="margin:14px 0;${isPreviouslySeen || isDuplicateThisRun ? 'opacity:0.5;' : ''}">
          <span style="color:#999;font-size:0.85rem;margin-right:8px;">${globalIndex}.</span>
          ${badges}
          ${titleEl}${occurrenceSuffix}
          ${j.company ? `<span style="color:#666;margin-left:8px;">— ${j.company}</span>` : ''}
          ${site !== 'Reed' ? `<br><a href="${j.url}" style="font-size:0.85rem;">${j.url}</a>` : ''}
        </div>`;
    }).join('');

    return `
      <div style="margin-top:2rem;">
        <h3 style="border-bottom:2px solid #333;padding-bottom:0.5rem;">
          ${site}${error ? ' <span style="color:#e67e22;font-size:0.8rem;">⚠ partial results</span>' : ''}
        </h3>
        <p style="color:#666;font-size:0.85rem;">${jobs.length} result${jobs.length !== 1 ? 's' : ''}</p>
        ${rows}
      </div>`;
  }).join('');

  // Flagged section
  let flaggedSection = '';
  if (flaggedRepresentatives.size > 0) {
    const flaggedRows = Array.from(flaggedRepresentatives.values())
      .sort((a, b) => b.count - a.count)
      .map((j, i) => {
        const titleEl = j.site === 'Reed'
          ? `<a href="${j.url}" style="font-weight:bold;color:#7f8c8d;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${j.title}</a>`
          : `<strong style="color:#7f8c8d;">${j.title}</strong>`;

        return `
          <div style="margin:14px 0;opacity:0.6;">
            <span style="color:#999;font-size:0.85rem;margin-right:8px;">${i + 1}.</span>
            <span style="background:#c0392b;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;margin-right:6px;">✕ ${j.count}×</span>
            ${titleEl}
            ${j.company ? `<span style="color:#999;margin-left:8px;">— ${j.company}</span>` : ''}
            ${j.site !== 'Reed' ? `<br><a href="${j.url}" style="font-size:0.85rem;color:#999;">${j.url}</a>` : ''}
          </div>`;
      }).join('');

    flaggedSection = `
      <div style="margin-top:3rem;padding-top:1rem;border-top:2px dashed #c0392b;">
        <h3 style="color:#c0392b;padding-bottom:0.5rem;">⚠ Flagged Listings (${flaggedRepresentatives.size})</h3>
        <p style="color:#888;font-size:0.85rem;">
          These listings appeared ${FLAG_THRESHOLD} or more times across all results and may be spam, bootcamps, or low-quality postings.
          They have been removed from the main results above.
        </p>
        ${flaggedRows}
      </div>`;
  }

  const totalUnique = new Set(siteResults.flatMap(r => r.jobs.map(j => j.id))).size;
  const totalFlagged = flaggedRepresentatives.size;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Job Scraper — ${keyword}</title></head>
<body style="font-family:sans-serif;max-width:860px;margin:40px auto;padding:0 1rem;">
  <h2>Job Scraper Results — ${keyword}</h2>
  <p style="color:#666;font-size:0.85rem;">
    ${new Date().toLocaleDateString('en-GB')} ·
    ${totalUnique} unique job${totalUnique !== 1 ? 's' : ''} total
    ${totalFlagged > 0 ? `· <span style="color:#c0392b;">${totalFlagged} flagged</span>` : ''}
  </p>
  <p style="font-size:0.8rem;color:#888;">
    <span style="background:#e67e22;color:#fff;padding:1px 5px;border-radius:3px;">SEEN BEFORE</span> = appeared in a previous run &nbsp;
    <span style="background:#8e44ad;color:#fff;padding:1px 5px;border-radius:3px;">DUPLICATE</span> = appeared across sites this run &nbsp;
    <span style="background:#e91e8c;color:#fff;padding:1px 5px;border-radius:3px;">⚡ EASY APPLY</span> = one-click application (Reed only) &nbsp;
    <span style="background:#c0392b;color:#fff;padding:1px 5px;border-radius:3px;">✕ N×</span> = flagged (4+ occurrences)
  </p>
  <hr>
  ${siteSections}
  ${flaggedSection}
</body>
</html>`;
}

// ─────────────────────────────────────────────
// RESULTS FILENAME
// ─────────────────────────────────────────────

function resultsFile(keyword: string): string {
  const slug = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `results-${slug}.html`;
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

(async () => {
  printBanner();
  checkDependencies();

  const config = loadConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Site selection
  const siteChoice = await getSiteChoice(rl);
  const runReed = ['1', '4'].includes(siteChoice);
  const runIndeed = ['2', '4'].includes(siteChoice);
  const runTotalJobs = ['3', '4'].includes(siteChoice);

  // Cookie files upfront
  let indeedCookieFile: string | null = null;
  let totalJobsCookieFile: string | null = null;

  if (runIndeed) {
    console.log('\n--- Indeed ---');
    indeedCookieFile = await getCookieFile(rl, 'Indeed', config.lastIndeedCookieFile);
  }
  if (runTotalJobs) {
    console.log('\n--- TotalJobs ---');
    totalJobsCookieFile = await getCookieFile(rl, 'TotalJobs', config.lastTotalJobsCookieFile);
  }

  // Save cookie paths to config
  if (indeedCookieFile) config.lastIndeedCookieFile = indeedCookieFile;
  if (totalJobsCookieFile) config.lastTotalJobsCookieFile = totalJobsCookieFile;
  saveConfig(config);

  // Shared search parameters
  const params = await getSharedParams(rl);
  rl.close();

  // Open browser after all prompts
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-http2',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
    ],
  });

  const viewport = randomViewport();
  const userAgent = randomUserAgent();

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });

  const page = await context.newPage();

  // Fingerprint masking for Reed and TotalJobs — safe universal baseline
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
      const context = this.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 100) {
          imageData.data[i] = imageData.data[i] ^ 1;
        }
        context.putImageData(imageData, 0, 0);
      }
      return toDataURL.call(this, type);
    };
  });

  const siteResults: SiteResult[] = [];

  try {
    if (runReed) {
      console.log('\n🔍 Searching Reed...');
      siteResults.push(await scrapeReed(page, params.keyword, params.location, params.radius, params.salary, params.fromage, params.exclude));
    }

    if (runIndeed) {
      console.log('\n🔍 Searching Indeed...');
      siteResults.push(await scrapeIndeed(browser, params.keyword, params.location, params.radius, params.salary, params.fromage, params.exclude, indeedCookieFile));
    }

    if (runTotalJobs) {
      console.log('\n🔍 Searching TotalJobs...');
      siteResults.push(await scrapeTotalJobs(page, params.keyword, params.location, params.radius, params.salary, params.fromage, params.exclude, totalJobsCookieFile));
    }

    // await page.pause(); // Uncomment to pause browser before closing (useful for debugging)

  } finally {
    await browser.close();

    const seenJobs = loadSeenJobs(params.keyword);
    const html = generateReport(params.keyword, siteResults, seenJobs);

    const newSeenJobs = new Set(seenJobs);
    siteResults.forEach(r => r.jobs.forEach(j => newSeenJobs.add(j.id)));
    saveSeenJobs(params.keyword, newSeenJobs);

    const outFile = resultsFile(params.keyword);
    fs.writeFileSync(outFile, html);

    const totalJobs = siteResults.reduce((acc, r) => acc + r.jobs.length, 0);
    const failedSites = siteResults.filter(r => r.error);

    console.log(`\n🎉 Results saved to ${outFile}`);
    console.log(`📋 ${totalJobs} job${totalJobs !== 1 ? 's' : ''} found across ${siteResults.length} site${siteResults.length !== 1 ? 's' : ''}`);
    console.log(`📁 Seen jobs updated — ${newSeenJobs.size} total tracked for "${params.keyword}"`);

    if (failedSites.length > 0) {
      console.log(`\n⚠  The following sites encountered errors:`);
      failedSites.forEach(r => console.log(`   - ${r.site}: ${r.error}`));
      console.log('   Partial results have been included in the report where available.');
    }
  }
})();
