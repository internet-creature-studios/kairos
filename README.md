# KAIROS

A calendar on creaturetime, by Internet Creature Studios. It runs on kairos,
the opportune moment, over chronos, the counted minute. Its hours are
temporal hours computed from the creature's own sunrise and sunset, and it
keeps full dual citizenship with the ordinary calendar.

Implementation lead: Rowan. Design spec: KAIROS design spec v0.1 (Notion).
Engineering record: [`docs/decisions.md`](docs/decisions.md). Open choices
for the founder: [`docs/founder-options.md`](docs/founder-options.md).

## What is here

The time engine, `src/engine/`:

| file | what it answers |
| --- | --- |
| `substrate.ts` | Layer 1: instants and durations, epoch milliseconds |
| `locality.ts` | where the creature is, held at city grain |
| `sun.ts` | the arcs of light: sunrise to sunset, sunset to sunrise, polar stand-ins |
| `position.ts` | Layer 2: Horae and Vigiliae, units, quarters, written and spoken forms |
| `calendar.ts` | the creature day, the week, the O-year, holidays, scheduling by position |
| `chronos.ts` | the ordinary clock and calendar, for dual citizenship |
| `moon.ts` | the moon clock: phase, tilt, moonspots, libration |
| `night.ts` | vigil qualities (moonlit, the Ancient Ones) and the planets of the night |
| `events.ts` | predicted starts, engraved starts and ends, glide, remote meetings |

## For engineers

```bash
npm install
npm test          # the engine's tests, checked against the real sky
npm run typecheck
npm run bench     # the engine bench at http://localhost:5180
```

The bench is an instrument for reading the engine's numbers against the sky,
not the app.
