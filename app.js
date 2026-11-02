/**
 * TaskForge 98 — Retro Task Tracker
 * Day-picker scheduling, Codeforces-style heatmaps & live dashboard alerts.
 */

// ============================================================
//  STORAGE & STATE
// ============================================================
const STORAGE_KEY = 'taskforge_v1';
const SETTINGS_KEY = 'taskforge_settings_v1';
const ROOMS_KEY = 'taskforge_rooms_v1';
const SESSION_KEY = 'taskforge_session_room_v1';

const CATEGORIES = ['sports', 'chores', 'productivity'];
const CATEGORY_LABELS = { sports: 'Sports', chores: 'Chores', productivity: 'Productivity' };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const DEFAULT_DATA = {
    tasks: [],
    completions: {
        sports: {},
        chores: {},
        productivity: {}
    },
    alerts: []
};

const MAX_STORED_ALERTS = 100;
const DEFAULT_TIME = '18:00';

function getRooms() {
    try {
        const raw = localStorage.getItem(ROOMS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to load rooms', e);
    }
    return {};
}

function saveRooms(rooms) {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

// Session holds the passcode hash of the room currently open
function getSessionRoom() {
    return localStorage.getItem(SESSION_KEY) || null;
}

function setSessionRoom(roomId) {
    if (roomId) {
        localStorage.setItem(SESSION_KEY, roomId);
    } else {
        localStorage.removeItem(SESSION_KEY);
    }
}

// v1 tasks had a single deadline timestamp, a reminder timestamp and one
// completed flag. v2 tasks repeat on a list of days at a fixed time, with
// completion and alert state tracked per day.
function migrateTask(t) {
    if (t.alertsOn === undefined) t.alertsOn = t.emailNotify !== false;
    delete t.emailNotify;

    if (!Array.isArray(t.days)) {
        const deadline = new Date(t.deadline || Date.now());
        const day = getDateKey(deadline);
        t.days = [day];
        t.time = toTimeValue(deadline);
        t.reminderMinutes = t.reminder ? Math.max(0, Math.round((deadline - new Date(t.reminder)) / 60000)) : null;
        t.done = t.completed ? { [day]: day } : {};
        t.sent = {
            [day]: {
                reminder: !!t.reminderSent,
                deadline: !!t.deadlineNotifySent,
                overdueCount: t.overdueAlertCount || 0,
                lastOverdueAt: t.lastOverdueAlertAt || null
            }
        };
        ['deadline', 'reminder', 'completed', 'reminderSent', 'deadlineNotifySent', 'overdueAlertCount', 'lastOverdueAlertAt']
            .forEach(k => delete t[k]);
    }
    if (!t.time) t.time = DEFAULT_TIME;
    if (!t.done) t.done = {};
    if (!t.sent) t.sent = {};
}

function normalizeData(data) {
    const d = data || structuredClone(DEFAULT_DATA);
    if (!d.tasks) d.tasks = [];
    if (!d.completions) d.completions = { sports: {}, chores: {}, productivity: {} };
    CATEGORIES.forEach(c => { if (!d.completions[c]) d.completions[c] = {}; });
    if (!d.alerts) d.alerts = [];
    d.tasks.forEach(migrateTask);
    d.alerts.forEach(a => { if (!a.day && a.deadline) a.day = getDateKey(a.deadline); });
    delete d.gmailInbox;
    return d;
}

// Data saved before rooms existed (anonymous use), adopted by the first room
function loadLegacyData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return normalizeData(JSON.parse(raw));
    } catch (e) {
        console.error('Failed to load local data', e);
    }
    return null;
}

function loadData() {
    const roomId = getSessionRoom();
    const room = roomId && getRooms()[roomId];
    return normalizeData(room ? room.data : null);
}

function saveData(data) {
    const roomId = getSessionRoom();
    if (!roomId) return;
    const rooms = getRooms();
    if (rooms[roomId]) {
        rooms[roomId].data = data;
        saveRooms(rooms);
    }
}

const DEFAULT_SETTINGS = {
    soundChime: true,
    reminderAlerts: true,
    deadlineAlerts: true,
    overdueFollowUpHours: 0    // 0 = off
};

const MAX_OVERDUE_FOLLOW_UPS = 3;

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
        console.error('Failed to load settings', e);
    }
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ============================================================
//  DATE UTILITIES
// ============================================================
const pad2 = n => String(n).padStart(2, '0');

function getDateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Parse 'YYYY-MM-DD' as a local date (new Date('YYYY-MM-DD') would be UTC)
function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function todayKey() {
    return getDateKey(new Date());
}

function addDays(key, n) {
    const d = parseDateKey(key);
    d.setDate(d.getDate() + n);
    return getDateKey(d);
}

