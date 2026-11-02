# TaskForge ⚡

> **Track. Conquer. Repeat.** — A high-performance task management system featuring Codeforces-style activity heatmaps, instant quick-add, and automated Gmail notifications.

🌐 **Live Website**: [https://adcobra.github.io/Task-Forge/](https://adcobra.github.io/Task-Forge/)

![TaskForge Banner](https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80)

---

## 🌟 Highlights

- **Instant "Type & Enter" Task Creation**: Add tasks in milliseconds through the prominent Quick-Add Bar or category-specific inline inputs.
- **Email Authentication & Account Management**: Sign in and create accounts using your email with multi-user isolation, personalized streak tracking, and automatic sync to Gmail notification delivery.
- **Codeforces-Style Heatmaps**: 52-week rolling activity grids with dynamic rating ranks (*Newbie* → *Pupil* → *Specialist* → *Expert* → *Candidate Master* → *Master* → *Grandmaster*).
- **Three Dedicated Spheres**:
  - 🏃 **Sports** (Electric Cyan / Specialist Tier)
  - 🧹 **Chores** (Amber Gold / Candidate Master Tier)
  - ⚡ **Productivity** (Coral Red / Grandmaster Tier)
- **Continuous 1-Second Heartbeat Watcher**:
  - Automatically triggers reminders at your scheduled time.
  - Automatically triggers urgent alerts when deadlines expire.
- **Gmail Notification Center**:
  - Multi-channel notification delivery: In-app live slide-in banner, synthesized Web Audio chimes, and browser desktop notifications.
  - Interactive Gmail Inbox Reader with formatted task details.
  - Full remote delivery integration support via [EmailJS](https://www.emailjs.com/).
- **Email Alerts**:
  - Toggle reminder and deadline emails independently.
  - Overdue follow-up emails (every 1h / 3h / 6h / 24h, max 3 per task) until the task is done.
  - Daily digest email of overdue and due-today tasks at a time you choose.
  - One-click **Send Test Email** to verify your EmailJS setup, with clear error messages.
  - Per-email delivery status (Sent / Failed / Local) in the inbox, with one-click retry for failed sends.
  - Alerts missed while the app was closed are sent on next open, without double-sending a reminder for a task that is already past its deadline.
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

## 📬 Gmail Notification Setup (Optional)

TaskForge runs with its built-in interactive **Gmail Notification Center** right out of the box. To deliver real remote emails to your personal inbox:

1. Create a free account at [EmailJS](https://www.emailjs.com/).
2. Add a Gmail service and create an email template.
3. In TaskForge, click the **Settings (⚙️)** icon in the header.
4. Enter your EmailJS **Public Key**, **Service ID**, **Template ID**, and **Gmail Address**.
5. In your EmailJS template, set **To Email** to `{{to_email}}`, the subject to `{{subject}}`, and the body to `{{message}}` (`{{task_title}}`, `{{task_category}}` and `{{task_deadline}}` are also available).
6. Click **Send Test Email** in the *Email Alerts* section to confirm delivery, then pick which alerts you want (reminders, deadlines, overdue follow-ups, daily digest).
7. Save settings — alerts will now dispatch directly to your inbox!

> **Note:** TaskForge is a static site, so alerts are sent while it is open in a browser tab. Anything missed while it was closed is sent the next time you open it.

---

## 🛠️ Tech Stack

- **HTML5**: Semantic, accessible structure with high-contrast theme.
- **Vanilla CSS**: Custom glassmorphism, responsive grid layout, ambient glowing orbs, and micro-animations.
- **Vanilla JavaScript (ES6+)**: Custom reactive state management, Web Audio API synthesis, continuous watchdog timers, and SVG heatmaps.

---

## 📄 License

MIT License © 2026 TaskForge
