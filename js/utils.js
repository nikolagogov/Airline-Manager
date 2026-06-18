import { Game, gameState } from './game.js';
import { seasons, extraCities } from './data.js';

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
    if (gameState.cityUpgrades && gameState.cityUpgrades[cityId]) {
        return gameState.cityUpgrades[cityId].maxSlots;
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
    if (gameState.hubCity && gameState.hubCity === fromId) return 1.2;
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
    let added = false;
    for (let ec of extraCities) {
        if (gameState.companyLevel >= ec.minLevel && !Game.cities.find(c => c.id === ec.id)) {
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
    if (!gameState.routeDemand[key]) {
        gameState.routeDemand[key] = { demand: 1.0, lastUpdate: Date.now() };
    }
    
    let d = gameState.routeDemand[key].demand;
    
    if (occupancy > 0.7) {
        d = Math.max(0.15, d - 0.035 * occupancy);
    } else if (occupancy > 0.4) {
        d = Math.max(0.25, d - 0.015);
    } else {
        d = Math.min(1.0, d + 0.005);
    }
    
    if (gameState.prestigeBonuses && gameState.prestigeBonuses.demandMultiplier) {
        d = Math.min(1.0, d * gameState.prestigeBonuses.demandMultiplier);
    }
    
    gameState.routeDemand[key].demand = d;
    gameState.routeDemand[key].lastUpdate = Date.now();
    saveGame();
}

export function recoverDemands() {
    if (Object.keys(gameState.routeDemand).length === 0) return;
    const now = Date.now();
    for (let k in gameState.routeDemand) {
        let entry = gameState.routeDemand[k];
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
    
    let multiplier = 1;
    if (gameState.prestigeBonuses && gameState.prestigeBonuses.moneyMultiplier) {
        multiplier = gameState.prestigeBonuses.moneyMultiplier;
    }
    
    let fuelDiscount = 0;
    if (gameState.prestigeBonuses && gameState.prestigeBonuses.fuelDiscount) {
        fuelDiscount = gameState.prestigeBonuses.fuelDiscount;
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
export function updateCompanyLevel() {
    const req = [0, 80000, 250000, 650000, 1400000, 2800000, 5500000, 9000000, 14000000, 22000000];
    let level = 1;
    for (let i = 1; i < req.length; i++) {
        if (gameState.totalRevenue >= req[i]) level = i + 1;
        else break;
    }
    if (gameState.companyLevel !== level) {
        gameState.companyLevel = level;
        unlockNewCities();
    }
    updateText('companyLevel', level);
    const nextReq = req[level] || req[req.length - 1];
    updateText('nextLevelReq', `€${nextReq.toLocaleString()}`);
    const prevReq = req[level - 1] || 0;
    const progress = ((gameState.totalRevenue - prevReq) / (nextReq - prevReq)) * 100;
    const progressEl = document.getElementById('levelProgress');
    if (progressEl) progressEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
}