import json
D=json.load(open("lab_data.json"))
DATA=json.dumps(D,separators=(",",":"))
HTML=r"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>PT Card Lab — new card projector</title>
<style>
:root{--bg:#0c1016;--panel:#141b26;--panel2:#1b2533;--line:#27374d;--txt:#e6edf6;--mut:#8da2bd;
--accent:#4ea3ff;--good:#3ddc97;--bad:#ff6b6b;--warn:#ffc857;--pur:#b07bff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:22px 18px 70px}
h1{font-size:23px;margin:0 0 2px}.sub{color:var(--mut);font-size:13px;margin-bottom:18px}
.tabs{display:flex;gap:6px;margin-bottom:16px}
.tab{background:var(--panel);border:1px solid var(--line);color:var(--mut);padding:8px 15px;border-radius:9px;cursor:pointer;font-weight:600;font-size:13px}
.tab.on{background:var(--accent);color:#06121f;border-color:var(--accent)}
.view{display:none}.view.on{display:block}
.grid{display:grid;grid-template-columns:340px 1fr;gap:18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
.card h3{margin:0 0 12px;font-size:14px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px}
.rrow{display:flex;align-items:center;gap:10px;margin-bottom:11px}
.rrow label{width:78px;font-size:13px;font-weight:600}
.rrow input[type=range]{flex:1}
.rrow .v{width:42px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
input[type=number],select{background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:7px 9px;font-size:13px;width:100%}
.statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.stat{background:var(--panel2);border-radius:10px;padding:11px 12px}
.stat .l{color:var(--mut);font-size:10.5px;text-transform:uppercase;letter-spacing:.4px}
.stat .n{font-size:21px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px}
.big .n{font-size:26px;color:var(--accent)}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:7px 8px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th:first-child,td:first-child{text-align:left}
th{color:var(--mut);font-size:10.5px;text-transform:uppercase;letter-spacing:.4px}
.pill{display:inline-block;font-size:10px;padding:2px 7px;border-radius:5px;font-weight:700;margin-left:6px}
.pill.warn{background:rgba(255,200,87,.18);color:var(--warn)}
.pill.ok{background:rgba(61,220,151,.18);color:var(--good)}
.note{color:var(--mut);font-size:12px;margin-top:10px;font-style:italic}
.bar{height:7px;border-radius:4px;background:var(--panel2);overflow:hidden;margin-top:5px}
.bar i{display:block;height:100%;background:var(--accent)}
.eq{font-family:ui-monospace,Menlo,monospace;background:var(--panel2);padding:10px 12px;border-radius:8px;font-size:12.5px;color:var(--good);margin:10px 0}
.cmp{color:var(--mut);font-size:12px}
@media(max-width:860px){.grid{grid-template-columns:1fr}.statgrid{grid-template-columns:repeat(2,1fr)}}
</style></head><body><div class="wrap">
<h1>PT Card Lab</h1>
<div class="sub">Project any card — including one that dropped five minutes ago — straight from its ratings. Model reproduces the engine exactly (hitter OPS ±0.002, pitcher FIP ±0.00).</div>
<div class="tabs">
<div class="tab on" data-v="hit">Hitter</div><div class="tab" data-v="pit">Pitcher</div><div class="tab" data-v="eng">How the engine works</div>
</div>

<div class="view on" id="v-hit"><div class="grid">
<div class="card"><h3>Ratings</h3><div id="hIn"></div>
<h3 style="margin-top:16px">Context</h3><select id="hEra"></select>
<div class="note">Era rescales the run environment — the same card plays differently in 1927 vs 2026.</div></div>
<div><div class="statgrid" id="hStats"></div>
<div class="card"><h3>Full line</h3><table id="hTbl"></table>
<div class="note" id="hWarn"></div></div>
<div class="card" style="margin-top:14px"><h3>What's driving it</h3><table id="hDrv"></table></div></div>
</div></div>

<div class="view" id="v-pit"><div class="grid">
<div class="card"><h3>Ratings</h3><div id="pIn"></div>
<h3 style="margin-top:16px">Context</h3><select id="pEra"></select></div>
<div><div class="statgrid" id="pStats"></div>
<div class="card"><h3>Full line</h3><table id="pTbl"></table><div class="note" id="pWarn"></div></div>
<div class="card" style="margin-top:14px"><h3>What's driving it</h3><table id="pDrv"></table></div></div>
</div></div>

<div class="view" id="v-eng"><div class="card">
<h3>The model</h3>
<div class="eq">rate = env_rate &times; e<sup>&alpha;</sup> &times; (rating / 50)<sup>&beta;</sup></div>
<p style="font-size:13.5px;color:var(--mut);margin:6px 0 16px">Every rating maps to one event rate through a power law fitted on real PT league results. <b style="color:var(--txt)">&beta;</b> is the elasticity — how hard that rating pulls. <b style="color:var(--txt)">R&sup2;</b> is how much the sim actually obeys it.</p>
<table id="engT"></table>
<div class="note">Ratings are on the ~50 = league-average scale. A rating of 100 is 2&times; average input, not 2&times; the output — the exponent decides that.</div>
</div></div>

</div>
<script>
const D=__DATA__, C=D.curves, ERAS=D.eras;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const W={BB:.69,HBP:.72,s1:.89,d2:1.27,d3:1.62,HR:2.10}, FIPC=3.10;
const rate=(c,r)=>c.env_rate*Math.exp(c.alpha)*Math.pow((r||50)/50,c.beta);
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');
 $$('.view').forEach(v=>v.classList.remove('on'));$('#v-'+t.dataset.v).classList.add('on')});

const HR_=[["BA","Contact",110],["GAP","Gap",110],["POW","Power",120],["EYE","Eye",110],["K","Avoid K",110]];
const PR_=[["STU","Stuff",120],["CON","Control",120],["HRA","HR Avoid",120],["PBABIP","pBABIP",110]];
function mkInputs(el,spec,cb){el.innerHTML='';spec.forEach(([k,lab,dv])=>{
 const d=document.createElement('div');d.className='rrow';
 d.innerHTML=`<label title="${k}">${lab}</label><input type="range" min="1" max="250" value="${dv}" id="r_${k}"><span class="v" id="v_${k}">${dv}</span>`;
 el.appendChild(d);const R=d.querySelector('input');
 R.oninput=()=>{document.getElementById('v_'+k).textContent=R.value;cb()}})}
const val=k=>+document.getElementById('r_'+k).value;
function mkEras(sel){sel.innerHTML='';Object.entries(ERAS).forEach(([k,v])=>{
 const o=document.createElement('option');o.value=k;o.textContent=(/^\d{4}$/.test(k)?k+' — ':'')+v.label;sel.appendChild(o)});
 sel.value='season:pt_season'}

function scale(era){ // multiplicative env adjustment vs PT season frame
 const b=ERAS['season:pt_season'],e=ERAS[era]||b;
 return {k:e.K/b.K,bb:e.BB/b.BB,hr:e.HR/b.HR,babip:e.BABIP/b.BABIP,xbh:(e.B2+e.B3)/(b.B2+b.B3),hbp:e.HBP/b.HBP};}

function projHit(R,era){const h=C.hit,s=scale(era);
 const k=rate(h.k,R.K)*s.k, bb=rate(h.bb,R.EYE)*s.bb, hbp=h.hbp_rate_env*s.hbp;
 const bip=Math.max(1e-6,1-k-bb-hbp);
 const hr=rate(h.hr,R.POW)*s.hr*bip, bipx=bip-hr;
 const hits=rate(h.babip,R.BA)*s.babip*bipx;
 const xbh=Math.min(rate(h.xbh,R.GAP)*s.xbh*bip,hits);
 const b3=xbh*h.xbh_3b_share,b2=xbh-b3,b1=Math.max(0,hits-xbh);
 const AB=1-bb-hbp,H=b1+b2+b3+hr;
 const ba=H/AB,obp=H+bb+hbp,slg=(b1+2*b2+3*b3+4*hr)/AB;
 const woba=W.BB*bb+W.HBP*hbp+W.s1*b1+W.d2*b2+W.d3*b3+W.HR*hr;
 return{BA:ba,OBP:obp,SLG:slg,OPS:obp+slg,ISO:slg-ba,wOBA:woba,K:k,BB:bb,HR:hr,BABIP:hits/bipx,
  HR600:hr*600,parts:{k,bb,hr,b1,b2,b3,hits}};}
function projPit(R,era){const p=C.pit,s=scale(era);
 const k=rate(p.k,R.STU)*s.k, bb=rate(p.bb,R.CON)*s.bb, hbp=p.hbp_rate_env*s.hbp;
 const bip=Math.max(1e-6,1-k-bb-hbp);
 const hr=rate(p.hr,R.HRA)*s.hr*bip, bipx=bip-hr, hits=rate(p.babip,R.PBABIP)*s.babip*bipx;
 const outs=k+(bipx-hits), ip=outs/3, p9=x=>9*x/ip;
 const fip=(13*hr+3*(bb+hbp)-2*k)/ip+FIPC;
 return{FIP:fip,K9:p9(k),BB9:p9(bb),HR9:p9(hr),WHIP:(hits+hr+bb)/ip,BABIP:hits/bipx,
  wOBA:W.BB*bb+W.HBP*hbp+W.s1*hits*.78+W.d2*hits*.19+W.d3*hits*.03+W.HR*hr,K:k,BB:bb,parts:{k,bb,hr,hits}};}

const f3=v=>v.toFixed(3).replace(/^0/,''),pc=v=>(100*v).toFixed(1)+'%';
function stat(l,n,big){return `<div class="stat ${big?'big':''}"><div class="l">${l}</div><div class="n">${n}</div></div>`}
function rangeWarn(spec,R){const out=[];Object.entries(spec).forEach(([comp,c])=>{
 const rv=R[c.rating];if(rv==null)return;const [lo,hi]=c.rating_range||[0,999];
 if(rv<lo||rv>hi)out.push(`${c.rating} ${rv} is outside the fitted range ${lo}–${hi} — extrapolated, treat with caution`)});
 return out.join(' · ')}

function drawHit(){const R={};HR_.forEach(([k])=>R[k]=val(k));const era=$('#hEra').value,o=projHit(R,era);
 $('#hStats').innerHTML=stat('OPS',f3(o.OPS),1)+stat('wOBA',f3(o.wOBA))+stat('HR / 600 PA',Math.round(o.HR600))+stat('K%',pc(o.K));
 $('#hTbl').innerHTML=`<tr><th>stat</th><th>value</th></tr>`+
  [['AVG',f3(o.BA)],['OBP',f3(o.OBP)],['SLG',f3(o.SLG)],['ISO',f3(o.ISO)],['wOBA',f3(o.wOBA)],
   ['BABIP',f3(o.BABIP)],['K%',pc(o.K)],['BB%',pc(o.BB)],['HR/PA',pc(o.HR)]]
   .map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('');
 $('#hWarn').innerHTML=rangeWarn(C.hit,R)||'';
 const rows=[['K rate','K',C.hit.k],['Walks','EYE',C.hit.bb],['Home runs','POW',C.hit.hr],['Extra bases','GAP',C.hit.xbh],['BABIP','BA',C.hit.babip]];
 $('#hDrv').innerHTML=`<tr><th>driver</th><th>rating</th><th>&beta;</th><th>R&sup2;</th><th>+10 rating</th></tr>`+
  rows.map(([lab,rk,c])=>{const b=rate(c,R[rk]),u=rate(c,R[rk]+10);const d=100*(u-b)/b;
  return `<tr><td>${lab}</td><td>${R[rk]}</td><td>${c.beta.toFixed(2)}</td><td>${c.r2.toFixed(2)}${c.r2<.4?'<span class="pill warn">noisy</span>':''}</td><td>${d>0?'+':''}${d.toFixed(1)}%</td></tr>`}).join('');}
function drawPit(){const R={};PR_.forEach(([k])=>R[k]=val(k));const era=$('#pEra').value,o=projPit(R,era);
 $('#pStats').innerHTML=stat('FIP',o.FIP.toFixed(2),1)+stat('K/9',o.K9.toFixed(1))+stat('BB/9',o.BB9.toFixed(1))+stat('WHIP',o.WHIP.toFixed(2));
 $('#pTbl').innerHTML=`<tr><th>stat</th><th>value</th></tr>`+
  [['FIP',o.FIP.toFixed(2)],['K/9',o.K9.toFixed(1)],['BB/9',o.BB9.toFixed(1)],['HR/9',o.HR9.toFixed(2)],
   ['WHIP',o.WHIP.toFixed(2)],['BABIP against',f3(o.BABIP)],['wOBA against',f3(o.wOBA)]]
   .map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('');
 $('#pWarn').innerHTML=rangeWarn(C.pit,R)||'';
 const rows=[['Strikeouts','STU',C.pit.k],['Walks','CON',C.pit.bb],['HR allowed','HRA',C.pit.hr],['BABIP','PBABIP',C.pit.babip]];
 $('#pDrv').innerHTML=`<tr><th>driver</th><th>rating</th><th>&beta;</th><th>R&sup2;</th><th>+10 rating</th></tr>`+
  rows.map(([lab,rk,c])=>{const b=rate(c,R[rk]),u=rate(c,R[rk]+10);const d=100*(u-b)/b;
  return `<tr><td>${lab}</td><td>${R[rk]}</td><td>${c.beta.toFixed(2)}</td><td>${c.r2.toFixed(2)}${c.r2<.4?'<span class="pill warn">noisy</span>':''}</td><td>${d>0?'+':''}${d.toFixed(1)}%</td></tr>`}).join('');}

function drawEng(){const rows=[];
 [['HITTER',C.hit,[['k','K','fewer strikeouts'],['bb','EYE','more walks'],['hr','POW','more home runs'],['xbh','GAP','more 2B/3B'],['babip','BA','higher BABIP']]],
  ['PITCHER',C.pit,[['k','STU','more strikeouts'],['bb','CON','fewer walks'],['hr','HRA','fewer HR allowed'],['babip','PBABIP','lower BABIP']]]]
 .forEach(([grp,spec,list])=>{rows.push(`<tr><td colspan="6" style="color:var(--accent);font-weight:700;padding-top:12px">${grp}</td></tr>`);
  list.forEach(([c,rk,eff])=>{const cc=spec[c];if(!cc)return;const b=rate(cc,100),u=rate(cc,110);const d=100*(u-b)/b;
   rows.push(`<tr><td>${rk}</td><td class="cmp">${eff}</td><td>${cc.beta.toFixed(3)}</td><td>${cc.r2.toFixed(3)}${cc.r2<.4?'<span class="pill warn">noisy</span>':cc.r2>.75?'<span class="pill ok">tight</span>':''}</td><td>${cc.env_rate.toFixed(5)}</td><td>${d>0?'+':''}${d.toFixed(1)}%</td></tr>`)})});
 $('#engT').innerHTML=`<tr><th>rating</th><th>higher rating &rarr;</th><th>&beta;</th><th>R&sup2;</th><th>env rate</th><th>+10 pts</th></tr>`+rows.join('');}

mkInputs($('#hIn'),HR_,drawHit); mkInputs($('#pIn'),PR_,drawPit);
mkEras($('#hEra')); mkEras($('#pEra'));
$('#hEra').onchange=drawHit; $('#pEra').onchange=drawPit;
drawHit();drawPit();drawEng();
</script></body></html>"""
open("PT Card Lab.html","w").write(HTML.replace("__DATA__",DATA))
print("built",len(HTML)+len(DATA),"bytes")
