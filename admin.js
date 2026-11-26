const addProduct = document.querySelector('#addProduct');
const productModal = document.querySelector('#productModal');
const productForm = document.querySelector('#productForm');
const toast = document.querySelector('#adminToast');
const inventoryPanel = document.querySelector('#inventory');
const sidebar = document.querySelector('.admin-sidebar');
const mediaPreview = document.querySelector('#mediaPreview');
let productImageData = '';
let inventoryThreshold = 10;
let products = JSON.parse(localStorage.getItem('ground-admin-products') || '[]');
let editingProductId = null;
const ordersBody = document.querySelector('#ordersBody');
const savedOrderStatuses = JSON.parse(localStorage.getItem('ground-order-statuses') || '{}');
ordersBody.querySelectorAll('.status-select').forEach((select) => { const saved = savedOrderStatuses[select.dataset.order]; if (!saved) return; select.value = saved; select.className = `status-select ${saved}`; select.closest('tr').dataset.orderStatus = saved; });
const productCatalog = document.querySelector('#productCatalog');
const catalogEmpty = document.querySelector('#catalogEmpty');
const productDetailModal = document.querySelector('#productDetailModal');
const productDetailContent = document.querySelector('#productDetailContent');
const productDetailTitle = document.querySelector('#productDetailTitle');
const orderDetailModal = document.querySelector('#orderDetailModal');
const orderDetailTitle = document.querySelector('#orderDetailTitle');
const orderDetailContent = document.querySelector('#orderDetailContent');
const userDetailModal = document.querySelector('#userDetailModal');
const userDetailContent = document.querySelector('#userDetailContent');
const userDetailTitle = document.querySelector('#userDetailTitle');
const kycDocumentModal = document.querySelector('#kycDocumentModal');
const kycDocumentImage = document.querySelector('#kycDocumentImage');
const kycDocumentError = document.querySelector('#kycDocumentError');
const kycDocumentDownload = document.querySelector('#kycDocumentDownload');
const kycDocumentTitle = document.querySelector('#kycDocumentTitle');
const kycDocumentApplicant = document.querySelector('#kycDocumentApplicant');
const kycDocumentStatus = document.querySelector('#kycDocumentStatus');
const kycDocumentDocumentType = document.querySelector('#kycDocumentDocumentType');
const kycDocumentNumber = document.querySelector('#kycDocumentNumber');
const kycDocumentSubmitted = document.querySelector('#kycDocumentSubmitted');
const kycDocumentReason = document.querySelector('#kycDocumentReason');
const kycDocumentNotes = document.querySelector('#kycDocumentNotes');
const kycDocumentFiles = document.querySelector('#kycDocumentFiles');
const kycDocumentGallery = document.querySelector('#kycDocumentGallery');
const analyticsRange = document.querySelector('#analyticsRange') || document.querySelector('.revenue-panel .panel-heading select');
const adminTokenKey = 'ground-admin-token';
const clientTokenKey = 'ground-client-token';
const apiToken = localStorage.getItem(adminTokenKey) || '';
const closeProductDetail = () => { productDetailModal.classList.remove('open'); productDetailModal.setAttribute('aria-hidden', 'true'); };
const openProductDetail = (product) => { if (!product) return; const images = product.images?.length ? product.images : (product.image ? [product.image] : []); productDetailTitle.textContent = product.name; productDetailContent.innerHTML = `<div class="product-detail-hero"><img id="productDetailMainImage" src="${images[0] || ''}" alt="${product.name}"${images.length ? '' : ' hidden'}>${images.length ? '' : '<span>G</span>'}</div>${images.length > 1 ? `<div class="product-detail-gallery" role="list">${images.map((image, index) => `<button type="button" class="product-detail-thumbnail${index === 0 ? ' active' : ''}" data-detail-image="${image}" aria-label="View image ${index + 1}"><img src="${image}" alt="${product.name} thumbnail ${index + 1}"></button>`).join('')}</div>` : ''}<div class="product-detail-summary"><div><h3>${product.name}</h3><p>${product.category || 'Uncategorized'}</p></div><strong class="product-detail-price">${formatMoney(product.price)}</strong></div><div class="product-detail-stats"><div><strong>${product.stock ?? 0}</strong><small>Available quantity</small></div><div><strong>${images.length}</strong><small>Product images</small></div><div><strong>SKU-${String(product.id).slice(-4)}</strong><small>Catalog reference</small></div></div><div class="product-detail-sections"><section><h4>Description</h4><p>${product.description || 'No description added yet.'}</p></section><section><h4>How to use</h4><p>${product.usage || 'No usage instructions added yet.'}</p></section><section><h4>Key features</h4><p>${product.features || 'No key features added yet.'}</p></section></div>`; productDetailModal.classList.add('open'); productDetailModal.setAttribute('aria-hidden', 'false'); };
productDetailContent.addEventListener('click', (event) => { const thumbnail = event.target.closest('[data-detail-image]'); if (!thumbnail) return; const mainImage = productDetailContent.querySelector('#productDetailMainImage'); if (!mainImage) return; mainImage.src = thumbnail.dataset.detailImage; productDetailContent.querySelectorAll('.product-detail-thumbnail').forEach((item) => item.classList.toggle('active', item === thumbnail)); });
const API_BASE = window.location.origin;
const THEME_KEY = 'ground-theme';
let currentAdminRole = localStorage.getItem('ground-admin-role') || '';
let currentAdminPermissions = [];
let currentAdminKycStatus = '';
let currencyCode = 'USD';
const formatMoney = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2 }).format(Number(value) || 0);
function updateAdminHeader(user) { const now = new Date(); const hour = now.getHours(); const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'; const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }); const firstName = user?.firstName || ''; const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrator'; const role = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role) ? 'Administrator' : user?.role === 'STAFF' ? 'Staff member' : 'Operations'; const nameElement = document.querySelector('#adminUserName'); document.querySelector('#adminDate').textContent = date; const greetingElement = document.querySelector('#adminGreeting'); greetingElement.textContent = greeting; if (firstName) { greetingElement.append(', '); const greetingName = document.createElement('span'); greetingName.className = 'greeting-name'; greetingName.textContent = firstName; if (user?.emailVerified) { const badge = document.createElement('span'); badge.className = 'verified-badge greeting-verified-badge'; badge.title = 'Email verified'; badge.setAttribute('aria-label', 'Email verified'); badge.innerHTML = '<i class="fa-solid fa-check"></i>'; greetingName.appendChild(badge); } greetingElement.append(greetingName); } greetingElement.append('.'); if (nameElement) { nameElement.textContent = fullName; if (currentAdminKycStatus === 'APPROVED') { const badge = document.createElement('span'); badge.className = 'verified-badge'; badge.title = 'KYC verified'; badge.setAttribute('aria-label', 'KYC verified'); badge.innerHTML = '<i class="fa-solid fa-check"></i>'; nameElement.appendChild(badge); } } document.querySelector('#adminUserRole').textContent = role; document.querySelector('.sidebar-bottom .avatar').textContent = fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
const applyTheme = (themeName = localStorage.getItem(THEME_KEY) || 'light') => {
  const isDark = themeName === 'dark';
  document.body.dataset.theme = themeName;
  localStorage.setItem(THEME_KEY, themeName);
  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    toggle.textContent = isDark ? '☾' : '☀';
    toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  });
};
updateAdminHeader();
const adminApiHeaders = () => apiToken ? { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } : null;
function enforceStaffCatalogRestrictions() {
  const staffAccount = currentAdminRole === 'STAFF' || document.querySelector('#adminUserRole')?.textContent?.trim() === 'Staff member';
  if (!staffAccount) return;
  ['#addProduct', '#catalogAdd', '.admin-sidebar a[href="#products"]'].forEach((selector) => document.querySelectorAll(selector).forEach((element) => { element.hidden = true; element.setAttribute('aria-hidden', 'true'); }));
  document.querySelectorAll('[data-edit-product], [data-delete-product], [data-stock-product] input, [data-stock-product] button').forEach((element) => { element.hidden = true; element.disabled = true; });
}
const staffCatalogRestrictionObserver = new MutationObserver(() => enforceStaffCatalogRestrictions());
staffCatalogRestrictionObserver.observe(document.body, { childList: true, subtree: true });
setInterval(enforceStaffCatalogRestrictions, 500);
const adminSessionAwareFetch = window.fetch.bind(window);
window.fetch = async (resource, options) => { const response = await adminSessionAwareFetch(resource, options); const url = String(resource); if (response.status === 401 && !url.includes('/api/v1/auth/')) { localStorage.removeItem(adminTokenKey); localStorage.removeItem(clientTokenKey); localStorage.removeItem('ground-token'); window.location.assign('index.html#top'); } return response; };
function roleCanAccess(permission) {
  if (currentAdminRole === 'ADMIN' || currentAdminRole === 'SUPER_ADMIN') return true;
  if (currentAdminRole === 'STAFF' && ['products.create', 'products.update', 'products.delete', 'inventory.update'].includes(permission)) return false;
  const writePermission = !permission.endsWith('.read') && permission !== 'reports.read';
  if (currentAdminRole === 'STAFF' && writePermission && currentAdminKycStatus !== 'APPROVED') return false;
  if (currentAdminPermissions.length) return currentAdminPermissions.includes(permission);
  const role = String(currentAdminRole || '').toUpperCase();
  if (role === 'ADMIN') return true;
  const defaults = { SUPER_ADMIN: ['*'], FINANCE_MANAGER: ['orders.read', 'orders.refund', 'finance.ledger', 'finance.payouts', 'finance.tax_reports', 'coupons.read', 'reports.read'], OPERATIONS_MANAGER: ['products.read', 'products.create', 'products.update', 'products.delete', 'inventory.read', 'inventory.update', 'orders.read', 'orders.update', 'shipping.update', 'coupons.read', 'reports.read'], SUPPORT_AGENT: ['orders.read', 'orders.cancel', 'shipping.update', 'coupons.read', 'users.read'], WAREHOUSE_STAFF: ['orders.read', 'shipping.update', 'shipping.packing_slips', 'inventory.read', 'coupons.read'], STAFF: ['products.read', 'orders.read', 'orders.update', 'orders.cancel', 'inventory.read', 'coupons.read', 'reports.read', 'reviews.moderate', 'users.read'] };
  if (defaults[role]?.includes('*')) return true;
  if (defaults[role]) return defaults[role].includes(permission);
  return false;
}
const canManageCommerceDefaults = () => ['ADMIN', 'SUPER_ADMIN'].includes(currentAdminRole);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const resolveMediaUrl = (value) => { if (!value) return ''; try { const url = new URL(String(value), API_BASE); if (url.pathname.startsWith('/uploads/')) return `${API_BASE}${url.pathname}${url.search}${url.hash}`; return url.href; } catch { return ''; } };
async function loadAdminBranding() { try { const response = await fetch(`${API_BASE}/api/v1/settings/public`); if (!response.ok) return; const settings = (await response.json()).data || {}; window.applyBrandColors(settings); currencyCode = String(settings.defaultCurrency || currencyCode).toUpperCase(); const name = settings.appName?.trim() || settings.storeName?.trim() || 'Store'; const logo = settings.storeLogo || ''; const mark = logo ? `<img src="${escapeHtml(logo)}" alt="">` : escapeHtml(name.charAt(0).toUpperCase()); document.title = `${name} / Operations`; document.querySelector('.admin-brand span').innerHTML = mark; document.querySelector('.admin-brand strong').textContent = name; document.querySelector('.login-brand span').innerHTML = mark; document.querySelector('.login-brand strong').textContent = name; document.querySelector('.login-heading h2').textContent = `Sign in to ${name}.`; const mobileBrand = document.querySelector('.admin-mobile-brand'); mobileBrand?.querySelector('span') && (mobileBrand.querySelector('span').innerHTML = mark); mobileBrand?.querySelector('strong') && (mobileBrand.querySelector('strong').textContent = name); refreshCurrencyDisplays(); renderCatalog(); } catch { /* Keep static branding when the API is offline. */ } }
loadAdminBranding();
function showToast(message, icon = 'success') { const text = String(message ?? ''); const permissionWarning = text.startsWith('Missing permission:') || text.startsWith('KYC approval is required') || text.includes('STAFF_KYC_REQUIRED'); const swalIcon = permissionWarning ? 'warning' : icon; if (window.Swal) { void window.Swal.fire({ icon: swalIcon, title: text, text: '', confirmButtonText: 'OK', buttonsStyling: false, customClass: { popup: 'admin-swal-popup', title: 'admin-swal-title', confirmButton: 'admin-swal-confirm' } }); return; } toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
async function loadServerProducts() { if (!adminApiHeaders()) return; try { const response = await fetch('http://localhost:4000/api/v1/products?take=100', { headers: adminApiHeaders() }); if (!response.ok) return; const payload = await response.json(); products = payload.data.map((item) => ({ id: item.id, name: item.name, category: item.category?.name || 'Objects', price: Number(item.price), stock: item.inventory?.available || 0, description: item.description || item.shortDescription || '', usage: '', features: '', image: item.images?.[0]?.url || '' })); localStorage.setItem('ground-admin-products', JSON.stringify(products)); renderCatalog(); enforceStaffCatalogRestrictions(); } catch { /* Keep local catalog fallback when the API is offline. */ } }
function openOrderDetail(order) { if (!order || !orderDetailModal) return; const customerName = `${order.user?.firstName || 'Customer'} ${order.user?.lastName || ''}`.trim(); const address = order.address; const payment = order.payments?.[0]; const paymentMetadata = payment?.metadata && typeof payment.metadata === 'object' ? Object.entries(payment.metadata).filter(([key]) => !['email'].includes(key)).map(([key, value]) => `<small>${escapeHtml(key)}: ${escapeHtml(value)}</small>`).join('') : ''; orderDetailTitle.textContent = order.orderNumber; orderDetailContent.innerHTML = `<div class="order-detail-summary"><div><span>Customer</span><strong>${escapeHtml(customerName)}</strong><small>${escapeHtml(order.user?.phone || order.address?.phone || 'No phone number')}</small><small>${escapeHtml(order.user?.email || '')}</small></div><div><span>Order status</span><strong class="order-detail-status ${order.status.toLowerCase()}">${escapeHtml(order.status.replaceAll('_', ' '))}</strong><span>Payment status</span><strong class="order-detail-status ${String(order.paymentStatus || 'PENDING').toLowerCase()}">${escapeHtml(String(order.paymentStatus || 'PENDING').replaceAll('_', ' '))}</strong></div><div><span>Total</span><strong>${formatMoney(order.total)}</strong><small>Placed ${new Date(order.createdAt).toLocaleString()}</small></div></div><section class="order-detail-section"><h3>Items</h3><div class="order-detail-items">${(order.items || []).map((item) => { const image = item.product?.images?.[0]?.url || ''; return `<div class="order-detail-item"><div class="order-detail-item-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}">` : '<span>G</span>'}</div><div class="order-detail-item-copy"><strong>${escapeHtml(item.name)}</strong><small>Qty ${item.quantity} · ${escapeHtml(item.sku || 'No SKU')}</small><small>${formatMoney(item.unitPrice)} each</small></div><b>${formatMoney(Number(item.unitPrice) * item.quantity)}</b></div>`; }).join('') || '<p>No items found.</p>'}</div></section><section class="order-detail-section"><h3>Payment details</h3><div class="order-detail-payment"><div><span>Provider</span><strong>${escapeHtml(payment?.provider || 'Pending')}</strong></div><div><span>Method</span><strong>${escapeHtml(payment?.paymentMethod || 'Not specified')}</strong></div><div><span>Reference</span><strong>${escapeHtml(payment?.reference || 'Not available')}</strong></div><div><span>Amount</span><strong>${formatMoney(payment?.amount ?? order.total)}</strong></div>${payment?.providerTransactionId ? `<div><span>Provider transaction</span><strong>${escapeHtml(payment.providerTransactionId)}</strong></div>` : ''}${payment?.paidAt ? `<div><span>Paid at</span><strong>${new Date(payment.paidAt).toLocaleString()}</strong></div>` : ''}${paymentMetadata}</div></section><section class="order-detail-section"><h3>Order summary</h3><div class="order-detail-breakdown"><span>Subtotal <b>${formatMoney(order.subtotal)}</b></span><span>Discount <b>${formatMoney(order.discount)}</b></span><span>Tax <b>${formatMoney(order.tax)}</b></span><span>Delivery <b>${formatMoney(order.shipping)}</b></span><strong>Total <b>${formatMoney(order.total)}</b></strong></div></section><section class="order-detail-section"><h3>Delivery</h3><p>${address ? `${escapeHtml(address.fullName)} · ${escapeHtml(address.phone)}<br>${escapeHtml(address.addressLine1)}${address.addressLine2 ? `, ${escapeHtml(address.addressLine2)}` : ''}<br>${escapeHtml(address.city)}, ${escapeHtml(address.country)}${address.instructions ? `<br>${escapeHtml(address.instructions)}` : ''}` : 'No delivery address attached.'}</p></section>`; orderDetailModal.classList.add('open'); orderDetailModal.setAttribute('aria-hidden', 'false'); }
const closeOrderDetail = () => { orderDetailModal?.classList.remove('open'); orderDetailModal?.setAttribute('aria-hidden', 'true'); };
const closeUserDetail = () => { userDetailModal?.classList.remove('open'); userDetailModal?.setAttribute('aria-hidden', 'true'); };
const closeKycDocument = () => { kycDocumentModal?.classList.remove('open'); kycDocumentModal?.setAttribute('aria-hidden', 'true'); if (kycDocumentImage) kycDocumentImage.src = ''; if (kycDocumentGallery) kycDocumentGallery.innerHTML = ''; if (kycDocumentFiles) kycDocumentFiles.innerHTML = ''; };
const openKycDocument = (details, applicantName = 'Identity document') => {
  const urls = Array.isArray(details?.documents) ? details.documents : (typeof details === 'string' ? [details] : []);
  const files = urls.map((url) => resolveMediaUrl(url)).filter(Boolean);
  if (!files.length || !kycDocumentModal) return;
  const primaryUrl = files[0] || '';
  if (kycDocumentTitle) kycDocumentTitle.textContent = applicantName;
  if (kycDocumentApplicant) kycDocumentApplicant.textContent = applicantName;
  if (kycDocumentDocumentType) kycDocumentDocumentType.textContent = details?.documentType || 'Identity document';
  if (kycDocumentNumber) kycDocumentNumber.textContent = details?.documentNumber || 'N/A';
  if (kycDocumentStatus) kycDocumentStatus.textContent = details?.status || 'PENDING';
  if (kycDocumentReason) kycDocumentReason.textContent = details?.reviewReason || 'No review reason yet';
  if (kycDocumentSubmitted) kycDocumentSubmitted.textContent = details?.submittedAt ? new Date(details.submittedAt).toLocaleString() : 'Not submitted';
  if (kycDocumentNotes) kycDocumentNotes.textContent = details?.notes || 'No notes provided.';
  if (kycDocumentFiles) {
    kycDocumentFiles.innerHTML = files.map((file, index) => `<a href="${escapeHtml(file)}" target="_blank" rel="noopener">${index + 1}. ${escapeHtml(new URL(file, location.href).pathname.split('/').pop() || 'Uploaded document')}</a>`).join('');
  }
  if (kycDocumentGallery) {
    kycDocumentGallery.innerHTML = files.map((file, index) => `<img src="${escapeHtml(file)}" alt="${escapeHtml(applicantName)} document ${index + 1}" data-kyc-gallery-file="${escapeHtml(file)}">`).join('');
    kycDocumentGallery.querySelectorAll('img').forEach((image) => {
      image.addEventListener('click', () => {
        if (!kycDocumentImage) return;
        kycDocumentImage.src = image.dataset.kycGalleryFile;
        kycDocumentImage.hidden = false;
        kycDocumentError.hidden = true;
      });
    });
  }
  kycDocumentImage.hidden = false;
  kycDocumentError.hidden = true;
  kycDocumentError.textContent = 'Document preview unavailable. Please upload the identity document again.';
  kycDocumentImage.onload = () => { const invalid = kycDocumentImage.naturalWidth <= 1 || kycDocumentImage.naturalHeight <= 1; kycDocumentImage.hidden = invalid; kycDocumentError.hidden = !invalid; };
  kycDocumentImage.onerror = () => { kycDocumentImage.hidden = true; kycDocumentError.hidden = false; };
  kycDocumentImage.src = primaryUrl;
  kycDocumentDownload.href = primaryUrl;
  kycDocumentModal.classList.add('open');
  kycDocumentModal.setAttribute('aria-hidden', 'false');
};
function openUserDetail(user) { const kycDocument = user.kycApplication?.documentUrl ? `<a href="${escapeHtml(user.kycApplication.documentUrl)}" target="_blank" rel="noopener">View document</a>` : 'No document'; const addressCount = Array.isArray(user.addresses) ? user.addresses.length : 0; userDetailTitle.textContent = `${user.firstName} ${user.lastName}`; userDetailContent.innerHTML = `<div class="user-detail-profile"><div class="profile-avatar">${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="">` : escapeHtml(user.firstName.charAt(0).toUpperCase())}</div><div><h3>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</h3><p>${escapeHtml(user.email)}</p></div></div><div class="user-detail-grid"><div><span>Role</span><strong>${escapeHtml(user.role)}</strong></div><div><span>Status</span><strong>${escapeHtml(user.status)}</strong></div><div><span>Phone</span><strong>${escapeHtml(user.phone || 'Not provided')}</strong></div><div><span>Joined</span><strong>${new Date(user.createdAt).toLocaleDateString()}</strong></div><div><span>Last active</span><strong>${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</strong></div><div><span>Saved addresses</span><strong>${addressCount}</strong></div><div><span>Email</span><strong>${user.emailVerified ? 'Verified' : 'Unverified'}</strong></div><div><span>KYC</span><strong>${escapeHtml(user.kycApplication?.status || 'Not submitted')} ${kycDocument}</strong></div></div><form class="user-password-form" data-password-user="${user.id}"><div class="panel-label">Set a new password</div><label>New password<input name="password" type="password" minlength="8" required></label><button class="primary-button" type="submit">Update password</button><p class="page-message" data-password-message></p></form>`; userDetailModal.classList.add('open'); userDetailModal.setAttribute('aria-hidden', 'false'); }
userDetailContent.addEventListener('submit', async (event) => { const form = event.target.closest('[data-password-user]'); if (!form) return; event.preventDefault(); const message = form.querySelector('[data-password-message]'); try { await adminJson(`/api/v1/users/${form.dataset.passwordUser}/account`, { method: 'PATCH', body: JSON.stringify({ password: new FormData(form).get('password') }) }); message.textContent = 'Password updated.'; form.reset(); } catch (error) { message.textContent = error.message; } });
const normalizeOrderFilters = () => { const filter = document.querySelector('#orderFilter'); if (filter && filter.options.length < 7) filter.innerHTML = '<option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="processing">Processing</option><option value="packed">Packed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>'; };
normalizeOrderFilters();
let adminOrders = [];
let ordersPage = 1;
const adminPageSize = 8;
function renderAttentionOrders() {
  const container = document.querySelector('#attentionOrders');
  const summary = document.querySelector('#attentionSummary');
  if (!container) return;
  const attentionStatuses = new Set(['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY']);
  const paymentIssueStatuses = new Set(['FAILED', 'CANCELLED', 'EXPIRED', 'PENDING']);
  const attention = adminOrders
    .map((order) => {
      const status = String(order.status || '').toUpperCase();
      const payment = Array.isArray(order.payments) ? order.payments[0] : order.payment;
      const paymentStatus = String(payment?.status || order?.paymentStatus || '').toUpperCase();
      const paymentIssue = paymentStatus && paymentIssueStatuses.has(paymentStatus) && paymentStatus !== 'SUCCESS';
      const needsAction = attentionStatuses.has(status) || paymentIssue;
      if (!needsAction) return null;
      const priority = status === 'PENDING' || paymentStatus === 'FAILED' ? 0 : status === 'CONFIRMED' || status === 'PROCESSING' ? 1 : 2;
      const reason = paymentStatus === 'FAILED' ? 'Payment failed'
        : paymentStatus === 'EXPIRED' ? 'Payment expired'
        : paymentStatus === 'CANCELLED' ? 'Payment cancelled'
        : status === 'PENDING' ? 'Awaiting confirmation'
        : status === 'CONFIRMED' ? 'Ready for processing'
        : status === 'PROCESSING' ? 'Being prepared'
        : status === 'PACKED' ? 'Ready to ship'
        : status === 'OUT_FOR_DELIVERY' ? 'Out for delivery'
        : 'Needs review';
      return { order, status, paymentStatus, paymentIssue, priority, reason };
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority || new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime())
    .slice(0, 6);
  if (summary) {
    summary.innerHTML = attention.length
      ? `<span class="attention-pill is-urgent">${attention.length} order${attention.length === 1 ? '' : 's'} need action</span>`
      : '<span class="attention-pill">All caught up</span>';
  }
  if (!attention.length) {
    container.innerHTML = '<div class="attention-empty">No orders need attention right now. New pending or in-progress orders will appear here.</div>';
    return;
  }
  container.innerHTML = attention.map(({ order, status, paymentStatus, reason, paymentIssue }) => {
    const customer = escapeHtml(`${order.user?.firstName || 'Customer'} ${order.user?.lastName || ''}`.trim());
    const ageMs = Date.now() - new Date(order.createdAt).getTime();
    const ageHours = Math.max(1, Math.floor(ageMs / 3600000));
    const ageLabel = ageHours < 24 ? `${ageHours}h ago` : `${Math.floor(ageHours / 24)}d ago`;
    const tone = paymentIssue || status === 'PENDING' ? 'urgent' : status === 'OUT_FOR_DELIVERY' || status === 'PACKED' ? 'active' : 'review';
    return `<article class="attention-card attention-${tone}"><div class="attention-card-top"><div><p class="attention-order">${escapeHtml(order.orderNumber)}</p><strong>${customer}</strong><small>${escapeHtml(new Date(order.createdAt).toLocaleDateString())} · ${escapeHtml(ageLabel)}</small></div><span class="attention-reason">${escapeHtml(reason)}</span></div><div class="attention-meta"><span>${formatMoney(order.total)}</span><span>${escapeHtml(status.replaceAll('_', ' '))}</span>${paymentStatus ? `<span>Payment: ${escapeHtml(paymentStatus.replaceAll('_', ' '))}</span>` : ''}</div><div class="attention-actions"><button type="button" class="order-view-button" data-view-order="${escapeHtml(order.orderNumber)}">Review</button></div></article>`;
  }).join('');
  container.querySelectorAll('[data-view-order]').forEach((button) => button.addEventListener('click', () => openOrderDetail(adminOrders.find((order) => order.orderNumber === button.dataset.viewOrder))));
}

function renderOrdersPage() { const orderTools = document.querySelector('.order-tools'); if (orderTools && !document.querySelector('#orderSearch')) { orderTools.insertAdjacentHTML('afterbegin', '<input id="orderSearch" type="search" placeholder="Search orders" aria-label="Search orders">'); document.querySelector('#orderSearch').addEventListener('input', () => { ordersPage = 1; renderOrdersPage(); }); } if (!document.querySelector('#ordersPager')) ordersBody.closest('.table-panel')?.insertAdjacentHTML('beforeend', '<div class="admin-pager" id="ordersPager"></div>'); const search = String(document.querySelector('#orderSearch')?.value || '').trim().toLowerCase(); const filter = document.querySelector('#orderFilter')?.value || 'all'; const filtered = adminOrders.filter((order) => { const customer = `${order.user?.firstName || ''} ${order.user?.lastName || ''} ${order.user?.email || ''}`.toLowerCase(); return (filter === 'all' || order.status.toLowerCase() === filter) && (!search || `${order.orderNumber} ${customer}`.includes(search)); }); const pages = Math.max(1, Math.ceil(filtered.length / adminPageSize)); ordersPage = Math.min(ordersPage, pages); const visible = filtered.slice((ordersPage - 1) * adminPageSize, ordersPage * adminPageSize); ordersBody.innerHTML = visible.map((order) => `<tr data-order-status="${order.status.toLowerCase()}"><td>${escapeHtml(order.orderNumber)}</td><td><strong>${escapeHtml(`${order.user?.firstName || 'Customer'} ${order.user?.lastName || ''}`.trim())}</strong><small class="order-customer-phone">${escapeHtml(order.user?.phone || order.address?.phone || 'No phone number')}</small></td><td>${new Date(order.createdAt).toLocaleDateString()}</td><td>${formatMoney(order.total)}</td><td><div class="order-status-actions"><select class="status-select ${order.status.toLowerCase()}" data-order="${escapeHtml(order.orderNumber)}" aria-label="Status for order ${escapeHtml(order.orderNumber)}">${['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((status) => `<option value="${status.toLowerCase()}" ${status === order.status ? 'selected' : ''}>${status.replaceAll('_', ' ')}</option>`).join('')}</select><button type="button" class="order-view-button" data-view-order="${escapeHtml(order.orderNumber)}">View</button></div></td></tr>`).join(''); document.querySelector('#ordersEmpty').hidden = visible.length > 0; document.querySelector('#ordersPager').innerHTML = `<button type="button" class="pager-button" data-orders-prev ${ordersPage === 1 ? 'disabled' : ''}>Previous</button><span>Page ${ordersPage} of ${pages} · ${filtered.length} orders</span><button type="button" class="pager-button" data-orders-next ${ordersPage === pages ? 'disabled' : ''}>Next</button>`; document.querySelector('#ordersPager').onclick = (event) => { if (event.target.matches('[data-orders-prev]')) ordersPage -= 1; if (event.target.matches('[data-orders-next]')) ordersPage += 1; renderOrdersPage(); }; ordersBody.querySelectorAll('[data-view-order]').forEach((button) => button.addEventListener('click', () => openOrderDetail(adminOrders.find((order) => order.orderNumber === button.dataset.viewOrder)))); }
async function loadServerOrders() { if (!adminApiHeaders()) return; try { const response = await fetch('http://localhost:4000/api/v1/orders', { headers: adminApiHeaders() }); if (!response.ok) return; const payload = await response.json(); adminOrders = payload.data || []; document.querySelector('#orderCount').textContent = adminOrders.length; renderOrdersPage(); renderAttentionOrders(); } catch { /* Keep static order examples when the API is offline. */ } }
const adminLogin = document.querySelector('#adminLogin');
const adminLoginForm = document.querySelector('#adminLoginForm');
const closeAdminLogin = () => {
  adminLogin.classList.remove('open');
  adminLogin.setAttribute('aria-hidden', 'true');
};
const adminAuthRequired = () => { document.body.classList.remove('admin-authenticated'); document.querySelector('.admin-main')?.setAttribute('aria-hidden', 'true'); };
const adminAuthGranted = (user) => {
  document.body.classList.add('admin-authenticated');
  document.querySelector('.admin-main')?.setAttribute('aria-hidden', 'false');
  currentAdminRole = String(user?.role || 'ADMIN').toUpperCase();
  currentAdminPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  currentAdminKycStatus = String(user?.kycApplication?.status || 'NOT_SUBMITTED').toUpperCase();
  document.body.classList.toggle('staff-restricted', currentAdminRole === 'STAFF');
  localStorage.setItem('ground-admin-role', currentAdminRole);
  updateAdminHeader(user);
  const couponCreateButton = document.querySelector('#createCouponButton');
  if (couponCreateButton) couponCreateButton.hidden = !['ADMIN', 'SUPER_ADMIN'].includes(currentAdminRole);
  document.querySelector('.settings-detail-link')?.toggleAttribute('hidden', !canManageCommerceDefaults());
  document.querySelector('#settingsDetails')?.toggleAttribute('hidden', location.hash !== '#settingsDetails' || !canManageCommerceDefaults());
  rebuildAdminSidebar(currentAdminRole);
  enforceStaffCatalogRestrictions();
  if (typeof loadUsers === 'function') void loadUsers();
  if (typeof loadCustomers === 'function') void loadCustomers();
};
async function ensureAdminSession() { if (apiToken) { try { const response = await fetch(`${API_BASE}/api/v1/users/me`, { headers: { Authorization: `Bearer ${apiToken}` }, signal: AbortSignal.timeout(5000) }); const result = await response.json(); if (response.ok && result.data?.role && result.data.role !== 'CUSTOMER') { adminAuthGranted(result.data); return; } } catch { setConnectionStatus('offline', 'Ground API is offline'); document.querySelector('#adminLoginError').textContent = 'The API could not be reached. Start the backend, then retry.'; } localStorage.removeItem(adminTokenKey); localStorage.removeItem(clientTokenKey); localStorage.removeItem('ground-token'); } adminAuthRequired(); adminLogin.classList.add('open'); adminLogin.setAttribute('aria-hidden', 'false'); void checkApiConnection(); }
document.querySelector('#adminLogout').addEventListener('click', () => { localStorage.removeItem(adminTokenKey); localStorage.removeItem(clientTokenKey); localStorage.removeItem('ground-token'); document.body.classList.remove('admin-authenticated'); location.href = 'index.html#top'; });
function setConnectionStatus(state, message) { const status = document.querySelector('#adminConnectionStatus'); status.className = `login-status ${state}`; status.querySelector('span').textContent = message; document.querySelector('#adminRetry').classList.toggle('visible', state === 'offline'); }
async function checkApiConnection() { try { const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3500) }); if (!response.ok) throw new Error('Health check failed'); setConnectionStatus('online', 'Ground API connected'); return true; } catch { setConnectionStatus('offline', 'Ground API is offline'); return false; } }
const activitySection = document.createElement('section');
activitySection.className = 'panel utility-panel';
activitySection.id = 'activity';
activitySection.innerHTML = '<div class="panel-heading"><div><p class="eyebrow">Transparency / audit</p><h2>Activity log</h2><small>Readable history of account and workspace activity.</small></div><button class="ghost-button" id="refreshActivity" type="button">Refresh</button></div><div class="activity-controls"><input id="activitySearch" type="search" placeholder="Search activity" aria-label="Search activity"><select id="activityEntity" aria-label="Filter activity by area"><option value="">All areas</option><option value="auth">Authentication</option><option value="orders">Orders</option><option value="products">Products</option><option value="users">Users</option><option value="catalog">Catalog</option><option value="settings">Settings</option></select><select id="activityPageSize" aria-label="Activity page size"><option value="25">25 per page</option><option value="50">50 per page</option><option value="100">100 per page</option></select></div><div class="admin-list" id="activityList"><p class="table-empty">Loading activity...</p></div><div class="activity-pagination"><button class="ghost-button" id="activityPrevious" type="button">Previous</button><span id="activityPageLabel">Page 1</span><button class="ghost-button" id="activityNext" type="button">Next</button></div>';
document.querySelector('#settings')?.before(activitySection);
document.querySelector('a[href="#performance"]')?.insertAdjacentHTML('afterend', '<a href="#activity"><span><i class="fa-solid fa-clock-rotate-left"></i></span><b class="nav-text">Activity log</b></a>');
const activityState = { page: 1, pageSize: 25, search: '', entity: '', requestId: 0 };
activitySection.querySelector('#refreshActivity').addEventListener('click', () => void loadActivityLog(true));
activitySection.querySelector('#activitySearch').addEventListener('input', (event) => { activityState.search = event.target.value; activityState.page = 1; void loadActivityLog(); });
activitySection.querySelector('#activityEntity').addEventListener('change', (event) => { activityState.entity = event.target.value; activityState.page = 1; void loadActivityLog(); });
activitySection.querySelector('#activityPageSize').addEventListener('change', (event) => { activityState.pageSize = Number(event.target.value); activityState.page = 1; void loadActivityLog(); });
activitySection.querySelector('#activityPrevious').addEventListener('click', () => { if (activityState.page > 1) { activityState.page -= 1; void loadActivityLog(); } });
activitySection.querySelector('#activityNext').addEventListener('click', () => { activityState.page += 1; void loadActivityLog(); });
const views = { '#dashboard': ['dashboard'], '#orders': ['orders'], '#inventory': ['inventory'], '#customers': ['customers'], '#products': ['products'], '#users': ['users'], '#kyc': ['kyc'], '#performance': ['performance'], '#promotions': ['promotions'], '#categories': ['categories'], '#activity': ['activity'], '#settings': ['settings'], '#adminProfile': ['adminProfile'], '#adminNotifications': ['adminNotifications'], '#adminChat': ['adminChat'], '#adminReturns': ['adminReturns'] };
function switchView(hash) { if (hash === '#settingsDetails' && !canManageCommerceDefaults()) hash = '#settings'; const targetId = (views[hash] || views['#dashboard'])[0]; const dashboard = hash === '#dashboard'; const sections = document.querySelectorAll('.admin-main > section'); sections.forEach((section) => { section.hidden = !dashboard || Boolean(section.id); section.querySelectorAll(':scope > article').forEach((article) => { article.hidden = !dashboard; }); }); if (!dashboard) { const target = document.getElementById(targetId); if (target) { const parentSection = target.closest('.admin-main > section'); if (parentSection) parentSection.hidden = false; if (target.matches('article')) { target.hidden = false; parentSection?.querySelectorAll(':scope > article').forEach((article) => { if (article !== target) article.hidden = true; }); } else target.hidden = false; } } document.querySelectorAll('.admin-sidebar nav a').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === hash)); history.replaceState(null, '', hash); if (hash === '#activity') void loadActivityLog(); }
async function loadActivityLog(forceRefresh = false) { if (!apiToken) return; const list = document.querySelector('#activityList'); const refreshButton = document.querySelector('#refreshActivity'); if (!list) return; const requestId = ++activityState.requestId; if (refreshButton) { refreshButton.disabled = true; refreshButton.textContent = 'Refreshing...'; } try { const params = new URLSearchParams({ page: String(activityState.page), pageSize: String(activityState.pageSize) }); if (activityState.search.trim()) params.set('search', activityState.search.trim()); if (activityState.entity) params.set('entity', activityState.entity); if (forceRefresh) params.set('_', String(Date.now())); const response = await fetch(`${API_BASE}/api/v1/audit-logs?${params}`, { cache: 'no-store', headers: { Authorization: `Bearer ${apiToken}`, 'Cache-Control': 'no-cache' } }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Could not load activity log.'); if (requestId !== activityState.requestId) return; const logs = result.data || []; const pagination = result.pagination || { page: 1, pages: 1, total: logs.length }; if (activityState.page > pagination.pages) { activityState.page = pagination.pages; return loadActivityLog(forceRefresh); } list.innerHTML = logs.length ? logs.map((log) => `<article class="admin-list-row activity-log-row"><span><strong>${escapeHtml(log.message || 'Activity recorded.')}</strong><small>${escapeHtml(log.user?.email || 'System')} · ${new Date(log.createdAt).toLocaleString()}</small></span><b>${escapeHtml(log.user?.role || 'SYSTEM')}</b></article>`).join('') : '<p class="table-empty">No activity matches these filters.</p>'; document.querySelector('#activityPageLabel').textContent = `Page ${pagination.page} of ${pagination.pages} · ${pagination.total} events`; document.querySelector('#activityPrevious').disabled = pagination.page <= 1; document.querySelector('#activityNext').disabled = pagination.page >= pagination.pages; } catch (error) { if (requestId === activityState.requestId) list.innerHTML = `<p class="table-empty">${escapeHtml(error.message)}</p>`; } finally { if (refreshButton && requestId === activityState.requestId) { refreshButton.disabled = false; refreshButton.textContent = 'Refresh'; } } }
adminLoginForm.addEventListener('submit', async (event) => { event.preventDefault(); const submit = adminLoginForm.querySelector('button[type="submit"]'); submit.disabled = true; submit.querySelector('span').textContent = 'Signing in...'; document.querySelector('#adminLoginError').textContent = ''; try { const data = new FormData(adminLoginForm); const response = await fetch(`${API_BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.get('email'), password: data.get('password') }), signal: AbortSignal.timeout(8000) }); setConnectionStatus('online', 'Ground API connected'); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(response.status === 401 ? 'Email or password is incorrect.' : result.error || `Login failed (${response.status})`); if (!result.user?.role || result.user.role === 'CUSTOMER' || !result.token) throw new Error('This account does not have operations access.'); localStorage.setItem(adminTokenKey, result.token); localStorage.removeItem('ground-token'); localStorage.removeItem(clientTokenKey); location.reload(); } catch (error) { const message = error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError ? 'Cannot reach Ground API. Start the backend on port 4000, then retry.' : error.message; document.querySelector('#adminLoginError').textContent = message; if (message.includes('Cannot reach')) setConnectionStatus('offline', 'Ground API is offline'); } finally { submit.disabled = false; submit.querySelector('span').textContent = 'Enter workspace'; } });
async function loadAnalytics(days = 30) { if (!apiToken) return; const from = new Date(Date.now() - days * 86400000).toISOString(); try { const response = await fetch(`http://localhost:4000/api/v1/analytics/dashboard?from=${encodeURIComponent(from)}`, { headers: { Authorization: `Bearer ${apiToken}` } }); if (!response.ok) return; const { data } = await response.json(); const setText = (selector, value) => { const element = document.querySelector(selector); if (element) element.textContent = value; }; setText('#dashboardRevenue', formatMoney(data.revenue)); setText('#dashboardRevenueNote', `${data.orders} orders in period`); setText('#dashboardOrders', Number(data.orders || 0).toLocaleString('en-US')); setText('#dashboardOrdersNote', `${data.pendingOrders} currently pending`); setText('#dashboardCustomers', Number(data.customers || 0).toLocaleString('en-US')); setText('#dashboardCustomersNote', `${data.products} products in catalog`); setText('#dashboardAverage', formatMoney(data.averageOrderValue)); setText('#dashboardCompleted', Number(data.completedOrders || 0).toLocaleString('en-US')); setText('#dashboardCompletedNote', `${data.orders ? Math.round(data.completedOrders / data.orders * 100) : 0}% of period orders`); setText('#dashboardLowStock', Number(data.lowStockProducts || 0).toLocaleString('en-US')); setText('#dashboardStockNote', `${data.inventory?.available || 0} units available`); setText('#performanceRevenue', formatMoney(data.revenue)); setText('#performanceOrders', Number(data.orders || 0).toLocaleString('en-US')); setText('#performanceCustomers', Number(data.customers || 0).toLocaleString('en-US')); setText('#performanceAverage', formatMoney(data.averageOrderValue)); setText('#dashboardChartValue', `${formatMoney(data.revenue)} `); setText('#dashboardChartHeadline', data.revenue ? 'Revenue activity' : 'No revenue activity'); setText('#dashboardChartNote', `${data.completedOrders || 0} delivered orders in this period.`); const trend = data.revenueTrend || []; const maximum = Math.max(...trend.map((bucket) => Number(bucket.revenue || 0)), 1); const chart = document.querySelector('#revenueChart'); if (chart) chart.innerHTML = trend.map((bucket) => `<i style="height:${Math.max(4, Number(bucket.revenue || 0) / maximum * 100)}%" title="${bucket.label}: ${formatMoney(bucket.revenue)} · ${bucket.orders} orders"></i>`).join(''); const labelsNode = document.querySelector('#revenueChartLabels'); if (labelsNode) labelsNode.innerHTML = trend.filter((_, index) => index === 0 || index === Math.floor(trend.length / 2) || index === trend.length - 1).map((bucket) => `<span>${bucket.label}</span>`).join(''); const channels = data.channels || []; const channelOrders = channels.reduce((sum, channel) => sum + Number(channel.orders || 0), 0); setText('#salesChannelOrders', channelOrders.toLocaleString('en-US')); const colors = ['var(--lime)', 'var(--ink)', '#cfd5c7', '#9fbe43', '#aeb8a5']; const segments = []; let offset = 0; channels.forEach((channel, index) => { const share = Number(channel.share || 0); segments.push(`${colors[index % colors.length]} ${offset}% ${offset + share}%`); offset += share; }); const donut = document.querySelector('#salesChannelDonut'); if (donut) donut.style.background = segments.length ? `conic-gradient(${segments.join(', ')})` : 'var(--soft)'; const legend = document.querySelector('#salesChannelLegend'); if (legend) legend.innerHTML = channels.length ? channels.map((channel, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(channel.name)} <b>${channel.share}%</b></span>`).join('') : '<span>No channel sales in this period.</span>'; } catch { /* Static dashboard values remain available offline. */ } }
const openProductModal = (product = null) => { editingProductId = product ? product.id : null; productForm.reset(); productImageData = product?.image || ''; mediaPreview.innerHTML = product?.image ? `<img src="${product.image}" alt="Product preview">` : '<span>＋</span><small>Product image</small>'; if (product) { productForm.elements.name.value = product.name; productForm.elements.category.value = product.category; productForm.elements.price.value = product.price; productForm.elements.description.value = product.description || ''; productForm.elements.usage.value = product.usage || ''; productForm.elements.features.value = product.features || ''; productForm.elements.featured.checked = Boolean(product.featured); productForm.elements.stock.value = product.stock; productModal.querySelector('h2').textContent = 'Edit product'; productSubmit.innerHTML = 'Update product <span>↗</span>'; } else { productModal.querySelector('h2').textContent = 'Add a product'; productSubmit.innerHTML = 'Create product <span>↗</span>'; } productModal.classList.add('open'); productModal.setAttribute('aria-hidden', 'false'); requestAnimationFrame(fitProductTextareas); productForm.elements.name.focus(); };
const closeProductModal = () => { productModal.classList.remove('open'); productModal.setAttribute('aria-hidden', 'true'); };
productModal.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeProductModal(); });
document.addEventListener('pointerdown', (event) => {
  if (orderDetailModal.classList.contains('open') && !event.target.closest('#orderDetailModal')) closeOrderDetail();
  if (productDetailModal.classList.contains('open') && !event.target.closest('#productDetailModal')) closeProductDetail();
  if (userDetailModal.classList.contains('open') && !event.target.closest('#userDetailModal')) closeUserDetail();
  if (event.target.closest('.admin-modal, .admin-login-card')) return;
  if (productModal.classList.contains('open')) closeProductModal();
});
const sidebarToggle = document.querySelector('#sidebarToggle');
const mediumScreen = window.matchMedia('(min-width: 561px) and (max-width: 900px)');
const mobileAdminScreen = window.matchMedia('(max-width: 900px)');
const mobileSidebarToggle = document.createElement('button');
mobileSidebarToggle.className = 'admin-mobile-sidebar-toggle';
mobileSidebarToggle.type = 'button';
mobileSidebarToggle.setAttribute('aria-label', 'Open sidebar');
mobileSidebarToggle.setAttribute('aria-expanded', 'false');
mobileSidebarToggle.innerHTML = '<span></span><span></span><span></span>';
document.body.appendChild(mobileSidebarToggle);
const mobileAdminBrand = document.createElement('a');
mobileAdminBrand.className = 'admin-mobile-brand';
mobileAdminBrand.href = '#dashboard';
mobileAdminBrand.innerHTML = '<span></span><strong>Store</strong>';
document.body.appendChild(mobileAdminBrand);
void loadAdminBranding();
const mobileSidebarOverlay = document.createElement('div');
mobileSidebarOverlay.className = 'admin-sidebar-overlay';
document.body.appendChild(mobileSidebarOverlay);
const setMobileSidebar = (open) => {
  sidebar.classList.toggle('mobile-open', open);
  sidebar.style.setProperty('transition', 'none', 'important');
  sidebar.style.setProperty('transform', open ? 'translateX(0)' : '', 'important');
  mobileSidebarOverlay.classList.toggle('visible', open);
  mobileSidebarToggle.setAttribute('aria-expanded', String(open));
  mobileSidebarToggle.setAttribute('aria-label', open ? 'Close sidebar' : 'Open sidebar');
};
if (mediumScreen.matches) sidebar.classList.add('collapsed');
sidebarToggle?.addEventListener('click', () => {
  if (mobileAdminScreen.matches) {
    setMobileSidebar(!sidebar.classList.contains('mobile-open'));
    return;
  }
  const collapsed = sidebar.classList.toggle('collapsed');
  sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
});
mobileSidebarToggle.addEventListener('click', () => setMobileSidebar(!sidebar.classList.contains('mobile-open')));
mobileSidebarOverlay.addEventListener('click', () => setMobileSidebar(false));
document.querySelectorAll('.admin-sidebar nav a').forEach((link) => link.addEventListener('click', () => {
  if (mobileAdminScreen.matches) setMobileSidebar(false);
}));
document.addEventListener('click', (event) => {
  if (mobileAdminScreen.matches && event.target.closest('.admin-sidebar nav a')) setMobileSidebar(false);
});
mobileAdminScreen.addEventListener('change', (event) => {
  if (event.matches) setMobileSidebar(false);
});
document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => toggle.addEventListener('click', () => applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark')));
applyTheme();
document.querySelectorAll('.admin-sidebar nav a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); switchView(link.getAttribute('href')); }));
const logoutAdmin = () => { if (apiToken) void fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, keepalive: true }).catch(() => { }); localStorage.removeItem(adminTokenKey); localStorage.removeItem(clientTokenKey); localStorage.removeItem('ground-token'); location.href = 'index.html#top'; };
document.querySelector('#adminLogout').addEventListener('click', logoutAdmin);
document.querySelector('#headerLogout').addEventListener('click', logoutAdmin);
document.addEventListener('click', (event) => { const logoutButton = event.target.closest('#adminLogout, #headerLogout'); if (!logoutButton) return; event.preventDefault(); event.stopImmediatePropagation(); localStorage.removeItem(adminTokenKey); localStorage.removeItem(clientTokenKey); localStorage.removeItem('ground-token'); document.body.classList.remove('admin-authenticated'); window.location.replace(`${window.location.origin}/index.html#top`); }, true);
document.querySelectorAll('.admin-sidebar nav a').forEach((link) => { const label = link.querySelector('.nav-text')?.textContent?.trim(); if (label) link.title = label; });
const selectedMedia = [];
const productImageInput = document.querySelector('#productImage');
const productSubmit = document.querySelector('#productSubmit');
const fitProductTextareas = () => { productForm.querySelectorAll('textarea').forEach((textarea) => { textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight}px`; }); };
productForm.addEventListener('input', (event) => { if (event.target.matches('textarea')) { event.target.style.height = 'auto'; event.target.style.height = `${event.target.scrollHeight}px`; } });
productImageInput.multiple = true;
productImageInput.setAttribute('aria-label', 'Upload product images');
const nativeAdminFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => { const url = String(input); if (init.body && /\/api\/v1\/products(?:\/[^/]+)?$/.test(url)) { try { const payload = JSON.parse(init.body); payload.usage = productForm.elements.usage.value; payload.features = productForm.elements.features.value; payload.featured = productForm.elements.featured.checked; payload.categoryId = productForm.elements.category.selectedOptions[0]?.dataset.categoryId || undefined; init = { ...init, body: JSON.stringify(payload) }; } catch { /* Leave non-JSON requests unchanged. */ } } return nativeAdminFetch(input, init); };
productImageInput.addEventListener('change', (event) => { selectedMedia.length = 0;[...event.target.files].slice(0, 12).forEach((file) => { const reader = new FileReader(); reader.addEventListener('load', () => { selectedMedia.push({ name: file.name, file, data: reader.result }); mediaPreview.innerHTML = selectedMedia.map((image) => `<img src="${image.data}" alt="${image.name}">`).join(''); }); reader.readAsDataURL(file); }); });
async function uploadSelectedMedia() { if (!adminApiHeaders() || !selectedMedia.length) return []; const formData = new FormData(); selectedMedia.forEach((image) => formData.append('images', image.file, image.name)); const response = await fetch(`${API_BASE}/api/v1/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: formData }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `Image upload failed (${response.status})`); return result.data.map((image) => ({ ...image, url: image.url.startsWith('http') ? image.url : `${API_BASE}${image.url}` })); }
productForm.addEventListener('submit', async (event) => { event.preventDefault(); event.stopImmediatePropagation(); const data = new FormData(productForm); let product = { id: editingProductId || Date.now(), name: data.get('name'), category: data.get('category'), price: Number(data.get('price')), stock: Number(data.get('stock')), description: data.get('description'), usage: data.get('usage'), features: data.get('features'), image: selectedMedia[0]?.data || '', images: selectedMedia.map((image) => image.data) }; try { const uploadedImages = await uploadSelectedMedia(); const endpoint = editingProductId ? `${API_BASE}/api/v1/products/${editingProductId}` : `${API_BASE}/api/v1/products`; const payload = { name: product.name, slug: String(product.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), ...(editingProductId ? {} : { sku: `ADMIN-${Date.now()}` }), description: product.description, shortDescription: product.description, price: product.price, status: 'ACTIVE', images: uploadedImages, stock: product.stock }; if (!adminApiHeaders()) throw new Error('Sign in as an admin before saving products.'); const response = await fetch(endpoint, { method: editingProductId ? 'PATCH' : 'POST', headers: adminApiHeaders(), body: JSON.stringify(payload) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `Could not save product (${response.status})`); const serverProduct = result.data; product = { ...product, id: serverProduct.id, image: resolveMediaUrl(serverProduct.images?.[0]?.url || uploadedImages[0]?.url || product.image), images: serverProduct.images?.map((image) => resolveMediaUrl(image.url)) || uploadedImages.map((image) => resolveMediaUrl(image.url)) }; if (editingProductId) products = products.map((entry) => String(entry.id) === String(editingProductId) ? product : entry); else products.unshift(product); localStorage.setItem('ground-admin-products', JSON.stringify(products)); renderCatalog(); closeProductModal(); productForm.reset(); selectedMedia.length = 0; mediaPreview.innerHTML = '<span>＋</span><small>Product images</small>'; editingProductId = null; showToast('Product and image gallery saved.'); } catch (error) { showToast(error.message || 'Could not save product.'); } }, true);
document.querySelector('#productSearch').addEventListener('input', (event) => renderCatalog(event.target.value));
document.querySelector('#catalogAdd').addEventListener('click', () => openProductModal());
document.querySelectorAll('.switch').forEach((control) => control.addEventListener('click', async () => { const next = !control.classList.contains('active'); control.classList.toggle('active', next); const key = control.id === 'storeStatus' ? 'storeStatus' : 'lowStockAlerts'; if (!adminApiHeaders()) return; const response = await fetch(`${API_BASE}/api/v1/settings`, { method: 'PATCH', headers: adminApiHeaders(), body: JSON.stringify({ [key]: next }) }); if (!response.ok) { control.classList.toggle('active', !next); showToast('Could not save setting.'); } }));
document.querySelector('.admin-actions .ghost-button').addEventListener('click', () => { switchView('#products'); document.querySelector('#productSearch').focus(); });
document.querySelectorAll('.admin-actions .ghost-button')[1].addEventListener('click', () => switchView('#orders'));
analyticsRange.addEventListener('change', (event) => { const selectedDays = Number(event.target.value) || [30, 7, 365][event.target.selectedIndex] || 30; loadAnalytics(selectedDays); });
document.querySelector('#orderFilter').addEventListener('change', () => { ordersPage = 1; renderOrdersPage(); });
ordersBody.addEventListener('change', async (event) => { const select = event.target.closest('.status-select'); if (!select) return; const row = select.closest('tr'); const previousStatus = row.dataset.orderStatus || select.dataset.previousStatus || select.value; const status = select.value; if (adminApiHeaders()) { const response = await fetch(`http://localhost:4000/api/v1/orders/${select.dataset.order}/status`, { method: 'PATCH', headers: adminApiHeaders(), body: JSON.stringify({ status: status.toUpperCase() }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { select.value = previousStatus; select.className = `status-select ${previousStatus}`; showToast(result.error || result.message || 'Could not update order in the API.', 'error'); return; } } row.dataset.orderStatus = status; select.dataset.previousStatus = status; select.className = `status-select ${status}`; const stored = JSON.parse(localStorage.getItem('ground-order-statuses') || '{}'); stored[select.dataset.order] = status; localStorage.setItem('ground-order-statuses', JSON.stringify(stored)); const targetOrder = adminOrders.find((order) => order.orderNumber === select.dataset.order); if (targetOrder) targetOrder.status = status.toUpperCase(); renderAttentionOrders(); showToast(`Order #${select.dataset.order} marked ${status}.`); });
addProduct.addEventListener('click', () => openProductModal());
document.querySelector('#productModalClose').addEventListener('click', closeProductModal);
document.querySelector('#productDetailClose').addEventListener('click', closeProductDetail);
document.querySelector('#orderDetailClose').addEventListener('click', closeOrderDetail);
document.querySelector('#userDetailClose').addEventListener('click', closeUserDetail);
document.querySelector('#kycDocumentClose').addEventListener('click', closeKycDocument);
orderDetailModal.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeOrderDetail(); });
productDetailModal.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeProductDetail(); });
userDetailModal.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeUserDetail(); });
productForm.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(productForm); let product = { id: editingProductId || Date.now(), name: data.get('name'), category: data.get('category'), price: Number(data.get('price')), stock: Number(data.get('stock')), description: data.get('description'), usage: data.get('usage'), features: data.get('features'), image: productImageData }; if (adminApiHeaders()) { const endpoint = editingProductId ? `http://localhost:4000/api/v1/products/${editingProductId}` : 'http://localhost:4000/api/v1/products'; const payload = { name: product.name, slug: String(product.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), sku: editingProductId ? undefined : `ADMIN-${Date.now()}`, description: product.description, shortDescription: product.description, price: product.price, status: 'ACTIVE', images: product.image ? [{ url: product.image, altText: product.name }] : [], stock: product.stock }; const response = await fetch(endpoint, { method: editingProductId ? 'PATCH' : 'POST', headers: adminApiHeaders(), body: JSON.stringify(payload) }); if (!response.ok) { toast.textContent = 'Could not save product to the API.'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); return; } const saved = await response.json(); const serverProduct = saved.data; product = { id: serverProduct.id, name: serverProduct.name, category: serverProduct.category?.name || product.category, price: Number(serverProduct.price), stock: serverProduct.inventory?.available ?? product.stock, description: serverProduct.description || product.description, usage: product.usage, features: product.features, image: serverProduct.images?.[0]?.url || product.image }; } if (editingProductId) products = products.map((entry) => String(entry.id) === String(editingProductId) ? product : entry); else products.unshift(product); localStorage.setItem('ground-admin-products', JSON.stringify(products)); renderCatalog(); closeProductModal(); productForm.reset(); productImageData = ''; mediaPreview.innerHTML = '<span>＋</span><small>Product image</small>'; toast.textContent = editingProductId ? 'Product updated.' : 'Product added to catalog.'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); editingProductId = null; });
function renderCatalog(search = '') { const filtered = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase())); productCatalog.innerHTML = filtered.map((product) => `<article class="catalog-card"><div class="catalog-image">${product.image ? `<img src="${product.image}" alt="${product.name}">` : '<span>G</span>'}</div><div class="catalog-card-copy"><div><h3>${product.name}</h3><small>${product.category}</small></div><strong>$${product.price.toLocaleString('en-US')}</strong><p>${product.description || 'No description added yet.'}</p><div class="catalog-meta"><span>${product.stock} in stock</span><span>SKU-${String(product.id).slice(-4)}</span></div><div class="catalog-actions"><button data-edit-product="${product.id}">Edit</button><button data-delete-product="${product.id}">Delete</button></div></div></article>`).join(''); catalogEmpty.hidden = filtered.length > 0; }
productCatalog.addEventListener('click', async (event) => { const edit = event.target.closest('[data-edit-product]'); const remove = event.target.closest('[data-delete-product]'); if (edit) openProductModal(products.find((product) => String(product.id) === String(edit.dataset.editProduct))); if (remove) { const id = remove.dataset.deleteProduct; if (adminApiHeaders() && typeof id === 'string' && !/^\d+$/.test(id)) { const response = await fetch(`http://localhost:4000/api/v1/products/${id}`, { method: 'DELETE', headers: adminApiHeaders() }); if (!response.ok) { showToast('Could not archive product in the API.', 'error'); return; } } products = products.filter((product) => String(product.id) !== String(id)); localStorage.setItem('ground-admin-products', JSON.stringify(products)); renderCatalog(document.querySelector('#productSearch').value); showToast('Product removed from catalog.'); } });
function renderCatalog(search = '') { const filtered = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase())); productCatalog.innerHTML = filtered.map((product) => { const images = (product.images?.length ? product.images : (product.image ? [product.image] : [])).map(resolveMediaUrl).filter(Boolean); return `<article class="catalog-card" data-product-id="${product.id}"><div class="catalog-image">${images.length ? `<div class="catalog-gallery">${images.map((image, index) => `<img src="${image}" alt="${product.name} image ${index + 1}" loading="lazy">`).join('')}</div>` : '<span>G</span>'}</div><div class="catalog-card-copy"><div><h3>${product.name}</h3><small>${product.category || 'Uncategorized'}</small></div><strong>${formatMoney(product.price)}</strong><p>${product.description || 'No description added yet.'}</p><div class="catalog-meta"><span>${product.stock ?? 0} in stock</span><span>${images.length} image${images.length === 1 ? '' : 's'}</span></div><div class="catalog-actions"><button type="button" data-edit-product="${product.id}">Edit</button><button type="button" data-delete-product="${product.id}">Delete</button></div></div></article>`; }).join(''); catalogEmpty.hidden = filtered.length > 0; }
async function loadServerProducts() { if (!adminApiHeaders()) return; try { const response = await fetch(`${API_BASE}/api/v1/products?status=ALL&take=100`, { headers: adminApiHeaders() }); if (!response.ok) return; const payload = await response.json(); products = payload.data.map((item) => ({ id: item.id, name: item.name, category: item.category?.name || 'Objects', price: Number(item.price), stock: item.inventory?.available || 0, description: item.description || item.shortDescription || '', usage: item.usage || '', features: item.features || '', featured: Boolean(item.featured), image: resolveMediaUrl(item.images?.[0]?.url), images: item.images?.map((image) => resolveMediaUrl(image.url)) || [] })); localStorage.setItem('ground-admin-products', JSON.stringify(products)); renderCatalog(); } catch { /* Keep local catalog fallback when the API is offline. */ } }
async function loadProductTextFields() { if (!adminApiHeaders()) return; try { const response = await fetch(`${API_BASE}/api/v1/products?status=ACTIVE&take=100`, { headers: adminApiHeaders() }); if (!response.ok) return; const payload = await response.json(); payload.data.forEach((item) => { const product = products.find((entry) => String(entry.id) === String(item.id)); if (!product) return; product.usage = item.usage || ''; product.features = item.features || ''; }); localStorage.setItem('ground-admin-products', JSON.stringify(products)); } catch { /* Keep the catalog available when the API is offline. */ } }
renderCatalog();
loadAnalytics();
ensureAdminSession();
async function loadCategories() { const select = document.querySelector('#productCategory'); if (!select) return; try { const response = await fetch(`${API_BASE}/api/v1/catalog/categories`); const result = await response.json(); select.innerHTML = result.data.map((category) => `<option value="${category.name}" data-category-id="${category.id}">${category.name}</option>`).join(''); } catch { select.innerHTML = '<option>Objects</option><option>Wear</option><option>Home</option>'; } }
async function sweetInput(title, inputLabel, inputValue = '') { if (!window.Swal) return null; const result = await window.Swal.fire({ title, input: 'text', inputLabel, inputValue, showCancelButton: true, confirmButtonText: 'Continue', inputValidator: (value) => value?.trim() ? undefined : 'This field is required.' }); return result.isConfirmed ? result.value.trim() : null; }
async function editCoupon(coupon = null) {
  if (!window.Swal) { showToast('Coupon dialog could not be opened.', 'error'); return; }
  const editing = Boolean(coupon?.id);
  const values = coupon || { code: '', type: 'PERCENTAGE', value: '', minimumOrder: '', maximumDiscount: '', expiresAt: '', published: false, active: true };
  const result = await window.Swal.fire({
    title: editing ? 'Edit coupon' : 'Create coupon',
    html: `<div class="swal-form-grid">
      <label class="swal-field swal-field-wide">Coupon code<input id="swalCouponCode" value="${escapeHtml(values.code || '')}" autocomplete="off"></label>
      <label class="swal-field">Discount type<select id="swalCouponType"><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option><option value="FREE_SHIPPING">Free shipping</option></select></label>
      <label class="swal-field">Value<input id="swalCouponValue" type="number" min="0" step="0.01" value="${values.value === '' || values.value === undefined || values.value === null ? '' : Number(values.value)}"></label>
      <label class="swal-field">Minimum order<input id="swalCouponMinimum" type="number" min="0" step="0.01" value="${values.minimumOrder ?? ''}"></label>
      <label class="swal-field">Maximum discount<input id="swalCouponMaximum" type="number" min="0" step="0.01" value="${values.maximumDiscount ?? ''}"></label>
      <label class="swal-field swal-field-wide">Expiration date<input id="swalCouponExpiry" type="date" value="${values.expiresAt ? new Date(values.expiresAt).toISOString().slice(0, 10) : ''}"><small>Leave blank for no expiration.</small></label>
      <label class="swal-field swal-field-wide" style="display:flex;gap:10px;align-items:flex-start;"><input id="swalCouponPublished" type="checkbox" ${values.published ? 'checked' : ''} style="width:auto;margin-top:4px;"><span><strong style="display:block;font-size:13px;">Publish to customers</strong><small>Show this coupon on the client page while it is active and valid.</small></span></label>
    </div>`,
    didOpen: () => { const type = document.querySelector('#swalCouponType'); if (type) type.value = values.type || 'PERCENTAGE'; },
    showCancelButton: true,
    confirmButtonText: editing ? 'Save changes' : 'Create coupon',
    cancelButtonText: 'Cancel',
    buttonsStyling: false,
    customClass: { popup: 'admin-swal-popup', confirmButton: 'admin-swal-confirm', cancelButton: 'admin-swal-cancel' },
    preConfirm: () => {
      const code = String(document.querySelector('#swalCouponCode')?.value || '').trim().toUpperCase();
      const type = String(document.querySelector('#swalCouponType')?.value || 'PERCENTAGE');
      const rawValue = String(document.querySelector('#swalCouponValue')?.value ?? '').trim();
      const value = rawValue === '' ? 0 : Number(rawValue);
      const minRaw = String(document.querySelector('#swalCouponMinimum')?.value ?? '').trim();
      const maxRaw = String(document.querySelector('#swalCouponMaximum')?.value ?? '').trim();
      const expiryRaw = String(document.querySelector('#swalCouponExpiry')?.value ?? '').trim();
      if (!code || !/^[A-Z0-9_-]+$/.test(code)) { window.Swal.showValidationMessage('Enter a valid coupon code using letters, numbers, _ or -.'); return null; }
      if (!Number.isFinite(value) || value < 0 || (type === 'PERCENTAGE' && value > 100)) { window.Swal.showValidationMessage('Enter a valid discount value.'); return null; }
      return {
        code,
        type,
        value,
        minimumOrder: minRaw === '' ? undefined : Number(minRaw),
        maximumDiscount: maxRaw === '' ? undefined : Number(maxRaw),
        expiresAt: expiryRaw === '' ? undefined : expiryRaw,
        active: true,
        published: Boolean(document.querySelector('#swalCouponPublished')?.checked)
      };
    }
  });
  if (!result.isConfirmed || !result.value) return;
  try {
    await adminJson(editing ? `/api/v1/coupons/${coupon.id}` : '/api/v1/coupons', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(result.value) });
    await loadCoupons();
    showToast(editing ? 'Coupon updated.' : 'Coupon created.');
  } catch (error) {
    console.error('Coupon save failed', error);
    showToast(error?.message || 'Coupon could not be saved.', 'error');
  }
}
document.querySelector('#addCategory').addEventListener('click', async () => { const name = await sweetInput('Add category', 'Category name'); if (!name || !adminApiHeaders()) return; const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); const response = await fetch(`${API_BASE}/api/v1/catalog/categories`, { method: 'POST', headers: adminApiHeaders(), body: JSON.stringify({ name, slug }) }); const result = await response.json().catch(() => ({})); if (!response.ok) return showToast(result.error || 'Could not add category.', 'error'); await loadCategories(); document.querySelector('#productCategory').value = name; showToast('Category added.'); });
async function loadSettings() { if (!roleCanAccess('settings.update') || !adminApiHeaders()) return; try { const response = await fetch(`${API_BASE}/api/v1/settings`, { headers: adminApiHeaders() }); if (!response.ok) return; const result = await response.json(); document.querySelector('#storeStatus').classList.toggle('active', result.data.storeStatus); document.querySelector('#lowStockAlerts').classList.toggle('active', result.data.lowStockAlerts); } catch { /* Static defaults remain visible. */ } }
function renderAdminLoginFeature() { const product = products.find((entry) => entry.featured && entry.image) || products.find((entry) => entry.image); const visual = document.querySelector('.login-visual'); const title = document.querySelector('#adminLoginFeatureTitle') || visual?.querySelector('h2'); if (!visual || !product?.image) return; visual.classList.add('has-featured-image'); visual.style.setProperty('--login-featured-image', `url("${product.image.replaceAll('"', '%22')}")`); if (title) title.textContent = product.name; }
async function loadPublicLoginFeature() { try { const response = await fetch(`${API_BASE}/api/v1/products?status=ACTIVE&take=100`); if (!response.ok) return; const payload = await response.json(); const publicProducts = (payload.data || []).map((item) => ({ name: item.name, featured: Boolean(item.featured), image: item.images?.[0]?.url || '' })); const featuredProduct = publicProducts.find((product) => product.featured && product.image) || publicProducts.find((product) => product.image); if (!featuredProduct) return; const previousProducts = products; products = featuredProduct ? [featuredProduct, ...products] : products; renderAdminLoginFeature(); products = previousProducts; } catch { /* Keep the text fallback when the public catalog is unavailable. */ } }
void loadPublicLoginFeature();
loadServerProducts().then(async () => { await loadProductTextFields(); renderAdminLoginFeature(); });
loadServerOrders();
async function refreshAdminOperationalData() {
  await Promise.allSettled([loadServerProducts(), loadServerOrders(), typeof loadInventory === 'function' ? loadInventory() : Promise.resolve()]);
  enforceStaffCatalogRestrictions();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshAdminOperationalData(); });
