import { Game, saveGame } from './game.js';
import { DOM, showElement, hideElement } from './cache.js';
import { aircraftDB, aircraftUpgrades } from './data.js';
import { showToast, goldFlash, refreshAll, updateAircraftSelect } from './ui.js';
import { AudioSystem } from './audio.js';
import { checkBankruptcy } from './state.js';

// ==================== BUY MENU ====================
export function openBuyMenu() {
    const marketDiv = DOM.marketList;
    if (!marketDiv) return;
    
    const fragment = document.createDocumentFragment();
    const state = Game.state;
    
    aircraftDB.forEach(ac => {
        const finalPrice = state.discountPercent > 0 ? Math.floor(ac.price * (1 - state.discountPercent/100)) : ac.price;
        const canBuy = state.money >= finalPrice;
        const priceColor = canBuy ? 'var(--success)' : 'var(--danger)';
        
        const card = document.createElement('div');
        card.className = 'aircraft-card';
        card.style.marginBottom = '10px';
        card.innerHTML = `
            <div>
                <strong>${ac.image} ${ac.name}</strong>
                <div style="font-size:11px; color:var(--text-muted);">👥 ${ac.capacity} | 📡 ${ac.range}km | ⛽ ${ac.fuelBurn} L/km</div>
            </div>
            <div>
                <span style="color:${priceColor};">💰 ${finalPrice.toLocaleString()}€</span>
                ${state.discountPercent > 0 ? `<br><span style="color:var(--success);">-${state.discountPercent}%!</span>` : ''}
                <br>
                <button class="btn btn-success" data-action="buyAircraft" data-id="${ac.id}" ${!canBuy ? 'disabled' : ''} style="margin-top:5px;">BUY</button>
            </div>
        `;
        fragment.appendChild(card);
    });
    
    marketDiv.innerHTML = '';
    marketDiv.appendChild(fragment);
    showElement('buyMenu');
}

export function closeBuyMenu() {
    hideElement('buyMenu');
}

// ==================== BUY AIRCRAFT ====================
export function buyAircraft(typeId) {
    const tmpl = aircraftDB.find(a => a.id === typeId);
    if (!tmpl) return;
    const state = Game.state;
    
    let price = tmpl.price;
    if (state.discountPercent > 0) {
        price = Math.floor(price * (1 - state.discountPercent/100));
        state.discountPercent = 0;
    }
    
    if (state.money < price) {
        showToast(`Need €${price.toLocaleString()}!`, true);
        AudioSystem.play('error');
        return;
    }
    
    state.money -= price;
    const newAc = {
        ...tmpl,
        uniqueId: Date.now() + '-' + Math.random(),
        busy: false,
        busyOnRouteId: null,
        flightsCount: 0,
        maintenance: false,
        upgrades: {}
    };
    state.aircrafts.push(newAc);
    if (state.aircrafts.length === 1) state.selectedAircraftUniqueId = newAc.uniqueId;
    
    saveGame();
    refreshAll();
    updateAircraftSelect();
    closeBuyMenu();
    AudioSystem.play('purchase');
    goldFlash('miniMoney');
    showToast(`✈️ Purchased ${tmpl.name}!`);
    checkBankruptcy();
}

// ==================== SELL AIRCRAFT ====================
export function sellSelectedAircraft() {
    const state = Game.state;
    if (!state.selectedAircraftUniqueId) {
        showToast('Select aircraft first', true);
        return;
    }
    
    const idx = state.aircrafts.findIndex(a => a.uniqueId === state.selectedAircraftUniqueId);
    if (idx === -1) return;
    
    const ac = state.aircrafts[idx];
    if (ac.busy || ac.maintenance) {
        showToast('Cannot sell busy aircraft', true);
        return;
    }
    
    const sellPrice = Math.floor(ac.price * 0.7);
    state.money += sellPrice;
    state.aircrafts.splice(idx, 1);
    state.routes = state.routes.filter(r => r.aircraftUniqueId !== ac.uniqueId);
    
    if (state.aircrafts.length === 0) {
        state.selectedAircraftUniqueId = null;
    } else {
        state.selectedAircraftUniqueId = state.aircrafts[0]?.uniqueId || null;
    }
    
    Game.mapNeedsUpdate = true;
    saveGame();
    refreshAll();
    updateAircraftSelect();
    AudioSystem.play('money');
    goldFlash('miniMoney');
    showToast(`💰 Sold ${ac.name} for €${sellPrice.toLocaleString()}`);
    checkBankruptcy();
}

