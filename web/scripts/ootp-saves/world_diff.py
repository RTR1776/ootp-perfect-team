"""Align world.dat league blocks on 'Great Glove Award' and diff the next N bytes across folders.
Usage: python3 -I world_diff.py N folder1 folder2 ..."""
import sys
N=int(sys.argv[1]); fs=sys.argv[2:]
bl=[]
for f in fs:
    d=open(f+'/world.dat','rb').read(); a=d.find(b'Great Glove Award')+17; bl.append(d[a:a+N])
diff=[i for i in range(N) if len({b[i] for b in bl})>1]
# group runs
runs=[];s=None
for i in diff:
    if s is None or i>p+1: 
        if s is not None: runs.append((s,p))
        s=i
    p=i
if s is not None: runs.append((s,p))
for a,b in runs[:80]:
    a0=a-a%4
    print(f'+{a0:5d}', ' | '.join(x[a0:b+1+(3-(b%4))].hex() for x in bl))
print(len(runs),'runs')
