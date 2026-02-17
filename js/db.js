// ============================================================
// DATABASE LAYER — Supabase CRUD + Realtime
// Replaces localStorage. All functions are async.
// ============================================================

// ── FIELD MAPPING: DB snake_case ↔ App camelCase ──

function dbProjectToState(row) {
  return {
    id: row.id,
    name: row.name || '',
    client: row.client || '',
    type: row.type || '',
    status: row.status || 'Incoming',
    priority: row.priority || '',
    lead: row.lead || '',
    startDate: row.start_date || '',
    targetDeadline: row.target_deadline || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

function stateProjectToDb(project) {
  return {
    name: project.name,
    client: project.client || '',
    type: project.type || '',
    status: project.status || 'Incoming',
    priority: project.priority || '',
    lead: project.lead || '',
    start_date: project.startDate || null,
    target_deadline: project.targetDeadline || null,
    notes: project.notes || '',
  };
}

function dbPhaseToState(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name || '',
    status: row.status || 'Not Started',
    owner: row.owner || '',
    discipline: row.discipline || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    _templateDuration: row.template_duration,
    blocked: row.blocked || false,
    blockedReason: row.blocked_reason || '',
    sortOrder: row.sort_order || 1,
  };
}

function statePhaseToDb(phase) {
  return {
    project_id: phase.projectId,
    name: phase.name,
    status: phase.status || 'Not Started',
    owner: phase.owner || '',
    discipline: phase.discipline || '',
    start_date: phase.startDate || null,
    end_date: phase.endDate || null,
    template_duration: phase._templateDuration || null,
    blocked: phase.blocked || false,
    blocked_reason: phase.blockedReason || '',
    sort_order: phase.sortOrder || 1,
  };
}

// ── LOAD ALL DATA ──

async function dbLoadAll() {
  const [projectsRes, phasesRes, membersRes, rolesRes] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: true }),
    supabase.from('phases').select('*').order('sort_order', { ascending: true }),
    supabase.from('team_members').select('*').order('created_at', { ascending: true }),
    supabase.from('roles').select('*').order('sort_order', { ascending: true }),
  ]);

  if (projectsRes.error) console.error('Load projects error:', projectsRes.error);
  if (phasesRes.error) console.error('Load phases error:', phasesRes.error);
  if (membersRes.error) console.error('Load members error:', membersRes.error);
  if (rolesRes.error) console.error('Load roles error:', rolesRes.error);

  state.projects = (projectsRes.data || []).map(dbProjectToState);
  state.phases = (phasesRes.data || []).map(dbPhaseToState);

  // Build members list
  const membersData = membersRes.data || [];
  state.teamMembers = membersData.map(m => m.name);

  // Build a lookup of member id -> name for role assignments
  const memberIdToName = {};
  for (const m of membersData) {
    memberIdToName[m.id] = m.name;
  }

  // Rebuild roles + roleAssignments using the member lookup
  state.roles = (rolesRes.data || []).map(r => r.name);
  state.roleAssignments = {};
  for (const r of (rolesRes.data || [])) {
    if (r.assigned_to && memberIdToName[r.assigned_to]) {
      state.roleAssignments[r.name] = memberIdToName[r.assigned_to];
    }
  }

  // Ensure 'Unassigned' is always in the list
  if (!state.teamMembers.includes('Unassigned')) {
    state.teamMembers.unshift('Unassigned');
  }
}

// ── PROJECT CRUD ──

async function dbCreateProject(projectData) {
  const { data, error } = await supabase
    .from('projects')
    .insert(stateProjectToDb(projectData))
    .select()
    .single();
  if (error) { console.error('Create project error:', error); return null; }
  return data.id;
}

async function dbUpdateProject(id, updates) {
  const dbUpdates = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null;
  if (updates.targetDeadline !== undefined) dbUpdates.target_deadline = updates.targetDeadline || null;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.client !== undefined) dbUpdates.client = updates.client;
  if (updates.lead !== undefined) dbUpdates.lead = updates.lead;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;

  const { error } = await supabase.from('projects').update(dbUpdates).eq('id', id);
  if (error) console.error('Update project error:', error);
}

async function dbDeleteProject(id) {
  // Phases are deleted automatically by ON DELETE CASCADE
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error('Delete project error:', error);
}

// ── PHASE CRUD ──

async function dbCreatePhases(phasesArray) {
  const rows = phasesArray.map(statePhaseToDb);
  const { data, error } = await supabase.from('phases').insert(rows).select();
  if (error) { console.error('Create phases error:', error); return []; }
  return data;
}

async function dbUpdatePhase(id, updates) {
  const dbUpdates = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.owner !== undefined) dbUpdates.owner = updates.owner;
  if (updates.discipline !== undefined) dbUpdates.discipline = updates.discipline;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null;
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate || null;
  if (updates.blocked !== undefined) dbUpdates.blocked = updates.blocked;
  if (updates.blockedReason !== undefined) dbUpdates.blocked_reason = updates.blockedReason;
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;

  const { error } = await supabase.from('phases').update(dbUpdates).eq('id', id);
  if (error) console.error('Update phase error:', error);
}

