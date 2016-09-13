/*
 * Slack Integration for BugBot
 *
 * Author: Ian Moore
 */
let Botkit = require('botkit');
let github = require('./github.js');

exports.start = (token) => {
  let controller = Botkit.slackbot({
    debug: false,
    json_file_store: './user_data'
  });

  // connect the bot to a stream of messages
  controller.spawn({
    'token': token
  }).startRTM()

  /*controller.on('slash_command', (bot,message) => {
    if (message.text == '/report_issue') {
      bot.startConversation(message, (err, convo) => {
        convo.ask('What project would you like to report an issue for?', (response, convo) => {
          let project = response.text;

        });
      });
    }
  });*/

  /**
   * Allows the user to authorize their github
   */
  controller.hears('authorize', ['direct_message'], (bot, message) => {
    bot.startConversation(message, (err, convo) => {
      convo.say('I will need a github token to create issue on your behalf');
      convo.next();

      convo.ask('Please provide your token below', (response, convo) => {
        token = response.text;

        github.getAuthUser(token, (response) => {
          convo.next();
          if (response.message == 'Bad credentials')
            convo.say('Your token appears to be invalid');
          else {
            controller.storage.users.save({id: message.user, token: token}, (err) => {
              if (err) convo.say('Sorry, I was unable to save your token.');
              else convo.say("You are now authenticated as the github user: " + response.login);
            });
          }
        });

      });

    });
  });

  /**
   * Prevent user from trying to authorize from a public chat
   */
  controller.hears('authorize', ['mention'], (bot,message) => {
    bot.reply('Please message me in a private chat to authorize your user');
  });


  /**
   * Executes when the controller hears the message new_issue
   */
  controller.hears('new issue',['direct_message', 'mention', 'direct_mention'], (bot,message) => {
    controller.storage.users.get(message.user, (err, user_data) => {
      if (err)
        bot.reply('Sorry, your account does not appear to be authorized with github\
        \nPlease send me the \'authorize\' command in a private chat.');
      else
        createIssue(bot,message,user_data.token);
    });
  });

}

function createIssue(bot,message,token) {
  let issue = {};
  bot.startConversation(message, (err, convo) => {
    convo.ask('What project would you like to report an issue for?', (response, convo) => {
      issue.owner = response.text.split('/')[0];
      issue.repo = response.text.split('/')[1];
      convo.next();
    });

    convo.ask('What would you like to title the issue?', (response, convo) => {
      issue.title = response.text;
      convo.next();
    });

    convo.ask('Give a description for the issue', (response, convo) => {
      issue.body = response.text;
      convo.next();

      convo.say('Thank you! I will now create your issue');
      github.createIssue(token, issue.owner, issue.repo,
          issue.title, issue.body, (response) => {

        console.log(response);
      });
    });
  });
}
