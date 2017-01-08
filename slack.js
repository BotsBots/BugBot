/*
 * Slack Integration for BugBot
 *
 * Author: Ian Moore
 */
let Botkit = require('botkit');
let github = require('./github.js');
let database = require('./database.js');

let winston = null; //will be set by start function
let strings = null;


exports.start = (settings, logger, stringsObject) => {
  let controller = Botkit.slackbot({
    debug: false,
  });

  winston = logger;
  strings = stringsObject;

  // connect the bot to a stream of messages
  controller.spawn({
    'token': settings.token
  }).startRTM();

  controller.hears('help', ['direct_message'], (bot, message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      bot.reply(message, strings.help.help);
      if (authorized)
        bot.reply(message, strings.help.authorized);
      else
        bot.reply(message, strings.help.notAuthorized);
    });
    winston.log('debug', 'Help called by: ' + message.user);
  });

  /**
   * Allows the user to authorize their github
   */
  controller.hears('authorize', ['direct_message'], (bot, message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (authorized)
        bot.reply(message, strings.errors.alreadyAuthorized);
      else
        authorizeUser(bot, message);
    });
    winston.log('debug', 'Authorize called by: ' + message.user);
  });

  /**
   * Prevent user from trying to authorize from a public chat
   */
  controller.hears('authorize', ['mention', 'direct_mention'], (bot,message) => {
    bot.reply(message, strings.errors.notPrivate);
  });


  /**
   * Executes when the controller hears the message new_issue
   */
  controller.hears(['new issue', 'issue'],['direct_message', 'direct_mention'], (bot,message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (err)
        bot.reply(message, strings.errors.dbError);
      else if (!authorized)
        bot.reply(message, strings.errors.notAuthorized);
      else
        database.getUser(message.user, (err, token, githubUser) => {
          createIssue(bot, message, token);
        });
    });
    winston.log('debug', 'New issue called by: ' + message.user);
  });

  controller.hears(['report', 'report bug'], ['direct_message', 'direct_mention'], (bot, message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (err)
        bot.reply(message, strings.errors.dbError);
      else if (!authorized)
        bot.reply(message, strings.errors.notAuthorized);
      else
        database.getUser(message.user, (err, token, githubUser) => {
          reportIssue(bot, message, token);
        });
    });
    winston.log('debug', 'Report called by: ' + message.user);
  });

  controller.hears(['new feature', 'feature'], ['direct_message', 'direct_mention'], (bot, message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (err)
        bot.reply(message, strings.errors.dbError);
      else if (!authorized)
        bot.reply(message, strings.errors.notAuthorized);
      else
        database.getUser(message.user, (err, token, githubUser) => {
          newFeature(bot, message, token);
        });
    });
    winston.log('debug', 'New feature called by: ' + message.user);
  });

  controller.hears(['revoke', 'revoke access'], ['direct_message'], (bot,message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (err)
        bot.reply(message, strings.errors.dbError);
      else if (!authorized)
        bot.reply(message, strings.errors.notAuthorized);
      else
        revokeAccess(bot, message);
    });
    winston.log('debug', 'Revoke called by: ' + message.user);
  });

  controller.hears(['show log'], ['direct_message'], (bot,message) => {
    readLog(bot,message);
  });

}

/**
 * A helper function for canceling the current action
 * the callback is what gets called if the user does not confirm the cancellation
 */
function cancelAction(bot, convo, callback) {
  convo.ask(strings.cancel.cancelAction, [
    { pattern: bot.utterances.yes, callback: (response, convo) => {
      convo.say(strings.cancel.corfirm);
      convo.next();
    }},
    { pattern: bot.utterances.no, callback: (response, convo) => {
      callback(null, convo);
      convo.next();
    }}
  ]);
}

/**
 * Conversation to open issue on github
 */
