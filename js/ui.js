import { Game, saveGame } from './game.js';
import { DOM, updateText, updateHTML, showElement, hideElement } from './cache.js';
import { aircraftDB, aircraftUpgrades, achievementsDB } from './data.js';
import { getDistance, getDemandKey, getSeasonBonus, getCurrentSeason, computeFlightProfit, updateCompanyLevel } from './utils.js';
import { AudioSystem } from './audio.js';
import { renderLoans } from './loans.js';
import { renderRouteAnalytics } from './routes.js';

// ==================== TOAST ====================
export function showToast(msg, err = false) {
    const existing = document.querySelectorAll('.toast');
    if (existing.length >= 3) existing[0].remove();
    
    const t = document.createElement('div');
    t.className = `toast ${err ? 'error' : ''}`;
    t.innerHTML = err ? `⚠️ ${msg}` : `✈️ ${msg}`;
    document.body.appendChild(t);
    
    if (!err) {
        t.style.animation = 'slideRight 0.4s, fadeOut 3.8s 2.4s forwards';
        
        if (msg.includes('Prestige') || msg.includes('Achievement') || 
            msg.includes('Purchased') || msg.includes('Level') || 
            msg.includes('upgraded')) {
            celebrate(1.6);
        } else if (msg.includes('Completed') || msg.includes('Route')) {
            celebrate(0.7);
        }
    }
    
    setTimeout(() => t.remove(), 4200);
}

// ==================== CELEBRATE ====================
export function celebrate(intensity = 1) {
    const count = 60 * intensity;
    const emojis = ['✈️','💰','🏆','🌟','🔥','🛫','🛬'];
    for(let i = 0; i < count; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.style.position = 'fixed';
            c.style.zIndex = '99999';
            c.style.left = Math.random() * 100 + 'vw';
            c.style.top = '-20px';
            c.style.fontSize = (18 + Math.random() * 22) + 'px';
            c.style.transition = 'all ' + (2.5 + Math.random() * 2) + 's linear';
            c.style.opacity = '1';
            c.innerHTML = emojis[Math.floor(Math.random() * emojis.length)];
            document.body.appendChild(c);

            setTimeout(() => {
                c.style.transform = `translateY(${window.innerHeight + 150}px) rotate(${Math.random()*600 - 300}deg)`;
                c.style.opacity = '0';
            }, 80);
            
            setTimeout(() => c.remove(), 5000);
        }, i * 6);
    }
}

// ==================== CONFIRM ====================
export function showConfirm(msg) {
    return new Promise((resolve) => {
        Game.confirmResolve = resolve;
        if (DOM.confirmMessage) DOM.confirmMessage.innerHTML = msg;
        showElement('confirmDialog');
    });
}

// ==================== GOLD FLASH ====================
export function goldFlash(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('gold-flash');
        setTimeout(() => el.classList.remove('gold-flash'), 400);
    }
}

// ==================== SCREEN SWITCH ====================
export function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${id}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-btn[data-screen="${id}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    if (id === 'stats') renderStatistics();
    if (id === 'achievements') renderAchievements();
    if (id === 'loans') renderLoans();
    
    if (id === 'leaderboard') {
        import('./main.js').then(module => {
            module.renderLeaderboard();
        });
    }
}

// ==================== UPDATE FUNCTIONS ====================
export function updateLoanUI() {
    const state = Game.state;
    const ind = document.getElementById('loanIndicator');
    if (state.loanActive && state.loanRemaining > 0) {
        if (ind) ind.style.display = 'block';
        updateText('loanRemaining', Math.floor(state.loanRemaining).toLocaleString());
    } else {
        if (ind) ind.style.display = 'none';
    }
    const ad = document.getElementById('activeLoanDisplay');
    if (ad) {
        if (state.loanActive && state.loanRemaining > 0) {
            ad.style.display = 'block';
            updateText('activeLoanRemaining', Math.floor(state.loanRemaining).toLocaleString());
        } else {
            ad.style.display = 'none';
        }
    }
}

