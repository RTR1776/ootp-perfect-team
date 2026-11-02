"""POC: extract every team's roster (by PT card ID) from an OOTP27 tournament .pt folder copy.
players.dat: card block = u16 card_type, i32 card_value, i32 card_id, u32 len + title.
text_data.dat (zip -> sqlite) league_transactions: 'Placed POS <player_N> on the active roster' per team.
Usage: python3 -I pt_rosters.py <pt_folder_copy> <out_csv>"""
import sys, re, struct, zipfile, sqlite3, io, csv, os, tempfile
src, out = sys.argv[1], sys.argv[2]
d = open(os.path.join(src, 'players.dat'), 'rb').read()
# record start: u32 pid, u32 a, u32 b, u8 day, u8 month, u16 year  -- find via bbref id strings instead:
# card block regex: u16 type (1..20), i32 value (1..120), i32 id, u32 len, title ascii with ', ' and year
pat = re.compile(rb'(..)(....)(....)(....)([ -~]{10,200}?, (?:\d{4}|Peak))', re.S)
cards = []
pos = 0
for m in pat.finditer(d):
    ctype = struct.unpack('<H', m.group(1))[0]; val = struct.unpack('<i', m.group(2))[0]
    cid = struct.unpack('<i', m.group(3))[0]; ln = struct.unpack('<I', m.group(4))[0]
    title = m.group(5)
    if ln == len(title) and 0 < ctype < 30 and 0 < val <= 125 and 0 < cid < 10**7:
        cards.append((m.start(), ctype, val, cid, title.decode('latin-1')))
# record starts: sequential pid then DOB; locate each "u32 pid" whose pid == idx+1 before card
starts = {}
pid = 1; p = 0
for off, *_ in cards:
    pass
# map record order -> pid by scanning for (pid, ?, ?, d, m, yyyy) headers
hdr = re.compile(rb'(....)(....)(....)([\x01-\x1f])([\x01-\x0c])(..)\x00\x00\x00', re.S)
recs = []
for m in hdr.finditer(d):
    pidv = struct.unpack('<I', m.group(1))[0]; yr = struct.unpack('<H', m.group(6))[0]
    if 0 < pidv < 100000 and 1830 < yr < 2015:
        recs.append((m.start(), pidv))
# keep a monotonic chain
chain = []; last = 0
for off, pv in recs:
    if pv > last and (not chain or off - chain[-1][0] > 400):
        chain.append((off, pv)); last = pv
def pid_for(off):
    best = None
    for o, pv in chain:
        if o < off: best = pv
        else: break
    return best
# transactions
z = zipfile.ZipFile(os.path.join(src, 'text_data.dat'))
tmp = tempfile.NamedTemporaryFile(suffix='.sqlite3', delete=False); tmp.write(z.read('text_data.sqlite3')); tmp.close()
db = sqlite3.connect(tmp.name)
team_of = {}; tname = {}; pos_of = {}; pname = {}
for (txt,) in db.execute("select transaction_text from league_transactions where transaction_text like '%on the active roster%'"):
    m = re.search(r'team_(\d+)\.html">([^<]+)</a>: Placed (\S+) <a href="../players/player_(\d+)\.html">([^<]+)</a>', txt)
    if m:
        t, tn, ps, p_, n = m.groups(); team_of[int(p_)] = int(t); tname[int(t)] = tn; pos_of[int(p_)] = ps; pname[int(p_)] = n
released = set()
for (txt,) in db.execute("select transaction_text from league_transactions where transaction_text like '%Released%'"):
    m = re.search(r'player_(\d+)\.html', txt)
    if m: released.add(int(m.group(1)))
import bisect
roffs=[o for o,_ in recs]
rows = []; mism = 0; seen=set()
for off, ctype, val, cid, title in cards:
    i = bisect.bisect_left(roffs, off)
    for j in range(i-1, max(-1, i-40), -1):
        o, p_ = recs[j]
        if off - o > 3000: break
        if p_ in team_of and p_ not in seen and pname[p_].split()[-1] in title:
            seen.add(p_)
            rows.append((team_of[p_], tname[team_of[p_]], p_, pos_of[p_], pname[p_], cid, val, ctype, title)); break
rows.sort()
with open(out, 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['team_id','team','player_id','pos','name','card_id','card_value','card_type','card_title'])
    w.writerows(rows)
print(f'cards={len(cards)} recs={len(chain)} rostered_players={len(team_of)} matched={len(rows)} name_mismatch={mism} teams={len(tname)}')
os.unlink(tmp.name)
