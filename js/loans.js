import { Game, saveGame } from './game.js';
import { DOM } from './cache.js';
import { showToast, showConfirm, refreshAll, updateLoanUI } from './ui.js';
import { AudioSystem } from './audio.js';

// ==================== CREDIT SCORE ====================
const REVENUE_THRESHOLDS = [
    { threshold: 10000000, score: 50 },
    { threshold: 5000000, score: 40 },
    { threshold: 1000000, score: 30 },
    { threshold: 500000, score: 20 },
    { threshold: 100000, score: 10 },
    { threshold: 0, score: 5 }
];

const FLIGHT_THRESHOLDS = [
    { threshold: 100, score: 15 },
    { threshold: 50, score: 10 },
    { threshold: 20, score: 5 },
    { threshold: 0, score: 0 }
];

const FLEET_THRESHOLDS = [
    { threshold: 5, score: 15 },
    { threshold: 3, score: 10 },
    { threshold: 1, score: 5 },
    { threshold: 0, score: 0 }
];

function getScoreFromThresholds(value, thresholds) {
    for (let t of thresholds) {
        if (value >= t.threshold) return t.score;
    }
    return 0;
}

export function getCreditScore() {
    const state = Game.state;
    let score = 0;
    
    score += getScoreFromThresholds(state.totalRevenue, REVENUE_THRESHOLDS);
    score += getScoreFromThresholds(state.totalFlights, FLIGHT_THRESHOLDS);
    score += getScoreFromThresholds(state.aircrafts.length, FLEET_THRESHOLDS);
    score += Math.min(20, state.companyLevel * 2);
    
    if (state.loanActive) {
        score = Math.max(0, score - 30);
        if (state.loanRemaining > 50000) score = Math.max(0, score - 20);
    }
    
    if (state.prestigeLevel > 0) {
        score += state.prestigeLevel * 5;
    }
    
    return Math.min(100, Math.max(0, score));
}

export function getMaxActiveLoans() {
    const score = getCreditScore();
    if (score >= 80) return 3;
    if (score >= 60) return 2;
    if (score >= 30) return 1;
    return 0;
}

export function getLoanCooldown() {
    const score = getCreditScore();
    if (score >= 80) return 30000;
    if (score >= 60) return 60000;
    if (score >= 30) return 120000;
    return 180000;
}

export function getAvailableLoans() {
    const state = Game.state;
    const score = getCreditScore();
    const maxLoans = getMaxActiveLoans();
    const activeLoans = state.loanActive ? 1 : 0;
    
    const loans = [];
    
    if (!state.loanActive) {
        loans.push({
            amount: 10000,
            repayment: 13000,
            minScore: 0,
            maxActive: 0,
            name: "💳 Starter Loan",
            description: "Small loan for beginners"
        });
    }
    
    if (score >= 20 && (activeLoans < Math.min(2, maxLoans))) {
        loans.push({
            amount: 25000,
            repayment: 35000,
            minScore: 20,
            maxActive: 1,
            name: "📈 Growth Loan",
            description: "For expanding your fleet"
        });
    }
    
    if (score >= 40 && (activeLoans < Math.min(2, maxLoans))) {
        loans.push({
            amount: 50000,
            repayment: 75000,
            minScore: 40,
            maxActive: 1,
            name: "🏢 Business Loan",
            description: "For major investments"
        });
    }
    
    if (score >= 60 && (activeLoans < Math.min(3, maxLoans))) {
        loans.push({
            amount: 100000,
            repayment: 160000,
            minScore: 60,
            maxActive: 2,
            name: "💼 Premium Loan",
            description: "For airline tycoons"
        });
    }
    
    if (score >= 80 && (activeLoans < maxLoans)) {
        loans.push({
            amount: 250000,
            repayment: 425000,
            minScore: 80,
            maxActive: 2,
            name: "👑 Elite Loan",
            description: "Only for the best airlines"
        });
    }
    
    return loans;
}

