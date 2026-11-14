from db import get_db
from flask import request

def filtered_records():
    sql='SELECT e.*,c.simulated,c.title,d.name department,d.region,t.status,t.disposition,t.closed_at,t.due_at FROM evaluations e JOIN cases c ON c.id=e.case_id JOIN departments d ON d.id=c.department_id LEFT JOIN tickets t ON t.evaluation_id=e.id WHERE 1=1';args=[]
    for field,col in [('region','d.region'),('target','e.target'),('start','e.created_at'),('end','e.created_at')]:
        value=request.args.get(field)
        if value:
            op='>=' if field=='start' else '<=' if field=='end' else '='
            sql+=f' AND {col}{op}?';args.append(value+'T23:59:59+08:00' if field=='end' else value)
    return [dict(r) for r in get_db().execute(sql+' ORDER BY e.id DESC',args)]
