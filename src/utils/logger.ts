import dayjs from 'dayjs';
import chalk from 'chalk';

/**
 * Log the info message
 * @param args - The message to log
 */
export const info = (...args: unknown[]) => {
  const time = dayjs().format('MM/DD HH:mm:ss');
  const level = chalk.green.bold('[INFO]');
  console.log(`${time} ${level}`, ...args);
};

/**
 * Log the error message
 * @param args - The message to log
 */
export const error = (...args: unknown[]) => {
  const time = dayjs().format('MM/DD HH:mm:ss');
  const level = chalk.red.bold('[ERROR]');
  console.log(`${time} ${level}`, ...args);
};
