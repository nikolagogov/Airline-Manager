import { Game, getDefaultState, loadGameFromStorage, saveGame } from './game.js';
import { DOM, cacheElements, showElement, hideElement } from './cache.js';
import { baseCities } from './data.js';
import { 
    showToast, showConfirm, goldFlash, switchScreen, 
    refreshAll, updateLoanUI, updateSeasonUI, renderLoans,
    updateAircraftSelect, updateProfitPreview, updateSliderInfo,
    renderAircrafts, renderStatistics, renderAchievements
} from './ui.js';
import { AudioSystem } from './audio.js';
import { openBuyMenu } from './airlines.js';
import { renderRoutes } from './routes.js';
import { startFlightTimer } from './routes.js';
import { 
    auth, 
    onAuthChange,
    loadGameFromCloud,
    getAuthState
} from './firebase.js';
import { checkBankruptcy } from './state.js';

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    setupAuthAndGame();
});

function setupAuthAndGame() {
    const unsubscribe = onAuthChange(async (user) => {
        unsubscribe();
        
        // Load game - правилна инициализация!
        const saved = loadGameFromStorage();
        Game.state = Object.assign(getDefaultState(), saved || {});
        Game.cities = [...baseCities];
        
        // Load cloud save if logged in
        if (user) {
            const result = await loadGameFromCloud(user.uid);
            if (result.success && result.data) {
                Object.assign(Game.state, result.data);
                showToast('☁️ Cloud save loaded!');
            }
        }
        
        // Setup events
        setupEvents();
        loadGame();
        renderUI();
    });
}

// ==================== EVENTS ====================
function setupEvents() {
    document.body.addEventListener('click', handleClick);
    document.body.addEventListener('change', handleChange);
    document.body.addEventListener('input', handleInput);
}

function handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    const action = target.dataset.action;
    const screen = target.dataset.screen;
    
    switch(action) {
        case 'switchScreen':
            if (screen) switchScreen(screen);
            break;
        case 'openBuyMenu':
            openBuyMenu();
            break;
        case 'closeBuyMenu':
            hideElement('buyMenu');
            break;
        case 'buyAircraft':
            import('./airlines.js').then(m => m.buyAircraft(parseInt(target.dataset.id)));
            break;
        case 'sellAircraft':
            import('./airlines.js').then(m => m.sellSelectedAircraft());
            break;
        case 'startFlight':
            import('./routes.js').then(m => m.startFlight(parseInt(target.dataset.id)));
            break;
        case 'removeRoute':
            import('./routes.js').then(m => m.removeRoute(parseInt(target.dataset.id)));
            break;
        case 'takeLoan':
            import('./loans.js').then(m => m.takeLoan(parseInt(target.dataset.amount), parseInt(target.dataset.repayment)));
            break;
        case 'upgradeCity':
            import('./map.js').then(m => m.upgradeCity(target.dataset.id));
            break;
        case 'confirmUpgrade':
            import('./map.js').then(m => m.confirmUpgradeCity());
            break;
        case 'cancelUpgrade':
            import('./map.js').then(m => m.cancelUpgradeCity());
            break;
        case 'showUpgrades':
            import('./airlines.js').then(m => m.showUpgrades(target.dataset.id));
            break;
        case 'applyUpgrade':
            import('./airlines.js').then(m => m.applyUpgrade(target.dataset.id, target.dataset.upgrade));
            break;
        case 'resolveEvent':
            import('./events.js').then(m => m.resolveEvent(parseInt(target.dataset.idx)));
            break;
        case 'toggleDarkMode':
            toggleDarkMode();
            break;
        case 'toggleSound':
            AudioSystem.toggle();
            break;
        case 'exportGame':
            exportGame();
            break;
        case 'importGame':
            showElement('importDialog');
            break;
        case 'importConfirm':
            const data = DOM.importData?.value;
            if (data) { importGame(data); hideElement('importDialog'); }
            break;
        case 'importCancel':
            hideElement('importDialog');
            break;
        case 'newGame':
            newGame();
            break;
        case 'showPrestige':
            import('./prestige.js').then(m => m.showPrestigeDialog());
            break;
        case 'prestigeBtn':
            import('./prestige.js').then(m => m.showPrestigeDialog());
            break;
        case 'setHub':
            import('./map.js').then(m => m.setHub());
            break;
        case 'clearMap':
            import('./map.js').then(m => m.clearMapSelection());
            break;
        case 'createRoute':
            import('./routes.js').then(m => m.createRouteFromMap());
            break;
        case 'autoStart':
            import('./routes.js').then(m => m.autoStartAll());
            break;
        case 'randomizeName':
            import('./prestige.js').then(m => m.randomizeAirlineName());
            break;
        case 'buyBtn':
            openBuyMenu();
            break;
        case 'buyFleetBtn':
            openBuyMenu();
            break;
        case 'closeUpgrade':
            hideElement('upgradePanel');
            break;
        case 'payMaintenance':
            import('./routes.js').then(m => m.resolveMaintenancePay());
            break;
        case 'waitMaintenance':
            import('./routes.js').then(m => m.resolveMaintenanceWait());
            break;
        case 'nextTutorial':
            nextTutorialStep();
            break;
        case 'skipTutorial':
            finishTutorial();
            break;
        case 'confirmYes':
            if (Game.confirmResolve) {
                Game.confirmResolve(true);
                hideElement('confirmDialog');
                Game.confirmResolve = null;
            }
            break;
        case 'confirmNo':
            if (Game.confirmResolve) {
                Game.confirmResolve(false);
                hideElement('confirmDialog');
                Game.confirmResolve = null;
            }
            break;
        case 'acceptBailout':
            acceptBailout();
            break;
        default:
            console.log('Action:', action);
    }
}

