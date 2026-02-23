export class Logger {
  private module: string;
  constructor(module: string) { this.module = module; }
  info(message: string): void {
    console.log(`\x1b[36m[${new Date().toISOString()}]\x1b[0m \x1b[32m[${this.module}]\x1b[0m ${message}`);
  }
  warn(message: string): void {
    console.log(`\x1b[36m[${new Date().toISOString()}]\x1b[0m \x1b[33m[${this.module}] ⚠ ${message}\x1b[0m`);
  }
  error(message: string): void {
    console.log(`\x1b[36m[${new Date().toISOString()}]\x1b[0m \x1b[31m[${this.module}] ✖ ${message}\x1b[0m`);
  }
  success(message: string): void {
    console.log(`\x1b[36m[${new Date().toISOString()}]\x1b[0m \x1b[32m[${this.module}] ✔ ${message}\x1b[0m`);
  }
  debug(message: string): void {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(`\x1b[36m[${new Date().toISOString()}]\x1b[0m \x1b[90m[${this.module}] ${message}\x1b[0m`);
    }
  }
}
