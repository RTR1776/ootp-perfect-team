import { test } from "node:test";
import assert from "node:assert/strict";
import { FIELD_POSITIONS, validateRoster, cardEligibility, parseCardTypeRule, slotCapacityIssues, valueWindowKnown, type RosterCard, type RosterRules, type RosterSlot } from "./roster-rules";
import { parseRosterInput } from "./roster-input";
import { formRatings } from "./card-forms";
import { periodCalendar } from "./ptcs-progress";

const rules: RosterRules = {dh:true,ratingsMin:40,ratingsMax:79,cardYearMin:null,cardYearMax:null,isDraft:false,restrictions:null};
function fixture() {
  const cards: RosterCard[] = Array.from({length:26},(_,i)=>({cardId:i+1,name:`Player ${i+1}`,val:70,year:1968,isPitcher:i>=13,role:i>=13?"SP":null,cardType:7,baseOwned:true,variantOwned:true,ratings:Object.fromEntries(FIELD_POSITIONS.map(p=>[`Pos Rating ${p}`,60]))}));
  const slots: RosterSlot[] = [];
  for(const hand of ["R","L"]) [...FIELD_POSITIONS,"DH"].forEach((slot,i)=>slots.push({cardId:i+1,slot,versusHand:hand,lineupOrder:i+1,useVariant:false}));
  for(let i=9;i<26;i++) slots.push({cardId:i+1,slot:i<13?`BN${i-8}`:i<18?`SP${i-12}`:`RP${i-17}`,versusHand:"both",lineupOrder:null,useVariant:false});
  return {cards,slots};
}
test("shared handed lineups count each player once and accept a complete roster",()=>{
  const {cards,slots}=fixture(); const v=validateRoster(slots,cards,rules);
  assert.equal(v.ready,true); assert.equal(v.counts.players,26);assert.equal(v.counts.value,1820);
});
test("two cards of one player are not allowed (one card per player)",()=>{
  const {cards,slots}=fixture();
  cards[19].player="youngcy01"; cards[20].player="youngcy01";
  const v=validateRoster(slots,cards,rules);
  assert.equal(v.ready,false);
  assert.ok(v.errors.some(e=>e.code==="same-player"&&e.cardId===21));
  cards[20].player="othercy01";
  assert.equal(validateRoster(slots,cards,rules).ready,true,"different players are fine");
});
test("variant cap counts forms once across both lineups",()=>{
  const {cards,slots}=fixture(); slots.filter(s=>s.cardId===1).forEach(s=>s.useVariant=true);
  assert.equal(validateRoster(slots,cards,{...rules,restrictions:{variantCap:1}}).ready,true);
  assert.ok(validateRoster(slots,cards,{...rules,restrictions:{variantsAllowed:false}}).errors.some(e=>e.code==="variant-cap"));
});
test("team cap applies to unique roster membership",()=>{
  const {cards,slots}=fixture();
  assert.equal(validateRoster(slots,cards,{...rules,restrictions:{teamCap:1820}}).ready,true);
  assert.ok(validateRoster(slots,cards,{...rules,restrictions:{teamCap:1819}}).errors.some(e=>e.code==="team-cap"));
});
test("slots are per-tier maximums and a lower card may fill a higher slot (L.J. 2026-09-07)",()=>{
  const {cards,slots}=fixture(); // 26 Silvers (val 70)
  assert.equal(validateRoster(slots,cards,{...rules,restrictions:{slots:{S:26}}}).ready,true);
  assert.equal(validateRoster(slots,cards,{...rules,restrictions:{slots:{G:20,S:6}}}).ready,true, "Silvers may sit in Gold slots");
  assert.ok(validateRoster(slots,cards,{...rules,restrictions:{slots:{S:25,B:1}}}).errors.some(e=>e.code==="tier-slots"), "26 Silvers overflow 25 Silver-or-better slots");
  cards[0].val=55; // an Iron in a Silver-only slot event is fine
  assert.equal(validateRoster(slots,cards,{...rules,restrictions:{slots:{S:26}}}).ready,true);
  cards[0].val=85; // a Gold with no Gold-or-better slot cannot enter at all
  assert.ok(cardEligibility(cards[0],{...rules,ratingsMax:null,restrictions:{slots:{S:26}}}).errors.some(e=>e.code==="tier-excluded"));
  assert.equal(cardEligibility(cards[0],{...rules,ratingsMax:null,restrictions:{slots:{D:1,S:25}}}).errors.length,0, "a Gold may take the Diamond slot");
  // the PTCS 6 Open championship rule: 8P 7D 6G 3S 2B 0I
  const open={P:8,D:7,G:6,S:3,B:2,I:0};
  assert.equal(slotCapacityIssues({P:8,D:7,G:6,S:3,B:2},open).length,0);
  assert.equal(slotCapacityIssues({P:6,D:9,G:6,S:3,B:2},open).length,0, "unused Perfect slots take Diamonds");
  assert.equal(slotCapacityIssues({P:6,D:9,G:6,S:5},open)[0]?.code,"tier-slots", "spare slots cascade down only once: 5 Silvers do not fit 3 Silver slots");
  assert.equal(slotCapacityIssues({P:8,D:7,G:6,S:3,I:2},open).length,0, "Irons may take the Bronze slots");
  assert.equal(slotCapacityIssues({P:9,D:6,G:6,S:3,B:2},open)[0]?.code,"tier-slots");
  assert.equal(slotCapacityIssues({P:8,D:8,G:5,S:3,B:2},open)[0]?.code,"tier-slots");
});
test("card-type rules are read as whole type names, dashed lists included",()=>{
  assert.deepEqual(parseCardTypeRule("Historical Legend-All-Star-Future Legend"),[4,5,6]);
  assert.deepEqual(parseCardTypeRule("All-Time Legend cards only"),[4]);
  assert.deepEqual(parseCardTypeRule("Snapshots"),[7]);
  assert.deepEqual(parseCardTypeRule("UH"),[8]);
  assert.deepEqual(parseCardTypeRule("Live"),[1]);
  assert.equal(parseCardTypeRule("Unverified"),null);
  assert.equal(parseCardTypeRule("Snapshots and Unicorns"),null);
});
test("Open and & Friends events have a confirmed absence of a value window",()=>{
  const none={...rules,ratingsMin:null,ratingsMax:null};
  assert.equal(valueWindowKnown(none),false);
  assert.equal(valueWindowKnown({...none,name:"Daily Open Cap"}),true);
  assert.equal(valueWindowKnown({...none,name:"Daily Iron & Friends OOTP Era"}),true);
  assert.equal(valueWindowKnown({...none,name:"Wide Open Spaces"}),true);
  assert.equal(valueWindowKnown({...none,name:"Daily Openers"}),false);
  const {cards,slots}=fixture();
  assert.ok(validateRoster(slots,cards,none).incomplete.some(e=>e.code==="unknown-value-window"));
  assert.ok(!validateRoster(slots,cards,{...none,name:"Sunday Open"}).incomplete.some(e=>e.code==="unknown-value-window"));
});
test("unknown card year and unknown type labels cannot be certified",()=>{
  const {cards,slots}=fixture(); cards[0].year=null;
  assert.equal(validateRoster(slots,cards,{...rules,cardYearMin:1920}).ready,false);
  assert.ok(cardEligibility(cards[1],{...rules,restrictions:{cardTypes:["Unverified"]}}).incomplete.length);
  assert.ok(cardEligibility(cards[1],{...rules,restrictions:{cardTypes:["Live"]}}).errors.length);
  assert.equal(cardEligibility(cards[1],{...rules,restrictions:{cardTypes:["SS"]}}).errors.length,0);
  assert.equal(cardEligibility(cards[1],{...rules,restrictions:{cardTypes:["UH","SS","RS"]}}).errors.length,0);
  assert.ok(cardEligibility(cards[1],{...rules,restrictions:{cardTypes:["Historical Legend-All-Star-Future Legend"]}}).errors.some(e=>e.code==="card-type"), "a Snapshot is not a legend");
});
test("base-only ownership, mixed forms and duplicate slots are rejected",()=>{
  const {cards,slots}=fixture();cards[0].variantOwned=false; slots[0].useVariant=true;
  const v=validateRoster([...slots,slots[0]],cards,rules);
  for(const code of ["not-owned","mixed-form","duplicate-slot","duplicate-player"]) assert.ok(v.errors.some(e=>e.code===code),code);
});
test("positions, DH rules and incomplete roster are checked",()=>{
  const {cards,slots}=fixture();cards[0].ratings={};
  const v=validateRoster(slots.slice(0,-1),cards,{...rules,dh:false});
  for(const code of ["position","dh-off","roster-size"]) assert.ok(v.errors.some(e=>e.code===code),code);
});
test("draft with unknown schedule stays unverified",()=>{
  const {cards,slots}=fixture();
  assert.ok(validateRoster(slots,cards,{...rules,isDraft:true}).incomplete.some(e=>e.code==="unknown-roster-size"));
});
test("request parser preserves variant choice and rejects malformed input",()=>{
  const {slots}=fixture();slots[0].useVariant=true;
  const p=parseRosterInput({name:" Example ",tournamentId:1,slots,requireReady:true});
  assert.ok(p.ok);if(p.ok){assert.equal(p.value.slots[0].useVariant,true);assert.equal(p.value.name,"Example");}
  for(const bad of [null,{}, {name:3,tournamentId:1,slots}, {name:"x",tournamentId:0,slots}, {name:"x",tournamentId:1,slots:[null]}, {name:"x",tournamentId:1,slots:[{...slots[0],lineupOrder:0}]}, {name:"x",tournamentId:1,slots:[{...slots[0],useVariant:"false"}]}]) assert.equal(parseRosterInput(bad).ok,false);
});
test("variant overlay: BA is BABIP, Contact is rebuilt from the BABIP/Avoid-K deltas, overalls follow the splits",()=>{
  const base={Contact:100,"Contact vL":90,"Contact vR":104,BABIP:110,"BABIP vL":100,"BABIP vR":114,"Avoid Ks":80,"Avoid K vL":70,"Avoid K vR":84,Power:60,"Power vL":50,"Power vR":64,"Control vL":50};
  const r=formRatings(base,{"BA vL":110,"BA vR":124,"K vL":80,"K vR":94,"POW vL":56,"POW vR":70,"CON vL":66});
  assert.equal(r["BABIP vL"],110);assert.equal(r["BABIP vR"],124);
  assert.equal(r["Contact vL"],Math.round(90+0.5702*10+0.4733*10));
  assert.equal(r["Contact vR"],Math.round(104+0.5702*10+0.4733*10));
  assert.equal(r.Contact,Math.round(100+10.4));
  assert.equal(r.BABIP,120);assert.equal(r["Avoid Ks"],90);assert.equal(r.Power,66);
  assert.equal(r["Control vL"],66);
  assert.deepEqual(formRatings(base,null),base);
  const untouched=formRatings({Contact:70,"Power vL":60},{"POW vL":80});
  assert.equal(untouched.Contact,70, "no BABIP/K deltas → Contact untouched");assert.equal(untouched["Power vL"],80);
});
test("PTCS elapsed days follow the calendar and Central date, not logged results",()=>{
  const p=periodCalendar("2026-08-03","2026-09-06",new Date("2026-08-06T02:00:00Z"));
  assert.equal(p.today,"2026-08-05");assert.equal(p.elapsed,3);assert.equal(p.remaining,32);
  assert.equal(periodCalendar("2026-08-03","2026-09-06",new Date("2026-07-01T12:00:00Z")).elapsed,0);
  assert.equal(periodCalendar("2026-08-03","2026-09-06",new Date("2026-09-08T12:00:00Z")).remaining,0);
});