window.addEventListener('focus', () => { void refreshAdminOperationalData(); });
setInterval(() => { if (!document.hidden) void refreshAdminOperationalData(); }, 15000);
loadCategories();
loadSettings();
productCatalog.addEventListener('error', (event) => { const image = event.target.closest('.catalog-gallery img'); if (!image) return; const box = image.closest('.catalog-image'); image.remove(); box?.classList.add('image-failed'); }, true);
productCatalog.addEventListener('click', (event) => { const image = event.target.closest('.catalog-gallery img'); if (!image) return; image.classList.toggle('zoomed'); });
productCatalog.addEventListener('click', (event) => { if (event.target.closest('button, .catalog-gallery')) return; const card = event.target.closest('[data-product-id]'); if (card) openProductDetail(products.find((product) => String(product.id) === String(card.dataset.productId))); });
Object.assign(views, { '#performance': ['performance'], '#promotions': ['promotions'], '#categories': ['categories'], '#settingsDetails': ['settingsDetails'], '#adminNotifications': ['adminNotifications'], '#adminChat': ['adminChat'], '#adminReturns': ['adminReturns'], '#users': ['users'], '#kyc': ['kyc'], '#adminProfile': ['adminProfile'] });
switchView(location.hash || '#dashboard');
async function adminJson(path, options = {}) { if (!adminApiHeaders()) return null; const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...adminApiHeaders(), ...(options.headers || {}) } }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`); return result; }
async function loadPerformance(days = 30) { try { const result = await adminJson(`/api/v1/analytics/dashboard?from=${encodeURIComponent(new Date(Date.now() - days * 86400000).toISOString())}`); if (!result) return; const data = result.data; document.querySelector('#performanceRevenue').textContent = formatMoney(data.revenue); document.querySelector('#performanceOrders').textContent = Number(data.orders || 0).toLocaleString('en-US'); document.querySelector('#performanceCustomers').textContent = Number(data.customers || 0).toLocaleString('en-US'); document.querySelector('#performanceAverage').textContent = formatMoney(data.averageOrderValue); document.querySelector('#topProducts').innerHTML = data.topProducts?.length ? data.topProducts.map((product) => `<div class="admin-list-row"><span><strong>${product.name}</strong><small>${product.units} units sold</small></span><b>${formatMoney(product.revenue)}</b></div>`).join('') : '<p class="table-empty">No sales in this period.</p>'; } catch (error) { showToast(error.message); } }
let couponCountdownTimer = null;
function formatCouponCountdown(milliseconds) { const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000)); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; return `${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`; }
function updateCouponCountdowns() { const now = Date.now(); let expired = false; document.querySelectorAll('[data-coupon-expires]').forEach((element) => { const remaining = Number(element.dataset.couponExpires) - now; if (remaining <= 0) { expired = true; return; } element.textContent = ` · expires in ${formatCouponCountdown(remaining)}`; }); if (expired) { clearInterval(couponCountdownTimer); couponCountdownTimer = null; void loadCoupons(); } }
async function loadCoupons() {
  if (!roleCanAccess('coupons.read')) return;
  clearInterval(couponCountdownTimer);
  couponCountdownTimer = null;
  try {
    const result = await adminJson('/api/v1/coupons');
    if (!result) return;
    const coupons = result.data || [];
    const canManage = ['ADMIN', 'SUPER_ADMIN'].includes(currentAdminRole);
    const now = Date.now();
    document.querySelector('#couponCount').textContent = `${coupons.filter((coupon) => coupon.active && !(coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now)).length} active`;
    document.querySelector('#couponList').innerHTML = coupons.length ? coupons.map((coupon) => {
      const expiry = coupon.expiresAt ? new Date(coupon.expiresAt).getTime() : 0;
      const expired = Boolean(expiry && expiry < now);
      const status = expired ? 'Expired' : coupon.active ? 'Active' : 'Inactive';
      const statusClass = expired ? 'list-expired' : coupon.active ? 'list-active' : '';
      const countdown = coupon.active && expiry > now ? `<span class="coupon-countdown" data-coupon-expires="${expiry}">Expires in ${formatCouponCountdown(expiry - now)}</span>` : '';
      const published = Boolean(coupon.published) && !expired && coupon.active;
      return `<div class="admin-list-row ${expired ? 'coupon-expired' : ''}"><span><strong>${escapeHtml(coupon.code)}</strong><small>${escapeHtml(coupon.type.replaceAll('_', ' '))} · ${coupon.value}${coupon.type === 'PERCENTAGE' ? '%' : ''}${coupon.expiresAt ? ` · expires ${new Date(coupon.expiresAt).toLocaleDateString()}` : ''}${published ? ' · <b class="list-active">Published</b>' : ''}${countdown ? ` ${countdown}` : ''}</small></span><span class="list-actions"><b class="${statusClass}">${status}</b>${canManage ? `<button type="button" class="icon-action" data-publish-coupon="${coupon.id}" data-published="${published ? 'true' : 'false'}" aria-label="${published ? 'Unpublish' : 'Publish'} ${escapeHtml(coupon.code)}" title="${published ? 'Unpublish from client page' : 'Publish to client page'}" ${expired || !coupon.active ? 'disabled' : ''}>${published ? '◉' : '○'}</button><button type="button" class="icon-action" data-edit-coupon="${coupon.id}" aria-label="Edit ${escapeHtml(coupon.code)}" title="Edit coupon" ${expired ? 'disabled' : ''}>✎</button><button type="button" class="icon-action" data-delete-coupon="${coupon.id}" aria-label="Delete ${escapeHtml(coupon.code)}" title="Delete coupon" ${expired ? 'disabled' : ''}>×</button>` : ''}</span></div>`;
    }).join('') : '<p class="table-empty">No coupons created yet.</p>';
    if (coupons.some((coupon) => coupon.active && coupon.expiresAt && new Date(coupon.expiresAt).getTime() > now)) couponCountdownTimer = setInterval(updateCouponCountdowns, 1000);
  } catch (error) { showToast(error.message, 'error'); }
}
async function editCategory(category) { if (!window.Swal || !category) return; const result = await window.Swal.fire({ title: 'Edit category', customClass: { popup: 'admin-swal-popup' }, html: `<div class="swal-form-grid"><label class="swal-field swal-field-wide">Category name<input id="swalCategoryName" value="${escapeHtml(category.name)}" autocomplete="off"></label><label class="swal-field swal-field-wide">Category slug<input id="swalCategorySlug" value="${escapeHtml(category.slug)}" autocomplete="off"><small>Use lowercase letters, numbers, and hyphens.</small></label></div>`, showCancelButton: true, confirmButtonText: 'Save changes', cancelButtonText: 'Cancel', buttonsStyling: false, customClass: { popup: 'admin-swal-popup', confirmButton: 'admin-swal-confirm', cancelButton: 'admin-swal-cancel' }, preConfirm: () => { const name = document.querySelector('#swalCategoryName').value.trim(); const slug = document.querySelector('#swalCategorySlug').value.trim().toLowerCase(); if (name.length < 2 || !/^[a-z0-9-]+$/.test(slug)) { window.Swal.showValidationMessage('Enter a valid name and lowercase slug.'); return null; } return { name, slug }; } }); if (!result.isConfirmed || !result.value) return; try { await adminJson(`/api/v1/catalog/categories/${category.id}`, { method: 'PATCH', body: JSON.stringify(result.value) }); await loadAdminCategories(); await loadCategories(); showToast('Category updated.'); } catch (error) { showToast(error.message, 'error'); } }
async function loadAdminCategories() { if (!roleCanAccess('products.update')) return; try { const response = await fetch(`${API_BASE}/api/v1/catalog/categories`); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not load categories'); const categories = result.data || []; document.querySelector('#categoryCount').textContent = `${categories.length} categories`; document.querySelector('#categoryList').innerHTML = categories.length ? categories.map((category) => `<div class="admin-list-row"><span><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(category.slug)}</small></span><span class="list-actions"><b>${category._count?.products || 0} products</b><button type="button" class="icon-action" data-edit-category="${category.id}" data-category="${encodeURIComponent(JSON.stringify({ id: category.id, name: category.name, slug: category.slug }))}" aria-label="Edit ${escapeHtml(category.name)}" title="Edit category">✎</button></span></div>`).join('') : '<p class="table-empty">No categories created yet.</p>'; } catch (error) { showToast(error.message, 'error'); } }
function refreshCurrencyDisplays() { document.querySelectorAll('.metric-card strong').forEach((element, index) => { if (index !== 0 && index !== 3) return; const value = Number(element.textContent.replace(/[^0-9.-]/g, '')); if (Number.isFinite(value)) element.textContent = formatMoney(value); }); const chartValue = document.querySelector('.chart-value'); if (chartValue) { const value = Number(chartValue.firstChild.textContent.replace(/[^0-9.-]/g, '')); if (Number.isFinite(value)) chartValue.firstChild.textContent = `${formatMoney(value)} `; } ['#performanceRevenue', '#performanceAverage', '#customerLifetimeValue'].forEach((selector) => { const element = document.querySelector(selector); if (!element) return; const value = Number(element.textContent.replace(/[^0-9.-]/g, '')); if (Number.isFinite(value)) element.textContent = formatMoney(value); }); document.querySelectorAll('#ordersBody tr').forEach((row) => { const total = row.cells[3]; if (!total) return; const value = Number(total.textContent.replace(/[^0-9.-]/g, '')); if (Number.isFinite(value)) total.textContent = formatMoney(value); }); document.querySelectorAll('#topProducts b').forEach((element) => { const value = Number(element.textContent.replace(/[^0-9.-]/g, '')); if (Number.isFinite(value)) element.textContent = formatMoney(value); }); const detailTotal = document.querySelector('.order-detail-summary > div:nth-child(3) strong'); if (detailTotal) { const value = Number(detailTotal.textContent.replace(/[^0-9.-]/g, '')); if (Number.isFinite(value)) detailTotal.textContent = formatMoney(value); } }
async function loadFullSettings() { if (!canManageCommerceDefaults() || !roleCanAccess('settings.update')) return; try { const result = await adminJson('/api/v1/settings'); if (!result) return; currencyCode = String(result.data.defaultCurrency || 'USD').toUpperCase(); inventoryThreshold = Number(result.data.lowStockThreshold ?? 10); const form = document.querySelector('#settingsForm'); Object.entries(result.data).forEach(([key, value]) => { const field = form.elements[key]; if (!field) return; if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = value ?? ''; }); renderPaymentGateways(Array.isArray(result.data.paymentGateways) ? result.data.paymentGateways : gatewayDefaults); renderTaxCountries(Array.isArray(result.data.taxCountries) ? result.data.taxCountries : defaultTaxCountries); syncTaxRateVisibility(); document.querySelectorAll('.inventory-stock').forEach((element) => { const available = Number.parseInt(element.textContent, 10) || 0; element.classList.toggle('low', available <= inventoryThreshold); }); await loadServerOrders(); await loadPerformance(Number(document.querySelector('#performanceRange')?.value || 30)); refreshCurrencyDisplays(); } catch (error) { showToast(error.message); } }
document.querySelector('#performanceRange').addEventListener('change', (event) => loadPerformance(Number(event.target.value)));
document.querySelector('#createCouponButton').addEventListener('click', () => { if (!['ADMIN', 'SUPER_ADMIN'].includes(currentAdminRole)) return showToast('Only administrators can create or manage coupons.', 'warning'); void editCoupon(); });
document.querySelector('#couponList').addEventListener('click', async (event) => {
  const publish = event.target.closest('[data-publish-coupon]');
  const edit = event.target.closest('[data-edit-coupon]');
  const remove = event.target.closest('[data-delete-coupon]');
  const id = publish?.dataset.publishCoupon || edit?.dataset.editCoupon || remove?.dataset.deleteCoupon;
  if (!id) return;
  if (publish) {
    const nextPublished = publish.dataset.published !== 'true';
    try {
      await adminJson(`/api/v1/coupons/${id}`, { method: 'PATCH', body: JSON.stringify({ published: nextPublished }) });
      await loadCoupons();
      showToast(nextPublished ? 'Coupon published to customers.' : 'Coupon unpublished.');
    } catch (error) { showToast(error.message, 'error'); }
    return;
  }
  if (remove) {
    try { await adminJson(`/api/v1/coupons/${id}`, { method: 'DELETE' }); await loadCoupons(); showToast('Coupon archived.'); } catch (error) { showToast(error.message, 'error'); }
    return;
  }
  const result = await adminJson('/api/v1/coupons');
  const coupon = result?.data?.find((entry) => String(entry.id) === String(id));
  await editCoupon(coupon);
});
document.querySelector('#categoryForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.target); try { await adminJson('/api/v1/catalog/categories', { method: 'POST', body: JSON.stringify({ name: data.get('name'), slug: data.get('slug'), active: true }) }); event.target.reset(); await loadAdminCategories(); await loadCategories(); showToast('Category created.'); } catch (error) { showToast(error.message, 'error'); } });
document.querySelector('#categoryList').addEventListener('click', async (event) => { const button = event.target.closest('[data-edit-category]'); if (!button) return; try { await editCategory(JSON.parse(decodeURIComponent(button.dataset.category))); } catch (error) { showToast(error.message, 'error'); } });
const taxEnabledInput = document.querySelector('#settingsForm input[name="taxEnabled"]');
const taxRateFields = document.querySelector('#taxRateFields');
const taxCountryList = document.querySelector('#taxCountryList');
const defaultTaxCountries = [{ code: 'GH', name: 'Ghana', rate: 15 }, { code: 'US', name: 'United States', rate: 0 }, { code: 'GB', name: 'United Kingdom', rate: 20 }];
const settingsForm = document.querySelector('#settingsForm');
function setupSettingsTabs() {
  if (!settingsForm || settingsForm.dataset.tabsReady) return;
  settingsForm.dataset.tabsReady = 'true';
  const tabBar = document.createElement('div');
  tabBar.className = 'settings-tabs';
  tabBar.setAttribute('role', 'tablist');
  const panels = {
    branding: document.createElement('div'),
    payment: document.createElement('div'),
    countries: document.createElement('div')
  };
  Object.entries(panels).forEach(([name, panel]) => { panel.className = `settings-tab-panel settings-tab-panel-${name}`; panel.dataset.settingsPanel = name; panel.hidden = name !== 'branding'; });
  const definitions = [['branding', 'Branding', 'fa-palette'], ['payment', 'Payment gateways', 'fa-credit-card'], ['countries', 'Countries supported', 'fa-earth-americas']];
  definitions.forEach(([name, label, icon], index) => { const button = document.createElement('button'); button.type = 'button'; button.className = `settings-tab${index === 0 ? ' active' : ''}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', index === 0 ? 'true' : 'false'); button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>`; button.addEventListener('click', () => { definitions.forEach(([tabName]) => { const tab = tabBar.querySelector(`[data-settings-tab="${tabName}"]`); const panel = panels[tabName]; tab?.classList.toggle('active', tabName === name); tab?.setAttribute('aria-selected', tabName === name ? 'true' : 'false'); panel.hidden = tabName !== name; }); }); button.dataset.settingsTab = name; tabBar.appendChild(button); });
  const saveButton = settingsForm.querySelector('.primary-button[type="submit"]');
  if (saveButton && !saveButton.querySelector('i')) saveButton.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>');
  const groups = [...settingsForm.children].filter((group) => group !== saveButton);
  groups.forEach((group) => { const fields = [...group.querySelectorAll('input, select')]; const names = fields.map((field) => field.name); const target = names.some((name) => ['paymentProvider', 'defaultShippingRate', 'paystackPublicKey', 'paystackSecretKey'].includes(name)) ? panels.payment : names.some((name) => ['taxEnabled', 'taxRateGH', 'taxRateUS', 'taxRateGB', 'taxCountryCode', 'taxCountryName', 'taxCountryRate'].includes(name)) || group.id === 'taxCountryList' || group.classList.contains('tax-country-settings') ? panels.countries : panels.branding; target.appendChild(group); });
  settingsForm.prepend(tabBar);
  const actionBar = document.createElement('div');
  actionBar.className = 'settings-action-bar';
  if (saveButton) actionBar.appendChild(saveButton);
  settingsForm.prepend(actionBar);
  Object.values(panels).forEach((panel) => settingsForm.appendChild(panel));
}
function setupLogoUploader() {
  const logoField = settingsForm?.querySelector('input[name="storeLogo"]');
  if (!logoField || logoField.dataset.uploadReady) return;
  logoField.dataset.uploadReady = 'true';
  const logoLabel = logoField.closest('label');
  if (logoLabel?.firstChild) logoLabel.firstChild.textContent = 'Store logo';
  const logoHelp = logoLabel?.querySelector('small');
  if (logoHelp) logoHelp.textContent = 'Upload a JPG, PNG, WEBP, or GIF logo. A preview appears after upload.';
  const hiddenLogo = document.createElement('input'); hiddenLogo.type = 'hidden'; hiddenLogo.name = 'storeLogo'; hiddenLogo.value = logoField.value || '';
  const upload = document.createElement('input'); upload.type = 'file'; upload.accept = 'image/jpeg,image/png,image/webp,image/gif'; upload.name = 'storeLogoFile'; upload.className = 'store-logo-file';
  const preview = document.createElement('div'); preview.className = 'store-logo-preview';
  const renderPreview = (src) => { preview.innerHTML = src ? `<img src="${escapeHtml(src)}" alt="Store logo preview"><span>Logo preview</span>` : '<span>No logo selected</span>'; };
  logoField.type = 'text'; logoField.name = 'storeLogoDisplay'; logoField.readOnly = true; logoField.hidden = true; logoField.removeAttribute('required'); logoField.parentElement?.append(upload, preview); logoField.parentElement?.append(hiddenLogo); renderPreview(hiddenLogo.value);
  upload.addEventListener('change', async () => { const file = upload.files?.[0]; if (!file) return; const formData = new FormData(); formData.append('images', file); try { const response = await fetch(`${API_BASE}/api/v1/media/upload`, { method: 'POST', headers: { Authorization: adminApiHeaders()?.Authorization || '' }, body: formData }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Could not upload store logo.'); const url = result.data?.[0]?.url || ''; hiddenLogo.value = url.startsWith('http') ? url : `${API_BASE}${url}`; renderPreview(hiddenLogo.value); showToast('Store logo uploaded.'); } catch (error) { upload.value = ''; showToast(error.message); } });
}
setupSettingsTabs();
settingsForm?.querySelectorAll('input[type="color"]').forEach((input) => input.addEventListener('input', () => {
  window.applyBrandColors({
    brandPrimaryColor: settingsForm.elements.brandPrimaryColor.value,
    brandAccentColor: settingsForm.elements.brandAccentColor.value
  });
}));
setupLogoUploader();
const paymentPanel = document.querySelector('[data-settings-panel="payment"]');
const legacyPaymentProvider = settingsForm?.querySelector('[name="paymentProvider"]');
const legacyPaystackPublic = settingsForm?.querySelector('[name="paystackPublicKey"]');
const legacyPaystackSecret = settingsForm?.querySelector('[name="paystackSecretKey"]');
[legacyPaymentProvider, legacyPaystackPublic, legacyPaystackSecret].forEach((field) => field?.closest('.admin-field-grid')?.remove());
const legacyTaxFields = document.querySelector('#taxRateFields');
legacyTaxFields?.remove();
const gatewayList = document.querySelector('#paymentGatewayList') || (() => { const wrapper = document.createElement('div'); wrapper.className = 'payment-gateways-settings'; wrapper.innerHTML = '<div class="panel-label"><span>Payment gateways</span><button class="ghost-button" id="addPaymentGateway" type="button">＋ Add gateway</button></div><div id="paymentGatewayList"></div>'; paymentPanel?.prepend(wrapper); return wrapper.querySelector('#paymentGatewayList'); })();
const gatewayDefaults = [{ id: 'paystack', name: 'Paystack', enabled: true }, { id: 'hubtel', name: 'Hubtel', enabled: false }, { id: 'mpesa', name: 'M-Pesa', enabled: false }];
function gatewayFields(gateway) { const common = `<label>Gateway name<input name="gatewayName" value="${escapeHtml(gateway.name || '')}" required></label><label>Gateway ID<input name="gatewayId" value="${escapeHtml(gateway.id || '')}" required maxlength="40"></label><label>Service fee (%)<input name="gatewayServiceFee" type="number" min="0" max="100" step="0.01" value="${Number(gateway.serviceFee ?? (gateway.id === 'paystack' ? 0.2 : 0))}"><small>Added to checkout totals when this gateway is selected.</small></label><label class="check-row"><input name="gatewayEnabled" type="checkbox" ${gateway.enabled ? 'checked' : ''}> Enabled for checkout</label>`; const fields = gateway.id === 'paystack' ? '<label>Public key<input name="gatewayPublicKey" placeholder="pk_test_..."></label><label>Secret key<input name="gatewaySecretKey" type="password" placeholder="sk_test_..."></label><label>Callback URL<input name="gatewayCallbackUrl" placeholder="https://..."></label><label>Webhook secret<input name="gatewayWebhookSecret" type="password"></label>' : '<label>Client ID<input name="gatewayClientId"></label><label>Client secret<input name="gatewayClientSecret" type="password"></label><label>Merchant account<input name="gatewayMerchantAccount"></label><label>API URL<input name="gatewayApiUrl" placeholder="https://..."></label><label>Callback URL<input name="gatewayCallbackUrl" placeholder="https://..."></label><label>Webhook secret<input name="gatewayWebhookSecret" type="password"></label>'; return `<div class="payment-gateway-row" data-payment-gateway><div class="admin-field-grid">${common}${fields}</div><button class="ghost-button gateway-remove" type="button" data-remove-gateway>Remove gateway</button></div>`; }
function renderPaymentGateways(gateways = gatewayDefaults) { if (!gatewayList) return; gatewayList.innerHTML = gateways.map(gatewayFields).join(''); gateways.forEach((gateway, index) => { const row = gatewayList.children[index]; if (!row) return; const set = (name, value) => { const field = row.querySelector(`[name="${name}"]`); if (field && value !== undefined) field.value = value; }; set('gatewayServiceFee', gateway.serviceFee ?? (gateway.id === 'paystack' ? 0.2 : 0)); set('gatewayPublicKey', gateway.publicKey); set('gatewaySecretKey', gateway.secretKey); set('gatewayClientId', gateway.clientId); set('gatewayClientSecret', gateway.clientSecret); set('gatewayMerchantAccount', gateway.merchantAccount); set('gatewayApiUrl', gateway.apiUrl); set('gatewayCallbackUrl', gateway.callbackUrl); set('gatewayWebhookSecret', gateway.webhookSecret); }); }
renderPaymentGateways();
document.querySelector('#addPaymentGateway')?.addEventListener('click', () => { const gateways = [...document.querySelectorAll('[data-payment-gateway]')].map((row) => ({ id: row.querySelector('[name="gatewayId"]')?.value || '', name: row.querySelector('[name="gatewayName"]')?.value || '', serviceFee: Number(row.querySelector('[name="gatewayServiceFee"]')?.value || 0), enabled: row.querySelector('[name="gatewayEnabled"]')?.checked })); gateways.push({ id: 'custom-gateway', name: 'Custom gateway', serviceFee: 0, enabled: false }); renderPaymentGateways(gateways); });
gatewayList?.addEventListener('click', (event) => { if (event.target.closest('[data-remove-gateway]')) event.target.closest('[data-payment-gateway]')?.remove(); });
function renderTaxCountries(countries = defaultTaxCountries) { if (!taxCountryList) return; taxCountryList.innerHTML = (countries.length ? countries : defaultTaxCountries).map((country) => `<div class="tax-country-row" data-tax-country-row><label>Country code<input name="taxCountryCode" maxlength="3" value="${escapeHtml(country.code || '')}" required></label><label>Country name<input name="taxCountryName" value="${escapeHtml(country.name || '')}" required></label><label>Tax rate (%)<input name="taxCountryRate" type="number" min="0" max="100" step="0.01" value="${Number(country.rate || 0)}" required></label><button class="ghost-button tax-country-remove" type="button" data-remove-tax-country aria-label="Remove ${escapeHtml(country.name || 'country')}" title="Remove country" ${countries.length <= 1 ? 'hidden' : ''}>⌫</button></div>`).join(''); }
const syncTaxRateVisibility = () => { if (taxRateFields) taxRateFields.hidden = !taxEnabledInput?.checked; };
taxEnabledInput?.addEventListener('change', syncTaxRateVisibility);
document.querySelector('#addTaxCountry')?.addEventListener('click', () => { const rows = [...document.querySelectorAll('[data-tax-country-row]')]; const countries = rows.map((row) => ({ code: row.querySelector('[name="taxCountryCode"]')?.value || '', name: row.querySelector('[name="taxCountryName"]')?.value || '', rate: row.querySelector('[name="taxCountryRate"]')?.value || 0 })); countries.push({ code: '', name: '', rate: 0 }); renderTaxCountries(countries); });
taxCountryList?.addEventListener('click', (event) => { const remove = event.target.closest('[data-remove-tax-country]'); if (!remove) return; remove.closest('[data-tax-country-row]')?.remove(); });
renderTaxCountries();
syncTaxRateVisibility();
settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const data = new FormData(event.currentTarget);
  const taxCountries = [...document.querySelectorAll('[data-tax-country-row]')].map((row) => ({
    code: String(row.querySelector('[name="taxCountryCode"]')?.value || '').trim().toUpperCase(),
    name: String(row.querySelector('[name="taxCountryName"]')?.value || '').trim(),
    rate: Number(row.querySelector('[name="taxCountryRate"]')?.value || 0),
  })).filter((country) => country.code && country.name);
  const paymentGateways = [...document.querySelectorAll('[data-payment-gateway]')].map((row) => ({
    id: String(row.querySelector('[name="gatewayId"]')?.value || '').trim().toLowerCase(),
    name: String(row.querySelector('[name="gatewayName"]')?.value || '').trim(),
    serviceFee: Number(row.querySelector('[name="gatewayServiceFee"]')?.value || 0),
    enabled: Boolean(row.querySelector('[name="gatewayEnabled"]')?.checked),
    publicKey: row.querySelector('[name="gatewayPublicKey"]')?.value || '',
    secretKey: row.querySelector('[name="gatewaySecretKey"]')?.value || '',
    clientId: row.querySelector('[name="gatewayClientId"]')?.value || '',
    clientSecret: row.querySelector('[name="gatewayClientSecret"]')?.value || '',
    merchantAccount: row.querySelector('[name="gatewayMerchantAccount"]')?.value || '',
    apiUrl: row.querySelector('[name="gatewayApiUrl"]')?.value || '',
    callbackUrl: row.querySelector('[name="gatewayCallbackUrl"]')?.value || '',
    webhookSecret: row.querySelector('[name="gatewayWebhookSecret"]')?.value || '',
  })).filter((gateway) => gateway.id && gateway.name);
  const activeGateway = paymentGateways.find((gateway) => gateway.enabled) || paymentGateways[0];
  const smtpPassword = String(data.get('smtpPassword') || '');
  const clearSmtpPassword = data.get('clearSmtpPassword') === 'on';
  const payload = {
    storeName: data.get('storeName'),
    storeLogo: data.get('storeLogo') || '',
    brandPrimaryColor: data.get('brandPrimaryColor'),
    brandAccentColor: data.get('brandAccentColor'),
    supportEmail: String(data.get('supportEmail') || '').trim(),
    smtpHost: String(data.get('smtpHost') || '').trim(),
    smtpPort: Number(data.get('smtpPort') || 587),
    smtpSecure: data.get('smtpSecure') === 'on',
    smtpUser: String(data.get('smtpUser') || '').trim(),
    smtpFrom: String(data.get('smtpFrom') || '').trim(),
    ...(clearSmtpPassword ? { smtpPassword: '' } : smtpPassword ? { smtpPassword } : {}),
    defaultCurrency: data.get('defaultCurrency'),
    paymentProvider: activeGateway?.id || 'paystack',
    paymentGateways,
    paystackPublicKey: activeGateway?.id === 'paystack' ? activeGateway.publicKey : '',
    paystackSecretKey: activeGateway?.id === 'paystack' ? activeGateway.secretKey : '',
    defaultShippingRate: data.get('defaultShippingRate'),
    freeShippingThreshold: data.get('freeShippingThreshold'),
    lowStockThreshold: data.get('lowStockThreshold'),
    taxEnabled: data.get('taxEnabled') === 'on',
    taxCountries,
  };
  try {
    await adminJson('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(payload) });
    settingsForm.elements.smtpPassword.value = '';
    settingsForm.elements.clearSmtpPassword.checked = false;
    await loadAdminBranding();
    showToast('Settings saved.');
    await loadFullSettings();
  } catch (error) {
    showToast(error.message);
  }
}, true);
document.querySelector('.smtp-settings')?.addEventListener('input', () => {
  const status = document.querySelector('#smtpTestResult');
  status.removeAttribute('data-state');
  status.textContent = 'SMTP settings changed. Save them before sending a new test.';
});
document.querySelector('#testSmtpConnection')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const recipientField = document.querySelector('#smtpTestRecipient');
  const status = document.querySelector('#smtpTestResult');
  const recipient = recipientField.value.trim();
  if (!recipient || !recipientField.checkValidity()) {
    status.dataset.state = 'error';
    status.textContent = 'Enter a valid email address to receive the test message.';
    recipientField.focus();
    return;
  }
  button.disabled = true;
  status.dataset.state = 'pending';
  status.textContent = 'Sending a test message using the saved SMTP settings...';
  try {
    await adminJson('/api/v1/settings/test-smtp', { method: 'POST', body: JSON.stringify({ recipient }) });
    status.dataset.state = 'success';
    status.textContent = `SMTP accepted the test email for ${recipient}. Check that inbox and its spam folder.`;
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
settingsForm.addEventListener('submit', async (event) => { event.preventDefault(); event.stopImmediatePropagation(); const data = new FormData(event.target); const taxCountries = [...document.querySelectorAll('[data-tax-country-row]')].map((row) => ({ code: String(row.querySelector('[name="taxCountryCode"]')?.value || '').trim().toUpperCase(), name: String(row.querySelector('[name="taxCountryName"]')?.value || '').trim(), rate: Number(row.querySelector('[name="taxCountryRate"]')?.value || 0) })).filter((country) => country.code && country.name); const paymentGateways = [...document.querySelectorAll('[data-payment-gateway]')].map((row) => ({ id: String(row.querySelector('[name="gatewayId"]')?.value || '').trim().toLowerCase(), name: String(row.querySelector('[name="gatewayName"]')?.value || '').trim(), serviceFee: Number(row.querySelector('[name="gatewayServiceFee"]')?.value || 0), enabled: Boolean(row.querySelector('[name="gatewayEnabled"]')?.checked), publicKey: row.querySelector('[name="gatewayPublicKey"]')?.value || '', secretKey: row.querySelector('[name="gatewaySecretKey"]')?.value || '', clientId: row.querySelector('[name="gatewayClientId"]')?.value || '', clientSecret: row.querySelector('[name="gatewayClientSecret"]')?.value || '', merchantAccount: row.querySelector('[name="gatewayMerchantAccount"]')?.value || '', apiUrl: row.querySelector('[name="gatewayApiUrl"]')?.value || '', callbackUrl: row.querySelector('[name="gatewayCallbackUrl"]')?.value || '', webhookSecret: row.querySelector('[name="gatewayWebhookSecret"]')?.value || '' })).filter((gateway) => gateway.id && gateway.name); const activeGateway = paymentGateways.find((gateway) => gateway.enabled) || paymentGateways[0]; try { await adminJson('/api/v1/settings', { method: 'PATCH', body: JSON.stringify({ storeName: data.get('storeName'), storeLogo: data.get('storeLogo') || '', brandPrimaryColor: data.get('brandPrimaryColor'), brandAccentColor: data.get('brandAccentColor'), supportEmail: data.get('supportEmail') || undefined, supportWhatsApp: String(data.get('supportWhatsApp') || '').trim() || undefined, defaultCurrency: data.get('defaultCurrency'), paymentProvider: activeGateway?.id || 'paystack', paymentGateways, paystackPublicKey: activeGateway?.id === 'paystack' ? activeGateway.publicKey : '', paystackSecretKey: activeGateway?.id === 'paystack' ? activeGateway.secretKey : '', defaultShippingRate: data.get('defaultShippingRate'), freeShippingThreshold: data.get('freeShippingThreshold'), lowStockThreshold: data.get('lowStockThreshold'), taxEnabled: data.get('taxEnabled') === 'on', taxCountries }) }); await loadAdminBranding(); showToast('Settings saved.'); await loadFullSettings(); } catch (error) { showToast(error.message); } }, true);
document.querySelector('#settingsForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.target); const taxCountries = [...document.querySelectorAll('[data-tax-country-row]')].map((row) => ({ code: String(row.querySelector('[name="taxCountryCode"]')?.value || '').trim().toUpperCase(), name: String(row.querySelector('[name="taxCountryName"]')?.value || '').trim(), rate: Number(row.querySelector('[name="taxCountryRate"]')?.value || 0) })).filter((country) => country.code && country.name); const paymentGateways = [...document.querySelectorAll('[data-payment-gateway]')].map((row) => ({ id: String(row.querySelector('[name="gatewayId"]')?.value || '').trim().toLowerCase(), name: String(row.querySelector('[name="gatewayName"]')?.value || '').trim(), enabled: Boolean(row.querySelector('[name="gatewayEnabled"]')?.checked), publicKey: row.querySelector('[name="gatewayPublicKey"]')?.value || '', secretKey: row.querySelector('[name="gatewaySecretKey"]')?.value || '', clientId: row.querySelector('[name="gatewayClientId"]')?.value || '', clientSecret: row.querySelector('[name="gatewayClientSecret"]')?.value || '', merchantAccount: row.querySelector('[name="gatewayMerchantAccount"]')?.value || '', apiUrl: row.querySelector('[name="gatewayApiUrl"]')?.value || '', callbackUrl: row.querySelector('[name="gatewayCallbackUrl"]')?.value || '', webhookSecret: row.querySelector('[name="gatewayWebhookSecret"]')?.value || '' })).filter((gateway) => gateway.id && gateway.name); const activeGateway = paymentGateways.find((gateway) => gateway.enabled) || paymentGateways[0]; try { await adminJson('/api/v1/settings', { method: 'PATCH', body: JSON.stringify({ storeName: data.get('storeName'), storeLogo: data.get('storeLogo') || '', supportEmail: data.get('supportEmail') || undefined, supportWhatsApp: String(data.get('supportWhatsApp') || '').trim() || undefined, defaultCurrency: data.get('defaultCurrency'), paymentProvider: activeGateway?.id || 'paystack', paymentGateways, paystackPublicKey: activeGateway?.id === 'paystack' ? activeGateway.publicKey : '', paystackSecretKey: activeGateway?.id === 'paystack' ? activeGateway.secretKey : '', defaultShippingRate: data.get('defaultShippingRate'), freeShippingThreshold: data.get('freeShippingThreshold'), lowStockThreshold: data.get('lowStockThreshold'), taxEnabled: data.get('taxEnabled') === 'on', taxCountries }) }); await loadAdminBranding(); showToast('Settings saved.'); await loadFullSettings(); } catch (error) { showToast(error.message); } });
document.querySelector('.settings-detail-link').addEventListener('click', (event) => { event.preventDefault(); switchView('#settingsDetails'); document.querySelector("a[href='#settings']").classList.add('active'); });
document.querySelector('#toggleAdminPassword').addEventListener('click', (event) => { const input = adminLoginForm.elements.password; const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; event.currentTarget.textContent = visible ? 'Show' : 'Hide'; event.currentTarget.setAttribute('aria-label', visible ? 'Show password' : 'Hide password'); });
document.querySelector('#adminExitToStore').addEventListener('click', () => { window.location.href = 'index.html'; });
document.querySelector('#adminRetry').addEventListener('click', () => { document.querySelector('#adminLoginError').textContent = ''; void checkApiConnection(); });
loadPerformance(); loadCoupons(); loadAdminCategories(); loadFullSettings();
async function loadAdminNotifications() { try { const result = await adminJson('/api/v1/notifications'); if (!result) return; const notifications = result.data || []; document.querySelector('#adminAlertCount').textContent = result.unread ? ` ${result.unread}` : ''; document.querySelector('#adminNotificationList').innerHTML = notifications.length ? notifications.map((notification) => `<div class="admin-list-row ${notification.readAt ? '' : 'unread'}"><span><strong>${notification.title}</strong><small>${notification.body} · ${new Date(notification.createdAt).toLocaleString()}</small></span>${notification.readAt ? '' : `<button type="button" data-read-notification="${notification.id}">Mark read</button>`}</div>`).join('') : '<p class="table-empty">No notifications yet.</p>'; } catch (error) { showToast(error.message); } }
document.querySelector('#adminAlerts').addEventListener('click', () => { switchView('#adminNotifications'); loadAdminNotifications(); });
document.querySelector('#adminNotificationList').addEventListener('click', async (event) => { const button = event.target.closest('[data-read-notification]'); if (!button) return; try { await adminJson(`/api/v1/notifications/${button.dataset.readNotification}/read`, { method: 'PATCH' }); await loadAdminNotifications(); } catch (error) { showToast(error.message); } });
document.querySelector('#markNotificationsRead').addEventListener('click', async () => { try { await adminJson('/api/v1/notifications/read-all', { method: 'PATCH' }); await loadAdminNotifications(); } catch (error) { showToast(error.message); } });
loadAdminNotifications();
async function loadAdminReturns() { const list = document.querySelector('#adminReturnsList'); if (!list) return; try { const result = await adminJson('/api/v1/refunds'); const refunds = result?.data || []; list.innerHTML = refunds.length ? refunds.map((refund) => `<article class="admin-list-row return-request-row"><span><strong>${escapeHtml(refund.orderItem?.name || 'Full order refund')}</strong><small>${escapeHtml(refund.user ? `${refund.user.firstName} ${refund.user.lastName} · ${refund.user.email}` : refund.order?.orderNumber || 'Order')} · Qty ${refund.quantity || 'All'} · ${formatMoney(refund.amount)}<br>${escapeHtml(refund.reason)}${refund.notes ? ` · ${escapeHtml(refund.notes)}` : ''}</small></span><span class="list-actions"><b>${escapeHtml(refund.status)}</b><select data-return-status="${refund.id}" aria-label="Return status"><option value="REQUESTED" ${refund.status === 'REQUESTED' ? 'selected' : ''}>Requested</option><option value="APPROVED" ${refund.status === 'APPROVED' ? 'selected' : ''}>Approved</option><option value="PROCESSING" ${refund.status === 'PROCESSING' ? 'selected' : ''}>Processing</option><option value="COMPLETED" ${refund.status === 'COMPLETED' ? 'selected' : ''}>Completed</option><option value="REJECTED" ${refund.status === 'REJECTED' ? 'selected' : ''}>Rejected</option></select></span></article>`).join('') : '<p class="table-empty">No return requests yet.</p>'; } catch (error) { list.innerHTML = `<p class="table-empty">${escapeHtml(error.message)}</p>`; } }
document.querySelector('#refreshReturns')?.addEventListener('click', () => void loadAdminReturns());
document.querySelector('#adminReturnsList')?.addEventListener('change', async (event) => { const select = event.target.closest('[data-return-status]'); if (!select) return; try { await adminJson(`/api/v1/refunds/${select.dataset.returnStatus}/status`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); showToast('Return status updated.'); await loadAdminReturns(); } catch (error) { showToast(error.message); } });
loadAdminReturns();
let adminChatConversations = {};
let activeAdminChatUser = '';
function renderAdminConversation(userId) { const conversation = adminChatConversations[userId]; const view = document.querySelector('#adminChatView'); if (!conversation || !view) return; const latest = conversation[conversation.length - 1]; view.innerHTML = `<div class="conversation-view-header"><button type="button" class="conversation-back" aria-label="Back to messages">‹</button><span class="conversation-avatar">${escapeHtml(latest.user.firstName?.slice(0, 1) || 'C')}</span><div><strong>${escapeHtml(latest.user.firstName)} ${escapeHtml(latest.user.lastName)}</strong><small>${escapeHtml(latest.user.email)}</small></div><span class="conversation-count">${conversation.length} messages</span></div><div class="chat-admin-messages">${conversation.map((message) => `<div class="chat-bubble ${message.senderRole === 'STAFF' || message.senderRole === 'ADMIN' ? 'mine' : ''}"><p>${escapeHtml(message.body)}</p><small>${new Date(message.createdAt).toLocaleString()}</small></div>`).join('')}</div><form class="chat-reply-form" data-chat-user="${latest.userId}"><input name="body" placeholder="Write a reply..." required maxlength="2000"><button type="submit" aria-label="Send reply">↗</button></form>`; document.querySelectorAll('.conversation-item').forEach((item) => item.classList.toggle('active', item.dataset.chatUser === userId)); document.querySelector('.messages-workspace')?.classList.remove('show-conversations'); document.querySelector('.messages-workspace')?.classList.add('conversation-open'); document.querySelector('#toggleChatList')?.setAttribute('aria-label', 'Show messages list'); }
async function loadAdminChat() { try { const result = await adminJson('/api/v1/chat'); if (!result) { document.querySelector('#adminChatList').innerHTML = '<p class="table-empty">Sign in to load messages.</p>'; return; } const messages = result.data || []; adminChatConversations = messages.reduce((groups, message) => { (groups[message.userId] ||= []).push(message); return groups; }, {}); const conversations = Object.values(adminChatConversations).sort((a, b) => new Date(b[b.length - 1].createdAt).getTime() - new Date(a[a.length - 1].createdAt).getTime()); document.querySelector('#adminChatList').innerHTML = conversations.length ? conversations.map((conversation) => { const latest = conversation[conversation.length - 1]; const pending = conversation.filter((message) => message.senderRole === 'CUSTOMER' && !message.readAt).length; return `<button type="button" class="conversation-item ${pending ? 'has-pending' : ''}" data-chat-user="${latest.userId}"><span class="conversation-avatar">${escapeHtml(latest.user.firstName?.slice(0, 1) || 'C')}</span><span class="conversation-preview"><strong>${escapeHtml(latest.user.firstName)} ${escapeHtml(latest.user.lastName)}</strong><small>${escapeHtml(latest.body)}</small></span><span class="conversation-meta"><time>${new Date(latest.createdAt).toLocaleDateString()}</time>${pending ? `<b aria-label="${pending} pending messages">${pending}</b>` : '<i aria-label="No pending messages">✓</i>'}</span></button>`; }).join('') : '<p class="table-empty">No customer conversations yet.</p>'; if (activeAdminChatUser && adminChatConversations[activeAdminChatUser]) renderAdminConversation(activeAdminChatUser); } catch (error) { document.querySelector('#adminChatList').innerHTML = `<p class="table-empty">Unable to load messages. ${escapeHtml(error.message)}</p>`; showToast(error.message); } }
document.querySelector('#adminChatList').addEventListener('click', async (event) => { const item = event.target.closest('.conversation-item'); if (!item) return; activeAdminChatUser = item.dataset.chatUser; renderAdminConversation(activeAdminChatUser); try { await adminJson('/api/v1/chat/read', { method: 'PATCH', body: JSON.stringify({ userId: activeAdminChatUser }) }); await loadAdminChat(); renderAdminConversation(activeAdminChatUser); } catch (error) { showToast(error.message); } });
document.querySelector('#adminChatView').addEventListener('click', (event) => { if (!event.target.closest('.conversation-back')) return; activeAdminChatUser = ''; document.querySelector('.messages-workspace')?.classList.remove('conversation-open'); document.querySelectorAll('.conversation-item').forEach((item) => item.classList.remove('active')); });
document.querySelector('#adminChat').addEventListener('submit', async (event) => { const form = event.target.closest('.chat-reply-form'); if (!form) return; event.preventDefault(); const data = new FormData(form); try { await adminJson('/api/v1/chat', { method: 'POST', body: JSON.stringify({ userId: form.dataset.chatUser, body: data.get('body') }) }); await loadAdminChat(); showToast('Reply sent.'); } catch (error) { showToast(error.message); } });
let chatAiFaqs = [];
function resetChatAiTrainingForm() { const form = document.querySelector('#chatAiTrainingForm'); const save = document.querySelector('#chatAiTrainingSave'); const cancel = document.querySelector('#chatAiTrainingCancel'); if (!form) return; form.reset(); delete form.dataset.editIndex; if (save) save.innerHTML = 'Save AI response <span>↗</span>'; if (cancel) cancel.hidden = true; }
function renderChatAiTraining() { const list = document.querySelector('#chatAiTrainingList'); const count = document.querySelector('#chatAiTrainingCount'); if (!list || !count) return; count.textContent = `${chatAiFaqs.length} saved`; list.innerHTML = chatAiFaqs.length ? chatAiFaqs.map((faq, index) => `<div class="admin-list-row chat-ai-training-row ${faq.enabled === false ? 'is-disabled' : ''}"><span><strong>${escapeHtml(faq.question)} <em>${faq.enabled === false ? 'Disabled' : 'Active'}</em></strong><small>${escapeHtml(faq.response)}</small></span><span class="list-actions"><button type="button" class="icon-action" data-edit-ai-faq="${index}" aria-label="Edit trained response" title="Edit trained response">✎</button><button type="button" class="icon-action" data-toggle-ai-faq="${index}" aria-label="${faq.enabled === false ? 'Enable' : 'Disable'} trained response" title="${faq.enabled === false ? 'Enable' : 'Disable'} trained response">${faq.enabled === false ? '✓' : 'Ⅱ'}</button><button type="button" class="icon-action" data-delete-ai-faq="${index}" aria-label="Delete trained response" title="Delete trained response">×</button></span></div>`).join('') : '<p class="table-empty">No trained responses yet.</p>'; }
async function saveChatAiTraining() { const form = document.querySelector('#chatAiTrainingForm'); if (!form || !roleCanAccess('settings.update')) return; const data = new FormData(form); const question = String(data.get('question') || '').trim(); const response = String(data.get('response') || '').trim(); if (!question || !response) return; const editIndex = Number(form.dataset.editIndex); const faq = { question, response, enabled: Number.isInteger(editIndex) && editIndex >= 0 ? chatAiFaqs[editIndex]?.enabled !== false : true }; const nextFaqs = Number.isInteger(editIndex) && editIndex >= 0 ? chatAiFaqs.map((item, index) => index === editIndex ? faq : item) : [...chatAiFaqs, faq]; try { await adminJson('/api/v1/settings', { method: 'PATCH', body: JSON.stringify({ chatAiFaqs: nextFaqs }) }); chatAiFaqs = nextFaqs; resetChatAiTrainingForm(); renderChatAiTraining(); showToast(Number.isInteger(editIndex) && editIndex >= 0 ? 'AI response updated.' : 'AI response saved.'); } catch (error) { showToast(error.message); } }
async function loadChatAiTraining() { const section = document.querySelector('#chatAiTraining'); if (!section || !roleCanAccess('settings.update')) return; section.hidden = false; try { const result = await adminJson('/api/v1/settings'); chatAiFaqs = Array.isArray(result?.data?.chatAiFaqs) ? result.data.chatAiFaqs : []; renderChatAiTraining(); } catch (error) { showToast(error.message); } }
document.querySelector('#chatAiTrainingForm')?.addEventListener('submit', (event) => { event.preventDefault(); void saveChatAiTraining(); });
document.querySelector('#chatAiTrainingCancel')?.addEventListener('click', resetChatAiTrainingForm);
document.querySelector('#chatAiTrainingList')?.addEventListener('click', async (event) => { const form = document.querySelector('#chatAiTrainingForm'); const edit = event.target.closest('[data-edit-ai-faq]'); const toggle = event.target.closest('[data-toggle-ai-faq]'); const remove = event.target.closest('[data-delete-ai-faq]'); const index = Number(edit?.dataset.editAiFaq || toggle?.dataset.toggleAiFaq || remove?.dataset.deleteAiFaq); if (!Number.isInteger(index) || !chatAiFaqs[index]) return; if (edit) { form.elements.question.value = chatAiFaqs[index].question; form.elements.response.value = chatAiFaqs[index].response; form.dataset.editIndex = String(index); document.querySelector('#chatAiTrainingSave').innerHTML = 'Update AI response <span>↗</span>'; document.querySelector('#chatAiTrainingCancel').hidden = false; form.elements.question.focus(); return; } const nextFaqs = toggle ? chatAiFaqs.map((faq, faqIndex) => faqIndex === index ? { ...faq, enabled: faq.enabled === false } : faq) : chatAiFaqs.filter((_, faqIndex) => faqIndex !== index); if (remove && window.Swal) { const confirmation = await window.Swal.fire({ title: 'Delete trained response?', text: 'This response will be removed from the AI assistant.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', cancelButtonText: 'Keep response', buttonsStyling: false, customClass: { popup: 'admin-swal-popup', confirmButton: 'admin-swal-confirm', cancelButton: 'admin-swal-cancel' } }); if (!confirmation.isConfirmed) return; } try { await adminJson('/api/v1/settings', { method: 'PATCH', body: JSON.stringify({ chatAiFaqs: nextFaqs }) }); chatAiFaqs = nextFaqs; if (Number(form?.dataset.editIndex) === index) resetChatAiTrainingForm(); renderChatAiTraining(); showToast(toggle ? `AI response ${nextFaqs[index]?.enabled === false ? 'disabled' : 'enabled'}.` : 'AI response removed.'); } catch (error) { showToast(error.message); } });
const adminChatTabKey = 'ground-admin-chat-tab';
function setAdminChatTab(name, persist = true) { const tabs = [...document.querySelectorAll('[data-chat-tab]')]; const selected = tabs.find((tab) => tab.dataset.chatTab === name) || tabs[0]; if (!selected) return; const selectedName = selected.dataset.chatTab; tabs.forEach((tab) => { const active = tab === selected; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); }); document.querySelectorAll('[data-chat-panel]').forEach((panel) => { panel.hidden = panel.dataset.chatPanel !== selectedName; }); if (persist) localStorage.setItem(adminChatTabKey, selectedName); }
document.querySelectorAll('[data-chat-tab]').forEach((tab) => tab.addEventListener('click', () => setAdminChatTab(tab.dataset.chatTab)));
setAdminChatTab(localStorage.getItem(adminChatTabKey) || 'messages', false);
void loadChatAiTraining();
document.querySelector('#markChatRead').addEventListener('click', async () => { try { await adminJson('/api/v1/chat/read', { method: 'PATCH' }); await loadAdminChat(); } catch (error) { showToast(error.message); } });
document.querySelector('#toggleChatList').addEventListener('click', () => { const workspace = document.querySelector('.messages-workspace'); const showingList = workspace.classList.toggle('show-conversations'); document.querySelector('#toggleChatList').setAttribute('aria-label', showingList ? 'Show active conversation' : 'Show messages list'); });
loadAdminChat();
async function loadInventory() { try { const result = await adminJson('/api/v1/products?status=ALL&take=100'); if (!result) return; const items = result.data || []; const stockTotal = items.reduce((sum, product) => sum + Number(product.inventory?.available || 0) + Number(product.inventory?.reserved || 0) + Number(product.inventory?.sold || 0), 0); const stockAvailable = items.reduce((sum, product) => sum + Number(product.inventory?.available || 0), 0); inventoryPanel.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Stock control</p><h2>Inventory</h2></div><span class="section-count">${stockAvailable} available / ${stockTotal} total</span></div><div class="inventory-list">${items.length ? items.map((product) => { const available = Number(product.inventory?.available || 0); const reserved = Number(product.inventory?.reserved || 0); const sold = Number(product.inventory?.sold || 0); const total = available + reserved + sold; const percent = total ? Math.round(available / total * 100) : 0; return `<div class="inventory-row"><div class="inventory-product"><div class="inventory-thumb">${product.images?.[0]?.url ? `<img src="${product.images[0].url}" alt="">` : '<span>G</span>'}</div><span><strong>${product.name}</strong><small>${product.sku}</small></span></div><div class="inventory-progress-wrap"><div class="inventory-stock-line"><span class="inventory-stock ${available <= inventoryThreshold ? 'low' : ''}">${available} available of ${total}</span><small>${percent}% remaining</small></div><div class="inventory-progress" role="progressbar" aria-valuenow="${available}" aria-valuemin="0" aria-valuemax="${total}" aria-label="${product.name}: ${available} of ${total} stock available"><i style="width:${percent}%"></i></div></div><form class="stock-adjust" data-stock-product="${product.id}"><input name="stock" type="number" min="0" value="${available}" aria-label="Available stock for ${product.name}"><button type="submit">Save</button></form></div>`; }).join('') : '<p class="table-empty">No products in inventory.</p>'}</div>`; } catch (error) { showToast(error.message); } }
document.querySelector('#inventory').addEventListener('submit', async (event) => { const form = event.target.closest('[data-stock-product]'); if (!form) return; event.preventDefault(); const data = new FormData(form); try { await adminJson(`/api/v1/products/${form.dataset.stockProduct}`, { method: 'PATCH', body: JSON.stringify({ stock: Number(data.get('stock')) }) }); showToast('Inventory updated.'); await loadInventory(); } catch (error) { showToast(error.message); } });
let adminInventory = [];
let inventoryPage = 1;
const renderInventoryPager = () => { const query = String(document.querySelector('#inventorySearch')?.value || '').trim().toLowerCase(); const filtered = adminInventory.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query)); const pages = Math.max(1, Math.ceil(filtered.length / adminPageSize)); inventoryPage = Math.min(inventoryPage, pages); const visible = filtered.slice((inventoryPage - 1) * adminPageSize, inventoryPage * adminPageSize); const list = inventoryPanel.querySelector('.inventory-list'); if (!list) return; list.innerHTML = visible.length ? visible.map((product) => { const available = Number(product.inventory?.available || 0); const reserved = Number(product.inventory?.reserved || 0); const sold = Number(product.inventory?.sold || 0); const total = available + reserved + sold; const percent = total ? Math.round(available / total * 100) : 0; return `<div class="inventory-row"><div class="inventory-product"><div class="inventory-thumb">${product.images?.[0]?.url ? `<img src="${escapeHtml(product.images[0].url)}" alt="">` : '<span>G</span>'}</div><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku)}</small></span></div><div class="inventory-progress-wrap"><div class="inventory-stock-line"><span class="inventory-stock ${available <= inventoryThreshold ? 'low' : ''}">${available} available of ${total}</span><small>${percent}% remaining</small></div><div class="inventory-progress"><i style="width:${percent}%"></i></div></div><form class="stock-adjust" data-stock-product="${product.id}"><input name="stock" type="number" min="0" value="${available}"><button type="submit">Save</button></form></div>`; }).join('') : '<p class="table-empty">No inventory found.</p>'; let pager = inventoryPanel.querySelector('#inventoryPager'); if (!pager) { inventoryPanel.insertAdjacentHTML('beforeend', '<div class="admin-pager" id="inventoryPager"></div>'); pager = inventoryPanel.querySelector('#inventoryPager'); } pager.innerHTML = `<button type="button" class="pager-button" data-inventory-prev ${inventoryPage === 1 ? 'disabled' : ''}>Previous</button><span>Page ${inventoryPage} of ${pages} · ${filtered.length} products</span><button type="button" class="pager-button" data-inventory-next ${inventoryPage === pages ? 'disabled' : ''}>Next</button>`; };
const originalLoadInventory = loadInventory;
loadInventory = async () => { await originalLoadInventory(); const heading = inventoryPanel.querySelector('.panel-heading'); if (heading && !document.querySelector('#inventorySearch')) { const searchMarkup = '<input id="inventorySearch" type="search" placeholder="Search inventory" aria-label="Search inventory">'; const sectionCount = heading.querySelector('.section-count'); if (sectionCount) sectionCount.insertAdjacentHTML('beforebegin', searchMarkup); else heading.insertAdjacentHTML('beforeend', searchMarkup); const inventorySearch = document.querySelector('#inventorySearch'); inventorySearch?.addEventListener('input', () => { inventoryPage = 1; renderInventoryPager(); }); } const result = await adminJson('/api/v1/products?status=ALL&take=100'); adminInventory = result?.data || []; renderInventoryPager(); };
inventoryPanel.addEventListener('click', (event) => { if (event.target.matches('[data-inventory-prev]')) { inventoryPage -= 1; renderInventoryPager(); } if (event.target.matches('[data-inventory-next]')) { inventoryPage += 1; renderInventoryPager(); } });
loadInventory();
async function loadCustomers() { if (!roleCanAccess('users.read')) return; try { const result = await adminJson('/api/v1/users?role=CUSTOMER&take=100'); if (!result) return; const customers = result.data || []; const panel = document.querySelector('#customers'); panel.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Relationship management</p><h2>Customers</h2></div><span class="section-count">${customers.length} total</span></div><div class="customer-list">${customers.length ? customers.map((customer) => `<div class="customer-row"><div><strong>${customer.firstName} ${customer.lastName}</strong><small>${customer.email}${customer.lastLoginAt ? ` · Last active ${new Date(customer.lastLoginAt).toLocaleDateString()}` : ''}</small></div><select class="customer-status" data-customer="${customer.id}" aria-label="Status for ${customer.email}">${['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING'].map((status) => `<option value="${status}" ${status === customer.status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>`).join('') : '<p class="table-empty">No customers found.</p>'}</div>`; } catch (error) { showToast(error.message); } }
document.querySelector('#customers').addEventListener('change', async (event) => { const select = event.target.closest('.customer-status'); if (!select) return; try { await adminJson(`/api/v1/users/${select.dataset.customer}/status`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); showToast('Customer status updated.'); } catch (error) { showToast(error.message); } });
let adminCustomers = [];
let customersPage = 1;
const renderCustomersPager = () => { const query = String(document.querySelector('#customerSearch')?.value || '').trim().toLowerCase(); const status = document.querySelector('#customerStatusFilter')?.value || ''; const filtered = adminCustomers.filter((customer) => `${customer.firstName} ${customer.lastName} ${customer.email}`.toLowerCase().includes(query) && (!status || customer.status === status)); const pages = Math.max(1, Math.ceil(filtered.length / adminPageSize)); customersPage = Math.min(customersPage, pages); const visible = filtered.slice((customersPage - 1) * adminPageSize, customersPage * adminPageSize); const list = document.querySelector('#customers .customer-list'); if (!list) return; list.innerHTML = visible.length ? visible.map((customer) => `<div class="customer-row"><div><strong>${escapeHtml(`${customer.firstName} ${customer.lastName}`)}</strong><small>${escapeHtml(customer.email)}${customer.lastLoginAt ? ` · Last active ${new Date(customer.lastLoginAt).toLocaleDateString()}` : ''}</small></div><select class="customer-status" data-customer="${customer.id}" aria-label="Status for ${escapeHtml(customer.email)}">${['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING'].map((value) => `<option value="${value}" ${value === customer.status ? 'selected' : ''}>${value}</option>`).join('')}</select></div>`).join('') : '<p class="table-empty">No customers found.</p>'; const pager = document.querySelector('#customersPager'); if (pager) pager.innerHTML = `<button type="button" class="pager-button" data-customers-prev ${customersPage === 1 ? 'disabled' : ''}>Previous</button><span>Page ${customersPage} of ${pages} · ${filtered.length} customers</span><button type="button" class="pager-button" data-customers-next ${customersPage === pages ? 'disabled' : ''}>Next</button>`; };
const originalLoadCustomers = loadCustomers;
loadCustomers = async () => { await originalLoadCustomers(); const panel = document.querySelector('#customers'); const heading = panel.querySelector('.panel-heading'); if (heading && !document.querySelector('#customerSearch')) { heading.querySelector('.section-count')?.insertAdjacentHTML('beforebegin', '<input id="customerSearch" type="search" placeholder="Search customers" aria-label="Search customers"><select id="customerStatusFilter" aria-label="Filter customers by status"><option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option><option>BANNED</option><option>PENDING</option></select>'); panel.insertAdjacentHTML('beforeend', '<div class="admin-pager" id="customersPager"></div>');['#customerSearch', '#customerStatusFilter'].forEach((selector) => document.querySelector(selector).addEventListener('input', () => { customersPage = 1; renderCustomersPager(); })); } const result = await adminJson('/api/v1/users?role=CUSTOMER&take=100'); adminCustomers = result?.data || []; renderCustomersPager(); };
document.querySelector('#customers').addEventListener('click', (event) => { if (event.target.matches('[data-customers-prev]')) { customersPage -= 1; renderCustomersPager(); } if (event.target.matches('[data-customers-next]')) { customersPage += 1; renderCustomersPager(); } });
loadCustomers();
const userList = document.querySelector('#userList');
const userCreateForm = document.querySelector('#userCreateForm');
userCreateForm.elements.role.innerHTML = [['CUSTOMER', 'Customer'], ['STAFF', 'Staff'], ['SUPER_ADMIN', 'Super Admin / Owner'], ['FINANCE_MANAGER', 'Finance / Accountant'], ['OPERATIONS_MANAGER', 'Operations / Inventory Manager'], ['SUPPORT_AGENT', 'Customer Support Agent'], ['WAREHOUSE_STAFF', 'Warehouse / Fulfillment Staff'], ['ADMIN', 'Administrator']].map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
let adminUsers = [];
function renderUsers(users) {
  const isAdmin = roleCanAccess('staff.roles');
  userList.innerHTML = users.length ? users.map((user) => {
    const roleOptions = ['CUSTOMER', 'STAFF', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'WAREHOUSE_STAFF', 'ADMIN'].map((role) => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${role.replaceAll('_', ' ')}</option>`).join('');
    const statusOptions = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING'].map((status) => `<option value="${status}" ${status === user.status ? 'selected' : ''}>${status}</option>`).join('');
    const editControls = isAdmin ? `<select data-user-role="${user.id}" aria-label="Role for ${escapeHtml(user.email)}">${roleOptions}</select><select data-user-status="${user.id}" aria-label="Status for ${escapeHtml(user.email)}">${statusOptions}</select>` : `<span class="user-row-readonly">${escapeHtml(user.role)}</span><span class="user-row-readonly">${escapeHtml(user.status)}</span>`;
    const actionMenu = `<details class="user-actions-menu"><summary aria-label="Actions for ${escapeHtml(user.email)}">•••</summary><div class="user-actions-popover"><button type="button" data-user-view="${user.id}">View details</button><button type="button" data-user-password="${user.id}">Change password</button>${isAdmin ? `<button type="button" data-user-permissions="${user.id}">Manage access</button>` : ''}</div></details>`;
    return `<div class="admin-list-row"><span class="user-row-main"><span class="user-avatar">${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="">` : escapeHtml(user.firstName.charAt(0).toUpperCase())}</span><span><strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong><small>${escapeHtml(user.email)} · Joined ${new Date(user.createdAt).toLocaleDateString()} · ${user.emailVerified ? 'Verified' : 'Unverified'}${user.kycApplication ? ` · KYC ${user.kycApplication.status}` : ''}</small></span></span><span class="user-row-controls"><span class="user-role">${escapeHtml(user.role)}</span>${editControls}${actionMenu}</span></div>`;
  }).join('') : '<p class="table-empty">No users found.</p>';
}
async function loadUsers() {
  if (!roleCanAccess('users.read')) return;
  try {
    const search = document.querySelector('#userSearch').value.trim();
    const role = document.querySelector('#userRoleFilter').value;
    const result = await adminJson(`/api/v1/users?take=100${role ? `&role=${role}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
    if (result) { adminUsers = result.data || []; renderUsers(adminUsers); }
  } catch (error) { showToast(error.message); }
}
document.querySelector('#addUser').addEventListener('click', () => { userCreateForm.hidden = !userCreateForm.hidden; if (!userCreateForm.hidden) userCreateForm.elements.firstName.focus(); });
document.querySelector('#cancelUser').addEventListener('click', () => { userCreateForm.reset(); userCreateForm.hidden = true; });
userCreateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(userCreateForm);
  try { await adminJson('/api/v1/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) }); userCreateForm.reset(); userCreateForm.hidden = true; await loadUsers(); showToast('User created.'); } catch (error) { showToast(error.message); }
});
document.querySelector('#userSearch').addEventListener('input', loadUsers);
document.querySelector('#userRoleFilter').addEventListener('change', loadUsers);
userList.addEventListener('change', async (event) => {
  const roleSelect = event.target.closest('[data-user-role]');
  const statusSelect = event.target.closest('[data-user-status]');
  if (!roleSelect && !statusSelect) return;
  const userId = (roleSelect || statusSelect).dataset.userRole || (roleSelect || statusSelect).dataset.userStatus;
  try { await adminJson(`/api/v1/users/${userId}/${roleSelect ? 'role' : 'status'}`, { method: 'PATCH', body: JSON.stringify({ [roleSelect ? 'role' : 'status']: (roleSelect || statusSelect).value }) }); showToast(`${roleSelect ? 'Role' : 'Account status'} updated.`); await loadUsers(); } catch (error) { showToast(error.message); await loadUsers(); }
});
userList.addEventListener('click', (event) => { const viewButton = event.target.closest('[data-user-view]'); const passwordButton = event.target.closest('[data-user-password]'); const userId = viewButton?.dataset.userView || passwordButton?.dataset.userPassword; if (!userId) return; const user = adminUsers.find((item) => String(item.id) === String(userId)); if (user) openUserDetail(user); });
const permissionGroups = [
  { title: 'Catalog & inventory', description: 'Products, stock, categories, and merchandising.', permissions: ['products.read', 'products.create', 'products.update', 'products.delete', 'inventory.read', 'inventory.update'] },
  { title: 'Orders & shipping', description: 'Order handling, cancellations, refunds, and fulfillment.', permissions: ['orders.read', 'orders.update', 'orders.cancel', 'orders.refund', 'shipping.update', 'shipping.packing_slips'] },
  { title: 'Finance & reporting', description: 'Financial operations and business reporting.', permissions: ['finance.ledger', 'finance.payouts', 'finance.tax_reports', 'reports.read', 'coupons.manage'] },
  { title: 'Customer data', description: 'Customer access and sensitive personal information.', permissions: ['users.read', 'users.manage', 'customer.pii', 'customer.pii_export', 'reviews.moderate'] },
  { title: 'Administration', description: 'System configuration, credentials, and staff access.', permissions: ['settings.update', 'payments.credentials', 'security.manage', 'database.manage', 'staff.roles'] }
];
const permissionLabels = permissionGroups.flatMap((group) => group.permissions);
const permissionText = (permission) => permission.replaceAll('.', ' / ').replaceAll('_', ' ');
async function editUserPermissions(user) {
  if (!window.Swal || !roleCanAccess('staff.roles')) return;
  const available = permissionLabels.filter((permission) => roleCanAccess(permission));
  const current = new Set(user.permissions || []);
  const result = await window.Swal.fire({
    title: `Access for ${user.firstName} ${user.lastName}`,
    html: `<div class="swal-access-intro"><span class="swal-access-icon">↗</span><div><strong>Permission overrides</strong><p>Choose the individual access this user can use in addition to their role defaults.</p></div></div><div class="swal-access-toolbar"><span>${available.length} permissions available</span><button type="button" data-permission-select="all">Select all</button><button type="button" data-permission-select="clear">Clear</button></div><div class="swal-permission-groups">${permissionGroups.map((group) => { const groupPermissions = group.permissions.filter((permission) => available.includes(permission)); if (!groupPermissions.length) return ''; return `<section class="swal-permission-group"><div class="swal-permission-group-heading"><strong>${group.title}</strong><small>${group.description}</small></div><div class="swal-permission-grid">${groupPermissions.map((permission) => `<label class="swal-permission-card"><input type="checkbox" value="${permission}" ${current.has(permission) ? 'checked' : ''}><span><strong>${permissionText(permission)}</strong><small>${current.has(permission) ? 'Enabled' : 'Role default or unavailable'}</small></span></label>`).join('')}</div></section>`; }).join('')}</div>`,
    showCancelButton: true,
    confirmButtonText: 'Save access',
    cancelButtonText: 'Cancel',
    buttonsStyling: false,
    customClass: { popup: 'admin-swal-popup admin-access-popup', title: 'admin-swal-title', confirmButton: 'admin-swal-confirm', cancelButton: 'admin-swal-cancel' },
    didOpen: (popup) => {
      popup.querySelector('[data-permission-select="all"]')?.addEventListener('click', () => popup.querySelectorAll('.swal-permission-grid input').forEach((input) => { input.checked = true; }));
      popup.querySelector('[data-permission-select="clear"]')?.addEventListener('click', () => popup.querySelectorAll('.swal-permission-grid input').forEach((input) => { input.checked = false; }));
    },
    preConfirm: () => ({ permissions: available.map((permission) => ({ permission, granted: Boolean(document.querySelector(`.swal-permission-grid input[value="${permission}"]`)?.checked) })) })
  });
  if (!result.isConfirmed) return;
  try { await adminJson(`/api/v1/users/${user.id}/permissions`, { method: 'PATCH', body: JSON.stringify(result.value) }); showToast('User access updated.'); await loadUsers(); } catch (error) { showToast(error.message, 'warning'); }
}
userList.addEventListener('click', (event) => { const accessButton = event.target.closest('[data-user-permissions]'); if (!accessButton) return; const user = adminUsers.find((item) => String(item.id) === String(accessButton.dataset.userPermissions)); if (user) void editUserPermissions(user); });
document.addEventListener('pointerdown', (event) => { if (event.target.closest('.user-actions-menu')) return; document.querySelectorAll('.user-actions-menu[open]').forEach((menu) => { menu.removeAttribute('open'); }); });
const kycStatusOptions = ['PROCESSING', 'APPROVED', 'REJECTED'];
const kycVerificationOptions = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED'];
const kycScreeningOptions = ['NOT_STARTED', 'PENDING', 'CLEAR', 'REVIEW_REQUIRED', 'FAILED'];
const kycAccessOptions = ['LEVEL_1_SUPPORT', 'LEVEL_2_OPERATIONS', 'LEVEL_3_FINANCE_EXECUTIVE'];
const kycDetailForm = document.querySelector('#kycDetailForm');
const kycDetailEmpty = document.querySelector('#kycDetailEmpty');
function kycStatusClass(status) { return `kyc-status-${String(status || 'PENDING').toLowerCase()}`; }
function kycFieldStateClass(value) { const state = String(value || '').toUpperCase(); if (['VERIFIED', 'CLEAR'].includes(state)) return 'kyc-field-approved'; if (['FAILED', 'REVIEW_REQUIRED'].includes(state)) return 'kyc-field-blocked'; return 'kyc-field-pending'; }
function getKycFullName(application) { const user = application?.user || {}; return `${user.firstName || 'Applicant'} ${user.lastName || ''}`.trim() || 'Applicant'; }
function openKycReview(application, action = 'view') {
  if (!application || !kycDetailForm) return;
  const tableView = document.querySelector('#kycTableView');
  const detailPanel = document.querySelector('#kycDetailPanel');
  const reviewMode = document.querySelector('#kycReviewMode');
  if (tableView) tableView.hidden = true;
  if (detailPanel) { detailPanel.hidden = false; detailPanel.classList.add('is-open'); }
  if (reviewMode) reviewMode.textContent = action === 'process' ? 'Process submission' : 'View submission';
  renderKycDetail(application);
}
function closeKycReview() {
  const tableView = document.querySelector('#kycTableView');
  const detailPanel = document.querySelector('#kycDetailPanel');
  if (tableView) tableView.hidden = false;
  if (detailPanel) { detailPanel.hidden = true; detailPanel.classList.remove('is-open'); }
  if (kycDetailForm) { kycDetailForm.hidden = true; kycDetailForm.reset(); }
}
function renderKycDetail(application) {
  if (!application || !kycDetailForm) return;
  const identityDocuments = Array.from(new Set([application.documentUrl, ...(Array.isArray(application.documents) ? application.documents : []), ...(Array.isArray(application.files) ? application.files : [])].filter(Boolean).map((item) => String(item).trim())));
  const mediaItems = [
    ...identityDocuments.map((url, index) => ({ label: identityDocuments.length > 1 ? `Identity document ${index + 1}` : 'Identity document', url })),
    ...(application.proofOfAddressUrl ? [{ label: 'Proof of address', url: String(application.proofOfAddressUrl).trim() }] : []),
    ...(application.selfieUrl ? [{ label: 'Live selfie', url: String(application.selfieUrl).trim() }] : [])
  ].map((item) => ({ ...item, url: resolveMediaUrl(item.url) })).filter((item) => item.url);
  const applicantName = getKycFullName(application);
  const status = application.status === 'PENDING' ? 'PROCESSING' : (application.status || 'PROCESSING');
  const defaultReviewReason = application.reviewReason || '';
  const signed = Boolean(application.ndaSigned);
  const policyAccepted = Boolean(application.acceptableUsePolicyAccepted);
  const formMarkup = `
    <div class="admin-kyc-header">
      <div class="admin-kyc-identity">
        <div class="profile-avatar">${application.user?.avatarUrl ? `<img src="${resolveMediaUrl(application.user.avatarUrl)}" alt="${escapeHtml(applicantName)}" />` : escapeHtml(applicantName.charAt(0).toUpperCase())}</div>
        <div>
          <strong>${escapeHtml(applicantName)}</strong>
          <small>${escapeHtml(application.user?.email || 'No email')}</small>
        </div>
      </div>
      <div class="admin-kyc-actions">
        <span class="kyc-status-badge ${kycStatusClass(status)}">${escapeHtml(status)}</span>
      </div>
    </div>
    <div class="admin-kyc-doc-grid">
      ${mediaItems.length ? mediaItems.map((item) => `
        <article class="admin-kyc-doc-card">
          <div class="admin-kyc-doc-preview">
            ${/\.(png|jpe?g|gif|webp|bmp)(?:\?|$)/i.test(item.url) ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(applicantName)} ${escapeHtml(item.label)}" />` : '<span class="kyc-file-placeholder">PDF</span>'}
          </div>
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.url.split('/').pop()?.split('?')[0] || 'Uploaded file')}</small>
          </div>
          <a class="primary-button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Open file</a>
        </article>
      `).join('') : '<article class="admin-kyc-doc-card"><div class="admin-kyc-doc-preview"><span>No file</span></div><div><strong>No uploaded documents</strong></div></article>'}
    </div>
    <div class="admin-kyc-meta-grid">
      <article class="admin-kyc-meta-item"><span>Document type</span><strong>${escapeHtml(application.documentType || 'Not provided')}</strong></article>
      <article class="admin-kyc-meta-item"><span>Document number</span><strong>${escapeHtml(application.documentNumber || 'Not provided')}</strong></article>
      <article class="admin-kyc-meta-item"><span>Submitted</span><strong>${new Date(application.submittedAt || Date.now()).toLocaleString()}</strong></article>
      <article class="admin-kyc-meta-item"><span>Access tier</span><strong>${escapeHtml(application.accessTier || 'LEVEL_1_SUPPORT')}</strong></article>
      <article class="admin-kyc-meta-item"><span>Aliases</span><strong>${escapeHtml(application.aliases || 'Not provided')}</strong></article>
      <article class="admin-kyc-meta-item"><span>Nationality</span><strong>${escapeHtml(application.nationality || 'Not provided')}</strong></article>
      <article class="admin-kyc-meta-item"><span>Date of birth</span><strong>${application.dateOfBirth ? new Date(application.dateOfBirth).toLocaleDateString() : 'Not provided'}</strong></article>
      <article class="admin-kyc-meta-item"><span>Current residence</span><strong>${escapeHtml(application.currentAddress || 'Not provided')}</strong></article>
    </div>
    <div class="admin-kyc-review-panel">
      <h3>Review and screening</h3>
      <div class="admin-kyc-approval-note"><strong>Approval requirements</strong><ul><li>Identity verification: <b>Verified</b></li><li>Document authenticity: <b>Verified</b></li><li>Address verification: <b>Verified</b></li><li>Background check: <b>Clear</b></li><li>Criminal record: <b>Clear</b></li><li>Sanctions / PEP: <b>Clear</b></li><li>Adverse media: <b>Clear</b></li><li>Employment verification: <b>Clear</b></li><li>NDA and Acceptable Use Policy: <b>Accepted</b></li></ul><small>Approval remains unavailable until every requirement above is satisfied.</small></div>
      <div class="admin-kyc-review-grid">
        <label>Identity verification<select class="${kycFieldStateClass(application.identityVerificationStatus || 'PENDING')}" name="identityVerificationStatus">${kycVerificationOptions.map((value) => `<option value="${value}" ${value === (application.identityVerificationStatus || 'PENDING') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Document authenticity<select class="${kycFieldStateClass(application.documentVerificationStatus || 'PENDING')}" name="documentVerificationStatus">${kycVerificationOptions.map((value) => `<option value="${value}" ${value === (application.documentVerificationStatus || 'PENDING') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Address verification<select class="${kycFieldStateClass(application.addressVerificationStatus || 'PENDING')}" name="addressVerificationStatus">${kycVerificationOptions.map((value) => `<option value="${value}" ${value === (application.addressVerificationStatus || 'PENDING') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Background check<select class="${kycFieldStateClass(application.backgroundCheckStatus || 'NOT_STARTED')}" name="backgroundCheckStatus">${kycScreeningOptions.map((value) => `<option value="${value}" ${value === (application.backgroundCheckStatus || 'NOT_STARTED') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Criminal record<select class="${kycFieldStateClass(application.criminalRecordStatus || 'NOT_STARTED')}" name="criminalRecordStatus">${kycScreeningOptions.map((value) => `<option value="${value}" ${value === (application.criminalRecordStatus || 'NOT_STARTED') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Sanctions / PEP<select class="${kycFieldStateClass(application.sanctionsPepStatus || 'NOT_STARTED')}" name="sanctionsPepStatus">${kycScreeningOptions.map((value) => `<option value="${value}" ${value === (application.sanctionsPepStatus || 'NOT_STARTED') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Adverse media<select class="${kycFieldStateClass(application.adverseMediaStatus || 'NOT_STARTED')}" name="adverseMediaStatus">${kycScreeningOptions.map((value) => `<option value="${value}" ${value === (application.adverseMediaStatus || 'NOT_STARTED') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Employment verification<select class="${kycFieldStateClass(application.employmentVerificationStatus || 'NOT_STARTED')}" name="employmentVerificationStatus">${kycScreeningOptions.map((value) => `<option value="${value}" ${value === (application.employmentVerificationStatus || 'NOT_STARTED') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
        <label>Verification provider<input name="verificationProvider" value="${escapeHtml(application.verificationProvider || '')}"></label>
        <label>Verification reference<input name="verificationReference" value="${escapeHtml(application.verificationReference || '')}"></label>
        <label>Decision<select name="status">${kycStatusOptions.map((value) => `<option value="${value}" ${value === status ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>Access tier<select name="accessTier">${kycAccessOptions.map((value) => `<option value="${value}" ${value === (application.accessTier || 'LEVEL_1_SUPPORT') ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`).join('')}</select></label>
      </div>
      <div class="admin-kyc-agreements">
        <label class="admin-kyc-agreement"><input name="ndaSigned" type="checkbox" ${signed ? 'checked' : ''}><span><strong>NDA signed</strong><small>Confidentiality agreement completed</small></span></label>
        <label class="admin-kyc-agreement"><input name="acceptableUsePolicyAccepted" type="checkbox" ${policyAccepted ? 'checked' : ''}><span><strong>Acceptable Use Policy accepted</strong><small>Usage policy accepted by applicant</small></span></label>
      </div>
      <label>Review notes<textarea name="reviewReason" rows="4" maxlength="1000" placeholder="Add review notes or rejection reasons">${escapeHtml(defaultReviewReason)}</textarea></label>
      <label>Screening notes<textarea name="screeningNotes" rows="3" maxlength="2000" placeholder="Screening comments">${escapeHtml(application.screeningNotes || '')}</textarea></label>
    </div>
    <div class="admin-kyc-actions">
      <div class="admin-kyc-action-bar">
        <button class="primary-button" type="submit">Save review</button>
        <button class="ghost-button" type="button" data-kyc-close="${application.id}">Close</button>
      </div>
    </div>
  `;
  kycDetailForm.innerHTML = formMarkup;
  kycDetailForm.dataset.kycId = application.id;
  kycDetailEmpty.hidden = true;
  kycDetailForm.hidden = false;
  kycDetailForm.querySelectorAll('select[name$="VerificationStatus"], select[name$="Status"]').forEach((select) => { select.addEventListener('change', () => { select.classList.remove('kyc-field-approved', 'kyc-field-pending', 'kyc-field-blocked'); select.classList.add(kycFieldStateClass(select.value)); }); });
  const closeButton = kycDetailForm.querySelector('[data-kyc-close]');
  closeButton?.addEventListener('click', closeKycReview);
}
async function loadKycApplications() {
  if (!roleCanAccess('users.manage')) return; try {
    const result = await adminJson('/api/v1/users/kyc'); if (!result) return; const applications = result.data || []; window.__kycApplications = applications; const searchTerm = String(document.querySelector('#kycSearch')?.value || '').trim().toLowerCase(); const selectedFilter = document.querySelector('#kycStatusFilter')?.value || 'ALL'; const filteredApplications = applications.filter((application) => {
      const matchesSearch = !searchTerm || `${getKycFullName(application)} ${application.user?.email || ''} ${application.documentType || ''}`.toLowerCase().includes(searchTerm);
      const matchesStatus = selectedFilter === 'ALL' || String(application.status || 'PENDING') === selectedFilter;
      return matchesSearch && matchesStatus;
    });
    const pendingKycCount = applications.filter((item) => !['APPROVED', 'REJECTED'].includes(String(item.status || 'PENDING').toUpperCase())).length;
    document.querySelector('#kycCount').textContent = `${pendingKycCount} pending`;
    document.querySelector('#kycTableBody').innerHTML = filteredApplications.length ? filteredApplications.map((application) => {
      const applicantName = getKycFullName(application);
      const status = application.status || 'PENDING';
      return `<tr><td><strong>${escapeHtml(applicantName)}</strong><small>${escapeHtml(application.user?.email || 'No email')}</small></td><td><strong>${escapeHtml(application.documentType || 'Identity document')}</strong><small>${escapeHtml(application.documentNumber || 'Not provided')}</small></td><td>${new Date(application.submittedAt || Date.now()).toLocaleDateString()}</td><td>${escapeHtml(String(application.accessTier || 'LEVEL_1_SUPPORT').replaceAll('_', ' '))}</td><td><span class="kyc-status-badge ${kycStatusClass(status)}">${escapeHtml(status)}</span></td><td><div class="kyc-table-actions"><button class="ghost-button" type="button" data-kyc-action="view" data-kyc-id="${application.id}">View</button><button class="primary-button" type="button" data-kyc-action="process" data-kyc-id="${application.id}">Process</button></div></td></tr>`;
    }).join('') : '<tr><td colspan="6" class="table-empty">No KYC applications match this filter.</td></tr>';
    closeKycReview();
  } catch (error) { showToast(error.message, 'error'); }
}
const kycTableBody = document.querySelector('#kycTableBody');
kycTableBody?.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-kyc-action]');
  if (!actionButton) return;
  const application = (window.__kycApplications || []).find((item) => String(item.id) === String(actionButton.dataset.kycId));
  if (application) openKycReview(application, actionButton.dataset.kycAction);
});
document.querySelector('#kycBackToList')?.addEventListener('click', closeKycReview);
document.querySelector('#kycDetailPanel')?.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeKycReview(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.querySelector('#kycDetailPanel.is-open')) closeKycReview(); });
kycDetailForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const applicationId = form.dataset.kycId;
  if (!applicationId) return;
  const data = new FormData(form);
  const payload = {
    status: data.get('status') || 'PROCESSING',
    reviewReason: data.get('reviewReason') || '',
    identityVerificationStatus: data.get('identityVerificationStatus'),
    documentVerificationStatus: data.get('documentVerificationStatus'),
    addressVerificationStatus: data.get('addressVerificationStatus'),
    backgroundCheckStatus: data.get('backgroundCheckStatus'),
    criminalRecordStatus: data.get('criminalRecordStatus'),
    sanctionsPepStatus: data.get('sanctionsPepStatus'),
    adverseMediaStatus: data.get('adverseMediaStatus'),
    employmentVerificationStatus: data.get('employmentVerificationStatus'),
    screeningNotes: data.get('screeningNotes') || '',
    accessTier: data.get('accessTier') || 'LEVEL_1_SUPPORT',
    verificationProvider: data.get('verificationProvider') || '',
    verificationReference: data.get('verificationReference') || '',
    ndaSigned: data.get('ndaSigned') === 'on',
    acceptableUsePolicyAccepted: data.get('acceptableUsePolicyAccepted') === 'on'
  };
  if (payload.status === 'APPROVED') {
    const approvalRequirements = [
      ['identityVerificationStatus', 'Identity verification must be Verified.'],
      ['documentVerificationStatus', 'Document authenticity must be Verified.'],
      ['addressVerificationStatus', 'Address verification must be Verified.'],
      ['backgroundCheckStatus', 'Background check must be Clear.'],
      ['criminalRecordStatus', 'Criminal record must be Clear.'],
      ['sanctionsPepStatus', 'Sanctions / PEP must be Clear.'],
      ['adverseMediaStatus', 'Adverse media must be Clear.'],
      ['employmentVerificationStatus', 'Employment verification must be Clear.']
    ];
    const unmet = approvalRequirements.find(([field, message]) => {
      const value = payload[field];
      const requiredValue = field.endsWith('VerificationStatus') ? 'VERIFIED' : 'CLEAR';
      return value !== requiredValue ? message : null;
    })?.[1];
    if (unmet || !payload.ndaSigned || !payload.acceptableUsePolicyAccepted) {
      showToast(unmet || 'Both NDA and Acceptable Use Policy agreements must be accepted before approval.', 'warning');
      return;
    }
  }
  try {
    await adminJson(`/api/v1/users/kyc/${applicationId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await loadKycApplications();
    showToast('KYC review saved.');
  } catch (error) { showToast(error.message, 'error'); }
});
document.querySelector('#kycSearch')?.addEventListener('input', () => { void loadKycApplications(); });
document.querySelector('#kycStatusFilter')?.addEventListener('change', () => { void loadKycApplications(); });
function createAdminProfilePanel() { const settings = document.querySelector('#settings'); if (!settings || document.querySelector('#adminProfile')) return; settings.insertAdjacentHTML('beforebegin', '<section class="panel utility-panel" id="adminProfile"><div class="panel-heading"><div><p class="eyebrow">Account</p><h2>My profile</h2></div></div><form class="settings-form" id="adminProfileForm"><div class="profile-identity"><div class="profile-avatar" id="adminProfileAvatar">A</div><div><label>Profile image<input id="adminProfileImage" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><small id="adminJoinedDate">Joined</small></div></div><div class="admin-field-grid"><label>First name<input name="firstName" required></label><label>Last name<input name="lastName" required></label></div><label>Email<input name="email" type="email" disabled></label><button class="primary-button" type="submit">Save profile</button><p id="adminProfileMessage"></p></form><form class="settings-form" id="adminPasswordForm"><div class="panel-label">Password</div><div class="admin-field-grid"><label>Current password<input name="currentPassword" type="password" required></label><label>New password<input name="newPassword" type="password" minlength="8" required></label></div><button class="ghost-button" type="submit">Update password</button><p id="adminPasswordMessage"></p></form></section>'); }
function enhanceAdminProfilePanel() { const panel = document.querySelector('#adminProfile'); if (!panel || panel.querySelector('#adminAddressForm')) return; panel.insertAdjacentHTML('beforeend', '<section class="settings-form admin-profile-tab-panel" data-admin-profile-panel="addresses"><div class="panel-label">Saved addresses</div><div class="admin-address-list" id="adminAddressList"><p class="table-empty">Loading addresses...</p></div><form class="admin-address-form" id="adminAddressForm"><div class="admin-field-grid"><label>Full name<input name="fullName" required></label><label>Phone<input name="phone" required></label></div><div class="admin-field-grid"><label>Country<input name="country" required></label><label>City<input name="city" required></label></div><label>Address<input name="addressLine1" required></label><label>GPS address / landmark <small>(optional)</small><input name="instructions"></label><label class="check-row"><input name="isDefault" type="checkbox"> Make this the default address</label><button class="primary-button" type="submit">Add address <span>↗</span></button><p id="adminAddressMessage"></p></form></section><section class="settings-form admin-profile-tab-panel" data-admin-profile-panel="kyc"><div class="panel-label">KYC submission <span id="adminKycStatus">NOT SUBMITTED</span></div><p class="admin-profile-help">Submit your identity details for compliance review. Approved submissions can be updated and will return to pending review.</p><form id="adminKycForm"><div class="admin-field-grid"><label>Document type<input name="documentType" placeholder="National ID or passport" required></label><label>Document number<input name="documentNumber" required></label></div><label>Identity document<input name="document" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small>Choose a new file only when replacing the current document.</small></label><label>Notes<textarea name="notes" rows="3" maxlength="1000"></textarea><button class="primary-button" type="submit">Submit KYC for review <span>↗</span></button><p id="adminKycMessage"></p></form></section>'); }
function setupAdminProfileTabs() { const panel = document.querySelector('#adminProfile'); if (!panel || panel.dataset.tabsReady) return; const panels = [...panel.querySelectorAll('.settings-form')]; if (panels.length < 4) return; panel.dataset.tabsReady = 'true'; const tabs = document.createElement('div'); tabs.className = 'profile-tabs'; tabs.setAttribute('role', 'tablist');['Profile', 'Security', 'Addresses', 'KYC'].forEach((label, index) => { const tab = document.createElement('button'); tab.type = 'button'; tab.className = `profile-tab${index === 0 ? ' active' : ''}`; tab.textContent = label; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false'); tab.addEventListener('click', () => { tabs.querySelectorAll('.profile-tab').forEach((item, itemIndex) => { const active = itemIndex === index; item.classList.toggle('active', active); item.setAttribute('aria-selected', active ? 'true' : 'false'); panels[itemIndex].hidden = !active; }); }); tabs.appendChild(tab); }); panels.forEach((panelItem, index) => { panelItem.classList.add('admin-profile-tab-panel'); panelItem.hidden = index !== 0; }); panel.querySelector('.panel-heading')?.after(tabs); }
function renderAdminAddresses(addresses) { const list = document.querySelector('#adminAddressList'); if (!list) return; list.innerHTML = addresses.length ? addresses.map((address) => `<article class="admin-address-card"><div><strong>${escapeHtml(address.fullName)}</strong><small>${escapeHtml(address.addressLine1)}, ${escapeHtml(address.city)}, ${escapeHtml(address.country)}${address.instructions ? ` · ${escapeHtml(address.instructions)}` : ''}<br>${escapeHtml(address.phone)}</small></div>${address.isDefault ? '<b>Default</b>' : ''}</article>`).join('') : '<p class="table-empty">No saved addresses yet.</p>'; }
async function loadAdminProfile() { createAdminProfilePanel(); enhanceAdminProfilePanel(); setupAdminProfileTabs(); if (location.hash === '#adminProfile') switchView('#adminProfile'); try { const [profileResult, addressResult] = await Promise.all([adminJson('/api/v1/users/me'), adminJson('/api/v1/addresses')]); if (!profileResult) return; const user = profileResult.data; const form = document.querySelector('#adminProfileForm'); form.elements.firstName.value = user.firstName; form.elements.lastName.value = user.lastName; form.elements.email.value = user.email; document.querySelector('#adminJoinedDate').textContent = `Joined ${new Date(user.createdAt).toLocaleDateString()}`; document.querySelector('#adminProfileAvatar').innerHTML = user.avatarUrl ? `<img src="${resolveMediaUrl(user.avatarUrl)}" alt="">` : escapeHtml(user.firstName.charAt(0).toUpperCase()); renderAdminAddresses(addressResult?.data || []); const kyc = user.kycApplication; document.querySelector('#adminKycStatus').textContent = kyc?.status || 'NOT SUBMITTED'; const kycForm = document.querySelector('#adminKycForm'); if (kycForm) { kycForm.elements.documentType.value = kyc?.documentType || ''; kycForm.elements.documentNumber.value = kyc?.documentNumber || ''; kycForm.elements.notes.value = kyc?.notes || ''; if (kyc) { const previews = { documents: Array.isArray(kyc.documents) ? kyc.documents : (kyc.documentUrl ? [kyc.documentUrl] : []), proofOfAddress: kyc.proofOfAddressUrl ? [kyc.proofOfAddressUrl] : [], selfie: kyc.selfieUrl ? [kyc.selfieUrl] : [] }; Object.entries(previews).forEach(([type, urls]) => { const list = kycForm.querySelector(`[data-kyc-preview-list="${type}"]`); if (list) list.innerHTML = urls.map((url, index) => renderPersistedAdminKycPreview(url, type, index)).join(''); }); renderAdminKycReviewSummary(kycForm, kyc); } } } catch (error) { showToast(error.message, 'error'); } finally { if (location.hash === '#adminProfile') setTimeout(() => { const profile = document.querySelector('#adminProfile'); document.querySelectorAll('.admin-main > section').forEach((section) => { section.hidden = section !== profile; }); if (profile) profile.hidden = false; document.querySelectorAll('.admin-sidebar nav a').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === '#adminProfile')); }, 0); } }
document.addEventListener('submit', async (event) => { if (event.target.id === 'adminProfileForm') { event.preventDefault(); const data = new FormData(event.target); const result = await adminJson('/api/v1/users/me', { method: 'PATCH', body: JSON.stringify({ firstName: data.get('firstName'), lastName: data.get('lastName') }) }); document.querySelector('#adminProfileMessage').textContent = result ? 'Profile updated.' : 'Could not update profile.'; } if (event.target.id === 'adminPasswordForm') { event.preventDefault(); const result = await adminJson('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); document.querySelector('#adminPasswordMessage').textContent = result?.message || 'Password updated.'; event.target.reset(); } });
document.addEventListener('submit', async (event) => { if (event.target.id === 'adminAddressForm') { event.preventDefault(); const form = event.target; const result = await adminJson('/api/v1/addresses', { method: 'POST', body: JSON.stringify({ fullName: form.elements.fullName.value, phone: form.elements.phone.value, country: form.elements.country.value, city: form.elements.city.value, addressLine1: form.elements.addressLine1.value, instructions: form.elements.instructions.value, isDefault: form.elements.isDefault.checked }) }); if (result) { document.querySelector('#adminAddressMessage').textContent = 'Address saved.'; form.reset(); const addresses = await adminJson('/api/v1/addresses'); renderAdminAddresses(addresses?.data || []); } } });
document.addEventListener('change', async (event) => { if (event.target.id !== 'adminProfileImage') return; const file = event.target.files?.[0]; if (!file) return; const formData = new FormData(); formData.append('image', file); const response = await fetch(`${API_BASE}/api/v1/media/avatar`, { method: 'POST', headers: { Authorization: adminApiHeaders()?.Authorization || '' }, body: formData }); if (!response.ok) return showToast('Could not upload profile image.', 'error'); const result = await response.json(); document.querySelector('#adminProfileAvatar').innerHTML = `<img src="${escapeHtml(resolveMediaUrl(result.data.avatarUrl))}" alt="">`; });
function permissionForHash(hash) {
  if (!hash || hash === '#dashboard') return 'products.read';
  if (hash === '#orders') return 'orders.read';
  if (hash === '#inventory') return 'inventory.read';
  if (hash === '#customers') return 'users.read';
  if (hash === '#users') return 'users.read';
  if (hash === '#kyc') return 'users.manage';
  if (hash === '#performance') return 'reports.read';
  if (hash === '#products') return 'products.update';
  if (hash === '#promotions') return 'coupons.manage';
  if (hash === '#categories') return 'products.update';
  if (hash === '#activity') return 'users.manage';
  if (hash === '#chat' || hash === '#adminReturns') return 'orders.refund';
  if (hash === '#settings' || hash === '#settingsDetails') return 'settings.update';
  return '';
}
function rebuildAdminSidebar(role = currentAdminRole || '') {
  const administrator = ['ADMIN', 'SUPER_ADMIN'].includes(role);
  const navs = Array.from(document.querySelectorAll('.admin-sidebar nav'));
  navs.forEach((nav) => {
    const anchors = Array.from(nav.querySelectorAll('a[href^="#"]'));
    anchors.forEach((link) => {
      const hash = link.getAttribute('href');
      const permission = permissionForHash(hash);
      if (permission && !roleCanAccess(permission)) {
        link.hidden = true;
        link.setAttribute('aria-hidden', 'true');
      } else {
        link.hidden = false;
        link.removeAttribute('aria-hidden');
      }
    });
  });
  const workspaceNav = document.querySelector('.admin-sidebar nav');
  if (!workspaceNav) return;
  const dashboardLink = workspaceNav.querySelector('a[href="#dashboard"]');
  const ordersLink = workspaceNav.querySelector('a[href="#orders"]');
  const inventoryLink = workspaceNav.querySelector('a[href="#inventory"]');
  const customersLink = workspaceNav.querySelector('a[href="#customers"]');
  const performanceLink = workspaceNav.querySelector('a[href="#performance"]');
  const activityLink = workspaceNav.querySelector('a[href="#activity"]');
  const profileNav = document.createElement('a');
  profileNav.href = '#adminProfile';
  profileNav.innerHTML = '<span><i class="fa-solid fa-user"></i></span><b class="nav-text">Profile</b>';
  profileNav.title = 'Profile';
  profileNav.addEventListener('click', (event) => { event.preventDefault(); switchView('#adminProfile'); void loadAdminProfile(); void refreshAdminKycProfileState(); setTimeout(restoreAdminProfileTab, 800); });

  const orderedLinks = [dashboardLink, profileNav];
  if (administrator) {
    const usersNav = document.createElement('a');
    usersNav.href = '#users';
    usersNav.innerHTML = '<span><i class="fa-solid fa-user-gear"></i></span><b class="nav-text">Users</b>';
    usersNav.title = 'Users';
    usersNav.addEventListener('click', (event) => { event.preventDefault(); switchView('#users'); });

    const kycNav = document.createElement('a');
    kycNav.href = '#kyc';
    kycNav.innerHTML = '<span><i class="fa-solid fa-shield-halved"></i></span><b class="nav-text">KYC</b>';
    kycNav.title = 'KYC';
    kycNav.addEventListener('click', (event) => { event.preventDefault(); switchView('#kyc'); void loadKycApplications(); });
    orderedLinks.push(usersNav, kycNav);
  }
  if (administrator || role === 'STAFF') {
    orderedLinks.push(ordersLink, inventoryLink);
    if (administrator) orderedLinks.push(customersLink);
    orderedLinks.push(performanceLink, activityLink);
  }
  const manageNav = document.querySelectorAll('.admin-sidebar nav')[1] || null;
  if (manageNav) {
    const settingsLink = manageNav.querySelector('a[href="#settings"]');
    const settingsDetailsLink = manageNav.querySelector('a[href="#settingsDetails"]');
    if (settingsLink && !roleCanAccess('settings.update')) { settingsLink.hidden = true; }
    if (settingsDetailsLink && !roleCanAccess('settings.update')) { settingsDetailsLink.hidden = true; }
    const productsLink = manageNav.querySelector('a[href="#products"]');
    const promotionsLink = manageNav.querySelector('a[href="#promotions"]');
    const categoriesLink = manageNav.querySelector('a[href="#categories"]');
    if (productsLink && !roleCanAccess('products.update')) { productsLink.hidden = true; }
    if (promotionsLink && !roleCanAccess('coupons.manage')) { promotionsLink.hidden = true; }
    if (categoriesLink && !roleCanAccess('products.update')) { categoriesLink.hidden = true; }
  }
  workspaceNav.replaceChildren(...orderedLinks.filter(Boolean));
  workspaceNav.querySelectorAll('a').forEach((link) => {
    const label = link.querySelector('.nav-text')?.textContent?.trim();
    if (label && !link.title) link.title = label;
  });
}
rebuildAdminSidebar(currentAdminRole);
loadUsers();
loadKycApplications();
loadAdminProfile();
void refreshAdminKycProfileState();
setTimeout(restoreAdminProfileTab, 400);
const uploadSelectedMediaWithPreservation = uploadSelectedMedia;
uploadSelectedMedia = async () => { if (selectedMedia.length || !editingProductId) return uploadSelectedMediaWithPreservation(); const existing = products.find((entry) => String(entry.id) === String(editingProductId)); return (existing?.images || (existing?.image ? [existing.image] : [])).map((url) => ({ url, altText: existing?.name })); };
window.addEventListener('load', () => switchView(location.hash || '#dashboard'));
document.addEventListener('click', (event) => { const tab = event.target.closest('#adminProfile .profile-tabs .profile-tab'); if (!tab) return; const tabs = [...document.querySelectorAll('#adminProfile .profile-tabs .profile-tab')]; const panels = [...document.querySelectorAll('#adminProfile .admin-profile-tab-panel')]; const index = tabs.indexOf(tab); if (index < 0) return; tabs.forEach((item, itemIndex) => { const active = itemIndex === index; item.classList.toggle('active', active); item.setAttribute('aria-selected', active ? 'true' : 'false'); }); panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; }); }, false);
const syncAdminProfileTabs = () => { const tabs = [...document.querySelectorAll('#adminProfile .profile-tabs .profile-tab')]; const panels = [...document.querySelectorAll('#adminProfile .admin-profile-tab-panel')]; if (tabs.length !== panels.length) return; tabs.forEach((tab, index) => { if (tab.dataset.syncBound) return; tab.dataset.syncBound = 'true'; tab.addEventListener('click', () => { tabs.forEach((item, itemIndex) => { const active = itemIndex === index; item.classList.toggle('active', active); item.setAttribute('aria-selected', active ? 'true' : 'false'); }); panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; }); }); }); };
const adminProfileTabsObserver = new MutationObserver(syncAdminProfileTabs);
adminProfileTabsObserver.observe(document.body, { childList: true, subtree: true });
syncAdminProfileTabs();
function restoreAdminProfileTab() {
  const storedTab = localStorage.getItem('ground-admin-profile-tab') || 'profile';
  const tabs = [...document.querySelectorAll('#adminProfile .profile-tabs .profile-tab')];
  const panels = [...document.querySelectorAll('#adminProfile .admin-profile-tab-panel')];
  const index = ['profile', 'security', 'addresses', 'kyc'].indexOf(storedTab);
  if (index < 0 || !tabs[index] || !panels[index]) return;
  tabs.forEach((tab, tabIndex) => { const active = tabIndex === index; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', active ? 'true' : 'false'); });
  panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
  setAdminKycSubmissionState(document.querySelector('#adminKycForm'), document.querySelector('#adminKycStatus')?.textContent);
}
document.addEventListener('click', (event) => { const tab = event.target.closest('#adminProfile .profile-tabs .profile-tab'); if (!tab) return; const tabs = [...document.querySelectorAll('#adminProfile .profile-tabs .profile-tab')]; const names = ['profile', 'security', 'addresses', 'kyc']; const index = tabs.indexOf(tab); if (index >= 0) localStorage.setItem('ground-admin-profile-tab', names[index]); });
document.addEventListener('pointerup', (event) => { const tab = event.target.closest('#adminProfile .profile-tabs .profile-tab'); if (!tab) return; setTimeout(() => { const tabs = [...document.querySelectorAll('#adminProfile .profile-tabs .profile-tab')]; const panels = [...document.querySelectorAll('#adminProfile .admin-profile-tab-panel')]; const index = tabs.indexOf(tab); if (index < 0 || tabs.length !== panels.length) return; tabs.forEach((item, itemIndex) => { const active = itemIndex === index; item.classList.toggle('active', active); item.setAttribute('aria-selected', active ? 'true' : 'false'); }); panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; }); }, 0); });
const enhanceAdminKycWorkflow = async () => {
  const form = document.querySelector('#adminKycForm');
  if (!form || form.dataset.internalWorkflowReady) return;
  form.dataset.internalWorkflowReady = 'true';
  const documentTypeInput = form.elements.documentType;
  if (documentTypeInput?.tagName === 'INPUT') { const select = document.createElement('select'); select.name = 'documentType'; select.required = true; select.innerHTML = '<option value="">Choose document type</option><option value="PASSPORT">Passport</option><option value="NATIONAL_ID">National ID card</option><option value="DRIVERS_LICENSE">Driver license</option><option value="RESIDENCE_PERMIT">Residence permit</option>'; select.value = documentTypeInput.value || ''; documentTypeInput.replaceWith(select); }
  const documentInput = form.elements.document;

  function bindAdminKycPolicyAndCamera(form) { form.querySelectorAll('[data-policy]').forEach((link) => link.addEventListener('click', (event) => { if (link.getAttribute('href') !== '#') return; event.preventDefault(); const nda = link.dataset.policy === 'nda'; void window.Swal?.fire({ icon: 'info', title: nda ? 'NDA and confidentiality agreement' : 'Acceptable Use Policy', text: nda ? 'Protect customer data, payment information, credentials, documents, and internal systems. Unauthorized disclosure or access may result in immediate access removal and disciplinary or legal action.' : 'Use only authorized access, protect credentials, report incidents, and never export or disclose customer data without permission.', confirmButtonText: 'I understand', buttonsStyling: false, customClass: { popup: 'admin-swal-popup', confirmButton: 'admin-swal-confirm' } }); })); const cameraButton = form.querySelector('[data-open-selfie-camera]'); if (!cameraButton || cameraButton.dataset.bound) return; cameraButton.dataset.bound = 'true'; cameraButton.addEventListener('click', async () => { if (!navigator.mediaDevices?.getUserMedia) return window.Swal?.fire({ icon: 'warning', title: 'Camera unavailable', text: 'Upload a selfie image instead.' }); const modal = document.createElement('div'); modal.className = 'kyc-camera-modal'; modal.innerHTML = '<div class="kyc-camera-card"><h3>Live selfie</h3><video autoplay playsinline></video><canvas hidden></canvas><div><button type="button" class="primary-button" data-capture-selfie>Capture selfie</button><button type="button" class="ghost-button" data-close-selfie>Cancel</button></div><p>Allow camera access, center your face, and capture.</p></div>'; document.body.appendChild(modal); const video = modal.querySelector('video'); let stream; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); video.srcObject = stream; } catch { modal.remove(); return window.Swal?.fire({ icon: 'warning', title: 'Camera access denied', text: 'Allow camera access or upload a selfie image instead.' }); } const close = () => { stream?.getTracks().forEach((track) => track.stop()); modal.remove(); }; modal.querySelector('[data-close-selfie]').addEventListener('click', close); const refreshSelfiePreview = () => { const list = form.querySelector('[data-kyc-preview-list="selfie"]'); if (!list) return; const files = form.elements.selfie?.files ? Array.from(form.elements.selfie.files) : []; list.innerHTML = files.length ? files.map((file) => renderAdminKycPreviewCard(file, 'selfie')).join('') : ''; }; modal.querySelector('[data-capture-selfie]').addEventListener('click', () => { const canvas = modal.querySelector('canvas'); canvas.width = video.videoWidth || 0; canvas.height = video.videoHeight || 0; const context = canvas.getContext('2d'); if (!context || !canvas.width || !canvas.height) return; context.drawImage(video, 0, 0, canvas.width, canvas.height); canvas.toBlob((blob) => { if (!blob) return; const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }); const transfer = new DataTransfer(); transfer.items.add(file); form.elements.selfie.files = transfer.files; form.elements.selfie.dispatchEvent(new Event('change', { bubbles: true })); form.querySelector('[data-selfie-status]').textContent = 'Live selfie captured.'; refreshSelfiePreview(); close(); }, 'image/jpeg', .92); }); }); }
  const documentLabel = documentInput?.closest('label');
  if (!documentLabel) return;
  documentInput.name = 'documents';
  documentInput.multiple = true;
  documentInput.required = true;
  documentLabel.firstChild.textContent = 'Government-issued photo ID';
  documentLabel.querySelector('small')?.remove();
  documentLabel.insertAdjacentHTML('afterend', '<div class="admin-kyc-workflow"><div class="panel-label">Identity and residence</div><label>Aliases or maiden names <small>(optional)</small><input name="aliases" maxlength="500"></label><div class="admin-field-grid"><label>Date of birth<input name="dateOfBirth" type="date" required></label><label>Nationality<input name="nationality" maxlength="80" required></label></div><label>Current residential address<textarea name="currentAddress" rows="3" maxlength="500" required></textarea></label><label>Previous addresses <small>(one per line, covering the past 3–5 years)</small><textarea name="previousAddresses" rows="3" maxlength="2500"></textarea></label><label>Proof of address <small>(utility bill or bank statement from the last 3 months)</small><input name="proofOfAddress" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" required></label><label>Live selfie<div class="kyc-selfie-control"><input name="selfie" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required><button type="button" class="ghost-button" data-open-selfie-camera>Open camera</button></div><small data-selfie-status>Use your camera for a live selfie, or upload an image.</small></label><div class="panel-label">Access tier and agreements</div><label>Requested access tier<select name="accessTier"><option value="LEVEL_1_SUPPORT">Level 1 · Basic support</option><option value="LEVEL_2_OPERATIONS">Level 2 · Operations and inventory</option><option value="LEVEL_3_FINANCE_EXECUTIVE">Level 3 · Finance and executive</option></select></label><label class="check-row"><input name="ndaSigned" type="checkbox" required> <span>I have signed the <a href="/nda_confidentiality_agreement.pdf" target="_blank" rel="noopener" data-policy="nda">NDA and confidentiality agreement</a>.</span></label><label class="check-row"><input name="acceptableUsePolicyAccepted" type="checkbox" required> <span>I accept the <a href="/acceptable_use_policy.pdf" target="_blank" rel="noopener" data-policy="aup">Acceptable Use Policy</a>.</span></label><div class="kyc-upload-preview-grid"><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Identity document</div><div class="kyc-upload-preview-list" data-kyc-preview-list="documents"></div></div><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Proof of address</div><div class="kyc-upload-preview-list" data-kyc-preview-list="proofOfAddress"></div></div><div class="kyc-upload-preview-block"><div class="kyc-upload-preview-title">Selfie</div><div class="kyc-upload-preview-list" data-kyc-preview-list="selfie"></div></div></div></div>');
  bindAdminKycPolicyAndCamera(form);
  bindAdminKycUploadPreview(form);
  try {
    const result = await adminJson('/api/v1/users/me');
    const kyc = result?.data?.kycApplication;
    if (!kyc) return;
    ['aliases', 'nationality', 'currentAddress', 'dateOfBirth', 'accessTier'].forEach((name) => { if (form.elements[name] && kyc[name]) form.elements[name].value = name === 'dateOfBirth' ? new Date(kyc[name]).toISOString().slice(0, 10) : kyc[name]; });
    if (form.elements.previousAddresses && Array.isArray(kyc.previousAddresses)) form.elements.previousAddresses.value = kyc.previousAddresses.join('\n');
    form.elements.ndaSigned.checked = Boolean(kyc.ndaSigned); form.elements.acceptableUsePolicyAccepted.checked = Boolean(kyc.acceptableUsePolicyAccepted);
    const previews = { documents: Array.isArray(kyc.documents) ? kyc.documents : (kyc.documentUrl ? [kyc.documentUrl] : []), proofOfAddress: kyc.proofOfAddressUrl ? [kyc.proofOfAddressUrl] : [], selfie: kyc.selfieUrl ? [kyc.selfieUrl] : [] };
    Object.entries(previews).forEach(([type, urls]) => { const list = form.querySelector(`[data-kyc-preview-list="${type}"]`); if (list && urls.length) list.innerHTML = urls.map((url, index) => renderPersistedAdminKycPreview(url, type, index)).join(''); });
    renderAdminKycReviewSummary(form, kyc);
    setAdminKycSubmissionState(form, kyc.status);
  } catch { /* The form remains available for a fresh submission. */ }
};
function readAdminPreviewDataUrl(file) {
  return new Promise((resolve) => {
    if (!file?.type?.startsWith('image/')) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function renderAdminKycPreviewCard(file, type, imageSrc = '') {
  const size = file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'File';
  const isImage = file.type?.startsWith('image/');
  const ext = ((file.name || '').split('.').pop() || 'FILE').toUpperCase();
  const image = isImage ? `<img src="${imageSrc || ''}" alt="">` : `<span class="kyc-preview-file-icon">${file.type === 'application/pdf' ? 'PDF' : ext}</span>`;
  const fileName = escapeHtml(file.name);
  return `<article class="kyc-upload-preview-card kyc-upload-preview-${type}"><div class="kyc-upload-preview-media">${image}</div><div class="kyc-upload-preview-details"><strong>${fileName}</strong><small>${escapeHtml(type === 'documents' ? 'Identity document' : type === 'proofOfAddress' ? 'Proof of address' : 'Selfie')}${size ? ` · ${size}` : ''}</small></div></article>`;
}
function renderPersistedAdminKycPreview(url, type, index = 0) {
  const absoluteUrl = resolveMediaUrl(url);
  if (!absoluteUrl) return '';
  const fileName = absoluteUrl.split('/').pop()?.split('?')[0] || `${type}-${index + 1}`;
  const isImage = /\.(png|jpe?g|gif|webp|bmp)(?:\?|$)/i.test(absoluteUrl);
  const preview = isImage ? `<img src="${escapeHtml(absoluteUrl)}" alt="${escapeHtml(type)} preview" loading="lazy">` : `<span class="kyc-preview-file-icon">${escapeHtml(fileName.split('.').pop()?.toUpperCase() || 'FILE')}</span>`;
  return `<article class="kyc-upload-preview-card kyc-upload-preview-${type} kyc-upload-preview-persisted"><div class="kyc-upload-preview-media">${preview}</div><div class="kyc-upload-preview-details"><strong>${escapeHtml(fileName)}</strong><small>${escapeHtml(type === 'documents' ? 'Saved identity document' : type === 'proofOfAddress' ? 'Saved proof of address' : 'Saved selfie')}</small></div></article>`;
}
function renderAdminKycReviewSummary(form, kyc) {
  let summary = form.querySelector('.admin-kyc-review-summary');
  if (!summary) { summary = document.createElement('div'); summary.className = 'admin-kyc-review-summary'; form.prepend(summary); }
  const status = kyc?.status || 'NOT SUBMITTED';
  const checks = [['Identity', kyc?.identityVerificationStatus], ['Document', kyc?.documentVerificationStatus], ['Address', kyc?.addressVerificationStatus], ['Background', kyc?.backgroundCheckStatus], ['Criminal', kyc?.criminalRecordStatus], ['Sanctions / PEP', kyc?.sanctionsPepStatus]];
  summary.innerHTML = `<div><strong>Latest compliance review</strong><span class="kyc-status-badge ${kycStatusClass(status)}">${escapeHtml(status)}</span></div><p>${kyc?.reviewReason ? escapeHtml(kyc.reviewReason) : 'No reviewer note has been added.'}</p><div class="admin-kyc-review-summary-grid">${checks.map(([label, value]) => { const state = String(value || 'NOT_STARTED').toLowerCase(); return `<span class="kyc-review-state-${escapeHtml(state)}"><small>${escapeHtml(label)}</small><b>${escapeHtml(String(value || 'NOT_STARTED').replaceAll('_', ' '))}</b></span>`; }).join('')}</div>`;
}
function setAdminKycSubmissionState(form, status) {
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
function bindAdminKycUploadPreview(form) {
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
      src: await readAdminPreviewDataUrl(file)
    })));
    previewMap[type].innerHTML = imageFiles.length ? imageFiles.map(({ file, src }) => renderAdminKycPreviewCard(file, type, src)).join('') : '';
  };
  form.elements.documents?.addEventListener('change', () => refresh('documents', Array.from(form.elements.documents.files || [])));
  form.elements.proofOfAddress?.addEventListener('change', () => refresh('proofOfAddress', form.elements.proofOfAddress.files ? Array.from(form.elements.proofOfAddress.files) : []));
  form.elements.selfie?.addEventListener('change', () => refresh('selfie', form.elements.selfie.files ? Array.from(form.elements.selfie.files) : []));
  form.addEventListener('reset', () => {
    Object.values(previewMap).forEach((list) => { if (list) list.innerHTML = ''; });
  });
}
async function refreshAdminKycProfileState() {
  createAdminProfilePanel();
  enhanceAdminProfilePanel();
  setupAdminProfileTabs();
  const form = document.querySelector('#adminKycForm');
  if (!form) return;
  try {
    const result = await adminJson('/api/v1/users/me');
    const kyc = result?.data?.kycApplication;
    if (!kyc) return;
    ['aliases', 'nationality', 'currentAddress', 'dateOfBirth', 'accessTier'].forEach((name) => { if (form.elements[name] && kyc[name]) form.elements[name].value = name === 'dateOfBirth' ? new Date(kyc[name]).toISOString().slice(0, 10) : kyc[name]; });
    if (form.elements.documentType) form.elements.documentType.value = kyc.documentType || '';
    if (form.elements.documentNumber) form.elements.documentNumber.value = kyc.documentNumber || '';
    if (form.elements.previousAddresses && Array.isArray(kyc.previousAddresses)) form.elements.previousAddresses.value = kyc.previousAddresses.join('\n');
    if (form.elements.ndaSigned) form.elements.ndaSigned.checked = Boolean(kyc.ndaSigned);
    if (form.elements.acceptableUsePolicyAccepted) form.elements.acceptableUsePolicyAccepted.checked = Boolean(kyc.acceptableUsePolicyAccepted);
    const previews = { documents: Array.isArray(kyc.documents) ? kyc.documents : (kyc.documentUrl ? [kyc.documentUrl] : []), proofOfAddress: kyc.proofOfAddressUrl ? [kyc.proofOfAddressUrl] : [], selfie: kyc.selfieUrl ? [kyc.selfieUrl] : [] };
    Object.entries(previews).forEach(([type, urls]) => { const list = form.querySelector(`[data-kyc-preview-list="${type}"]`); if (list) list.innerHTML = urls.map((url, index) => renderPersistedAdminKycPreview(url, type, index)).join(''); });
    renderAdminKycReviewSummary(form, kyc);
    const status = document.querySelector('#adminKycStatus');
    if (status) status.textContent = kyc.status || 'NOT SUBMITTED';
    setAdminKycSubmissionState(form, kyc.status);
  } catch { /* Keep the profile usable if the refresh endpoint is unavailable. */ }
}
const adminKycWorkflowObserver = new MutationObserver(() => { void enhanceAdminKycWorkflow(); });
adminKycWorkflowObserver.observe(document.body, { childList: true, subtree: true });
void enhanceAdminKycWorkflow();
document.addEventListener('submit', async (event) => {
  const form = event.target.closest('#adminKycForm');
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (form.querySelector('button[type="submit"]')?.disabled) return;
  try {
    const files = Array.from(form.elements.documents?.files || []);
    const proofOfAddress = form.elements.proofOfAddress?.files?.[0];
    const selfie = form.elements.selfie?.files?.[0];
    if (!files.length || !proofOfAddress || !selfie || !form.elements.ndaSigned.checked || !form.elements.acceptableUsePolicyAccepted.checked) throw new Error('Upload your ID, proof of address, selfie, and accept both compliance agreements.');
    const upload = new FormData(); files.forEach((file) => upload.append('documents', file)); upload.append('proofOfAddress', proofOfAddress); upload.append('selfie', selfie);
    const uploadResponse = await fetch(`${API_BASE}/api/v1/media/kyc`, { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: upload });
    const uploadPayload = await uploadResponse.json().catch(() => ({})); if (!uploadResponse.ok) throw new Error(uploadPayload.error || 'Could not upload KYC documents.');
    const absolute = (url) => url && String(url).startsWith('http') ? url : `${API_BASE}${url}`;
    const previousAddresses = String(form.elements.previousAddresses?.value || '').split('\n').map((value) => value.trim()).filter(Boolean);
    const body = {
      documentType: String(form.elements.documentType?.value || '').trim(),
      documentNumber: String(form.elements.documentNumber?.value || '').trim(),
      documents: uploadPayload.data.documents.map(absolute),
      documentUrl: absolute(uploadPayload.data.documentUrl),
      proofOfAddressUrl: absolute(uploadPayload.data.proofOfAddressUrl),
      selfieUrl: absolute(uploadPayload.data.selfieUrl),
      aliases: String(form.elements.aliases?.value || '').trim() || undefined,
      dateOfBirth: String(form.elements.dateOfBirth?.value || '').trim() || undefined,
      nationality: String(form.elements.nationality?.value || '').trim() || undefined,
      currentAddress: String(form.elements.currentAddress?.value || '').trim() || undefined,
      previousAddresses: previousAddresses.length ? previousAddresses : undefined,
      accessTier: String(form.elements.accessTier?.value || 'LEVEL_1_SUPPORT').trim(),
      ndaSigned: Boolean(form.elements.ndaSigned.checked),
      acceptableUsePolicyAccepted: Boolean(form.elements.acceptableUsePolicyAccepted.checked),
      notes: String(form.elements.notes?.value || '').trim() || undefined
    };
    const result = await adminJson('/api/v1/users/me/kyc', { method: 'POST', body: JSON.stringify(body) });
    document.querySelector('#adminKycMessage').textContent = result ? 'KYC submitted for compliance review.' : 'Could not submit KYC.';
    document.querySelector('#adminKycStatus').textContent = result?.data?.status || 'PENDING';
  } catch (error) { document.querySelector('#adminKycMessage').textContent = error.message; }
}, true);