function createIssue(bot,message,token) {
  let issue = {};

  let askProject = function(err, convo) {
    convo.ask(strings.createIssue.askProject, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.specifyProject);
        askProject(null, convo);
        convo.next();
      } else if (response.text.indexOf('/') == -1 || response.text.split('/').length != 2) {
        convo.say(strings.createIssue.projectFormat);
        askProject(null, convo);
        convo.next();
      } else {
        //set the fields
        issue.owner = response.text.split('/')[0];
        issue.repo = response.text.split('/')[1];

        //call the next function
        askTitle(response, convo);
        convo.next();
      }
    });
  }

  let askTitle = function(prevResponse, convo) {
    convo.ask(strings.createIssue.askTitle, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askTitle);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.requireTitle);
        askTitle(response, convo);
        convo.next();
      } else if (response.text.length > 80) {
        convo.say(strings.createIssue.titleTooLong);
        askTitle(response, convo);
        convo.next();
      } else {
        issue.title = response.text;
        askDescription(response, convo);
        convo.next();
      }
    });
  }

  let askDescription = function(prevResponse, convo) {
    convo.ask(strings.createIssue.askDescription, askCallback);

    function askCallback(response, convo) {
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askDescription);
        convo.next();
      } else {
        issue.body = response.text;

        github.createIssue(token, issue.owner, issue.repo,
          issue.title, issue.body, [], githubCallback);
      }
    }

    function githubCallback(response) {
      convo.next();
      if (response.message == 'Not Found')
        convo.say(strings.createIssue.invalidProject + issue.owner + '/' + issue.repo);
      else {
        //convert from the API url to the clickable url
        issueUrl = 'https://github.com/' + response.url.split('repos/')[1];
        convo.say(strings.createIssue.issueAvailable + issueUrl);
      }
    }

  }

  bot.startConversation(message, askProject);
}

/**
 * This function walks the user through reporting an issue
 * by asking specific questions.
 */
function reportIssue(bot, message, token) {
  bot.startConversation(message, askProject);

  let issue = {};
  function askProject(err, convo) {
    convo.ask(strings.createIssue.askProject, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.specifyProject);
        askProject(null, convo);
        convo.next();
      } else if (response.text.indexOf('/') == -1 || response.text.split('/').length != 2) {
        convo.say(strings.createIssue.projectFormat);
        askProject(null, convo);
        convo.next();
      } else {
        //set the fields
        issue.owner = response.text.split('/')[0];
        issue.repo = response.text.split('/')[1];

        //call the next function
        askTitle(response, convo);
        convo.next();
      }
    });
  }

  let askTitle = function(prevResponse, convo) {
    convo.ask(strings.createIssue.askTitle, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askTitle);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.requireTitle);
        askTitle(response, convo);
        convo.next();
      } else if (response.text.length > 80) {
        convo.say(strings.createIssue.titleTooLong);
        askTitle(response, convo);
        convo.next();
      } else {
        issue.title = response.text;
        askReproduce(response, convo);
        convo.next();
      }
    });
  }

  let askReproduce = function(prevResponse, convo) {
    convo.ask(strings.createIssue.askReproduce, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.required);
        askReproduce(null, convo);
        convo.next();
      } else {
        issue.reproduce = response.text;
        askCrash(response, convo);
        convo.next();
      }
    });
  }

  let askCrash = function(prevResponse, convo) {
    convo.ask(strings.createIssue.askReproduce, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.required);
        askCrash(null, convo);
        convo.next();
      } else {
        issue.crash = response.text;
        askVersion(response, convo);
        convo.next();
      }
    });
  }

  let askVersion = function(prevResponse, convo) {
    convo.ask(strings.createIssue.askVersion, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else {
        issue.version = response.text;
        askOS(response, convo);
        convo.next();
      }
    });
  }

  let askOS = function(prevResponse, convo) {
    convo.ask(strings.createIssue.askOS, askCallback);

    function askCallback(response, callback) {
      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else { //TODO potentially limit the OS to known OSes.
        issue.os = response.text;
        //compile the issue report
        issue.body = `#### crash report\n${issue.crash}\n#### how to reproduce\n${issue.reproduce}\n` +
        `version: ${issue.version}\noperating system: ${issue.os}`;

        //now we upload the issue to github
        github.createIssue(token, issue.owner, issue.repo,
          issue.title, issue.body, ['bug'], githubCallback);
      }
    }

    function githubCallback(response) {
      convo.next();
      if (response.message == 'Not Found')
        convo.say(strings.createIssue.invalidProject + issue.owner + '/' + issue.repo);
      else {
        //convert from the API url to the clickable url
        issueUrl = 'https://github.com/' + response.url.split('repos/')[1];
        convo.say(strings.createIssue.issueAvailable + issueUrl);
      }
    }
  }
}

/**
 * This function walks the user through creating a feature
 * by asking specific questions.
 */
