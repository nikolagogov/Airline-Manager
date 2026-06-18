import { Game, saveGame } from './game.js';
import { DOM, showElement, hideElement } from './cache.js';
import { showToast, refreshAll } from './ui.js';
import { AudioSystem } from './audio.js';
import { checkBankruptcy } from './state.js';

// ==================== EVENT DEFINITIONS ====================
const EVENT_TEMPLATES = Object.freeze([
    {
        text: "⚡ Fuel Crisis!",
        description: "Oil prices are skyrocketing!",
        options: [
            { text: "Accept the increase", effect: { fuelMult: 1.5, duration: 120000, message: "Fuel prices increased for 2 minutes!" } },
            { text: "Lobby government", effect: { fuelMult: 1.2, penalty: -5000, duration: 60000, message: "Fuel prices slightly increased. Cost: €5,000" } }
        ]
    },
    {
        text: "🎉 Tourism Boom!",
        description: "Tourists are flocking to your destinations!",
        options: [
            { text: "Raise ticket prices", effect: { demandBoost: 1.3, duration: 180000, message: "Demand boosted by 30% for 3 minutes!" } },
            { text: "Keep prices stable", effect: { bonus: 8000, message: "€8,000 bonus from happy tourists!" } }
        ]
    },
    {
        text: "🌀 Major Storm Alert!",
        description: "A massive storm is approaching your hub!",
        options: [
            { text: "Delay all flights", effect: { penalty: -2000, duration: 60000, message: "All flights delayed. Cost: €2,000" } },
            { text: "Reroute through hubs", effect: { fuelMult: 1.3, penalty: -1000, duration: 90000, message: "Rerouted flights. Extra fuel cost." } }
        ]
    },
    {
        text: "✈️ Boeing Discount!",
        description: "Boeing is offering a special deal!",
        options: [
            { text: "Take the deal", effect: { discount: 20, duration: 180000, message: "20% off all aircraft for 3 minutes!" } },
            { text: "Wait for Airbus deal", effect: { bonus: 5000, message: "€5,000 bonus for waiting." } }
        ]
    },
    {
        text: "👨‍✈️ Pilot Strike!",
        description: "Your pilots are demanding higher pay!",
        options: [
            { text: "Negotiate", effect: { penalty: -3000, duration: 120000, message: "Pilots paid extra. Cost: €3,000" } },
            { text: "Hire new pilots", effect: { penalty: -8000, message: "New pilots hired. Cost: €8,000" } }
        ]
    },
    {
        text: "🚀 New Aircraft Tech!",
        description: "A new fuel-efficient engine is available!",
        options: [
            { text: "Install in all planes", effect: { fuelEfficiencyBonus: 0.2, duration: 300000, message: "Fuel efficiency improved by 20% for 5 minutes!" } },
            { text: "Wait for price drop", effect: { bonus: 3000, message: "€3,000 bonus" } }
        ]
    },
    {
        text: "🏆 Global Recognition!",
        description: "Your airline is featured in a global magazine!",
        options: [
            { text: "Use the publicity", effect: { demandBoost: 1.2, bonus: 5000, duration: 120000, message: "Demand boosted by 20% + €5,000 bonus!" } },
            { text: "Stay humble", effect: { bonus: 10000, message: "€10,000 bonus" } }
        ]
    },
    {
        text: "📉 Economic Recession!",
        description: "The global economy is taking a hit!",
        options: [
            { text: "Cut costs aggressively", effect: { fuelEfficiencyBonus: 0.1, duration: 300000, message: "Cost-cutting measures: 10% fuel efficiency for 5 minutes!" } },
            { text: "Maintain quality", effect: { penalty: -2000, message: "Maintaining quality costs €2,000" } }
        ]
    }
]);

