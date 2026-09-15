namespace Script {
    import fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script);  // Register the namespace to FUDGE for serialization

    export class AvatarComponentScript extends fc.ComponentScript {
      // Register the script as component for use in the editor via drag&drop
      public static readonly iSubclass: number = fc.Component.registerSubclass(AvatarComponentScript);
      // Properties may be mutated by users in the editor via the automatically created user interface
      public message: string = "AvatarComponentScript added to ";
    
      private rigidbody: fc.ComponentRigidbody;

      private currentVelocity: fc.Vector3;

      private jumpHeight: number;
      private jumpActive: boolean;
      private obstacleContacts: Set<fc.ComponentRigidbody> = new Set();

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
            fc.Loop.addEventListener(fc.EVENT.LOOP_FRAME, this.handleInputs)
            fc.Loop.addEventListener(fc.EVENT.LOOP_FRAME, this.update)
            break;
          case fc.EVENT.COMPONENT_REMOVE:
            this.rigidbody.removeEventListener(fc.EVENT_PHYSICS.COLLISION_ENTER, this.handleCollisionEnter);
            this.rigidbody.removeEventListener(fc.EVENT_PHYSICS.COLLISION_EXIT, this.handleCollisionExit);
            this.rigidbody.removeEventListener(fc.EVENT_PHYSICS.TRIGGER_ENTER, this.handleTriggerEnter);
            this.removeEventListener(fc.EVENT.COMPONENT_ADD, this.hndEvent);
            this.removeEventListener(fc.EVENT.COMPONENT_REMOVE, this.hndEvent);
            break;
          case fc.EVENT.NODE_DESERIALIZED:
            this.rigidbody = this.node.getComponent(fc.ComponentRigidbody);
            // Set the pose before locking rotation: the player follows the
            // slope visually but can still never spin from a collision.
            this.rigidbody.setRotation(new fc.Vector3(0, 90, GAME_SETTINGS.slopeAngleDegrees));
            // Keep the visual Avatar tilted with the slope, but counter-rotate
            // the collision box so its bottom edge cannot behave like a ramp.
            this.rigidbody.mtxPivot.rotateZ(-GAME_SETTINGS.slopeAngleDegrees);
            this.rigidbody.isInitialized = false;
            this.rigidbody.effectRotation = GAME_SETTINGS.lockPlayerRotation ? new fc.Vector3(0, 0, 0) : new fc.Vector3(1, 1, 1);
            this.rigidbody.setAngularVelocity(new fc.Vector3(0, 0, 0));
            this.rigidbody.addEventListener(fc.EVENT_PHYSICS.COLLISION_ENTER, this.handleCollisionEnter);
            this.rigidbody.addEventListener(fc.EVENT_PHYSICS.COLLISION_EXIT, this.handleCollisionExit);
            this.rigidbody.addEventListener(fc.EVENT_PHYSICS.TRIGGER_ENTER, this.handleTriggerEnter);
            this.currentVelocity = new fc.Vector3(0, 0, 0);
            this.jumpHeight = 0;
            this.jumpActive = false;
            break;
        }
      }
  
      private update = (_event: Event): void => {
        if (GAME_SETTINGS.lockPlayerRotation) {
          this.rigidbody.setAngularVelocity(new fc.Vector3(0, 0, 0));
        }

        let minimumSpeed: number = GAME_SETTINGS.minimumForwardSpeed;
        this.currentVelocity = this.rigidbody.getVelocity();
        let position: fc.Vector3 = this.rigidbody.getPosition();
        // Leaving the deck starts a real fall. Keep the run active until the
        // player is visibly below the slope instead of failing at the edge.
        if ((!isWithinCourse(position) || (GAME_SETTINGS.courseStyle == "glacier" && isHardGap(position.x))) && hasFallenFarEnough(position)) {
          this.node.dispatchEvent(new CustomEvent("fall", { bubbles: true }));
          return;
        }
        let grounded: boolean = this.isGrounded();
        if (grounded && this.currentVelocity.y <= 0) {
          isAirborne = false;
          this.jumpActive = false;
        }
        else {
          isAirborne = true;
        }

        if (this.currentVelocity.x < minimumSpeed && !this.isBlockedByObstacle()) {
          this.rigidbody.setVelocity(new fc.Vector3(minimumSpeed, this.currentVelocity.y, this.currentVelocity.z));
          this.currentVelocity = this.rigidbody.getVelocity();
        }
        vui.updateSpeed(this.currentVelocity.x);
      }

      // protected reduceMutator(_mutator: ƒ.Mutator): void {
      //   // delete properties that should not be mutated
      //   // undefined properties and private fields (#) will not be included by default
      // }
      
      public handleInputs = (_event: Event): void => {
        this.currentVelocity = this.rigidbody.getVelocity();
        let forwardPressed: boolean = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.W, fc.KEYBOARD_CODE.ARROW_UP]);
        let brakePressed: boolean = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.S, fc.KEYBOARD_CODE.ARROW_DOWN]);
        let leftPressed: boolean = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.A, fc.KEYBOARD_CODE.ARROW_LEFT]);
        let rightPressed: boolean = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.D, fc.KEYBOARD_CODE.ARROW_RIGHT]);
        let jumpPressed: boolean = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.SPACE]);

        vui.updateInputViewer(forwardPressed, leftPressed, brakePressed, rightPressed, jumpPressed);

        if (forwardPressed) {
          this.moveForward();
        }
        if (brakePressed) {
          this.moveBrake();
        }
        if (leftPressed) {
          this.moveLeft();
        }
        if (rightPressed) {
          this.moveRight();
        }
        if (jumpPressed) {
          this.addJumpVelocity();
        }
        else {
          if(this.jumpHeight > 1.5){
            this.applyJumpVelocity(this.jumpHeight);
          }
          this.jumpHeight = 0;
        }

        vui.setJumpCharge(jumpPressed ? this.jumpHeight / GAME_SETTINGS.maximumJumpCharge : 0);
      }

      addJumpVelocity(): void {
        if(this.isGrounded() && !this.jumpActive){
          this.jumpHeight += GAME_SETTINGS.jumpChargePerFrame;
        }
      }

      applyJumpVelocity(velo: number): void {
        if(this.isGrounded() && !this.jumpActive){
          let clampedCharge: number = Math.min(velo, GAME_SETTINGS.maximumJumpCharge);
          let jumpVelocity: number = clampedCharge / GAME_SETTINGS.maximumJumpCharge * GAME_SETTINGS.maximumJumpVelocity;
          this.rigidbody.addVelocity(new fc.Vector3(0, jumpVelocity, 0));
          isAirborne = true;
          this.jumpActive = true;
        }
      }

      moveRight(): void {
        if(this.currentVelocity.z < GAME_SETTINGS.maximumSidewaysSpeed){
          this.rigidbody.applyForce(new fc.Vector3(0, 0, GAME_SETTINGS.sidewaysForce));
        }
      }

      moveLeft(): void {
        if(this.currentVelocity.z > -GAME_SETTINGS.maximumSidewaysSpeed){
          this.rigidbody.applyForce(new fc.Vector3(0, 0, -GAME_SETTINGS.sidewaysForce));
        }
      }

      moveForward(): void {
        if (this.isBlockedByObstacle()) return;
        let maximumSpeed: number = GAME_SETTINGS.maximumForwardSpeed + currentCoins * GAME_SETTINGS.coinMaximumSpeedBonus;
        if(this.currentVelocity.x < maximumSpeed) {
          this.rigidbody.applyForce(new fc.Vector3(GAME_SETTINGS.forwardForce, -3, 0));
        }
      }

      private isBlockedByObstacle(): boolean {
        return this.rigidbody.collisions.some(this.isObstacle);
      }

      private isGrounded(): boolean {
        let position: fc.Vector3 = this.rigidbody.getPosition();
        if (GAME_SETTINGS.courseStyle == "glacier" && (isHardGap(position.x) || !isWithinCourse(position)))
          return false;
        return position.y <= getSlopeSurfaceY(position.x) + GAME_SETTINGS.avatarGroundOffset;
      }

      private isObstacle = (_body: fc.ComponentRigidbody): boolean => {
        let name: string = _body.node.name;
        let parentName: string | undefined = _body.node.getParent()?.name;
        return name == "Fence" || name == "Tree" || name == "Snowboarder" ||
          parentName == "Fence" || parentName == "Tree" || parentName == "Snowboarder";
      }

      private handleCollisionEnter = (_event: fc.EventPhysics): void => {
        if (this.isObstacle(_event.cmpRigidbody)) {
          this.obstacleContacts.add(_event.cmpRigidbody);
          // A single rebound separates the bodies. Never teleport the player
          // to the surface each frame: that pins both falling and steering.
          let velocity: fc.Vector3 = this.rigidbody.getVelocity();
          this.rigidbody.setVelocity(new fc.Vector3(-4, Math.min(velocity.y, 0), velocity.z));
        }
      }

      private handleCollisionExit = (_event: fc.EventPhysics): void => {
        this.obstacleContacts.delete(_event.cmpRigidbody);
      }

      private handleTriggerEnter = (_event: fc.EventPhysics): void => {
        if (_event.cmpRigidbody.node.name != "Snowboarder")
          return;
        let velocity: fc.Vector3 = this.rigidbody.getVelocity();
        this.rigidbody.setVelocity(new fc.Vector3(
          Math.max(GAME_SETTINGS.minimumForwardSpeed, velocity.x * 0.55),
          velocity.y,
          velocity.z * 0.5
        ));
      }

      moveBrake(): void {
        if(this.currentVelocity.x > GAME_SETTINGS.minimumForwardSpeed) {
          this.rigidbody.applyForce(new fc.Vector3(-GAME_SETTINGS.brakeForce, 0, 0));
        }
      }
    }
  }
