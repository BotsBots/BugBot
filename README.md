# BugBot
Bugbot is a helpful bot that helps you create Github issues from Slack.

### Motivation
Creating issues can be difficult for users who do not know what the troubleshooter
is looking for. Bugbot can help with this by asking a specific series of questions,
and then compiling an issue report. It is designed to help
both technical and non-technical users create more consistent and readable issues.

### Usage

You can message a running instance of bugbot with any of the following commands:
Note that bugbot only responds to direct messages.

* authorize - send this message in a private chat to authenticate to github.
You will need a github personal access token which can be found in github's settings.
* revoke - revoke your authorization
* new issue/issue - open an issue on a project
* report - guides the user through creating an issue
* new feature/feature - walks the user through creating a fetaure as opposed to an issue.
* help - display help message

### Installation/deployment

#### Prerequsites
* NodeJS and NPM

#### Install
* create a slack bot on your team, and get a token
* clone the bugbot repo.
* copy example-settings.yml to settings.yml and your slack token
* run `npm install` in the bugbot repo
* Install foreverJS `npm install -g forever` (optional)

#### Start/stop
* Start bugbot with the command `forever start bugbot.js`
* To stop bugbot run `forever stop bugbot.js`
* If you do not want to use forever simply run `node bugbot.js`

### Future Plans
Bugbot could begin to implement some natural language processing techniques to detect
poorly written issues and help users provide more detail.

We could also detect when a user is confused and provide more guided help. I.E.,
if a user does not understand instructions the bot should be able to elaborate
on all of its functions.
