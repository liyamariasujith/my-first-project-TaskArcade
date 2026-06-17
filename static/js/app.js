// State variables
let allUsers = [];
let currentUser = null;
let habits = [];
let completions = [];
let activeTab = 'dashboard';
let currentBoardCategory = 'All';
let pendingDiamonds = 0;
let pendingFreezes = 0;
let breakTimeRemaining = 600; // 10 minutes default break time
let breakTimerInterval = null;
let gamesListenersInitialized = false;

// Constants
const TODAY_DATE = '2026-06-16'; // Aligned with metadata current time

// Chart instances
let categoryChartInstance = null;
let trendChartInstance = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Set Header Date
    const headerDateEl = document.getElementById('header-date');
    if (headerDateEl) {
        const parsedDate = new Date(TODAY_DATE);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        headerDateEl.textContent = parsedDate.toLocaleDateString('en-US', options);
    }
    
    // Load Users
    fetchUsers();
}

function setupEventListeners() {
    // Tab switching
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const tabName = btn.getAttribute('data-tab');
            
            navItems.forEach(n => n.classList.remove('active'));
            btn.classList.add('active');
            
            switchTab(tabName);
        });
    });
    
    // User Switcher dropdown toggle
    const userCard = document.getElementById('current-user-card');
    const userDropdown = document.getElementById('user-switcher-dropdown');
    
    userCard.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
        const icon = userCard.querySelector('.toggle-dropdown-icon');
        if (userDropdown.classList.contains('hidden')) {
            icon.style.transform = 'rotate(0deg)';
        } else {
            icon.style.transform = 'rotate(180deg)';
        }
    });
    
    // Close dropdown on click outside
    document.addEventListener('click', () => {
        if (userDropdown && !userDropdown.classList.contains('hidden')) {
            userDropdown.classList.add('hidden');
            const icon = userCard.querySelector('.toggle-dropdown-icon');
            icon.style.transform = 'rotate(0deg)';
        }
    });
    
    // Add Habit Form submission
    const addHabitForm = document.getElementById('add-habit-form');
    if (addHabitForm) {
        addHabitForm.addEventListener('submit', (e) => {
            e.preventDefault();
            createNewHabit();
        });
    }
    
    // Habit Board Category filters
    const filterButtons = document.querySelectorAll('#board-category-filters .filter-btn');
    if (filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                currentBoardCategory = e.currentTarget.getAttribute('data-category');
                renderHabitBoard();
            });
        });
    }
    
    // Collapsible Time blocks (Morning/Afternoon/Evening Accordion Buttons)
    const blockHeaders = document.querySelectorAll('.time-block-header');
    if (blockHeaders.length > 0) {
        blockHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const block = e.currentTarget.closest('.collapsible-block');
                block.classList.toggle('collapsed');
                
                const arrow = block.querySelector('.expand-arrow');
                if (arrow) {
                    if (block.classList.contains('collapsed')) {
                        arrow.style.transform = 'rotate(-90deg)';
                    } else {
                        arrow.style.transform = 'rotate(0deg)';
                    }
                }
            });
        });
    }
    
    // Reward modal claim button
    const claimBtn = document.getElementById('btn-claim-reward');
    if (claimBtn) {
        claimBtn.addEventListener('click', () => {
            claimPendingReward();
        });
    }
    
    // Initialize Games listeners once
    initGamesSectionListeners();
}

function switchTab(tabName) {
    activeTab = tabName;
    
    // Hide all views
    const views = document.querySelectorAll('.content-view');
    views.forEach(view => {
        view.classList.remove('active');
    });
    
    // Show selected view
    const activeView = document.getElementById(`${tabName}-view`);
    if (activeView) {
        activeView.classList.add('active');
    }
    
    // Tab-specific rendering refresh
    if (tabName === 'calendar') {
        pauseBreakTimer();
        renderHabitBoard();
    } else if (tabName === 'insights') {
        pauseBreakTimer();
        renderInsights();
    } else if (tabName === 'challenges') {
        pauseBreakTimer();
        renderChallenges();
    } else if (tabName === 'profile') {
        pauseBreakTimer();
        renderProfile();
    } else if (tabName === 'games') {
        startBreakTimer();
        initGamesSection();
    } else {
        pauseBreakTimer();
    }
}

// -----------------------------------------------------------------------------
// API FETCH CALLS
// -----------------------------------------------------------------------------

function fetchUsers() {
    fetch('/api/users')
        .then(res => res.json())
        .then(data => {
            allUsers = data;
            populateUserSwitcherDropdown();
            // Default User: Liam Carter (id: 1)
            const defaultUser = allUsers.find(u => u.id === '1') || allUsers[0];
            setCurrentUser(defaultUser);
        })
        .catch(err => console.error('Error fetching users:', err));
}

function loadUserData() {
    if (!currentUser) return;
    
    // Fetch habits and completions in parallel
    Promise.all([
        fetch(`/api/habits/${currentUser.id}`).then(res => res.json()),
        fetch(`/api/completions/${currentUser.id}`).then(res => res.json())
    ])
    .then(([habitsData, completionsData]) => {
        habits = habitsData;
        completions = completionsData;
        
        // Refresh Current View
        updateGlobalHeaderStats();
        renderTodayDashboard();
        
        if (activeTab === 'calendar') {
            renderHabitBoard();
        } else if (activeTab === 'insights') {
            renderInsights();
        } else if (activeTab === 'challenges') {
            renderChallenges();
        } else if (activeTab === 'profile') {
            renderProfile();
        }
    })
    .catch(err => console.error('Error loading user data:', err));
}

// -----------------------------------------------------------------------------
// USER SWITCHER RENDER
// -----------------------------------------------------------------------------

function populateUserSwitcherDropdown() {
    const list = document.getElementById('users-dropdown-list');
    if (!list) return;
    
    list.innerHTML = '';
    allUsers.forEach(user => {
        const li = document.createElement('li');
        li.className = 'user-list-item';
        if (currentUser && currentUser.id === user.id) {
            li.classList.add('selected');
        }
        
        li.innerHTML = `
            <span class="user-avatar">${user.avatar}</span>
            <div class="user-info">
                <span class="user-name">${user.name}</span>
                <span class="user-role">@${user.username}</span>
            </div>
        `;
        
        li.addEventListener('click', () => {
            setCurrentUser(user);
        });
        
        list.appendChild(li);
    });
}

function setCurrentUser(user) {
    currentUser = user;
    
    // Update active visual card in sidebar
    document.getElementById('current-user-avatar').textContent = user.avatar;
    document.getElementById('current-user-name').textContent = user.name;
    
    // Update welcome header text
    document.getElementById('welcome-text').textContent = `Hello, ${user.name.split(' ')[0]}!`;
    
    // Update diamonds & freezes badge counts in header welcome
    const dCount = document.getElementById('header-user-diamonds');
    const fCount = document.getElementById('header-user-freezes');
    if (dCount) dCount.textContent = user.diamonds || 0;
    if (fCount) fCount.textContent = user.streak_freezes || 0;
    
    // Update selected checkmark class in list
    populateUserSwitcherDropdown();
    
    // Fetch habits & completions for new user
    loadUserData();
}

function updateGlobalHeaderStats() {
    const todayHabits = habits; // all habits are daily for now
    if (todayHabits.length === 0) {
        document.getElementById('today-progress-percent').textContent = '0%';
        document.getElementById('today-progress-bar').style.width = '0%';
        return;
    }
    
    const completedToday = completions.filter(c => c.date === TODAY_DATE && c.status === 'Completed').length;
    const rate = Math.round((completedToday / todayHabits.length) * 100);
    
    document.getElementById('today-progress-percent').textContent = `${rate}%`;
    document.getElementById('today-progress-bar').style.width = `${rate}%`;
}

// -----------------------------------------------------------------------------
// TODAY VIEW / DASHBOARD RENDERING & INTERACTIONS
// -----------------------------------------------------------------------------

function renderTodayDashboard() {
    const morningList = document.getElementById('morning-habit-list');
    const afternoonList = document.getElementById('afternoon-habit-list');
    const eveningList = document.getElementById('evening-habit-list');
    
    morningList.innerHTML = '';
    afternoonList.innerHTML = '';
    eveningList.innerHTML = '';
    
    let totalHabits = habits.length;
    let completedCount = 0;
    
    habits.forEach(habit => {
        const isCompleted = completions.some(c => c.habit_id === habit.id && c.date === TODAY_DATE && c.status === 'Completed');
        if (isCompleted) completedCount++;
        
        const card = document.createElement('div');
        card.className = `habit-card ${isCompleted ? 'completed' : ''}`;
        card.setAttribute('data-id', habit.id);
        
        card.innerHTML = `
            <div class="habit-checkbox">
                <i class="fa-solid fa-check"></i>
            </div>
            <div class="habit-details">
                <div class="habit-name">${habit.name}</div>
                <div class="habit-meta">
                    <span class="habit-category">${habit.category}</span>
                    <span class="habit-streak">${(parseInt(habit.streak) || 0) > 0 ? '🔥 ' + habit.streak + 'd streak' : '💤 0d streak'}</span>
                </div>
            </div>
            <div class="habit-actions">
                <button class="btn-delete-habit" title="Delete Habit">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        
        // Checkbox click toggle
        card.querySelector('.habit-checkbox').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHabitCompletion(habit.id, TODAY_DATE);
        });
        
        // Delete button click
        card.querySelector('.btn-delete-habit').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete habit "${habit.name}"?`)) {
                deleteHabit(habit.id);
            }
        });
        
        // Append to time block (normalized case-insensitive check)
        const timeOfDayNormalized = (habit.time_of_day || '').trim().toLowerCase();
        if (timeOfDayNormalized === 'morning') {
            morningList.appendChild(card);
        } else if (timeOfDayNormalized === 'afternoon') {
            afternoonList.appendChild(card);
        } else if (timeOfDayNormalized === 'evening') {
            eveningList.appendChild(card);
        } else {
            // Default fallback
            eveningList.appendChild(card);
        }
    });
    
    // Check if lists are empty
    checkEmptyBlock(morningList, '🌅 No morning habits scheduled.');
    checkEmptyBlock(afternoonList, '☀️ No afternoon habits scheduled.');
    checkEmptyBlock(eveningList, '🌙 No evening habits scheduled.');
    
    // Update widget completion wheel
    updateCompletionWheel(completedCount, totalHabits);
}

