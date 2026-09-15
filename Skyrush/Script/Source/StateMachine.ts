namespace Script {
    import fc = FudgeCore;
    import fAid = FudgeAid;
    fc.Project.registerScriptNamespace(Script);  // Register the namespace to FUDGE for serialization
  
    enum JOB {
      IDLE, TARGET
    }
  
    export class TurretStateMachine extends fAid.ComponentStateMachine<JOB> {
      public static readonly iSubclass: number = fc.Component.registerSubclass(TurretStateMachine);
      private static instructions: fAid.StateMachineInstructions<JOB> = TurretStateMachine.get();


      public torqueIdle: number = 5;
      private cmpTurretSphere: fc.ComponentTransform;
  
  
      constructor() {
        super();
        this.instructions = TurretStateMachine.instructions; // setup instructions with the static set
  
        // Don't start when running in editor
        if (fc.Project.mode == fc.MODE.EDITOR)
          return;
  
        // Listen to this component being added to or removed from a node
        this.addEventListener(fc.EVENT.COMPONENT_ADD, this.hndEvent);
        this.addEventListener(fc.EVENT.COMPONENT_REMOVE, this.hndEvent);
        this.addEventListener(fc.EVENT.NODE_DESERIALIZED, this.hndEvent);
      }
  
      public static get(): fAid.StateMachineInstructions<JOB> {
        let setup: fAid.StateMachineInstructions<JOB> = new fAid.StateMachineInstructions();
        setup.transitDefault = TurretStateMachine.transitDefault;
        setup.actDefault = TurretStateMachine.actDefault;
        setup.setAction(JOB.IDLE, <fc.General>this.actIdle);
        setup.setAction(JOB.TARGET, <fc.General>this.actTarget);
        setup.setTransition(JOB.IDLE, JOB.TARGET, <fc.General>this.transitOutOfRange);
        return setup;
      }
  
      private static transitDefault(_machine: TurretStateMachine): void {
        console.log("Transit to", _machine.stateNext);
      }
  
      private static async actDefault(_machine: TurretStateMachine): Promise<void> {
        console.log(JOB[_machine.stateCurrent]);
      }
  
      private static async actIdle(_machine: TurretStateMachine): Promise<void> {
        if (!_machine.cmpTurretSphere) {
          return;
        }
        _machine.cmpTurretSphere.mtxLocal.rotateY(2);
        TurretStateMachine.actDefault(_machine);
      }
  
      private static async actTarget(_machine: TurretStateMachine): Promise<void> {
        console.log(JOB[_machine.stateCurrent]);
      }

      private static transitOutOfRange(_machine: TurretStateMachine): void {
        _machine.transit(JOB.IDLE);
      }
  
  
      // Activate the functions of this component as response to events
      private hndEvent = (_event: Event): void => {
        switch (_event.type) {
          case fc.EVENT.COMPONENT_ADD:
            break;
          case fc.EVENT.COMPONENT_REMOVE:
            this.removeEventListener(fc.EVENT.COMPONENT_ADD, this.hndEvent);
            this.removeEventListener(fc.EVENT.COMPONENT_REMOVE, this.hndEvent);
            fc.Loop.removeEventListener(fc.EVENT.LOOP_FRAME, this.update);
            break;
          case fc.EVENT.NODE_DESERIALIZED:
            let turretSphere: fc.Node = this.node.getChildrenByName("Circle")[0];
            if (!turretSphere) {
              fc.Debug.error("Skyrush turret has no Circle child node.");
              return;
            }
            this.cmpTurretSphere = turretSphere.getComponent(fc.ComponentTransform);
            if (!this.cmpTurretSphere) {
              fc.Debug.error("Skyrush turret Circle has no transform component.");
              return;
            }
            this.transit(JOB.IDLE);
            fc.Loop.addEventListener(fc.EVENT.LOOP_FRAME, this.update);
            break;
        }
      }
  
      private update = (_event: Event): void => {
        this.act();
      }
  
  
  
      // protected reduceMutator(_mutator: ƒ.Mutator): void {
      //   // delete properties that should not be mutated
      //   // undefined properties and private fields (#) will not be included by default
      // }
    }
  }
