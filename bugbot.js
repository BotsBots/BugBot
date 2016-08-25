/*
 * Bugbot - a bot to help users report issues with software
 *
 * Author: Ian Moore
 */

const request = require('request');
const file = require('fs');
const yaml = require('js-yaml');

/* parses the settings.yml file */
function readSettings() {
  try {
    return yaml.safeLoad(file.readFileSync('./settings.yml', 'utf-8'));
  } catch(exception) {
    console.log(exception);
  }
}

function getRepos(token) {
  let options = {
    url: 'https://api.github.com/user/repos',
    method: 'GET',
    headers: {
      'User-Agent': 'EnableIssues',
      'content-type': 'application/json',
      'Authorization': 'token ' + token
    }
  };

  console.log(options)

  // Send a http request to url and specify a callback that will be called upon its return.
	request(options, (error, response, body) => {
    var obj = JSON.parse(body);
    console.log( obj );

    for( var i = 0; i < obj.length; i++ ) {
		  var name = obj[i].name;
		  console.log( name );
		}
  });
}

let settings = readSettings();
getRepos(settings.token);