function checkEmptyBlock(listEl, message) {
    if (listEl.children.length === 0) {
        listEl.innerHTML = `<div class="empty-state-text" style="color: var(--text-muted); font-size:13px; font-style:italic; padding: 12px 20px;">${message}</div>`;
    }
}

function updateCompletionWheel(completed, total) {
    const ring = document.getElementById('completion-wheel-ring');
    const text = document.getElementById('completion-wheel-text');
    
    text.textContent = `${completed}/${total}`;
    
    if (total === 0) {
        ring.style.strokeDashoffset = '251.2';
        return;
    }
    
    const percentage = completed / total;
    // Stroke dashoffset: circumference (2 * pi * r) = 2 * 3.14159 * 40 = 251.2
    const offset = 251.2 - (percentage * 251.2);
    ring.style.strokeDashoffset = offset;
}

function toggleHabitCompletion(habitId, dateStr) {
    fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            habit_id: habitId,
            date: dateStr
        })
    })
    .then(res => res.json())
    .then(data => {
        // If completed today, trigger treasure chest roll
        if (data.status === 'Completed' && dateStr === TODAY_DATE) {
            triggerChestRoll();
        }
        // Reload habits & completions
        loadUserData();
    })
    .catch(err => console.error('Error toggling completion:', err));
}

function createNewHabit() {
    const nameInput = document.getElementById('habit-name');
    const categoryInput = document.getElementById('habit-category');
    const timeSelect = document.getElementById('habit-time');
    
    const name = nameInput.value;
    const category = categoryInput.value;
    const time = timeSelect.value;
    
    fetch('/api/habits/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            name: name,
            category: category,
            time_of_day: time
        })
    })
    .then(res => res.json())
    .then(data => {
        // Clear inputs
        nameInput.value = '';
        categoryInput.value = '';
        
        // Force-expand the category block where this habit was added
        const blockId = `${time.toLowerCase()}-block`;
        const block = document.getElementById(blockId);
        if (block && block.classList.contains('collapsed')) {
            block.classList.remove('collapsed');
            const arrow = block.querySelector('.expand-arrow');
            if (arrow) {
                arrow.style.transform = 'rotate(0deg)';
            }
        }
        
        // Reload lists
        loadUserData();
    })
    .catch(err => console.error('Error creating habit:', err));
}

function deleteHabit(habitId) {
    fetch('/api/habits/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit_id: habitId })
    })
    .then(res => res.json())
    .then(data => {
        loadUserData();
    })
    .catch(err => console.error('Error deleting habit:', err));
}

// -----------------------------------------------------------------------------
// CALENDAR VIEW RENDERING & INTERACTIONS
// -----------------------------------------------------------------------------

function getPast7Days() {
    const list = [];
    const today = new Date(TODAY_DATE);
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        list.push(`${yyyy}-${mm}-${dd}`);
    }
    return list;
}

function renderHabitBoard() {
    const table = document.getElementById('weekly-board-table');
    if (!table) return;
    
    table.innerHTML = '';
    
    const dates = getPast7Days();
    
    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Habit & Category</th>';
    
    dates.forEach(dateStr => {
        const d = new Date(dateStr);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = d.getDate();
        headerRow.innerHTML += `<th style="text-align: center;">${dayName} ${dayNum}</th>`;
    });
    
    table.appendChild(headerRow);
    
    // Filter habits by category for Habit Board
    let filteredHabits = habits;
    if (currentBoardCategory !== 'All') {
        filteredHabits = habits.filter(h => (h.category || '').trim().toLowerCase() === currentBoardCategory.toLowerCase());
    }
    
    // Create habit rows
    if (filteredHabits.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No habits found in this category.</td>`;
        table.appendChild(row);
    } else {
        filteredHabits.forEach(habit => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="board-habit-title">
                        <span class="board-habit-name">${habit.name}</span>
                        <span class="board-habit-category">${habit.category}</span>
                    </div>
                </td>
            `;
            
            dates.forEach(dateStr => {
                const isCompleted = completions.some(c => c.habit_id === habit.id && c.date === dateStr && c.status === 'Completed');
                const td = document.createElement('td');
                td.className = 'day-bubble-cell';
                
                const isToday = dateStr === TODAY_DATE;
                const bubble = document.createElement('div');
                bubble.className = `day-bubble ${isToday ? '' : 'read-only'} ${isCompleted ? 'completed' : ''}`;
                bubble.innerHTML = isCompleted ? '<i class="fa-solid fa-check"></i>' : '';
                bubble.title = `${habit.name} - ${dateStr}${isToday ? '' : ' (Read-only)'}`;
                
                if (isToday) {
                    bubble.addEventListener('click', () => {
                        toggleHabitCompletion(habit.id, dateStr);
                    });
                }
                
                td.appendChild(bubble);
                row.appendChild(td);
            });
            
            table.appendChild(row);
        });
    }
    
    renderHeatmap();
}

function getPast30Days() {
    const list = [];
    const today = new Date(TODAY_DATE);
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        list.push(`${yyyy}-${mm}-${dd}`);
    }
    return list;
}

function renderHeatmap() {
    const grid = document.getElementById('month-heatmap-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const dates = getPast30Days();
    const totalHabits = habits.length;
    
    dates.forEach(dateStr => {
        // Count completions for this day
        const completionsCount = completions.filter(c => c.date === dateStr && c.status === 'Completed').length;
        
        // Rate level: 0 to 4
        let level = 0;
        if (totalHabits > 0) {
            const rate = completionsCount / totalHabits;
            if (rate > 0.75) level = 4;
            else if (rate > 0.50) level = 3;
            else if (rate > 0.25) level = 2;
            else if (rate > 0) level = 1;
        }
        
        const dayCell = document.createElement('div');
        dayCell.className = `heatmap-day level-${level}`;
        
        const d = new Date(dateStr);
        const dayNum = d.getDate();
        dayCell.textContent = dayNum;
        
        // Tooltip description
        dayCell.title = `${dateStr}: ${completionsCount} of ${totalHabits} habits completed (${totalHabits > 0 ? Math.round((completionsCount/totalHabits)*100) : 0}%)`;
        
        grid.appendChild(dayCell);
    });
}

// -----------------------------------------------------------------------------
// INSIGHTS & ANALYTICS VIEW
// -----------------------------------------------------------------------------

function renderInsights() {
    // 1. Fill Statistics Cards
    const totalCompsVal = completions.filter(c => c.status === 'Completed').length;
    document.getElementById('analytics-total-completions').textContent = totalCompsVal;
    
    const bestStreakVal = habits.length > 0 ? Math.max(...habits.map(h => parseInt(h.streak_milestone) || 0)) : 0;
    document.getElementById('analytics-best-streak').textContent = bestStreakVal;
    
    document.getElementById('analytics-active-habits').textContent = habits.length;
    
    // Weekly rate
    const dates7 = getPast7Days();
    let completionsInPast7 = 0;
    let totalTargetCompletions = habits.length * 7;
    
    dates7.forEach(dateStr => {
        completionsInPast7 += completions.filter(c => c.date === dateStr && c.status === 'Completed').length;
    });
    
    const weeklyRate = totalTargetCompletions > 0 ? Math.round((completionsInPast7 / totalTargetCompletions) * 100) : 0;
    document.getElementById('analytics-weekly-rate').textContent = `${weeklyRate}%`;
    
    // 2. Render Charts using Chart.js
    renderCategoryChart();
    renderTrendChart();
}

function renderCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    
    // Group habits by category
    const categoriesCount = {};
    habits.forEach(h => {
        categoriesCount[h.category] = (categoriesCount[h.category] || 0) + 1;
    });
    
    const labels = Object.keys(categoriesCount);
    const dataVals = Object.values(categoriesCount);
    
    // Destroy previous instance
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }
    
    if (labels.length === 0) {
        // Draw empty indicator
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#64748B';
        ctx.font = '14px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('No habits data available. Create habits first.', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    categoryChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataVals,
                backgroundColor: [
                    '#6366F1', // Indigo
                    '#8B5CF6', // Violet
                    '#10B981', // Emerald
                    '#F59E0B', // Amber
                    '#3B82F6', // Blue
                    '#EF4444'  // Red
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#F8FAFC',
                        font: { family: 'Outfit', size: 12 }
                    }
                }
            }
        }
    });
}

function renderTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    
    const dates = getPast7Days();
    const trendData = dates.map(dateStr => {
        return completions.filter(c => c.date === dateStr && c.status === 'Completed').length;
    });
    
    const displayLabels = dates.map(dStr => {
        const parts = dStr.split('-');
        return `${parts[1]}/${parts[2]}`; // MM/DD format
    });
    
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }
    
    trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Habits Completed',
                data: trendData,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3,
                borderWidth: 3,
                pointBackgroundColor: '#34D399'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94A3B8', font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { 
                        color: '#94A3B8', 
                        font: { family: 'Outfit' },
                        stepSize: 1,
                        beginAtZero: true
                    }
                }
            }
        }
    });
}

// -----------------------------------------------------------------------------
// CHALLENGES VIEW RENDERING & INTERACTIONS
// -----------------------------------------------------------------------------

function renderChallenges() {
    // Fetch challenges and user joined list parallelly
    Promise.all([
        fetch('/api/challenges').then(res => res.json()),
        fetch(`/api/challenges/user/${currentUser.id}`).then(res => res.json()),
        fetch('/api/leaderboard').then(res => res.json())
    ])
    .then(([challengesList, joinedList, leaderboardData]) => {
        renderChallengesGrid(challengesList, joinedList);
        renderLeaderboard(leaderboardData);
    })
    .catch(err => console.error('Error rendering challenges tab:', err));
}

function renderChallengesGrid(challengesList, joinedList) {
    const grid = document.getElementById('challenges-list-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    challengesList.forEach(challenge => {
        const isJoined = joinedList.includes(challenge.id);
        const card = document.createElement('div');
        card.className = 'challenge-card';
        
        let badgeClass = 'badge-blue';
        if (challenge.category === 'Mind') badgeClass = 'badge-purple';
        else if (challenge.category === 'Career') badgeClass = 'badge-green';
        else if (challenge.category === 'Creative') badgeClass = 'badge-orange';
        
        card.innerHTML = `
            <div class="challenge-info">
                <div class="challenge-badge-row">
                    <span class="challenge-badge ${badgeClass}">${challenge.category}</span>
                </div>
                <h3>${challenge.title}</h3>
                <p class="challenge-desc">${challenge.description}</p>
                <div class="challenge-meta-data">
                    <span><i class="fa-solid fa-users"></i> <strong id="participant-count-${challenge.id}">${challenge.participants_count}</strong> joined</span>
                    <span><i class="fa-solid fa-clock"></i> ${challenge.duration}</span>
                </div>
            </div>
            <button class="btn-join ${isJoined ? 'joined' : ''}" data-id="${challenge.id}">
                ${isJoined ? 'Joined' : 'Join'}
            </button>
        `;
        
        card.querySelector('.btn-join').addEventListener('click', (e) => {
            toggleChallengeJoin(challenge.id, e.target);
        });
        
        grid.appendChild(card);
    });
}

