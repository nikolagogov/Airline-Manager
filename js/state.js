import { Game } from './game.js';
import { aircraftDB, achievementsDB } from './data.js';
import { showToast, refreshAll } from './ui.js';
import { AudioSystem } from './audio.js';
import { saveGame } from './game.js';
import { DOM } from './cache.js';
import { getDemandKey, calculateOccupancy, unlockNewCities } from './utils.js';

// ==================== STATISTICS ====================
export function updateStatistics(route, profit) {
    const state = Game.state;
    state.totalFlights++;
    state.totalDistance += route.distance;
    
    if (route.distance > 2000 && !state.longHaulCompleted) {
        state.longHaulCompleted = true;
        checkAchievements();
    }
    
    const key = getDemandKey(route.from, route.to);
    if (!state.routeStats) state.routeStats = {};
    if (!state.routeStats[key]) {
        state.routeStats[key] = {
            flights: 0,
            totalProfit: 0,
            distance: route.distance,
            fromName: route.fromName,
            toName: route.toName
        };
    }
    state.routeStats[key].flights++;
    state.routeStats[key].totalProfit += profit;
    
    // Route analytics
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
        state.routeDemand[getDemandKey(route.from, route.to)]?.demand || 1.0,
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
    const state = Game.state;
    let changed = false;
    for (let ach of achievementsDB) {
        if (!state.achievements.includes(ach.id) && ach.condition(state)) {
            state.achievements.push(ach.id);
            state.money += ach.reward;
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

// ==================== COMPANY LEVEL ====================
export function updateCompanyLevel() {
    const state = Game.state;
    const req = [0, 80000, 250000, 650000, 1400000, 2800000, 5500000, 9000000, 14000000, 22000000];
    let level = 1;
    for (let i = 1; i < req.length; i++) {
        if (state.totalRevenue >= req[i]) level = i + 1;
        else break;
    }
    if (state.companyLevel !== level) {
        state.companyLevel = level;
        unlockNewCities();
    }
    
    const el = DOM.companyLevel;
    if (el) el.innerText = level;
    
    const nextReq = req[level] || req[req.length - 1];
    const nextEl = DOM.nextLevelReq;
    if (nextEl) nextEl.innerHTML = `€${nextReq.toLocaleString()}`;
    
    const prevReq = req[level - 1] || 0;
    const progress = ((state.totalRevenue - prevReq) / (nextReq - prevReq)) * 100;
    const progressEl = DOM.levelProgress;
    if (progressEl) progressEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
}

// ==================== BANKRUPTCY ====================
export function checkBankruptcy() {
    const state = Game.state;
    const cheapest = Math.min(...aircraftDB.map(a => a.price));
    const hasPending = state.routes.some(r => !r.active);
    if (state.aircrafts.length === 0 && state.money < cheapest && !state.loanActive && !hasPending) {
        const msgEl = DOM.bailoutMessage;
        if (msgEl) {
            msgEl.innerHTML = `You have no aircraft and €${Math.floor(state.money).toLocaleString()}.<br>Emergency loan of €25,000 with 50% repayment.`;
        }
        const dialog = DOM.bailoutDialog;
        if (dialog) dialog.style.display = 'block';
    }
}