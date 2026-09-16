# Skyrush

Standalone arcade flight, tower-defense game. Open `index.html`, or run `python -m http.server 8080 --bind 127.0.0.1` from the repository root and visit http://localhost:8080/Skyrush/. No installation, build or external assets are required to play.

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

The game consists of 10 waves the player has to fend off. They feature increasingly difficult enemies, with higher speed and health-pools. The player can grow stronger alongside the enemies by beating waves and collecting upgrade crystals that are scattered around the stage. Destroying them grants upgrade points which can be spend on upgrading speed, damage, fire rate and the amount of shots.
