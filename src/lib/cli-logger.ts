import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { ILogger } from '../core/interfaces.js';

export class CliLogger implements ILogger {
  private spinner: Ora | null = null;

  log(message: string): void {
    console.log(message);
  }

  info(message: string): void {
    console.log(chalk.blue(message));
  }

  success(message: string): void {
    console.log(chalk.green(message));
  }

  warn(message: string): void {
    console.log(chalk.yellow(message));
  }

  error(message: string, error?: any): void {
    console.error(chalk.red(message));
    if (error) {
      console.error(chalk.red(error.stack || error.message || error));
    }
  }

  startSpinner(message: string): void {
    this.spinner = ora(message).start();
  }

  stopSpinner(success: boolean = true, message?: string): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message);
      } else {
        this.spinner.fail(message);
      }
      this.spinner = null;
    }
  }
}
