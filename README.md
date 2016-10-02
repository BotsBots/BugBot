# BugBot
A helpful bot for helping someone report an issue for an app or webpage.

### Usage

* authorize - send this message in a private chat to authenticate to github.
* revoke - revoke your authorization
* new issue - open an issue on a project
* help - display help message

### Installation/deployment

#### Install
* create a slack bot, and get a token
* clone the bugbot repo.
* copy example-settings.yml to settings.yml and your slack token
* run `npm install` in the bugbot repo
* Install foreverJS `npm install -g forever`

#### Start/stop
* Start bugbot with the command `forever start bugbot.js`
* To stop bugbot run `forever stop bugbot.js`
