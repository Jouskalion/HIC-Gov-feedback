PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
 name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('citizen','window','admin','rectifier','supervisor')),
 department_id INTEGER REFERENCES departments(id)
);
CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cases (
 id INTEGER PRIMARY KEY, number TEXT UNIQUE NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id),
 department_id INTEGER NOT NULL REFERENCES departments(id), title TEXT NOT NULL, channel TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'completed', scenario TEXT NOT NULL DEFAULT 'custom',
 materials TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, completed_at TEXT, simulated INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS evaluations (
 id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), user_id INTEGER NOT NULL REFERENCES users(id),
 target TEXT NOT NULL CHECK(target IN ('service','guide','window')), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 tags TEXT NOT NULL DEFAULT '[]', comment TEXT NOT NULL DEFAULT '', channel TEXT NOT NULL,
 anonymous INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
 UNIQUE(case_id,target)
);
CREATE TABLE IF NOT EXISTS tickets (
 id INTEGER PRIMARY KEY, evaluation_id INTEGER UNIQUE NOT NULL REFERENCES evaluations(id),
 department_id INTEGER NOT NULL REFERENCES departments(id), assignee_id INTEGER REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'pending', disposition TEXT NOT NULL DEFAULT 'unreviewed',
 evidence TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL DEFAULT '', feedback TEXT NOT NULL DEFAULT '',
 citizen_response TEXT NOT NULL DEFAULT '', due_at TEXT NOT NULL, created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, closed_at TEXT, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS ticket_events (
 id INTEGER PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES tickets(id), actor_id INTEGER REFERENCES users(id),
 action TEXT NOT NULL, from_status TEXT, to_status TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS surveys (
 id INTEGER PRIMARY KEY, evaluation_id INTEGER UNIQUE NOT NULL REFERENCES evaluations(id), user_id INTEGER NOT NULL REFERENCES users(id),
 instrument TEXT NOT NULL CHECK(instrument IN ('course5','sus10')),
 answers TEXT NOT NULL, tlx TEXT NOT NULL, usability_score REAL NOT NULL, workload_score REAL NOT NULL,
 task_seconds REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
 id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), user_id INTEGER NOT NULL REFERENCES users(id),
 token TEXT UNIQUE NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_cases_user ON cases(user_id,created_at);
CREATE INDEX IF NOT EXISTS ix_tickets_status ON tickets(status,due_at);
CREATE INDEX IF NOT EXISTS ix_evaluations_created ON evaluations(created_at,rating);
