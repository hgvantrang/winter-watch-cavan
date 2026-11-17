import { decideRoute, groundThresholdC } from "../src/decision-engine.js";
const coords=[[53.99,-7.345],[54.04,-7.38],[54.07,-7.44],[53.88,-7.33],[53.92,-6.98],[53.87,-7.54],[54.06,-7.09],[54.11,-7.58],[53.83,-7.08],[53.9,-6.8]];
const routes=["R01","R02","R03","R04","R05","R06","R07","R08","R09","R10"];
const names={R01:"N3 Virginia",R02:"N54 Cavan–Monaghan",R03:"N55 Ballyjamesduff",R04:"R198 Hospital",R05:"R165 Bailieborough Road",R06:"R188 Kingscourt",R07:"R154 Belturbet",R08:"R199 Shercock",R09:"R203 Killeshandra",R10:"R162 Kingscourt Hill"};
const priority={R01:1,R02:1,R03:1,R04:1,R05:2,R06:2,R07:2,R08:2,R09:2,R10:3};
const history={R01:{treated:0,untreated:0,runs:38},R02:{treated:0,untreated:1,runs:41},R03:{treated:1,untreated:1,runs:34},R04:{treated:0,untreated:1,runs:89},R05:{treated:10,untreated:1,runs:49},R06:{treated:1,untreated:0,runs:19},R07:{treated:1,untreated:0,runs:45},R08:{treated:2,untreated:0,runs:43},R09:{treated:0,untreated:2,runs:54},R10:{treated:0,untreated:19,runs:27}};
const fallback=coords.map((_,i)=>({temperature_2m:3-i*.12,soil_temperature_0cm:1.6-i*.16,dew_point_2m:.8-i*.08,precipitation:i%3===0?.2:0}));
let forecast=fallback,rows=[],map;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=v=>Number.isFinite(Number(v))?Number(v).toFixed(1):"—";
const pct=v=>Math.max(0,Math.min(99,Math.round(v*100)));
function modelRisk(route,f){
 const rc={R01:-2.7939898557,R02:-1.0624001093,R03:.1989959132,R04:-.7299384364,R05:1.6473900689,R06:-1.0159525339,R07:.4791935627,R08:1.3699410407,R09:.7054879878,R10:1.2208953727}[route]||0;
 const z=-5.569648475+rc-5.6482422456*((f.soil_temperature_0cm-4.0446688742)/2.9392504884)+1.6176344671*((f.soil_temperature_0cm-4.071192053)/3.0655160498)-.3892016548*((f.dew_point_2m-2.5625827815)/3.5172456795)+.2661719783*((f.precipitation-1.7965231788)/3.1843685628);
 return 1/(1+Math.exp(-z));
}
function label(d){return d==="DONT_TREAT"?"DON'T TREAT":d.replace("_"," ");}
async function loadForecast(){
 try{
  const lat=coords.map(c=>c[0]).join(","),lon=coords.map(c=>c[1]).join(",");
  const u="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&hourly=temperature_2m,soil_temperature_0cm,dew_point_2m,precipitation&forecast_hours=24&timezone=Europe%2FDublin";
  const res=await fetch(u);if(!res.ok)throw new Error("forecast");
  const d=await res.json();
  forecast=routes.map((_,i)=>({temperature_2m:d[i].hourly.temperature_2m[0],soil_temperature_0cm:d[i].hourly.soil_temperature_0cm[0],dew_point_2m:d[i].hourly.dew_point_2m[0],precipitation:d[i].hourly.precipitation[0]}));
  $("#dataStatus").textContent="Forecast live";$("#refreshTime").textContent=new Intl.DateTimeFormat("en-IE",{hour:"2-digit",minute:"2-digit"}).format(new Date());
 }catch(e){$("#dataStatus").textContent="Forecast fallback";$("#refreshTime").textContent="feed unavailable";}
}
function build(){rows=routes.map((r,i)=>{const f=forecast[i],p=priority[r];return Object.assign(decideRoute({priority:p,groundC:f.soil_temperature_0cm,rainMm:f.precipitation,dewPointC:f.dew_point_2m,depotStockT:100,depotCapacityT:200,saltNeededT:5,trucksReady:true,routeLengthKm:20,groundReachZeroAt:null}),{route:r,name:names[r],priority:p,f:f,risk:modelRisk(r,f),hist:history[r]});});}
function render(){
 build();
 const treat=rows.filter(x=>x.decision==="TREAT").length,flag=rows.filter(x=>x.decision==="FLAG").length,max=Math.max.apply(null,rows.map(x=>x.risk));
 $("#treatCount").textContent=treat;$("#flagCount").textContent=flag;$("#maxRisk").textContent=pct(max)+"%";
 $("#networkDecision").textContent=treat?"TREATMENT REQUIRED":"MONITOR";$("#networkReason").textContent=treat?treat+" route(s) pass the temperature/moisture gate; depot stock and truck readiness remain operational checks.":"No route currently passes the temperature/moisture gate.";
 $("#signoffDecision").textContent=treat?"TREATMENT REQUIRED":"MONITOR";$("#signoffRisk").textContent=pct(max)+"%";
 $("#routeList").innerHTML=rows.map(x=>'<div class="route-item"><div class="route-line"><span class="route-name">'+x.route+" · "+x.name+'</span><span class="decision '+x.decision+'">'+label(x.decision)+'</span></div><div class="route-meta">P'+x.priority+" · ground "+fmt(x.f.soil_temperature_0cm)+"°C · moisture "+(x.moisture?.possible?"possible":"dry")+'</div><div class="riskbar"><i style="width:'+pct(x.risk)+'%"></i></div><div class="route-extra"><span>ML hazard '+pct(x.risk)+'%</span><span>'+ (x.decision==="TREAT"?"Timing check":"Plan check")+'</span></div></div>').join("");
 $("#routeTable").innerHTML=rows.map(x=>'<tr><td>'+x.route+" · "+x.name+'</td><td><span class="pbadge">P'+x.priority+'</span></td><td class="'+(x.f.soil_temperature_0cm<=groundThresholdC(x.priority)?"temp-warn":"temp-good")+'">'+fmt(x.f.soil_temperature_0cm)+'°C</td><td>'+(x.moisture?.possible?"Possible":"Dry")+'</td><td><span class="risk '+(x.risk>.7?"high":x.risk>.35?"med":"low")+'">'+pct(x.risk)+'%</span></td><td><span class="decision '+x.decision+'">'+label(x.decision)+'</span></td><td>—</td></tr>').join("");
 const f=forecast[0]||fallback[0];$("#forecastStrip").innerHTML=Array.from({length:8},(_,h)=>{const s=f.soil_temperature_0cm-h*.08;return '<div class="hour '+(s<=.5?"cold":s<=1.5?"warn":"")+'"><div class="t">+'+h+'h</div><div class="temp">'+fmt(s)+'°</div><div class="soil">ground</div></div>';}).join("");
}
function initMap(){map=L.map("map",{zoomControl:false}).setView([53.96,-7.28],9);L.control.zoom({position:"bottomright"}).addTo(map);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map);rows.forEach((x,i)=>{const c=coords[i],color=x.decision==="TREAT"?"#2e9b68":x.decision==="FLAG"?"#c4544d":"#d39e43";L.circleMarker(c,{radius:8,weight:3,color:color,fillColor:color,fillOpacity:.8}).addTo(map).bindPopup("<b>"+x.route+" · "+x.name+"</b><br>Priority P"+x.priority+"<br>Ground "+fmt(x.f.soil_temperature_0cm)+"°C<br>Model risk "+pct(x.risk)+"%<br><b>"+label(x.decision)+"</b>");});}
function wire(){
 const now=new Date();$("#dateLabel").textContent=new Intl.DateTimeFormat("en-IE",{weekday:"long",day:"numeric",month:"long"}).format(now).toUpperCase();
 const tick=()=>$("#clock").textContent=new Intl.DateTimeFormat("en-IE",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:"Europe/Dublin"}).format(new Date());tick();setInterval(tick,1000);
 $$("[data-filter]").forEach(b=>b.addEventListener("click",()=>{$$("[data-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");const f=b.dataset.filter;$("#routeTable").querySelectorAll("tr").forEach((tr,i)=>tr.style.display=f==="all"||rows[i].decision===f?"":"none");}));
 $("#approveBtn").addEventListener("click",()=>$("#humanLog").textContent="Approved by Duty Engineer · "+new Date().toLocaleTimeString("en-IE"));
 $("#overrideBtn").addEventListener("click",()=>{const reason=prompt("Record override reason:");if(reason)$("#humanLog").textContent="Override recorded · "+reason;});
 const open=()=>$("#modal").hidden=false,close=()=>$("#modal").hidden=true;$("#detailsBtn").addEventListener("click",open);$("#sourceBtn").addEventListener("click",open);$("#close").addEventListener("click",close);$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")close();});
}
await loadForecast();render();wire();initMap();