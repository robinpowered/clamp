'use strict';

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const spinners = require('cli-spinners');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

class ClaspShell {
  constructor() {
    this.running = false;
    this.cache = new Map();
  }

  getSpinner(text) {
    return ora({
      text: chalk`{gray ${text}}`,
      spinner: spinners.dots12,
      spinner: {
        frames: ['◜', '◝', '◟', '◞',]
      },
      color: 'gray',
      interval: 40
    });
  }

  getCache(file) {
    return this.cache.get(file);
  }

  setCache(file, checksum) {
    return this.cache.set(file, checksum);
  }

  async handleAndReportSyntaxError(file, line, cmd) {
    // We assume a `.js` extention on local files, no `.gs`
    file = file + '.js';
    line = parseInt(line, 10);
    const filepath = path.join(process.cwd(), file);

    const fileString = await fs.readFile(filepath, 'utf-8')

    const lines = fileString.split('\n');
    const topIndex = line - 3;
    const aboveIndex = line - 2;
    const currentIndex = line - 1;
    const belowIndex = line;
    const bottomIndex = line + 1;
    const numberWidth = (belowIndex + 1).toString().length;

    const output = [
      '',
      chalk`   {gray ${this.formatLine(lines[topIndex], topIndex + 1, numberWidth)}}`,
      chalk`   {gray ${this.formatLine(lines[aboveIndex], aboveIndex + 1, numberWidth)}}`,
      chalk` {red {bold >}} ${this.formatLine(lines[currentIndex], currentIndex + 1, numberWidth)}`,
      chalk`   {gray ${this.formatLine(lines[belowIndex], belowIndex + 1, numberWidth)}}`,
      chalk`   {gray ${this.formatLine(lines[bottomIndex], bottomIndex + 1, numberWidth)}}`,
    ].join('\n');

    console.log(chalk`{red ✕ ${cmd} failed because of {bold syntax error}}\n${output}\n`);
  }

  formatLine(line, number, padSize) {
    if (line === undefined) {
      return `${'*'.padStart(padSize)} |`;
    }
    return `${number.toString().padStart(padSize)} | ${line}`;
  }

  flush() {
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
    } else {
      const readline = require('readline');
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0, null);
    }
  }


  push() {
    if (this.running) return;
    this.running = true;
    const spinner = this.getSpinner('pushing...');
    spinner.start();
    exec('clasp push')
      .then(({ stdout }) => {
        this.flush();
        spinner.stop();

        const lines = stdout.split('\n');
        let fileCount = null;

        const output = lines.reduce((acc, line) => {
          if (line.indexOf('└─') > -1) {
            let newLine = line.replace('└─', chalk`{green ↻}`);
            acc.push(chalk`{gray ${newLine}}`);
          } else {
            const re = line.match(/(\d+) file/gi);
            fileCount = re ? parseInt(re[0]) : fileCount;
          }
          return acc;
        }, []).join('\n');

        console.log(chalk`{green ✓ pushed {bold ${fileCount}} files}\n${output}\n`);
        this.running = false;
      })
      .catch(({ stderr }) => {
        this.flush();
        spinner.stop();

        const lines = stderr.split('\n');
        const output = lines.reduce((result, line) => {
          if (line.toLowerCase().indexOf('syntax error') > -1) {
            try {
              const findLineNumber = /line: (\d+)/gi;
              const findFileName = /file: ([\w\/\\]+)/gi;
              const reLineNumber = findLineNumber.exec(line);
              const reFileName = findFileName.exec(line);
              this.handleAndReportSyntaxError(reFileName[1], reLineNumber[1], 'push');
              return false;
            } catch (e) {
              return chalk`{gray ${e}}`;
            }
          }
          return result;
        }, '');

        if (output) {
          console.log(chalk`{red ✕ push failed}\n${output}`);
        }
        this.running = false;
      });
  }

  pull() {
    if (this.running) return;
    this.running = true;
    const spinner = this.getSpinner('pulling...');
    spinner.start();
    exec('clasp pull')
      .then(({ stdout }) => {
        this.flush();
        spinner.stop();

        const lines = stdout.split('\n');
        let fileCount = null;

        let output = lines.reduce((acc, line) => {
          if (line.indexOf('└─') > -1) {
            let newLine = line.replace('└─', chalk`{yellow ↺}`);
            acc.push(chalk`{gray ${newLine}}`);
          } else {
            const re = line.match(/(\d+) file/gi);
            fileCount = re ? parseInt(re[0]) : fileCount;
          }
          return acc;
        }, []).join('\n');

        console.log(chalk`{green ✓ pulled {bold ${fileCount}} files}\n${output}\n`);
        this.running = false;
      })
      .catch(({ stderr }) => {
        this.flush();
        spinner.stop();

        const lines = stderr.split('\n');
        const output = lines.reduce((result, line) => {
          if (line.toLowerCase().indexOf('syntax error') > -1) {
            try {
              const findLineNumber = /line: (\d+)/gi;
              const findFileName = /file: ([\w\/\\]+)/gi;
              const reLineNumber = findLineNumber.exec(line);
              const reFileName = findFileName.exec(line);
              this.handleAndReportSyntaxError(reFileName[1], reLineNumber[1], 'pull');
              return false;
            } catch (e) {
              return chalk`{gray ${e}}`;
            }
          }
          return result;
        }, '');

        if (output) {
          console.log(chalk`{red ✕ pull failed\n${err}}`);
        }
        this.running = false;
      });
  }

  run(cmd) {
    if (this.running) return;
    this.running = true;
    const spinner = this.getSpinner(`running "${cmd}"...`);
    spinner.start();
    exec(`clasp ${cmd}`)
      .then(({ stdout }) => {
        this.flush();
        spinner.stop();
        console.log(chalk`{green ✓ ${cmd}}\n${stdout}`);
        this.running = false;
      })
      .catch(err => {
        this.flush();
        spinner.stop();
        console.log(chalk`{red ✕ failed when running {bold ${cmd}}}\n\n${err}`);
        this.running = false;
      });
  }
}

module.exports = ClaspShell;
