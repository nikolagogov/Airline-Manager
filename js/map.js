```js
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

// ==================== MAP PREVIEW LINE ====================

let previewRouteLine = null;

function updatePreviewRouteLine() {
    if (!Game.map) return;

    if (previewRouteLine) {
        Game.map.removeLayer(previewRouteLine);
        previewRouteLine = null;
    }

    if (!Game.selectedStart || !Game.selectedEnd) return;

    previewRouteLine = L.polyline(
        [
            [Game.selectedStart.lat, Game.selectedStart.lon],
            [Game.selectedEnd.lat, Game.selectedEnd.lon]
        ],
        {
            color: '#ef4444',
            weight: 4,
            opacity: 0.9,
            dashArray: '8, 8'
        }
    ).addTo(Game.map);

    previewRouteLine.bringToFront();
}

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
        setTimeout(() => {
            Game.map?.invalidateSize(true);
            updateMapMarkers();
            updatePreviewRouteLine();
        }, 200);
        return;
    }

    try {
        Game.map = window.L.map(mapContainer).setView([50, 10], 4);

        window.L.tileLayer(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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

        updateMapMarkers();
        updatePreviewRouteLine();

        console.info('[Map] Initialization completed');
    } catch (error) {
        console.error('[Map] Initialization failed:', error);
        Game.map = null;
    }
}

// ==================== CITY COLORS ====================

export function getCityColor(type) {
    if (type === 'beach') return '#3b82f6';
    if (type === 'mountain') return '#10b981';
    return '#f59e0b';
}

// ==================== UPDATE MAP MARKERS ====================

export function updateMapMarkers() {
    if (!Game.map) return;

    const state = Game.state;

    Object.values(Game.markers).forEach(marker => {
        Game.map.removeLayer(marker);
    });

    Game.markers = {};

    Game.cities.forEach(city => {
        const used = getCitySlotUsage(city.id, state.routes);
        const maxSlots = getMaxSlots(city.id);
        const seasonBonus = getSeasonBonus(city.id);
        const hubBonus =
            state.hubCity === city.id ? '⭐ HUB +20%' : '';

        const isStart = Game.selectedStart?.id === city.id;
        const isEnd = Game.selectedEnd?.id === city.id;

        let markerColor = getCityColor(city.type);

        if (isStart) {
            markerColor = '#10b981';
        } else if (isEnd) {
            markerColor = '#ef4444';
        }

        let selectionLabel;

        if (!Game.selectedStart || isStart) {
            selectionLabel = 'Choose as START';
        } else {
            selectionLabel = 'Choose as DESTINATION';
        }

        const popup = `
            <div style="min-width:180px">
                <strong>${city.name}</strong><br>
                Slots: ${used}/${maxSlots}<br>
                Level: ${city.level}<br>
                Season: ${(seasonBonus * 100).toFixed(0)}%<br>
                ${hubBonus ? `${hubBonus}<br>` : ''}

                <div style="
                    display:flex;
                    gap:6px;
                    margin-top:10px;
                    align-items:center;
                ">
                    <button
                        class="btn btn-primary"
                        onclick="window.selectMapCity('${city.id}')"
                        style="
                            flex:1;
                            font-size:12px;
                            padding:7px 8px;
                        ">
                        ${isStart ? '✓ START' :
                            isEnd ? '✓ DESTINATION' :
                            selectionLabel}
                    </button>

                    <button
                        class="btn btn-secondary"
                        data-action="upgradeCity"
                        data-id="${city.id}"
                        ${state.money < city.upgradeCost ? 'disabled' : ''}
                        style="
                            font-size:11px;
                            padding:7px 8px;
                        ">
                        Upgrade
                    </button>
                </div>
            </div>
        `;

        const marker = L.circleMarker(
            [city.lat, city.lon],
            {
                radius: isStart || isEnd ? 11 : 9,
                fillColor: markerColor,
                color: isStart || isEnd ? '#111827' : '#ffffff',
                weight: isStart || isEnd ? 3 : 2,
                fillOpacity: 0.95
            }
        ).addTo(Game.map);

        marker.bindPopup(popup);

        marker.on('click', () => {
            onCityClick(city, marker);
        });

        Game.markers[city.id] = marker;
    });

    updatePreviewRouteLine();
}

// ==================== CITY UPGRADE ====================

export function upgradeCity(cityId) {
    const state = Game.state;
    const city = Game.cities.find(c => String(c.id) === String(cityId));

    if (!city) return;

    const currentUpgrade = state.cityUpgrades?.[cityId];
    const currentMaxSlots = currentUpgrade
        ? currentUpgrade.maxSlots
        : city.maxSlots;

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
        msgEl.innerHTML =
            `Upgrade ${city.name}?<br>` +
            `Slots: ${currentMaxSlots} → ${city.upgradeTo}<br>` +
            `Cost: €${cost.toLocaleString()}`;
    }

    showElement('upgradeCityDialog');
}

export function confirmUpgradeCity() {
    if (!Game.pendingUpgrade) return;

    const state = Game.state;

    const {
        cityId,
        newMaxSlots,
        cost,
        cityName,
        currentSlots
    } = Game.pendingUpgrade;

    if (state.money >= cost) {
        state.money -= cost;

        if (!state.cityUpgrades) {
            state.cityUpgrades = {};
        }

        const current = state.cityUpgrades[cityId] || {
            maxSlots: currentSlots,
            level: 0
        };

        state.cityUpgrades[cityId] = {
            maxSlots: newMaxSlots,
            level: (current.level || 0) + 1
        };

        const city = Game.cities.find(c => String(c.id) === String(cityId));

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

// ==================== RESET MARKER COLORS ====================

export function resetMapColors() {
    for (const id in Game.markers) {
        const city = Game.cities.find(c => String(c.id) === String(id));

        if (!city) continue;

        const isStart = Game.selectedStart?.id === city.id;
        const isEnd = Game.selectedEnd?.id === city.id;

        let fillColor = getCityColor(city.type);

        if (isStart) {
            fillColor = '#10b981';
        } else if (isEnd) {
            fillColor = '#ef4444';
        }

        Game.markers[id].setStyle({
            fillColor,
            radius: isStart || isEnd ? 11 : 9,
            color: isStart || isEnd ? '#111827' : '#ffffff',
            weight: isStart || isEnd ? 3 : 2
        });
    }
}

// ==================== SELECT CITY ====================

export function selectMapCity(cityId) {
    const city = Game.cities.find(
        c => String(c.id) === String(cityId)
    );

    if (!city) return;

    if (!Game.selectedStart || Game.selectedStart.id === city.id) {
        Game.selectedStart = city;
        Game.selectedEnd = null;
    } else {
        Game.selectedEnd = city;
    }

    updateMapMarkers();
    updateSelectionInfo();
    updateProfitPreview();
    updateHubButton();
}

// ==================== CITY CLICK ====================

export function onCityClick(city, marker) {
    if (!Game.selectedStart) {
        Game.selectedStart = city;
        Game.selectedEnd = null;
    } else if (Game.selectedStart.id === city.id) {
        marker.openPopup();
        return;
    } else {
        Game.selectedEnd = city;
    }

    resetMapColors();
    updatePreviewRouteLine();
    updateSelectionInfo();
    updateProfitPreview();
    updateHubButton();
}

// ==================== SELECTION INFO ====================

function updateSelectionInfo() {
    const info = DOM.selectionInfo;

    if (!info) return;

    if (Game.selectedStart && Game.selectedEnd) {
        const distance = getDistance(
            Game.selectedStart,
            Game.selectedEnd
        );

        info.innerHTML =
            `🟢 START: ${Game.selectedStart.name}<br>` +
            `🔴 DESTINATION: ${Game.selectedEnd.name}<br>` +
            `📏 Distance: ${Math.round(distance).toLocaleString()} km<br>` +
            `✈️ Select an aircraft and review the expected profit below.`;
    } else if (Game.selectedStart) {
        info.innerHTML =
            `🟢 START: ${Game.selectedStart.name}<br>` +
            `➡️ Now choose a destination city.`;
    } else {
        info.innerHTML =
            '✈️ Choose a START city, then a DESTINATION.';
    }
}

// ==================== CLEAR SELECTION ====================

export function clearMapSelection() {
    Game.selectedStart = null;
    Game.selectedEnd = null;

    resetMapColors();
    updatePreviewRouteLine();
    updateSelectionInfo();
    updateProfitPreview();
    updateHubButton();
}

// ==================== SET HUB ====================

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

    showToast(
        `⭐ ${Game.selectedStart.name} is now your hub! +20% demand.`
    );

    saveGame();
    refreshAll();
}

// ==================== GLOBAL HANDLERS ====================

window.selectMapCity = selectMapCity;
window.selectMapDestination = selectMapDestination;
```