function newFeature(bot, message, token) {
  bot.startConversation(message, askProject);

  let issue = {};
  function askProject(err, convo) {
    convo.ask(strings.createIssue.askProject, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.specifyProject);
        askProject(null, convo);
        convo.next();
      } else if (response.text.indexOf('/') == -1 || response.text.split('/').length != 2) {
        convo.say(strings.createIssue.projectFormat);
        askProject(null, convo);
        convo.next();
      } else {
        //set the fields
        issue.owner = response.text.split('/')[0];
        issue.repo = response.text.split('/')[1];

        //call the next function
        askTitle(response, convo);
        convo.next();
      }
    });
  }

  function askTitle(prevResponse, convo) {
    convo.ask(strings.createFeature.askTitle, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askTitle);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.requireTitle);
        askTitle(response, convo);
        convo.next();
      } else if (response.text.length > 80) {
        convo.say(strings.createIssue.titleTooLong);
        askTitle(response, convo);
        convo.next();
      } else {
        issue.title = response.text;
        askDescription(response, convo);
        convo.next();
      }
    });
  }

  function askDescription(prevResponse, convo) {
    convo.ask(strings.createFeature.askDescription, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say(strings.createIssue.required);
        askDescription(null, convo);
        convo.next();
      } else {
        issue.description = response.text;
        askRelease(response, convo);
        convo.next();
      }
    });
  }

  function askRelease(prevResponse, convo) {
    convo.ask(strings.createFeature.askRelease, (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else {
        issue.release = response.text;
        askPriority(response, convo);
        convo.next();
      }
    });
  }

  function askPriority(prevResponse, convo) {
    convo.ask(strings.createFeature.askPriority, askCallback);

    function askCallback(response, covnvo) {
      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else {
        issue.priority = response.text;
        //compile the issue report
        issue.body = `${issue.description}\n` +
        `target completion: ${issue.release}\npriority: ${issue.priority}`;

        //now we upload the issue to github
        github.createIssue(token, issue.owner, issue.repo,
          issue.title, issue.body, [issue.priority, issue.release, 'enhancement'],
          githubCallback);
      }
    }

    function githubCallback(response) {
      console.log("called with response: " + response);
      convo.next();
      if (response.message == 'Not Found')
        convo.say(strings.createIssue.invalidProject + issue.owner + '/' + issue.repo);
      else {
        //convert from the API url to the clickable url
        issueUrl = 'https://github.com/' + response.url.split('repos/')[1];
        convo.say(strings.createFeature.featureAvailable + issueUrl);
      }
    }
  }
}

function authorizeUser(bot, message) {
  bot.startConversation(message, (err, convo) => {
    convo.ask(strings.authorizeUser.provideToken, (response, convo) => {
      token = response.text;

      github.getAuthUser(token, (response) => {
        convo.next();
        if (response.message == 'Bad credentials')
          convo.say(strings.authorizeUser.invalidToken);
        else {
          database.saveUser(message.user, token, response.login, (err, doc) => {
            if (err) convo.say(strings.authorizeUser.cannotSave);
            else convo.say(strings.authorizeUser.authorized + response.login);
          });
        }
      });
    });
  });
}

/**
 * Revoke access to a user
 */
function revokeAccess(bot, message) {
  database.getUser(message.user, (err, apiKey, githubUser) => {
    bot.startConversation(message, (err, convo) => {
      convo.ask(strings.authorizeUser.askRevoke + githubUser,
        (response, convo) => {

        convo.next();
        if (response.text == 'yes' || response.text == 'y') {
          database.revokeAccess(message.user, (err, numRemoved) => {
            if (err)
              convo.say(strings.authorizeUser.revokeDBError);
            if (numRemoved == 0)
              convo.say(strings.authorizeUser.revokeError);
            else
              convo.say(strings.authorizeUser.revokeError);
          });
        } else {
          convo.say(strings.authorizeUser.neverMind);
        }
      });
    });
  });
}

/**
 * Return the last 10 log entries for debug
 */
function readLog(bot, message) {
  let options = {
    limit: 10,
    order: 'desc'
  }

  winston.query(options, function (err, results) {
    if (err) {
      throw err;
    }
    //reply with the log results
    bot.reply(message,'Log tail:\n' + JSON.stringify(results.file));
  });
}
