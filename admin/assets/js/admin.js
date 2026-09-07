/* Ferry Admin Console — zero-dependency vanilla JS SPA */
(function () {
  "use strict";

  const APP_ROOT = location.pathname.replace(/\/admin\/?.*$/, "");
  const API = APP_ROOT + "/api/admin/";
  const IMG = APP_ROOT + "/";

  let token = null;
  let user = null;

  /* ---------- helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  async function api(method, path, body) {
    const headers = { Accept: "application/json" };
    let payload;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    if (token) headers["X-CSRF-Token"] = token;
    const res = await fetch(API + path, { method, headers, body: payload });
    if (res.status === 401) {
      showLogin();
      throw new Error("auth");
    }
    let j;
    try {
      j = await res.json();
    } catch (e) {
      throw new Error("Bad server response");
    }
    if (!j.ok) throw new Error(j.error || "Request failed");
    return j.data;
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  function modal(title, bodyHtml, footerHtml) {
    $("#modal").innerHTML =
      `<div class="modal-head"><h3>${esc(title)}</h3><button class="x" onclick="Admin.closeModal()">×</button></div>` +
      `<div class="modal-body">${bodyHtml}</div>` +
      (footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : "");
    $("#modal-backdrop").hidden = false;
  }
  function closeModal() {
    $("#modal-backdrop").hidden = true;
  }
  window.Admin = { closeModal };

  async function confirmDialog(msg) {
    return new Promise((resolve) => {
      modal(
        "Please confirm",
        `<p class="section-desc">${esc(msg)}</p>`,
        `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button>
         <button class="btn btn-danger" id="cf-yes">Confirm</button>`
      );
      $("#cf-yes").onclick = () => {
        closeModal();
        resolve(true);
      };
    });
  }

  function can(perm) {
    return user && (user.permissions.includes(perm) || user.permissions.includes("*"));
  }
  function badge(status) {
    const map = {
      active: "badge-green",
      inactive: "badge-red",
      publish: "badge-green",
      draft: "badge-amber",
      completed: "badge-green",
      processing: "badge-blue",
      pending: "badge-amber",
      cancelled: "badge-red",
      refunded: "badge-gray",
      onhold: "badge-gray",
    };
    const cls = map[String(status).toLowerCase()] || "badge-gray";
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  }
  const img = (p) => (p ? IMG + p : "");

  /* ---------- nav ---------- */
  const NAV = [
    { route: "dashboard", label: "Dashboard", icon: "▦", perm: "dashboard.view" },
    { route: "products", label: "Products", icon: "▣", perm: "products.view" },
    { route: "categories", label: "Categories", icon: "▤", perm: "categories.view" },
    { route: "attributes", label: "Attributes", icon: "◆", perm: "attributes.view" },
    { route: "media", label: "Media", icon: "▢", perm: "media.view" },
    { route: "customers", label: "Customers", icon: "👤", perm: "customers.view" },
    { route: "orders", label: "Orders", icon: "▰", perm: "orders.view" },
    { route: "content", label: "Content", icon: "✎", perm: "content.view" },
    { route: "settings", label: "Settings", icon: "⚙", perm: "settings.view" },
    { route: "users", label: "Admin Users", icon: "⛁", perm: "admin_users.view" },
    { route: "roles", label: "Roles & Permissions", icon: "⚿", perm: "roles.view" },
    { route: "activity", label: "Activity Log", icon: "↻", perm: "activity.view" },
  ];

  function renderNav() {
    const items = NAV.filter((n) => can(n.perm))
      .map(
        (n) =>
          `<a href="#/${n.route}" data-route="${n.route}"><span class="ic">${n.icon}</span>${esc(n.label)}</a>`
      )
      .join("");
    $("#side-nav").innerHTML = items;
    $("#who").innerHTML = user
      ? `<b>${esc(user.full_name || user.username)}</b><br>${esc(user.role_name)}`
      : "";
    $("#who-mini").textContent = user ? user.username : "";
  }

  /* ---------- router ---------- */
  const routes = {
    dashboard: viewDashboard,
    products: viewProducts,
    categories: viewCategories,
    attributes: viewAttributes,
    media: viewMedia,
    customers: viewCustomers,
    orders: viewOrders,
    content: viewContent,
    settings: viewSettings,
    users: viewUsers,
    roles: viewRoles,
    activity: viewActivity,
  };

  function router() {
    const r = (location.hash.replace(/^#\//, "") || "dashboard").split("/")[0];
    const titleEl = $("#page-title");
    const navName = NAV.find((n) => n.route === r);
    titleEl.textContent = navName ? navName.label : "Dashboard";
    document.querySelectorAll(".side-nav a").forEach((a) =>
      a.classList.toggle("active", a.dataset.route === r)
    );
    const fn = routes[r] || viewDashboard;
    fn().catch((e) => {
      if (e.message !== "auth") $("#admin-app").innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    });
  }

  /* ---------- login ---------- */
  function showLogin() {
    $("#login-view").hidden = false;
    $("#app-view").hidden = true;
  }
  async function boot() {
    try {
      const data = await api("GET", "auth/me");
      token = data.csrf;
      user = data.user;
      enterApp();
    } catch (e) {
      showLogin();
    }
  }
  function enterApp() {
    $("#login-view").hidden = true;
    $("#app-view").hidden = false;
    renderNav();
    router();
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-error").textContent = "";
    const fd = new FormData(e.target);
    try {
      const data = await api("POST", "auth/login", {
        username: fd.get("username"),
        password: fd.get("password"),
      });
      token = data.csrf;
      user = data.user;
      enterApp();
    } catch (err) {
      $("#login-error").textContent = err.message;
    }
  });
  $("#logout-btn").addEventListener("click", async () => {
    try {
      await api("POST", "auth/logout");
    } catch (e) {}
    token = null;
    user = null;
    showLogin();
  });
  $("#menu-btn").addEventListener("click", () =>
    $("#sidebar").classList.toggle("open")
  );
  window.addEventListener("hashchange", router);

  /* ============ VIEWS ============ */

  async function viewDashboard() {
    const s = await api("GET", "dashboard/stats");
    const a = await api("GET", "activity");
    const cards = [
      ["Products", s.products, "var(--primary)"],
      ["Low stock", s.low_stock, "var(--warn)"],
      ["Categories", s.categories, "var(--primary)"],
      ["Customers", s.customers, "var(--success)"],
      ["Pending wholesale", s.pending_wholesale, "var(--warn)"],
      ["Orders", s.orders, "var(--primary)"],
      ["Revenue (CHF)", s.revenue.toFixed(2), "var(--success)"],
      ["Active admins", s.admins, "var(--primary)"],
    ];
    $("#admin-app").innerHTML =
      `<div class="grid">` +
      cards
        .map(
          (c) =>
            `<div class="card stat"><div class="label">${esc(c[0])}</div><div class="value">${esc(c[1])}</div><div class="bar" style="background:${c[2]}"></div></div>`
        )
        .join("") +
      `</div>
      <div class="panel" style="margin-top:18px">
        <div class="panel-head"><h3>Recent activity</h3></div>
        <div class="panel-body">` +
      (a.items.length
        ? `<table class="tbl"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th></tr></thead><tbody>` +
          a.items
            .map(
              (x) =>
                `<tr><td>${esc(x.created_at)}</td><td>${esc(x.username || "—")}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}${x.entity_id ? " #" + x.entity_id : ""}</td></tr>`
            )
            .join("") +
          `</tbody></table>`
        : `<div class="empty">No activity yet</div>`) +
      `</div></div>`;
  }

  /* ---- Products ---- */
  let productPage = 1;
  async function viewProducts() {
    const q = new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";
    const d = await api("GET", `products?page=${productPage}&q=${encodeURIComponent(q)}`);
    const rows = d.items
      .map(
        (p) => `<tr>
        <td><img class="thumb" src="${img(p.image)}" onerror="this.style.visibility='hidden'"></td>
        <td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.sku || "")}</span></td>
        <td>${p.price != null ? "CHF " + p.price : '<span class="muted">—</span>'}</td>
        <td>${esc(p.stock)} ${badge(p.stock_status)}</td>
        <td class="btn-row">
          <button class="btn btn-sm" onclick="Admin.editProduct(${p.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="Admin.delProduct(${p.id})">Delete</button>
        </td></tr>`
      )
      .join("");
    $("#admin-app").innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h3>Products</h3><div class="spacer"></div>
          <input class="input-search" id="prod-search" placeholder="Search…" value="${esc(q)}">
          <button class="btn btn-primary" onclick="Admin.newProduct()">+ New product</button>
        </div>
        <div class="panel-body">
          <table class="tbl"><thead><tr><th></th><th>Name</th><th>Retail price</th><th>Stock</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="empty">No products</td></tr>`}</tbody></table>
        </div>
        <div class="pagination"><span class="muted">Page ${d.page} · ${d.total} total</span>
          <button class="btn btn-sm" ${d.page <= 1 ? "disabled" : ""} onclick="Admin.prodPrev()">Prev</button>
          <button class="btn btn-sm" onclick="Admin.prodNext()">Next</button></div>
      </div>`;
    $("#prod-search").addEventListener("input", (e) => {
      location.hash = `#/products?q=${encodeURIComponent(e.target.value)}`;
    });
  }
  window.Admin.prodNext = () => { productPage++; router(); };
  window.Admin.prodPrev = () => { productPage = Math.max(1, productPage - 1); router(); };

  window.Admin.newProduct = () => openProductForm(null);
  window.Admin.editProduct = (id) => openProductForm(id);

  async function openProductForm(id) {
    let p = { name: "", sku: "", slug: "", description: "", status: "publish", featured: 0, stock: 0, stock_status: "instock", manages_stock: 0, weight: "", min_order_qty: 1, image: "", price_retail: "", price_wholesale: "", category_ids: [], attribute_value_ids: [] };
    const cats = await api("GET", "categories");
    const attrs = await api("GET", "attributes");
    if (id) {
      const full = await api("GET", "products/" + id);
      p = Object.assign(p, full.product);
      const pr = {};
      full.prices.forEach((x) => (pr[x.customer_group] = x.price));
      p.price_retail = pr.retail ?? "";
      p.price_wholesale = pr.wholesale ?? "";
      p.category_ids = full.categories.map((c) => c.id);
      p.attribute_value_ids = full.attributes.map((a) => a.value_id);
    }
    const catOpts = cats
      .map((c) => `<option value="${c.id}" ${p.category_ids.includes(c.id) ? "selected" : ""}>${esc(c.name)}</option>`)
      .join("");
    let attrHtml = "";
    attrs.forEach((a) => {
      attrHtml += `<div class="perm-group"><h4>${esc(a.name)}</h4><div class="perm-list">` +
        a.values.map((v) => `<label class="perm-item"><input type="checkbox" name="attr" value="${v.id}" ${p.attribute_value_ids.includes(v.id) ? "checked" : ""}>${esc(v.value)}</label>`).join("") +
        `</div></div>`;
    });
    modal(
      id ? "Edit product" : "New product",
      `<div class="form-row">
        <div class="field"><label>Name</label><input name="name" value="${esc(p.name)}"></div>
        <div class="field"><label>SKU</label><input name="sku" value="${esc(p.sku)}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Slug (auto)</label><input name="slug" value="${esc(p.slug)}" placeholder="leave blank to auto"></div>
        <div class="field"><label>Status</label><select name="status">
          <option ${p.status==="publish"?"selected":""}>publish</option>
          <option ${p.status==="draft"?"selected":""}>draft</option>
          <option ${p.status==="private"?"selected":""}>private</option></select></div>
      </div>
      <div class="field"><label>Description</label><textarea name="description">${esc(p.description)}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Retail price (CHF)</label><input name="price_retail" type="number" step="0.01" value="${esc(p.price_retail)}"></div>
        <div class="field"><label>Wholesale price (CHF)</label><input name="price_wholesale" type="number" step="0.01" value="${esc(p.price_wholesale)}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Stock</label><input name="stock" type="number" value="${esc(p.stock)}"></div>
        <div class="field"><label>Stock status</label><select name="stock_status">
          <option ${p.stock_status==="instock"?"selected":""}>instock</option>
          <option ${p.stock_status==="outofstock"?"selected":""}>outofstock</option>
          <option ${p.stock_status==="onbackorder"?"selected":""}>onbackorder</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Weight</label><input name="weight" value="${esc(p.weight)}"></div>
        <div class="field"><label>Min order qty</label><input name="min_order_qty" type="number" value="${esc(p.min_order_qty)}"></div>
      </div>
      <div class="field"><label>Image path (assets/uploads/...)</label><input name="image" value="${esc(p.image)}"></div>
      <div class="field"><label>Categories</label><select name="category_ids" multiple size="5">${catOpts}</select></div>
      <div class="field"><label>Attributes</label>${attrHtml || '<span class="muted">No attributes defined</span>'}</div>
      <label class="perm-item"><input type="checkbox" name="featured" ${p.featured?"checked":""}> Featured product</label>`,
      `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button>
       <button class="btn btn-primary" id="save-prod">Save</button>`
    );
    $("#save-prod").onclick = async () => {
      const fd = new FormData($("#modal .modal-body").closest(".modal"));
      const body = {};
      fd.forEach((v, k) => {
        if (k === "attr") {
          body.attribute_value_ids = body.attribute_value_ids || [];
          body.attribute_value_ids.push(+(v));
        } else if (k === "category_ids") {
          body.category_ids = body.category_ids || [];
          body.category_ids.push(+(v));
        } else if (k === "featured") {
          body.featured = true;
        } else {
          body[k] = v;
        }
      });
      try {
        if (id) await api("PUT", "products/" + id, body);
        else await api("POST", "products", body);
        toast("Saved");
        closeModal();
        router();
      } catch (e) {
        toast(e.message);
      }
    };
  }
  window.Admin.delProduct = async (id) => {
    if (!(await confirmDialog("Delete this product?"))) return;
    try { await api("DELETE", "products/" + id); toast("Deleted"); router(); }
    catch (e) { toast(e.message); }
  };

  /* ---- Categories ---- */
  async function viewCategories() {
    const cats = await api("GET", "categories");
    const rows = cats
      .map(
        (c) => `<tr>
        <td><img class="thumb" src="${img(c.image)}" onerror="this.style.visibility='hidden'"></td>
        <td><b>${esc(c.name)}</b><br><span class="muted">${esc(c.slug)}</span></td>
        <td class="btn-row">
          <button class="btn btn-sm" onclick="Admin.editCat(${c.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="Admin.delCat(${c.id})">Delete</button>
        </td></tr>`
      )
      .join("");
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Categories</h3><div class="spacer"></div>
      <button class="btn btn-primary" onclick="Admin.newCat()">+ New category</button></div>
      <div class="panel-body"><table class="tbl"><thead><tr><th></th><th>Name</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="empty">No categories</td></tr>`}</tbody></table></div></div>`;
  }
  function catForm(id) {
    api("GET", "categories").then(async (cats) => {
      let c = { name: "", slug: "", description: "", image: "", parent_id: "", sort_order: 0 };
      if (id) {
        const full = await api("GET", "categories/" + id);
        c = full.category;
      }
      const opts = `<option value="">— none —</option>` +
        cats.filter((x) => x.id != id).map((x) => `<option value="${x.id}" ${c.parent_id == x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("");
      modal(id ? "Edit category" : "New category",
        `<div class="field"><label>Name</label><input name="name" value="${esc(c.name)}"></div>
         <div class="field"><label>Slug</label><input name="slug" value="${esc(c.slug)}"></div>
         <div class="field"><label>Parent</label><select name="parent_id">${opts}</select></div>
         <div class="field"><label>Image path</label><input name="image" value="${esc(c.image)}"></div>
         <div class="field"><label>Sort order</label><input name="sort_order" type="number" value="${esc(c.sort_order)}"></div>
         <div class="field"><label>Description</label><textarea name="description">${esc(c.description)}</textarea></div>`,
        `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button><button class="btn btn-primary" id="save-cat">Save</button>`);
      $("#save-cat").onclick = async () => {
        const f = new FormData($("#modal .modal-body").closest(".modal"));
        const body = {}; f.forEach((v, k) => (body[k] = v));
        try { id ? await api("PUT", "categories/" + id, body) : await api("POST", "categories", body); toast("Saved"); closeModal(); router(); }
        catch (e) { toast(e.message); }
      };
    });
  }
  window.Admin.newCat = () => catForm(null);
  window.Admin.editCat = (id) => catForm(id);
  window.Admin.delCat = async (id) => {
    if (!(await confirmDialog("Delete this category? Products stay but lose this grouping."))) return;
    try { await api("DELETE", "categories/" + id); toast("Deleted"); router(); } catch (e) { toast(e.message); }
  };

  /* ---- Attributes ---- */
  async function viewAttributes() {
    const attrs = await api("GET", "attributes");
    const rows = attrs
      .map(
        (a) => `<tr><td><b>${esc(a.name)}</b><br><span class="muted">${esc(a.slug)} · ${esc(a.type)}</span></td>
        <td class="wrap">${(a.values || []).map((v) => `<span class="badge badge-gray">${esc(v.value)}</span>`).join(" ")}</td>
        <td class="btn-row">
          <button class="btn btn-sm" onclick="Admin.addAttrVal(${a.id})">+ Value</button>
          <button class="btn btn-sm" onclick="Admin.editAttr(${a.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="Admin.delAttr(${a.id})">Delete</button>
        </td></tr>`
      )
      .join("");
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Attributes</h3><div class="spacer"></div>
      <button class="btn btn-primary" onclick="Admin.newAttr()">+ New attribute</button></div>
      <div class="panel-body"><table class="tbl"><thead><tr><th>Attribute</th><th>Values</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="3" class="empty">No attributes</td></tr>`}</tbody></table></div></div>`;
  }
  function attrForm(id) {
    let a = { name: "", slug: "", type: "select" };
    if (id) { /* simple edit via prompt fields */ }
    modal(id ? "Edit attribute" : "New attribute",
      `<div class="field"><label>Name</label><input name="name" value="${esc(a.name)}"></div>
       <div class="field"><label>Slug</label><input name="slug" value="${esc(a.slug)}"></div>
       <div class="field"><label>Type</label><select name="type"><option value="select">select</option><option value="text">text</option></select></div>`,
      `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button><button class="btn btn-primary" id="save-a">Save</button>`);
    $("#save-a").onclick = async () => {
      const f = new FormData($("#modal .modal-body").closest(".modal")); const b = {}; f.forEach((v, k) => (b[k] = v));
      try { id ? await api("PUT", "attributes/" + id, b) : await api("POST", "attributes", b); toast("Saved"); closeModal(); router(); }
      catch (e) { toast(e.message); }
    };
  }
  window.Admin.newAttr = () => attrForm(null);
  window.Admin.editAttr = (id) => attrForm(id);
  window.Admin.delAttr = async (id) => {
    if (!(await confirmDialog("Delete attribute and its values?"))) return;
    try { await api("DELETE", "attributes/" + id); toast("Deleted"); router(); } catch (e) { toast(e.message); }
  };
  window.Admin.addAttrVal = (id) => {
    modal("Add attribute value", `<div class="field"><label>Value</label><input id="av" placeholder="e.g. Red"></div>`,
      `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button><button class="btn btn-primary" id="save-av">Add</button>`);
    $("#save-av").onclick = async () => {
      try { await api("POST", "attributes/" + id + "/values", { value: $("#av").value }); toast("Added"); closeModal(); router(); }
      catch (e) { toast(e.message); }
    };
  };

  /* ---- Media ---- */
  async function viewMedia() {
    const m = await api("GET", "media");
    const grid = m.items
      .map(
        (x) => `<div class="card" style="padding:10px">
        <img src="${img(x.file_path)}" style="width:100%;height:120px;object-fit:cover;border-radius:8px" onerror="this.style.opacity=.3">
        <div class="btn-row" style="margin-top:8px"><button class="btn btn-sm btn-danger" onclick="Admin.delMedia(${x.id})">Delete</button></div>
      </div>`
      )
      .join("");
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Media library</h3><div class="spacer"></div>
      <label class="btn btn-primary">Upload<input type="file" id="up" hidden></label></div>
      <div class="panel-body" style="padding:18px"><div class="grid">${grid || `<div class="empty">No media</div>`}</div></div></div>`;
    $("#up").addEventListener("change", async (e) => {
      const fd = new FormData();
      fd.append("file", e.target.files[0]);
      try { await api("POST", "media", fd); toast("Uploaded"); router(); }
      catch (err) { toast(err.message); }
    });
  }
  window.Admin.delMedia = async (id) => {
    if (!(await confirmDialog("Delete this media file?"))) return;
    try { await api("DELETE", "media/" + id); toast("Deleted"); router(); } catch (e) { toast(e.message); }
  };

  /* ---- Customers ---- */
  async function viewCustomers() {
    const c = await api("GET", "customers");
    const rows = c.items
      .map(
        (x) => `<tr>
        <td><b>${esc(x.email)}</b><br><span class="muted">${esc(x.company || "")}</span></td>
        <td>${esc(x.customer_group)}</td>
        <td>${x.wholesale_approved ? badge("active") : badge("inactive")}</td>
        <td class="btn-row">
          ${x.wholesale_approved ? "" : `<button class="btn btn-sm btn-success" onclick="Admin.approveCust(${x.id})">Approve</button>`}
          <button class="btn btn-sm" onclick="Admin.editCust(${x.id})">Edit</button>
        </td></tr>`
      )
      .join("");
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Customers</h3></div>
      <div class="panel-body"><table class="tbl"><thead><tr><th>Email</th><th>Group</th><th>Wholesale</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty">No customers</td></tr>`}</tbody></table></div></div>`;
  }
  window.Admin.approveCust = async (id) => {
    try { await api("POST", "customers/" + id + "/approve"); toast("Approved"); router(); } catch (e) { toast(e.message); }
  };
  window.Admin.editCust = (id) => {
    api("GET", "customers/" + id).then((d) => {
      const c = d.customer;
      modal("Edit customer",
        `<div class="field"><label>Company</label><input name="company" value="${esc(c.company)}"></div>
         <div class="field"><label>VAT ID</label><input name="vat_id" value="${esc(c.vat_id)}"></div>
         <div class="field"><label>Group</label><select name="customer_group"><option ${c.customer_group==="retail"?"selected":""}>retail</option><option ${c.customer_group==="wholesale"?"selected":""}>wholesale</option></select></div>
         <label class="perm-item"><input type="checkbox" name="wholesale_approved" ${c.wholesale_approved?"checked":""}> Wholesale approved</label>`,
        `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button><button class="btn btn-primary" id="save-c">Save</button>`);
      $("#save-c").onclick = async () => {
        const f = new FormData($("#modal .modal-body").closest(".modal")); const b = {}; f.forEach((v, k) => (b[k] = v));
        try { await api("PUT", "customers/" + id, b); toast("Saved"); closeModal(); router(); } catch (e) { toast(e.message); }
      };
    });
  };

  /* ---- Orders ---- */
  async function viewOrders() {
    const o = await api("GET", "orders");
    const rows = o.items
      .map(
        (x) => `<tr><td><b>${esc(x.order_no)}</b></td><td>${esc(x.customer_email || "—")}</td>
        <td>${badge(x.status)}</td><td>CHF ${esc(x.total)}</td>
        <td class="btn-row"><button class="btn btn-sm" onclick="Admin.viewOrder(${x.id})">View</button></td></tr>`
      )
      .join("");
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Orders</h3></div>
      <div class="panel-body"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="empty">No orders</td></tr>`}</tbody></table></div></div>`;
  }
  window.Admin.viewOrder = (id) => {
    api("GET", "orders/" + id).then((d) => {
      const o = d.order;
      const items = (o.items || []).map((i) => `<li>${esc(i.qty)}× ${esc(i.name)} — CHF ${esc(i.line_total)}</li>`).join("");
      const hist = (o.history || []).map((h) => `<li>${esc(h.created_at)} · ${esc(h.status)}${h.note ? " — " + esc(h.note) : ""}</li>`).join("");
      modal("Order " + o.order_no,
        `<p>${badge(o.status)} · CHF ${esc(o.total)}</p>
         <h4>Items</h4><ul>${items || "<li class='muted'>none</li>"}</ul>
         <h4>History</h4><ul>${hist || "<li class='muted'>none</li>"}</ul>
         <div class="field"><label>Update status</label><select id="ost">
           ${["pending","processing","completed","cancelled","refunded","onhold"].map((s) => `<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select></div>`,
        `<button class="btn btn-ghost" onclick="Admin.closeModal()">Close</button><button class="btn btn-primary" id="up-ost">Update status</button>`);
      $("#up-ost").onclick = async () => {
        try { await api("PUT", "orders/" + id + "/status", { status: $("#ost").value }); toast("Updated"); closeModal(); router(); }
        catch (e) { toast(e.message); }
      };
    });
  };

  /* ---- Content ---- */
  async function viewContent() {
    const c = await api("GET", "content");
    const item = (key, label, isLong) => {
      const v = c.items[key];
      return `<div class="field"><label>${label}</label>${isLong ? `<textarea name="${key}">${esc(v ? v.body : "")}</textarea>` : `<input name="${key}" value="${esc(v ? v.body : "")}">`}</div>`;
    };
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Site content</h3><div class="spacer"></div>
      <button class="btn btn-primary" id="save-content">Save content</button></div>
      <div class="panel-body" style="padding:18px" id="content-fields">
        ${item("announcement", "Announcement bar")}
        ${item("about", "About text", true)}
        ${item("footer_contact", "Footer contact", true)}
      </div></div>`;
    $("#save-content").onclick = async () => {
      const fields = $("#content-fields").querySelectorAll("input,textarea");
      for (const f of fields) {
        try { await api("PUT", "content/" + f.name, { body: f.value }); } catch (e) { toast(e.message); }
      }
      toast("Content saved");
    };
  }

  /* ---- Settings ---- */
  async function viewSettings() {
    const s = await api("GET", "settings");
    const def = { site_name: "", currency: "CHF", country: "CH", shipping_text: "", contact_email: "", seo_title: "", seo_description: "" };
    Object.assign(def, s.items);
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Settings</h3><div class="spacer"></div>
      <button class="btn btn-primary" id="save-set">Save settings</button></div>
      <div class="panel-body" style="padding:18px">
        <div class="form-row">
          <div class="field"><label>Site name</label><input name="site_name" value="${esc(def.site_name)}"></div>
          <div class="field"><label>Currency</label><input name="currency" value="${esc(def.currency)}"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Country</label><input name="country" value="${esc(def.country)}"></div>
          <div class="field"><label>Contact email</label><input name="contact_email" value="${esc(def.contact_email)}"></div>
        </div>
        <div class="field"><label>Shipping text</label><input name="shipping_text" value="${esc(def.shipping_text)}"></div>
        <div class="field"><label>SEO title</label><input name="seo_title" value="${esc(def.seo_title)}"></div>
        <div class="field"><label>SEO description</label><textarea name="seo_description">${esc(def.seo_description)}</textarea></div>
      </div></div>`;
    $("#save-set").onclick = async () => {
      const b = {};
      $("#admin-app").querySelectorAll("input,textarea").forEach((f) => (b[f.name] = f.value));
      try { await api("PUT", "settings", b); toast("Settings saved"); } catch (e) { toast(e.message); }
    };
  }

  /* ---- Admin Users ---- */
  async function viewUsers() {
    const u = await api("GET", "users");
    const rows = u.items
      .map(
        (x) => `<tr><td><b>${esc(x.username)}</b><br><span class="muted">${esc(x.email)}</span></td>
        <td>${esc(x.role_name || "—")}</td><td>${badge(x.status)}</td>
        <td class="btn-row">
          <button class="btn btn-sm" onclick="Admin.editUser(${x.id})">Edit</button>
          <button class="btn btn-sm" onclick="Admin.toggleUser(${x.id})">${x.status === "active" ? "Deactivate" : "Activate"}</button>
          <button class="btn btn-sm btn-danger" onclick="Admin.delUser(${x.id})">Delete</button>
        </td></tr>`
      )
      .join("");
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Admin users</h3><div class="spacer"></div>
      <button class="btn btn-primary" onclick="Admin.newUser()">+ New user</button></div>
      <div class="panel-body"><table class="tbl"><thead><tr><th>User</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty">No users</td></tr>`}</tbody></table></div></div>`;
  }
  function userForm(id) {
    Promise.all([api("GET", "roles")]).then(async ([roles]) => {
      let u = { username: "", email: "", full_name: "", role_id: 2, status: "active", password: "" };
      if (id) {
        const d = await api("GET", "users/" + id);
        u = Object.assign(u, d.user);
      }
      const opts = roles.items.map((r) => `<option value="${r.id}" ${u.role_id == r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("");
      modal(id ? "Edit user" : "New user",
        `<div class="form-row">
          <div class="field"><label>Username</label><input name="username" value="${esc(u.username)}"></div>
          <div class="field"><label>Email</label><input name="email" type="email" value="${esc(u.email)}"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Full name</label><input name="full_name" value="${esc(u.full_name)}"></div>
          <div class="field"><label>Role</label><select name="role_id">${opts}</select></div>
        </div>
        <div class="field"><label>Password ${id ? "(leave blank to keep)" : ""}</label><input name="password" type="password" placeholder="${id ? "••••••" : ""}"></div>
        <div class="field"><label>Status</label><select name="status"><option ${u.status==="active"?"selected":""}>active</option><option ${u.status==="inactive"?"selected":""}>inactive</option></select></div>`,
        `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button><button class="btn btn-primary" id="save-u">Save</button>`);
      $("#save-u").onclick = async () => {
        const f = new FormData($("#modal .modal-body").closest(".modal")); const b = {}; f.forEach((v, k) => (b[k] = v));
        if (id && !b.password) delete b.password;
        try { id ? await api("PUT", "users/" + id, b) : await api("POST", "users", b); toast("Saved"); closeModal(); router(); }
        catch (e) { toast(e.message); }
      };
    });
  }
  window.Admin.newUser = () => userForm(null);
  window.Admin.editUser = (id) => userForm(id);
  window.Admin.toggleUser = async (id) => {
    try { await api("POST", "users/" + id + "/toggle"); toast("Updated"); router(); } catch (e) { toast(e.message); }
  };
  window.Admin.delUser = async (id) => {
    if (!(await confirmDialog("Delete this admin user?"))) return;
    try { await api("DELETE", "users/" + id); toast("Deleted"); router(); } catch (e) { toast(e.message); }
  };

  /* ---- Roles & Permissions ---- */
  async function viewRoles() {
    const [roles, perms] = await Promise.all([api("GET", "roles"), api("GET", "permissions")]);
    const groupHtml = Object.entries(perms.items)
      .map(
        ([g, list]) =>
          `<div class="perm-group"><h4>${esc(g)}</h4><div class="perm-list">` +
          list.map((p) => `<label class="perm-item" data-pid="${p.id}"><input type="checkbox" value="${p.id}"> ${esc(p.name)}</label>`).join("") +
          `</div></div>`
      )
      .join("");
    const rows = roles.items
      .map(
        (r) => `<tr><td><b>${esc(r.name)}</b><br><span class="muted">${esc(r.slug)}</span></td>
        <td>${esc(r.user_count)}</td><td>${badge(r.status)}</td>
        <td class="btn-row">
          <button class="btn btn-sm" onclick="Admin.editRole(${r.id})">Permissions</button>
          <button class="btn btn-sm" onclick="Admin.renameRole(${r.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="Admin.delRole(${r.id})">Delete</button>
        </td></tr>`
      )
      .join("");
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Roles &amp; Permissions</h3><div class="spacer"></div>
      <button class="btn btn-primary" onclick="Admin.newRole()">+ New role</button></div>
      <div class="panel-body"><table class="tbl"><thead><tr><th>Role</th><th>Users</th><th>Status</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty">No roles</td></tr>`}</tbody></table></div></div>`;
    window.__permGroups = groupHtml;
  }
  window.Admin.editRole = (id) => {
    Promise.all([api("GET", "roles/" + id), api("GET", "permissions")]).then(([role, perms]) => {
      const have = new Set(role.role.permissions.map((p) => p.id));
      let html = Object.entries(perms.items)
        .map(
          ([g, list]) =>
            `<div class="perm-group"><h4>${esc(g)}</h4><div class="perm-list">` +
            list.map((p) => `<label class="perm-item"><input type="checkbox" class="perm-chk" value="${p.id}" ${have.has(p.id) ? "checked" : ""}> ${esc(p.name)}</label>`).join("") +
            `</div></div>`
        )
        .join("");
      modal("Permissions — " + role.role.name, html,
        `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button><button class="btn btn-primary" id="save-rp">Save permissions</button>`);
      $("#save-rp").onclick = async () => {
        const checks = [...document.querySelectorAll(".perm-chk")];
        const want = new Set(checks.filter((c) => c.checked).map((c) => +c.value));
        const current = have;
        try {
          for (const c of checks) {
            const pid = +c.value;
            if (c.checked && !current.has(pid)) await api("POST", "roles/" + id + "/permissions", { permission_id: pid });
            if (!c.checked && current.has(pid)) await api("DELETE", "roles/" + id + "/permissions/" + pid);
          }
          toast("Permissions saved"); closeModal(); router();
        } catch (e) { toast(e.message); }
      };
    });
  };
  window.Admin.renameRole = (id) => {
    api("GET", "roles/" + id).then((r) => {
      modal("Edit role",
        `<div class="field"><label>Name</label><input name="name" value="${esc(r.role.name)}"></div>
         <div class="field"><label>Description</label><textarea name="description">${esc(r.role.description)}</textarea></div>
         <div class="field"><label>Status</label><select name="status"><option ${r.role.status==="active"?"selected":""}>active</option><option ${r.role.status==="inactive"?"selected":""}>inactive</option></select></div>`,
        `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button><button class="btn btn-primary" id="save-rr">Save</button>`);
      $("#save-rr").onclick = async () => {
        const f = new FormData($("#modal .modal-body").closest(".modal")); const b = {}; f.forEach((v, k) => (b[k] = v));
        try { await api("PUT", "roles/" + id, b); toast("Saved"); closeModal(); router(); } catch (e) { toast(e.message); }
      };
    });
  };
  window.Admin.newRole = () => {
    modal("New role",
      `<div class="field"><label>Name</label><input name="name"></div>
       <div class="field"><label>Slug</label><input name="slug" placeholder="e.g. manager"></div>
       <div class="field"><label>Description</label><textarea name="description"></textarea></div>`,
      `<button class="btn btn-ghost" onclick="Admin.closeModal()">Cancel</button><button class="btn btn-primary" id="save-nr">Create</button>`);
    $("#save-nr").onclick = async () => {
      const f = new FormData($("#modal .modal-body").closest(".modal")); const b = {}; f.forEach((v, k) => (b[k] = v));
      try { await api("POST", "roles", b); toast("Created"); closeModal(); router(); } catch (e) { toast(e.message); }
    };
  };
  window.Admin.delRole = async (id) => {
    if (!(await confirmDialog("Delete this role? It must have no assigned users."))) return;
    try { await api("DELETE", "roles/" + id); toast("Deleted"); router(); } catch (e) { toast(e.message); }
  };

  /* ---- Activity ---- */
  async function viewActivity() {
    const a = await api("GET", "activity");
    const rows = a.items
      .map(
        (x) => `<tr><td>${esc(x.created_at)}</td><td>${esc(x.username || "—")}</td>
        <td>${esc(x.action)}</td><td>${esc(x.entity)}${x.entity_id ? " #" + x.entity_id : ""}</td></tr>`
      )
      .join("");
    $("#admin-app").innerHTML = `<div class="panel"><div class="panel-head"><h3>Activity log</h3></div>
      <div class="panel-body"><table class="tbl"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty">No activity</td></tr>`}</tbody></table></div></div>`;
  }

  boot();
})();
