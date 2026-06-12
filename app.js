/**
 * FocusFlow Task Management Engine
 * Written from first principles using ES6+ JavaScript, Web Audio API, and HTML5 Canvas.
 */

// ==========================================================================
// STATE MANAGEMENT & DATA CONTROLLER
// ==========================================================================
class TaskManager {
    constructor() {
        this.tasks = [];
        this.categories = [
            { name: 'Personal', color: '#10b981' },
            { name: 'Work', color: '#3b82f6' },
            { name: 'Health', color: '#ef4444' },
            { name: 'Finance', color: '#f59e0b' }
        ];
        this.undoBuffer = { task: null, index: -1 };
        this.activeFilter = {
            status: 'All',
            category: 'All',
            priority: 'All',
            query: ''
        };
        this.activeSort = 'Created'; // 'Created', 'Due', 'Priority', 'Alphabetical', 'Manual'
        
        this.init();
    }

    init() {
        // Load Categories from LocalStorage
        const savedCategories = localStorage.getItem('focusflow_categories');
        if (savedCategories) {
            try {
                this.categories = JSON.parse(savedCategories);
            } catch (e) {
                console.error("Error parsing categories, reverting to defaults", e);
            }
        }

        // Load Tasks from LocalStorage
        const savedTasks = localStorage.getItem('focusflow_tasks');
        if (savedTasks) {
            try {
                this.tasks = JSON.parse(savedTasks);
            } catch (e) {
                console.error("Error parsing tasks", e);
            }
        }
    }

    saveTasks() {
        localStorage.setItem('focusflow_tasks', JSON.stringify(this.tasks));
    }

    saveCategories() {
        localStorage.setItem('focusflow_categories', JSON.stringify(this.categories));
    }

    addTask(title, desc = '', category = 'Personal', priority = 'Low', dueDate = '') {
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: title.trim(),
            description: desc.trim(),
            category,
            priority,
            dueDate: dueDate ? new Date(dueDate).toISOString() : '',
            completed: false,
            createdAt: new Date().toISOString()
        };
        this.tasks.unshift(newTask);
        this.saveTasks();
        return newTask;
    }

    deleteTask(id) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.undoBuffer = {
                task: this.tasks[index],
                index: index
            };
            this.tasks.splice(index, 1);
            this.saveTasks();
            return true;
        }
        return false;
    }

    restoreLastDeleted() {
        if (this.undoBuffer.task) {
            this.tasks.splice(this.undoBuffer.index, 0, this.undoBuffer.task);
            this.undoBuffer = { task: null, index: -1 };
            this.saveTasks();
            return true;
        }
        return false;
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            return task;
        }
        return null;
    }

    editTask(id, updatedFields) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            Object.assign(task, updatedFields);
            this.saveTasks();
            return task;
        }
        return null;
    }

    clearCompleted() {
        const beforeCount = this.tasks.length;
        this.tasks = this.tasks.filter(t => !t.completed);
        this.saveTasks();
        return beforeCount - this.tasks.length;
    }

    clearAll() {
        this.tasks = [];
        this.saveTasks();
    }

    addCategory(name, color) {
        const sanitized = name.trim();
        if (this.categories.some(c => c.name.toLowerCase() === sanitized.toLowerCase())) {
            return false;
        }
        this.categories.push({ name: sanitized, color });
        this.saveCategories();
        return true;
    }

    getFilteredAndSortedTasks() {
        // 1. Filter
        let result = this.tasks.filter(task => {
            // Status filter
            if (this.activeFilter.status === 'Active' && task.completed) return false;
            if (this.activeFilter.status === 'Completed' && !task.completed) return false;
            
            // Category filter
            if (this.activeFilter.category !== 'All' && task.category !== this.activeFilter.category) return false;
            
            // Priority filter
            if (this.activeFilter.priority !== 'All' && task.priority !== this.activeFilter.priority) return false;
            
            // Query filter
            if (this.activeFilter.query) {
                const q = this.activeFilter.query.toLowerCase();
                const titleMatch = task.title.toLowerCase().includes(q);
                const descMatch = task.description.toLowerCase().includes(q);
                if (!titleMatch && !descMatch) return false;
            }
            
            return true;
        });

        // 2. Sort
        const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
        
        if (this.activeSort === 'Created') {
            result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (this.activeSort === 'Due') {
            result.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            });
        } else if (this.activeSort === 'Priority') {
            result.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
        } else if (this.activeSort === 'Alphabetical') {
            result.sort((a, b) => a.title.localeCompare(b.title));
        }
        
        // Manual sorting does not sort here: it maintains the array order in which tasks are placed.
        
        return result;
    }

    reorderTasks(orderedIds) {
        const idMap = new Map(this.tasks.map((t, idx) => [t.id, t]));
        const reordered = [];
        orderedIds.forEach(id => {
            if (idMap.has(id)) {
                reordered.push(idMap.get(id));
            }
        });
        
        // Append any items that might have been filtered out of drag-drop UI
        this.tasks.forEach(t => {
            if (!orderedIds.includes(t.id)) {
                reordered.push(t);
            }
        });
        
        this.tasks = reordered;
        this.saveTasks();
    }
}

