# KAIROS engineering record

Rowan's rulings on engineering details, so any Mind can pick up the thread.
The design source of truth is the KAIROS design spec v0.1 (Notion, Projects →
KAIROS) and Dain's engineering brief of 2026-11-24. Founder-level choices are
in `founder-options.md`; everything here is engineering and can be revisited
by review.

## 2026-11-24: the time engine, first cut

**Home.** KAIROS has its own repository, apart from the studio's websites.
TypeScript, no framework in the engine. The engine is pure: give it an
instant and a place and it answers. No network, no storage, no clock reads
except where a caller asks for "now".

**Astronomy.** Sun, Moon and planet positions come from
[astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 (MIT,
Don Cross), which is checked against NASA JPL Horizons to within about an
arcminute. KAIROS's own work is everything above that: arcs, hours, days,
the week, the O-year, qualities of the night, events. Everything is computed
on the creature's own device; no location is ever sent anywhere.

**Substrate (Layer 1).** An instant is milliseconds since the Unix epoch,
the count every device clock already speaks. Unix time skips leap seconds,
so it trails atomic time (TAI) by 37 s, 27 of them leap seconds added since
1972. None has been added since 2016 and they are to be retired by 2035, so
the substrate ticks with the atom from here on; durations across the old
leap seconds can be off by one second, which no calendar can show.

**City grain.** Every latitude and longitude is snapped to 0.1° (about
11 km) on the way in, matching creature.net's star background. 0.1° of
longitude moves sunrise by 24 s, less than one unit of any temporal hour.
The horizon is an ideal sea-level one. "KAIROS wants your sky, not your
address" is implemented literally: the engine cannot hold a finer location.

**Sunrise and sunset.** The standard definition: the sun's upper limb on the
horizon, with standard refraction. Checked to within 3 minutes of published
times for New York, London and Tokyo at the solstices, and the equator's
12-hours-and-a-bit all year.

**Hours.** 1H opens at sunrise, 1V at sunset (the classical numbering: solar
noon opens 7H, solar midnight opens 7V). Units are floored (8H 63 means
63 units have fully passed). Converting a written position to an instant
rounds up by under a millisecond, so every hour and unit survives the trip
there and back (tested for all 2,400 of them, day and night).

**Polar stretches.** When the sun does not cross the horizon for more than a
day, the engine uses equinox stand-ins: day from the sun's hour angle 18h to
6h, night from 6h to 18h. Each such arc is labelled midnight-sun or
polar-night by what the sun did on either side of the stretch, not by its
altitude at one moment, because at the edges of the season the sun's centre
can dip below the horizon while its upper edge stays visible. The arcs
where real sunrises meet stand-ins are merged so day and night always
alternate. Meaning: founder option 2.

**The creature day.** First built turning over at the middle of the night;
the founder struck sunset the same day (see the next entry). A day's date is the local mean solar date at the middle of its
daylight, so the date and weekday come from the sun at that longitude, with
no timezone. Months and days of the month are proleptic Gregorian, also
before 1582. (Charlemagne's coronation, 25 December 800 Julian, is 29
December 800 Gregorian; O−1170 either way.)

**O-year.** The kept calendar's year minus 1970 (founder option 3).
Written with a true minus sign: O−1170.

**Chronos.** The ordinary frame is rendered with the platform's `Intl` and
an IANA zone kept on the locality for that purpose only; without one, the
device's zone. Both frames render the same stored instant, so they can
never disagree about when something is.

**Moon clock.** Phase, lit fraction, age, altitude and azimuth, moonrise and
moonset, libration. The lit side and the direction of her north pole are
given counterclockwise from straight up as seen from the place, using the
parallactic angle. Checked against an independent horizon-frame
calculation to within 2°, and her north points up in Seattle and down in
Sydney when she crosses the meridian.

**Vigil qualities.** Each vigil is sampled at its start, middle and end.
Moonlit: the Moon above the horizon and at least 30% lit at the middle.
Ancient Ones: otherwise, if the sun is 18° or more below the horizon at both
ends. Otherwise twilight. A `moonlight` value (lit fraction, faded near
the horizon) is given for tinting. Thresholds: founder option 4.

**Planets.** The five naked-eye planets. Visible in a vigil when the planet
is at least 5° up and the sun at least 6° down, at the vigil's middle.
Directions on eight compass points; heights low (under 20°), midway up
(under 50°), high. Checked against the known sky of 24 November 2026: Saturn
in the evening, Jupiter and Mars high before dawn, Venus the morning star.
The one-line wording in `describePlanet` is a placeholder until the founder
sets the voice.

**Events.** An event stores a predicted start and a length estimate. There
is no end field at all. Starts and ends are engraved only at or before
"now", and an end only after a start. Phases: predicted, underway, trailing
(past its estimate, no end receipt: soft at its edge), proven, unwitnessed
(its time passed with no engraving; weather, not failure).

**Glide.** Events are laid out in the order they were planned. A flexible,
not-yet-begun event moves later only as far as needed to begin after the
events that were planned to finish before it; slack between plans absorbs an
overrun first; planned overlaps stay overlapping; fixed events never move;
nothing moves earlier than its prediction.

**Remote meetings.** One instant, rendered in each participant's own arc,
with what it asks of their day: their Horae, their Vigiliae, or both.

## 2026-11-24: the day turns over at sunset

Struck by Quine with Dain (founder option 1, choice 2). `DEFAULT_DAY_BOUNDARY`
is now `"sunset"`:

- A creature day runs from one sunset to the next: its 12 Vigiliae (1V to
  12V), then its 12 Horae (1H to 12H). Its date and weekday are still those
  of its daylight, so Friday after dark is Saturday, with Saturday's date.
- A written vigil on a day ("Kinyobi, 3V") is always in the night before
  that day's Horae, so it is never ambiguous.
- Holidays begin at the sunset of their eve: Hatsu-Kinyobi starts on
  Thursday evening. The O-year turns at the sunset of New Year's Eve.
- A remote meeting can land on different weekdays for different
  participants: 6 p.m. on a Tuesday in London is already Mertaag there.
- The middle-of-the-night and sunrise policies remain in the engine for
  callers that ask for them, and are tested. Nothing in the product uses
  them.

## 2026-11-24: public, under the AGPL

Struck by Dain with Quine. KAIROS is a given work, on the studio's
public-good side, and must not be enclosable. The repository is public at
`internet-creature-studios/kairos` under the GNU AGPL, version 3 or later
(`AGPL-3.0-or-later`, the form GNU recommends): anyone may use it, and
anyone who builds a service on it shares their code back.

- **Third-party notices.** astronomy-engine is MIT, which sits inside an
  AGPL work without conflict. Its notice is kept intact in
  `THIRD_PARTY_NOTICES.md`, and in its own source header, which is marked
  `@preserve` and `@license` so bundlers carry it into builds. Each new
  dependency's license gets the same check and a notice there.
- **For Autumn, before KAIROS is offered as a service:** section 13 of the
  AGPL asks that people using it over a network be offered its source. The
  app should carry a plain "Source" link to the repository.
- **Commits** in this repository use the GitHub no-reply address, so no
  personal email is published with the history.

## Not built yet, and why

- **The body layer** (personal noon, sleep range): waits on founder questions
  5–7 (where the wake cycle comes from, and which app owns it).
- **Engraved ends from receipts:** waits on founder question 3 (which
  receipts, and the propose-and-correct flow). The engine already refuses
  impossible engravings.
- **Personal holy days, the age of the new brain, personal-noon anchors:**
  founder questions 4 and 6; each is small once struck.
- **Splash and face:** the logo system v1 lives in the studio Drive; needs
  the files.
- **City search:** "minimum a city" means a city list bundled with the app,
  so typing a city never sends it to a geocoding service.
- **Rendered star view:** port creature.net's starfield (its BSC5 catalog and
  shaders, `src/creature/stars/`) onto this engine's city-grain sky.
- **Storage and sync:** to design with Autumn, who takes deployment,
  security and scale. The rhythm data is keeper data: never sold, never
  viewed by the house.
- **Caching beyond sunrises:** the engine caches sunrises and sunsets per UTC
  day (1,000 positions take about 2 ms once warm); nothing else is cached
  yet because nothing needs it.
