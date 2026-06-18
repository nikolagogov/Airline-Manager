import { startFlightTimer } from './routes.js';
import { Game, gameState, getDefaultState, loadGameFromStorage, saveGame, updateSaveStatus } from './game.js';
import { DOM, cacheElements, updateText, updateHTML, showElement, hideElement } from './cache.js';
import { aircraftDB, baseCities, achievementsDB } from './data.js';
import { 
    showToast, showConfirm, goldFlash, switchScreen, 
    refreshAll, updateLoanUI, updateSeasonUI, renderAchievements, renderLoans,
    updateAircraftSelect, updateProfitPreview, updateSliderInfo,
    renderAircrafts, renderRoutes, renderStatistics, renderOverview, renderRouteAnalytics
} from './ui.js';
import { AudioSystem } from './audio.js';
import { 
    openBuyMenu, closeBuyMenu, buyAircraft, sellSelectedAircraft,
    showUpgrades, applyUpgrade
} from './airlines.js';
import {
    createRouteFromMap, startFlight, removeRoute, autoStartAll,
    resolveMaintenancePay, resolveMaintenanceWait
} from './routes.js';
import {
    getCreditScore, getMaxActiveLoans, getLoanCooldown, getAvailableLoans,
    renderLoans as renderLoansFn, takeLoan, applyLoanRepayment
} from './loans.js';
import {
    triggerRandomEvent, resolveEvent
} from './events.js';
import {
    initMap, updateMapMarkers, upgradeCity, confirmUpgradeCity, cancelUpgradeCity,
    clearMapSelection, setHub
} from './map.js';
import {
    updateAirlineName, randomizeAirlineName, showPrestigeDialog, performPrestige
} from './prestige.js';
import { 
    auth, 
    loginUser, 
    registerUser, 
    loginWithGoogle, 
    logoutUser, 
    onAuthChange,
    loadGameFromCloud,
    saveToLeaderboard,
    loadLeaderboard,
    getAuthState
} from './firebase.js';

// ==================== LEADERBOARD CACHE ====================
let leaderboardCache = {
    data: null,
    lastUpdate: 0,
    cacheDuration: 300000
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    setupAuthAndGame();
});

function setupAuthAndGame() {
    const unsubscribe = onAuthChange(async (user) => {
        unsubscribe();
        
        const saved = loadGameFromStorage();
        if (saved) {
            Object.assign(gameState, saved);
        } else {
            const defaults = getDefaultState();
            Object.assign(gameState, defaults);
        }
        Game.state = gameState;
        Game.cities = [...baseCities];
        
        if (user) {
            const result = await loadGameFromCloud(user.uid);
            if (result.success && result.data) {
                Object.assign(gameState, result.data);
                showToast('☁️ Cloud save loaded!');
            }
        }
        
        setupEventDelegation();
        setupMapHandling();
        setupAuthUI();
        loadGame();
    });
}

// ==================== EVENT DELEGATION ====================
function setupEventDelegation() {
    document.body.addEventListener('click', handleGlobalClick);
    document.body.addEventListener('change', handleGlobalChange);
    document.body.addEventListener('input', handleGlobalInput);
}

function handleGlobalClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    
    const action = target.dataset.action;
    
    switch(action) {
        case 'switchScreen': switchScreen(target.dataset.screen); break;
        case 'openBuyMenu': openBuyMenu(); break;
        case 'closeBuyMenu': closeBuyMenu(); break;
        case 'buyAircraft': buyAircraft(parseInt(target.dataset.id)); break;
        case 'sellAircraft': sellSelectedAircraft(); break;
        case 'startFlight': startFlight(parseInt(target.dataset.id)); break;
        case 'removeRoute': removeRoute(parseInt(target.dataset.id)); break;
        case 'takeLoan': takeLoan(parseInt(target.dataset.amount), parseInt(target.dataset.repayment)); break;
        case 'upgradeCity': upgradeCity(target.dataset.id); break;
        case 'confirmUpgrade': confirmUpgradeCity(); break;
        case 'cancelUpgrade': cancelUpgradeCity(); break;
        case 'showUpgrades': showUpgrades(target.dataset.id); break;
        case 'applyUpgrade': applyUpgrade(target.dataset.id, target.dataset.upgrade); break;
        case 'resolveEvent': resolveEvent(parseInt(target.dataset.idx)); break;
        case 'toggleDarkMode': toggleDarkMode(); break;
        case 'toggleSound': AudioSystem.toggle(); break;
        case 'exportGame': exportGame(); break;
        case 'importGame': importGamePrompt(); break;
        case 'newGame': newGame(); break;
        case 'showPrestige': showPrestigeDialog(); break;
        case 'setHub': setHub(); break;
        case 'clearMap': clearMapSelection(); break;
        case 'createRoute': createRouteFromMap(); break;
        case 'autoStart': autoStartAll(); break;
        case 'randomizeName': randomizeAirlineName(); break;
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
        case 'acceptBailout': acceptBailout(); break;
        case 'importConfirm':
            const data = DOM.importData?.value;
            if (data) { importGame(data); hideElement('importDialog'); }
            break;
        case 'importCancel': hideElement('importDialog'); break;
        case 'nextTutorial': nextTutorialStep(); break;
        case 'skipTutorial': finishTutorial(); break;
        case 'closeUpgrade': hideElement('upgradePanel'); break;
        case 'payMaintenance': resolveMaintenancePay(); break;
        case 'waitMaintenance': resolveMaintenanceWait(); break;
        case 'prestigeBtn': showPrestigeDialog(); break;
        case 'buyBtn': openBuyMenu(); break;
        case 'buyFleetBtn': openBuyMenu(); break;
        default: console.warn('Unknown action:', action);
    }
}

function handleGlobalChange(e) {
    const target = e.target;
    if (target.id === 'airlineNameInput') updateAirlineName(target.value);
    if (target.id === 'fleetSort' || target.id === 'fleetFilter') renderAircrafts();
    if (target.id === 'aircraftSelect') updateProfitPreview();
}

function handleGlobalInput(e) {
    const target = e.target;
    if (target.id === 'priceSlider') {
        Game.routePriceMultiplier = parseFloat(target.value);
        updateSliderInfo();
    }
}

// ==================== MAP HANDLING ====================
function setupMapHandling() {
    const mapBtn = document.querySelector('[data-screen="map"]');
    if (mapBtn) {
        mapBtn.addEventListener('click', () => {
            const mapScreen = document.getElementById('screen-map');
            const onTransitionEnd = () => {
                if (Game.map) { Game.map.invalidateSize(); } else { initMap(); }
                mapScreen.removeEventListener('transitionend', onTransitionEnd);
                updateProfitPreview();
            };
            mapScreen.addEventListener('transitionend', onTransitionEnd);
            setTimeout(() => {
                mapScreen.removeEventListener('transitionend', onTransitionEnd);
                if (Game.map) Game.map.invalidateSize();
                else initMap();
                updateProfitPreview();
            }, 300);
        });
    }
}

// ==================== AUTH UI ====================
let currentUser = null;

function setupAuthUI() {
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const loginBtn = document.getElementById('authLoginBtn');
    const registerBtn = document.getElementById('authRegisterBtn');
    const googleBtn = document.getElementById('authGoogleBtn');
    const logoutBtn = document.getElementById('authLogoutBtn');
    const authForms = document.getElementById('authForms');
    const authUserInfo = document.getElementById('authUserInfo');
    const userEmailEl = document.getElementById('authUserEmail');
    const onlineBadge = document.querySelector('.online-badge');
    
    loginBtn?.addEventListener('click', async () => {
        const email = emailInput?.value?.trim();
        const password = passwordInput?.value?.trim();
        if (!email || !password) { showToast('Please enter email and password', true); return; }
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
        const result = await loginWithGoogle();
        if (result.success) { showToast('✅ Logged in with Google!'); } 
        else { showToast('❌ ' + result.error, true); }
    });
    
    logoutBtn?.addEventListener('click', async () => {
        await logoutUser();
        showToast('Logged out');
    });
    
    onAuthChange(async (user) => {
        currentUser = user;
        const authState = getAuthState(user);
        if (authState.isLoggedIn) {
            authForms.style.display = 'none';
            authUserInfo.style.display = 'flex';
            userEmailEl.textContent = authState.email;
            if (onlineBadge) onlineBadge.textContent = '● Online';
            await saveToLeaderboard(user.uid, authState.displayName || authState.email || 'Anonymous', gameState);
        } else {
            authForms.style.display = 'flex';
            authUserInfo.style.display = 'none';
            if (onlineBadge) onlineBadge.textContent = '● Offline';
        }
    });
    
    emailInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn?.click(); });
    passwordInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn?.click(); });
}