test("formRatings scales a variant's listed positions by its DEF boost (Nimmala 2026-09-16)", () => {
  const base = { "Pos Rating 3B": 119, "Pos Rating SS": 108, "Pos Rating 2B": 0, "Pos Rating P": 0, "Infield Range": 98 };
  const r = formRatings(base, { DEF: 128, "IF RNG": 98 }, "3B");
  assert.equal(r["Pos Rating 3B"], 128);
  assert.equal(r["Pos Rating SS"], 116); // in-game 116
  assert.equal(r["Pos Rating 2B"], 0);   // unlisted stays unlisted
  assert.equal(r["Pos Rating P"], 0);
  // no DEF, or no position: untouched
  assert.deepEqual(formRatings(base, { "IF RNG": 98 }, "3B")["Pos Rating SS"], 108);
  assert.deepEqual(formRatings(base, { DEF: 128 })["Pos Rating SS"], 108);
  // base copy (DEF equals the base rating): untouched
  assert.deepEqual(formRatings(base, { DEF: 119 }, "3B")["Pos Rating SS"], 108);
});

/* describeRules and the set rule's message (UI plan G2, 2026-09-27) */
import { confirmedNotes, describeRules, ruleCardTypes, setRuleFromText, slotOverflow, slotUse } from "./roster-rules";
import { summariseSetEvidence } from "./set-evidence";

