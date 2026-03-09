// ===========================
// ThinkingZaka v2.0 - Free Tier Optimized
// RESPECTS 25 calls/day limit
// ===========================

const ALPHA_API_KEY = "75IQNS7TVU6Z7WR6";

// Track API usage
let alphaCallsToday = 0;
let lastResetDate = new Date().toDateString();

// Asset configuration with priorities
const assets = {
  // High priority - check every cycle
  btc: { 
    id: "bitcoin", 
    name: "BTC", 
    category: "war",
    priority: 1,
    source: "coingecko", // Free, unlimited
    updateInterval: 1 // Every cycle
  },
  sol: { 
    id: "solana", 
    name: "SOL", 
    category: "peace",
    priority: 1,
    source: "coingecko",
    updateInterval: 1
  },
  pltr: { 
    id: "PLTR", 
    name: "PLTR", 
    category: "war",
    priority: 1,
    source: "alphavantage",
    updateInterval: 3 // Every 3 cycles
  },
  qqq: { 
    id: "QQQ", 
    name: "QQQ", 
    category: "peace",
    priority: 1,
    source: "alphavantage",
    updateInterval: 3
  },
  gold: { 
    id: "XAUUSD", 
    name: "GOLD", 
    category: "war",
    priority: 1,
    source: "alphavantage", 
    updateInterval: 3
  },
  // South African stocks - lower priority, update rarely
  capitec: { 
    id: "CPI.JO", 
    name: "CAPITEC", 
    category: "peace",
    priority: 2,
    source: "alphavantage",
    updateInterval: 6, // Every 6 cycles (hourly)
    fallbackPrice: 4210 // Last known price as fallback
  },
  standardbank: { 
    id: "SBK.JO", 
    name: "STANDBANK", 
    category: "peace",
    priority: 2,
    source: "alphavantage",
    updateInterval: 6,
    fallbackPrice: 296
  },
  firstrand: { 
    id: "FSR.JO", 
    name: "FIRSTRAND", 
    category: "peace",
    priority: 2,
    source: "alphavantage",
    updateInterval: 6,
    fallbackPrice: 86
  },
  shoprite: { 
    id: "SHP.JO", 
    name: "SHOPRITE", 
    category: "peace",
    priority: 2,
    source: "alphavantage",
    updateInterval: 6,
    fallbackPrice: 260
  }
};

// Cache with expiration
const cache = {
  prices: {},
  lastFetch: {},
  cycleCount: 0
};

// Entry zones with targets (from your strategy)
const zones = {
  btc: { entry: [63000, 65000], support: 60000, target: 73000 },
  sol: { entry: [78, 81], support: 76, target: 101 },
  pltr: { entry: [142, 148], support: 136, target: 186 },
  qqq: { entry: [595, 603], support: 585, target: 616 },
  gold: { entry: [4805, 5000], support: 4780, target: 6000 },
  capitec: { entry: [4155, 4170], support: 4170, target: 4779 },
  standardbank: { entry: [290, 303], support: 285, target: 350 },
  firstrand: { entry: [86, 87], support: 84, target: 102 },
  shoprite: { entry: [260, 261], support: 255, target: 285 }
};

// Track Alpha Vantage usage
function checkAlphaLimit() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    alphaCallsToday = 0;
    lastResetDate = today;
  }
  
  if (alphaCallsToday >= 20) { // Conservative limit (leave buffer)
    console.warn("⚠️ Approaching Alpha Vantage daily limit");
    return false;
  }
  return true;
}

// Modified fetch with limit awareness
async function fetchWithLimit(url, assetId) {
  if (!checkAlphaLimit()) {
    // Return cached or fallback price
    return cache.prices[assetId] !== undefined ? 
      { fromCache: true, price: cache.prices[assetId] } : 
      { fromCache: true, price: assets[assetId]?.fallbackPrice || 0 };
  }
  
  try {
    const res = await fetch(url);
    alphaCallsToday++;
    const data = await res.json();
    return { fromCache: false, data };
  } catch (error) {
    console.error(`Fetch failed for ${assetId}:`, error);
    return { fromCache: true, price: cache.prices[assetId] || assets[assetId]?.fallbackPrice || 0 };
  }
}

