from flask import g
from services import require

def ticket_access(row):
    require(row is not None,'工单不存在',404)
    role=g.user['role']
    require(role in ('admin','supervisor') or (role=='citizen' and row['user_id']==g.user['id']) or (role in ('rectifier','window') and row['department_id']==g.user['department_id']),'无权查看此工单',403)


ticket_sql='SELECT t.*,e.user_id,e.rating,e.comment,e.tags,e.target,e.anonymous,c.title,c.number,c.simulated,d.name department,d.region,u.name assignee FROM tickets t JOIN evaluations e ON e.id=t.evaluation_id JOIN cases c ON c.id=e.case_id JOIN departments d ON d.id=t.department_id LEFT JOIN users u ON u.id=t.assignee_id'


