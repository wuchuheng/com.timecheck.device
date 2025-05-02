import { Request } from 'express';
import { renderUrlToHtml, RenderUrlToHtmlResult } from './htmlRenderService';
import { ProcessStatus, statusClientRegister } from '../app';

interface ResponseBody<T> {
  success: boolean;
  data?: T;
  error?: string;
}
export const renderUrl = async (
  url: string,
  req: Request,
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
    return response;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    status = ProcessStatus.IDLE;
    statusClientRegister.push({ type: 'status', data: status });
  }
};
