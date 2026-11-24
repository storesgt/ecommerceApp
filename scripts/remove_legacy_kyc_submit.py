from pathlib import Path

path = Path(r'c:\Users\king\Desktop\ecommerceApp\app.js')
text = path.read_text(encoding='utf-8')
needle_start = "document.addEventListener('submit', async (event) => { const form = event.target.closest('#profileKycForm');"
needle_end = "document.addEventListener('click', (event) => { const tab = event.target.closest('[data-profile-tab]');"
start = text.index(needle_start)
end = text.index(needle_end, start)
new_text = text[:start] + text[end:]
path.write_text(new_text, encoding='utf-8')
print('legacy KYC submit block removed')