const hardware: RosterRules = {
  name: "Daily All-Star Hardware Slots", dh: true, ratingsMin: null, ratingsMax: null, cardYearMin: null, cardYearMax: null, isDraft: false,
  restrictions: { slots: { P: 8, D: 6, G: 3, S: 3, B: 3, I: 3 }, cardTypes: ["Historical All-Star+Hardware Heroes"] },
};
const played = (spec: [number, number, number][]) => summariseSetEvidence(spec.flatMap(([cardType, year, n]) => Array.from({ length: n }, () => ({ cardType, year }))));

test("9100139's rules read as sets and slots", () => {
  const items = describeRules(hardware);
  const by = Object.fromEntries(items.map((i) => [i.key, i]));
  assert.equal(by.sets.text, "Historical All-Star, Hardware Heroes");
  assert.equal(by.sets.state, "set");
  assert.equal(by.slots.text, "P8 · D6 · G3 · S3 · B3 · I3");
  assert.equal(by.value, undefined, "slots stand in for a value window");
  assert.deepEqual(items.map((i) => i.key), ["slots", "sets", "size", "dh"], "fixed order, only what applies");
});

test("a card from another set is refused by name", () => {
  const manush: RosterCard = { cardId: 1, name: "Heinie Manush", val: 96, year: 1928, isPitcher: false, role: null, cardType: 7, ratings: {}, baseOwned: true, variantOwned: false };
  const e = cardEligibility(manush, hardware).errors.find((x) => x.code === "card-type");
  assert.equal(e?.message, "Heinie Manush: card set Snapshot not allowed (allowed: Historical All-Star, Hardware Heroes).");
});

