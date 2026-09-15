# Game Studio

A small collection of games called Game Studio. There are two playable prototypes: **Skyrush**, an arcade flight and tower-defense game, and **Slopedown**, a fast slope-descent platformer.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="data/Skyrush_teaser.png" alt="Skyrush gameplay teaser" width="640" height="360">
      <h2>Skyrush</h2>
      <p>A tower defense game, where you are the "tower". Upgrade your ship and stop 10 increasingly difficult waves from passing through.</p>
      <p>Available through the Game Studio launcher.</p>
    </td>
    <td width="50%" valign="top">
      <img src="data/Slopedown_teaser.png" alt="Slopedown gameplay teaser" width="640" height="360">
      <h2>Slopedown</h2>
      <p>Control your snowboarder down a course, collect coins, hit boost-gates and finish the run as quickly as possible.</p>
      <p>Available through the Game Studio launcher.</p>
    </td>
  </tr>
</table>

# Play
Play the games here: <a href="https://marth1703.github.io/GameStudio/">https://marth1703.github.io/GameStudio/</a>

## Run locally

No package installation is required. From this folder, start a local static server:

```text
python -m http.server 8080 --bind 127.0.0.1
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/) and choose a game from the launcher. Opening the individual `index.html` files directly works too, but a local server is recommended. VSCode's Live Server is suitable for example.

## Status

The games are playable prototypes. Slopedown was part of the Prima course 2022, where a final project had to be submitted which implemented a game in the Fudge game engine. Skyrush is a newly added game with modern approaches. 
