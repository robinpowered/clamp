#!/usr/bin/env node

'use strict';

const fs = require('fs-extra');
const path = require('path');
const md5 = require('md5');
const chokidar = require('chokidar');
const chalk = require('chalk');
const program = require('commander');
const ClaspShell = require('./clasp-shell');

const Clasp = new ClaspShell();

program.version('1.0.0')
  .usage('[command]')

program.command('push')
  .description('push all files to scripts.google.com repository')
  .option('-w, --watch', 'Watch for any file changes and push all updates')
  .action(cmd => {
    if (cmd.watch) {
      const dir = process.cwd();
      console.log(chalk`{gray ⎋  watching {bold ${dir.split(path.sep).pop()}} for changes}`);
      const watcher = chokidar.watch(dir, {
        ignored: /(^|[\/\\])\../,
        persistent: true
      });
      const log = console.log.bind(console);
      watcher.on('change', path => {
        fs.readFile(path, 'utf-8').then(contents => {
          const checksum = md5(contents);
          if (Clasp.getCache(path) !== checksum) {
            if (!Clasp.running) {
              const relativePath = path.replace(process.cwd(), '');
              console.log(chalk`{gray changes from {white {bold ${relativePath}}}}`);
              Clasp.setCache(path, checksum);
            }
            Clasp.push();
          }
        })
      })
    } else {
      Clasp.push();
    }
  });

program.command('pull')
  .description('replace all local files with files from scripts.google.com repository')
  .action(() => {
    Clasp.pull();
  });

program.command('*')
  .description('all other available `clasp` commands')
  .action(cmd => {
    Clasp.run(cmd)
  });

program.parse(process.argv);

// Set default command to --help
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log('');
  process.exit(0);
}
