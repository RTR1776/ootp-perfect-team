"""Does a pricing change predict WINS better? An A/B of two builds of the team harness.

Build the harness twice, before and after the change, then compare:

  MV2_NO_LEAGUE=1 MV2_DIR=/tmp/h-a node --import tsx scripts/model-v2/teams.mts
  (make the change)
  MV2_NO_LEAGUE=1 MV2_DIR=/tmp/h-b node --import tsx scripts/model-v2/teams.mts
  python3 -I scripts/model-review/wins-ab.py /tmp/h-a /tmp/h-b

Add MV2_TOURDIR=Archive/Completed on the Mac to run it on every archived export; without it the
harness reads the exports in git (36 cap exports and six PTCS 7 Championship brackets, 3,580 team-events).

Both builds are scored with production's team weights by era band (the frame of endtoend.py), win% r
within each export, over 40 export half-samples. "off" is the first build, "on" the second. The bar
for a pricing change is 37 of 40 on the whole score.

A change to bats can also widen or narrow the offence term, and the team weights were tuned beside
the old one, so two more reads separate shape from scale: (a) the new offence term rescaled to the old
spread, (b) each build given its own offence multiplier, fitted on one half of the exports and scored
on the other.

Run on the exports in git, 2026-11-13:
  - The curved bat calibration (calibration.ts hit.bend; set hit.bend.applied to true for build B):
    whole score +0.0003 r, better in 24 of 40. Not adopted.
  - Arms' vL/vR blend by throwing hand (env-fit.ts pitchLhbShareFor; MV2_PITCH_LHB=flat for build A):
    whole score +0.0006 r, better in 37 of 40. Adopted.
Docs/Improvement Plan 2026-11-12.md has both tables.
"""
import json, re, sys
import numpy as np

POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]
SLOPE = {"C": .0362, "1B": .1407, "2B": .1744, "3B": .1501, "SS": .1562, "LF": .0895, "CF": .0643, "RF": .0973}
CAL = {"C": 1.61, "1B": 1.0, "2B": 1.29, "3B": 1.2, "SS": 1.64, "LF": 1.24, "CF": 1.69, "RF": 1.25}
PROD = (2, 1, 1.5, 2)  # gloves, framing, rotation, pen
W = {"<=1945": PROD, "1946-76": PROD, "1977-93": (1.25, .5, 1, 3), "1994-09": (1.25, .5, 1, 2.5), "2010+": PROD}


def band(y):
    return "<=1945" if y < 1946 else "1946-76" if y < 1977 else "1977-93" if y < 1994 else "1994-09" if y < 2010 else "2010+"


def load(d):
    return {(t["unit"], t["org"]): t for t in json.load(open(f"{d}/teams.json")) if t["kind"] == "tour" and t["W"] + t["L"] > 0}


if len(sys.argv) < 3:
    sys.exit(__doc__)
O, N = load(sys.argv[1]), load(sys.argv[2])
keys = sorted(set(O) & set(N))
print(f"{len(keys)} team-events in both builds, {len(set(k[0] for k in keys))} exports")


def glove(t):
    return sum(SLOPE[p] * .887 * CAL[p] * (t.get("dpos") or {}).get(p, {}).get("lin", 0.0) for p in POS)


def rest(t):
    D, F, S, R = W[band(t["year"])]
    return D * glove(t) + F * t.get("frm", 0) + S * t["pitSP"] + R * t["pitRP"]


bat_off = np.array([O[k]["off"] for k in keys]); bat_on = np.array([N[k]["off"] for k in keys])
rest_off = np.array([rest(O[k]) for k in keys]); rest_on = np.array([rest(N[k]) for k in keys])
off, on = bat_off + rest_off, bat_on + rest_on
y = np.array([O[k]["W"] / (O[k]["W"] + O[k]["L"]) for k in keys])
w = np.array([O[k]["W"] + O[k]["L"] for k in keys], float)
units = np.array([k[0] for k in keys]); bands = np.array([band(O[k]["year"]) for k in keys])
print(f"offence term moved: mean |on - off| {np.abs(bat_on - bat_off).mean():.3f} runs a game; spread off {bat_off.std():.3f}, on {bat_on.std():.3f}")


# Each export as an integer, so a mean per export is one pass (np.bincount) whatever the number of exports.
# The first version looped over the exports inside every correlation: fine on the 42 in git, hours on 900.
unit_names, code = np.unique(units, return_inverse=True)
K = len(unit_names)


