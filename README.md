# TaskForge 98 ⚡

> **Track. Conquer. Repeat.** — A retro, late-90s-desktop-style task tracker with a day-picker calendar, Codeforces-style activity heatmaps, instant quick-add, and live dashboard alerts.

🌐 **Live Website**: [https://adcobra.github.io/Task-Forge/](https://adcobra.github.io/Task-Forge/)

---

## 🌟 Highlights

- **Retro 90s Look (light mode)**: Beveled grey windows, navy title bars, a taskbar with a clock and scrolling ticker, pixel-font counters, and yellow system-tray alert balloons.
- **Retro Sounds**: Synthesized in the browser (no audio files) — keyboard clacks as you type (with distinct Backspace and Enter sounds), mechanical button clicks, checkbox blips, a jingle when you finish a task, dialog open/close tones, an error chord, and a startup tune. Toggle them with **🔊 Sound** in the toolbar, or in **⚙️ Settings** (click & typing sounds, alert chime, volume).
- **Mobile Friendly**: Finger-sized controls, no zoom-on-focus on iPhone, a bottom bar with ◀ day ▶, ＋ new task and 🔔 alerts, full-screen dialogs with buttons always in reach, collapsible windows, and support for the iPhone home-bar area.
- **Pick Your Days**: In **📝 New Task…** (or **📅 Pick Days…** from Quick Add), click any days on a month calendar — or use *Today*, *Next 7 days*, *Weekdays (2 wks)* — and the task shows up on each of them at its due time. Each day is ticked off separately.
- **Calendar + Day View**: A calendar window marks days with tasks (blue), overdue work (red), and all-done days (green). Click a day, or use ◀ Today ▶, to see that day's tasks and stats.
- **Instant "Type & Enter" Task Creation**: Quick Add and the per-category inputs add a task to the day you're viewing.
- **Passcode Rooms (no sign-up)**: Open the site, type a passcode, and you're in. A new passcode creates your room (after a one-click confirm, so typos don't make empty rooms); the same passcode brings you back. Each room has its own tasks, streaks, and alerts. Passcodes are stored only as SHA-256 hashes.
- **Codeforces-Style Heatmaps**: 53-week activity grids that fill the window (and scroll on phones, newest weeks first), with hover tooltips and rating ranks in their Codeforces colours (*Newbie* → *Pupil* → *Specialist* → *Expert* → *Candidate Master* → *Master* → *Grandmaster*).
- **Three Dedicated Spheres**:
  - 🏃 **Sports** (teal)
  - 🧹 **Chores** (amber)
  - ⚡ **Productivity** (red)
- **Continuous 1-Second Heartbeat Watcher**:
  - Automatically triggers reminders at your scheduled time.
  - Automatically triggers urgent alerts when deadlines expire.
- **Dashboard Alerts**:
  - An **Alerts** panel right on the dashboard lists reminders, deadline hits, and overdue follow-ups, newest first.
  - Mark a task done straight from its alert, dismiss alerts one by one, mark all read, or clear the list.
  - Unread count on the 🔔 Alerts button, plus a pop-up balloon, an optional chime, and desktop notifications when the browser allows them.
  - Turn reminder and deadline alerts on or off, and choose overdue follow-ups (every 1h / 3h / 6h / 24h, max 3 per task day).
  - Alerts missed while the app was closed fire on next open, without doubling up a reminder for a task that's already past its deadline.
- **Local Persistence**: Powered by `localStorage` for zero-setup, privacy-first offline capability.

---

## 🚀 Getting Started

Simply clone the repository and open `index.html` in your favorite web browser or start any local HTTP server:

```bash
# Clone the repository
git clone https://github.com/ADCobra/Task-Forge.git
cd Task-Forge

# Option 1: Open directly in browser
open index.html

# Option 2: Serve using Python
python3 -m http.server 3000

# Option 3: Serve using Node / npx
npx serve .
```

Visit `http://localhost:3000` in your browser.

---

## 🔔 Alert Settings

Click the **Settings (⚙️)** icon in the header to toggle the chime, reminder alerts, deadline alerts, and overdue follow-ups. **Show Test Alert** fires a sample alert so you can see how it looks.

> **Note:** TaskForge is a static site, so alerts fire while it is open in a browser tab. Anything missed while it was closed shows up the next time you open it.

---

## 🛠️ Tech Stack

- **HTML5**: Semantic, accessible structure with high-contrast theme.
- **Vanilla CSS**: Custom glassmorphism, responsive grid layout, ambient glowing orbs, and micro-animations.
- **Vanilla JavaScript (ES6+)**: Custom reactive state management, Web Audio API synthesis, continuous watchdog timers, and SVG heatmaps.

---

## 📄 License

MIT License © 2026 TaskForge
