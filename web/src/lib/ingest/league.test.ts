import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLeagueExport, resolveRatingCols } from "./league";

test("a league export keeps each copy's split ratings and variant level", () => {
  const header = "POS,Name,ORG,VAL,CID,VAR,VLvl,BABIP,GAP,POW,EYE,K's,BA vL,GAP vL,POW vL,EYE vL,K vL,BA vR,GAP vR,POW vR,EYE vR,K vR,STU,CON,PBABIP,HRA,STU vL,CON vL,PBABIP vL,HRA vL,STU vR,CON vR,PBABIP vR,HRA vR,PA,AB,H,HR";
  const bat = "LF,Kevin Mitchell,Kansas City Torrent - JW,100,86911,Y,5,118,147,208,183,112,97,141,250,212,139,125,150,190,172,98,1,1,1,1,1,1,1,1,1,1,1,1,600,520,160,40";
  const arm = "SP,Cy Young,Kansas City Torrent - JW,102,86572,N,0,32,72,1,24,94,45,41,1,51,121,27,80,1,9,88,118,151,142,130,118,148,142,123,117,154,142,135,0,0,0,0";
  const { stints } = parseLeagueExport([header, bat, arm].join("\n"), "pel_vL.csv");
  const [m, cy] = stints;
  assert.equal(m.isVariant, true);
  assert.equal(m.ratings["VLvl"], 5);
  assert.equal(m.ratings["POW vL"], 250);
  assert.equal(m.ratings["EYE vR"], 172);
  assert.equal(m.ratings["Kav vL"], 139);
  assert.equal(m.ratings["BABr vR"], 125);
  assert.equal(m.ratings["POW"], 208, "the overall rating is still kept under its old key");
  assert.equal(cy.ratings["STU vL"], 118);
  assert.equal(cy.ratings["CON"], 151);
  assert.equal(cy.ratings["CON vL"], 148);
  assert.equal(cy.ratings["CON vR"], 154);
  assert.equal(cy.ratings["PBAB vR"], 142);
  assert.equal(cy.ratings["HRA vR"], 135);
});

/**
 * HD451 of 2026-09-27 came as OOTP's wider 338-column view: hitter Contact
 * (CON, CON vL, CON vR) first, pitcher Control as CON_1, CON vL_1, CON vR_1,
 * and B/T as words. Header and row are that file's, verbatim (hd451_vL).
 */