function toggleChallengeJoin(challengeId, buttonEl) {
    fetch('/api/challenges/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            challenge_id: challengeId
        })
    })
    .then(res => res.json())
    .then(data => {
        // Toggle joined button visual state
        if (data.joined) {
            buttonEl.classList.add('joined');
            buttonEl.textContent = 'Joined';
        } else {
            buttonEl.classList.remove('joined');
            buttonEl.textContent = 'Join';
        }
        
        // Update participant count
        const countSpan = document.getElementById(`participant-count-${challengeId}`);
        if (countSpan) {
            countSpan.textContent = data.participants_count;
        }
        
        // Reload leaderboard ranking since user count might change
        fetch('/api/leaderboard')
            .then(res => res.json())
            .then(leaderboardData => renderLeaderboard(leaderboardData));
    })
    .catch(err => console.error('Error toggling challenge join:', err));
}

function renderLeaderboard(leaderboardData) {
    const list = document.getElementById('leaderboard-ranking-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    leaderboardData.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'leaderboard-item';
        
        li.innerHTML = `
            <span class="leaderboard-rank">${index + 1}</span>
            <span class="leaderboard-avatar">${item.avatar}</span>
            <div class="leaderboard-details">
                <span class="leaderboard-name">${item.name}</span>
            </div>
            <span class="leaderboard-count">${item.completions_count} checks</span>
        `;
        
        list.appendChild(li);
    });
}

// -----------------------------------------------------------------------------
// USER PROFILE VIEW
// -----------------------------------------------------------------------------

function renderProfile() {
    if (!currentUser) return;
    
    document.getElementById('profile-avatar').textContent = currentUser.avatar;
    document.getElementById('profile-full-name').textContent = currentUser.name;
    document.getElementById('profile-username-tag').textContent = `@${currentUser.username}`;
    document.getElementById('profile-bio-text').textContent = currentUser.bio;
    
    // Evaluate milestone achievements / achievements
    renderProfileBadges();
}

function renderProfileBadges() {
    const badgesGrid = document.getElementById('profile-badges-grid');
    if (!badgesGrid) return;
    
    badgesGrid.innerHTML = '';
    
    // Badges definitions
    const totalCompsCount = completions.filter(c => c.status === 'Completed').length;
    const bestStreak = habits.length > 0 ? Math.max(...habits.map(h => parseInt(h.streak_milestone) || 0)) : 0;
    
    const badgesList = [
        {
            title: 'First Step',
            desc: 'Completed at least 1 habit check-in.',
            icon: '🌱',
            unlocked: totalCompsCount >= 1
        },
        {
            title: 'Habit Disciple',
            desc: 'Completed 15 habit check-ins.',
            icon: '🧘‍♂️',
            unlocked: totalCompsCount >= 15
        },
        {
            title: 'Consistency King',
            desc: 'Completed 30 habit check-ins.',
            icon: '👑',
            unlocked: totalCompsCount >= 30
        },
        {
            title: 'Fire Starter',
            desc: 'Achieved a streak of 5 consecutive days.',
            icon: '🔥',
            unlocked: bestStreak >= 5
        },
        {
            title: 'Unstoppable Force',
            desc: 'Achieved a streak of 15 consecutive days.',
            icon: '⚡',
            unlocked: bestStreak >= 15
        },
        {
            title: 'Community Leader',
            desc: 'Created at least 3 custom habits.',
            icon: '🤝',
            unlocked: habits.length >= 3
        }
    ];
    
    badgesList.forEach(badge => {
        const card = document.createElement('div');
        card.className = `badge-item ${badge.unlocked ? '' : 'locked'}`;
        
        card.innerHTML = `
            <span class="badge-icon">${badge.unlocked ? badge.icon : '🔒'}</span>
            <span class="badge-title">${badge.title}</span>
            <span class="badge-desc">${badge.desc}</span>
            ${badge.unlocked ? '' : '<span class="badge-lock-overlay"><i class="fa-solid fa-lock"></i></span>'}
        `;
        
        badgesGrid.appendChild(card);
    });
}

// -----------------------------------------------------------------------------
// REWARD SYSTEM LOGIC (TREASURE CHESTS & SOUND SYNTHESIS)
// -----------------------------------------------------------------------------

function triggerChestRoll() {
    const roll = Math.floor(Math.random() * 100);
    let chestType = "";
    let chestEmoji = "";
    let desc = "";
    
    pendingDiamonds = 0;
    pendingFreezes = 0;
    
    if (roll < 20) {
        chestType = "Small Chest";
        chestEmoji = "📦";
        pendingDiamonds = 3;
        desc = "Rewards: +3 Diamonds 💎";
    } else if (roll < 40) {
        chestType = "Normal Chest";
        chestEmoji = "🪵";
        pendingDiamonds = 7;
        desc = "Rewards: +7 Diamonds 💎";
    } else if (roll < 60) {
        chestType = "Big Chest";
        chestEmoji = "🧰";
        pendingDiamonds = 20;
        desc = "Rewards: +20 Diamonds 💎";
    } else if (roll < 80) {
        chestType = "Huge Chest";
        chestEmoji = "📦✨";
        pendingFreezes = 1;
        desc = "Rewards: +1 Streak Freeze ❄️";
    } else {
        chestType = "Super Giant Chest";
        chestEmoji = "👑💎";
        pendingFreezes = 2;
        desc = "Rewards: +2 Streak Freezes ❄️";
    }
    
    // Populate Modal
    document.getElementById('reward-chest-emoji').textContent = chestEmoji;
    document.getElementById('reward-chest-type').textContent = chestType;
    document.getElementById('reward-description').textContent = desc;
    
    // Show Modal
    const overlay = document.getElementById('reward-modal-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
    
    // Play Sound
    playSynthSound('discover');
}

function claimPendingReward() {
    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: pendingDiamonds,
            streak_freezes: pendingFreezes
        })
    })
    .then(res => res.json())
    .then(data => {
        // Update currentUser details in memory
        currentUser.diamonds = data.diamonds;
        currentUser.streak_freezes = data.streak_freezes;
        
        // Update header badges
        const dCount = document.getElementById('header-user-diamonds');
        const fCount = document.getElementById('header-user-freezes');
        if (dCount) dCount.textContent = data.diamonds || 0;
        if (fCount) fCount.textContent = data.streak_freezes || 0;
        
        // Play Claim Sound
        playSynthSound('claim');
        
        // Hide Modal
        const overlay = document.getElementById('reward-modal-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        
        // Show success alert toast
        alert(`Claimed! You successfully received:\n${pendingDiamonds > 0 ? '+' + pendingDiamonds + ' Diamonds 💎' : ''}${pendingFreezes > 0 ? '+' + pendingFreezes + ' Streak Freezes ❄️' : ''}`);
        
        // Reset rewards cache
        pendingDiamonds = 0;
        pendingFreezes = 0;
        
        // Reload data to sync with profile
        loadUserData();
    })
    .catch(err => console.error('Error claiming reward:', err));
}

// Sound synthesis utilities using Web Audio API
function playSynthSound(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        if (type === 'discover') {
            // Arpeggio sound: C4 -> E4 -> G4 -> C5
            const notes = [261.63, 329.63, 392.00, 523.25];
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);
                
                gain.gain.setValueAtTime(0.15, ctx.currentTime + index * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.1 + 0.3);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(ctx.currentTime + index * 0.1);
                osc.stop(ctx.currentTime + index * 0.1 + 0.35);
            });
        } else if (type === 'claim') {
            // High pitch chime sound: G5 -> C6
            const notes = [783.99, 1046.50];
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08);
                
                gain.gain.setValueAtTime(0.2, ctx.currentTime + index * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.08 + 0.4);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(ctx.currentTime + index * 0.08);
                osc.stop(ctx.currentTime + index * 0.08 + 0.45);
            });
        }
    } catch (e) {
        console.error("Web Audio API not supported or blocked by user gesture", e);
    }
}

// -----------------------------------------------------------------------------
// BREAK TIMER & GAMES LOGIC (GUESS IN 10 & WORD SEARCH)
// -----------------------------------------------------------------------------

function startBreakTimer() {
    if (breakTimerInterval) return;
    
    updateTimerUI();
    
    breakTimerInterval = setInterval(() => {
        if (breakTimeRemaining > 0) {
            breakTimeRemaining--;
            updateTimerUI();
            
            if (breakTimeRemaining <= 0) {
                // Time's up! Lock games
                clearInterval(breakTimerInterval);
                breakTimerInterval = null;
                showTimesUpOverlay();
            }
        }
    }, 1000);
}

function pauseBreakTimer() {
    if (breakTimerInterval) {
        clearInterval(breakTimerInterval);
        breakTimerInterval = null;
    }
}

function updateTimerUI() {
    const clock = document.getElementById('break-timer-clock');
    if (!clock) return;
    
    const mins = Math.floor(breakTimeRemaining / 60);
    const secs = breakTimeRemaining % 60;
    clock.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function showTimesUpOverlay() {
    const overlay = document.getElementById('break-times-up-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function hideTimesUpOverlay() {
    const overlay = document.getElementById('break-times-up-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function buyBreakTime(minutes, cost) {
    const diamondsCount = parseInt(currentUser.diamonds) || 0;
    if (diamondsCount < cost) {
        alert(`Not enough diamonds! You have 💎 ${diamondsCount}, but need 💎 ${cost}.`);
        return;
    }
    
    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: -cost,
            streak_freezes: 0
        })
    })
    .then(res => res.json())
    .then(data => {
        // Deduct from memory
        currentUser.diamonds = data.diamonds;
        
        // Update header badges
        const dCount = document.getElementById('header-user-diamonds');
        if (dCount) dCount.textContent = data.diamonds || 0;
        
        // Add time
        breakTimeRemaining += minutes * 60;
        updateTimerUI();
        
        // Hide overlay
        hideTimesUpOverlay();
        
        // Restart timer countdown if it stopped
        startBreakTimer();
        
        // Chime sound
        playSynthSound('claim');
        
        alert(`Success! Purchased +${minutes} minutes of break time.`);
    })
    .catch(err => console.error('Error buying break time:', err));
}

