# Tourney exports to grab (checked 2026-10-11)

**On file:** the newest regular tourney exports were imported **10-07 13:20Z** (one batch of dailies and weeklies), plus the PTCS 7 Championship brackets on 10-11. The results ledger (`my_results`, from the Monday dump) runs only to **10-04**, so the database doesn't know about events played 10-05 to 10-11 yet.

**What to do (L.J.'s plan, 10-11):** Your Tournaments cleaned to finished, non-draft events. Export **every finished non-draft event on the screen, oldest first**: `Watch Tourney Stats.command` files each one and skips nothing silently. A re-export of an event already on file just re-imports the same run. Skip drafts (PD Daily / PD Weekly), EF pop-ups and Quicks. Follow `Docs/Export Runbook - computer use.md`.

Known gaps from the ledger (played, no export on file). The 10-01 to 10-03 rows have probably aged off the screen:

| Played | Event id | Event | File it becomes | Teams |
|---|---|---|---|---|
| 2026-10-01 | 1870021 | Thursday CWhit's Cap Challenge 5 | c4q5_21 (cwhit numbering) | 128 |
| 2026-10-02 | 1940129 | Daily Late 1900s | late1900s_129 | 64 |
| 2026-10-03 | 1650200 | Daily Silver Snapshots | silversnapshots_200 | 128 |
| 2026-10-03 | 1580029 | Saturday Bronze Cap | bronzecapweekly_29 | 128 |
| 2026-10-03 | 1290203 | Daily Goldfather II | goldfather_203 | 128 |
| 2026-10-04 | 1220204 | Daily Low Bronze Only | lowbronzeonlydaily_204 | 64 |
| 2026-10-04 | 1590029 | Saturday Diamond Variety | diamondvariety_29 | 128 |
| 2026-10-04 | 1170204 | Daily Early Bronze | earlybronze_204 | 128 |
| 2026-10-04 | 1600029 | Sunday Silver and Gold Cap | highironfloorgoldceilingweekly_29 | 128 |
| 2026-10-04 | 1900131 | Daily Silver & Friends Slots | silverfriendsslots_131 | 64 |
| 2026-10-04 | 1610029 | Sunday Open Slots | openslotsweekly_29 | 128 |
| 2026-10-04 | 1820188 | Daily Bronze OOTP Era | bronzeootp_188 | 128 |
| 2026-10-04 | 1800205 | Daily Diamond Jumble Slots | diamondslotsdaily_205 | 64 |
| 2026-10-04 | 1620029 | Sunday Open Main Event | openweekly_29 | 256 |

Then everything finished from **10-05 to 10-11**.

**After:** quit the watcher, run `Push to GitHub.command`, and tell the cloud Claude. It then reruns `import:observed` if needed, refreshes `field-construction.json` and series meta, rechecks this list, and reads how the new cards are playing.
