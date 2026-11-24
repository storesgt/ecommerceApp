from pathlib import Path

p = Path('app.js')
s = p.read_text(encoding='utf-8', errors='ignore')
legacy_block_start = "document.addEventListener('submit', async (event) => { const form = event.target.closest('#profileKycForm'); if (!form) return; event.preventDefault(); event.stopImmediatePropagation(); try { const currentResponse = await fetch('http://localhost:4000/api/v1/users/me', { headers: apiHeaders() });"
legacy_block_end = "document.addEventListener('click', (event) => { const tab = event.target.closest('[data-profile-tab]'); if (!tab) return; const addressBook = document.querySelector('.address-book-panel'); if (addressBook) addressBook.hidden = tab.dataset.profileTab !== 'profile'; });"
start = s.find(legacy_block_start)
end = s.find(legacy_block_end, start) if start >= 0 else -1
if start >= 0 and end > start:
    s = s[:start] + s[end:]
    p.write_text(s, encoding='utf-8')
    print('removed stale KYC submit event from app.js')
else:
    print('legacy submit block not found')
