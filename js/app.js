// ============================================================
// APP LOGIC — Studio Capacity Planner
// All mutations are async (Supabase via db.js)
// ============================================================

// ── CONSTANTS ──

const PHASE_STATUSES = ['Not Started', 'In Progress', 'In Review', 'Revisions', 'Waiting on Client', 'Done'];
const PROJECT_STATUSES = ['Incoming', 'Active', 'Waiting on Client', 'On Hold', 'Complete', 'Cancelled'];
const DISCIPLINES = ['Strategy', 'Design', 'Development', 'Motion', 'Copy', 'PM'];
const PRIORITIES = ['P1 — Urgent', 'P2 — High', 'P3 — Normal', 'P4 — Low'];
const PROJECT_TYPES = ['Deck', 'Web', 'Brand', 'LP', 'MVB', 'Retainer'];

const DEFAULT_ROLES = ['Strategist', 'Designer', 'Developer', 'PM', 'Copywriter'];

// Owner / group header color palette
const OWNER_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f97316', // orange
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#eab308', // yellow
  '#06b6d4', // cyan
  '#ef4444', // red
  '#14b8a6', // teal
  '#f43f5e', // rose
  '#8b5cf6', // violet
];

function getOwnerColor(name) {
  if (!name || name === 'Unassigned') return '#666';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return OWNER_COLORS[Math.abs(hash) % OWNER_COLORS.length];
}

const TEMPLATES = {
  Deck: [
    { name: 'Brief & Strategy', discipline: 'Strategy', ownerRole: 'Strategist', duration: 2 },
    { name: 'Content Outline', discipline: 'Copy', ownerRole: 'Copywriter', duration: 2 },
    { name: 'Design Exploration', discipline: 'Design', ownerRole: 'Designer', duration: 3 },
    { name: 'Client Review 1', discipline: 'PM', ownerRole: 'PM', duration: 2 },
    { name: 'Design Refinement', discipline: 'Design', ownerRole: 'Designer', duration: 2 },
    { name: 'Final Production', discipline: 'Design', ownerRole: 'Designer', duration: 1 },
    { name: 'Client Review 2', discipline: 'PM', ownerRole: 'PM', duration: 2 },
  ],
  Web: [
    { name: 'Discovery & Sitemap', discipline: 'Strategy', ownerRole: 'Strategist', duration: 3 },
    { name: 'Wireframes', discipline: 'Design', ownerRole: 'Designer', duration: 4 },
    { name: 'Client Review 1', discipline: 'PM', ownerRole: 'PM', duration: 3 },
    { name: 'Visual Design', discipline: 'Design', ownerRole: 'Designer', duration: 5 },
    { name: 'Client Review 2', discipline: 'PM', ownerRole: 'PM', duration: 3 },
    { name: 'Design Revisions', discipline: 'Design', ownerRole: 'Designer', duration: 3 },
    { name: 'Development', discipline: 'Development', ownerRole: 'Developer', duration: 8 },
    { name: 'QA & Testing', discipline: 'Development', ownerRole: 'Developer', duration: 2 },
    { name: 'Content Entry', discipline: 'Copy', ownerRole: 'Copywriter', duration: 2 },
    { name: 'Client Review 3', discipline: 'PM', ownerRole: 'PM', duration: 3 },
    { name: 'Launch', discipline: 'Development', ownerRole: 'Developer', duration: 1 },
  ],
  Brand: [
    { name: 'Discovery & Research', discipline: 'Strategy', ownerRole: 'Strategist', duration: 4 },
    { name: 'Strategy & Positioning', discipline: 'Strategy', ownerRole: 'Strategist', duration: 3 },
    { name: 'Client Review 1', discipline: 'PM', ownerRole: 'PM', duration: 3 },
    { name: 'Design Exploration', discipline: 'Design', ownerRole: 'Designer', duration: 5 },
    { name: 'Client Review 2', discipline: 'PM', ownerRole: 'PM', duration: 3 },
    { name: 'Design Refinement', discipline: 'Design', ownerRole: 'Designer', duration: 4 },
    { name: 'Client Review 3', discipline: 'PM', ownerRole: 'PM', duration: 3 },
    { name: 'Brand Guidelines', discipline: 'Design', ownerRole: 'Designer', duration: 3 },
    { name: 'Asset Production', discipline: 'Design', ownerRole: 'Designer', duration: 2 },
    { name: 'Final Delivery', discipline: 'PM', ownerRole: 'PM', duration: 1 },
  ],
  LP: [
    { name: 'Brief & Copy', discipline: 'Copy', ownerRole: 'Copywriter', duration: 2 },
    { name: 'Design', discipline: 'Design', ownerRole: 'Designer', duration: 3 },
    { name: 'Client Review', discipline: 'PM', ownerRole: 'PM', duration: 2 },
    { name: 'Revisions', discipline: 'Design', ownerRole: 'Designer', duration: 1 },
    { name: 'Development', discipline: 'Development', ownerRole: 'Developer', duration: 3 },
    { name: 'QA & Launch', discipline: 'Development', ownerRole: 'Developer', duration: 1 },
  ],
  MVB: [
    { name: 'Quick Discovery', discipline: 'Strategy', ownerRole: 'Strategist', duration: 1 },
    { name: 'Logo + Type + Color', discipline: 'Design', ownerRole: 'Designer', duration: 3 },
    { name: 'Client Review', discipline: 'PM', ownerRole: 'PM', duration: 2 },
    { name: 'Refinement', discipline: 'Design', ownerRole: 'Designer', duration: 2 },
    { name: 'Mini Guidelines', discipline: 'Design', ownerRole: 'Designer', duration: 1 },
    { name: 'Delivery', discipline: 'PM', ownerRole: 'PM', duration: 1 },
  ],
  Retainer: [
    { name: 'Monthly Planning', discipline: 'PM', ownerRole: 'PM', duration: 1 },
    { name: 'Design Sprint', discipline: 'Design', ownerRole: 'Designer', duration: 5 },
    { name: 'Dev Sprint', discipline: 'Development', ownerRole: 'Developer', duration: 5 },
    { name: 'Client Review', discipline: 'PM', ownerRole: 'PM', duration: 2 },
    { name: 'Revisions & Delivery', discipline: 'Design', ownerRole: 'Designer', duration: 2 },
  ],
};

// ── STATE (populated from Supabase via dbLoadAll) ──

let state = {
  projects: [],
  phases: [],
  teamMembers: ['Unassigned'],
  roles: [...DEFAULT_ROLES],
  roleAssignments: {},
};

// ============================================================
// DATE HELPERS
// ============================================================

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(startStr, endStr) {
  const a = new Date(startStr + 'T12:00:00');
  const b = new Date(endStr + 'T12:00:00');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================
// CASCADING PHASE ENGINE
// ============================================================

function cascadePhases(projectId) {
  const phases = state.phases
    .filter(p => p.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (phases.length === 0) return;

  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1];
    const curr = phases[i];
    const duration = curr.startDate && curr.endDate ? daysBetween(curr.startDate, curr.endDate) : 0;
    curr.startDate = addDays(prev.endDate, 1);
    curr.endDate = addDays(curr.startDate, Math.max(duration, 0));
  }
}

