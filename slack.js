/*
 * Slack Integration for BugBot
 *
 * Author: Ian Moore
 */
let Botkit = require('botkit');
let github = require('./github.js');
let database = require('./database.js');

exports.start = (token) => {
  let controller = Botkit.slackbot({
    debug: false,
    json_file_store: './user_data'
  });

  // connect the bot to a stream of messages
  controller.spawn({
    'token': token
  }).startRTM()

  controller.hears('help', ['direct_message'], (bot, message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      bot.reply(message, 'Hello, I am BugBot. I can help you report issues to Github\
      \nType \'new issue\' to report an issue or type \'report\' for guided issue creation.');
      if (authorized)
        bot.reply(message, 'You are currently authenticated with Github. You can type\
  \'revoke\' to revoke your access');
      else
        bot.reply(message, 'You are not currently authenticated with Github. You can type\
  \'authorize\' to begin the authenticate to your github account.');
    });
  });

  /**
   * Allows the user to authorize their github
   */
  controller.hears('authorize', ['direct_message'], (bot, message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (authorized)
        bot.reply(message, 'You are already authorized.');
      else
        authorizeUser(bot, message);
    });
  });

  /**
   * Prevent user from trying to authorize from a public chat
   */
  controller.hears('authorize', ['mention', 'direct_mention'], (bot,message) => {
    bot.reply(message, 'Please message me in a private chat to authorize your user');
  });


  /**
   * Executes when the controller hears the message new_issue
   */
  controller.hears('new issue',['direct_message', 'direct_mention'], (bot,message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (err)
        bot.reply(message, 'There appears to be an error with my database. My appologies, please\
        contact the maintainer of this bot.');
      else if (!authorized)
        bot.reply(message, 'Sorry, your account does not appear to be authorized with github\
        \nPlease send me the \'authorize\' command in a private chat.');
      else
        database.getUser(message.user, (err, token, githubUser) => {
          createIssue(bot, message, token);
        });
    });
  });

  controller.hears(['report', 'report bug'], ['direct_message', 'direct_mention'], (bot, message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (err)
        bot.reply(message, 'There appears to be an error with my database. My appologies, please\
        contact the maintainer of this bot.');
      else if (!authorized)
        bot.reply(message, 'Sorry, your account does not appear to be authorized with github\
        \nPlease send me the \'authorize\' command in a private chat.');
      else
        database.getUser(message.user, (err, token, githubUser) => {
          reportIssue(bot, message, token);
        });
    });
  });

  controller.hears(['revoke', 'revoke access'], ['direct_message'], (bot,message) => {
    database.isAuthorized(message.user, (err, authorized) => {
      if (err)
        bot.reply(message, 'There appears to be an error with my database. My appologies, please\
        contact the maintainer of this bot.');
      else if (!authorized)
        bot.reply(message, 'Your user does not appear to be authorized. Type \'authorize\' \
        to authorize your user');
      else
        revokeAccess(bot, message);
    });
  });

}

/**
 * A helper function for canceling the current action
 * the callback is what gets called if the user does not confirm the cancellation
 */
