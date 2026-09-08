"""Package reviewed PTCS6 evidence into the canonical portable report input."""
import csv
import json
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parent
evidence = json.loads((root / 'evidence.json').read_text())
all_formats = json.loads((root / 'all-format-matches.json').read_text())
rankings = {b['category']: b['rankings'] for b in all_formats['builds']}
blocks, tables, datasets = [], [], {}
source = {'id': 'audit', 'label': 'PTCS 6 saved roster and tournament evidence audit',
          'path': 'Docs/ptcs6-audit-2026-09-07/evidence.json',
          'description': 'Combined historical/current rankings: all-format-matches.json, derived by web/scripts/ptcs6-all-format-matches.ts from the September 4 .champ-comparables.json snapshot and current audit. Read-only database snapshot produced by web/scripts/audit-ptcs6.ts. Tables: tournaments, cards, collection_cards, uploads, rosters, roster_slots, observed_card_stats and parks. Archive lineage: web/scripts/.coverage.json and .inventory.json. Environment inputs: web/src/data/eras.json and park-factors.json.'}
source['query'] = {'engine':'postgresql','sql':';\n'.join(q['sql'] for q in evidence['queries'] if not q['params'])+';', 'description':'Original unparameterized database extraction queries. Parameterized collection and saved-roster queries, including bound values, are preserved in evidence.json. Transformations and eligibility checks are in web/scripts/audit-ptcs6.ts.', 'tables_used':['tournaments','cards','observed_card_stats','parks'], 'executed_at':evidence['capturedAt']}
def md(id, text, sourced=True):
    blocks.append({'id': id, 'type': 'markdown', 'body': text, **({'sourceId': 'audit'} if sourced else {})})
def table(id, title, rows, columns):
    datasets[id] = rows
    tables.append({'id': id, 'title': title, 'dataset': id, 'sourceId': 'audit',
                   'columns': [{'field': key, 'label': label, 'type': 'text'} for key, label in columns]})
    blocks.append({'id': id+'-block', 'type': 'table', 'tableId': id})
def f(n): return f'{n:,.0f}'

md('title', '# PTCS 6: build audit and tournament matches', False)
md('summary', '''## Executive Summary

- **All five saved rosters pass the recorded rules.** Bronze, Silver, Gold, Diamond and Cap each have 26 unique owned cards, complete legal handed lineups and no recorded eligibility violations. Cap uses 1,609 of 1,610 value points. Its numeric 50 floor remains an interpretation of the announced High Iron floor.
- **The builds are legal starting points, not RE-optimized recommendations.** Fit and pWOBA/pFIP use generic ratings models. The era affects staff size; the scoring functions do not take the championship RE or park. The build page also displayed the wrong Wrigley version for Gold and wrong Yankee version for Diamond; local source now resolves the park by name and year and shows both batting sides.
- **Direct championship performance data is absent for all five.** Gold and Diamond have useful borrowed tournament samples. Bronze and Silver have partial evidence; Cap has the weakest environment-matched evidence. The new Gold formats have no current-format card exports on file.
- **Past and present formats are ranked together, regardless of whether we have exports.** Old Sporer’s Golden Childhood is the closest modeled Diamond match. Diamond Slots leads Gold, with old Low Gold Retrospectus and old Golden Childhood close behind. Cap has no tight match in the known catalog. Data availability is shown separately from environment similarity.''')
md('rules-intro', '''## Five legal rosters, with one inferred boundary

The stored settings match the [official championship announcement](https://forums.ootpdevelopments.com/showthread.php?t=371946): September 12, best-of-nine, card years 1920–1989 and variants permitted. The table audits the saved rosters, not newly generated substitutes. Tier ceilings follow the project's established tier-and-below rule. The Cap band is interpreted as 50–74; the official post states High Iron through Low Silver in words.

“Pass” checks distinct roster size, ownership of the selected base/variant form, card value/year/type, position ratings, complete L/R lineups, DH, duplicate slots and players, variant count and team cap. It does not establish that batting order, pitcher usage, defense or the selected players maximize wins.''')
rule_rows=[]
park_rows=[]
for b in evidence['builds']:
    t=b['tournament']; r=b['rosters'][0]; c=r['validation']['counts']; p=b['env']['park']['row']
    sp=sum(s['slot'].startswith('SP') for s in r['staff']); rp=len(r['staff'])-sp
    rule_rows.append({'Build':b['category'],'Roster':str(r['id']),'Rules':f"{t['ratingsMin'] or 'tier below'}–{t['ratingsMax']}; 1920–1989",'RE / DH':f"{t['envYear']} / {'on' if t['dh'] else 'off'}",'Park':t['stadium'],'Players':str(c['players']),'Value':str(c['value'])+('/1610' if b['category']=='Cap' else ''),'Variants':str(c['variants']),'Staff':f'{sp} SP + {rp} RP','Check':'Pass recorded rules'})
    park_rows.append({'Build':b['category'],'AVG L/R':f"{p['avgL']:.3f} / {p['avgR']:.3f}",'HR L/R':f"{p['hrL']:.3f} / {p['hrR']:.3f}",'Model R/G':f"{b['env']['v']['rg']:.2f}",'Era source':b['env']['era']})
