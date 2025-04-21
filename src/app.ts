import express from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import asyncHandler from 'express-async-handler';
import { renderUrlToHtml, RenderUrlToHtmlResult } from './services/htmlRenderService';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
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
    statusClientRegister.push({ type: 'status', data: status });

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
      statusClientRegister.push({ type: 'status', data: status });
    }
  })
);

type StatusType = {
  // Data type
  type: 'status' | 'ping';
  data?: ProcessStatus;
  createdAt?: string;
};

let nextResId = 0;
const statusClientRegister = {
  idMapRes: {} as Record<number, Response>,
  register: (res: Response) => {
    const id = nextResId++;
    statusClientRegister.idMapRes[id] = res;
    const cancel = () => delete statusClientRegister.idMapRes[id];
    return cancel;
  },

  push: (data: StatusType) => {
    Object.values(statusClientRegister.idMapRes).forEach((res) => {
      const now = dayjs().format('YYYY/MM/DD HH:mm:ss');
      const msg: StatusType = {
        ...data,
        createdAt: now,
      };
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    });
  },
};

setInterval(() => {
  statusClientRegister.push({ type: 'ping' });
}, 60 * 1000);

app.get(
  '/api/render-url/status',
  asyncHandler(async (req, res) => {
    // 1. Input Processing
    // 1.1 Set up SSE headers for event streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 1.2 Create a client ID for this connection

    // 2.2 Send initial status immediately
    const cancel = statusClientRegister.register(res);

    // 2.4 Handle client disconnection
    req.on('close', cancel);

    statusClientRegister.push({
      type: 'status',
      data: status,
    });
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

app.get('/api/ip', async (req, res) => {
  // 2.1 Get the public IP address with https://ipw.cn/, the response will be like: { success: true, data: { ip: "113.116.96.24" } }
  const publicIpv4 = await fetch('https://4.ipw.cn/').then((res) => res.text());
  res.send({
    success: true,
    data: publicIpv4,
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