// ==================== LOAD GAME ====================
function loadGame() {
    Game.pendingMaintenance = null;
    if (Game.maintenanceTimeout) {
        clearTimeout(Game.maintenanceTimeout);
        Game.maintenanceTimeout = null;
    }
    hideElement('maintenanceDialog');
    
    if (gameState.airlineName && DOM.airlineNameInput) {
        DOM.airlineNameInput.value = gameState.airlineName;
    }
    
    if (gameState.selectedAircraftUniqueId === undefined ||
        !gameState.aircrafts.find(a => a.uniqueId === gameState.selectedAircraftUniqueId)) {
        gameState.selectedAircraftUniqueId = gameState.aircrafts[0]?.uniqueId || null;
    }
    
    gameState.routes.forEach(r => {
        if (r.active && r.endTime > Date.now()) {
            startFlightTimer(r);
        } else if (r.active && r.endTime <= Date.now()) {
            r.active = false;
            r.endTime = null;
            const ac = gameState.aircrafts.find(a => a.uniqueId === r.aircraftUniqueId);
            if (ac) ac.busy = false;
        }
    });
    
    if (gameState.pendingEvent) {
        showElement('eventPanel');
        const panel = DOM.eventPanel;
        if (panel) {
            panel.innerHTML = `
                <div>
                    <strong>⚠️ ${gameState.pendingEvent.text}</strong>
                    <div style="font-size:11px; color:var(--text-muted);">${gameState.pendingEvent.description}</div>
                </div>
                <div class="event-buttons">
                    ${gameState.pendingEvent.options.map((opt, idx) => `
                        <button class="btn" data-action="resolveEvent" data-idx="${idx}" style="font-size:11px; padding:4px 12px; min-height:30px;">${opt.text}</button>
                    `).join('')}
                </div>
            `;
        }
    }
    
    updateCompanyLevel();
    unlockNewCities();
    refreshAll();
    startBackgroundProcesses();
    updateLoanUI();
    updateSeasonUI();
    loadDarkMode();
    checkTutorial();
    checkBankruptcy();
    checkAchievements();
    
    if (document.querySelector('[data-screen]')) switchScreen('overview');
}

// ==================== DARK MODE ====================
export function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('airlineManagerDarkMode', isDark ? 'true' : 'false');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.innerText = isDark ? '☀️' : '🌙';
    showToast(isDark ? '🌙 Dark Mode' : '☀️ Light Mode');
}

export function loadDarkMode() {
    const isDark = localStorage.getItem('airlineManagerDarkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) toggle.innerText = '☀️';
    }
}

// ==================== BANKRUPTCY ====================
export function checkBankruptcy() {
    const cheapest = Math.min(...aircraftDB.map(a => a.price));
    const hasPending = gameState.routes.some(r => !r.active);
    if (gameState.aircrafts.length === 0 && gameState.money < cheapest && !gameState.loanActive && !hasPending) {
        if (DOM.bailoutMessage) {
            DOM.bailoutMessage.innerHTML = 
                `You have no aircraft and €${Math.floor(gameState.money).toLocaleString()}.<br>Emergency loan of €25,000 with 50% repayment.`;
        }
        showElement('bailoutDialog');
    }
}

export function acceptBailout() {
    gameState.money += 25000;
    gameState.loanActive = true;
    gameState.loanRemaining = 30000;
    saveGame();
    refreshAll();
    updateLoanUI();
    hideElement('bailoutDialog');
    showToast(`💶 Emergency loan granted!`);
}

