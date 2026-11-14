from server.security import auth
from server.security import body
from flask import g
from db import get_db
from flask import jsonify
from db import now
from services import require
import secrets

def register(app):
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
