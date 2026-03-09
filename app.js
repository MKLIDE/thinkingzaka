// ===========================
// ThinkingZaka v1.1 - Live Dashboard
// ===========================

const ALPHA_API_KEY = "75IQNS7TVU6Z7WR6"; // Consider moving to env variable

const assets = {
  btc: "bitcoin",
  sol: "solana",
  pltr: "PLTR",
  qqq: "QQQ",
  gold: "XAUUSD"
};

const entryZones = {
  btc: [63000, 65000],
  sol: [78, 81],
  pltr: [142, 148],
  qqq: [595, 603],
  gold: [4805, 5000]
};

// Cache to reduce API calls and track state
const cache = {
  prices: {},
  lastFetch: {},
  errors: {}
};

const CONFIG = {
  CACHE_DURATION: 20000, // 20 seconds cache
  RETRY_DELAY: 5000, // 5 seconds retry
  MAX_RETRIES: 2
};

// Utility for fetching JSON with retry logic and timeout
async function fetchJSON(url, retries = CONFIG.MAX_RETRIES) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (retries > 0 && error.name !== 'AbortError') {
      await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY));
      return fetchJSON(url, retries - 1);
    }
    throw error;
  }
}

// Check if cache is valid
function isCacheValid(assetId) {
  return cache.lastFetch[assetId] && 
         (Date.now() - cache.lastFetch[assetId] < CONFIG.CACHE_DURATION) &&
         cache.prices[assetId] !== undefined;
}

// ---------------- Crypto via CoinGecko
async function getCryptoPrice(id) {
  if (isCacheValid(id)) return cache.prices[id];
  
  try {
    const data = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const price = data[id]?.usd || 0;
    
    if (price === 0) throw new Error(`Invalid price for ${id}`);
    
    cache.prices[id] = price;
    cache.lastFetch[id] = Date.now();
    delete cache.errors[id];
    
    return price;
  } catch (error) {
    cache.errors[id] = error.message;
    console.error(`Error fetching ${id}:`, error);
    return cache.prices[id] || 0; // Return last known price
  }
}

// ---------------- Stocks/Gold via Alpha Vantage
async function getStockPrice(symbol) {
  if (isCacheValid(symbol)) return cache.prices[symbol];
  
  try {
    const func = symbol === "XAUUSD" ? "CURRENCY_EXCHANGE_RATE" : "GLOBAL_QUOTE";
    const url = func === "GLOBAL_QUOTE"
      ? `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&apikey=${ALPHA_API_KEY}`
      : `https://www.alphavantage.co/query?function=${func}&from_currency=XAU&to_currency=USD&apikey=${ALPHA_API_KEY}`;
    
    const data = await fetchJSON(url);
    
    let price = 0;
    if (func === "GLOBAL_QUOTE") {
      // Check if we got a valid response
      if (!data["Global Quote"] || !data["Global Quote"]["05. price"]) {
        throw new Error(`Invalid Alpha Vantage response for ${symbol}`);
      }
      price = parseFloat(data["Global Quote"]["05. price"]);
    } else {
      if (!data["Realtime Currency Exchange Rate"] || !data["Realtime Currency Exchange Rate"]["5. Exchange Rate"]) {
        throw new Error(`Invalid Alpha Vantage response for gold`);
      }
      price = parseFloat(data["Realtime Currency Exchange Rate"]["5. Exchange Rate"]);
    }
    
    if (isNaN(price) || price === 0) throw new Error(`Invalid price for ${symbol}`);
    
    cache.prices[symbol] = price;
    cache.lastFetch[symbol] = Date.now();
    delete cache.errors[symbol];
    
    return price;
  } catch (error) {
    cache.errors[symbol] = error.message;
    console.error(`Error fetching ${symbol}:`, error);
    return cache.prices[symbol] || 0;
  }
}

