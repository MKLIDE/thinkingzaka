// ========================================
// ThinkingZaka - Complete Strategy Implementation
// War vs Peace Portfolio · March 2026
// ========================================

// API Configuration
const ALPHA_API_KEY = "75IQNS7TVU6Z7WR6";

// Complete Asset Configuration
const assets = [
    // War Portfolio
    { key: 'btc', id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', category: 'war', type: 'crypto', source: 'coingecko',
      entry: [63000, 65000], support: 60000, target: 73000, stop: 0.10 },
    { key: 'pltr', id: 'PLTR', symbol: 'PLTR', name: 'Palantir', category: 'war', type: 'stock', source: 'alphavantage',
      entry: [142, 148], support: 136, target: 186, stop: 0.10 },
    { key: 'gold', id: 'XAUUSD', symbol: 'GOLD', name: 'Gold', category: 'war', type: 'forex', source: 'alphavantage',
      entry: [4805, 5000], support: 4780, target: 6000, stop: 0.05 },
    
    // Peace Portfolio - US
    { key: 'qqq', id: 'QQQ', symbol: 'QQQ', name: 'Nasdaq', category: 'peace', type: 'stock', source: 'alphavantage',
      entry: [595, 603], support: 585, target: 616, stop: 0.08 },
    { key: 'sol', id: 'solana', symbol: 'SOL', name: 'Solana', category: 'peace', type: 'crypto', source: 'coingecko',
      entry: [78, 81], support: 76, target: 101, stop: 0.15 },
    
    // South African Portfolio
    { key: 'capitec', id: 'CPI.JO', symbol: 'CPI', name: 'Capitec', category: 'peace', type: 'sa_stock', source: 'alphavantage',
      entry: [4155, 4170], support: 4170, target: 4779, stop: 0.10, fallback: 4210 },
    { key: 'standardbank', id: 'SBK.JO', symbol: 'SBK', name: 'Standard Bank', category: 'peace', type: 'sa_stock', source: 'alphavantage',
      entry: [290, 303], support: 285, target: 350, stop: 0.10, fallback: 296 },
    { key: 'firstrand', id: 'FSR.JO', symbol: 'FSR', name: 'FirstRand', category: 'peace', type: 'sa_stock', source: 'alphavantage',
      entry: [86, 87], support: 84, target: 102, stop: 0.10, fallback: 86 },
    { key: 'shoprite', id: 'SHP.JO', symbol: 'SHP', name: 'Shoprite', category: 'peace', type: 'sa_stock', source: 'alphavantage',
      entry: [260, 261], support: 255, target: 285, stop: 0.10, fallback: 260 }
];

// State Management
const state = {
    prices: {},
    history: {},
    entries: {},
    lastFetch: {},
    alphaCalls: 0,
    lastReset: new Date().toDateString(),
    cycleCount: 0,
    portfolio: { war: 0, peace: 0, cash: 100000 }
};

// Initialize history
assets.forEach(asset => { state.history[asset.key] = []; });

// ========================================
// Utility Functions
// ========================================

