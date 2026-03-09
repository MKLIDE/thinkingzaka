const levels = {

btcBuy:65000,
btcSell:73000,

solBuy:80,
solSell:100,

goldWar:2100,

qqqBuy:595,
qqqSell:616,

pltrBuy:148,
pltrSell:186

}

async function loadPrices(){

let btc = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")
.then(r=>r.json())

let sol = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")
.then(r=>r.json())

let btcPrice = btc.bitcoin.usd
let solPrice = sol.solana.usd

document.getElementById("btc").innerText="$"+btcPrice
document.getElementById("sol").innerText="$"+solPrice

checkSignals(btcPrice,solPrice)

}

function checkSignals(btc,sol){

if(btc <= levels.btcBuy){

setSignal("btcSignal","BUY","buy")

notify("Bitcoin entering buy zone")

}

else if(btc >= levels.btcSell){

setSignal("btcSignal","SELL","sell")

notify("Bitcoin near resistance")

}

else{

setSignal("btcSignal","PREPARE","prepare")

}

if(sol <= levels.solBuy){

setSignal("solSignal","BUY","buy")

notify("Solana entering buy zone")

}

else if(sol >= levels.solSell){

setSignal("solSignal","SELL","sell")

}

else{

setSignal("solSignal","PREPARE","prepare")

}

detectMarketMode()

}

function setSignal(id,text,className){

let el=document.getElementById(id)

el.innerHTML=text
el.className=className

}

function detectMarketMode(){

if(document.getElementById("btcSignal").innerHTML==="SELL"){

document.getElementById("mode").innerHTML="⚠ WAR MODE"

}

else{

document.getElementById("mode").innerHTML="🚀 PEACE MODE"

}

}

function notify(msg){

if(Notification.permission==="granted"){

new Notification(msg)

}

}

Notification.requestPermission()

setInterval(loadPrices,60000)

loadPrices()

loadNews()

async function loadNews(){

let res=await fetch("https://cryptopanic.com/api/v1/posts/?auth_token=demo")

let data=await res.json()

let list=document.getElementById("news")

data.results.slice(0,5).forEach(article=>{

let li=document.createElement("li")

li.innerText=article.title

list.appendChild(li)

})

}
