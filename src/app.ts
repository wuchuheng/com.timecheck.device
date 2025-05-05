import express from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import asyncHandler from 'express-async-handler';
import path from 'path';
import fs from 'fs';
import {
  pingClientRegister,
  renderUrl,
  statusClientRegister,
  StatusType,
} from './services/common.service';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import dayjs from 'dayjs';
import * as logger from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
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
app.get(
  renderRoute,
  asyncHandler(async (req, res) => {
    const url = req.query.url as string;
    logger.info('Render request', url);
    const startTime = Date.now();
    const requestUrl = req.hostname;
    const port = req.socket.localPort;
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${requestUrl}:${port === 80 ? '' : port}`;
    const resBody = await renderUrl(url, baseUrl, status);
    const takeTime = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Finished render(${takeTime} s): `, url);
    res.send(resBody);
  })
);

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

// 3. Get the public IP address
const ipRoute = '/api/ip';
app.get(ipRoute, async (req, res) => {
  // 2.1 Get the public IP address with https://ipw.cn/, the response will be like: { success: true, data: { ip: "113.116.96.24" } }
  const publicIpv4 = await fetch('https://4.ipw.cn/').then((res) => res.text());
  res.send({
    success: true,
    data: publicIpv4,
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer);

let globalSocket: Socket | undefined;
io.on('connection', (socket) => {
  // 1.1 Handle the render request
  globalSocket = socket;
  socket.on(renderRoute, async (url: string) => {
    // socket protocol

    const protocol = socket.handshake.headers.protocol || 'http';
    const baseUrl = `${protocol}://${socket.handshake.headers.host || ''}`;
    const resBody = await renderUrl(url, baseUrl, status);
    socket.emit(renderRoute, resBody);
  });

  // 2. Access the public IP address
  socket.on(ipRoute, async () => {
    console.log('ipRoute');
    const publicIpv4 = await fetch('https://4.ipw.cn/').then((res) => res.text());
    socket.emit(ipRoute, publicIpv4);
  });

  // 3. Get the status of the render
  socket.on(statusRoute, () => {
    console.log('statusRoute');
    statusClientRegister.push({
      type: 'status',
      data: status,
    });
  });
});

export const pushStatus = (msg: StatusType) => {
  globalSocket?.emit(statusRoute, msg);
};

httpServer.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