// ==========================================================================
// SYNTHETIC AUDIO FEEDBACK (WEB AUDIO API)
// ==========================================================================
class SoundController {
    constructor() {
        this.enabled = localStorage.getItem('focusflow_sound') !== 'false';
        this.audioCtx = null;
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('focusflow_sound', this.enabled);
        return this.enabled;
    }

    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playClick() {
        if (!this.enabled) return;
        this.initCtx();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.08);
        
        gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.08);
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.08);
    }

    playSuccessChime() {
        if (!this.enabled) return;
        this.initCtx();
        const now = this.audioCtx.currentTime;
        
        const playTone = (freq, start, duration, volume) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);
            
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(start);
            osc.stop(start + duration);
        };
        
        // Sweet double beep (E5 -> G5)
        playTone(523.25, now, 0.15, 0.08); // C5
        playTone(659.25, now + 0.08, 0.25, 0.08); // E5
        playTone(783.99, now + 0.16, 0.35, 0.08); // G5
    }

    playAlarm() {
        if (!this.enabled) return;
        this.initCtx();
        const now = this.audioCtx.currentTime;
        
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.linearRampToValueAtTime(440, now + 0.4);
        
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(884, now);
        osc2.frequency.linearRampToValueAtTime(442, now + 0.4);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
    }
}

// ==========================================================================
// PHYSICS CONFETTI ENGINE (HTML5 CANVAS)
// ==========================================================================
class ConfettiEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationFrameId = null;
        this.colors = ['#8b5cf6', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'];
        
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    spawn() {
        // Spawn from left and right edges shooting upwards
        const particleCount = 100;
        
        // Left shooter
        for (let i = 0; i < particleCount / 2; i++) {
            this.particles.push({
                x: 0,
                y: this.canvas.height * 0.85,
                vx: Math.random() * 8 + 8,
                vy: -(Math.random() * 12 + 10),
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                size: Math.random() * 8 + 6,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 4 - 2,
                opacity: 1
            });
        }
        
        // Right shooter
        for (let i = 0; i < particleCount / 2; i++) {
            this.particles.push({
                x: this.canvas.width,
                y: this.canvas.height * 0.85,
                vx: -(Math.random() * 8 + 8),
                vy: -(Math.random() * 12 + 10),
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                size: Math.random() * 8 + 6,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 4 - 2,
                opacity: 1
            });
        }
        
        if (!this.animationFrameId) {
            this.loop();
        }
    }

    loop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Apply physics
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.45; // Gravity
            p.vx *= 0.98; // Air resistance
            p.rotation += p.rotationSpeed;
            
            // Fade out as they fall down
            if (p.vy > 0) {
                p.opacity -= 0.015;
            }
            
            if (p.opacity <= 0 || p.x < -20 || p.x > this.canvas.width + 20 || p.y > this.canvas.height + 20) {
                this.particles.splice(i, 1);
                continue;
            }
            
            // Draw confetti particle
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();
        }
        
        if (this.particles.length > 0) {
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        } else {
            this.animationFrameId = null;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

// ==========================================================================
// POMODORO TIMER MANAGER
// ==========================================================================
class PomodoroTimer {
    constructor(soundController, onTick, onComplete, onModeChange) {
        this.sound = soundController;
        this.onTick = onTick;
        this.onComplete = onComplete;
        this.onModeChange = onModeChange;
        
        this.modes = {
            pomodoro: 25,
            short: 5,
            long: 15
        };
        
        this.currentMode = 'pomodoro';
        this.durationSeconds = this.modes.pomodoro * 60;
        this.secondsLeft = this.durationSeconds;
        this.isActive = false;
        this.intervalId = null;
        this.boundTask = null;
    }

    setMode(mode) {
        if (this.modes[mode] !== undefined) {
            this.pause();
            this.currentMode = mode;
            this.durationSeconds = this.modes[mode] * 60;
            this.secondsLeft = this.durationSeconds;
            this.onModeChange(mode);
            this.onTick(this.secondsLeft, this.durationSeconds);
        }
    }

    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.intervalId = setInterval(() => {
            this.secondsLeft--;
            this.onTick(this.secondsLeft, this.durationSeconds);
            
            if (this.secondsLeft <= 0) {
                this.complete();
            }
        }, 1000);
        this.sound.playClick();
    }

    pause() {
        if (!this.isActive) return;
        this.isActive = false;
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.sound.playClick();
    }

    reset() {
        this.pause();
        this.secondsLeft = this.durationSeconds;
        this.onTick(this.secondsLeft, this.durationSeconds);
    }

    complete() {
        this.pause();
        this.sound.playAlarm();
        this.onComplete(this.currentMode, this.boundTask);
        this.reset();
    }

    bindTask(task) {
        this.boundTask = task;
    }

    unbindTask() {
        this.boundTask = null;
    }
}

