namespace Script {
  import fc = FudgeCore;

  // Exact top-surface bounds; the chasm has no hidden collider underneath it.
  export const HARD_COURSE_START: number = -500;
  export const HARD_COURSE_END: number = 1000;
  export const HARD_FINISH_X: number = 960;
  export const HARD_GAP_START: number = -12;
  export const HARD_GAP_END: number = 30;

  export function isHardGap(_x: number): boolean {
    return (_x > HARD_GAP_START && _x < HARD_GAP_END) || (_x > 690 && _x < 732);
  }

  export function hardCourseCenterZ(_x: number): number {
    if (_x >= -240 && _x < -100) return 7;
    if (_x >= 400 && _x < 580) return -7;
    return 0;
  }

  export function hardCourseHalfWidth(_x: number): number {
    if (_x >= -240 && _x < -210) return 5;
    if (_x >= -210 && _x < -130) return 1.15;
    if (_x >= -130 && _x < -100) return 5;
    if (_x >= 400 && _x < 430) return 5;
    if (_x >= 430 && _x < 550) return 1.15;
    if (_x >= 550 && _x < 580) return 5;
    return 14;
  }

  export function createHardCourse(_branch: fc.Node): void {
    _branch.getChildrenByName("Slope")[0]?.activate(false);
    const background: fc.Node = _branch.getChildrenByName("Background")[0];
    if (background) {
      background.mtxLocal.translation = new fc.Vector3(250, 0, 0);
      background.getComponent(fc.ComponentMesh).mtxPivot.scaling = new fc.Vector3(1800, 1200, 1800);
      background.getComponent(fc.ComponentMesh).mtxPivot.translation = new fc.Vector3(0, -1000, 0);
    }
    let sky: fc.Node | undefined = _branch.getChildrenByName("Terrain")[0];
    let skyMesh: fc.ComponentMesh | undefined = sky?.getComponent(fc.ComponentMesh);
    if (skyMesh)
      skyMesh.mtxPivot.scaling = new fc.Vector3(3000, 16, 900);
    let course: fc.Node = new fc.Node("GlacierDivide");
    _branch.addChild(course);
    let snow: fc.Material = fc.Project.resources["Material|2023-01-10T16:08:39.923Z|66013"] as fc.Material;
    let ice: fc.Material = new fc.Material("GlacierIce", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.18, 0.65, 0.82)));
    let cyan: fc.Material = new fc.Material("RouteCyan", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.2, 0.95, 1)));
    let amber: fc.Material = new fc.Material("TakeoffAmber", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(1, 0.58, 0.12)));
    let angle: number = GAME_SETTINGS.slopeAngleDegrees * Math.PI / 180;

    let finishLine: fc.Node | undefined = _branch.getChildrenByName("Finishline")[0];
    if (finishLine) {
      let finishPosition: fc.Vector3 = new fc.Vector3(HARD_FINISH_X, getSlopeSurfaceY(HARD_FINISH_X) + 18.5, 0);
      finishLine.getComponent(fc.ComponentTransform).mtxLocal.translation = finishPosition;
      let finishBody: fc.ComponentRigidbody | undefined = finishLine.getComponent(fc.ComponentRigidbody);
      if (finishBody)
        finishBody.isInitialized = false;
    }

    function box(_name: string, _position: fc.Vector3, _size: fc.Vector3, _material: fc.Material, _solid: boolean = false, _tilt: number = 0): void {
      let node: fc.Node = new fc.Node(_name);
      let transform: fc.ComponentTransform = new fc.ComponentTransform();
      transform.mtxLocal.translation = _position;
      transform.mtxLocal.rotation = new fc.Vector3(0, 0, _tilt);
      let mesh: fc.ComponentMesh = new fc.ComponentMesh(new fc.MeshCube(_name));
      mesh.mtxPivot.scaling = _size;
      node.addComponent(transform);
      node.addComponent(mesh);
      node.addComponent(new fc.ComponentMaterial(_material));
      if (_solid) {
        let body: fc.ComponentRigidbody = new fc.ComponentRigidbody();
        body.typeBody = fc.BODY_TYPE.STATIC;
        body.effectGravity = 0;
        body.mtxPivot.scaling = _size;
        node.addComponent(body);
      }
      course.addChild(node);
    }

    let bounds: number[] = [HARD_COURSE_START, -240, -210, -130, -100, HARD_GAP_START, HARD_GAP_END, 400, 430, 550, 580, 690, 732, HARD_COURSE_END];
    for (let i: number = 0; i < bounds.length - 1; i++) {
      let start: number = bounds[i];
      let end: number = bounds[i + 1];
      let x: number = (start + end) / 2;
      if (isHardGap(x)) continue;
      // Offset along the surface normal so the rotated top face ends exactly
      // at start/end, instead of silently extending into the jump gap.
      box("SnowDeck", new fc.Vector3(x + Math.sin(angle), getSlopeSurfaceY(x) - Math.cos(angle), hardCourseCenterZ(x)),
        new fc.Vector3((end - start) / Math.cos(angle), 2, hardCourseHalfWidth(x) * 2), snow, true, GAME_SETTINGS.slopeAngleDegrees);
      for (let markerX: number = start + 4; markerX < end - 2; markerX += 12) {
        for (let side of [-1, 1]) {
          let z: number = hardCourseCenterZ(markerX) + side * (hardCourseHalfWidth(markerX) - 0.3);
          box("EdgeLight", new fc.Vector3(markerX, getSlopeSurfaceY(markerX) + 0.15, z), new fc.Vector3(3, 0.16, 0.24), cyan, false, GAME_SETTINGS.slopeAngleDegrees);
        }
      }
    }

    // Glacial towers below/outside the route frame the bridge and open chasm.
    for (let x of [-225, -190, -155, -55, -20, 34, 70, 415, 490, 565, 720, 900]) {
      for (let side of [-1, 1]) {
        box("IceSpire", new fc.Vector3(x, getSlopeSurfaceY(x) - 15, side * 21), new fc.Vector3(7, 38, 5), ice, false, side * 12);
      }
    }
    for (let x of [-360, -250, -100, 80, 280, 390, 600, 780, 910]) {
      let gateHalfWidth: number = Math.min(12.5, hardCourseHalfWidth(x) - 0.35);
      for (let side of [-1, 1])
        box("GatePost", new fc.Vector3(x, getSlopeSurfaceY(x) + 4, side * gateHalfWidth), new fc.Vector3(0.5, 8, 0.5), cyan);
      box("GateHeader", new fc.Vector3(x, getSlopeSurfaceY(x) + 8, 0), new fc.Vector3(0.5, 0.5, gateHalfWidth * 2 + 0.5), cyan);
    }
    for (let x of [-60, -48, -36, -24, -15])
      box("ChargeStripe", new fc.Vector3(x, getSlopeSurfaceY(x) + 0.08, 0), new fc.Vector3(0.7, 0.1, 25), amber, false, GAME_SETTINGS.slopeAngleDegrees);
    for (let side of [-1, 1])
      box("TakeoffBeacon", new fc.Vector3(-13, getSlopeSurfaceY(-13) + 3, side * 13), new fc.Vector3(0.7, 6, 0.7), amber);
    for (let x of [652, 664, 676, 687])
      box("ChargeStripe", new fc.Vector3(x, getSlopeSurfaceY(x) + 0.08, 0), new fc.Vector3(0.7, 0.1, 25), amber, false, GAME_SETTINGS.slopeAngleDegrees);

    // Readable, repeatable slalom: each pair leaves a generous opposite lane.
    for (let [x, side] of [[-350, -1], [-290, 1], [130, 1], [210, -1], [310, 1], [600, -1], [790, 1], [840, -1]]) {
      for (let z of [0, side * 4, side * 8])
        _branch.addChild(new FenceNode(new fc.Vector3(x, getSlopeSurfaceY(x) + GAME_SETTINGS.fenceBaseHeight, z)));
      for (let dx of [-16, -6, 4])
        _branch.addChild(new CoinNode(new fc.Vector3(x + dx, getSlopeSurfaceY(x + dx) + GAME_SETTINGS.coinSurfaceOffset, -side * 5)));
    }
    for (let x of [-390, -265, 100, 240, 370, 620, 760, 880]) {
      for (let side of [-1, 1])
        _branch.addChild(new TreeNode(new fc.Vector3(x, getSlopeSurfaceY(x) + GAME_SETTINGS.treeSurfaceOffset, side * 11)));
    }
    for (let x of [-202, -187, -172, -157, -142, 62, 74, 86, 445, 465, 485, 505, 525])
      _branch.addChild(new CoinNode(new fc.Vector3(x, getSlopeSurfaceY(x) + GAME_SETTINGS.coinSurfaceOffset, hardCourseCenterZ(x))));
    // Five boost gates punctuate the full course; the jump remains possible
    // without collecting the approach gate.
    for (let x of [-320, -80, 160, 630, 900])
      _branch.addChild(new RingNode(new fc.Vector3(x, getSlopeSurfaceY(x) + GAME_SETTINGS.portalSurfaceOffset, 0)));

    // Each random row has its own reserved downhill interval, clear of fixed
    // fences, boost frames, bridge entrances and jump run-ups/landings.
    for (let center of [-380, 265, 355, 870]) {
      const x: number = center + fc.random.getRange(-5, 5);
      const z: number = fc.random.getRange(-7, 7);
      if (Math.random() < 0.5)
        _branch.addChild(new TreeNode(new fc.Vector3(x, getSlopeSurfaceY(x) + GAME_SETTINGS.treeSurfaceOffset, z)));
      else
        _branch.addChild(new FenceNode(new fc.Vector3(x, getSlopeSurfaceY(x) + GAME_SETTINGS.fenceBaseHeight, z)));
    }
    for (let x of [65, 185, 815])
      _branch.addChild(new SnowboarderNode(new fc.Vector3(x, getSlopeSurfaceY(x) + 0.35, 0), Math.random() * Math.PI * 2, 9));
  }
}

