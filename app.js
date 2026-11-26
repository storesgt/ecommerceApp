async function aiAssistantGreeting(message) { const greetingText = String(message || '').trim().toLowerCase().replace(/^[^a-z]+/, '').replace(/\s+/g, ' '); return /^(hi|hello|hey|good\s*(morning|afternoon|evening)|how are you)(?:\b|$)/.test(greetingText) ? 'Hello. I can help you find products, compare options, understand delivery, or check an order. What would you like to solve?' : null; }
function clearPurchasedCart() { cart = []; Object.keys(localStorage).filter((key) => /^ground-cart(-user-[^\s]+)?$/i.test(key) || key === 'ground-cart-guest').forEach((key) => localStorage.removeItem(key)); localStorage.setItem(CART_CLEAR_MARKER_KEY, 'true'); saveState(); renderCart(); }
let products = [];
const productReviews = new Map();
const CLIENT_TOKEN_KEY = 'ground-client-token';
const ADMIN_TOKEN_KEY = 'ground-admin-token';
const APP_STATE_VERSION = '2026-09-11-live-fix';
const legacyToken = localStorage.getItem('ground-token');
const storedAppVersion = localStorage.getItem('ground-app-version');
const resetStaleAppState = () => {
  const theme = localStorage.getItem('ground-theme');
  const staleKeys = [
    'ground-app-version',
    'ground-token',
    CLIENT_TOKEN_KEY,
    ADMIN_TOKEN_KEY,
    'ground-cart',
    'ground-wishlist',
    'ground-cart-guest',
    'ground-wishlist-guest',
    'ground-user',
    'ground-account',
    'ground-checkout'
  ];
  const userKeys = Object.keys(localStorage).filter((key) => /^ground-(cart|wishlist)(-user-[^\s]+)?$/i.test(key));
  [...staleKeys, ...userKeys].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem('ground-app-version', APP_STATE_VERSION);
  if (theme) localStorage.setItem('ground-theme', theme);
};
if (storedAppVersion !== APP_STATE_VERSION) {
  resetStaleAppState();
} else {
  localStorage.setItem('ground-app-version', APP_STATE_VERSION);
}
if (legacyToken && !localStorage.getItem(CLIENT_TOKEN_KEY) && !localStorage.getItem(ADMIN_TOKEN_KEY)) {
  localStorage.setItem(CLIENT_TOKEN_KEY, legacyToken);
}
let activeCategory = 'All'; let query = ''; let cart = []; let wishlist = new Set(); let activeUserId = ''; let selectedProduct = null; let modalQuantity = 1; let checkoutStep = 1; let accountMode = 'login'; let storeOpen = true; let currencyCode = 'USD'; let configuredPaymentProvider = 'paystack';
let checkoutOrderNumber = ''; let checkoutPaymentId = ''; let selectedShippingMethod = null; let appliedCoupon = null; let checkoutTax = 0; let taxEnabled = false; let availableCountries = [{ code: 'GH', name: 'Ghana', rate: 15 }, { code: 'US', name: 'United States', rate: 0 }, { code: 'GB', name: 'United Kingdom', rate: 20 }]; let availablePaymentGateways = [{ id: 'paystack', name: 'Paystack', enabled: true, serviceFee: 0.2 }]; let selectedPaymentProvider = 'paystack'; let selectedImageIndex = 0; let zoomedProductImage = false;
const $ = (selector) => document.querySelector(selector);
const appPage = $('#appPage');
const pageNames = { home: 'Shop', profile: 'Profile', kyc: 'Staff KYC', orders: 'Orders', notifications: 'Notifications', checkout: 'Checkout', tracking: 'Track order', about: 'About', contact: 'Contact' };
const showStorePage = () => { window.destroyDeliveryRouteMap?.(); appPage.hidden = true; $('#top').hidden = false; document.body.classList.remove('page-active'); };
const normalizePageCheckoutGpsField = () => { const field = document.querySelector('#pageCheckoutForm input[name="postal"]'); if (!field) return; field.name = 'gpsAddress'; field.removeAttribute('required'); field.removeAttribute('pattern'); field.setAttribute('autocomplete', 'street-address'); const label = field.closest('label'); if (label?.firstChild) label.firstChild.textContent = 'GPS address / landmark (optional) '; };
const countryOptions = (includePlaceholder = false) => `${includePlaceholder ? '<option value="" selected disabled>Choose a country</option>' : ''}${availableCountries.map((country) => `<option value="${escapeHtml(country.code)}">${escapeHtml(country.name)}</option>`).join('')}`;
function renderCountryOptions() { document.querySelectorAll('select[name="country"]').forEach((select) => { const current = select.value; select.innerHTML = countryOptions(select.id === 'shippingCountry'); if ([...select.options].some((option) => option.value === current)) select.value = current; }); }
const showAppPage = (name, content, options = {}) => { const preserveScroll = options.preserveScroll === true; const scrollY = preserveScroll ? window.scrollY : 0; appPage.innerHTML = `<div class="page-frame"><div class="page-kicker"><span>Ground / ${pageNames[name] || 'Account'}</span><a href="#shop" data-page-link="home">Back to shop <b>↗</b></a></div>${content}</div>`; if (name === 'checkout') renderPaymentProviders(); appPage.hidden = false; $('#top').hidden = true; document.body.classList.add('page-active'); if (preserveScroll) window.scrollTo({ top: scrollY, behavior: 'auto' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => { void hydrateTrackingItems(); if (name === 'checkout') { normalizePageCheckoutGpsField(); renderCountryOptions(); void enhanceCheckoutAddressSelector('#pageCheckoutForm'); hydrateCheckoutControls('#pageCheckoutForm'); void loadTaxQuote($('#pageCheckoutForm')).catch((error) => showToast(error.message)); } if (name === 'profile') void renderAddressBook(); }, 0); };
const requireClientPage = (name, content, options = {}) => { if (!authToken) { showToast('Sign in to view your account'); $('#accountModal').classList.add('open'); $('#accountModal').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); return; } showAppPage(name, content, options); };
const accountPageHeader = (eyebrow, title, copy) => `<header class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${copy}</p></header>`;
const orderStatusSteps = [
  { key: 'PENDING', label: 'Pending', icon: '⏳', detail: 'We have your order and are preparing it.' },
  { key: 'CONFIRMED', label: 'Confirmed', icon: '✓', detail: 'Your order is confirmed and being prepared.' },
  { key: 'PROCESSING', label: 'Processing', icon: '▣', detail: 'We are packing your order with care.' },
  { key: 'PACKED', label: 'Packed', icon: '▤', detail: 'Your order is packed and ready for dispatch.' },
  { key: 'SHIPPED', label: 'Shipped', icon: '⤴', detail: 'Your parcel is on the way.' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', icon: '🚚', detail: 'The courier is on the way to you.' },
  { key: 'DELIVERED', label: 'Delivered', icon: '✓', detail: 'Your order has been delivered.' },
];
const getOrderStatusTimeline = (status) => {
  const normalized = String(status || 'PENDING').toUpperCase();
  const index = orderStatusSteps.findIndex((step) => step.key === normalized);
  const safeIndex = index >= 0 ? index : 0;
  const completed = orderStatusSteps.map((step, stepIndex) => ({ ...step, complete: stepIndex <= safeIndex, active: stepIndex === safeIndex }));
  const next = completed.find((step) => !step.complete) || completed[completed.length - 1];
  return { completed, currentIndex: safeIndex, next };
};
function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) added += 1;
  }
  return result;
}
function getTrackingDeliveryEstimate(order, status) {
  if (status === 'DELIVERED') return { title: 'Delivered', detail: 'Your order has been delivered.' };
  const suppliedEstimate = order?.estimatedDeliveryAt ? new Date(order.estimatedDeliveryAt) : null;
  if (suppliedEstimate && Number.isFinite(suppliedEstimate.getTime())) {
    return {
      title: suppliedEstimate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      detail: 'Estimated delivery date provided for this order.',
    };
  }
  const placedAt = new Date(order?.createdAt || '');
  if (!Number.isFinite(placedAt.getTime())) {
    return { title: 'Estimate unavailable', detail: 'A delivery estimate will appear when one is provided.' };
  }
  const start = addBusinessDays(placedAt, 3);
  const end = addBusinessDays(placedAt, 5);
  if (end.getTime() < Date.now()) {
    return {
      title: 'No revised ETA yet',
      detail: 'The standard estimate window has passed; check the latest order update.',
    };
  }
  const formatDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return {
    title: `${formatDate(start)} – ${formatDate(end)}`,
    detail: 'Planning estimate: 3–5 business days from order placement; no carrier ETA is available.',
  };
}
async function fetchSavedAddresses() {
  if (!authToken) return [];
  const response = await fetch('http://localhost:4000/api/v1/addresses', { headers: apiHeaders() });
  if (!response.ok) return [];
  return (await response.json()).data || [];
}
function normalizeCountryCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return { GHANA: 'GH', GH: 'GH', 'UNITED STATES': 'US', USA: 'US', US: 'US', 'UNITED KINGDOM': 'GB', UK: 'GB', GB: 'GB' }[normalized] || normalized;
}
function applySavedAddress(form, address) {
  if (!form || !address) return;
  const nameParts = String(address.fullName || '').trim().split(/\s+/);
  const set = (name, value) => { const field = form.elements[name]; if (field) field.value = value || ''; };
  set('firstName', nameParts.shift() || '');
  set('lastName', nameParts.join(' '));
  set('phone', address.phone);
  set('country', normalizeCountryCode(address.country));
  set('address', address.addressLine1);
  set('city', address.city);
  set('gpsAddress', address.instructions);
  applyCheckoutFieldValidation(form);
  form.querySelector('select[name="country"]')?.dispatchEvent(new Event('change', { bubbles: true }));
}
async function enhanceCheckoutAddressSelector(formSelector) {
  const form = document.querySelector(formSelector);
  if (!form || form.querySelector('.saved-address-control')) return;
  const addresses = await fetchSavedAddresses();
  if (!addresses.length) return;
  const control = document.createElement('div');
  control.className = 'saved-address-control';
  control.innerHTML = `<label>Use a saved address<select name="savedAddress"><option value="">Enter a new address</option>${addresses.map((address) => `<option value="${escapeHtml(address.id)}">${escapeHtml(address.fullName)} · ${escapeHtml(address.addressLine1)}, ${escapeHtml(address.city)}</option>`).join('')}</select></label><button type="button" class="page-secondary saved-address-clear">Clear</button>`;
  form.prepend(control);
  control.querySelector('select').addEventListener('change', (event) => {
    const address = addresses.find((item) => item.id === event.target.value);
    if (address) applySavedAddress(form, address);
  });
  control.querySelector('.saved-address-clear').addEventListener('click', () => { control.querySelector('select').value = ''; form.reset(); });
  const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0];
  control.querySelector('select').value = defaultAddress.id;
  applySavedAddress(form, defaultAddress);
}
async function renderAddressBook() {
  const frame = appPage.querySelector('.page-frame');
  if (!frame || frame.querySelector('.address-book-panel')) return;
  const addresses = await fetchSavedAddresses();
  const panel = document.createElement('section');
  panel.className = 'page-panel address-book-panel';
  const render = (items) => `<div class="panel-label">Saved addresses <span>${items.length} saved</span></div><div class="saved-address-list">${items.length ? items.map((address) => `<article class="saved-address-card" data-address-id="${escapeHtml(address.id)}"><div class="saved-address-summary"><strong>${escapeHtml(address.fullName)}</strong><p>${escapeHtml(address.addressLine1)}${address.addressLine2 ? `, ${escapeHtml(address.addressLine2)}` : ''}<br>${escapeHtml(address.city)}, ${escapeHtml(address.country)}${address.instructions ? `<br>GPS: ${escapeHtml(address.instructions)}` : ''}<br>${escapeHtml(address.phone)}</p></div><div class="saved-address-actions">${address.isDefault ? '<span class="address-default">Default</span>' : '<button type="button" class="address-action" data-address-default>Make default</button>'}<button type="button" class="address-action" data-address-edit>Edit</button></div></article>`).join('') : '<p class="page-empty">No saved addresses yet.</p>'}</div><form class="address-form" id="addressForm"><div class="panel-label">Add an address</div><div class="page-field-grid"><label>Full name<input name="fullName" required></label><label>Phone<input name="phone" required></label></div><div class="page-field-grid"><label>Country<input name="country" required></label><label>City<input name="city" required></label></div><div class="page-field-grid"><label>Address<input name="addressLine1" required></label><label>GPS address / landmark <small>(optional)</small><input name="instructions"></label></div><label class="address-default-toggle"><input type="checkbox" name="isDefault"> Make this my default address</label><button class="page-primary" type="submit">Save address <span>↗</span></button><p class="page-message" id="addressFormMessage"></p></form>`;
  panel.innerHTML = render(addresses);
  frame.append(panel);
  const refresh = async (message) => { panel.remove(); await renderAddressBook(); if (message) showToast(message); };
  panel.querySelector('.saved-address-list')?.addEventListener('click', async (event) => {
    const card = event.target.closest('[data-address-id]');
    if (!card) return;
    const address = addresses.find((item) => item.id === card.dataset.addressId);
    if (!address) return;
    if (event.target.closest('[data-address-default]')) {
      const response = await fetch(`http://localhost:4000/api/v1/addresses/${encodeURIComponent(address.id)}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ isDefault: true }) });
      if (!response.ok) return showToast('Could not set the default address.');
      await refresh('Default address updated.');
      return;
    }
    if (event.target.closest('[data-address-edit]')) {
      card.innerHTML = `<form class="address-edit-form"><div class="page-field-grid"><label>Full name<input name="fullName" value="${escapeHtml(address.fullName)}" required></label><label>Phone<input name="phone" value="${escapeHtml(address.phone)}" required></label></div><div class="page-field-grid"><label>Country<input name="country" value="${escapeHtml(address.country)}" required></label><label>City<input name="city" value="${escapeHtml(address.city)}" required></label></div><label>Address<input name="addressLine1" value="${escapeHtml(address.addressLine1)}" required></label><label>GPS address / landmark <small>(optional)</small><input name="instructions" value="${escapeHtml(address.instructions || '')}"></label><div class="address-edit-actions"><button type="submit" class="page-primary">Save changes</button><button type="button" class="page-secondary" data-address-cancel>Cancel</button></div><p class="page-message"></p></form>`;
      card.querySelector('input')?.focus();
    }
  });
  panel.querySelector('.saved-address-list')?.addEventListener('submit', async (event) => {
    const form = event.target.closest('.address-edit-form');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const response = await fetch(`http://localhost:4000/api/v1/addresses/${encodeURIComponent(form.closest('[data-address-id]').dataset.addressId)}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ fullName: data.get('fullName'), phone: data.get('phone'), country: data.get('country'), city: data.get('city'), addressLine1: data.get('addressLine1'), instructions: data.get('instructions') }) });
    if (!response.ok) { form.querySelector('.page-message').textContent = 'Could not update this address.'; return; }
    await refresh('Address updated.');
  });
  panel.querySelector('.saved-address-list')?.addEventListener('click', (event) => { if (!event.target.closest('[data-address-cancel]')) return; void refresh(); });
  panel.querySelector('#addressForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch('http://localhost:4000/api/v1/addresses', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ fullName: data.get('fullName'), phone: data.get('phone'), country: data.get('country'), city: data.get('city'), addressLine1: data.get('addressLine1'), instructions: data.get('instructions'), isDefault: data.get('isDefault') === 'on' }) });
    if (!response.ok) { $('#addressFormMessage').textContent = 'Could not save this address.'; return; }
    showToast('Address saved.');
    panel.remove();
    await renderAddressBook();
  });
}
async function renderKycPage() {
  if (!authToken) return;
  try {
    const response = await fetch('http://localhost:4000/api/v1/users/me', { headers: apiHeaders() });
    const user = response.ok ? (await response.json()).data : null;
    if (!user || String(user.role || '').toUpperCase() !== 'STAFF') return renderProfilePage();
    const kyc = user.kycApplication;
    requireClientPage('kyc', `${accountPageHeader('Staff verification', 'KYC and compliance submission.', 'Complete your identity, address, and screening profile before access is granted.')}<section class="page-panel page-form profile-tab-panel" data-profile-panel="kyc"><div class="panel-label">Staff KYC <span class="kyc-status-badge ${kyc?.status ? `kyc-status-${String(kyc.status).toLowerCase()}` : ''}">${escapeHtml(kyc?.status || 'NOT SUBMITTED')}</span></div>${kyc?.reviewReason ? `<p class="page-message">Review note: ${escapeHtml(kyc.reviewReason)}</p>` : ''}<form id="profileKycForm"><label>Document type<select name="documentType" required><option value="">Choose document type</option><option value="PASSPORT" ${kyc?.documentType === 'PASSPORT' ? 'selected' : ''}>Passport</option><option value="NATIONAL_ID" ${kyc?.documentType === 'NATIONAL_ID' ? 'selected' : ''}>National ID</option><option value="DRIVERS_LICENSE" ${kyc?.documentType === 'DRIVERS_LICENSE' ? 'selected' : ''}>Driver license</option><option value="RESIDENCE_PERMIT" ${kyc?.documentType === 'RESIDENCE_PERMIT' ? 'selected' : ''}>Residence permit</option></select></label><label>Document number<input name="documentNumber" value="${escapeHtml(kyc?.documentNumber || '')}" required></label><label>Identity documents<input name="documents" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple required></label><div class="kyc-upload-preview-grid"><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Identity document</div><div class="kyc-upload-preview-list" data-kyc-preview-list="documents"></div></div><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Proof of address</div><div class="kyc-upload-preview-list" data-kyc-preview-list="proofOfAddress"></div></div><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Selfie</div><div class="kyc-upload-preview-list" data-kyc-preview-list="selfie"></div></div></div><div class="kyc-workflow-fields"><div class="panel-label">Identity and residence</div><label>Aliases or maiden names <small>(optional)</small><input name="aliases" maxlength="500" value="${escapeHtml(kyc?.aliases || '')}"></label><div class="page-field-grid"><label>Date of birth<input name="dateOfBirth" type="date" required value="${kyc?.dateOfBirth ? new Date(kyc.dateOfBirth).toISOString().slice(0, 10) : ''}"></label><label>Nationality<input name="nationality" maxlength="80" required value="${escapeHtml(kyc?.nationality || '')}"></label></div><label>Current residential address<textarea name="currentAddress" rows="3" maxlength="500" required>${escapeHtml(kyc?.currentAddress || '')}</textarea></label><label>Previous addresses <small>(one per line, covering the past 3–5 years)</small><textarea name="previousAddresses" rows="3" maxlength="2500">${escapeHtml(Array.isArray(kyc?.previousAddresses) ? kyc.previousAddresses.join('\n') : '')}</textarea></label><label>Proof of address <small>(utility bill or bank statement from the last 3 months)</small><input name="proofOfAddress" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" required></label><label>Live selfie<div class="kyc-selfie-control"><input name="selfie" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required><button type="button" class="page-secondary" data-open-selfie-camera>Open camera</button></div><small data-selfie-status>Use your camera for a live selfie, or upload an image.</small></label><div class="panel-label">Access tier and agreements</div><label>Requested access tier<select name="accessTier"><option value="LEVEL_1_SUPPORT" ${kyc?.accessTier === 'LEVEL_1_SUPPORT' ? 'selected' : ''}>Level 1 · Basic support</option><option value="LEVEL_2_OPERATIONS" ${kyc?.accessTier === 'LEVEL_2_OPERATIONS' ? 'selected' : ''}>Level 2 · Operations and inventory</option><option value="LEVEL_3_FINANCE_EXECUTIVE" ${kyc?.accessTier === 'LEVEL_3_FINANCE_EXECUTIVE' ? 'selected' : ''}>Level 3 · Finance and executive</option></select></label><label class="check-row"><input name="ndaSigned" type="checkbox" required ${kyc?.ndaSigned ? 'checked' : ''}> <span>I have signed the <a href="/nda_confidentiality_agreement.pdf" target="_blank" rel="noopener" data-policy="nda">NDA and confidentiality agreement</a>.</span></label><label class="check-row"><input name="acceptableUsePolicyAccepted" type="checkbox" required ${kyc?.acceptableUsePolicyAccepted ? 'checked' : ''}> <span>I accept the <a href="/acceptable_use_policy.pdf" target="_blank" rel="noopener" data-policy="acceptable-use">Acceptable Use Policy</a>.</span></label><label>Notes<textarea name="notes" rows="3" maxlength="1000">${escapeHtml(kyc?.notes || '')}</textarea></label></div><button class="page-primary" type="submit">Submit KYC for review <span>↗</span></button><p class="page-message" id="profileKycMessage"></p></form></section>`);
    const form = document.querySelector('#profileKycForm');
    if (form) enhanceInternalKycForm(form);
  } catch {
    renderProfilePage();
  }
}
async function renderProfilePage() { if (!authToken) return; const response = await fetch('http://localhost:4000/api/v1/users/me', { headers: apiHeaders() }); const user = (await response.json()).data; const userRole = String(user.role || '').toUpperCase(); const kyc = user.kycApplication; const avatar = user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="Profile image">` : `<span>${escapeHtml(user.firstName.charAt(0).toUpperCase())}</span>`; const staffKyc = userRole === 'STAFF' ? `<section class="page-panel page-form profile-tab-panel" data-profile-panel="kyc"><div class="panel-label">Staff KYC <span class="kyc-status-badge ${kyc?.status ? `kyc-status-${String(kyc.status).toLowerCase()}` : ''}">${escapeHtml(kyc?.status || 'NOT SUBMITTED')}</span></div>${kyc?.reviewReason ? `<p class="page-message">Review note: ${escapeHtml(kyc.reviewReason)}</p>` : ''}<form id="profileKycForm"><label>Document type<input name="documentType" value="${escapeHtml(kyc?.documentType || '')}" placeholder="National ID or passport" required></label><label>Document number<input name="documentNumber" value="${escapeHtml(kyc?.documentNumber || '')}" required></label><label>Identity documents<input name="documents" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label><label>Notes<textarea name="notes" rows="3" maxlength="1000">${escapeHtml(kyc?.notes || '')}</textarea><button class="page-primary" type="submit">Submit KYC for review <span>↗</span></button><p class="page-message" id="profileKycMessage"></p></form></section>` : ''; requireClientPage('profile', `${accountPageHeader('Your account', 'Profile & preferences.', 'Manage your identity, security, and verification in one place.')}<div class="profile-tabs" role="tablist"><button type="button" class="active" data-profile-tab="profile">Profile</button><button type="button" data-profile-tab="security">Security</button>${userRole === 'STAFF' ? '<button type="button" data-profile-tab="kyc">Staff KYC</button>' : ''}</div><section class="account-page-grid"><div><section class="page-panel page-form profile-tab-panel" data-profile-panel="profile"><div class="profile-identity"><div class="profile-avatar" id="profileAvatar">${avatar}</div><div><div class="panel-label">Profile image</div><input id="profileImage" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small>Joined ${new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</small></div></div><form id="pageProfileForm"><div class="panel-label">Personal details</div><label>First name<input name="firstName" value="${escapeHtml(user.firstName)}" required></label><label>Last name<input name="lastName" value="${escapeHtml(user.lastName)}" required></label><label>Email address<input value="${escapeHtml(user.email)}" disabled></label><button class="page-primary" type="submit">Save changes <span>↗</span></button><p class="page-message" id="pageProfileMessage"></p></form></section><section class="page-panel page-form profile-tab-panel" data-profile-panel="security" hidden><form id="pagePasswordForm"><div class="panel-label">Password</div><label>Current password<input name="currentPassword" type="password" required></label><label>New password<input name="newPassword" type="password" minlength="8" required></label><button class="page-secondary" type="submit">Update password <span>↗</span></button><p class="page-message" id="pagePasswordMessage"></p></form></section>${staffKyc}</div><aside class="page-panel account-quick"><div class="panel-label">Account navigation</div><a href="#orders" data-page-link="orders"><span>▤</span>Order history <b>→</b></a><a href="#notifications" data-page-link="notifications"><span>♢</span>Notifications <b>→</b></a><a href="#shop" data-page-link="home"><span>⌂</span>Continue shopping <b>→</b></aside></section>`); document.querySelectorAll('[data-profile-tab]').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('[data-profile-tab]').forEach((item) => item.classList.toggle('active', item === tab)); document.querySelectorAll('[data-profile-panel]').forEach((panel) => { panel.hidden = panel.dataset.profilePanel !== tab.dataset.profileTab; }); })); $('#pageProfileForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.target); const result = await fetch('http://localhost:4000/api/v1/users/me', { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ firstName: data.get('firstName'), lastName: data.get('lastName') }) }); $('#pageProfileMessage').textContent = result.ok ? 'Profile updated.' : 'Could not update profile.'; }); $('#profileImage').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; const formData = new FormData(); formData.append('image', file); const result = await fetch('http://localhost:4000/api/v1/media/avatar', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: formData }); $('#pageProfileMessage').textContent = result.ok ? 'Profile image updated.' : 'Could not upload profile image.'; if (result.ok) { const avatarUrl = (await result.json()).data.avatarUrl; $('#profileAvatar').innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="Profile image">`; setAuthenticatedHeader({ ...user, avatarUrl }); } }); $('#pagePasswordForm').addEventListener('submit', async (event) => { event.preventDefault(); const result = await fetch('http://localhost:4000/api/v1/auth/change-password', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); const payload = await result.json().catch(() => ({})); $('#pagePasswordMessage').textContent = result.ok ? payload.message : payload.error || 'Could not update password.'; if (result.ok) event.target.reset(); }); $('#profileKycForm')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.target; const upload = new FormData(); upload.append('document', form.elements.document.files[0]); const uploadResponse = await fetch('http://localhost:4000/api/v1/media/kyc', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: upload }); const uploadPayload = await uploadResponse.json().catch(() => ({})); if (!uploadResponse.ok) { $('#profileKycMessage').textContent = uploadPayload.error || 'Could not upload document.'; return; } const result = await fetch('http://localhost:4000/api/v1/users/me/kyc', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ documentType: form.elements.documentType.value, documentNumber: form.elements.documentNumber.value, documentUrl: `http://localhost:4000${uploadPayload.data.documentUrl}`, notes: form.elements.notes.value }) }); const payload = await result.json().catch(() => ({})); $('#profileKycMessage').textContent = result.ok ? 'KYC submitted for admin review.' : payload.error || 'Could not submit KYC.'; }); }
document.addEventListener('click', (event) => { const tab = event.target.closest('#appPage [data-profile-tab="kyc"]'); if (!tab) return; event.preventDefault(); event.stopImmediatePropagation(); void renderKycPage(); }, true);
document.addEventListener('click', (event) => { const tab = event.target.closest('[data-profile-tab]'); if (!tab) return; const addressBook = document.querySelector('.address-book-panel'); if (addressBook) addressBook.hidden = tab.dataset.profileTab !== 'profile'; });
document.addEventListener('click', (event) => { const tab = event.target.closest('[data-profile-tab]'); if (tab) localStorage.setItem('ground-profile-tab', tab.dataset.profileTab); });
const restoreClientProfileTab = () => { const storedTab = localStorage.getItem('ground-profile-tab'); if (!storedTab) return; const tab = document.querySelector(`[data-profile-tab="${CSS.escape(storedTab)}"]`); if (tab && tab.dataset.restoredProfileTab !== 'true') { tab.dataset.restoredProfileTab = 'true'; tab.click(); } };
const clientProfileTabObserver = new MutationObserver(restoreClientProfileTab);
clientProfileTabObserver.observe(appPage, { childList: true, subtree: true });
async function renderOrdersPage() { if (!authToken) return; const response = await fetch('http://localhost:4000/api/v1/orders', { headers: apiHeaders() }); const orders = response.ok ? (await response.json()).data || [] : []; requireClientPage('orders', `${accountPageHeader('Order history', 'Every order, in one place.', 'Follow delivery progress, download receipts, and keep the full story of each purchase.')}<section class="page-panel orders-page-panel"><div class="panel-label">Your transactions <span>${orders.length} orders</span></div><div class="orders-page-list">${orders.length ? orders.map((order) => { const timeline = getOrderStatusTimeline(order.status); const canReturn = ['DELIVERED', 'RETURNED'].includes(String(order.status).toUpperCase()) && order.items?.length; const returnForm = canReturn ? `<details class="return-request"><summary>Return an item</summary><form data-return-form="${escapeHtml(order.id)}" class="page-form"><label>Item<select name="orderItemId" required>${order.items.map((item) => `<option value="${escapeHtml(item.id)}" data-unit-price="${Number(item.unitPrice)}" data-max-quantity="${item.quantity}">${escapeHtml(item.name)} · ${money(item.unitPrice)} each</option>`).join('')}</select></label><label>Quantity<input name="quantity" type="number" min="1" max="${order.items[0]?.quantity || 1}" value="1" required></label><label>Reason<textarea name="reason" rows="3" minlength="5" maxlength="500" placeholder="Tell us why you are returning this item." required></textarea></label><label>Refund amount<input name="amount" type="number" min="0.01" step="0.01" value="${Number(order.items[0]?.unitPrice || 0).toFixed(2)}" required></label><button class="page-primary" type="submit">Submit return request <span>↗</span></button><p class="page-message" data-return-message></p></form></details>` : ''; return `<article class="order-page-card"><div class="order-page-top"><div><span class="order-number">${escapeHtml(order.orderNumber)}</span><h2>${escapeHtml(order.status.replaceAll('_', ' '))}</h2><p>${new Date(order.createdAt).toLocaleDateString()} · ${money(order.total)} ${escapeHtml(order.currency)}</p></div><div class="order-actions"><button class="page-secondary" data-track-order="${escapeHtml(order.orderNumber)}">Track order <span>→</span></button>${order.orderNumber ? `<button class="page-secondary" data-view-receipt="${escapeHtml(order.orderNumber)}">Invoice <span>↓</span></button>` : ''}</div></div><div class="order-line">${timeline.completed.map((step) => `<span class="${step.complete ? 'complete' : ''}"></span>`).join('')}</div><div class="order-line-labels">${timeline.completed.map((step) => `<span>${escapeHtml(step.label)}</span>`).join('')}</div>${returnForm}</article>`; }).join('') : '<p class="page-empty">No orders yet. Your first purchase will appear here.</p>'}</div></section>`); document.querySelectorAll('[data-return-form]').forEach((form) => { const itemSelect = form.elements.orderItemId; const quantity = form.elements.quantity; const amount = form.elements.amount; const sync = () => { const option = itemSelect.selectedOptions[0]; const max = Number(option?.dataset.maxQuantity || 1); quantity.max = String(max); quantity.value = String(Math.min(Number(quantity.value) || 1, max)); amount.value = (Number(option?.dataset.unitPrice || 0) * Number(quantity.value || 1)).toFixed(2); }; itemSelect.addEventListener('change', sync); quantity.addEventListener('input', sync); form.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(form); const message = form.querySelector('[data-return-message]'); try { const result = await fetch('http://localhost:4000/api/v1/refunds', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ orderId: form.dataset.returnForm, orderItemId: data.get('orderItemId'), quantity: Number(data.get('quantity')), amount: Number(data.get('amount')), reason: data.get('reason') }) }); const payload = await result.json().catch(() => ({})); if (!result.ok) throw new Error(payload.error || 'Could not submit return request.'); message.textContent = 'Return request submitted. Support will review it shortly.'; form.querySelector('button[type="submit"]').disabled = true; } catch (error) { message.textContent = error.message; } }); }); }
async function renderNotificationsPage() { if (!authToken) return; const response = await fetch('http://localhost:4000/api/v1/notifications', { headers: apiHeaders() }); const payload = response.ok ? await response.json() : { data: [] }; requireClientPage('notifications', `${accountPageHeader('Your inbox', 'Notifications that matter.', 'Order updates, delivery milestones, and account activity live here.')}<section class="page-panel notifications-page-panel"><div class="panel-label">Recent activity <span>${payload.unread || 0} unread</span></div><div class="page-notification-list">${payload.data?.length ? payload.data.map((notification) => `<article class="page-notification ${notification.readAt ? '' : 'unread'}" data-page-notification="${escapeHtml(notification.id)}"><span class="notification-icon">♢</span><div><strong>${escapeHtml(notification.title || 'Account update')}</strong><p>${escapeHtml(notification.body || '')}</p><small>${new Date(notification.createdAt).toLocaleString()}</small></div><b>${notification.readAt ? 'Read' : 'New'}</b></article>`).join('') : '<p class="page-empty">You are all caught up.</p>'}</div></section>`); }
async function renderTrackingPageLegacy(orderNumber = '') { if (!authToken) return; const response = await fetch('http://localhost:4000/api/v1/orders', { headers: apiHeaders() }); const orders = response.ok ? (await response.json()).data || [] : []; const order = orders.find((item) => item.orderNumber === orderNumber) || orders[0]; requireClientPage('tracking', `${accountPageHeader('Delivery tracking', 'Track your order.', 'A clear view of where your package is and what happens next.')}<section class="tracking-layout"><form class="page-panel tracking-search" id="trackingSearch"><div class="panel-label">Find an order</div><label>Order number<input name="orderNumber" placeholder="GR-2026-0001" value="${escapeHtml(order?.orderNumber || '')}" required></label><button class="page-primary" type="submit">Track order <span>⌕</span></button></form>${order ? `<article class="page-panel tracking-card"><div class="tracking-summary"><div><span class="order-number">${escapeHtml(order.orderNumber)}</span><h2>${escapeHtml(order.status.replaceAll('_', ' '))}</h2><p>Placed ${new Date(order.createdAt).toLocaleDateString()} · ${money(order.total)} ${escapeHtml(order.currency)}</p></div><span class="tracking-badge">${escapeHtml(order.status.replaceAll('_', ' '))}</span></div><div class="tracking-progress"><span class="active"><i>✓</i><b>Order placed</b><small>Received</small></span><span class="active"><i>✓</i><b>Confirmed</b><small>Processing</small></span><span class="${['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status) ? 'active' : ''}"><i>✓</i><b>Shipped</b><small>On the way</small></span><span class="${order.status === 'DELIVERED' ? 'active' : ''}"><i>✓</i><b>Delivered</b><small>Arriving soon</small></span></div><div class="tracking-help"><strong>Need help with this order?</strong><p>Our support team can help with delivery questions.</p><button class="page-secondary" type="button" data-page-link="home">Continue shopping</button></div></article>` : '<article class="page-panel page-empty">No matching order found.</article>'}</section>`); $('#trackingSearch').addEventListener('submit', (event) => { event.preventDefault(); renderTrackingPageLegacy(new FormData(event.target).get('orderNumber')); }); }
function renderCheckoutPage() { if (!authToken) { showToast('Sign in before checkout'); $('#accountModal').classList.add('open'); $('#accountModal').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); return; } const items = cart.map((item) => `<div class="checkout-line"><img src="${escapeHtml(imageFor(item))}" alt=""><div><strong>${escapeHtml(item.name)}</strong><small>Qty ${item.quantity}</small></div><b>${money(item.price * item.quantity)}</b></div>`).join(''); showAppPage('checkout', `${accountPageHeader('Secure checkout', 'Make it yours.', 'A considered checkout with every detail in the right place.')}<section class="checkout-page-layout"><form class="page-panel page-form" id="pageCheckoutForm"><div class="panel-label">Contact & delivery</div><div class="page-field-grid"><label>First name<input name="firstName" required autocomplete="given-name"></label><label>Last name<input name="lastName" required autocomplete="family-name"></label></div><label>Email address<input type="email" name="email" required autocomplete="email"></label><label>Phone<input type="tel" name="phone" required autocomplete="tel"></label><label>Address<input name="address" required autocomplete="street-address"></label><div class="page-field-grid"><label>City<input name="city" required autocomplete="address-level2"></label><label>Postal code<input name="postal" required autocomplete="postal-code"></label></div><label>Country<select name="country" required><option value="US">United States</option><option value="GH">Ghana</option><option value="GB">United Kingdom</option></select></label><div class="panel-label payment-heading">Payment provider</div><label><select name="provider"><option value="paystack">Paystack</option></select></label><button class="page-primary" type="submit">Place order <span>↗</span></button><p class="page-message" id="checkoutPageMessage"></p></form><aside class="page-panel checkout-summary"><div class="panel-label">Your order</div>${items || '<p class="page-empty">Your bag is empty.</p>'}<div class="checkout-summary-total"><span>Total</span><strong>${money(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))}</strong></div><div class="checkout-support-note"><span>Need help before you pay?</span><a class="support-whatsapp-link" data-support-whatsapp-link data-support-whatsapp-message="Hello, I need help completing my checkout." href="#" target="_blank" rel="noopener noreferrer" hidden><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp support</a></div></aside></section>`); syncSupportWhatsAppLink(); if (authToken) { fetch('http://localhost:4000/api/v1/users/me', { headers: apiHeaders() }).then((response) => response.json()).then((user) => { const form = $('#pageCheckoutForm'); if (!form) return; form.elements.firstName.value = user.data.firstName || ''; form.elements.lastName.value = user.data.lastName || ''; form.elements.email.value = user.data.email || ''; form.elements.phone.value = user.data.phone || ''; }).catch(() => { }); } $('#pageCheckoutForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.target; try { const addressId = await ensureCheckoutAddress(form); const orderResponse = await fetch('http://localhost:4000/api/v1/orders', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ items: cart.map((item) => ({ productId: toServerProductId(item), quantity: Number(item.quantity) })), addressId, email: form.elements.email.value, currency: currencyCode }) }); const result = await orderResponse.json().catch(() => ({})); if (!orderResponse.ok) throw new Error(result.error || 'Unable to create order'); checkoutOrderNumber = result.data.orderNumber; cart = []; saveState(); renderCart(); $('#checkoutPageMessage').textContent = `Order ${checkoutOrderNumber} received. We will keep you updated here.`; form.querySelector('button').disabled = true; } catch (error) { $('#checkoutPageMessage').textContent = error.message; } }); }
function renderInfoPage(name) { const content = name === 'about' ? `${accountPageHeader('Our point of view', 'Less, but much better.', 'Ground is a considered marketplace for useful objects, honest materials, and the details that make everyday life feel more intentional.')}<section class="info-page-grid"><article class="page-panel"><div class="panel-label">What we look for</div><p>We choose pieces that earn their place through thoughtful function, enduring form, and materials that become more personal with time.</p></article><article class="page-panel"><div class="panel-label">How we work</div><p>We keep the collection focused, work with makers we trust, and make it easier to buy fewer things that are better suited to your life.</p></article></section>` : `${accountPageHeader('Customer care', 'We are here to help.', 'Questions about an order, a product, or finding the right piece? Send us a note and our team will get back to you.')}<section class="contact-layout"><form class="page-panel page-form" id="contactForm"><div class="panel-label">Send a message</div><label>Name<input name="name" required></label><label>Email address<input type="email" name="email" required></label><label>Message<textarea name="message" rows="5" required></textarea></label><button class="page-primary" type="submit">Send message <span>↗</span></button><p class="page-message" id="contactMessage"></p></form><aside class="page-panel"><div class="panel-label">Other ways to reach us</div><p>For order support, include your order number so we can help quickly.</p><div class="support-contact-links"><a class="text-link" id="supportEmailLink" href="mailto:">Loading support contact…</a><a class="text-link support-whatsapp-link" data-support-whatsapp-link href="#" target="_blank" rel="noopener noreferrer" hidden><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Chat on WhatsApp</a></div></aside></section>`; showAppPage(name, content); if (name === 'contact') { syncSupportEmailLink(); syncSupportWhatsAppLink(); $('#contactForm').addEventListener('submit', (event) => { event.preventDefault(); $('#contactMessage').textContent = 'Thanks. We will be in touch shortly.'; event.target.reset(); }); } }
async function hydrateTrackingItems() { const card = document.querySelector('.tracking-card'); if (!card || card.querySelector('.tracking-items')) return; const number = card.querySelector('.order-number')?.textContent; if (!number) return; const response = await fetch('http://localhost:4000/api/v1/orders', { headers: apiHeaders() }); if (!response.ok) return; const order = ((await response.json()).data || []).find((item) => item.orderNumber === number); if (!order?.items?.length) return; const lines = order.items.map((item) => { const product = products.find((entry) => normalizeProductId(entry.id) === normalizeProductId(item.productId)) || products.find((entry) => entry.name?.toLowerCase() === item.name?.toLowerCase()); return `<div class="tracking-item"><img src="${escapeHtml(imageFor(product))}" alt="${escapeHtml(item.name)}"><div><strong>${escapeHtml(item.name)}</strong><small>Qty ${item.quantity}</small></div><b>${money(Number(item.unitPrice) * item.quantity)}</b></div>`; }).join(''); card.querySelector('.tracking-progress')?.insertAdjacentHTML('beforebegin', `<div class="tracking-items"><div class="panel-label">Items in this order</div>${lines}</div>`); }
let trackingMapLoaderPromise;
function loadTrackingMapRenderer() {
  if (typeof window.renderDeliveryRouteMap === 'function') return Promise.resolve();
  if (!trackingMapLoaderPromise) {
    trackingMapLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'tracking-map.bundle.js?v=20261125-tracking-complete-11';
      script.onload = () => typeof window.renderDeliveryRouteMap === 'function'
        ? resolve()
        : reject(new Error('The delivery route preview did not initialize.'));
      script.onerror = () => reject(new Error('The delivery route preview could not be loaded.'));
      document.head.appendChild(script);
    }).catch((error) => {
      trackingMapLoaderPromise = undefined;
      throw error;
    });
  }
  return trackingMapLoaderPromise;
}
async function renderTrackingPage(orderNumber = '', options = {}) {
  if (!authToken) return;
  window.destroyDeliveryRouteMap?.();
  const response = await fetch('http://localhost:4000/api/v1/orders', { headers: apiHeaders() });
  const orders = response.ok ? (await response.json()).data || [] : [];
  const order = orders.find((item) => item.orderNumber === orderNumber) || orders[0];
  const currentStatus = String(order?.status || 'PENDING').toUpperCase();
  const statusIndex = Math.max(0, orderStatusSteps.findIndex((step) => step.key === currentStatus));
  const currentStep = orderStatusSteps[statusIndex];
  const timeline = order ? getOrderStatusTimeline(currentStatus) : { completed: [], next: orderStatusSteps[0] };
  const deliveryEstimate = getTrackingDeliveryEstimate(order, currentStatus);
  const orderUpdatedAt = new Date(order?.updatedAt || order?.createdAt || '');
  const lastOrderUpdate = Number.isFinite(orderUpdatedAt.getTime())
    ? orderUpdatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Update time unavailable';
  const trackingStagesSummary = orderStatusSteps.map((step, index) => {
    const stageState = index < statusIndex ? 'complete' : index === statusIndex ? 'current' : 'upcoming';
    return `${step.label}: ${stageState}`;
  }).join('. ');
  const trackingMapSummary = `Illustrative route, not live GPS. Current order stage: ${currentStep.label}. ${trackingStagesSummary}.`;
  const milestones = [
    { label: 'Ordered', detail: 'Order received', key: 'PENDING' },
    { label: 'Confirmed', detail: 'Order confirmed', key: 'CONFIRMED' },
    { label: 'Shipped', detail: 'On the way', key: 'SHIPPED' },
    { label: 'Delivered', detail: 'Arriving soon', key: 'DELIVERED' },
  ];
  const items = order?.items?.map((item) => {
    const product = products.find((entry) => normalizeProductId(entry.id) === normalizeProductId(item.productId)) || products.find((entry) => entry.name?.toLowerCase() === item.name?.toLowerCase());
    const itemImage = imageFor(item.product) || imageFor(product);
    return `<div class="tracking-item"><img src="${escapeHtml(itemImage)}" alt="${escapeHtml(item.name)}" loading="lazy"><div><strong>${escapeHtml(item.name)}</strong><small>Qty: ${item.quantity} <span>·</span> ${escapeHtml(item.sku || 'Standard')}</small></div><div class="tracking-item-price"><b>${money(Number(item.unitPrice) * item.quantity)}</b><small>${money(Number(item.unitPrice) * item.quantity)} total</small></div></div>`;
  }).join('') || '<p class="page-empty">No items are attached to this order yet.</p>';
  const placedDate = order ? new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const address = order?.address;
  const payment = order?.payments?.[0];
  const paymentFailed = ['FAILED', 'CANCELLED', 'EXPIRED'].includes(String(payment?.status || order?.paymentStatus || '').toUpperCase());
  const paymentIncomplete = payment && String(payment.status || '').toUpperCase() !== 'SUCCESS';
  if (order && !paymentIncomplete && localStorage.getItem(`ground-paid-cart-cleared-${order.orderNumber}`) !== 'true') { clearPurchasedCart(); localStorage.setItem(`ground-paid-cart-cleared-${order.orderNumber}`, 'true'); void clearServerCart(); }
  const reviewForm = order && !paymentIncomplete ? `<section class="page-panel tracking-section"><h3>Rate your experience</h3><form class="page-form" id="trackingReviewForm"><div class="review-product-picker"><p>Choose a product to review</p><div>${(order.items || []).map((item, index) => { const product = products.find((entry) => normalizeProductId(entry.id) === normalizeProductId(item.productId)); return `<button type="button" class="review-product-card${index === 0 ? ' selected' : ''}" data-review-product="${escapeHtml(item.productId)}"><img src="${escapeHtml(imageFor(product || item.product))}" alt=""><span>${escapeHtml(item.name)}</span><small>Qty ${item.quantity}</small></button>`; }).join('')}</div></div><input type="hidden" name="productId" value="${escapeHtml(order.items?.[0]?.productId || '')}"><div class="review-rating-picker"><p>Your rating</p><div class="review-stars" role="radiogroup" aria-label="Choose a rating">${Array.from({ length: 5 }, (_, index) => `<button type="button" class="review-star${index < 5 ? ' selected' : ''}" data-review-value="${index + 1}" aria-label="${index + 1} out of 5">★</button>`).join('')}</div></div><label>Comment<textarea name="body" rows="4" minlength="10" maxlength="3000" required placeholder="Tell us how the experience was..."></textarea></label><button class="page-primary" type="submit">Submit rating <span>↗</span></button></form></section>` : '';
  const addressLines = address ? [address.firstName && `${address.firstName} ${address.lastName || ''}`.trim(), address.line1 || address.address, address.city && `${address.city}${address.state ? `, ${address.state}` : ''} ${address.postalCode || ''}`.trim(), address.country, address.phone].filter(Boolean) : [];
  const destinationLabel = [address?.city, address?.country].filter(Boolean).join(', ') || 'Delivery area';
  const card = order ? `<div class="tracking-results">
    <article class="tracking-order-head"><div><h2>Order ${escapeHtml(order.orderNumber)}</h2><p>Placed on ${escapeHtml(placedDate)}</p></div><div class="tracking-actions"><span class="tracking-badge">${escapeHtml(paymentFailed ? 'PAYMENT FAILED' : paymentIncomplete ? 'PAYMENT PENDING' : currentStatus.replaceAll('_', ' '))}</span>${paymentIncomplete && payment?.id ? `<label class="retry-payment-email">Payment email<input type="email" value="${escapeHtml(order.user?.email || '')}" data-retry-email-input="${escapeHtml(payment.id)}" autocomplete="email" required></label><button class="page-primary" type="button" data-retry-payment="${escapeHtml(payment.id)}" data-retry-provider="paystack">Try payment again <span>↗</span></button>` : ''}<button class="page-secondary" type="button" data-view-receipt="${escapeHtml(order.orderNumber)}"><span>⇩</span> Invoice</button><button class="page-secondary" type="button" data-print-page><span>▧</span> Print</button></div></article>
    <section class="page-panel tracking-section tracking-route-section" aria-labelledby="trackingRouteTitle"><div class="tracking-route-heading"><div><p class="tracking-route-eyebrow">STATUS-DRIVEN PREVIEW</p><h3 id="trackingRouteTitle">Your delivery, in motion</h3></div><span class="tracking-route-chip"><i class="fa-solid fa-route" aria-hidden="true"></i> Route preview</span></div><div class="tracking-route-meta" aria-label="Delivery update"><div class="tracking-route-meta-card"><span>Current stage</span><strong>${escapeHtml(currentStep.label)}</strong><small>${escapeHtml(currentStep.detail)}</small></div><div class="tracking-route-meta-card"><span>Estimated delivery</span><strong>${escapeHtml(deliveryEstimate.title)}</strong><small>${escapeHtml(deliveryEstimate.detail)}</small></div><div class="tracking-route-meta-card"><span>Last order update</span><strong>${escapeHtml(lastOrderUpdate)}</strong><small>Based on the latest saved order update.</small></div></div><div class="tracking-map-canvas" id="deliveryRouteMap" role="img" aria-label="Illustrative delivery route to ${escapeHtml(destinationLabel)}. Current stage: ${escapeHtml(currentStep.label)}." aria-describedby="trackingMapAccessibleSummary"><span class="tracking-map-loading">Preparing your route preview…</span></div><p class="tracking-map-accessible-summary" id="trackingMapAccessibleSummary">${escapeHtml(trackingMapSummary)}</p><div class="tracking-route-legend"><span><i class="tracking-route-dot dispatch" aria-hidden="true"></i> Dispatch</span><span class="tracking-route-legend-arrow" aria-hidden="true">→</span><span><i class="tracking-route-dot destination" aria-hidden="true"></i> ${escapeHtml(destinationLabel)}</span><span class="tracking-route-legend-current"><i aria-hidden="true"></i> Current delivery segment</span></div><p class="tracking-route-disclaimer"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> This animated map is an illustrative status preview, not live GPS or a real road route. Green spaces and street details are decorative.</p></section>
    <div class="tracking-detail-pane">
    <section class="page-panel tracking-section delivery-section"><div class="tracking-section-heading"><div><h3>Delivery progress</h3><p>Estimated delivery: ${escapeHtml(deliveryEstimate.title)}</p></div></div><div class="tracking-milestones"><div class="tracking-meter"><span style="width:${Math.round((Math.min(statusIndex, 6) / 6) * 100)}%"></span></div>${milestones.map((step) => { const stepIndex = orderStatusSteps.findIndex((item) => item.key === step.key); const complete = statusIndex >= stepIndex; return `<div class="tracking-milestone ${complete ? 'complete' : ''}"><i>${complete ? '✓' : '◈'}</i><b>${step.label}</b><small>${step.detail}</small></div>`; }).join('')}</div></section>
    <section class="page-panel tracking-section tracking-timeline-section"><h3>Order timeline</h3><div class="tracking-timeline">${timeline.completed.map((step, index) => `<div class="tracking-event ${step.complete ? 'complete' : ''} ${step.active ? 'current' : ''}"><i>${step.complete ? '✓' : step.icon}</i><div><strong>${escapeHtml(step.label)}${step.active ? '<em>Current</em>' : ''}</strong><p>${escapeHtml(step.detail)}</p><small>${index === 0 ? escapeHtml(placedDate) : step.complete ? 'In progress' : 'Expected next'}</small></div></div>`).join('')}</div></section>
    <section class="page-panel tracking-section tracking-info"><h3>Tracking information</h3><div class="tracking-info-grid"><div><strong>▱ &nbsp; Standard delivery</strong><p>Tracking # ${escapeHtml(order.orderNumber)}</p><b>Status</b><span class="tracking-status">${escapeHtml(currentStatus.replaceAll('_', ' '))}</span><b>Estimated delivery</b><p>${currentStatus === 'DELIVERED' ? 'Delivered' : 'In 3–5 business days'}</p></div><div><b>Last update</b><p>${escapeHtml(timeline.next?.detail || 'Your order has been delivered.')}</p><small>${new Date(order.updatedAt || order.createdAt).toLocaleString()}</small><b>Last location</b><p>${escapeHtml(address?.city || 'Processing facility')}</p></div></div></section>
    <section class="page-panel tracking-section tracking-items-section"><h3>Order items</h3><div class="tracking-items">${items}</div><div class="tracking-items-total"><span>${order.items?.length || 0} items</span><span>Total: <strong>${money(order.total)} ${escapeHtml(order.currency)}</strong></span></div></section>
    <div class="tracking-detail-grid"><section class="page-panel tracking-section"><h3>⌖ &nbsp; Shipping address</h3><div class="tracking-address">${addressLines.length ? addressLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('') : '<p>Address details unavailable.</p>'}</div></section><section class="page-panel tracking-section"><h3>▣ &nbsp; Payment method</h3><div class="tracking-address"><p>${escapeHtml(payment?.paymentMethod || payment?.provider || 'Secure checkout')}</p><p>Reference ${escapeHtml(payment?.reference || 'Pending')}</p><p>Total: ${money(order.total)} ${escapeHtml(order.currency)}</p></div></section></div>
    ${reviewForm}<section class="page-panel tracking-help"><strong>Need help with your order?</strong><p>Our support team is here to help with delivery questions, payment issues, or anything about this order.</p><div class="tracking-help-actions">${supportWhatsAppButton(`Hello, I need help with order ${order.orderNumber}.`, 'tracking-whatsapp-button')}<button class="page-secondary" type="button" data-page-link="contact">Contact support</button><button class="page-secondary" type="button" data-page-link="orders">View order details</button></div></section>
    </div>
  </div>` : '<p class="page-empty">No orders yet. Track a recent purchase to keep an eye on it here.</p>';
  requireClientPage('tracking', `<div class="tracking-page-title"><h1>Track Your Order</h1><p>Enter your order details to check the current status</p></div><section class="tracking-layout"><form class="page-panel tracking-search" id="trackingSearch"><div><h3>Find Your Order</h3><p>Enter your order ID and email address to track your order</p></div><div class="tracking-search-fields"><label>Order ID<input name="orderNumber" placeholder="GR-2026-0001" value="${escapeHtml(order?.orderNumber || '')}" required></label><label>Email Address<input name="email" type="email" placeholder="you@example.com" value="${escapeHtml(order?.user?.email || '')}"></label></div><button class="page-primary" type="submit"><span>⌕</span> Track Order</button></form>${card}</section>`, options);
  const routeMap = $('#deliveryRouteMap');
  if (routeMap) {
    void loadTrackingMapRenderer().then(() => {
      if (routeMap.isConnected) window.renderDeliveryRouteMap(routeMap, {
        progressIndex: Math.min(statusIndex, orderStatusSteps.length - 1),
      });
    }).catch((error) => {
      if (!routeMap.isConnected) return;
      console.error('Unable to render the delivery route preview.', error);
      const errorMessage = document.createElement('span');
      errorMessage.className = 'tracking-map-error';
      errorMessage.textContent = 'The route preview could not be loaded. Please refresh to try again.';
      routeMap.replaceChildren(errorMessage);
    });
  }
  $('#trackingSearch')?.addEventListener('submit', (event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get('orderNumber') || '').trim(); if (value) navigatePage('tracking', value); });
  const reviewFormElement = $('#trackingReviewForm');
  reviewFormElement?.querySelectorAll('[data-review-product]').forEach((button) => button.addEventListener('click', () => { const selected = button.classList.toggle('selected'); if (!selected && !reviewFormElement.querySelector('[data-review-product].selected')) button.classList.add('selected'); }));
  reviewFormElement?.querySelectorAll('[data-review-value]').forEach((button) => button.addEventListener('click', () => { const rating = Number(button.dataset.reviewValue); reviewFormElement.dataset.rating = String(rating); reviewFormElement.querySelectorAll('[data-review-value]').forEach((star) => star.classList.toggle('selected', Number(star.dataset.reviewValue) <= rating)); }));
  reviewFormElement?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const rating = Number(form.dataset.rating || 5); const productIds = [...form.querySelectorAll('[data-review-product].selected')].map((button) => button.dataset.reviewProduct); if (!productIds.length) return showClientAlert('warning', 'Choose a product', 'Select at least one product to review.'); try { const results = await Promise.all(productIds.map(async (productId) => { const response = await fetch(`http://localhost:4000/api/v1/reviews/product/${encodeURIComponent(productId)}`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ rating, title: 'Order experience', body: String(data.get('body') || '').trim() }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Unable to submit your rating'); productReviews.delete(normalizeProductId(productId)); await loadProductReviews(productId); return result; })); form.reset(); form.dataset.rating = '5'; form.querySelectorAll('[data-review-product]').forEach((button, index) => button.classList.toggle('selected', index === 0)); form.querySelectorAll('[data-review-value]').forEach((star) => star.classList.add('selected')); await showClientAlert('success', 'Reviews saved', `${results.length} product${results.length === 1 ? '' : 's'} reviewed successfully.`); } catch (error) { await showClientAlert('error', 'Review could not be saved', error.message || 'Unable to submit your rating.'); } });
}
document.addEventListener('click', async (event) => { const retry = event.target.closest('[data-retry-payment]'); if (!retry) return; const emailField = document.querySelector(`[data-retry-email-input="${CSS.escape(retry.dataset.retryPayment)}"]`); const email = String(emailField?.value || '').trim(); if (!emailField?.checkValidity() || !email) { emailField?.reportValidity(); return; } retry.disabled = true; try { const response = await fetch(`http://localhost:4000/api/v1/payments/initialize`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ provider: 'paystack', paymentId: retry.dataset.retryPayment, email }) }); const result = await response.json().catch(() => ({})); if (response.status === 401) { setClientToken(''); authToken = ''; await showClientAlert('warning', 'Sign in required', 'Your session has expired. Sign in again before retrying this payment.'); $('#accountModal').classList.add('open'); $('#accountModal').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); return; } if (!response.ok) throw new Error(result.message || result.error || 'Unable to retry payment'); if (!result.provider?.redirectUrl) throw new Error('Payment provider is unavailable right now'); window.location.assign(result.provider.redirectUrl); } catch (error) { await showClientAlert('error', 'Payment could not be started', error.message || 'Unable to retry payment.'); } finally { retry.disabled = false; } });
function navigatePage(name, value = '') { $('#accountDropdown').hidden = true; closeAccountModal(); if (name === 'home') { location.hash = 'shop'; showStorePage(); return; } if (name === 'checkout') { renderCheckoutPage(); return; } if (name === 'about' || name === 'contact') { renderInfoPage(name); location.hash = name; return; } if (name === 'profile') { renderProfilePage(); location.hash = 'profile'; return; } if (name === 'kyc') { renderKycPage().then(() => document.querySelector('[data-profile-tab="kyc"]')?.click()); location.hash = 'profile'; return; } if (name === 'orders') { renderOrdersPage(); location.hash = 'orders'; return; } if (name === 'notifications') { renderNotificationsPage(); location.hash = 'notifications'; return; } if (name === 'tracking') { renderTrackingPage(value); location.hash = value ? `tracking/${encodeURIComponent(value)}` : 'tracking'; return; } }
function routeFromHash() { const route = location.hash.replace(/^#/, ''); const [section, value] = route.split('/'); if (section === 'profile') renderProfilePage(); else if (section === 'kyc') renderKycPage().then(() => document.querySelector('[data-profile-tab="kyc"]')?.click()); else if (section === 'orders') renderOrdersPage(); else if (section === 'notifications') renderNotificationsPage(); else if (section === 'tracking') renderTrackingPage(value || ''); else if (section === 'checkout') renderCheckoutPage(); else if (section === 'about' || section === 'contact') renderInfoPage(section); else showStorePage(); }
window.addEventListener('hashchange', () => {
  if (location.hash.replace(/^#/, '').split('/')[0] !== 'tracking') window.destroyDeliveryRouteMap?.();
});
const getClientToken = () => localStorage.getItem(CLIENT_TOKEN_KEY) || localStorage.getItem('ground-token') || '';
const openOrderReceipt = async (orderNumber) => {
  if (!orderNumber) return;
  await viewReceipt(orderNumber);
  if (authToken) {
    navigatePage('tracking', orderNumber);
  }
};
const THEME_KEY = 'ground-theme';
const applyTheme = (themeName = localStorage.getItem(THEME_KEY) || 'light') => {
  const isDark = themeName === 'dark';
  document.body.dataset.theme = themeName;
  localStorage.setItem(THEME_KEY, themeName);
  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    toggle.textContent = isDark ? '☾' : '☀';
    toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  });
};
let authToken = getClientToken();
const setAuthenticatedHeader = (user) => { const role = String(user.role || '').toUpperCase(); const operationsRole = ['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(role); const avatar = $('#accountAvatar'); $('#accountName').textContent = user.firstName || 'Account'; $('#accountDropdownName').textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Account'; if (avatar) avatar.innerHTML = user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="">` : escapeHtml((user.firstName || 'A').charAt(0).toUpperCase()); $('#adminAccess').hidden = true; $('#headerAdminDashboard').hidden = !operationsRole; $('#headerKyc').hidden = role !== 'STAFF'; };
if (authToken || localStorage.getItem(ADMIN_TOKEN_KEY)) { $('#adminAccess').hidden = true; $('#accountName').textContent = 'Account'; }
const setClientToken = (token) => {
  if (token) {
    localStorage.setItem(CLIENT_TOKEN_KEY, token);
    localStorage.removeItem('ground-token');
  } else {
    localStorage.removeItem(CLIENT_TOKEN_KEY);
    localStorage.removeItem('ground-token');
  }
};
const normalizeProductId = (id) => String(id ?? '').trim();
const normalizeImageSource = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return normalizeImageSource(value[0]);
  if (typeof value === 'object') {
    if (typeof value.url === 'string') return value.url.trim();
    if (typeof value.src === 'string') return value.src.trim();
    if (typeof value.image === 'string') return value.image.trim();
    if (typeof value.href === 'string') return value.href.trim();
    if (Array.isArray(value.images)) return normalizeImageSource(value.images[0]);
    if (value.product && typeof value.product === 'object') return normalizeImageSource(value.product.images || value.product.image || value.product);
  }
  return '';
};
const toServerProductId = (item) => {
  const direct = products.find((product) => normalizeProductId(product.id) === normalizeProductId(item?.id));
  if (direct && String(direct.id).length > 10) return String(direct.id);
  const byName = products.find((product) => product && item && product.name && item.name && product.name.toLowerCase() === item.name.toLowerCase() && String(product.id).length > 10);
  if (byName) return String(byName.id);
  return normalizeProductId(item?.id || '');
};
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).format(Number(value || 0));
function bindCheckoutCoupon(form) { const button = form?.parentElement?.querySelector('[data-apply-coupon]') || form?.closest('.checkout-modal')?.querySelector('[data-apply-coupon]'); if (!button || button.dataset.couponBound) return; button.dataset.couponBound = 'true'; button.addEventListener('click', () => { const container = button.closest('.checkout-coupon'); const message = container?.querySelector('[data-coupon-message]'); void applyCheckoutCoupon(form, container).catch((error) => { if (message) { message.classList.add('error'); message.textContent = error.message; } showToast(error.message); }); }); }
let publishedCoupons = [];
let publishedCouponsRequest = 0;
async function loadPublishedCoupons() {
  const requestId = ++publishedCouponsRequest;
  try {
    const response = await fetch('http://localhost:4000/api/v1/coupons/public');
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not load offers');
    if (requestId !== publishedCouponsRequest) return;
    publishedCoupons = Array.isArray(result.data) ? result.data : [];
  } catch {
    if (requestId !== publishedCouponsRequest) return;
    publishedCoupons = [];
  }
  renderPublishedCoupons();
}
function renderPublishedCoupons() {
  document.querySelectorAll('[data-published-coupons]').forEach((container) => {
    const wrapper = container.closest('.published-coupons');
    if (!publishedCoupons.length) { if (wrapper) wrapper.hidden = true; container.innerHTML = ''; return; }
    if (wrapper) wrapper.hidden = false;
    const offerCount = wrapper?.querySelector('[data-offer-count]');
    if (offerCount) offerCount.textContent = `${publishedCoupons.length} ${publishedCoupons.length === 1 ? 'offer' : 'offers'}`;
    container.innerHTML = publishedCoupons.map((coupon) => {
      const valueLabel = coupon.type === 'PERCENTAGE' ? `${Number(coupon.value)}% off` : coupon.type === 'FREE_SHIPPING' ? 'Free shipping' : `${money(coupon.value)} off`;
      const expiry = coupon.expiresAt ? `Valid until ${new Date(coupon.expiresAt).toLocaleDateString()}` : 'Valid now';
      const minimum = Number(coupon.minimumOrder) > 0 ? `Minimum spend ${money(coupon.minimumOrder)}` : '';
      const maximum = Number(coupon.maximumDiscount) > 0 ? `Maximum discount ${money(coupon.maximumDiscount)}` : '';
      const terms = [minimum, maximum, expiry].filter(Boolean).join(' · ');
      return `<button type="button" class="published-coupon-chip" data-apply-published-coupon="${escapeHtml(coupon.code)}" aria-label="Apply ${escapeHtml(coupon.code)}: ${escapeHtml(valueLabel)}. ${escapeHtml(terms)}"><span class="published-coupon-topline"><span>MEMBER OFFER</span><span aria-hidden="true">✦</span></span><strong>${escapeHtml(coupon.code)}</strong><span class="published-coupon-benefit">${escapeHtml(valueLabel)}</span><span class="published-coupon-footer"><small>${escapeHtml(terms)}</small><span class="published-coupon-apply">Apply offer <b aria-hidden="true">↗</b></span></span></button>`;
    }).join('');
  });
}
function hydrateCheckoutControls(formSelector) { const form = document.querySelector(formSelector); const summary = form?.parentElement?.querySelector('.checkout-summary'); if (!form) return; if (summary && !summary.querySelector('[data-apply-coupon]')) summary.insertAdjacentHTML('beforeend', `<div class="checkout-coupon"><label>Coupon code<input name="couponCode" placeholder="WELCOME10" autocomplete="off"></label><button type="button" class="page-secondary" data-apply-coupon>Apply</button><small data-coupon-message></small></div><div class="published-coupons" hidden><div class="published-coupons-heading"><div><p class="published-coupons-kicker">A little extra</p><p class="published-coupons-title">Available offers</p></div><span class="published-coupons-count" data-offer-count></span></div><div class="published-coupons-list" data-published-coupons></div></div><div class="checkout-summary-lines"><span>Discount <b id="checkoutDiscount">-${money(0)}</b></span><span>Tax <b id="checkoutTax">${money(0)}</b></span></div>`); renderPaymentProviders(); updateCheckout(); bindCheckoutCoupon(form); void loadPublishedCoupons(); }
const imageFor = (product) => normalizeImageSource(product?.images || product?.image || product?.images?.[0] || product?.product?.images || product?.product?.image || product?.product || '');
const apiHeaders = () => authToken ? { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' } : null;
async function syncCartFromServer() { if (!authToken) return; if (isCartRecentlyCleared()) { cart = []; wishlist = new Set(); clearCartPersistence(); renderCart(); renderWishlist(); return; } try { const response = await fetch('http://localhost:4000/api/v1/cart', { headers: apiHeaders() }); if (!response.ok) return; const payload = await response.json(); if (isCartRecentlyCleared()) { cart = []; wishlist = new Set(); renderCart(); renderWishlist(); return; } const serverItems = payload.data?.items || []; cart = serverItems.map((item) => ({ ...item.product, price: Number(item.product.price), image: item.product.images?.[0]?.url || '', quantity: item.quantity, serverCartItemId: item.id })); saveState(); renderCart(); } catch { /* Keep the signed-in user's local cart when the API is unavailable. */ } }
async function clearServerCart() { if (!authToken) return; try { await fetch('http://localhost:4000/api/v1/cart', { method: 'DELETE', headers: apiHeaders() }); } catch { /* The local cart is still cleared when the API is unavailable. */ } }
async function syncCartItem(productId, quantity) { if (!authToken) return; const current = cart.find((item) => item.id === productId); try { if (current?.serverCartItemId) { await fetch(`http://localhost:4000/api/v1/cart/items/${current.serverCartItemId}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ quantity }) }); } else { const response = await fetch('http://localhost:4000/api/v1/cart/items', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ productId, quantity }) }); if (response.ok) { const payload = await response.json(); const synced = payload.data; if (current && synced?.id) current.serverCartItemId = synced.id; } } } catch { /* Local cart remains usable if the API is offline. */ } }
let featuredProducts = [];
let featuredOffset = 0;
let featuredTimer = null;
async function recordProductView(productId) { const id = normalizeProductId(productId); if (!id) return; const product = products.find((entry) => normalizeProductId(entry.id) === id); if (product) product.viewCount = Number(product.viewCount || 0) + 1; try { await fetch(`http://localhost:4000/api/v1/products/${encodeURIComponent(id)}/view`, { method: 'POST' }); } catch { /* View analytics should not interrupt shopping. */ } }
async function loadServerCatalog() { try { const response = await fetch('http://localhost:4000/api/v1/products?status=ACTIVE&take=100'); if (!response.ok) return; const payload = await response.json(); products = (payload.data || []).map((product) => { const images = product.images?.map((image) => image.url).filter(Boolean) || []; return { id: product.id, name: product.name, category: product.category?.name || 'Uncategorized', categoryId: product.category?.id || '', price: Number(product.price), rating: 5, image: images[0] || '', images, description: product.description || product.shortDescription || '', usage: product.usage || '', features: product.features || '', stock: product.inventory?.available ?? 0, viewCount: Number(product.viewCount || 0), featured: Boolean(product.featured) }; }); featuredProducts = products.filter((product) => product.featured); await Promise.allSettled(products.map((product) => loadProductReviews(product.id))); renderProducts(); renderWishlist(); renderFeaturedProducts(); renderDynamicHero(); renderDynamicCategories(); startFeaturedCarousel(); } catch { products = []; renderProducts(); renderFeaturedProducts(); renderDynamicHero(); renderDynamicCategories(); } }
function renderDynamicHero() { const product = featuredProducts[0]; const copy = $('#featuredHeroCopy'); const image = $('#featuredHeroImage'); if (!copy || !image) return; if (!product) { copy.innerHTML = '<p class="eyebrow">Featured products</p><h1 id="hero-title">Your next<br><em>favorite thing.</em></h1><p class="hero-description">Products selected by the Ground team will appear here.</p>'; image.innerHTML = '<div class="hero-empty">No featured products yet.</div>'; return; } copy.innerHTML = `<p class="eyebrow">Featured product</p><h1 id="hero-title">${escapeHtml(product.name)}</h1><p class="hero-description">${escapeHtml(product.description || 'A product selected by the Ground team.')}</p><button class="hero-order-link" type="button" data-view="${escapeHtml(product.id)}">View product ↗</button>`; image.innerHTML = product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"><div class="hero-note"><span>Featured</span><span>${escapeHtml(product.category)}</span></div>` : '<div class="hero-empty">This featured product has no image.</div>'; }
function renderFeaturedProducts() { const container = $('#featuredProductCarousel'); if (!container) return; if (!featuredProducts.length) { container.innerHTML = '<p class="category-loading">No featured products selected by the admin yet.</p>'; return; } const visible = [...featuredProducts, ...featuredProducts].slice(featuredOffset, featuredOffset + Math.min(3, featuredProducts.length)); container.innerHTML = visible.map((product) => `<article class="top-product-card" data-view="${escapeHtml(product.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(product.name)}"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"><div><span>${escapeHtml(product.category)}</span><h3>${escapeHtml(product.name)}</h3><strong>${money(product.price)}</strong></div><button type="button" data-view="${escapeHtml(product.id)}" aria-label="View ${escapeHtml(product.name)}">View ↗</button></article>`).join(''); }
function startFeaturedCarousel() { clearInterval(featuredTimer); const container = $('#featuredProductCarousel'); if (!container || featuredProducts.length < 2) return; featuredTimer = setInterval(() => { featuredOffset = (featuredOffset + 1) % featuredProducts.length; renderFeaturedProducts(); }, 4200); if (!container.dataset.carouselBound) { container.dataset.carouselBound = 'true'; container.addEventListener('mouseenter', () => clearInterval(featuredTimer)); container.addEventListener('mouseleave', startFeaturedCarousel); } }
let dynamicCategories = [];
function renderDynamicCategories() { const uncategorizedCount = products.filter((product) => product.category === 'Uncategorized').length; const categories = [...dynamicCategories]; if (uncategorizedCount && !categories.some((category) => category.name === 'Uncategorized')) categories.push({ id: '', name: 'Uncategorized', _count: { products: uncategorizedCount } }); const button = (category) => `<button type="button" class="category-tab" data-category-id="${escapeHtml(category.id)}" data-category="${escapeHtml(category.name)}">${escapeHtml(category.name)} <small>${category._count?.products || 0}</small></button>`; const tabs = $('#categoryTabs'); if (tabs) tabs.innerHTML = `<button type="button" class="category-tab active" data-category="All">All products</button>${categories.map(button).join('')}`; const tiles = $('#categoryTiles'); if (tiles) tiles.innerHTML = categories.length ? categories.slice(0, 6).map((category) => `<button type="button" class="category-tile" data-category-id="${escapeHtml(category.id)}" data-category="${escapeHtml(category.name)}"><strong>${escapeHtml(category.name)}</strong><small>${category._count?.products || 0} products</small></button>`).join('') : '<p class="category-loading">No categories available.</p>'; decorateCategoryTiles(); bindCategoryTabs(); }
function decorateCategoryTiles() { document.querySelectorAll('.category-tile').forEach((tile) => { const product = products.find((item) => item.categoryId === tile.dataset.categoryId || item.category === tile.dataset.category); if (product?.image) tile.style.backgroundImage = `linear-gradient(180deg, transparent 35%, rgba(32,33,29,.72)), url("${product.image.replaceAll('"', '%22')}")`; }); }
async function loadDynamicCategories() { try { const response = await fetch('http://localhost:4000/api/v1/catalog/categories'); if (!response.ok) return; dynamicCategories = (await response.json()).data || []; renderDynamicCategories(); } catch { dynamicCategories = []; renderDynamicCategories(); } }
function cartStorageKey() { return activeUserId ? `ground-cart-user-${activeUserId}` : 'ground-cart'; }
function wishlistStorageKey() { return activeUserId ? `ground-wishlist-user-${activeUserId}` : 'ground-wishlist'; }
const CART_CLEAR_MARKER_KEY = 'ground-cart-cleared-at';
function isCartRecentlyCleared() {
  return localStorage.getItem(CART_CLEAR_MARKER_KEY) === 'true';
}
function clearCartPersistence() {
  Object.keys(localStorage).forEach((key) => {
    if (/^ground-(cart|wishlist)(-user-[^\s]+)?$/i.test(key) || key === 'ground-cart-guest' || key === 'ground-wishlist-guest') {
      localStorage.removeItem(key);
    }
  });
  localStorage.setItem(CART_CLEAR_MARKER_KEY, 'true');
}
function restoreState() {
  try {
    const hasClientToken = Boolean(getClientToken());
    const savedKeys = Object.keys(localStorage).filter((key) => /^ground-(cart|wishlist)(-user-[^\s]+)?$/i.test(key) || key === 'ground-cart-guest' || key === 'ground-wishlist-guest');
    if (isCartRecentlyCleared()) {
      cart = [];
      savedKeys.filter((key) => /^ground-cart(-user-[^\s]+)?$/i.test(key) || key === 'ground-cart-guest').forEach((key) => localStorage.removeItem(key));
      const storedWishlist = localStorage.getItem(wishlistStorageKey()) || localStorage.getItem('ground-wishlist') || localStorage.getItem('ground-wishlist-guest') || '[]';
      wishlist = new Set(JSON.parse(storedWishlist).map((id) => normalizeProductId(id)));
      return;
    }
    if (!hasClientToken) {
      cart = [];
      wishlist = new Set();
      savedKeys.forEach((key) => localStorage.removeItem(key));
      return;
    }
    const storedCart = localStorage.getItem(cartStorageKey()) || localStorage.getItem('ground-cart') || localStorage.getItem('ground-cart-guest') || '[]';
    const savedCart = JSON.parse(storedCart);
    const storedWishlist = localStorage.getItem(wishlistStorageKey()) || localStorage.getItem('ground-wishlist') || localStorage.getItem('ground-wishlist-guest') || '[]';
    cart = savedCart.filter((item) => item && item.quantity > 0).map((item) => { const localProduct = products.find((product) => normalizeProductId(product.id) === normalizeProductId(item.id)) || products.find((product) => product && item && product.name && item.name && product.name.toLowerCase() === item.name.toLowerCase()); return { ...(localProduct || {}), ...item, id: normalizeProductId(item.id || localProduct?.id), image: normalizeImageSource(item.image ?? localProduct?.image ?? localProduct?.images), price: Number(item.price ?? localProduct?.price ?? 0), quantity: Number(item.quantity || 1) }; });
    wishlist = new Set(JSON.parse(storedWishlist).map((id) => normalizeProductId(id)));
  } catch (error) {
    cart = [];
    wishlist = new Set();
  }
}
function saveState() { const cartPayload = JSON.stringify(cart.map((item) => ({ ...item, id: String(item.id) }))); const wishlistPayload = JSON.stringify([...wishlist].map((id) => String(id))); localStorage.setItem('ground-cart', cartPayload); localStorage.setItem('ground-wishlist', wishlistPayload); if (activeUserId) { localStorage.setItem(`ground-cart-user-${activeUserId}`, cartPayload); localStorage.setItem(`ground-wishlist-user-${activeUserId}`, wishlistPayload); } }
function clearLocalCartAfterOrder() { cart = []; wishlist = new Set(); clearCartPersistence(); saveState(); localStorage.setItem(CART_CLEAR_MARKER_KEY, 'true'); renderCart(); renderWishlist(); }
function logoutToLanding() { localStorage.removeItem(CLIENT_TOKEN_KEY); localStorage.removeItem(ADMIN_TOKEN_KEY); localStorage.removeItem('ground-token'); authToken = ''; activeUserId = ''; cart = []; wishlist = new Set(); closeAccountModal(); window.location.assign('index.html#top'); }
const sessionAwareFetch = window.fetch.bind(window);
window.fetch = async (resource, options) => { const response = await sessionAwareFetch(resource, options); const url = String(resource); if (response.status === 401 && !url.includes('/api/v1/auth/')) logoutToLanding(); return response; };
function setAccountMode(mode) { accountMode = mode; const register = mode === 'register'; $('#accountTitle').textContent = register ? 'Create your account.' : 'Welcome back.'; $('#accountSubtitle').textContent = register ? 'A few details to get started.' : 'Sign in to continue.'; $('.account-name-fields').hidden = !register; $('#accountSubmit').innerHTML = `${register ? 'Create account' : 'Sign in'} <span>↗</span>`; $('#accountSwitch').innerHTML = register ? 'Sign in <span aria-hidden="true">↪</span>' : 'Create account <span aria-hidden="true">＋</span>'; $('#accountForm input[name="password"]').autocomplete = register ? 'new-password' : 'current-password'; document.querySelectorAll('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.authTab === mode)); }
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function prefillCheckout(user, addresses) { const form = $('#checkoutForm'); const name = addresses[0]?.fullName || `${user.data.firstName} ${user.data.lastName}`.trim(); const nameParts = name.split(/\s+/); form.elements.firstName.value = user.data.firstName || nameParts[0] || ''; form.elements.lastName.value = user.data.lastName || nameParts.slice(1).join(' '); form.elements.email.value = user.data.email || ''; form.elements.phone.value = addresses[0]?.phone || user.data.phone || ''; const address = addresses[0]; if (!address) return; form.elements.address.value = address.addressLine1 || ''; form.elements.city.value = address.city || ''; form.elements.gpsAddress.value = address.instructions || ''; form.elements.country.value = normalizeCountryCode(address.country) || form.elements.country.value; }
let storeBrand = { name: 'Store', logo: '' };
let configuredSupportEmail = '';
let configuredSupportWhatsApp = '';
const whatsappSupportHref = (message = 'Hello, I need help with my order.') => {
  const digits = String(configuredSupportWhatsApp || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : '';
};
const supportWhatsAppButton = (message, extraClass = '') => {
  const href = whatsappSupportHref(message);
  return href ? `<a class="page-secondary whatsapp-support-button ${extraClass}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Chat on WhatsApp</a>` : '';
};
function syncSupportEmailLink() {
  const link = $('#supportEmailLink');
  if (!link) return;
  link.hidden = !configuredSupportEmail;
  link.textContent = configuredSupportEmail || '';
  link.href = configuredSupportEmail ? `mailto:${configuredSupportEmail}` : 'mailto:';
}
function syncSupportWhatsAppLink(message = 'Hello, I need help with my order.') {
  document.querySelectorAll('[data-support-whatsapp-link]').forEach((link) => {
    const customMessage = link.dataset.supportWhatsappMessage || message;
    const href = whatsappSupportHref(customMessage);
    link.hidden = !href;
    link.href = href || '#';
  });
}
const receiptBrandMarkup = () => storeBrand.logo ? `<div class="receipt-brand"><img src="${escapeHtml(storeBrand.logo)}" alt=""></div>` : '';
function renderAccountBrand() { const visual = document.querySelector('.account-visual'); if (!visual) return; const mark = storeBrand.logo ? `<span class="wordmark-mark"><img src="${escapeHtml(storeBrand.logo)}" alt=""></span>` : `<span class="wordmark-mark">${escapeHtml(storeBrand.name.trim().charAt(0).toUpperCase() || 'G')}</span>`; visual.innerHTML = `<div class="account-brand">${mark}<strong>${escapeHtml(storeBrand.name)}</strong></div>`; }
function ensureProfileEditor(user) { const session = $('#accountSession'); if (!session || session.querySelector('#profileForm')) return; session.insertAdjacentHTML('afterbegin', `<form class="profile-form" id="profileForm"><div><p class="eyebrow">Profile</p><h4>Update your details</h4></div><div class="profile-fields"><label>First name<input name="firstName" value="${escapeHtml(user.data.firstName)}" required></label><label>Last name<input name="lastName" value="${escapeHtml(user.data.lastName || '')}" required></label></div><button class="modal-add" type="submit">Save profile <span>↗</span></button><p class="account-error" id="profileError"></p></form>`); $('#profileForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.target); try { const response = await fetch('http://localhost:4000/api/v1/users/me', { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ firstName: data.get('firstName'), lastName: data.get('lastName') }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Could not update profile'); setAuthenticatedHeader({ firstName: data.get('firstName'), lastName: data.get('lastName') }); $('#accountGreeting').textContent = `${data.get('firstName')}'s account`; $('#accountDropdownName').textContent = `${data.get('firstName')} ${data.get('lastName')}`; showToast('Profile updated.'); } catch (error) { $('#profileError').textContent = error.message; } }); }
async function loadClientArea(user) { const [ordersResponse, addressesResponse] = await Promise.all([fetch('http://localhost:4000/api/v1/orders', { headers: apiHeaders() }), fetch('http://localhost:4000/api/v1/addresses', { headers: apiHeaders() })]); const ordersPayload = ordersResponse.ok ? await ordersResponse.json() : { data: [] }; const addressesPayload = addressesResponse.ok ? await addressesResponse.json() : { data: [] }; const orders = ordersPayload.data || []; const addresses = addressesPayload.data || []; activeUserId = user.data.id; prefillCheckout(user, addresses); renderAccountBrand(); ensureProfileEditor(user); $('#accountTitle').textContent = 'Your account'; $('#accountSubtitle').textContent = 'Manage your profile, orders, and saved pieces.'; $('#accountGreeting').textContent = `${user.data.firstName}'s account`; $('#accountOrderCount').textContent = orders.length; $('#accountSavedCount').textContent = wishlist.size; $('#accountAddressCount').textContent = addresses.length; $('#accountOrders').innerHTML = orders.length ? orders.slice(0, 5).map((order) => `<article class="account-order"><div><strong>${escapeHtml(order.orderNumber)}</strong><small>${new Date(order.createdAt).toLocaleDateString()} · ${escapeHtml(order.status.replaceAll('_', ' '))}</small></div><div><b>${money(order.total)} ${escapeHtml(order.currency)}</b><button type="button" data-client-receipt="${escapeHtml(order.orderNumber)}">Receipt ↓</button></div></article>`).join('') : '<p class="account-muted">No orders yet. Your first purchase will appear here.</p>'; }
async function loadAccount() { if (!authToken) return; try { const response = await fetch('http://localhost:4000/api/v1/users/me', { headers: { Authorization: `Bearer ${authToken}` } }); if (!response.ok) throw new Error('Session expired'); const user = await response.json(); setAuthenticatedHeader(user.data); activeUserId = user.data.id; $('#accountName').textContent = user.data.firstName; $('#accountDropdownName').textContent = `${user.data.firstName} ${user.data.lastName || ''}`.trim(); $('#accountEmail').textContent = user.data.email; $('#accountForm').hidden = true; $('#accountSwitch').hidden = true; $('#accountSession').hidden = false; await loadClientArea(user); await syncCartFromServer(); } catch (error) { if (error.message === 'Session expired') logoutToLanding(); else $('#accountError').textContent = 'Your account area is temporarily unavailable.'; } }
let activeCategoryId = '';
function visibleProducts() {
  const matchesCategory = (product) => activeCategory === 'All' && !activeCategoryId ? true : activeCategoryId ? product.categoryId === activeCategoryId : product.category === activeCategory;
  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let list = products.filter((product) => {
    if (!matchesCategory(product)) return false;
    const searchableText = [product.name, product.category, product.description, product.usage, product.features]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');
    return searchTerms.every((term) => searchableText.includes(term));
  });
  const sort = $('#sortSelect').value;
  if (sort === 'featured') list.sort((a, b) => Number(b.featured) - Number(a.featured));
  if (sort === 'price-low') list.sort((a, b) => a.price - b.price);
  if (sort === 'price-high') list.sort((a, b) => b.price - a.price);
  if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
  return list;
}
function getProductReviewSummary(productId) {
  const summary = productReviews.get(normalizeProductId(productId));
  if (!summary || !summary.reviews?.length) return { average: Number(productId && products.find((product) => normalizeProductId(product.id) === normalizeProductId(productId))?.rating) || 5, count: 0, reviews: [] };
  const average = summary.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / summary.reviews.length;
  return { average, count: summary.reviews.length, reviews: summary.reviews };
}
async function loadProductReviews(productId) {
  const id = normalizeProductId(productId);
  if (!id || productReviews.has(id)) return productReviews.get(id);
  try {
    const response = await fetch(`http://localhost:4000/api/v1/reviews/product/${encodeURIComponent(id)}`);
    if (!response.ok) {
      productReviews.set(id, { reviews: [], average: 0, count: 0 });
      return productReviews.get(id);
    }
    const payload = await response.json();
    const reviews = Array.isArray(payload.data) ? payload.data : [];
    const summary = { reviews, average: reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0, count: reviews.length };
    productReviews.set(id, summary);
    return summary;
  } catch {
    productReviews.set(id, { reviews: [], average: 0, count: 0 });
    return productReviews.get(id);
  }
}
function renderProducts() {
  const grid = $('#productGrid');
  const list = visibleProducts();
  grid.innerHTML = list.map((product) => {
    const productId = normalizeProductId(product.id);
    const saved = wishlist.has(productId);
    const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : null;
    const unavailable = stock !== null && stock <= 0;
    const ratingSummary = getProductReviewSummary(productId);
    const average = Number(ratingSummary.average || product.rating || 5);
    return `<article class="product-card ${unavailable ? 'out-of-stock' : ''}"><div class="product-image"><button class="wishlist-button ${saved ? 'active' : ''}" data-wish="${productId}" aria-label="${saved ? 'Remove from' : 'Add to'} wishlist">${saved ? '♥' : '♡'}</button><button class="product-view" data-view="${productId}" aria-label="View ${product.name}"><img src="${imageFor(product)}" alt="${product.name}" loading="lazy"></button><button class="quick-add" data-add="${productId}" ${unavailable ? 'disabled' : ''}>${unavailable ? 'Out of stock' : 'Add to bag +'}</button></div><div class="product-meta"><button class="product-title" data-view="${productId}"><span class="product-name">${product.name}</span><span class="product-category">${product.category}</span></button><div><p class="product-price">${money(product.price)}</p><span class="product-rating">${unavailable ? 'Currently unavailable' : `★ ${average.toFixed(1)}${ratingSummary.count ? ` · ${ratingSummary.count} review${ratingSummary.count > 1 ? 's' : ''}` : ''}`}</span><small class="product-view-count">${Number(product.viewCount || 0).toLocaleString()} views</small></div></div></article>`;
  }).join('');
  const filterSummary = query ? ` for "${query}"` : activeCategory !== 'All' ? ` in ${activeCategory}` : '';
  $('#catalogResultCount').textContent = `${list.length} ${list.length === 1 ? 'product' : 'products'}${filterSummary}`;
  $('#emptyState').hidden = list.length > 0;
  $('#emptyStateMessage').textContent = products.length
    ? query ? 'No products match your search.' : `No products in ${activeCategory} yet.`
    : 'No products are available right now.';
  $('#clearCatalogFilters').hidden = !query && activeCategory === 'All' && !activeCategoryId;
}
function renderCart() { const items = $('#cartItems'); const count = cart.reduce((sum, item) => sum + item.quantity, 0); $('#cartCount').textContent = count; $('#drawerCount').textContent = `(${count})`; if (!cart.length) { items.innerHTML = '<p class="cart-empty">Your bag is waiting for something good.<br><br>Explore the collection and add a piece that feels like you.</p>'; } else { items.innerHTML = cart.map((item) => { const stock = Number(item.stock); const atLimit = Number.isFinite(stock) && item.quantity >= stock; const itemImage = imageFor(item); return `<div class="cart-item"><img src="${escapeHtml(itemImage)}" alt="${escapeHtml(item.name)}"><div><h3>${escapeHtml(item.name)}</h3><p>${money(item.price)}</p><div class="quantity"><button data-quantity="${normalizeProductId(item.id)}" data-change="-1" aria-label="Decrease ${item.name}">−</button><span>${item.quantity}</span><button data-quantity="${normalizeProductId(item.id)}" data-change="1" aria-label="Increase ${item.name}" ${atLimit ? 'disabled' : ''}>+</button></div>${Number.isFinite(stock) ? `<small class="stock-note">${stock - item.quantity} available</small>` : ''}</div><span class="cart-item-price">${money(item.price * item.quantity)}</span></div>`; }).join(''); } $('#subtotal').textContent = money(cart.reduce((sum, item) => sum + item.price * item.quantity, 0)); }
function renderWishlist() { const saved = products.filter((product) => wishlist.has(normalizeProductId(product.id))); $('#wishlistCount').textContent = saved.length; $('#wishlistDrawerCount').textContent = `(${saved.length})`; $('#wishlistItems').innerHTML = saved.length ? saved.map((product) => `<div class="saved-item"><img src="${imageFor(product)}" alt="${product.name}"><div><h3>${product.name}</h3><p>${money(product.price)}</p><button data-move-to-cart="${normalizeProductId(product.id)}">Move to bag <span>↗</span></button></div><button class="saved-remove" data-wish="${normalizeProductId(product.id)}" aria-label="Remove ${product.name} from wishlist">×</button></div>`).join('') : '<p class="cart-empty">Your saved pieces will appear here.<br><br>Tap the heart on anything you want to keep close.</p>'; }
function showToast(message, icon = 'info', quiet = false) { const text = String(message ?? ''); const toast = $('#toast'); if (window.Swal && !quiet) return window.Swal.fire({ icon, title: icon === 'info' ? 'Notice' : icon.charAt(0).toUpperCase() + icon.slice(1), text, confirmButtonText: 'Continue', buttonsStyling: false, customClass: { popup: 'store-swal-popup', title: 'store-swal-title', confirmButton: 'store-swal-confirm' } }); if (!toast) return Promise.resolve(); toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); return Promise.resolve(); }
function showClientAlert(icon, title, text) { if (window.Swal) return window.Swal.fire({ icon, title, text, confirmButtonText: 'Continue', buttonsStyling: false, customClass: { popup: 'store-swal-popup', title: 'store-swal-title', confirmButton: 'store-swal-confirm' } }); showToast(text || title, icon, true); return Promise.resolve(); }
async function showOrderConfirmation(orderNumber) { const message = `Your order ${orderNumber} has been received. We will keep you updated here.`; if (window.Swal) { await window.Swal.fire({ icon: 'success', title: 'Order received', text: message, confirmButtonText: 'Continue', buttonsStyling: false, customClass: { popup: 'store-swal-popup', title: 'store-swal-title', confirmButton: 'store-swal-confirm' } }); return; } showToast(message); }
function addToCart(id) { const product = products.find((item) => normalizeProductId(item.id) === normalizeProductId(id)); if (!product) return; if (!storeOpen) return showToast('The store is temporarily closed.'); const stock = Number(product.stock); if (Number.isFinite(stock) && stock <= 0) return showToast(`${product.name} is out of stock`); const normalizedId = normalizeProductId(product.id); void recordProductView(normalizedId); const existing = cart.find((item) => normalizeProductId(item.id) === normalizedId); const nextQuantity = (existing?.quantity || 0) + 1; if (Number.isFinite(stock) && nextQuantity > stock) return showToast(`Only ${stock} ${product.name} available`); if (existing) existing.quantity = nextQuantity; else cart.push({ ...product, id: normalizedId, price: Number(product.price || 0), quantity: 1 }); localStorage.removeItem(CART_CLEAR_MARKER_KEY); saveState(); renderCart(); void syncCartItem(normalizedId, nextQuantity); showToast(`${product.name} added to your bag`, 'info', true); }
const baseRenderCart = renderCart;
renderCart = function renderCartWithRemoveControl() { baseRenderCart(); document.querySelectorAll('#cartItems .cart-item').forEach((itemNode) => { if (itemNode.querySelector('[data-remove-cart]')) return; const itemId = itemNode.querySelector('[data-quantity]')?.dataset.quantity; if (!itemId) return; itemNode.insertAdjacentHTML('beforeend', `<button type="button" class="cart-item-remove" data-remove-cart="${escapeHtml(itemId)}" aria-label="Remove item">🗑</button>`); }); };
function removeFromCart(id) { const item = cart.find((entry) => normalizeProductId(entry.id) === normalizeProductId(id)); if (!item) return; if (item.serverCartItemId && authToken) void fetch(`http://localhost:4000/api/v1/cart/items/${item.serverCartItemId}`, { method: 'DELETE', headers: apiHeaders() }); cart = cart.filter((entry) => entry !== item); saveState(); renderCart(); showToast(`${item.name} removed from your bag`); }
document.addEventListener('click', (event) => { const remove = event.target.closest('[data-remove-cart]'); if (remove) removeFromCart(remove.dataset.removeCart); });
function openCart() { $('#cartDrawer').classList.add('open'); $('#cartDrawer').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); }
function closeCart() { $('#cartDrawer').classList.remove('open'); $('#cartDrawer').setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('visible'); }
function openWishlist() { renderWishlist(); $('#wishlistDrawer').classList.add('open'); $('#wishlistDrawer').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); }
function closeWishlist() { $('#wishlistDrawer').classList.remove('open'); $('#wishlistDrawer').setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('visible'); }
function productImages(product) {
  const images = Array.isArray(product?.images) ? product.images : Array.isArray(product?.image) ? product.image : [product?.image];
  return images.map((image) => normalizeImageSource(image)).filter(Boolean);
}
function renderModalGallery() { if (!selectedProduct) return; const images = productImages(selectedProduct); const image = images[selectedImageIndex] || images[0]; $('#modalImage').src = image; $('#modalImage').alt = `${selectedProduct.name} image ${selectedImageIndex + 1}`; $('#modalImage').classList.toggle('zoomed', zoomedProductImage); $('#modalPrev').hidden = images.length < 2; $('#modalNext').hidden = images.length < 2; $('#modalThumbnails').innerHTML = images.map((src, index) => `<button class="modal-thumbnail ${index === selectedImageIndex ? 'active' : ''}" data-modal-image="${index}" aria-label="View image ${index + 1}"><img src="${src}" alt=""></button>`).join(''); }
function renderProductReviews() {
  const container = $('#modalReviews');
  if (!container || !selectedProduct) return;
  const summary = getProductReviewSummary(selectedProduct.id);
  const reviews = summary.reviews || [];
  const average = Number(summary.average || selectedProduct.rating || 5);
  const starNodes = Array.from({ length: 5 }, (_, index) => `<span class="rating-star ${index < Math.round(average) ? 'filled' : ''}">★</span>`).join('');
  const reviewForm = authToken ? `<form class="review-form" id="productReviewForm"><div class="review-row"><label>Rate this product</label><div class="review-stars" id="reviewStars">${Array.from({ length: 5 }, (_, index) => `<button type="button" class="review-star" data-review-value="${index + 1}" aria-label="Rate ${index + 1} out of 5">★</button>`).join('')}</div></div><textarea name="body" rows="3" placeholder="Tell other customers what stood out about this piece..." required></textarea><button class="modal-add" type="submit">Submit review <span>↗</span></button></form>` : '<p class="review-signin">Sign in to leave a rating for this product.</p>';
  container.innerHTML = `
    <div class="review-summary">
      <div>
        <p class="eyebrow">Customer ratings</p>
        <h3>${average.toFixed(1)} / 5</h3>
      </div>
      <div class="review-stars summary-stars" aria-label="Average rating ${average.toFixed(1)} out of 5">${starNodes}</div>
      <small>${reviews.length ? `${reviews.length} review${reviews.length > 1 ? 's' : ''}` : 'No reviews yet'}</small>
    </div>
    ${reviewForm}
    <div class="review-list">
      ${reviews.length ? reviews.slice(0, 3).map((review) => `
        <article class="review-item">
          <div class="review-head"><strong>${escapeHtml(review.user?.firstName || 'Customer')}</strong><span>${'★'.repeat(Number(review.rating || 0))}</span></div>
          <p>${escapeHtml(review.body || '')}</p>
        </article>
      `).join('') : '<p class="review-empty">Be the first to review this piece.</p>'}
    </div>
  `;

  const form = $('#productReviewForm');
  if (form) {
    let selectedRating = 5;
    form.querySelectorAll('.review-star').forEach((button) => {
      button.addEventListener('click', () => {
        selectedRating = Number(button.dataset.reviewValue || 5);
        form.querySelectorAll('.review-star').forEach((star) => star.classList.toggle('selected', Number(star.dataset.reviewValue) <= selectedRating));
      });
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = new FormData(form).get('body');
      if (!body || String(body).trim().length < 10) {
        showToast('Please write at least 10 characters for your review.');
        return;
      }
      try {
        const response = await fetch(`http://localhost:4000/api/v1/reviews/product/${encodeURIComponent(selectedProduct.id)}`, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ rating: selectedRating, title: `${selectedProduct.name} review`, body: String(body).trim() })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Unable to submit your review');
        await loadProductReviews(selectedProduct.id);
        renderProductReviews();
        renderProducts();
        await showClientAlert('success', 'Review saved', 'Thanks for sharing your experience.');
      } catch (error) {
        await showClientAlert('error', 'Review could not be saved', error.message || 'Unable to submit your review');
      }
    });
  }
}
function openProduct(id) { selectedProduct = products.find((product) => normalizeProductId(product.id) === normalizeProductId(id)); if (!selectedProduct) return; void recordProductView(selectedProduct.id); modalQuantity = 1; selectedImageIndex = 0; zoomedProductImage = false; renderModalGallery(); $('#modalCategory').textContent = selectedProduct.category; $('#modalName').textContent = selectedProduct.name; $('#modalRating').textContent = `★ ${Number(getProductReviewSummary(selectedProduct.id).average || selectedProduct.rating || 5).toFixed(1)} / 5`; const viewCount = $('#modalViewCount') || (() => { const element = document.createElement('p'); element.id = 'modalViewCount'; element.className = 'product-view-count'; $('#modalRating').after(element); return element; })(); viewCount.textContent = `${Number(selectedProduct.viewCount || 0).toLocaleString()} views`; $('#modalPrice').textContent = money(selectedProduct.price); $('.modal-description').textContent = selectedProduct.description || 'A quietly considered piece made for daily use. Thoughtful materials, enduring form, and the details that make a good object feel like yours.'; $('#modalUsage').textContent = selectedProduct.usage || 'Use this piece as part of your everyday routine.'; $('#modalUsageSection').hidden = !selectedProduct.usage; const features = String(selectedProduct.features || '').split(/\r?\n|\s*[,;]\s*/).map((feature) => feature.trim()).filter(Boolean); $('#modalFeatures').innerHTML = features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join(''); $('#modalFeaturesSection').hidden = !features.length; $('#modalQuantity').textContent = modalQuantity; $('#modalWishlist').textContent = wishlist.has(normalizeProductId(selectedProduct.id)) ? '♥ In your wishlist' : '♡ Add to wishlist'; renderProductReviews(); $('#productModal').classList.add('open'); $('#productModal').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); }
function closeProduct() { $('#productModal').classList.remove('open'); $('#productModal').setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('visible'); }
function openCheckout() { checkoutStep = 1; selectedShippingMethod = null; appliedCoupon = null; checkoutTax = 0; const countryField = $('#shippingCountry'); if (countryField) countryField.value = ''; $('#checkoutModal').classList.add('open'); $('#checkoutModal').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); updateCheckout(); void enhanceCheckoutAddressSelector('#checkoutForm'); hydrateCheckoutControls('#checkoutForm'); }
function closeCheckout() { $('#checkoutModal').classList.remove('open'); $('#checkoutModal').setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('visible'); }
function updateCheckout() { document.querySelectorAll('.checkout-step').forEach((section) => { section.classList.toggle('active', Number(section.dataset.step) === checkoutStep); }); document.querySelectorAll('[data-step-label]').forEach((label) => { label.classList.toggle('active', Number(label.dataset.stepLabel) <= checkoutStep); }); const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0); const discount = Number(appliedCoupon?.discount || 0); const shipping = Number(appliedCoupon?.shipping ?? (selectedShippingMethod?.price || 0)); const serviceFee = Number(((Math.max(0, subtotal - discount) + shipping + Number(checkoutTax || 0)) * 0.002).toFixed(2)); const total = Math.max(0, subtotal - discount) + shipping + Number(checkoutTax || 0) + serviceFee; document.querySelectorAll('#checkoutTotal, .checkout-summary-total strong').forEach((element) => { element.textContent = money(total); }); document.querySelectorAll('#checkoutDiscount').forEach((element) => { element.textContent = `-${money(discount)}`; }); document.querySelectorAll('#checkoutTax').forEach((element) => { element.textContent = money(checkoutTax); }); document.querySelectorAll('#checkoutServiceFee').forEach((element) => { element.textContent = money(serviceFee); }); if (checkoutOrderNumber) $('#orderNumber').textContent = checkoutOrderNumber; }
const baseUpdateCheckout = updateCheckout;
function renderPaymentProviders() {
  const configuredPaystack = availablePaymentGateways.find((gateway) => gateway.id === 'paystack');
  const gateways = [{ id: 'paystack', name: 'Paystack', enabled: true, serviceFee: Number(configuredPaystack?.serviceFee ?? 0.2) }];
  configuredPaymentProvider = 'paystack';
  selectedPaymentProvider = 'paystack';
  document.querySelectorAll('#checkoutForm, #pageCheckoutForm').forEach((form) => {
    const select = form.querySelector('[name="provider"]');
    if (!select) return;
    let selector = form.querySelector('[data-payment-providers]');
    if (!selector) {
      const host = select.closest('.payment-option, label');
      host?.insertAdjacentHTML('beforebegin', '<div class="payment-provider-selector" data-payment-providers></div>');
      selector = form.querySelector('[data-payment-providers]');
    }
    if (!selector) return;
    select.innerHTML = gateways.map((gateway) => `<option value="${escapeHtml(gateway.id)}">${escapeHtml(gateway.name)}</option>`).join('');
    select.value = selectedPaymentProvider;
    select.hidden = true;
    const icons = { paystack: 'P' };
    selector.innerHTML = `<div class="payment-provider-badges" role="group" aria-label="Choose a payment provider">${gateways.map((gateway) => `<button class="payment-provider-badge${gateway.id === selectedPaymentProvider ? ' selected' : ''}" type="button" data-payment-provider="${escapeHtml(gateway.id)}" aria-pressed="${gateway.id === selectedPaymentProvider}"><span class="payment-provider-icon" aria-hidden="true">${icons[gateway.id]}</span>${escapeHtml(gateway.name)}</button>`).join('')}</div>${gateways.length ? '<p class="payment-provider-note">Any service charge shown is collected by the selected provider to handle funds smoothly. Ground does not collect external service charges.</p>' : '<p class="payment-provider-empty">No payment providers are currently configured.</p>'}`;
  });
  const selectedGateway = gateways.find((gateway) => gateway.id === selectedPaymentProvider);
  const paymentHelp = document.querySelector('#paymentHelp');
  if (paymentHelp) paymentHelp.textContent = selectedGateway ? `Secure payment checkout via ${selectedGateway.name}.` : 'No payment provider is currently configured.';
  document.querySelectorAll('.checkout-summary-lines').forEach((lines) => {
    if (!lines.querySelector('[data-service-fee]')) lines.insertAdjacentHTML('beforeend', '<span data-service-fee hidden><span data-service-fee-label>Payment provider service charge</span><b data-service-fee-amount></b></span>');
  });
}
updateCheckout = () => {
  baseUpdateCheckout();
  const gateway = availablePaymentGateways.find((entry) => entry.id === 'paystack') || { id: 'paystack', name: 'Paystack', serviceFee: 0.2 };
  const configuredRate = Number(gateway?.serviceFee ?? 0);
  const serviceFeeRate = Number.isFinite(configuredRate) ? Math.max(0, configuredRate) : 0;
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const discount = Number(appliedCoupon?.discount || 0);
  const shipping = Number(appliedCoupon?.shipping ?? (selectedShippingMethod?.price || 0));
  const serviceFee = Number(((Math.max(0, subtotal - discount) + shipping + Number(checkoutTax || 0)) * serviceFeeRate / 100).toFixed(2));
  const total = Math.max(0, subtotal - discount) + shipping + Number(checkoutTax || 0) + serviceFee;
  document.querySelectorAll('#checkoutTotal, .checkout-summary-total strong').forEach((element) => { element.textContent = money(total); });
  document.querySelectorAll('.checkout-summary-lines [data-service-fee]').forEach((row) => {
    row.hidden = serviceFeeRate <= 0;
    row.querySelector('[data-service-fee-label]').textContent = `${gateway?.name || 'Payment provider'} service charge (${serviceFeeRate}%)`;
    row.querySelector('[data-service-fee-amount]').textContent = money(serviceFee);
  });
};
document.addEventListener('click', (event) => {
  const badge = event.target.closest('[data-payment-provider]');
  if (!badge) return;
  selectedPaymentProvider = badge.dataset.paymentProvider;
  document.querySelectorAll('#checkoutForm [name="provider"], #pageCheckoutForm [name="provider"]').forEach((select) => { select.value = selectedPaymentProvider; });
  renderPaymentProviders();
  updateCheckout();
});
function getCheckoutPhonePattern(country) {
  const normalized = String(country || '').trim().toUpperCase();
  if (normalized === 'GH') return '^(?:0\\d{9}|\\+233\\d{9})$';
  if (normalized === 'US') return '^(?:\\+1\\s?)?(?:\\(?\\d{3}\\)?[-.\\s]?)\\d{3}[-.\\s]?\\d{4}$';
  if (normalized === 'GB') return '^(?:\\+44\\s?|0)\\d{9,11}$';
  return '^[+()\\d\\s.-]{7,20}$';
}
function applyCheckoutFieldValidation(form) {
  if (!form) return;
  const data = new FormData(form);
  const countryField = form.querySelector('select[name="country"]');
  const phoneField = form.querySelector('input[name="phone"]');
  const emailField = form.querySelector('input[name="email"]');
  const addressField = form.querySelector('input[name="address"]');
  const cityField = form.querySelector('input[name="city"]');
  const gpsAddressField = form.querySelector('input[name="gpsAddress"]');
  const country = String(data.get('country') || '').trim().toUpperCase();
  const pattern = getCheckoutPhonePattern(country);
  if (phoneField) {
    phoneField.pattern = pattern;
    phoneField.placeholder = country === 'GH' ? 'e.g. 0548214842 or +233 548214842' : 'e.g. +1 555 123 4567';
    phoneField.setAttribute('inputmode', 'numeric');
    const rawPhone = String(data.get('phone') || '');
    const cleanedPhone = rawPhone.replace(/[^\d+()\s.-]/g, '').replace(/\s+/g, ' ').trim();
    if (cleanedPhone !== rawPhone) phoneField.value = cleanedPhone;
    const normalizedPhone = cleanedPhone.replace(/[\s().-]/g, '').replace(/^\+/, '+');
    const hasLetters = /[A-Za-z]/.test(rawPhone);
    const hasInvalidChars = /[^\d+()\s.-]/.test(rawPhone);
    const validPhone = country ? new RegExp(pattern).test(normalizedPhone) : true;
    phoneField.setCustomValidity((!hasLetters && !hasInvalidChars && validPhone) || !normalizedPhone ? '' : country === 'GH' ? 'Enter a valid Ghana phone number.' : 'Enter a valid phone number for the selected country.');
  }
  if (countryField) {
    countryField.setCustomValidity(country ? '' : 'Please select a delivery country.');
  }
  if (emailField) {
    const email = String(data.get('email') || '').trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    emailField.setCustomValidity(validEmail || !email ? '' : 'Enter a valid email address.');
  }
  if (addressField) {
    const address = String(data.get('address') || '').trim();
    addressField.setCustomValidity(address.length >= 5 ? '' : 'Please enter a full street address.');
  }
  if (cityField) {
    const city = String(data.get('city') || '').trim();
    cityField.setCustomValidity(city.length >= 2 ? '' : 'Please enter a city.');
  }
  if (gpsAddressField) gpsAddressField.setCustomValidity('');
}
function validateCheckoutForm(form) {
  if (!form) return false;
  applyCheckoutFieldValidation(form);
  const fields = [...form.querySelectorAll('input, select')];
  const invalid = fields.find((field) => {
    if (field.disabled || field.type === 'hidden') return false;
    return !field.checkValidity();
  });
  if (invalid) {
    invalid.focus();
    invalid.reportValidity();
    return false;
  }
  return true;
}
async function loadShippingQuote(form = null) { const activeForm = form || ($('#checkoutModal')?.classList.contains('open') ? $('#checkoutForm') : document.querySelector('#pageCheckoutForm') || $('#checkoutForm')); const countryField = activeForm?.querySelector('select[name="country"]') || $('#shippingCountry'); const country = String(countryField?.value || '').trim().toUpperCase(); if (country.length < 2) { countryField?.setCustomValidity('Choose a country before continuing.'); countryField?.reportValidity(); throw new Error('Choose a country before continuing.'); } countryField?.setCustomValidity(''); const response = await fetch('http://localhost:4000/api/v1/shipping/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country, weightKg: cart.reduce((sum, item) => sum + item.quantity, 0) }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || result.error || 'No delivery methods are available for this destination.'); const methods = result.data || []; selectedShippingMethod = methods[0] || null; const deliveryOptions = activeForm?.querySelector('#deliveryOptions') || $('#deliveryOptions'); if (deliveryOptions) deliveryOptions.innerHTML = methods.length ? methods.map((method, index) => `<label class="delivery-choice ${index === 0 ? 'selected' : ''}"><input type="radio" name="shippingMethod" value="${method.id}" data-price="${method.price}" ${index === 0 ? 'checked' : ''}><span><strong>${method.name}</strong><small>${method.description || `${method.estimatedDays.min}-${method.estimatedDays.max} business days`}</small></span><b>${money(method.price)}</b></label>`).join('') : '<span><strong>No delivery methods available</strong><small>Try another destination.</small></span>'; await loadTaxQuote(activeForm); updateCheckout(); }
async function loadTaxQuote(form) { const country = String(form?.querySelector('select[name="country"]')?.value || '').trim().toUpperCase(); const enabled = taxEnabled === true || taxEnabled === 'true'; if (!enabled || country.length < 2) { checkoutTax = 0; updateCheckout(); return; } const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0); const response = await fetch('http://localhost:4000/api/v1/taxes/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country, subtotal: Math.max(0, subtotal - Number(appliedCoupon?.discount || 0)) }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Unable to calculate tax.'); checkoutTax = Number(result.data?.amount || 0); updateCheckout(); }
async function applyCheckoutCoupon(form, container = null) { const couponContainer = container || form?.querySelector('.checkout-coupon'); const input = couponContainer?.querySelector('input[name="couponCode"]'); const message = couponContainer?.querySelector('[data-coupon-message]'); const code = String(input?.value || '').trim().toUpperCase(); if (!code) { appliedCoupon = null; if (message) { message.classList.add('error'); message.textContent = 'Enter a coupon code.'; } updateCheckout(); return; } const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0); const response = await fetch('http://localhost:4000/api/v1/coupons/validate', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ code, subtotal, shipping: Number(selectedShippingMethod?.price || 0) }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Coupon is invalid or expired.'); appliedCoupon = result.data; if (message) { message.classList.remove('error'); message.textContent = `${appliedCoupon.code} applied.`; } await loadTaxQuote(form); updateCheckout(); }
document.addEventListener('click', (event) => { const button = event.target.closest('[data-apply-coupon]'); if (!button) return; const checkout = button.closest('.checkout-modal, .checkout-page-layout'); const form = checkout?.querySelector('form') || document.querySelector('#pageCheckoutForm'); const message = button.closest('.checkout-coupon')?.querySelector('[data-coupon-message]'); if (!form) return; event.preventDefault(); void applyCheckoutCoupon(form, button.closest('.checkout-coupon')).catch((error) => { if (message) { message.classList.add('error'); message.textContent = error.message; } showToast(error.message); }); });
document.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-apply-published-coupon]');
  if (!chip) return;
  const code = chip.dataset.applyPublishedCoupon || '';
  const checkout = chip.closest('.checkout-modal, .checkout-page-layout, .checkout-shell, body');
  const form = checkout?.querySelector('#checkoutForm, #pageCheckoutForm') || document.querySelector('#checkoutForm, #pageCheckoutForm');
  const couponInput = checkout?.querySelector('input[name="couponCode"]') || form?.querySelector('input[name="couponCode"]');
  const container = couponInput?.closest('.checkout-coupon') || chip.closest('.checkout-modal, .checkout-page-layout')?.querySelector('.checkout-coupon');
  if (couponInput) couponInput.value = code;
  if (form) void applyCheckoutCoupon(form, container).catch((error) => { const message = container?.querySelector('[data-coupon-message]'); if (message) { message.classList.add('error'); message.textContent = error.message; } showToast(error.message); });
});
document.addEventListener('change', (event) => { const country = event.target.closest('#pageCheckoutForm select[name="country"]'); if (!country) return; void loadTaxQuote(country.form).catch((error) => showToast(error.message)); });
async function ensureCheckoutAddress(form) {
  const checkoutForm = form instanceof FormData ? form : new FormData(form);
  const existingResponse = await fetch('http://localhost:4000/api/v1/addresses', { headers: apiHeaders() });
  if (!existingResponse.ok) throw new Error('Unable to load your saved addresses');
  const existing = (await existingResponse.json()).data || [];
  const match = existing.find((address) => address.addressLine1 === checkoutForm.get('address') && address.city === checkoutForm.get('city') && address.country === checkoutForm.get('country'));
  if (match) return match.id;
  const response = await fetch('http://localhost:4000/api/v1/addresses', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      fullName: `${checkoutForm.get('firstName')} ${checkoutForm.get('lastName')}`.trim(),
      phone: checkoutForm.get('phone'),
      country: checkoutForm.get('country'),
      city: checkoutForm.get('city'),
      addressLine1: checkoutForm.get('address'),
      instructions: checkoutForm.get('gpsAddress'),
      isDefault: existing.length === 0,
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'Unable to save your shipping address');
  return result.data.id;
}
async function createServerOrder(formOverride = null) {
  if (!authToken || !cart.length) throw new Error('Sign in and add at least one item before placing an order.');
  if (!availablePaymentGateways.some((gateway) => gateway.id === selectedPaymentProvider)) throw new Error('No payment provider is currently configured for checkout.');
  const checkoutForm = formOverride || $('#checkoutForm') || $('#pageCheckoutForm');
  if (!checkoutForm) throw new Error('Checkout form is unavailable.');
  const formData = new FormData(checkoutForm);
  const addressId = await ensureCheckoutAddress(formData);
  const items = cart.map((item) => ({ productId: toServerProductId(item), quantity: Number(item.quantity) }));
  const response = await fetch('http://localhost:4000/api/v1/orders', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ items, addressId, shippingMethodId: selectedShippingMethod?.id, email: formData.get('email'), provider: 'paystack', currency: currencyCode, couponCode: appliedCoupon?.code })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'Unable to create order');
  const order = result.data;
  checkoutPaymentId = order.payments?.[0]?.id || '';
  return order.orderNumber;
}
async function initializePayment(formOverride = null) {
  if (!checkoutPaymentId || !authToken) return;
  const checkoutForm = formOverride || $('#checkoutForm') || $('#pageCheckoutForm');
  if (!checkoutForm) throw new Error('Checkout form is unavailable.');
  const formData = new FormData(checkoutForm);
  const response = await fetch('http://localhost:4000/api/v1/payments/initialize', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ provider: 'paystack', paymentId: checkoutPaymentId, email: formData.get('email') })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'Unable to initialize payment');
  return result.provider?.redirectUrl || '';
}
async function downloadReceipt() {
  if (!checkoutOrderNumber || !authToken) return showToast('Sign in to download your receipt');
  const response = await fetch(`http://localhost:4000/api/v1/orders/${encodeURIComponent(checkoutOrderNumber)}/receipt`, { headers: { Authorization: `Bearer ${authToken}` } });
  if (!response.ok) return showToast('Receipt is not available yet');
  const receipt = (await response.json()).data;
  try {
    await exportReceiptPdf(receipt);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Unable to export invoice PDF.');
  }
}
function receiptFinancialRows(receipt) {
  return [
    { label: 'Subtotal', amount: Number(receipt.subtotal) },
    ...(Number(receipt.discount) > 0 ? [{ label: `Coupon discount${receipt.couponCode ? ` (${receipt.couponCode})` : ''}`, amount: -Number(receipt.discount) }] : []),
    { label: 'Delivery', amount: Number(receipt.shipping) },
    { label: 'Tax', amount: Number(receipt.tax) },
    ...(Number(receipt.serviceFee) > 0 ? [{ label: 'Payment provider service charge', amount: Number(receipt.serviceFee) }] : [])
  ];
}
function receiptSummaryMarkup(receipt) {
  const rows = receiptFinancialRows(receipt).map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(money(row.amount))}</td></tr>`).join('');
  const serviceFeeNote = Number(receipt.serviceFee) > 0 ? '<p class="receipt-service-note">This service charge is collected by the payment provider for secure handling of funds. The company does not charge an external fee.</p>' : '';
  return `<table class="receipt-financials"><thead><tr><th>Details</th><th>Amount</th></tr></thead><tbody>${rows}<tr class="receipt-total-row"><td>Total</td><td>${escapeHtml(money(receipt.total))} ${escapeHtml(receipt.currency)}</td></tr></tbody></table>${serviceFeeNote}`;
}
function loadReceiptLogo() {
  if (!storeBrand.logo) return Promise.resolve({ dataUrl: null, failed: false });
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), failed: false });
      } catch {
        resolve({ dataUrl: null, failed: true });
      }
    };
    image.onerror = () => resolve({ dataUrl: null, failed: true });
    image.src = storeBrand.logo;
  });
}
async function exportReceiptPdf(receipt) {
  if (typeof window.createInvoicePdf !== 'function') throw new Error('PDF export is unavailable. Refresh the page and try again.');
  const logo = await loadReceiptLogo();
  const pdfData = window.createInvoicePdf({ receipt, logoDataUrl: logo.dataUrl });
  const pdfUrl = URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = pdfUrl;
  link.download = `${String(receipt.invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
  if (logo.failed) showToast('Invoice PDF downloaded, but the configured company logo could not be included.');
}
document.addEventListener('click', (event) => { const add = event.target.closest('[data-add]'); if (add) addToCart(add.dataset.add); const move = event.target.closest('[data-move-to-cart]'); if (move) { const id = normalizeProductId(move.dataset.moveToCart); addToCart(id); wishlist.delete(id); saveState(); renderProducts(); renderWishlist(); } const view = event.target.closest('[data-view]'); if (view) openProduct(view.dataset.view); const wish = event.target.closest('[data-wish]'); if (wish) { const id = normalizeProductId(wish.dataset.wish); void recordProductView(id); if (wishlist.has(id)) wishlist.delete(id); else wishlist.add(id); saveState(); renderProducts(); renderWishlist(); } const thumbnail = event.target.closest('[data-modal-image]'); if (thumbnail) { selectedImageIndex = Number(thumbnail.dataset.modalImage); zoomedProductImage = false; renderModalGallery(); } const galleryArrow = event.target.closest('[data-gallery-direction]'); if (galleryArrow && selectedProduct) { const images = productImages(selectedProduct); selectedImageIndex = (selectedImageIndex + Number(galleryArrow.dataset.galleryDirection) + images.length) % images.length; zoomedProductImage = false; renderModalGallery(); } const quantity = event.target.closest('[data-quantity]'); if (quantity) { const item = cart.find((entry) => normalizeProductId(entry.id) === normalizeProductId(quantity.dataset.quantity)); if (!item) return; item.quantity += Number(quantity.dataset.change); if (item.quantity < 1) { if (item.serverCartItemId && authToken) fetch(`http://localhost:4000/api/v1/cart/items/${item.serverCartItemId}`, { method: 'DELETE', headers: apiHeaders() }); cart = cart.filter((entry) => entry !== item); } else void syncCartItem(normalizeProductId(item.id), item.quantity); saveState(); renderCart(); } });
function bindCategoryTabs() { document.querySelectorAll('.category-tab, .category-tile').forEach((tab) => { if (tab.dataset.bound) return; tab.dataset.bound = 'true'; tab.addEventListener('click', () => { document.querySelectorAll('.category-tab.active').forEach((item) => item.classList.remove('active')); document.querySelectorAll(`.category-tab[data-category="${CSS.escape(tab.dataset.category)}"]`).forEach((item) => item.classList.add('active')); activeCategory = tab.dataset.category; activeCategoryId = tab.dataset.categoryId || ''; renderProducts(); document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }); }
bindCategoryTabs();
$('#sortSelect').addEventListener('change', renderProducts); $('#cartToggle').addEventListener('click', openCart); $('#cartClose').addEventListener('click', closeCart); $('#wishlistToggle').addEventListener('click', openWishlist); $('#wishlistClose').addEventListener('click', closeWishlist); $('#overlay').addEventListener('click', () => { closeCart(); closeWishlist(); closeProduct(); closeCheckout(); }); $('#checkoutButton').addEventListener('click', () => { if (cart.length) { closeCart(); navigatePage('checkout'); } else showToast('Your bag is empty'); });
$('#featuredPrevious')?.addEventListener('click', () => { if (!featuredProducts.length) return; featuredOffset = (featuredOffset - 1 + featuredProducts.length) % featuredProducts.length; renderFeaturedProducts(); });
$('#featuredNext')?.addEventListener('click', () => { if (!featuredProducts.length) return; featuredOffset = (featuredOffset + 1) % featuredProducts.length; renderFeaturedProducts(); });
$('#modalClose').addEventListener('click', closeProduct); $('#modalZoom').addEventListener('click', () => { zoomedProductImage = !zoomedProductImage; renderModalGallery(); }); $('#modalImage').addEventListener('click', () => { zoomedProductImage = !zoomedProductImage; renderModalGallery(); }); $('#modalMinus').addEventListener('click', () => { modalQuantity = Math.max(1, modalQuantity - 1); $('#modalQuantity').textContent = modalQuantity; }); $('#modalPlus').addEventListener('click', () => { modalQuantity += 1; $('#modalQuantity').textContent = modalQuantity; }); $('#modalAdd').addEventListener('click', () => { for (let index = 0; index < modalQuantity; index += 1) addToCart(selectedProduct.id); closeProduct(); openCart(); }); $('#modalWishlist').addEventListener('click', () => { const selectedId = normalizeProductId(selectedProduct.id); void recordProductView(selectedId); if (wishlist.has(selectedId)) wishlist.delete(selectedId); else wishlist.add(selectedId); saveState(); $('#modalWishlist').textContent = wishlist.has(selectedId) ? '♥ In your wishlist' : '♡ Add to wishlist'; renderProducts(); renderWishlist(); });
$('#checkoutClose').addEventListener('click', closeCheckout); $('#shippingCountry').addEventListener('change', () => { const form = $('#checkoutForm'); applyCheckoutFieldValidation(form); loadShippingQuote().catch((error) => showToast(error.message)); }); $('#paymentProvider').addEventListener('change', () => { $('#paymentHelp').textContent = 'Secure card, bank, and mobile money checkout via Paystack.'; }); $('#checkoutForm').addEventListener('input', () => applyCheckoutFieldValidation($('#checkoutForm'))); $('#checkoutForm').addEventListener('change', (event) => { const method = event.target.closest('input[name="shippingMethod"]'); if (!method) return; selectedShippingMethod = { id: method.value, price: Number(method.dataset.price) }; document.querySelectorAll('.delivery-choice').forEach((choice) => choice.classList.toggle('selected', choice.contains(method))); updateCheckout(); }); const submitCheckoutForm = async (event, form, isPageCheckout = false) => {
  if (!form) return;
  event.preventDefault();
  if (!validateCheckoutForm(form)) return;
  const currentSection = isPageCheckout ? form : $(`.checkout-step[data-step="${checkoutStep}"]`);
  const fields = [...currentSection.querySelectorAll('input,select')];
  const invalidField = fields.find((field) => !field.checkValidity());
  if (invalidField) {
    invalidField.reportValidity();
    return;
  }
  if (!isPageCheckout && (checkoutStep === 1 || checkoutStep === 2)) {
    try {
      await loadShippingQuote(form);
    } catch (error) {
      showToast(error.message);
      return;
    }
  }
  if (isPageCheckout) {
    try {
      await loadTaxQuote(form);
    } catch (error) {
      showToast(error.message);
      return;
    }
  }
  if (isPageCheckout || checkoutStep === 3) {
    try {
      if (!authToken) {
        showToast('Sign in to place an order.');
        return;
      }
      if (!cart.length) {
        showToast('Your bag is empty.');
        return;
      }
      checkoutOrderNumber = await createServerOrder(form);
      const redirectUrl = await initializePayment(form);
      if (redirectUrl) { window.location.assign(redirectUrl); return; }
      showToast('Payment could not be started. Your order is ready to retry from tracking.');
      navigatePage('tracking', checkoutOrderNumber);
      return;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to place order.');
      return;
    }
  }
  if (!isPageCheckout) {
    checkoutStep += 1;
    updateCheckout();
  }
};
$('#checkoutForm').addEventListener('submit', (event) => submitCheckoutForm(event, $('#checkoutForm'), false));
document.addEventListener('submit', (event) => { if (event.target?.id !== 'pageCheckoutForm') return; event.preventDefault(); event.stopImmediatePropagation(); void submitCheckoutForm(event, event.target, true); }, true);
$('#pageCheckoutForm')?.addEventListener('submit', (event) => submitCheckoutForm(event, $('#pageCheckoutForm'), true));
$('#receiptButton').addEventListener('click', () => viewReceipt(checkoutOrderNumber));
$('#doneButton').addEventListener('click', () => { checkoutStep = 1; closeCheckout(); });
function updateProductSearch(value) { query = value.trim(); $('#catalogSearchInput').value = query; $('#searchInput').value = query; activeCategory = 'All'; activeCategoryId = ''; document.querySelectorAll('.category-tab.active').forEach((item) => item.classList.remove('active')); document.querySelector('.category-tab[data-category="All"]')?.classList.add('active'); renderProducts(); }
function clearCatalogFilters() { query = ''; activeCategory = 'All'; activeCategoryId = ''; $('#catalogSearchInput').value = ''; $('#searchInput').value = ''; $('#sortSelect').value = 'featured'; document.querySelectorAll('.category-tab.active').forEach((item) => item.classList.remove('active')); document.querySelector('.category-tab[data-category="All"]')?.classList.add('active'); renderProducts(); $('#catalogSearchInput').focus(); }
$('#clearCatalogFilters').addEventListener('click', clearCatalogFilters);
$('#searchToggle').addEventListener('click', () => { $('#searchBar').classList.add('open'); $('#searchInput').focus(); }); $('#searchClose').addEventListener('click', () => { $('#searchBar').classList.remove('open'); }); $('#searchInput').addEventListener('input', (event) => { updateProductSearch(event.target.value); }); $('#catalogSearchInput').addEventListener('input', (event) => { updateProductSearch(event.target.value); }); $('#searchBar').addEventListener('submit', (event) => { event.preventDefault(); document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#searchBar').classList.remove('open'); }); $('#catalogSearch').addEventListener('submit', (event) => { event.preventDefault(); document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('#newsletterForm')?.addEventListener('submit', (event) => { event.preventDefault(); $('#formMessage').textContent = 'You are on the list. See you soon.'; event.target.reset(); });
$('#accountToggle').addEventListener('click', () => { $('#accountModal').classList.add('open'); $('#accountModal').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); loadAccount(); }); $('#accountClose').addEventListener('click', () => { $('#accountModal').classList.remove('open'); $('#accountModal').setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('visible'); }); $('#accountSwitch').addEventListener('click', () => setAccountMode(accountMode === 'login' ? 'register' : 'login')); document.querySelectorAll('.auth-tab').forEach((tab) => tab.addEventListener('click', () => setAccountMode(tab.dataset.authTab))); $('#accountPasswordToggle').addEventListener('click', () => { const input = $('#accountPasswordInput'); const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; $('#accountPasswordToggle').textContent = visible ? 'Show' : 'Hide'; $('#accountPasswordToggle').setAttribute('aria-label', visible ? 'Show password' : 'Hide password'); }); $('#accountLogout').addEventListener('click', () => { setClientToken(''); authToken = ''; $('#accountToggle').textContent = 'Account'; $('#accountForm').hidden = false; $('#accountSwitch').hidden = false; $('#accountSession').hidden = true; setAccountMode('login'); showToast('You have been signed out'); }); $('#accountForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.target); const payload = { email: data.get('email'), password: data.get('password') }; if (accountMode === 'register') Object.assign(payload, { firstName: data.get('firstName'), lastName: data.get('lastName') }); try { const response = await fetch(`http://localhost:4000/api/v1/auth/${accountMode === 'register' ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to authenticate'); if (accountMode === 'register') {
  $('#accountError').textContent = '';
  event.target.reset();
  setAccountMode('login');
  await showToast('Account created. Check your email to verify it before signing in.', 'success');
  return;
} authToken = result.token; setClientToken(authToken); await loadAccount(); showToast('Welcome back'); } catch (error) { $('#accountError').textContent = error.message; } });
const resetClientHeader = () => { const accountName = $('#accountName'); const accountAvatar = $('#accountAvatar'); const dropdownName = $('#accountDropdownName'); const adminAccess = $('#adminAccess'); const dropdown = $('#accountDropdown'); const adminDashboard = $('#headerAdminDashboard'); const headerKyc = $('#headerKyc'); if (accountName) accountName.textContent = 'Client login'; if (accountAvatar) accountAvatar.textContent = ''; if (dropdownName) dropdownName.textContent = 'Account'; if (adminAccess) adminAccess.hidden = false; if (adminDashboard) adminDashboard.hidden = true; if (headerKyc) headerKyc.hidden = true; if (dropdown) dropdown.hidden = true; };
const restoreAccountButton = () => { const button = $('#accountToggle'); if (button && !$('#accountAvatar')) button.innerHTML = '<span class="account-avatar" id="accountAvatar" aria-hidden="true"></span><span id="accountName">Account</span><span class="account-chevron">⌄</span>'; };
document.querySelector('#accountLogout')?.addEventListener('click', () => setTimeout(restoreAccountButton, 0));
renderAccountBrand();
const closeAccountModal = () => { $('#accountModal')?.classList.remove('open'); $('#accountModal')?.setAttribute('aria-hidden', 'true'); $('#overlay')?.classList.remove('visible'); };
$('#overlay').addEventListener('click', () => { closeAccountModal(); closeNotificationsModal(); });
$('#accountModal').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeAccountModal(); });
$('#notificationClose')?.addEventListener('click', closeNotificationsModal);
$('#notificationModal')?.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeNotificationsModal(); });
document.querySelectorAll('.product-modal, .checkout-modal').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target !== event.currentTarget) return; modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('visible'); }));
document.addEventListener('pointerdown', (event) => { if (event.target.closest('.account-modal, .product-modal, .checkout-modal, .cart-drawer, .chat-panel, .search-bar, .account-menu, #cartToggle, #wishlistToggle, #searchToggle')) return; if ($('#accountModal')?.classList.contains('open')) closeAccountModal(); if ($('#productModal')?.classList.contains('open')) closeProduct(); if ($('#checkoutModal')?.classList.contains('open')) closeCheckout(); if ($('#cartDrawer')?.classList.contains('open')) closeCart(); if ($('#wishlistDrawer')?.classList.contains('open')) closeWishlist(); if ($('#searchBar')?.classList.contains('open')) $('#searchBar').classList.remove('open'); });
const originalLoadAccount = loadAccount;
document.querySelector('#accountForm')?.addEventListener('submit', () => { setTimeout(() => { if (authToken && accountMode === 'login') { closeAccountModal(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 700); });
document.addEventListener('click', (event) => { const notification = event.target.closest('[data-notification-id]'); if (!notification || !authToken || notification.classList.contains('read')) return; fetch(`http://localhost:4000/api/v1/notifications/${notification.dataset.notificationId}/read`, { method: 'PATCH', headers: apiHeaders() }).then(() => { notification.classList.remove('unread'); loadClientNotifications(); }).catch(() => { }); });
loadAccount = async () => { const sessionToken = authToken || localStorage.getItem(ADMIN_TOKEN_KEY) || ''; if (!sessionToken) { $('#headerAdminDashboard').hidden = true; return originalLoadAccount(); } const previousToken = authToken; authToken = sessionToken; try { await originalLoadAccount(); const profileResponse = await fetch('http://localhost:4000/api/v1/users/me', { headers: { Authorization: `Bearer ${authToken}` } }); const profile = profileResponse.ok ? (await profileResponse.json()).data : null; $('#headerAdminDashboard').hidden = !['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(profile?.role); await loadClientNotifications(); renderOrderTracking(); } finally { authToken = previousToken || sessionToken; } };
const hasSession = () => Boolean(authToken || localStorage.getItem(ADMIN_TOKEN_KEY));
const enhanceAccountMenu = () => { const menu = $('#accountDropdown'); if (!menu) return; const entries = [['#headerProfile', 'fa-user-circle', 'Profile'], ['#headerOrders', 'fa-receipt', 'Orders'], ['#headerNotifications', 'fa-bell', 'Notifications'], ['#headerKyc', 'fa-shield-halved', 'Staff KYC'], ['#headerAdminDashboard', 'fa-gauge-high', 'Admin dashboard'], ['#headerSaved', 'fa-heart', 'Saved pieces'], ['#headerShop', 'fa-house', 'Continue shopping'], ['#headerAccountLogout', 'fa-right-from-bracket', 'Log out']]; entries.forEach(([selector, icon, label]) => { const item = menu.querySelector(selector); if (item) item.innerHTML = `<span aria-hidden="true"><i class="fa-solid ${icon}"></i></span>${label}`; }); if (!menu.querySelector('#headerNotifications')) { const item = document.createElement('button'); item.type = 'button'; item.id = 'headerNotifications'; item.innerHTML = '<span aria-hidden="true"><i class="fa-solid fa-bell"></i></span>Notifications'; menu.querySelector('#headerOrders')?.after(item); } };
const syncAccountFormIcons = () => {
  const accountSwitch = $('#accountSwitch');
  const switchMarkup = accountMode === 'register' ? 'Sign in <span aria-hidden="true"><i class="fa-solid fa-arrow-right-to-bracket"></i></span>' : 'Create account <span aria-hidden="true"><i class="fa-solid fa-user-plus"></i></span>';
  if (accountSwitch && accountSwitch.innerHTML !== switchMarkup) accountSwitch.innerHTML = switchMarkup;
  const accountSubmit = $('#accountSubmit');
  if (accountSubmit?.querySelector('span') && accountSubmit.querySelector('span').innerHTML !== '<i class="fa-solid fa-arrow-up-right-from-square"></i>') accountSubmit.querySelector('span').innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
  const passwordToggle = $('#accountPasswordToggle');
  const passwordMarkup = `<i class="fa-solid ${passwordToggle?.getAttribute('aria-label') === 'Hide password' ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
  if (passwordToggle && passwordToggle.innerHTML !== passwordMarkup) passwordToggle.innerHTML = passwordMarkup;
};
const accountFormIconObserver = new MutationObserver(syncAccountFormIcons);
accountFormIconObserver.observe($('#accountModal'), { childList: true, subtree: true, characterData: true });
syncAccountFormIcons();
document.addEventListener('click', (event) => { if (event.target.closest('.auth-tab, #accountPasswordToggle')) setTimeout(syncAccountFormIcons, 0); });
const renderOrderTracking = () => { document.querySelectorAll('.account-order').forEach((order) => { if (order.querySelector('.order-tracking')) return; const status = order.querySelector('small')?.textContent?.split('·').pop()?.trim().toLowerCase() || 'pending'; const stages = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']; const current = Math.max(0, stages.indexOf(status.replaceAll(' ', '_'))); order.insertAdjacentHTML('beforeend', `<div class="order-tracking" aria-label="Order tracking">${stages.map((stage, index) => `<span class="${index <= current ? 'complete' : ''}"><i></i>${stage}</span>`).join('')}</div>`); }); };
async function loadClientNotifications() { const count = $('#headerNotificationCount'); if (!authToken) return; try { const response = await fetch('http://localhost:4000/api/v1/notifications', { headers: apiHeaders() }); if (!response.ok) return; const payload = await response.json(); const notifications = payload.data || []; const unread = Number(payload.unread || 0); if (count) { count.textContent = unread > 99 ? '99+' : String(unread); count.hidden = unread === 0; } const avatar = $('#accountAvatar'); if (avatar) { let badge = avatar.querySelector('.notification-badge'); if (unread > 0) { if (!badge) { badge = document.createElement('b'); badge.className = 'notification-badge'; badge.setAttribute('aria-label', `${unread} unread notifications`); avatar.appendChild(badge); } badge.textContent = unread > 99 ? '99+' : String(unread); badge.setAttribute('aria-label', `${unread} unread notifications`); } else badge?.remove(); } const list = $('#notificationModalList'); if (list) list.innerHTML = notifications.length ? notifications.map((notification) => `<article class="account-notification ${notification.readAt ? '' : 'unread'}" data-notification-id="${escapeHtml(notification.id)}"><span class="notification-icon">♢</span><div><strong>${escapeHtml(notification.title || 'Account update')}</strong><p>${escapeHtml(notification.body || '')}</p><small>${new Date(notification.createdAt).toLocaleString()}</small></div><b>${notification.readAt ? 'Read' : 'New'}</b></article>`).join('') : '<p class="account-muted">You are all caught up.</p>'; } catch { /* Notifications are supplementary to the account view. */ } }
function closeNotificationsModal() { const modal = $('#notificationModal'); if (!modal) return; modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); $('#overlay')?.classList.remove('visible'); }
async function openNotificationsModal() { if (!hasSession()) return showToast('Sign in to view notifications'); $('#accountDropdown').hidden = true; $('#notificationModal').classList.add('open'); $('#notificationModal').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('visible'); await loadClientNotifications(); }
$('#accountToggle').addEventListener('click', (event) => { if (!hasSession()) return; event.stopImmediatePropagation(); $('#accountDropdown').hidden = !$('#accountDropdown').hidden; }, true);
$('#headerProfile').addEventListener('click', () => navigatePage('profile'));
$('#headerKyc').addEventListener('click', () => navigatePage('kyc'));
$('#headerOrders').addEventListener('click', () => navigatePage('orders'));
$('#headerNotifications')?.addEventListener('click', () => navigatePage('notifications'));
$('#headerSaved').addEventListener('click', () => { $('#accountDropdown').hidden = true; openWishlist(); });
$('#headerAccountLogout').addEventListener('click', () => { $('#accountLogout').click(); setTimeout(resetClientHeader, 0); });
$('#accountLogout').addEventListener('click', () => setTimeout(resetClientHeader, 0));
$('#accountLogout').addEventListener('click', logoutToLanding);
$('#accountLogout').addEventListener('click', () => { localStorage.removeItem(ADMIN_TOKEN_KEY); $('#accountDropdown').hidden = true; });
enhanceAccountMenu();
const notificationMenuItem = $('#headerNotifications');
if (notificationMenuItem && !notificationMenuItem.querySelector('#headerNotificationCount')) notificationMenuItem.insertAdjacentHTML('beforeend', '<b id="headerNotificationCount" hidden>0</b>');
document.addEventListener('click', (event) => { if (!event.target.closest('#headerNotifications')) return; void openNotificationsModal(); });
document.addEventListener('click', (event) => { const quantity = event.target.closest('[data-quantity][data-change="1"]'); if (!quantity) return; const item = cart.find((entry) => normalizeProductId(entry.id) === normalizeProductId(quantity.dataset.quantity)); const stock = Number(item?.stock); if (item && Number.isFinite(stock) && item.quantity >= stock) { event.preventDefault(); event.stopImmediatePropagation(); showToast(`Only ${stock} ${item.name} available`); } }, true);
document.addEventListener('click', (event) => { if (!event.target.closest('#modalAdd')) return; const stock = Number(selectedProduct?.stock); if (selectedProduct && Number.isFinite(stock) && stock <= 0) { event.preventDefault(); event.stopImmediatePropagation(); showToast(`${selectedProduct.name} is out of stock`); } }, true);
document.addEventListener('pointerdown', (event) => { if (!event.target.closest('.account-menu')) $('#accountDropdown').hidden = true; });
document.addEventListener('click', (event) => { const link = event.target.closest('[data-page-link]'); if (!link) return; event.preventDefault(); navigatePage(link.dataset.pageLink); });
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-print-page]')) { window.print(); return; }
  const track = event.target.closest('[data-track-order]');
  if (track) navigatePage('tracking', track.dataset.trackOrder);
  const receipt = event.target.closest('[data-view-receipt]');
  if (receipt) void viewReceipt(receipt.dataset.viewReceipt);
  const notification = event.target.closest('[data-page-notification]');
  if (notification && authToken && notification.classList.contains('unread')) fetch(`http://localhost:4000/api/v1/notifications/${notification.dataset.pageNotification}/read`, { method: 'PATCH', headers: apiHeaders() }).then(() => { notification.classList.remove('unread'); notification.querySelector('b').textContent = 'Read'; }).catch(() => { });
});
applyTheme();
document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => toggle.addEventListener('click', () => applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark')));
window.addEventListener('hashchange', routeFromHash);
restoreState(); renderProducts(); renderCart(); renderWishlist(); loadServerCatalog(); loadDynamicCategories(); loadAccount();
async function loadStoreConfiguration() { try { const settingsResponse = await fetch('http://localhost:4000/api/v1/settings/public'); if (settingsResponse.ok) { const settings = (await settingsResponse.json()).data; window.applyBrandColors(settings); storeBrand = { name: settings.appName?.trim() || settings.storeName?.trim() || 'Store', logo: settings.storeLogo || '' }; document.title = `${storeBrand.name} - Objects with a point of view`; storeOpen = Boolean(settings.storeStatus); currencyCode = settings.defaultCurrency || 'USD'; taxEnabled = settings.taxEnabled === true || settings.taxEnabled === 'true'; availableCountries = Array.isArray(settings.taxCountries) && settings.taxCountries.length ? settings.taxCountries : availableCountries; configuredPaymentProvider = settings.paymentProvider || 'paystack'; availablePaymentGateways = Array.isArray(settings.paymentGateways) ? settings.paymentGateways : []; configuredSupportEmail = String(settings.supportEmail || '').trim(); configuredSupportWhatsApp = String(settings.supportWhatsApp || '').trim(); syncSupportEmailLink(); syncSupportWhatsAppLink(); renderCountryOptions(); renderPaymentProviders(); updateCheckout(); const mark = document.querySelector('.wordmark-mark'); mark.innerHTML = storeBrand.logo ? `<img src="${escapeHtml(storeBrand.logo)}" alt="">` : escapeHtml(storeBrand.name.charAt(0).toUpperCase()); document.querySelector('.wordmark').lastChild.textContent = ` ${storeBrand.name}`; const footerMark = $('#footerWordmarkMark'); const footerName = $('#footerWordmarkName'); if (footerMark) footerMark.innerHTML = storeBrand.logo ? `<img src="${escapeHtml(storeBrand.logo)}" alt="">` : escapeHtml(storeBrand.name.charAt(0).toUpperCase()); if (footerName) footerName.textContent = storeBrand.name; renderAccountBrand(); document.querySelector('#storeClosed').hidden = storeOpen; if ($('#pageCheckoutForm')) void loadTaxQuote($('#pageCheckoutForm')); renderProducts(); renderCart(); } } catch { /* Keep the storefront available when public settings are offline. */ } }
renderPaymentProviders();
loadStoreConfiguration();
async function loadPublicSupportEmail() {
  const response = await fetch('http://localhost:4000/api/v1/settings/public');
  if (!response.ok) throw new Error('Could not load the configured support email.');
  const settings = (await response.json()).data;
  configuredSupportEmail = String(settings.supportEmail || '').trim();
  configuredSupportWhatsApp = String(settings.supportWhatsApp || '').trim();
  syncSupportEmailLink();
  syncSupportWhatsAppLink();
}
void loadPublicSupportEmail().catch((error) => console.error('Unable to load the configured support email.', error));
function updateAccountVisual() { const product = products.find((entry) => entry.featured && entry.image) || products.find((entry) => entry.image); const visual = document.querySelector('.account-visual'); if (!visual || !product?.image) return; visual.classList.add('has-featured-image'); visual.style.setProperty('--account-featured-image', `url("${product.image.replaceAll('"', '%22')}")`); const title = visual.querySelector('h2'); if (title) title.textContent = product.name; }
const accountVisualTimer = setInterval(() => { if (!products.length) return; updateAccountVisual(); clearInterval(accountVisualTimer); }, 300);
routeFromHash();
async function refreshClientOperationalData() {
  const route = location.hash.replace(/^#/, '').split('/')[0];
  if (route === 'orders') return;
  await loadServerCatalog();
  if (route === 'tracking') await renderTrackingPage(location.hash.split('/')[1] || '', { preserveScroll: true });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshClientOperationalData(); });
window.addEventListener('focus', () => { void refreshClientOperationalData(); });
setInterval(() => { if (!document.hidden) void refreshClientOperationalData(); }, 15000);
async function viewReceipt(orderNumber) {
  if (!orderNumber || !authToken) return showToast('Sign in to view your receipt');
  const response = await fetch(`http://localhost:4000/api/v1/orders/${encodeURIComponent(orderNumber)}/receipt`, { headers: { Authorization: `Bearer ${authToken}` } });
  if (!response.ok) return showToast('Receipt is not available yet');
  const receipt = (await response.json()).data;
  const rows = receipt.items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${money(Number(item.unitPrice) * item.quantity)}</td></tr>`).join('');
  const summary = receiptSummaryMarkup(receipt);
  document.querySelector('.receipt-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'receipt-modal';
  modal.innerHTML = `<article class="receipt-sheet">${receiptBrandMarkup()}<header><div><p class="eyebrow">Invoice</p><h2>Receipt</h2><p>${escapeHtml(receipt.invoiceNumber)}<br>${new Date(receipt.issuedAt).toLocaleString()}</p></div><div class="receipt-actions"><button type="button" class="receipt-print">Download PDF</button><button type="button" class="receipt-close" aria-label="Close receipt">×</button></div></header><table class="receipt-item-table"><thead><tr><th>Details</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>${summary}<p class="receipt-payment">Payment: ${escapeHtml(receipt.payment?.provider || 'pending')} / ${escapeHtml(receipt.payment?.status || receipt.paymentStatus || 'PENDING')}</p></article>`;
  document.body.appendChild(modal);
  modal.querySelector('.receipt-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
  modal.querySelector('.receipt-print').addEventListener('click', async () => {
    try {
      await exportReceiptPdf(receipt);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to export invoice PDF.');
    }
  });
}
document.addEventListener('click', (event) => { const receipt = event.target.closest('[data-client-receipt]'); if (!receipt) return; void viewReceipt(receipt.dataset.clientReceipt); });
document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => { document.querySelectorAll('.main-nav a').forEach((item) => item.classList.toggle('active', item === link)); }));
const ensureInternalKycProfile = async () => {
  const tabs = document.querySelector('.profile-tabs');
  const grid = document.querySelector('.account-page-grid > div');
  if (!tabs || !grid || document.querySelector('[data-profile-tab="kyc"]')) return;
  try {
    const result = await fetch('http://localhost:4000/api/v1/users/me', { headers: apiHeaders() });
    const user = result.ok ? (await result.json()).data : null;
    if (!user || user.role === 'CUSTOMER') return;
    if ($('#headerKyc')) $('#headerKyc').hidden = false;
    const tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'profile-tab'; tab.dataset.profileTab = 'kyc'; tab.textContent = 'Staff KYC';
    tabs.appendChild(tab);
    grid.insertAdjacentHTML('beforeend', '<section class="page-panel page-form profile-tab-panel" data-profile-panel="kyc" hidden><div class="panel-label">Staff KYC <span class="kyc-status-badge">NOT SUBMITTED</span></div><p class="page-message">Complete your identity, screening, and compliance package before access is granted.</p><form id="profileKycForm"><label>Document type<input name="documentType" placeholder="National ID or passport" required></label><label>Document number<input name="documentNumber" required></label><label>Identity documents<input name="documents" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple required></label><label>Notes<textarea name="notes" rows="3" maxlength="1000"></textarea><button class="page-primary" type="submit">Submit KYC for review <span>↗</span></button></form></section>');
    tab.addEventListener('click', () => { tabs.querySelectorAll('[data-profile-tab]').forEach((item) => item.classList.toggle('active', item === tab)); grid.querySelectorAll('[data-profile-panel]').forEach((panel) => { panel.hidden = panel.dataset.profilePanel !== 'kyc'; }); });
    const kyc = user.kycApplication;
    const panel = grid.querySelector('[data-profile-panel="kyc"]');
    if (kyc) { panel.querySelector('.kyc-status-badge').textContent = kyc.status || 'PENDING'; panel.querySelector('input[name="documentType"]').value = kyc.documentType || ''; panel.querySelector('input[name="documentNumber"]').value = kyc.documentNumber || ''; }
  } catch { /* Profile remains usable if the optional KYC hydration is unavailable. */ }
};
const internalKycProfileObserver = new MutationObserver(() => { void ensureInternalKycProfile(); });
internalKycProfileObserver.observe(appPage, { childList: true, subtree: true });

function readPreviewDataUrl(file) {
  return new Promise((resolve) => {
    if (!file?.type?.startsWith('image/')) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function renderKycPreviewCard(file, type, imageSrc = '') {
  const size = file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'File';
  const isImage = file.type?.startsWith('image/');
  const ext = ((file.name || '').split('.').pop() || 'FILE').toUpperCase();
  const image = isImage ? `<img src="${imageSrc || ''}" alt="">` : `<span class="kyc-preview-file-icon">${file.type === 'application/pdf' ? 'PDF' : ext}</span>`;
  const fileName = escapeHtml(file.name);
  return `<article class="kyc-upload-preview-card kyc-upload-preview-${type}"><div class="kyc-upload-preview-media">${image}</div><div class="kyc-upload-preview-details"><strong>${fileName}</strong><small>${escapeHtml(type === 'documents' ? 'Identity document' : type === 'proofOfAddress' ? 'Proof of address' : 'Selfie')}${size ? ` · ${size}` : ''}</small></div></article>`;
}
function renderPersistedKycPreview(url, type, index = 0) {
  const absoluteUrl = String(url || '').trim();
  if (!absoluteUrl) return '';
  const fileName = absoluteUrl.split('/').pop()?.split('?')[0] || `${type}-${index + 1}`;
  const isImage = /\.(png|jpe?g|gif|webp|bmp)(?:\?|$)/i.test(absoluteUrl);
  const preview = isImage ? `<img src="${escapeHtml(absoluteUrl)}" alt="${escapeHtml(type)} preview" loading="lazy">` : `<span class="kyc-preview-file-icon">${escapeHtml(fileName.split('.').pop()?.toUpperCase() || 'FILE')}</span>`;
  return `<article class="kyc-upload-preview-card kyc-upload-preview-${type} kyc-upload-preview-persisted"><div class="kyc-upload-preview-media">${preview}</div><div class="kyc-upload-preview-details"><strong>${escapeHtml(fileName)}</strong><small>${escapeHtml(type === 'documents' ? 'Saved identity document' : type === 'proofOfAddress' ? 'Saved proof of address' : 'Saved selfie')}</small></div></article>`;
}
function setClientKycSubmissionState(form, status) {
  const submit = form?.querySelector('button[type="submit"]');
  if (!submit) return;
  const approved = String(status || '').toUpperCase() === 'APPROVED';
  submit.disabled = approved;
  const processing = String(status || '').toUpperCase() === 'PROCESSING';
  submit.textContent = approved ? 'KYC approved' : processing ? 'Update KYC submission' : 'Submit KYC for review';
  submit.classList.toggle('is-approved', approved);
  submit.setAttribute('aria-disabled', String(approved));
  if (approved) submit.title = 'This KYC application has already been approved.';
}

function bindKycUploadPreview(form) {
  const previewMap = {
    documents: form.querySelector('[data-kyc-preview-list="documents"]'),
    proofOfAddress: form.querySelector('[data-kyc-preview-list="proofOfAddress"]'),
    selfie: form.querySelector('[data-kyc-preview-list="selfie"]')
  };
  if (!previewMap.documents || !previewMap.proofOfAddress || !previewMap.selfie) return;

  const refresh = async (type, files) => {
    if (!previewMap[type]) return;
    const imageFiles = await Promise.all(files.map(async (file) => ({
      file,
      src: await readPreviewDataUrl(file)
    })));
    previewMap[type].innerHTML = imageFiles.length ? imageFiles.map(({ file, src }) => renderKycPreviewCard(file, type, src)).join('') : '';
  };

  form.elements.documents?.addEventListener('change', () => refresh('documents', Array.from(form.elements.documents.files || [])));
  form.elements.proofOfAddress?.addEventListener('change', () => refresh('proofOfAddress', form.elements.proofOfAddress.files ? Array.from(form.elements.proofOfAddress.files) : []));
  form.elements.selfie?.addEventListener('change', () => refresh('selfie', form.elements.selfie.files ? Array.from(form.elements.selfie.files) : []));

  form.addEventListener('reset', () => {
    Object.values(previewMap).forEach((list) => { if (list) list.innerHTML = ''; });
  });
}

async function hydrateKycFormFromServer(form) {
  if (!form || form.dataset.kycHydrated === 'true') return;
  form.dataset.kycHydrated = 'true';
  try {
    const response = await fetch('http://localhost:4000/api/v1/users/me', { headers: apiHeaders() });
    const user = response.ok ? (await response.json()).data : null;
    const kyc = user?.kycApplication;
    setClientKycSubmissionState(form, kyc?.status);
    if (!kyc) return;
    const setValue = (name, value) => { if (form.elements[name] && value !== undefined && value !== null) form.elements[name].value = value; };
    setValue('documentType', kyc.documentType);
    setValue('documentNumber', kyc.documentNumber);
    setValue('aliases', kyc.aliases || '');
    setValue('dateOfBirth', kyc.dateOfBirth ? new Date(kyc.dateOfBirth).toISOString().slice(0, 10) : '');
    setValue('nationality', kyc.nationality || '');
    setValue('currentAddress', kyc.currentAddress || '');
    setValue('previousAddresses', Array.isArray(kyc.previousAddresses) ? kyc.previousAddresses.join('\n') : '');
    setValue('accessTier', kyc.accessTier || 'LEVEL_1_SUPPORT');
    setValue('notes', kyc.notes || '');
    if (form.elements.ndaSigned) form.elements.ndaSigned.checked = Boolean(kyc.ndaSigned);
    if (form.elements.acceptableUsePolicyAccepted) form.elements.acceptableUsePolicyAccepted.checked = Boolean(kyc.acceptableUsePolicyAccepted);
    setClientKycSubmissionState(form, kyc.status);
    const previews = {
      documents: Array.isArray(kyc.documents) ? kyc.documents : (kyc.documentUrl ? [kyc.documentUrl] : []),
      proofOfAddress: kyc.proofOfAddressUrl ? [kyc.proofOfAddressUrl] : [],
      selfie: kyc.selfieUrl ? [kyc.selfieUrl] : []
    };
    Object.entries(previews).forEach(([type, urls]) => {
      const list = form.querySelector(`[data-kyc-preview-list="${type}"]`);
      if (!list || !urls.length || list.children.length) return;
      list.innerHTML = urls.map((url, index) => renderPersistedKycPreview(url, type, index)).join('');
    });
  } catch { /* Keep the form usable when the profile endpoint is temporarily unavailable. */ }
}

const enhanceInternalKycForm = (form) => {
  if (!form || form.dataset.internalWorkflowReady) return;
  form.dataset.internalWorkflowReady = 'true';
  const documentTypeInput = form.elements.documentType;
  if (documentTypeInput?.tagName === 'INPUT') { const select = document.createElement('select'); select.name = 'documentType'; select.required = true; select.innerHTML = '<option value="">Choose document type</option><option value="PASSPORT">Passport</option><option value="NATIONAL_ID">National ID card</option><option value="DRIVERS_LICENSE">Driver license</option><option value="RESIDENCE_PERMIT">Residence permit</option>'; select.value = documentTypeInput.value || ''; documentTypeInput.replaceWith(select); }
  const documentsLabel = form.elements.documents?.closest('label');
  if (!documentsLabel) return;
  documentsLabel.insertAdjacentHTML('afterend', '<div class="kyc-workflow-fields"><div class="panel-label">Identity and residence</div><label>Aliases or maiden names <small>(optional)</small><input name="aliases" maxlength="500"></label><div class="page-field-grid"><label>Date of birth<input name="dateOfBirth" type="date" required></label><label>Nationality<input name="nationality" maxlength="80" required></label></div><label>Current residential address<textarea name="currentAddress" rows="3" maxlength="500" required></textarea></label><label>Previous addresses <small>(one per line, covering the past 3–5 years)</small><textarea name="previousAddresses" rows="3" maxlength="2500"></textarea></label><label>Proof of address <small>(utility bill or bank statement from the last 3 months)</small><input name="proofOfAddress" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" required></label><label>Live selfie<div class="kyc-selfie-control"><input name="selfie" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required><button type="button" class="page-secondary" data-open-selfie-camera>Open camera</button></div><small data-selfie-status>Use your camera for a live selfie, or upload an image.</small></label><div class="panel-label">Access tier and agreements</div><label>Requested access tier<select name="accessTier"><option value="LEVEL_1_SUPPORT">Level 1 · Basic support</option><option value="LEVEL_2_OPERATIONS">Level 2 · Operations and inventory</option><option value="LEVEL_3_FINANCE_EXECUTIVE">Level 3 · Finance and executive</option></select></label><label class="check-row"><input name="ndaSigned" type="checkbox" required> <span>I have signed the <a href="/nda_confidentiality_agreement.pdf" target="_blank" rel="noopener" data-policy="nda">NDA and confidentiality agreement</a>.</span></label><label class="check-row"><input name="acceptableUsePolicyAccepted" type="checkbox" required> <span>I accept the <a href="/acceptable_use_policy.pdf" target="_blank" rel="noopener" data-policy="acceptable-use">Acceptable Use Policy</a>.</span></label>.pdf" target="_blank" rel="noopener" data-policy="acceptable-use">Acceptable Use Policy</a>.</span></label><div class="kyc-upload-preview-grid"><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Identity document</div><div class="kyc-upload-preview-list" data-kyc-preview-list="documents"></div></div><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Proof of address</div><div class="kyc-upload-preview-list" data-kyc-preview-list="proofOfAddress"></div></div><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Selfie</div><div class="kyc-upload-preview-list" data-kyc-preview-list="selfie"></div></div></div></div>');
  bindKycPolicyAndCamera(form);
  bindKycUploadPreview(form);
  void hydrateKycFormFromServer(form);
};
function bindKycPolicyAndCamera(form) {
  form.querySelectorAll('[data-policy]').forEach((link) => link.addEventListener('click', (event) => { if (link.getAttribute('href') !== '#') return; event.preventDefault(); const nda = link.dataset.policy === 'nda'; void showClientAlert('info', nda ? 'NDA and confidentiality agreement' : 'Acceptable Use Policy', nda ? 'Review the supplied NDA before accepting.' : 'Review the supplied Acceptable Use Policy before accepting.'); }));
  const cameraButton = form.querySelector('[data-open-selfie-camera]');
  if (!cameraButton || cameraButton.dataset.bound) return;
  cameraButton.dataset.bound = 'true';
  cameraButton.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) return showClientAlert('warning', 'Camera unavailable', 'Your browser does not provide camera access. Upload a selfie image instead.');
    const modal = document.createElement('div'); modal.className = 'kyc-camera-modal'; modal.innerHTML = '<div class="kyc-camera-card"><h3>Live selfie</h3><video autoplay playsinline></video><canvas hidden></canvas><div><button type="button" class="page-primary" data-capture-selfie>Capture selfie</button><button type="button" class="page-secondary" data-close-selfie>Cancel</button></div><p data-camera-message>Allow camera access, center your face, and capture.</p></div>'; document.body.appendChild(modal);
    const video = modal.querySelector('video'); let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); video.srcObject = stream; } catch { modal.remove(); return showClientAlert('warning', 'Camera access denied', 'Allow camera access or upload a selfie image instead.'); }
    const close = () => { stream?.getTracks().forEach((track) => track.stop()); modal.remove(); };
    modal.querySelector('[data-close-selfie]').addEventListener('click', close);
    modal.querySelector('[data-capture-selfie]').addEventListener('click', async () => {
      const canvas = modal.querySelector('canvas');
      canvas.width = video.videoWidth || 0;
      canvas.height = video.videoHeight || 0;
      const context = canvas.getContext('2d');
      if (!context || !canvas.width || !canvas.height) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        form.elements.selfie.files = transfer.files;
        form.elements.selfie.dispatchEvent(new Event('change', { bubbles: true }));
        form.querySelector('[data-selfie-status]').textContent = 'Live selfie captured.';
        const dataUrl = await readPreviewDataUrl(file);
        const list = form.querySelector('[data-kyc-preview-list="selfie"]');
        if (list) list.innerHTML = renderKycPreviewCard(file, 'selfie', dataUrl);
        close();
      }, 'image/jpeg', .92);
    });
  });
}
document.addEventListener('submit', async (event) => {
  const form = event.target.closest('#profileKycForm');
  if (!form || form.dataset.kycSubmitInFlight === 'true') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  form.dataset.kycSubmitInFlight = 'true';
  enhanceInternalKycForm(form);
  try {
    const files = Array.from(form.elements.documents?.files || []);
    const proofOfAddress = form.elements.proofOfAddress?.files?.[0];
    const selfie = form.elements.selfie?.files?.[0];
    const ndaSigned = Boolean(form.elements.ndaSigned?.checked);
    const acceptableUsePolicyAccepted = Boolean(form.elements.acceptableUsePolicyAccepted?.checked);
    if (!files.length || !proofOfAddress || !selfie || !ndaSigned || !acceptableUsePolicyAccepted) {
      throw new Error('Upload your ID, proof of address, selfie, and accept both compliance agreements.');
    }

    const upload = new FormData();
    files.forEach((file) => upload.append('documents', file));
    upload.append('proofOfAddress', proofOfAddress);
    upload.append('selfie', selfie);

    const uploadResponse = await fetch('http://localhost:4000/api/v1/media/kyc', { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: upload });
    const uploadPayload = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'Could not upload KYC documents.');

    const toAbsolute = (url) => {
      if (!url) return undefined;
      const value = String(url).trim();
      if (!value) return undefined;
      if (/^https?:\/\//i.test(value)) return value;
      return new URL(value, 'http://localhost:4000').toString();
    };
    const previousAddresses = String(form.elements.previousAddresses?.value || '')
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);

    const body = {
      documentType: String(form.elements.documentType?.value || '').trim(),
      documentNumber: String(form.elements.documentNumber?.value || '').trim(),
      documents: Array.isArray(uploadPayload.data?.documents) ? uploadPayload.data.documents.map(toAbsolute).filter(Boolean) : [],
      documentUrl: toAbsolute(uploadPayload.data?.documentUrl || uploadPayload.data?.documents?.[0]),
      aliases: String(form.elements.aliases?.value || '').trim() || undefined,
      dateOfBirth: String(form.elements.dateOfBirth?.value || '').trim() || undefined,
      nationality: String(form.elements.nationality?.value || '').trim() || undefined,
      currentAddress: String(form.elements.currentAddress?.value || '').trim() || undefined,
      previousAddresses: previousAddresses.length ? previousAddresses : undefined,
      accessTier: String(form.elements.accessTier?.value || '').trim() || 'LEVEL_1_SUPPORT',
      ndaSigned,
      acceptableUsePolicyAccepted,
      notes: String(form.elements.notes?.value || '').trim() || undefined,
      proofOfAddressUrl: toAbsolute(uploadPayload.data?.proofOfAddressUrl),
      selfieUrl: toAbsolute(uploadPayload.data?.selfieUrl)
    };

    const result = await fetch('http://localhost:4000/api/v1/users/me/kyc', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) throw new Error(payload.error || 'Could not submit KYC.');

    await showClientAlert('success', 'KYC submitted', 'Your identity and screening package is ready for compliance review.');
    await renderKycPage();
    document.querySelector('[data-profile-tab="kyc"]')?.click();
  } catch (error) {
    await showClientAlert('error', 'KYC could not be submitted', error.message || 'Unable to submit KYC.');
  } finally {
    form.dataset.kycSubmitInFlight = 'false';
  }
}, true);
document.addEventListener('click', (event) => { const story = event.target.closest('[data-journal-message]'); if (story) showToast(story.dataset.journalMessage); });
let chatStaffOnline = false;
let chatMessageIds = new Set();
let chatAudioContext;
let chatSoundsEnabled = localStorage.getItem('ground-chat-sounds') !== 'off';
function chatSender(message) { if (message.senderRole === 'CUSTOMER') return { name: 'You', image: '', initial: 'Y' }; const sender = message.sender || {}; if (!sender.id) return { name: 'AI assistant', image: '', initial: 'A' }; const name = `${sender.firstName || 'Support'} ${sender.lastName || ''}`.trim(); return { name, image: sender.avatarUrl || '', initial: (sender.firstName || 'S').charAt(0).toUpperCase() }; }
function playChatSound(kind = 'message') { if (!chatSoundsEnabled) return; try { chatAudioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (chatAudioContext.state === 'suspended') void chatAudioContext.resume(); const oscillator = chatAudioContext.createOscillator(); const gain = chatAudioContext.createGain(); const now = chatAudioContext.currentTime; oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(kind === 'sent' ? 620 : 880, now); oscillator.frequency.exponentialRampToValueAtTime(kind === 'sent' ? 760 : 660, now + .11); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.06, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + .14); oscillator.connect(gain).connect(chatAudioContext.destination); oscillator.start(now); oscillator.stop(now + .15); } catch { /* Audio is an enhancement and may be blocked by the browser. */ } }
function chatReadTicks(message) { return message.readAt ? '<span class="chat-ticks read" title="Read" aria-label="Read">✓✓</span>' : '<span class="chat-ticks" title="Sent" aria-label="Sent">✓</span>'; }
async function loadClientStaffPresence() { const status = $('#chatStaffStatus'); if (!status) return; if (!authToken) { chatStaffOnline = false; status.innerHTML = '<i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Sign in to see staff availability.</span>'; return; } try { const response = await fetch('http://localhost:4000/api/v1/chat/presence', { headers: apiHeaders() }); if (!response.ok) throw new Error('Presence unavailable'); const staff = (await response.json()).data || []; chatStaffOnline = staff.length > 0; status.innerHTML = chatStaffOnline ? `<i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>${staff.map((member) => escapeHtml(`${member.firstName} ${member.lastName}`.trim())).join(', ')} online · AI is ready</span>` : '<i class="fa-solid fa-clock" aria-hidden="true"></i><span>No staff online. AI will reply immediately.</span>'; } catch { chatStaffOnline = false; status.innerHTML = '<i class="fa-solid fa-clock" aria-hidden="true"></i><span>Staff availability is temporarily unavailable.</span>'; } }
async function aiAssistantReply(message) { const text = String(message || '').trim(); const normalized = text.toLowerCase(); const has = (...words) => words.some((word) => normalized.includes(word)); if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(normalized)) return 'Hello. I can help you find products, compare options, understand delivery, or check an order. What would you like to solve?'; if (has('order', 'track', 'parcel', 'package')) { const orderNumber = text.match(/ord[-\s]?[a-z0-9-]+/i)?.[0]; try { const response = await fetch('http://localhost:4000/api/v1/orders', { headers: apiHeaders() }); const orders = response.ok ? (await response.json()).data || [] : []; const order = orders.find((item) => !orderNumber || item.orderNumber.toLowerCase() === orderNumber.replace(/\s/g, '').toLowerCase()) || (orders.length === 1 ? orders[0] : null); if (order) return `Your order ${order.orderNumber} is currently ${String(order.status || 'pending').toLowerCase().replaceAll('_', ' ')}. Open Track order from your Orders page for the full timeline.`; } catch { /* Fall back to guidance when orders are unavailable. */ } return 'I can check that for you. Please include your order number, such as ORD-20260917-AB12, and I will look for it. If it is still unclear, I will send this conversation to staff.'; } if (has('return', 'refund', 'exchange', 'wrong item', 'damaged')) return 'I can help start a return or refund request. Please share the order number and briefly tell me whether the item is damaged, incorrect, or simply unwanted. A staff member will confirm eligibility before any refund is issued.'; if (has('delivery', 'shipping', 'ship', 'arrive', 'how long')) return 'Delivery choices and fees are calculated at checkout from your destination. Standard delivery timing can vary by country and stock status; share your country and I can narrow this down.'; if (has('pay', 'payment', 'card', 'checkout', 'coupon', 'discount')) return 'Checkout accepts the payment method shown for your region. Your total is calculated from item prices, shipping, tax, and any valid coupon before payment is confirmed.'; if (has('recommend', 'looking for', 'find me', 'suggest', 'product', 'price', 'cost', 'available', 'stock')) { const matches = products.filter((product) => [product.name, product.category, product.description, product.features].join(' ').toLowerCase().includes(normalized.replace(/\b(please|can you|do you have|show me|i need|a|an|the)\b/g, '').trim())).slice(0, 3); if (matches.length) return `I found ${matches.map((product) => `${product.name} (${money(product.price)})`).join(', ')}. Open a product card to see details, stock, and reviews.`; const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].slice(0, 5); return categories.length ? `I can help you browse ${categories.join(', ')}. Tell me your preferred category, budget, or use case and I will narrow the options.` : 'Tell me the category, budget, or use case you have in mind and I will narrow the catalog for you.'; } if (has('account', 'sign in', 'login', 'profile')) return 'You can manage your profile, saved addresses, orders, and notifications from the account menu. I can guide you to the right page, but I cannot change account details for you.'; return null; }
function appendChatMessage(name, body, mine = false, feedback = false, message = null) { const feedbackMarkup = feedback ? '<div class="chat-feedback"><button type="button" data-chat-helpful>Helpful</button><button type="button" data-chat-not-helpful>Not helpful</button></div>' : ''; const ticks = mine ? chatReadTicks(message || {}) : ''; $('#chatMessages').insertAdjacentHTML('beforeend', `<div class="chat-message ${mine ? 'mine' : ''}"><div class="chat-avatar">${mine ? '<i class="fa-solid fa-user" aria-hidden="true"></i>' : '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>'}</div><div class="chat-message-body"><div class="chat-message-meta"><strong>${escapeHtml(name)}</strong><small>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div><div class="chat-bubble"><p>${escapeHtml(body)} ${ticks}</p>${feedbackMarkup}</div></div></div>`); $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight; }
async function sendChatToStaff(body) { const response = await fetch('http://localhost:4000/api/v1/chat', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ body }) }); if (!response.ok) throw new Error('Message could not be sent'); return response.json(); }
async function handleCustomerChatMessage(message) { appendChatMessage('You', message, true); playChatSound('sent'); try { const response = await fetch('http://localhost:4000/api/v1/chat/assistant', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ body: message }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) { throw new Error(payload.error || 'The AI assistant is unavailable.'); } await loadClientChat(); playChatSound(); if (payload?.data?.handoff) { const escalate = document.querySelector('#chatEscalateButton'); if (escalate) escalate.hidden = false; } } catch (error) { showToast(error.message || 'We could not send your message.'); } }
async function loadClientChat() { if (!authToken) { $('#chatMessages').innerHTML = '<p class="account-muted">Sign in to start a conversation.</p>'; await loadClientStaffPresence(); return; } try { const response = await fetch('http://localhost:4000/api/v1/chat', { headers: apiHeaders() }); if (!response.ok) throw new Error('Chat unavailable'); const result = await response.json(); const messages = result.data || []; const hasNewIncoming = messages.some((message) => message.senderRole !== 'CUSTOMER' && !chatMessageIds.has(message.id)); chatMessageIds = new Set(messages.map((message) => message.id)); $('#chatMessages').innerHTML = messages.length ? messages.map((message) => { const sender = chatSender(message); const avatar = sender.image ? `<img src="${escapeHtml(sender.image)}" alt="${escapeHtml(sender.name)}">` : `<span>${escapeHtml(sender.initial)}</span>`; return `<div class="chat-message ${message.senderRole === 'CUSTOMER' ? 'mine' : ''}"><div class="chat-avatar">${avatar}</div><div class="chat-message-body"><div class="chat-message-meta"><strong>${escapeHtml(sender.name)}</strong><small>${new Date(message.createdAt).toLocaleString()}</small></div><div class="chat-bubble"><p>${escapeHtml(message.body)} ${message.senderRole === 'CUSTOMER' ? chatReadTicks(message) : ''}</p></div></div></div>`; }).join('') : '<p class="account-muted">Send us a message and our team will reply here.</p>'; $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight; if (hasNewIncoming) playChatSound(); await loadClientStaffPresence(); } catch { showToast('Support chat is unavailable right now.'); } }
$('#chatLauncher').addEventListener('click', () => { $('#chatPanel').classList.add('open'); $('#chatPanel').setAttribute('aria-hidden', 'false'); loadClientChat(); }); $('#chatClose').addEventListener('click', () => { $('#chatPanel').classList.remove('open'); $('#chatPanel').setAttribute('aria-hidden', 'true'); });
document.addEventListener('click', (event) => { const panel = document.querySelector('#chatPanel'); if (!panel?.classList.contains('open')) return; if (panel.contains(event.target) || event.target.closest('#chatLauncher')) return; panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }); $('#chatSoundToggle').addEventListener('click', () => { chatSoundsEnabled = !chatSoundsEnabled; localStorage.setItem('ground-chat-sounds', chatSoundsEnabled ? 'on' : 'off'); $('#chatSoundToggle').innerHTML = `<i class="fa-solid fa-volume-${chatSoundsEnabled ? 'high' : 'xmark'}" aria-hidden="true"></i>`; $('#chatSoundToggle').setAttribute('aria-label', chatSoundsEnabled ? 'Mute chat sounds' : 'Unmute chat sounds'); if (chatSoundsEnabled) playChatSound(); }); document.querySelectorAll('[data-chat-query]').forEach((button) => button.addEventListener('click', () => { if (!authToken) return showToast('Sign in before starting a chat.'); void handleCustomerChatMessage(button.dataset.chatQuery); })); async function connectCustomerToStaff(trigger) {
  if (!authToken) return showToast('Sign in before starting a chat.');
  const button = trigger?.closest?.('#chatEscalateButton, [data-connect-staff]') || trigger;
  if (button?.dataset?.connecting === 'true') return;
  if (button?.dataset) button.dataset.connecting = 'true';
  if (button) button.disabled = true;
  try {
    const body = 'I would like to speak with a support agent.';
    await sendChatToStaff(body);
    await loadClientChat();
    appendChatMessage('Support', 'Your request has been sent to our support team. A staff member will join this chat shortly.', false);
    playChatSound();
    const escalate = document.querySelector('#chatEscalateButton');
    if (escalate) escalate.hidden = true;
  } catch (error) {
    showToast(error.message || 'Could not connect you to staff.');
  } finally {
    if (button?.dataset) button.dataset.connecting = 'false';
    if (button) button.disabled = false;
  }
}
$('#chatEscalateButton').addEventListener('click', (event) => { void connectCustomerToStaff(event.currentTarget); });
document.querySelectorAll('[data-connect-staff]').forEach((button) => button.addEventListener('click', (event) => { void connectCustomerToStaff(event.currentTarget); })); $('#chatMessages').addEventListener('click', (event) => { if (event.target.closest('[data-chat-helpful]')) event.target.closest('.chat-feedback').innerHTML = '<small>Glad that helped.</small>'; if (event.target.closest('[data-chat-not-helpful]')) { event.target.closest('.chat-feedback').innerHTML = '<small>Thanks for letting us know.</small>'; $('#chatEscalateButton').hidden = false; } }); $('#chatForm').addEventListener('submit', async (event) => { event.preventDefault(); if (!authToken) return showToast('Sign in before starting a chat.'); const message = String(new FormData(event.target).get('body') || '').trim(); if (!message) return; event.target.reset(); await handleCustomerChatMessage(message); });