#!/bin/sh
# Run pt_rosters.py over every copied tournament folder and concatenate with folder + era year.
S=$(cd "$(dirname "$0")/.." && pwd)
out=$S/out/all_rosters.csv; : > $out.tmp
for p in $S/data/worlds/7ea*.pt; do f=$(basename $p .pt)
  python3 -I $S/scripts/pt_rosters.py $p $S/out/r_$f.csv | sed "s/^/$f /"
  yr=$(grep "^$f" $S/out/survey.txt | sed 's/.*yr=\([0-9]*\).*/\1/')
  tail -n +2 $S/out/r_$f.csv | sed "s/^/$f,$yr,/" >> $out.tmp; rm $S/out/r_$f.csv
done
{ echo "folder,era_year,team_id,team,player_id,pos,name,card_id,card_value,card_type,card_title"; cat $out.tmp; } > $out; rm $out.tmp
