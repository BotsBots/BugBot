/*
 * Flat file database used for storing user github keys
 *
 * Author: Ian Moore
 */
const DATABASE_PATH = './userdb';

let Datastore = require('nedb');
let db = null;

function getDB() {
  if (db == null) {
    db = new Datastore({ filename: DATABASE_PATH });
    db.loadDatabase();
  }

  return db;
}

exports.saveUser = (userID, apiKey, githubUser, callback) => {
  getDB().insert({_id: userID, apiKey: apiKey, githubUser: githubUser },
    (err, doc) => {callback(err,doc);});
}

/**
 * Get a user's info
 */
exports.getUser = (userID, callback) => {
  getDB().findOne({_id: userID}, (err, doc) => {
    callback(err, doc.apiKey, doc.githubUser);
  });
}

/**
 * Calls callback with true if the user is authorized
 * otherwise it it calls the callback with false
 */
exports.isAuthorized = (userID, callback) => {
  getDB().count({_id: userID}, (err, count) => {
    if (count == 1) callback(err, true);
    else if (count == 0) callback(err, false);
    //if there is more than one record, set err to true, and call the callback
    else callback(true, false);
  });
}

exports.revokeAccess = (userID, callback) => {
  getDB().remove({_id: userID}, {}, callback(err, numRemoved));
}