table('rules','Saved roster checks',rule_rows,[(k,k) for k in rule_rows[0]])
md('parks-intro', '''## Gold and Diamond needed the stadium year corrected

Gold was showing 1932 Wrigley factors instead of 1985; Diamond was showing a different Yankee Stadium version instead of 1987. Bronze, Silver and Cap already matched their announced park factors. The local build page now uses the same name-and-year lookup as the environment analysis, shows left/right factors and correctly says there is no observed championship data. These changes have not been deployed.

The park asymmetry matters: 1987 Yankee favors left-handed batting much more than right-handed batting. Gold's 1985 Wrigley boosts home runs from both sides; Silver's 2005 U.S. Cellular is also a strong home-run park. Cap's 1932 Wrigley boosts left-handed homers while suppressing right-handed homers. Generic Fit cannot express these differences.

Factors use 1.000 as neutral. Model R/G means runs per team/game from the existing era-plus-park calculator at a 35% left-handed batting share, not projected roster scoring. Era inputs mix CardLab profiles and MLB-derived baselines; these are comparison estimates, not an official OOTP simulation of these lineups.''')
table('parks','Championship environment factors',park_rows,[(k,k) for k in park_rows[0]])
md('definitions', '''## Read the data as borrowed evidence

**Current runs** means archived exports classified as belonging to the event's present rules. **Roster cards** counts saved-roster card IDs with any stats in that series, out of 26. **Bats ≥500 PA / arms ≥400 IP** applies the sample floors separately to each card within that series. These counts are not success rates. The database aggregates by series and card ID, so base and variant performance cannot be certified separately; tournament exports here do not supply L/R statistical splits.

**Environment gap** is the existing standardized distance across modeled R/G, strikeouts, home runs, singles and doubles per PA; smaller is closer. It is not a win probability. Park hand asymmetry, DH, card pool, team caps, slots and series length are separate checks. A matching run environment does not make an entire roster transferable. Unknown park factors and drafts are excluded. Retired formats and pre-refresh versions are included and labeled Past format. Rankings use the combined known-format population; data availability does not determine eligibility for the ranking. The September 4 snapshot preserves prior RE, park and DH settings for events subsequently changed under the same name.

Performance from the completed HD/PEL leagues is useful for league questions. It is not counted as championship tournament evidence. Competitive dumps describe team finishes and fields, not card-level performance.''')

