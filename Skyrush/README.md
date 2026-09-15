# Skyrush

Standalone Canvas arcade flight game. Open `index.html`, or run `python -m http.server 8080 --bind 127.0.0.1` from the repository root and visit http://localhost:8080/Skyrush/. No installation, build or external assets are required to play.

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D (arrows also work) | Steer: nose down / left / nose up / right |
| Left click, held | Fire the selected weapon in mouse-steering mode |
| Ctrl, held | Fire in the selectable no-mouse steering mode |
| F | Fire a homing rocket |
| Space | Switch driving / stationary aiming; skip cinematics |
| Q | Spend a boost charge |
| Shift + direction | Tight turn |
| Right mouse + move | Mouse steering, when the pre-launch mode is set to Mouse steering |
| Bottom upgrade bar | Shows progress and automatically opens upgrades when filled |
| P / Escape | Pause / resume |

Before launch, choose Mouse steering or No-mouse steering. Mouse steering uses right mouse to steer and left click to fire. No-mouse steering keeps flight entirely on the keyboard and makes Ctrl the firing key. Stationary mode immediately stops forward motion and retains pitch for aiming. Boost can move you briefly even in stationary mode, then stops again. Three boost bars below the ship show available charges and the next charge refilling over ten seconds. A rocket reload strip sits under the weapon button. Rockets require a target lock.

## Waves and upgrades

A six-second opening pans across the stage while simulation is frozen. Ten increasingly large and durable waves follow, each with fast scouts, slower armored enemies and medium-speed interceptors on offset lanes along the amber route. Wave 8 has two separated bosses. Wave 10 introduces the Dreadnought through its own cinematic: it deploys escorts until the route midpoint, heals 30% of its maximum health there, and then launches cylindrical shockwaves that must be flown over or under. Any enemy reaching the dimensional destination gate loses the run. Each cleared wave gives twelve seconds to repair before the next wave. Rookie reduces enemy travel speed and collision damage.

Turrets provide repeatable upgrade power and respawn after about 67 seconds. Their payout rises by 20% with every wave, and every cleared wave tops up the current upgrade bar so one upgrade can be chosen. Moving enemies and bosses award score without granting upgrade power. Target markers retain health bars without names or distance labels. Health orbs restore 30 health and recharge after 35 seconds.

The upgrade menu opens automatically whenever the power bar reaches its next increasingly expensive threshold. Every card displays the current and next values. More shots receives a one-time light-blue outline when it first becomes selectable in wave 3; after buying it, its next level remains locked for the current and following wave.

- **Improve speed:** +22 m/s per level, starting at 105 m/s.
- **More damage:** blaster +8 damage per volley (starting at 18); rocket +60 (starting at 150).
- **Improve fire rate:** +22% of base firing frequency per level for both weapons; blaster starts at 6.7 volleys/s, rocket at a four-second reload.
- **More shots:** adds one blaster bolt per volley, up to three upgrade levels.

Armor reduces blaster damage by 30%. Rockets retain a 150-unit splash radius. Ship modules evolve with upgrades. The chase camera is 145 units behind the ship with a 36-unit vertical offset.

## Files and validation

`game.js`, `index.html` and `styles.css` implement the active game. `Star Fox - OST - Corneria.mp3` is the local looping background track. The pause menu has independently saved SFX and music volume sliders. `Fonts/skyrush-pixel.ttf` is an original local 5x7 display font; `Fonts/build_font.py` is its editable source and requires fontTools only when rebuilding the font. Small descriptive text keeps a readable monospace font.

`Script/`, `Autoview.js`, `Internal.json`, models and original assets are preserved prototype/editor material and are not loaded by this entry point.

JavaScript syntax and temporary mocked-canvas runtime checks cover the controls, escalating rewards, upgrade locks, wave 8 bosses, final-boss phases, portal placement and shockwave height collision. No test suite or runtime dependencies were added. Visual layout, sound balance, performance and a complete human playthrough remain unverified. Enemy speeds, health and wave timing are an initial balance pass.
