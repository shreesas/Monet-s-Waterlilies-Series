// Adapters that normalize Monet catalog entries and Japanese print entries
// into a single LightboxMetadata-shaped object the FullscreenLightbox
// understands. Japanese prints expose `collection`; we forward that into
// `location` so the lightbox renders one unified row.

export function monetToLightbox(entry) {
  if (!entry) return null;
  return {
    title: entry.title,
    year: entry.year,
    location: entry.collection || entry.location,
    imageUrl: entry.image_url,
  };
}

export function printToLightbox(entry, imgSrc) {
  if (!entry) return null;
  return {
    title: entry.title,
    artist: entry.artist,
    year: entry.year,
    location: entry.collection,
    imageUrl: imgSrc,
  };
}

// Catalog numbers in the JSON look like "W.1509". This pulls the integer so
// callers can do simple range filters.
export function catalogNumberToInt(catalogNumber) {
  if (!catalogNumber) return NaN;
  const match = String(catalogNumber).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : NaN;
}