def centre(v, m):
    """v on the masked rows, less each export's games-weighted mean there."""
    c, ww, vv = code[m], w[m], v[m]
    sw = np.bincount(c, weights=ww, minlength=K); sv = np.bincount(c, weights=ww * vv, minlength=K)
    return vv - (sv / np.where(sw > 0, sw, 1.0))[c]


def r(s, m):
    a, b, ww = centre(s, m), centre(y, m), w[m]
    return np.sum(ww * a * b) / np.sqrt(np.sum(ww * a * a) * np.sum(ww * b * b))


def halves(m):
    """The 40 half-samples of the exports under a mask: 20 random splits, both sides of each."""
    U = np.unique(code[m])  # in name order, as before, so the same seeds draw the same exports
    for seed in range(20):
        h = np.isin(code, np.random.default_rng(seed).choice(U, len(U) // 2, replace=False))
        yield h & m, ~h & m
        yield ~h & m, h & m


def compare(m, label, a, b):
    U = np.unique(code[m])
    if len(U) < 4:
        print(f"   {label:22} n {m.sum():5d}  {len(U):2d} exports: too few to split;  off {r(a, m):.4f}  on {r(b, m):.4f}  ({r(b, m) - r(a, m):+.4f})")
        return
    ro = np.array([r(a, part) for part, _ in halves(m)]); rn = np.array([r(b, part) for part, _ in halves(m)])
    print(f"   {label:22} n {m.sum():5d}  {len(U):2d} exports   off {ro.mean():.4f}   on {rn.mean():.4f}   {rn.mean() - ro.mean():+.4f}   better in {np.sum(rn > ro)}/40")


allm = np.ones(len(keys), bool)
champ = np.array(["champ" in u.lower() for u in units])
groups = [(allm, "ALL")] + [(bands == b, b) for b in W if (bands == b).any()]
if champ.any() and (~champ).any():
    groups += [(champ, "championship brackets"), (~champ, "everything else")]
# Cap and slots events ration cards, so a change to how bats are scaled against arms can cut the other way there
# (the bend, on the 36 cap exports in git: worse in 34 of 40). Series from the catalogue's rules, 2026-11-13.
CAP = """bronzecapweekly bronzeonlycapdaily c4q1 c4q4 diamondcapdaily earlyyearscap goldcapdaily goldfloorcapweekly
highironfloorgoldceilingweekly highsilverlowgoldcap ironcapdaily liveplusbronzelowgoldpopup nightmarecap openlowcap
ptcs4cap silveronlycapdaily ptcs7champcap""".split()
SLOTS = """5ldeadball 6lpowerplay allstarhardwareslots bronzeptcs3 diamondslotsdaily goldslotsdaily ironandfriends
liveslotsweekly nelslotsweekly openslotsdaily openslotsweekly silverandfriends silverfriendsslots silverslotsdaily
timetravelersslots wonkyslots""".split()
series = np.array([re.sub(r"_\d+$", "", u) for u in units])
cap, slots = np.isin(series, CAP), np.isin(series, SLOTS)
for m, l in ((cap, "cap events"), (slots, "slots events"), (~cap & ~slots, "no cap, no slots")):
    if m.any() and (~m).any():
        groups.append((m, l))

print("whole score (bats + gloves + framing + arms, production weights):")
for m, l in groups:
    compare(m, l, off, on)
print("the offence term alone:")
for m, l in groups:
    compare(m, l, bat_off, bat_on)

k = bat_off.std() / bat_on.std()
print(f"(a) shape without scale: the bent offence term times {k:.3f}, the straight term's spread")
for m, l in groups:
    compare(m, l, off, rest_on + k * bat_on)

print("(b) each build's own offence multiplier, fitted on the other half of the exports")
GRID = np.arange(0.5, 1.61, 0.05)


def best(bat, other, m):
    return GRID[int(np.argmax([r(other + g * bat, m) for g in GRID]))]


for m, l in groups:
    if len(np.unique(code[m])) < 4:
        continue
    ro, rn, go, gn = [], [], [], []
    for fit, test in halves(m):
        a, b = best(bat_off, rest_off, fit), best(bat_on, rest_on, fit)
        go.append(a); gn.append(b)
        ro.append(r(rest_off + a * bat_off, test)); rn.append(r(rest_on + b * bat_on, test))
    ro, rn = np.array(ro), np.array(rn)
    print(f"   {l:22} off {ro.mean():.4f} (x{np.mean(go):.2f})   on {rn.mean():.4f} (x{np.mean(gn):.2f})   {rn.mean() - ro.mean():+.4f}   better in {np.sum(rn > ro)}/40")
