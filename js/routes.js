import { Game, saveGame } from './game.js';
import { DOM, showElement, hideElement } from './cache.js';
import { getDemandKey, computeFlightProfit, calculateOccupancy, updateDemand, getDistance, getMaxSlots, getCitySlotUsage } from './utils.js';
import { showToast, showConfirm, refreshAll } from './ui.js';
import { AudioSystem } from './audio.js';
import { updateStatistics, checkBankruptcy } from './state.js';
import { applyLoanRepayment } from './loans.js';
import { getMaintenanceCost } from './utils.js';

// ==================== ROUTE CREATION ====================
export async function createRouteFromMap() {
    const state = Game.state;
    if (!Game.selectedStart || !Game.selectedEnd) {
        showToast('Select start and destination', true);
        return;
    }
    
    const aid = DOM.aircraftSelect?.value;
    if (!aid) {
        showToast('Select an aircraft', true);
        return;
    }
    
    const ac = state.aircrafts.find(a => a.uniqueId === aid);
    if (!ac) return;
    if (ac.busy || ac.maintenance) {
        showToast('Aircraft not available', true);
        return;
    }
    
    const startMaxSlots = getMaxSlots(Game.selectedStart.id);
    const endMaxSlots = getMaxSlots(Game.selectedEnd.id);
    
    if (getCitySlotUsage(Game.selectedStart.id, state.routes) >= startMaxSlots) {
        showToast(`No slots at ${Game.selectedStart.name}! Upgrade?`, true);
        return;
    }
    if (getCitySlotUsage(Game.selectedEnd.id, state.routes) >= endMaxSlots) {
        showToast(`No slots at ${Game.selectedEnd.name}! Upgrade?`, true);
        return;
    }
    
    const dist = getDistance(Game.selectedStart, Game.selectedEnd);
    if (dist > ac.range) {
        showToast(`Range too short! Need ${dist}km`, true);
        return;
    }
    
    const fee = ac.airportFee + dist * 0.05;
    if (state.money < fee) {
        showToast(`Need €${Math.floor(fee)} for fee`, true);
        return;
    }
    
    state.money -= fee;
    const route = {
        id: Date.now(),
        from: Game.selectedStart.id,
        to: Game.selectedEnd.id,
        fromName: Game.selectedStart.name,
        toName: Game.selectedEnd.name,
        aircraftUniqueId: ac.uniqueId,
        aircraftName: ac.name,
        duration: Math.max(20, Math.floor((dist / ac.speed) * 3600)),
        active: false,
        endTime: null,
        priceMultiplier: Game.routePriceMultiplier,
        distance: dist,
        capacity: ac.capacity,
        basePricePerKm: ac.baseTicketPrice,
        fuelBurn: ac.fuelBurn,
        airportFee: ac.airportFee
    };
    
    state.routes.push(route);
    Game.mapNeedsUpdate = true;
    saveGame();
    refreshAll();
    clearMapSelection();
    showToast(`✅ Route: ${Game.selectedStart.name} → ${Game.selectedEnd.name} | Fee: €${Math.floor(fee)}`);
    Game.selectedStart = null;
    Game.selectedEnd = null;
}

// ==================== FLIGHT FUNCTIONS ====================
export function startFlight(rid) {
    const state = Game.state;
    const r = state.routes.find(r => r.id === rid);
    if (!r || r.active) {
        showToast('Route not found or active', true);
        return;
    }
    const ac = state.aircrafts.find(a => a.uniqueId === r.aircraftUniqueId);
    if (!ac || ac.busy || ac.maintenance) {
        showToast('Aircraft not available', true);
        return;
    }
    
    ac.busy = true;
    r.active = true;
    r.endTime = Date.now() + r.duration * 1000;
    Game.mapNeedsUpdate = true;
    saveGame();
    refreshAll();
    startFlightTimer(r);
    AudioSystem.play('flight_start');
    showToast(`✈️ Flight departed!`);
}

