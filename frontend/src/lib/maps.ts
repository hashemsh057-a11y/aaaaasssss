export function getGoogleMapsSearchUrl(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return "https://www.google.com/maps";
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}
