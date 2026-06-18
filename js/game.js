import { cacheElements } from './cache.js';
import { auth, saveGameToCloud } from './firebase.js';

// ==================== GAME OBJECT ====================
export const Game = {
    state: null,
    timers: {},
    map: null,
    markers: {},
    mapNeedsUpdate: false,
    selectedStart: null,
    selectedEnd: null,
    routePriceMultiplier: 1.0,
    confirmResolve: null,
    pendingUpgrade: null,
    pendingMaintenance: null,
    maintenanceTimeout: null,
    cities: [],
    unlockToastTimeout: null,
    intervals: {
        demandRecovery: null,
        fuelFluctuation: null,
        event: null,
        season: null,
        effects: null
    },
    routeAnalytics: {},
    prestigeLevel: 0,
    prestigeBonuses: {
        moneyMultiplier: 1,
        demandMultiplier: 1,
        fuelDiscount: 0
    },
    tutorialStep: 0,
    tutorialCompleted: false,
    airlineName: "Skyline Airways",
    airlineLogo: "✈️"
};

// ==================== DEFAULT STATE ====================
export function getDefaultState() {
    return {
        money: 30000,
        totalRevenue: 0,
        aircrafts: [],
        routes: [],
        selectedAircraftUniqueId: null,
        fuelPrice: 1.80,
        routeDemand: {},
        pendingEvent: null,
        discountPercent: 0,
        loanActive: false,
        loanRemaining: 0,
        loanCooldown: 0,
        loanHistory: [],
        totalFlights: 0,
        totalDistance: 0,
        routeStats: {},
        achievements: [],
        longHaulCompleted: false,
        anyUpgrade: false,
        hubCity: null,
        hubSet: false,
        companyLevel: 1,
        cityUpgrades: {},
        activeEffects: {},
        prestigeLevel: 0,
        prestigeBonuses: {
            moneyMultiplier: 1,
            demandMultiplier: 1,
            fuelDiscount: 0
        },
        tutorialCompleted: false,
        airlineName: "Skyline Airways",
        airlineLogo: "✈️"
    };
}

// ==================== SAVE SYSTEM ====================
let saveDebounceTimer = null;
let saveQueue = [];
let isSaving = false;
let lastCloudSave = 0;
const CLOUD_SAVE_INTERVAL = 60000;

export function updateSaveStatus(status, isError = false) {
    const el = document.getElementById('saveStatus');
    if (el) {
        el.innerText = status;
        el.style.color = isError ? '#ef4444' : '#10b981';
    }
}

async function processSaveQueue() {
    if (isSaving || saveQueue.length === 0) return;
    isSaving = true;
    const data = saveQueue.pop();
    saveQueue = [];
    
    try {
        // Local save
        localStorage.setItem('airlineManagerUltimate', JSON.stringify(data));
        
        // Cloud save
        const now = Date.now();
        if (auth.currentUser && (now - lastCloudSave) > CLOUD_SAVE_INTERVAL) {
            lastCloudSave = now;
            const result = await saveGameToCloud(auth.currentUser.uid, data);
            if (result.success) {
                updateSaveStatus('☁️ Cloud saved');
            } else {
                updateSaveStatus('💾 Local only');
            }
        } else {
            updateSaveStatus('💾 Saved');
        }
    } catch (e) {
        console.warn('Save failed:', e);
        updateSaveStatus('❌ Error', true);
    } finally {
        isSaving = false;
        if (saveQueue.length > 0) processSaveQueue();
    }
}

export function saveGame(immediate = false) {
    if (!Game.state) return;
    const data = Game.state;
    
    if (immediate) {
        clearTimeout(saveDebounceTimer);
        saveQueue.push(data);
        processSaveQueue();
    } else {
        updateSaveStatus('⏳ Saving...');
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            saveQueue.push(data);
            processSaveQueue();
        }, 2500);
    }
}

export function loadGameFromStorage() {
    const saved = localStorage.getItem('airlineManagerUltimate');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            const defaults = getDefaultState();
            for (let key in defaults) {
                if (data[key] === undefined) {
                    data[key] = defaults[key];
                }
            }
            return data;
        } catch (e) {
            console.warn('Load failed:', e);
        }
    }
    return null;
}

// ==================== SAVE ON UNLOAD ====================
document.addEventListener('visibilitychange', () => {
    if (document.hidden && auth.currentUser && Game.state) {
        const data = Game.state;
        saveGameToCloud(auth.currentUser.uid, data);
    }
});

window.addEventListener('beforeunload', () => {
    if (auth.currentUser && Game.state) {
        const data = Game.state;
        localStorage.setItem('airlineManagerUltimate', JSON.stringify(data));
    }
});