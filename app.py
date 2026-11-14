"""Application factory and command-line entry point."""
from flask import Flask
from db import init_db
import os
import secrets
from datetime import timedelta

from server.config import BASE
from server.config import STAFF
from server import lifecycle
from server.routes import accounts, cases, evaluations, tickets, messages, reports

def create_app(config=None):
    app=Flask(__name__,static_folder='static')
    local=BASE/'.local';local.mkdir(exist_ok=True)
    key=local/'session.key'
    if not key.exists():key.write_text(secrets.token_hex(32),encoding='utf-8')
    app.config.update(SECRET_KEY=os.environ.get('SECRET_KEY') or key.read_text().strip(),DATABASE=str(local/'feedback.sqlite3'),MAX_CONTENT_LENGTH=128*1024,SESSION_COOKIE_NAME='gov_feedback_session',SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SAMESITE='Lax',PERMANENT_SESSION_LIFETIME=timedelta(hours=8))
    if config:app.config.update(config)
    init_db(app.config['DATABASE'],app.config.get('SEED',True))
    lifecycle.register(app)
    accounts.register(app)
    cases.register(app)
    evaluations.register(app)
    tickets.register(app)
    messages.register(app)
    reports.register(app)
    return app


if __name__=='__main__':
    from waitress import serve
    port=int(os.environ.get('PORT','5100'))
    print(f'Gov feedback: http://localhost:{port}',flush=True)
    serve(create_app(),host=os.environ.get('HOST','0.0.0.0'),port=port,threads=16)
