# flight-game-mf-20261126

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/sitopberkah-blip/flight-game-mf-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/sitopberkah-blip/flight-game-mf-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Meridian Rings — a chase-view flight game. You fly a small prop plane from a camera on her tail: a real instrument panel (airspeed, altimeter, artificial horizon, compass, vertical speed, throttle quadrant, warning lamps), a living island below — fields, peaks with snow, a harbour town, wind turbines, boats — and five sorties to fly over it.

Thread the gold rings in order (chain them fast for a combo multiplier up to ×5), grab fuel drums, repair crates and stars, dodge the balloons, mind the storm sortie's rain, gusts and lightning — then put her back on Runway 07 with a gentle touchdown for the landing bonus. Stall her, belly-land her, or fly her into a hillside and the sortie ends the way you'd expect.

**Controls:** mouse or arrow keys to steer · W/S throttle · G gear · B brake · P pause · M sound. On a phone: left thumb is the stick, right thumb works the throttle rail.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Everything is self-contained static files under `game/` — no build step, no network requests. The source is split one job per file: `config` (constants), `random` (seeded RNG), `terrain` (the island), `plane` (the aircraft and its drawing), `physics` (the flight model), `missions` (the five sorties and scoring), `effects` (particles, shake, rain), `render` (the chase camera and world), `hud` (instruments and screens), `input`, `audio` (synthesised engine, wind and chimes), `shots` (the staged screenshot scenes behind `?shot=`), and `main` (the loop).

---

<sub>Entered on [make.fun](https://make.fun/?ref=ahb5nxpg&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
