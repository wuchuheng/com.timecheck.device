import dayjs from 'dayjs';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

const getLogDir = (): string => {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
};

const writeLog = (type: 'info' | 'error' | 'warn', message: string) => {
  let logDir = getLogDir();
  logDir = path.join(logDir, dayjs().format('YYYY-MM-DD'));
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, `${type}.log`);
  const logContent = `${message} \n`;
  fs.appendFileSync(logFile, logContent);
};

const typeInColor = (type: 'info' | 'error' | 'warn') => {
  switch (type) {
    case 'info':
      return chalk.green.bold('[INFO]');
    case 'error':
      return chalk.red.bold('[ERROR]');
    case 'warn':
      return chalk.yellow.bold('[WARN]');
  }
};

/**
 * Log the info message
 * @param args - The message to log
 */
export const info = (...args: unknown[]) => {
  const time = dayjs().format('MM/DD HH:mm:ss');
  console.log(`${time} ${typeInColor('info')}`, ...args);
  writeLog('info', `${time} [${'info'}] ${args.join(' ')}`);
};

/**
 * Log the error message
 * @param args - The message to log
 */
export const error = (...args: unknown[]) => {
  const time = dayjs().format('MM/DD HH:mm:ss');
  console.log(`${time} ${typeInColor('error')}`, ...args);
  writeLog('error', `${time} [${'error'}] ${args.join(' ')}`);
};

/**
 * Log the info message
 * @param args - The message to log
 */
export const warn = (...args: unknown[]) => {
  const time = dayjs().format('MM/DD HH:mm:ss');
  console.log(`${time} ${typeInColor('warn')}`, ...args);
  writeLog('warn', `${time} [${'warn'}] ${args.join(' ')}`);
};