export function startFlightTimer(route) {
    if (Game.timers[route.id]) clearInterval(Game.timers[route.id]);
    Game.timers[route.id] = setInterval(() => {
        if (Date.now() >= route.endTime) {
            clearInterval(Game.timers[route.id]);
            delete Game.timers[route.id];
            completeFlight(route.id);
        } else {
            updateSingleTimer(route.id);
        }
    }, 1000);
}

export function updateSingleTimer(rid) {
    const state = Game.state;
    const r = state.routes.find(r => r.id === rid);
    if (!r) return;
    const el = document.getElementById(`timer-${r.id}`);
    if (el && r.active && r.endTime) {
        const rem = Math.max(0, r.endTime - Date.now());
        const mins = Math.floor(rem / 60000);
        const secs = Math.floor((rem % 60000) / 1000);
        const newText = `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;
        if (el.textContent !== newText) {
            el.textContent = newText;
        }
    }
}

export async function completeFlight(rid) {
    const state = Game.state;
    const r = state.routes.find(r => r.id === rid);
    if (!r || !r.active) return;
    
    const dKey = getDemandKey(r.from, r.to);
    const demand = state.routeDemand[dKey]?.demand || 1.0;
    
    // Изчисли occupancy веднъж и го използвай за всичко
    const occ = calculateOccupancy(demand, r.priceMultiplier, r.capacity, r.from);
    
    // Изчисли печалбата с вече изчисленото occupancy
    const profit = computeFlightProfitWithOccupancy(r, demand, state.fuelPrice, occ);
    
    // Обнови demand с изчисленото occupancy
    updateDemand(dKey, occ);
    
    const ac = state.aircrafts.find(a => a.uniqueId === r.aircraftUniqueId);
    if (ac) {
        ac.busy = false;
        ac.flightsCount = (ac.flightsCount || 0) + 1;
        if (ac.flightsCount >= 10 && !ac.maintenance) {
            ac.maintenance = true;
            ac.busy = true;
            if (Game.maintenanceTimeout) clearTimeout(Game.maintenanceTimeout);
            Game.pendingMaintenance = ac;
            showMaintenanceDialog(ac);
        }
    }
    
    r.active = false;
    updateStatistics(r, profit);
    
    if (state.loanActive && profit > 0) {
        profit = applyLoanRepayment(profit);
    }
    
    state.money += profit;
    state.totalRevenue += profit;
    Game.mapNeedsUpdate = true;
    saveGame();
    refreshAll();
    AudioSystem.play('flight_complete');
    showToast(`✅ Completed! +€${profit.toLocaleString()}`);
    checkBankruptcy();
}

// ==================== COMPUTE FLIGHT PROFIT WITH OCCUPANCY ====================
function computeFlightProfitWithOccupancy(route, demand, fuelPrice, occupancy) {
    const dist = route.distance;
    const state = Game.state;
    
    const ticketPrice = route.basePricePerKm * route.priceMultiplier * (Math.sqrt(dist) * 0.9 + dist * 0.035);
    const revenue = ticketPrice * route.capacity * occupancy;
    
    let multiplier = 1;
    if (state.prestigeBonuses && state.prestigeBonuses.moneyMultiplier) {
        multiplier = state.prestigeBonuses.moneyMultiplier;
    }
    
    let fuelDiscount = 0;
    if (state.prestigeBonuses && state.prestigeBonuses.fuelDiscount) {
        fuelDiscount = state.prestigeBonuses.fuelDiscount;
    }
    
    const fuelCost = dist * route.fuelBurn * fuelPrice * (1 - fuelDiscount);
    const airportFee = route.airportFee + dist * 0.08;
    const maintenanceCost = route.capacity * 1.2;
    const crewCost = Math.max(80, route.capacity * 0.65);

    let profit = revenue - fuelCost - airportFee - maintenanceCost - crewCost;
    profit = profit * multiplier;
    
    if (dist > 4000) {
        const longHaulBonus = 1.15 + (route.capacity > 200 ? 0.15 : 0);
        profit = Math.floor(profit * longHaulBonus);
    }
    
    return Math.floor(Math.max(0, profit));
}

// ==================== MAINTENANCE ====================
export function showMaintenanceDialog(ac) {
    if (Game.pendingMaintenance && Game.maintenanceTimeout) {
        clearTimeout(Game.maintenanceTimeout);
        Game.maintenanceTimeout = null;
    }
    const cost = getMaintenanceCost(ac.weightClass);
    const msgEl = DOM.maintenanceMessage;
    if (msgEl) {
        msgEl.innerHTML = `${ac.name} needs maintenance!<br>Pay €${cost.toLocaleString()} or wait 30 seconds.`;
    }
    showElement('maintenanceDialog');
}

export function resolveMaintenancePay() {
    const state = Game.state;
    if (Game.pendingMaintenance) {
        const cost = getMaintenanceCost(Game.pendingMaintenance.weightClass);
        if (state.money >= cost) {
            state.money -= cost;
            Game.pendingMaintenance.maintenance = false;
            Game.pendingMaintenance.flightsCount = 0;
            Game.pendingMaintenance.busy = false;
            showToast(`🔧 ${Game.pendingMaintenance.name} repaired!`);
            AudioSystem.play('purchase');
            Game.mapNeedsUpdate = true;
            saveGame();
            refreshAll();
        } else {
            showToast(`Not enough money!`, true);
            AudioSystem.play('error');
        }
        if (Game.maintenanceTimeout) {
            clearTimeout(Game.maintenanceTimeout);
            Game.maintenanceTimeout = null;
        }
        Game.pendingMaintenance = null;
        hideElement('maintenanceDialog');
    }
}

export function resolveMaintenanceWait() {
    if (Game.pendingMaintenance) {
        if (Game.maintenanceTimeout) clearTimeout(Game.maintenanceTimeout);
        showToast(`⏳ Waiting 30 seconds for ${Game.pendingMaintenance.name}...`);
        Game.maintenanceTimeout = setTimeout(() => {
            if (Game.pendingMaintenance) {
                Game.pendingMaintenance.maintenance = false;
                Game.pendingMaintenance.flightsCount = 0;
                Game.pendingMaintenance.busy = false;
                showToast(`🔧 ${Game.pendingMaintenance.name} repaired after waiting!`);
                Game.mapNeedsUpdate = true;
                saveGame();
                refreshAll();
            }
            if (Game.maintenanceTimeout) Game.maintenanceTimeout = null;
        }, 30000);
        Game.pendingMaintenance = null;
        hideElement('maintenanceDialog');
    }
}

// ==================== ROUTE MANAGEMENT ====================
export async function removeRoute(rid) {
    const state = Game.state;
    const confirmed = await showConfirm('Delete this route?');
    if (!confirmed) return;
    
    const r = state.routes.find(r => r.id === rid);
    if (r && Game.timers[rid]) {
        clearInterval(Game.timers[rid]);
        delete Game.timers[rid];
    }
    if (r) {
        const ac = state.aircrafts.find(a => a.uniqueId === r.aircraftUniqueId);
        if (ac) ac.busy = false;
    }
    state.routes = state.routes.filter(r => r.id !== rid);
    Game.mapNeedsUpdate = true;
    saveGame();
    refreshAll();
    showToast('Route deleted.');
    checkBankruptcy();
}

export function autoStartAll() {
    const state = Game.state;
    let started = 0;
    for (let r of state.routes) {
        const isExpired = r.endTime && r.endTime < Date.now();
        if (isExpired) {
            r.active = false;
            r.endTime = null;
            const ac = state.aircrafts.find(a => a.uniqueId === r.aircraftUniqueId);
            if (ac) ac.busy = false;
        }
        if (!r.active && !r.endTime) {
            const ac = state.aircrafts.find(a => a.uniqueId === r.aircraftUniqueId);
            if (ac && !ac.busy && !ac.maintenance) {
                ac.busy = true;
                r.active = true;
                r.endTime = Date.now() + r.duration * 1000;
                startFlightTimer(r);
                started++;
            }
        }
    }
    Game.mapNeedsUpdate = true;
    saveGame();
    refreshAll();
    showToast(`Started ${started} flights!`);
}

export function renderRoutes() {
    const cont = DOM.routesListScreen;
    if (!cont) return;
    
    const state = Game.state;
    if (!state.routes.length) {
        cont.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">No routes.</div>';
        return;
    }
    
    cont.innerHTML = state.routes.map(r => {
        let timer = '', btnText = '✈️ START', btnDisabled = false;
        if (r.active && r.endTime) {
            const rem = Math.max(0, r.endTime - Date.now());
            const mins = Math.floor(rem / 60000);
            const secs = Math.floor((rem % 60000) / 1000);
            timer = `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;
            btnText = '✈️ IN FLIGHT';
            btnDisabled = true;
        } else {
            timer = '🟢 READY';
            btnText = '✈️ START';
            btnDisabled = false;
        }
        
        const dKey = getDemandKey(r.from, r.to);
        const demand = state.routeDemand[dKey]?.demand || 1.0;
        let profit = computeFlightProfit(r, demand, state.fuelPrice);
        if (state.loanActive && profit > 0) profit = Math.floor(profit * 0.5);
        
        return `<div class="route-item ${r.active ? 'active-flight' : ''}">
            <div>
                <strong style="color:var(--text-primary);">${r.fromName} → ${r.toName}</strong>
                <div style="font-size:11px; color:var(--text-muted);">${r.aircraftName} | 💰 ~€${profit.toLocaleString()}</div>
            </div>
            <div class="route-timer" id="timer-${r.id}">${timer}</div>
            <div>
                <button class="btn" data-action="startFlight" data-id="${r.id}" ${btnDisabled ? 'disabled' : ''}>${btnText}</button>
                <button class="btn btn-danger" data-action="removeRoute" data-id="${r.id}">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

export function renderRouteAnalytics() {
    const container = DOM.routeAnalyticsList;
    if (!container) return;
    
    const analytics = Game.routeAnalytics || {};
    const entries = Object.entries(analytics);
    
    if (entries.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">Complete flights to see analytics</div>';
        return;
    }
    
    entries.sort((a, b) => b[1].totalProfit - a[1].totalProfit);
    
    container.innerHTML = entries.slice(0, 10).map(([key, data]) => {
        const [from, to] = key.split('-');
        const avgProfit = data.flights > 0 ? Math.floor(data.totalProfit / data.flights) : 0;
        const avgOccupancy = data.occupancyHistory.length > 0
            ? Math.floor(data.occupancyHistory.reduce((a, b) => a + b, 0) / data.occupancyHistory.length * 100)
            : 0;
        const trend = data.profitHistory.length > 1
            ? (data.profitHistory[data.profitHistory.length-1] - data.profitHistory[0])
            : 0;
        const trendIcon = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
        
        return `<div style="background:var(--bg-primary); border-radius:12px; padding:10px; margin-bottom:8px; transition:background 0.3s;">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
                <div>
                    <strong style="color:var(--text-primary);">${from} → ${to}</strong>
                    <span style="font-size:11px; color:var(--text-muted);">${data.flights} flights</span>
                </div>
                <div>
                    <span style="color:var(--primary);">💰 €${avgProfit.toLocaleString()}</span>
                    <span style="font-size:11px; color:var(--text-muted); margin-left:8px;">👥 ${avgOccupancy}%</span>
                    <span style="font-size:11px; margin-left:8px;">${trendIcon}</span>
                </div>
            </div>
            <div style="font-size:10px; color:var(--text-light); margin-top:4px;">
                📏 ${data.totalDistance}km total | ${data.profitHistory.length > 0 ? '📊 ' + data.profitHistory.length + ' records' : ''}
            </div>
            <div style="display:flex; gap:2px; margin-top:4px; height:20px;">
                ${data.profitHistory.slice(-10).map(p => {
                    const max = Math.max(1, ...data.profitHistory);
                    const height = Math.max(3, (p / max) * 17);
                    return `<div style="width:10px; background:${p > 0 ? 'var(--success)' : 'var(--danger)'}; height:${height}px; border-radius:2px; transition:height 0.3s;"></div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
}