from server.config import BASE
from server.security import body
from werkzeug.security import check_password_hash
from flask import g
from werkzeug.security import generate_password_hash
from db import get_db
from flask import jsonify
from services import require
import secrets
from flask import send_from_directory
from flask import session
from services import text

def register(app):
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
