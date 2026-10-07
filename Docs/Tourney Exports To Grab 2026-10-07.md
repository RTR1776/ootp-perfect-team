# Tourney exports not filed yet (checked 2026-10-07)

Supersedes `Tourney Exports To Grab 2026-10-02.md`. Everything on that list from 09-25 to 09-30 is now filed (the 09-24 pair aged out).

**How it was checked:** every non-draft event in `my_results` from 09-25 on (the community dump runs through 10-05) was compared against the file names in every published observed `import_batches` row. Slug = `tournaments.series` for the event's slot (id ÷ 10000), and run = id mod 10000.

**Not covered:** events played 10-05 to 10-07 (the dump stops there), drafts, and EF pop-ups. Take those straight off the Your Tournaments screen.

Grab oldest first. Your Tournaments keeps about a week, so the 10-01 rows are the ones about to drop off.

| Played | Event id | Event | Teams | Finish | File it becomes |
|---|---|---|---|---|---|
| 10-01 | 1200202 | Daily Bronze Only Cap | 64 | 1 | bronzeonlycapdaily_202 |
| 10-01 | 1510028 | Thursday Splendid Silver Only Spectacular | 256 | 73 | silverweekly_28 |
| 10-01 | 1530028 | Thursday Night Gold Rush | 256 | 24 | goldweekly_28 |
| 10-01 | 1640197 | Daily Bronze 1910-59 | 64 | 53 | bronze10to50_197 |
| 10-01 | 1820185 | Daily Bronze OOTP Era | 128 | 90 | bronzeootp_185 |
| 10-01 | 1870021 | Thursday CWhit's Cap Challenge 5 | 128 | 43 | c4q1_21 (cwhit: c4q5_3) |
| 10-01 | 1890128 | Daily Bronze PTCS 3 Replay Slots | 64 | 5 | bronzeptcs3_128 |
| 10-02 | 1220202 | Daily Low Bronze Only | 64 | 58 | lowbronzeonlydaily_202 |
| 10-02 | 1290202 | Daily Goldfather II | 128 | 22 | goldfather_202 |
| 10-02 | 1410202 | Daily Open Slots | 64 | 8 | openslotsdaily_202 |
| 10-02 | 1540028 | Friday Nightmare Cap | 128 | 35 | nightmarecap_28 |
| 10-02 | 1550028 | Friday Danksville | 256 | 170 | lowironweekly_28 |
| 10-02 | 1650199 | Daily Silver Snapshots | 128 | 51 | silversnapshots_199 |
| 10-02 | 1800203 | Daily Diamond Jumble Slots | 64 | 43 | diamondslotsdaily_203 |
| 10-02 | 1820186 | Daily Bronze OOTP Era | 128 | 23 | bronzeootp_186 |
| 10-02 | 1940129 | Daily Late 1900s | 64 | 45 | late1900s_129 |
| 10-03 | 1290203 | Daily Goldfather II | 128 | 46 | goldfather_203 |
| 10-03 | 1340203 | Daily Low Diamond Only | 64 | 4 | lowdiamondonly_203 |
| 10-03 | 1580029 | Saturday Bronze Cap | 128 | 50 | bronzecapweekly_29 |
| 10-03 | 1650200 | Daily Silver Snapshots | 128 | 110 | silversnapshots_200 |
| 10-03 | 1850186 | Daily Diamond Up to 1969 | 64 | 64 | diamondupto1969_186 |
| 10-03 | 1860186 | Daily Live Plus | 64 | 62 | liveplus_186 |
| 10-03 | 1890129 | Daily Bronze PTCS 3 Replay Slots | 64 | 25 | bronzeptcs3_129 |
| 10-03 | 1950018 | Saturday Negro Leagues Slots | 128 | 24 | nelslotsweekly_18 |
| 10-04 | 1170204 | Daily Early Bronze | 128 | 5 | earlybronze_204 |
| 10-04 | 1220204 | Daily Low Bronze Only | 64 | 33 | lowbronzeonlydaily_204 |
| 10-04 | 1590029 | Saturday Diamond Variety | 128 | 8 | diamondvariety_29 |
| 10-04 | 1600029 | Sunday Silver and Gold Cap | 128 | 13 | highironfloorgoldceilingweekly_29 |
| 10-04 | 1610029 | Sunday Open Slots | 128 | 42 | openslotsweekly_29 |
| 10-04 | 1620029 | Sunday Open Main Event | 256 | 196 | openweekly_29 |
| 10-04 | 1800205 | Daily Diamond Jumble Slots | 64 | 25 | diamondslotsdaily_205 |
| 10-04 | 1820188 | Daily Bronze OOTP Era | 128 | 24 | bronzeootp_188 |
| 10-04 | 1900131 | Daily Silver & Friends Slots | 64 | 43 | silverfriendsslots_131 |

Dates are the dump's UTC start dates, so a late-evening event can show a day late.

Most wanted, beyond simply not losing data:
- **Diamond 1990 Onward** has only runs 24 and 25. Its model check (10-05) needs more runs, but 10-05 to 10-07 runs aren't in the dump. Grab any on screen.
- **Splendid Silver 28**: the 537 format dates from run 27, so run 28 is the second of the new format.
- **Danksville 28 and NEL Slots 18**: the second runs of the formats changed 09-25/26.
- **CC5 run 21**: the last run of the old Cap Challenge format, which completes its series.
