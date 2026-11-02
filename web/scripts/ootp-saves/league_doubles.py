"""Print era year + the two double arrays in the world.dat league block (offsets rel. to end of 'Great Glove Award').
Usage: python3 -I league_doubles.py <worlds_dir>"""
import sys,os,struct
root=sys.argv[1]
for f in sorted(os.listdir(root)):
    w=os.path.join(root,f,'world.dat')
    if not os.path.exists(w): continue
    d=open(w,'rb').read(); a=d.find(b'Great Glove Award')
    if a<0: continue
    a+=17; yr=struct.unpack('<H',d[a+11:a+13])[0]
    def dbl(o,n): return [round(struct.unpack('<d',d[a+o+8*i:a+o+8*i+8])[0],3) for i in range(n)]
    # find start of 1.0-ish arrays: scan from +480 for first plausible double
    b1=dbl(479,16); b2=dbl(651,9)
    print(f[:26],yr,'A',b1,'B',b2)
