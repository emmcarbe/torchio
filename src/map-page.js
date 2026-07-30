/**
 * The map page: places that carry coordinates, drawn twice over. A sketch in
 * plain SVG that needs nothing at all (so the page holds without scripts),
 * and, where scripts run, a real slippy map with tiles. Provenance is
 * visible: coordinates the edition declares or the editor confirmed are
 * filled, gazetteer suggestions awaiting review are hollow.
 *
 * Split out of site.js, byte for byte.
 */

import { escapeHTML } from './render.js';
import { chrome, jsonForScript } from './page-shell.js';
import { WORLD } from './world-data.js';

export function pressMapPage({ geoPlaces, pageFor, t, T, lang, theme, parent, pages }) {
    const lats = geoPlaces.map((p) => p.geo.lat);
    const lons = geoPlaces.map((p) => p.geo.lon);
    const pad = 1.5;
    const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
    const minLon = Math.min(...lons) - pad, maxLon = Math.max(...lons) + pad;
    const W = 720, H = 440;
    const px = (lon) => ((lon - minLon) / (maxLon - minLon)) * (W - 40) + 20;
    const py = (lat) => H - (((lat - minLat) / (maxLat - minLat)) * (H - 40) + 20);
    const showLabels = geoPlaces.length <= 25;
    let dots = '';
    for (const pl of geoPlaces) {
      const x = px(pl.geo.lon).toFixed(1), y = py(pl.geo.lat).toFixed(1);
      const unconfirmed = pl.geoSource === 'geonames';
      dots += unconfirmed
        ? `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="var(--accent)" stroke-width="1.5"><title>${escapeHTML(pl.label)}</title></circle>`
        : `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"><title>${escapeHTML(pl.label)}</title></circle>`;
      if (showLabels) {
        dots += `<text x="${(+x + 7).toFixed(1)}" y="${(+y + 3).toFixed(1)}" font-size="11" fill="var(--soft)" font-family="var(--mono)">${escapeHTML(pl.label)}</text>`;
      }
    }
    let land = '';
    for (const ring of WORLD) {
      let minx = 999, maxx = -999, miny = 999, maxy = -999;
      for (const [x, y] of ring) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
      if (maxx < minLon || minx > maxLon || maxy < minLat || miny > maxLat) continue;
      land += 'M' + ring.map(([x, y]) => `${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join('L') + 'Z';
    }
    const landPath = land
      ? `<path d="${land}" fill="var(--hair)" fill-opacity=".45" stroke="var(--faint)" stroke-width="1" fill-rule="evenodd"/>`
      : '';
    let grid = '';
    for (let lon = Math.ceil(minLon); lon <= maxLon; lon++) grid += `<line x1="${px(lon)}" y1="0" x2="${px(lon)}" y2="${H}" stroke="var(--hair)" stroke-width="1"/>`;
    for (let lat = Math.ceil(minLat); lat <= maxLat; lat++) grid += `<line x1="0" y1="${py(lat)}" x2="${W}" y2="${py(lat)}" stroke="var(--hair)" stroke-width="1"/>`;
    const markers = geoPlaces.map((pl) => ({
      lat: pl.geo.lat, lon: pl.geo.lon,
      label: pl.label, unconfirmed: pl.geoSource === 'geonames',
    }));
    const leafletInit = `
var map=L.map('map',{scrollWheelZoom:false});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
var pts=${jsonForScript(markers)};
var group=[];
pts.forEach(function(p){
  var m=L.circleMarker([p.lat,p.lon],{radius:7,color:'#B01E28',weight:2,
    fillColor:'#B01E28',fillOpacity:p.unconfirmed?0:0.9}).addTo(map);
  var pc=document.createElement('span');
  pc.textContent=p.label;
  if(p.unconfirmed){var q=document.createElement('span');q.style.color='#888';q.textContent=' (?)';pc.appendChild(q);}
  m.bindPopup(pc);
  group.push(m);
});
var lats=pts.map(function(p){return p.lat}),lons=pts.map(function(p){return p.lon});
var cLat=(Math.min.apply(null,lats)+Math.max.apply(null,lats))/2;
var cLon=(Math.min.apply(null,lons)+Math.max.apply(null,lons))/2;
var spanLat=Math.max(Math.max.apply(null,lats)-Math.min.apply(null,lats),0.05)*1.5;
var spanLon=Math.max(Math.max.apply(null,lons)-Math.min.apply(null,lons),0.05)*1.5;
function fit(){
  var s=map.getSize();
  if(!s.x||!s.y){setTimeout(fit,100);return;}
  var z=Math.floor(Math.min(
    Math.log2(s.x/256*360/spanLon),
    Math.log2(s.y/256*170/spanLat)));
  map.setView([cLat,cLon],Math.max(2,Math.min(12,z)));
}
fit();
window.addEventListener('resize',function(){map.invalidateSize();fit();});
`;
    let mapBody = `<main id="main" class="torchio" style="max-width:64rem">`
      + `<link rel="stylesheet" href="assets/leaflet/leaflet.css">`
      + `<div id="map" style="height:26rem;border:1px solid var(--hair);border-radius:2px" role="region" aria-label="${T.mapAria}"></div>`
      + `<script src="assets/leaflet/leaflet.js"></script><script>${leafletInit}</script>`
      + `<noscript><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T.mapAria}" style="width:100%;height:auto;border:1px solid var(--hair);border-radius:2px;background:var(--paper)">${landPath}${grid}${dots}</svg></noscript>`
      + `<p class="occ">${T.mapNote}</p><table class="idx-table">`;
    for (const pl of [...geoPlaces].sort((a, b) => a.label.localeCompare(b.label))) {
      mapBody += `<tr><td>${escapeHTML(pl.label)}${pl.geoSource === 'geonames' ? ' <span class="occ">?</span>' : ''}</td>`
        + `<td class="occ">${pl.geo.lat.toFixed(4)}, ${pl.geo.lon.toFixed(4)}</td>`
        + `<td class="occ"><a href="https://www.openstreetmap.org/?mlat=${pl.geo.lat}&amp;mlon=${pl.geo.lon}#map=12/${pl.geo.lat}/${pl.geo.lon}">OSM</a></td></tr>`;
    }
    mapBody += '</table></main>';
    return chrome({ title: t, sub: T.map.toLowerCase(), active: 'map.html', pages, body: mapBody, t: T, lang, theme, parent });
}
