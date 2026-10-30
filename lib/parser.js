export function normalize(text = '') {
  return String(text)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function extractHints(html) {
  const text = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return text.match(
    /Kode diperbarui:[\s\S]*?JANGAN SEBARKAN PASSCODE[\s\S]*?\)\.?/gi
  ) || [];
}

export function exactMatch(input, hints) {
  const query = normalize(input);

  if (!query) return null;

  return hints.find(
    hint => normalize(hint) === query
  ) || null;
}