export function updateSeasonUI() {
    updateText('seasonName', getCurrentSeason().name);
}

// ==================== STATISTICS ====================
export function renderStatistics() {
    const state = Game.state;
    updateText('statTotalFlights', state.totalFlights || 0);
    updateText('statTotalDistance', `${(state.totalDistance || 0).toLocaleString()} km`);
    
    let total = 0, bestProfit = 0, bestKey = null, arr = [];
    for (let k in state.routeStats) {
        const rs = state.routeStats[k];
        const avg = rs.totalProfit / rs.flights;
        total += rs.totalProfit;
        arr.push({ ...rs, avgProfit: avg, key: k });
        if (avg > bestProfit) {
            bestProfit = avg;
            bestKey = k;
        }
    }
    
    const avgProfit = state.totalFlights > 0 ? Math.floor(total / state.totalFlights) : 0;
    updateText('statAvgProfit', `€${avgProfit.toLocaleString()}`);
    
    if (bestKey && state.routeStats[bestKey]) {
        updateText('statBestRoute', state.routeStats[bestKey].fromName + " → " + state.routeStats[bestKey].toName);
        updateText('statBestProfit', `€${Math.floor(bestProfit).toLocaleString()}`);
    }
    
    const efficiency = state.aircrafts.length > 0 ? Math.floor((state.aircrafts.filter(a => a.busy).length / state.aircrafts.length) * 100) : 0;
    updateText('statFleetEfficiency', `${efficiency}%`);
    
    arr.sort((a, b) => b.avgProfit - a.avgProfit);
    const top5 = arr.slice(0, 5);
    const topDiv = DOM.topRoutesList;
    if (topDiv) {
        if (top5.length === 0) {
            topDiv.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">No completed flights.</div>';
        } else {
            topDiv.innerHTML = top5.map((r, i) =>
                `<div class="route-rank">
                    <span>${i+1}. ${r.fromName} → ${r.toName}</span>
                    <span class="rank-profit">💰 €${Math.floor(r.avgProfit).toLocaleString()}</span>
                    <span style="font-size:11px; color:var(--text-light);">${r.flights} flights</span>
                </div>`
            ).join('');
        }
    }
    
    const chartDiv = DOM.profitChart;
    if (chartDiv) {
        if (arr.length === 0) {
            chartDiv.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">No data.</div>';
        } else {
            const max = Math.max(...arr.map(r => r.avgProfit), 1);
            chartDiv.innerHTML = arr.slice(0, 8).map(r =>
                `<div>
                    <div style="display:flex; justify-content:space-between; color:var(--text-secondary);">
                        <span>${r.fromName} → ${r.toName}</span>
                        <span>€${Math.floor(r.avgProfit).toLocaleString()}</span>
                    </div>
                    <div class="chart-bar">
                        <div class="chart-fill" style="width: ${(r.avgProfit / max) * 100}%;"></div>
                    </div>
                </div>`
            ).join('');
        }
    }
}

// ==================== ACHIEVEMENTS ====================
export function renderAchievements() {
    const c = DOM.achievementsList;
    if (!c) return;
    const state = Game.state;
    c.innerHTML = achievementsDB.map(ach => {
        const unlocked = state.achievements.includes(ach.id);
        return `<div class="achievement-card ${!unlocked ? 'achievement-locked' : ''}">
            <div>
                <strong>${unlocked ? '🏆' : '🔒'} ${ach.name}</strong>
                <div style="font-size:11px; color:var(--text-muted);">${ach.desc}</div>
                <div style="color:var(--primary);">💰 +€${ach.reward.toLocaleString()}</div>
            </div>
            <div>${unlocked ? '✅' : '🔒'}</div>
        </div>`;
    }).join('');
}

