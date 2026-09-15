namespace Script {
    import fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script);  // Register the namespace to FUDGE for serialization
  
    export class SlopeComponentScript extends fc.ComponentScript {
      // Register the script as component for use in the editor via drag&drop
      public static readonly iSubclass: number = fc.Component.registerSubclass(SlopeComponentScript);
      // Properties may be mutated by users in the editor via the automatically created user interface
      public message: string = "SlopeComponentScript added to ";

      private deathPlane: fc.ComponentRigidbody;
      private colliderPlane: fc.ComponentRigidbody;
      constructor() {
        super();
  
        // Don't start when running in editor
        if (fc.Project.mode == fc.MODE.EDITOR)
          return;
  
        // Listen to this component being added to or removed from a node
        this.addEventListener(fc.EVENT.COMPONENT_ADD, this.hndEvent);
        this.addEventListener(fc.EVENT.COMPONENT_REMOVE, this.hndEvent);
        this.addEventListener(fc.EVENT.NODE_DESERIALIZED, this.hndEvent);
      }
  
      // Activate the functions of this component as response to events
      public hndEvent = (_event: Event): void => {
        switch (_event.type) {
          case fc.EVENT.COMPONENT_ADD:
            fc.Debug.log(this.message, this.node);
            break;
          case fc.EVENT.COMPONENT_REMOVE:
            this.removeEventListener(fc.EVENT.COMPONENT_ADD, this.hndEvent);
            this.removeEventListener(fc.EVENT.COMPONENT_REMOVE, this.hndEvent);
            break;
          case fc.EVENT.NODE_DESERIALIZED:
            this.deathPlane = this.node.getChildrenByName("Deathplane")[0].getComponent(fc.ComponentRigidbody);
            this.colliderPlane = this.node.getChildrenByName("Colliderplane")[0].getComponent(fc.ComponentRigidbody);
            this.deathPlane.addEventListener(fc.EVENT_PHYSICS.TRIGGER_ENTER, this.playerRespawn);
            this.colliderPlane.addEventListener(fc.EVENT_PHYSICS.TRIGGER_ENTER, this.onSlope);
            break;
        }
      }

      private onSlope = (_event: fc.EventPhysics): void => {
        if (_event.cmpRigidbody.node == avatar && currentTime/1000 > 1){
          isAirborne = false;
        }
      }
      
      playerRespawn = (_event: fc.EventPhysics): void => {
        if (_event.cmpRigidbody.node == avatar && currentTime / 1000 > 2 && hasFallenFarEnough(_event.cmpRigidbody.getPosition())){
          this.node.dispatchEvent(new CustomEvent("fall", {bubbles: true}));
        }
      }
      // protected reduceMutator(_mutator: ƒ.Mutator): void {
      //   // delete properties that should not be mutated
      //   // undefined properties and private fields (#) will not be included by default
      // }
    }
}
