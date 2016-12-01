/*
 * Github API integrations for bugbot
 *
 * Author: Ian Moore
 */

const request = require('request');

/**
 * Returns information on each of the users repositories
 */
exports.getUserRepos = (token, callback) => {
  let options = {
    url: 'https://api.github.com/user/repos',
    method: 'GET',
    headers: {
      'User-Agent': 'EnableIssues',
      'content-type': 'application/json',
      'Authorization': 'token ' + token
    }
  };

  // Send a http request to url and specify a callback that will be called upon its return.
	request(options, (error, response, body) => {
     callback(JSON.parse(body));
  });
}

/**
 * Returns details of the currently authenticated user
 */
exports.getAuthUser = (token, callback) => {
  let options = {
    url: 'https://api.github.com/user',
    method: 'GET',
    headers: {
      'User-Agent': 'EnableIssues',
      'content-type': 'application/json',
      'Authorization': 'token ' + token
    }
  };

  // Send a http request to url and specify a callback that will be called upon its return.
	request(options, (error, response, body) => {
    if (response)
      callback(JSON.parse(body));
  });
}

/**
 * List all issues on a given project
 */
exports.getIssues = (token, owner, repo, callback) => {
  let options = {
    url: 'https://api.github.com/repos/' + owner + '/' + repo + '/issues',
    method: 'GET',
    headers: {
      'User-Agent': 'EnableIssues',
      'content-type': 'application/json',
      'Authorization': 'token ' + token
    }
  };

  request(options, (error, response, body) => {
    callback(JSON.parse(body));
  });

}

/**
 * Create an issue on a project
 */
exports.createIssue = (token, owner, repo, title, body, labels, callback) => {
  let options = {
    url: 'https://api.github.com/repos/' + owner + '/' + repo + '/issues',
    method: 'POST',
    headers: {
      'User-Agent': 'EnableIssues',
      'content-type': 'application/json',
      'Authorization': 'token ' + token
    },
    json: true,
    body: {
      'title': title,
      'body': body
    },
    labels: labels
  };

  request(options, (error, response, body) => {
    callback(body);
  });
}
