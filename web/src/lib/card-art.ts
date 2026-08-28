/**
 * Card art lives in the project's Vercel Blob store, uploaded from L.J.'s
 * own OOTP cache by scripts/upload-card-art.mjs — deterministic paths, one
 * 400×600 webp per card id. Images are fetched lazily (hover only) so the
 * tables never pay for them.
 */

const BASE = "https://yenhspu3f9odyl6a.public.blob.vercel-storage.com";

export function cardArtUrl(cardId: number): string {
  return `${BASE}/cards/${cardId}.webp`;
}
