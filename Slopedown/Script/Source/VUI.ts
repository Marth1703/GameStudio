namespace Script {
  import fc = FudgeCore;

  export interface SessionResult {
    timeMs: number;
    coins: number;
    score: number;
  }

  export class VUI extends fc.Mutable {
    private timeDisplay: HTMLElement;
    private coinsDisplay: HTMLElement;
    private speedDisplay: HTMLElement;
    private finishSummary: HTMLElement;
    private resultTime: HTMLElement;
    private resultCoins: HTMLElement;
    private resultScore: HTMLElement;
    private leaderboard: HTMLOListElement;
    private pauseOverlay: HTMLElement;
    private finishKicker: HTMLElement;
    private finishTitle: HTMLElement;
    private resultGrid: HTMLElement;
    private leaderboardWrap: HTMLElement;
    private jumpKey: HTMLElement;
    private resultTimeStat: HTMLElement;
    private resultCoinsStat: HTMLElement;
    private resultScoreStat: HTMLElement;
    private text: any;
    private soundMuted: boolean = false;

    constructor() {
      super();
      this.text = (window as any).SLOPEDOWN_TEXT;
      this.timeDisplay = this.getElement("hud-time");
      this.coinsDisplay = this.getElement("hud-coins");
      this.speedDisplay = this.getElement("hud-speed");
      this.finishSummary = this.getElement("finish-summary");
      this.resultTime = this.getElement("result-time");
      this.resultCoins = this.getElement("result-coins");
      this.resultScore = this.getElement("result-score");
      this.leaderboard = this.getElement("session-leaderboard") as HTMLOListElement;
      this.pauseOverlay = this.getElement("pause-overlay");
      this.finishKicker = this.getElement("finish-kicker");
      this.finishTitle = this.getElement("finish-title");
      this.resultGrid = this.getElement("result-grid");
      this.leaderboardWrap = this.getElement("leaderboard-wrap");
      this.jumpKey = this.getKey("jump");
      this.resultTimeStat = this.getElement("result-time-stat");
      this.resultCoinsStat = this.getElement("result-coins-stat");
      this.resultScoreStat = this.getElement("result-score-stat");
      this.getElement("retry-button").addEventListener("click", this.retry);
      this.getElement("pause-restart-button").addEventListener("click", this.retry);
      this.getElement("sound-toggle").addEventListener("click", this.toggleSound);
    }

    protected reduceMutator(_mutator: fc.Mutator): void { /**/ }

    public updateRaceStats(_timeMs: number, _coins: number): void {
      this.timeDisplay.textContent = `${(_timeMs / 1000).toFixed(3)}s`;
      this.coinsDisplay.textContent = _coins.toString();
    }

    public updateSpeed(_speed: number): void {
      this.speedDisplay.textContent = Math.floor(_speed).toString();
    }

    public updateInputViewer(_forward: boolean, _left: boolean, _brake: boolean, _right: boolean, _jump: boolean): void {
      this.setKeyState("forward", _forward);
      this.setKeyState("left", _left);
      this.setKeyState("brake", _brake);
      this.setKeyState("right", _right);
      this.setKeyState("jump", _jump);
    }

    public showFinish(_result: SessionResult, _topResults: SessionResult[]): void {
      this.finishKicker.textContent = this.text.results.successKicker;
      this.finishTitle.textContent = this.text.results.successTitle;
      this.resultGrid.hidden = false;
      this.leaderboardWrap.hidden = false;
      this.resultTimeStat.hidden = false;
      this.resultCoinsStat.hidden = false;
      this.resultScoreStat.hidden = false;
      this.resultTime.textContent = `${(_result.timeMs / 1000).toFixed(3)}s`;
      this.resultCoins.textContent = _result.coins.toString();
      this.resultScore.textContent = _result.score.toString();
      this.leaderboard.replaceChildren();

      _topResults.forEach((_run: SessionResult): void => {
        let item: HTMLLIElement = document.createElement("li");
        item.classList.toggle("current-run", _run === _result);
        let runTime: HTMLSpanElement = document.createElement("span");
        let runCoins: HTMLSpanElement = document.createElement("span");
        runTime.textContent = `${(_run.timeMs / 1000).toFixed(3)}s`;
        runCoins.textContent = `${_run.coins} ${this.text.results.coinSuffix}`;
        item.append(runTime, runCoins);
        this.leaderboard.appendChild(item);
      });

      this.finishSummary.hidden = false;
      this.getElement("retry-button").focus();
    }

    public showFailure(_timeMs: number, _coins: number): void {
      this.finishKicker.textContent = this.text.results.failureKicker;
      this.finishTitle.textContent = this.text.results.failureTitle;
      this.resultTime.textContent = `${(_timeMs / 1000).toFixed(3)}s`;
      this.resultCoins.textContent = _coins.toString();
      this.resultGrid.hidden = false;
      this.leaderboardWrap.hidden = true;
      this.resultTimeStat.hidden = false;
      this.resultCoinsStat.hidden = false;
      this.resultScoreStat.hidden = true;
      this.finishSummary.hidden = false;
      this.getElement("retry-button").focus();
    }

    public setPaused(_isPaused: boolean): void {
      this.pauseOverlay.hidden = !_isPaused;
    }

    public setJumpCharge(_ratio: number): void {
      let charge: number = Math.max(0, Math.min(1, _ratio));
      this.jumpKey.style.setProperty("--jump-fill", charge.toString());
    }

    private setKeyState(_key: string, _isPressed: boolean): void {
      this.getKey(_key).classList.toggle("is-pressed", _isPressed);
    }

    private getKey(_key: string): HTMLElement {
      let key: HTMLElement | null = document.querySelector(`[data-key="${_key}"]`);
      if (!key)
        throw new Error(`Missing Slopedown input key: ${_key}`);
      return key;
    }

    private getElement(_id: string): HTMLElement {
      let element: HTMLElement | null = document.getElementById(_id);
      if (!element)
        throw new Error(`Missing Slopedown UI element: ${_id}`);
      return element;
    }

    private retry = (): void => {
      let level: string = (window as any).slopedownSelectedLevel || "easy";
      window.location.href = `index.html?level=${encodeURIComponent(level)}&autostart=1`;
    }

    private toggleSound = (): void => {
      this.soundMuted = !this.soundMuted;
      fc.AudioManager.default.volume = this.soundMuted ? 0 : 1;
      let button: HTMLElement = this.getElement("sound-toggle");
      button.textContent = this.soundMuted ? this.text.results.soundOn : this.text.results.soundOff;
      button.setAttribute("aria-pressed", this.soundMuted.toString());
    }
  }
}
