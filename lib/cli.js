#!/usr/bin/env node

process.title = 'sinopia-helper';

const program = require('commander');

const config = require('./config').getDefaultConfig();
const sinopiaHelper = require('./helper');

program
  .command('scan-folder <source> [destination]')
  .description("Scan a 'node_modules' folder and add children packages to sinopia. <source> is a 'node_modules' folder. By default 'destination' will be verdaccio or sinopia's storage folder.")
  .action((source, dest = config.storageFolder) => {
    if (dest === undefined) {
      console.error('No destination folder given!');
      process.exit(1);
    }

    console.log('Using %s folder as destination.', source);
    console.log('Scanning %s folder...', source);
    sinopiaHelper.scan(source, dest);
  });

program
  .command('reset [storage-folder]')
  .option('-url', 'Sinopia or verdaccio repo url, e.g. http://localhost:4873. By default it will use http://localhost:4873')
  .description("Reset the package.json files in a verdaccio or sinopia's storage folder, leaving only urls of cached packages. This avoids fetching errors while working offline.")
  .action((storageFolder = config.storageFolder, command) => {
    let url = 'http://localhost:4873/';
    if (command.url) {
      let matches = command.url.match(/https?:\/\/[\w\.\-]+(:\d+)?/gi);
      if (matches.length === 0) {
        console.error('Bad repository URL given!');
        process.exit(1);
      }
    }
    if (!url.endsWith('/')) {
      url += '/';
    }
    if (storageFolder === undefined) {
      console.error('No storage folder given!');
      process.exit(1);
    }

    console.log('Reseting package.json files in %s folder.', storageFolder);
    sinopiaHelper.reset(storageFolder, url);
  });

program
  .version('1.0.0')
  .parse(process.argv);