notes={
'Bronze': 'Bronze 1910–59 is the best immediately usable donor: three current runs and substantial overlap with this roster, although the RE is 1959 and DH is on. PTCS 2 Iron Replay is the closest current park/era analogue (1969 RE, the same 1964 Shea, no DH), but its Iron ceiling and card-type rules make it a laboratory rather than a Bronze roster substitute. New Gold Slots supplies the exact 1968 RE in 1968 Connie Mack, but has DH and a different tier-slot structure.',
'Silver': 'There is no close current Silver-tier match to the 2006/U.S. Cellular target. Daily Open Slots is the nearest modeled current environment with exports, but only two runs and a stronger mixed field. Silver Slots supplies much better card overlap at 1977 Riverfront with no DH. Retired Silver Slamboree adds deeper card samples, but from the 1987/Three Rivers environment. New Gold Cap is the best new-Gold environment analogue; its 1999 RE, 1999 Jacobs Field and 1,780 total cap differ materially.',
'Gold': 'Diamond Slots is the closest modeled active environment and has 28 runs. Diamonds Are Forever has the exact 1985 Wrigley park, a nearby 1987 RE and 31 runs; it uses DH and a higher ceiling. Both are more useful environment references than the new Golds. Retired Golden Childhood has the exact 1984 RE at a different park, while old Low Gold Retrospectus offers 13 historical runs. New Golden Heart is the closest refreshed Gold environment, but has no post-refresh exports.',
'Diamond': 'Old Sporer’s Golden Childhood (1984 RE, 1958 Tiger Stadium, DH on) is the closest modeled past-or-present environment. Old Golden Heart (1977 RE, 1977 Olympic Stadium, DH on) is another close historical comparison. Late Silver is close on the modeled blended environment, but covers only one of the saved Diamond roster cards. Diamonds Are Forever and Diamond Slots are stronger practical donors: same 1987 RE/nearby park for the former, broader card coverage for both. Daily Open 1930–89 and Silver Snapshots share 1987 RE, DH and 1986 Three Rivers, but have no current exports here. Silver Snapshots also restricts card types. No current Gold is a tight Diamond-environment match.',
'Cap': 'Cap is the least supported build. New Golden Age is the nearest current non-draft environment, but 1925 is not 1935, Hamtramck is not Wrigley, it has no 1,610 cap and cards stop at 1929. There are no exports yet. Historical Silver Heart and Early Gold supply older low-strikeout context, while current Silver Slots offers individual-card evidence from a much different era. None establishes the right Cap roster or pitching plan. Treat the legal 1,609 build as a starting point, not a certified optimum.'}
chosen={
'Bronze':['Daily Bronze 1910-59','Daily Diamond Slots','Daily Low Gold Retrospectus'],
'Silver':['Daily Open Slots','Daily Silver Slots','Daily Silver Slamboree','Daily Late Silver'],
'Gold':['Daily Diamond Slots','Daily Diamonds are Forever','Daily Diamond Heart',"Daily Sporer's Golden Childhood",'Daily Low Gold Retrospectus'],
'Diamond':['Daily Diamonds are Forever','Daily Diamond Slots','Daily Diamond Heart','Daily Late Silver'],
'Cap':['Daily Silver Slots','Daily Silver Heart','Daily Early Gold',"Tuesday Sporer's Sandlot"]}
detail=[]
for b in evidence['builds']:
    cat=b['category']; md(cat.lower()+'-intro',f'## {cat}: evidence and closest tournaments\n\n'+notes[cat])
    all_matches=b['matches']+b['historicalDonors']; selected=[]
    for name in chosen[cat]:
        m=next((m for m in all_matches if m['name']==name),None)
        if m: selected.append(m)
    rows=[]
    for m in selected:
        cv=m['coverage'] or {}; historical=m['historical']; runs=m['archivedFiles'] if historical else cv.get('currentFiles',0)
        rows.append({'Source':m['name'],'Format':'Historical' if historical else 'Current','Runs':str(runs),'RE / DH':f"{m['env']['year']} / {'on' if m['dh'] else 'off'}",'Gap':f"{m['distance']:.2f}",'Eligible card IDs':str(m['eligibleRows']),'Roster cards':f"{m['rosterCardsWithData']}/26",'Bats ≥500 PA':str(m['rosterHitters500']),'Arms ≥400 IP':str(m['rosterPitchers400'])})
        for d in m['rosterData']:detail.append({'build':cat,'series':m['series'],'format':'historical' if historical else 'current','card_id':d['cardId'],'name':d['name'],'is_pitcher':d['isPitcher'],'pa':d['pa'],'ip':d['ip'],'instances':d['instances']})
    table(cat.lower()+'-data','Available card-level sources',rows,[(k,k) for k in rows[0]])
    matches=[]
    for m in rankings[cat][:8]:
        matches.append({'Event':m['name'],'Format':m['status'],'Gap':f"{m['gap']:.2f}",'RE':str(m['year']),'Park':m['park']['label'],'DH':'on' if m['dh'] else 'off','Exports for format':str(m['runs'])})
    table(cat.lower()+'-matches','Closest past or present formats',matches,[(k,k) for k in matches[0]])
    md(cat.lower()+'-transfer','Individual eligibility checks card value/year/type only. Whole-team slots, cap, variant limits and DH can still prevent transferring the roster. The park label explicitly identifies a nearest-year substitute when exact factors are unavailable.')

