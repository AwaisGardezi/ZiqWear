/* ==========================================================================
   ZIQWEAR - email integration
   Sends emails through the local server's /api/email endpoint (Gmail SMTP).
   Falls back to mailto: if the server API is unavailable or email is not
   configured, so the site never breaks.
   ========================================================================== */
(function (global) {
  "use strict";

  var UI = global.UI;

  /* Send an email via the local server's Gmail SMTP endpoint.
   * opts: { subject, message, replyTo, fromName }
   * cb: function(ok, error) - called with true/false and an error string. */
  function send(opts, cb) {
    cb = cb || function () {};

    if (!opts || !opts.message) {
      cb(false, "No message to send.");
      return;
    }

    var payload = {
      subject: opts.subject || "Website enquiry",
      message: opts.message,
      replyTo: opts.replyTo || "",
      fromName: opts.fromName || "",
      toEmail: opts.toEmail || ""
    };

    var json;
    try {
      json = JSON.stringify(payload);
    } catch (e) {
      cb(false, "Could not build the email payload.");
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "api/email", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 12000;

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        cb(true, "");
      } else {
        var err = "The server could not send the email.";
        try {
          var resp = JSON.parse(xhr.responseText);
          if (resp && resp.error) err = resp.error;
        } catch (e) {}
        cb(false, err);
      }
    };

    xhr.ontimeout = function () {
      cb(false, "The request timed out. The server may not be running.");
    };

    xhr.onerror = function () {
      cb(false, "Could not reach the server.");
    };

    try {
      xhr.send(json);
    } catch (e) {
      cb(false, "Could not send the request.");
    }
  }

  global.Email = { send: send };
})(window);