// ==================== RENDER LOANS ====================
export function renderLoans() {
    const c = DOM.availableLoansList;
    if (!c) return;
    const state = Game.state;
    
    const score = getCreditScore();
    const maxLoans = getMaxActiveLoans();
    const activeLoans = state.loanActive ? 1 : 0;
    const cooldown = state.loanCooldown || 0;
    const isOnCooldown = Date.now() < cooldown;
    const cooldownRemaining = isOnCooldown ? Math.ceil((cooldown - Date.now()) / 1000) : 0;
    
    const scoreColor = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--primary)' : 'var(--danger)';
    const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : score >= 20 ? 'Poor' : 'Very Poor';
    
    const fragment = document.createDocumentFragment();
    
    // Credit score display
    const scoreDiv = document.createElement('div');
    scoreDiv.className = 'credit-score-display';
    scoreDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span><strong style="color:var(--text-primary);">📊 Credit Score</strong></span>
            <span style="font-size:24px; font-weight:bold; color:${scoreColor};">${score}</span>
        </div>
        <div style="background:var(--border-color); border-radius:20px; height:8px; margin-top:6px; overflow:hidden;">
            <div style="background:${scoreColor}; width:${score}%; height:100%; border-radius:20px; transition:width 0.3s;"></div>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
            <span>📈 ${scoreLabel}</span>
            <span>🔒 Max loans: ${maxLoans}</span>
            <span>📋 Active: ${activeLoans}/${maxLoans}</span>
        </div>
        ${isOnCooldown ? `<div style="font-size:11px; color:var(--danger); margin-top:4px;">⏳ Loan cooldown: ${cooldownRemaining}s</div>` : ''}
        ${activeLoans >= maxLoans ? `<div style="font-size:11px; color:var(--danger); margin-top:4px;">⚠️ Maximum active loans reached!</div>` : ''}
    `;
    fragment.appendChild(scoreDiv);
    
    const loans = getAvailableLoans();
    
    if (loans.length === 0 || isOnCooldown) {
        let reason = '';
        if (isOnCooldown) {
            reason = `⏳ Please wait ${cooldownRemaining}s before taking another loan.`;
        } else if (activeLoans >= maxLoans) {
            reason = '⚠️ You have reached the maximum number of active loans.';
        } else {
            reason = '📊 Improve your credit score to unlock more loans.';
        }
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'text-align:center; color:var(--text-muted); padding:20px;';
        emptyDiv.innerHTML = `No loans available.<br>${reason}`;
        fragment.appendChild(emptyDiv);
    } else {
        loans.forEach(loan => {
            const canTake = !state.loanActive && getCreditScore() >= loan.minScore && !isOnCooldown && activeLoans < maxLoans;
            const card = document.createElement('div');
            card.className = 'loan-card';
            card.style.borderLeft = `4px solid ${canTake ? 'var(--success)' : 'var(--danger)'}`;
            card.innerHTML = `
                <div>
                    <strong style="color:var(--text-primary);">${loan.name}</strong>
                    <div style="font-size:11px; color:var(--text-muted);">${loan.description}</div>
                    <div style="font-size:12px; margin-top:4px;">
                        <span style="color:var(--primary);">💰 €${loan.amount.toLocaleString()}</span>
                        <span style="color:var(--danger); margin-left:12px;">↗️ Repay: €${loan.repayment.toLocaleString()}</span>
                    </div>
                    <div style="font-size:10px; color:var(--text-light); margin-top:2px;">
                        📊 Min score: ${loan.minScore} | 📋 Max active: ${loan.maxActive}
                    </div>
                </div>
                <div>
                    <button class="btn btn-success" data-action="takeLoan" data-amount="${loan.amount}" data-repayment="${loan.repayment}" 
                            ${!canTake ? 'disabled' : ''} 
                            style="font-size:11px; padding:4px 12px; min-height:30px;">
                        ${canTake ? '💳 Take Loan' : '🔒 Locked'}
                    </button>
                </div>
            `;
            fragment.appendChild(card);
        });
    }
    
    c.innerHTML = '';
    c.appendChild(fragment);
}

// ==================== TAKE LOAN ====================
export async function takeLoan(amount, repaymentAmount) {
    const state = Game.state;
    if (state.loanActive) {
        showToast('You already have an active loan!', true);
        return;
    }
    
    const maxLoans = getMaxActiveLoans();
    const activeLoans = state.loanActive ? 1 : 0;
    if (activeLoans >= maxLoans) {
        showToast('Maximum active loans reached!', true);
        return;
    }
    
    const score = getCreditScore();
    const loans = getAvailableLoans();
    const loan = loans.find(l => l.amount === amount && l.repayment === repaymentAmount);
    if (loan && score < loan.minScore) {
        showToast(`Need credit score ${loan.minScore} for this loan! (Current: ${score})`, true);
        return;
    }
    
    const cooldown = state.loanCooldown || 0;
    if (Date.now() < cooldown) {
        const remaining = Math.ceil((cooldown - Date.now()) / 1000);
        showToast(`Please wait ${remaining}s before taking another loan.`, true);
        return;
    }
    
    const confirmed = await showConfirm(
        `💳 ${loan ? loan.name : 'Loan'}<br><br>Amount: €${amount.toLocaleString()}<br>Repayment: €${repaymentAmount.toLocaleString()}<br>Interest: ${Math.round((repaymentAmount-amount)/amount*100)}%<br><br>${loan ? loan.description : 'Take this loan?'}`
    );
    
    if (confirmed) {
        state.money += amount;
        state.loanActive = true;
        state.loanRemaining = Math.round(repaymentAmount * 100) / 100;
        
        state.loanHistory = state.loanHistory || [];
        state.loanHistory.push({
            amount: amount,
            repayment: repaymentAmount,
            takenAt: Date.now(),
            repaid: false
        });
        
        state.loanCooldown = Date.now() + getLoanCooldown();
        
        saveGame();
        refreshAll();
        updateLoanUI();
        showToast(`💶 Loan of €${amount.toLocaleString()} granted!`);
        AudioSystem.play('money');
    }
}

// ==================== LOAN REPAYMENT ====================
export function applyLoanRepayment(profit) {
    const state = Game.state;
    if (!state.loanActive || state.loanRemaining <= 0) return profit;
    
    let repayment = Math.floor(profit * 0.5);
    if (repayment > state.loanRemaining) repayment = state.loanRemaining;
    state.loanRemaining -= repayment;
    
    if (state.loanRemaining < 1) {
        state.loanRemaining = 0;
    }
    
    if (state.loanRemaining <= 0) {
        state.loanActive = false;
        state.loanRemaining = 0;
        
        if (state.loanHistory) {
            const lastLoan = state.loanHistory.find(l => !l.repaid);
            if (lastLoan) {
                lastLoan.repaid = true;
                lastLoan.repaidAt = Date.now();
            }
        }
        
        state.loanCooldown = Date.now() + getLoanCooldown();
        
        showToast(`🎉 Loan fully repaid! Next loan available in ${Math.ceil(getLoanCooldown()/1000)}s.`);
        updateLoanUI();
    }
    return profit - repayment;
}