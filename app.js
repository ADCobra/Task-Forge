/**
 * TaskForge — Codeforces-Style Task Tracker & Dashboard Alerts
 * High-performance task management with Codeforces heatmaps & live alerts.
 */

// ============================================================
//  STORAGE & STATE
// ============================================================
const STORAGE_KEY = 'taskforge_v1';
const SETTINGS_KEY = 'taskforge_settings_v1';
const ROOMS_KEY = 'taskforge_rooms_v1';
const SESSION_KEY = 'taskforge_session_room_v1';


const CATEGORIES = ['sports', 'chores', 'productivity'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function normalizeData(data) {
    const d = data || structuredClone(DEFAULT_DATA);
    if (!d.tasks) d.tasks = [];
    if (!d.completions) d.completions = { sports: {}, chores: {}, productivity: {} };
    if (!d.alerts) d.alerts = [];
    // Older data: per-task flag was called emailNotify, and the inbox log is retired
    d.tasks.forEach(t => {
        if (t.alertsOn === undefined) t.alertsOn = t.emailNotify !== false;
        delete t.emailNotify;
    });
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

let appData = loadData();
let appSettings = loadSettings();
let quickSelectedCategory = 'productivity';

// ============================================================
//  AUDIO CHIME (WEB AUDIO SYNTHESIZER)
// ============================================================
function playNotificationChime(type = 'reminder') {
    if (!appSettings.soundChime) return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';

        const now = ctx.currentTime;
        if (type === 'reminder') {
            // Uplifting two-tone chime (A5 -> E6)
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.15);
            osc2.frequency.setValueAtTime(440, now);
            osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
        } else {
            // Urgent alert chime (high warning C6 -> G5)
            osc1.frequency.setValueAtTime(1046.5, now);
            osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
            osc2.frequency.setValueAtTime(523.25, now);
            osc2.frequency.exponentialRampToValueAtTime(392.00, now + 0.2);
        }

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.6);
        osc2.stop(now + 0.6);
    } catch (e) {
        // AudioContext may be locked until user interaction
    }
}

