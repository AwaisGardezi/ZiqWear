/* ==========================================================================
   ZIQWEAR — order tracking
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Store, UI = window.UI;
  var qs = UI.qs, esc = UI.esc;

  var STEPS = ["pending", "confirmed", "shipped", "delivered"];
  var LABEL = { pending: "Order placed", confirmed: "Confirmed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function render(list, query) {
    var host = qs("#orders-list");
    if (!query) {
      host.innerHTML = '<p style="font-size:var(--fs-sm);color:var(--muted)">No number entered yet.</p>';
      return;
    }
    if (!list.length) {
      host.innerHTML = '<div class="empty-state" style="padding:50px 10px">' +
        '<h3>No orders found</h3><p>We could not find any order for ' + esc(query) + '. Double-check the number, or message us on WhatsApp.</p>' +
        '<a class="btn btn--ghost" href="https://wa.me/' + esc(S.settings.whatsapp) + '" target="_blank" rel="noopener">Message support</a></div>';
      return;
    }
    host.innerHTML = '<p style="font-size:var(--fs-meta);color:var(--muted);margin-bottom:16px">' + list.length + ' order' + (list.length > 1 ? "s" : "") + ' found</p>' +
      list.map(function (o) {
        var stepIdx = STEPS.indexOf(o.status);
        var timeline = o.status === "cancelled"
          ? '<p style="font-size:var(--fs-meta);color:var(--sale);margin-top:14px">This order was cancelled. Message us if this looks wrong.</p>'
          : '<div class="timeline">' + STEPS.map(function (s, i) {
            return '<div class="tl-step' + (i <= stepIdx ? " is-done" : "") + '">' +
              '<div class="tl-dot"></div><span>' + LABEL[s] + '</span></div>';
          }).join("") + '</div>';

        return '<div class="order-card">' +
          '<div class="order-card__head">' +
            '<div><p class="order-card__id">' + esc(o.id) + '</p>' +
              '<p class="order-card__date">' + fmtDate(o.createdAt) + ' · ' + o.items.length + ' item' + (o.items.length > 1 ? "s" : "") + '</p></div>' +
            '<div style="display:flex;align-items:center;gap:14px">' +
              '<span class="order-card__id">' + UI.money(o.total) + '</span>' +
              '<span class="status status--' + esc(o.status) + '">' + esc(LABEL[o.status] || o.status) + '</span></div>' +
          '</div>' +
          timeline +
          '<div style="margin-top:18px;display:flex;gap:12px;flex-wrap:wrap">' +
            o.items.map(function (i) {
              return '<div style="display:flex;gap:8px;align-items:center">' +
                '<img src="' + esc(i.image) + '" alt="" style="width:44px;height:56px;object-fit:cover">' +
                '<div><p style="font-size:var(--fs-meta);max-width:170px">' + esc(i.title) + '</p>' +
                '<p style="font-size:var(--fs-minor);color:var(--muted)">' + [i.color, i.size].filter(Boolean).map(esc).join(" · ") + ' × ' + i.qty + '</p></div></div>';
            }).join("") +
          '</div>' +
          '<p style="font-size:var(--fs-meta);color:var(--muted);margin-top:16px">Delivering to ' + esc((o.customer || {}).address) + ', ' + esc((o.customer || {}).city) + ' · ' + esc(o.payment === "cod" ? "Cash on delivery" : "Bank transfer") + '</p>' +
        '</div>';
      }).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    S.init();
    UI.mount();

    var input = qs("#track-phone");
    // Anything arriving from the query string is attacker-controlled: keep it to
    // the characters a phone number can actually contain and cap the length.
    var preset = String(new URLSearchParams(location.search).get("phone") || "")
      .replace(/[^\d+\s()-]/g, "").slice(0, 24);
    if (preset) {
      input.value = preset;
      render(S.ordersByPhone(preset), preset);
    }

    qs("#track-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) { UI.toast("Enter your phone number"); return; }
      render(S.ordersByPhone(v), v);
    });

    /* ---- Track by email ---- */
    var etForm = qs("#email-track-form");
    if (etForm) {
      etForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var orderId = qs("#et-order").value.trim();
        var email = qs("#et-email").value.trim();
        var msgHost = qs("#email-track-msg");

        if (!orderId) { UI.toast("Enter your order ID"); return; }
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          UI.toast("Enter a valid email address");
          return;
        }

        /* Find the order by ID across all stored orders. */
        var allOrders = S.orders();
        var order = null;
        for (var i = 0; i < allOrders.length; i++) {
          if (allOrders[i].id === orderId) { order = allOrders[i]; break; }
        }

        if (!order) {
          msgHost.innerHTML = '<p style="font-size:var(--fs-meta);color:var(--sale);padding:4px 0">' +
            'No order found with ID "' + esc(orderId) + '". Check the ID and try again, or ' +
            '<a href="https://wa.me/' + esc(S.settings.whatsapp) + '" target="_blank" rel="noopener" style="text-decoration:underline">message us on WhatsApp</a>.</p>';
          return;
        }

        /* Build the status email. */
        var stepIdx = STEPS.indexOf(order.status);
        var statusLabel = LABEL[order.status] || order.status;
        var lines = [];
        lines.push("Hi " + (order.customer.name || "there") + ",");
        lines.push("");
        lines.push("Here is the status of your ZIQWEAR order:");
        lines.push("");
        lines.push("ORDER ID: " + order.id);
        lines.push("Status: " + statusLabel);
        lines.push("Date placed: " + fmtDate(order.createdAt));
        lines.push("Total: " + S.money(order.total));
        lines.push("Items: " + order.items.length);
        order.items.forEach(function (i) {
          var variant = [i.color, i.size].filter(Boolean).join(" / ");
          lines.push("  - " + i.title + (variant ? " (" + variant + ")" : "") + " x" + i.qty);
        });
        lines.push("");
        if (order.status === "pending") {
          lines.push("Your order has been placed and is waiting for confirmation.");
        } else if (order.status === "confirmed") {
          lines.push("Your order has been confirmed and is being prepared for dispatch.");
        } else if (order.status === "shipped") {
          lines.push("Your order has been shipped and is on its way!");
        } else if (order.status === "delivered") {
          lines.push("Your order has been delivered. Thank you for shopping with ZIQWEAR!");
        } else if (order.status === "cancelled") {
          lines.push("Your order was cancelled. Contact us if this looks wrong.");
        }
        lines.push("");
        lines.push("Shipping to: " + (order.customer.address || "-") + ", " + (order.customer.city || "-"));
        lines.push("");
        lines.push("Need help? Reply to this email or WhatsApp us at " + (S.settings.phone || ""));
        lines.push("");
        lines.push("--");
        lines.push("ZIQWEAR | Zenith in Quality");
        lines.push(S.settings.address || "");

        msgHost.innerHTML = '<p style="font-size:var(--fs-meta);color:var(--muted);padding:4px 0">Sending status email to ' + esc(email) + '...</p>';

        window.Email.send({
          subject: "Order Status - " + order.id + " - " + statusLabel + " - ZIQWEAR",
          message: lines.join("\n"),
          replyTo: S.settings.email || "",
          fromName: "ZIQWEAR Store",
          toEmail: email
        }, function (ok, err) {
          if (ok) {
            msgHost.innerHTML = '<p style="font-size:var(--fs-meta);color:#22B24C;padding:4px 0">' +
              'Status email sent to ' + esc(email) + '! Check your inbox.</p>';
            UI.toast("Status email sent");
          } else {
            msgHost.innerHTML = '<p style="font-size:var(--fs-meta);color:var(--sale);padding:4px 0">' +
              'Could not send email: ' + esc(err || "Server error") + '. Try again or ' +
              '<a href="https://wa.me/' + esc(S.settings.whatsapp) + '" target="_blank" rel="noopener" style="text-decoration:underline">WhatsApp us</a>.</p>';
          }
        });
      });
    }
  });
})();