function handleChange(e) {
    const target = e.target;
    if (target.id === 'airlineNameInput') {
        import('./prestige.js').then(m => m.updateAirlineName(target.value));
    }
    if (target.id === 'fleetSort' || target.id === 'fleetFilter') {
        renderAircrafts();
    }
    if (target.id === 'aircraftSelect') {
        updateProfitPreview();
    }
}

function handleInput(e) {
    const target = e.target;
    if (target.id === 'priceSlider') {
        Game.routePriceMultiplier = parseFloat(target.value);
        updateSliderInfo();
    }
}

// ==================== LOAD GAME ====================
function loadGame() {
    const state = Game.state;
    
    // Reset maintenance
    Game.pendingMaintenance = null;
    if (Game.maintenanceTimeout) {
        clearTimeout(Game.maintenanceTimeout);
        Game.maintenanceTimeout = null;
    }
    hideElement('maintenanceDialog');
    
    // Load airline name
    if (state.airlineName && DOM.airlineNameInput) {
        DOM.airlineNameInput.value = state.airlineName;
    }
    
    // Set selected aircraft
    if (state.selectedAircraftUniqueId === undefined ||
        !state.aircrafts.find(a => a.uniqueId === state.selectedAircraftUniqueId)) {
        state.selectedAircraftUniqueId = state.aircrafts[0]?.uniqueId || null;
    }
    
    // Restore active flights
    state.routes.forEach(r => {
        if (r.active && r.endTime > Date.now()) {
            startFlightTimer(r);
        } else if (r.active && r.endTime <= Date.now()) {
            r.active = false;
            r.endTime = null;
            const ac = state.aircrafts.find(a => a.uniqueId === r.aircraftUniqueId);
            if (ac) ac.busy = false;
        }
    });
    
    // Restore pending event
    if (state.pendingEvent) {
        showElement('eventPanel');
        const panel = DOM.eventPanel;
        if (panel) {
            panel.innerHTML = `
                <div>
                    <strong>⚠️ ${state.pendingEvent.text}</strong>
                    <div style="font-size:11px; color:var(--text-muted);">${state.pendingEvent.description}</div>
                </div>
                <div class="event-buttons">
                    ${state.pendingEvent.options.map((opt, idx) => `
                        <button class="btn" data-action="resolveEvent" data-idx="${idx}" style="font-size:11px; padding:4px 12px; min-height:30px;">${opt.text}</button>
                    `).join('')}
                </div>
            `;
        }
    }
    
    // Auth UI
    setupAuthUI();
    
    // Start game
    import('./state.js').then(m => {
        m.updateCompanyLevel();
    });
    import('./utils.js').then(m => {
        m.unlockNewCities();
    });
    
    refreshAll();
    startBackgroundProcesses();
    updateLoanUI();
    updateSeasonUI();
    loadDarkMode();
    checkTutorial();
    checkBankruptcy();
    
    if (document.querySelector('[data-screen]')) switchScreen('overview');
}

