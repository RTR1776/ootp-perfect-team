#!/usr/bin/env node
/**
 * Layout check: every page at phone (390×844) and desktop (1440×900) width,
 * against a running server. Read-only: it signs in and looks, nothing else.
 *
 *   BASE=http://localhost:3217 APP_PASSWORD=… node scripts/check-layout.mjs [--only /build]
 *
 * Asserts, per route and width:
 * - the page lands where it was sent (no redirect: /draft sat behind one to
 *   /build for weeks);
 * - the page itself never scrolls sideways (scrollWidth ≤ innerWidth). A wide
 *   table must scroll inside its own box.
 * On pages off PENDING (rebuilt for the UI plan), tables too:
 * - a table with more than 25 rows keeps its header in view when it scrolls
 *   (scrolled for real: a sticky header inside an overflow box scrolled away on
 *   /played, to −1581px);
 * - on a phone, at most 4 columns show.
 *
 * Later UI-plan PRs add assertions here (no font under 11px, and the other
 * simplicity checks for pages taken off PENDING below).
 *
 * Chromium: $CHROMIUM, else the cloud image's /opt/pw-browsers/chromium, else
 * the installed Google Chrome.
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE ?? "http://localhost:3217").replace(/\/$/, "");
const PASSWORD = process.env.APP_PASSWORD;
if (!PASSWORD) {
  console.error("Set APP_PASSWORD to the server's password.");
  process.exit(2);
}
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

// Every nav link, read from lib/nav.ts so a new page is checked without edits here.
const navHrefs = [...readFileSync(new URL("../src/lib/nav.ts", import.meta.url), "utf8").matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
// States a bare nav link never reaches: Build overflowed only with an event chosen.
const EXTRA = ["/build?t=9100139", "/draft?t=9100139", "/cards?q=aaron", "/played?event=9100139"];
const ROUTES = [...new Set([...navHrefs, ...EXTRA])].filter((r) => !only || r.startsWith(only));
const WIDTHS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

/**
 * Pages not yet rebuilt for the simplicity rules (first control high on the
 * page, little prose before the first table, at most 4 columns on a phone).
 * A page leaves this list in the PR that rebuilds it and never rejoins it.
 */
export const PENDING = ["/build", "/draft", "/ptcs", "/cards", "/market", "/league", "/meta", "/runenv", "/environments", "/upload"];
const pending = (route) => PENDING.includes(new URL(route, "http://x").pathname);

const executablePath = process.env.CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : { channel: "chrome" });
const failures = [];

async function check(page, route, w) {
  const res = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(800);
  const url = new URL(page.url());
  const landed = `${url.pathname}${url.search}`;
  const problems = [];
  if (!res || res.status() >= 400) problems.push(`HTTP ${res?.status() ?? "no response"}`);
  if (landed !== route) problems.push(`landed on ${landed}`);
  const m = await page.evaluate(() => {
    const vw = window.innerWidth, off = [];
    if (document.documentElement.scrollWidth > vw) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) continue;
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX) && p.getBoundingClientRect().right <= vw + 1) { clipped = true; break; }
          p = p.parentElement;
        }
        if (!clipped) off.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(/\s+/).slice(0, 4).join(".") : ""} → ${Math.round(r.right)}px "${(el.textContent ?? "").trim().slice(0, 24)}"`);
        if (off.length >= 3) break;
      }
    }
    return { sw: document.documentElement.scrollWidth, vw, off };
  });
  if (m.sw > m.vw) problems.push(`scrolls sideways: ${m.sw}px wide on a ${m.vw}px screen${m.off.length ? `\n        first past the edge: ${m.off.join("\n                             ")}` : ""}`);
  if (!pending(route) && route !== "/login") problems.push(...(await tableProblems(page, w)));
  console.log(`${problems.length ? "FAIL" : "ok  "}  ${w.name.padEnd(7)} ${route}${problems.length ? `\n      ${problems.join("\n      ")}` : ""}`);
  if (problems.length) failures.push(`${w.name} ${route}`);
}

/**
 * The table rules for a rebuilt page. Each visible table with more than 25
 * body rows is scrolled 600px (its own box when it has one, else the page) and
 * its header must still be at the top of what shows. On a phone, no table
 * shows more than 4 columns.
 */
async function tableProblems(page, w) {
  const found = await page.evaluate(async ({ phone }) => {
    const out = [];
    const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const tables = [...document.querySelectorAll("main table")].filter(shown);
    for (const [i, table] of tables.entries()) {
      const name = `table ${i + 1} of ${tables.length}`;
      const head = table.tHead?.rows[0];
      const cols = head ? [...head.cells].filter(shown).length : 0;
      if (phone && cols > 4) out.push(`${name} shows ${cols} columns on a phone (at most 4)`);
      const rows = [...(table.tBodies[0]?.rows ?? [])].filter(shown).length;
      const th = head?.cells[0];
      if (rows <= 25 || !th) continue;
      let box = table.parentElement;
      while (box && box !== document.body) {
        const s = getComputedStyle(box);
        if (/(auto|scroll)/.test(s.overflowY) && box.scrollHeight > box.clientHeight + 4) break;
        box = box.parentElement;
      }
      let ok;
      if (box && box !== document.body) {
        box.scrollTop = Math.min(600, box.scrollHeight - box.clientHeight);
        await frame();
        ok = Math.abs(th.getBoundingClientRect().top - box.getBoundingClientRect().top) <= 2;
        box.scrollTop = 0;
      } else {
        scrollTo(0, table.getBoundingClientRect().top + scrollY + 600);
        await frame();
        const top = th.getBoundingClientRect().top;
        ok = top >= 0 && top <= 120;
        scrollTo(0, 0);
      }
      if (!ok) out.push(`${name} (${rows} rows): header scrolls away`);
    }
    return out;
  }, { phone: w.width < 768 });
  return found;
}

for (const w of WIDTHS) {
  // Signed out first: the login page must fit too.
  const anon = await browser.newContext({ viewport: { width: w.width, height: w.height } });
  await check(await anon.newPage(), "/login", w);
  await anon.close();

  const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
  const page = await ctx.newPage();
  const login = await page.request.post(`${BASE}/api/login`, { data: { password: PASSWORD } });
  if (!login.ok()) { console.error(`Sign-in failed (${login.status()}); check APP_PASSWORD.`); process.exit(2); }
  for (const route of ROUTES) await check(page, route, w);
  await ctx.close();
}
await browser.close();

if (failures.length) {
  console.log(`\n${failures.length} failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nEvery page fits and lands where it was sent.");
