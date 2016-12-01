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

/* parses the settings.yml file */
function readSettings() {
  try {
    return yaml.safeLoad(file.readFileSync('./settings.yml', 'utf-8'));
  } catch(exception) {
    winston.log(exception);
  }
}

function setupLogging() {
  winston.add(winston.transports.File, { filename: 'bugbot.log' });
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
  let settings = readSettings();

  /* start the slack RTM */
  slack.start(settings.slack.token, settings.slack.webhook);
}

main();
