import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import asyncHandler from 'express-async-handler';
import path from 'path';
import fs from 'fs';
import { pingClientRegister, renderUrl, statusClientRegister } from './services/common.service';
import { createServer } from 'http';
import * as logger from './utils/logger';
import axios from 'axios';
import compression from 'compression';
import { cleanupBrowser } from './services/htmlRenderService';
import chalk from 'chalk';
import { exec } from 'child_process';

// Load environment variables
dotenv.config();

const app = express();
app.use(compression());
const port = process.env.PORT || 3000;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript Express!');
});

export enum ProcessStatus {
  PROCESSING = 'processing',
  IDLE = 'idle',
}

export const screenshotDir = path.join(__dirname, '../screenshots');

let status: ProcessStatus = ProcessStatus.IDLE;
export const setStatus = (newStatus: ProcessStatus) => {
  status = newStatus;
};
export const getStatus = () => status;

/**
 * 1.1 Render the url to html
 */
const renderRoute = '/api/render-url';
app.get(renderRoute, (req, res) => {
  const url = req.query.url as string;
  logger.info('Render request', url);
  if (!url) {
    res.send({
      success: false,
      error: 'URL is required',
    });
    logger.error('URL is required', url);
    return;
  }
  // 1.1.1 Check the url is valid
  if (!url.startsWith('http')) {
    res.send({
      success: false,
      error: 'URL is invalid',
    });
    logger.error('URL is invalid', url);
    return;
  }

  // 1.2 Check the status is idle
  if (status !== ProcessStatus.IDLE) {
    res.send({
      success: false,
      error: 'Process is not idle',
    });
    logger.error('Process is not idle', status);
    return;
  }

  const startTime = Date.now();
  renderUrl(url, status)
    .then((resBody) => {
      const takeTime = ((Date.now() - startTime) / 1000).toFixed(2);

      logger.info(`Finished render(${chalk.green.bold(takeTime)} s): `, url);
      res.send(resBody);

      // 2.2 If the timeTaken is less than 0.5s, then restart the process
      if (Number(takeTime) < 0.9) {
        logger.error(
          `${url} render time is ${takeTime}s, that is not normal, restart the process ...`
        );
        exec('pm2 restart timecheck-device');
      }
    })
    .catch((error) => {
      logger.error('Failed to render url', error);
      res.send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    })
    .finally(() => {
      setStatus(ProcessStatus.IDLE);
    });
});

/**
 * 1.2 Ping the server
 */
const pingRoute = '/api/ping';
app.get(pingRoute, async (req, res) => {
  // 1. Input Processing
  // 1.1 Set up SSE headers for event streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 1.2 Create a client ID for this connection

  // 2.2 Send initial status immediately

  const cancel = pingClientRegister.register(res);

  // 2.4 Handle client disconnection
  req.on('close', cancel);

  pingClientRegister.push();
});

// 2. Get the status of the render
const statusRoute = '/api/render-url/status';
app.get(
  statusRoute,
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

app.use('/screenshots', (req, res, next) => {
  const screenshotPath = path.join(screenshotDir, req.path);
  if (fs.existsSync(screenshotPath)) {
    res.sendFile(screenshotPath);
  } else {
    next();
  }
});

app.get(
  '/api/restart-app',
  asyncHandler(async (req, res) => {
    logger.warn('Restarting app ...');
    res.send({ success: true, message: 'App restarting ...' });

    exec('pm2 restart timecheck-device', (error) => {
      if (error) {
        logger.error('Failed to restart app', error);
      } else {
        logger.info('App restarted successfully');
      }
    });
  })
);

// 3. Get the public IP address
const ipRoute = '/api/ip';
let latestIp: string = '';
let latestUpdatedAt = Date.now();
app.get(
  ipRoute,
  asyncHandler(async (req, res) => {
    // 2.1 Get the public IP address with https://ipw.cn/, the response will be like: { success: true, data: { ip: "113.116.96.24" } }
    if (latestUpdatedAt + 60 * 1000 < Date.now() && latestIp !== '') {
      logger.info('Use cached ip', latestIp);
      latestUpdatedAt = Date.now();
      res.send({
        success: true,
        data: latestIp,
      });
      return;
    }

    axios
      .get('https://4.ipw.cn/', {
        timeout: 60 * 1000,
      })
      .then((ipRes) => {
        const publicIpv4 = ipRes.data;
        latestIp = publicIpv4;
        latestUpdatedAt = Date.now();
        logger.info('Get public ip', publicIpv4);
        res.send({
          success: true,
          data: publicIpv4,
        });
      })
      .catch((error) => {
        logger.error('Failed to get public ip', error);
        res.send({
          success: false,
          data: 'Failed to get public ip',
        });
      });
  })
);

// Add browser cleanup endpoint
app.get(
  '/api/restart-browser',
  asyncHandler(async (req, res) => {
    try {
      await cleanupBrowser();
      res.send({ success: true, message: 'Browser restarted successfully' });
    } catch (_) {
      res.status(500).send({ success: false, message: 'Failed to restart browser' });
    }
  })
);

// Add health check endpoint
app.get('/api/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = Math.round(memoryUsage.rss / 1024 / 1024);

  res.send({
    status: 'ok',
    memory: `${memoryUsageMB}MB`,
    uptime: process.uptime(),
  });
});

const httpServer = createServer(app);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Global error handler', err);
  res.status(500).send({
    success: false,
    data: 'Internal Server Error',
  });
});

httpServer.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});