function redistributePhases(projectId, projectStart, projectEnd) {
  const phases = state.phases
    .filter(p => p.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (phases.length === 0) return;

  const totalCalendarDays = daysBetween(projectStart, projectEnd) + 1;
  if (totalCalendarDays <= 0) return;

  const durations = phases.map(p => {
    if (p.startDate && p.endDate) return Math.max(daysBetween(p.startDate, p.endDate) + 1, 1);
    return p._templateDuration || 1;
  });

  const totalTemplateDays = durations.reduce((s, d) => s + d, 0);

  let scaledDurations = durations.map(d => Math.max(Math.round((d / totalTemplateDays) * totalCalendarDays), 1));

  let scaledTotal = scaledDurations.reduce((s, d) => s + d, 0);
  const diff = totalCalendarDays - scaledTotal;
  if (diff !== 0) {
    const longestIdx = scaledDurations.indexOf(Math.max(...scaledDurations));
    scaledDurations[longestIdx] = Math.max(scaledDurations[longestIdx] + diff, 1);
  }

  let cursor = projectStart;
  for (let i = 0; i < phases.length; i++) {
    phases[i].startDate = cursor;
    phases[i].endDate = addDays(cursor, scaledDurations[i] - 1);
    cursor = addDays(phases[i].endDate, 1);
  }
}

function renumberPhases(projectId) {
  const phases = state.phases
    .filter(p => p.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  phases.forEach((p, i) => { p.sortOrder = i + 1; });
}

// ============================================================
// DATA ACCESSORS
// ============================================================

function getProjectPhases(projectId) {
  return state.phases.filter(p => p.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
}

function getProjectProgress(projectId) {
  const phases = getProjectPhases(projectId);
  if (phases.length === 0) return 0;
  const done = phases.filter(p => p.status === 'Done').length;
  return Math.round((done / phases.length) * 100);
}

function getNextPhaseDue(projectId) {
  const phases = getProjectPhases(projectId).filter(p => p.status !== 'Done' && p.endDate);
  if (phases.length === 0) return null;
  phases.sort((a, b) => a.endDate.localeCompare(b.endDate));
  return phases[0].endDate;
}

function getProject(id) { return state.projects.find(p => p.id === id); }
function getPhase(id) { return state.phases.find(p => p.id === id); }

function getOwnerForRole(role) {
  return state.roleAssignments[role] || '';
}

// ============================================================
// APP STATE
// ============================================================

let currentView = 'phases-timeline-owner';
let currentModal = null;
let tooltip = null;

const VIEWS = {
  'phases-timeline-owner': { label: 'Timeline by Owner', icon: '◫', section: 'Phases' },
  'phases-timeline-discipline': { label: 'Timeline by Discipline', icon: '◫', section: 'Phases' },
  'phases-board': { label: 'Board by Status', icon: '▦', section: 'Phases' },
  'phases-this-week': { label: 'This Week', icon: '◉', section: 'Phases' },
  'phases-blocked': { label: 'Blocked', icon: '⊘', section: 'Phases' },
  'projects-table': { label: 'All Projects', icon: '▤', section: 'Projects' },
  'projects-active': { label: 'Active Projects', icon: '▸', section: 'Projects' },
  'projects-waiting': { label: 'Waiting on Client', icon: '◷', section: 'Projects' },
  'projects-incoming': { label: 'Incoming', icon: '◈', section: 'Projects' },
  'settings-team': { label: 'Team & Roles', icon: '⚙', section: 'Settings' },
};

function render() {
  const app = document.getElementById('app');
  app.innerHTML = `${renderSidebar()}<div class="main">${renderToolbar()}<div class="content" id="content">${renderContent()}</div></div>`;
  attachEvents();
  // Auto-scroll timeline to today
  if (currentView.startsWith('phases-timeline')) {
    scrollTimelineToToday();
  }
}

function scrollTimelineToToday() {
  setTimeout(() => {
    const container = document.querySelector('.timeline-container');
    if (!container) return;
    const todayCell = container.querySelector('.timeline-day.today');
    if (!todayCell) return;
    // Scroll so today is near the left (offset by the label column width ~200px + some padding)
    const labelColWidth = 200;
    const offset = todayCell.offsetLeft - labelColWidth - 20;
    container.scrollLeft = Math.max(0, offset);
  }, 50);
}

function renderSidebar() {
  const sections = {};
  for (const [key, v] of Object.entries(VIEWS)) {
    if (!sections[v.section]) sections[v.section] = [];
    sections[v.section].push({ key, ...v });
  }

  let html = `<div class="sidebar"><div class="sidebar-header"><h1>Studio Planner</h1><p>Capacity & Timeline</p></div>`;

  for (const [section, items] of Object.entries(sections)) {
    html += `<div class="nav-section"><div class="nav-section-label">${section}</div>`;
    for (const item of items) {
      html += `<div class="nav-item ${currentView === item.key ? 'active' : ''}" data-view="${item.key}">
        <span class="icon">${item.icon}</span> ${item.label}</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function renderToolbar() {
  const view = VIEWS[currentView];
  let rightButtons = '';
  if (currentView.startsWith('projects')) {
    rightButtons = `<button class="btn btn-primary" data-action="new-project">+ New Project</button>`;
  } else if (currentView.startsWith('phases')) {
    rightButtons = `<button class="btn btn-primary" data-action="new-phase">+ New Phase</button>`;
  }

  return `<div class="toolbar"><div class="toolbar-left"><h2>${view.label}</h2></div><div class="toolbar-right">${rightButtons}</div></div>`;
}

function renderContent() {
  switch (currentView) {
    case 'phases-timeline-owner': return renderTimeline('owner');
    case 'phases-timeline-discipline': return renderTimeline('discipline');
    case 'phases-board': return renderBoard();
    case 'phases-this-week': return renderThisWeek();
    case 'phases-blocked': return renderBlocked();
    case 'projects-table': return renderProjectsTable(null);
    case 'projects-active': return renderProjectsTable('Active');
    case 'projects-waiting': return renderProjectsTable('Waiting on Client');
    case 'projects-incoming': return renderProjectsTable('Incoming');
    case 'settings-team': return renderTeamSettings();
    default: return '';
  }
}

// ============================================================
// TIMELINE VIEW
// ============================================================

function renderTimeline(groupBy) {
  const phases = state.phases.filter(p => p.status !== 'Done' && p.startDate && p.endDate);

  if (phases.length === 0) {
    return `<div class="empty-state"><h3>No active phases with dates</h3><p>Create a project from a template to populate the timeline.</p></div>`;
  }

  let minDate = phases[0].startDate;
  let maxDate = phases[0].endDate;
  for (const p of phases) {
    if (p.startDate < minDate) minDate = p.startDate;
    if (p.endDate > maxDate) maxDate = p.endDate;
  }

  const todayStr = today();
  if (todayStr < minDate) minDate = todayStr;
  minDate = addDays(minDate, -3);
  maxDate = addDays(maxDate, 7);

  // Calculate current week bounds (Mon–Sun)
  const todayDate = new Date();
  const todayDow = todayDate.getDay();
  const weekStartDate = new Date(todayDate);
  weekStartDate.setDate(todayDate.getDate() - (todayDow === 0 ? 6 : todayDow - 1));
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  const currentWeekStart = weekStartDate.toISOString().split('T')[0];
  const currentWeekEnd = weekEndDate.toISOString().split('T')[0];

  const days = [];
  let cur = new Date(minDate + 'T00:00:00');
  const end = new Date(maxDate + 'T00:00:00');
  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0];
    days.push({
      date: dateStr, dayOfWeek: cur.getDay(), dayNum: cur.getDate(),
      month: cur.toLocaleString('en-US', { month: 'short' }),
      dayName: cur.toLocaleString('en-US', { weekday: 'short' }).charAt(0),
      isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
      isToday: dateStr === todayStr,
      isCurrentWeek: dateStr >= currentWeekStart && dateStr <= currentWeekEnd,
      isFirstOfMonth: cur.getDate() === 1,
    });
    cur.setDate(cur.getDate() + 1);
  }

  const groups = {};
  for (const phase of phases) {
    const key = groupBy === 'owner' ? (phase.owner || 'Unassigned') : (phase.discipline || 'Unassigned');
    if (!groups[key]) groups[key] = [];
    groups[key].push(phase);
  }

  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  let html = `<div class="timeline-container"><div class="timeline-header">
    <div class="timeline-label-col">${groupBy === 'owner' ? 'Owner' : 'Discipline'}</div><div class="timeline-dates">`;

  for (const day of days) {
    html += `<div class="timeline-day ${day.isWeekend ? 'weekend' : ''} ${day.isToday ? 'today' : ''} ${day.isCurrentWeek ? 'current-week' : ''}">
      ${day.isFirstOfMonth || days.indexOf(day) === 0 ? `<div class="month-label">${day.month}</div>` : `<div class="day-name">${day.dayName}</div>`}
      <div class="day-num">${day.dayNum}</div></div>`;
  }

  html += `</div></div>`;

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    const groupPhases = groups[key];
    const ownerColor = getOwnerColor(key);
    html += `<div class="timeline-group"><div class="timeline-group-header-row"><div class="timeline-group-header"><span class="owner-color-dot" style="background:${ownerColor}"></span>${key} <span class="count" style="margin-left:8px;font-weight:400;color:var(--text-muted)">${groupPhases.length}</span></div></div>`;

    for (const phase of groupPhases) {
      const project = getProject(phase.projectId);
      const projectName = project ? project.name : '';
      const startIdx = days.findIndex(d => d.date === phase.startDate);
      const endIdx = days.findIndex(d => d.date === phase.endDate);
      const left = (startIdx >= 0 ? startIdx : 0) * 36;
      const width = Math.max(((endIdx >= 0 ? endIdx : days.length - 1) - (startIdx >= 0 ? startIdx : 0) + 1) * 36 - 4, 32);
      const statusClass = 'status-' + phase.status.toLowerCase().replace(/\s+/g, '-');

      html += `<div class="timeline-row">
        <div class="timeline-row-label" data-phase-id="${phase.id}" data-action="edit-phase">
          <div class="phase-name">${phase.name}</div>
          <div class="project-name">${projectName}</div>
        </div>
        <div class="timeline-row-cells" style="position:relative;min-width:${days.length * 36}px">`;

      for (const day of days) {
        html += `<div class="timeline-cell ${day.isWeekend ? 'weekend' : ''} ${day.isToday ? 'today' : ''} ${day.isCurrentWeek ? 'current-week' : ''}"></div>`;
      }

      html += `<div class="timeline-bar ${statusClass}" style="left:${left}px;width:${width}px"
        data-phase-id="${phase.id}" data-action="edit-phase"
        data-tooltip-title="${phase.name}"
        data-tooltip-meta="${projectName} · ${formatDate(phase.startDate)} – ${formatDate(phase.endDate)} · ${phase.status}">
        ${phase.name}</div></div></div>`;
    }

    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

// ============================================================
// BOARD VIEW
// ============================================================

function renderBoard() {
  let html = `<div class="board">`;

  for (const status of PHASE_STATUSES) {
    const items = state.phases.filter(p => p.status === status).sort((a, b) => (a.sortOrder - b.sortOrder) || (a.startDate || '').localeCompare(b.startDate || ''));

    html += `<div class="board-column"><div class="board-column-header"><span>${status}</span><span class="count">${items.length}</span></div><div class="board-column-body">`;

    for (const phase of items) {
      const project = getProject(phase.projectId);
      html += `<div class="board-card" data-phase-id="${phase.id}" data-action="edit-phase">
        <div class="card-title">${phase.name}</div>
        <div class="card-meta">
          ${project ? `<span>${project.name}</span>` : ''}
          ${phase.owner ? `<span>· ${phase.owner}</span>` : ''}
          ${phase.endDate ? `<span>· ${formatDate(phase.endDate)}</span>` : ''}
        </div>
        ${phase.discipline ? `<span class="badge badge-discipline-${phase.discipline.toLowerCase()}" style="margin-top:6px">${phase.discipline}</span>` : ''}
      </div>`;
    }

    if (items.length === 0) {
      html += `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">No phases</div>`;
    }

    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
}

// ============================================================
// THIS WEEK / BLOCKED VIEWS
// ============================================================

function renderThisWeek() {
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay();
  const startOfWeek = new Date(todayDate);
  startOfWeek.setDate(todayDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const weekStart = startOfWeek.toISOString().split('T')[0];
  const weekEnd = endOfWeek.toISOString().split('T')[0];

  const phases = state.phases.filter(p =>
    p.status !== 'Done' && p.startDate && p.endDate &&
    p.startDate <= weekEnd && p.endDate >= weekStart
  ).sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''));

  if (phases.length === 0) {
    return `<div class="empty-state"><h3>Nothing this week</h3><p>No active phases overlap with this week.</p></div>`;
  }

  let html = `<div style="margin-bottom:16px;font-size:12px;color:var(--text-dim)">Week of ${formatDate(weekStart)} – ${formatDate(weekEnd)}</div>
    <table class="data-table"><thead><tr><th>Phase</th><th>Project</th><th>Owner</th><th>Status</th><th>Due</th><th>Blocked</th></tr></thead><tbody>`;

  for (const phase of phases) {
    const project = getProject(phase.projectId);
    const statusClass = 'badge-status-' + phase.status.toLowerCase().replace(/\s+/g, '-');
    html += `<tr class="clickable" data-phase-id="${phase.id}" data-action="edit-phase">
      <td>${phase.name}</td>
      <td style="color:var(--text-dim)">${project ? project.name : '—'}</td>
      <td>${phase.owner || '—'}</td>
      <td><span class="badge ${statusClass}">${phase.status}</span></td>
      <td>${formatDate(phase.endDate)}</td>
      <td>${phase.blocked ? '⊘ ' + (phase.blockedReason || 'Yes') : '—'}</td>
    </tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

function renderBlocked() {
  const phases = state.phases.filter(p => p.blocked && p.status !== 'Done')
    .sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''));

  if (phases.length === 0) {
    return `<div class="empty-state"><h3>Nothing blocked</h3><p>All clear.</p></div>`;
  }

  let html = `<table class="data-table"><thead><tr><th>Phase</th><th>Project</th><th>Owner</th><th>Due</th><th>Reason</th></tr></thead><tbody>`;

  for (const phase of phases) {
    const project = getProject(phase.projectId);
    html += `<tr class="clickable" data-phase-id="${phase.id}" data-action="edit-phase">
      <td>${phase.name}</td>
      <td style="color:var(--text-dim)">${project ? project.name : '—'}</td>
      <td>${phase.owner || '—'}</td>
      <td>${formatDate(phase.endDate)}</td>
      <td style="color:var(--yellow)">${phase.blockedReason || '—'}</td>
    </tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

// ============================================================
// PROJECTS TABLE
// ============================================================

function renderProjectsTable(filterStatus) {
  let projects = state.projects;
  if (filterStatus) projects = projects.filter(p => p.status === filterStatus);

  const activeCount = state.projects.filter(p => p.status === 'Active').length;
  const waitingCount = state.projects.filter(p => p.status === 'Waiting on Client').length;
  const incomingCount = state.projects.filter(p => p.status === 'Incoming').length;
  const totalPhases = state.phases.filter(p => p.status !== 'Done').length;

  let html = `<div class="stats-bar">
    <div class="stat"><span class="stat-value">${activeCount}</span><span class="stat-label">Active</span></div>
    <div class="stat"><span class="stat-value">${waitingCount}</span><span class="stat-label">Waiting</span></div>
    <div class="stat"><span class="stat-value">${incomingCount}</span><span class="stat-label">Incoming</span></div>
    <div class="stat"><span class="stat-value">${totalPhases}</span><span class="stat-label">Open Phases</span></div>
  </div>`;

  if (projects.length === 0) {
    html += `<div class="empty-state"><h3>No projects${filterStatus ? ' with status "' + filterStatus + '"' : ''}</h3><p>Click "+ New Project" to create one from a template.</p></div>`;
    return html;
  }

  if (!filterStatus) {
    for (const status of PROJECT_STATUSES) {
      const grouped = projects.filter(p => p.status === status);
      if (grouped.length === 0) continue;
      html += `<div class="group-header"><h3>${status} <span class="count">${grouped.length}</span></h3></div>`;
      html += renderProjectTable(grouped);
    }
  } else {
    html += renderProjectTable(projects);
  }

  return html;
}

function renderProjectTable(projects) {
  let html = `<table class="data-table"><thead><tr>
    <th>Project</th><th>Client</th><th>Type</th><th>Lead</th><th>Progress</th><th>Next Due</th><th>Priority</th><th></th>
  </tr></thead><tbody>`;

  for (const project of projects) {
    const progress = getProjectProgress(project.id);
    const nextDue = getNextPhaseDue(project.id);
    const statusClass = 'badge-status-' + project.status.toLowerCase().replace(/\s+/g, '-');
    const prioClass = project.priority ? 'badge-priority-' + project.priority.substring(0, 2).toLowerCase() : '';

    html += `<tr class="clickable" data-project-id="${project.id}" data-action="view-project">
      <td><strong>${project.name}</strong></td>
      <td style="color:var(--text-dim)">${project.client || '—'}</td>
      <td><span class="badge ${statusClass}" style="font-size:10px">${project.type || '—'}</span></td>
      <td>${project.lead || '—'}</td>
      <td><div class="progress-bar"><div class="progress-bar-fill" style="width:${progress}%"></div></div><span class="progress-text">${progress}%</span></td>
      <td>${formatDate(nextDue)}</td>
      <td>${project.priority ? `<span class="badge ${prioClass}">${project.priority}</span>` : '—'}</td>
      <td><button class="btn btn-sm btn-danger" data-action="delete-project" data-project-id="${project.id}">✕</button></td>
    </tr>`;
  }

  html += `</tbody></table>`;
  return html;
}

// ============================================================
// TEAM & ROLE SETTINGS
// ============================================================

function renderTeamSettings() {
  const nonUnassigned = state.teamMembers.filter(m => m !== 'Unassigned');

  let html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;">
    <div>
    <h3 style="font-size:14px;font-weight:600;margin-bottom:4px;">Team Members</h3>
    <p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">
      Add your team. They'll appear in Owner dropdowns and Role assignments.
    </p>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="new-member-input" placeholder="Name..." style="
        padding:7px 10px;background:var(--surface2);border:1px solid var(--border);
        border-radius:var(--radius);color:var(--text);font-size:13px;flex:1;
        font-family:inherit;outline:none;
      " />
      <button class="btn btn-primary" data-action="add-member">Add</button>
    </div>`;

  if (nonUnassigned.length === 0) {
    html += `<div style="color:var(--text-muted);font-size:12px;padding:8px 0;">No team members added yet.</div>`;
  } else {
    for (const member of nonUnassigned) {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);">
        <span style="flex:1;font-size:13px;">${member}</span>
        <button class="btn btn-sm btn-danger" data-action="remove-member" data-member="${member}" style="font-size:10px;padding:2px 8px;">✕</button>
      </div>`;
    }
  }

  html += `</div>`;

  html += `
    <div>
    <h3 style="font-size:14px;font-weight:600;margin-bottom:4px;">Roles</h3>
    <p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">
      Define the roles used in your studio. Template phases map to these roles for auto-assignment.
    </p>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <input type="text" id="new-role-input" placeholder="Role name..." style="
        padding:7px 10px;background:var(--surface2);border:1px solid var(--border);
        border-radius:var(--radius);color:var(--text);font-size:13px;flex:1;
        font-family:inherit;outline:none;
      " />
      <button class="btn btn-primary" data-action="add-role">Add</button>
    </div>`;

  if (state.roles.length === 0) {
    html += `<div style="color:var(--text-muted);font-size:12px;padding:8px 0;">No roles defined yet.</div>`;
  } else {
    for (const role of state.roles) {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);">
        <span style="flex:1;font-size:13px;font-weight:500;">${role}</span>
        <button class="btn btn-sm" data-action="rename-role" data-role="${role}" style="font-size:10px;padding:2px 8px;">Rename</button>
        <button class="btn btn-sm btn-danger" data-action="remove-role" data-role="${role}" style="font-size:10px;padding:2px 8px;">✕</button>
      </div>`;
    }
  }

  html += `</div></div>`;

  html += `
    <div style="margin-top:32px;">
    <h3 style="font-size:14px;font-weight:600;margin-bottom:4px;">Role Assignments</h3>
    <p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">
      Map each role to a default team member. When you create a project from a template, phases auto-assign to the mapped person.
    </p>`;

  if (state.roles.length === 0) {
    html += `<div style="color:var(--text-muted);font-size:12px;padding:8px 0;">Add roles above to configure assignments.</div>`;
  } else {
    html += `<table class="role-table">
      <thead><tr><th>Role</th><th>Default Owner</th></tr></thead>
      <tbody>`;

    for (const role of state.roles) {
      const current = state.roleAssignments[role] || '';
      html += `<tr>
        <td style="font-weight:500">${role}</td>
        <td>
          <select data-action="assign-role" data-role="${role}">
            <option value="" ${!current ? 'selected' : ''}>Unassigned</option>
            ${nonUnassigned.map(m => `<option value="${m}" ${current === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </td>
      </tr>`;
    }

    html += `</tbody></table>`;
  }

  html += `</div>`;

  // Migration button
  html += `
    <div style="margin-top:40px;padding-top:24px;border-top:1px solid var(--border);">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:4px;">Data Migration</h3>
      <p style="color:var(--text-dim);margin-bottom:12px;font-size:12px">
        If you previously used this app with localStorage, you can import that data into Supabase.
      </p>
      <button class="btn" data-action="migrate-localstorage">Import from localStorage</button>
    </div>`;

  return html;
}

// ============================================================
// MODALS
// ============================================================

function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  currentModal = overlay;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  setTimeout(() => {
    const input = overlay.querySelector('input:not([type="checkbox"]), select');
    if (input) input.focus();
  }, 50);
}

function closeModal() {
  if (currentModal) { currentModal.remove(); currentModal = null; }
}

// ============================================================
// NEW PROJECT MODAL
// ============================================================

function showNewProjectModal() {
  const memberOptions = state.teamMembers.map(m => `<option value="${m}">${m}</option>`).join('');
  const typeOptions = PROJECT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');

  const firstTemplate = TEMPLATES[PROJECT_TYPES[0]];
  const totalDays = firstTemplate.reduce((s, t) => s + t.duration, 0);
  const defaultEnd = addDays(today(), totalDays);

  showModal(`
    <div class="modal">
      <div class="modal-header"><h3>New Project</h3><button class="btn btn-sm" data-action="close-modal">✕</button></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>Client</label>
            <input type="text" id="proj-client" placeholder="Acme Corp" />
          </div>
          <div class="form-group">
            <label>Deliverable</label>
            <input type="text" id="proj-deliverable" placeholder="Marketing Site" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Project Type (Template)</label>
            <select id="proj-type">${typeOptions}</select>
          </div>
          <div class="form-group">
            <label>Priority</label>
            <select id="proj-priority">
              ${PRIORITIES.map(p => `<option value="${p}" ${p.includes('Normal') ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Start Date</label>
            <input type="date" id="proj-start" value="${today()}" />
          </div>
          <div class="form-group">
            <label>End Date</label>
            <input type="date" id="proj-end" value="${defaultEnd}" />
          </div>
        </div>
        <div class="cascade-info" id="proj-duration-info">
          Phases will be distributed across <strong>${totalDays} days</strong> (template default: ${totalDays} days for ${PROJECT_TYPES[0]}).
        </div>
        <div class="form-group">
          <label>Lead</label>
          <select id="proj-lead">${memberOptions}</select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="proj-notes" rows="2" placeholder="Brief link, context..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary" data-action="save-project">Create Project</button>
      </div>
    </div>
  `);

  const updateInfo = () => {
    const typeEl = document.getElementById('proj-type');
    const startEl = document.getElementById('proj-start');
    const endEl = document.getElementById('proj-end');
    const infoEl = document.getElementById('proj-duration-info');
    if (!typeEl || !startEl || !endEl || !infoEl) return;

    const tmpl = TEMPLATES[typeEl.value];
    const tmplDays = tmpl ? tmpl.reduce((s, t) => s + t.duration, 0) : 0;
    const windowDays = daysBetween(startEl.value, endEl.value);

    if (windowDays <= 0) {
      infoEl.innerHTML = `<span style="color:var(--red)">End date must be after start date.</span>`;
    } else if (windowDays < tmplDays) {
      infoEl.innerHTML = `Phases will be <strong>compressed</strong> into <strong>${windowDays} days</strong> (template default: ${tmplDays} days). Some phases may be shortened.`;
    } else if (windowDays > tmplDays) {
      infoEl.innerHTML = `Phases will be <strong>stretched</strong> across <strong>${windowDays} days</strong> (template default: ${tmplDays} days). Phases get proportionally more time.`;
    } else {
      infoEl.innerHTML = `Phases will fit exactly in <strong>${windowDays} days</strong> (matches template default).`;
    }
  };

  const typeChanged = () => {
    const typeEl = document.getElementById('proj-type');
    const startEl = document.getElementById('proj-start');
    const endEl = document.getElementById('proj-end');
    if (!typeEl || !startEl || !endEl) return;
    const tmpl = TEMPLATES[typeEl.value];
    if (tmpl) {
      const tmplDays = tmpl.reduce((s, t) => s + t.duration, 0);
      endEl.value = addDays(startEl.value, tmplDays);
    }
    updateInfo();
  };

  setTimeout(() => {
    document.getElementById('proj-type')?.addEventListener('change', typeChanged);
    document.getElementById('proj-start')?.addEventListener('change', () => { typeChanged(); });
    document.getElementById('proj-end')?.addEventListener('change', updateInfo);
  }, 60);
}

async function saveNewProject() {
  const client = document.getElementById('proj-client').value.trim();
  const deliverable = document.getElementById('proj-deliverable').value.trim();
  const type = document.getElementById('proj-type').value;
  const priority = document.getElementById('proj-priority').value;
  const lead = document.getElementById('proj-lead').value;
  const startDate = document.getElementById('proj-start').value;
  const endDate = document.getElementById('proj-end').value;
  const notes = document.getElementById('proj-notes').value.trim();

  if (!client && !deliverable) return;
  if (!startDate || !endDate || endDate <= startDate) return;

  const name = client && deliverable ? `${client} — ${deliverable}` : (client || deliverable);

  const projectData = {
    name, client, type,
    status: 'Incoming',
    priority,
    lead: lead === 'Unassigned' ? '' : lead,
    startDate,
    targetDeadline: endDate,
    notes,
  };

  const newProjectId = await dbCreateProject(projectData);
  if (!newProjectId) return;

  // Generate phases from template
  const template = TEMPLATES[type];
  if (template) {
    const phasesToCreate = template.map((tmpl, idx) => ({
      projectId: newProjectId,
      name: tmpl.name,
      status: 'Not Started',
      owner: getOwnerForRole(tmpl.ownerRole),
      discipline: tmpl.discipline,
      startDate: '',
      endDate: '',
      _templateDuration: tmpl.duration,
      blocked: false,
      blockedReason: '',
      sortOrder: idx + 1,
    }));

    const createdPhases = await dbCreatePhases(phasesToCreate);

    // Load into state so redistribute can work on them
    await dbLoadAll();

    // Distribute phases across the project window
    redistributePhases(newProjectId, startDate, endDate);

    // Save redistributed dates back to DB
    const projectPhases = getProjectPhases(newProjectId);
    if (projectPhases.length > 0) {
      await dbBatchUpdatePhases(projectPhases);
    }
  }

  await dbLoadAll();
  closeModal();
  render();
}

// ============================================================
// NEW PHASE MODAL
// ============================================================

function showNewPhaseModal(projectId) {
  const memberOptions = state.teamMembers.map(m => `<option value="${m}">${m}</option>`).join('');
  const projectOptions = state.projects.map(p => `<option value="${p.id}" ${p.id === projectId ? 'selected' : ''}>${p.name}</option>`).join('');
  const disciplineOptions = DISCIPLINES.map(d => `<option value="${d}">${d}</option>`).join('');

  const existingPhases = projectId ? getProjectPhases(projectId) : [];
  const lastPhase = existingPhases[existingPhases.length - 1];
  const defaultStart = lastPhase ? addDays(lastPhase.endDate, 1) : today();
  const defaultEnd = addDays(defaultStart, 2);
  const defaultOrder = (lastPhase ? lastPhase.sortOrder + 1 : 1);

  showModal(`
    <div class="modal">
      <div class="modal-header"><h3>New Phase</h3><button class="btn btn-sm" data-action="close-modal">✕</button></div>
      <div class="modal-body">
        <div class="cascade-info">Adding a phase will cascade all subsequent phases forward.</div>
        <div class="form-group">
          <label>Project</label>
          <select id="phase-project">${projectOptions}</select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Phase Name</label>
            <input type="text" id="phase-name" placeholder="Design Exploration" />
          </div>
          <div class="form-group">
            <label>Discipline</label>
            <select id="phase-discipline">${disciplineOptions}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Owner</label>
            <select id="phase-owner">${memberOptions}</select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="phase-status">${PHASE_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Duration (days)</label>
            <input type="number" id="phase-duration" value="3" min="1" />
          </div>
          <div class="form-group">
            <label>Insert at Position</label>
            <input type="number" id="phase-sort" value="${defaultOrder}" min="1" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary" data-action="save-phase">Create Phase</button>
      </div>
    </div>
  `);
}

async function saveNewPhase() {
  const projectId = document.getElementById('phase-project').value;
  const name = document.getElementById('phase-name').value.trim();
  if (!name || !projectId) return;

  const owner = document.getElementById('phase-owner').value;
  const duration = Math.max(parseInt(document.getElementById('phase-duration').value) || 1, 1);
  const insertAt = parseInt(document.getElementById('phase-sort').value) || 1;

  // Shift existing phases at or after this position
  const projectPhases = state.phases.filter(p => p.projectId === projectId);
  projectPhases.forEach(p => {
    if (p.sortOrder >= insertAt) p.sortOrder += 1;
  });

  const project = getProject(projectId);
  const phasesBefore = state.phases
    .filter(p => p.projectId === projectId && p.sortOrder < insertAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const prevPhase = phasesBefore[phasesBefore.length - 1];
  const startDate = prevPhase ? addDays(prevPhase.endDate, 1) : (project?.startDate || today());
  const endDate = addDays(startDate, duration - 1);

  const newPhaseData = {
    projectId, name,
    status: document.getElementById('phase-status').value,
    owner: owner === 'Unassigned' ? '' : owner,
    discipline: document.getElementById('phase-discipline').value,
    startDate, endDate,
    blocked: false, blockedReason: '',
    sortOrder: insertAt,
  };

  await dbCreatePhases([newPhaseData]);

  // Batch update sort orders for shifted phases
  const shiftedPhases = projectPhases.filter(p => p.sortOrder > insertAt);
  if (shiftedPhases.length > 0) {
    await dbBatchUpdatePhases(shiftedPhases);
  }

  // Reload, cascade, and save
  await dbLoadAll();
  cascadePhases(projectId);
  const allProjectPhases = getProjectPhases(projectId);
  if (allProjectPhases.length > 0) {
    await dbBatchUpdatePhases(allProjectPhases);
  }

  await dbLoadAll();
  closeModal();
  render();
}

// ============================================================
// EDIT PHASE MODAL
// ============================================================

function showEditPhaseModal(phaseId) {
  const phase = getPhase(phaseId);
  if (!phase) return;

  const project = getProject(phase.projectId);
  const memberOptions = state.teamMembers.map(m => `<option value="${m}" ${(phase.owner || 'Unassigned') === m ? 'selected' : ''}>${m}</option>`).join('');
  const duration = phase.startDate && phase.endDate ? daysBetween(phase.startDate, phase.endDate) + 1 : 1;

  showModal(`
    <div class="modal">
      <div class="modal-header"><h3>Edit Phase</h3><button class="btn btn-sm" data-action="close-modal">✕</button></div>
      <div class="modal-body">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">
          Project: ${project ? project.name : '—'} · Phase ${phase.sortOrder} of ${getProjectPhases(phase.projectId).length}
        </div>
        <div class="cascade-info">Changing the duration will cascade all subsequent phases. Changing the start date shifts this phase and everything after it.</div>
        <div class="form-row">
          <div class="form-group">
            <label>Phase Name</label>
            <input type="text" id="edit-phase-name" value="${phase.name}" />
          </div>
          <div class="form-group">
            <label>Discipline</label>
            <select id="edit-phase-discipline">
              ${DISCIPLINES.map(d => `<option value="${d}" ${phase.discipline === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Owner</label>
            <select id="edit-phase-owner">${memberOptions}</select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="edit-phase-status">
              ${PHASE_STATUSES.map(s => `<option value="${s}" ${phase.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Start Date</label>
            <input type="date" id="edit-phase-start" value="${phase.startDate || ''}" />
          </div>
          <div class="form-group">
            <label>Duration (days)</label>
            <input type="number" id="edit-phase-duration" value="${duration}" min="1" />
          </div>
        </div>
        <div class="form-group">
          <label style="color:var(--text-muted)">End Date (auto-calculated)</label>
          <input type="date" id="edit-phase-end" value="${phase.endDate || ''}" disabled style="opacity:0.6" />
        </div>
        <div class="form-group">
          <label>Blocked</label>
          <div class="checkbox-row">
            <input type="checkbox" id="edit-phase-blocked" ${phase.blocked ? 'checked' : ''} />
            <span>This phase is blocked</span>
          </div>
        </div>
        <div class="form-group">
          <label>Blocked Reason</label>
          <input type="text" id="edit-phase-blocked-reason" value="${phase.blockedReason || ''}" placeholder="Waiting for assets..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" data-action="delete-phase" data-phase-id="${phase.id}">Delete Phase</button>
        <div style="flex:1"></div>
        <button class="btn" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary" data-action="update-phase" data-phase-id="${phase.id}">Save & Cascade</button>
      </div>
    </div>
  `);

  const syncEndDate = () => {
    const startEl = document.getElementById('edit-phase-start');
    const durEl = document.getElementById('edit-phase-duration');
    const endEl = document.getElementById('edit-phase-end');
    if (startEl && durEl && endEl && startEl.value) {
      const dur = Math.max(parseInt(durEl.value) || 1, 1);
      endEl.value = addDays(startEl.value, dur - 1);
    }
  };

  setTimeout(() => {
    document.getElementById('edit-phase-start')?.addEventListener('change', syncEndDate);
    document.getElementById('edit-phase-duration')?.addEventListener('input', syncEndDate);
  }, 60);
}

async function updatePhase(phaseId) {
  const phase = getPhase(phaseId);
  if (!phase) return;

  const owner = document.getElementById('edit-phase-owner').value;
  const duration = Math.max(parseInt(document.getElementById('edit-phase-duration').value) || 1, 1);
  const newStart = document.getElementById('edit-phase-start').value;

  phase.name = document.getElementById('edit-phase-name').value.trim() || phase.name;
  phase.discipline = document.getElementById('edit-phase-discipline').value;
  phase.owner = owner === 'Unassigned' ? '' : owner;
  phase.status = document.getElementById('edit-phase-status').value;
  phase.startDate = newStart;
  phase.endDate = addDays(newStart, duration - 1);
  phase.blocked = document.getElementById('edit-phase-blocked').checked;
  phase.blockedReason = document.getElementById('edit-phase-blocked-reason').value.trim();

  await dbUpdatePhase(phase.id, phase);

  // Cascade all phases after this one
  cascadePhases(phase.projectId);
  const allProjectPhases = getProjectPhases(phase.projectId);
  if (allProjectPhases.length > 0) {
    await dbBatchUpdatePhases(allProjectPhases);
  }

  await dbLoadAll();
  closeModal();
  render();
}

// ============================================================
// VIEW PROJECT MODAL
// ============================================================

function showViewProjectModal(projectId) {
  const project = getProject(projectId);
  if (!project) return;

  const phases = getProjectPhases(projectId);
  const progress = getProjectProgress(projectId);
  const statusClass = 'badge-status-' + project.status.toLowerCase().replace(/\s+/g, '-');

  const memberOpts = state.teamMembers.map(m => m === 'Unassigned' ? `<option value="">Unassigned</option>` : `<option value="${m}">${m}</option>`).join('');

  let phasesHtml = '';
  for (const phase of phases) {
    const dur = phase.startDate && phase.endDate ? daysBetween(phase.startDate, phase.endDate) + 1 : 1;
    const statusOpts = PHASE_STATUSES.map(s => `<option value="${s}" ${phase.status === s ? 'selected' : ''}>${s}</option>`).join('');
    const ownerOpts = memberOpts.replace(`value="${phase.owner || ''}"`, `value="${phase.owner || ''}" selected`);

    phasesHtml += `
      <div class="phase-list-item" data-phase-id="${phase.id}">
        <span class="phase-order">${phase.sortOrder}</span>
        <div class="phase-info">
          <div class="name">${phase.name}</div>
          <div class="meta">${formatDate(phase.startDate)} – ${formatDate(phase.endDate)} · ${phase.discipline || '—'}</div>
        </div>
        <div class="phase-controls">
          <div class="phase-controls-row">
            <select class="phase-inline-select" data-phase-id="${phase.id}" data-field="owner">${ownerOpts}</select>
            <select class="phase-inline-select" data-phase-id="${phase.id}" data-field="status">${statusOpts}</select>
          </div>
          <div class="phase-controls-row">
            <span style="font-size:10px;color:var(--text-muted)">Duration:</span>
            <input type="number" class="phase-inline-input" value="${dur}" min="1" data-phase-id="${phase.id}" data-field="duration" />
            <span style="font-size:10px;color:var(--text-muted)">d</span>
            <button class="phase-edit-btn" data-phase-id="${phase.id}" data-action="edit-phase-from-project" title="Full edit">Edit</button>
            <button class="phase-delete-btn" data-phase-id="${phase.id}" data-action="inline-delete-phase" title="Remove phase">✕</button>
          </div>
        </div>
      </div>`;
  }

  const statusOptions = PROJECT_STATUSES.map(s => `<option value="${s}" ${project.status === s ? 'selected' : ''}>${s}</option>`).join('');

  showModal(`
    <div class="modal" style="width:640px">
      <div class="modal-header"><h3>${project.name}</h3><button class="btn btn-sm" data-action="close-modal">✕</button></div>
      <div class="modal-body">
        <div style="display:flex;gap:16px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">
          <span class="badge ${statusClass}">${project.status}</span>
          ${project.type ? `<span style="color:var(--text-dim);font-size:12px">${project.type}</span>` : ''}
          ${project.priority ? `<span style="color:var(--text-dim);font-size:12px">${project.priority}</span>` : ''}
          <span style="color:var(--text-dim);font-size:12px">Lead: ${project.lead || 'Unassigned'}</span>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <div class="progress-bar" style="width:120px"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
          <span class="progress-text">${progress}% (${phases.filter(p=>p.status==='Done').length}/${phases.length} phases)</span>
        </div>

        <div class="form-row" style="margin-bottom:8px;">
          <div class="form-group" style="margin-bottom:0">
            <label>Status</label>
            <select id="proj-detail-status">${statusOptions}</select>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Lead</label>
            <select id="proj-detail-lead">
              <option value="" ${!project.lead ? 'selected' : ''}>Unassigned</option>
              ${state.teamMembers.filter(m => m !== 'Unassigned').map(m => `<option value="${m}" ${project.lead === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row" style="margin-bottom:8px;">
          <div class="form-group" style="margin-bottom:0">
            <label>Start Date</label>
            <input type="date" id="proj-detail-start" value="${project.startDate || ''}" />
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>End Date</label>
            <input type="date" id="proj-detail-deadline" value="${project.targetDeadline || ''}" />
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <button class="btn btn-sm" data-action="redistribute-phases" data-project-id="${project.id}" style="font-size:11px;">
            Redistribute Phases to Fit Dates
          </button>
        </div>

        ${project.notes ? `<div style="font-size:12px;color:var(--text-dim);margin-bottom:16px;padding:8px 12px;background:var(--surface2);border-radius:var(--radius)">${project.notes}</div>` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted)">Phases (${phases.length})</label>
          <button class="btn btn-sm" data-action="add-phase-to-project" data-project-id="${project.id}">+ Add Phase</button>
        </div>
        ${phasesHtml || '<div style="color:var(--text-muted);font-size:12px;padding:12px;">No phases yet.</div>'}
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" data-action="delete-project" data-project-id="${project.id}">Delete Project</button>
        <div style="flex:1"></div>
        <button class="btn" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary" data-action="update-project" data-project-id="${project.id}">Save Changes</button>
      </div>
    </div>
  `);

  // Attach inline phase control listeners
  setTimeout(() => {
    document.querySelectorAll('.phase-inline-select').forEach(el => {
      el.addEventListener('change', async () => {
        const phase = getPhase(el.dataset.phaseId);
        if (!phase) return;
        if (el.dataset.field === 'status') {
          await dbUpdatePhase(phase.id, { status: el.value });
        }
        if (el.dataset.field === 'owner') {
          await dbUpdatePhase(phase.id, { owner: el.value });
        }
        await dbLoadAll();
        closeModal();
        showViewProjectModal(projectId);
      });
      el.addEventListener('click', (e) => e.stopPropagation());
    });

    document.querySelectorAll('.phase-inline-input').forEach(el => {
      el.addEventListener('change', async () => {
        const phase = getPhase(el.dataset.phaseId);
        if (!phase) return;
        const newDur = Math.max(parseInt(el.value) || 1, 1);
        phase.endDate = addDays(phase.startDate, newDur - 1);
        await dbUpdatePhase(phase.id, { endDate: phase.endDate });

        cascadePhases(phase.projectId);
        const allProjectPhases = getProjectPhases(phase.projectId);
        if (allProjectPhases.length > 0) {
          await dbBatchUpdatePhases(allProjectPhases);
        }

        await dbLoadAll();
        closeModal();
        showViewProjectModal(projectId);
      });
      el.addEventListener('click', (e) => e.stopPropagation());
    });
  }, 60);
}

async function updateProject(projectId) {
  const project = getProject(projectId);
  if (!project) return;

  const updates = {
    status: document.getElementById('proj-detail-status').value,
    lead: document.getElementById('proj-detail-lead').value,
    startDate: document.getElementById('proj-detail-start').value,
    targetDeadline: document.getElementById('proj-detail-deadline').value,
  };

  await dbUpdateProject(projectId, updates);
  await dbLoadAll();
  closeModal();
  render();
}

// ============================================================
// EVENT HANDLING
// ============================================================

function attachEvents() {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => { currentView = el.dataset.view; render(); });
  });

  if (!attachEvents._actionBound) {
    document.addEventListener('click', handleAction);
    attachEvents._actionBound = true;
  }

  document.querySelectorAll('[data-tooltip-title]').forEach(el => {
    el.addEventListener('mouseenter', (e) => { showTooltip(e, el.dataset.tooltipTitle, el.dataset.tooltipMeta); });
    el.addEventListener('mouseleave', hideTooltip);
  });

  // Role assignment dropdowns (in settings)
  document.querySelectorAll('select[data-action="assign-role"]').forEach(el => {
    el.addEventListener('change', async () => {
      const role = el.dataset.role;
      state.roleAssignments[role] = el.value;
      await dbAssignRole(role, el.value);
    });
  });

  // Enter key for settings inputs
  const memberInput = document.getElementById('new-member-input');
  if (memberInput) {
    memberInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { document.querySelector('[data-action="add-member"]')?.click(); }
    });
  }
  const roleInput = document.getElementById('new-role-input');
  if (roleInput) {
    roleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { document.querySelector('[data-action="add-role"]')?.click(); }
    });
  }
}

async function handleAction(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  switch (action) {
    case 'new-project':
      showNewProjectModal();
      break;
    case 'save-project':
      await saveNewProject();
      break;
    case 'new-phase':
      showNewPhaseModal();
      break;
    case 'save-phase':
      await saveNewPhase();
      break;
    case 'edit-phase':
    case 'edit-phase-from-project': {
      const phaseId = target.dataset.phaseId || target.closest('[data-phase-id]')?.dataset.phaseId;
      if (phaseId) { closeModal(); setTimeout(() => showEditPhaseModal(phaseId), 50); }
      break;
    }
    case 'update-phase':
      await updatePhase(target.dataset.phaseId);
      break;
    case 'delete-phase': {
      const phaseId = target.dataset.phaseId;
      const phase = getPhase(phaseId);
      const projectId = phase ? phase.projectId : null;
      await dbDeletePhase(phaseId);
      if (projectId) {
        await dbLoadAll();
        renumberPhases(projectId);
        cascadePhases(projectId);
        const allProjectPhases = getProjectPhases(projectId);
        if (allProjectPhases.length > 0) {
          await dbBatchUpdatePhases(allProjectPhases);
        }
      }
      await dbLoadAll();
      closeModal();
      render();
      break;
    }
    case 'inline-delete-phase': {
      const phaseId = target.dataset.phaseId;
      const phase = getPhase(phaseId);
      const projectId = phase ? phase.projectId : null;
      await dbDeletePhase(phaseId);
      if (projectId) {
        await dbLoadAll();
        renumberPhases(projectId);
        cascadePhases(projectId);
        const allProjectPhases = getProjectPhases(projectId);
        if (allProjectPhases.length > 0) {
          await dbBatchUpdatePhases(allProjectPhases);
        }
        await dbLoadAll();
        closeModal();
        showViewProjectModal(projectId);
      } else {
        await dbLoadAll();
        closeModal();
        render();
      }
      break;
    }
    case 'view-project': {
      const projectId = target.dataset.projectId || target.closest('[data-project-id]')?.dataset.projectId;
      if (projectId) showViewProjectModal(projectId);
      break;
    }
    case 'update-project':
      await updateProject(target.dataset.projectId);
      break;
    case 'delete-project': {
      const projectId = target.dataset.projectId;
      await dbDeleteProject(projectId);
      await dbLoadAll();
      closeModal();
      render();
      break;
    }
    case 'add-phase-to-project': {
      closeModal();
      setTimeout(() => showNewPhaseModal(target.dataset.projectId), 50);
      break;
    }
    case 'redistribute-phases': {
      const projectId = target.dataset.projectId;
      const startEl = document.getElementById('proj-detail-start');
      const endEl = document.getElementById('proj-detail-deadline');
      if (startEl && endEl && startEl.value && endEl.value && endEl.value > startEl.value) {
        await dbUpdateProject(projectId, { startDate: startEl.value, targetDeadline: endEl.value });
        await dbLoadAll();
        redistributePhases(projectId, startEl.value, endEl.value);
        const allProjectPhases = getProjectPhases(projectId);
        if (allProjectPhases.length > 0) {
          await dbBatchUpdatePhases(allProjectPhases);
        }
        await dbLoadAll();
        closeModal();
        showViewProjectModal(projectId);
      }
      break;
    }
    case 'close-modal':
      closeModal();
      break;
    case 'add-member': {
      const input = document.getElementById('new-member-input');
      const name = input?.value.trim();
      if (name && !state.teamMembers.includes(name)) {
        await dbAddTeamMember(name);
        await dbLoadAll();
        render();
      }
      break;
    }
    case 'remove-member': {
      const member = target.dataset.member;
      await dbRemoveTeamMember(member);
      await dbLoadAll();
      render();
      break;
    }
    case 'add-role': {
      const input = document.getElementById('new-role-input');
      const name = input?.value.trim();
      if (name && !state.roles.includes(name)) {
        await dbAddRole(name);
        await dbLoadAll();
        render();
      }
      break;
    }
    case 'remove-role': {
      const role = target.dataset.role;
      await dbRemoveRole(role);
      await dbLoadAll();
      render();
      break;
    }
    case 'rename-role': {
      const oldRole = target.dataset.role;
      const newName = prompt('Rename role:', oldRole);
      if (newName && newName.trim() && newName.trim() !== oldRole && !state.roles.includes(newName.trim())) {
        await dbRenameRole(oldRole, newName.trim());
        await dbLoadAll();
        render();
      }
      break;
    }
    case 'migrate-localstorage': {
      await migrateFromLocalStorage();
      break;
    }
  }
}

// ============================================================
// TOOLTIPS
// ============================================================

function showTooltip(e, title, meta) {
  hideTooltip();
  const tt = document.createElement('div');
  tt.className = 'tooltip';
  tt.innerHTML = `<div class="tt-title">${title}</div><div class="tt-meta">${meta || ''}</div>`;
  document.body.appendChild(tt);
  tooltip = tt;
  const rect = e.target.getBoundingClientRect();
  tt.style.left = rect.left + 'px';
  tt.style.top = (rect.bottom + 6) + 'px';
}

function hideTooltip() {
  if (tooltip) { tooltip.remove(); tooltip = null; }
}

// ============================================================
// INIT
// ============================================================

async function init() {
  const app = document.getElementById('app');
  app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#888;font-size:14px;">Loading...</div>';
  try {
    await dbLoadAll();
    render();
    setupRealtimeSubscriptions();
  } catch (err) {
    console.error('Init error:', err);
    app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#ef4444;font-size:14px;flex-direction:column;gap:8px;"><div>Failed to connect to database</div><div style="font-size:12px;color:#888;">Check browser console for details</div></div>';
  }
}

init();
