"""SQLite connection lifecycle and deterministic, explicitly simulated fixtures."""
import json
import random
import secrets
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from flask import current_app, g
from werkzeug.security import generate_password_hash

TZ = timezone(timedelta(hours=8))

def now():
    return datetime.now(TZ).isoformat(timespec='seconds')

def connect(path):
    c = sqlite3.connect(path, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    c.execute('PRAGMA journal_mode=WAL')
    c.execute('PRAGMA busy_timeout=30000')
    return c

def get_db():
    if 'db' not in g:
        g.db = connect(current_app.config['DATABASE'])
    return g.db

def init_db(path, seed=True):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(path)) as c, c:
        c.executescript(Path(__file__).with_name('schema.sql').read_text(encoding='utf-8'))
        if seed and not c.execute('SELECT 1 FROM users').fetchone():
            seed_data(c)

def seed_data(c):
    departments=[('政务服务中心','天河区'),('社会保障服务中心','越秀区'),('住房公积金服务中心','海珠区'),('市场监管服务中心','白云区')]
    c.executemany('INSERT INTO departments(name,region) VALUES (?,?)',departments)
    # Intentionally public demo credentials. Production use requires changing passwords.
    for username,name,role,dept in [('citizen','林同学','citizen',None),('window','窗口工作人员','window',1),('admin','实验管理员','admin',None),('rectifier','整改专员','rectifier',1),('supervisor','监督专员','supervisor',None)]:
        c.execute('INSERT INTO users(username,password,name,role,department_id) VALUES (?,?,?,?,?)',(username,generate_password_hash('Demo2026!'),name,role,dept))
    for dept in (2,3,4):
        c.execute('INSERT INTO users(username,password,name,role,department_id) VALUES (?,?,?,?,?)',(f'rectifier{dept}',generate_password_hash('Demo2026!'),f'{departments[dept-1][0]}整改专员','rectifier',dept))
    rng=random.Random(20261113)
    base=datetime.now(TZ)
    titles=['社保参保证明办理','住房公积金提取咨询','个体工商户登记','居住证办理咨询']
    for i in range(64):
        at=(base-timedelta(days=31-i//2,hours=i%5)).isoformat(timespec='seconds')
        dept=i%4+1
        case=c.execute('INSERT INTO cases(number,user_id,department_id,title,channel,status,scenario,materials,created_at,completed_at,simulated) VALUES (?,?,?,?,?,?,?,?,?,?,1)',(f'SIM-{i+1:05d}',1,dept,titles[i%4],['web','mobile','onsite','sms'][i%4],'completed',['A','B','C'][i%3],'教学模拟材料，非真实申请',at,at)).lastrowid
        if i>=58: continue
        rating=rng.choices([1,2,3,4,5],[1,2,1,3,8])[0]
        comment='办理指引清晰，操作方便。' if rating>=3 else '材料清单不够清楚，希望一次告知需要补充的内容。'
        eid=c.execute('INSERT INTO evaluations(case_id,user_id,target,rating,tags,comment,channel,anonymous,created_at) VALUES (?,?,?,?,?,?,?,?,?)',(case,1,'service',rating,json.dumps(['流程清晰' if rating>=3 else '材料告知不清'],ensure_ascii=False),comment,['web','mobile','onsite','sms'][i%4],1,at)).lastrowid
        if rating<=2:
            status=['pending','dispatched','rectifying','feedback','closed'][i%5]
            due=(datetime.fromisoformat(at)+timedelta(days=5)).isoformat(timespec='seconds')
            tid=c.execute('INSERT INTO tickets(evaluation_id,department_id,assignee_id,status,disposition,evidence,plan,feedback,due_at,created_at,updated_at,closed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',(eid,dept,4 if dept==1 else None,status,'valid' if status in ('rectifying','feedback','closed') else 'unreviewed','模拟核实：材料清单存在遗漏。' if status in ('rectifying','feedback','closed') else '', '完善材料清单并一次告知。' if status in ('feedback','closed') else '', '已补充清单并通知办事人。' if status in ('feedback','closed') else '',due,at,at,at if status=='closed' else None)).lastrowid
            c.execute('INSERT INTO ticket_events(ticket_id,actor_id,action,to_status,detail,created_at) VALUES (?,?,?,?,?,?)',(tid,3,'seed',status,'预置教学案例，状态为模拟快照。',at))
        answers=[rng.randint(3,5) if rating>=3 else rng.randint(1,3) for _ in range(5)]
        tlx=[rng.randrange(10,45,5) if rating>=3 else rng.randrange(40,85,5) for _ in range(6)]
        c.execute('INSERT INTO surveys(evaluation_id,user_id,instrument,answers,tlx,usability_score,workload_score,task_seconds,created_at) VALUES (?,?,?,?,?,?,?,?,?)',(eid,1,'course5',json.dumps(answers),json.dumps(tlx),(sum(answers)-5)*5,sum(tlx)/6,rng.randint(45,180),at))
    case=c.execute('SELECT id FROM cases WHERE id=64').fetchone()['id']
    c.execute('INSERT INTO messages(case_id,user_id,token,body,created_at,expires_at) VALUES (?,?,?,?,?,?)',(case,1,secrets.token_urlsafe(24),'【教学模拟】您的事项已办结，欢迎自愿评价。此消息未发送到真实手机。',now(),(base+timedelta(days=7)).isoformat(timespec='seconds')))