// ==================== FLEET ====================
export function renderAircrafts() {
    const cont = DOM.aircraftListScreen;
    if (!cont) return;
    const state = Game.state;
    
    if (!state.aircrafts.length) {
        cont.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">✈️ No aircraft. Buy first!</div>';
        return;
    }
    
    let sorted = [...state.aircrafts];
    const sortBy = document.getElementById('fleetSort')?.value || 'name';
    const filterBy = document.getElementById('fleetFilter')?.value || 'all';
    
    if (filterBy !== 'all') sorted = sorted.filter(ac => ac.weightClass === filterBy);
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'price') sorted.sort((a, b) => a.price - b.price);
    if (sortBy === 'priceDesc') sorted.sort((a, b) => b.price - a.price);
    if (sortBy === 'capacity') sorted.sort((a, b) => b.capacity - a.capacity);
    
    cont.innerHTML = sorted.map(ac => {
        const isSelected = state.selectedAircraftUniqueId === ac.uniqueId;
        let status = ac.busy ? 'BUSY' : 'IDLE';
        let statusClass = ac.busy ? 'status-busy' : 'status-idle';
        if (ac.maintenance) {
            status = 'MAINTENANCE';
            statusClass = 'status-maintenance';
        }
        return `<div class="aircraft-card ${isSelected ? 'selected' : ''}" data-id="${ac.uniqueId}">
            <div>
                <strong>${ac.image} ${ac.name}</strong>
                <div style="font-size:11px; color:var(--text-muted);">👥 ${ac.capacity} | 📡 ${ac.range}km | ⛽ ${ac.fuelBurn} L/km</div>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                <span class="${statusClass}">${status}</span>
                <span style="color:var(--primary);">💰 ${ac.price.toLocaleString()}€</span>
                <button class="btn btn-secondary" data-action="showUpgrades" data-id="${ac.uniqueId}" style="font-size:10px; padding:2px 8px; min-height:24px;">🔧</button>
            </div>
        </div>`;
    }).join('');
}

export function selectAircraft(uid) {
    const state = Game.state;
    state.selectedAircraftUniqueId = uid;
    renderAircrafts();
    const ac = state.aircrafts.find(a => a.uniqueId === uid);
    showToast(`Selected ${ac?.name}`);
}

export function updateAircraftSelect() {
    const sel = DOM.aircraftSelect;
    if (sel) {
        const state = Game.state;
        sel.innerHTML = '<option value="">-- Select IDLE Aircraft --</option>' +
            state.aircrafts.filter(ac => !ac.busy && !ac.maintenance)
                .map(ac => `<option value="${ac.uniqueId}">${ac.image} ${ac.name} (Cap:${ac.capacity} | Range:${ac.range}km)</option>`)
                .join('');
    }
    updateProfitPreview();
}

// ==================== PROFIT PREVIEW ====================
export async function updateProfitPreview() {
    const pre = DOM.profitPreview;
    if (!pre) return;
    const state = Game.state;
    
    if (!Game.selectedStart || !Game.selectedEnd) {
        pre.innerText = '💶 Select start and destination first';
        return;
    }
    const aid = DOM.aircraftSelect?.value;
    if (!aid) {
        pre.innerText = '💶 Select an aircraft';
        return;
    }
    const ac = state.aircrafts.find(a => a.uniqueId === aid);
    if (!ac) return;
    const dist = getDistance(Game.selectedStart, Game.selectedEnd);
    if (dist > ac.range) {
        pre.innerText = '❌ Range too short';
        return;
    }
    const dKey = getDemandKey(Game.selectedStart.id, Game.selectedEnd.id);
    const demand = state.routeDemand[dKey]?.demand || 1.0;
    const temp = {
        distance: dist,
        priceMultiplier: Game.routePriceMultiplier,
        capacity: ac.capacity,
        basePricePerKm: ac.baseTicketPrice,
        fuelBurn: ac.fuelBurn,
        airportFee: ac.airportFee,
        from: Game.selectedStart.id
    };
    let profit = computeFlightProfit(temp, demand, state.fuelPrice);
    if (state.loanActive && profit > 0) profit = Math.floor(profit * 0.5);
    pre.innerHTML = `💶 Expected: <strong style="color:var(--primary);">€${profit.toLocaleString()}</strong> (demand: ${(demand*100).toFixed(0)}%, season: ${(getSeasonBonus(Game.selectedStart.id)*100).toFixed(0)}%)`;
}

