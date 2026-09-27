import sys,json
for f in sys.argv[1:]:
  rows=[json.loads(l.split(' ',1)[1]) for l in open(f) if l.strip()]
  fails=sum(r['a']-1 for r in rows)+(0 if rows[-1]['clear'] else 1)
  last=rows[-1]
  print(f.split('/')[-1][:-4].ljust(16),'reached',last['n'],'clear' if last['clear'] else 'DIED ','retries',fails,
   'avg t',round(sum(r['t'] for r in rows)/len(rows)),'idle%',round(100*sum(r['idle'] for r in rows)/max(1,sum(r['t']-r['brk'] for r in rows))),
   'rank@50',[r['rank'] for r in rows][-1],'maxT',max(r['t'] for r in rows))