// ==========================================================================
// APPLICATION CONTROLLER & UI RENDERER
// ==========================================================================
class AppController {
    constructor() {
        this.manager = new TaskManager();
        this.sound = new SoundController();
        this.confetti = new ConfettiEngine('confettiCanvas');
        
        // Bind functions
        this.render = this.render.bind(this);
        this.showToast = this.showToast.bind(this);
        
        this.timer = new PomodoroTimer(
            this.sound,
            // Tick callback
            (left, total) => this.updateTimerUI(left, total),
            // Complete callback
            (mode, task) => this.handleTimerComplete(mode, task),
            // Mode change callback
            (mode) => this.updateTimerModeUI(mode)
        );

        this.editingTaskId = null;
        this.selectedColor = '#10b981'; // default category color
        
        this.initDomElements();
        this.bindEvents();
        this.renderGreetings();
        this.loadCategoriesSelect();
        
        // Initial render
        this.render();
    }

    initDomElements() {
        // Forms & Drawer
        this.taskForm = document.getElementById('taskForm');
        this.taskTitleInput = document.getElementById('taskTitleInput');
        this.toggleDetailsBtn = document.getElementById('toggleDetailsBtn');
        this.detailsDrawer = document.getElementById('detailsDrawer');
        this.taskCategorySelect = document.getElementById('taskCategorySelect');
        this.taskDueDate = document.getElementById('taskDueDate');
        this.taskDescInput = document.getElementById('taskDescInput');
        
        // Filters & Search
        this.searchInput = document.getElementById('searchInput');
        this.filterStatus = document.getElementById('filterStatus');
        this.filterCategory = document.getElementById('filterCategory');
        this.filterPriority = document.getElementById('filterPriority');
        this.sortTasks = document.getElementById('sortTasks');
        
        // List, Stats & Empty
        this.taskList = document.getElementById('taskList');
        this.emptyState = document.getElementById('emptyState');
        this.statTotal = document.getElementById('statTotal');
        this.statCompleted = document.getElementById('statCompleted');
        this.statPending = document.getElementById('statPending');
        this.statOverdue = document.getElementById('statOverdue');
        this.progressPercentageText = document.getElementById('progressPercentageText');
        this.progressCircle = document.getElementById('progressCircle');
        
        // Theme & Sound Toggle
        this.themeToggle = document.getElementById('themeToggle');
        this.soundToggle = document.getElementById('soundToggle');
        this.soundOnIcon = document.getElementById('soundOnIcon');
        this.soundOffIcon = document.getElementById('soundOffIcon');
        
        // Bulk Actions
        this.clearCompletedBtn = document.getElementById('clearCompletedBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.importFileInput = document.getElementById('importFileInput');
        
        // Modals
        this.customCatModal = document.getElementById('customCatModal');
        this.newCatInput = document.getElementById('newCatInput');
        this.cancelCatBtn = document.getElementById('cancelCatBtn');
        this.saveCatBtn = document.getElementById('saveCatBtn');
        this.editTaskModal = document.getElementById('editTaskModal');
        this.editTitleInput = document.getElementById('editTitleInput');
        this.editCategorySelect = document.getElementById('editCategorySelect');
        this.editDueDate = document.getElementById('editDueDate');
        this.editDescInput = document.getElementById('editDescInput');
        this.cancelEditBtn = document.getElementById('cancelEditBtn');
        this.saveEditBtn = document.getElementById('saveEditBtn');
        
        // Timer elements
        this.timerText = document.getElementById('timerText');
        this.timerCircle = document.getElementById('timerCircle');
        this.activeTaskTitle = document.getElementById('activeTaskTitle');
        this.timerStartBtn = document.getElementById('timerStartBtn');
        this.timerPauseBtn = document.getElementById('timerPauseBtn');
        this.timerResetBtn = document.getElementById('timerResetBtn');
        this.timerPulseDot = document.getElementById('timerPulseDot');
        this.recordDemoBtn = document.getElementById('recordDemoBtn');
        
        // Initialize Theme UI
        const currentTheme = localStorage.getItem('focusflow_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        this.updateThemeToggleIcon(currentTheme);
        
        // Initialize Sound UI
        this.updateSoundToggleIcon(this.sound.enabled);
    }

    bindEvents() {
        // Drawer toggle
        this.toggleDetailsBtn.addEventListener('click', () => {
            this.detailsDrawer.classList.toggle('hidden');
            this.sound.playClick();
        });

        // Add Task Submit
        this.taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = this.taskTitleInput.value.trim();
            if (!title) return;
            
            const desc = this.taskDescInput.value;
            const category = this.taskCategorySelect.value;
            
            // Get priority checked value
            const priority = document.querySelector('input[name="priority"]:checked').value;
            const dueDate = this.taskDueDate.value;
            
            this.manager.addTask(title, desc, category, priority, dueDate);
            
            // Clear inputs
            this.taskTitleInput.value = '';
            this.taskDescInput.value = '';
            this.taskDueDate.value = '';
            document.getElementById('prioLow').checked = true; // reset to low
            this.detailsDrawer.classList.add('hidden');
            
            this.sound.playClick();
            this.showToast('Task added successfully', 'success');
            
            this.render();
        });

        // Search & Filters
        this.searchInput.addEventListener('input', (e) => {
            this.manager.activeFilter.query = e.target.value;
            this.render();
        });

        this.filterStatus.addEventListener('change', (e) => {
            this.manager.activeFilter.status = e.target.value;
            this.render();
        });

        this.filterCategory.addEventListener('change', (e) => {
            this.manager.activeFilter.category = e.target.value;
            this.render();
        });

        this.filterPriority.addEventListener('change', (e) => {
            this.manager.activeFilter.priority = e.target.value;
            this.render();
        });

        this.sortTasks.addEventListener('change', (e) => {
            this.manager.activeSort = e.target.value;
            this.render();
        });

        // Category custom selector modal triggers
        this.taskCategorySelect.addEventListener('change', (e) => {
            if (e.target.value === 'Custom') {
                this.openCategoryModal();
                // Reset select back to personal until user completes
                this.taskCategorySelect.value = 'Personal';
            }
        });

        this.cancelCatBtn.addEventListener('click', () => {
            this.closeCategoryModal();
        });

        this.saveCatBtn.addEventListener('click', () => {
            const name = this.newCatInput.value.trim();
            if (!name) return;
            
            const success = this.manager.addCategory(name, this.selectedColor);
            if (success) {
                this.loadCategoriesSelect();
                // Select newly created category
                this.taskCategorySelect.value = name;
                this.closeCategoryModal();
                this.showToast(`Category "${name}" created`, 'success');
            } else {
                this.showToast('Category already exists', 'danger');
            }
        });

        // Category Modal Color Dots selection
        const colorDots = document.querySelectorAll('.color-dot');
        colorDots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                colorDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                this.selectedColor = dot.getAttribute('data-color');
            });
        });

        // Theme and Sound togglers
        this.themeToggle.addEventListener('click', () => {
            const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('focusflow_theme', nextTheme);
            this.updateThemeToggleIcon(nextTheme);
            this.sound.playClick();
        });

        this.soundToggle.addEventListener('click', () => {
            const enabled = this.sound.toggle();
            this.updateSoundToggleIcon(enabled);
            this.sound.playClick();
        });

        // Bulk operations
        this.clearCompletedBtn.addEventListener('click', () => {
            const cleared = this.manager.clearCompleted();
            if (cleared > 0) {
                this.showToast(`Cleared ${cleared} completed task(s)`, 'success');
                this.render();
            } else {
                this.showToast('No completed tasks to clear', 'warning');
            }
        });

        this.clearAllBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all tasks? This action cannot be undone.')) {
                this.manager.clearAll();
                this.showToast('All tasks cleared', 'danger');
                this.render();
            }
        });

        this.exportBtn.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.manager.tasks, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href",     dataStr);
            downloadAnchor.setAttribute("download", "focusflow_backup.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            this.showToast('Tasks backup exported', 'success');
        });

        this.importBtn.addEventListener('click', () => {
            this.importFileInput.click();
        });

        this.importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const importedTasks = JSON.parse(evt.target.result);
                    if (Array.isArray(importedTasks)) {
                        this.manager.tasks = importedTasks;
                        this.manager.saveTasks();
                        this.showToast('Tasks imported successfully', 'success');
                        this.render();
                    } else {
                        this.showToast('Invalid backup file format', 'danger');
                    }
                } catch (err) {
                    this.showToast('Error reading import file', 'danger');
                }
            };
            reader.readAsText(file);
        });

        // Edit Modal actions
        this.cancelEditBtn.addEventListener('click', () => {
            this.closeEditModal();
        });

        this.saveEditBtn.addEventListener('click', () => {
            const title = this.editTitleInput.value.trim();
            if (!title) return;
            
            const category = this.editCategorySelect.value;
            const priority = document.querySelector('input[name="editPriority"]:checked').value;
            const dueDate = this.editDueDate.value;
            const desc = this.editDescInput.value;
            
            this.manager.editTask(this.editingTaskId, {
                title,
                category,
                priority,
                dueDate: dueDate ? new Date(dueDate).toISOString() : '',
                description: desc
            });
            
            this.closeEditModal();
            this.showToast('Task updated', 'success');
            this.render();
        });

        // Pomodoro Actions
        const modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.timer.setMode(btn.getAttribute('data-mode'));
            });
        });

        this.timerStartBtn.addEventListener('click', () => {
            this.timer.start();
            this.timerStartBtn.classList.add('hidden');
            this.timerPauseBtn.classList.remove('hidden');
            this.timerPulseDot.classList.remove('hidden');
        });

        this.timerPauseBtn.addEventListener('click', () => {
            this.timer.pause();
            this.timerPauseBtn.classList.add('hidden');
            this.timerStartBtn.classList.remove('hidden');
            this.timerPulseDot.classList.add('hidden');
        });

        this.timerResetBtn.addEventListener('click', () => {
            this.timer.reset();
            this.timerPauseBtn.classList.add('hidden');
            this.timerStartBtn.classList.remove('hidden');
            this.timerPulseDot.classList.add('hidden');
        });

        // Drag & Drop events on list wrapper
        this.taskList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(this.taskList, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    this.taskList.appendChild(draggable);
                } else {
                    this.taskList.insertBefore(draggable, afterElement);
                }
            }
        });

        this.taskList.addEventListener('drop', () => {
            const listItems = [...this.taskList.querySelectorAll('.task-item')];
            const orderedIds = listItems.map(item => item.getAttribute('data-id'));
            
            // Only reorder if manual sorting is active, else let user drag but prompt them to switch
            if (this.manager.activeSort === 'Manual') {
                this.manager.reorderTasks(orderedIds);
            } else {
                this.showToast('Switch to "Sort: Drag & Drop" to save order', 'warning');
                this.render(); // Reset DOM back to correct sorting order
            }
        });

        if (this.recordDemoBtn) {
            this.recordDemoBtn.addEventListener('click', () => {
                this.startAutoDemo();
            });
        }
    }

    openCategoryModal() {
        this.customCatModal.classList.remove('hidden');
        this.newCatInput.value = '';
        this.newCatInput.focus();
    }

    closeCategoryModal() {
        this.customCatModal.classList.add('hidden');
    }

    openEditModal(task) {
        this.editingTaskId = task.id;
        this.editTitleInput.value = task.title;
        
        // Copy categories select contents dynamically
        this.editCategorySelect.innerHTML = this.taskCategorySelect.innerHTML;
        // Strip custom option since we only want to pick existing ones in edit modal
        const customOpt = this.editCategorySelect.querySelector('option[value="Custom"]');
        if (customOpt) customOpt.remove();
        
        this.editCategorySelect.value = task.category;
        
        // Set priority radios
        document.getElementById(`editPrio${task.priority}`).checked = true;
        
        // Set date
        if (task.dueDate) {
            // Convert ISO string back to local datetime picker string
            const localDate = new Date(task.dueDate);
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const hours = String(localDate.getHours()).padStart(2, '0');
            const minutes = String(localDate.getMinutes()).padStart(2, '0');
            this.editDueDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        } else {
            this.editDueDate.value = '';
        }
        
        this.editDescInput.value = task.description;
        
        this.editTaskModal.classList.remove('hidden');
        this.editTitleInput.focus();
    }

    closeEditModal() {
        this.editTaskModal.classList.add('hidden');
        this.editingTaskId = null;
    }

    loadCategoriesSelect() {
        // Load into Creator Select
        const defaultCategoriesHTML = this.manager.categories.map(cat => {
            let emoji = '🟢';
            if (cat.name === 'Work') emoji = '🔵';
            if (cat.name === 'Health') emoji = '🔴';
            if (cat.name === 'Finance') emoji = '🟡';
            if (cat.name !== 'Personal' && cat.name !== 'Work' && cat.name !== 'Health' && cat.name !== 'Finance') emoji = '⚙️';
            return `<option value="${cat.name}">${emoji} ${cat.name}</option>`;
        }).join('');
        
        this.taskCategorySelect.innerHTML = defaultCategoriesHTML + '<option value="Custom">+ Create custom...</option>';
        
        // Load into Filter Category Dropdown
        const filterCategoriesHTML = '<option value="All">All Categories</option>' + this.manager.categories.map(cat => {
            return `<option value="${cat.name}">${cat.name}</option>`;
        }).join('');
        
        this.filterCategory.innerHTML = filterCategoriesHTML;
        // Maintain selection
        this.filterCategory.value = this.manager.activeFilter.category;
    }

    renderGreetings() {
        const hour = new Date().getHours();
        let greet = 'Good morning, Achiever';
        if (hour >= 12 && hour < 17) greet = 'Good afternoon, Achiever';
        else if (hour >= 17 && hour < 22) greet = 'Good evening, Achiever';
        else if (hour >= 22 || hour < 5) greet = 'Make it a productive night';
        
        document.getElementById('greetingText').innerText = greet;
        
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', options);
    }

    // ==========================================================================
    // UI REFRESH & PROGRESS GAUGES
    // ==========================================================================
    render() {
        this.renderStats();
        this.renderTaskList();
        this.renderGreetings();
    }

    renderStats() {
        const total = this.manager.tasks.length;
        const completed = this.manager.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        
        const now = new Date();
        const overdue = this.manager.tasks.filter(t => {
            return !t.completed && t.dueDate && new Date(t.dueDate) < now;
        }).length;
        
        this.statTotal.innerText = total;
        this.statCompleted.innerText = completed;
        this.statPending.innerText = pending;
        this.statOverdue.innerText = overdue;
        
        // Circular Progress Ring calculation
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        this.progressPercentageText.innerText = percent;
        
        // radius is 40, circumference is 2 * PI * 40 = 251.2
        const circleLength = 2 * Math.PI * 40;
        this.progressCircle.style.strokeDasharray = `${circleLength} ${circleLength}`;
        
        const offset = circleLength - (percent / 100) * circleLength;
        this.progressCircle.style.strokeDashoffset = offset;
    }

    renderTaskList() {
        const filteredTasks = this.manager.getFilteredAndSortedTasks();
        this.taskList.innerHTML = '';
        
        if (filteredTasks.length === 0) {
            this.emptyState.classList.remove('hidden');
            return;
        }
        
        this.emptyState.classList.add('hidden');
        
        filteredTasks.forEach(task => {
            const taskItem = this.createTaskDomNode(task);
            this.taskList.appendChild(taskItem);
        });
    }

    createTaskDomNode(task) {
        const li = document.createElement('li');
        li.className = `task-item prio-${task.priority} ${task.completed ? 'completed' : ''}`;
        li.setAttribute('data-id', task.id);
        
        // Check manual sorting state for drag handle
        const isManualSort = this.manager.activeSort === 'Manual';
        li.setAttribute('draggable', isManualSort ? 'true' : 'false');

        // Drag start/end listeners
        li.addEventListener('dragstart', () => {
            li.classList.add('dragging');
        });
        
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
        });

        // Check if task is overdue
        const isOverdue = !task.completed && task.dueDate && new Date(task.dueDate) < new Date();
        
        // Date badge content
        let dateBadgeHTML = '';
        if (task.dueDate) {
            const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const formattedDate = new Date(task.dueDate).toLocaleDateString('en-US', options);
            dateBadgeHTML = `
                <div class="badge badge-date ${isOverdue ? 'overdue' : ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>${formattedDate}${isOverdue ? ' (Overdue)' : ''}</span>
                </div>
            `;
        }

        // Custom category coloring
        const catObj = this.manager.categories.find(c => c.name === task.category) || { color: 'var(--accent)' };

        li.innerHTML = `
            <div class="drag-handle tooltip ${isManualSort ? '' : 'hidden'}" data-tooltip="Drag to reorder">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </div>
            
            <label class="checkbox-container">
                <input type="checkbox" ${task.completed ? 'checked' : ''} class="task-checkbox-input">
                <span class="custom-checkbox">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
            </label>
            
            <div class="task-content">
                <div class="task-top-row">
                    <span class="task-title">${this.escapeHtml(task.title)}</span>
                </div>
                ${task.description ? `<p class="task-desc">${this.escapeHtml(task.description)}</p>` : ''}
                
                <div class="task-badges">
                    <span class="badge badge-category" style="background-color: ${catObj.color + '15'}; color: ${catObj.color}; border-color: ${catObj.color + '25'}">${task.category}</span>
                    <span class="badge badge-priority" style="background-color: var(--color-${task.priority.toLowerCase()}-bg); color: var(--color-${task.priority.toLowerCase()})">${task.priority} Priority</span>
                    ${dateBadgeHTML}
                </div>
            </div>
            
            <div class="task-actions">
                <button class="icon-btn focus-task-btn tooltip" data-tooltip="Focus in Pomodoro" aria-label="Bind to Pomodoro">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                </button>
                <button class="icon-btn edit-task-btn tooltip" data-tooltip="Edit task" aria-label="Edit task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="icon-btn delete-task-btn tooltip" data-tooltip="Delete task" aria-label="Delete task">
                    <svg class="text-danger" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        `;

        // Checkbox complete/active toggle listener
        const checkbox = li.querySelector('.task-checkbox-input');
        checkbox.addEventListener('change', () => {
            const updated = this.manager.toggleTask(task.id);
            if (updated) {
                if (updated.completed) {
                    this.sound.playSuccessChime();
                    this.confetti.spawn();
                    this.showToast('Task marked completed', 'success');
                } else {
                    this.sound.playClick();
                }
                this.render();
            }
        });

        // Edit button listener
        li.querySelector('.edit-task-btn').addEventListener('click', () => {
            this.openEditModal(task);
            this.sound.playClick();
        });

        // Delete button listener
        li.querySelector('.delete-task-btn').addEventListener('click', () => {
            const success = this.manager.deleteTask(task.id);
            if (success) {
                this.sound.playClick();
                this.showToast('Task deleted', 'danger', 'Undo', () => {
                    this.manager.restoreLastDeleted();
                    this.showToast('Task restored', 'success');
                    this.render();
                });
                
                // If it was the bound Pomodoro task, unbind it
                if (this.timer.boundTask && this.timer.boundTask.id === task.id) {
                    this.timer.unbindTask();
                    this.activeTaskTitle.innerText = 'No task selected for focus';
                }
                
                this.render();
            }
        });

        // Focus binder listener
        li.querySelector('.focus-task-btn').addEventListener('click', () => {
            this.timer.bindTask(task);
            this.activeTaskTitle.innerText = task.title;
            this.showToast(`Active task bound to Pomodoro focus space`, 'success');
            this.sound.playClick();
        });

        return li;
    }

    // ==========================================================================
    // TIMER UI INTERACTION
    // ==========================================================================
    updateTimerUI(secondsLeft, totalDuration) {
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        this.timerText.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Update circular ring
        // radius is 80, circumference is 2 * PI * 80 = 502.65
        const circleLength = 2 * Math.PI * 80;
        this.timerCircle.style.strokeDasharray = `${circleLength} ${circleLength}`;
        
        const offset = (secondsLeft / totalDuration) * circleLength;
        this.timerCircle.style.strokeDashoffset = circleLength - offset;
    }

    updateTimerModeUI(mode) {
        // Mode colors
        const colors = {
            pomodoro: '#8b5cf6', // Violet
            short: '#10b981',    // Emerald
            long: '#3b82f6'      // Blue
        };
        
        document.documentElement.style.setProperty('--timer-color', colors[mode]);
        this.timerPulseDot.className = 'pulse-dot hidden';
        this.timerStartBtn.classList.remove('hidden');
        this.timerPauseBtn.classList.add('hidden');
    }

    handleTimerComplete(mode, boundTask) {
        let msg = 'Focus session finished! Time for a break.';
        if (mode === 'short') msg = 'Short break finished. Let\'s get back to work!';
        if (mode === 'long') msg = 'Long break finished. Ready to focus again?';
        
        if (mode === 'pomodoro' && boundTask) {
            msg = `Focus session finished on: "${boundTask.title}"!`;
            // Add custom check or prompt to complete
            const confirmed = confirm(`${msg}\nWould you like to mark this task as completed?`);
            if (confirmed) {
                const updated = this.manager.toggleTask(boundTask.id);
                if (updated) {
                    this.sound.playSuccessChime();
                    this.confetti.spawn();
                    this.render();
                }
            }
        } else {
            this.showToast(msg, 'success');
        }
    }

    // ==========================================================================
    // TOAST NOTIFICATIONS & PRESETS
    // ==========================================================================
    showToast(message, type = 'success', actionText = '', actionCallback = null) {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">${message}</div>
            ${actionText ? `<button class="toast-action-btn">${actionText}</button>` : ''}
        `;
        
        if (actionText && actionCallback) {
            const actBtn = toast.querySelector('.toast-action-btn');
            actBtn.addEventListener('click', () => {
                actionCallback();
                toast.classList.add('toast-leave');
                setTimeout(() => toast.remove(), 300);
            });
        }
        
        toastContainer.appendChild(toast);
        
        // Auto remove toast
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-leave');
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    updateThemeToggleIcon(theme) {
        const sun = this.themeToggle.querySelector('.sun-icon');
        const moon = this.themeToggle.querySelector('.moon-icon');
        if (theme === 'dark') {
            sun.classList.remove('hidden');
            moon.classList.add('hidden');
        } else {
            sun.classList.add('hidden');
            moon.classList.remove('hidden');
        }
    }

    updateSoundToggleIcon(enabled) {
        if (enabled) {
            this.soundOnIcon.classList.remove('hidden');
            this.soundOffIcon.classList.add('hidden');
        } else {
            this.soundOnIcon.classList.add('hidden');
            this.soundOffIcon.classList.remove('hidden');
        }
    }

    // ==========================================================================
    // HELPER FUNCTIONS
    // ==========================================================================
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async startAutoDemo() {
        try {
            // 1. Prompt user context
            this.showToast('Please select "This Tab" in the following popup to record properly!', 'warning');
            
            // 2. Request tab capture
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "browser",
                    width: 1280,
                    height: 720,
                    frameRate: 30
                },
                audio: true
            });

            const chunks = [];
            
            // Check supported WebM codecs
            let options = { mimeType: 'video/webm;codecs=vp9' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm' };
            }
            
            const recorder = new MediaRecorder(stream, options);

            recorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'focusflow-live-demo.webm';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                
                // Stop all tracks in screen recording stream
                stream.getTracks().forEach(track => track.stop());
                
                this.showToast('Demo recording finished and downloaded as focusflow-live-demo.webm!', 'success');
            };

            // Start recording
            recorder.start();
            this.showToast('Recording started! Performing automated demo...', 'success');

            // Automation Timeline (Total ~18 seconds)
            
            // Step 1: Open details drawer and add a High Priority task
            setTimeout(() => {
                this.toggleDetailsBtn.click();
                this.taskTitleInput.value = '🥇 Complete Synent Task 5';
                this.taskDescInput.value = 'Deliver the world-class To-Do Web App project';
                // Set due date to today + 2 hours
                const date = new Date();
                date.setHours(date.getHours() + 2);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                this.taskDueDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                
                document.getElementById('prioHigh').checked = true;
            }, 1000);

            // Submit the first task
            setTimeout(() => {
                // Trigger form submit
                this.taskForm.requestSubmit();
            }, 3500);

            // Step 2: Add a second Low Priority task quickly
            setTimeout(() => {
                this.taskTitleInput.value = '☕ Take a short break';
                document.getElementById('prioLow').checked = true;
                this.taskForm.requestSubmit();
            }, 5500);

            // Step 3: Check/Complete the first task (Chime chime + Confetti explosion!)
            setTimeout(() => {
                const firstCheckbox = this.taskList.querySelector('.task-checkbox-input');
                if (firstCheckbox) {
                    firstCheckbox.click();
                }
            }, 8500);

            // Step 4: Toggle theme to Light Mode
            setTimeout(() => {
                this.themeToggle.click();
            }, 11500);

            // Step 5: Toggle theme back to Dark Mode
            setTimeout(() => {
                this.themeToggle.click();
            }, 13500);

            // Step 6: Bind the remaining task to Pomodoro Focus Space and start the timer
            setTimeout(() => {
                const focusBtn = this.taskList.querySelector('.focus-task-btn');
                if (focusBtn) focusBtn.click();
            }, 15000);

            setTimeout(() => {
                this.timerStartBtn.click();
            }, 16500);

            // Step 7: Finish recording
            setTimeout(() => {
                this.timerPauseBtn.click(); // Stop timer ticks
                recorder.stop();
            }, 18000);

        } catch (err) {
            console.error('Error starting demo capture:', err);
            this.showToast('Recording cancelled or failed', 'danger');
        }
    }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
