import { Game, saveGame, getDefaultState } from './game.js';
import { showToast, showConfirm, refreshAll } from './ui.js';

// ==================== PRESTIGE SYSTEM ====================
export function showPrestigeDialog() {
    const state = Game.state;
    if (state.companyLevel < 10) {
        showToast('Reach Level 10 to Prestige!', true);
        return;
    }
    const nextLevel = (state.prestigeLevel || 0) + 1;
    const moneyBonus = 1 + (nextLevel * 0.1);
    const demandBonus = 1 + (nextLevel * 0.05);
    const fuelDiscount = Math.min(0.3, nextLevel * 0.03);
    
    showConfirm(
        `🌟 Prestige to Level ${nextLevel}?<br><br>You'll reset to Level 1 but gain:<br>• +${Math.round((moneyBonus-1)*100)}% money bonus<br>• +${Math.round((demandBonus-1)*100)}% demand bonus<br>• ${Math.round(fuelDiscount*100)}% fuel discount<br>• Permanent prestige level ${nextLevel}`
    ).then(confirmed => {
        if (confirmed) {
            performPrestige();
        }
    });
}

export function performPrestige() {
    const state = Game.state;
    const prestigeLevel = (state.prestigeLevel || 0) + 1;
    
    const keep = {
        prestigeLevel: prestigeLevel,
        prestigeBonuses: {
            moneyMultiplier: 1 + (prestigeLevel * 0.1),
            demandMultiplier: 1 + (prestigeLevel * 0.05),
            fuelDiscount: Math.min(0.3, prestigeLevel * 0.03)
        },
        airlineName: state.airlineName || "Skyline Airways",
        airlineLogo: state.airlineLogo || "✈️"
    };
    
    const newState = getDefaultState();
    
    // Пряка промяна на Game.state - НЕ преприсвояваме!
    Object.keys(newState).forEach(key => {
        state[key] = newState[key];
    });
    Object.keys(keep).forEach(key => {
        state[key] = keep[key];
    });
    
    Game.state = state;
    
    saveGame(true);
    refreshAll();
    showToast(`🌟 Prestige ${prestigeLevel}! +${Math.round((keep.prestigeBonuses.moneyMultiplier-1)*100)}% money, +${Math.round((keep.prestigeBonuses.demandMultiplier-1)*100)}% demand, ${Math.round(keep.prestigeBonuses.fuelDiscount*100)}% fuel discount`);
    setTimeout(() => location.reload(), 1500);
}

// ==================== AIRLINE NAME ====================
export function updateAirlineName(name) {
    const state = Game.state;
    if (name && name.trim()) {
        state.airlineName = name.trim();
        saveGame();
        showToast(`✈️ Airline renamed to "${name.trim()}"`);
    }
}

export function randomizeAirlineName() {
    const names = [
        "Skyline Airways", "Apex Air", "Star Wings", "Global Jet",
        "Aurora Airlines", "Zenith Flights", "Pinnacle Air",
        "Silver Star", "Golden Wings", "Cloud 9 Airlines",
        "Phoenix Air", "Titan Airways", "Eagle Flights",
        "Falcon Jet", "Horizon Air"
    ];
    const name = names[Math.floor(Math.random() * names.length)];
    const input = document.getElementById('airlineNameInput');
    if (input) input.value = name;
    updateAirlineName(name);
}