function addAlert(text) {
    const list = document.getElementById('alertList');
    if (!list) return;
    
    const li = document.createElement('li');
    li.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    list.prepend(li);
    
    while (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
}

async function fetchJSON(url, retries = 2) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

function checkAlphaLimit() {
    const today = new Date().toDateString();
    if (today !== state.lastReset) {
        state.alphaCalls = 0;
        state.lastReset = today;
    }
    
    const el = document.getElementById('apiUsage');
    if (el) el.textContent = `API: ${state.alphaCalls}/25`;
    
    return state.alphaCalls < 23;
}

// ========================================
// Price Fetching
// ========================================

async function getUSDZARRate() {
    try {
        const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=ZAR&apikey=${ALPHA_API_KEY}`;
        state.alphaCalls++;
        const data = await fetchJSON(url);
        return parseFloat(data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'] || 18.5);
    } catch {
        return 18.5;
    }
}

async function fetchPrice(asset) {
    const now = Date.now();
    
    // Check cache (5 minutes)
    if (state.lastFetch[asset.key] && now - state.lastFetch[asset.key] < 300000) {
        return state.prices[asset.key];
    }
    
    try {
        let price = 0;
        
        if (asset.type === 'crypto') {
            const data = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${asset.id}&vs_currencies=usd`);
            price = data[asset.id]?.usd || 0;
        }
        else if (asset.type === 'sa_stock') {
            if (!checkAlphaLimit()) return state.prices[asset.key] || asset.fallback || 0;
            
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${asset.id}&apikey=${ALPHA_API_KEY}`;
            state.alphaCalls++;
            const data = await fetchJSON(url);
            const zarPrice = parseFloat(data['Global Quote']?.['05. price'] || 0);
            
            if (zarPrice > 0) {
                const usdZar = await getUSDZARRate();
                price = zarPrice / usdZar;
            }
        }
        else if (asset.type === 'forex') {
            if (!checkAlphaLimit()) return state.prices[asset.key] || 0;
            
            const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=XAU&to_currency=USD&apikey=${ALPHA_API_KEY}`;
            state.alphaCalls++;
            const data = await fetchJSON(url);
            price = parseFloat(data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'] || 0);
        }
        else {
            if (!checkAlphaLimit()) return state.prices[asset.key] || 0;
            
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${asset.id}&apikey=${ALPHA_API_KEY}`;
            state.alphaCalls++;
            const data = await fetchJSON(url);
            price = parseFloat(data['Global Quote']?.['05. price'] || 0);
        }
        
        if (price > 0) {
            state.prices[asset.key] = price;
            state.lastFetch[asset.key] = now;
            state.history[asset.key].push(price);
            if (state.history[asset.key].length > 20) state.history[asset.key].shift();
        }
        
        return price || state.prices[asset.key] || asset.fallback || 0;
        
    } catch (error) {
        console.error(`Error fetching ${asset.key}:`, error);
        return state.prices[asset.key] || asset.fallback || 0;
    }
}

// ========================================
// Technical Analysis
// ========================================

function calculateRSI(key, currentPrice) {
    const history = state.history[key] || [];
    if (history.length < 14) return 50;
    
    let gains = 0, losses = 0;
    for (let i = history.length - 14; i < history.length - 1; i++) {
        const change = history[i + 1] - history[i];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function analyzeAsset(asset, price) {
    if (!price) return null;
    
    const inZone = price >= asset.entry[0] && price <= asset.entry[1];
    const nearSupport = price <= asset.support * 1.02;
    const rsi = calculateRSI(asset.key, price);
    const isOverbought = rsi > 70;
    const isOversold = rsi < 30;
    
    // Check pullback
    const history = state.history[asset.key] || [];
    const recentHigh = Math.max(...history.slice(-5));
    const isPullback = recentHigh > price * 1.03;
    
    // Entry logic
    let signal = null;
    
    if (inZone && isPullback && !isOverbought) {
        signal = { type: 'BUY', reason: 'Pullback in zone', confidence: 'HIGH' };
    }
    else if (inZone && !isOverbought && rsi < 60) {
        signal = { type: 'WATCH', reason: 'In zone', confidence: 'MEDIUM' };
    }
    else if (nearSupport && isOversold) {
        signal = { type: 'WATCH', reason: 'Near support', confidence: 'MEDIUM' };
    }
    
    // Stop loss check
    if (state.entries[asset.key]) {
        const loss = (state.entries[asset.key] - price) / state.entries[asset.key];
        if (loss > asset.stop) {
            signal = { type: 'STOP', reason: `${(loss*100).toFixed(1)}% loss`, confidence: 'HIGH' };
        }
    }
    
    return {
        price,
        inZone,
        rsi: Math.round(rsi),
        isOverbought,
        isOversold,
        isPullback,
        targetDistance: ((asset.target - price) / price * 100).toFixed(1),
        signal
    };
}

// ========================================
// UI Rendering
// ========================================

function renderCard(asset) {
    const price = state.prices[asset.key] || 0;
    if (!price) return;
    
    let card = document.getElementById(`card-${asset.key}`);
    const analysis = analyzeAsset(asset, price);
    
    // Create card if not exists
    if (!card) {
        const grid = asset.category === 'war' ? document.getElementById('warPortfolio') :
                    asset.key.includes('capitec') || asset.key.includes('standardbank') || 
                    asset.key.includes('firstrand') || asset.key.includes('shoprite') ? 
                    document.getElementById('saPortfolio') : document.getElementById('peacePortfolioUS');
        
        if (!grid) return;
        
        // Remove loading placeholder
        const loading = document.getElementById(`${asset.key}-loading`);
        if (loading) loading.remove();
        
        card = document.createElement('div');
        card.id = `card-${asset.key}`;
        card.className = `card ${asset.category}`;
        grid.appendChild(card);
    }
    
    // Price change
    const history = state.history[asset.key] || [];
    const prevPrice = history[history.length - 2] || price;
    const arrow = price > prevPrice ? '↑' : (price < prevPrice ? '↓' : '→');
    const priceClass = price > prevPrice ? 'up' : (price < prevPrice ? 'down' : '');
    
    // Generate alert for buy signals
    if (analysis?.signal?.type === 'BUY') {
        const lastAlert = localStorage.getItem(`alert_${asset.key}`);
        const now = Date.now();
        if (!lastAlert || now - parseInt(lastAlert) > 3600000) {
            addAlert(`${asset.symbol}: ${analysis.signal.reason} at $${price.toFixed(2)}`);
            localStorage.setItem(`alert_${asset.key}`, now.toString());
        }
    }
    
    // Build HTML
    card.innerHTML = `
        <div class="card-header">
            <span class="card-symbol">${asset.symbol}</span>
            <span class="card-category ${asset.category}">${asset.category}</span>
        </div>
        <div class="card-price ${priceClass}">
            $${price.toFixed(2)} ${arrow}
        </div>
        <div class="strategy-panel">
            <div class="zone-row">
                <span>Entry:</span> $${asset.entry[0].toLocaleString()} - $${asset.entry[1].toLocaleString()}
            </div>
            <div class="zone-row">
                <span>Target:</span> $${asset.target.toLocaleString()} (${analysis?.targetDistance || 0}%)
            </div>
            <div class="indicator-row">
                <span class="rsi ${analysis?.isOverbought ? 'overbought' : (analysis?.isOversold ? 'oversold' : '')}">
                    RSI: ${analysis?.rsi || 50}
                </span>
                <span>${analysis?.isPullback ? 'Pullback' : 'Trending'}</span>
            </div>
            ${analysis?.signal ? `
                <div class="signal-badge ${analysis.signal.type === 'BUY' ? 'buy' : (analysis.signal.type === 'WATCH' ? 'wait' : 'stop')}">
                    ${analysis.signal.reason} (${analysis.signal.confidence})
                </div>
            ` : ''}
        </div>
        <div class="card-footer">
            <span>${asset.source}</span>
            <span>${new Date().toLocaleTimeString()}</span>
        </div>
    `;
}

// ========================================
// Macro Regime Detection
// ========================================

function detectRegime() {
    const btc = state.prices.btc || 0;
    const pltr = state.prices.pltr || 0;
    const qqq = state.prices.qqq || 0;
    const gold = state.prices.gold || 0;
    
    const btcAsset = assets.find(a => a.key === 'btc');
    const pltrAsset = assets.find(a => a.key === 'pltr');
    const qqqAsset = assets.find(a => a.key === 'qqq');
    const goldAsset = assets.find(a => a.key === 'gold');
    
    let warScore = 0;
    let peaceScore = 0;
    
    if (gold > (goldAsset?.support || 0) * 1.02) warScore += 2;
    if (btc < (btcAsset?.support || 0)) warScore += 1;
    if (pltr > (pltrAsset?.target || 0)) warScore += 2;
    
    if (qqq > (qqqAsset?.support || 0) * 1.03) peaceScore += 2;
    if (btc > (btcAsset?.entry[0] || 0)) peaceScore += 1;
    if (pltr < (pltrAsset?.entry[1] || 0)) peaceScore += 1;
    
    const total = state.portfolio.war + state.portfolio.peace + state.portfolio.cash;
    const warPct = total > 0 ? ((state.portfolio.war / total) * 100).toFixed(1) : 0;
    const peacePct = total > 0 ? ((state.portfolio.peace / total) * 100).toFixed(1) : 0;
    
    document.getElementById('allocationStatus').innerHTML = 
        `${warPct}% War · ${peacePct}% Peace · 20% Cash`;
    
    if (warScore > peaceScore + 1) {
        return { text: 'WAR BIAS - Favor defense', class: 'war' };
    } else if (peaceScore > warScore + 1) {
        return { text: 'PEACE BIAS - Favor growth', class: 'peace' };
    } else {
        return { text: 'NEUTRAL - Balanced', class: 'neutral' };
    }
}

// ========================================
// Main Update
// ========================================

async function updateMarket() {
    state.cycleCount++;
    
    // Fetch all prices
    for (const asset of assets) {
        await fetchPrice(asset);
    }
    
    // Render all cards
    for (const asset of assets) {
        renderCard(asset);
    }
    
    // Update regime
    const regime = detectRegime();
    const macroEl = document.getElementById('macroStatus');
    if (macroEl) {
        macroEl.querySelector('.regime-value').textContent = regime.text;
        macroEl.querySelector('.regime-value').className = `regime-value ${regime.class}`;
    }
    
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
}

// ========================================
// Event Handlers
// ========================================

function recordEntry() {
    const asset = prompt('Enter asset symbol (BTC, PLTR, etc):');
    if (!asset) return;
    const price = prompt('Enter entry price:');
    if (!price) return;
    const quantity = prompt('Enter quantity:');
    if (!quantity) return;
    
    const assetKey = asset.toLowerCase();
    const assetData = assets.find(a => a.key === assetKey || a.symbol.toLowerCase() === assetKey);
    
    if (assetData) {
        state.entries[assetData.key] = parseFloat(price);
        state.portfolio[assetData.category] += parseFloat(price) * parseFloat(quantity);
        state.portfolio.cash -= parseFloat(price) * parseFloat(quantity);
        addAlert(`Recorded ${assetData.symbol} entry: ${quantity} @ $${price}`);
    }
}

function recordExit() {
    const asset = prompt('Enter asset symbol:');
    if (!asset) return;
    const price = prompt('Enter exit price:');
    if (!price) return;
    const quantity = prompt('Enter quantity:');
    if (!quantity) return;
    
    const assetKey = asset.toLowerCase();
    const assetData = assets.find(a => a.key === assetKey || a.symbol.toLowerCase() === assetKey);
    
    if (assetData && state.entries[assetData.key]) {
        const entry = state.entries[assetData.key];
        const pnl = ((parseFloat(price) - entry) / entry * 100).toFixed(1);
        state.portfolio[assetData.category] -= parseFloat(price) * parseFloat(quantity);
        state.portfolio.cash += parseFloat(price) * parseFloat(quantity);
        delete state.entries[assetData.key];
        addAlert(`Exited ${assetData.symbol}: ${pnl}% P&L`);
    }
}

function exportData() {
    const data = {
        prices: state.prices,
        portfolio: state.portfolio,
        entries: state.entries,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thinkingzaka-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initial update
    updateMarket();
    
    // Set interval (10 minutes)
    setInterval(updateMarket, 600000);
    
    // Event listeners
    document.getElementById('refreshBtn')?.addEventListener('click', updateMarket);
    document.getElementById('clearAlerts')?.addEventListener('click', () => {
        document.getElementById('alertList').innerHTML = '<li class="alert-placeholder">System ready. Waiting for signals...</li>';
    });
    
    document.getElementById('recordEntryBtn')?.addEventListener('click', recordEntry);
    document.getElementById('recordExitBtn')?.addEventListener('click', recordExit);
    document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
    
    // Strategy modal
    const modal = document.getElementById('strategyModal');
    document.getElementById('viewStrategyBtn')?.addEventListener('click', () => {
        modal.style.display = 'flex';
    });
    
    document.getElementById('closeStrategyModal')?.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
    
    // Install PWA
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        const installBtn = document.getElementById('installPWA');
        installBtn.style.display = 'inline';
        installBtn.onclick = async () => {
            e.prompt();
            const { outcome } = await e.userChoice;
            if (outcome === 'accepted') installBtn.style.display = 'none';
        };
    });
});

// Expose to window
window.thinkingzaka = { state, assets, updateMarket };