// ---------------- Update Cards & Alerts
function updateCard(id, name, price) {
  const card = document.getElementById(id);
  if (!card) return;
  
  // Handle stale/error state
  if (price === 0 && cache.errors[id]) {
    card.innerHTML = `<h3>${name}</h3>
      <div class="price error">⚠️ Offline</div>
      <small>Last: $${(cache.prices[id] || 0).toLocaleString()}</small><br>
      <small class="timestamp">${new Date().toLocaleTimeString()}</small>`;
    return;
  }
  
  const arrow = cache.prices[id] ? (price > cache.prices[id] ? "↑" : (price < cache.prices[id] ? "↓" : "→")) : "";
  const priceChangeClass = price > cache.prices[id] ? "up" : (price < cache.prices[id] ? "down" : "stable");
  
  cache.prices[id] = price;
  
  card.innerHTML = `<h3>${name}</h3>
    <div class="price ${priceChangeClass}">$${price.toLocaleString()} ${arrow}</div>
    <small class="timestamp">${new Date().toLocaleTimeString()}</small>`;
}

// Check entry zones with debounce to avoid spam
const alertThrottle = {};

function checkEntryZone(id, price) {
  const zone = entryZones[id];
  if (!zone || price === 0) return;
  
  const inZone = price >= zone[0] && price <= zone[1];
  const lastAlert = alertThrottle[id] || 0;
  const now = Date.now();
  
  if (inZone && (now - lastAlert > 60000)) { // Max once per minute
    alertThrottle[id] = now;
    createAlert(`🚨 ${id.toUpperCase()} entered ENTRY ZONE: ${zone[0]}–${zone[1]} (Current: $${price})`);
    notifyUser(`${id.toUpperCase()} ALERT`, `Price at $${price}`);
  } else if (!inZone && lastAlert > 0 && (now - lastAlert > 300000)) {
    // Clear throttle if out of zone for 5 minutes
    alertThrottle[id] = 0;
  }
}

// ---------------- Alerts with max limit
function createAlert(text) {
  const list = document.getElementById("alertList");
  if (!list) return;
  
  const li = document.createElement("li");
  li.textContent = text;
  li.classList.add('alert-item');
  list.prepend(li);
  
  // Keep only last 10 alerts
  while (list.children.length > 10) {
    list.removeChild(list.lastChild);
  }
}

// ---------------- Notifications
let notificationPermission = false;

async function initNotifications() {
  if (!("Notification" in window)) return false;
  
  if (Notification.permission === "granted") {
    notificationPermission = true;
  } else if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    notificationPermission = permission === "granted";
  }
  return notificationPermission;
}

function notifyUser(title, text) {
  if (!notificationPermission) return;
  new Notification(title, { body: text, silent: false });
}

// ---------------- Macro Regime with better logic
function updateMacro() {
  const btcPrice = cache.prices.btc || 0;
  const pltrPrice = cache.prices.pltr || 0;
  
  // More nuanced scoring
  let score = 0;
  score += btcPrice > 65000 ? -2 : (btcPrice > 60000 ? -1 : 1);
  score += pltrPrice > 150 ? -2 : (pltrPrice > 100 ? -1 : 1);
  
  const status = score > 0 ? "🛡️ WAR BIAS" : (score < 0 ? "☮️ PEACE BIAS" : "⚖️ NEUTRAL");
  document.getElementById("macroStatus").innerText = status;
}

// ---------------- Main Update with rate limiting
let isUpdating = false;
let updateInterval;

