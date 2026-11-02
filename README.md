# TaskForge ⚡

> **Track. Conquer. Repeat.** — A high-performance task management system featuring Codeforces-style activity heatmaps, instant quick-add, and live dashboard alerts.

🌐 **Live Website**: [https://adcobra.github.io/Task-Forge/](https://adcobra.github.io/Task-Forge/)

![TaskForge Banner](https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80)

---

## 🌟 Highlights

- **Instant "Type & Enter" Task Creation**: Add tasks in milliseconds through the prominent Quick-Add Bar or category-specific inline inputs.
- **Passcode Rooms (no sign-up)**: Open the site, type a passcode, and you're in. A new passcode creates your room (after a one-click confirm, so typos don't make empty rooms); the same passcode brings you back. Each room has its own tasks, streaks, and alerts. Passcodes are stored only as SHA-256 hashes.
- **Codeforces-Style Heatmaps**: 52-week rolling activity grids with dynamic rating ranks (*Newbie* → *Pupil* → *Specialist* → *Expert* → *Candidate Master* → *Master* → *Grandmaster*).
- **Three Dedicated Spheres**:
  - 🏃 **Sports** (Electric Cyan / Specialist Tier)
  - 🧹 **Chores** (Amber Gold / Candidate Master Tier)
  - ⚡ **Productivity** (Coral Red / Grandmaster Tier)
- **Continuous 1-Second Heartbeat Watcher**:
  - Automatically triggers reminders at your scheduled time.
  - Automatically triggers urgent alerts when deadlines expire.
- **Dashboard Alerts**:
  - An **Alerts** panel right on the dashboard lists reminders, deadline hits, and overdue follow-ups, newest first.
  - Mark a task done straight from its alert, dismiss alerts one by one, mark all read, or clear the list.
  - Unread count on the 🔔 bell, plus a slide-in banner, an optional chime, and desktop notifications when the browser allows them.
  - Turn reminder and deadline alerts on or off, and choose overdue follow-ups (every 1h / 3h / 6h / 24h, max 3 per task).
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
