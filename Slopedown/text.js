// Slopedown player-facing copy. Edit this file to change the main on-screen text without touching game logic.
window.SLOPEDOWN_TEXT = Object.freeze({
  pageTitle: "Slopedown",
  title: "SLOPEDOWN",
  tagline: "Stay on the slope and finish the level as fast as possible!",
  controls: {
    forward: "<strong>W</strong> accelerate",
    steer: "<strong>A / D</strong> steer",
    brake: "<strong>S</strong> brake",
    jump: "<strong>SPACE</strong> hold, then release to jump"
  },
  courseSelect: "SELECT COURSE",
  levels: {
    easy: { name: "EASY", description: "" },
    normal: { name: "NORMAL", description: "" },
    hard: { name: "HARD", description: "" }
  },
  hardBriefing: "WARNING: Be prepared to jump!",
  status: {
    loading: "LOADING TRACK…",
    courseLoading: "{level} COURSE - LOADING TRACK",
    ready: "{level} COURSE READY - PRESS START",
    unavailable: "TRACK UNAVAILABLE - START WITHOUT MUSIC"
  },
  startRun: "Start run",
  studio: "GAME STUDIO",
  hud: { raceLabel: "SLOPEDOWN", time: "TIME", coins: "COINS", controls: "CONTROLS", speed: "SPEED", speedUnit: "mph" },
  pause: { kicker: "", title: "GAME PAUSED", resume: "Press <kbd>Esc</kbd> to resume", restart: "Restart run", quit: "QUIT GAME" },
  results: {
    successKicker: "RUN COMPLETE", successTitle: "Finish line crossed",
    failureKicker: "RUN FAILED", failureTitle: "You fell off.",
    time: "TIME", coins: "COINS", score: "SCORE", leaderboard: "SESSION TOP 5",
    coinSuffix: "coins", retry: "Retry run", mainMenu: "Main Menu", soundOff: "SOUND OFF", soundOn: "SOUND ON"
  },
  errors: { missingGraph: "Nothing to render. Create a graph with at least a mesh, material and probably some light" }
});

window.applySlopedownText = function () {
  const text = window.SLOPEDOWN_TEXT;
  document.title = text.pageTitle;
  document.querySelectorAll("[data-slopedown-text]").forEach(function (element) {
    const value = element.getAttribute("data-slopedown-text").split(".").reduce(function (current, key) { return current && current[key]; }, text);
    if (typeof value === "string") element.textContent = value;
  });
  document.querySelectorAll("[data-slopedown-html]").forEach(function (element) {
    const value = element.getAttribute("data-slopedown-html").split(".").reduce(function (current, key) { return current && current[key]; }, text);
    if (typeof value === "string") element.innerHTML = value;
  });
};