async function updateMarket() {
  if (isUpdating) return; // Prevent concurrent updates
  isUpdating = true;
  
  try {
    // Show loading state
    document.querySelectorAll('.price').forEach(el => {
      if (!el.classList.contains('error')) {
        el.classList.add('loading');
      }
    });
    
    // Parallel fetching for better performance
    const [btcPrice, solPrice, pltrPrice, qqqPrice, goldPrice] = await Promise.allSettled([
      getCryptoPrice("bitcoin"),
      getCryptoPrice("solana"),
      getStockPrice("PLTR"),
      getStockPrice("QQQ"),
      getStockPrice("XAUUSD")
    ]);
    
    // Update each card with results (handle both fulfilled and rejected)
    updateCard("btc", "BTC", btcPrice.status === 'fulfilled' ? btcPrice.value : 0);
    checkEntryZone("btc", btcPrice.status === 'fulfilled' ? btcPrice.value : 0);
    
    updateCard("sol", "SOL", solPrice.status === 'fulfilled' ? solPrice.value : 0);
    checkEntryZone("sol", solPrice.status === 'fulfilled' ? solPrice.value : 0);
    
    updateCard("pltr", "PLTR", pltrPrice.status === 'fulfilled' ? pltrPrice.value : 0);
    checkEntryZone("pltr", pltrPrice.status === 'fulfilled' ? pltrPrice.value : 0);
    
    updateCard("qqq", "QQQ", qqqPrice.status === 'fulfilled' ? qqqPrice.value : 0);
    checkEntryZone("qqq", qqqPrice.status === 'fulfilled' ? qqqPrice.value : 0);
    
    updateCard("gold", "GOLD", goldPrice.status === 'fulfilled' ? goldPrice.value : 0);
    checkEntryZone("gold", goldPrice.status === 'fulfilled' ? goldPrice.value : 0);
    
    updateMacro();
    
    // Show last successful update time
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
    
  } catch (error) {
    console.error('Update failed:', error);
    createAlert(`⚠️ Update failed: ${error.message}`);
  } finally {
    isUpdating = false;
    
    // Remove loading class
    document.querySelectorAll('.price').forEach(el => {
      el.classList.remove('loading');
    });
  }
}

// ---------------- Manual refresh button
function manualRefresh() {
  createAlert('🔄 Manual refresh triggered');
  updateMarket();
}

// ---------------- Status indicator
function updateConnectionStatus() {
  const errors = Object.keys(cache.errors).length;
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;
  
  if (errors > 0) {
    statusEl.innerHTML = `⚠️ ${errors} source(s) offline`;
    statusEl.className = 'status-warning';
  } else {
    statusEl.innerHTML = '✅ All sources online';
    statusEl.className = 'status-ok';
  }
}

// ---------------- Initialize
async function init() {
  // Request notification permission on load
  await initNotifications();
  
  // Add connection status indicator if not exists
  if (!document.getElementById('connectionStatus')) {
    const header = document.querySelector('h1') || document.body;
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connectionStatus';
    statusDiv.className = 'status-ok';
    header.insertAdjacentElement('afterend', statusDiv);
  }
  
  // Add last update time if not exists
  if (!document.getElementById('lastUpdateTime')) {
    const macroEl = document.getElementById('macroStatus');
    if (macroEl) {
      const timeEl = document.createElement('small');
      timeEl.id = 'lastUpdateTime';
      timeEl.style.marginLeft = '10px';
      macroEl.insertAdjacentElement('afterend', timeEl);
    }
  }
  
  // Start updates
  updateMarket();
  updateInterval = setInterval(updateMarket, 30000);
  
  // Check connection status periodically
  setInterval(updateConnectionStatus, 5000);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
  });
}

// Add some CSS classes dynamically
const style = document.createElement('style');
style.textContent = `
  .price.up { color: #00ff00; }
  .price.down { color: #ff0000; }
  .price.stable { color: #ffff00; }
  .price.loading { opacity: 0.5; }
  .price.error { color: #ff6666; }
  .status-ok { color: #00ff00; }
  .status-warning { color: #ffff00; }
  .timestamp { font-size: 0.8em; color: #888; }
  .alert-item { animation: fadeIn 0.3s; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;
document.head.appendChild(style);

// Start the dashboard
init();

// Expose manual refresh to console/window
window.refreshDashboard = manualRefresh;