md('actions', '''## Next steps for championship preparation

1. **Use the saved rosters as legal baselines.** Keep the five builds intact while testing substitutions. Generic Fit is insufficient to select the final park-specific roster, batting order or usage plan.
2. **Refresh the strongest existing donors:** Diamond Slots, Diamonds Are Forever, Diamond Heart, Bronze 1910–59 and Silver Slots. These have real roster overlap; some of the strongest archives stop in late August.
3. **Use past formats where they match better.** Old Golden Childhood and Golden Heart matter for Diamond; old Low Gold Retrospectus and Golden Childhood matter for Gold. Keep each historical sample attached to its historical rules. The ranking answers similarity first; current availability and usable card samples are separate decisions.
4. **Review handedness and pitcher usage against the championship park.** Diamond's Yankee asymmetry and Cap's left/right HR split deserve explicit treatment. Staff sizes are era heuristics, not validated best-of-nine fatigue or rest simulations.
5. **Log today's results into PTCS 7 when supplied.** This audit changes no qualifying results and does not analyze the draft championship.''')
md('questions', '''## What remains to verify

- Confirm Cap's numeric floor from the in-game restrictions when convenient; the official announcement expresses the band in tier words.
- New Gold evidence is the limiting input. Finish-order dumps cannot replace card-stat exports, and the date a format cycles into service must be established before pooling old/new runs.
- There is no measured guarantee that the generic card ranking is optimal in these environments. A real RE-aware ranking needs a separately validated component-rate model or appropriately controlled tournament evidence.''')
md('limits', '''## Sources, assumptions and checks

Sources: the official September 3 [PTCS 6 announcement](https://forums.ootpdevelopments.com/showthread.php?t=371946); L.J.'s September 7 Gold refresh record in Tourney Data/refresh-2026-09.json; latest collection upload 65; live saved rosters 12–16; imported observed_card_stats; archived-file inventory; local era and park-factor tables. Full counts, rules and per-card joins are retained in evidence.json and roster-evidence.csv beside this report.

Combined rankings also use web/scripts/.champ-comparables.json (September 4 pre-refresh snapshot), through web/scripts/ptcs6-all-format-matches.ts, with all-format-matches.json retaining every scored candidate. The archive classifier uses run-number/date mapping and may be approximate at format cutovers. The inventory's UTC generation date is September 8; this audit is labeled September 7 in Chicago and uses the September 7 supplied dumps. Similarity ranks depend on the candidate set and assumed batting-hand mix. They exclude DH effects from the run-environment solve; DH and roster restrictions are shown separately. Historical samples are reference material, never relabeled as the new formats.

Validation: all five saved-roster checks pass; 21 existing roster/restriction tests pass; TypeScript and production build pass. Lint reports the same 13 pre-existing React issues as the baseline, with no additional issues from this change. App source changes are local and have not been deployed. The HTML report passed structural validation; the automated browser visual check timed out, so visual rendering is unverified.''')