// ==================== EVENTS 2.0 ====================
export function triggerRandomEvent() {
    const state = Game.state;
    if (state.pendingEvent) return;
    
    const events = EVENT_TEMPLATES;
    state.pendingEvent = events[Math.floor(Math.random() * events.length)];
    const panel = DOM.eventPanel;
    if (!panel) return;
    
    panel.style.display = 'block';
    
    const fragment = document.createDocumentFragment();
    
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = `
        <strong>⚠️ ${state.pendingEvent.text}</strong>
        <div style="font-size:11px; color:var(--text-muted);">${state.pendingEvent.description}</div>
    `;
    fragment.appendChild(contentDiv);
    
    const btnDiv = document.createElement('div');
    btnDiv.className = 'event-buttons';
    state.pendingEvent.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.dataset.action = 'resolveEvent';
        btn.dataset.idx = idx;
        btn.style.cssText = 'font-size:11px; padding:4px 12px; min-height:30px;';
        btn.textContent = opt.text;
        btnDiv.appendChild(btn);
    });
    fragment.appendChild(btnDiv);
    
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'font-size:10px; color:var(--text-light); margin-top:4px;';
    msgDiv.textContent = state.pendingEvent.options[0].effect.message || '';
    fragment.appendChild(msgDiv);
    
    panel.innerHTML = '';
    panel.appendChild(fragment);
    saveGame();
}

export function resolveEvent(idx) {
    const state = Game.state;
    if (!state.pendingEvent) return;
    const opt = state.pendingEvent.options[idx];
    if (opt) {
        if (!state.activeEffects) state.activeEffects = {};
        
        if (opt.effect.fuelMult) {
            state.fuelPrice = Math.min(3.5, state.fuelPrice * opt.effect.fuelMult);
            if (opt.effect.duration) {
                const key = 'fuelMult_' + Date.now();
                state.activeEffects[key] = {
                    type: 'fuelMult',
                    value: opt.effect.fuelMult,
                    endTime: Date.now() + opt.effect.duration,
                    message: opt.effect.message || 'Fuel price changed'
                };
            }
        }
        if (opt.effect.penalty) {
            state.money = Math.max(0, state.money + opt.effect.penalty);
            showToast(`Cost: €${Math.abs(opt.effect.penalty)}`, true);
            AudioSystem.play('error');
        }
        if (opt.effect.demandBoost) {
            for (let k in state.routeDemand) {
                state.routeDemand[k].demand = Math.min(1.0, state.routeDemand[k].demand * opt.effect.demandBoost);
            }
            if (opt.effect.duration) {
                const key = 'demandBoost_' + Date.now();
                state.activeEffects[key] = {
                    type: 'demandBoost',
                    value: opt.effect.demandBoost,
                    endTime: Date.now() + opt.effect.duration,
                    message: opt.effect.message || 'Demand boosted'
                };
            }
            showToast(`Demand increased!`);
        }
        if (opt.effect.discount) {
            state.discountPercent = opt.effect.discount;
            if (opt.effect.duration) {
                const key = 'discount_' + Date.now();
                state.activeEffects[key] = {
                    type: 'discount',
                    value: opt.effect.discount,
                    endTime: Date.now() + opt.effect.duration,
                    message: opt.effect.message || `${opt.effect.discount}% discount active`
                };
            }
            showToast(`${opt.effect.discount}% discount!`);
        }
        if (opt.effect.fuelEfficiencyBonus) {
            const key = 'fuelEfficiency_' + Date.now();
            state.activeEffects[key] = {
                type: 'fuelEfficiencyBonus',
                value: opt.effect.fuelEfficiencyBonus,
                endTime: Date.now() + opt.effect.duration,
                message: opt.effect.message || 'Fuel efficiency improved'
            };
            showToast(`Fuel efficiency improved!`);
        }
        if (opt.effect.bonus) {
            state.money += opt.effect.bonus;
            showToast(`Bonus: €${opt.effect.bonus}`);
            AudioSystem.play('money');
        }
        saveGame();
        refreshAll();
    }
    state.pendingEvent = null;
    const panel = DOM.eventPanel;
    if (panel) panel.style.display = 'none';
    checkBankruptcy();
}