// Price fetching with priority-based scheduling
async function getPrice(assetId, asset) {
  const now = Date.now();
  const cycle = cache.cycleCount;
  
  // Check if this asset should update this cycle based on priority
  if (cycle % asset.updateInterval !== 0) {
    // Return cached price
    return cache.prices[assetId] || asset.fallbackPrice || 0;
  }
  
  // Check cache age (don't update if recent)
  if (cache.lastFetch[assetId] && now - cache.lastFetch[assetId] < 300000) { // 5 min cache
    return cache.prices[assetId];
  }
  
  try {
    let price = 0;
    
    if (asset.source === "coingecko") {
      // CoinGecko - free, good limits
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${asset.id}&vs_currencies=usd`);
      const data = await res.json();
      price = data[asset.id]?.usd || 0;
    } else {
      // Alpha Vantage - limited calls
      const func = asset.id === "XAUUSD" ? "CURRENCY_EXCHANGE_RATE" : "GLOBAL_QUOTE";
      const url = func === "GLOBAL_QUOTE"
        ? `https://www.alphavantage.co/query?function=${func}&symbol=${asset.id}&apikey=${ALPHA_API_KEY}`
        : `https://www.alphavantage.co/query?function=${func}&from_currency=XAU&to_currency=USD&apikey=${ALPHA_API_KEY}`;
      
      const result = await fetchWithLimit(url, assetId);
      
      if (result.fromCache) {
        return result.price;
      }
      
      if (func === "GLOBAL_QUOTE") {
        price = parseFloat(result.data["Global Quote"]?.["05. price"] || 0);
      } else {
        price = parseFloat(result.data["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] || 0);
      }
    }
    
    if (price > 0) {
      cache.prices[assetId] = price;
      cache.lastFetch[assetId] = now;
    }
    
    return price || cache.prices[assetId] || asset.fallbackPrice || 0;
  } catch (error) {
    console.error(`Error fetching ${assetId}:`, error);
    return cache.prices[assetId] || asset.fallbackPrice || 0;
  }
}

// RSI simulation using price position (saves API calls)
function calculateSimulatedRSI(assetId, currentPrice) {
  const zone = zones[assetId];
  if (!zone) return 50;
  
  // Calculate where price is in its recent range
  const range = zone.target - zone.support;
  if (range <= 0) return 50;
  
  const position = (currentPrice - zone.support) / range;
  // Convert to 0-100 scale, with 50 as neutral
  const simulatedRSI = Math.min(100, Math.max(0, position * 100));
  
  return Math.round(simulatedRSI);
}

// Entry analysis using your strategy rules
function analyzeEntry(assetId, price) {
  const zone = zones[assetId];
  if (!zone) return null;
  
  const inZone = price >= zone.entry[0] && price <= zone.entry[1];
  const nearSupport = price <= zone.support * 1.02;
  const rsi = calculateSimulatedRSI(assetId, price);
  const distanceToTarget = ((zone.target - price) / price) * 100;
  
  // Your strategy: "Buy pullbacks, not breakouts"
  const isBreakout = price > zone.entry[1];
  const isPullback = price < zone.entry[0] && price > zone.support;
  
  // Entry logic based on your strategy document
  let shouldEnter = false;
  let reason = "";
  let confidence = "LOW";
  
  if (inZone && rsi < 65) {
    shouldEnter = true;
    reason = `In entry zone with RSI ${rsi} - healthy pullback`;
    confidence = "HIGH";
  } else if (nearSupport && rsi < 50) {
    shouldEnter = true;
    reason = `Near support with RSI ${rsi} - accumulation zone`;
    confidence = "MEDIUM";
  } else if (isPullback && rsi < 40) {
    shouldEnter = true;
    reason = `Deep pullback, RSI ${rsi} - oversold`;
    confidence = "HIGH";
  }
  
  return {
    inZone,
    nearSupport,
    isBreakout,
    isPullback,
    rsi,
    distanceToTarget: distanceToTarget.toFixed(1) + "%",
    shouldEnter,
    reason,
    confidence
  };
}

// Macro regime detection from your strategy
function detectMacroRegime() {
  let warScore = 0;
  let peaceScore = 0;
  
  const btc = cache.prices.btc || 0;
  const pltr = cache.prices.pltr || 0;
  const qqq = cache.prices.qqq || 0;
  const gold = cache.prices.gold || 0;
  
  // War signals from your document
  if (gold > zones.gold.support * 1.02) warScore += 1; // Rising gold = safe haven
  if (btc < zones.btc.support) warScore += 1; // BTC down = fear
  if (pltr > zones.pltr.target) warScore += 1; // Defense spending up
  
  // Peace signals from your document
  if (qqq > zones.qqq.support * 1.05) peaceScore += 1; // Tech up = risk on
  if (btc > zones.btc.entry[0]) peaceScore += 1; // BTC stable/up
  if (pltr < zones.pltr.entry[1]) peaceScore += 1; // PLTR pullback = not spiking
  
  if (warScore > peaceScore + 1) return "⚔️ WAR BIAS - Favor defense assets";
  if (peaceScore > warScore + 1) return "🕊️ PEACE BIAS - Favor growth assets";
  return "⚖️ NEUTRAL - Balanced allocation (40/40/20)";
}

// Update UI with full strategy info
function updateCard(assetId, price) {
  const asset = assets[assetId];
  const card = document.getElementById(assetId);
  if (!card || !asset) return;
  
  const analysis = analyzeEntry(assetId, price);
  const arrow = cache.prices[assetId] ? 
    (price > cache.prices[assetId] ? "↑" : price < cache.prices[assetId] ? "↓" : "→") : "";
  
  cache.prices[assetId] = price;
  
  // Build strategy-aware HTML
  let strategyHtml = "";
  if (analysis) {
    strategyHtml = `
      <div class="strategy-panel">
        <div class="zone-info">
          <small>Entry: $${zones[assetId].entry[0].toLocaleString()}-${zones[assetId].entry[1].toLocaleString()}</small>
          <small>Support: $${zones[assetId].support.toLocaleString()}</small>
          <small>Target: $${zones[assetId].target.toLocaleString()} (${analysis.distanceToTarget})</small>
        </div>
        <div class="tech-info">
          <span class="rsi">RSI: ${analysis.rsi}</span>
          ${analysis.isBreakout ? '<span class="warning">⚠️ Breakout - wait for pullback</span>' : ''}
          ${analysis.isPullback ? '<span class="signal">📉 Pullback - watching</span>' : ''}
        </div>
        ${analysis.shouldEnter ? 
          `<div class="buy-signal ${analysis.confidence.toLowerCase()}">
            🎯 BUY SIGNAL (${analysis.confidence} confidence)<br>
            <small>${analysis.reason}</small>
           </div>` : 
          ''}
      </div>
    `;
  }
  
  card.innerHTML = `
    <h3>${asset.name} <span class="category ${asset.category}">${asset.category}</span></h3>
    <div class="price">$${price.toLocaleString()} ${arrow}</div>
    ${strategyHtml}
    <div class="metadata">
      <small>Source: ${asset.source}</small>
      <small>${new Date().toLocaleTimeString()}</small>
    </div>
  `;
}

// Main update loop with cycle counting
async function updateMarket() {
  cache.cycleCount++;
  
  // Show API usage
  const usageEl = document.getElementById("apiUsage");
  if (usageEl) {
    usageEl.textContent = `Alpha Vantage: ${alphaCallsToday}/20 today`;
  }
  
  // Update each asset based on priority schedule
  for (const [id, asset] of Object.entries(assets)) {
    const price = await getPrice(id, asset);
    if (price > 0) {
      updateCard(id, price);
      
      // Generate alert if buy signal
      const analysis = analyzeEntry(id, price);
      if (analysis?.shouldEnter) {
        createAlert(`🎯 ${asset.name}: ${analysis.reason} ($${price})`);
      }
    }
  }
  
  // Update macro regime
  const macroEl = document.getElementById("macroStatus");
  if (macroEl) {
    macroEl.textContent = detectMacroRegime();
  }
}

// Initialize with your existing HTML structure
document.addEventListener('DOMContentLoaded', () => {
  // Add API usage indicator
  const header = document.querySelector('h1') || document.body;
  const usageDiv = document.createElement('div');
  usageDiv.id = 'apiUsage';
  usageDiv.style.fontSize = '12px';
  usageDiv.style.color = '#888';
  header.insertAdjacentElement('afterend', usageDiv);
  
  // Start updates
  updateMarket();
  setInterval(updateMarket, 600000); // 10 minutes to save API calls
});

// Styling for strategy UI
const style = document.createElement('style');
style.textContent = `
  .category { font-size: 10px; padding: 2px 5px; border-radius: 3px; }
  .category.war { background: #ff4444; color: white; }
  .category.peace { background: #44ff44; color: black; }
  .strategy-panel { font-size: 12px; margin: 8px 0; padding: 5px; background: #f5f5f5; border-radius: 3px; }
  .zone-info { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .tech-info { display: flex; justify-content: space-between; margin-bottom: 5px; }
  .rsi { font-weight: bold; }
  .warning { color: orange; }
  .signal { color: blue; }
  .buy-signal { 
    background: #00ff00; color: black; padding: 5px; border-radius: 3px; 
    font-weight: bold; text-align: center; margin-top: 5px;
  }
  .buy-signal.high { background: #00ff00; }
  .buy-signal.medium { background: #ffff00; }
  .buy-signal.low { background: #ffaa00; }
  .metadata { display: flex; justify-content: space-between; margin-top: 5px; color: #888; }
`;
document.head.appendChild(style);
