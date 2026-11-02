"""Per-tournament fingerprint from all_rosters.csv: era, teams, card value range, L.J.'s team, real save date.
Usage: python3 -I fingerprint.py all_rosters.csv folder_dates.csv out.csv"""
import csv,sys,collections,statistics
dates=dict(l.strip().split(',') for l in open(sys.argv[2]))
g=collections.defaultdict(list)
for r in csv.DictReader(open(sys.argv[1])): g[r['folder']].append(r)
w=csv.writer(open(sys.argv[3],'w')); w.writerow(['folder','saved','era','teams','cards','val_min','val_max','team_val_median','lj_team','lj_cards'])
for f,rs in sorted(g.items(),key=lambda x:dates.get(x[0],'')):
    vals=[int(r['card_value']) for r in rs]; teams=collections.defaultdict(list)
    for r in rs: teams[r['team']].append(int(r['card_value']))
    lj=[t for t in teams if 'Torrent' in t]
    w.writerow([f,dates.get(f),rs[0]['era_year'],len(teams),len(rs),min(vals),max(vals),statistics.median(sum(v) for v in teams.values()),lj[0] if lj else '',len(teams[lj[0]]) if lj else 0])