// ============================================================
//  DATE UTILITIES
// ============================================================
function getDateKey(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateTimeLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
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

// ============================================================
//  CODEFORCES HEATMAP & STATS ENGINE
// ============================================================
function getCodeforcesRank(count) {
    if (count >= 100) return { title: 'Grandmaster', class: 'rank-grandmaster' };
    if (count >= 75) return { title: 'Master', class: 'rank-gold' };
    if (count >= 50) return { title: 'Candidate Master', class: 'rank-gold' };
    if (count >= 30) return { title: 'Expert', class: 'rank-cyan' };
    if (count >= 15) return { title: 'Specialist', class: 'rank-cyan' };
    if (count >= 5) return { title: 'Pupil', class: 'rank-cyan' };
    return { title: 'Newbie', class: 'rank-cyan' };
}

function calculateCategoryStats(category) {
    const completions = (appData.completions && appData.completions[category]) || {};
    const dates = Object.keys(completions).sort();

    let totalDone = 0;
    let activeDays = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    dates.forEach(dStr => {
        const count = completions[dStr] || 0;
        if (count > 0) {
            totalDone += count;
            const d = new Date(dStr);
            if (d >= oneYearAgo && d <= today) {
                activeDays++;
            }
        }
    });

    // Current Streak & Max Streak
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    // Build timeline for streaks
    const cursor = new Date(today);
    const todayKey = getDateKey(today);
    const hasToday = (completions[todayKey] || 0) > 0;

    if (hasToday) {
        currentStreak = 1;
        cursor.setDate(cursor.getDate() - 1);
    } else {
        // Check yesterday to see if streak is alive
        cursor.setDate(cursor.getDate() - 1);
    }

    while (true) {
        const k = getDateKey(cursor);
        if ((completions[k] || 0) > 0) {
            currentStreak++;
            cursor.setDate(cursor.getDate() - 1);
        } else {
            break;
        }
    }

    // Longest streak across all dates
    if (dates.length > 0) {
        let prevDate = null;
        dates.forEach(dStr => {
            if ((completions[dStr] || 0) > 0) {
                const cur = new Date(dStr);
                if (prevDate) {
                    const diffDays = Math.round((cur - prevDate) / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) {
                        tempStreak++;
                    } else {
                        tempStreak = 1;
                    }
                } else {
                    tempStreak = 1;
                }
                if (tempStreak > maxStreak) maxStreak = tempStreak;
                prevDate = cur;
            }
        });
    }

    if (currentStreak > maxStreak) maxStreak = currentStreak;

    return { totalDone, activeDays, currentStreak, maxStreak };
}

function renderHeatmaps() {
    CATEGORIES.forEach(cat => renderHeatmap(cat));
}

function renderHeatmap(category) {
    const grid = document.getElementById(`${category}-heatmap`);
    const monthsEl = document.getElementById(`${category}-months`);
    const summaryEl = document.getElementById(`${category}-heatmap-summary`);
    const rankBadge = document.getElementById(`${category}-rank`);
    const curStreakEl = document.getElementById(`${category}-current-streak`);
    const maxStreakEl = document.getElementById(`${category}-max-streak`);
    const activeDaysEl = document.getElementById(`${category}-active-days`);
    const totalDoneEl = document.getElementById(`${category}-total-done`);

    if (!grid || !monthsEl) return;
    grid.innerHTML = '';
    monthsEl.innerHTML = '';

    const colorVars = {
        sports: ['var(--sports-1)', 'var(--sports-2)', 'var(--sports-3)', 'var(--sports-4)'],
        chores: ['var(--chores-1)', 'var(--chores-2)', 'var(--chores-3)', 'var(--chores-4)'],
        productivity: ['var(--prod-1)', 'var(--prod-2)', 'var(--prod-3)', 'var(--prod-4)'],
    };

    const colors = colorVars[category];
    const completions = (appData.completions && appData.completions[category]) || {};

    // 52 full weeks (364 days + offset)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);

    // Align to Monday (Codeforces / GitHub standard: Mon-Sun)
    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + mondayOffset);

    const monthPositions = [];
    let lastMonth = -1;
    let currentDate = new Date(startDate);
    let weekIndex = 0;
    let weekEl = null;

    let yearSubmissions = 0;

    while (currentDate <= today) {
        const dow = currentDate.getDay();
        const mondayDow = dow === 0 ? 6 : dow - 1; // Mon=0, Sun=6

        if (mondayDow === 0) {
            weekEl = document.createElement('div');
            weekEl.className = 'heatmap-week';
            grid.appendChild(weekEl);

            const month = currentDate.getMonth();
            if (month !== lastMonth) {
                monthPositions.push({ month, weekIndex });
                lastMonth = month;
            }
            weekIndex++;
        }

        const key = getDateKey(currentDate);
        const count = completions[key] || 0;
        if (count > 0) yearSubmissions += count;

        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.dataset.date = key;
        cell.dataset.count = count;

        const formattedDate = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        cell.dataset.tooltip = `${formattedDate} • ${count} task${count !== 1 ? 's' : ''} completed`;

        if (count > 0) {
            const level = count >= 4 ? 3 : count >= 3 ? 2 : count >= 2 ? 1 : 0;
            cell.style.background = colors[level];
            cell.style.borderColor = colors[level];
        }

        if (weekEl) weekEl.appendChild(cell);

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Render month labels
    const weekWidth = 15; // 12px cell + 3px gap
    monthPositions.forEach(({ month, weekIndex: wi }) => {
        const span = document.createElement('span');
        span.textContent = MONTH_NAMES[month];
        span.style.position = 'absolute';
        span.style.left = `${wi * weekWidth}px`;
        monthsEl.appendChild(span);
    });

    // Update section stats and Codeforces rank
    const stats = calculateCategoryStats(category);
    const rank = getCodeforcesRank(stats.totalDone);

    if (summaryEl) summaryEl.textContent = `${yearSubmissions} tasks in the last year`;
    if (rankBadge) {
        rankBadge.textContent = rank.title;
        rankBadge.className = `cf-rank-badge ${rank.class}`;
    }
    if (curStreakEl) curStreakEl.textContent = `${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`;
    if (maxStreakEl) maxStreakEl.textContent = `${stats.maxStreak} day${stats.maxStreak !== 1 ? 's' : ''}`;
    if (activeDaysEl) activeDaysEl.textContent = stats.activeDays;
    if (totalDoneEl) totalDoneEl.textContent = stats.totalDone;
}

// ============================================================
//  TASK MANAGEMENT & RENDERING
// ============================================================
function renderTasks() {
    CATEGORIES.forEach(cat => {
        const list = document.getElementById(`${cat}-tasks`);
        const empty = document.getElementById(`${cat}-empty`);
        if (!list || !empty) return;

        const tasks = appData.tasks.filter(t => t.category === cat);
        const countEl = document.getElementById(`${cat}-count`);
        if (countEl) countEl.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;

        if (tasks.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');

        // Incomplete first (high -> medium -> low), then completed
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const sorted = [...tasks].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        });

        const now = new Date();

        list.innerHTML = sorted.map(task => {
            const deadline = new Date(task.deadline);
            const isOverdue = !task.completed && deadline < now;
            const isUrgent = !task.completed && (deadline - now) < 3600000 && !isOverdue;
            const timeLeft = formatTimeLeft(deadline, now);

            return `
                <div class="task-item ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" data-id="${task.id}">
                    <div class="task-checkbox">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')" id="check-${task.id}" aria-label="Toggle task completion">
                        <div class="check-visual">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                    </div>
                    <div class="task-info">
                        <div class="task-title">${escapeHTML(task.title)}</div>
                        ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>` : ''}
                        <div class="task-meta">
                            <span class="task-deadline ${isUrgent || isOverdue ? 'urgent' : ''}">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                                ${timeLeft}
                            </span>
                            <span class="task-priority-dot ${task.priority}" title="${task.priority} priority"></span>
                            ${task.alertsOn ? `
                                <span class="task-alert-pill" title="Dashboard alerts active">🔔 Alerts</span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="task-action-btn" onclick="deleteTask('${task.id}')" title="Delete task" aria-label="Delete task">
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    });

    updateGlobalStats();
}

function updateGlobalStats() {
    const total = appData.tasks.length;
    const completed = appData.tasks.filter(t => t.completed).length;
    const now = new Date();
    const overdue = appData.tasks.filter(t => !t.completed && new Date(t.deadline) < now).length;

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = total - completed;
    document.getElementById('overdueTasks').textContent = overdue;

    calculateCombinedStreak();
}

function calculateCombinedStreak() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    const d = new Date(today);

    while (true) {
        const key = getDateKey(d);
        let hasCompletion = false;

        for (const cat of CATEGORIES) {
            if (appData.completions[cat] && appData.completions[cat][key] > 0) {
                hasCompletion = true;
                break;
            }
        }

        if (!hasCompletion && d < today) break;
        if (hasCompletion) streak++;
        if (!hasCompletion && d.getTime() === today.getTime()) {
            d.setDate(d.getDate() - 1);
            continue;
        }
        d.setDate(d.getDate() - 1);
    }

    document.getElementById('streakCount').textContent = streak;
}

// ============================================================
//  TASK CREATION & MODIFICATION
// ============================================================
function addTask(taskData) {
    const task = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2),
        title: taskData.title,
        description: taskData.description || '',
        category: taskData.category || 'productivity',
        deadline: taskData.deadline,
        reminder: taskData.reminder || null,
        priority: taskData.priority || 'medium',
        alertsOn: taskData.alertsOn !== false,
        completed: false,
        createdAt: new Date().toISOString(),
        reminderSent: false,
        deadlineNotifySent: false,
        overdueAlertCount: 0,
        lastOverdueAlertAt: null,
    };

    appData.tasks.push(task);
    saveData(appData);
    renderTasks();

    showToast(`Task added to ${task.category.toUpperCase()}! ⚡`, 'success');
}

function toggleTask(id) {
    const task = appData.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;

    const today = getDateKey(new Date());
    if (!appData.completions[task.category]) appData.completions[task.category] = {};

    if (task.completed) {
        appData.completions[task.category][today] = (appData.completions[task.category][today] || 0) + 1;
        playNotificationChime('reminder');
        showToast(`🎉 "${task.title}" completed! Heatmap updated!`, 'success');
    } else {
        if (appData.completions[task.category][today] > 0) {
            appData.completions[task.category][today]--;
        }
    }

    saveData(appData);
    renderTasks();
    renderHeatmaps();
    renderAlerts();
}

function deleteTask(id) {
    const task = appData.tasks.find(t => t.id === id);
    if (!task) return;

    appData.tasks = appData.tasks.filter(t => t.id !== id);
    saveData(appData);
    renderTasks();
    renderAlerts();
    showToast(`Task removed`, 'info');
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

function composeAlertMessage(task, type) {
    const deadlineStr = new Date(task.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    if (type === 'reminder') return `Due ${deadlineStr} — ${formatTimeLeft(new Date(task.deadline), new Date())}.`;
    if (type === 'overdue') return `Was due ${deadlineStr} and still isn't done.`;
    if (type === 'test') return 'Alerts are working. They will show up here.';
    return `Was due ${deadlineStr}. Complete it or update the deadline.`;
}

function triggerAlert(task, type = 'reminder') {
    const alert = {
        id: 'alert_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        taskId: task.id,
        taskTitle: task.title,
        category: task.category,
        priority: task.priority,
        deadline: task.deadline,
        type: type,
        message: composeAlertMessage(task, type),
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
        const canComplete = task && !task.completed;
        return `
            <div class="alert-item ${alert.type} ${alert.read ? '' : 'unread'}" onclick="markAlertRead('${alert.id}')">
                <span class="alert-item-icon">${meta.icon}</span>
                <div class="alert-item-body">
                    <div class="alert-item-title">
                        <span class="alert-item-label">${meta.label}</span>
                        ${escapeHTML(alert.taskTitle)}
                        ${alert.category && CATEGORIES.includes(alert.category) ? `<span class="alert-cat-pill ${alert.category}">${alert.category}</span>` : ''}
                    </div>
                    <div class="alert-item-msg">${escapeHTML(alert.message)}</div>
                </div>
                <span class="alert-item-time">${formatRelativeTime(alert.timestamp)}</span>
                <div class="alert-item-actions">
                    ${canComplete ? `<button type="button" class="alert-done-btn" onclick="event.stopPropagation(); completeFromAlert('${alert.id}')" title="Mark task done">✓ Done</button>` : ''}
                    ${task && task.completed ? `<span class="alert-completed-tag">Completed</span>` : ''}
                    <button type="button" class="alert-dismiss-btn" onclick="event.stopPropagation(); dismissAlert('${alert.id}')" title="Dismiss alert" aria-label="Dismiss alert">&times;</button>
                </div>
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
    if (task && !task.completed) toggleTask(task.id);
    renderAlerts();
}

// ============================================================
//  DEADLINE & REMINDER ACTIVE WATCHER (1-SECOND HEARTBEAT)
// ============================================================
function startNotificationHeartbeat() {
    setInterval(() => {
        const now = Date.now();
        let changed = false;

        appData.tasks.forEach(task => {
            if (task.completed || !task.alertsOn) return;
            const deadlineTime = task.deadline ? new Date(task.deadline).getTime() : null;

            // 1. Reminder Check
            if (task.reminder && !task.reminderSent) {
                const reminderTime = new Date(task.reminder).getTime();
                if (now >= reminderTime) {
                    task.reminderSent = true;
                    changed = true;
                    // If the app was closed past the deadline too, the deadline alert covers it
                    const coveredByDeadline = appSettings.deadlineAlerts && !task.deadlineNotifySent
                        && deadlineTime !== null && now >= deadlineTime && reminderTime < deadlineTime;
                    if (appSettings.reminderAlerts && !coveredByDeadline) {
                        triggerAlert(task, 'reminder');
                    }
                }
            }

            // 2. Deadline Reached Check
            if (deadlineTime !== null && !task.deadlineNotifySent && now >= deadlineTime) {
                task.deadlineNotifySent = true;
                task.lastOverdueAlertAt = now;
                changed = true;
                if (appSettings.deadlineAlerts) {
                    triggerAlert(task, 'deadline');
                }
            }

            // 3. Overdue Follow-up Check
            const followUpMs = (appSettings.overdueFollowUpHours || 0) * 3600000;
            if (followUpMs > 0 && task.deadlineNotifySent && (task.overdueAlertCount || 0) < MAX_OVERDUE_FOLLOW_UPS) {
                const last = task.lastOverdueAlertAt || deadlineTime;
                if (now - last >= followUpMs) {
                    task.overdueAlertCount = (task.overdueAlertCount || 0) + 1;
                    task.lastOverdueAlertAt = now;
                    changed = true;
                    triggerAlert(task, 'overdue');
                }
            }
        });

        if (changed) {
            saveData(appData);
            renderTasks();
        }
    }, 1000);

    // Keep "5m ago" labels fresh
    setInterval(renderAlerts, 60000);
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
        setTimeout(() => toast.remove(), 260);
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
    document.body.style.overflow = '';
}

// ============================================================
//  EVENT LISTENERS SETUP
// ============================================================
function setupEventListeners() {
    // 1. SMART QUICK-ADD FORM ("i type something and its a task")
    const quickForm = document.getElementById('quickAddForm');
    const quickInput = document.getElementById('quickInput');
    const deadlinePreset = document.getElementById('quickDeadlinePreset');
    const customDeadlineInput = document.getElementById('quickCustomDeadline');

    // Category button toggle
    document.querySelectorAll('.quick-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quick-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            quickSelectedCategory = btn.dataset.cat;
        });
    });

    // Deadline preset change
    deadlinePreset.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customDeadlineInput.classList.remove('hidden');
            const tmrw = new Date();
            tmrw.setDate(tmrw.getDate() + 1);
            customDeadlineInput.value = formatDateTimeLocal(tmrw);
        } else {
            customDeadlineInput.classList.add('hidden');
        }
    });

    quickForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = quickInput.value.trim();
        if (!title) return;

        // Compute deadline
        const now = new Date();
        let deadline = new Date(now);

        const presetVal = deadlinePreset.value;
        if (presetVal === 'today-eod') {
            deadline.setHours(23, 59, 0, 0);
        } else if (presetVal === 'tomorrow-9am') {
            deadline.setDate(deadline.getDate() + 1);
            deadline.setHours(9, 0, 0, 0);
        } else if (presetVal === 'tomorrow-eod') {
            deadline.setDate(deadline.getDate() + 1);
            deadline.setHours(23, 59, 0, 0);
        } else if (presetVal === 'in-1-hour') {
            deadline = new Date(now.getTime() + 3600000);
        } else if (presetVal === 'in-2-hours') {
            deadline = new Date(now.getTime() + 7200000);
        } else if (presetVal === 'in-3-days') {
            deadline.setDate(deadline.getDate() + 3);
            deadline.setHours(23, 59, 0, 0);
        } else if (presetVal === 'custom' && customDeadlineInput.value) {
            deadline = new Date(customDeadlineInput.value);
        }

        // Compute reminder
        const reminderPreset = document.getElementById('quickReminderPreset').value;
        let reminder = null;
        if (reminderPreset === '15m') {
            reminder = new Date(deadline.getTime() - 15 * 60000);
        } else if (reminderPreset === '1h') {
            reminder = new Date(deadline.getTime() - 60 * 60000);
        } else if (reminderPreset === '3h') {
            reminder = new Date(deadline.getTime() - 180 * 60000);
        } else if (reminderPreset === '1d') {
            reminder = new Date(deadline.getTime() - 1440 * 60000);
        } else if (reminderPreset === 'at-deadline') {
            reminder = new Date(deadline);
        }

        addTask({
            title,
            category: quickSelectedCategory,
            deadline: deadline.toISOString(),
            reminder: reminder ? reminder.toISOString() : null,
            priority: 'medium',
            alertsOn: true
        });

        quickInput.value = '';
        quickInput.focus();
    });

    // 2. INLINE SECTION QUICK-ADD INPUTS
    ['sports', 'chores', 'productivity'].forEach(cat => {
        const input = document.getElementById(`inline-add-${cat}`);
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const title = input.value.trim();
                if (!title) return;

                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(23, 59, 0, 0);

                const reminder = new Date(tomorrow.getTime() - 60 * 60000);

                addTask({
                    title,
                    category: cat,
                    deadline: tomorrow.toISOString(),
                    reminder: reminder.toISOString(),
                    priority: 'medium',
                    alertsOn: true
                });

                input.value = '';
            }
        });
    });

    // 3. DETAILED MODAL CONTROLS
    document.getElementById('addTaskBtn').addEventListener('click', () => {
        const tmrw = new Date();
        tmrw.setDate(tmrw.getDate() + 1);
        tmrw.setHours(23, 59, 0, 0);
        document.getElementById('taskDeadline').value = formatDateTimeLocal(tmrw);

        const rem = new Date(tmrw.getTime() - 60 * 60000);
        document.getElementById('taskReminder').value = formatDateTimeLocal(rem);

        openModal('taskModal');
        setTimeout(() => document.getElementById('taskTitle').focus(), 120);
    });

    document.getElementById('modalClose').addEventListener('click', () => closeModal('taskModal'));
    document.getElementById('modalCancel').addEventListener('click', () => closeModal('taskModal'));

    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const category = document.querySelector('input[name="category"]:checked').value;
        const deadline = document.getElementById('taskDeadline').value;
        const reminder = document.getElementById('taskReminder').value;
        const priority = document.querySelector('input[name="priority"]:checked').value;
        const alertsOn = document.getElementById('taskAlertsOn').checked;

        if (!title) return;

        addTask({
            title,
            description,
            category,
            deadline: new Date(deadline).toISOString(),
            reminder: reminder ? new Date(reminder).toISOString() : null,
            priority,
            alertsOn
        });

        closeModal('taskModal');
        document.getElementById('taskForm').reset();
    });

    // 4. ALERTS PANEL
    document.getElementById('alertsBtn').addEventListener('click', () => {
        document.getElementById('alertsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('alertBannerViewBtn').addEventListener('click', () => {
        document.getElementById('alertBanner').classList.remove('active');
        document.getElementById('alertsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    // 5. SETTINGS
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
        triggerAlert({
            id: null,
            title: 'Sample task',
            category: 'productivity',
            priority: 'medium',
            deadline: new Date(Date.now() + 3600000).toISOString()
        }, 'test');
    });

    // 7. SECTION COLLAPSE
    document.querySelectorAll('.btn-collapse').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = btn.dataset.target;
            const body = document.getElementById(`${target}-body`);
            btn.classList.toggle('collapsed');
            body.classList.toggle('hidden');
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

    closeModal('roomModal');
    document.getElementById('roomForm').reset();
    setRoomCreateMode(false);
    updateRoomUI();
    renderHeatmaps();
    renderTasks();
    renderAlerts();
}

function handleLeaveRoom() {
    saveData(appData);
    setSessionRoom(null);
    appData = structuredClone(DEFAULT_DATA);

    updateRoomUI();
    renderHeatmaps();
    renderTasks();
    renderAlerts();
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
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    setupEventListeners();
    updateRoomUI();
    renderHeatmaps();
    renderTasks();
    renderAlerts();
    startNotificationHeartbeat();

    const roomId = getSessionRoom();
    if (!roomId || !getRooms()[roomId]) {
        setSessionRoom(null);
        showRoomGate();
    }
}

document.addEventListener('DOMContentLoaded', init);