// ==================== RENDER UI ====================
function renderUI() {
    renderAircrafts();
    renderRoutes();
    renderStatistics();
    renderAchievements();
    renderLoans();
    updateAircraftSelect();
}

// ==================== AUTH UI ====================
function setupAuthUI() {
    const authForms = document.getElementById('authForms');
    const authUserInfo = document.getElementById('authUserInfo');
    const userEmailEl = document.getElementById('authUserEmail');
    const onlineBadge = document.querySelector('.online-badge');
    const loginBtn = document.getElementById('authLoginBtn');
    const registerBtn = document.getElementById('authRegisterBtn');
    const googleBtn = document.getElementById('authGoogleBtn');
    const logoutBtn = document.getElementById('authLogoutBtn');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    
    loginBtn?.addEventListener('click', async () => {
        const email = emailInput?.value?.trim();
        const password = passwordInput?.value?.trim();
        if (!email || !password) { showToast('Please enter email and password', true); return; }
        const { loginUser } = await import('./firebase.js');
        const result = await loginUser(email, password);
        if (result.success) {
            showToast('✅ Logged in!');
            emailInput.value = '';
            passwordInput.value = '';
        } else {
            showToast('❌ ' + result.error, true);
        }
    });
    
    registerBtn?.addEventListener('click', async () => {
        const email = emailInput?.value?.trim();
        const password = passwordInput?.value?.trim();
        if (!email || !password) { showToast('Please enter email and password', true); return; }
        if (password.length < 6) { showToast('Password must be at least 6 characters', true); return; }
        const { registerUser } = await import('./firebase.js');
        const result = await registerUser(email, password);
        if (result.success) {
            showToast('✅ Registered!');
            emailInput.value = '';
            passwordInput.value = '';
        } else {
            showToast('❌ ' + result.error, true);
        }
    });
    
    googleBtn?.addEventListener('click', async () => {
        const { loginWithGoogle } = await import('./firebase.js');
        const result = await loginWithGoogle();
        if (result.success) { showToast('✅ Logged in with Google!'); } 
        else { showToast('❌ ' + result.error, true); }
    });
    
    logoutBtn?.addEventListener('click', async () => {
        const { logoutUser } = await import('./firebase.js');
        await logoutUser();
        showToast('Logged out');
    });
    
    onAuthChange(async (user) => {
        const state = getAuthState(user);
        if (state.isLoggedIn) {
            authForms.style.display = 'none';
            authUserInfo.style.display = 'flex';
            userEmailEl.textContent = state.email;
            if (onlineBadge) onlineBadge.textContent = '● Online';
        } else {
            authForms.style.display = 'flex';
            authUserInfo.style.display = 'none';
            if (onlineBadge) onlineBadge.textContent = '● Offline';
        }
    });
    
    emailInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn?.click(); });
    passwordInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn?.click(); });
}

// ==================== DARK MODE ====================
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('airlineManagerDarkMode', isDark ? 'true' : 'false');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.innerText = isDark ? '☀️' : '🌙';
    showToast(isDark ? '🌙 Dark Mode' : '☀️ Light Mode');
}

function loadDarkMode() {
    const isDark = localStorage.getItem('airlineManagerDarkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) toggle.innerText = '☀️';
    }
}

// ==================== BANKRUPTCY ====================
export function acceptBailout() {
    const state = Game.state;
    state.money += 25000;
    state.loanActive = true;
    state.loanRemaining = 30000;
    saveGame();
    refreshAll();
    updateLoanUI();
    hideElement('bailoutDialog');
    showToast(`💶 Emergency loan granted!`);
}

