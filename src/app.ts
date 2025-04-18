import express from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import asyncHandler from 'express-async-handler';
import { renderUrlToHtml, RenderUrlToHtmlResult } from './services/htmlRenderService';
import path from 'path';
import fs from 'fs';
import os from 'os';
// Load environment variables
dotenv.config();

interface ResponseBody<T> {
  success: boolean;
  data: T;
  error?: Error;
}

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript Express!');
});

enum ProcessStatus {
  PROCESSING = 'processing',
  IDLE = 'idle',
}

export const screenshotDir = path.join(__dirname, '../screenshots');

let status: ProcessStatus = ProcessStatus.IDLE;
app.get(
  '/api/render-url',
  asyncHandler(async (req, res) => {
    // 1. Handle input.
    // 1.1 Access the url from the request parameter
    const url = req.query.url as string;
    if (!url) {
      res.send({
        success: false,
        error: 'URL is required',
      });
      return;
    }
    // 1.1.1 Check the url is valid
    if (!url.startsWith('http')) {
      res.send({
        success: false,
        error: 'URL is invalid',
      });
      return;
    }

    // 1.2 Check the status is idle
    if (status !== ProcessStatus.IDLE) {
      res.send({
        success: false,
        error: 'Process is not idle',
      });
      return;
    }
    status = ProcessStatus.PROCESSING;

    // 2. Handle logic
    // 2.1 Call the service function to render the URL
    try {
      const data = await renderUrlToHtml(url);

      // Convert the screenshot path to the public URL
      const requestUrl = req.hostname;
      const port = req.socket.localPort;
      const protocol = req.protocol;
      const baseUrl = `${protocol}://${requestUrl}:${port === 80 ? '' : port}`;
      const screenshot = baseUrl + '/' + data.screenshot.replace('./', '');

      data.screenshot = screenshot;
      const response: ResponseBody<RenderUrlToHtmlResult> = {
        success: true,
        data,
      };
      res.send(response);
    } catch (error) {
      res.send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      status = ProcessStatus.IDLE;
    }
  })
);

// Allow to access the screenshots folder
app.use('/screenshots', (req, res, next) => {
  const screenshotPath = path.join(screenshotDir, req.path);
  if (fs.existsSync(screenshotPath)) {
    res.sendFile(screenshotPath);
  } else {
    next();
  }
});

app.get('/api/status', (req, res) => {
  res.send({
    success: true,
    data: { status },
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
