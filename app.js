const assets = {
  btc: "bitcoin",
  gold: "gold",
  pltr: "palantir",
  qqq: "nasdaq-100",
  sol: "solana"
};

const zones = {
  btc: [63000, 65000],
  sol: [78, 81],
  pltr: [142, 148]
};

async function fetchPrice(asset) {
  let url;
  if(asset === "pltr") return Math.round(140 + Math.random()*20); // Mock
  if(asset === "qqq") return Math.round(595 + Math.random()*20); // Mock
  url = `https://api.coingecko.com/api/v3/simple/price?ids=${asset}&vs_currencies=usd`;
  let res = await fetch(url);
  let data = await res.json();
  return data[asset]?.usd || 0;
}

function updateCard(id,name,price){
  let card = document.getElementById(id);
  card.innerHTML = `<h3>${name}</h3>
  <div class="price">$${price}</div>
  Last update: ${new Date().toLocaleTimeString()}`;
}

function checkZones(name,price){
  let zone = zones[name];
  if(!zone) return;
  if(price >= zone[0] && price <= zone[1]){
    createAlert(`${name.toUpperCase()} entered entry zone: ${zone[0]}–${zone[1]}`);
  }
}

function createAlert(text){
  let list = document.getElementById("alertList");
  let li = document.createElement("li");
  li.textContent = text;
  list.prepend(li);
}

async function updateMarket(){
  for(const [id,asset] of Object.entries(assets)){
    let price = await fetchPrice(asset);
    updateCard(id, id.toUpperCase(), price);
    checkZones(id, price);
  }
}

function updateMacro(){
  let btcPrice = parseFloat(document.querySelector("#btc .price")?.textContent.replace("$","")) || 0;
  let pltrPrice = parseFloat(document.querySelector("#pltr .price")?.textContent.replace("$","")) || 0;
  let score = btcPrice > 65000 ? -1 : 1;
  score += pltrPrice > 150 ? -1 : 1;
  document.getElementById("macroStatus").innerText = score > 0 ? "WAR BIAS" : "PEACE BIAS";
}

setInterval(updateMarket,20000);
setInterval(updateMacro,30000);
updateMarket();
updateMacro();