function initGamesSectionListeners() {
    if (gamesListenersInitialized) return;
    gamesListenersInitialized = true;
    
    // Purchase time buttons (Header Panel)
    const buy2mBtn = document.getElementById('btn-buy-2m');
    const buy5mBtn = document.getElementById('btn-buy-5m');
    
    if (buy2mBtn) buy2mBtn.addEventListener('click', () => buyBreakTime(2, 30));
    if (buy5mBtn) buy5mBtn.addEventListener('click', () => buyBreakTime(5, 70));
    
    // Purchase time buttons (Times Up Overlay)
    const overlayBuy2mBtn = document.getElementById('btn-overlay-buy-2m');
    const overlayBuy5mBtn = document.getElementById('btn-overlay-buy-5m');
    
    if (overlayBuy2mBtn) overlayBuy2mBtn.addEventListener('click', () => buyBreakTime(2, 30));
    if (overlayBuy5mBtn) overlayBuy5mBtn.addEventListener('click', () => buyBreakTime(5, 70));
    
    // Guess in 6 listeners
    const revealClueBtn = document.getElementById('btn-reveal-clue');
    if (revealClueBtn) {
        revealClueBtn.addEventListener('click', revealGuessClue);
    }
    const guessBuyHintBtn = document.getElementById('btn-guess-buy-hint');
    if (guessBuyHintBtn) {
        guessBuyHintBtn.addEventListener('click', buyGuessGameHint);
    }
    
    const guessForm = document.getElementById('guess-country-form');
    if (guessForm) {
        guessForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitCountryGuess();
        });
    }
    
    const restartGuessBtn = document.getElementById('btn-restart-guess');
    if (restartGuessBtn) {
        restartGuessBtn.addEventListener('click', initGuessGame);
    }
    
    // Word Search restart listener
    const restartWsearchBtn = document.getElementById('btn-restart-wordsearch');
    if (restartWsearchBtn) {
        restartWsearchBtn.addEventListener('click', initWordSearchGame);
    }
    const wsearchBuyHintBtn = document.getElementById('btn-wordsearch-buy-hint');
    if (wsearchBuyHintBtn) {
        wsearchBuyHintBtn.addEventListener('click', buyWordSearchHint);
    }

    // Sudoku listeners
    const restartSudokuBtn = document.getElementById('btn-restart-sudoku');
    if (restartSudokuBtn) {
        restartSudokuBtn.addEventListener('click', initSudokuGame);
    }
    const checkSudokuBtn = document.getElementById('btn-check-sudoku');
    if (checkSudokuBtn) {
        checkSudokuBtn.addEventListener('click', checkSudokuSolution);
    }
    const sudokuBuyHintBtn = document.getElementById('btn-sudoku-buy-hint');
    if (sudokuBuyHintBtn) {
        sudokuBuyHintBtn.addEventListener('click', buySudokuHint);
    }
    
    // Wordcross listeners
    const restartWordcrossBtn = document.getElementById('btn-restart-wordcross');
    if (restartWordcrossBtn) {
        restartWordcrossBtn.addEventListener('click', initWordcrossGame);
    }
    const checkWordcrossBtn = document.getElementById('btn-check-wordcross');
    if (checkWordcrossBtn) {
        checkWordcrossBtn.addEventListener('click', checkWordcrossSolution);
    }
    const wordcrossBuyHintBtn = document.getElementById('btn-wordcross-buy-hint');
    if (wordcrossBuyHintBtn) {
        wordcrossBuyHintBtn.addEventListener('click', buyWordcrossHint);
    }

    // Math game listeners
    const restartMathBtn = document.getElementById('btn-restart-math');
    if (restartMathBtn) {
        restartMathBtn.addEventListener('click', initMathGame);
    }
    const submitMathBtn = document.getElementById('btn-submit-math');
    if (submitMathBtn) {
        submitMathBtn.addEventListener('click', submitMathAnswer);
    }
    const mathBuyHintBtn = document.getElementById('btn-math-buy-hint');
    if (mathBuyHintBtn) {
        mathBuyHintBtn.addEventListener('click', buyMathHint);
    }
    const mathInput = document.getElementById('input-math-answer');
    if (mathInput) {
        mathInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitMathAnswer();
            }
        });
    }

    // Tic Tac Toe listeners
    const restartTTTBtn = document.getElementById('btn-restart-ttt');
    if (restartTTTBtn) {
        restartTTTBtn.addEventListener('click', initTTTGame);
    }
    const tttBuyHintBtn = document.getElementById('btn-ttt-buy-hint');
    if (tttBuyHintBtn) {
        tttBuyHintBtn.addEventListener('click', buyTTTHint);
    }
}

function initGamesSection() {
    // Check if locked
    if (breakTimeRemaining <= 0) {
        showTimesUpOverlay();
    } else {
        hideTimesUpOverlay();
    }
    
    // Initialize individual games
    initGuessGame();
    initWordSearchGame();
    initSudokuGame();
    initWordcrossGame();
    initMathGame();
    initTTTGame();
}

// -----------------------------------------------------------------------------
// GAME 1: GUESS IN 10 (COUNTRY EDITION)
// -----------------------------------------------------------------------------

const GUESS_COUNTRIES_DATA = [
    {
        name: "Bhutan",
        clues: [
            "Its national language is Dzongkha, and its name translates to 'Land of the Thunder Dragon.'",
            "It is the only country in the world that is officially carbon-negative, absorbing more CO2 than it emits.",
            "The national sport of this mountainous kingdom is traditional archery, where players shoot at targets 140 meters away.",
            "Its capital city, Thimphu, is one of the only capitals in the world without a single traffic light.",
            "It famously prioritizes Gross National Happiness (GNH) over Gross Domestic Product (GDP).",
            "It is a landlocked South Asian nation nestled in the Eastern Himalayas, bordering India and China."
        ]
    },
    {
        name: "Andorra",
        clues: [
            "It is the only co-principality in the world, jointly ruled by the Bishop of Urgell and the President of France.",
            "Nestled in the Pyrenees mountains, its official language is Catalan, making it the only country with this official language.",
            "It has no national bank, uses the Euro, and has never had its own currency.",
            "It has no airports or train stations; visitors must enter by road through Spain or France.",
            "The capital, Andorra la Vella, is the highest capital city in Europe, sitting at an elevation of 1,023 meters.",
            "It is a tiny landlocked European microstate known as a tax haven and ski destination."
        ]
    },
    {
        name: "Suriname",
        clues: [
            "It is the smallest sovereign state in South America by area and population, yet one of the most culturally diverse.",
            "It is the only nation outside of Europe where Dutch is the official and primary spoken language of the majority.",
            "Approximately 90% of its land area is covered by pristine, dense tropical rainforest.",
            "Its capital, Paramaribo, features a historic inner city that is a UNESCO World Heritage site, famous for wooden Dutch colonial architecture.",
            "Its population has unique roots, including Javanese, Hindustani, Creole, Maroon, and indigenous tribes.",
            "It borders French Guiana to the east, Brazil to the south, and Guyana to the west."
        ]
    },
    {
        name: "Liechtenstein",
        clues: [
            "It is one of only two double-landlocked countries in the world (surrounded entirely by other landlocked nations).",
            "It is the world's leading manufacturer of high-quality false teeth, producing tens of millions annually.",
            "It has not maintained an active military force since 1868, when the army was disbanded due to expense.",
            "It is bordered by Switzerland to the west and south, and Austria to the east.",
            "Its head of state is a reigning Prince who lives in a medieval castle overlooking the capital, Vaduz.",
            "It is a tiny, wealthy alpine principality in Central Europe, measuring just 160 square kilometers."
        ]
    },
    {
        name: "Madagascar",
        clues: [
            "It separated from the Indian subcontinent around 88 million years ago, allowing its wildlife to evolve in isolation.",
            "More than 90% of its native flora and fauna cannot be found anywhere else on Earth.",
            "It is the world's leading producer and exporter of vanilla beans.",
            "Its unique geography features karst rock forests known as 'Tsingy' (meaning 'where one cannot walk barefoot').",
            "Its capital is Antananarivo, and it is located off the southeastern coast of Africa.",
            "It is the fourth-largest island in the world, famous for lemurs and baobab trees."
        ]
    },
    {
        name: "Morocco",
        clues: [
            "It is separated from the European continent by a narrow strait that is only 14 kilometers wide.",
            "It is home to the world's oldest continually operating university, the University of Al-Qarawiyyin, founded in 859 AD.",
            "Its historic city of Chefchaouen is world-famous for its striking, blue-washed streets and houses.",
            "Its diverse geography ranges from the snowy Atlas Mountains to the arid sands of the Sahara Desert.",
            "The film Casablanca was named after one of its largest economic hubs and port cities.",
            "It is a North African kingdom with Rabat as its capital, bordering both the Atlantic and Mediterranean."
        ]
    },
    {
        name: "Vanuatu",
        clues: [
            "It is the birthplace of land diving (Naghol), an ancient ritual that directly inspired modern bungee jumping.",
            "It is a volcanic archipelago in the South Pacific consisting of roughly 80 islands.",
            "It has the highest language density per capita in the world, with over 100 distinct indigenous languages spoken.",
            "It is home to Mount Yasur, one of the world's most active and accessible volcanoes, located on Tanna Island.",
            "Its capital and largest city is Port Vila.",
            "Formerly known as the New Hebrides, it gained independence from joint British and French rule in 1980."
        ]
    },
    {
        name: "Kyrgyzstan",
        clues: [
            "Its culture is centered around the nomadic lifestyle, and its national epic, the Epic of Manas, is one of the longest in the world.",
            "Over 90% of its mountainous territory is covered by the spectacular Tian Shan mountain range.",
            "The traditional horse game Kok-boru (similar to polo but played with a goat carcass) is highly popular here.",
            "It contains Issyk-Kul, the second-largest alpine lake in the world, which never freezes despite being surrounded by snow-capped peaks.",
            "Its capital city is Bishkek, and it borders Kazakhstan, Uzbekistan, Tajikistan, and China.",
            "It is a landlocked Central Asian nation that was formerly part of the Soviet Union."
        ]
    }
];