// ==================== AIRCRAFT UPGRADES ====================
export function showUpgrades(aircraftId) {
    const state = Game.state;
    const ac = state.aircrafts.find(a => a.uniqueId === aircraftId);
    if (!ac) {
        showToast('Aircraft not found!', true);
        return;
    }
    
    const panel = DOM.upgradePanel;
    if (panel) panel.style.display = 'block';
    
    if (!ac.upgrades) ac.upgrades = {};
    
    const list = DOM.upgradeList;
    if (!list) return;
    
    const fragment = document.createDocumentFragment();
    
    aircraftUpgrades.forEach(upg => {
        const currentLevel = ac.upgrades[upg.id] || 0;
        const maxed = currentLevel >= upg.maxLevel;
        const cost = Math.floor(upg.cost * (1 + currentLevel * 0.5));
        const canAfford = state.money >= cost;
        const desc = Object.entries(upg.effect).map(([key, val]) => {
            const current = ac[key] || 0;
            const newVal = current + val;
            if (key === 'fuelBurn') {
                return `${key}: ${current.toFixed(2)} → ${newVal.toFixed(2)} L/km`;
            }
            return `${key}: ${current} → ${newVal}`;
        }).join(' | ');
        
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:var(--bg-primary); padding:10px; border-radius:12px; gap:8px; flex-wrap:wrap; transition:background 0.3s;';
        div.innerHTML = `
            <div>
                <strong>${upg.name}</strong>
                <div style="font-size:11px; color:var(--text-muted);">${desc}</div>
                <div style="font-size:10px; color:var(--primary);">Level ${currentLevel}/${upg.maxLevel}</div>
            </div>
            <div>
                <button class="btn btn-success" data-action="applyUpgrade" data-id="${ac.uniqueId}" data-upgrade="${upg.id}" 
                        ${!canAfford || maxed ? 'disabled' : ''} 
                        style="font-size:11px; padding:4px 12px; min-height:30px;">
                    ${maxed ? '✅ MAX' : `Upgrade €${cost.toLocaleString()}`}
                </button>
            </div>
        `;
        fragment.appendChild(div);
    });
    
    list.innerHTML = '';
    list.appendChild(fragment);
}

export function applyUpgrade(aircraftId, upgradeId) {
    const state = Game.state;
    const ac = state.aircrafts.find(a => a.uniqueId === aircraftId);
    if (!ac) return;
    
    if (ac.busy || ac.maintenance) {
        showToast('Cannot upgrade busy aircraft!', true);
        return;
    }
    
    const upgrade = aircraftUpgrades.find(u => u.id === upgradeId);
    if (!upgrade) return;
    
    if (!ac.upgrades) ac.upgrades = {};
    const currentLevel = ac.upgrades[upgradeId] || 0;
    if (currentLevel >= upgrade.maxLevel) {
        showToast('Already max level!', true);
        return;
    }
    
    const cost = Math.floor(upgrade.cost * (1 + currentLevel * 0.5));
    if (state.money < cost) {
        showToast(`Need €${cost.toLocaleString()}!`, true);
        return;
    }
    
    state.money -= cost;
    ac.upgrades[upgradeId] = currentLevel + 1;
    
    // Apply effects
    for (let [key, val] of Object.entries(upgrade.effect)) {
        ac[key] = (ac[key] || 0) + val;
    }
    
    saveGame();
    refreshAll();
    AudioSystem.play('purchase');
    showToast(`🔧 ${upgrade.name} applied to ${ac.name}!`);
    showUpgrades(aircraftId);
}