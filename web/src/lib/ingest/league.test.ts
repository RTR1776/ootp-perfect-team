import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLeagueExport } from "./league";

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
  assert.equal(cy.ratings["PBAB vR"], 142);
  assert.equal(cy.ratings["HRA vR"], 135);
});
