(function () {
  "use strict";

  var BASE = new URL(document.baseURI).pathname.replace(/\/+$/, "");
  if (BASE.charAt(BASE.length - 1) !== "/") BASE += "/";
  var API = BASE + "api/v1";
  var CUR = "CHF";
  var PLACEHOLDER = BASE + "assets/img/no-image.svg";
  var CAT_PLACEHOLDER = BASE + "assets/img/category-default.svg";

  var state = {
    b2b: localStorage.getItem("ft_b2b") === "1",
    cart: loadCart()
  };

  // Shop view state — filters live here, never in the URL.
  var shopState = null;
  var shopCats = [], shopAttrs = [];
  var catById = {}, catSlugToId = {};
  var pendingShopInit = null;
  var lastItems = [];
  var allItems = [];

  function loadCart() {
    try { return JSON.parse(localStorage.getItem("ft_cart")) || []; }
    catch (e) { return []; }
  }
  function saveCart() { localStorage.setItem("ft_cart", JSON.stringify(state.cart)); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function enc(s) { return encodeURIComponent(s); }
  function fmt(n) {
    n = parseFloat(n);
    if (isNaN(n)) return "0.00";
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }
  function money(n) { return CUR + " " + fmt(n); }

  function U(path) { return BASE + (path.charAt(0) === "/" ? path.slice(1) : path); }

  function stockHtml(status, stock) {
    if (status === "outofstock") return '<div class="stock out-of-stock">Out of stock</div>';
    if (stock >= 25) return '<div class="stock">25+ stock</div>';
    return '<div class="stock">' + esc(stock) + ' stock</div>';
  }
  function priceHtml(p, opts) {
    opts = opts || {};
    if (!state.b2b) {
      return '<div class="loginprices"><a href="' + U("account") + '">' + (opts.label || "Login for price") + "</a></div>";
    }
    var v = (opts.wholesale != null) ? opts.wholesale : p;
    if (v == null) return '<div class="price">—</div>';
    return '<div class="price">' + money(v) + "</div>";
  }

  function getJSON(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      return r.json().then(function (j) {
        if (!j.ok) throw new Error(j.error || ("HTTP " + r.status));
        return j.data;
      });
    });
  }

  function pushUrl(url) {
    if (url === location.pathname + location.search + location.hash) { route(); return; }
    history.pushState({}, "", url);
    route();
  }

  var app = document.getElementById("app");
  function loading() { app.innerHTML = '<div class="loading"><div class="spinner"></div>Loading…</div>'; }

  function footerHtml() {
    return '<footer class="site-footer">' +
      '<div class="container footer-widgets">' +
      '<div class="footer-col"><h4>Customer Service</h4><ul>' +
      '<li><a href="' + U("shop") + '">Shop</a></li>' +
      '<li><a href="' + U("account") + '">My Account</a></li>' +
      '<li><a href="' + U("cart") + '">Cart</a></li></ul></div>' +
      '<div class="footer-col"><h4>About Ferrytelecom</h4><p>Your B2B wholesale partner for mobile phone parts, accessories and repair equipment. Serving Switzerland &amp; Luxembourg.</p></div>' +
      '<div class="footer-col"><h4>Contact</h4><p>Wholesale enquiries &amp; support.<br>SELL screens: <a href="https://sellscreens.ferrytelecom.com/" target="_blank" rel="noopener">sellscreens.ferrytelecom.com</a></p></div>' +
      '</div><div class="footer-bottom"><div class="container">© ' + new Date().getFullYear() + ' Ferrytelecom. All rights reserved.</div></div></footer>';
  }

  function breadcrumb(trail) {
    var h = '<a href="' + U("") + '">Home</a>';
    trail.forEach(function (t) {
      h += ' / ' + (t.href ? '<a href="' + t.href + '">' + esc(t.label) + "</a>" : "<span>" + esc(t.label) + "</span>");
    });
    return '<nav class="breadcrumb" aria-label="Breadcrumb">' + h + "</nav>";
  }

  /* ---------------- ROUTER ---------------- */
  function parseRoute() {
    var pn = location.pathname;
    if (pn.indexOf(BASE) === 0) pn = pn.slice(BASE.length);
    pn = pn.replace(/^\/+/, "").replace(/\/+$/, "");
    var query = {};
    if (location.search) {
      var sp = new URLSearchParams(location.search);
      sp.forEach(function (v, k) {
        if (k.slice(-2) === "[]") { k = k.slice(0, -2); (query[k] = query[k] || []).push(v); }
        else query[k] = v;
      });
    }
    return { path: pn, query: query };
  }
  function route() {
    closeDrawer();
    closeAllPanels();
    var r = parseRoute();
    var p = r.path;
    Array.prototype.forEach.call(document.querySelectorAll(".nav-links a"), function (a) {
      var href = a.getAttribute("href");
      var hp = href === "" ? "" : href.replace(/^\/+/, "");
      a.classList.toggle("active", hp === p || (hp !== "" && p.indexOf(hp) === 0));
    });
    if (p === "" || p === "home") renderHome();
    else if (p === "shop") enterShop({});
    else if (p.indexOf("categories/") === 0) enterShop({ category: decodeURIComponent(p.slice("categories/".length)) });
    else if (p === "categories") renderCategories();
    else if (p.indexOf("product/") === 0) renderProduct(decodeURIComponent(p.slice("product/".length)));
    else if (p === "cart") renderCart();
    else if (p === "account") renderAccount();
    else renderHome();
    window.scrollTo(0, 0);
  }

  /* ---------------- HEADER ---------------- */
  function buildNav() {
    var MENU = [
      ["Categories", "categories"],
      ["APPLE PARTS", "apple-parts"], ["iPhone", "iphone"], ["iPad", "ipad"],
      ["Apple Watch", "apple-watch"], ["Macbook Pro", "macbook-pro"], ["iMac", "imac"],
      ["SAMSUNG PARTS", "samsung-parts"], ["HUAWEI PARTS", "huawei-parts"],
      ["XIAOMI PARTS", "xiaomi-parts"], ["GOOGLE PARTS", "google-parts"],
      ["DEVICES", "devices"], ["Accessoires", "accessoires"], ["Tools", "tools"]
    ];
    var MISSING = { "google-parts": 1, "accessoires": 1, "tools": 1 };
    var html = "";
    MENU.forEach(function (m) {
      var slug = m[1], label = m[0];
      var href = MISSING[slug] ? U("shop") : U("categories/" + slug);
      html += '<li><a href="' + href + '"' + (MISSING[slug] ? ' data-q="' + esc(label) + '"' : "") + ">" + esc(label) + "</a></li>";
    });
    var list = document.getElementById("menu-list");
    if (list) {
      list.innerHTML = html;
      list.addEventListener("click", function (e) {
        var a = e.target.closest("a[data-q]");
        if (a) { pendingShopInit = { q: a.getAttribute("data-q"), category: "" }; }
      });
    }
  }

  function setupSearch() {
    var form = document.getElementById("search-form");
    var input = document.getElementById("search-input");
    var box = document.getElementById("search-results");
    var t;

    input.addEventListener("input", function () {
      clearTimeout(t);
      var q = input.value.trim();
      if (q.length < 2) { box.classList.remove("open"); box.innerHTML = ""; return; }
      t = setTimeout(function () {
        getJSON(API + "/products?q=" + enc(q) + "&page=1").then(function (d) {
          if (!d.items.length) { box.innerHTML = '<div class="sr-empty">No results</div>'; box.classList.add("open"); return; }
          var h = "";
          d.items.slice(0, 8).forEach(function (p) {
            h += '<a class="sr-item" href="' + U("product/" + p.slug) + '">' +
              '<img src="' + esc(p.image || PLACEHOLDER) + '" alt="">' +
              '<span><span class="sr-name">' + esc(p.name) + "</span><br>" +
              '<span class="sr-sku">' + esc(p.sku) + "</span></span></a>";
          });
          box.innerHTML = h;
          box.classList.add("open");
        }).catch(function () { box.classList.remove("open"); });
      }, 350);
    });

    document.addEventListener("click", function (e) {
      if (!form.contains(e.target)) box.classList.remove("open");
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      box.classList.remove("open");
      pendingShopInit = { q: q, category: "" };
      pushUrl(U("shop"));
    });
  }

  /* ---------------- CART ---------------- */
  function mcItemPrice(i, qty) {
    if (!state.b2b) return '<a class="mc-login" href="' + U("account") + '">Login for price</a>';
    if (i.price == null) return "Login for price";
    return money(i.price) + " × " + qty;
  }
  function mcSubtotal(v) {
    if (!state.b2b) return '<a class="mc-login" href="' + U("account") + '">Login for price</a>';
    return money(v);
  }
  function renderCartHeader() {
    var count = state.cart.reduce(function (s, i) { return s + i.qty; }, 0);
    var sub = state.cart.reduce(function (s, i) { return s + (i.price != null ? i.price * i.qty : 0); }, 0);
    ["cart-count", "cart-count-2"].forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = count; });
    var head = '<div class="mc-head"><span>Shopping Cart</span><b>' + count + " item" + (count === 1 ? "" : "s") + "</b></div>";
    var body = "";
    if (!state.cart.length) {
      body = '<div class="mc-empty"><span class="mc-empty__ic">🛒</span>No products in the cart yet.</div>';
    } else {
      state.cart.slice(0, 6).forEach(function (i) {
        body += '<div class="mc-item"><img src="' + esc(i.image || PLACEHOLDER) + '" alt="">' +
          '<div class="mc-info"><span class="mc-name">' + esc(i.name) + '</span>' +
          '<span class="mc-meta">' + mcItemPrice(i, i.qty) + '</span></div>' +
          '<button class="mc-remove" data-rm="' + i.id + '" title="Remove" aria-label="Remove">&times;</button></div>';
      });
      if (state.cart.length > 6) {
        body += '<div class="mc-more">+' + (state.cart.length - 6) + " more item(s) in cart</div>";
      }
      body += '<div class="mc-foot"><div class="mc-sub"><span>Subtotal</span><b>' + mcSubtotal(sub) + '</b></div>' +
        '<div class="mc-actions"><a class="btn" href="' + U("cart") + '">View Cart</a>' +
        '<a class="btn btn-primary" href="' + U("cart") + '">Checkout</a></div></div>';
    }
    var h = head + body;
    ["mini-cart-inner", "mini-cart-inner-2"].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.innerHTML = h;
      Array.prototype.forEach.call(el.querySelectorAll("[data-rm]"), function (b) {
        b.addEventListener("click", function () { removeFromCart(+b.getAttribute("data-rm")); });
      });
      Array.prototype.forEach.call(el.querySelectorAll(".mc-actions a"), function (a) {
        a.addEventListener("click", function () { closeAllPanels(); });
      });
    });
  }

  function openDrawer() { document.getElementById("cart-drawer").classList.add("open"); document.getElementById("overlay").classList.add("open"); }
  function closeDrawer() { document.getElementById("cart-drawer").classList.remove("open"); document.getElementById("overlay").classList.remove("open"); }
  function openMiniCart() {
    closeAllPanels(null);
    ["mini-cart", "mini-cart-2"].forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.add("open"); });
  }

  function renderDrawer() {
    var body = document.getElementById("cart-drawer-body");
    var foot = document.getElementById("cart-drawer-foot");
    if (!state.cart.length) {
      body.innerHTML = '<div class="mc-empty">Your cart is empty.</div>';
      foot.innerHTML = "";
      return;
    }
    var h = "";
    state.cart.forEach(function (i) {
      h += '<div class="mc-item"><img src="' + esc(i.image || PLACEHOLDER) + '" alt=""><span><span class="mc-name">' + esc(i.name) +
        "</span><br><span class=\"mc-price\">" + mcItemPrice(i, i.qty) +
        "</span><br><button class=\"link-remove\" data-rm=\"" + i.id + "\">Remove</button></span></div>";
    });
    body.innerHTML = h;
    var total = state.cart.reduce(function (s, i) { return s + (i.price != null ? i.price * i.qty : 0); }, 0);
    foot.innerHTML = '<div class="mc-foot" style="padding:0 0 10px"><span>Subtotal</span><span>' + mcSubtotal(total) +
      '</span></div><a class="btn btn-primary btn-block" href="' + U("cart") + '" onclick="closeDrawer()">Checkout</a>';
    Array.prototype.forEach.call(body.querySelectorAll("[data-rm]"), function (b) {
      b.addEventListener("click", function () { removeFromCart(+b.getAttribute("data-rm")); });
    });
  }

  function addToCart(p, qty) {
    qty = qty || 1;
    var ex = state.cart.find(function (i) { return i.id === p.id; });
    if (ex) ex.qty += qty;
    else state.cart.push({ id: p.id, slug: p.slug, name: p.name, image: p.image, sku: p.sku, price: (state.b2b ? parseFloat(p.price) || null : null), qty: qty });
    saveCart(); renderCartHeader(); renderDrawer(); openMiniCart();
  }
  function removeFromCart(id) {
    state.cart = state.cart.filter(function (i) { return i.id !== id; });
    saveCart(); renderCartHeader(); renderDrawer();
    if (parseRoute().path === "cart") renderCart();
  }
  function updateQty(id, qty) {
    var it = state.cart.find(function (i) { return i.id === id; });
    if (!it) return;
    it.qty = Math.max(1, qty | 0);
    saveCart(); renderCartHeader(); renderDrawer();
    if (parseRoute().path === "cart") renderCart();
  }

  /* ---------------- WISHLIST ---------------- */
  function loadWishlist() { try { return JSON.parse(localStorage.getItem("ft_wishlist")) || []; } catch (e) { return []; } }
  function saveWishlist(w) { localStorage.setItem("ft_wishlist", JSON.stringify(w)); }
  function inWishlist(id) { return loadWishlist().some(function (x) { return x.id === id; }); }
  function updateWishlistCount() { var c = loadWishlist().length; ["wishlist-count", "wishlist-count-2"].forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = c; }); }
  function updateWishlistHearts() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-wl]"), function (b) {
      b.classList.toggle("active", inWishlist(+b.getAttribute("data-wl")));
    });
  }
  function addToWishlist(item) { var w = loadWishlist(); if (!w.some(function (x) { return x.id === item.id; })) w.push(item); saveWishlist(w); updateWishlistCount(); updateWishlistHearts(); renderWishlist(); }
  function removeFromWishlist(id) { saveWishlist(loadWishlist().filter(function (x) { return x.id !== id; })); updateWishlistCount(); updateWishlistHearts(); renderWishlist(); }
  function toggleWishlist(item) { if (inWishlist(item.id)) removeFromWishlist(item.id); else addToWishlist(item); }
  function renderWishlistInto(panel) {
    if (!panel) return;
    var w = loadWishlist();
    if (!w.length) { panel.innerHTML = '<div class="wl-empty">Your wishlist is empty.</div>'; return; }
    var h = "";
    w.forEach(function (i) {
      h += '<div class="wl-item"><img src="' + esc(i.image || PLACEHOLDER) + '" alt=""><div class="wl-info"><span class="wl-name">' + esc(i.name) +
        '</span><span class="wl-price">' + (state.b2b ? (i.price != null ? money(i.price) : "Login for price") : '<a class="mc-login" href="' + U("account") + '">Login for price</a>') + '</span></div>' +
        '<div class="wl-actions"><button class="wl-add" data-wl-add="' + i.id + '" title="Add to cart"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>' +
        '<button class="wl-remove" data-wl-rm="' + i.id + '" title="Remove"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path></svg></button></div></div>';
    });
    h += '<div class="wl-foot"><a class="btn btn-primary btn-block" href="' + U("shop") + '">Browse products</a></div>';
    panel.innerHTML = h;
    Array.prototype.forEach.call(panel.querySelectorAll("[data-wl-add]"), function (b) {
      b.addEventListener("click", function () {
        var id = +b.getAttribute("data-wl-add");
        var it = loadWishlist().find(function (x) { return x.id === id; });
        if (it) { addToCart({ id: it.id, slug: it.slug, name: it.name, image: it.image, sku: it.sku, price: it.price }, 1); removeFromWishlist(id); }
      });
    });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-wl-rm]"), function (b) {
      b.addEventListener("click", function () { removeFromWishlist(+b.getAttribute("data-wl-rm")); });
    });
  }
  function renderWishlist() { renderWishlistInto(document.getElementById("wishlist-panel")); }
  function closeAllPanels(except) {
    ["mini-cart", "mini-cart-2", "account-menu", "account-menu-2", "wishlist-panel", "wishlist-panel-2"].forEach(function (id) {
      if (id !== except) { var el = document.getElementById(id); if (el) el.classList.remove("open"); }
    });
  }
  function togglePanel(id) {
    var el = document.getElementById(id); if (!el) return;
    var open = el.classList.toggle("open");
    closeAllPanels(open ? id : null);
  }

  /* ---------------- PRODUCT CARD ---------------- */
  function productCard(p) {
    var out = (p.stock_status === "outofstock");
    var img = p.image || PLACEHOLDER;
    return '<div class="product">' +
      '<div class="mf-product-thumbnail">' +
      '<a href="' + U("product/" + p.slug) + '"><img src="' + esc(img) + '" alt="' + esc(p.name) + '"></a>' +
      "</div>" +
      '<div class="mf-product-details">' +
      '<div class="mf-product-content"><h2><a href="' + U("product/" + p.slug) + '">' + esc(p.name) + "</a></h2>" +
      '<div class="sku">SKU: ' + esc(p.sku) + "</div>" +
      stockHtml(p.stock_status, p.stock) +
      priceHtml(p.price) +
      "</div>" +
      '<div class="footer-button"><button class="button" data-add="' + p.id + '" data-slug="' + esc(p.slug) + '" ' + (out ? "disabled" : "") + '>' +
      (out ? "Out of stock" : '<i>🛒</i><span>Add to cart</span>') + "</button></div>" +
      "</div></div>";
  }

  function bindAddButtons(root) {
    root = root || app;
    Array.prototype.forEach.call(root.querySelectorAll("[data-add]"), function (b) {
      if (b.__bound) return;
      b.__bound = true;
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = +b.getAttribute("data-add");
        var card = b.closest(".product");
        var name = card.querySelector("h2 a").textContent;
        var img = card.querySelector("img").src;
        var sku = card.querySelector(".sku").textContent.replace("SKU: ", "");
        addToCart({ id: id, slug: b.getAttribute("data-slug") || "", name: name, image: img, sku: sku, price: null }, 1);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-wl]"), function (b) {
      if (b.__bound) return;
      b.__bound = true;
      b.addEventListener("click", function (e) {
        e.stopPropagation(); e.preventDefault();
        var card = b.closest(".product");
        var name = card.querySelector("h2 a").textContent;
        var img = card.querySelector("img").src;
        var sku = card.querySelector(".sku").textContent.replace("SKU: ", "");
        toggleWishlist({ id: +b.getAttribute("data-wl"), slug: b.getAttribute("data-slug") || "", name: name, image: img, sku: sku, price: null });
      });
    });
  }

  /* ---------------- CATEGORY ART (inline SVG, instant load, keyword-relevant) ---------------- */
  var CAT_COLORS = { apple:"#23282d", samsung:"#1f4fd8", huawei:"#cf0a2c", xiaomi:"#ff6900", pixel:"#34a853", google:"#4285f4", oppo:"#1ba784", sony:"#111111", nokia:"#124191", motorola:"#5c9c00", generic:"#4887f4" };
  function catColor(s, n) {
    s = (s + " " + n).toLowerCase();
    if (s.indexOf("apple") >= 0) return CAT_COLORS.apple;
    if (s.indexOf("samsung") >= 0) return CAT_COLORS.samsung;
    if (s.indexOf("huawei") >= 0 || s.indexOf("p-series") >= 0 || s.indexOf("p series") >= 0) return CAT_COLORS.huawei;
    if (s.indexOf("xiaomi") >= 0 || s.indexOf("redmi") >= 0) return CAT_COLORS.xiaomi;
    if (s.indexOf("pixel") >= 0) return CAT_COLORS.pixel;
    if (s.indexOf("google") >= 0) return CAT_COLORS.google;
    if (s.indexOf("oppo") >= 0) return CAT_COLORS.oppo;
    if (s.indexOf("sony") >= 0) return CAT_COLORS.sony;
    if (s.indexOf("nokia") >= 0) return CAT_COLORS.nokia;
    if (s.indexOf("motorola") >= 0 || s.indexOf("moto") >= 0) return CAT_COLORS.motorola;
    return CAT_COLORS.generic;
  }
  function catType(s, n) {
    s = (s + " " + n).toLowerCase();
    if (s.indexOf("batter") >= 0) return "battery";
    if (s.indexOf("screen") >= 0 || s.indexOf("display") >= 0 || s.indexOf("lcd") >= 0) return "screen";
    if (s.indexOf("camera") >= 0) return "camera";
    if (s.indexOf("speaker") >= 0) return "speaker";
    if (s.indexOf("charg") >= 0 || s.indexOf("cable") >= 0 || s.indexOf("usb") >= 0 || s.indexOf("adapter") >= 0) return "cable";
    if (s.indexOf("case") >= 0 || s.indexOf("cover") >= 0) return "case";
    if (s.indexOf("tool") >= 0 || s.indexOf("screw") >= 0) return "tool";
    if (s.indexOf("lamp") >= 0 || s.indexOf("light") >= 0) return "lamp";
    if (s.indexOf("laptop") >= 0 || s.indexOf("computer") >= 0) return "laptop";
    if (s.indexOf("watch") >= 0 || s.indexOf("band") >= 0) return "watch";
    if (s.indexOf("headphone") >= 0 || s.indexOf("earphone") >= 0 || s.indexOf("earbud") >= 0) return "headphone";
    if (s.indexOf("chip") >= 0 || s.indexOf("board") >= 0) return "chip";
    if (s.indexOf("tablet") >= 0 || s.indexOf("ipad") >= 0) return "tablet";
    if (s.indexOf("device") >= 0 || s.indexOf("gadget") >= 0) return "gadget";
    if (s.indexOf("acces") >= 0 || s.indexOf("accessor") >= 0) return "cable";
    if (s.indexOf("multimedia") >= 0) return "laptop";
    if (s.indexOf("phone") >= 0 || s.indexOf("series") >= 0 || s.indexOf("-parts") >= 0) return "phone";
    return "phone";
  }
  var CAT_ICONS = {
    phone: '<rect x="42" y="28" width="36" height="64" rx="7"/><line x1="54" y1="36" x2="66" y2="36"/><circle cx="60" cy="84" r="3"/>',
    tablet: '<rect x="34" y="26" width="52" height="68" rx="7"/><circle cx="60" cy="86" r="2.5"/>',
    laptop: '<rect x="32" y="40" width="56" height="34" rx="3"/><line x1="26" y1="80" x2="94" y2="80"/><line x1="42" y1="74" x2="78" y2="74"/>',
    watch: '<rect x="46" y="34" width="28" height="52" rx="8"/><line x1="46" y1="44" x2="38" y2="38"/><line x1="74" y1="44" x2="82" y2="38"/><line x1="46" y1="76" x2="38" y2="82"/><line x1="74" y1="76" x2="82" y2="82"/><circle cx="60" cy="60" r="9"/>',
    battery: '<rect x="34" y="46" width="44" height="28" rx="4"/><rect x="78" y="54" width="6" height="12" rx="2"/><path d="M61 51 L52 64 H60 L57 75"/>',
    screen: '<rect x="40" y="32" width="40" height="46" rx="3"/><line x1="52" y1="84" x2="68" y2="84"/><line x1="48" y1="88" x2="72" y2="88"/>',
    camera: '<rect x="38" y="44" width="44" height="32" rx="5"/><circle cx="60" cy="60" r="9"/><circle cx="78" cy="52" r="2.5"/>',
    speaker: '<rect x="42" y="34" width="36" height="52" rx="6"/><circle cx="60" cy="56" r="9"/><circle cx="60" cy="76" r="3"/>',
    cable: '<rect x="42" y="48" width="16" height="28" rx="3"/><path d="M50 48 C50 30 74 30 74 50 C74 66 60 66 60 82"/>',
    case: '<rect x="44" y="30" width="32" height="60" rx="7"/><rect x="50" y="36" width="20" height="48" rx="4"/>',
    tool: '<line x1="44" y1="86" x2="70" y2="60"/><path d="M66 56 l10 -10 6 6 -10 10 z"/>',
    lamp: '<path d="M46 44 h28 l8 22 h-44 z"/><line x1="60" y1="66" x2="60" y2="84"/><line x1="48" y1="84" x2="72" y2="84"/>',
    chip: '<rect x="44" y="44" width="32" height="32" rx="4"/><line x1="52" y1="44" x2="52" y2="36"/><line x1="68" y1="44" x2="68" y2="36"/><line x1="44" y1="52" x2="36" y2="52"/><line x1="44" y1="68" x2="36" y2="68"/><line x1="76" y1="52" x2="84" y2="52"/><line x1="76" y1="68" x2="84" y2="68"/><line x1="52" y1="76" x2="52" y2="84"/><line x1="68" y1="76" x2="68" y2="84"/>',
    headphone: '<path d="M40 64 v-6 a20 20 0 0 1 40 0 v6"/><rect x="34" y="62" width="12" height="20" rx="5"/><rect x="74" y="62" width="12" height="20" rx="5"/>',
    gadget: '<rect x="40" y="42" width="40" height="36" rx="5"/><circle cx="60" cy="60" r="6"/><line x1="40" y1="72" x2="80" y2="72"/>'
  };
  function categoryImage(slug, name) {
    var c = catColor(slug, name), t = catType(slug, name);
    var icon = CAT_ICONS[t] || CAT_ICONS.phone;
    return '<svg class="cat-art" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(name) + '">' +
      '<rect width="120" height="120" rx="16" fill="' + c + '" fill-opacity="0.10"/>' +
      '<g fill="none" stroke="' + c + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' + icon + '</g></svg>';
  }

  function catImgUrl(c) {
    if (!c || !c.image) return "";
    return (/^(https?:|data:)/.test(c.image)) ? c.image : BASE + "/" + c.image.replace(/^\/+/, "");
  }
  function catMedia(c) {
    var u = catImgUrl(c);
    return u ? '<img src="' + esc(u) + '" alt="' + esc(c.name) + '" loading="lazy">' : categoryImage(c.slug, c.name);
  }

  /* ---------------- HOME ---------------- */
  function makeSlider(track) {
    if (!track) return;
    var originals = Array.prototype.slice.call(track.children);
    var n = originals.length;
    if (n < 2) return;
    var viewport = track.parentElement;
    var wrap = viewport.parentElement;
    function gap() {
      var cs = getComputedStyle(track);
      var g = parseFloat(cs.columnGap || cs.gap || "0");
      return isNaN(g) ? 0 : g;
    }
    function step() { return originals[0].getBoundingClientRect().width + gap(); }
    function perView() {
      var vw = viewport.getBoundingClientRect().width;
      return Math.max(1, Math.min(n, Math.round(vw / step())));
    }
    function buildClones() {
      Array.prototype.slice.call(track.querySelectorAll(".slider-clone")).forEach(function (c) { c.remove(); });
      var pv = perView(), i, c;
      for (i = 0; i < pv; i++) { c = originals[n - pv + i].cloneNode(true); c.classList.add("slider-clone"); track.appendChild(c); }
      for (i = 0; i < pv; i++) { c = originals[i].cloneNode(true); c.classList.add("slider-clone"); track.insertBefore(c, track.firstChild); }
      bindAddButtons(track);
    }
    var index = perView();
    function apply(animated) {
      track.style.transition = animated ? "transform .5s cubic-bezier(.22,.61,.36,1)" : "none";
      track.style.transform = "translateX(" + (-(index * step())) + "px)";
      if (!animated) { void track.offsetWidth; }
    }
    buildClones();
    apply(false);
    function move(dir) { index += dir; apply(true); }
    track.addEventListener("transitionend", function (e) {
      if (e.target !== track || e.propertyName !== "transform") return;
      if (index >= n + perView()) { index = perView(); apply(false); }
      else if (index < perView()) { index = n + perView(); apply(false); }
    });
    var prev = wrap.querySelector("[data-slider-prev]");
    var next = wrap.querySelector("[data-slider-next]");
    if (prev) prev.addEventListener("click", function () { move(-1); });
    if (next) next.addEventListener("click", function () { move(1); });
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { buildClones(); index = perView(); apply(false); }, 200);
    });
  }
  function fmtCountdown(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return "<span>" + p(h) + "</span>:<span>" + p(m) + "</span>:<span>" + p(sec) + "</span>";
  }
  function startHomeCountdowns() {
    ["homeCountdown", "flashCountdown"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var total = 8 * 3600 + 23 * 60 + 45;
      el.dataset.t = total;
      el.innerHTML = fmtCountdown(total);
    });
    if (!window.__hpTimer) {
      window.__hpTimer = setInterval(function () {
        ["homeCountdown", "flashCountdown"].forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          var t = parseInt(el.dataset.t, 10) - 1;
          if (t < 0) t = 8 * 3600 + 23 * 60 + 45;
          el.dataset.t = t;
          el.innerHTML = fmtCountdown(t);
        });
      }, 1000);
    }
  }
  function wireNewsletter() {
    var f = document.getElementById("newsletterForm");
    if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      f.innerHTML = '<div class="hp-news__thanks">Thanks for subscribing!</div>';
    });
  }

  function renderHome() {
    loading();
    var brandGroups = [
      { slug: "apple-parts", name: "Apple Parts", cls: "camp--apple" },
      { slug: "samsung-parts", name: "Samsung Parts", cls: "camp--samsung" },
      { slug: "p-series", name: "Huawei Parts", cls: "camp--huawei" },
      { slug: "xiaomi-parts", name: "Xiaomi Parts", cls: "camp--xiaomi" },
      { slug: "google-pixel-parts", name: "Google Pixel Parts", cls: "camp--google" }
    ];
    var preferred = ["apple-parts", "samsung-parts", "p-series", "xiaomi-parts", "google-pixel-parts", "devices", "accesoires", "cool-gadgets", "it-multimedia", "lamps-lighting"];
    var IN_STOCK = function (p) { return p.stock_status !== "outofstock"; };
    var calls = [
      getJSON(API + "/categories"),
      getJSON(API + "/products?page=1&stock[]=instock"),
      getJSON(API + "/products?sort=newest&page=1&stock[]=instock")
    ];
    brandGroups.slice(0, 4).forEach(function (b) { calls.push(getJSON(API + "/products?category=" + enc(b.slug) + "&page=1&stock[]=instock")); });

    Promise.all(calls).then(function (res) {
      var cats = res[0], popular = res[1].items.filter(IN_STOCK), news = res[2].items.filter(IN_STOCK);
      var brandProds = res.slice(3).map(function (r) { return { items: (r.items || []).filter(IN_STOCK) }; });
      var top = cats.filter(function (c) { return !c.parent_id; });
      var bySlug = {}; top.forEach(function (c) { bySlug[c.slug] = c; });
      var homeCats = preferred.filter(function (s) { return bySlug[s]; }).map(function (s) { return bySlug[s]; }).slice(0, 12);

      function sliderHtml(id, items) {
        var inner = items.length ? items.map(function (p) { return '<div class="slider-slide">' + productCard(p) + "</div>"; }).join("") : '<div class="slider-slide"><div class="empty">No products yet.</div></div>';
        return '<div class="slider" data-slider="' + id + '">' +
          '<button class="slider-arrow slider-arrow--prev" type="button" data-slider-prev aria-label="Previous">‹</button>' +
          '<div class="slider-viewport"><div class="slider-track" id="' + id + '">' + inner + "</div></div>" +
          '<button class="slider-arrow slider-arrow--next" type="button" data-slider-next aria-label="Next">›</button></div>';
      }
      function catSliderHtml(cats) {
        var inner = cats.map(function (c) { return '<div class="slider-slide cat-slide">' + c + "</div>"; }).join("");
        return '<div class="slider" data-slider="catRail">' +
          '<button class="slider-arrow slider-arrow--prev" type="button" data-slider-prev aria-label="Previous">‹</button>' +
          '<div class="slider-viewport"><div class="slider-track" id="catRail">' + inner + "</div></div>" +
          '<button class="slider-arrow slider-arrow--next" type="button" data-slider-next aria-label="Next">›</button></div>';
      }

      var heroMedia = (popular[0] ? '<div class="hp-hero__feature"><img src="' + esc(popular[0].image || PLACEHOLDER) + '" alt=""></div>' : "") +
        (popular[1] ? '<div class="hp-hero__float hp-hero__float--1"><img src="' + esc(popular[1].image || PLACEHOLDER) + '" alt=""></div>' : "") +
        (popular[2] ? '<div class="hp-hero__float hp-hero__float--2"><img src="' + esc(popular[2].image || PLACEHOLDER) + '" alt=""></div>' : "");

      var catItems = homeCats.map(function (c) {
        return '<a class="cat-card" ' + 'href="' + U("categories/" + c.slug) + '">' +
          '<span class="cat-card__media">' + catMedia(c) + '</span>' +
          '<span class="cat-card__name">' + esc(c.name) + '</span>' + '</a>';
      });

      var brandCards = brandGroups.slice(0, 4).map(function (b) {
        return '<a class="campaign-card ' + b.cls + '" href="' + U("categories/" + b.slug) + '"><div><span>Wholesale</span><h3>' + esc(b.name) + '</h3><p>Original &amp; compatible parts.</p><b>Shop now →</b></div></a>';
      }).join("");

      var bestCols = brandGroups.slice(0, 4).map(function (b, i) {
        var items = (brandProds[i] && brandProds[i].items) ? brandProds[i].items.slice(0, 3) : [];
        var list = items.length ? items.map(productCard).join("") : '<div class="empty">No products.</div>';
        return '<div class="bestseller-col"><h3 class="bestseller-col__title">' + esc(b.name) + '</h3><div class="bestseller-col__items">' + list + '</div></div>';
      }).join("");

      var brandStrip = ["Apple", "Samsung", "Huawei", "Xiaomi", "Google", "OnePlus", "OPPO", "Sony", "Nokia"].map(function (n) { return "<span>" + n + "</span>"; }).join("");

      var reviews = [
        { n: "TechRepair CH", t: "“Reliable parts and fast delivery across Switzerland. Our go-to B2B supplier.”", s: "Verified customer" },
        { n: "Lux GSM", t: "“Wholesale prices are unbeatable and the catalog is huge.”", s: "Verified customer" },
        { n: "iFix Lu", t: "“Quality tested components, minimal DOA. Highly recommended.”", s: "Verified customer" },
        { n: "MobilePro", t: "“Great support and quick restocking on high-demand models.”", s: "Verified customer" }
      ].map(function (r) {
        return '<div class="review-card"><div class="review-stars">★★★★★</div><p>' + r.t + '</p><div class="review-by"><b>' + r.n + '</b><small>' + r.s + '</small></div></div>';
      }).join("");

      app.innerHTML =
        '<section class="hp-hero"><div class="container hp-hero__inner">' +
          '<div class="hp-hero__copy"><span class="eyebrow">B2B Wholesale Supplier</span>' +
          "<h1>Wholesale Mobile Phone Parts &amp; Repair Equipment</h1>" +
          "<p>Original &amp; tested-compatible parts for Apple, Samsung, Huawei, Xiaomi and more. Net wholesale prices for registered business accounts.</p>" +
          '<div class="hp-hero__actions"><a class="btn btn-primary" href="' + U("shop") + '">Browse Catalog</a><a class="btn" href="' + U("account") + '">Open B2B Account</a></div>' +
          '<div class="hp-hero__stats"><div><b>10,000+</b><span>Products</span></div><div><b>6+</b><span>Brands</span></div><div><b>CH &amp; LU</b><span>Fast delivery</span></div></div>' +
          "</div>" +
          '<div class="hp-hero__media"><div class="hp-hero__badge">UP TO<br><strong>40%</strong><br>OFF</div>' + heroMedia + "</div>" +
        "</div></section>" +

        '<section class="section container"><div class="section-head"><h2>Top Categories</h2><a href="' + U("categories") + '">View all →</a></div>' +
          catSliderHtml(catItems) + "</section>" +

        '<section class="section container"><div class="section-head"><h2>Popular Products</h2><a href="' + U("shop") + '">View all →</a></div>' +
          sliderHtml("popularRail", popular) + "</section>" +

        '<section class="hp-deal container"><div class="hp-deal__copy"><span class="eyebrow">Exclusive B2B offer</span>' +
          "<h2>Stock Up &amp; Save on Wholesale Lots</h2>" +
          "<p>Order in bulk and unlock net wholesale pricing across the entire catalog.</p>" +
          '<a class="btn btn-primary" href="' + U("shop") + '">Shop the collection →</a></div>' +
          '<div class="hp-deal__count" id="homeCountdown"></div></section>' +

        '<section class="hp-trust container"><article><span class="hp-trust__ic">🚚</span><div><b>Fast Shipping</b><small>Switzerland &amp; Luxembourg</small></div></article>' +
          '<article><span class="hp-trust__ic">🏷️</span><div><b>B2B Pricing</b><small>Net wholesale rates</small></div></article>' +
          '<article><span class="hp-trust__ic">🛠️</span><div><b>Quality Parts</b><small>Original &amp; tested</small></div></article>' +
          '<article><span class="hp-trust__ic">🎧</span><div><b>Expert Support</b><small>Mon–Fri, 9–18h</small></div></article></section>' +

        '<section class="section container hp-flash"><div class="hp-flash__intro"><span class="hp-flash__ic">⚡</span><span>Limited time</span>' +
          "<h2>Today’s Wholesale Picks</h2><p>Hand-picked high-demand parts with the best margins.</p>" +
          '<div class="hp-flash__count" id="flashCountdown"></div></div>' +
          sliderHtml("flashRail", news) + "</section>" +

        '<section class="section container"><div class="section-head"><h2>Shop by Brand</h2><a href="' + U("shop") + '">All brands →</a></div>' +
          '<div class="campaign-grid">' + brandCards + "</div></section>" +

        '<section class="section container"><div class="section-head"><h2>New Arrivals</h2><a href="' + U("shop") + '">View all →</a></div>' +
          sliderHtml("newRail", news) + "</section>" +

        '<section class="section container"><div class="section-head"><h2>Best Sellers by Category</h2><a href="' + U("shop") + '">See rankings →</a></div>' +
          '<div class="bestseller-columns">' + bestCols + "</div></section>" +

        '<section class="hp-offers container">' +
          '<article class="offer-card"><span class="offer-card__ic">🎟️</span><div><span>Coupon code</span><h3>B2B10</h3><p>Extra 10% on first wholesale order.</p></div><button type="button" data-copy="B2B10">Copy code</button></article>' +
          '<article class="offer-card"><span class="offer-card__ic">🎁</span><div><span>Gift-ready</span><h3>Free wrapping</h3><p>Available on eligible orders.</p></div><a href="' + U("shop") + '">Learn more</a></article>' +
          '<article class="offer-card"><span class="offer-card__ic">💳</span><div><span>Payment offer</span><h3>Net 30 terms</h3><p>For approved business accounts.</p></div><a href="' + U("account") + '">See details</a></article>' +
        "</section>" +

        '<section class="hp-benefits"><div class="container hp-benefits__grid">' +
          '<article><span>⚡</span><div><b>Flash Deals</b><small>New offers daily</small></div></article>' +
          '<article><span>🎟️</span><div><b>Coupon Codes</b><small>Extra savings</small></div></article>' +
          '<article><span>🎁</span><div><b>Gift Cards</b><small>Sent by email</small></div></article>' +
          '<article><span>📦</span><div><b>Bundle Offers</b><small>More items, lower price</small></div></article>' +
          '<article><span>⭐</span><div><b>Loyalty Rewards</b><small>Earn on every order</small></div></article>' +
        "</div></section>" +

        '<section class="section container hp-reviews"><div class="section-head section-head--center"><div><h2>What Our Customers Say</h2><p>Verified feedback from wholesale partners.</p></div></div>' +
          '<div class="review-rail">' + reviews + "</div></section>" +

        '<section class="hp-brands container"><span class="hp-brands__label">Trusted brands:</span>' + brandStrip + "</section>" +

        '<section class="hp-news"><div class="container hp-news__inner">' +
          '<div class="hp-news__copy"><span class="hp-news__ic">✉️</span><div><h2>Subscribe to Our Newsletter</h2><p>New arrivals, exclusive offers and B2B coupon alerts.</p></div></div>' +
          '<form id="newsletterForm" class="hp-news__form"><input type="email" required placeholder="Enter your email address"><button type="submit">Subscribe</button></form>' +
        "</div></section>" + footerHtml();

      bindAddButtons();
      makeSlider(document.getElementById("catRail"));
      makeSlider(document.getElementById("popularRail"));
      makeSlider(document.getElementById("flashRail"));
      makeSlider(document.getElementById("newRail"));
      startHomeCountdowns();
      wireNewsletter();
    }).catch(function (e) { app.innerHTML = '<div class="loading">Failed to load: ' + esc(e.message) + "</div>"; });
  }

  /* ---------------- SHOP (AJAX filters, URL never changes) ---------------- */
  function enterShop(initial) {
    initial = initial || {};
    if (pendingShopInit) { initial = Object.assign({}, initial, pendingShopInit); pendingShopInit = null; }
    shopState = { category: initial.category || "", q: initial.q || "", sort: initial.sort || "", attributes: (initial.attributes || []).slice(), stock: (initial.stock || []).slice(), page: initial.page || 1, view: initial.view || "list" };
    loading();
    Promise.all([getJSON(API + "/categories"), getJSON(API + "/attributes")]).then(function (r) {
      shopCats = r[0]; shopAttrs = r[1];
      catById = {}; catSlugToId = {};
      shopCats.forEach(function (c) { catById[c.id] = c; catSlugToId[c.slug] = c.id; });
      renderShopShell();
      loadShop();
    }).catch(function (e) { app.innerHTML = '<div class="loading">Failed to load: ' + esc(e.message) + "</div>"; });
  }

  function renderShopShell() {
    var catHtml = '<div class="widget filter-cat-w"><h3 class="widget-title">Category Filter</h3>' +
      '<ul class="cat-filter-list">' +
      buildCategoryFilter(shopCats, shopState.category) +
      '</ul></div>';

    var stockHtml = buildStockFilter();

    var attrHtml = '<div class="widget"><h3 class="widget-title">Filter by Attribute</h3>';
    shopAttrs.slice(0, 8).forEach(function (a) {
      attrHtml += '<div class="attr-block"><strong class="attr-name">' + esc(a.name) + '</strong><ul class="attr-list">';
      a.values.slice(0, 8).forEach(function (v) {
        var key = a.slug + ":" + v.slug;
        attrHtml += '<li><label><input type="checkbox" class="attr-chk" value="' + esc(key) + '"> ' + esc(v.value) + "</label></li>";
      });
      attrHtml += "</ul></div>";
    });
    attrHtml += "</div>";

    app.innerHTML =
      '<div class="container"><div class="breadcrumb"><a href="' + U("") + '">Home</a> / <a href="' + U("shop") + '">Shop</a>' +
      (shopState.category ? ' / <span id="crumb-cat"></span>' : "") + "</div></div>" +
      '<div class="shop-layout container">' +
      '<aside class="sidebar" id="shop-sidebar">' +
      '<div class="sidebar-body" id="sidebar-body"><div class="sidebar-inner">' + catHtml + stockHtml + attrHtml + "</div></div>" +
      "</aside>" +
      '<div class="shop-main" id="shop-main">' +
      buildCategoryCarousel() +
      '<div class="toolbar"><span class="result-count" id="result-count"></span>' +
      '<div class="toolbar-right">' +
      '<div class="view-toggle">' +
      '<button type="button" class="view-btn' + (shopState.view === "list" ? " active" : "") + '" data-view="list" id="view-list" aria-label="List view">&#9776; List</button>' +
      '<button type="button" class="view-btn' + (shopState.view === "grid" ? " active" : "") + '" data-view="grid" id="view-grid" aria-label="Grid view">&#9783; Grid</button>' +
      '</div>' +
      '<select class="sort-select" id="sort-select">' +
      '<option value="">Sort: Default</option><option value="newest">Newest</option>' +
      '<option value="name">Name A–Z</option><option value="price">Price low–high</option></select>' +
      '</div></div>' +
      '<div class="products" id="products-grid"></div>' +
      '<div class="pagination" id="shop-pagination"></div>' +
      "</div></div>";

    bindShopEvents();

    if (shopState.category && catById[catSlugToId[shopState.category]]) {
      document.getElementById("crumb-cat").textContent = catById[catSlugToId[shopState.category]].name;
    }
  }

  function childrenOfCat(slug) {
    var id = catSlugToId[slug];
    if (!id) return [];
    return shopCats.filter(function (c) { return c.parent_id === id; });
  }

  function buildCategoryCarousel() {
    if (!shopState.category || !catSlugToId[shopState.category]) return "";
    var kids = childrenOfCat(shopState.category);
    if (!kids.length) return "";
      var items = kids.map(function (c) {
        return '<div class="pop-cat"><a href="' + U("categories/" + c.slug) + '">' +
          '<span class="pop-cat__img">' + catMedia(c) + "</span>" +
          '<span class="pop-cat__name">' + esc(c.name) + "</span></a></div>";
      }).join("");
    return '<section class="pop-cats container"><div class="pop-cats__head">' +
      '<h3 class="pop-cats__title">Popular Categories</h3>' +
      '<div class="pop-cats__nav"><button type="button" class="pop-prev" aria-label="Previous">‹</button>' +
      '<button type="button" class="pop-next" aria-label="Next">›</button></div></div>' +
      '<div class="pop-cats__track" id="pop-cats-track">' + items + "</div></section>";
  }

  function renderCategories() {
    loading();
    getJSON(API + "/categories").then(function (cats) {
      var byParent = {}, tops = [], allCats = {};
      cats.forEach(function (c) {
        allCats[c.id] = c;
        if (c.parent_id == null) tops.push(c);
        else (byParent[c.parent_id] = byParent[c.parent_id] || []).push(c);
      });
      function descendants(id, out) {
        (byParent[id] || []).forEach(function (c) { out.push(c); descendants(c.id, out); });
        return out;
      }
      var html = '<section class="section container"><div class="section-head"><h2>All Categories</h2><a href="' + U("shop") + '">Browse all products →</a></div>';
      tops.forEach(function (t) {
        var all = [t].concat(descendants(t.id, []));
        html += '<div class="cat-group"><div class="cat-group__title"><a href="' + U("categories/" + t.slug) + '">' + esc(t.name) + " (" + all.length + ")</a></div>";
        html += '<div class="cat-grid">';
        all.forEach(function (c) {
          html += '<a class="cat-tile" href="' + U("categories/" + c.slug) + '">' +
            '<span class="cat-tile__media">' + catMedia(c) + "</span>" +
            '<span class="cat-tile__name">' + esc(c.name) + "</span></a>";
        });
        html += "</div></div>";
      });
      html += "</section>";
      app.innerHTML = html;
      window.scrollTo(0, 0);
    }).catch(function (e) {
      app.innerHTML = '<div class="loading">Failed to load: ' + esc(e.message) + "</div>";
    });
  }

  function buildCategoryFilter(cats, activeSlug) {
    var childrenOf = {}, topList = [];
    cats.forEach(function (c) {
      if (c.parent_id) (childrenOf[c.parent_id] = childrenOf[c.parent_id] || []).push(c);
      else topList.push(c);
    });
    function item(val, label, back) {
      var checked = (val && val === activeSlug) ? " checked" : "";
      return '<li class="cat-filter-item' + (back ? " cat-filter-back" : "") + '"><label><input type="checkbox" class="cat-chk" value="' + esc(val) + '"' + checked + '> <span class="cat-name" title="' + esc(label) + '">' + esc(label) + "</span></label></li>";
    }
    var html = item("", "All Categories", false);
    var cur = (activeSlug && catSlugToId[activeSlug]) ? catById[catSlugToId[activeSlug]] : null;
    if (cur && cur.parent_id && catById[cur.parent_id]) {
      var par = catById[cur.parent_id];
      html += item(par.slug, "← Back to " + par.name, true);
    }
    var roots = cur ? (childrenOf[cur.id] || []) : topList;
    if (roots.length === 0 && cur) roots = [cur];
    html += roots.map(function (c) { return item(c.slug, c.name, false); }).join("");
    return html;
  }

  function buildStockFilter() {
    var opts = [
      { v: "instock", l: "In stock" },
      { v: "outofstock", l: "Out of stock" }
    ];
    return '<div class="widget"><h3 class="widget-title">Availability</h3><ul class="stock-filter-list">' +
      opts.map(function (o) {
        var checked = (shopState.stock.indexOf(o.v) >= 0) ? " checked" : "";
        return '<li class="stock-filter-item"><label><input type="checkbox" class="stock-chk" value="' + o.v + '"' + checked + '> ' + o.l + "</label></li>";
      }).join("") +
      "</ul></div>";
  }

  function bindShopEvents() {
    var sb = document.getElementById("shop-sidebar");
    var ct = document.getElementById("cat-toggle");
    var track = document.getElementById("pop-cats-track");
    if (track) {
      var prev = document.querySelector(".pop-prev");
      var next = document.querySelector(".pop-next");
      if (prev) prev.addEventListener("click", function () { track.scrollBy({ left: -220, behavior: "smooth" }); });
      if (next) next.addEventListener("click", function () { track.scrollBy({ left: 220, behavior: "smooth" }); });
    }
    if (ct) ct.addEventListener("click", function () {
      ct.closest(".filter-cat").classList.toggle("collapsed");
    });
    sb.addEventListener("click", function (e) {
      var caret = e.target.closest(".cat-caret:not(.leaf)");
      if (caret) {
        var node = caret.closest(".cat-node");
        node.classList.toggle("open");
        caret.classList.toggle("open");
        return;
      }
      var link = e.target.closest(".cat-link");
      if (link) {
        e.preventDefault(); e.stopPropagation();
        shopState.category = link.getAttribute("data-cat") || "";
        shopState.page = 1;
        loadShop();
        var node = link.closest(".cat-node");
        if (node && node.classList.contains("has-children")) {
          var open = node.classList.toggle("open");
          var c = node.querySelector(".cat-caret:not(.leaf)");
          if (c) c.classList.toggle("open", open);
        }
      }
    });
    sb.addEventListener("change", function (e) {
      if (e.target.classList.contains("attr-chk")) {
        var list = [];
        sb.querySelectorAll(".attr-chk:checked").forEach(function (cb) { list.push(cb.value); });
        shopState.attributes = list;
        shopState.page = 1;
        loadShop();
      } else if (e.target.classList.contains("stock-chk")) {
        var slist = [];
        sb.querySelectorAll(".stock-chk:checked").forEach(function (cb) { slist.push(cb.value); });
        shopState.stock = slist;
        shopState.page = 1;
        loadShop();
      } else if (e.target.classList.contains("cat-chk")) {
        var val = e.target.value || "";
        location.href = val ? U("categories/" + val) : U("shop");
      }
    });
    var ss = document.getElementById("sort-select");
    ss.addEventListener("change", function () { shopState.sort = ss.value; shopState.page = 1; loadShop(); });

    document.querySelectorAll(".view-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        shopState.view = b.getAttribute("data-view");
        paintProducts();
        document.querySelectorAll(".view-btn").forEach(function (x) {
          x.classList.toggle("active", x.getAttribute("data-view") === shopState.view);
        });
      });
    });

    var sm = document.getElementById("shop-main");
    sm.addEventListener("click", function (e) {
      var a = e.target.closest(".page-link");
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      shopState.page = +a.getAttribute("data-page");
      loadShop();
    });
    var sp = document.getElementById("shop-pagination");
    if (sp) sp.addEventListener("click", function (e) {
      if (!e.target.closest(".load-more")) return;
      e.preventDefault();
      shopState.page++;
      loadShop();
    });
  }

  function paintProducts() {
    var el = document.getElementById("products-grid");
    if (!el) return;
    el.className = "products view-" + (shopState.view || "list");
    el.innerHTML = allItems.length ? allItems.map(productCard).join("") : '<div class="empty-cart">No products found.</div>';
    bindAddButtons(el);
  }

  function loadShop() {
    var params = [];
    if (shopState.q) params.push("q=" + enc(shopState.q));
    if (shopState.category) params.push("category=" + enc(shopState.category));
    if (shopState.sort) params.push("sort=" + enc(shopState.sort));
    shopState.attributes.forEach(function (a) { params.push("attribute[]=" + enc(a)); });
    shopState.stock.forEach(function (s) { params.push("stock[]=" + enc(s)); });
    params.push("page=" + shopState.page);

    getJSON(API + "/products?" + params.join("&")).then(function (data) {
      var items = data.items || [], total = data.total || 0;
      if (shopState.page === 1) allItems = items; else allItems = allItems.concat(items);
      document.getElementById("result-count").textContent = total + " products";
      renderLoadMore(total);
      paintProducts();
      if (shopState.page === 1 && !document.querySelector(".site-footer")) {
        app.insertAdjacentHTML("beforeend", footerHtml());
      }
      syncSidebar();
      var sm = document.getElementById("shop-main");
      if (sm && shopState.page === 1 && window.scrollY > sm.offsetTop) window.scrollTo({ top: sm.offsetTop - 90, behavior: "smooth" });
    }).catch(function (e) {
      var g = document.getElementById("products-grid");
      if (g) g.innerHTML = '<div class="loading">Failed: ' + esc(e.message) + "</div>";
    });
  }

  function renderLoadMore(total) {
    var box = document.getElementById("shop-pagination");
    if (!box) return;
    box.innerHTML = (allItems.length < total)
      ? '<button type="button" class="load-more" id="load-more">Load more</button>'
      : "";
  }

  function syncSidebar() {
    var sb = document.getElementById("shop-sidebar");
    if (!sb) return;
    Array.prototype.forEach.call(sb.querySelectorAll(".cat-chk"), function (cb) {
      cb.checked = (cb.value === shopState.category);
    });
    Array.prototype.forEach.call(sb.querySelectorAll(".attr-chk"), function (cb) {
      cb.checked = shopState.attributes.indexOf(cb.value) >= 0;
    });
    Array.prototype.forEach.call(sb.querySelectorAll(".stock-chk"), function (cb) {
      cb.checked = shopState.stock.indexOf(cb.value) >= 0;
    });
    var crumb = document.getElementById("crumb-cat");
    if (crumb) {
      crumb.textContent = (shopState.category && catById[catSlugToId[shopState.category]]) ? catById[catSlugToId[shopState.category]].name : "";
    }
    var ss = document.getElementById("sort-select");
    if (ss) ss.value = shopState.sort || "";
  }

  /* ---------------- PRODUCT DETAIL ---------------- */
  function renderProduct(slug) {
    loading();
    getJSON(API + "/products/" + enc(slug)).then(function (d) {
      var p = d.product;
      var prices = d.prices || [];
      var wholesale = null, retail = null;
      prices.forEach(function (x) { if (x.customer_group === "wholesale") wholesale = parseFloat(x.price); if (x.customer_group === "retail") retail = parseFloat(x.price); });
      var cats = d.categories || [];
      var attrs = d.attributes || [];
      var media = (d.media && d.media.length) ? d.media : [{ file_path: p.image, alt: p.name }];
      var imgs = media.map(function (m) { return m.file_path; });
      if (p.image && imgs.indexOf(p.image) < 0) imgs.unshift(p.image);
      if (!imgs.length) imgs = [PLACEHOLDER];
      var out = (p.stock_status === "outofstock");

      var thumbHtml = imgs.map(function (src, i) {
        return '<img src="' + esc(src) + '" class="' + (i === 0 ? "active" : "") + '" data-img="' + esc(src) + '">';
      }).join("");

      var attrRows = attrs.map(function (a) {
        return "<tr><td>" + esc(a.attr) + "</td><td>" + esc(a.value) + "</td></tr>";
      }).join("");

      app.innerHTML =
        '<div class="container">' +
        '<div class="breadcrumb"><a href="' + U("") + '">Home</a> / <a href="' + U("shop") + '">Shop</a> / ' + esc(p.name) + "</div>" +
        '<div class="single-product">' +
        '<div class="gallery"><div class="main-image"><img id="main-img" src="' + esc(imgs[0]) + '" alt="' + esc(p.name) + '"></div>' +
        '<div class="thumbs">' + thumbHtml + "</div></div>" +
        '<div class="summary">' +
        '<h1 class="product_title">' + esc(p.name) + "</h1>" +
        '<div class="sku">SKU: ' + esc(p.sku) + (cats.length ? " &nbsp;|&nbsp; " + esc(cats[0].name) : "") + "</div>" +
        (state.b2b ? '<div class="price-big">' + money(wholesale != null ? wholesale : (retail != null ? retail : 0)) + "</div>" : '<div class="loginprices"><a href="' + U("account") + '">Login / Register for Pricing</a></div>') +
        stockHtml(p.stock_status, p.stock) +
        (out ? "" : '<div class="qty-row"><label>Qty</label><input type="number" id="pd-qty" value="1" min="1"></div>' +
          '<div class="pd-actions"><button class="btn btn-primary" id="pd-add">Add to cart</button><button class="btn wl-heart-btn" id="pd-wishlist" data-wl="' + p.id + '" data-slug="' + esc(p.slug) + '">♥ Wishlist</button></div>') +
        (attrRows ? '<div class="attrs"><table class="attr-table">' + attrRows + "</table></div>" : "") +
        "</div></div>" +

        '<div class="tabs"><div class="tabs-nav"><button class="active" data-tab="desc">Description</button>' +
        (cats.length ? '<button data-tab="cat">Categories</button>' : "") + "</div>" +
        '<div class="tab-panel active" id="tab-desc">' + (p.description ? esc(p.description) : "<p>No description available.</p>") + "</div>" +
        (cats.length ? '<div class="tab-panel" id="tab-cat">' + cats.map(function (c) { return '<a href="' + U("categories/" + c.slug) + '">' + esc(c.name) + "</a>"; }).join(", ") + "</div>" : "") +
        "</div>" +

        '<div class="related section"><div class="section-head"><h2>Related Products</h2></div><div class="products" id="related"></div></div>' +
        "</div>";

      Array.prototype.forEach.call(app.querySelectorAll(".thumbs img"), function (t) {
        t.addEventListener("click", function () {
          document.getElementById("main-img").src = t.getAttribute("data-img");
          app.querySelectorAll(".thumbs img").forEach(function (x) { x.classList.remove("active"); });
          t.classList.add("active");
        });
      });
      Array.prototype.forEach.call(app.querySelectorAll(".tabs-nav button"), function (b) {
        b.addEventListener("click", function () {
          app.querySelectorAll(".tabs-nav button").forEach(function (x) { x.classList.remove("active"); });
          app.querySelectorAll(".tab-panel").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          document.getElementById("tab-" + b.getAttribute("data-tab")).classList.add("active");
        });
      });
      if (!out) {
        document.getElementById("pd-add").addEventListener("click", function () {
          var qty = parseInt(document.getElementById("pd-qty").value, 10) || 1;
          addToCart({ id: p.id, slug: p.slug, name: p.name, image: imgs[0], sku: p.sku, price: (state.b2b ? (wholesale != null ? wholesale : retail) : null) }, qty);
        });
        document.getElementById("pd-wishlist").addEventListener("click", function () {
          toggleWishlist({ id: p.id, slug: p.slug, name: p.name, image: imgs[0], sku: p.sku, price: (state.b2b ? (p.price != null ? p.price : null) : null) });
        });
      }

      function appendFooter() { if (!document.querySelector(".site-footer")) app.insertAdjacentHTML("beforeend", footerHtml()); }
      if (cats.length) {
        getJSON(API + "/products?category=" + enc(cats[0].slug) + "&page=1").then(function (rel) {
          var relEl = document.getElementById("related");
          if (relEl) relEl.innerHTML = (rel.items || []).filter(function (x) { return x.id !== p.id; }).slice(0, 4).map(productCard).join("") || '<div class="empty-cart">No related products.</div>';
          bindAddButtons(relEl);
          appendFooter();
        }).catch(appendFooter);
      } else { appendFooter(); }
    }).catch(function (e) { app.innerHTML = '<div class="loading">Product not found: ' + esc(e.message) + "</div>"; });
  }

  /* ---------------- CART PAGE ---------------- */
  function renderCart() {
    if (!state.cart.length) {
      app.innerHTML = '<div class="container">' + breadcrumb([{ label: "Shop", href: U("shop") }, { label: "Cart" }]) + '<div class="empty-cart">Your cart is empty.<br><a class="btn btn-primary" href="' + U("shop") + '">Continue Shopping</a></div>' + footerHtml();
      return;
    }
    var rows = state.cart.map(function (i) {
      return "<tr><td><img src=\"" + esc(i.image || PLACEHOLDER) + "\" alt=\"\"></td><td>" + esc(i.name) +
        "<br><small>SKU: " + esc(i.sku) + "</small></td><td>" + (state.b2b ? (i.price != null ? money(i.price) : "Login for price") : '<a class="mc-login" href="' + U("account") + '">Login for price</a>') +
        "</td><td><input class=\"qty\" min=\"1\" value=\"" + i.qty + "\" data-qty=\"" + i.id + "\"></td>" +
        "<td>" + (state.b2b ? (i.price != null ? money(i.price * i.qty) : "—") : '<a class="mc-login" href="' + U("account") + '">Login for price</a>') + "</td>" +
        '<td><button class="btn" data-rm="' + i.id + '">Remove</button></td></tr>';
    }).join("");
    var total = state.cart.reduce(function (s, i) { return s + (i.price != null ? i.price * i.qty : 0); }, 0);
    app.innerHTML =
      '<div class="container">' + breadcrumb([{ label: "Shop", href: U("shop") }, { label: "Cart" }]) +
      '<div class="page-head"><h1>Shopping Cart</h1></div>' +
      '<table class="cart-table"><thead><tr><th></th><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr></thead><tbody>' +
      rows + "</tbody></table>" +
      '<div class="cart-actions"><a class="btn" href="' + U("shop") + '">← Continue Shopping</a></div>' +
      '<div class="cart-totals"><div class="row"><span>Subtotal</span><span>' + (state.b2b ? money(total) : '<a class="mc-login" href="' + U("account") + '">Login for price</a>') + "</span></div>" +
      '<div class="row"><span>Shipping</span><span>Calculated at checkout</span></div>' +
      '<div class="row total"><span>Total</span><span>' + (state.b2b ? money(total) : '<a class="mc-login" href="' + U("account") + '">Login for price</a>') + "</span></div>" +
      '<button class="btn btn-primary btn-block" id="checkout-btn" style="margin-top:14px">Proceed to Checkout</button></div></div>' + footerHtml();

    Array.prototype.forEach.call(app.querySelectorAll("[data-qty]"), function (inp) {
      inp.addEventListener("change", function () { updateQty(+this.getAttribute("data-qty"), +this.value); });
    });
    Array.prototype.forEach.call(app.querySelectorAll("[data-rm]"), function (b) {
      b.addEventListener("click", function () { removeFromCart(+b.getAttribute("data-rm")); });
    });
    document.getElementById("checkout-btn").addEventListener("click", function () {
      if (!state.b2b) { openLogin(); return; }
      alert("Checkout is not enabled in this preview build.");
    });
  }

  /* ---------------- ACCOUNT / LOGIN ---------------- */
  function renderAccount() {
    if (state.b2b) {
      app.innerHTML = '<div class="container">' + breadcrumb([{ label: "Account", href: U("account") }, { label: "Dashboard" }]) + '<div class="myaccount">' +
        '<nav class="myaccount-nav"><ul>' +
          '<li class="is-active" data-pane="dashboard"><a href="#">Dashboard</a></li>' +
          '<li data-pane="orders"><a href="#">Orders</a></li>' +
          '<li data-pane="downloads"><a href="#">Downloads</a></li>' +
          '<li data-pane="addresses"><a href="#">Addresses</a></li>' +
          '<li data-pane="details"><a href="#">Account details</a></li>' +
          '<li><a href="#" id="acct-logout">Log out</a></li>' +
        '</ul></nav>' +
        '<div class="myaccount-content">' +
          '<div class="acct-pane" id="pane-dashboard">' +
            '<p class="acct-greeting">Hello <strong>wholesale@demo.ch</strong> (not <strong>wholesale@demo.ch</strong>? <a href="#" id="acct-logout2">Log out</a>)</p>' +
            '<p>From your account dashboard you can view your recent orders, manage your shipping and billing addresses, and edit your password and account details.</p>' +
            '<div class="acct-cards">' +
              '<a class="acct-card" href="#" data-pane="orders"><b>0</b><span>Orders</span></a>' +
              '<a class="acct-card" href="#" data-pane="downloads"><b>0</b><span>Downloads</span></a>' +
              '<a class="acct-card" href="#" data-pane="addresses"><b>0</b><span>Addresses</span></a>' +
            '</div>' +
          '</div>' +
          '<div class="acct-pane" id="pane-orders" style="display:none"><h2>Orders</h2><div class="acct-empty">No orders yet.</div></div>' +
          '<div class="acct-pane" id="pane-downloads" style="display:none"><h2>Downloads</h2><div class="acct-empty">No downloads available.</div></div>' +
          '<div class="acct-pane" id="pane-addresses" style="display:none"><h2>Addresses</h2><div class="acct-empty">No addresses saved.</div></div>' +
          '<div class="acct-pane" id="pane-details" style="display:none"><h2>Account details</h2>' +
            '<form class="acct-form" id="acct-details-form">' +
              '<label>Email address</label><input type="email" value="wholesale@demo.ch" readonly>' +
              '<label>New password</label><input type="password" placeholder="Enter new password">' +
              '<button type="submit" class="btn btn-primary">Save changes</button>' +
            '</form>' +
            '<p class="account-note" id="details-saved" style="display:none;color:var(--primary)">Account details saved.</p>' +
          '</div>' +
        '</div>' +
      '</div></div>' + footerHtml();

      function switchPane(name) {
        app.querySelectorAll(".myaccount-nav li").forEach(function (li) { li.classList.remove("is-active"); });
        var navLi = app.querySelector('.myaccount-nav li[data-pane="' + name + '"]');
        if (navLi) navLi.classList.add("is-active");
        app.querySelectorAll(".acct-pane").forEach(function (p) { p.style.display = "none"; });
        var pane = document.getElementById("pane-" + name);
        if (pane) pane.style.display = "block";
      }
      app.querySelectorAll("[data-pane]").forEach(function (el) {
        el.addEventListener("click", function (e) { e.preventDefault(); switchPane(el.getAttribute("data-pane")); });
      });
      var doLogout = function (e) {
        if (e) e.preventDefault();
        state.b2b = false; localStorage.removeItem("ft_b2b");
        state.cart.forEach(function (i) { i.price = null; }); saveCart();
        renderCartHeader(); renderDrawer(); closeAllPanels(); renderAccount();
      };
      var lo = document.getElementById("acct-logout"); if (lo) lo.addEventListener("click", doLogout);
      var lo2 = document.getElementById("acct-logout2"); if (lo2) lo2.addEventListener("click", doLogout);
      var df = document.getElementById("acct-details-form"); if (df) df.addEventListener("submit", function (e) { e.preventDefault(); document.getElementById("details-saved").style.display = "block"; });
      return;
    }
    app.innerHTML = '<div class="container">' + breadcrumb([{ label: "Account", href: U("account") }, { label: "Login" }]) + '<div class="myaccount-login">' +
      '<div class="login-col">' +
        '<h2>Login</h2>' +
        '<form id="acct-form">' +
          '<label>Username or email address</label>' +
          '<input type="text" id="acct-email" value="wholesale@demo.ch" required>' +
          '<label>Password</label>' +
          '<input type="password" id="acct-pass" value="demo1234" required>' +
          '<label class="remember"><input type="checkbox" checked> Remember me</label>' +
          '<button type="submit" class="btn btn-primary btn-block">Log in</button>' +
          '<p class="lost-pass"><a href="#">Lost your password?</a></p>' +
        '</form>' +
      '</div>' +
      '<div class="register-col">' +
        '<h2>Register</h2>' +
        '<form id="reg-form">' +
          '<label>Email address</label>' +
          '<input type="email" id="reg-email" required>' +
          '<label>Password</label>' +
          '<input type="password" id="reg-pass" required>' +
          '<button type="submit" class="btn btn-primary btn-block">Register</button>' +
        '</form>' +
        '<p class="account-note">Registration is reviewed by our team. Use the demo credentials above to preview wholesale pricing.</p>' +
      '</div>' +
    '</div></div>' + footerHtml();
    document.getElementById("acct-form").addEventListener("submit", function (e) { e.preventDefault(); doLogin(); });
    document.getElementById("reg-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var n = document.getElementById("reg-email");
      alert("Thank you! Registration for " + (n.value || "your email") + " will be reviewed by our team.");
    });
  }
  function doLogin() {
    state.b2b = true; localStorage.setItem("ft_b2b", "1");
    closeLogin();
    refreshCartPrices();
    renderCartHeader(); renderDrawer();
    route();
  }
  function refreshCartPrices() {
    if (!state.b2b || !state.cart.length) return;
    var pending = state.cart.filter(function (i) { return i.price == null; });
    if (!pending.length) return;
    var proms = pending.map(function (i) {
      return getJSON(API + "/products/" + enc(i.slug)).then(function (d) {
        var prices = d.prices || [], w = null, r = null;
        prices.forEach(function (x) { if (x.customer_group === "wholesale") w = parseFloat(x.price); if (x.customer_group === "retail") r = parseFloat(x.price); });
        i.price = (w != null ? w : (r != null ? r : null));
        saveCart();
      }).catch(function () {});
    });
    if (typeof Promise !== "undefined" && Promise.all) {
      Promise.all(proms).then(function () {
        renderCartHeader(); renderDrawer();
        if (parseRoute().path === "cart") route();
      });
    }
  }
  function openLogin() { document.getElementById("login-modal").classList.add("open"); }
  function closeLogin() { document.getElementById("login-modal").classList.remove("open"); }

  /* ---------------- INIT ---------------- */
  function init() {
    var yrEl = document.getElementById("year"); if (yrEl) yrEl.textContent = new Date().getFullYear();
    buildNav();
    setupSearch();
    renderCartHeader();
    renderDrawer();

    // Intercept internal links; resolve relative hrefs against <base>.
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented) return;
      var a = e.target.closest("a");
      if (!a) return;
      if (a.target === "_blank") return;
      var href = a.getAttribute("href");
      if (!href) return;
      var abs = new URL(href, document.baseURI);
      if (abs.origin !== location.origin) return;
      if (abs.pathname === location.pathname && abs.search === location.search) { e.preventDefault(); return; }
      e.preventDefault();
      closeAllPanels();
      pushUrl(abs.pathname + abs.search);
    });

    document.getElementById("cart-drawer-close").addEventListener("click", closeDrawer);
    document.getElementById("overlay").addEventListener("click", closeDrawer);
    document.getElementById("menu-extra-register").addEventListener("click", function (e) {
      e.preventDefault();
      if (state.b2b) togglePanel("account-menu");
      else openLogin();
    });
    function doLogout(e) {
      if (e) e.preventDefault();
      state.b2b = false; localStorage.removeItem("ft_b2b");
      state.cart.forEach(function (i) { i.price = null; }); saveCart();
      renderCartHeader(); renderDrawer(); closeAllPanels(); route();
    }
    var accLogout = document.getElementById("account-logout");
    if (accLogout) accLogout.addEventListener("click", doLogout);
    var accLogout2 = document.getElementById("account-logout-2");
    if (accLogout2) accLogout2.addEventListener("click", doLogout);
    document.getElementById("icon-cart-contents").addEventListener("click", function (e) { e.preventDefault(); togglePanel("mini-cart"); });
    document.getElementById("icon-wishlist-contents").addEventListener("click", function (e) { e.preventDefault(); renderWishlist(); togglePanel("wishlist-panel"); });
    var c2 = document.getElementById("icon-cart-contents-2");
    if (c2) c2.addEventListener("click", function (e) { e.preventDefault(); togglePanel("mini-cart-2"); });
    var w2 = document.getElementById("icon-wishlist-contents-2");
    if (w2) w2.addEventListener("click", function (e) { e.preventDefault(); renderWishlistInto(document.getElementById("wishlist-panel-2")); togglePanel("wishlist-panel-2"); });
    var a2 = document.getElementById("menu-extra-register-2");
    if (a2) a2.addEventListener("click", function (e) { e.preventDefault(); if (state.b2b) togglePanel("account-menu-2"); else openLogin(); });
    document.addEventListener("click", function (e) {
      if (e.target.closest("#mini-cart") || e.target.closest("#account-menu") || e.target.closest("#wishlist-panel") || e.target.closest("#mini-cart-2") || e.target.closest("#account-menu-2") || e.target.closest("#wishlist-panel-2")) return;
      if (e.target.closest(".menu-item-cart") || e.target.closest(".menu-item-account") || e.target.closest(".menu-item-wishlist") || e.target.closest(".nav-actions")) return;
      closeAllPanels();
    });
    updateWishlistCount();
    updateWishlistHearts();
    var mt = document.getElementById("menu-toggle");
    var md = document.getElementById("menu-dropdown");
    if (mt && md) {
      mt.addEventListener("click", function (e) { e.stopPropagation(); md.classList.toggle("open"); });
      md.addEventListener("click", function (e) { if (e.target.closest("a")) md.classList.remove("open"); });
      document.addEventListener("click", function (e) { if (!md.contains(e.target) && e.target !== mt) md.classList.remove("open"); });
    }
    var navSentinel = document.querySelector(".nav-sticky-sentinel");
    var navWrap = document.getElementById("primaryNavWrap");
    var navSpacer = document.getElementById("navStickySpacer");
    if (navSentinel && navWrap && navSpacer && "IntersectionObserver" in window) {
      var navObserver = new IntersectionObserver(function (entries) {
        var stuck = !entries[0].isIntersecting;
        navWrap.classList.toggle("is-stuck", stuck);
        navSpacer.classList.toggle("is-active", stuck);
      }, { rootMargin: "-1px 0px 0px 0px", threshold: 0 });
      navObserver.observe(navSentinel);
    }
    document.getElementById("login-close").addEventListener("click", closeLogin);
    document.getElementById("login-modal").addEventListener("click", function (e) { if (e.target === this) closeLogin(); });
    document.getElementById("login-form").addEventListener("submit", function (e) { e.preventDefault(); doLogin(); });

    window.addEventListener("popstate", route);
    route();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
