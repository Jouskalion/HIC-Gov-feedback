"""HTTP layer for a local, multi-user government service feedback simulator."""
import csv
import io
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path
from flask import Flask, jsonify, request, session, g, send_from_directory, Response
from werkzeug.security import check_password_hash, generate_password_hash
from db import get_db, init_db, now, TZ
from services import RuleError, require, text, evaluate, transition, survey_scores

BASE=Path(__file__).resolve().parent
STAFF=('admin','window','rectifier','supervisor')

def create_app(config=None):
    app=Flask(__name__,static_folder='static')
    local=BASE/'.local';local.mkdir(exist_ok=True)
    key=local/'session.key'
    if not key.exists():key.write_text(secrets.token_hex(32),encoding='utf-8')
    app.config.update(SECRET_KEY=os.environ.get('SECRET_KEY') or key.read_text().strip(),DATABASE=str(local/'feedback.sqlite3'),MAX_CONTENT_LENGTH=128*1024,SESSION_COOKIE_NAME='gov_feedback_session',SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SAMESITE='Lax',PERMANENT_SESSION_LIFETIME=timedelta(hours=8))
    if config:app.config.update(config)
    init_db(app.config['DATABASE'],app.config.get('SEED',True))

    @app.teardown_appcontext
    def close(_):
        c=g.pop('db',None)
        if c:c.close()

    @app.errorhandler(RuleError)
    def rule_error(e):return jsonify(error=e.message),e.status

    @app.errorhandler(sqlite3.IntegrityError)
    def integrity(_):return jsonify(error='记录重复或关联数据无效，请刷新后重试'),409

    @app.errorhandler(413)
    def too_large(_):return jsonify(error='提交内容过大'),413

    @app.before_request
    def authenticate():
        g.user=None
        if session.get('uid'):
            u=get_db().execute('SELECT id,username,name,role,department_id FROM users WHERE id=?',(session['uid'],)).fetchone()
            if u:g.user=dict(u)
        if request.path.startswith('/api/') and request.method in ('POST','PUT','DELETE'):
            require(bool(session.get('csrf')) and secrets.compare_digest(request.headers.get('X-CSRF-Token',''),session['csrf']),'页面验证已过期，请刷新后重试',403)

    @app.after_request
    def headers(r):
        r.headers['X-Content-Type-Options']='nosniff'
        r.headers['Referrer-Policy']='same-origin'
        r.headers['X-Frame-Options']='DENY'
        if request.path.startswith('/api/'):r.headers['Cache-Control']='no-store'
        return r

    def auth(*roles):
        def decorator(f):
            @wraps(f)
            def run(*a,**kw):
                require(g.user is not None,'请先登录',401)
                require(not roles or g.user['role'] in roles,'当前角色不能执行此操作',403)
                return f(*a,**kw)
            return run
        return decorator

    def body():
        data=request.get_json(silent=True)
        require(isinstance(data,dict),'请求格式无效')
        return data

    @app.get('/')
    def index():return send_from_directory(BASE/'static','index.html')

    @app.get('/api/session')
    def current():
        if not session.get('csrf'):session['csrf']=secrets.token_hex(24)
        return jsonify(user=g.user,csrf=session['csrf'])

    @app.post('/api/login')
    def login():
        d=body();u=get_db().execute('SELECT * FROM users WHERE username=?',(text(d.get('username',''),60),)).fetchone()
        password=text(d.get('password',''),200)
        require(u is not None and check_password_hash(u['password'],password),'账号或密码不正确',401)
        session.clear();session.update(uid=u['id'],csrf=secrets.token_hex(24));session.permanent=True
        return jsonify(user={k:u[k] for k in ('id','username','name','role','department_id')},csrf=session['csrf'])

    @app.post('/api/register')
    def register():
        d=body();username=text(d.get('username',''),30);name=text(d.get('name',''),30);password=text(d.get('password',''),100)
        require(3<=len(username)<=30 and username.isascii() and username.replace('_','').isalnum(),'账号需为 3 至 30 位英文字母、数字或下划线')
        require(name and len(password)>=8,'请输入姓名，并设置至少 8 位密码')
        with get_db() as c:c.execute("INSERT INTO users(username,password,name,role) VALUES (?,?,?,'citizen')",(username,generate_password_hash(password),name))
        return jsonify(ok=True),201

    @app.post('/api/logout')
    def logout():session.clear();return jsonify(ok=True)

    @app.get('/api/meta')
    def meta():
        c=get_db()
        return jsonify(departments=[dict(x) for x in c.execute('SELECT * FROM departments')],staff=[dict(x) for x in c.execute("SELECT id,name,role,department_id FROM users WHERE role='rectifier'")])

    @app.get('/api/cases')
    @auth()
    def cases():
        sql='SELECT c.*,d.name department,d.region,(SELECT count(*) FROM evaluations e WHERE e.case_id=c.id AND e.target=\'service\') evaluated,(SELECT group_concat(e.target) FROM evaluations e WHERE e.case_id=c.id) evaluated_targets FROM cases c JOIN departments d ON d.id=c.department_id'
        args=[]
        if g.user['role']=='citizen':sql+=' WHERE c.user_id=?';args=[g.user['id']]
        elif g.user['role'] in ('window','rectifier'):sql+=' WHERE c.department_id=?';args=[g.user['department_id']]
        return jsonify(items=[dict(x) for x in get_db().execute(sql+' ORDER BY c.id DESC',args)])

    @app.post('/api/cases')
    @auth('citizen','window','admin')
    def create_case():
        d=body();scenario=d.get('scenario','A');require(scenario in ('A','B','C'),'请选择模拟场景')
        channel=d.get('channel','web');require(channel in ('web','mobile','onsite','sms'),'渠道无效')
        department=d.get('department_id',1);require(type(department) is int,'部门编号无效');require(get_db().execute('SELECT 1 FROM departments WHERE id=?',(department,)).fetchone(),'部门不存在')
        uid=g.user['id'] if g.user['role']=='citizen' else 1
        templates={'A':('社保参保证明办理','材料齐全，线上办结，等待群众评价。'),'B':('住房公积金提取咨询','窗口材料告知不清，群众多次补交。'),'C':('个体工商户登记','已明确告知材料清单，申请人仍缺少必要材料；需结合服务态度核实评价。')}
        title,materials=templates[scenario];at=now()
        with get_db() as c:
            cid=c.execute('INSERT INTO cases(number,user_id,department_id,title,channel,scenario,materials,created_at,completed_at,simulated) VALUES (?,?,?,?,?,?,?,?,?,1)',('LAB-'+secrets.token_hex(4).upper(),uid,department,title,channel,scenario,materials,at,at)).lastrowid
        return jsonify(id=cid),201

    @app.post('/api/evaluations')
    @auth('citizen')
    def submit_evaluation():
        with get_db() as c:
            c.execute('BEGIN IMMEDIATE');result=evaluate(c,g.user,body())
        return jsonify(result),201

    @app.get('/api/evaluations')
    @auth()
    def evaluations():
        sql='SELECT e.*,c.title,c.number,c.simulated,d.name department,d.region,t.id ticket_id,t.status ticket_status,s.id survey_id FROM evaluations e JOIN cases c ON c.id=e.case_id JOIN departments d ON d.id=c.department_id LEFT JOIN tickets t ON t.evaluation_id=e.id LEFT JOIN surveys s ON s.evaluation_id=e.id'
        args=[]
        if g.user['role']=='citizen':sql+=' WHERE e.user_id=?';args=[g.user['id']]
        elif g.user['role'] in ('window','rectifier'):sql+=' WHERE c.department_id=?';args=[g.user['department_id']]
        return jsonify(items=[dict(x) for x in get_db().execute(sql+' ORDER BY e.id DESC',args)])

    def ticket_access(row):
        require(row is not None,'工单不存在',404)
        role=g.user['role']
        require(role in ('admin','supervisor') or (role=='citizen' and row['user_id']==g.user['id']) or (role in ('rectifier','window') and row['department_id']==g.user['department_id']),'无权查看此工单',403)

    ticket_sql='SELECT t.*,e.user_id,e.rating,e.comment,e.tags,e.target,e.anonymous,c.title,c.number,c.simulated,d.name department,d.region,u.name assignee FROM tickets t JOIN evaluations e ON e.id=t.evaluation_id JOIN cases c ON c.id=e.case_id JOIN departments d ON d.id=t.department_id LEFT JOIN users u ON u.id=t.assignee_id'

    @app.get('/api/tickets')
    @auth()
    def tickets():
        sql=ticket_sql;args=[]
        if g.user['role']=='citizen':sql+=' WHERE e.user_id=?';args=[g.user['id']]
        elif g.user['role'] in ('window','rectifier'):sql+=' WHERE t.department_id=?';args=[g.user['department_id']]
        return jsonify(items=[dict(x) for x in get_db().execute(sql+' ORDER BY t.id DESC',args)])

    @app.get('/api/tickets/<int:tid>')
    @auth()
    def ticket(tid):
        c=get_db();row=c.execute(ticket_sql+' WHERE t.id=?',(tid,)).fetchone();ticket_access(row)
        return jsonify(ticket=dict(row),events=[dict(x) for x in c.execute('SELECT l.*,u.name actor FROM ticket_events l LEFT JOIN users u ON u.id=l.actor_id WHERE ticket_id=? ORDER BY l.id',(tid,))])

    @app.post('/api/tickets/<int:tid>/actions')
    @auth()
    def actions(tid):
        with get_db() as c:
            c.execute('BEGIN IMMEDIATE');result=transition(c,g.user,tid,body())
        return jsonify(result)

    @app.post('/api/surveys')
    @auth('citizen')
    def survey():
        d=body();instrument=d.get('instrument','course5');a=d.get('answers');tlx=d.get('tlx');score,load=survey_scores(instrument,a,tlx)
        e=get_db().execute('SELECT * FROM evaluations WHERE id=?',(d.get('evaluation_id'),)).fetchone()
        require(e is not None and e['user_id']==g.user['id'],'只能填写本人评价对应的问卷',403)
        seconds=d.get('task_seconds',0);require(type(seconds) in (int,float) and 0<=seconds<=86400,'任务用时无效')
        with get_db() as c:c.execute('INSERT INTO surveys(evaluation_id,user_id,instrument,answers,tlx,usability_score,workload_score,task_seconds,created_at) VALUES (?,?,?,?,?,?,?,?,?)',(e['id'],g.user['id'],instrument,json.dumps(a),json.dumps(tlx),score,load,seconds,now()))
        return jsonify(usability_score=score,workload_score=load),201

    @app.get('/api/messages')
    @auth('citizen')
    def messages():return jsonify(items=[dict(x) for x in get_db().execute('SELECT m.*,c.title FROM messages m JOIN cases c ON c.id=m.case_id WHERE m.user_id=? ORDER BY m.id DESC',(g.user['id'],))])

    @app.post('/api/messages')
    @auth('citizen','admin','window')
    def message():
        d=body();c=get_db();case=c.execute('SELECT * FROM cases WHERE id=?',(d.get('case_id'),)).fetchone();require(case is not None,'办件不存在',404)
        require(g.user['role']=='admin' or (g.user['role']=='citizen' and case['user_id']==g.user['id']) or (g.user['role']=='window' and case['department_id']==g.user['department_id']),'无权发送此办件的补评邀请',403)
        token=secrets.token_urlsafe(24)
        with c:c.execute('INSERT INTO messages(case_id,user_id,token,body,created_at,expires_at) VALUES (?,?,?,?,?,?)',(case['id'],case['user_id'],token,'【教学模拟】事项已办结，请自愿评价。本消息仅显示在模拟收件箱。',now(),(datetime.now(TZ)+timedelta(days=7)).isoformat(timespec='seconds')))
        return jsonify(token=token),201

    @app.get('/api/invite/<token>')
    @auth('citizen')
    def invitation(token):
        row=get_db().execute('SELECT * FROM messages WHERE token=?',(token,)).fetchone();require(row is not None,'补评链接不存在',404)
        require(row['user_id']==g.user['id'],'请使用该办件的群众账号登录',403)
        require(row['expires_at']>=now(),'此补评链接已过期',410)
        return jsonify(case_id=row['case_id'])

    def filtered_records():
        sql='SELECT e.*,c.simulated,c.title,d.name department,d.region,t.status,t.disposition,t.closed_at,t.due_at FROM evaluations e JOIN cases c ON c.id=e.case_id JOIN departments d ON d.id=c.department_id LEFT JOIN tickets t ON t.evaluation_id=e.id WHERE 1=1';args=[]
        for field,col in [('region','d.region'),('target','e.target'),('start','e.created_at'),('end','e.created_at')]:
            value=request.args.get(field)
            if value:
                op='>=' if field=='start' else '<=' if field=='end' else '='
                sql+=f' AND {col}{op}?';args.append(value+'T23:59:59+08:00' if field=='end' else value)
        return [dict(r) for r in get_db().execute(sql+' ORDER BY e.id DESC',args)]

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

    return app

if __name__=='__main__':
    from waitress import serve
    port=int(os.environ.get('PORT','5100'))
    print(f'Gov feedback: http://localhost:{port}',flush=True)
    serve(create_app(),host=os.environ.get('HOST','0.0.0.0'),port=port,threads=16)
