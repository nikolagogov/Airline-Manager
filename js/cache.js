// ==================== DOM CACHE ====================
export const DOM = {};

export function cacheElements() {
    const elements = [
        // Stats
        'miniMoney', 'miniPlanes', 'miniRoutes', 'miniFuel', 'saveStatus',
        'companyLevel', 'levelProgress', 'nextLevelReq',
        'ovMoney', 'ovPlanes', 'ovRoutes', 'ovRevenue',
        'statTotalFlights', 'statTotalDistance', 'statAvgProfit',
        'statFleetEfficiency', 'statBestRoute', 'statBestProfit',
        'seasonName', 'loanRemaining', 'activeLoanRemaining',
        // Lists
        'aircraftListScreen', 'routesListScreen', 'recentRoutesList',
        'topRoutesList', 'profitChart', 'routeAnalyticsList',
        'achievementsList', 'availableLoansList', 'marketList',
        'upgradeList', 'upgradePanel',
        // Controls
        'profitPreview', 'selectionInfo', 'aircraftSelect',
        'priceMultLabel', 'setHubBtn', 'priceSlider',
        'fleetSort', 'fleetFilter',
        // Dialogs
        'confirmMessage', 'bailoutMessage', 'bailoutDialog',
        'upgradeCityMessage', 'maintenanceMessage', 'importData',
        // Tutorial
        'tutorialTitle', 'tutorialText', 'tutorialProgress',
        'tutorialOverlay',
        // Map
        'map'
    ];
    
    elements.forEach(id => {
        DOM[id] = document.getElementById(id);
    });
}

// ==================== PARTIAL UPDATE ====================
export function updateText(elementId, value) {
    const el = DOM[elementId] || document.getElementById(elementId);
    if (el && el.textContent !== String(value)) {
        el.textContent = value;
    }
}

export function updateHTML(elementId, html) {
    const el = DOM[elementId] || document.getElementById(elementId);
    if (el && el.innerHTML !== html) {
        el.innerHTML = html;
    }
}

export function updateStyle(elementId, property, value) {
    const el = DOM[elementId] || document.getElementById(elementId);
    if (el && el.style[property] !== value) {
        el.style[property] = value;
    }
}

export function showElement(elementId) {
    const el = DOM[elementId] || document.getElementById(elementId);
    if (el) el.style.display = 'block';
}

export function hideElement(elementId) {
    const el = DOM[elementId] || document.getElementById(elementId);
    if (el) el.style.display = 'none';
}

export function toggleVisibility(elementId) {
    const el = DOM[elementId] || document.getElementById(elementId);
    if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
}