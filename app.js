/*  app.js  –  ID-Future Dashboard logic  */
import { csvParse } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";

/*  Data files (keep at repo root)  */
const CSV   = 'infectious-diseases-by-county-year-and-sex.csv';
const GEO   = 'california_counties.geojson';

/*  DOM handles  */
const diseaseSel = document.getElementById('disease');
const sexSel     = document.getElementById('sex');
const countySel  = document.getElementById('county');

/*  Global data  */
let rows = [];
let geo  = null;

/* ---------- Utility helpers ---------- */
const uniq      = arr => [...new Set(arr)].sort();
const titleCase = s   => s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const sumByKey  = (arr,keyFn)=>{           // lightweight roll-up
  const m=new Map();
  arr.forEach(r=>{
    const k=keyFn(r);
    m.set(k,(m.get(k)||0)+r.Cases);
  });
  return [...m.entries()].sort((a,b)=>a[0]-b[0]);
};

/* ---------- Minimal error banner ---------- */
function showError(msg){
  const div=document.createElement('div');
  div.style.cssText='background:#b00020;color:#fff;padding:.5rem;font-family:monospace;text-align:center';
  div.textContent='⚠ '+msg;
  document.body.prepend(div);
}

/* ---------- Load both files, then boot ---------- */
Promise.all([
  fetch(CSV).then(r=>r.ok ? r.text() : Promise.reject('CSV not found')),
  fetch(GEO).then(r=>r.ok ? r.json(): Promise.reject('GeoJSON not found'))
]).then(([csvText,geoJson])=>{
    rows = csvParse(csvText,d=>({
      Disease:d.Disease,
      County :titleCase(d.County),
      Year   :+d.Year,
      Sex    :d.Sex,
      Cases  :+d.Cases
    }));
    geo=geoJson;
    initControls();
    render();          // first draw
}).catch(showError);

/* ---------- Build dropdowns ---------- */
function initControls(){
  uniq(rows.map(r=>r.Disease))
    .forEach(d=>diseaseSel.insertAdjacentHTML('beforeend',`<sl-option value="${d}">${d}</sl-option>`));
  uniq(rows.map(r=>r.County))
    .forEach(c=>countySel.insertAdjacentHTML('beforeend',`<sl-option value="${c}">${c}</sl-option>`));

  diseaseSel.addEventListener('sl-change',render);
  sexSel.addEventListener('sl-change',render);
  countySel.addEventListener('sl-change',render);
}

/* ---------- Main render ---------- */
function render(){
  if(!diseaseSel.value) return;          // wait till user picks a disease
  const dis = diseaseSel.value;
  const sex = sexSel.value;
  const hct = countySel.value || 'All';

  const subset = rows.filter(r=>r.Disease===dis && r.Sex===sex);
  drawChart(subset,dis,sex);
  drawMap(subset,dis,hct);
}

/* ---------- Yearly time-series ---------- */
function drawChart(subset,dis,sex){
  const yearly = sumByKey(subset, r=>r.Year);
  const x = yearly.map(d=>d[0]), y = yearly.map(d=>d[1]);

  Plotly.react('chart',[{
      x,y,
      type:'scatter',
      mode:'lines+markers',
      line:{color:'#18ffff',width:3},
      marker:{color:'#b388ff',size:6}
    }],{
      paper_bgcolor:'rgba(0,0,0,0)',
      plot_bgcolor :'rgba(0,0,0,0)',
      font:{color:'#eceff1',family:'Orbitron'},
      title:`${dis} cases by year (${sex})`,
      xaxis:{title:'Year'},
      yaxis:{title:'Cases'}
    },{responsive:true});
}

/* ---------- County choropleth ---------- */
function drawMap(subset,dis,highlight){
  const totals = sumByKey(subset, r=>r.County);
  const locs = totals.map(d=>d[0]);
  const z    = totals.map(d=>d[1]);

  const baseTrace = {
    type:'choropleth',
    geojson:geo,
    featureidkey:'properties.name',
    locations:locs,
    z,
    colorscale:'Viridis',
    colorbar:{title:'Cases'},
    marker:{line:{color:'#111',width:0.4}}
  };

  const hlTrace = highlight!=='All' ? {
    type:'choropleth',
    geojson:geo,
    featureidkey:'properties.name',
    locations:[highlight],
    z:[1],
    colorscale:[[0,'#ff4081'],[1,'#ff4081']],
    showscale:false,
    marker:{line:{color:'#ff4081',width:1}}
  } : null;

  const data = hlTrace ? [baseTrace,hlTrace] : [baseTrace];

  Plotly.react('map',data,{
      geo:{
        scope:'usa',
        center:{lat:37.3,lon:-119.5},
        fitbounds:'locations',
        bgcolor:'rgba(0,0,0,0)'
      },
      paper_bgcolor:'rgba(0,0,0,0)',
      margin:{l:0,r:0,t:40,b:0},
      title:`${dis} burden by county`
    },{responsive:true});
}
