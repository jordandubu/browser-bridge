#!/usr/bin/env node
// bench/ui build — composes shared header into each page body. Run: node bench/ui/build.js
const fs = require("fs");
const path = require("path");

const HEADER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Acme Shop</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="index.html">Acme Shop</a>
    <nav>
      <a href="index.html" data-nav="home">Home</a>
      <a href="catalog.html" data-nav="catalog">Catalog</a>
      <a href="account.html" data-nav="account">Account</a>
    </nav>
    <div class="mega" id="mega-shop">
      <button class="mega-btn" id="mega-toggle">Shop ▾</button>
      <div class="mega-panel" id="mega-panel">
        <div class="mega-col">
          <h4>Electronics</h4>
          <a href="#" data-nav="Phones">Phones</a>
          <a href="#" data-nav="Laptops">Laptops</a>
          <a href="#" data-nav="Audio">Audio</a>
        </div>
        <div class="mega-col">
          <h4>Home</h4>
          <a href="#" data-nav="Kitchen">Kitchen</a>
          <a href="#" data-nav="Furniture">Furniture</a>
          <a href="#" data-nav="Decor">Decor</a>
        </div>
        <div class="mega-col">
          <h4>Fashion</h4>
          <a href="#" data-nav="Men">Men</a>
          <a href="#" data-nav="Women">Women</a>
          <a href="#" data-nav="Kids">Kids</a>
        </div>
      </div>
    </div>
    <div class="search">
      <input id="search-input" placeholder="Search products…">
      <button id="search-btn">🔍</button>
    </div>
    <div class="topbar-right">
      <div class="dd" id="dd-account">
        <button class="dd-btn" id="dd-account-btn">Account ▾</button>
        <div class="dd-panel">
          <div class="dd-head">Signed in as guest</div>
          <a href="#" data-acc="Profile">Profile</a>
          <a href="#" data-acc="Orders">Orders</a>
          <a href="#" data-acc="Settings">Settings</a>
          <a href="#" data-acc="Logout">Logout</a>
        </div>
      </div>
      <a href="cart.html" class="dd-btn">Cart (<span data-cart-count>0</span>)</a>
    </div>
  </div>