connection=sqlite3.connect(':memory:')
connection.execute('create table championship_parks(build text, park text, year integer)')
connection.execute('create table park_factor_inputs(park text, year integer, hr_l real, hr_r real)')
raw_parks=json.loads((root.parents[1]/'web/src/data/park-factors.json').read_text())
connection.executemany('insert into park_factor_inputs values(?,?,?,?)', [(park,int(year),r['hrL'],r['hrR']) for park,years in raw_parks.items() for year,r in years.items()])
connection.executemany('insert into championship_parks values(?,?,?)', [(b['category'],b['env']['park']['name'],b['env']['park']['year']) for b in evidence['builds']])
park_sql="SELECT c.build, 'Left-handed' AS side, p.hr_l AS factor FROM championship_parks c JOIN park_factor_inputs p ON c.park=p.park AND c.year=p.year UNION ALL SELECT c.build, 'Right-handed' AS side, p.hr_r AS factor FROM championship_parks c JOIN park_factor_inputs p ON c.park=p.park AND c.year=p.year"
connection.row_factory=sqlite3.Row
datasets['hr_factors']=[dict(r) for r in connection.execute(park_sql)]
park_source={'id':'park_sql','label':'Championship park-year join to raw park factors','path':'web/src/data/park-factors.json','query':{'engine':'sqlite','sql':park_sql,'description':'Raw park-factor JSON loaded into park_factor_inputs; verified championship park/year selections loaded into championship_parks. Exact input loading and executed query are in build_report.py.','tables_used':['championship_parks','park_factor_inputs'],'executed_at':evidence['capturedAt']}}
(root/'park-factors.sql').write_text(park_sql+';\n')
chart={'id':'hr_factors','title':'Home-run park factors by batting side','subtitle':'1.000 is neutral. Diamond and Cap favor left-handed home runs; Gold and Silver boost both sides.','type':'bar','dataset':'hr_factors','sourceId':'park_sql','valueFormat':'number','encodings':{'x':{'field':'build','type':'nominal','label':'Championship'},'y':{'field':'factor','type':'quantitative','label':'HR park factor'},'color':{'field':'side','type':'nominal','label':'Batting side'}}}
blocks.insert(next(i for i,b in enumerate(blocks) if b['id']=='parks-block'),{'id':'park-chart','type':'chart','chartId':'hr_factors'})
artifact={'surface':'report','manifest':{'version':1,'surface':'report','title':'PTCS 6: build audit and tournament matches','description':'Saved roster compliance, environment limitations and evidence-aware comparisons for the five tournament berths.','generatedAt':evidence['capturedAt'],'filters':[],'cards':[],'charts':[chart],'tables':tables,'sources':[source,park_source],'blocks':blocks},'snapshot':{'version':1,'generatedAt':evidence['capturedAt'],'status':'ready','datasets':datasets,'accessIssues':[]},'sources':[source,park_source]}
(root/'artifact.json').write_text(json.dumps(artifact,indent=2))
with (root/'roster-evidence.csv').open('w') as stream:
    writer=csv.DictWriter(stream,fieldnames=list(detail[0]));writer.writeheader();writer.writerows(detail)
(root/'source-notes.md').write_text('Report mode: portable HTML. Audience: product stakeholders.\nRequired sections: title, Executive Summary, findings (rules, parks, data definitions and five builds), next steps, further questions, caveats.\nChart map: Parks section — grouped bar, championship x HR factor, batting side as color, 10 rows, 1.000 neutral; supports asymmetric park effects. Tables supply exact rules, source identity, sample sizes and restrictions; a distance chart would hide eligibility constraints. No causal performance claims.\nReproduce database extraction from web with: node --env-file=.env.local --import tsx scripts/audit-ptcs6.ts\nThen run this build_report.py and the Data Analytics deliver_portable_artifact.mjs command.\n')
notebook={'nbformat':4,'nbformat_minor':5,'metadata':{'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'}},'cells':[{'cell_type':'markdown','metadata':{},'source':['# PTCS 6 evidence checks\n','Run from this notebook directory. Database extraction is the read-only web/scripts/audit-ptcs6.ts companion; secrets are read by the Node environment loader and are never printed. Tables are card-ID aggregates, not variant-specific lines.']},{'cell_type':'code','execution_count':None,'metadata':{},'outputs':[],'source':['import json\n','from pathlib import Path\n','data = json.loads(Path("evidence.json").read_text())\n','for build in data["builds"]:\n','    assert build["directRows"] == 0\n','    for roster in build["rosters"]:\n','        assert roster["validation"]["ready"]\n','        assert roster["validation"]["counts"]["players"] == 26\n','    print(build["category"], build["env"]["park"]["label"], build["rosters"][0]["validation"]["counts"])\n']}]}
(root/'audit.ipynb').write_text(json.dumps(notebook,indent=2))
print(f'Prepared {len(tables)} tables, {len(blocks)} blocks, {len(detail)} per-card source rows')
