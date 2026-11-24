(() => {
  const defaultColors = {
    primary: '#20211d',
    accent: '#c7e86a'
  };
  const normalizeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  const contrastColor = (hex) => {
    const channels = hex.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255);
    const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance > 0.179 ? '#20211d' : '#ffffff';
  };

  window.applyBrandColors = (settings = {}) => {
    const primary = normalizeColor(settings.brandPrimaryColor, defaultColors.primary);
    const accent = normalizeColor(settings.brandAccentColor, defaultColors.accent);
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-primary-contrast', contrastColor(primary));
    root.style.setProperty('--brand-accent', accent);
    root.style.setProperty('--brand-accent-contrast', contrastColor(accent));
  };
})();
