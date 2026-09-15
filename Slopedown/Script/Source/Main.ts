namespace Script {
  import fc = FudgeCore;

  fc.Debug.info("Main Program Template running!");

  export let viewport: fc.Viewport;
  export let vui: VUI;
  export let currentTime: number;
  export let isAirborne: boolean;
  export let avatar: fc.Node;
  export let currentCoins: number;
  export let componentAudio: fc.ComponentAudio;
  export let gateSpeedUncapped: boolean = false;
  let timeSinceStart: number;
  let cmpCamera: fc.ComponentCamera;
  let gameFinished: boolean = false;
  let gamePaused: boolean = false;
  let occupiedSpawns: SpawnPlacement[] = [];
  let selectedLevel: "easy" | "normal" | "hard" = "easy";
  const SESSION_RESULTS_KEY: string = "slopedown-session-results";
  document.addEventListener("interactiveViewportStarted", (_event: Event): void => {
    void start(_event as CustomEvent);
  });

  async function start(_event: CustomEvent): Promise<void> {
    let requestedLevel: string | undefined = (window as any).slopedownSelectedLevel as string | undefined;
    selectedLevel = requestedLevel == "normal" || requestedLevel == "hard" ? requestedLevel : "easy";
    await loadGameSettings(selectedLevel);
    // FUDGE/Oimo uses a small collision skin by default. A slightly wider
    // margin catches fast impacts before a player can tunnel through a fence.
    fc.Physics.settings.defaultCollisionMargin = GAME_SETTINGS.physicsCollisionMargin;
    timeSinceStart = fc.Time.game.get();
    viewport = _event.detail;
    cmpCamera = viewport.camera;
    if (GAME_SETTINGS.courseStyle == "glacier")
      cmpCamera.projectCentral(cmpCamera.getAspect(), cmpCamera.getFieldOfView(), cmpCamera.getDirection(), cmpCamera.getNear(), 6000);
    fetchCameraPosition();
    let branch: fc.Node = viewport.getBranch();
    configureCourse(branch);
    vui = new VUI();
    currentTime = 0;
    isAirborne = false;
    gameFinished = false;
    gamePaused = false;
    avatar = branch.getChildrenByName("Avatar")[0];
    currentCoins = 0;
    gateSpeedUncapped = false;
    let avatarBody: fc.ComponentRigidbody = avatar.getComponent(fc.ComponentRigidbody);
    if (GAME_SETTINGS.courseStyle != "straight") {
      let startPosition: fc.Vector3 = avatarBody.getPosition();
      avatarBody.setPosition(new fc.Vector3(
        startPosition.x,
        getSlopeSurfaceY(startPosition.x) + GAME_SETTINGS.avatarGroundOffset,
        getCourseCenterZ(startPosition.x)
      ));
    }
    avatarBody.setVelocity(new fc.Vector3(GAME_SETTINGS.initialForwardSpeed, 0, 0));
    fc.Loop.addEventListener(fc.EVENT.LOOP_FRAME, update);
    branch.addEventListener("fall", stopGame);
    branch.addEventListener("fin", endGame);
    setUpMusic();
    occupiedSpawns = [];
    if (GAME_SETTINGS.courseStyle != "glacier") {
      if (GAME_SETTINGS.courseStyle == "curved")
        createSnowboarders();
      createRings();
      createTrees();
      createCoins();
      createFences();
    }
    document.addEventListener("keydown", handlePauseKey);
    fc.Loop.start(); 
    
  }

  function stopGame(): void {
    if (gameFinished)
      return;

    gameFinished = true;
    avatar.activate(false);
    componentAudio.play(false);
    vui.showFailure(currentTime, currentCoins);
  }

  function endGame(): void {
    if (gameFinished)
      return;

    gameFinished = true;
    componentAudio.play(false);
    componentAudio.setAudio(new fc.Audio(".\\Sounds\\victory.mp3"));
    componentAudio.volume = 0.3;
    componentAudio.play(true);
    avatar.activate(false);
    let calculatedScore: number = Math.max(0, Math.round(currentCoins * 200 + (60000 - currentTime)));
    let result: SessionResult = { timeMs: currentTime, coins: currentCoins, score: calculatedScore };
    vui.showFinish(result, recordSessionResult(result));
  }

  function handlePauseKey(_event: KeyboardEvent): void {
    if (_event.code != "Escape" || gameFinished)
      return;

    _event.preventDefault();
    gamePaused = !gamePaused;
    vui.setPaused(gamePaused);

    if (gamePaused) {
      componentAudio.play(false);
      fc.Loop.stop();
      return;
    }

    componentAudio.play(true);
    fc.Loop.continue();
  }

  function setUpMusic(): void {
    componentAudio = new fc.ComponentAudio();
    avatar.addComponent(componentAudio);
    // Autoview begins loading the track while the controls briefing is shown,
    // so the first audible frame follows the Start click instead of arriving
    // several seconds into a run.
    let music: fc.Audio | undefined = (window as any).slopedownBackgroundMusic as fc.Audio | undefined;
    if (!music) {
      music = new fc.Audio();
      void music.load("Sounds/backgroundMusic.mp3");
    }
    componentAudio.setAudio(music);
    componentAudio.volume = 0.1;
    componentAudio.play(true);
  }

  async function fetchCameraPosition(): Promise<void> {
    let response: Response = await fetch("config.json");
    let camAngle: any = await response.json();
    cmpCamera.mtxPivot.translate(new fc.Vector3(camAngle.CameraX, camAngle.CameraY, camAngle.CameraZ));
  }

  function createRings(): void {
    // The rendered gate is much wider than its pickup trigger. Reserve its
    // full footprint so a later fence cannot intersect its frame.
    let positions: SpawnPoint[] = createDistributedSpawnPoints(GAME_SETTINGS.portalCount, 13,
      GAME_SETTINGS.spawnStartMargin + GAME_SETTINGS.portalStartSafeDistance, GAME_SETTINGS.spawnEndMargin);
    for (let position of positions) {
      let ringY: number = getSlopeSurfaceY(position.x) + GAME_SETTINGS.portalSurfaceOffset;
      let ring: RingNode = new RingNode(new fc.Vector3(position.x, ringY, position.z));
      viewport.getBranch().addChild(ring);
    }
  }

  function createTrees(): void {
    let positions: SpawnPoint[] = createDistributedSpawnPoints(GAME_SETTINGS.treeCount, GAME_SETTINGS.treeSpawnRadius);
    for (let position of positions) {
      let treeY: number = getSlopeSurfaceY(position.x) + GAME_SETTINGS.treeSurfaceOffset;
      let tree: TreeNode = new TreeNode(new fc.Vector3(position.x, treeY, position.z));
      viewport.getBranch().addChild(tree);
    }
  }

  function createCoins(): void {
    let coinGroupRadius: number = Math.max(
      GAME_SETTINGS.coinGroupSpawnRadius,
      GAME_SETTINGS.coinGroupSpacing + GAME_SETTINGS.coinTriggerLength
    );
    let positions: SpawnPoint[] = createDistributedSpawnPoints(GAME_SETTINGS.coinGroupCount, coinGroupRadius);
    for (let position of positions) {
      let coinX: number = position.x - GAME_SETTINGS.coinGroupSpacing;
      let coinY: number = getSlopeSurfaceY(coinX) + GAME_SETTINGS.coinSurfaceOffset;
      let coinZ: number = position.z;
      let coin1: CoinNode = new CoinNode(new fc.Vector3(coinX, coinY, coinZ));
      let coin2X: number = coinX + GAME_SETTINGS.coinGroupSpacing;
      let coin3X: number = coin2X + GAME_SETTINGS.coinGroupSpacing;
      let coin2: CoinNode = new CoinNode(new fc.Vector3(coin2X, getSlopeSurfaceY(coin2X) + GAME_SETTINGS.coinSurfaceOffset, coinZ));
      let coin3: CoinNode = new CoinNode(new fc.Vector3(coin3X, getSlopeSurfaceY(coin3X) + GAME_SETTINGS.coinSurfaceOffset, coinZ));
      viewport.getBranch().addChild(coin1);
      viewport.getBranch().addChild(coin2);
      viewport.getBranch().addChild(coin3);
    }
  }

  function createFences(): void {
    let positions: SpawnPoint[] = createDistributedSpawnPoints(GAME_SETTINGS.fenceCount, GAME_SETTINGS.fenceSpawnRadius);
    for (let position of positions) {
      // The fence origin is raised by its measured leg height, so every fence
      // stands on the precisely calculated slope surface instead of sinking into it.
      let fenceY: number = getSlopeSurfaceY(position.x) + GAME_SETTINGS.fenceBaseHeight;
      let fence: FenceNode = new FenceNode(new fc.Vector3(position.x, fenceY, position.z));
      viewport.getBranch().addChild(fence);
    }
  }

  function configureCourse(_branch: fc.Node): void {
    if (GAME_SETTINGS.courseStyle == "glacier") {
      createHardCourse(_branch);
      return;
    }
    if (GAME_SETTINGS.courseStyle != "curved")
      return;

    let originalSlope: fc.Node | undefined = _branch.getChildrenByName("Slope")[0];
    if (originalSlope)
      originalSlope.activate(false);

    let normalCourse: fc.Node = new fc.Node("NormalCourse");
    let snowMaterial: fc.Material = fc.Project.resources["Material|2023-01-10T16:08:39.923Z|66013"] as fc.Material;
    let segmentCount: number = Math.ceil((GAME_SETTINGS.normalTerrainEndX - GAME_SETTINGS.normalTerrainStartX) / GAME_SETTINGS.normalSegmentLength);

    for (let index: number = 0; index < segmentCount; index++) {
      let startX: number = GAME_SETTINGS.normalTerrainStartX + index * GAME_SETTINGS.normalSegmentLength;
      let endX: number = Math.min(startX + GAME_SETTINGS.normalSegmentLength, GAME_SETTINGS.normalTerrainEndX);
      let centerX: number = (startX + endX) / 2;
      let segment: fc.Node = new fc.Node(`NormalTerrain${index}`);
      let mesh: fc.ComponentMesh = new fc.ComponentMesh(new fc.MeshCube(`NormalTerrainMesh${index}`));
      let material: fc.ComponentMaterial = new fc.ComponentMaterial(snowMaterial);
      let transform: fc.ComponentTransform = new fc.ComponentTransform();
      let rigidbody: fc.ComponentRigidbody = new fc.ComponentRigidbody();
      let yaw: number = Math.atan(getCourseCenterZSlope(centerX)) * 180 / Math.PI;

      mesh.mtxPivot.scaling = new fc.Vector3(endX - startX + 2, 40, GAME_SETTINGS.normalCourseHalfWidth * 2);
      // getSlopeSurfaceY describes the top of the snow. Cube transforms are
      // positioned at their centre, so lower the segment by its half-height.
      // Previously using the surface height as the centre put the avatar
      // inside the Normal terrain on the first physics frame.
      let terrainCenterY: number = getSlopeSurfaceY(centerX) -
        Math.cos(GAME_SETTINGS.slopeAngleDegrees * Math.PI / 180) * GAME_SETTINGS.slopeHalfHeight;
      transform.mtxLocal.translation = new fc.Vector3(centerX, terrainCenterY, getCourseCenterZ(centerX));
      transform.mtxLocal.rotation = new fc.Vector3(0, yaw, GAME_SETTINGS.slopeAngleDegrees);
      rigidbody.typeBody = fc.BODY_TYPE.STATIC;
      rigidbody.effectGravity = 0;
      rigidbody.mtxPivot.scaling = new fc.Vector3(endX - startX + 2, 40, GAME_SETTINGS.normalCourseHalfWidth * 2);

      segment.addComponent(mesh);
      segment.addComponent(material);
      segment.addComponent(transform);
      segment.addComponent(rigidbody);
      normalCourse.addChild(segment);
    }

    _branch.addChild(normalCourse);
  }

  interface SpawnPoint {
    x: number;
    z: number;
  }

  interface SpawnPlacement extends SpawnPoint {
    radius: number;
  }

  function createDistributedSpawnPoints(_amount: number, _radius: number, _startMargin: number = GAME_SETTINGS.spawnStartMargin, _endMargin: number = GAME_SETTINGS.spawnEndMargin): SpawnPoint[] {
    let firstX: number = GAME_SETTINGS.courseStartX + _startMargin;
    let lastX: number = GAME_SETTINGS.courseEndX - _endMargin;
    let segmentWidth: number = (lastX - firstX) / _amount;
    let positions: SpawnPoint[] = [];

    for (let i: number = 0; i < _amount; i++) {
      let point: SpawnPoint | undefined;
      for (let attempt: number = 0; attempt < GAME_SETTINGS.spawnPlacementAttempts; attempt++) {
        let x: number = attempt < GAME_SETTINGS.spawnPlacementAttempts / 2
          ? firstX + (i + fc.random.getRange(0.08, 0.92)) * segmentWidth
          : fc.random.getRange(firstX, lastX);
        let z: number = getSpawnLane(x);

        if (isSpawnClear(x, z, _radius)) {
          point = { x, z };
          occupiedSpawns.push({ x, z, radius: _radius });
          break;
        }
      }

      if (point)
        positions.push(point);
      else
        fc.Debug.warn(`Skipped a spawn after ${GAME_SETTINGS.spawnPlacementAttempts} overlap checks.`);
    }

    return positions;
  }

  function isSpawnClear(_x: number, _z: number, _radius: number): boolean {
    return occupiedSpawns.every((_occupied: SpawnPlacement): boolean => {
      let minimumDistance: number = _radius + _occupied.radius;
      let xDistance: number = _x - _occupied.x;
      let zDistance: number = _z - _occupied.z;
      return xDistance * xDistance + zDistance * zDistance >= minimumDistance * minimumDistance;
    });
  }

  export function getSlopeSurfaceY(_x: number): number {
    let slopeAngleRadians: number = GAME_SETTINGS.slopeAngleDegrees * Math.PI / 180;
    return Math.tan(slopeAngleRadians) * _x + GAME_SETTINGS.slopeHalfHeight / Math.cos(slopeAngleRadians);
  }

  export function getCourseCenterZ(_x: number): number {
    if (GAME_SETTINGS.courseStyle == "glacier") return hardCourseCenterZ(_x);
    if (GAME_SETTINGS.courseStyle != "curved")
      return 0;

    let progress: number = (_x - GAME_SETTINGS.normalTerrainStartX) /
      (GAME_SETTINGS.normalTerrainEndX - GAME_SETTINGS.normalTerrainStartX);
    return Math.sin(progress * Math.PI * 2) * GAME_SETTINGS.normalCurveAmplitude;
  }

  export function isWithinCourse(_position: fc.Vector3): boolean {
    if (GAME_SETTINGS.courseStyle == "glacier") {
      return _position.x >= HARD_COURSE_START && _position.x <= HARD_COURSE_END &&
        Math.abs(_position.z - hardCourseCenterZ(_position.x)) <= hardCourseHalfWidth(_position.x) &&
        _position.y >= getSlopeSurfaceY(_position.x) - 2;
    }
    if (GAME_SETTINGS.courseStyle != "curved")
      return true;

    return _position.x >= GAME_SETTINGS.normalTerrainStartX &&
      _position.x <= GAME_SETTINGS.normalTerrainEndX &&
      Math.abs(_position.z - getCourseCenterZ(_position.x)) <= GAME_SETTINGS.normalCourseHalfWidth;
  }

  function createSnowboarders(): void {
    let positions: number[] = [-220, 60, 300];
    positions.forEach((_x: number, _index: number): void => {
      let z: number = getCourseCenterZ(_x);
      occupiedSpawns.push({ x: _x, z, radius: 4 });
      viewport.getBranch().addChild(new SnowboarderNode(
        new fc.Vector3(_x, getSlopeSurfaceY(_x) + 0.35, z),
        _index * Math.PI * 2 / positions.length,
        GAME_SETTINGS.normalCourseHalfWidth - 3
      ));
    });
  }

  export function hasFallenFarEnough(_position: fc.Vector3): boolean {
    return _position.y <= getSlopeSurfaceY(_position.x) - GAME_SETTINGS.fallDepth;
  }

  function getCourseCenterZSlope(_x: number): number {
    let courseLength: number = GAME_SETTINGS.normalTerrainEndX - GAME_SETTINGS.normalTerrainStartX;
    return Math.cos((_x - GAME_SETTINGS.normalTerrainStartX) / courseLength * Math.PI * 2) *
      GAME_SETTINGS.normalCurveAmplitude * Math.PI * 2 / courseLength;
  }

  function getSpawnLane(_x: number): number {
    return getCourseCenterZ(_x) + fc.random.getRange(GAME_SETTINGS.spawnLaneMinZ, GAME_SETTINGS.spawnLaneMaxZ);
  }

  function recordSessionResult(_result: SessionResult): SessionResult[] {
    let results: SessionResult[] = [];
    const storageKey: string = `${SESSION_RESULTS_KEY}-${selectedLevel}`;

    try {
      let storedResults: string | null = window.sessionStorage.getItem(storageKey);
      if (storedResults)
        results = JSON.parse(storedResults) as SessionResult[];
    } catch (_error) {
      // Session storage may be unavailable in a restrictive browser context.
      results = [];
    }

    results.push(_result);
    results.sort((_first: SessionResult, _second: SessionResult): number => {
      return _first.timeMs - _second.timeMs || _second.coins - _first.coins;
    });
    results = results.slice(0, 5);

    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(results));
    } catch (_error) {
      // The current result remains visible even if it cannot be persisted.
    }

    return results;
  }

  function update(_event: Event): void {
    fc.Physics.simulate();  // if physics is included and used
    let avatarBody: fc.ComponentRigidbody = avatar.getComponent(fc.ComponentRigidbody);
    let velocity: fc.Vector3 = avatarBody.getVelocity();
    let maximumBoostedSpeed: number = GAME_SETTINGS.maximumBoostedSpeed + currentCoins * GAME_SETTINGS.coinMaximumSpeedBonus;
    if (!gateSpeedUncapped && velocity.x > maximumBoostedSpeed)
      avatarBody.setVelocity(new fc.Vector3(maximumBoostedSpeed, velocity.y, velocity.z));
    viewport.draw();
    fc.AudioManager.default.update();
    if (!gameFinished)
      currentTime = fc.Time.game.get() - timeSinceStart;
    vui.updateRaceStats(currentTime, currentCoins);
  }
}
