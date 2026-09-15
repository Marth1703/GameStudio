/**
 * Startup script to display a graph given with the resource file referred to from the html document, 
 * play its sound and add an interactive orbit camera.
 * 
 * It is highly recommended to use TypeScript for further coding. 
 * Your recommended structure for coding and some starter code is already set up for you in the folder "Script".
 * However, the code below is written in Javascript, so no compilation is required to get started.
 * The types are annotated as comments here and may become regular Javascript-code as this TC39-Proposal progresses {@link https://github.com/tc39/proposal-type-annotations}
 * 
 * Do not extend this file, but use it as a template to transfer some of its functionality to your own code. 
 * This file will should disappear as you progress...
 * 
 * Have fun creating with FUDGE!
 * @author: Jirka Dell'Oro-Friedl, HFU, 2022
 */


var ƒ = FudgeCore;
var ƒAid = FudgeAid;
var startSlopedownGame;
var selectedSlopedownLevel = "easy";
var slopedownMusicReady = false;
var startStatusElement;
var autoStartSlopedown = false;
window.addEventListener("load", init);

function updateStartStatus() {
  if (!startStatusElement)
    return;
  let levelName = selectedSlopedownLevel.toUpperCase();
  startStatusElement.textContent = slopedownMusicReady
    ? SLOPEDOWN_TEXT.status.ready.replace("{level}", levelName)
    : SLOPEDOWN_TEXT.status.courseLoading.replace("{level}", levelName);
}

// Prepare a rendered-but-paused scene behind Slopedown's own start briefing.
function init(_event)/* : void */ {
  applySlopedownText();
  let parameters = new URLSearchParams(window.location.search);
  let requestedLevel = parameters.get("level");
  if (requestedLevel === "easy" || requestedLevel === "normal" || requestedLevel === "hard")
    selectedSlopedownLevel = requestedLevel;
  autoStartSlopedown = parameters.get("autostart") === "1";
  let startButton/* : HTMLButtonElement */ = document.querySelector("#start-button");
  let levelButtons/* : NodeListOf<HTMLButtonElement> */ = document.querySelectorAll(".level-button");
  window.slopedownSelectedLevel = selectedSlopedownLevel;
  document.getElementById("hard-briefing").hidden = selectedSlopedownLevel !== "hard";
  levelButtons.forEach(function (button) {
    let isInitiallySelected = button.dataset.level === selectedSlopedownLevel;
    button.classList.toggle("is-selected", isInitiallySelected);
    button.setAttribute("aria-checked", isInitiallySelected ? "true" : "false");
    button.addEventListener("click", function () {
      if (button.disabled)
        return;
      selectedSlopedownLevel = button.dataset.level;
      window.slopedownSelectedLevel = selectedSlopedownLevel;
      document.getElementById("hard-briefing").hidden = selectedSlopedownLevel !== "hard";
      levelButtons.forEach(function (candidate) {
        let isSelected = candidate === button;
        candidate.classList.toggle("is-selected", isSelected);
        candidate.setAttribute("aria-checked", isSelected ? "true" : "false");
      });
      updateStartStatus();
    });
  });
  startButton.addEventListener("click", function () {
    if (startSlopedownGame)
      startSlopedownGame();
  });
  let graphId/* : string */ = document.head.querySelector("meta[autoView]").getAttribute("autoView");
  startInteractiveViewport(graphId);
}

function setUpCamera(_cmpCamera, _graph) {
  let avatar = _graph.getChildrenByName("Avatar")[0];
  avatar.addComponent(_cmpCamera);
}

// setup and start interactive viewport
async function startInteractiveViewport(_graphId)/* : void */ {
  // load resources referenced in the link-tag
  await ƒ.Project.loadResourcesFromHTML();
  ƒ.Debug.log("Project:", ƒ.Project.resources);

  // get the graph to show from loaded resources
  let graph/* : ƒ.Graph */ = ƒ.Project.resources[_graphId];
  ƒ.Debug.log("Graph:", graph);
  if (!graph) {
    alert(SLOPEDOWN_TEXT.errors.missingGraph);
    return;
  }

  // setup the viewport
  let cmpCamera/* : ƒ.ComponentCamera */ = new ƒ.ComponentCamera();
  let canvas/* : HTMLCanvasElement */ = document.querySelector("canvas");
  let viewport/* : ƒ.Viewport */ = new ƒ.Viewport();
  viewport.initialize("InteractiveViewport", graph, cmpCamera, canvas);
  ƒ.Debug.log("Viewport:", viewport);  
  // make the camera interactive (complex method in FudgeAid)
  let cameraOrbit/* : ƒ.Node */ = ƒAid.Viewport.expandCameraToInteractiveOrbit(viewport);

  // hide the cursor when interacting, also suppressing right-click menu
  canvas.addEventListener("mousedown", canvas.requestPointerLock);
  canvas.addEventListener("mouseup", function () { document.exitPointerLock(); });

  setUpCamera(cmpCamera, graph);


  // setup audio
  let cmpListener/* : ƒ.ComponentAudioListener */ = new ƒ.ComponentAudioListener();
  cmpCamera.node.addComponent(cmpListener);
  ƒ.AudioManager.default.listenWith(cmpListener);
  ƒ.AudioManager.default.listenTo(graph);
  ƒ.Debug.log("Audio:", ƒ.AudioManager.default);

  // draw viewport once for immediate feedback
  ƒ.Render.prepare(cameraOrbit);
  viewport.draw();

  let startOverlay/* : HTMLElement */ = document.querySelector("#start-overlay");
  let startButton/* : HTMLButtonElement */ = document.querySelector("#start-button");
  let startStatus/* : HTMLElement */ = document.querySelector("#start-status");
  startStatusElement = startStatus;
  let music/* : ƒ.Audio */ = new ƒ.Audio();
  window.slopedownBackgroundMusic = music;
  document.body.classList.add("start-screen");
  startOverlay.hidden = false;

  // Download and decode the background track before a run can begin. This
  // moves the former multi-second music delay into the loading screen.
  music.load("Sounds/backgroundMusic.mp3").then(function () {
    slopedownMusicReady = true;
    updateStartStatus();
    startButton.textContent = SLOPEDOWN_TEXT.startRun;
    startButton.disabled = false;
    startButton.focus();
  }).catch(function () {
    startStatus.textContent = SLOPEDOWN_TEXT.status.unavailable;
    startButton.textContent = SLOPEDOWN_TEXT.startRun;
    startButton.disabled = false;
    startButton.focus();
  });

  startSlopedownGame = function () {
    startOverlay.hidden = true;
    document.body.classList.remove("start-screen");
    // Resume in the direct button event, keeping browser audio permission
    // tied to the player's gesture even though the game setup is asynchronous.
    if (ƒ.AudioManager.default.state === "suspended")
      ƒ.AudioManager.default.resume();
    canvas.dispatchEvent(new CustomEvent("interactiveViewportStarted", { bubbles: true, detail: viewport }));
  };
  if (autoStartSlopedown)
    startSlopedownGame();
}
