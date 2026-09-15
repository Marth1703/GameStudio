namespace Script {
  import fc = FudgeCore;
  fc.Debug.info("Main Program Template running!");

  export let gameState: GameState;
  export let viewport: fc.Viewport;

  let cmpCamera: fc.ComponentCamera;

  export let cmpTerrain: fc.ComponentMesh;

  let AnimatedCube: fc.Node;
  document.addEventListener("interactiveViewportStarted", <EventListener>start);
  function generateCubes(n: number): void {

    let cubeMesh: fc.MeshCube = new fc.MeshCube("cubeMesh");

    let material: fc.Material = new fc.Material("cubeShader", fc.ShaderLit);
    let randZ: number;
    let randY: number;
    let randX: number;
    let colorR: number;
    let colorG: number;
    let colorB: number;
    for (let i: number = 0; i < n; i++) {
      let nodeCube: fc.Node = new fc.Node("cube" + i);
      randX = fc.random.getRange(-1000, 1000);
      randY = fc.random.getRange(15, 30);
      randZ = fc.random.getRange(-1000, 1000);

      let componentMesh: fc.ComponentMesh = new fc.ComponentMesh(cubeMesh);
      let componentMaterial: fc.ComponentMaterial = new fc.ComponentMaterial(material);
      let componentTransform: fc.ComponentTransform = new fc.ComponentTransform();
      let componentRigidbody: fc.ComponentRigidbody = new fc.ComponentRigidbody();

      colorR = fc.random.getRange(0, 1);
      colorG = fc.random.getRange(0, 1);
      colorB = fc.random.getRange(0, 1);
      componentMaterial.clrPrimary = new fc.Color(colorR, colorG, colorB, 1)

      componentTransform.mtxLocal.translation = new fc.Vector3(randX, randY, randZ);
      componentTransform.mtxLocal.scale(new fc.Vector3(5, 5, 5));
      componentRigidbody.effectGravity = 0;
      componentRigidbody.mass = 0.001;
      componentRigidbody.setScaling(new fc.Vector3(5, 5, 5));
      nodeCube.addComponent(componentMesh);
      nodeCube.addComponent(componentMaterial);
      nodeCube.addComponent(componentTransform);
      nodeCube.addComponent(componentRigidbody);
      viewport.getBranch().addChild(nodeCube);
    }

  }

  function start(_event: CustomEvent): void {
  
    // let response: Response = await fetch("config.json");
    // let json = await response.json();

    viewport = _event.detail;
    let branch: fc.Node = viewport.getBranch();
    let floor: fc.Node = branch.getChildrenByName("Floor")[0];
    AnimatedCube = branch.getChildrenByName("AnimatedCube")[0];

    if (!floor || !AnimatedCube) {
      fc.Debug.error("Skyrush could not start: the Floor or AnimatedCube node is missing from the level.");
      return;
    }

    cmpCamera = viewport.camera;
    gameState = new GameState();
    cmpTerrain = floor.getComponent(fc.ComponentMesh);
    cmpCamera.mtxPivot.translate(new fc.Vector3(0, 4, -30));
    initAnim();
    generateCubes(50);
    fc.Loop.addEventListener(fc.EVENT.LOOP_FRAME, update);
    fc.Loop.start();  // start the game loop after every scene component is ready
  }

  function initAnim(): void {

    let animseqRot: fc.AnimationSequence = new fc.AnimationSequence();
    animseqRot.addKey(new fc.AnimationKey(0, 0));
    animseqRot.addKey(new fc.AnimationKey(1500, 180));
    animseqRot.addKey(new fc.AnimationKey(3000, 360));

    let animseqTra: fc.AnimationSequence = new fc.AnimationSequence();
    animseqTra.addKey(new fc.AnimationKey(0, 20));
    animseqTra.addKey(new fc.AnimationKey(1500, 50));
    animseqTra.addKey(new fc.AnimationKey(3000, 80));

    let animStructure: fc.AnimationStructure = {
      components: {
        ComponentTransform: [
          {
            "ƒ.ComponentTransform": {
              mtxLocal: {
                rotation: {
                  x: animseqRot,
                  y: animseqRot
                }
              }
            }
          }
        ]
      }
    };

    let fps: number = 30;

    let animation: fc.Animation = new fc.Animation("testAnimation", animStructure, fps);

    let cmpAnimator: fc.ComponentAnimator = new fc.ComponentAnimator(animation);
    cmpAnimator.scale = 1;
    console.log("FERTIG ANIM INIT");
    
    // cmpAnimator.addEventListener("event", (_event: Event) => {
    //   let time: number = (<fc.ComponentAnimator>_event.target).time;
    //   console.log(`Event fired at ${time}`, _event);
    // });



    AnimatedCube.addComponent(cmpAnimator);
    cmpAnimator.activate(true);

    console.log("Component", cmpAnimator);
  }


  function update(_event: Event): void {
    fc.Physics.simulate();  // if physics is included and used
    fc.AudioManager.default.update();
    viewport.draw();
  }
}
