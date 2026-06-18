import { Game, saveGame } from './game.js';
import { DOM, updateHTML, showElement, hideElement } from './cache.js';
import { getDistance, getMaxSlots, getCitySlotUsage, getSeasonBonus } from './utils.js';
import { showToast, updateProfitPreview, updateHubButton, refreshAll } from './ui.js';
import { AudioSystem } from './audio.js';
import { checkAchievements } from './state.js';

// ==================== MAP ====================
export function initMap() {
    if (Game.map) return;
    
    const mapContainer = document.getElementById('map');
    const isVisible = mapContainer && mapContainer.offsetParent !== null;
    
    Game.map = L.map('map', {
        tap: true,
        touchZoom: true,
        scrollWheelZoom: true,
        dragging: true,
        zoomControl: true,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true
    }).setView([50, 10], 4);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OSM'
    }).addTo(Game.map);
    
    if (!isVisible) {
        const observer = new ResizeObserver(() => {
            if (mapContainer && mapContainer.offsetParent !== null) {
                Game.map.invalidateSize();
                observer.disconnect();
            }
        });
        observer.observe(mapContainer);
    }
    
    updateMapMarkers();
}

export function getCityColor(type) {
    if (type === 'beach') return '#3b82f6';
    if (type === 'mountain') return '#10b981';
    return '#f59e0b';
}

export function updateMapMarkers() {
    if (!Game.map) return;
    const state = Game.state;
    
    Object.values(Game.markers).forEach(m => Game.map.removeLayer(m));
    Game.markers = {};
    
    Game.cities.forEach(c => {
        const used = getCitySlotUsage(c.id, state.routes);
        const maxSlots = getMaxSlots(c.id);
        const seasonBonus = getSeasonBonus(c.id);
        const hubBonus = (state.hubCity === c.id) ? '⭐ HUB +20%' : '';
        
        const popup = `<b>${c.name}</b><br>
            Slots: ${used}/${maxSlots}<br>
            Level: ${c.level}<br>
            Season: ${(seasonBonus*100).toFixed(0)}%<br>
            ${hubBonus}<br>
            <button class="btn btn-secondary" data-action="upgradeCity" data-id="${c.id}" ${state.money < c.upgradeCost ? 'disabled' : ''} 
                    style="font-size:11px; padding:4px 8px; min-height:24px;">
                Upgrade (€${c.upgradeCost.toLocaleString()})
            </button>`;
        
        const m = L.circleMarker([c.lat, c.lon], {
            radius: 9,
            fillColor: getCityColor(c.type),
            color: 'white',
            weight: 2,
            fillOpacity: 0.9
        }).addTo(Game.map);
        
        m.bindPopup(popup);
        m.on('click', () => onCityClick(c, m));
        
        Game.markers[c.id] = m;
    });
}

export function upgradeCity(cityId) {
    const state = Game.state;
    const city = Game.cities.find(c => c.id === cityId);
    if (!city) return;
    
    const currentUpgrade = state.cityUpgrades[cityId];
    const currentMaxSlots = currentUpgrade ? currentUpgrade.maxSlots : city.maxSlots;
    const cost = city.upgradeCost;
    
    if (state.money < cost) {
        showToast(`Need €${cost.toLocaleString()}`, true);
        return;
    }
    
    Game.pendingUpgrade = {
        cityId,
        newMaxSlots: city.upgradeTo,
        cost,
        cityName: city.name,
        currentSlots: currentMaxSlots
    };
    
    const msgEl = DOM.upgradeCityMessage;
    if (msgEl) {
        msgEl.innerHTML = `Upgrade ${city.name}?<br>Slots: ${currentMaxSlots} → ${city.upgradeTo}<br>Cost: €${cost.toLocaleString()}`;
    }
    showElement('upgradeCityDialog');
}

export function confirmUpgradeCity() {
    if (!Game.pendingUpgrade) return;
    const state = Game.state;
    const { cityId, newMaxSlots, cost, cityName, currentSlots } = Game.pendingUpgrade;
    
    if (state.money >= cost) {
        state.money -= cost;
        if (!state.cityUpgrades) state.cityUpgrades = {};
        const current = state.cityUpgrades[cityId] || { maxSlots: currentSlots, level: 0 };
        state.cityUpgrades[cityId] = {
            maxSlots: newMaxSlots,
            level: (current.level || 0) + 1
        };
        
        const city = Game.cities.find(c => c.id === cityId);
        if (city) {
            city.level = (current.level || 0) + 2;
            city.upgradeCost = Math.floor(city.upgradeCost * 1.5);
            city.upgradeTo = Math.floor(city.upgradeTo * 1.3);
        }
        
        if (!state.anyUpgrade) {
            state.anyUpgrade = true;
            checkAchievements();
        }
        
        Game.mapNeedsUpdate = true;
        saveGame();
        refreshAll();
        AudioSystem.play('purchase');
        showToast(`🏗️ ${cityName} upgraded!`);
    }
    hideElement('upgradeCityDialog');
    Game.pendingUpgrade = null;
}

export function cancelUpgradeCity() {
    hideElement('upgradeCityDialog');
    Game.pendingUpgrade = null;
}

export function resetMapColors() {
    for (let id in Game.markers) {
        const city = Game.cities.find(c => c.id === id);
        if (city) {
            Game.markers[id].setStyle({ fillColor: getCityColor(city.type) });
        }
    }
}

export function onCityClick(city, marker) {
    if (!Game.selectedStart) {
        Game.selectedStart = city;
        resetMapColors();
        marker.setStyle({ fillColor: '#10b981' });
        const info = DOM.selectionInfo;
        if (info) info.innerHTML = `📍 START: ${city.name}<br>✨ Click destination`;
        updateProfitPreview();
    } else if (!Game.selectedEnd && Game.selectedStart.id !== city.id) {
        Game.selectedEnd = city;
        marker.setStyle({ fillColor: '#ef4444' });
        const info = DOM.selectionInfo;
        if (info) {
            info.innerHTML = `📍 ${Game.selectedStart.name} → ${city.name}<br>📏 ${getDistance(Game.selectedStart, city)}km<br>✅ Set price and CREATE`;
        }
        updateProfitPreview();
    } else {
        Game.selectedStart = city;
        Game.selectedEnd = null;
        resetMapColors();
        marker.setStyle({ fillColor: '#10b981' });
        const info = DOM.selectionInfo;
        if (info) info.innerHTML = `📍 START: ${city.name}<br>✨ Click destination`;
        updateProfitPreview();
    }
    updateHubButton();
}

export function clearMapSelection() {
    Game.selectedStart = null;
    Game.selectedEnd = null;
    resetMapColors();
    const info = DOM.selectionInfo;
    if (info) info.innerHTML = '✨ Tap a city for START → then DESTINATION';
    updateProfitPreview();
    updateHubButton();
}

export function setHub() {
    const state = Game.state;
    if (!Game.selectedStart) {
        showToast('Select a start city first!', true);
        return;
    }
    state.hubCity = Game.selectedStart.id;
    state.hubSet = true;
    Game.mapNeedsUpdate = true;
    updateMapMarkers();
    showToast(`⭐ ${Game.selectedStart.name} is now your hub! +20% demand.`);
    saveGame();
    checkAchievements();
    refreshAll();
}