# Game Studio

A small collection of games called Game Studio. There are two playable prototypes: **Skyrush**, an arcade flight and tower-defense game, and **Slopedown**, a fast slope-descent platformer.

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="Skyrush/index.html">
        <img src="data/Skyrush_teaser.png" alt="Skyrush gameplay teaser" width="100%">
      </a>
      <h2><a href="Skyrush/index.html">Skyrush</a></h2>
      <p>Steer through ten increasingly difficult waves, collect turret power, upgrade your ship and defend the dimensional gate.</p>
      <p><a href="Skyrush/index.html">Play Skyrush -&gt;</a></p>
    </td>
    <td width="50%" valign="top">
      <a href="Slopedown/index.html">
        <img src="data/Slopedown_teaser.png" alt="Slopedown gameplay teaser" width="100%">
      </a>
      <h2><a href="Slopedown/index.html">Slopedown</a></h2>
      <p>Control your snowboarder down a course, collect coins, hit boosts and finish the run as quickly as possible.</p>
      <p><a href="Slopedown/index.html">Play Slopedown -&gt;</a></p>
    </td>
  </tr>
</table>

## Run locally
Play the games here:

## Run locally

No package installation is required. From this folder, start a local static server:

```text
python -m http.server 8080 --bind 127.0.0.1
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/) and choose a game from the launcher. Opening the individual `index.html` files directly works too, but a local server is recommended. VSCode's Live Server is suitable for example.

## Status

The games are playable prototypes. Slopedown was part of the Prima course 2022, where a final project had to be submitted which implemented a game in the Fudge game engine. Skyrush is a newly added game with modern approaches. 
