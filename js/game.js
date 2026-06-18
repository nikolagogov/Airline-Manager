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
const CLOUD_SAVE_INTERVAL = 60000; // 1 минута между cloud saves
let saveInProgress = false;

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
        // Local save (винаги)
        localStorage.setItem('airlineManagerUltimate', JSON.stringify(data));
        
        // Cloud save - само ако има логнат потребител и е минало достатъчно време
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

// ==================== SAVE ON UNLOAD (без sendBeacon) ====================
let unloadSaveAttempted = false;

async function performUnloadSave() {
    // Предотвратяване на множество опити
    if (unloadSaveAttempted) return;
    unloadSaveAttempted = true;
    
    if (auth.currentUser && Game.state) {
        const data = Game.state;
        try {
            // Local save
            localStorage.setItem('airlineManagerUltimate', JSON.stringify(data));
            
            // Cloud save - използваме съществуващата функция с Firebase SDK
            await saveGameToCloud(auth.currentUser.uid, data);
            console.log('💾 Unload cloud save completed');
        } catch (e) {
            console.warn('Unload save failed:', e);
        }
    }
}

// ==================== СТРАТЕГИЯ ЗА ЗАПИС ПРИ ИЗЛИЗАНЕ ====================
// 1. visibilitychange - когато потребителят сменя таба (най-надеждно)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Имаме време да изпълним async операция
        performUnloadSave();
    }
});

// 2. beforeunload - като резервен вариант (без sendBeacon)
window.addEventListener('beforeunload', () => {
    // Използваме синхронен localStorage запис + async cloud опит
    if (auth.currentUser && Game.state) {
        const data = Game.state;
        localStorage.setItem('airlineManagerUltimate', JSON.stringify(data));
        
        // Опитваме cloud save, но не чакаме (браузърът може да прекъсне)
        // Използваме Promise без await за fire-and-forget
        saveGameToCloud(auth.currentUser.uid, data)
            .then(() => console.log('💾 Beforeunload cloud save initiated'))
            .catch(() => {});
    }
});

// ==================== EXPORT STATE ====================
export let gameState = Game.state;