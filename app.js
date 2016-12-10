var request = require("request");
var async = require("async");
var config = require("./config");
var twilio = require("twilio");
var sms = new twilio.RestClient(config.twilio.sid, config.twilio.auth_token);
var down = false;
var downstart;
var confirmed;

check();

function check() {
  console.log("Checking status...");
  async.parallel({
    control: function(done) {
      request("https://www.google.com/", function(err, result) {
        if (err)
          result = {
            error: err
          };
        done(null, result);
      });
    },
    test: function(done) {
      request(config.url, function(err, result) {
        if (err)
          result = {
            error: err
          };
        done(null, result);
      });
    }
  }, function(error, results) {
    // If the control site is down
    if (results.control.error) {
      console.error("Control failed: " + results.control.error);
      setTimeout(check, 60 * 1000);
    } else if (results.test.error) {
      // If the server is encountering an error and it was not previously, double check, then mark it as down
      if (!down) {
        console.log(confirmed);
        if (confirmed) {
          smsAlert("DOWN", results.test.error);
          down = true;
          downstart = new Date();
        } else
          confirmed = true;
      }
      setTimeout(check, 10 * 1000);
    } else {
      if (down) {
        var minutes = Math.round((new Date().getTime() - downstart) / 60000);
        var seconds = Math.round((new Date().getTime() - downstart) / 1000);
        smsAlert("UP", "Service restored after " + minutes + "m " + seconds + "s.");
        down = false;
        confirmed = false;
      }
      setTimeout(check, 60 * 1000);
    }
  });
}

function smsAlert(status, message) {
  var functions = [];
  var msg = "[" + config.prefix + "] " + status + " - " + message;
  for (var i = 0; i < config.contacts.length; i++) {
    (function(contact) {
      functions.push(function(done) {
        sms.messages.create({
          body: msg,
          to: contact,
          from: config.twilio.number,
        }, function(err, message) {
          done(err, message);
        });
      });
    })(config.contacts[i]);
  }

  async.parallel(functions, function(err, response) {
    console.log("Message(s) sent.");
  });
}

function request(url, callback) {
  var req = request(url, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      callback(null, true);
    } else {
      if (error)
        callback(null, {
          error: "Request failed: " + error,
        });
      else
        callback(null, {
          error: "Invalid status: " + response.statusCode,
        });
    }
  });
}