test("the slot counts show where each card sits; only cards with no slot left are marked", () => {
  // Legal: the seventh Diamond sits in the spare Perfect slot.
  const legal = describeRules(hardware, { used: { P: 7, D: 7, G: 3, S: 3, B: 3, I: 3 } }).find((i) => i.key === "slots")!;
  assert.equal(legal.text, "P 8/8 · D 6/6 · G 3/3 · S 3/3 · B 3/3 · I 3/3");
  assert.equal(legal.unplaced, undefined);
  const over = describeRules(hardware, { used: { P: 9, D: 5, G: 3, S: 3, B: 3, I: 3 } }).find((i) => i.key === "slots")!;
  assert.deepEqual(over.unplaced, { P: 1 });
  assert.match(over.text, /P \+1 no slot$/);
});

test("a tier with no slots of its own still counts where its cards sit (544 Wonky Slots: G13 / I13)", () => {
  const wonky: RosterRules = { ...hardware, name: "Monday Wonky Historical Slots", restrictions: { slots: { P: 0, D: 0, G: 13, S: 0, B: 0, I: 13 } } };
  const now = describeRules(wonky, { used: { G: 8, S: 4, B: 1, I: 13 } }).find((i) => i.key === "slots")!;
  assert.equal(now.text, "G 13/13 · I 13/13", "four Silvers and a Bronze fill the Gold slots");
  const swapped = describeRules(wonky, { used: { G: 9, S: 4, B: 1, I: 12 } }).find((i) => i.key === "slots")!;
  assert.equal(swapped.text, "G 13/13 · I 12/13 · B +1 no slot", "an Iron slot cannot take a Bronze");
  assert.deepEqual(slotUse({ G: 9, S: 4, B: 1, I: 12 }, wonky.restrictions!.slots!).over, { B: 1 });
  assert.equal(slotOverflow({ G: 9, S: 4, B: 1, I: 12 }, wonky.restrictions!.slots!)?.tier, "B", "the same tier the cumulative check names");
});