async function dbBatchUpdatePhases(phasesArray) {
  // Used after cascadePhases() — upserts multiple phases' dates/sortOrders
  const rows = phasesArray.map(p => ({
    id: p.id,
    project_id: p.projectId,
    name: p.name,
    status: p.status || 'Not Started',
    owner: p.owner || '',
    discipline: p.discipline || '',
    start_date: p.startDate || null,
    end_date: p.endDate || null,
    template_duration: p._templateDuration || null,
    blocked: p.blocked || false,
    blocked_reason: p.blockedReason || '',
    sort_order: p.sortOrder || 1,
  }));

  const { error } = await supabase.from('phases').upsert(rows);
  if (error) console.error('Batch update phases error:', error);
}

async function dbDeletePhase(id) {
  const { error } = await supabase.from('phases').delete().eq('id', id);
  if (error) console.error('Delete phase error:', error);
}

// ── TEAM MEMBERS ──

async function dbAddTeamMember(name) {
  const { error } = await supabase.from('team_members').insert({ name });
  if (error) console.error('Add member error:', error);
}

async function dbRemoveTeamMember(name) {
  // ON DELETE SET NULL on roles.assigned_to handles cleanup
  const { error } = await supabase.from('team_members').delete().eq('name', name);
  if (error) console.error('Remove member error:', error);
}

// ── ROLES ──

async function dbAddRole(name) {
  const maxOrder = state.roles.length;
  const { error } = await supabase.from('roles').insert({ name, sort_order: maxOrder + 1 });
  if (error) console.error('Add role error:', error);
}

async function dbRemoveRole(name) {
  const { error } = await supabase.from('roles').delete().eq('name', name);
  if (error) console.error('Remove role error:', error);
}

async function dbRenameRole(oldName, newName) {
  const { error } = await supabase.from('roles').update({ name: newName }).eq('name', oldName);
  if (error) console.error('Rename role error:', error);
}

async function dbAssignRole(roleName, memberName) {
  let memberId = null;
  if (memberName) {
    const { data } = await supabase
      .from('team_members')
      .select('id')
      .eq('name', memberName)
      .single();
    if (data) memberId = data.id;
  }
  const { error } = await supabase
    .from('roles')
    .update({ assigned_to: memberId })
    .eq('name', roleName);
  if (error) console.error('Assign role error:', error);
}

// ── REALTIME SUBSCRIPTIONS ──

function setupRealtimeSubscriptions() {
  supabase
    .channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, handleRealtimeChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'phases' }, handleRealtimeChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, handleRealtimeChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, handleRealtimeChange)
    .subscribe();
}

let _realtimeDebounceTimer = null;

function handleRealtimeChange(payload) {
  // Debounce: batch rapid changes (e.g., cascade updates) into one reload
  clearTimeout(_realtimeDebounceTimer);
  _realtimeDebounceTimer = setTimeout(async () => {
    await dbLoadAll();
    render();
  }, 400);
}

// ── LOCALSTORAGE MIGRATION ──

async function migrateFromLocalStorage() {
  const raw = localStorage.getItem('studio-capacity-planner-v5');
  if (!raw) {
    alert('No localStorage data found to migrate.');
    return;
  }

  try {
    const old = JSON.parse(raw);

    // 1. Insert team members
    const existingMembers = state.teamMembers;
    for (const name of (old.teamMembers || [])) {
      if (name !== 'Unassigned' && !existingMembers.includes(name)) {
        await dbAddTeamMember(name);
      }
    }

    // Reload to get member IDs for role assignment
    await dbLoadAll();

    // 2. Insert roles (that don't already exist)
    for (const roleName of (old.roles || [])) {
      if (!state.roles.includes(roleName)) {
        await dbAddRole(roleName);
      }
    }

    // 3. Assign roles
    for (const [roleName, memberName] of Object.entries(old.roleAssignments || {})) {
      if (memberName && state.roles.includes(roleName)) {
        await dbAssignRole(roleName, memberName);
      }
    }

    // 4. Insert projects and remap phase projectIds
    for (const project of (old.projects || [])) {
      const oldId = project.id;
      const newId = await dbCreateProject(project);
      if (!newId) continue;

      // Get phases for this old project ID
      const projectPhases = (old.phases || []).filter(p => p.projectId === oldId);
      if (projectPhases.length > 0) {
        const remapped = projectPhases.map(p => ({ ...p, projectId: newId }));
        await dbCreatePhases(remapped);
      }
    }

    await dbLoadAll();
    render();
    alert('Migration complete! Your data has been imported from localStorage.');
  } catch (e) {
    console.error('Migration error:', e);
    alert('Migration failed. Check the browser console for details.');
  }
}
