# cwhit (DCFC) uploads, 2026-11-14

From his sheet of 11-14 (`Tourney Data/DCFCStats_App_Data_Entry 2026-11-14.xlsx`), checked against the exports imported to the app and the events L.J. played. Scope (L.J.): daily and weekly tourneys dated in the last two weeks (10-31 on). No quicks, no drafts (drafts are never exported, and his sheet doesn't track ours).

## On the Mac, in this order
1. **Export the 9 events below** (File OOTP Exports.command, as usual). Each one he still lists as Missing also gets copied into `UPLOAD TO CWHIT TODAY` as it's filed.
2. **Pull, then double-click `Make cwhit Upload Folder.command`.** It now takes only his Missing rows dated in the last 14 days (`RECENT_DAYS` in `web/scripts/cwhit_upload.py`). Without a newer download it uses the 11-14 sheet in Tourney Data. It rebuilds the folder from Archive/Completed: the 56 files below plus whatever step 1 filed. Its report goes to `Archive/last-cwhit-upload-report.txt`; anything that fails his checks is listed there under "Not included".
3. **Drag the folder onto the second tab of app.cwhitstats.com/upload.** His sheet updates itself.

## Played, Missing on his sheet, not exported yet (9)
These are all still in Your Tournaments (11-12 and 11-13).

| His date | Event (id) | His file |
|---|---|---|
| 11-12 | Thursday Splendid Silver Only Spectacular (1510034) | silveronlyweekly_34.csv |
| 11-12 | Thursday Night Gold Rush (1530034) | goldweekly_34.csv |
| 11-12 | Daily Late Silver (1240244) | latesilver_244.csv |
| 11-12 | Daily Silver Snapshots (1650240) | silversnapshots_240.csv |
| 11-12 | Daily Open Slots (1410243) | openslotsdaily_243.csv |
| 11-12 | Daily Golden Age (1660239) | goldenage_239.csv |
| 11-12 | Daily Live Plus (1860226) | liveplusdaily_226.csv |
| 11-13 | Friday Nightmare Cap (1540034) | nightmarecap_34.csv |
| 11-13 | Daily Early Bronze (1170244) | earlybronze_244.csv |

Also:
- **Daily Gold Slots 1320233** (11-02, goldslotsdaily_233) was never exported and has probably dropped off the list by now.
- **Today's events, once they finish:**
  - Daily Iron Cap 1150245 → ironcapdaily_245.
  - Daily Bronze 1910-59 1640241 → bronze10to59_241.
  - Saturday NeL Slots 1950024 and Saturday Iron Warriors 1570035. His sheet doesn't have rows for these two yet.
- **Already on his sheet as Loaded or Approved, so not needed:** Late Iron 244 (stradico) and PTCS 2 Iron 227.

## Already in Archive/Completed, Missing on his sheet (56)
The folder builder picks all of these up. "Ours" is shown only when our archive name differs from his.

| His date | His file | Ours |
|---|---|---|
| 10-31 | diamond1990onward_52.csv | same |
| 10-31 | diamondvariety_33.csv | same |
| 10-31 | ironandfriends_157.csv | same |
| 10-31 | irondreamland_228.csv | same |
| 10-31 | lateiron_232.csv | same |
| 10-31 | latesilver_232.csv | same |
| 10-31 | nelslotsweekly_22.csv | same |
| 10-31 | ptcs2iron_215.csv | same |
| 11-01 | ashhslots_229.csv | allstarhardwareslots_229.csv |
| 11-01 | diamondjumbleslots_233.csv | diamondslotsdaily_233.csv |
| 11-01 | diamondsforever_229.csv | same |
| 11-01 | late1900s_159.csv | same |
| 11-01 | openweekly_33.csv | same |
| 11-02 | diamondjumbleslots_234.csv | diamondslotsdaily_234.csv |
| 11-02 | late1900s_160.csv | same |
| 11-02 | openslotsdaily_233.csv | same |
| 11-03 | goldfather_234.csv | same |
| 11-03 | lowgoldonlydaily_234.csv | lowgoldonly_234.csv |
| 11-03 | lowsilveronly_64.csv | same |
| 11-04 | bronze10to59_231.csv | bronze10to50_231.csv |
| 11-04 | goldfather_235.csv | same |
| 11-04 | latesilver_236.csv | same |
| 11-05 | diamond1990onward_57.csv | same |
| 11-05 | diamondjumbleslots_237.csv | diamondslotsdaily_237.csv |
| 11-05 | goldfather_236.csv | same |
| 11-05 | openslotsdaily_236.csv | same |
| 11-06 | diamond1990onward_58.csv | same |
| 11-06 | goldfather_237.csv | same |
| 11-06 | liveplusdaily_220.csv | liveplus_220.csv |
| 11-07 | ashhslots_235.csv | allstarhardwareslots_235.csv |
| 11-07 | goldenheart_222.csv | same |
| 11-07 | goldfather_238.csv | same |
| 11-07 | ironweekly_34.csv | same |
| 11-07 | late1900s_165.csv | same |
| 11-08 | diamond1990onward_60.csv | same |
| 11-08 | diamonddaily_239.csv | same |
| 11-08 | latesilver_240.csv | same |
| 11-08 | openslotsdaily_239.csv | same |
| 11-09 | diamond1990onward_61.csv | same |
| 11-09 | goldenage_236.csv | same |
| 11-09 | goldfather_240.csv | same |
| 11-09 | late1900s_167.csv | same |
| 11-09 | openslotsdaily_240.csv | same |
| 11-10 | goldenheart_225.csv | same |
| 11-10 | goldfather_241.csv | same |
| 11-10 | openslotsdaily_241.csv | same |
| 11-10 | silveronlycap_241.csv | silveronlycapdaily_241.csv |
| 11-10 | silversnapshots_238.csv | same |
| 11-11 | 1950tonow_34.csv | same |
| 11-11 | deadballweekly_34.csv | same |
| 11-11 | diamond1990onward_63.csv | same |
| 11-11 | diamondweekly_34.csv | same |
| 11-11 | goldfather_242.csv | same |
| 11-11 | late1900s_169.csv | same |
| 11-11 | liveplusdaily_225.csv | liveplus_225.csv |
| 11-11 | openslotsdaily_242.csv | same |

The archive also holds 44 older files (September and October, before 10-31) that he still lists as Missing. They're left out on purpose.