test("an Open Slots event with no slot rule on file is flagged, not read as 'Value any'", () => {
  const open: RosterRules = { ...hardware, name: "Daily Open Slots", ratingsMin: null, ratingsMax: null, restrictions: { refreshText: "1987 RE, 1990 Metrodome" } };
  const items = describeRules(open);
  assert.equal(items.find((i) => i.key === "value"), undefined, "the Slots chip stands in for the value window");
  const slots = items.find((i) => i.key === "slots")!;
  assert.equal(slots.state, "suspect");
  assert.match(slots.text, /not on file/);
  const v = validateRoster([], [], open);
  assert.ok(v.incomplete.some((i) => i.code === "unknown-slots"));
  assert.ok(!v.incomplete.some((i) => i.code === "unknown-value-window"));
  assert.equal(valueWindowKnown({ ...open, name: "Sunday Open Main Event" }), true, "an Open event without Slots has no window");
});

test("a value window guessed from the refresh post is flagged until confirmed", () => {
  const dank: RosterRules = { ...hardware, name: "Daily Dank", ratingsMin: 40, ratingsMax: 59, restrictions: { valueWindowFrom: "refresh post section: iron (name has no tier word - confirm on screen)" } };
  const value = describeRules(dank).find((i) => i.key === "value")!;
  assert.equal(value.state, "suspect");
  assert.equal(value.text, "40–59 — inferred, confirm");
  assert.ok(validateRoster([], [], dank).incomplete.some((i) => i.code === "unconfirmed-value-window"));
  const iron = describeRules({ ...dank, name: "Daily Iron Cap", restrictions: { valueWindowFrom: "name: Iron" } }).find((i) => i.key === "value")!;
  assert.equal(iron.state, "set", "a tier word in the name is read, not guessed");
  assert.equal(iron.detail, "Card value 40–59, read off the name (Iron).");
  // 538: read off the name, but the import's note says to check it.
  const sunday = describeRules({ ...dank, name: "Sunday High Iron Floor and Gold Ceiling", ratingsMin: 50, ratingsMax: 89, restrictions: { valueWindowFrom: "name: Silver + Gold", refreshNote: "Ceiling set to 89 by hand; the floor is left to the parser. CONFIRM BOTH ON SCREEN." } }).find((i) => i.key === "value")!;
  assert.equal(sunday.state, "suspect");
  assert.equal(describeRules({ ...dank, restrictions: { ...dank.restrictions, valueConfirmed: "2026-09-27" } }).find((i) => i.key === "value")!.state, "set", "set by hand: confirmed");
});

test("a set rule in the captured rules text is flagged with those sets to apply", () => {
  assert.deepEqual(setRuleFromText("Nel-SS-UH-HH, 1969 RE, DH off, Variants on, 1964 Shea Stadium"), [2, 7, 8, 9]);
  assert.deepEqual(setRuleFromText("Snapshots and Unsung Heroes cards from 1950-2026, 2026 Globe Life Field"), [7, 8]);
  assert.equal(setRuleFromText("SLOTS: 12 Gold, 8 Silver, 6 Bronze, 0 Iron; 1968 RE, DH on, Variant Cap 13"), null);
  assert.equal(setRuleFromText("High Bronze Floor-Silver Ceiling, No LE, 1805 cap, 1971 RE, DH off"), null);
  const replay: RosterRules = { ...hardware, name: "Daily PTCS 2 Iron Replay", restrictions: { refreshText: "Nel-SS-UH-HH, 1969 RE, DH off, Variants on, 1964 Shea Stadium" } };
  const sets = describeRules(replay).find((i) => i.key === "sets")!;
  assert.equal(sets.state, "suspect");
  assert.deepEqual(sets.propose, [2, 7, 8, 9]);
});

