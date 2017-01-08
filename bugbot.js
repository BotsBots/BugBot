/*
 * Bugbot - a bot to help users report issues with software
 *
 * Author: Ian Moore
 */

const file = require('fs');
const yaml = require('js-yaml');
const winston = require('winston');
const process = require('process');

const github = require('./github.js');
const slack = require('./slack.js');

/* parses a yaml file */
function readYaml(fileName) {
  try {
    return yaml.safeLoad(file.readFileSync(fileName, 'utf-8'));
  } catch(exception) {
    winston.log(exception);
  }
}

function setupLogging() {
  //configure a log file with a max size of 10MB (10^6 * 10 bytes)
  winston.add(winston.transports.File,
    { filename: 'bugbot.log', maxsize: 10000000, maxFiles: 1 });
  winston.level = 'debug';
  winston.log('debug', 'Starting bugbot. Logging enabled');
  process.on('SIGINT', () => {
    winston.log('debug', 'Bugbot recieved SIGINT. Bye!');
    process.exit(1);
  });
  process.on('SIGTERM', () => {
    winston.log('debug', 'Bugbot recieved SIGTERM. Bye!');
    process.exit(1);
  })
}

function main() {
  setupLogging();
  let settings = readYaml('./settings.yml');
  let strings = readYaml('./strings-en.yml');

  /* start the slack RTM */
  slack.start(settings.slack, winston, strings);
}

main();