let guessSelectedCountry = null;
let guessCluesRevealed = 0;
let guessGameEnded = false;

function initGuessGame() {
    const randomIndex = Math.floor(Math.random() * GUESS_COUNTRIES_DATA.length);
    guessSelectedCountry = GUESS_COUNTRIES_DATA[randomIndex];
    guessCluesRevealed = 0;
    guessGameEnded = false;
    
    // Clear clues list
    const clueList = document.getElementById('guess-clues-list');
    if (clueList) {
        clueList.innerHTML = `<li class="clue-placeholder">Click 'Get Clue' to begin!</li>`;
    }
    
    // Reset inputs & counters
    document.getElementById('guess-clue-count').textContent = '0';
    document.getElementById('input-country-guess').value = '';
    
    const statusMsg = document.getElementById('guess-game-status');
    statusMsg.className = 'game-status-msg';
    statusMsg.textContent = '';
    
    // Enable submit
    document.getElementById('btn-submit-guess').disabled = false;
    document.getElementById('btn-reveal-clue').disabled = false;
}

function revealGuessClue() {
    if (guessGameEnded) return;
    if (guessCluesRevealed >= 6) {
        alert("You have already revealed all 6 clues!");
        return;
    }
    
    const clueList = document.getElementById('guess-clues-list');
    if (guessCluesRevealed === 0) {
        clueList.innerHTML = '';
    }
    
    const li = document.createElement('li');
    li.textContent = `Clue ${guessCluesRevealed + 1}: ${guessSelectedCountry.clues[guessCluesRevealed]}`;
    clueList.appendChild(li);
    
    // Auto scroll clue board
    const board = clueList.closest('.clue-board');
    board.scrollTop = board.scrollHeight;
    
    guessCluesRevealed++;
    document.getElementById('guess-clue-count').textContent = guessCluesRevealed;
}

function submitCountryGuess() {
    if (guessGameEnded) return;
    
    const input = document.getElementById('input-country-guess');
    const guess = input.value.trim().toLowerCase();
    const correctName = guessSelectedCountry.name.toLowerCase();
    
    const statusMsg = document.getElementById('guess-game-status');
    
    if (guess === correctName) {
        // Correct!
        guessGameEnded = true;
        statusMsg.className = 'game-status-msg correct';
        statusMsg.textContent = `🎉 Correct! The country is ${guessSelectedCountry.name}. You earned 💎 5!`;
        
        // Disable controls
        document.getElementById('btn-submit-guess').disabled = true;
        document.getElementById('btn-reveal-clue').disabled = true;
        
        // Reward user
        rewardUserForGameCompletion(5);
    } else {
        // Wrong!
        if (guessCluesRevealed >= 6) {
            // Out of clues / attempts
            guessGameEnded = true;
            statusMsg.className = 'game-status-msg wrong';
            statusMsg.textContent = `😢 Out of clues! The correct answer was ${guessSelectedCountry.name}.`;
            document.getElementById('btn-submit-guess').disabled = true;
            document.getElementById('btn-reveal-clue').disabled = true;
        } else {
            statusMsg.className = 'game-status-msg wrong';
            statusMsg.textContent = `❌ Incorrect guess. Try again or reveal another clue!`;
            input.value = '';
        }
    }
}

function rewardUserForGameCompletion(diamondsAmount) {
    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: diamondsAmount,
            streak_freezes: 0
        })
    })
    .then(res => res.json())
    .then(data => {
        // Add to memory
        currentUser.diamonds = data.diamonds;
        // Update header badges
        const dCount = document.getElementById('header-user-diamonds');
        if (dCount) dCount.textContent = data.diamonds || 0;
        
        // Play Chime
        playSynthSound('claim');
    })
    .catch(err => console.error('Error rewarding user:', err));
}

// -----------------------------------------------------------------------------
// GAME 2: WORD SEARCH (HABITS EDITION)
// -----------------------------------------------------------------------------

let WS_GRID_LETTERS = [];
let WS_WORDS_DATA = [];

const HABIT_WORDS_POOL = [
    "MEDITATE", "ROUTINE", "FITNESS", "HEALTH",
    "STREAK", "TRACKER", "BREATHE", "CONSISTENT",
    "YOGA", "HYDRATE", "JOURNAL", "MINDFUL"
];

function generateWordSearchBoard() {
    const size = 15;
    let grid = Array(size).fill(null).map(() => Array(size).fill(''));
    let wordsData = [];
    
    const directions = [
        [0, 1],   // Horizontal right
        [0, -1],  // Horizontal left
        [1, 0],   // Vertical down
        [-1, 0],  // Vertical up
        [1, 1],   // Diagonal down-right
        [-1, -1], // Diagonal up-left
        [1, -1],  // Diagonal down-left
        [-1, 1]   // Diagonal up-right
    ];
    
    const sortedWords = [...HABIT_WORDS_POOL].sort((a, b) => b.length - a.length);
    
    for (let word of sortedWords) {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 250) {
            attempts++;
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const dr = dir[0];
            const dc = dir[1];
            
            const r = Math.floor(Math.random() * size);
            const c = Math.floor(Math.random() * size);
            
            const endR = r + (word.length - 1) * dr;
            const endC = c + (word.length - 1) * dc;
            
            if (endR < 0 || endR >= size || endC < 0 || endC >= size) {
                continue;
            }
            
            let canPlace = true;
            let coords = [];
            for (let i = 0; i < word.length; i++) {
                const currR = r + i * dr;
                const currC = c + i * dc;
                const cellChar = grid[currR][currC];
                if (cellChar !== '' && cellChar !== word[i]) {
                    canPlace = false;
                    break;
                }
                coords.push(`${currR},${currC}`);
            }
            
            if (canPlace) {
                for (let i = 0; i < word.length; i++) {
                    const currR = r + i * dr;
                    const currC = c + i * dc;
                    grid[currR][currC] = word[i];
                }
                wordsData.push({
                    word: word,
                    coords: coords
                });
                placed = true;
            }
        }
        
        if (!placed) {
            return generateWordSearchBoard();
        }
    }
    
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (grid[r][c] === '') {
                grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
            }
        }
    }
    
    WS_GRID_LETTERS = grid;
    WS_WORDS_DATA = wordsData;
}

let wsSelectedCells = []; // array of "row,col" strings
let wsFoundWords = []; // array of word strings

function initWordSearchGame() {
    wsSelectedCells = [];
    wsFoundWords = [];
    
    generateWordSearchBoard();
    
    const board = document.getElementById('wordsearch-grid-board');
    if (!board) return;
    
    board.innerHTML = '';
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            const cell = document.createElement('div');
            cell.className = 'ws-cell';
            cell.textContent = WS_GRID_LETTERS[r][c];
            cell.setAttribute('data-coord', `${r},${c}`);
            
            cell.addEventListener('click', () => handleWordSearchCellClick(cell));
            board.appendChild(cell);
        }
    }
    
    const wordsUl = document.getElementById('wordsearch-words-ul');
    wordsUl.innerHTML = '';
    
    WS_WORDS_DATA.forEach(wData => {
        const li = document.createElement('li');
        li.className = 'word-list-item';
        li.id = `ws-word-${wData.word}`;
        li.textContent = wData.word;
        wordsUl.appendChild(li);
    });
    
    const statusMsg = document.getElementById('wordsearch-status');
    statusMsg.className = 'game-status-msg';
    statusMsg.textContent = '';
}

function handleWordSearchCellClick(cellEl) {
    if (breakTimeRemaining <= 0) return;
    
    const coord = cellEl.getAttribute('data-coord');
    
    // Toggle Selection
    if (cellEl.classList.contains('selected')) {
        cellEl.classList.remove('selected');
        wsSelectedCells = wsSelectedCells.filter(c => c !== coord);
    } else {
        cellEl.classList.add('selected');
        wsSelectedCells.push(coord);
    }
    
    // Verify selection matches any word
    checkWordSearchSelection();
}

function checkWordSearchSelection() {
    const sortedSelected = [...wsSelectedCells].sort();
    
    let matchedWord = null;
    
    for (let wData of WS_WORDS_DATA) {
        if (wsFoundWords.includes(wData.word)) continue;
        
        const sortedCoords = [...wData.coords].sort();
        
        if (sortedSelected.length === sortedCoords.length && sortedSelected.every((val, i) => val === sortedCoords[i])) {
            matchedWord = wData;
            break;
        }
    }
    
    if (matchedWord) {
        wsFoundWords.push(matchedWord.word);
        
        matchedWord.coords.forEach(coord => {
            const cell = document.querySelector(`.ws-cell[data-coord="${coord}"]`);
            if (cell) {
                cell.classList.remove('selected');
                cell.classList.add('found');
            }
        });
        
        const li = document.getElementById(`ws-word-${matchedWord.word}`);
        if (li) {
            li.classList.add('found');
        }
        
        wsSelectedCells = [];
        
        playSynthSound('claim');
        
        const statusMsg = document.getElementById('wordsearch-status');
        statusMsg.className = 'game-status-msg correct';
        statusMsg.textContent = `✨ Found word: ${matchedWord.word}!`;
        
        if (wsFoundWords.length === WS_WORDS_DATA.length) {
            statusMsg.textContent = `🎉 Congratulations! Found all words. You earned 💎 5!`;
            rewardUserForGameCompletion(5);
        }
    }
}

// -----------------------------------------------------------------------------
// GAME 3: BREAK SUDOKU
// -----------------------------------------------------------------------------

