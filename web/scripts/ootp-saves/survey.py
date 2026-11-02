"""Survey all copied saves: league year (u16 after 'Great Glove Award'+9), league name, teams, last news date, human team.
Usage: python3 -I survey.py <worlds_dir>"""
import sys,os,struct,zipfile,sqlite3,tempfile,re
root=sys.argv[1]
for f in sorted(os.listdir(root)):
    p=os.path.join(root,f); w=os.path.join(p,'world.dat')
    if not os.path.exists(w): continue
    d=open(w,'rb').read(); a=d.find(b'Great Glove Award')
    yr=struct.unpack('<H',d[a+17+11:a+17+13])[0] if a>0 else None
    lg=re.findall(rb'\x00([A-Z][A-Za-z0-9 \-\'&]{3,40}) Conference',d)
    teams=last=champ=''
    t=os.path.join(p,'text_data.dat')
    if os.path.exists(t):
        try:
            z=zipfile.ZipFile(t);tmp=tempfile.NamedTemporaryFile(delete=False);tmp.write(z.read('text_data.sqlite3'));tmp.close()
            db=sqlite3.connect(tmp.name)
            teams=db.execute("select count(distinct substr(transaction_text,1,instr(transaction_text,'</a>'))) from league_transactions where transaction_text like '%active roster%'").fetchone()[0]
            last=db.execute("select max(news_date) from league_news").fetchone()[0]
            r=db.execute("select news_text from league_news where news_text like '%MVP Award%' order by news_date desc limit 1").fetchone()
            champ=re.sub('<[^>]+>','',r[0])[:70] if r else ''
            os.unlink(tmp.name)
        except Exception as e: teams=str(e)[:30]
    print(f'{f[:44]:44} yr={yr} {lg[:1]} teams={teams} last={last} {champ}')
