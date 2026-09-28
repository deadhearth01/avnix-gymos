/**
 * Derives a full, accessible theme from one gym brand colour. Injected as a
 * <style> on :root so portals (dialogs, menus, toasts) pick it up too.
 */
const HEX = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function brandThemeCss(color: string | null | undefined) {
  if (!color || !HEX.test(color) || color.toLowerCase() === "#16a34a") return "";
  const L = luminance(color);
  // pick the foreground with the better contrast ratio
  const onBrand = (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? "#0a0a0b" : "#ffffff";
  const darkBrand = L < 0.08 ? `color-mix(in oklab, ${color} 70%, white)` : color;
  return `:root{--primary:${color};--primary-foreground:${onBrand};--ring:${color};--sidebar-primary:${color};--sidebar-primary-foreground:${onBrand};--sidebar-ring:${color}}
.dark{--primary:${darkBrand};--primary-foreground:${L < 0.08 ? "#0a0a0b" : onBrand};--ring:${darkBrand};--sidebar-primary:${darkBrand};--sidebar-primary-foreground:${L < 0.08 ? "#0a0a0b" : onBrand};--sidebar-ring:${darkBrand}}`;
}
