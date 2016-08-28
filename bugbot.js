/*
 * Bugbot - a bot to help users report issues with software
 *
 * Author: Ian Moore
 */

const file = require('fs');
const yaml = require('js-yaml');

const github = require('./github.js');

/* parses the settings.yml file */
function readSettings() {
  try {
    return yaml.safeLoad(file.readFileSync('./settings.yml', 'utf-8'));
  } catch(exception) {
    console.log(exception);
  }
}

function main() {
  let settings = readSettings();

  github.getIssues(settings.token, 'BotsBots', 'BugBot', (issues) => {
    console.log(issues);
  });

  /*createIssue(settings.token, 'BotsBots', 'BugBot', 'test issue',
    'this issue created by bugbot through the github API');*/
}