// ==================== EXPORT / IMPORT ====================
export function exportGame() {
    const data = JSON.stringify(gameState);
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

export function importGamePrompt() {
    showElement('importDialog');
}

export function importGame(data) {
    try {
        const loaded = JSON.parse(data);
        Object.assign(gameState, loaded);
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

// ==================== STATISTICS ====================
export function updateStatistics(route, profit) {
    gameState.totalFlights++;
    gameState.totalDistance += route.distance;
    
    if (route.distance > 2000 && !gameState.longHaulCompleted) {
        gameState.longHaulCompleted = true;
        checkAchievements();
    }
    
    const key = getDemandKey(route.from, route.to);
    if (!gameState.routeStats) gameState.routeStats = {};
    if (!gameState.routeStats[key]) {
        gameState.routeStats[key] = {
            flights: 0,
            totalProfit: 0,
            distance: route.distance,
            fromName: route.fromName,
            toName: route.toName
        };
    }
    gameState.routeStats[key].flights++;
    gameState.routeStats[key].totalProfit += profit;
    
    const routeKey = `${route.from}-${route.to}`;
    if (!Game.routeAnalytics) Game.routeAnalytics = {};
    if (!Game.routeAnalytics[routeKey]) {
        Game.routeAnalytics[routeKey] = {
            flights: 0,
            totalProfit: 0,
            totalDistance: 0,
            occupancyHistory: [],
            profitHistory: []
        };
    }
    const analytics = Game.routeAnalytics[routeKey];
    analytics.flights++;
    analytics.totalProfit += profit;
    analytics.totalDistance += route.distance;
    analytics.occupancyHistory.push(calculateOccupancy(
        gameState.routeDemand[getDemandKey(route.from, route.to)]?.demand || 1.0,
        route.priceMultiplier,
        route.capacity,
        route.from
    ));
    analytics.profitHistory.push(profit);
    if (analytics.occupancyHistory.length > 20) analytics.occupancyHistory.shift();
    if (analytics.profitHistory.length > 20) analytics.profitHistory.shift();
    
    saveGame();
    checkAchievements();
    updateCompanyLevel();
}

// ==================== ACHIEVEMENTS ====================
export function checkAchievements() {
    let changed = false;
    for (let ach of achievementsDB) {
        if (!gameState.achievements.includes(ach.id) && ach.condition(gameState)) {
            gameState.achievements.push(ach.id);
            gameState.money += ach.reward;
            showToast(`🏆 ${ach.name}! +€${ach.reward.toLocaleString()}`);
            AudioSystem.play('achievement');
            changed = true;
        }
    }
    if (changed) {
        saveGame();
        refreshAll();
    }
}

// ==================== ACTIVE EFFECTS ====================
export function checkActiveEffects() {
    if (!gameState.activeEffects) return;
    const now = Date.now();
    let changed = false;
    
    for (let key in gameState.activeEffects) {
        const effect = gameState.activeEffects[key];
        if (effect.endTime && now >= effect.endTime) {
            delete gameState.activeEffects[key];
            changed = true;
            if (effect.message) {
                showToast(`⏰ ${effect.message} expired`);
            }
        }
    }
    
    if (changed) {
        saveGame();
        refreshAll();
    }
}

// ==================== TUTORIAL ====================
const tutorialSteps = [
    {
        title: "✈️ Welcome to Airline Manager!",
        text: "Build your airline empire from the ground up. Start by buying your first aircraft!",
        action: () => { switchScreen('fleet'); setTimeout(openBuyMenu, 500); }
    },
    {
        title: "🛒 Buy Your First Aircraft",
        text: "Buy the Cessna 208 - it's perfect for short routes and costs €28,000.",
        action: () => { switchScreen('fleet'); }
    },
    {
        title: "🗺️ Create Your First Route",
        text: "Go to the Map screen, select two cities, and create your first route!",
        action: () => { switchScreen('map'); }
    },
    {
        title: "✈️ Start Your Flight",
        text: "Go to Routes and click START to begin your first flight.",
        action: () => { switchScreen('routes'); }
    },
    {
        title: "💰 Earn Your First Profit",
        text: "Wait for the flight to complete and watch your money grow!",
        action: () => { switchScreen('overview'); }
    },
    {
        title: "🏆 You're Ready!",
        text: "You're now ready to build your airline empire! Buy more planes, open new routes, and dominate the skies!",
        action: () => {}
    }
];

let currentTutorialStep = 0;

export function startTutorial() {
    if (gameState.tutorialCompleted) return;
    currentTutorialStep = 0;
    showTutorialStep();
}

export function showTutorialStep() {
    if (currentTutorialStep >= tutorialSteps.length) {
        finishTutorial();
        return;
    }
    
    const step = tutorialSteps[currentTutorialStep];
    if (DOM.tutorialTitle) DOM.tutorialTitle.innerText = step.title;
    if (DOM.tutorialText) DOM.tutorialText.innerText = step.text;
    if (DOM.tutorialProgress) DOM.tutorialProgress.innerText = `Step ${currentTutorialStep + 1} of ${tutorialSteps.length}`;
    
    const nextBtn = document.getElementById('tutorialNextBtn');
    if (nextBtn) {
        nextBtn.innerText = currentTutorialStep === tutorialSteps.length - 1 ? '🎉 Finish' : 'Next →';
    }
    
    showElement('tutorialOverlay');
    if (step.action) {
        setTimeout(step.action, 500);
    }
}

export function nextTutorialStep() {
    currentTutorialStep++;
    if (currentTutorialStep >= tutorialSteps.length) {
        finishTutorial();
    } else {
        showTutorialStep();
    }
}

export function finishTutorial() {
    hideElement('tutorialOverlay');
    gameState.tutorialCompleted = true;
    saveGame();
    showToast('🎉 Welcome aboard, Captain!');
}

export function checkTutorial() {
    if (!gameState.tutorialCompleted && gameState.aircrafts.length === 0) {
        setTimeout(startTutorial, 1000);
    }
}

// ==================== LEADERBOARD ====================
export async function renderLeaderboard() {
    const container = document.getElementById('leaderboardList');
    if (!container) return;
    
    const now = Date.now();
    
    if (leaderboardCache.data && (now - leaderboardCache.lastUpdate) < leaderboardCache.cacheDuration) {
        renderLeaderboardHTML(container, leaderboardCache.data);
        return;
    }
    
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading...</div>';
    
    const result = await loadLeaderboard();
    if (!result.success || result.data.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No entries yet. Be the first!</div>';
        return;
    }
    
    leaderboardCache.data = result.data;
    leaderboardCache.lastUpdate = now;
    
    renderLeaderboardHTML(container, result.data);
}

function renderLeaderboardHTML(container, data) {
    container.innerHTML = data.slice(0, 20).map((entry, i) => `
        <div style="display:flex; justify-content:space-between; padding:10px 12px; border-bottom:1px solid var(--border-color); transition:background 0.3s;">
            <div style="display:flex; gap:12px; align-items:center;">
                <span style="font-weight:bold; color:var(--primary); font-size:16px;">#${i+1}</span>
                <span style="color:var(--text-primary);">${entry.displayName || 'Anonymous'}</span>
            </div>
            <div style="display:flex; gap:16px; font-size:12px; color:var(--text-muted); flex-wrap:wrap;">
                <span>💰 €${(entry.revenue || 0).toLocaleString()}</span>
                <span>✈️ ${entry.aircrafts || 0}</span>
                <span>🛣️ ${entry.flights || 0}</span>
                <span>🏢 Lv.${entry.level || 1}</span>
            </div>
        </div>
    `).join('');
}

// ==================== BACKGROUND PROCESSES ====================
export function startBackgroundProcesses() {
    if (Game.intervals.demandRecovery) clearInterval(Game.intervals.demandRecovery);
    Game.intervals.demandRecovery = setInterval(() => recoverDemands(), 60000);
    
    if (Game.intervals.fuelFluctuation) clearInterval(Game.intervals.fuelFluctuation);
    Game.intervals.fuelFluctuation = setInterval(() => {
        let change = (Math.random() - 0.5) * 0.15;
        gameState.fuelPrice = Math.max(1.0, Math.min(3.2, gameState.fuelPrice + change));
        saveGame();
        refreshStats();
    }, 90000);
    
    if (Game.intervals.event) clearInterval(Game.intervals.event);
    Game.intervals.event = setInterval(() => {
        if (Math.random() < 0.25) triggerRandomEvent();
    }, 120000);
    
    if (Game.intervals.season) clearInterval(Game.intervals.season);
    Game.intervals.season = setInterval(() => {
        updateSeasonUI();
        refreshAll();
    }, 3600000);
    
    if (Game.intervals.effects) clearInterval(Game.intervals.effects);
    Game.intervals.effects = setInterval(checkActiveEffects, 10000);
}

// ==================== ЕДИНСТВЕН ЕКСПОРТ ====================
export { startFlightTimer, renderLeaderboard };