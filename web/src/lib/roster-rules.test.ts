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
import { describeRules } from "./roster-rules";
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

test("the tier count on the board marks only the first tier that overflows", () => {
  // Legal: a Diamond fills the spare Perfect slot (P 7/8, D 7/6 is fine cumulatively).
  const legal = describeRules(hardware, { used: { P: 7, D: 7, G: 3, S: 3, B: 3, I: 3 } }).find((i) => i.key === "slots")!;
  assert.equal(legal.text, "P 7/8 · D 7/6 · G 3/3 · S 3/3 · B 3/3 · I 3/3");
  assert.equal(legal.over, null);
  const over = describeRules(hardware, { used: { P: 9, D: 5, G: 3, S: 3, B: 3, I: 3 } }).find((i) => i.key === "slots")!;
  assert.equal(over.over, "P");
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
  const years = describeRules({ ...noRule, name: "Daily Live Plus" }, { evidence: played([[1, 2026, 141], [6, 2026, 60], [7, 2026, 3], [5, 2026, 2]]) }).find((i) => i.key === "years");
  assert.equal(years?.state, "suspect");
});
