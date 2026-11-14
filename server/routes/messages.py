from db import TZ
from server.security import auth
from server.security import body
from datetime import datetime
from flask import g
from db import get_db
from flask import jsonify
from db import now
from services import require
import secrets
from datetime import timedelta

def register(app):
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
