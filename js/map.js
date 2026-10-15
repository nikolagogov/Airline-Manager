
import { Game, saveGame } from './game.js';
import {
    getCitySlotUsage,
    getMaxSlots,
    getSeasonBonus,
    getDistance
} from './utils.js';
import {
    showToast,
    updateProfitPreview,
    updateHubButton,
    refreshAll
} from './ui.js';
import { DOM, showElement, hideElement } from './cache.js';
import { AudioSystem } from './audio.js';

const L = window.L;

// ==================== MAP ====================

export function initMap() {
    const mapContainer = document.getElementById('map');

    if (!mapContainer) {
        console.error('[Map] Missing #map container');
        return;
    }

    if (!window.L) {
        console.error('[Map] Leaflet is not loaded');
        return;
    }

    if (Game.map) {
        setTimeout(() => Game.map?.invalidateSize(true), 200);
        return;
    }

    try {
        Game.map = window.L.map(mapContainer).setView([50, 10], 4);

        window.L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            {
                attribution: '&copy; OpenStreetMap contributors'
            }
        ).addTo(Game.map);

        Game.map.on('load', () => {
            console.info('[Map] Leaflet map loaded');
        });

        Game.map.on('tileerror', (event) => {
            console.error('[Map] Tile failed to load', event);
        });

        setTimeout(() => Game.map?.invalidateSize(true), 200);

        try {
            updateMapMarkers();
        } catch (error) {
            console.error('[Map] Marker rendering failed:', error);
        }

        console.info('[Map] Initialization completed');
    } catch (error) {
        console.error('[Map] Initialization failed:', error);
        Game.map = null;
    }
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
        
const isStart = Game.selectedStart?.id === c.id;
const isEnd = Game.selectedEnd?.id === c.id;

const isStart = Game.selectedStart?.id === c.id;
const isEnd = Game.selectedEnd?.id === c.id;

const popup = `
    <div style="min-width:180px">
        <b>${c.name}</b><br>
        Slots: ${used}/${maxSlots}<br>
        Level: ${c.level}<br>
        Season: ${(seasonBonus * 100).toFixed(0)}%<br>
        ${hubBonus ? `${hubBonus}<br>` : ''}

        <div style="display:flex; gap:6px; margin-top:10px; align-items:center">
            <button
                class="btn btn-primary"
                onclick="window.selectMapCity('${c.id}')"
                style="flex:1; font-size:12px; padding:7px 8px">
                ${isStart ? '✓ START' : isEnd ? '✓ DESTINATION' : 'Select city'}
            </button>

            <button
                class="btn btn-secondary"
                data-action="upgradeCity"
                data-id="${c.id}"
                ${state.money < c.upgradeCost ? 'disabled' : ''}
                style="font-size:11px; padding:7px 8px">
                Upgrade
            </button>
        </div>
    </div>`;
        
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

export function selectMapCity(cityId) {
    const city = Game.cities.find(c => String(c.id) === String(cityId));
    if (!city) return;

    Game.selectedStart = city;
    Game.selectedEnd = null;

    resetMapColors();

    if (Game.markers[city.id]) {
        Game.markers[city.id].setStyle({ fillColor: '#10b981' });
    }

    updateSelectionInfo();
    updateProfitPreview();
    updateHubButton();
    updateMapMarkers();
}

export function selectMapDestination() {
    if (!Game.selectedStart) {
        showToast('Choose a START city first!', true);
        return;
    }

    const startId = Game.selectedStart.id;
    const marker = Game.markers[startId];

    if (marker) {
        marker.openPopup();
    }

    showToast('Now click another city to select DESTINATION.');
}

function updateSelectionInfo() {
    const info = DOM.selectionInfo;
    if (!info) return;

    if (Game.selectedStart && Game.selectedEnd) {
        info.innerHTML =
            `📍 START: ${Game.selectedStart.name} → DESTINATION: ${Game.selectedEnd.name}<br>` +
            `📏 ${getDistance(Game.selectedStart, Game.selectedEnd)} km<br>` +
            `✅ Set price and CREATE`;
    } else if (Game.selectedStart) {
        info.innerHTML =
            `📍 START: ${Game.selectedStart.name}<br>` +
            `✨ Choose another city as DESTINATION`;
    } else {
        info.innerHTML = '✨ Choose a START city, then a DESTINATION';
    }
}

export function onCityClick(city, marker) {
    if (!Game.selectedStart) {
        // First city becomes START.
        selectMapCity(city.id);
        return;
    }

    if (Game.selectedStart.id === city.id) {
        // Clicking START again keeps it selected.
        marker.openPopup();
        return;
    }

    // A different city becomes DESTINATION.
    Game.selectedEnd = city;

    resetMapColors();

    if (Game.markers[Game.selectedStart.id]) {
        Game.markers[Game.selectedStart.id]
            .setStyle({ fillColor: '#10b981' });
    }

    if (Game.markers[city.id]) {
        Game.markers[city.id]
            .setStyle({ fillColor: '#ef4444' });
    }

    updateSelectionInfo();
    updateProfitPreview();
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
    refreshAll();
}

window.selectMapCity = selectMapCity;
window.selectMapDestination = selectMapDestination;
