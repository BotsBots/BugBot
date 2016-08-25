/*
 * Bugbot - a bot to help users report issues with software
 *
 * Author: Ian Moore
 */

const https = require('https');
const file = require('fs');
const yaml = require('js-yaml');

/* reads in the github token from a file in the same directory named 'token'
 * eventually will be replaced with a better way to authenticate to github */
function readSettings() {
  try {
    return yaml.safeLoad(file.readFileSync('./settings.yml', 'utf-8'));
  } catch(exception) {
    console.log(exception);
  }
}

let settings = readSettings();
console.log(settings.token);