// ==================== EXPORT / IMPORT ====================
export function exportGame() {
    const data = JSON.stringify(Game.state);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airline_save.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📤 Game exported!');
}

export function importGame(data) {
    try {
        const loaded = JSON.parse(data);
        Object.assign(Game.state, loaded);
        saveGame(true);
        showToast('📥 Game imported!');
        setTimeout(() => location.reload(), 1000);
    } catch (e) {
        showToast('❌ Invalid save!', true);
    }
}

export function newGame() {
    showConfirm('⚠️ Start a new game? All progress will be lost!').then(confirmed => {
        if (confirmed) {
            localStorage.removeItem('airlineManagerUltimate');
            location.reload();
        }
    });
}

// ==================== TUTORIAL ====================
const tutorialSteps = [
    { title: "✈️ Welcome!", text: "Buy your first aircraft!", action: () => { switchScreen('fleet'); setTimeout(openBuyMenu, 500); } },
    { title: "🛒 Buy Aircraft", text: "Buy the Cessna 208 - €28,000.", action: () => { switchScreen('fleet'); } },
    { title: "🗺️ Create Route", text: "Go to Map, select two cities, create route!", action: () => { switchScreen('map'); } },
    { title: "✈️ Start Flight", text: "Go to Routes and click START!", action: () => { switchScreen('routes'); } },
    { title: "💰 Earn Profit", text: "Wait for flight to complete!", action: () => { switchScreen('overview'); } },
    { title: "🏆 You're Ready!", text: "Build your airline empire!", action: () => {} }
];

let currentTutorialStep = 0;

function startTutorial() {
    const state = Game.state;
    if (state.tutorialCompleted) return;
    currentTutorialStep = 0;
    showTutorialStep();
}

function showTutorialStep() {
    if (currentTutorialStep >= tutorialSteps.length) { finishTutorial(); return; }
    const step = tutorialSteps[currentTutorialStep];
    if (DOM.tutorialTitle) DOM.tutorialTitle.innerText = step.title;
    if (DOM.tutorialText) DOM.tutorialText.innerText = step.text;
    if (DOM.tutorialProgress) DOM.tutorialProgress.innerText = `Step ${currentTutorialStep + 1} of ${tutorialSteps.length}`;
    const nextBtn = document.getElementById('tutorialNextBtn');
    if (nextBtn) nextBtn.innerText = currentTutorialStep === tutorialSteps.length - 1 ? '🎉 Finish' : 'Next →';
    showElement('tutorialOverlay');
    if (step.action) setTimeout(step.action, 500);
}

function nextTutorialStep() {
    currentTutorialStep++;
    if (currentTutorialStep >= tutorialSteps.length) finishTutorial();
    else showTutorialStep();
}

function finishTutorial() {
    hideElement('tutorialOverlay');
    const state = Game.state;
    state.tutorialCompleted = true;
    saveGame();
    showToast('🎉 Welcome aboard, Captain!');
}

function checkTutorial() {
    const state = Game.state;
    if (!state.tutorialCompleted && state.aircrafts.length === 0) {
        setTimeout(startTutorial, 1000);
    }
}

// ==================== BACKGROUND PROCESSES ====================
function startBackgroundProcesses() {
    import('./utils.js').then(m => {
        setInterval(() => m.recoverDemands(), 60000);
    });
    
    setInterval(() => {
        const state = Game.state;
        let change = (Math.random() - 0.5) * 0.15;
        state.fuelPrice = Math.max(1.0, Math.min(3.2, state.fuelPrice + change));
        saveGame();
        import('./ui.js').then(ui => ui.refreshStats());
    }, 90000);
    
    setInterval(() => {
        if (Math.random() < 0.25) {
            import('./events.js').then(m => m.triggerRandomEvent());
        }
    }, 120000);
    
    setInterval(() => {
        updateSeasonUI();
        refreshAll();
    }, 3600000);
}

// ==================== ЕКСПОРТИ ====================
export { startFlightTimer };