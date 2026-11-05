/* ==========================================================================
   ZIQWEAR — checkout
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Store, UI = window.UI, I = UI.icons;
  var qs = UI.qs, qsa = UI.qsa, esc = UI.esc;

  var chosen = { shipping: "standard", payment: "cod" };

  function shippingOptions() {
    var sub = S.cartSubtotal();
    var free = sub >= S.settings.freeShipping;
    return [
      { id: "standard", name: "Standard delivery", desc: "2–4 working days", price: free ? 0 : S.settings.shippingFee },
      { id: "express", name: "Express delivery", desc: "Next day in major cities", price: 450 },
      { id: "pickup", name: "Store pickup", desc: S.settings.address, price: 0 }
    ];
  }

  function paymentOptions() {
    return [
      { id: "cod", name: "Cash on delivery", desc: "Pay the rider when your parcel arrives", tag: "Most popular" },
      { id: "bank", name: "Bank transfer", desc: "Details sent on WhatsApp after you order" },
      { id: "card", name: "Card (coming soon)", desc: "Online card payments are not live yet", disabled: true }
    ];
  }

  function renderMethods() {
    var ship = shippingOptions();
    qs("#shipping-methods").innerHTML = ship.map(function (m) {
      return '<label class="radio-card' + (chosen.shipping === m.id ? " is-on" : "") + '" data-ship="' + m.id + '">' +
        '<input type="radio" name="ship" value="' + m.id + '"' + (chosen.shipping === m.id ? " checked" : "") + '>' +
        '<span class="radio-card__dot"></span>' +
        '<span class="radio-card__t"><b>' + esc(m.name) + '</b><span>' + esc(m.desc) + '</span></span>' +
        '<span class="radio-card__price">' + (m.price ? UI.money(m.price) : "Free") + '</span></label>';
    }).join("");

    var pay = paymentOptions();
    qs("#payment-methods").innerHTML = pay.map(function (m) {
      return '<label class="radio-card' + (chosen.payment === m.id ? " is-on" : "") + '" data-pay="' + m.id + '"' + (m.disabled ? ' style="opacity:.5;pointer-events:none"' : '') + '>' +
        '<input type="radio" name="pay" value="' + m.id + '"' + (chosen.payment === m.id ? " checked" : "") + '>' +
        '<span class="radio-card__dot"></span>' +
        '<span class="radio-card__t"><b>' + esc(m.name) + '</b><span>' + esc(m.desc) + '</span></span>' +
        (m.tag ? '<span class="radio-card__price" style="font-size:var(--fs-tag);letter-spacing:var(--ls-wide);text-transform:uppercase">' + esc(m.tag) + '</span>' : '') +
        '</label>';
    }).join("");

    qsa("[data-ship]").forEach(function (el) {
      el.addEventListener("click", function () {
        chosen.shipping = el.dataset.ship;
        renderMethods();
        renderSummary();
      });
    });
    qsa("[data-pay]").forEach(function (el) {
      el.addEventListener("click", function () {
        chosen.payment = el.dataset.pay;
        renderMethods();
      });
    });
  }

  function totals() {
    var sub = S.cartSubtotal();
    var ship = shippingOptions().filter(function (m) { return m.id === chosen.shipping; })[0];
    var shipFee = ship ? ship.price : 0;
    return { sub: sub, ship: shipFee, total: sub + shipFee };
  }

  function renderSummary() {
    var host = qs("#summary");
    var items = S.cart();
    var t = totals();

    if (!items.length) {
      host.innerHTML = '<h2>Order summary</h2><p style="font-size:var(--fs-sm);color:var(--muted)">Your bag is empty.</p>' +
        '<a class="btn btn--ghost btn--full" style="margin-top:16px" href="shop.html">Continue shopping</a>';
      qs("#place-order").disabled = true;
      return;
    }
    qs("#place-order").disabled = false;

    host.innerHTML = '<h2>Order summary</h2>' +
      '<div class="summary__items">' + items.map(function (i) {
        return '<div class="sitem">' +
          '<img src="' + esc(i.image) + '" alt="">' +
          '<div><p class="sitem__t">' + esc(i.title) + '</p>' +
            '<p class="sitem__m">' + [i.color, i.size].filter(Boolean).map(esc).join(" · ") + ' × ' + i.qty + '</p></div>' +
          '<span class="sitem__p">' + UI.money(i.price * i.qty) + '</span>' +
        '</div>';
      }).join("") + '</div>' +
      '<div class="cart-line"><span>Subtotal</span><span>' + UI.money(t.sub) + '</span></div>' +
      '<div class="cart-line"><span>Delivery</span><span>' + (t.ship ? UI.money(t.ship) : "Free") + '</span></div>' +
      '<div class="cart-line cart-line--total"><span>Total</span><span>' + UI.money(t.total) + '</span></div>' +
      '<p class="cart-note" style="text-align:left;margin-top:14px">' +
        (t.sub >= S.settings.freeShipping ? '🎉 Free shipping applied' : 'Add ' + UI.money(S.settings.freeShipping - t.sub) + ' for free shipping') +
      '</p>' +
      '<a class="btn btn--ghost btn--full wa-btn" id="wa-checkout" style="margin-top:14px" target="_blank" rel="noopener" href="#">' +
        UI.icons.whatsapp + ' Send this order on WhatsApp</a>' +
      '<p class="cart-note" style="text-align:left;margin-top:8px">Skip the form \u2014 send your bag straight to us on WhatsApp.</p>';

    paintWALink();
  }

  /* WhatsApp version of the order, using whatever the customer has typed so far. */
  function paintWALink() {
    var a = qs("#wa-checkout");
    if (!a) return;
    var v = function (id) { var el = qs("#" + id); return el ? el.value.trim() : ""; };
    var extra = [
      v("name") ? "Name: " + v("name") : "",
      v("phone") ? "Phone: " + v("phone") : "",
      v("address") ? "Address: " + v("address") : "",
      v("city") ? "City: " + v("city") : "",
      v("province") ? "Province: " + v("province") : ""
    ].filter(Boolean).join("\n");
    a.href = UI.waLink(UI.cartMessage(extra));
  }

  /* ---------- submit ---------- */
  function validate() {
    var required = ["name", "phone", "address", "city", "province"];
    var bad = null;
    required.forEach(function (id) {
      var el = qs("#" + id);
      if (!el.value.trim()) {
        el.style.borderColor = "var(--sale)";
        if (!bad) bad = el;
      } else {
        el.style.borderColor = "";
      }
    });
    if (bad) {
      bad.focus();
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
      UI.toast("Please fill in the required fields");
      return false;
    }
    var phone = qs("#phone").value.replace(/\D/g, "");
    if (phone.length < 10) {
      qs("#phone").style.borderColor = "var(--sale)";
      qs("#phone").focus();
      UI.toast("Enter a valid phone number");
      return false;
    }
    return true;
  }

  function placeOrder(e) {
    e.preventDefault();
    if (!S.cart().length) { UI.toast("Your bag is empty"); return; }
    if (!validate()) return;

    var t = totals();
    var order = S.createOrder({
      customer: {
        name: qs("#name").value.trim(),
        phone: qs("#phone").value.trim(),
        email: qs("#email").value.trim(),
        address: qs("#address").value.trim(),
        city: qs("#city").value.trim(),
        province: qs("#province").value,
        postal: qs("#postal").value.trim(),
        landmark: qs("#landmark").value.trim()
      },
      payment: chosen.payment,
      shippingFee: t.ship,
      notes: qs("#notes").value.trim()
    });

    /* Send an order notification email to the store owner via Gmail SMTP. */
    sendOrderEmail(order);

    /* Send an order confirmation email to the customer (if they gave an email). */
    sendCustomerConfirmation(order);

    showSuccess(order);
  }

  /* ---------- email notification ---------- */
  function sendOrderEmail(order) {
    if (!window.Email) return;

    var lines = [];
    lines.push("New order placed on the ZIQWEAR website.");
    lines.push("");
    lines.push("Order ID: " + order.id);
    lines.push("Date: " + new Date(order.createdAt).toLocaleString("en-GB"));
    lines.push("Payment: " + (order.payment === "cod" ? "Cash on delivery" : "Bank transfer"));
    lines.push("");
    lines.push("CUSTOMER");
    lines.push("Name: " + (order.customer.name || "-"));
    lines.push("Phone: " + (order.customer.phone || "-"));
    if (order.customer.email) lines.push("Email: " + order.customer.email);
    lines.push("Address: " + (order.customer.address || "-"));
    lines.push("City: " + (order.customer.city || "-"));
    lines.push("Province: " + (order.customer.province || "-"));
    if (order.customer.postal) lines.push("Postal: " + order.customer.postal);
    if (order.customer.landmark) lines.push("Landmark: " + order.customer.landmark);
    if (order.notes) lines.push("Notes: " + order.notes);
    lines.push("");
    lines.push("ITEMS");
    order.items.forEach(function (i) {
      var variant = [i.color, i.size].filter(Boolean).join(" / ");
      lines.push("- " + i.title + (variant ? " (" + variant + ")" : "") + " x" + i.qty + " = " + S.money(i.price * i.qty));
    });
    lines.push("");
    lines.push("Subtotal: " + S.money(order.subtotal));
    lines.push("Delivery: " + (order.shipping ? S.money(order.shipping) : "Free"));
    lines.push("TOTAL: " + S.money(order.total));

    window.Email.send({
      subject: "New Order " + order.id + " - " + S.money(order.total),
      message: lines.join("\n"),
      replyTo: order.customer.email || "",
      fromName: order.customer.name || "Website"
    }, function (ok) {
      /* Silent - the customer already sees the success page. This just
         notifies the store owner. If it fails, the order is still saved
         in the admin panel. */
    });
  }

  /* ---------- customer confirmation email ---------- */
  function sendCustomerConfirmation(order) {
    if (!window.Email) return;
    if (!order.customer.email) return; /* only if customer gave an email */

    var lines = [];
    lines.push("Hi " + (order.customer.name || "there") + ",");
    lines.push("");
    lines.push("Thank you for your order from ZIQWEAR! Your order has been received and is now being processed.");
    lines.push("");
    lines.push("ORDER ID: " + order.id);
    lines.push("Date: " + new Date(order.createdAt).toLocaleString("en-GB"));
    lines.push("Status: Order placed");
    lines.push("");
    lines.push("ITEMS");
    order.items.forEach(function (i) {
      var variant = [i.color, i.size].filter(Boolean).join(" / ");
      lines.push("- " + i.title + (variant ? " (" + variant + ")" : "") + " x" + i.qty + " = " + S.money(i.price * i.qty));
    });
    lines.push("");
    lines.push("Subtotal: " + S.money(order.subtotal));
    lines.push("Delivery: " + (order.shipping ? S.money(order.shipping) : "Free"));
    lines.push("TOTAL: " + S.money(order.total));
    lines.push("");
    lines.push("SHIPPING ADDRESS");
    lines.push(order.customer.address || "-");
    lines.push((order.customer.city || "-") + ", " + (order.customer.province || "-"));
    if (order.customer.postal) lines.push("Postal: " + order.customer.postal);
    lines.push("Phone: " + (order.customer.phone || "-"));
    lines.push("");
    lines.push("PAYMENT: " + (order.payment === "cod" ? "Cash on delivery" : "Bank transfer"));
    lines.push("");
    lines.push("TRACK YOUR ORDER");
    lines.push("You can track your order status anytime by visiting:");
    lines.push(location.origin + location.pathname.replace(/[^/]*$/, "") + "orders.html?phone=" + encodeURIComponent(order.customer.phone));
    lines.push("");
    lines.push("You will receive an email update when your order is confirmed, shipped, and delivered.");
    lines.push("");
    lines.push("Need help? Reply to this email or WhatsApp us at " + S.settings.phone);
    lines.push("");
    lines.push("--");
    lines.push("ZIQWEAR | Zenith in Quality");
    lines.push(S.settings.address);

    window.Email.send({
      subject: "Order Confirmed - " + order.id + " - ZIQWEAR",
      message: lines.join("\n"),
      replyTo: S.settings.email || "",
      fromName: "ZIQWEAR Store",
      toEmail: order.customer.email
    }, function (ok) {
      /* Silent - the order is already placed. This is just a courtesy email. */
    });
  }

  function showSuccess(order) {
    qs("#checkout").style.display = "none";
    var host = qs("#success");
    host.style.display = "block";
    var wa = "https://wa.me/" + UI.digits(S.settings.whatsapp) + "?text=" +
      encodeURIComponent("Hi ZIQWEAR, I just placed order " + order.id + " (" + UI.money(order.total) + "). Name: " + order.customer.name);

    host.innerHTML = '<div style="max-width:640px;margin:20px auto 90px;text-align:center">' +
      '<div style="width:64px;height:64px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;margin:0 auto 24px">' + I.check + '</div>' +
      '<p class="eyebrow">Order confirmed</p>' +
      '<h2 style="font-size:var(--fs-page);font-weight:var(--fw-bold);margin:10px 0 14px">Thank you, ' + esc(order.customer.name.split(" ")[0]) + '.</h2>' +
      '<p style="color:var(--muted);font-size:var(--fs-body);max-width:440px;margin:0 auto">Your order <b style="color:var(--ink)">' + esc(order.id) + '</b> is in. We will confirm it on WhatsApp within a few hours.</p>' +
      '<div style="border:1px solid var(--line);padding:24px;margin:32px 0;text-align:left">' +
        order.items.map(function (i) {
          return '<div class="sitem"><img src="' + esc(i.image) + '" alt="">' +
            '<div><p class="sitem__t">' + esc(i.title) + '</p><p class="sitem__m">' + [i.color, i.size].filter(Boolean).map(esc).join(" · ") + ' × ' + i.qty + '</p></div>' +
            '<span class="sitem__p">' + UI.money(i.price * i.qty) + '</span></div>';
        }).join("") +
        '<div class="cart-line" style="margin-top:12px"><span>Delivery</span><span>' + (order.shipping ? UI.money(order.shipping) : "Free") + '</span></div>' +
        '<div class="cart-line cart-line--total"><span>Total</span><span>' + UI.money(order.total) + '</span></div>' +
        '<p style="font-size:var(--fs-meta);color:var(--muted);margin-top:14px">Delivering to ' + esc(order.customer.address) + ', ' + esc(order.customer.city) + '</p>' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
        '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">Confirm on WhatsApp</a>' +
        '<a class="btn btn--ghost" href="orders.html?phone=' + encodeURIComponent(order.customer.phone) + '">Track order</a>' +
      '</div>' +
      '<p style="margin-top:26px"><a href="shop.html" style="font-size:var(--fs-meta);text-decoration:underline;color:var(--muted)">Continue shopping</a></p>' +
    '</div>';
    window.scrollTo({ top: 0, behavior: "smooth" });
    UI.syncCounts();
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    S.init();
    UI.mount();
    renderMethods();
    renderSummary();
    qs("#co-form").addEventListener("submit", placeOrder);

    // keep the WhatsApp message in sync with whatever has been typed
    ["name", "phone", "address", "city", "province"].forEach(function (id) {
      var el = qs("#" + id);
      if (el) el.addEventListener("input", paintWALink);
    });

    if (!S.cart().length) {
      UI.toast("Your bag is empty — add something first");
    }
  });
})();
