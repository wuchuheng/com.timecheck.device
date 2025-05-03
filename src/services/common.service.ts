import { Response } from 'express';
import { renderUrlToHtml, RenderUrlToHtmlResult } from './htmlRenderService';
import { ProcessStatus, pushStatus, setStatus } from '../app';
import dayjs from 'dayjs';

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
  baseUrl: string,
  status: ProcessStatus
): Promise<ResponseBody<RenderUrlToHtmlResult>> => {
  // 1. Handle input.
  // 1.1 Access the url from the request parameter
  if (!url) {
    return {
      success: false,
      error: 'URL is required',
    };
  }
  // 1.1.1 Check the url is valid
  if (!url.startsWith('http')) {
    return {
      success: false,
      error: 'URL is invalid',
    };
  }

  // 1.2 Check the status is idle
  if (status !== ProcessStatus.IDLE) {
    return {
      success: false,
      error: 'Process is not idle',
    };
  }
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
    const screenshot = baseUrl + '/' + data.screenshot.replace('./', '');

    data.screenshot = screenshot;
    result = {
      success: true,
      data,
    };
  } catch (error) {
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
    const cancel = () => delete statusClientRegister.idMapRes[id];
    return cancel;
  },

  push: (data: StatusType) => {
    const now = dayjs().format('YYYY/MM/DD HH:mm:ss');
    const nowTime = Date.now();
    const timeTaken = ((nowTime - latestReportTime) / 1000).toFixed(2);

    const msg: StatusType = {
      ...data,
      createdAt: now,
      timeTaken: `${timeTaken} s`,
    };
    latestReportTime = nowTime;
    pushStatus(msg);
    Object.values(statusClientRegister.idMapRes).forEach((res) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
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
    Object.values(pingClientRegister.idMapRes).forEach((res) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    });
  },
};

setInterval(() => {
  pingClientRegister.push();
}, 1000);
