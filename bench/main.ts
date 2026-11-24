// The engine bench: every number the engine knows about one place and one
// moment, laid out plainly so engineers and reviewers can check it against
// the sky. Nothing here is KAIROS's design; it is a test instrument.

import {
  HOUR,
  chronosAt,
  creatureDayAt,
  describePlanet,
  formatCreatureDate,
  formatPosition,
  holidaysOn,
  instantIn,
  locality,
  moonClock,
  nightAround,
  nightSky,
  perParticipant,
  positionAt,
  speak,
  type Arc,
  type Locality,
} from "../src/engine";

const PLACES: Locality[] = [
  locality(47.6, -122.3, { name: "Seattle", timeZone: "America/Los_Angeles" }),
  locality(40.7, -74.0, { name: "New York", timeZone: "America/New_York" }),
  locality(51.5, -0.1, { name: "London", timeZone: "Europe/London" }),
  locality(35.7, 139.7, { name: "Tokyo", timeZone: "Asia/Tokyo" }),
  locality(-33.9, 151.2, { name: "Sydney", timeZone: "Australia/Sydney" }),
  locality(-0.2, -78.5, { name: "Quito", timeZone: "America/Guayaquil" }),
  locality(69.6, 19.0, { name: "Tromsø", timeZone: "Europe/Oslo" }),
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const placeSelect = $<HTMLSelectElement>("place");
const offsetInput = $<HTMLInputElement>("offset");

let places = [...PLACES];
const renderOptions = () => {
  placeSelect.innerHTML = places
    .map((p, i) => `<option value="${i}">${p.name} (${p.latitude}, ${p.longitude})</option>`)
    .join("");
};
renderOptions();

const place = () => places[Number(placeSelect.value)]!;
const instant = () => Date.now() + Number(offsetInput.value) * HOUR;
const clock = (t: number, p: Locality) => chronosAt(t, p).time;

function renderHere(t: number, p: Locality) {
  const pos = positionAt(t, p);
  const day = creatureDayAt(t, p);
  const holidays = holidaysOn(day);
  const spoken = speak(pos);
  $("here").innerHTML = `
    <h2>Here, now</h2>
    <div class="big ${pos.kind}">${formatPosition(pos)}</div>
    <div>${spoken.short} · ${spoken.long}</div>
    <div>${formatCreatureDate(day)}${holidays.length ? ` · ${holidays.join(", ")}` : ""}</div>
    <p class="dim">chronos: ${chronosAt(t, p).text}<br />
    one ${pos.kind === "day" ? "Hora" : "Vigilia"} here is ${(pos.hourLength / 60000).toFixed(1)} min;
    one unit is ${(pos.hourLength / 100 / 1000).toFixed(1)} s<br />
    arc source: ${pos.arc.source}</p>`;
}

function rows(arc: Arc, from: number, to: number, p: Locality, t: number) {
  const out: string[] = [];
  for (let h = 1; h <= 12; h++) {
    const start = instantIn(arc, h);
    const end = h === 12 ? arc.end : instantIn(arc, h + 1);
    if (start < from - 1 || start >= to) continue;
    const now = start <= t && t < end;
    const label = `${h}${arc.kind === "day" ? "H" : "V"}`;
    out.push(
      `<tr class="${now ? "now" : ""}"><td class="${arc.kind}">${label}</td><td>${clock(start, p)}</td><td class="dim">${((end - start) / 60000).toFixed(0)} min</td></tr>`,
    );
  }
  return out.join("");
}

function renderDay(t: number, p: Locality) {
  const day = creatureDayAt(t, p);
  $("day").innerHTML = `
    <h2>${day.weekdayName}: its 24 hours (boundary: ${day.boundary})</h2>
    <table>
      ${rows(day.nightBefore, day.start, day.end, p, t)}
      ${rows(day.horae, day.start, day.end, p, t)}
      ${rows(day.nightAfter, day.start, day.end, p, t)}
    </table>`;
}

function moonSvg(illuminated: number, brightLimb: number, northPole: number) {
  const r = 46;
  // Drawn with the lit side to the right, then turned so it faces brightLimb
  // (degrees counterclockwise from up).
  const rx = Math.abs(1 - 2 * illuminated) * r;
  const sweep = illuminated > 0.5 ? 1 : 0;
  const lit = `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx} ${r} 0 0 ${sweep} 0 ${-r} Z`;
  const pole = (northPole * Math.PI) / 180;
  return `<svg width="120" height="120" viewBox="-60 -60 120 120" aria-label="the moon as seen here">
    <circle r="${r}" fill="#2b2c33" />
    <path d="${lit}" fill="#e8e4d6" transform="rotate(${270 - brightLimb})" />
    <line x1="0" y1="0" x2="${(-Math.sin(pole) * (r + 10)).toFixed(1)}" y2="${(-Math.cos(pole) * (r + 10)).toFixed(1)}" stroke="#d98c8c" stroke-width="1.5" />
  </svg>`;
}

function renderMoon(t: number, p: Locality) {
  const m = moonClock(t, p);
  const when = (x: number | null) => (x === null ? "—" : `${clock(x, p)} (${formatPosition(positionAt(x, p), "quarter")})`);
  $("moon").innerHTML = `
    <h2>Moon clock</h2>
    <div class="moon">
      ${moonSvg(m.illuminated, m.brightLimb, m.northPole)}
      <div>
        <div>${m.phaseName}, ${(m.illuminated * 100).toFixed(1)}% lit, ${m.age.toFixed(1)} days</div>
        <div>${m.up ? "up" : "below the horizon"}: altitude ${m.altitude.toFixed(1)}°, azimuth ${m.azimuth.toFixed(1)}°</div>
        <div>lit side ${m.brightLimb.toFixed(1)}°, her north ${m.northPole.toFixed(1)}° <span class="dim">(ccw from up; red line)</span></div>
        <div>libration lat ${m.libration.latitude.toFixed(2)}°, lon ${m.libration.longitude.toFixed(2)}°</div>
        <div class="dim">next rise ${when(m.nextRise)}, next set ${when(m.nextSet)}</div>
      </div>
    </div>`;
}

function renderNight(t: number, p: Locality) {
  const sky = nightSky(nightAround(t, p), p);
  const lines = sky.planets.map((pl) => describePlanet(pl) ?? `${pl.planet}: not seen tonight`);
  $("night").innerHTML = `
    <h2>Tonight's vigils (from ${clock(sky.night.start, p)})</h2>
    <div class="vigils">${sky.vigils
      .map((v) => `<div class="q-${v.quality}" title="${v.quality}, sun ${v.sunAltitude.toFixed(0)}°, moon ${v.moonAltitude.toFixed(0)}°">${v.vigil}V</div>`)
      .join("")}</div>
    <div class="dim">pale: moonlit · violet: the Hour of the Ancient Ones · slate: twilight</div>
    <p>${lines.join("<br />")}</p>`;
}

function renderMeeting(t: number) {
  const views = perParticipant(
    { start: t, end: t + HOUR },
    PLACES.map((p) => ({ name: p.name!, place: p })),
  );
  $("meeting").innerHTML = `
    <h2>One instant, every sky (a one-hour meeting starting now)</h2>
    <table>${views
      .map(
        (v) => `<tr><td>${v.participant.name}</td><td class="${v.start.kind}">${formatPosition(v.start, "quarter")}</td><td>${v.day.weekdayName}</td><td class="dim">${clock(t, v.participant.place)}</td><td class="${v.asks === "horae" ? "day" : "night"}">asks for ${v.asks}</td></tr>`,
      )
      .join("")}</table>`;
}

function render() {
  const t = instant();
  const p = place();
  const offset = Number(offsetInput.value);
  $("offsetLabel").textContent = offset === 0 ? "live" : `${offset > 0 ? "+" : ""}${offset} h from now`;
  renderHere(t, p);
  renderDay(t, p);
  renderMoon(t, p);
  renderNight(t, p);
  renderMeeting(t);
}

placeSelect.addEventListener("change", render);
offsetInput.addEventListener("input", render);
$("now").addEventListener("click", () => {
  offsetInput.value = "0";
  render();
});
$("mine").addEventListener("click", () => {
  // Asked only on click; snapped to city grain; never leaves the page.
  navigator.geolocation?.getCurrentPosition(
    ({ coords }) => {
      places = [locality(coords.latitude, coords.longitude, { name: "my sky" }), ...PLACES];
      renderOptions();
      placeSelect.value = "0";
      render();
    },
    () => undefined,
    { enableHighAccuracy: false, maximumAge: 3_600_000, timeout: 10_000 },
  );
});

render();
setInterval(() => {
  if (offsetInput.value === "0") render();
}, 10_000);
