import { Game, gameState, getDefaultState, saveGame } from './game.js';
import { showToast, showConfirm, refreshAll } from './ui.js';

// ==================== PRESTIGE SYSTEM ====================
export function showPrestigeDialog() {
    if (gameState.companyLevel < 10) {
        showToast('Reach Level 10 to Prestige!', true);
        return;
    }
    const nextLevel = (gameState.prestigeLevel || 0) + 1;
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
    const prestigeLevel = (gameState.prestigeLevel || 0) + 1;
    
    const keep = {
        prestigeLevel: prestigeLevel,
        prestigeBonuses: {
            moneyMultiplier: 1 + (prestigeLevel * 0.1),
            demandMultiplier: 1 + (prestigeLevel * 0.05),
            fuelDiscount: Math.min(0.3, prestigeLevel * 0.03)
        },
        airlineName: gameState.airlineName || "Skyline Airways",
        airlineLogo: gameState.airlineLogo || "✈️"
    };
    
    const newState = getDefaultState();
    gameState = { ...newState, ...keep };
    Game.state = gameState;
    
    saveGame(true);
    refreshAll();
    showToast(`🌟 Prestige ${prestigeLevel}! +${Math.round((keep.prestigeBonuses.moneyMultiplier-1)*100)}% money, +${Math.round((keep.prestigeBonuses.demandMultiplier-1)*100)}% demand, ${Math.round(keep.prestigeBonuses.fuelDiscount*100)}% fuel discount`);
    setTimeout(() => location.reload(), 1500);
}