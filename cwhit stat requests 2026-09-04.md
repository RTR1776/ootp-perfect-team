# cwhit stat requests — what you can actually supply

Read off Your Tournaments at 10:00pm Central, Fri Sep 4. **25 exports** of cwhit's missing IDs are still
inside your results window. None of them are already in Archive/Completed — every one needs grabbing.

Event id = slot + 4-digit run, so "Daily Silver Slots 173" is event **1270173**.

| Tournament | Grab these runs | Event ids | Files it should produce | cwhit still missing after |
|---|---|---|---|---|
| Daily Silver Slots | **173, 172, 170, 168** | 1270173, 1270172, 1270170, 1270168 | `silverslotsdaily_173.csv`, `silverslotsdaily_172.csv`, `silverslotsdaily_170.csv`, `silverslotsdaily_168.csv` | 171, 174 |
| Daily Silver & Friends Slots | **100, 99, 97** | 1900100, 1900099, 1900097 | `silverandfriends_100.csv`, `silverandfriends_99.csv`, `silverandfriends_97.csv` | 96, 98 |
| Daily Bronze PTCS 3 Replay Slots | **100, 99, 98** | 1890100, 1890099, 1890098 | `bronzeptcs3_100.csv`, `bronzeptcs3_99.csv`, `bronzeptcs3_98.csv` | 94, 96, 97 |
| Daily Bronze 1910-59 | **169, 166** | 1640169, 1640166 | `bronze10to59_169.csv`, `bronze10to59_166.csv` | 163, 164, 165, 167, 168 |
| Daily Late Silver | **173, 171** | 1240173, 1240171 | `latesilver_173.csv`, `latesilver_171.csv` | 172, 174 |
| Daily Early Gold | **172, 171** | 1280172, 1280171 | `earlygold_172.csv`, `earlygold_171.csv` | 168, 170, 173 |
| Daily Bronze OOTP Era | **155, 153** | 1820155, 1820153 | `bronzeootp_155.csv`, `bronzeootp_153.csv` | 152, 156, 157 |
| Daily Diamond & Friends Slots | **98, 97** | 1920098, 1920097 | `diamondandfriends_98.csv`, `diamondandfriends_97.csv` | 99, 100 |
| Daily Low Diamond | **173** | 1340173 | `lowdiamonddaily_173.csv` | 167, 168, 169, 170, 171, 172 |
| Daily Gold Slots | **170** | 1320170 | `goldslotsdaily_170.csv` | 171, 172, 173 |
| Daily Open Slots | **172** | 1410172 | `openslotsdaily_172.csv` | 168, 169, 170, 171, 173 |
| Daily Silver Only Cap | **172** | 1250172 | `silveronlycap_172.csv` | 167, 168, 169, 170, 171, 173 |
| Daily Low Silver Only | **3** | 1970003 | `lowsilveronly_3.csv` | 0, 1 |

## Nothing you can do for these

cwhit's missing runs are older than anything still on your results screen:

| Tournament | cwhit needs | oldest you still have |
|---|---|---|
| Diamond Heart | 151-156 | 158 (in flight) |
| Silver Slamboree / Snapshots | 167-170 | 165 |
| Silver Heart / Roaring Silvers | 154, 156, 157 | 153 |
| Low Gold Retrospecticus | 168, 169 | 165 |
| Golden Heart | 156, 157 | 151 |

Everything else on cwhit's sheet is a tournament you don't play.

## Note on the filenames

cwhit's varnames don't all match the filer's slugs. Two to watch:

- Bronze 1910-59: he calls it `bronze10to59`, the filer writes `bronze10to50`.
- Silver & Friends: he splits the pre- and post-rename runs across two rows but uses one varname, `silverandfriends`.

Also worth telling him: his `diamondandfriends` run numbers (97-100) don't line up with the
files already in Archive/Completed under that slug (12-46), so one of the two is pointing at a different event.
