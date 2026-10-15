/**
 * OOTP 27 saved card filters — the Manage Cards "Filter" dropdown, stored in
 * `<OOTP Baseball 27>/tables/pt_all_ptcards_filters`. Plain little-endian binary,
 * decoded 2026-10-14 from L.J.'s own file:
 *
 *   u8  version (0)
 *   u32 filter count
 *   per filter:
 *     u8  flag (1)
 *     u32 name length, name bytes (latin1)
 *     u32 criterion count
 *     per criterion, 26 bytes:
 *       u8  kind (2)
 *       u16 field        956 = Card ID, 981 = the "Sell Dupes" count field
 *       u8  operator     1 = equals, 2 = at least
 *       u32 reserved (0)
 *       f64 value
 *       f64 second value (-1 when unused)
 *       u8  enabled (1)
 *       u8  join         0 on the first line, 1 = OR with the line above
 *
 * A roster filter is one "Card ID = x" line per card, OR-joined, so Manage Cards
 * shows the whole roster at once. Variants share their base card's Card ID, so
 * both copies show; pick the variant by hand.
 */

export const FIELD_CARD_ID = 956;
const OP_EQUALS = 1;
const CRIT_BYTES = 26;

export interface FilterCriterion {
  kind: number; field: number; op: number; reserved: number;
  value: number; value2: number; enabled: number; join: number;
}
export interface SavedFilter { flag: number; name: string; criteria: FilterCriterion[] }
export interface FilterFile { version: number; filters: SavedFilter[] }

const latin1 = (s: string) => Uint8Array.from(s, (ch) => { const c = ch.charCodeAt(0); return c < 256 ? c : 63; });

export function parseFilterFile(bytes: Uint8Array): FilterFile {
  if (bytes.length === 0) return { version: 0, filters: [] };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  const need = (n: number) => { if (p + n > bytes.length) throw new Error("Not an OOTP card filter file (it ends early)."); };
  need(5);
  const version = dv.getUint8(p); p += 1;
  const count = dv.getUint32(p, true); p += 4;
  if (count > 10000) throw new Error("Not an OOTP card filter file (implausible filter count).");
  const filters: SavedFilter[] = [];
  for (let i = 0; i < count; i++) {
    need(5);
    const flag = dv.getUint8(p); p += 1;
    const len = dv.getUint32(p, true); p += 4;
    need(len);
    const name = String.fromCharCode(...bytes.subarray(p, p + len)); p += len;
    need(4);
    const n = dv.getUint32(p, true); p += 4;
    need(n * CRIT_BYTES);
    const criteria: FilterCriterion[] = [];
    for (let j = 0; j < n; j++) {
      criteria.push({
        kind: dv.getUint8(p), field: dv.getUint16(p + 1, true), op: dv.getUint8(p + 3), reserved: dv.getUint32(p + 4, true),
        value: dv.getFloat64(p + 8, true), value2: dv.getFloat64(p + 16, true), enabled: dv.getUint8(p + 24), join: dv.getUint8(p + 25),
      });
      p += CRIT_BYTES;
    }
    filters.push({ flag, name, criteria });
  }
  if (p !== bytes.length) throw new Error("Not an OOTP card filter file (unexpected trailing bytes).");
  return { version, filters };
}

export function serializeFilterFile(file: FilterFile): Uint8Array {
  let size = 5;
  for (const f of file.filters) size += 1 + 4 + f.name.length + 4 + f.criteria.length * CRIT_BYTES;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let p = 0;
  dv.setUint8(p, file.version); p += 1;
  dv.setUint32(p, file.filters.length, true); p += 4;
  for (const f of file.filters) {
    dv.setUint8(p, f.flag); p += 1;
    const name = latin1(f.name);
    dv.setUint32(p, name.length, true); p += 4;
    out.set(name, p); p += name.length;
    dv.setUint32(p, f.criteria.length, true); p += 4;
    for (const c of f.criteria) {
      dv.setUint8(p, c.kind); dv.setUint16(p + 1, c.field, true); dv.setUint8(p + 3, c.op); dv.setUint32(p + 4, c.reserved, true);
      dv.setFloat64(p + 8, c.value, true); dv.setFloat64(p + 16, c.value2, true); dv.setUint8(p + 24, c.enabled); dv.setUint8(p + 25, c.join);
      p += CRIT_BYTES;
    }
  }
  return out;
}

/** One filter showing every listed card: "Card ID = x" lines OR-joined, duplicates dropped. */
export function rosterFilter(name: string, cardIds: number[]): SavedFilter {
  const ids = [...new Set(cardIds.filter((x) => Number.isInteger(x) && x > 0))];
  return {
    flag: 1,
    name: name.trim().slice(0, 120) || "Roster",
    criteria: ids.map((id, i) => ({ kind: 2, field: FIELD_CARD_ID, op: OP_EQUALS, reserved: 0, value: id, value2: -1, enabled: 1, join: i === 0 ? 0 : 1 })),
  };
}

/** Adds the filter to the file, replacing any filter of the same name; every other filter is kept as it was. */
export function mergeFilter(existing: Uint8Array, filter: SavedFilter): { bytes: Uint8Array; replaced: boolean; kept: number } {
  const file = parseFilterFile(existing);
  const at = file.filters.findIndex((f) => f.name === filter.name);
  if (at >= 0) file.filters[at] = filter; else file.filters.push(filter);
  return { bytes: serializeFilterFile(file), replaced: at >= 0, kept: file.filters.length - 1 };
}
