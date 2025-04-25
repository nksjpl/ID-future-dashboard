/* app.js – core logic for ID-Future Dashboard (ES2020 modules) */
import { csvParse } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";

/* ---------- FILE PATHS ---------- */
const CSV_PATH = 'infectious-diseases-by-county-year-and-sex.csv';
const GEO_PATH = 'california_counties.geojson';

/* ---------- DOM refs ---------- */
const diseaseSel = document.getElementById('disease');
const sexSel     = document.getElementById('sex');
const countySel  = document.getElementById('county');

/* ---------- Global state ---------- */
let rows = [];
let geo  = null;

/* ---------- Fetch data ---------- */
Promise.all([fetch(CSV_PATH).then(r=>r.text()), fetch(GEO_PATH).then(r=>r.json())])
  .then(([csvText, geoJson])=>{
      rows = csvParse(csvText, d=>({
        Disease:d.Disease,
        County:titleCase(d.County),
        Year:+d.Year,
        Sex:d.Sex,
        Cases:+d.Cases
      }));
      geo  = geoJson;
      initControls();
      render();
  });

/* ---------- Helpers ---------- */
const uniq = arr => [...new Set(arr)].sort();
const titleCase = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function initControls(){
  uniq(rows.map(r=>r.Disease))
    .forEach(d=>diseaseSel.insertAdjacentHTML('beforeend',`<sl-option value="${d}">${d}</sl-option>`));
  uniq(rows.map(r=>r.County))
    .forEach(c=>countySel.insertAdjacentHTML('beforeend',`<sl-option value="${c}">${c}</sl-option>`));
  diseaseSel.addEventListener('sl-change', render);
  sexSel.addEventListener('sl-change', render);
  countySel.addEventListener('sl-change', render);
}

function render(){
  const dis = diseaseSel.value;
  const sex = sexSel.value;
  const cty = countySel.value || "All";

  const filtered = rows.filter(r=>r.Disease===dis && r.Sex===sex);
  drawChart(filtered, dis, sex);
  drawMap(filtered, dis, cty);
}

/* ---------- Chart ---------- */
function drawChart(data, dis, sex){
  const yearly = rollupSum(data, r=>r.Year);
  const x = yearly.map(d=>d[0]), y = yearly.map(d=>d[1]);

  Plotly.react('chart',[{
      x, y, type:'scatter', mode:'lines+markers',
      line:{color:'#18ffff',width:3}, marker:{color:'#b388ff',size:6}
    }],
    {paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
     font:{color:'#e0e0e0',family:'Orbitron'},
     title:`${dis} cases by year (${sex})`,
     xaxis:{title:'Year'}, yaxis:{title:'Cases'}},
    {responsive:true});
}

function rollupSum(arr, keyFn){
  const m = new Map();
  arr.forEach(r=>{
    const k=keyFn(r);
    m.set(k, (m.get(k)||0) + r.Cases);
  });
  return [...m.entries()].sort((a,b)=>a[0]-b[0]);
}

/* ---------- Map ---------- */
function drawMap(data, dis, highlight){
  const countyTotal = rollupSum(data, r=>r.County);
  const locs = countyTotal.map(d=>d[0]);
  const z    = countyTotal.map(d=>d[1]);

  const highlightTrace = highlight!=="All" ? [{
     type:'choropleth', geojson:geo, featureidkey:'properties.name',
     locations:[highlight], z:[1],
     colorscale:[[0,'#ff4081'],[1,'#ff4081']],
     showscale:false, marker:{line:{color:'#ff4081',width:1}}
  }] : [];

  Plotly.react('map',[
      {type:'choropleth', geojson:geo, featureidkey:'properties.name',
       locations:locs, z, colorscale:'Viridis',
       colorbar:{title:'Cases'}, marker:{line:{color:'#111',width:0.5)}},
      ...highlightTrace
    ],
    {geo:{scope:'usa',center:{lat:37.3,lon:-119.5},fitbounds:'locations',
          bgcolor:'rgba(0,0,0,0)'},
     paper_bgcolor:'rgba(0,0,0,0)',
     margin:{l:0,r:0,t:40,b:0},
     title:`${dis} burden by county`},
    {responsive:true});
}