function toTimeValue(date) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDayLabel(key) {
    return parseDateKey(key).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeLabel(time) {
    const [h, m] = time.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function shiftMonth(monthKey, n) {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function formatMonthTitle(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function formatTimeLeft(deadline, now) {
    const diff = deadline - now;
    if (diff < 0) return 'OVERDUE';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${minutes % 60}m left`;
    if (minutes > 0) return `${minutes}m left`;
    return 'Due right now';
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

let appData = loadData();
let appSettings = loadSettings();
let quickSelectedCategory = 'productivity';
let viewDay = todayKey();
let lastSeenToday = viewDay;
let calendarMonth = viewDay.slice(0, 7);
let pickerMonth = calendarMonth;
let pickerDays = new Set();

// ============================================================
//  TASK OCCURRENCES
// ============================================================
function occurrenceDue(task, day) {
    const [h, m] = task.time.split(':').map(Number);
    const d = parseDateKey(day);
    d.setHours(h, m, 0, 0);
    return d;
}

function isDoneOn(task, day) {
    return !!task.done[day];
}

function tasksOnDay(day) {
    return appData.tasks.filter(t => t.days.includes(day));
}

function overdueOccurrences(now = new Date()) {
    const list = [];
    appData.tasks.forEach(task => task.days.forEach(day => {
        if (!isDoneOn(task, day) && occurrenceDue(task, day) < now) list.push({ task, day });
    }));
    return list;
}

// ============================================================
//  AUDIO CHIME (8-BIT WEB AUDIO SYNTH)
// ============================================================
let audioCtx = null;

function playNotificationChime(type = 'reminder') {
    if (!appSettings.soundChime) return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        // Reuse one context; browsers cap how many can exist
        audioCtx = audioCtx || new AudioContext();
        const ctx = audioCtx;

        const notes = type === 'reminder' ? [880, 1318.5] : [1046.5, 783.99, 1046.5];
        const now = ctx.currentTime;
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
            gain.gain.setValueAtTime(0.06, now + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.11);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.12);
        });
    } catch (e) {
        // AudioContext may be locked until user interaction
    }
}

function requestNotificationPermission() {
    // Must run from a user gesture; browsers ignore or penalize on-load prompts
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ============================================================
//  CODEFORCES HEATMAP & STATS ENGINE
// ============================================================
const HEATMAP_WEEKS = 53;

function getCodeforcesRank(count) {
    if (count >= 100) return { title: 'Grandmaster', class: 'rank-grandmaster' };
    if (count >= 75) return { title: 'Master', class: 'rank-master' };
    if (count >= 50) return { title: 'Candidate Master', class: 'rank-cm' };
    if (count >= 30) return { title: 'Expert', class: 'rank-expert' };
    if (count >= 15) return { title: 'Specialist', class: 'rank-specialist' };
    if (count >= 5) return { title: 'Pupil', class: 'rank-pupil' };
    return { title: 'Newbie', class: 'rank-newbie' };
}

function calculateCategoryStats(category) {
    const completions = appData.completions[category] || {};
    const activeKeys = Object.keys(completions).filter(k => completions[k] > 0).sort();
    const today = todayKey();
    const yearAgo = addDays(today, -364);

    let totalDone = 0;
    let activeDays = 0;
    activeKeys.forEach(k => {
        totalDone += completions[k];
        if (k >= yearAgo && k <= today) activeDays++;
    });

    // Current streak counts back from today, or from yesterday if today is still empty
    let currentStreak = 0;
    let cursor = completions[today] > 0 ? today : addDays(today, -1);
    while (completions[cursor] > 0) {
        currentStreak++;
        cursor = addDays(cursor, -1);
    }

    let maxStreak = 0;
    let run = 0;
    let prev = null;
    activeKeys.forEach(k => {
        run = prev && addDays(prev, 1) === k ? run + 1 : 1;
        maxStreak = Math.max(maxStreak, run);
        prev = k;
    });

    return { totalDone, activeDays, currentStreak, maxStreak };
}

function calculateCombinedStreak() {
    const active = k => CATEGORIES.some(c => (appData.completions[c] || {})[k] > 0);
    const today = todayKey();
    let cursor = active(today) ? today : addDays(today, -1);
    let streak = 0;
    while (active(cursor)) {
        streak++;
        cursor = addDays(cursor, -1);
    }
    return streak;
}

function renderHeatmaps() {
    CATEGORIES.forEach(cat => renderHeatmap(cat));
}

function renderHeatmap(category) {
    const grid = document.getElementById(`${category}-heatmap`);
    if (!grid) return;

    const completions = appData.completions[category] || {};
    const today = todayKey();
    // Columns are Mon–Sun weeks; start 52 weeks before this week's Monday
    const mondayOffset = (parseDateKey(today).getDay() + 6) % 7;
    const start = addDays(today, -mondayOffset - 7 * (HEATMAP_WEEKS - 1));

    let cells = '';
    let yearTotal = 0;
    const monthStarts = [];
    let lastMonth = -1;

    for (let w = 0; w < HEATMAP_WEEKS; w++) {
        const col = w + 2; // column 1 holds weekday labels
        const weekStart = addDays(start, w * 7);
        const month = parseDateKey(weekStart).getMonth();
        if (month !== lastMonth) {
            monthStarts.push({ col, month });
            lastMonth = month;
        }

        for (let d = 0; d < 7; d++) {
            const key = addDays(weekStart, d);
            if (key > today) break;
            const count = completions[key] || 0;
            yearTotal += count;
            cells += `<span class="hm-cell lvl-${Math.min(count, 4)}${key === today ? ' today' : ''}" style="grid-column:${col};grid-row:${d + 2}" title="${formatDayLabel(key)}: ${count} task${count !== 1 ? 's' : ''} done"></span>`;
        }
    }

    // Drop a month label when the next one starts too close to fit it
    const months = monthStarts
        .filter((m, i) => i === monthStarts.length - 1 || monthStarts[i + 1].col - m.col >= 3)
        .map(m => `<span class="hm-month" style="grid-column:${m.col} / span 3">${MONTH_NAMES[m.month]}</span>`)
        .join('');
    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']
        .map((label, i) => label ? `<span class="hm-day" style="grid-row:${i + 2}">${label}</span>` : '')
        .join('');

    grid.innerHTML = dayLabels + months + cells;

    // Show the most recent weeks first when the graph has to scroll
    const scroller = grid.parentElement;
    scroller.scrollLeft = scroller.scrollWidth;

    const stats = calculateCategoryStats(category);
    const rank = getCodeforcesRank(stats.totalDone);
    const plural = n => `${n} day${n !== 1 ? 's' : ''}`;

    document.getElementById(`${category}-heatmap-summary`).textContent = `${yearTotal} task${yearTotal !== 1 ? 's' : ''} done in the last year`;
    const rankBadge = document.getElementById(`${category}-rank`);
    rankBadge.textContent = rank.title;
    rankBadge.className = `cf-rank-badge ${rank.class}`;
    document.getElementById(`${category}-current-streak`).textContent = plural(stats.currentStreak);
    document.getElementById(`${category}-max-streak`).textContent = plural(stats.maxStreak);
    document.getElementById(`${category}-active-days`).textContent = stats.activeDays;
    document.getElementById(`${category}-total-done`).textContent = stats.totalDone;
}

// ============================================================
//  DAY VIEW: TASK LISTS & STATS
// ============================================================
function taskRowHTML(task, now) {
    const done = isDoneOn(task, viewDay);
    const due = occurrenceDue(task, viewDay);
    const overdue = !done && due < now;
    const urgent = !done && !overdue && due - now < 3600000;
    const multi = task.days.length > 1;

    return `
        <div class="task-item ${done ? 'completed' : ''} ${overdue ? 'overdue' : ''}" data-id="${task.id}">
            <input type="checkbox" class="task-check" ${done ? 'checked' : ''} onchange="toggleTask('${task.id}')" aria-label="Mark done for this day">
            <div class="task-info">
                <div class="task-title">${escapeHTML(task.title)}</div>
                ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>` : ''}
                <div class="task-meta">
                    <span>🕒 ${formatTimeLabel(task.time)}</span>
                    <span class="task-deadline ${urgent || overdue ? 'urgent' : ''}">${done ? '✓ Done' : formatTimeLeft(due, now)}</span>
                    <span class="task-priority ${task.priority}">${task.priority}</span>
                    ${multi ? `<span class="task-days-pill" title="${task.days.map(formatDayLabel).join(', ')}">📅 ${task.days.length} days</span>` : ''}
                    ${task.alertsOn ? '<span title="Alerts on">🔔</span>' : ''}
                </div>
            </div>
            <button type="button" class="task-action-btn" onclick="removeTaskFromDay('${task.id}')" title="${multi ? 'Remove from this day' : 'Delete task'}" aria-label="${multi ? 'Remove from this day' : 'Delete task'}">×</button>
        </div>
    `;
}

function renderTasks() {
    const now = new Date();
    const dayTasks = tasksOnDay(viewDay);
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    CATEGORIES.forEach(cat => {
        const list = document.getElementById(`${cat}-tasks`);
        const empty = document.getElementById(`${cat}-empty`);
        if (!list || !empty) return;

        const tasks = dayTasks.filter(t => t.category === cat);
        document.getElementById(`${cat}-count`).textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''} on this day`;
        empty.classList.toggle('hidden', tasks.length > 0);

        // Unfinished first, then by due time, then priority
        const sorted = [...tasks].sort((a, b) =>
            isDoneOn(a, viewDay) - isDoneOn(b, viewDay)
            || a.time.localeCompare(b.time)
            || (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

        list.innerHTML = sorted.map(task => taskRowHTML(task, now)).join('');
    });

    updateGlobalStats(dayTasks, now);
    updateDayHeader();
}

function updateGlobalStats(dayTasks, now) {
    const done = dayTasks.filter(t => isDoneOn(t, viewDay)).length;

    document.getElementById('totalTasks').textContent = dayTasks.length;
    document.getElementById('completedTasks').textContent = done;
    document.getElementById('pendingTasks').textContent = dayTasks.length - done;
    document.getElementById('overdueTasks').textContent = overdueOccurrences(now).length;
    document.getElementById('streakCount').textContent = String(calculateCombinedStreak()).padStart(3, '0');
}

// Quick adds go to the day being viewed, or today when viewing the past
function quickAddDay() {
    const today = todayKey();
    return viewDay < today ? today : viewDay;
}

function updateDayHeader() {
    const today = todayKey();
    const label = formatDayLabel(viewDay);
    document.getElementById('viewDayTitle').textContent =
        viewDay === today ? `Today — ${label}` : viewDay === addDays(today, 1) ? `Tomorrow — ${label}` : label;

    const target = quickAddDay();
    document.getElementById('quickAddTarget').textContent =
        `Quick add puts tasks on ${target === today ? 'today' : formatDayLabel(target)}. Use 📅 Pick Days… for more days.`;
}

function selectViewDay(key) {
    viewDay = key;
    calendarMonth = key.slice(0, 7);
    renderTasks();
    renderCalendar();
}

// ============================================================
//  CALENDARS (SIDEBAR VIEW + NEW-TASK DAY PICKER)
// ============================================================
function buildMonthGrid(monthKey, cellFn) {
    const [y, m] = monthKey.split('-').map(Number);
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;   // Monday-first
    const daysInMonth = new Date(y, m, 0).getDate();

    let html = WEEKDAY_SHORT.map(d => `<span class="cal-wd">${d}</span>`).join('');
    for (let i = 0; i < lead; i++) html += '<span class="cal-blank"></span>';
    for (let d = 1; d <= daysInMonth; d++) html += cellFn(`${y}-${pad2(m)}-${pad2(d)}`, d);
    return html;
}

function renderCalendar() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;

    const now = new Date();
    const today = todayKey();
    const info = {};
    appData.tasks.forEach(task => task.days.forEach(day => {
        const i = info[day] || (info[day] = { total: 0, done: 0, overdue: false });
        i.total++;
        if (isDoneOn(task, day)) i.done++;
        else if (occurrenceDue(task, day) < now) i.overdue = true;
    }));

    document.getElementById('calMonthTitle').textContent = formatMonthTitle(calendarMonth);
    grid.innerHTML = buildMonthGrid(calendarMonth, (key, d) => {
        const i = info[key];
        const classes = ['cal-day'];
        if (key === today) classes.push('today');
        if (key === viewDay) classes.push('selected');
        if (i) classes.push(i.overdue ? 'has-overdue' : i.done === i.total ? 'all-done' : 'has-tasks');
        const tip = i ? `${i.total} task${i.total !== 1 ? 's' : ''}, ${i.done} done` : 'No tasks';
        return `<button type="button" class="${classes.join(' ')}" onclick="selectViewDay('${key}')" title="${formatDayLabel(key)}: ${tip}">${d}</button>`;
    });
}

function renderPicker() {
    const today = todayKey();
    document.getElementById('pickerMonthTitle').textContent = formatMonthTitle(pickerMonth);
    document.getElementById('pickerGrid').innerHTML = buildMonthGrid(pickerMonth, (key, d) => {
        const past = key < today;
        const classes = ['cal-day'];
        if (key === today) classes.push('today');
        if (pickerDays.has(key)) classes.push('selected');
        return `<button type="button" class="${classes.join(' ')}" ${past ? 'disabled' : ''} onclick="togglePickerDay('${key}')" aria-pressed="${pickerDays.has(key)}">${d}</button>`;
    });

    const days = [...pickerDays].sort();
    document.getElementById('pickerSummary').textContent = days.length === 0
        ? 'No days selected — click days on the calendar.'
        : `${days.length} day${days.length !== 1 ? 's' : ''} selected: ${days.slice(0, 6).map(formatDayLabel).join(', ')}${days.length > 6 ? `, +${days.length - 6} more` : ''}`;
}

function togglePickerDay(key) {
    if (pickerDays.has(key)) pickerDays.delete(key);
    else pickerDays.add(key);
    showTaskFormError('');
    renderPicker();
}

function setPickerDays(keys) {
    pickerDays = new Set(keys);
    if (keys.length) pickerMonth = keys[0].slice(0, 7);
    showTaskFormError('');
    renderPicker();
}

function showTaskFormError(msg) {
    const el = document.getElementById('taskFormError');
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
}

function openTaskModal({ title = '', category = quickSelectedCategory } = {}) {
    const form = document.getElementById('taskForm');
    form.reset();
    document.getElementById('taskTitle').value = title;
    form.querySelector(`input[name="category"][value="${category}"]`).checked = true;
    document.getElementById('taskTime').value = document.getElementById('quickTime').value || DEFAULT_TIME;

    setPickerDays([quickAddDay()]);
    openModal('taskModal');
    setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

// ============================================================
//  TASK CREATION & MODIFICATION
// ============================================================
function addTask(taskData) {
    const days = [...new Set(taskData.days)].sort();
    const task = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2),
        title: taskData.title,
        description: taskData.description || '',
        category: taskData.category || 'productivity',
        priority: taskData.priority || 'medium',
        alertsOn: taskData.alertsOn !== false,
        days: days,
        time: taskData.time || DEFAULT_TIME,
        reminderMinutes: taskData.reminderMinutes ?? null,
        done: {},
        sent: {},
        createdAt: new Date().toISOString()
    };

    appData.tasks.push(task);
    saveData(appData);
    renderTasks();
    renderCalendar();
    requestNotificationPermission();

    const where = days.length === 1 ? formatDayLabel(days[0]) : `${days.length} days`;
    showToast(`Added "${task.title}" to ${where}`, 'success');
}

function readReminder(selectEl) {
    return selectEl.value === '' ? null : Number(selectEl.value);
}

function toggleTask(id, day = viewDay) {
    const task = appData.tasks.find(t => t.id === id);
    if (!task || !task.days.includes(day)) return;

    const counts = appData.completions[task.category];
    if (isDoneOn(task, day)) {
        // Undo against the day it was actually ticked, which may not be today
        const doneOn = task.done[day];
        if (counts[doneOn] > 0) counts[doneOn]--;
        delete task.done[day];
    } else {
        const today = todayKey();
        task.done[day] = today;
        counts[today] = (counts[today] || 0) + 1;
        playNotificationChime('reminder');
        showToast(`🎉 "${task.title}" done! Heatmap updated.`, 'success');
    }

    saveData(appData);
    renderTasks();
    renderHeatmaps();
    renderCalendar();
    renderAlerts();
}

function removeTaskFromDay(id, day = viewDay) {
    const task = appData.tasks.find(t => t.id === id);
    if (!task) return;

    task.days = task.days.filter(d => d !== day);
    delete task.done[day];
    delete task.sent[day];

    if (task.days.length === 0) {
        appData.tasks = appData.tasks.filter(t => t.id !== id);
        showToast('Task deleted', 'info');
    } else {
        showToast(`Removed from ${formatDayLabel(day)} — still on ${task.days.length} other day${task.days.length !== 1 ? 's' : ''}`, 'info');
    }

    saveData(appData);
    renderTasks();
    renderCalendar();
    renderAlerts();
}

// ============================================================
//  DASHBOARD ALERTS ENGINE
// ============================================================
const ALERT_META = {
    reminder: { icon: '⏰', label: 'Due soon' },
    deadline: { icon: '🚨', label: 'Deadline reached' },
    overdue: { icon: '🔁', label: 'Still overdue' },
    test: { icon: '🔔', label: 'Test alert' }
};

function composeAlertMessage(task, type, day) {
    const due = occurrenceDue(task, day);
    const when = `${formatDayLabel(day)}, ${formatTimeLabel(task.time)}`;
    if (type === 'reminder') return `Due ${when} — ${formatTimeLeft(due, new Date())}.`;
    if (type === 'overdue') return `Was due ${when} and still isn't done.`;
    if (type === 'test') return 'Alerts are working. They will show up here.';
    return `Was due ${when}. Tick it off or remove it from that day.`;
}

function triggerAlert(task, type, day) {
    const alert = {
        id: 'alert_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        taskId: task.id,
        taskTitle: task.title,
        category: task.category,
        priority: task.priority,
        day: day,
        type: type,
        message: composeAlertMessage(task, type, day),
        timestamp: new Date().toISOString(),
        read: false
    };

    appData.alerts.unshift(alert);
    appData.alerts.length = Math.min(appData.alerts.length, MAX_STORED_ALERTS);
    saveData(appData);
    renderAlerts();

    playNotificationChime(type === 'reminder' || type === 'test' ? 'reminder' : 'urgent');
    showAlertBanner(alert);

    // Native HTML5 Browser Notification (useful when the tab is in the background)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`${ALERT_META[type].icon} ${ALERT_META[type].label}: ${task.title}`, {
            body: alert.message,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>'
        });
    }
}

function showAlertBanner(alert) {
    const banner = document.getElementById('alertBanner');
    if (!banner) return;
    const meta = ALERT_META[alert.type];

    document.getElementById('alertBannerIcon').textContent = meta.icon;
    document.getElementById('alertBannerTitle').textContent = `${meta.label}: ${alert.taskTitle}`;
    document.getElementById('alertBannerBody').textContent = alert.message;
    banner.className = `alert-banner active ${alert.type}`;

    // Auto dismiss after 7 seconds
    if (banner._timeout) clearTimeout(banner._timeout);
    banner._timeout = setTimeout(() => {
        banner.classList.remove('active');
    }, 7000);
}

function formatRelativeTime(iso) {
    const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderAlerts() {
    const listEl = document.getElementById('alertsList');
    const badgeEl = document.getElementById('unreadAlertBadge');
    const pillEl = document.getElementById('alertsUnreadPill');
    if (!listEl) return;

    const unreadCount = appData.alerts.filter(a => !a.read).length;
    if (badgeEl) {
        badgeEl.textContent = unreadCount;
        badgeEl.classList.toggle('has-unread', unreadCount > 0);
    }
    if (pillEl) {
        pillEl.textContent = `${unreadCount} new`;
        pillEl.classList.toggle('hidden', unreadCount === 0);
    }

    if (appData.alerts.length === 0) {
        listEl.innerHTML = `<div class="alerts-empty">No alerts yet. Reminders, deadlines and overdue follow-ups will show up here.</div>`;
        return;
    }

    listEl.innerHTML = appData.alerts.map(alert => {
        const meta = ALERT_META[alert.type] || ALERT_META.test;
        const task = appData.tasks.find(t => t.id === alert.taskId);
        const scheduled = task && alert.day && task.days.includes(alert.day);
        const done = scheduled && isDoneOn(task, alert.day);
        return `
            <div class="alert-item ${alert.type} ${alert.read ? '' : 'unread'}" onclick="markAlertRead('${alert.id}')">
                <span class="alert-item-icon">${meta.icon}</span>
                <div class="alert-item-body">
                    <div class="alert-item-title">
                        <span class="alert-item-label">${meta.label}</span>
                        ${escapeHTML(alert.taskTitle)}
                    </div>
                    <div class="alert-item-msg">${escapeHTML(alert.message)}</div>
                    <div class="alert-item-foot">
                        <span class="alert-item-time">${formatRelativeTime(alert.timestamp)}</span>
                        ${scheduled && !done ? `<button type="button" class="btn btn-small" onclick="event.stopPropagation(); completeFromAlert('${alert.id}')" title="Mark task done for that day">✓ Done</button>` : ''}
                        ${done ? `<span class="alert-completed-tag">✓ Completed</span>` : ''}
                    </div>
                </div>
                <button type="button" class="alert-dismiss-btn" onclick="event.stopPropagation(); dismissAlert('${alert.id}')" title="Dismiss alert" aria-label="Dismiss alert">×</button>
            </div>
        `;
    }).join('');
}

function markAlertRead(id) {
    const alert = appData.alerts.find(a => a.id === id);
    if (!alert || alert.read) return;
    alert.read = true;
    saveData(appData);
    renderAlerts();
}

function dismissAlert(id) {
    appData.alerts = appData.alerts.filter(a => a.id !== id);
    saveData(appData);
    renderAlerts();
}

function completeFromAlert(id) {
    const alert = appData.alerts.find(a => a.id === id);
    if (!alert) return;
    alert.read = true;
    const task = appData.tasks.find(t => t.id === alert.taskId);
    if (task && task.days.includes(alert.day) && !isDoneOn(task, alert.day)) toggleTask(task.id, alert.day);
    saveData(appData);
    renderAlerts();
}

// ============================================================
//  DEADLINE & REMINDER ACTIVE WATCHER (1-SECOND HEARTBEAT)
// ============================================================
function checkTaskAlerts(now = Date.now()) {
    let changed = false;
    const followUpMs = (appSettings.overdueFollowUpHours || 0) * 3600000;

    appData.tasks.forEach(task => {
        if (!task.alertsOn) return;

        task.days.forEach(day => {
            if (isDoneOn(task, day)) return;
            const dueTime = occurrenceDue(task, day).getTime();
            const s = task.sent[day] || {};
            const mark = () => { task.sent[day] = s; changed = true; };

            // 1. Reminder Check
            if (task.reminderMinutes !== null && !s.reminder) {
                const reminderTime = dueTime - task.reminderMinutes * 60000;
                if (now >= reminderTime) {
                    s.reminder = true;
                    mark();
                    // Once the task is already due, the deadline alert covers it
                    const coveredByDeadline = appSettings.deadlineAlerts && !s.deadline && now >= dueTime;
                    if (appSettings.reminderAlerts && !coveredByDeadline) {
                        triggerAlert(task, 'reminder', day);
                    }
                }
            }

            // 2. Deadline Reached Check
            if (!s.deadline && now >= dueTime) {
                s.deadline = true;
                s.lastOverdueAt = now;
                mark();
                if (appSettings.deadlineAlerts) {
                    triggerAlert(task, 'deadline', day);
                }
            }

            // 3. Overdue Follow-up Check
            if (followUpMs > 0 && s.deadline && (s.overdueCount || 0) < MAX_OVERDUE_FOLLOW_UPS) {
                const last = s.lastOverdueAt || dueTime;
                if (now - last >= followUpMs) {
                    s.overdueCount = (s.overdueCount || 0) + 1;
                    s.lastOverdueAt = now;
                    mark();
                    triggerAlert(task, 'overdue', day);
                }
            }
        });
    });

    if (changed) {
        saveData(appData);
        renderTasks();
        renderCalendar();
    }
}

function updateClock() {
    const el = document.getElementById('taskbarClock');
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function startNotificationHeartbeat() {
    setInterval(() => checkTaskAlerts(), 1000);

    // Refresh countdowns, "5m ago" labels and the clock; roll over at midnight
    setInterval(() => {
        const today = todayKey();
        if (today !== lastSeenToday) {
            if (viewDay === lastSeenToday) selectViewDay(today);
            lastSeenToday = today;
            renderHeatmaps();
        }
        renderTasks();
        renderCalendar();
        renderAlerts();
        updateClock();
    }, 30000);
}

function renderAll() {
    renderTasks();
    renderHeatmaps();
    renderCalendar();
    renderAlerts();
}

// ============================================================
//  TOAST SYSTEM
// ============================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('exiting');
        setTimeout(() => toast.remove(), 200);
    }, 3200);
}

// ============================================================
//  MODAL CONTROLS
// ============================================================
function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
}