export function updateSliderInfo() {
    const lbl = DOM.priceMultLabel;
    if (lbl) lbl.innerHTML = Game.routePriceMultiplier.toFixed(2) + 'x';
    updateProfitPreview();
}

// ==================== OVERVIEW ====================
export function renderOverview() {
    const state = Game.state;
    const recent = state.routes.slice(-3).reverse();
    const c = DOM.recentRoutesList;
    if (c) {
        c.innerHTML = recent.length ?
            recent.map(r =>
                `<div style="background:var(--bg-secondary); border-radius:12px; padding:8px; transition:background 0.3s;">
                    <strong style="color:var(--text-primary);">${r.fromName} → ${r.toName}</strong>
                    <br><span style="color:var(--text-muted); font-size:12px;">${r.aircraftName}</span>
                </div>`
            ).join('') :
            '<div style="color:var(--text-muted); padding:8px;">No routes yet.</div>';
    }
}

// ==================== REFRESH ====================
export function refreshStats() {
    const state = Game.state;
    const active = state.routes.filter(r => r.active && r.endTime > Date.now()).length;
    updateText('miniMoney', `€${Math.floor(state.money).toLocaleString()}`);
    updateText('miniPlanes', state.aircrafts.length);
    updateText('miniRoutes', active);
    updateText('miniFuel', `€${state.fuelPrice.toFixed(2)}`);
    updateText('ovMoney', `€${Math.floor(state.money).toLocaleString()}`);
    updateText('ovPlanes', state.aircrafts.length);
    updateText('ovRoutes', state.routes.length);
    updateText('ovRevenue', `€${Math.floor(state.totalRevenue).toLocaleString()}`);
}

export function refreshFleet() {
    renderAircrafts();
    updateAircraftSelect();
}

export function refreshRoutes() {
    import('./routes.js').then(module => module.renderRoutes());
}

// ==================== REFRESH MAP ====================
let lastMapHash = '';

export function refreshMap() {
    if (!Game.mapNeedsUpdate) return;
    const state = Game.state;
    
    const routeHash = state.routes.map(r => `${r.from}-${r.to}-${r.active}`).join('|');
    const hubHash = state.hubCity || 'none';
    const citiesHash = Game.cities.map(c => c.id).join(',');
    const currentHash = `${routeHash}|${hubHash}|${citiesHash}`;
    
    if (currentHash === lastMapHash) {
        Game.mapNeedsUpdate = false;
        return;
    }
    
    lastMapHash = currentHash;
    
    import('./map.js').then(module => {
        module.updateMapMarkers();
        Game.mapNeedsUpdate = false;
    });
}

// ==================== REFRESH UI ====================
export function refreshUI() {
    updateLoanUI();
    updateSeasonUI();
    updateCompanyLevel();
    updateHubButton();
    renderOverview();
    renderStatistics();
    renderAchievements();
    renderLoans();
    renderRouteAnalytics();
}

export function refreshAll() {
    refreshStats();
    refreshFleet();
    refreshRoutes();
    refreshMap();
    refreshUI();
    updateProfitPreview();
    updateSliderInfo();
}

export function updateHubButton() {
    const hubBtn = DOM.setHubBtn;
    if (hubBtn) hubBtn.disabled = !Game.selectedStart;
}

// ==================== EXPORT ====================
export { renderLoans, renderRouteAnalytics };