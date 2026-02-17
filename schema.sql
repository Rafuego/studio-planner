-- ============================================================
-- Studio Capacity Planner — Supabase Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- TABLE: team_members
-- ============================================================
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the default "Unassigned" placeholder
INSERT INTO team_members (name) VALUES ('Unassigned');

-- ============================================================
-- TABLE: roles
-- ============================================================
CREATE TABLE roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default roles
INSERT INTO roles (name, sort_order) VALUES
  ('Strategist', 1),
  ('Designer', 2),
  ('Developer', 3),
  ('PM', 4),
  ('Copywriter', 5);

-- ============================================================
-- TABLE: projects
-- ============================================================
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT DEFAULT '',
  type TEXT DEFAULT '',
  status TEXT DEFAULT 'Incoming',
  priority TEXT DEFAULT 'P3 — Normal',
  lead TEXT DEFAULT '',
  start_date DATE,
  target_deadline DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLE: phases
-- ============================================================
CREATE TABLE phases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'Not Started',
  owner TEXT DEFAULT '',
  discipline TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  template_duration INT,
  blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT DEFAULT '',
  sort_order INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_phases_project_id ON phases(project_id);
CREATE INDEX idx_phases_status ON phases(status);

-- ============================================================
-- ROW LEVEL SECURITY — Open access for shared use
-- ============================================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to team_members" ON team_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to roles" ON roles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to projects" ON projects
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to phases" ON phases
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- ENABLE REALTIME for live multi-user sync
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE roles;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE phases;