function cancelAction(bot, convo, callback) {
  convo.ask('Are you sure you want to cancel?', [
    { pattern: bot.utterances.yes, callback: (response, convo) => {
      convo.say('canceling action');
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
    convo.ask('What project would you like to report an issue for?\n\
  This should be in the form owner/repo, I.E., octocat/hello-world', (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say('You must specify a project');
        askProject(null, convo);
        convo.next();
      } else if (response.text.indexOf('/') == -1 || response.text.split('/').length != 2) {
        convo.say('You need to specify the porject in the format owner/project.');
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
    convo.ask('What would you like to title the issue?', (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askTitle);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say('A title is required');
        askTitle(response, convo);
        convo.next();
      } else if (response.text.length > 80) {
        convo.say('That\'s a bit long for a title. Can you try to be more concise?');
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
    convo.ask('Give a description for the issue', (response, convo) => {
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askDescription);
        convo.next();
      } else {
        issue.body = response.text;

        github.createIssue(token, issue.owner, issue.repo,
          issue.title, issue.body, (response) => {
          convo.next();
          if (response.message == 'Not Found')
            convo.say('Sorry I could not find the project: ' + issue.owner + '/' + issue.repo);
          else {
            //convert from the API url to the clickable url
            issueUrl = 'https://github.com/' + response.url.split('repos/')[1];
            convo.say('Thank you! Your issue is available at ' + issueUrl);
          }
        });
      }
    });
  }

  bot.startConversation(message, askProject);
}

/**
 * This function walks the user through reporting an issue
 * by asking specific questions.
 */
function reportIssue(bot, message, token) {
  let issue = {};

  let askProject = function(err, convo) {
    convo.ask('What project would you like to report an issue for?\n\
  This should be in the form owner/repo, I.E., octocat/hello-world', (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say('You must specify a project');
        askProject(null, convo);
        convo.next();
      } else if (response.text.indexOf('/') == -1 || response.text.split('/').length != 2) {
        convo.say('You need to specify the porject in the format owner/project.');
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
    convo.ask('What would you like to title the issue?', (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askTitle);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say('A title is required');
        askTitle(response, convo);
        convo.next();
      } else if (response.text.length > 80) {
        convo.say('That\'s a bit long for a title. Can you try to be more concise?');
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
    convo.ask('What were you doing when the issue occurred?\
    Try to help the troubleshooter recreate the issue.', (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say('This is required.');
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
    convo.ask('Now, what happened when the program crashed? Be sure to include any error codes.', (response, convo) => {

      //error check
      if (response.text == 'cancel') {
        cancelAction(bot, convo, askProject);
        convo.next();
      } else if (response.text.length == 0) {
        convo.say('This is required.');
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
    convo.ask('What version of the software were you running?.', (response, convo) => {

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
    convo.ask('Now, tell us about the device where the error occurred What \
    operating system is it running? (I.E., Windows 7, Android, etc)', (response, convo) => {
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
        issue.title, issue.body, (response) => {
          convo.next();
          if (response.message == 'Not Found')
            convo.say('Sorry I could not find the project: ' + issue.owner + '/' + issue.repo);
          else {
            //convert from the API url to the clickable url
            issueUrl = 'https://github.com/' + response.url.split('repos/')[1];
            convo.say('Thank you! Your issue is available at ' + issueUrl);
          }
        });
      }
    });
  }

  bot.startConversation(message, askProject);
}

function authorizeUser(bot, message) {
  bot.startConversation(message, (err, convo) => {
    convo.say('I will need a github personal access token to create issue on your behalf.\
    This token must have repo access enabled');
    convo.next();

    convo.ask('Please provide your token below', (response, convo) => {
      token = response.text;

      github.getAuthUser(token, (response) => {
        convo.next();
        if (response.message == 'Bad credentials')
          convo.say('Your token appears to be invalid');
        else {
          database.saveUser(message.user, token, response.login, (err, doc) => {
            if (err) convo.say('Sorry, I was unable to save your token.');
            else convo.say("You are now authenticated as the github user: " + response.login);
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
      convo.ask('Are you sure you want to revoke access to the github account:' + githubUser,
        (response, convo) => {

        convo.next();
        if (response.text == 'yes' || response.text == 'y') {
          database.revokeAccess(message.user, (err, numRemoved) => {
            if (err)
              convo.say('Your access could not be revoked due to a database error\
              Plase contact the maintainer of this bot.');
            if (numRemoved == 0)
              convo.say('Your user did not appear to be authorized. This is a bug\
              please contact the maintainer of this bot');
            else
              convo.say('Access revoked. Send me an \'authorize\' message to reconnect\
              to your github account.');
          });
        } else {
          convo.say('Never mind then');
        }
      });
    });
  });
}