const WIDE_HEADER = "ID,POS,RL,#,Name,Name_1,First Name,Last Name,Nickname,Claim,Inf,TM,TM_1,TM_2,ORG,ORG_1,LG,LG_1,Lev,Lev_1,DOB,Age,NAT,NAT2,City,HT,WT,B,B_1,T,T_1,EXP,Nat. Pop.,Loc. Pop.,OVR,VAL,CTM,CFR,CYear,CEra,CType,ST,CID,Tier,Title,SER,MV,Missions,ActMissions,MC,REL,L10,BUY,SELL,Dup,Lock,Valid,St,VAR,VLvl,Tour,TRN,CON,BABIP,GAP,POW,EYE,K's,BA vL,CON vL,GAP vL,POW vL,EYE vL,K vL,BA vR,CON vR,GAP vR,POW vR,EYE vR,K vR,BUN,BFH,BBT,GBT,FBT,STU,MOV,CON_1,PBABIP,HRA,STU vL,MOV vL,CON vL_1,PBABIP vL,HRA vL,STU vR,MOV vR,CON vR_1,PBABIP vR,HRA vR,FB,CH,CB,SL,SI,SP,CT,FO,CC,SC,KC,KN,PIT,G/F,VELO,VT,Slot,PT,STM,HLD,C ABI,C FRM,C ARM,IF RNG,IF ERR,IF ARM,TDP,OF RNG,OF ERR,OF ARM,DEF,P,C,1B,2B,3B,SS,LF,CF,RF,DEF Pot,P Pot,C Pot,1B Pot,2B Pot,3B Pot,SS Pot,LF Pot,CF Pot,RF Pot,SPE,SR,STE,RUN,G,GS,PA,AB,H,1B_1,2B_1,3B_1,HR,RBI,R,BB,BB%,IBB,HP,SH,SF,CI,K,K%,GIDP,EBH,TB,AVG,OBP,SLG,RC,RC/27,ISO,wOBA,OPS,OPS+,BABIP_1,WPA,wRC,wRC+,wRAA,WAR,PI/PA,SB,CS,SB%,BatR,wSB,UBR,BsR,G_1,GS_1,W,L,WIN%,SVO,SV,SV%,BS,BS%,HLD_1,SD,MD,IP,BF,AB_1,HA,1B_2,2B_2,3B_2,HR_1,TB_1,R_1,ER,BB_1,IBB_1,K_1,HP_1,ERA,AVG_1,OBP_1,SLG_1,OPS_1,BABIP_2,WHIP,BRA/9,HR/9,H/9,BB/9,K/9,K/BB,K%_1,BB%_1,K%-BB%,SH_1,SF_1,WP,BK,CI_1,DP,RA,GF,IR,IRS,IRS%,LOB%,pLi,GF%,QS,QS%,CG,CG%,SHO,PPG,RS,RSG,PI,GB,FB_1,GO%,SB_1,CS_1,ERA+,FIP,FIP-,WPA_1,WAR_1,rWAR,SIERA,POS_1,G_2,GS_2,TC,A,PO,E,DP_1,TP,PCT,RNG,ZR,EFF,SBA,RTO,RTO%,IP_1,PB,CER,CERA,BIZ-R%,BIZ-R,BIZ-Rm,BIZ-L%,BIZ-L,BIZ-Lm,BIZ-E%,BIZ-E,BIZ-Em,BIZ-U%,BIZ-U,BIZ-Um,BIZ-Z%,BIZ-Z,BIZ-Zm,BIZ-I,FRM,ARM,ACT,5d,4d,3d,2d,Yest.,Today,SPF%,RPF%,BF%,SL_1,Lists,CON/STU,BA/PBA,POW/MOV,POW/HRA,EYE/CON,FLD/STA,CON/STU P,POW/MOV P,EYE/CON P";
const WIDE_ARM = "608,SP,SP,74,Grover Cleveland Alexander,G. Alexander,Grover Cleveland,Alexander,Old Pete,-,,Bloody Nines,Bloody,9,Bloody Nines,9,High Diamond .451,HD451,High Diamond,HD,02/26/1887,24,USA,,Unknown,6' 1',185 lbs,Right,R,Right,R,1,Unkn.,Unkn.,101,101,Philadelphia Phillies,PHI,1911,2026,RS,PTCS,86472,Perfect,PTCS 5 - Rookie Sensation  SP Grover Cleveland Alexander  PHI  1911,,200,0,0,,08/04/2026,1 144 814,0,0,No,No,Yes,Active,N,0,Y,Open High Cap  PTWC 1 T2  PTWC 1 T3  Sunday Open Slots_07.12  Tuesday Up To 1969  Tuesday Up To 1969_v2  Wednesday Deadball  Wednesday Deadball_07.08,63,53,117,70,58,71,62,66,132,55,71,71,50,62,112,74,50,72,5,8,Line Drive,Normal,Normal,132,140,119,138,141,116,150,118,130,160,145,131,120,144,125,-,137,115,-,131,-,-,-,-,117,-,-,4,NEU,91-93,91-93,3/4,Normal,94,59,-,-,-,28,74,42,24,6,9,1,95,95,-,-,-,-,-,-,-,-,95,95,-,-,-,-,-,-,-,-,69,94,81,75,,,0,0,0,0,0,0,0,0,0,0,0.0,0,0,0,0,0,0,0.0,0,0,0,.000,.000,.000,0.0,0.0,.000,.000,.000,-100,.000,0.00,0,100,-0.0,0.0,0.00,0,0,0.0,-0.0,0.0,0.0,0.0,34,34,0,0,.000,0,0,.000,0,.000,0,0,0,97.1,449,411,123,84,27,5,7,181,58,48,31,0,80,5,4.44,.299,.355,.440,.795,.357,1.58,14.7,0.6,11.4,2.9,7.4,2.6,17.8,6.9,10.9,1,1,1,0,0,4,0,0,0,0,0.0,67.7,1.01,.000,0,.000,0,.000,0,0,16,0.5,0,114,90,0.56,0,0,99,3.81,87,0.0,2.0,0.6,4.15,1,34,34,32,19,12,1,1,0,.969,1.36,0.3,1.075,14,3,21.4,204.2,0,0,0.00,78.6%,14,11,71.4%,7,5,100.0%,2,2,100.0%,1,1,0.0%,0,0,0,-1.1,0.0,Yes,109,0,0,0,0,0,100%,96%,100%,No,-,132,138,140,141,119,94,-,-,-";

test("the 338-column view reads pitcher Control, not hitter Contact", () => {
  const { stints } = parseLeagueExport([WIDE_HEADER, WIDE_ARM].join("\n"), "hd451_vl (1).csv");
  const [pete] = stints;
  assert.equal(pete.name, "Grover Cleveland Alexander");
  assert.equal(pete.isPitcher, true);
  // The file's Contact is 63 / 66 / 62; its Control is 119 / 118 / 120.
  assert.equal(pete.ratings["CON"], 119);
  assert.equal(pete.ratings["CON vL"], 118);
  assert.equal(pete.ratings["CON vR"], 120);
  assert.equal(pete.ratings["STU vL"], 116);
  assert.equal(pete.ratings["PBAB vL"], 130);
  assert.equal(pete.ratings["HRA vL"], 160);
  assert.equal(pete.bats, "R");
  assert.equal(pete.throws, "R");
  assert.equal(pete.ip, 97 + 1 / 3);
  assert.equal(pete.war, 2.0);
});

test("Control is found after Stuff wherever the view puts it", () => {
  const narrow = "POS,Name,STU,CON,STU vL,CON vL,STU vR,CON vR";
  const wide = "POS,Name,CON,CON vL,CON vR,STU,MOV,CON_1,STU vL,MOV vL,CON vL_1,STU vR,MOV vR,CON vR_1";
  const pick = (h: string) =>
    Object.fromEntries(resolveRatingCols(h.split(",")).filter(([k]) => k.startsWith("CON")));
  assert.deepEqual(pick(narrow), { CON: "CON", "CON vL": "CON vL", "CON vR": "CON vR" });
  assert.deepEqual(pick(wide), { CON: "CON_1", "CON vL": "CON vL_1", "CON vR": "CON vR_1" });
  // No Stuff column and the name is shared: leave Control out rather than guess.
  assert.deepEqual(pick("POS,Name,CON vL,CON vL_1"), {});
});
