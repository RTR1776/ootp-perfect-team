# The OOTP PT Engine, Decoded

**How ratings become outcomes — the multipliers, the factors, and what actually matters.**
Verified 2026-07-25: this model reproduces the engine's own projections to **±0.002 OPS** (hitters) and **±0.00 FIP** (pitchers) across 401 cards.

---

## 1. The one equation

Everything runs through a single power law, fitted per component from real PT league results:

```
rate  =  env_rate  ×  e^α  ×  (rating / 50)^β
```

| Term | Meaning |
|---|---|
| `rate` | the event rate — K per PA, HR per ball-in-play, etc. |
| `env_rate` | league-average rate for that event in the current PT run environment |
| `α` (alpha) | the card-quality intercept (how the played meta sits vs league average) |
| `β` (beta) | **the elasticity — how hard that rating pulls.** This is the number that matters. |
| `rating / 50` | ratings are on a **50 = league average** scale |

**The critical intuition:** a rating of 100 is *2× the average input*, but it is **not** 2× the output. β decides that. With β = 1.33 (power), doubling the rating gives 2^1.33 ≈ **2.5×** the home run rate. With β = 0.16 (contact→BABIP), doubling gives 2^0.16 ≈ **1.12×** — almost nothing.

---

## 2. The multiplier table

This is the whole engine on one page. "+10 rating" = the marginal value of ten rating points at a rating of 100.

### Hitters

| Rating | Drives | β | R² | +10 rating | Read |
|---|---|---|---|---|---|
| **POW** | HR / ball-in-play | **+1.326** | 0.78 | **+13.5% HR** | 🔥 the most powerful rating in the game |
| **EYE** | BB / PA | **+1.037** | 0.87 | +10.4% walks | nearly linear, very reliable |
| **GAP** | (2B+3B) / BIP | +0.751 | 0.57 | +7.4% extra-base hits | solid, moderately noisy |
| **K (avoid)** | K / PA | **−0.759** | 0.88 | −7.0% strikeouts | tightest fit in the game |
| **BA (contact)** | BABIP | **+0.164** | **0.26** | **+1.6%** | ⚠️ **nearly worthless** |

### Pitchers

| Rating | Drives | β | R² | +10 rating | Read |
|---|---|---|---|---|---|
| **CON (control)** | BB / BF | **−0.942** | 0.74 | **−8.6% walks** | the best pitcher rating |
| **HRA** | HR / BIP | −0.905 | 0.51 | −8.3% HR allowed | strong but noisier |
| **STU (stuff)** | K / BF | +0.525 | 0.68 | +5.1% strikeouts | weaker than you'd think |
| **PBABIP** | BABIP against | **−0.106** | **0.17** | **−1.0%** | ⚠️ **noise — DIPS lives** |

---

## 3. The five things this tells you

**① Power is king.** POW has by far the steepest curve (β = 1.33). It's the only rating with meaningfully *increasing* returns — every 10 points buys more than the last. When comparing two similar cards, the one with more POW wins more often than raw OVR suggests.

**② Contact / BABIP ratings are a trap.** BA (β = 0.16, R² = 0.26) and PBABIP (β = −0.11, R² = 0.17) barely move outcomes, and the sim barely obeys them. **This is DIPS theory holding inside OOTP** — balls in play are mostly luck, and the engine models it that way. A card with a gaudy contact rating and mediocre POW/EYE is overpriced. This is exactly why the compressed run environment we found earlier flattens batting averages but not power.

**③ For pitchers, control beats stuff.** CON (β = −0.94) moves walks nearly twice as hard as STU (β = +0.53) moves strikeouts. The market tends to pay for velocity and Stuff; the engine pays for command.

**④ Trust the high-R² ratings.** K-avoid (0.88), EYE (0.87), POW (0.78) are what the sim reliably obeys. HRA (0.51), GAP (0.57) are looser. BABIP ratings (0.17–0.26) are close to noise. **R² is your confidence weight** — when two cards differ only in a low-R² rating, that difference is mostly meaningless.

**⑤ Ratings are multiplicative, not additive.** OVR is a blend; outcomes are a product of independent power laws. That's why two "100 OVR" cards can project a hundred points of OPS apart — and why the Card Lab beats eyeballing.

---

## 4. How a full line gets built

Hitter, per plate appearance:

```
K%      = curve(K rating)
BB%     = curve(EYE)
HBP%    = env constant
BIP     = 1 − K% − BB% − HBP%              ← balls in play
HR      = curve(POW)  × BIP
BABIP   = curve(BA)   × (BIP − HR)         ← non-HR hits
2B+3B   = curve(GAP)  × BIP                 (capped at total non-HR hits)
1B      = non-HR hits − (2B+3B)
```
then AVG/OBP/SLG/wOBA from standard linear weights
(BB .69, HBP .72, 1B .89, 2B 1.27, 3B 1.62, HR 2.10).

Pitcher, per batter faced: same shape, then
`IP = outs/3`, `FIP = (13·HR + 3·(BB+HBP) − 2·K) / IP + 3.10`.

**The 3B share of extra-base hits is a fixed 9.43%** — the engine doesn't model triples separately off speed in this projection frame.

---

## 5. Two hard-won gotchas

**Platoon contamination.** The observed "overall" split in any export is **usage-contaminated** — managers platoon, so a card's overall line reflects *who chose to play it and when*, not its true talent. The engine fits **vL and vR separately** and constructs overall from them. Never calibrate on the "all" split.

**Duplicate column names.** OOTP's 184-column exports reuse names across the hitter/pitcher/fielder blocks. `CON vL` appears **twice** — the first is hitter contact, the second (`CON vL_1` after de-duplication) is pitcher control. Reading the wrong one silently produces garbage; it cost a full debugging cycle tonight (pitcher FIP was off by +11.7 until fixed). Also: `-` means null, and the MLB "`.xls`" baseline file is actually HTML.

---

## 6. Era contexts

Tournaments specify an era (`1975/DH/BP`, `1958/NoDH/BP`). Era changes `env_rate` for every component, so the same card projects differently:

| Era | K rate | HR/BIP | Effect |
|---|---|---|---|
| 1927 | 0.053 | 0.014 | almost no strikeouts, almost no power → contact/speed cards rise |
| 2020–26 (PT) | 0.226 | 0.046 | modern three-true-outcomes → POW and EYE dominate |

**Practical:** in dead-ball contexts, the value of POW compresses and GAP/contact matters relatively more. In modern contexts, POW and EYE run the table. The Card Lab has all 96 eras — switch context and watch the line move.

---

## 7. Where this model is weak

- **Fitted on the played meta.** The population is elite-skewed (min 150 PA / 100 BF in real leagues), so projections for low-rated cards ride the power law into territory it never saw. The Card Lab flags ratings outside the fitted range.
- **BABIP components are barely predictive** (R² 0.17–0.26) — treat any projection difference driven by BA/PBABIP as noise.
- **No defense/baserunning in this equation** — those are separate models (defensive runs per 162, positional adjustment, BsR).
- **MOV (movement) is not in the v2 pitcher model** at all.

---

*Model: `engine/config/curves.json` (fitted 2026-07-06) · Calculator: `card_projector.py` · Interactive: `PT Card Lab.html`*
