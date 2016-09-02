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
        convo.next();

        //save the token under the user's id
        controller.storage.users.save({id: message.user, token: token}, (err) => {
          if (err)
            convo.say('Sorry, I was unable to save your token.');
          else convo.say('Your token has been saved. You should now be able to create issues');
        });
      });
    });
  });


  /**
   * Executes when the controller hears the message new_issue
   */
  controller.hears('new issue',['direct_message', 'mention', 'direct_mention'], (bot,message) => {
    let issue = {};
    bot.startConversation(message, (err, convo) => {
      convo.ask('What project would you like to report an issue for?', (response, convo) => {
        issue.project = response.text;
        convo.next();
      });

      convo.ask('What would you like to title the issue?', (response, convo) => {
        issue.title = response.text;
        convo.next();
      });

      convo.ask('Give a description for the issue', (response, convo) => {
        issue.description = response.text;
        convo.next();

        convo.say('Thank you! I will now create your issue');
        //github.createIssue(token, owner, repo, title, body);
        console.log(issue.project + ', ' + issue.title + '\n' + issue.description);
      });
    });
  });


}
