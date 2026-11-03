/* ==========================================================================
   ZIQWEAR - contact page
   Studio details, FAQ accordion and the WhatsApp / email enquiry composer.
   Kept in its own file so the site can run under a strict Content-Security-
   Policy with no inline scripts.
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Store, UI = window.UI, I = UI.icons, qs = UI.qs, qsa = UI.qsa;
  var esc = UI.esc, safeUrl = UI.safeUrl;

  /* Keep only characters that can legally appear in an address, so a stray
     quote or newline in the admin field cannot break out of the mailto URL. */
  function mailAddr(v) {
    return String(v == null ? "" : v).replace(/[^A-Za-z0-9._%+@-]/g, "").slice(0, 120);
  }

  var FAQ_FALLBACK = [
    ["How long does delivery take?", "Orders placed before 4pm are dispatched the same working day. Standard delivery takes 2\u20134 working days anywhere in Pakistan."]
  ];

  document.addEventListener("DOMContentLoaded", function () {
    S.init();
    UI.mount();
    var s = S.settings;

    qs("#cf-send").innerHTML = I.whatsapp + "Send on WhatsApp";
    qs("#cf-mail").innerHTML = I.mail + "Send by email";

    var wa = UI.digits(s.whatsapp);
    qs("#c-wa").href = "https://wa.me/" + wa;
    qs("#c-wa").textContent = "+" + wa;
    qs("#c-phone").href = "tel:" + String(s.phone || "").replace(/[^\d+]/g, "");
    qs("#c-phone").textContent = s.phone;
    qs("#c-email").href = "mailto:" + mailAddr(s.email);
    qs("#c-email").textContent = s.email;
    qs("#c-address").textContent = s.address;
    qs("#c-hours").textContent = s.hours;

    var soc = s.socials || {};
    if (soc.instagram) qs("#c-insta").href = safeUrl(soc.instagram);
    if (soc.tiktok) qs("#c-tiktok").href = safeUrl(soc.tiktok);

    qs("#faq").innerHTML = (s.faq && s.faq.length ? s.faq : FAQ_FALLBACK).map(function (f) {
      return '<div class="faq-item"><button class="faq-q">' + esc(f[0]) + I.plus + '</button>' +
        '<div class="faq-a"><div><p>' + esc(f[1]) + '</p></div></div></div>';
    }).join("");

    qsa(".faq-q").forEach(function (b) {
      b.addEventListener("click", function () { b.parentElement.classList.toggle("is-open"); });
    });

    function compose() {
      var name = qs("#cf-name").value.trim();
      var phone = qs("#cf-phone").value.trim();
      var email = qs("#cf-email").value.trim();
      var topic = qs("#cf-topic").value;
      var msg = qs("#cf-msg").value.trim();
      if (!name || !msg) { UI.toast("Add your name and a message first"); return null; }
      return {
        name: name,
        phone: phone,
        email: email,
        topic: topic,
        msg: msg,
        text: "Hi " + s.storeName + "!\n\n" +
          "Name: " + name + "\n" +
          "Phone: " + phone + "\n" +
          (email ? "Email: " + email + "\n" : "") +
          "Topic: " + topic + "\n\n" +
          msg
      };
    }

    /* WhatsApp button - opens WhatsApp with the message pre-filled. */
    qs("#contact-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var c = compose();
      if (!c) return;
      window.open(UI.waLink(c.text), "_blank", "noopener");
      UI.toast("Opening WhatsApp \u2014 press send there");
      e.target.reset();
    });

    /* Email button - sends through the server's Gmail SMTP endpoint.
       Falls back to mailto: if the server is not running or email is not configured. */
    qs("#cf-mail").addEventListener("click", function () {
      var c = compose();
      if (!c) return;

      var btn = qs("#cf-mail");
      var originalHTML = btn.innerHTML;
      btn.innerHTML = I.mail + " Sending...";
      btn.disabled = true;

      window.Email.send({
        subject: "[" + s.storeName + "] " + c.topic,
        message: c.text,
        replyTo: c.email,
        fromName: c.name
      }, function (ok, error) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;

        if (ok) {
          UI.toast("Email sent \u2014 we will get back to you shortly");
          var form = qs("#contact-form");
          if (form) form.reset();
        } else {
          /* Fallback: open the user's mail app with the same content. */
          var subject = "[" + s.storeName + "] " + c.topic;
          window.location.href = "mailto:" + mailAddr(s.email) +
            "?subject=" + encodeURIComponent(subject) +
            "&body=" + encodeURIComponent(c.text);
          UI.toast("Opening your mail app \u2014 press send there");
        }
      });
    });
  });
})();