const SUDOKU_BOARDS = [
    {
        start: [
            [5, 3, 0, 0, 7, 0, 0, 0, 0],
            [6, 0, 0, 1, 9, 5, 0, 0, 0],
            [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3],
            [4, 0, 0, 8, 0, 3, 0, 0, 1],
            [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0],
            [0, 0, 0, 4, 1, 9, 0, 0, 5],
            [0, 0, 0, 0, 8, 0, 0, 7, 9]
        ],
        solution: [
            [5, 3, 4, 6, 7, 8, 9, 1, 2],
            [6, 7, 2, 1, 9, 5, 3, 4, 8],
            [1, 9, 8, 3, 4, 2, 5, 6, 7],
            [8, 5, 9, 7, 6, 1, 4, 2, 3],
            [4, 2, 6, 8, 5, 3, 7, 9, 1],
            [7, 1, 3, 9, 2, 4, 8, 5, 6],
            [9, 6, 1, 5, 3, 7, 2, 8, 4],
            [2, 8, 7, 4, 1, 9, 6, 3, 5],
            [3, 4, 5, 2, 8, 6, 1, 7, 9]
        ]
    },
    {
        start: [
            [0, 0, 0, 2, 6, 0, 7, 0, 1],
            [6, 8, 0, 0, 7, 0, 0, 9, 0],
            [1, 9, 0, 0, 0, 4, 5, 0, 0],
            [8, 2, 0, 1, 0, 0, 0, 4, 0],
            [0, 0, 4, 6, 0, 2, 9, 0, 0],
            [0, 5, 0, 0, 0, 3, 0, 2, 8],
            [0, 0, 9, 3, 0, 0, 0, 7, 4],
            [0, 4, 0, 0, 5, 0, 0, 3, 6],
            [7, 0, 3, 0, 1, 8, 0, 0, 0]
        ],
        solution: [
            [4, 3, 5, 2, 6, 9, 7, 8, 1],
            [6, 8, 2, 5, 7, 1, 3, 9, 4],
            [1, 9, 7, 8, 3, 4, 5, 6, 2],
            [8, 2, 6, 1, 9, 5, 7, 4, 3],
            [3, 7, 4, 6, 8, 2, 9, 1, 5],
            [9, 5, 1, 7, 4, 3, 6, 2, 8],
            [5, 1, 9, 3, 2, 6, 8, 7, 4],
            [2, 4, 8, 9, 5, 7, 1, 3, 6],
            [7, 6, 3, 4, 1, 8, 2, 5, 9]
        ]
    }
];

let sudokuActiveBoardIndex = 0;
let sudokuCurrentBoard = [];
let sudokuSelectedCell = null;
let sudokuListenersInitialized = false;
let sudokuGameEnded = false;

function initSudokuGame() {
    sudokuActiveBoardIndex = Math.floor(Math.random() * SUDOKU_BOARDS.length);
    const boardDef = SUDOKU_BOARDS[sudokuActiveBoardIndex];
    sudokuCurrentBoard = boardDef.start.map(row => [...row]);
    sudokuSelectedCell = null;
    sudokuGameEnded = false;

    const gridBoard = document.getElementById('sudoku-grid-board');
    if (!gridBoard) return;

    gridBoard.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.setAttribute('data-coord', `${r},${c}`);
            
            const cellVal = sudokuCurrentBoard[r][c];
            if (cellVal !== 0) {
                cell.textContent = cellVal;
                cell.classList.add('static');
            } else {
                cell.addEventListener('click', () => {
                    if (breakTimeRemaining <= 0 || sudokuGameEnded) return;
                    
                    document.querySelectorAll('.sudoku-cell').forEach(el => el.classList.remove('selected'));
                    cell.classList.add('selected');
                    sudokuSelectedCell = { r, c };
                });
            }

            // Thick borders for 3x3 box outlines
            if (c % 3 === 2 && c !== 8) {
                cell.style.borderRight = '2px solid var(--text-primary)';
            }
            if (r % 3 === 2 && r !== 8) {
                cell.style.borderBottom = '2px solid var(--text-primary)';
            }

            gridBoard.appendChild(cell);
        }
    }

    const statusMsg = document.getElementById('sudoku-status');
    if (statusMsg) {
        statusMsg.className = 'game-status-msg';
        statusMsg.textContent = '';
    }

    if (!sudokuListenersInitialized) {
        sudokuListenersInitialized = true;
        // Number pad buttons click
        document.querySelectorAll('.btn-numpad').forEach(btn => {
            btn.addEventListener('click', () => {
                if (breakTimeRemaining <= 0 || sudokuGameEnded) return;
                const val = parseInt(btn.getAttribute('data-val'));
                setSudokuCellValue(val);
            });
        });

        // Keyboard inputs
        window.addEventListener('keydown', (e) => {
            if (activeTab !== 'games' || breakTimeRemaining <= 0 || sudokuGameEnded) return;
            if (sudokuSelectedCell) {
                if (e.key >= '1' && e.key <= '9') {
                    setSudokuCellValue(parseInt(e.key));
                } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
                    setSudokuCellValue(0);
                }
            }
        });
    }
}

function setSudokuCellValue(val) {
    if (!sudokuSelectedCell || sudokuGameEnded) return;
    const { r, c } = sudokuSelectedCell;
    
    // Safety check: is it a static cell?
    if (SUDOKU_BOARDS[sudokuActiveBoardIndex].start[r][c] !== 0) return;

    sudokuCurrentBoard[r][c] = val;
    const cellEl = document.querySelector(`.sudoku-cell[data-coord="${r},${c}"]`);
    if (cellEl) {
        cellEl.textContent = val === 0 ? '' : val;
    }
}

function checkSudokuSolution() {
    if (sudokuGameEnded) return;
    const solution = SUDOKU_BOARDS[sudokuActiveBoardIndex].solution;
    const statusMsg = document.getElementById('sudoku-status');
    
    let correct = true;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (sudokuCurrentBoard[r][c] !== solution[r][c]) {
                correct = false;
                break;
            }
        }
        if (!correct) break;
    }

    if (correct) {
        sudokuGameEnded = true;
        statusMsg.className = 'game-status-msg correct';
        statusMsg.textContent = `🎉 Correct! Sudoku solved. You earned 💎 5!`;
        
        // Remove selection glow
        document.querySelectorAll('.sudoku-cell').forEach(el => el.classList.remove('selected'));
        sudokuSelectedCell = null;

        // Reward diamonds
        rewardUserForGameCompletion(5);
    } else {
        statusMsg.className = 'game-status-msg wrong';
        statusMsg.textContent = `❌ Incorrect solution. Double-check your entries!`;
    }
}

// -----------------------------------------------------------------------------
// GAME 4: HABITS WORDCROSS
// -----------------------------------------------------------------------------

const WORDCROSS_BOARDS = [
    {
        grid: [
            ['S', 'E', 'N', 'S', 'E'],
            ['L', '.', 'E', '.', 'N'],
            ['E', 'V', 'E', 'N', 'T'],
            ['E', '.', 'D', '.', 'E'],
            ['P', 'O', 'S', 'E', 'R']
        ],
        numbers: {
            "0,0": 1,
            "0,2": 2,
            "0,4": 3,
            "2,0": 4,
            "4,0": 5
        },
        clues: {
            across: [
                { num: 1, text: "A faculty by which the body perceives an external stimulus (5)", row: 0, col: 0 },
                { num: 4, text: "A planned public/social occasion, or occurrence of significance (5)", row: 2, col: 0 },
                { num: 5, text: "Assumes a particular position; or a puzzling question (5)", row: 4, col: 0 }
            ],
            down: [
                { num: 1, text: "A natural state of rest, crucial for health and mental recovery (5)", row: 0, col: 0 },
                { num: 2, text: "Things that are essential or necessary for survival and well-being (5)", row: 0, col: 2 },
                { num: 3, text: "Come or go into a place; or press this key to submit (5)", row: 0, col: 4 }
            ]
        }
    },
    {
        grid: [
            ['W', 'A', 'T', 'E', 'R'],
            ['R', '.', 'R', '.', 'E'],
            ['I', 'N', 'A', 'C', 'T'],
            ['T', '.', 'C', '.', 'R'],
            ['E', 'A', 'K', 'E', 'S']
        ],
        numbers: {
            "0,0": 1,
            "0,2": 2,
            "0,4": 3,
            "2,0": 4,
            "4,0": 5
        },
        clues: {
            across: [
                { num: 1, text: "Hydrate yourself with this liquid daily (5)", row: 0, col: 0 },
                { num: 4, text: "State of not taking action; passive or dormant (5)", row: 2, col: 0 },
                { num: 5, text: "Hurts, throb with dull pain (e.g. after heavy training) (5)", row: 4, col: 0 }
            ],
            down: [
                { num: 1, text: "Put thoughts down on paper; jot down journals (5)", row: 0, col: 0 },
                { num: 2, text: "Locate or trace down habits; keep a log (5)", row: 0, col: 2 },
                { num: 3, text: "Go back or undo; regression to old habits (5)", row: 0, col: 4 }
            ]
        }
    }
];

let wordcrossActiveIndex = 0;
let wordcrossGameEnded = false;

function initWordcrossGame() {
    wordcrossActiveIndex = Math.floor(Math.random() * WORDCROSS_BOARDS.length);
    const boardDef = WORDCROSS_BOARDS[wordcrossActiveIndex];
    wordcrossGameEnded = false;

    const gridBoard = document.getElementById('wordcross-grid-board');
    if (!gridBoard) return;

    gridBoard.innerHTML = '';
    
    // Draw grid
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const container = document.createElement('div');
            container.className = 'wordcross-cell-container';

            const char = boardDef.grid[r][c];
            const input = document.createElement('input');
            input.setAttribute('maxlength', '1');
            
            if (char === '.') {
                input.className = 'wordcross-input blackout';
                input.disabled = true;
            } else {
                input.className = 'wordcross-input';
                input.setAttribute('data-coord', `${r},${c}`);
                
                // Number label if defined
                const cellNum = boardDef.numbers[`${r},${c}`];
                if (cellNum) {
                    const numLabel = document.createElement('div');
                    numLabel.className = 'wordcross-cell-number';
                    numLabel.textContent = cellNum;
                    container.appendChild(numLabel);
                }

                // Auto advance keyup
                input.addEventListener('input', () => {
                    if (input.value.length >= 1) {
                        const inputs = Array.from(document.querySelectorAll('.wordcross-input:not(.blackout)'));
                        const idx = inputs.indexOf(input);
                        if (idx >= 0 && idx < inputs.length - 1) {
                            inputs[idx + 1].focus();
                            inputs[idx + 1].select();
                        }
                    }
                });

                // Auto backspace backward
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && input.value.length === 0) {
                        const inputs = Array.from(document.querySelectorAll('.wordcross-input:not(.blackout)'));
                        const idx = inputs.indexOf(input);
                        if (idx > 0) {
                            inputs[idx - 1].focus();
                            inputs[idx - 1].select();
                        }
                    }
                });
            }

            container.appendChild(input);
            gridBoard.appendChild(container);
        }
    }

    // Populate clues
    const acrossUl = document.getElementById('wordcross-clues-across');
    const downUl = document.getElementById('wordcross-clues-down');
    
    if (acrossUl) acrossUl.innerHTML = '';
    if (downUl) downUl.innerHTML = '';

    boardDef.clues.across.forEach(clue => {
        const li = document.createElement('li');
        li.textContent = `${clue.num}. ${clue.text}`;
        acrossUl.appendChild(li);
    });

    boardDef.clues.down.forEach(clue => {
        const li = document.createElement('li');
        li.textContent = `${clue.num}. ${clue.text}`;
        downUl.appendChild(li);
    });

    const statusMsg = document.getElementById('wordcross-status');
    if (statusMsg) {
        statusMsg.className = 'game-status-msg';
        statusMsg.textContent = '';
    }
}