test("a Live name is explained by a card-year rule; a narrow set explains narrow years", () => {
  const plus: RosterRules = { ...hardware, name: "Daily Live Plus", restrictions: null, cardYearMin: 2026, cardYearMax: 2026 };
  assert.equal(describeRules(plus).find((i) => i.key === "sets")!.state, "none");
  assert.equal(describeRules({ ...plus, name: "PTCS 6 Championship - Live", cardYearMin: 1920, cardYearMax: 1989 }).find((i) => i.key === "sets")!.state, "none");
  assert.equal(describeRules({ ...plus, name: "Daily All-Star Hardware" }).find((i) => i.key === "sets")!.state, "suspect", "other set words still count");
  const liveOnly = describeRules({ ...plus, cardYearMin: null, cardYearMax: null, name: "Daily Fun" }, { evidence: played([[1, 2026, 243]]) });
  assert.equal(liveOnly.find((i) => i.key === "sets")!.state, "suspect");
  assert.deepEqual(liveOnly.find((i) => i.key === "sets")!.propose, [1]);
  assert.equal(liveOnly.find((i) => i.key === "years"), undefined, "one amber chip, not two");
});

test("L.J.'s confirmations are picked out of the notes", () => {
  const nightmare: RosterRules = { ...hardware, restrictions: { notes: ["default RE", "2026-09-25 from L.J.: cards 50-74, 1559 cap", "inferred from field: x.csv"] } };
  assert.deepEqual(confirmedNotes(nightmare), ["2026-09-25 from L.J.: cards 50-74, 1559 cap"]);
  assert.deepEqual(confirmedNotes({ ...hardware, restrictions: { notes: ["2026-09-25 confirmed by L.J.: cards 49 or below"] } }).length, 1);
});

test("a missing set rule is flagged from the field's play or the name; an unreadable one is loud", () => {
  const noRule: RosterRules = { ...hardware, name: "Some Slots Event", restrictions: { slots: hardware.restrictions!.slots } };
  const sets = (r: RosterRules, e = null as ReturnType<typeof played>) => describeRules(r, { evidence: e }).find((i) => i.key === "sets")!;
  assert.equal(sets(noRule).state, "none");
  const narrow = sets(noRule, played([[5, 1957, 209], [9, 1990, 111]]));
  assert.equal(narrow.state, "suspect");
  assert.match(narrow.text, /HAS 209 · HH 111/);
  assert.equal(sets({ ...noRule, name: "Daily Live Plus" }).state, "suspect", "the name alone");
  const bad = sets({ ...hardware, restrictions: { cardTypes: ["Unicorns"] } });
  assert.equal(bad.state, "unreadable");
  assert.match(bad.detail!, /NOT filtered/);
  assert.match(bad.text, /not understood: “Unicorns” — pool not filtered/, "said on the chip, not only in a title");
  const years = describeRules({ ...noRule, name: "Daily Live Plus" }, { evidence: played([[1, 2026, 141], [6, 2026, 60], [7, 2026, 3], [5, 2026, 2]]) }).find((i) => i.key === "years");
  assert.equal(years?.state, "suspect");
});

test("an event's set rule as codes: none, read, or unreadable", () => {
  assert.deepEqual(ruleCardTypes(hardware), [5, 9]);
  assert.deepEqual(ruleCardTypes({ restrictions: { cardTypes: ["Snapshots", "UH"] } }), [7, 8]);
  assert.equal(ruleCardTypes({ restrictions: { slots: { P: 26 } } }), null, "no rule");
  assert.equal(ruleCardTypes({ restrictions: { cardTypes: [" "] } }), null, "a blank label is no rule");
  assert.equal(ruleCardTypes({ restrictions: { cardTypes: ["Live", "Unicorns"] } }), null, "unreadable: not filtered, not guessed");
  assert.equal(ruleCardTypes({ restrictions: null }), null);
});
test("a No LE event bars Limited Edition cards, and a card whose edition isn't known is incomplete, not legal",()=>{
  const noLe={...rules,restrictions:{noLimitedEdition:true}};
  const card=fixture().cards[0];
  assert.ok(cardEligibility({...card,le:true},noLe).errors.some(e=>e.code==="limited-edition"));
  assert.equal(cardEligibility({...card,le:false},noLe).errors.length,0);
  assert.ok(cardEligibility({...card},noLe).incomplete.some(e=>e.code==="missing-le"));
  assert.equal(cardEligibility({...card,le:true},rules).errors.length,0,"no rule, no check");
});
