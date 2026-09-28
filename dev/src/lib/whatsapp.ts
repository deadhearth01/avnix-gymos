/** Click-to-chat link that opens WhatsApp with a prefilled message. */
export function waLink(phone: string | null | undefined, text?: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const to = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${to}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