function checkWordcrossSolution() {
    if (wordcrossGameEnded) return;
    const boardDef = WORDCROSS_BOARDS[wordcrossActiveIndex];
    const statusMsg = document.getElementById('wordcross-status');
    
    let correct = true;
    const inputs = document.querySelectorAll('.wordcross-input:not(.blackout)');
    
    for (let input of inputs) {
        const [r, c] = input.getAttribute('data-coord').split(',').map(Number);
        const enteredVal = input.value.trim().toUpperCase();
        const expectedVal = boardDef.grid[r][c].toUpperCase();
        
        if (enteredVal !== expectedVal) {
            correct = false;
            break;
        }
    }

    if (correct) {
        wordcrossGameEnded = true;
        statusMsg.className = 'game-status-msg correct';
        statusMsg.textContent = `🎉 Correct! Wordcross solved. You earned 💎 5!`;
        
        // Disable all inputs
        inputs.forEach(input => input.disabled = true);

        // Reward diamonds
        rewardUserForGameCompletion(5);
    } else {
        statusMsg.className = 'game-status-msg wrong';
        statusMsg.textContent = `❌ Incorrect solution. Check your crossword entries!`;
    }
}

// -----------------------------------------------------------------------------
// GAME HINTS SHOP (5 DIAMONDS COST)
// -----------------------------------------------------------------------------

function buyGuessGameHint() {
    if (guessGameEnded) return;
    const cost = 5;
    const diamondsCount = parseInt(currentUser.diamonds) || 0;
    if (diamondsCount < cost) {
        alert(`Not enough diamonds! You have 💎 ${diamondsCount}, but need 💎 ${cost}.`);
        return;
    }

    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: -cost,
            streak_freezes: 0
        })
    })
    .then(res => res.json())
    .then(data => {
        currentUser.diamonds = data.diamonds;
        const dCount = document.getElementById('header-user-diamonds');
        if (dCount) dCount.textContent = data.diamonds || 0;

        // Reveal a letter at random index
        const name = guessSelectedCountry.name;
        const indices = [];
        for (let i = 0; i < name.length; i++) {
            if (name[i] !== ' ') indices.push(i);
        }
        const randIdx = indices[Math.floor(Math.random() * indices.length)];
        const letter = name[randIdx];

        const clueList = document.getElementById('guess-clues-list');
        if (clueList) {
            if (guessCluesRevealed === 0) clueList.innerHTML = '';
            const li = document.createElement('li');
            li.style.borderLeftColor = '#EAB308'; // yellow color for hint
            li.textContent = `💡 Hint: The letter at position ${randIdx + 1} is "${letter.toUpperCase()}"`;
            clueList.appendChild(li);

            const board = clueList.closest('.clue-board');
            board.scrollTop = board.scrollHeight;
        }

        playSynthSound('claim');
        alert(`Purchased a hint for 5 diamonds! Check the clue list.`);
    })
    .catch(err => console.error('Error buying guess hint:', err));
}

function buyWordSearchHint() {
    const cost = 5;
    const diamondsCount = parseInt(currentUser.diamonds) || 0;
    if (diamondsCount < cost) {
        alert(`Not enough diamonds! You have 💎 ${diamondsCount}, but need 💎 ${cost}.`);
        return;
    }

    const unfound = WS_WORDS_DATA.filter(w => !wsFoundWords.includes(w.word));
    if (unfound.length === 0) {
        alert("All words are already found!");
        return;
    }
    const targetWord = unfound[Math.floor(Math.random() * unfound.length)];

    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: -cost,
            streak_freezes: 0
        })
    })
    .then(res => res.json())
    .then(data => {
        currentUser.diamonds = data.diamonds;
        const dCount = document.getElementById('header-user-diamonds');
        if (dCount) dCount.textContent = data.diamonds || 0;

        const firstCoord = targetWord.coords[0];
        const cell = document.querySelector(`.ws-cell[data-coord="${firstCoord}"]`);
        if (cell) {
            cell.style.background = '#EAB308';
            cell.style.color = '#000';
            cell.style.boxShadow = '0 0 15px #EAB308';
            setTimeout(() => {
                cell.style.background = '';
                cell.style.color = '';
                cell.style.boxShadow = '';
            }, 5000);
        }

        playSynthSound('claim');
        alert(`💡 Hint: The word "${targetWord.word}" starts with "${targetWord.word[0]}" at the highlighted yellow cell (Row ${parseInt(firstCoord.split(',')[0])+1}, Col ${parseInt(firstCoord.split(',')[1])+1})!`);
    })
    .catch(err => console.error('Error buying wordsearch hint:', err));
}

function buySudokuHint() {
    if (sudokuGameEnded) return;
    if (!sudokuSelectedCell) {
        alert("Please click and select an empty cell in the Sudoku grid first!");
        return;
    }

    const { r, c } = sudokuSelectedCell;
    if (SUDOKU_BOARDS[sudokuActiveBoardIndex].start[r][c] !== 0) {
        alert("This cell is already filled from the start!");
        return;
    }

    const cost = 5;
    const diamondsCount = parseInt(currentUser.diamonds) || 0;
    if (diamondsCount < cost) {
        alert(`Not enough diamonds! You have 💎 ${diamondsCount}, but need 💎 ${cost}.`);
        return;
    }

    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: -cost,
            streak_freezes: 0
        })
    })
    .then(res => res.json())
    .then(data => {
        currentUser.diamonds = data.diamonds;
        const dCount = document.getElementById('header-user-diamonds');
        if (dCount) dCount.textContent = data.diamonds || 0;

        const correctVal = SUDOKU_BOARDS[sudokuActiveBoardIndex].solution[r][c];
        sudokuCurrentBoard[r][c] = correctVal;

        const cellEl = document.querySelector(`.sudoku-cell[data-coord="${r},${c}"]`);
        if (cellEl) {
            cellEl.textContent = correctVal;
            cellEl.classList.remove('selected');
            cellEl.classList.add('static'); // lock it
        }
        sudokuSelectedCell = null;

        playSynthSound('claim');
        alert(`Cell at Row ${r+1}, Col ${c+1} filled with correct value: ${correctVal}!`);
    })
    .catch(err => console.error('Error buying sudoku hint:', err));
}

function buyWordcrossHint() {
    if (wordcrossGameEnded) return;
    const activeEl = document.activeElement;
    if (!activeEl || !activeEl.classList.contains('wordcross-input') || activeEl.disabled) {
        alert("Please click and focus on an empty letter cell in the Wordcross grid first!");
        return;
    }

    const cost = 5;
    const diamondsCount = parseInt(currentUser.diamonds) || 0;
    if (diamondsCount < cost) {
        alert(`Not enough diamonds! You have 💎 ${diamondsCount}, but need 💎 ${cost}.`);
        return;
    }

    const coordAttr = activeEl.getAttribute('data-coord');
    if (!coordAttr) return;
    const [r, c] = coordAttr.split(',').map(Number);

    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: -cost,
            streak_freezes: 0
        })
    })
    .then(res => res.json())
    .then(data => {
        currentUser.diamonds = data.diamonds;
        const dCount = document.getElementById('header-user-diamonds');
        if (dCount) dCount.textContent = data.diamonds || 0;

        const correctChar = WORDCROSS_BOARDS[wordcrossActiveIndex].grid[r][c].toUpperCase();
        activeEl.value = correctChar;
        activeEl.disabled = true; // lock it
        activeEl.style.color = 'var(--color-success-light)';
        activeEl.style.borderColor = 'var(--color-success)';

        playSynthSound('claim');
        alert(`Revealed letter: "${correctChar}"!`);
    })
    .catch(err => console.error('Error buying wordcross hint:', err));
}

// -----------------------------------------------------------------------------
// GAME 5: QUICK MATH SUMS
// -----------------------------------------------------------------------------

let mathCurrentQuestionIndex = 0;
let mathScore = 0;
let mathCorrectAnswer = 0;
let mathGameEnded = false;

function initMathGame() {
    mathCurrentQuestionIndex = 0;
    mathScore = 0;
    mathGameEnded = false;

    const input = document.getElementById('input-math-answer');
    if (input) {
        input.value = '';
        input.disabled = false;
    }

    const currentQText = document.getElementById('math-current-q');
    if (currentQText) currentQText.textContent = '1';

    const scoreText = document.getElementById('math-score');
    if (scoreText) scoreText.textContent = '0';

    const submitBtn = document.getElementById('btn-submit-math');
    if (submitBtn) submitBtn.disabled = false;

    const hintBtn = document.getElementById('btn-math-buy-hint');
    if (hintBtn) hintBtn.disabled = false;

    const statusMsg = document.getElementById('math-status');
    if (statusMsg) {
        statusMsg.className = 'game-status-msg';
        statusMsg.textContent = '';
    }

    generateMathQuestion();
}

function generateMathQuestion() {
    if (mathCurrentQuestionIndex >= 10) {
        endMathGame();
        return;
    }

    const operators = ['+', '-', '*', '/'];
    const op = operators[Math.floor(Math.random() * operators.length)];
    let num1 = 0;
    let num2 = 0;
    let displayOp = '';

    if (op === '+') {
        num1 = Math.floor(Math.random() * 450) + 50; // 50 to 499
        num2 = Math.floor(Math.random() * 450) + 50; // 50 to 499
        mathCorrectAnswer = num1 + num2;
        displayOp = '+';
    } else if (op === '-') {
        num1 = Math.floor(Math.random() * 899) + 100; // 100 to 998
        num2 = Math.floor(Math.random() * (num1 - 50)) + 50; // 50 to (num1 - 50)
        mathCorrectAnswer = num1 - num2;
        displayOp = '-';
    } else if (op === '*') {
        num1 = Math.floor(Math.random() * 90) + 10; // 10 to 99
        num2 = Math.floor(Math.random() * 8) + 2;   // 2 to 9
        mathCorrectAnswer = num1 * num2;
        displayOp = '×';
    } else if (op === '/') {
        num2 = Math.floor(Math.random() * 8) + 2;   // divisor: 2 to 9
        const mult = Math.floor(Math.random() * 90) + 10; // quotient: 10 to 99
        num1 = num2 * mult; // dividend: 20 to 891
        mathCorrectAnswer = mult;
        displayOp = '÷';
    }

    document.getElementById('math-num1').textContent = num1;
    document.getElementById('math-num2').textContent = num2;
    document.getElementById('math-operator').textContent = displayOp;
    
    const input = document.getElementById('input-math-answer');
    if (input) {
        input.value = '';
        input.focus();
    }
}

