import dayjs from 'dayjs';
import { Browser, Page, chromium } from 'playwright';

/**
 * Service for rendering HTML content from URLs using Playwright
 */

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

  // 2.2 Initialize browser and page
  // 2.2.1 Launch Playwright browser with necessary security settings
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // 2.2.2 Create browser context and page
    const context = await browser.newContext();
    const page = await context.newPage();

    // 2.3 Navigate to the URL and wait for content
    // 2.3.1 Navigate to the specified URL
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 50 * 1000 });

    // 2.3.2 Wait for specific content to appear and get HTML
    const html = await getHtmlWhenReady(page);

    // 2.4 Calculate performance metrics
    const endTime = Date.now();
    const timeTaken = (endTime - startTime) / 1000;

    const formattedTime = dayjs(endTime).format('YYYY-MM-DD HH:mm:ss');
    console.log(`[${formattedTime}] Time taken to render ${url} ${timeTaken} seconds`);

    // 2.5 Save the screenshot

    const savePath = `./screenshots/screenshot.png`;
    await page.screenshot({ path: savePath });

    // 3. Output
    // 3.1 Return both the HTML and time taken
    const result: RenderUrlToHtmlResult = {
      html,
      timeTaken,
      screenshot: savePath,
      url,
    };
    return result;
  } catch (error) {
    console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Error rendering ${url}: ${error}`);
    throw error;
  } finally {
    // 2.5 Clean up resources
    await browser?.close();
  }
}
