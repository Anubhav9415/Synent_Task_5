# FocusFlow ⚡
### A World-Class Task Management & Pomodoro Productivity Hub

FocusFlow is a high-fidelity, responsive task management and productivity web application built from first principles. It combines a checklist with an interactive analytics dashboard, tag categories, manual drag-and-drop sorting, a Pomodoro timer, audio cues, and a physics-based canvas confetti engine.

---

## Key Features

- **Dashboard Analytics**: Real-time progress calculations shown through an animated circular ring and statistics cards (Total, Completed, Pending, Overdue).
- **Advanced Task Creator**: Details drawer supporting descriptions, priority tags (Low, Medium, High), due dates, and categories.
- **Custom Tags Manager**: Create custom categories with custom theme colors using a built-in color-picker modal.
- **Dynamic Sorting & Filtering**: Instant keyword search, filtering by status/category/priority, and sorting by created time, due date, priority, or drag-and-drop manual ordering.
- **Focus Space**: Syncs a Pomodoro timer (Focus, Short Break, Long Break) to any selected task, urging task completion when the focus session ends.
- **Web Audio Feedback**: Soft, synthetic clicks and double-beep completion melodies generated client-side via the browser's Web Audio API.
- **Confetti Particle Engine**: A lightweight HTML5 Canvas physics emitter simulating colorful falling particles on task completion.
- **Import / Export**: Backup tasks locally as a `.json` file or restore a previous session.
- **Persistent Theme**: Toggle dark/light theme, saving user preference in browser `localStorage`.

---

## File Structure

- `index.html` - HTML5 structure, inline SVGs, and modal/toast wrappers.
- `style.css` - Custom styling using HSL variables, glassmorphic layout definitions, keyframe animations, and media queries.
- `app.js` - Application logic containing:
  - `TaskManager` (Data operations, CRUD, undo cache)
  - `SoundController` (Web Audio API synth tones)
  - `ConfettiEngine` (Canvas rendering loop)
  - `PomodoroTimer` (Countdowns & callback handles)
  - `AppController` (DOM events and UI renderer)

---

## Getting Started

1. Download or clone this directory.
2. Double-click `index.html` to run the application in any modern web browser.
3. No build tools, compilers, node modules, or external CDN dependencies are required. The app is fully self-contained.