function submitMathAnswer() {
    if (mathGameEnded || breakTimeRemaining <= 0) return;

    const input = document.getElementById('input-math-answer');
    if (!input) return;

    const val = parseInt(input.value);
    if (isNaN(val)) {
        alert("Please enter a numeric answer.");
        return;
    }

    const statusMsg = document.getElementById('math-status');
    
    if (val === mathCorrectAnswer) {
        mathScore++;
        statusMsg.className = 'game-status-msg correct';
        statusMsg.textContent = `✨ Correct!`;
        playSynthSound('claim');
    } else {
        statusMsg.className = 'game-status-msg wrong';
        statusMsg.textContent = `❌ Incorrect! Correct answer was ${mathCorrectAnswer}.`;
    }

    // Update score UI
    const scoreText = document.getElementById('math-score');
    if (scoreText) scoreText.textContent = mathScore;

    // Advance question index
    mathCurrentQuestionIndex++;

    // Disable input while showing answer brief delay
    input.disabled = true;
    const submitBtn = document.getElementById('btn-submit-math');
    if (submitBtn) submitBtn.disabled = true;
    const hintBtn = document.getElementById('btn-math-buy-hint');
    if (hintBtn) hintBtn.disabled = true;

    setTimeout(() => {
        if (mathCurrentQuestionIndex < 10) {
            input.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
            if (hintBtn) hintBtn.disabled = false;
            
            const currentQText = document.getElementById('math-current-q');
            if (currentQText) currentQText.textContent = (mathCurrentQuestionIndex + 1);
            statusMsg.textContent = '';
            
            generateMathQuestion();
        } else {
            endMathGame();
        }
    }, 1500);
}

function endMathGame() {
    mathGameEnded = true;

    const input = document.getElementById('input-math-answer');
    if (input) input.disabled = true;

    const submitBtn = document.getElementById('btn-submit-math');
    if (submitBtn) submitBtn.disabled = true;

    const hintBtn = document.getElementById('btn-math-buy-hint');
    if (hintBtn) hintBtn.disabled = true;

    const statusMsg = document.getElementById('math-status');
    if (mathScore >= 8) {
        statusMsg.className = 'game-status-msg correct';
        statusMsg.textContent = `🎉 Game Over! You scored ${mathScore}/10. You earned 💎 5!`;
        rewardUserForGameCompletion(5);
    } else {
        statusMsg.className = 'game-status-msg wrong';
        statusMsg.textContent = `😢 Game Over! You scored ${mathScore}/10. Score at least 8/10 to earn diamonds. Try again!`;
    }
}

function buyMathHint() {
    if (mathGameEnded || breakTimeRemaining <= 0) return;
    const cost = 5;
    const diamondsCount = parseInt(currentUser.diamonds) || 0;
    if (diamondsCount < cost) {
        alert(`Not enough diamonds! You have 💎 ${diamondsCount}, but need 💎 ${cost}.`);
        return;
    }

    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: -cost,
            streak_freezes: 0
        })
    })
    .then(res => res.json())
    .then(data => {
        currentUser.diamonds = data.diamonds;
        const dCount = document.getElementById('header-user-diamonds');
        if (dCount) dCount.textContent = data.diamonds || 0;

        document.getElementById('input-math-answer').value = mathCorrectAnswer;
        playSynthSound('claim');
        
        // Auto submit answer
        submitMathAnswer();
    })
    .catch(err => console.error('Error buying math hint:', err));
}

// -----------------------------------------------------------------------------
// GAME 6: TIC TAC TOE (BOT EDITION)
// -----------------------------------------------------------------------------

let tttBoard = ['', '', '', '', '', '', '', '', ''];
let tttGameActive = true;
let tttTurn = 'X'; // X is Player, O is Bot

function initTTTGame() {
    tttBoard = ['', '', '', '', '', '', '', '', ''];
    tttGameActive = true;
    tttTurn = 'X';

    const board = document.getElementById('ttt-grid-board');
    if (!board) return;

    board.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'ttt-cell';
        cell.setAttribute('data-index', i);
        cell.addEventListener('click', () => handleTTTCellClick(cell, i));
        board.appendChild(cell);
    }

    const statusMsg = document.getElementById('ttt-status');
    if (statusMsg) {
        statusMsg.className = 'game-status-msg';
        statusMsg.textContent = 'Your turn (X)';
    }

    const hintBtn = document.getElementById('btn-ttt-buy-hint');
    if (hintBtn) hintBtn.disabled = false;
}

function handleTTTCellClick(cellEl, index) {
    if (!tttGameActive || tttBoard[index] !== '' || tttTurn !== 'X' || breakTimeRemaining <= 0) return;

    // Player moves
    tttBoard[index] = 'X';
    cellEl.textContent = 'X';
    cellEl.classList.add('x-cell');

    // Check winner or draw
    if (checkTTTResult('X')) {
        endTTTGame('win');
        return;
    }
    if (tttBoard.every(c => c !== '')) {
        endTTTGame('draw');
        return;
    }

    // Switch to Bot
    tttTurn = 'O';
    const statusMsg = document.getElementById('ttt-status');
    if (statusMsg) {
        statusMsg.textContent = 'Bot is thinking...';
    }

    setTimeout(makeBotMove, 500);
}

function makeBotMove() {
    if (!tttGameActive || tttTurn !== 'O') return;

    // Calculate best move for O
    const bestIdx = getTTTBestMove('O');
    
    tttBoard[bestIdx] = 'O';
    const cellEl = document.querySelector(`.ttt-cell[data-index="${bestIdx}"]`);
    if (cellEl) {
        cellEl.textContent = 'O';
        cellEl.classList.add('o-cell');
    }

    // Check winner or draw
    if (checkTTTResult('O')) {
        endTTTGame('lose');
        return;
    }
    if (tttBoard.every(c => c !== '')) {
        endTTTGame('draw');
        return;
    }

    // Switch back to Player
    tttTurn = 'X';
    const statusMsg = document.getElementById('ttt-status');
    if (statusMsg) {
        statusMsg.textContent = 'Your turn (X)';
    }
}

function checkTTTResult(player) {
    const winCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    return winCombos.some(combo => {
        return combo.every(idx => tttBoard[idx] === player);
    });
}

function getTTTBestMove(player) {
    const opponent = player === 'O' ? 'X' : 'O';

    function findWinningMove(p) {
        const winCombos = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (let combo of winCombos) {
            const cells = combo.map(idx => tttBoard[idx]);
            const pCount = cells.filter(c => c === p).length;
            const emptyCount = cells.filter(c => c === '').length;

            if (pCount === 2 && emptyCount === 1) {
                // Return index of the empty cell
                const emptyOffset = cells.indexOf('');
                return combo[emptyOffset];
            }
        }
        return -1;
    }

    // 1. Can we win?
    let move = findWinningMove(player);
    if (move !== -1) return move;

    // 2. Do we need to block opponent?
    move = findWinningMove(opponent);
    if (move !== -1) return move;

    // 3. Take center if open
    if (tttBoard[4] === '') return 4;

    // 4. Take random corner
    const corners = [0, 2, 6, 8].filter(idx => tttBoard[idx] === '');
    if (corners.length > 0) {
        return corners[Math.floor(Math.random() * corners.length)];
    }

    // 5. Take random side
    const sides = [1, 3, 5, 7].filter(idx => tttBoard[idx] === '');
    if (sides.length > 0) {
        return sides[Math.floor(Math.random() * sides.length)];
    }

    return tttBoard.indexOf('');
}

function endTTTGame(result) {
    tttGameActive = false;
    const statusMsg = document.getElementById('ttt-status');
    const hintBtn = document.getElementById('btn-ttt-buy-hint');
    if (hintBtn) hintBtn.disabled = true;

    if (result === 'win') {
        if (statusMsg) {
            statusMsg.className = 'game-status-msg correct';
            statusMsg.textContent = '🎉 You won! You earned 💎 5!';
        }
        rewardUserForGameCompletion(5);
    } else if (result === 'lose') {
        if (statusMsg) {
            statusMsg.className = 'game-status-msg wrong';
            statusMsg.textContent = '😢 Bot won! Better luck next time!';
        }
    } else {
        if (statusMsg) {
            statusMsg.className = 'game-status-msg';
            statusMsg.textContent = "🤝 It's a draw!";
        }
    }
}

function buyTTTHint() {
    if (!tttGameActive || tttTurn !== 'X' || breakTimeRemaining <= 0) return;

    const cost = 5;
    const diamondsCount = parseInt(currentUser.diamonds) || 0;
    if (diamondsCount < cost) {
        alert(`Not enough diamonds! You have 💎 ${diamondsCount}, but need 💎 ${cost}.`);
        return;
    }

    fetch('/api/users/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            diamonds: -cost,
            streak_freezes: 0
        })
    })
    .then(res => res.json())
    .then(data => {
        currentUser.diamonds = data.diamonds;
        const dCount = document.getElementById('header-user-diamonds');
        if (dCount) dCount.textContent = data.diamonds || 0;

        // Best move for X
        const bestIdx = getTTTBestMove('X');
        
        tttBoard[bestIdx] = 'X';
        const cellEl = document.querySelector(`.ttt-cell[data-index="${bestIdx}"]`);
        if (cellEl) {
            cellEl.textContent = 'X';
            cellEl.classList.add('x-cell');
        }

        playSynthSound('claim');

        // Check win or draw
        if (checkTTTResult('X')) {
            endTTTGame('win');
            return;
        }
        if (tttBoard.every(c => c !== '')) {
            endTTTGame('draw');
            return;
        }

        // Switch to Bot
        tttTurn = 'O';
        const statusMsg = document.getElementById('ttt-status');
        if (statusMsg) {
            statusMsg.textContent = 'Bot is thinking...';
        }

        setTimeout(makeBotMove, 500);
    })
    .catch(err => console.error('Error buying Tic Tac Toe hint:', err));
}
