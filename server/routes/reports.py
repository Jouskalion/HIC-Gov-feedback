from flask import Response
from server.security import auth
import csv
from server.report_service import filtered_records
from db import get_db
import io
import json
from flask import jsonify
from flask import request
from services import require

def register(app):
    @app.get('/api/public/stats')
    def stats():
        records=filtered_records();c=get_db();groups={};trend={};channels={};ratings=[0]*5
        for d in c.execute('SELECT * FROM departments'):
            if request.args.get('region') and d['region']!=request.args['region']:continue
            groups[d['name']]={'name':d['name'],'region':d['region'],'total':0,'positive':0,'negative':0,'valid':0,'rectified':0,'ontime':0}
        for r in records:
            v=groups[r['department']];v['total']+=1;v['positive']+=r['rating']>=4;v['negative']+=r['rating']<=2
            v['valid']+=r['disposition']=='valid';done=r['disposition']=='valid' and r['status']=='closed';v['rectified']+=done;v['ontime']+=bool(done and r['closed_at']<=r['due_at'])
            day=r['created_at'][:10];trend[day]=trend.get(day,0)+1;channels[r['channel']]=channels.get(r['channel'],0)+1;ratings[r['rating']-1]+=1
        for v in groups.values():
            v['positive_rate']=round(v['positive']/v['total']*100,1) if v['total'] else None
            v['rectification_rate']=round(v['rectified']/v['valid']*100,1) if v['valid'] else None
        valid=sum(v['valid'] for v in groups.values());done=sum(v['rectified'] for v in groups.values())
        return jsonify(total=len(records),positive=sum(r['rating']>=4 for r in records),negative=sum(r['rating']<=2 for r in records),valid=valid,rectified=done,rectification_rate=round(done/valid*100,1) if valid else None,average_score=round(sum({1:0,2:3,3:6,4:8,5:10}[r['rating']] for r in records)/len(records),1) if records else None,departments=sorted(groups.values(),key=lambda v:v['total'],reverse=True),trend=[{'date':k,'count':v} for k,v in sorted(trend.items())],channels=channels,ratings=ratings,simulated=sum(r['simulated'] for r in records),recent=[{k:r[k] for k in ('id','rating','comment','department','region','title','created_at','channel','simulated')} for r in records[:12]])


    @app.get('/api/analytics')
    @auth('admin','supervisor')
    def analytics():
        rows=[dict(x) for x in get_db().execute('SELECT s.*,e.rating,c.simulated FROM surveys s JOIN evaluations e ON e.id=s.evaluation_id JOIN cases c ON c.id=e.case_id ORDER BY s.id DESC')]
        summaries=[]
        for instrument in ('course5','sus10'):
            for label,predicate in [('好评组',lambda r:r['rating']>=4),('基本满意组',lambda r:r['rating']==3),('差评组',lambda r:r['rating']<=2)]:
                group=[r for r in rows if r['instrument']==instrument and predicate(r)]
                if group:summaries.append({'instrument':instrument,'group':label,'n':len(group),'usability':round(sum(r['usability_score'] for r in group)/len(group),1),'workload':round(sum(r['workload_score'] for r in group)/len(group),1),'tlx':[round(sum(json.loads(r['tlx'])[i] for r in group)/len(group),1) for i in range(6)]})
        return jsonify(summaries=summaries,total=len(rows),simulated=sum(r['simulated'] for r in rows))


    @app.get('/api/export/<kind>')
    @auth('admin','supervisor')
    def export(kind):
        require(kind in ('surveys','tickets','evaluations'),'导出类型不存在',404)
        sql={'surveys':'SELECT s.*,c.simulated FROM surveys s JOIN evaluations e ON e.id=s.evaluation_id JOIN cases c ON c.id=e.case_id','tickets':'SELECT * FROM tickets','evaluations':'SELECT * FROM evaluations'}[kind]
        rows=get_db().execute(sql).fetchall();buf=io.StringIO();w=csv.writer(buf)
        if rows:
            w.writerow(rows[0].keys())
            for r in rows:w.writerow([("'"+str(v)) if isinstance(v,str) and v.startswith(('=','+','-','@','\t','\r')) else v for v in r])
        return Response('\ufeff'+buf.getvalue(),mimetype='text/csv',headers={'Content-Disposition':f'attachment; filename="{kind}.csv"'})


