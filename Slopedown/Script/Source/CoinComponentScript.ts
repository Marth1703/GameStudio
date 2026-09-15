namespace Script {
    import fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script);  // Register the namespace to FUDGE for serialization
  
    export class CoinComponentScript extends fc.ComponentScript {
      // Register the script as component for use in the editor via drag&drop
      public static readonly iSubclass: number = fc.Component.registerSubclass(CoinComponentScript);
      // Properties may be mutated by users in the editor via the automatically created user interface
      public message: string = "CoinComponentScript added to ";

      private coinSound: fc.Audio;
      private coinBody: fc.ComponentRigidbody;
      private collected: boolean = false;
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
            this.coinBody = this.node.getComponent(fc.ComponentRigidbody);
            this.coinBody.addEventListener(fc.EVENT_PHYSICS.TRIGGER_ENTER, this.collectCoin);
            this.coinSound = new fc.Audio(".\\Sounds\\coinCollect.mp3");
            fc.Loop.addEventListener(fc.EVENT.LOOP_FRAME, this.checkProximity);
            break;
          case fc.EVENT.COMPONENT_REMOVE:
            this.removeEventListener(fc.EVENT.COMPONENT_ADD, this.hndEvent);
            this.removeEventListener(fc.EVENT.COMPONENT_REMOVE, this.hndEvent);
            fc.Loop.removeEventListener(fc.EVENT.LOOP_FRAME, this.checkProximity);
            break;
          case fc.EVENT.NODE_DESERIALIZED:
            break;
          case fc.EVENT.NODE_ACTIVATE:
            break;
        }
      }

      private collectCoin = (_event: fc.EventPhysics): void => {
        // Coins overlap the slope when they are created. Only the Avatar may
        // collect one; other static/trigger bodies must be ignored.
        if (this.collected || _event.cmpRigidbody.node != avatar)
          return;

        this.collect();
      }

      private checkProximity = (_event: Event): void => {
        if (this.collected || !avatar)
          return;

        let avatarPosition: fc.Vector3 = avatar.getComponent(fc.ComponentRigidbody).getPosition();
        let coinPosition: fc.Vector3 = this.coinBody.getPosition();
        let isInsidePickup: boolean =
          Math.abs(avatarPosition.x - coinPosition.x) <= GAME_SETTINGS.coinTriggerLength + GAME_SETTINGS.avatarGroundOffset &&
          Math.abs(avatarPosition.y - coinPosition.y) <= GAME_SETTINGS.coinPickupHeight &&
          Math.abs(avatarPosition.z - coinPosition.z) <= GAME_SETTINGS.coinTriggerWidth;

        if (isInsidePickup)
          this.collect();
      }

      private collect(): void {
        if (this.collected)
          return;

        this.collected = true;
        let componentAudio = this.node.getComponent(fc.ComponentAudio);
        componentAudio.setAudio(this.coinSound);
        componentAudio.volume = 0.3;
        componentAudio.play(true);
        currentCoins++;
        this.coinBody.activate(false);
        this.node.getComponent(fc.ComponentMaterial).activate(false);
      }


  
      // protected reduceMutator(_mutator: ƒ.Mutator): void {
      //   // delete properties that should not be mutated
      //   // undefined properties and private fields (#) will not be included by default
      // }
    }
}
