import { Response } from 'express';
import { renderUrlToHtml, RenderUrlToHtmlResult } from './htmlRenderService';
import { getStatus, ProcessStatus, setStatus } from '../app';
import dayjs from 'dayjs';
import * as logger from '../utils/logger';

interface ResponseBody<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Render the url to html
 * @param url - The url to render
 * @param req - The request object
 * @param status - The status of the process
 * @returns The response body
 */
export const renderUrl = async (
  url: string,
  status: ProcessStatus
): Promise<ResponseBody<RenderUrlToHtmlResult>> => {
  // 1. Handle input.
  // 1.1 Access the url from the request parameter
  status = ProcessStatus.PROCESSING;
  setStatus(status);
  statusClientRegister.push({ type: 'status', data: status });

  // 2. Handle logic
  // 2.1 Call the service function to render the URL
  let result: ResponseBody<RenderUrlToHtmlResult> = {
    success: false,
    error: 'Unknown error',
  };

  try {
    const data = await renderUrlToHtml(url);

    // Convert the screenshot path to the public URL
    const screenshot = data.screenshot;

    data.screenshot = `/${screenshot}`;
    result = {
      success: true,
      data,
    };
  } catch (error) {
    logger.error(
      `Error rendering URL ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    result = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  status = ProcessStatus.IDLE;
  setStatus(status);
  statusClientRegister.push({ type: 'status', data: status });

  return result;
};

export type StatusType = {
  // Data type
  type: 'status' | 'ping';
  data?: ProcessStatus;
  createdAt?: string;
  timeTaken?: string;
};
let nextResId = 0;

let latestReportTime: number = Date.now();
export const statusClientRegister = {
  idMapRes: {} as Record<number, Response>,
  register: (res: Response) => {
    const id = nextResId++;
    statusClientRegister.idMapRes[id] = res;
    const cancel = () => {
      const idMapRes = statusClientRegister.idMapRes;
      delete idMapRes[id];
    };
    return cancel;
  },

  push: (data: StatusType) => {
    const nowTime = new Date();
    const now = dayjs(nowTime).format('YYYY/MM/DD HH:mm:ss');
    const timeTaken = ((nowTime.getTime() - latestReportTime) / 1000).toFixed(2);

    const msg: StatusType = {
      ...data,
      createdAt: now,
      timeTaken: `${timeTaken} s`,
    };
    latestReportTime = nowTime.getTime();
    Object.values(statusClientRegister.idMapRes).forEach((res) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
      if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
        (res as Response & { flush?: () => void }).flush!();
      }
    });

    // Push the status to the socket
  },
};

/**
 * Ping the client
 */
export const pingClientRegister = {
  nextId: 0,
  idMapRes: {} as Record<number, Response>,
  register: (res: Response) => {
    const id = pingClientRegister.nextId++;
    pingClientRegister.idMapRes[id] = res;
    const cancel = () => delete pingClientRegister.idMapRes[id];
    return cancel;
  },

  push: () => {
    // 2.1 Push the ping message to the client via SSE.
    const now = dayjs().format('YYYY/MM/DD HH:mm:ss');
    const msg: StatusType = {
      type: 'ping',
      createdAt: now,
    };
    Object.values(pingClientRegister.idMapRes).forEach((res: Response) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
      if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
        (res as Response & { flush?: () => void }).flush!();
      }
    });
  },
};

setInterval(() => statusClientRegister.push({ type: 'status', data: getStatus() }), 1000);