</div>
<div class="wrap">`;

const FOOTER = `</div>
<div class="toast" id="toast"></div>
<script src="app.js"></script>
</body>
</html>`;

const pages = {
  "index.html": `  <h1>Welcome to Acme Shop</h1>
  <p>Browse our catalog or use the Shop menu.</p>
  <div class="card">
    <h2>Featured</h2>
    <div class="grid">
      <div class="product"><h3>Wireless Mouse</h3><span class="price">$29</span><br><button class="btn primary" data-add="mouse" data-name="Wireless Mouse" data-price="29">Add to cart</button></div>
      <div class="product"><h3>Mechanical Keyboard</h3><span class="price">$89</span><br><button class="btn primary" data-add="keyboard" data-name="Mechanical Keyboard" data-price="89">Add to cart</button></div>
      <div class="product"><h3>27" Monitor</h3><span class="price">$230</span><br><button class="btn primary" data-add="monitor" data-name="Monitor" data-price="230">Add to cart</button></div>
    </div>
  </div>
  <div class="card" id="late-section">
    <h2>Special Offer</h2>
    <p id="late-status">Loading…</p>
  </div>`,

  "catalog.html": `  <nav class="crumb"><a href="index.html">Home</a> › Catalog</nav>
  <h1>Catalog</h1>
  <div class="filters">
    <select data-filter="category"><option value="all">All</option><option value="electronics">Electronics</option><option value="home">Home</option><option value="fashion">Fashion</option></select>
    <select data-filter="price"><option value="all">Any price</option><option value="low">Under $50</option><option value="high">$50+</option></select>
    <span class="chip" data-chip="sale">Sale</span>
    <span class="chip" data-chip="new">New</span>
    <span class="chip" data-chip="bestseller">Bestseller</span>
  </div>
  <div class="grid" id="catalog-grid">
    <div class="product"><h3>Wireless Mouse</h3><span class="price">$29</span><br><button class="btn primary" data-add="mouse" data-name="Wireless Mouse" data-price="29">Add</button></div>
    <div class="product"><h3>Mechanical Keyboard</h3><span class="price">$89</span><br><button class="btn primary" data-add="keyboard" data-name="Mechanical Keyboard" data-price="89">Add</button></div>
    <div class="product"><h3>USB-C Hub</h3><span class="price">$45</span><br><button class="btn primary" data-add="hub" data-name="USB-C Hub" data-price="45">Add</button></div>
    <div class="product"><h3>27" Monitor</h3><span class="price">$230</span><br><button class="btn primary" data-add="monitor" data-name="Monitor" data-price="230">Add</button></div>
    <div class="product"><h3>Laptop Stand</h3><span class="price">$35</span><br><button class="btn primary" data-add="stand" data-name="Laptop Stand" data-price="35">Add</button></div>
    <div class="product"><h3>Desk Lamp</h3><span class="price">$40</span><br><button class="btn primary" data-add="lamp" data-name="Desk Lamp" data-price="40">Add</button></div>
  </div>
  <div class="pager">
    <button data-page="1">1</button>
    <button data-page="2">2</button>
    <button data-page="3">3</button>
  </div>`,

  "product.html": `  <nav class="crumb"><a href="index.html">Home</a> › <a href="catalog.html">Catalog</a> › Mechanical Keyboard</nav>
  <h1>Mechanical Keyboard</h1>
  <div class="card">
    <h2>Choose variant</h2>
    <div class="variant" data-variant="Red">Red</div>
    <div class="variant" data-variant="Blue">Blue</div>
    <div class="variant" data-variant="Green">Green</div>
  </div>
  <div class="card">
    <h2>Quantity</h2>
    <div class="qty">
      <button data-qty-dec="keyboard">−</button>
      <span data-qty-val="keyboard">1</span>
      <button data-qty-inc="keyboard">+</button>
    </div>
    <br>
    <button class="btn primary" data-add="keyboard" data-name="Mechanical Keyboard" data-price="89">Add to cart</button>
  </div>`,

  "cart.html": `  <nav class="crumb"><a href="index.html">Home</a> › Cart</nav>
  <h1>Your Cart</h1>
  <div class="card">
    <table id="cart-table">
      <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
      <tbody id="cart-body"></tbody>
    </table>
    <p>Cart total: <span id="cart-total">$0</span></p>
    <a class="btn primary" href="checkout.html">Checkout</a>
  </div>`,

  "checkout.html": `  <nav class="crumb"><a href="index.html">Home</a> › <a href="cart.html">Cart</a> › Checkout</nav>
  <h1>Checkout</h1>
  <div class="stepper">
    <span class="step active" data-step="1">1. Shipping</span>
    <span class="step" data-step="2">2. Payment</span>
    <span class="step" data-step="3">3. Review</span>
  </div>
  <div class="card">
    <div class="step-form active" id="step-form-1">
      <label>Address</label>
      <input id="ship-address" placeholder="Street">
      <label>City</label>
      <input id="ship-city" placeholder="City">
    </div>
    <div class="step-form" id="step-form-2">
      <label>Card number</label>
      <input id="pay-card" placeholder="4242 4242 4242 4242">
      <label>Expiry</label>
      <input id="pay-exp" placeholder="MM/YY">
    </div>
    <div class="step-form" id="step-form-3">
      <p>Review your order and confirm.</p>
      <button class="btn primary" id="place-order">Place Order</button>
      <p class="res" id="order-result"></p>
    </div>
    <button class="btn" id="step-next">Next</button>
  </div>`,

  "account.html": `  <nav class="crumb"><a href="index.html">Home</a> › Account</nav>
  <h1>Account</h1>
  <div class="card">
    <h2>User management</h2>
    <table>
      <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>
        <tr data-uid="u1"><td class="u-name">Alice</td><td>admin</td><td class="status on">active</td><td><button class="btn small" data-toggle="u1">Toggle</button></td></tr>
        <tr data-uid="u2"><td class="u-name">Bob</td><td>user</td><td class="status on">active</td><td><button class="btn small" data-toggle="u2">Toggle</button></td></tr>
        <tr data-uid="u3"><td class="u-name">Carol</td><td>editor</td><td class="status off">blocked</td><td><button class="btn small" data-toggle="u3">Toggle</button></td></tr>
      </tbody>
    </table>
  </div>
  <div class="card">
    <h2>Settings</h2>
    <div class="tabs">
      <button class="tab active" data-tab="profile">Profile</button>
      <button class="tab" data-tab="security">Security</button>
      <button class="tab" data-tab="billing">Billing</button>
    </div>
    <div class="tab-panel active" id="panel-profile">
      <p>Profile settings.</p>
      <button class="btn" data-modal-open="modal-2fa">Set up 2FA</button>
    </div>
    <div class="tab-panel" id="panel-security">
      <p>Security settings.</p>
      <div class="acc">
        <div class="acc-head">Change password</div>
        <div class="acc-body"><button class="btn" data-modal-open="modal-pw">Reset password</button></div>
      </div>
    </div>
    <div class="tab-panel" id="panel-billing">
      <p>Billing settings.</p>
      <button class="btn" data-modal-open="modal-invoice">Download invoice</button>
    </div>
  </div>

  <div class="modal-overlay" id="modal-2fa">
    <div class="modal">
      <h3>Set up 2FA</h3>
      <label>Code</label>
      <input id="twofa-code" placeholder="6-digit">
      <div class="modal-actions">
        <button class="btn" data-modal-close="1">Cancel</button>
        <button class="btn primary" data-modal-confirm="2FA enabled">Confirm</button>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="modal-pw">
    <div class="modal">
      <h3>Reset password</h3>
      <div class="modal-actions">
        <button class="btn" data-modal-close="1">Cancel</button>
        <button class="btn primary" data-modal-confirm="Password reset">Reset</button>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="modal-invoice">
    <div class="modal">
      <h3>Download invoice</h3>
      <div class="modal-actions">
        <button class="btn" data-modal-close="1">Cancel</button>
        <button class="btn primary" data-modal-confirm="Invoice downloaded">Download</button>
      </div>
    </div>
  </div>`,
};

for (const [file, body] of Object.entries(pages)) {
  fs.writeFileSync(path.join(__dirname, file), HEADER + body + FOOTER);
  console.log("wrote bench/ui/" + file);
}
