"""Business rules; transitions execute in the caller's SQLite transaction."""
import json
from datetime import datetime, timedelta
from db import now, TZ

class RuleError(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status

def require(condition, message, status=400):
    if not condition:
        raise RuleError(message,status)

def text(value, maximum=2000):
    require(isinstance(value,str),'请输入有效文本')
    require(len(value)<=maximum,f'内容不能超过 {maximum} 字')
    return value.strip()

def survey_scores(instrument, answers, tlx):
    require(instrument in ('course5','sus10'),'问卷版本无效')
    require(isinstance(answers,list) and len(answers)==(5 if instrument=='course5' else 10),'请完成全部可用性题目')
    require(all(type(x) is int and 1<=x<=5 for x in answers),'问卷分值必须是 1 至 5 的整数')
    require(isinstance(tlx,list) and len(tlx)==6 and all(type(x) is int and 0<=x<=100 for x in tlx),'请完成六项 0 至 100 的任务负荷评分')
    score=(sum(answers)-5)*5 if instrument=='course5' else sum(x-1 if i%2==0 else 5-x for i,x in enumerate(answers))*2.5
    return score, round(sum(tlx)/6,2)

def evaluate(c, user, data):
    case=c.execute('SELECT * FROM cases WHERE id=?',(data.get('case_id'),)).fetchone()
    require(case is not None,'办件不存在',404)
    require(case['user_id']==user['id'],'只能评价本人的办件',403)
    require(case['status']=='completed','办件完成后才能评价')
    rating=data.get('rating')
    require(type(rating) is int and 1<=rating<=5,'请选择满意度')
    target=data.get('target','service')
    require(target in ('service','guide','window'),'评价对象无效')
    channel=data.get('channel',case['channel'])
    require(channel in ('web','mobile','onsite','sms'),'评价渠道无效')
    tags=data.get('tags',[])
    require(isinstance(tags,list) and len(tags)<=8 and all(isinstance(t,str) and len(t)<=30 for t in tags),'原因标签无效')
    comment=text(data.get('comment',''),1000)
    require(rating>=3 or comment or tags,'请填写差评原因或选择原因标签，便于工作人员核实')
    require(not c.execute('SELECT id FROM evaluations WHERE case_id=? AND target=?',(case['id'],target)).fetchone(),'此办件的该对象已评价，请在评价记录中查看',409)
    at=now()
    eid=c.execute('INSERT INTO evaluations(case_id,user_id,target,rating,tags,comment,channel,anonymous,created_at) VALUES (?,?,?,?,?,?,?,?,?)',(case['id'],user['id'],target,rating,json.dumps(tags,ensure_ascii=False),comment,channel,1 if data.get('anonymous',True) else 0,at)).lastrowid
    tid=None
    if rating<=2:
        due=(datetime.now(TZ)+timedelta(days=5)).isoformat(timespec='seconds')
        tid=c.execute('INSERT INTO tickets(evaluation_id,department_id,due_at,created_at,updated_at) VALUES (?,?,?,?,?)',(eid,case['department_id'],due,at,at)).lastrowid
        c.execute('INSERT INTO ticket_events(ticket_id,actor_id,action,to_status,detail,created_at) VALUES (?,?,?,?,?,?)',(tid,user['id'],'create','pending','群众提交差评，自动创建待受理工单。',at))
    return {'evaluation_id':eid,'ticket_id':tid}

def transition(c, user, tid, data):
    row=c.execute('SELECT t.*, e.user_id AS owner FROM tickets t JOIN evaluations e ON e.id=t.evaluation_id WHERE t.id=?',(tid,)).fetchone()
    require(row is not None,'工单不存在',404)
    require(type(data.get('version')) is int and row['version']==data['version'],'工单已被其他人更新，请刷新后重试',409)
    action=data.get('action')
    old=row['status']; new=old
    updates={}; detail=text(data.get('detail',''))
    staff=user['role'] in ('admin','supervisor') or (user['role']=='rectifier' and row['department_id']==user['department_id'])
    if action=='dispatch':
        require(user['role'] in ('admin','supervisor'),'仅管理员或监督专员可派单',403)
        require(old=='pending','只有待受理工单可以派发',409)
        assignee=c.execute("SELECT * FROM users WHERE id=? AND role='rectifier'",(data.get('assignee_id'),)).fetchone()
        require(assignee is not None and assignee['department_id']==row['department_id'],'请选择负责该部门的整改专员')
        updates['assignee_id']=assignee['id'];new='dispatched';detail=detail or '工单已派发给整改专员。'
    elif action in ('valid','invalid'):
        require(staff,'没有此部门工单的核实权限',403)
        require(old=='dispatched','请先派发工单再进行核实',409)
        require(len(detail)>=6,'请填写至少 6 字的核实依据，不能只根据材料不全判断')
        updates.update(disposition=action,evidence=detail)
        if action=='valid': new='rectifying'
        else:
            new='feedback';updates['feedback']='核实结论：不属于服务整改事项。说明：'+detail
    elif action=='plan':
        require(staff,'没有此部门工单的整改权限',403)
        require(old=='rectifying','只有整改中的工单可以保存方案',409)
        require(len(detail)>=6,'请填写具体整改方案');updates['plan']=detail
    elif action=='feedback':
        require(staff,'没有此部门工单的反馈权限',403)
        require(old=='rectifying' and bool(row['plan']),'请先保存整改方案',409)
        require(len(detail)>=6,'请说明整改结果及后续措施');updates['feedback']=detail;new='feedback'
    elif action in ('accept','reopen'):
        require(user['id']==row['owner'] and user['role']=='citizen','仅评价人可确认处理结果',403)
        require(old=='feedback','当前没有待确认的处理反馈',409)
        if action=='accept':
            new='closed';updates['closed_at']=now();detail=detail or '评价人确认已收到并接受处理结果。'
        else:
            require(len(detail)>=6,'请说明不接受的原因，便于重新核实')
            new='dispatched' if row['disposition']=='invalid' else 'rectifying'
            if row['disposition']=='invalid':updates['disposition']='unreviewed'
            updates['due_at']=(datetime.now(TZ)+timedelta(days=5)).isoformat(timespec='seconds')
        updates['citizen_response']=detail
    elif action=='remind':
        require(user['role'] in ('admin','supervisor'),'仅管理或监督人员可催办',403)
        require(old!='closed','已办结工单无需催办',409)
        detail=detail or '监督催办：请及时核实、处理并反馈。'
    else:
        raise RuleError('未知的工单操作')
    updates.update(status=new,updated_at=now(),version=row['version']+1)
    sql=','.join(k+'=?' for k in updates)
    result=c.execute(f'UPDATE tickets SET {sql} WHERE id=? AND version=?',(*updates.values(),tid,row['version']))
    require(result.rowcount==1,'工单已更新，请刷新',409)
    c.execute('INSERT INTO ticket_events(ticket_id,actor_id,action,from_status,to_status,detail,created_at) VALUES (?,?,?,?,?,?,?)',(tid,user['id'],action,old,new,detail,now()))
    return {'status':new,'version':updates['version']}
