import dayjs from 'dayjs';
import { Browser, Page, chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

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
    ],
  });
}

// Get or create browser
export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await createBrowser();
    console.log(`Browser launched at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
  }
  return browser;
}

// Safe cleanup function
export async function cleanupBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
      console.error('Error closing browser:', e);
    } finally {
      browser = null;
    }
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  await cleanupBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanupBrowser();
  process.exit(0);
});

// Ensure screenshots directory exists
const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
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
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // Load URL with timeout
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Rendering: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50 * 1000 });

    // Get HTML content
    const html = await getHtmlWhenReady(page);

    // Save screenshot with unique name
    const timestamp = Date.now();
    const savePath = `screenshots/screenshot-${timestamp}.png`;
    await page.screenshot({ path: savePath });

    // Calculate performance metrics
    const endTime = Date.now();
    const timeTaken = (endTime - startTime) / 1000;
    console.log(
      `[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Finished render ${url} in ${timeTaken} seconds`
    );

    // Build result
    const result: RenderUrlToHtmlResult = {
      html,
      timeTaken,
      screenshot: savePath,
      url,
    };

    return result;
  } catch (error) {
    console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Error rendering ${url}:`, error);
    throw error;
  } finally {
    // Clean up resources in reverse order to prevent orphaned processes
    await page.close().catch((e) => console.error('Error closing page:', e));
    await context.close().catch((e) => console.error('Error closing context:', e));

    // For long-running process health, occasionally restart the browser
    if (Math.random() < 0.05) {
      // ~5% chance to refresh browser
      await cleanupBrowser();
    }
  }
}
