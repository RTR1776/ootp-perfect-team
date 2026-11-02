"""Dump OOTP27 park factors from a parks.dat copy. 8 doubles sit 148..92 bytes before each park-name string
(u32 length prefix + name). Field order is a GUESS: avg, avg_L, avg_R, 2B, 3B, HR, HR_L, HR_R (not yet verified
against the in-game park screen). Usage: python3 -I park_factors.py parks.dat out.csv"""
import sys,struct,re,csv
d=open(sys.argv[1],'rb').read(); w=csv.writer(open(sys.argv[2],'w'))
w.writerow(['offset','park','f1_avg','f2_avgL','f3_avgR','f4_2B','f5_3B','f6_HR','f7_HRL','f8_HRR'])
for m in re.finditer(rb'(....)([A-Z][ -~]{3,60})',d,re.S):
    n=struct.unpack('<I',m.group(1))[0]; name=m.group(2)[:n]
    if n<4 or n>60 or len(name)!=n: continue
    i=m.start(2); 
    if i<150: continue
    v=[struct.unpack('<d',d[i-148+8*k:i-140+8*k])[0] for k in range(8)]
    if all(0.5<x<1.6 for x in v) and not name.endswith((b'.pod',b'.png',b'.webp')):
        w.writerow([i,name.decode('latin-1')]+[round(x,4) for x in v])
