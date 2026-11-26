# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/nguyenhuong74/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/nguyenhuong74/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Skyline Courier — Valley Run: an original bush-plane courier game. Fly a little yellow high-wing plane down a river valley in a side-view chase camera, thread sky rings, drop a supply crate on a striped drop zone, and land gently on a grass strip before the fuel or the clock runs out. Three missions, a live flight model (throttle, pitch, lift, stall, sink rate), fuel and damage that turn every sortie into decisions, and a full instrument panel: altitude, speed, heading, attitude, fuel and damage gauges.

## Run it

```sh
python3 -m http.server 8080 --directory game
# then open http://localhost:8080 in desktop Chrome
```

Or serve `game/` with any static HTTP server and open `index.html`. No build step, no network requests, no libraries — plain canvas and hand-written JavaScript.

## Missions

- **Ring Run** — thread 8 sky rings across the valley, then land on the far strip.
- **Cargo Drop** — carry a crate to the striped drop zone, release it with Space, then land on either strip.
- **Dawn Delivery** — a timed mail run: 4 rings and the far strip inside 180 seconds on a light fuel load.

## Controls

- **W / S** — throttle up / down (or drag the throttle lever with the mouse)
- **A / D** or **↑ / ↓** — pitch nose up / down
- **← / →** — throttle down / up
- **Space** — drop the cargo crate (Cargo Drop mission)
- **P** — pause · **M** — mute · **Enter** — take off / fly again

Land gently: sink under 6.5 m/s, wings near level, speed under 46 m/s. Below 24 m/s the wing stalls.

---

<sub>Entered on [make.fun](https://make.fun/?ref=6nfavmbn&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
