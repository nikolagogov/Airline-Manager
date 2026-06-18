import { Game } from './game.js';
import { seasons, extraCities } from './data.js';
import { showToast } from './ui.js';
import { saveGame } from './game.js';

// ==================== DISTANCE ====================
export function getDistance(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const x = Math.sin(dLat/2)**2 + Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) * Math.sin(dLon/2)**2;
    return Math.floor(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)));
}

// ==================== CITY HELPERS ====================
export function getCitySlotUsage(cityId, routes) {
    return routes.filter(r => r.from === cityId || r.to === cityId).length;
}

export function getMaxSlots(cityId) {
    const state = Game.state;
    if (state.cityUpgrades && state.cityUpgrades[cityId]) {
        return state.cityUpgrades[cityId].maxSlots;
    }
    const city = Game.cities.find(c => c.id === cityId);
    return city ? city.maxSlots : 3;
}

export function getDemandKey(from, to) {
    return `${from}-${to}`;
}

// ==================== SEASONS ====================
export function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    for (let s of seasons) {
        if (s.months.includes(month)) return s;
    }
    return seasons[0];
}

export function getSeasonBonus(cityId) {
    const city = Game.cities.find(c => c.id === cityId);
    if (!city) return 1.0;
    const s = getCurrentSeason();
    return s.bonuses[city.type] || 1.0;
}

export function getHubBonus(fromId) {
    const state = Game.state;
    if (state.hubCity && state.hubCity === fromId) return 1.2;
    return 1.0;
}

// ==================== MAINTENANCE ====================
export function getMaintenanceCost(weightClass) {
    if (weightClass === 'heavy') return 8000;
    if (weightClass === 'medium') return 5000;
    return 3000;
}

// ==================== UNLOCK CITIES ====================
export function unlockNewCities() {
    const state = Game.state;
    let added = false;
    for (let ec of extraCities) {
        if (state.companyLevel >= ec.minLevel && !Game.cities.find(c => c.id === ec.id)) {
            Game.cities.push({...ec});
            added = true;
        }
    }
    if (added) {
        Game.mapNeedsUpdate = true;
        if (Game.unlockToastTimeout) clearTimeout(Game.unlockToastTimeout);
        Game.unlockToastTimeout = setTimeout(() => {
            showToast('🌍 New destinations unlocked! Asia & Africa now available!');
        }, 100);
    }
}

// ==================== DEMAND ====================
export function updateDemand(key, occupancy) {
    const state = Game.state;
    if (!state.routeDemand[key]) {
        state.routeDemand[key] = { demand: 1.0, lastUpdate: Date.now() };
    }
    
    let d = state.routeDemand[key].demand;
    
    if (occupancy > 0.7) {
        d = Math.max(0.15, d - 0.035 * occupancy);
    } else if (occupancy > 0.4) {
        d = Math.max(0.25, d - 0.015);
    } else {
        d = Math.min(1.0, d + 0.005);
    }
    
    if (state.prestigeBonuses && state.prestigeBonuses.demandMultiplier) {
        d = Math.min(1.0, d * state.prestigeBonuses.demandMultiplier);
    }
    
    state.routeDemand[key].demand = d;
    state.routeDemand[key].lastUpdate = Date.now();
    saveGame();
}

export function recoverDemands() {
    const state = Game.state;
    if (Object.keys(state.routeDemand).length === 0) return;
    const now = Date.now();
    for (let k in state.routeDemand) {
        let entry = state.routeDemand[k];
        let minutesPassed = (now - entry.lastUpdate) / 60000;
        if (minutesPassed > 0) {
            let newDemand = Math.min(1.0, entry.demand + minutesPassed * 0.01);
            entry.demand = newDemand;
            entry.lastUpdate = now;
        }
    }
    saveGame();
}

export function calculateOccupancy(demand, priceMultiplier, capacity, cityId) {
    const capFactor = Math.min(1, 150 / capacity);
    const season = getSeasonBonus(cityId);
    const hub = getHubBonus(cityId);
    let occ = demand * (1.0 / priceMultiplier) * capFactor * season * hub;
    return Math.min(0.95, Math.max(0.15, occ));
}

// ==================== PROFIT ====================
export function computeFlightProfit(route, demand, fuelPrice) {
    const dist = route.distance;
    const occ = calculateOccupancy(demand, route.priceMultiplier, route.capacity, route.from);
    
    const ticketPrice = route.basePricePerKm * route.priceMultiplier * (Math.sqrt(dist) * 0.9 + dist * 0.035);
    const revenue = ticketPrice * route.capacity * occ;
    
    const state = Game.state;
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

// ==================== COMPANY LEVEL ====================
// Преместено в state.js