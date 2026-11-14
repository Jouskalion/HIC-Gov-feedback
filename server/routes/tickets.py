from server.security import auth
from server.security import body
from flask import g
from db import get_db
from flask import jsonify
from server.ticket_service import ticket_access
from server.ticket_service import ticket_sql
from services import transition

def register(app):
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


