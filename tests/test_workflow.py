"""Executable checks, using temporary databases rather than the user's records."""
import concurrent.futures
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import create_app
from services import survey_scores, RuleError

class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=tempfile.TemporaryDirectory()
        cls.template=Path(cls.root.name)/'template.db'
        create_app({'DATABASE':str(cls.template),'TESTING':True})

    @classmethod
    def tearDownClass(cls):
        cls.root.cleanup()

    def setUp(self):
        self.path=Path(self.root.name)/(self._testMethodName+'.db')
        with closing(sqlite3.connect(self.template)) as source, closing(sqlite3.connect(self.path)) as target:
            source.backup(target)
        self.app=create_app({'DATABASE':str(self.path),'TESTING':True,'SECRET_KEY':'unit-test-only'})
        self.client=self.app.test_client()
        self.csrf=self.client.get('/api/session').json['csrf']

    def post(self,url,data,expected=200):
        r=self.client.post('/api'+url,json=data,headers={'X-CSRF-Token':self.csrf})
        self.assertEqual(r.status_code,expected,r.json)
        return r.json

    def login(self,name):
        r=self.post('/login',{'username':name,'password':'Demo2026!'})
        self.csrf=r['csrf']

    def evaluation(self,rating=1):
        self.login('citizen')
        case=self.post('/cases',{'scenario':'B','department_id':1,'channel':'onsite'},201)['id']
        return self.post('/evaluations',{'case_id':case,'rating':rating,'comment':'材料清单缺少说明，造成多次往返。'},201),case

    def action(self,tid,action,detail='已经核对服务记录，确认材料清单遗漏。',**extra):
        t=self.client.get('/api/tickets/'+str(tid)).json['ticket']
        return self.post(f'/tickets/{tid}/actions',{'action':action,'version':t['version'],'detail':detail,**extra})

    def test_valid_full_loop_with_reopen(self):
        e,cid=self.evaluation();tid=e['ticket_id']
        self.login('admin');self.action(tid,'dispatch',assignee_id=4)
        self.login('rectifier');self.action(tid,'valid');self.action(tid,'plan','补全材料清单，窗口统一一次告知。');self.action(tid,'feedback','已更新清单并向群众解释办理步骤。')
        self.login('citizen');self.action(tid,'reopen','仍未说明原件是否必须携带。')
        self.login('rectifier');self.action(tid,'feedback','已进一步明确原件核验与复印件要求。')
        self.login('citizen');self.action(tid,'accept')
        t=self.client.get(f'/api/tickets/{tid}').json
        self.assertEqual(t['ticket']['status'],'closed');self.assertEqual(len(t['events']),8)

    def test_invalid_explain_recheck(self):
        e,_=self.evaluation();tid=e['ticket_id'];self.login('admin');self.action(tid,'dispatch',assignee_id=4)
        self.login('rectifier');self.action(tid,'invalid','已查验清单，告知完整；不满足受理条件。')
        self.login('citizen');self.action(tid,'reopen','窗口工作人员此前口头告知不需要该材料。')
        self.login('rectifier');self.action(tid,'valid','核实录音发现口头说明与清单不一致。')
        self.action(tid,'plan','统一口头说明并培训窗口工作人员。');self.action(tid,'feedback','已完成培训并提供完整材料清单。')
        self.login('citizen');self.action(tid,'accept')

    def test_duplicates_conflicts_and_roles(self):
        e,cid=self.evaluation();tid=e['ticket_id']
        self.post('/evaluations',{'case_id':cid,'rating':1,'comment':'重复提交测试'},409)
        self.post(f'/tickets/{tid}/actions',{'action':'dispatch','version':1,'assignee_id':4},403)
        self.login('admin');self.action(tid,'dispatch',assignee_id=4)
        self.post(f'/tickets/{tid}/actions',{'action':'valid','version':1,'detail':'核实材料存在告知遗漏'},409)
        self.login('rectifier2');self.assertEqual(self.client.get(f'/api/tickets/{tid}').status_code,403)
        self.post(f'/tickets/{tid}/actions',{'action':'valid','version':2,'detail':'核实材料存在告知遗漏'},403)

    def test_survey_and_groups(self):
        e,_=self.evaluation(5)
        self.post('/surveys',{'evaluation_id':e['evaluation_id'],'instrument':'sus10','answers':[5,1]*5,'tlx':[0,10,20,30,40,50]},201)
        self.post('/surveys',{'evaluation_id':e['evaluation_id'],'instrument':'course5','answers':[5]*5,'tlx':[0]*6},409)
        self.login('admin');data=self.client.get('/api/analytics').json
        self.assertTrue(any(s['instrument']=='sus10' and s['usability']==100 for s in data['summaries']))
        for k in ('surveys','tickets','evaluations'):self.assertEqual(self.client.get('/api/export/'+k).status_code,200)
        self.assertEqual(self.client.get('/api/export/secret').status_code,404)

    def test_scores_and_validation(self):
        self.assertEqual(survey_scores('course5',[5]*5,[50]*6),(100,50))
        self.assertEqual(survey_scores('sus10',[1,5]*5,[100]*6),(0,100))
        for instrument,a,t in [('bad',[1]*5,[0]*6),('course5',[6]*5,[0]*6),('course5',[True]*5,[0]*6),('course5',[5]*5,[101]*6),('sus10',[5]*5,[0]*6)]:
            with self.assertRaises(RuleError):survey_scores(instrument,a,t)

    def test_register_ownership_csrf(self):
        self.assertEqual(self.client.post('/api/login',json={}).status_code,403)
        self.post('/register',{'username':'new_user','name':'新群众','password':'Demo2026!'},201)
        self.login('new_user');self.assertEqual(self.client.get('/api/cases').json['items'],[])
        self.post('/evaluations',{'case_id':1,'rating':5},403)
        self.assertEqual(self.client.get('/api/analytics').status_code,403)
        self.post('/register',{'username':'new_user','name':'重名','password':'Demo2026!'},409)
        self.post('/logout',{});self.assertEqual(self.client.get('/api/tickets').status_code,401)

    def test_messages_and_public_filters(self):
        _,cid=self.evaluation(4)
        d=self.post('/messages',{'case_id':cid},201)
        self.assertEqual(self.client.get('/api/invite/'+d['token']).json['case_id'],cid)
        self.assertGreater(len(self.client.get('/api/messages').json['items']),0)
        self.assertEqual(self.client.get('/api/invite/not-present').status_code,404)
        empty=self.client.get('/api/public/stats?region=不存在&start=2099-01-01&end=2099-01-02').json
        self.assertEqual(empty['total'],0);self.assertIsNone(empty['rectification_rate'])
        with self.client.get('/') as response:self.assertEqual(response.status_code,200)
        self.assertEqual(self.client.get('/api/meta').status_code,200)

    def test_window_and_validation(self):
        self.login('window');self.assertTrue(all(x['department_id']==1 for x in self.client.get('/api/cases').json['items']))
        self.post('/evaluations',{},403);self.assertEqual(self.client.get('/api/evaluations').status_code,200)
        self.login('citizen');self.post('/cases',{'scenario':'Z'},400)
        self.post('/cases',{'channel':'invalid'},400)
        self.post('/evaluations',{'case_id':999,'rating':1},404)
        cid=self.post('/cases',{},201)['id']
        self.post('/evaluations',{'case_id':cid,'rating':0},400)
        self.post('/evaluations',{'case_id':cid,'rating':1},400)
        self.post('/evaluations',{'case_id':cid,'rating':4,'target':'invalid'},400)

    def test_transition_guards(self):
        e,_=self.evaluation();tid=e['ticket_id'];self.login('admin')
        self.post(f'/tickets/{tid}/actions',{'action':'valid','version':1,'detail':'尚未派发不可核实'},409)
        self.post(f'/tickets/{tid}/actions',{'action':'dispatch','version':1,'assignee_id':6},400)
        self.action(tid,'dispatch',assignee_id=4);self.action(tid,'remind')
        self.post(f'/tickets/{tid}/actions',{'action':'valid','version':3,'detail':'短'},400)
        self.action(tid,'valid')
        self.post(f'/tickets/{tid}/actions',{'action':'feedback','version':4,'detail':'尚未保存整改方案'},409)
        self.post(f'/tickets/{tid}/actions',{'action':'unknown','version':4},400)

    def test_100_concurrent_unique_evaluations(self):
        self.login('citizen')
        ids=[self.post('/cases',{},201)['id'] for _ in range(100)]
        def submit(cid):
            client=self.app.test_client()
            with client.session_transaction() as s:s.update(uid=1,csrf='load-test-token')
            return client.post('/api/evaluations',json={'case_id':cid,'rating':5,'comment':'并发评价模拟'},headers={'X-CSRF-Token':'load-test-token'}).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=100) as pool:
            result=list(pool.map(submit,ids))
        self.assertEqual(result.count(201),100)
        with closing(sqlite3.connect(self.path)) as c:self.assertEqual(c.execute("SELECT COUNT(*) FROM evaluations WHERE comment='并发评价模拟'").fetchone()[0],100)

if __name__=='__main__':unittest.main(verbosity=2)
