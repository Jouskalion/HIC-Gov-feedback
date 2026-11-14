from flask import g
from flask import request
from services import require
from functools import wraps

def auth(*roles):
    def decorator(f):
        @wraps(f)
        def run(*a,**kw):
            require(g.user is not None,'请先登录',401)
            require(not roles or g.user['role'] in roles,'当前角色不能执行此操作',403)
            return f(*a,**kw)
        return run
    return decorator


def body():
    data=request.get_json(silent=True)
    require(isinstance(data,dict),'请求格式无效')
    return data
