namespace Script {
  import fc = FudgeCore;

  export class SnowboarderNode extends fc.Node {
    private static cube: fc.MeshCube = new fc.MeshCube("SnowboarderCube");
    private static sphere: fc.MeshSphere = new fc.MeshSphere("SnowboarderSphere", 8, 6);
    private static snow: fc.Material = new fc.Material("SnowboarderSnow", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.93, 0.98, 1, 1)));
    private static coal: fc.Material = new fc.Material("SnowboarderCoal", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.04, 0.07, 0.09, 1)));
    private static wood: fc.Material = new fc.Material("SnowboarderWood", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.35, 0.17, 0.07, 1)));
    private static orange: fc.Material = new fc.Material("SnowboarderNose", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(1, 0.35, 0.04, 1)));
    private static board: fc.Material = new fc.Material("SnowboarderBoard", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.12, 0.7, 0.92, 1)));

    private startX: number;
    private centerZ: number;
    private phase: number;
    private range: number;

    constructor(_position: fc.Vector3, _phase: number, _range: number) {
      super("Snowboarder");
      this.startX = _position.x;
      this.centerZ = _position.z;
      this.phase = _phase;
      this.range = _range;

      let transform: fc.ComponentTransform = new fc.ComponentTransform();
      transform.mtxLocal.translation = _position;
      this.addComponent(transform);

      this.addPart("Board", SnowboarderNode.cube, SnowboarderNode.board, new fc.Vector3(0, 0, 0), new fc.Vector3(0.75, 0.18, 2.5));
      this.addPart("Body", SnowboarderNode.sphere, SnowboarderNode.snow, new fc.Vector3(0, 1.15, 0), new fc.Vector3(1.35, 1.35, 1.35));
      this.addPart("Chest", SnowboarderNode.sphere, SnowboarderNode.snow, new fc.Vector3(0, 2.45, 0), new fc.Vector3(1.05, 1.05, 1.05));
      this.addPart("Head", SnowboarderNode.sphere, SnowboarderNode.snow, new fc.Vector3(0, 3.55, 0), new fc.Vector3(0.8, 0.8, 0.8));
      this.addPart("Hat", SnowboarderNode.cube, SnowboarderNode.coal, new fc.Vector3(0, 4.35, 0), new fc.Vector3(0.95, 0.28, 0.95));
      // Face uphill toward the incoming player, not downhill toward the finish.
      this.addPart("Nose", SnowboarderNode.cube, SnowboarderNode.orange, new fc.Vector3(-0.65, 3.55, 0), new fc.Vector3(0.75, 0.16, 0.16));
      this.addPart("LeftArm", SnowboarderNode.cube, SnowboarderNode.wood, new fc.Vector3(0, 2.55, -1.15), new fc.Vector3(0.18, 0.18, 1.3));
      this.addPart("RightArm", SnowboarderNode.cube, SnowboarderNode.wood, new fc.Vector3(0, 2.55, 1.15), new fc.Vector3(0.18, 0.18, 1.3));

      let body: fc.ComponentRigidbody = new fc.ComponentRigidbody();
      body.typeBody = fc.BODY_TYPE.KINEMATIC;
      body.isTrigger = true;
      body.effectGravity = 0;
      body.mtxPivot.translation = new fc.Vector3(0, 1.8, 0);
      body.mtxPivot.scaling = new fc.Vector3(2.1, 3.8, 1.8);
      this.addComponent(body);
      fc.Loop.addEventListener(fc.EVENT.LOOP_FRAME, this.update);
    }

    private addPart(_name: string, _mesh: fc.Mesh, _material: fc.Material, _position: fc.Vector3, _scale: fc.Vector3): void {
      let part: fc.Node = new fc.Node(_name);
      let transform: fc.ComponentTransform = new fc.ComponentTransform();
      transform.mtxLocal.translation = _position;
      let mesh: fc.ComponentMesh = new fc.ComponentMesh(_mesh);
      mesh.mtxPivot.scaling = _scale;
      part.addComponent(transform);
      part.addComponent(mesh);
      part.addComponent(new fc.ComponentMaterial(_material));
      this.addChild(part);
    }

    private update = (_event: Event): void => {
      let seconds: number = fc.Time.game.get() / 1000;
      let sweep: number = Math.sin(seconds * 1.15 + this.phase);
      this.mtxLocal.translation = new fc.Vector3(
        this.startX,
        getSlopeSurfaceY(this.startX) + 0.35 + Math.abs(Math.cos(seconds * 2.3 + this.phase)) * 0.08,
        this.centerZ + sweep * this.range
      );
    }
  }
}
