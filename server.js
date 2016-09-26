'use strict';

// Module imports
var express = require('express')
  , WebSocketServer = require('ws').Server
  , restify = require('restify')
  , http = require('http')
  , bodyParser = require('body-parser')
  , util = require('util')
  , async = require('async')
;

// DBCS APEX stuff
// Temporary workaround. Demo zone will be retrieved from a local config file
const DEMOZONE = "MADRID"
//const DBZONEHOST = "https://oc-141-145-24-78.compute.oraclecloud.com";
const DBZONEHOST = "https://oc-140-86-0-162.compute.oraclecloud.com";
const DBZONEURI = "/apex/pdb1/anki/zone/" + DEMOZONE + "/{id}";
const DBDOCSSETUP = "/apex/pdb1/anki/docs/setup/" + DEMOZONE;


// Other constants
const FINISH = "finish";
const DRONEONGOING = "go";
const DRONETAKINGPICTURE = "picture";
const DRONERETURNING = "return";

// Instantiate classes & servers
var app    = express()
  , router = express.Router()
  , server = http.createServer(app)
  , dbClient = restify.createJsonClient({
    url: DBZONEHOST,
    rejectUnauthorized: false
  })
;

// ************************************************************************
// Main code STARTS HERE !!
// ************************************************************************

// Main handlers registration - BEGIN
// Main error handler
process.on('uncaughtException', function (err) {
  console.log("Uncaught Exception: " + err);
  console.log("Uncaught Exception: " + err.stack);
});
// Detect CTRL-C
process.on('SIGINT', function() {
  console.log("Caught interrupt signal");
  console.log("Exiting gracefully");
  process.exit(2);
});
// Main handlers registration - END

const PORT = process.env.PORT || 9999;
const wsURI = '/ws';

// REST engine initial setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const restURI = '/drone';
var ws = undefined;
var currentCorrId = undefined;

// WEBSOCKET stuff - BEGIN

var wss = new WebSocketServer({
  server: server,
  path: wsURI,
  verifyClient: function (info) {
    return true;
  }
});

wss.on('connection', function(_ws) {

  console.log("WS session connected");
  ws = _ws;

  _ws.on('close', function() {
    console.log("WS session disconnected");
    ws = undefined;
    currentCorrId = undefined;
  });

  _ws.on('message', function(data, flags) {
    var jsonData = JSON.parse(data);
    console.log("Incoming data received: %j", jsonData);
    if ( !jsonData.id) {
        console.log("Invalid message received: " + data);
        return;
    }
    if ( !currentCorrId) {
      console.log("No correlation id stored now!. Ignoring command.");
      return;
    }
    if ( currentCorrId !== jsonData.id) {
      console.log("Current correlation id (%s) doesn't match incoming id: %s", currentCorrId, jsonData.id);
      return;
    }
    // Up to this point, we receive a valid "finish" or "changedStatus" message that we were waiting.
    // TODO: Invoke external API to notify drone tasks are done

    if ( jsonData.result.toLowerCase() === FINISH) {
      // TODO
    } else if ( jsonData.result.toLowerCase() === DRONEONGOING) {
      // TODO
    } else if ( jsonData.result.toLowerCase() === DRONETAKINGPICTURE) {
      // TODO
    } else if ( jsonData.result.toLowerCase() === DRONERETURNING) {
      // TODO
    } else {
      // TODO
    }

  });

});
// WEBSOCKET stuff - END

// REST stuff - BEGIN
router.post('/go/:corrid/:folder/:zone', function(req, res) {
  console.log("POST request");

  var corrId = req.params.corrid;
  currentCorrId = corrId;
  var folderId = req.params.folder;
  var zone = req.params.zone;

  var self = this;
  var command = {};
  var response = "";
  command.corrId = corrId;

  async.series({
    docs: function(callback) {
      dbClient.get(DBDOCSSETUP, function(err, _req, _res, obj) {
        if (err) {
          console.log(err);
          callback(err.message);
        }
        if ( obj.items.length > 0) {
          var DOCS = obj.items[0];
          DOCS.folderId = folderId;
          command.DOCS = DOCS;
          callback(null);
        } else {
          response = "NO DOCS SETUP INFO FOUND IN THE DATABASE";
          callback(response);
        }
      });
    },
    commands: function(callback) {
      dbClient.get(DBZONEURI.replace('{id}', zone), function(err, _req, _res, obj) {
        if (err) {
          console.log(err);
          callback(err.message);
        }
        if ( obj.items.length > 0) {
          var commands = JSON.parse(obj.items[0].commands);
          command.steps = commands;
          callback(null);
        } else  {
          response = "Requested ZONE not found in database.";
          callback({ message: response });
        }
      });
    }
  }, function (err, results) {
    if (err) {
      res.status(500).send({ error: err.message });
    } else {
      // "command" object contains all data. Send it over WS
      //console.log("%j", command);
      if ( ws) {
        ws.send(JSON.stringify(command));
        response = "Command sent successfully";
        res.send({ result: response });
      } else {
        // WebSocket session not opened when received the command!!
        console.log("Request received but no WS session opened!");
        response = "WebSocket session not opened!";
        res.status(500).send({ error: response });
      }
    }
  });
});

router.get('/', function(req, res) {
  console.log("REST request");
  res.send("Usage: POST /drone/go/:corrid/:folder/:zone");
});
app.use(restURI, router);
// REST stuff - END

server.listen(PORT, function() {
  console.log("REST server running on http://localhost:" + PORT + restURI);
  console.log("WS server running on http://localhost:" + PORT + wsURI);
});
