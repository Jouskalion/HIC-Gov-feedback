from server.security import auth
from server.security import body
from services import evaluate
from flask import g
from db import get_db
import json
from flask import jsonify
from db import now
from services import require
from services import survey_scores

def register(app):
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


    @app.post('/api/surveys')
    @auth('citizen')
    def survey():
        d=body();instrument=d.get('instrument','course5');a=d.get('answers');tlx=d.get('tlx');score,load=survey_scores(instrument,a,tlx)
        e=get_db().execute('SELECT * FROM evaluations WHERE id=?',(d.get('evaluation_id'),)).fetchone()
        require(e is not None and e['user_id']==g.user['id'],'只能填写本人评价对应的问卷',403)
        seconds=d.get('task_seconds',0);require(type(seconds) in (int,float) and 0<=seconds<=86400,'任务用时无效')
        with get_db() as c:c.execute('INSERT INTO surveys(evaluation_id,user_id,instrument,answers,tlx,usability_score,workload_score,task_seconds,created_at) VALUES (?,?,?,?,?,?,?,?,?)',(e['id'],g.user['id'],instrument,json.dumps(a),json.dumps(tlx),score,load,seconds,now()))
        return jsonify(usability_score=score,workload_score=load),201
