import { decideRoute, groundThresholdC, calculateDepartureTime } from "../src/decision-engine.js";
import { summariseHistory, validateHistoryChecks } from "../src/history-summary.js";

const SOURCES={
 tonight:"https://bdaib-hub.pages.dev/data/winter/tonight.csv",
 routes:"https://bdaib-hub.pages.dev/data/winter/routes.csv",
 history:"https://bdaib-hub.pages.dev/data/winter/history.csv",
 forecast:"https://api.open-meteo.com/v1/forecast?latitude=53.99,54.04,54.07,53.88,53.92,53.87,54.06,54.11,53.83,53.9&longitude=-7.345,-7.38,-7.44,-7.33,-6.98,-7.54,-7.09,-7.58,-7.08,-6.8&hourly=temperature_2m,soil_temperature_0cm,dew_point_2m,precipitation&forecast_hours=24&timezone=Europe%2FDublin"
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=v=>Number.isFinite(Number(v))?Number(v).toFixed(1):"—";
const pct=v=>Math.max(0,Math.min(99,Math.round(Number(v||0)*100)));
const clean=v=>String(v??"").trim();
const csvParse=text=>{const lines=text.trim().split(/\r?\n/);if(!lines.length)return[];const parseLine=l=>{const out=[];let cur="",q=false;for(let i=0;i<l.length;i++){const c=l[i];if(c==='"'){if(q&&l[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur);cur="";}else cur+=c;}out.push(cur);return out;};const h=parseLine(lines[0]);return lines.slice(1).filter(Boolean).map(l=>{const a=parseLine(l),o={};h.forEach((k,i)=>o[k]=a[i]??"");return o;});};
const num=(v,d=0)=>{const x=Number(v);return Number.isFinite(x)?x:d};
const bool=v=>["1","true","yes","y","ready"].includes(clean(v).toLowerCase());
let routes=[],depots=[],history=[],forecast=[],routeRows=[],map;

function get(row,...keys){for(const k of keys){if(row&&row[k]!==undefined&&clean(row[k])!=="")return row[k];}return null;}
function routeId(r,i){return clean(get(r,"route_id","route","id","routeid"))||"R"+String(i+1).padStart(2,"0");}
function routeName(r,i){return clean(get(r,"route_name","name","route","road"))||routeId(r,i);}
function priorityOf(r){const x=clean(get(r,"priority","priority_level")).replace(/^P/i,"");return num(x,2);}
function depotOf(r){return clean(get(r,"depot","depot_id","depot_name"));}
function stockFor(d){return num(get(d,"salt_stock_t","stock_t","salt_stock","salt_t"),0);}
function truckFor(d){return bool(get(d,"trucks_ready","truck_ready","trucks","ready"));}
function saltNeeded(r){return num(get(r,"salt_needed_t","salt_t","required_salt_t","salt_needed"),5);}
function lengthKm(r){return num(get(r,"length_km","route_km","km","length"),20);}

function modelRisk(route,f,hoursBelow0){
 const rc={"R01":-2.7939898557,"R02":-1.0624001093,"R03":0.1989959132,"R04":-0.7299384364,"R05":1.6473900689,"R06":-1.0159525339,"R07":0.4791935627,"R08":1.3699410407,"R09":0.7054879878,"R10":1.2208953727}[route]||0;
 const z=-5.569648475+rc
 +1.1714244552*((num(f.temperature_2m)-3.8033112583)/3.6526927782)
 -5.6482422456*((num(f.soil_temperature_0cm)-4.0446688742)/2.9392504884)
 -.3892016548*((num(f.dew_point_2m)-2.5625827815)/3.5172456795)
 +.2661719783*((num(f.precipitation)-1.7965231788)/3.1843685628)
 +.4223293317*((hoursBelow0-1.1447019878)/3.7922352366)
 +1.6176344671*((num(f.soil_temperature_0cm)-4.071192053)/3.0655160498);
 return 1/(1+Math.exp(-z));
}
function hoursBelow0(series){return series.filter(x=>num(x)<=0).length;}
function zeroTime(series,time){const i=series.findIndex(v=>num(v)<=0);return i<0?null:new Date(time[i]);}
function nearestForecast(i){return forecast[i]||{time:[],temperature_2m:[],soil_temperature_0cm:[],dew_point_2m:[],precipitation:[]};}

async function fetchText(url,timeoutMs=12000){
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
   const r=await fetch(url,{cache:"no-store",signal:controller.signal,mode:"cors"});
   if(!r.ok) throw new Error(url+" "+r.status);
   return await r.text();
 }finally{clearTimeout(timer);}
}
async function fetchJson(url,timeoutMs=12000){return JSON.parse(await fetchText(url,timeoutMs));}

const COORDS=[
 [53.99,-7.345],[54.04,-7.38],[54.07,-7.44],[53.88,-7.33],[53.92,-6.98],
 [53.87,-7.54],[54.06,-7.09],[54.11,-7.58],[53.83,-7.08],[53.9,-6.8]
];
async function loadForecast(){
 const url=SOURCES.forecast;
 try{
   const f=await fetchJson(url,14000);
   const arr=Array.isArray(f)?f:[f];
   if(arr.length && arr.some(x=>x.hourly)) return arr.map(x=>x.hourly||x);
 }catch(e){}
 // Same Open-Meteo source, one coordinate per request as a resilient fallback.
 const qs=COORDS.map(([lat,lon])=>fetchJson(
   "https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+
   "&hourly=temperature_2m,soil_temperature_0cm,dew_point_2m,precipitation&forecast_hours=24&timezone=Europe%2FDublin",9000
 ).then(x=>x.hourly||x));
 return await Promise.all(qs);
}
async function load(){
 routes=[];depots=[];history=[];forecast=[];
 const errors=[];
 const status=(msg)=>{const el=$("#dataStatus");if(el)el.textContent=msg;};
 status("Loading live weather…");

 const routeP=fetchText(SOURCES.routes).then(t=>{routes=csvParse(t);return"routes";}).catch(()=>{errors.push("routes");return"routes";});
 const depotP=fetchText(SOURCES.tonight).then(t=>{depots=csvParse(t);return"depot";}).catch(()=>{errors.push("depot");return"depot";});
 const historyP=fetchText(SOURCES.history,20000).then(t=>{history=csvParse(t);return"history";}).catch(()=>{errors.push("history");return"history";});
 const forecastP=loadForecast().then(f=>{
   forecast=f;
   status("Live weather connected");
   return"forecast";
 }).catch(()=>{
   errors.push("forecast");
   status("Weather feed unavailable");
   return"forecast";
 });
 await Promise.all([routeP,depotP,forecastP]);
 if(!routes.length){
   try{routes=csvParse(await fetchText("data/priority-routes.csv"));}catch(e){}
 }
 const connected=[routes.length,depots.length,forecast.length].filter(Boolean).length;
 status(forecast.length ? (connected===3?"Live data connected":"Live weather connected · other data partial") : "Data unavailable");
 $("#refreshTime").textContent=new Intl.DateTimeFormat("en-IE",{hour:"2-digit",minute:"2-digit"}).format(new Date());
 render();
 // History is non-blocking: it enriches the evidence panel without delaying tonight's weather decision.
 await historyP;
 if(errors.length){
   const labels={routes:"route network",depot:"depot data",history:"historical data",forecast:"forecast"};
   $("#networkReason").textContent="Live data loaded where available. Unavailable source: "+errors.map(x=>labels[x]).join(", ")+".";
 }
 render();
 return {rows:history.length,errors};
}
function findDepot(route){const name=depotOf(route);return depots.find(d=>clean(get(d,"depot","depot_id","name"))===name)||depots.find(d=>clean(get(d,"depot","depot_id","name")).toLowerCase()===name.toLowerCase())||depots[0]||{};}
function buildRows(){
 routeRows=routes.map((r,i)=>{
   const id=routeId(r,i),p=priorityOf(r),d=findDepot(r),f=nearestForecast(i);
   const series=f.soil_temperature_0cm||[], below=hoursBelow0(series), zt=zeroTime(series,f.time||[]);
   const fc={temperature_2m:num(f.temperature_2m?.[0],NaN),soil_temperature_0cm:num(f.soil_temperature_0cm?.[0],NaN),dew_point_2m:num(f.dew_point_2m?.[0],NaN),precipitation:num(f.precipitation?.[0],NaN)};
   const decision=decideRoute({priority:p,groundC:fc.soil_temperature_0cm,rainMm:fc.precipitation,dewPointC:fc.dew_point_2m,depotStockT:stockFor(d),depotCapacityT:num(get(d,"depot_capacity_t","capacity_t"),NaN),saltNeededT:saltNeeded(r),trucksReady:truckFor(d),routeLengthKm:lengthKm(r),groundReachZeroAt:zt?.toISOString()});
   return {...decision,route_id:id,route:routeName(r,i),priority:p,depot:depotOf(r)||clean(get(d,"depot","name"))||"—",forecast:fc,hoursBelow0:below,risk:modelRisk(id,fc,below),departureAt:decision.departureAt};
 });
}
function render(){
 buildRows();
 const treat=routeRows.filter(x=>x.decision==="TREAT").length,flag=routeRows.filter(x=>x.decision==="FLAG").length,max=Math.max(...routeRows.map(x=>x.risk),0);
 if(!routeRows.length){
   $("#networkDecision").textContent="DATA CHECK";
   $("#networkReason").textContent="No route records are currently available. The engineer should not use this page for an operational call.";
   $("#routeList").innerHTML='<div class="empty-state"><div class="empty-icon">!</div><b>Waiting for route data</b><span>Source data could not be loaded safely. No placeholder operational decision is shown.</span></div>';
   $("#routeTable").innerHTML='<tr><td colspan="7">Route data unavailable — no operational decision issued.</td></tr>';
   $("#treatCount").textContent="—";$("#flagCount").textContent="—";$("#maxRisk").textContent="—";
   $("#signoffDecision").textContent="NO DECISION";$("#signoffRisk").textContent="—";
   return;
 }
 $("#treatCount").textContent=treat;$("#flagCount").textContent=flag;$("#maxRisk").textContent=pct(max)+"%";
 $("#networkDecision").textContent=treat?"TREATMENT REQUIRED":"MONITOR";
 $("#networkReason").textContent=treat?treat+" route(s) pass the plan's temperature/moisture gate. Stock, truck readiness and timing are shown per route.":"No route currently passes the plan's temperature/moisture gate.";
 $("#signoffDecision").textContent=treat?"TREATMENT REQUIRED":"MONITOR";$("#signoffRisk").textContent=pct(max)+"%";
 $("#routeList").innerHTML=routeRows.map(x=>'<div class="route-item"><div class="route-line"><span class="route-name">'+x.route_id+" · "+x.route+'</span><span class="decision '+x.decision+'">'+label(x.decision)+'</span></div><div class="route-meta">P'+x.priority+" · "+x.depot+" · ground "+fmt(x.forecast.soil_temperature_0cm)+"°C · "+(x.moisture?.possible?"moisture possible":"dry")+'</div><div class="riskbar"><i style="width:'+pct(x.risk)+'%"></i></div><div class="route-extra"><span>ML hazard '+pct(x.risk)+'%</span><span>'+ (x.departureAt?("leave "+time(x.departureAt)):"no departure")+'</span></div></div>').join("");
 $("#routeTable").innerHTML=routeRows.map(x=>'<tr><td>'+x.route_id+" · "+x.route+'</td><td><span class="pbadge">P"+x.priority+'</span></td><td class="'+(x.forecast.soil_temperature_0cm<=groundThresholdC(x.priority)?"temp-warn":"temp-good")+'">'+fmt(x.forecast.soil_temperature_0cm)+'°C</td><td>'+(x.moisture?.possible?"Possible":"Dry")+'</td><td><span class="risk '+(x.risk>.7?"high":x.risk>.35?"med":"low")+'">'+pct(x.risk)+'%</span></td><td><span class="decision '+x.decision+'">'+label(x.decision)+'</span></td><td>'+time(x.departureAt)+'</td></tr>').join("");
 const f=forecast[0]||{};const times=f.time||[], soil=f.soil_temperature_0cm||[];
 $("#forecastStrip").innerHTML=Array.from({length:8},(_,h)=>{const s=soil[h],t=times[h];return '<div class="hour '+(s<=0?"cold":s<=1.5?"warn":"")+'"><div class="t">'+(t?new Intl.DateTimeFormat("en-IE",{hour:"2-digit"}).format(new Date(t)):"+"+h+"h")+'</div><div class="temp">'+fmt(s)+'°</div><div class="soil">ground</div></div>';}).join("");
 const hs=summariseHistory(history),tot=validateHistoryChecks(history);$("#historyRows").textContent=tot.rows.toLocaleString();$("#historyRuns").textContent=tot.gritting_runs.toLocaleString();$("#historySalt").textContent=tot.salt_t.toFixed(1);
 const candidates=hs.map(x=>({x,score:(num(x.ice_incidents_untreated)-num(x.ice_incidents_treated))})).sort((a,b)=>b.score-a.score);
 const top=candidates[0]?.x;if(top){$("#reviewRoute").textContent=top.route_id+" · "+top.route;$("#reviewText").innerHTML='<strong>'+top.ice_incidents_untreated+'</strong> untreated-night ice incidents vs <strong>'+top.ice_incidents_treated+'</strong> treated-night incidents.';}
}
function label(d){return d==="DONT_TREAT"?"DON'T TREAT":d.replaceAll("_"," ");}
function time(v){if(!v)return"—";return new Intl.DateTimeFormat("en-IE",{hour:"2-digit",minute:"2-digit"}).format(new Date(v));}
function initMap(){
 map=L.map("map",{zoomControl:false}).setView([53.96,-7.28],9);
 L.control.zoom({position:"bottomright"}).addTo(map);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map);
 routeRows.forEach((x,i)=>{
   const c=COORDS[i];if(!c)return;
   const color=x.decision==="TREAT"?"#2e9b68":x.decision==="FLAG"?"#c4544d":"#d39e43";
   L.circleMarker(c,{radius:9,weight:3,color,fillColor:color,fillOpacity:.82}).addTo(map)
    .bindPopup("<b>"+x.route_id+" · "+x.route+"</b><br>Priority P"+x.priority+"<br>Ground "+fmt(x.forecast.soil_temperature_0cm)+"°C<br>Model risk "+pct(x.risk)+"%<br><b>"+label(x.decision)+"</b>");
 });
}
function wire(){
 const now=new Date();$("#dateLabel").textContent=new Intl.DateTimeFormat("en-IE",{weekday:"long",day:"numeric",month:"long"}).format(now).toUpperCase();const tick=()=>$("#clock").textContent=new Intl.DateTimeFormat("en-IE",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:"Europe/Dublin"}).format(new Date());tick();setInterval(tick,1000);
 $$("[data-filter]").forEach(b=>b.addEventListener("click",()=>{$$("[data-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");const f=b.dataset.filter;$("#routeTable").querySelectorAll("tr").forEach((tr,i)=>tr.style.display=f==="all"||routeRows[i].decision===f?"":"none");}));
 $("#approveBtn").addEventListener("click",()=>$("#humanLog").textContent="Approved by Duty Engineer · "+new Date().toLocaleTimeString("en-IE"));
 $("#overrideBtn").addEventListener("click",()=>{const reason=prompt("Record override reason:");if(reason)$("#humanLog").textContent="Override recorded · "+reason;});
 const open=()=>$("#modal").hidden=false,close=()=>$("#modal").hidden=true;$("#detailsBtn").addEventListener("click",open);$("#sourceBtn").addEventListener("click",open);$("#close").addEventListener("click",close);$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")close();});
}
await load();render();wire();initMap();