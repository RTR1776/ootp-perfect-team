# Saturday Bronze Cap — Claude's pick, 2026-09-19

PT default (2010) run environment · 2025 Standard Stadium (neutral) · DH · cards 40–69 · **cap 1,331 over 26 (51 a card)** · 128 teams, Bo7 · starts Sat 11:59 AM · Standings: Bronze + Cap. No exports of this series yet, so the field's handedness is borrowed from the Bronze weekly and the Bronze cap daily (36% LHP) and the roster shape from those fields (14 bats / 6 SP / 6 RP). Saved on /build for the event as "Claude pick 2026-09-19 (era-corrected)"; load file `Inbox/rosters/bronzecap-claude-2026-09-19.txt`.

    pnpm env:roster --name "Saturday Bronze Cap" --series bronzecapweekly --year 2010 --park "Standard Stadium" --park-year 2025 \
      --dh --min 40 --max 69 --cap 1331 --size 26 --optimize --role-trust 0.25 --starts 12 --lhp-share 0.36 --sp 6 --rp 6

Objective −72.4 weighted runs against a greedy fill of −157.2. Every 40–69 card reads below a 2010 league-average player, so the runs are relative; the cap is the whole problem and the search spent it on the vs-RHP board (64% of plate appearances) and the two arms that matter.

## vs RHP
C McCarver (68) · 1B Stan Hack (46) · 2B Jefferson Rojas (66, 128 glove) · 3B Hank Blalock (68, +11.3) · SS Kid Elberfeld (VAR, 47) · LF Steve Pearce (69) · CF Dwayne Hosey (49) · RF Aaron Hicks (63) · DH Wes Covington (67, +17.1 — the best bat on the roster, Power 143 vR)

## vs LHP
C McCarver · 1B Bob Horner (44) · 2B Rojas · 3B Elberfeld (VAR) · SS Hal Lanier (43, 133 glove) · LF Pearce (+11.3 vL, Power 132 vL) · CF Hosey · RF Hicks · DH Pete Incaviglia (46, Power 137 vL)

## Staff
Rotation: Kincannon (45), Bob Gibson (44), James McDonald (VAR, 55, +2.7), Langston (48), Bunny Hearn (45), **Fritz Ostermueller (64, +6.8; 98 stamina — the one real starter)**. Pen: Todd Jones CL (43), R.T. Walker (40, 69 stamina — the long man), Reed Garrett (49), Steve Farr (43), Zach Agnos (49), Ron Robinson (43). Bench: Horner, Incaviglia, Jerome Walton, Lanier, Tsung-Che Cheng (VAR).

26 cards · value 1,331 of 1,331 · 3 variants · legal.

## Read it with care
- Where the money went: Blalock, Covington, McCarver, Pearce, Rojas, Hicks and Ostermueller are 63–69; the other nineteen average 45. That is what a 51-a-card cap buys, and it is the same shape the Nightmare Cap forced.
- The vs-LHP board is bad by construction (McCarver −22.6 vL, Lanier −24.0): 36% of plate appearances at that weight cost less than a weaker everyday lineup would. A 45–50 right-handed catcher for the LHP board is the first thing worth finding if you have one.
- Five arms sit past the curves' fitted range (pBABIP under 50): Kincannon, Gibson, Jones, Farr, Robinson read as a direction, not a measurement.
- No exports of this series: the field read is borrowed. Export it when it ends and the next build has its own.
