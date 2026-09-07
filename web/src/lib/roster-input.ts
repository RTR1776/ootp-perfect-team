import { FIELD_POSITIONS, type RosterSlot } from "./roster-rules";
export interface RosterInput { tournamentId: number; name: string; slots: RosterSlot[]; requireReady: boolean }

export function parseRosterInput(input: unknown): {ok:true;value:RosterInput}|{ok:false;error:string} {
  const fail = (error:string) => ({ok:false as const,error});
  if (!input || typeof input!=="object") return fail("A roster is required.");
  const b=input as Record<string,unknown>;
  if (typeof b.name!=="string" || !b.name.trim()) return fail("Give this roster a name.");
  if (typeof b.tournamentId!=="number" || !Number.isSafeInteger(b.tournamentId) || b.tournamentId<=0) return fail("Choose a tournament.");
  if (!Array.isArray(b.slots) || !b.slots.length || b.slots.length>60) return fail("Supply between 1 and 60 assignments.");
  const slots:RosterSlot[]=[];
  for(const raw of b.slots) {
    if (!raw || typeof raw!=="object") return fail("Invalid roster assignment.");
    const s=raw as Record<string,unknown>;
    if (typeof s.cardId!=="number" || !Number.isSafeInteger(s.cardId) || s.cardId<=0) return fail("Invalid card ID.");
    if (typeof s.slot!=="string" || (!([...FIELD_POSITIONS,"DH","CL"] as string[]).includes(s.slot) && !/^(SP|RP|BN)[1-9]\d?$/.test(s.slot))) return fail("Unknown roster position.");
    if (s.versusHand!=null && !["L","R","both"].includes(String(s.versusHand))) return fail("Unknown lineup hand.");
    if (s.lineupOrder!=null && (typeof s.lineupOrder!=="number" || !Number.isInteger(s.lineupOrder) || s.lineupOrder<1 || s.lineupOrder>9)) return fail("Batting order must be 1–9.");
    if (s.useVariant!=null && typeof s.useVariant!=="boolean") return fail("Variant selection must be true or false.");
    slots.push({cardId:s.cardId,slot:s.slot,versusHand:(s.versusHand??null) as string|null,lineupOrder:(s.lineupOrder??null) as number|null,useVariant:s.useVariant===true});
  }
  return {ok:true,value:{tournamentId:b.tournamentId,name:b.name.trim().slice(0,120),slots,requireReady:b.requireReady===true}};
}
