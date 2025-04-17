import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import asyncHandler from 'express-async-handler';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript Express!');
});

// Render the url insite the chromumi.
// 1. Handle input
// 1.1 Define API endpoint for URL rendering

app.get(
  '/api/render-url',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    console.log(`Start time: ${startTime}`);
    // 1. Handle input
    // 1.1 Set request timeout to 2 minutes
    req.setTimeout(120000); // 2 minutes in milliseconds

    // 1.2 Access the url from the request parameter named 'url'
    const url = req.query.url as string;

    // 2.2 Render the url.
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // 2.2 Take a screenshot of the url
    const page = await browser.newPage();
    // 2.2.1 Set page timeout to 1 minute
    await page.setDefaultTimeout(60000); // 1 minute in milliseconds
    // 2.2.2 Wait for the page to load
    await page.goto(url, { waitUntil: 'networkidle0' });

    // 2.3 Take a screenshot of the page
    const screenshot = await page.screenshot();

    // 3. Handle output
    // 3.1 Return the screenshot as a response
    res.contentType('image/png').send(screenshot);
    const endTime = Date.now();
    console.log(`End time: ${endTime}`);
    console.log(`Time taken: ${endTime - startTime} milliseconds`);
  })
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
