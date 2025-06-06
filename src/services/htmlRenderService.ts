import dayjs from 'dayjs';
import { Browser, Page, chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import * as logger from '../utils/logger';

/**
 * Service for rendering HTML content from URLs using Playwright
 */

// Single browser instance - keep a reference to avoid repeated creation
let browser: Browser | null = null;

// Create browser with correct flags to prevent zombies
async function createBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--no-zygote', // Critical for preventing zombies
      '--disable-dev-shm-usage',
      // Add fingerprinting prevention flags
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-canvas-aa',
      '--disable-2d-canvas-clip-aa',
      '--disable-web-security',
      '--disable-webgl',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-notifications',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-extensions',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
    ],
  });
}

// Get or create browser
export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    try {
      browser = await createBrowser();
      logger.info(`Browser launched at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
    } catch (err) {
      logger.error('Failed to launch browser:', err);
      throw err;
    }
  }
  return browser;
}

// Safe cleanup function
export async function cleanupBrowser(): Promise<void> {
  if (browser) {
    try {
      logger.info('Cleaning up browser...');
      await browser.close();
      logger.info('Browser closed successfully');
    } catch (e) {
      logger.error('Error closing browser:', e);
    } finally {
      browser = null;
    }
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  logger.info('SIGINT received, cleaning up browser...');
  await cleanupBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, cleaning up browser...');
  await cleanupBrowser();
  process.exit(0);
});

// Ensure screenshots directory exists
const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Generate a random user agent
function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  ];

  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 1. Input Processing
// 1.1 Define the function to wait for specific content to appear on the page
const getHtmlWhenReady = async (page: Page): Promise<string> => {
  // 1.2 Use page.evaluate to run client-side code that waits for content
  const html = await page.evaluate<string>(
    () =>
      new Promise((resolve) => {
        // 1.2.1 Define expected words inside the evaluate function
        const expectedWords = ['配送', '商品详情'];

        // 1.2.2 Create a function to check if content contains expected words
        const checkContent = () => {
          const bodyText = document.body.innerText;
          return expectedWords.some((word) => bodyText.includes(word));
        };

        // 1.2.3 Check immediately if content is already available
        if (checkContent()) {
          resolve(document.documentElement.outerHTML);
          return;
        }

        // 1.2.4 Set up mutation observer to watch for content changes
        const observer = new MutationObserver(() => {
          if (checkContent()) {
            observer.disconnect();
            resolve(document.documentElement.outerHTML);
          }
        });

        // 1.2.5 Configure the observer to watch the entire body
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        // 1.2.6 Set a timeout to resolve anyway after 30 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(document.documentElement.outerHTML);
        }, 30000);
      })
  );

  // 1.3 Return the HTML content
  return html;
};

/**
 * Manages screenshot directories - creates today's directory and cleans up old ones
 * @returns The path to today's screenshot directory
 */
function manageScreenshotDirectories(): string {
  const getRelatevePath = (date: Date): string => {
    const dateDir = dayjs(date).format('YYYY-MM-DD');
    return `screenshots/${dateDir}`;
  };
  // Clean up directories older than 1 day to avoid filling up the disk
  const oneDayAgo = dayjs().subtract(1, 'day');
  const oneDayAgoDir = path.join(process.cwd(), getRelatevePath(oneDayAgo.toDate()));
  if (fs.existsSync(oneDayAgoDir)) {
    fs.rmdirSync(oneDayAgoDir, { recursive: true });
  }

  // Create a directory for today
  const relativeDir = getRelatevePath(new Date());
  const dir = path.join(process.cwd(), relativeDir);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return relativeDir;
}

/**
 * Get the directory path to save screenshots
 * @returns the relative path to the screenshot file
 */
const saveScreenshot = async (page: Page, url: string): Promise<string> => {
  // Manage screenshot directories
  const relativeDir = manageScreenshotDirectories();

  const urlObj = new URL(url);
  // Get the id from the url query named `id`.
  const fileName = `${dayjs().format('HH-mm-ss')}-${urlObj.searchParams.get('id')}.png`;

  const relativePath = `${relativeDir}/${fileName}`;

  // Save the page screenshot to the directory
  await page.screenshot({ path: path.join(process.cwd(), relativePath) });

  // Return the relative path
  return relativePath;
};

// 2. Logic Handling
// 2.1 Define the main function to render HTML from a URL
export interface RenderUrlToHtmlResult {
  screenshot: string;
  html: string;
  timeTaken: number;
  url: string;
}

export async function renderUrlToHtml(url: string): Promise<RenderUrlToHtmlResult> {
  // 2.1.1 Record start time for performance measurement
  const startTime = Date.now();

  // Use isolated browser contexts for each request
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    viewport: {
      width: 1366 + Math.floor(Math.random() * 100),
      height: 768 + Math.floor(Math.random() * 100),
    },
    screen: {
      width: 1366 + Math.floor(Math.random() * 100),
      height: 768 + Math.floor(Math.random() * 100),
    },
    deviceScaleFactor: 1 + Math.random() * 0.3,
    locale: ['en-US', 'en-GB', 'zh-CN'][Math.floor(Math.random() * 3)],
    timezoneId: ['Asia/Shanghai', 'America/New_York', 'Europe/London'][
      Math.floor(Math.random() * 3)
    ],
    permissions: ['geolocation'],
    javaScriptEnabled: true,
    bypassCSP: true,
    hasTouch: Math.random() > 0.5,
    // Add additional context options to prevent fingerprinting
    colorScheme: Math.random() > 0.5 ? 'dark' : 'light',
    reducedMotion: Math.random() > 0.8 ? 'reduce' : 'no-preference',
    forcedColors: Math.random() > 0.9 ? 'active' : 'none',
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    // Randomize navigator properties to avoid fingerprinting
    await page.addInitScript(() => {
      // Override properties used for fingerprinting
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // Add noise to fingerprinting APIs
      if (Math.random() > 0.5) {
        // Random hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => Math.floor(Math.random() * 8) + 2,
        });
      }

      if (Math.random() > 0.5) {
        // Random platform
        Object.defineProperty(navigator, 'platform', {
          get: () => ['Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 3)],
        });
      }
    });

    // Add script to interfere with canvas fingerprinting
    await page.addInitScript(`
      (function() {
        // Add noise to Canvas
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
          const dataURL = originalToDataURL.apply(this, arguments);
          if (Math.random() < 0.1) {
            // 10% chance to slightly modify the canvas data
            const canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this, 0, 0);
            
            // Add a tiny invisible dot at a random position
            ctx.fillStyle = 'rgba(255, 255, 255, 0.001)';
            ctx.fillRect(
              Math.random() * this.width,
              Math.random() * this.height,
              1,
              1
            );
            return canvas.toDataURL(type);
          }
          return dataURL;
        };
      })();
    `);

    // Load URL with timeout
    logger.info(`Rendering: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50 * 1000 });

    // Get HTML content
    const html = await getHtmlWhenReady(page);

    // Save screenshot with unique name
    const savePath = await saveScreenshot(page, url);

    // Calculate performance metrics
    const endTime = Date.now();
    const timeTaken = (endTime - startTime) / 1000;

    // Build result
    const result: RenderUrlToHtmlResult = {
      html,
      timeTaken,
      screenshot: savePath,
      url,
    };

    return result;
  } catch (error) {
    logger.error(`Error rendering ${url}:`, error);
    await cleanupBrowser();
    throw error;
  } finally {
    // Clean up resources in reverse order to prevent orphaned processes
    await page.close().catch((e) => logger.error('Error closing page:', e));
    await context.close().catch((e) => logger.error('Error closing context:', e));

    // Randomly restart the browser after some requests (20% chance)
    logger.info(`Rotating browser to prevent fingerprinting`);
    await cleanupBrowser();
  }
}