// ============================================================
//  EVENT LISTENERS SETUP
// ============================================================
function setupEventListeners() {
    // 1. QUICK-ADD FORM
    const quickForm = document.getElementById('quickAddForm');
    const quickInput = document.getElementById('quickInput');

    document.querySelectorAll('.quick-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quick-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            quickSelectedCategory = btn.dataset.cat;
        });
    });

    const addToQuickDay = (title, category) => {
        const day = quickAddDay();
        if (day !== viewDay) selectViewDay(day);
        addTask({
            title,
            category,
            days: [day],
            time: document.getElementById('quickTime').value || DEFAULT_TIME,
            reminderMinutes: readReminder(document.getElementById('quickReminderPreset')),
            priority: 'medium',
            alertsOn: true
        });
    };

    quickForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = quickInput.value.trim();
        if (!title) return;
        addToQuickDay(title, quickSelectedCategory);
        quickInput.value = '';
        quickInput.focus();
    });

    document.getElementById('quickPickDaysBtn').addEventListener('click', () => {
        openTaskModal({ title: quickInput.value.trim() });
        quickInput.value = '';
    });

    // 2. INLINE CATEGORY QUICK-ADD INPUTS
    CATEGORIES.forEach(cat => {
        const input = document.getElementById(`inline-add-${cat}`);
        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const title = input.value.trim();
            if (!title) return;
            addToQuickDay(title, cat);
            input.value = '';
        });
    });

    // 3. DAY NAVIGATION & CALENDAR
    document.getElementById('prevDayBtn').addEventListener('click', () => selectViewDay(addDays(viewDay, -1)));
    document.getElementById('nextDayBtn').addEventListener('click', () => selectViewDay(addDays(viewDay, 1)));
    document.getElementById('todayBtn').addEventListener('click', () => selectViewDay(todayKey()));
    document.getElementById('calPrevMonth').addEventListener('click', () => { calendarMonth = shiftMonth(calendarMonth, -1); renderCalendar(); });
    document.getElementById('calNextMonth').addEventListener('click', () => { calendarMonth = shiftMonth(calendarMonth, 1); renderCalendar(); });

    // 4. NEW TASK DIALOG
    document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('modalClose').addEventListener('click', () => closeModal('taskModal'));
    document.getElementById('modalCancel').addEventListener('click', () => closeModal('taskModal'));

    document.getElementById('pickerPrev').addEventListener('click', () => { pickerMonth = shiftMonth(pickerMonth, -1); renderPicker(); });
    document.getElementById('pickerNext').addEventListener('click', () => { pickerMonth = shiftMonth(pickerMonth, 1); renderPicker(); });
    document.getElementById('pickToday').addEventListener('click', () => setPickerDays([todayKey()]));
    document.getElementById('pickWeek').addEventListener('click', () => {
        setPickerDays(Array.from({ length: 7 }, (_, i) => addDays(todayKey(), i)));
    });
    document.getElementById('pickWeekdays').addEventListener('click', () => {
        const days = Array.from({ length: 14 }, (_, i) => addDays(todayKey(), i))
            .filter(k => { const dow = parseDateKey(k).getDay(); return dow !== 0 && dow !== 6; });
        setPickerDays(days);
    });
    document.getElementById('pickClear').addEventListener('click', () => setPickerDays([]));

    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) return;
        if (pickerDays.size === 0) {
            showTaskFormError('Pick at least one day on the calendar.');
            return;
        }

        addTask({
            title,
            description: document.getElementById('taskDescription').value.trim(),
            category: document.querySelector('input[name="category"]:checked').value,
            days: [...pickerDays],
            time: document.getElementById('taskTime').value || DEFAULT_TIME,
            reminderMinutes: readReminder(document.getElementById('taskReminder')),
            priority: document.querySelector('input[name="priority"]:checked').value,
            alertsOn: document.getElementById('taskAlertsOn').checked
        });

        closeModal('taskModal');
    });

    // 5. ALERTS
    const showAlertsPanel = () => document.getElementById('alertsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('alertsBtn').addEventListener('click', showAlertsPanel);

    document.getElementById('alertBannerViewBtn').addEventListener('click', () => {
        document.getElementById('alertBanner').classList.remove('active');
        showAlertsPanel();
    });

    document.getElementById('alertBannerCloseBtn').addEventListener('click', () => {
        document.getElementById('alertBanner').classList.remove('active');
    });

    document.getElementById('markAlertsReadBtn').addEventListener('click', () => {
        appData.alerts.forEach(a => { a.read = true; });
        saveData(appData);
        renderAlerts();
    });

    document.getElementById('clearAlertsBtn').addEventListener('click', () => {
        appData.alerts = [];
        saveData(appData);
        renderAlerts();
        showToast('Alerts cleared', 'info');
    });

    // 6. SETTINGS
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('soundChimeToggle').checked = appSettings.soundChime !== false;
        document.getElementById('reminderAlertsToggle').checked = appSettings.reminderAlerts !== false;
        document.getElementById('deadlineAlertsToggle').checked = appSettings.deadlineAlerts !== false;
        document.getElementById('overdueFollowUp').value = String(appSettings.overdueFollowUpHours || 0);
        openModal('settingsModal');
    });

    document.getElementById('settingsClose').addEventListener('click', () => closeModal('settingsModal'));
    document.getElementById('settingsCancelBtn').addEventListener('click', () => closeModal('settingsModal'));

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        appSettings.soundChime = document.getElementById('soundChimeToggle').checked;
        appSettings.reminderAlerts = document.getElementById('reminderAlertsToggle').checked;
        appSettings.deadlineAlerts = document.getElementById('deadlineAlertsToggle').checked;
        appSettings.overdueFollowUpHours = Number(document.getElementById('overdueFollowUp').value) || 0;

        saveSettings(appSettings);
        closeModal('settingsModal');
        showToast('Alert settings saved!', 'success');
    });

    document.getElementById('testAlertBtn').addEventListener('click', () => {
        closeModal('settingsModal');
        requestNotificationPermission();
        triggerAlert({
            id: null,
            title: 'Sample task',
            category: 'productivity',
            priority: 'medium',
            time: toTimeValue(new Date(Date.now() + 3600000))
        }, 'test', todayKey());
    });

    // 7. WINDOW MINIMIZE
    document.querySelectorAll('.btn-collapse').forEach(btn => {
        btn.addEventListener('click', () => {
            const body = document.getElementById(`${btn.dataset.target}-body`);
            const collapsed = body.classList.toggle('hidden');
            btn.textContent = collapsed ? '□' : '_';
            btn.title = collapsed ? 'Restore' : 'Minimize';
        });
    });

    // 8. ESCAPE & OVERLAY CLICKS
    // The room gate can't be dismissed until a room is open
    document.querySelectorAll('.modal-overlay:not(#roomModal)').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active:not(#roomModal)').forEach(m => closeModal(m.id));
        }
    });

    // 9. KEEP TABS IN SYNC
    // Another tab saving the same room would otherwise be overwritten by this one
    window.addEventListener('storage', (e) => {
        if (e.key === ROOMS_KEY && getSessionRoom()) {
            appData = loadData();
            renderAll();
        } else if (e.key === SETTINGS_KEY) {
            appSettings = loadSettings();
        }
    });

    // ============================================================
    //  ROOM EVENT LISTENERS
    // ============================================================
    document.getElementById('roomForm').addEventListener('submit', handleRoomSubmit);
    document.getElementById('roomPasscode').addEventListener('input', () => setRoomCreateMode(false));
    document.getElementById('leaveRoomBtn').addEventListener('click', handleLeaveRoom);
}

