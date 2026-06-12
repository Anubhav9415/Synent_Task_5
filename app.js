/**
 * FocusFlow Task Management Engine - Core CRUD Logic
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
        this.activeSort = 'Created';
        
        this.init();
    }

    init() {
        const savedCategories = localStorage.getItem('focusflow_categories');
        if (savedCategories) {
            try {
                this.categories = JSON.parse(savedCategories);
            } catch (e) {
                console.error("Error parsing categories", e);
            }
        }

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
        let result = this.tasks.filter(task => {
            if (this.activeFilter.status === 'Active' && task.completed) return false;
            if (this.activeFilter.status === 'Completed' && !task.completed) return false;
            if (this.activeFilter.category !== 'All' && task.category !== this.activeFilter.category) return false;
            if (this.activeFilter.priority !== 'All' && task.priority !== this.activeFilter.priority) return false;
            
            if (this.activeFilter.query) {
                const q = this.activeFilter.query.toLowerCase();
                const titleMatch = task.title.toLowerCase().includes(q);
                const descMatch = task.description.toLowerCase().includes(q);
                if (!titleMatch && !descMatch) return false;
            }
            return true;
        });

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
// PLACEHOLDER SUBSYSTEM STUBS
// ==========================================================================
class SoundController {
    constructor() {
        this.enabled = false;
    }
    toggle() { return this.enabled; }
    playClick() {}
    playSuccessChime() {}
    playAlarm() {}
}

class ConfettiEngine {
    constructor() {}
    spawn() {}
}

class PomodoroTimer {
    constructor(soundController, onTick, onComplete, onModeChange) {
        this.sound = soundController;
        this.onTick = onTick;
        this.onComplete = onComplete;
        this.onModeChange = onModeChange;
        this.boundTask = null;
    }
    setMode(mode) { this.onModeChange(mode); }
    start() {}
    pause() {}
    reset() {}
    complete() {}
    bindTask(task) { this.boundTask = task; }
    unbindTask() { this.boundTask = null; }
}

// ==========================================================================
// APPLICATION CONTROLLER & UI RENDERER
// ==========================================================================
class AppController {
    constructor() {
        this.manager = new TaskManager();
        this.sound = new SoundController();
        this.confetti = new ConfettiEngine();
        
        this.render = this.render.bind(this);
        this.showToast = this.showToast.bind(this);
        
        this.timer = new PomodoroTimer(
            this.sound,
            (left, total) => this.updateTimerUI(left, total),
            (mode, task) => this.handleTimerComplete(mode, task),
            (mode) => this.updateTimerModeUI(mode)
        );

        this.editingTaskId = null;
        this.selectedColor = '#10b981';
        
        this.initDomElements();
        this.bindEvents();
        this.renderGreetings();
        this.loadCategoriesSelect();
        this.render();
    }

    initDomElements() {
        this.taskForm = document.getElementById('taskForm');
        this.taskTitleInput = document.getElementById('taskTitleInput');
        this.toggleDetailsBtn = document.getElementById('toggleDetailsBtn');
        this.detailsDrawer = document.getElementById('detailsDrawer');
        this.taskCategorySelect = document.getElementById('taskCategorySelect');
        this.taskDueDate = document.getElementById('taskDueDate');
        this.taskDescInput = document.getElementById('taskDescInput');
        
        this.searchInput = document.getElementById('searchInput');
        this.filterStatus = document.getElementById('filterStatus');
        this.filterCategory = document.getElementById('filterCategory');
        this.filterPriority = document.getElementById('filterPriority');
        this.sortTasks = document.getElementById('sortTasks');
        
        this.taskList = document.getElementById('taskList');
        this.emptyState = document.getElementById('emptyState');
        this.statTotal = document.getElementById('statTotal');
        this.statCompleted = document.getElementById('statCompleted');
        this.statPending = document.getElementById('statPending');
        this.statOverdue = document.getElementById('statOverdue');
        this.progressPercentageText = document.getElementById('progressPercentageText');
        this.progressCircle = document.getElementById('progressCircle');
        
        this.themeToggle = document.getElementById('themeToggle');
        this.soundToggle = document.getElementById('soundToggle');
        this.soundOnIcon = document.getElementById('soundOnIcon');
        this.soundOffIcon = document.getElementById('soundOffIcon');
        
        this.clearCompletedBtn = document.getElementById('clearCompletedBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.importFileInput = document.getElementById('importFileInput');
        
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
        
        this.timerText = document.getElementById('timerText');
        this.timerCircle = document.getElementById('timerCircle');
        this.activeTaskTitle = document.getElementById('activeTaskTitle');
        this.timerStartBtn = document.getElementById('timerStartBtn');
        this.timerPauseBtn = document.getElementById('timerPauseBtn');
        this.timerResetBtn = document.getElementById('timerResetBtn');
        this.timerPulseDot = document.getElementById('timerPulseDot');
        
        const currentTheme = localStorage.getItem('focusflow_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        this.updateThemeToggleIcon(currentTheme);
    }

    bindEvents() {
        this.toggleDetailsBtn.addEventListener('click', () => {
            this.detailsDrawer.classList.toggle('hidden');
        });

        this.taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = this.taskTitleInput.value.trim();
            if (!title) return;
            
            const desc = this.taskDescInput.value;
            const category = this.taskCategorySelect.value;
            const priority = document.querySelector('input[name="priority"]:checked').value;
            const dueDate = this.taskDueDate.value;
            
            this.manager.addTask(title, desc, category, priority, dueDate);
            
            this.taskTitleInput.value = '';
            this.taskDescInput.value = '';
            this.taskDueDate.value = '';
            document.getElementById('prioLow').checked = true;
            this.detailsDrawer.classList.add('hidden');
            
            this.showToast('Task added successfully', 'success');
            this.render();
        });

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

        this.taskCategorySelect.addEventListener('change', (e) => {
            if (e.target.value === 'Custom') {
                this.openCategoryModal();
                this.taskCategorySelect.value = 'Personal';
            }
        });

        this.cancelCatBtn.addEventListener('click', () => this.closeCategoryModal());
        this.saveCatBtn.addEventListener('click', () => {
            const name = this.newCatInput.value.trim();
            if (!name) return;
            const success = this.manager.addCategory(name, this.selectedColor);
            if (success) {
                this.loadCategoriesSelect();
                this.taskCategorySelect.value = name;
                this.closeCategoryModal();
            }
        });

        const colorDots = document.querySelectorAll('.color-dot');
        colorDots.forEach(dot => {
            dot.addEventListener('click', () => {
                colorDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                this.selectedColor = dot.getAttribute('data-color');
            });
        });

        this.themeToggle.addEventListener('click', () => {
            const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('focusflow_theme', nextTheme);
            this.updateThemeToggleIcon(nextTheme);
        });

        this.clearCompletedBtn.addEventListener('click', () => {
            this.manager.clearCompleted();
            this.render();
        });

        this.clearAllBtn.addEventListener('click', () => {
            if (confirm('Clear all tasks?')) {
                this.manager.clearAll();
                this.render();
            }
        });

        this.exportBtn.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.manager.tasks, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "focusflow_backup.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        });

        this.importBtn.addEventListener('click', () => this.importFileInput.click());
        this.importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    this.manager.tasks = JSON.parse(evt.target.result);
                    this.manager.saveTasks();
                    this.render();
                } catch (err) {}
            };
            reader.readAsText(file);
        });

        this.cancelEditBtn.addEventListener('click', () => this.closeEditModal());
        this.saveEditBtn.addEventListener('click', () => {
            const title = this.editTitleInput.value.trim();
            if (!title) return;
            this.manager.editTask(this.editingTaskId, {
                title,
                category: this.editCategorySelect.value,
                priority: document.querySelector('input[name="editPriority"]:checked').value,
                dueDate: this.editDueDate.value ? new Date(this.editDueDate.value).toISOString() : '',
                description: this.editDescInput.value
            });
            this.closeEditModal();
            this.render();
        });

        this.taskList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(this.taskList, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) this.taskList.appendChild(draggable);
                else this.taskList.insertBefore(draggable, afterElement);
            }
        });

        this.taskList.addEventListener('drop', () => {
            const listItems = [...this.taskList.querySelectorAll('.task-item')];
            const orderedIds = listItems.map(item => item.getAttribute('data-id'));
            if (this.manager.activeSort === 'Manual') {
                this.manager.reorderTasks(orderedIds);
            } else {
                this.render();
            }
        });
    }

    openCategoryModal() {
        this.customCatModal.classList.remove('hidden');
        this.newCatInput.value = '';
    }

    closeCategoryModal() { this.customCatModal.classList.add('hidden'); }

    openEditModal(task) {
        this.editingTaskId = task.id;
        this.editTitleInput.value = task.title;
        this.editCategorySelect.innerHTML = this.taskCategorySelect.innerHTML;
        const customOpt = this.editCategorySelect.querySelector('option[value="Custom"]');
        if (customOpt) customOpt.remove();
        this.editCategorySelect.value = task.category;
        document.getElementById(`editPrio${task.priority}`).checked = true;
        
        if (task.dueDate) {
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
    }

    closeEditModal() {
        this.editTaskModal.classList.add('hidden');
        this.editingTaskId = null;
    }

    loadCategoriesSelect() {
        const defaultCategoriesHTML = this.manager.categories.map(cat => {
            let emoji = '🟢';
            if (cat.name === 'Work') emoji = '🔵';
            if (cat.name === 'Health') emoji = '🔴';
            if (cat.name === 'Finance') emoji = '🟡';
            if (cat.name !== 'Personal' && cat.name !== 'Work' && cat.name !== 'Health' && cat.name !== 'Finance') emoji = '⚙️';
            return `<option value="${cat.name}">${emoji} ${cat.name}</option>`;
        }).join('');
        this.taskCategorySelect.innerHTML = defaultCategoriesHTML + '<option value="Custom">+ Create custom...</option>';
        const filterCategoriesHTML = '<option value="All">All Categories</option>' + this.manager.categories.map(cat => {
            return `<option value="${cat.name}">${cat.name}</option>`;
        }).join('');
        this.filterCategory.innerHTML = filterCategoriesHTML;
    }

    renderGreetings() {
        document.getElementById('greetingText').innerText = 'FocusFlow Workspace';
        document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US');
    }

    render() {
        this.renderStats();
        this.renderTaskList();
    }

    renderStats() {
        const total = this.manager.tasks.length;
        const completed = this.manager.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const overdue = this.manager.tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date()).length;
        
        this.statTotal.innerText = total;
        this.statCompleted.innerText = completed;
        this.statPending.innerText = pending;
        this.statOverdue.innerText = overdue;
        
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        this.progressPercentageText.innerText = percent;
        
        const circleLength = 2 * Math.PI * 40;
        this.progressCircle.style.strokeDasharray = `${circleLength} ${circleLength}`;
        this.progressCircle.style.strokeDashoffset = circleLength - (percent / 100) * circleLength;
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
            this.taskList.appendChild(this.createTaskDomNode(task));
        });
    }

    createTaskDomNode(task) {
        const li = document.createElement('li');
        li.className = `task-item prio-${task.priority} ${task.completed ? 'completed' : ''}`;
        li.setAttribute('data-id', task.id);
        const isManualSort = this.manager.activeSort === 'Manual';
        li.setAttribute('draggable', isManualSort ? 'true' : 'false');
        
        li.addEventListener('dragstart', () => li.classList.add('dragging'));
        li.addEventListener('dragend', () => li.classList.remove('dragging'));

        li.innerHTML = `
            <div class="drag-handle ${isManualSort ? '' : 'hidden'}">⠿</div>
            <label class="checkbox-container">
                <input type="checkbox" ${task.completed ? 'checked' : ''} class="task-checkbox-input">
                <span class="custom-checkbox">✓</span>
            </label>
            <div class="task-content">
                <span class="task-title">${this.escapeHtml(task.title)}</span>
                ${task.description ? `<p class="task-desc">${this.escapeHtml(task.description)}</p>` : ''}
            </div>
            <div class="task-actions">
                <button class="icon-btn edit-task-btn">✏️</button>
                <button class="icon-btn delete-task-btn">🗑️</button>
            </div>
        `;

        li.querySelector('.task-checkbox-input').addEventListener('change', () => {
            this.manager.toggleTask(task.id);
            this.render();
        });

        li.querySelector('.edit-task-btn').addEventListener('click', () => {
            this.openEditModal(task);
        });

        li.querySelector('.delete-task-btn').addEventListener('click', () => {
            this.manager.deleteTask(task.id);
            this.showToast('Task deleted', 'danger', 'Undo', () => {
                this.manager.restoreLastDeleted();
                this.render();
            });
            this.render();
        });

        return li;
    }

    updateTimerUI() {}
    updateTimerModeUI() {}
    handleTimerComplete() {}

    showToast(message, type = 'success', actionText = '', actionCallback = null) {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">${message}</div>
            ${actionText ? `<button class="toast-action-btn">${actionText}</button>` : ''}
        `;
        if (actionText && actionCallback) {
            toast.querySelector('.toast-action-btn').addEventListener('click', () => {
                actionCallback();
                toast.remove();
            });
        }
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    updateThemeToggleIcon(theme) {
        const sun = this.themeToggle.querySelector('.sun-icon');
        const moon = this.themeToggle.querySelector('.moon-icon');
        if (theme === 'dark') {
            if (sun) sun.classList.remove('hidden');
            if (moon) moon.classList.add('hidden');
        } else {
            if (sun) sun.classList.add('hidden');
            if (moon) moon.classList.remove('hidden');
        }
    }

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
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