// ============================================================
//  ROOM CONTROLLERS (PASSCODE ACCESS)
// ============================================================
const MIN_PASSCODE_LENGTH = 4;
let roomCreateMode = false;

async function hashPasscode(passcode) {
    const bytes = new TextEncoder().encode('taskforge-room:' + passcode);
    if (window.crypto && crypto.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return 'room_' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for insecure contexts without SubtleCrypto (FNV-1a)
    let h = 0x811c9dc5;
    bytes.forEach(b => { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; });
    return 'room_fnv_' + h.toString(16);
}

function setRoomCreateMode(on) {
    roomCreateMode = on;
    document.getElementById('roomSubmitBtn').textContent = on ? 'Create New Room' : 'Enter Room';
    document.getElementById('roomHint').textContent = on
        ? 'No room uses this passcode yet. Check it for typos, or click "Create New Room" to make one.'
        : 'Enter your room passcode. Using a new passcode creates a new room.';
    showRoomError('');
}

function showRoomError(msg) {
    const err = document.getElementById('roomErrorMsg');
    err.textContent = msg;
    err.classList.toggle('hidden', !msg);
}

async function handleRoomSubmit(e) {
    e.preventDefault();
    const passcode = document.getElementById('roomPasscode').value.trim();
    if (passcode.length < MIN_PASSCODE_LENGTH) {
        showRoomError(`Passcode must be at least ${MIN_PASSCODE_LENGTH} characters.`);
        return;
    }

    const roomId = await hashPasscode(passcode);
    const rooms = getRooms();

    if (!rooms[roomId]) {
        // Ask once before creating, so a typo doesn't silently open an empty room
        if (!roomCreateMode) {
            setRoomCreateMode(true);
            return;
        }

        // The first room on this browser adopts any tasks from before rooms existed
        const legacy = Object.keys(rooms).length === 0 ? loadLegacyData() : null;
        rooms[roomId] = {
            createdAt: new Date().toISOString(),
            data: legacy && legacy.tasks.length ? legacy : structuredClone(DEFAULT_DATA)
        };
        saveRooms(rooms);
        enterRoom(roomId, rooms[roomId]);
        showToast('🎉 Room created! Alerts will show on your dashboard.', 'success');
    } else {
        enterRoom(roomId, rooms[roomId]);
        showToast('⚡ Welcome back to your room!', 'success');
    }
}

function enterRoom(roomId, room) {
    setSessionRoom(roomId);
    appData = normalizeData(room.data);
    saveData(appData);
    requestNotificationPermission();

    closeModal('roomModal');
    document.getElementById('roomForm').reset();
    setRoomCreateMode(false);
    updateRoomUI();
    selectViewDay(todayKey());
    renderAll();
}

function handleLeaveRoom() {
    saveData(appData);
    setSessionRoom(null);
    appData = structuredClone(DEFAULT_DATA);

    updateRoomUI();
    renderAll();
    showRoomGate();
    showToast('Left room. Enter a passcode to continue.', 'info');
}

function showRoomGate() {
    setRoomCreateMode(false);
    openModal('roomModal');
    setTimeout(() => document.getElementById('roomPasscode').focus(), 120);
}

function updateRoomUI() {
    const roomId = getSessionRoom();
    const room = roomId && getRooms()[roomId];
    const chip = document.getElementById('roomChip');
    if (chip) chip.classList.toggle('hidden', !room);
}

// ============================================================
//  INITIALIZATION
// ============================================================
function init() {
    setupEventListeners();
    updateRoomUI();
    updateClock();
    renderAll();
    startNotificationHeartbeat();

    const roomId = getSessionRoom();
    if (!roomId || !getRooms()[roomId]) {
        setSessionRoom(null);
        showRoomGate();
    } else {
        // Persist any data migration right away
        saveData(appData);
    }
}

document.addEventListener('DOMContentLoaded', init);
