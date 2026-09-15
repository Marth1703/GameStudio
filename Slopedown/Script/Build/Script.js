"use strict";
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    class AvatarComponentScript extends fc.ComponentScript {
        // Register the script as component for use in the editor via drag&drop
        static iSubclass = fc.Component.registerSubclass(AvatarComponentScript);
        // Properties may be mutated by users in the editor via the automatically created user interface
        message = "AvatarComponentScript added to ";
        rigidbody;
        currentVelocity;
        jumpHeight;
        jumpActive;
        obstacleContacts = new Set();
        constructor() {
            super();
            // Don't start when running in editor
            if (fc.Project.mode == fc.MODE.EDITOR)
                return;
            // Listen to this component being added to or removed from a node
            this.addEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
            this.addEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
            this.addEventListener("nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */, this.hndEvent);
        }
        // Activate the functions of this component as response to events
        hndEvent = (_event) => {
            switch (_event.type) {
                case "componentAdd" /* fc.EVENT.COMPONENT_ADD */:
                    fc.Debug.log(this.message, this.node);
                    fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.handleInputs);
                    fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.update);
                    break;
                case "componentRemove" /* fc.EVENT.COMPONENT_REMOVE */:
                    this.rigidbody.removeEventListener("ColliderEnteredCollision" /* fc.EVENT_PHYSICS.COLLISION_ENTER */, this.handleCollisionEnter);
                    this.rigidbody.removeEventListener("ColliderLeftCollision" /* fc.EVENT_PHYSICS.COLLISION_EXIT */, this.handleCollisionExit);
                    this.rigidbody.removeEventListener("TriggerEnteredCollision" /* fc.EVENT_PHYSICS.TRIGGER_ENTER */, this.handleTriggerEnter);
                    this.removeEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
                    this.removeEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
                    break;
                case "nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */:
                    this.rigidbody = this.node.getComponent(fc.ComponentRigidbody);
                    // Set the pose before locking rotation: the player follows the
                    // slope visually but can still never spin from a collision.
                    this.rigidbody.setRotation(new fc.Vector3(0, 90, Script.GAME_SETTINGS.slopeAngleDegrees));
                    // Keep the visual Avatar tilted with the slope, but counter-rotate
                    // the collision box so its bottom edge cannot behave like a ramp.
                    this.rigidbody.mtxPivot.rotateZ(-Script.GAME_SETTINGS.slopeAngleDegrees);
                    this.rigidbody.isInitialized = false;
                    this.rigidbody.effectRotation = Script.GAME_SETTINGS.lockPlayerRotation ? new fc.Vector3(0, 0, 0) : new fc.Vector3(1, 1, 1);
                    this.rigidbody.setAngularVelocity(new fc.Vector3(0, 0, 0));
                    this.rigidbody.addEventListener("ColliderEnteredCollision" /* fc.EVENT_PHYSICS.COLLISION_ENTER */, this.handleCollisionEnter);
                    this.rigidbody.addEventListener("ColliderLeftCollision" /* fc.EVENT_PHYSICS.COLLISION_EXIT */, this.handleCollisionExit);
                    this.rigidbody.addEventListener("TriggerEnteredCollision" /* fc.EVENT_PHYSICS.TRIGGER_ENTER */, this.handleTriggerEnter);
                    this.currentVelocity = new fc.Vector3(0, 0, 0);
                    this.jumpHeight = 0;
                    this.jumpActive = false;
                    break;
            }
        };
        update = (_event) => {
            if (Script.GAME_SETTINGS.lockPlayerRotation) {
                this.rigidbody.setAngularVelocity(new fc.Vector3(0, 0, 0));
            }
            let minimumSpeed = Script.GAME_SETTINGS.minimumForwardSpeed;
            this.currentVelocity = this.rigidbody.getVelocity();
            let position = this.rigidbody.getPosition();
            // Leaving the deck starts a real fall. Keep the run active until the
            // player is visibly below the slope instead of failing at the edge.
            if ((!Script.isWithinCourse(position) || (Script.GAME_SETTINGS.courseStyle == "glacier" && Script.isHardGap(position.x))) && Script.hasFallenFarEnough(position)) {
                this.node.dispatchEvent(new CustomEvent("fall", { bubbles: true }));
                return;
            }
            let grounded = this.isGrounded();
            if (grounded && this.currentVelocity.y <= 0) {
                Script.isAirborne = false;
                this.jumpActive = false;
            }
            else {
                Script.isAirborne = true;
            }
            if (this.currentVelocity.x < minimumSpeed && !this.isBlockedByObstacle()) {
                this.rigidbody.setVelocity(new fc.Vector3(minimumSpeed, this.currentVelocity.y, this.currentVelocity.z));
                this.currentVelocity = this.rigidbody.getVelocity();
            }
            Script.vui.updateSpeed(this.currentVelocity.x);
        };
        // protected reduceMutator(_mutator: ƒ.Mutator): void {
        //   // delete properties that should not be mutated
        //   // undefined properties and private fields (#) will not be included by default
        // }
        handleInputs = (_event) => {
            this.currentVelocity = this.rigidbody.getVelocity();
            let forwardPressed = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.W, fc.KEYBOARD_CODE.ARROW_UP]);
            let brakePressed = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.S, fc.KEYBOARD_CODE.ARROW_DOWN]);
            let leftPressed = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.A, fc.KEYBOARD_CODE.ARROW_LEFT]);
            let rightPressed = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.D, fc.KEYBOARD_CODE.ARROW_RIGHT]);
            let jumpPressed = fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.SPACE]);
            Script.vui.updateInputViewer(forwardPressed, leftPressed, brakePressed, rightPressed, jumpPressed);
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
                if (this.jumpHeight > 1.5) {
                    this.applyJumpVelocity(this.jumpHeight);
                }
                this.jumpHeight = 0;
            }
            Script.vui.setJumpCharge(jumpPressed ? this.jumpHeight / Script.GAME_SETTINGS.maximumJumpCharge : 0);
        };
        addJumpVelocity() {
            if (this.isGrounded() && !this.jumpActive) {
                this.jumpHeight += Script.GAME_SETTINGS.jumpChargePerFrame;
            }
        }
        applyJumpVelocity(velo) {
            if (this.isGrounded() && !this.jumpActive) {
                let clampedCharge = Math.min(velo, Script.GAME_SETTINGS.maximumJumpCharge);
                let jumpVelocity = clampedCharge / Script.GAME_SETTINGS.maximumJumpCharge * Script.GAME_SETTINGS.maximumJumpVelocity;
                this.rigidbody.addVelocity(new fc.Vector3(0, jumpVelocity, 0));
                Script.isAirborne = true;
                this.jumpActive = true;
            }
        }
        moveRight() {
            if (this.currentVelocity.z < Script.GAME_SETTINGS.maximumSidewaysSpeed) {
                this.rigidbody.applyForce(new fc.Vector3(0, 0, Script.GAME_SETTINGS.sidewaysForce));
            }
        }
        moveLeft() {
            if (this.currentVelocity.z > -Script.GAME_SETTINGS.maximumSidewaysSpeed) {
                this.rigidbody.applyForce(new fc.Vector3(0, 0, -Script.GAME_SETTINGS.sidewaysForce));
            }
        }
        moveForward() {
            if (this.isBlockedByObstacle())
                return;
            let maximumSpeed = Script.GAME_SETTINGS.maximumForwardSpeed + Script.currentCoins * Script.GAME_SETTINGS.coinMaximumSpeedBonus;
            if (this.currentVelocity.x < maximumSpeed) {
                this.rigidbody.applyForce(new fc.Vector3(Script.GAME_SETTINGS.forwardForce, -3, 0));
            }
        }
        isBlockedByObstacle() {
            return this.rigidbody.collisions.some(this.isObstacle);
        }
        isGrounded() {
            let position = this.rigidbody.getPosition();
            if (Script.GAME_SETTINGS.courseStyle == "glacier" && (Script.isHardGap(position.x) || !Script.isWithinCourse(position)))
                return false;
            return position.y <= Script.getSlopeSurfaceY(position.x) + Script.GAME_SETTINGS.avatarGroundOffset;
        }
        isObstacle = (_body) => {
            let name = _body.node.name;
            let parentName = _body.node.getParent()?.name;
            return name == "Fence" || name == "Tree" || name == "Snowboarder" ||
                parentName == "Fence" || parentName == "Tree" || parentName == "Snowboarder";
        };
        handleCollisionEnter = (_event) => {
            if (this.isObstacle(_event.cmpRigidbody)) {
                this.obstacleContacts.add(_event.cmpRigidbody);
                // A single rebound separates the bodies. Never teleport the player
                // to the surface each frame: that pins both falling and steering.
                let velocity = this.rigidbody.getVelocity();
                this.rigidbody.setVelocity(new fc.Vector3(-4, Math.min(velocity.y, 0), velocity.z));
            }
        };
        handleCollisionExit = (_event) => {
            this.obstacleContacts.delete(_event.cmpRigidbody);
        };
        handleTriggerEnter = (_event) => {
            if (_event.cmpRigidbody.node.name != "Snowboarder")
                return;
            let velocity = this.rigidbody.getVelocity();
            this.rigidbody.setVelocity(new fc.Vector3(Math.max(Script.GAME_SETTINGS.minimumForwardSpeed, velocity.x * 0.55), velocity.y, velocity.z * 0.5));
        };
        moveBrake() {
            if (this.currentVelocity.x > Script.GAME_SETTINGS.minimumForwardSpeed) {
                this.rigidbody.applyForce(new fc.Vector3(-Script.GAME_SETTINGS.brakeForce, 0, 0));
            }
        }
    }
    Script.AvatarComponentScript = AvatarComponentScript;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    class CoinComponentScript extends fc.ComponentScript {
        // Register the script as component for use in the editor via drag&drop
        static iSubclass = fc.Component.registerSubclass(CoinComponentScript);
        // Properties may be mutated by users in the editor via the automatically created user interface
        message = "CoinComponentScript added to ";
        coinSound;
        coinBody;
        collected = false;
        constructor() {
            super();
            // Don't start when running in editor
            if (fc.Project.mode == fc.MODE.EDITOR)
                return;
            // Listen to this component being added to or removed from a node
            this.addEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
            this.addEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
            this.addEventListener("nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */, this.hndEvent);
        }
        // Activate the functions of this component as response to events
        hndEvent = (_event) => {
            switch (_event.type) {
                case "componentAdd" /* fc.EVENT.COMPONENT_ADD */:
                    this.coinBody = this.node.getComponent(fc.ComponentRigidbody);
                    this.coinBody.addEventListener("TriggerEnteredCollision" /* fc.EVENT_PHYSICS.TRIGGER_ENTER */, this.collectCoin);
                    this.coinSound = new fc.Audio(".\\Sounds\\coinCollect.mp3");
                    fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.checkProximity);
                    break;
                case "componentRemove" /* fc.EVENT.COMPONENT_REMOVE */:
                    this.removeEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
                    this.removeEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
                    fc.Loop.removeEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.checkProximity);
                    break;
                case "nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */:
                    break;
                case "nodeActivate" /* fc.EVENT.NODE_ACTIVATE */:
                    break;
            }
        };
        collectCoin = (_event) => {
            // Coins overlap the slope when they are created. Only the Avatar may
            // collect one; other static/trigger bodies must be ignored.
            if (this.collected || _event.cmpRigidbody.node != Script.avatar)
                return;
            this.collect();
        };
        checkProximity = (_event) => {
            if (this.collected || !Script.avatar)
                return;
            let avatarPosition = Script.avatar.getComponent(fc.ComponentRigidbody).getPosition();
            let coinPosition = this.coinBody.getPosition();
            let isInsidePickup = Math.abs(avatarPosition.x - coinPosition.x) <= Script.GAME_SETTINGS.coinTriggerLength + Script.GAME_SETTINGS.avatarGroundOffset &&
                Math.abs(avatarPosition.y - coinPosition.y) <= Script.GAME_SETTINGS.coinPickupHeight &&
                Math.abs(avatarPosition.z - coinPosition.z) <= Script.GAME_SETTINGS.coinTriggerWidth;
            if (isInsidePickup)
                this.collect();
        };
        collect() {
            if (this.collected)
                return;
            this.collected = true;
            let componentAudio = this.node.getComponent(fc.ComponentAudio);
            componentAudio.setAudio(this.coinSound);
            componentAudio.volume = 0.3;
            componentAudio.play(true);
            Script.currentCoins++;
            this.coinBody.activate(false);
            this.node.getComponent(fc.ComponentMaterial).activate(false);
        }
    }
    Script.CoinComponentScript = CoinComponentScript;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    class CoinNode extends fc.Node {
        constructor(_cords) {
            super("Coin");
            let coinTorus = new fc.MeshTorus("Cointorus", -0.250, 7, 6);
            let coinMesh = new fc.ComponentMesh(coinTorus);
            coinMesh.mtxPivot.scaling = new fc.Vector3(2, 1, 2);
            // This material is preloaded from Internal.json, just like the snow
            // and sky textures. Runtime-created TextureImage instances do not
            // reliably finish loading before FUDGE renders these spawned nodes.
            let coinMat = fc.Project.resources["Material|2026-09-07T18:10:00.000Z|33145"];
            let coinMatComp = new fc.ComponentMaterial(coinMat);
            coinMatComp.mtxPivot.scaling = new fc.Vector2(1, 6);
            let coinTransform = new fc.ComponentTransform();
            coinTransform.mtxLocal.translation = _cords;
            coinTransform.mtxLocal.rotateZ(85);
            let coinRigidBody = new fc.ComponentRigidbody();
            coinRigidBody.isTrigger = true;
            coinRigidBody.effectGravity = 0;
            // A wider trigger prevents a fast player from stepping over the
            // final coin in a three-coin row between physics frames.
            // The coin node is rotated 85 degrees around Z: its local Y axis
            // therefore follows the downhill X direction of the slope.
            coinRigidBody.mtxPivot.scaling = new fc.Vector3(0.6, Script.GAME_SETTINGS.coinTriggerLength, Script.GAME_SETTINGS.coinTriggerWidth);
            coinRigidBody.typeBody = fc.BODY_TYPE.STATIC;
            let coinAudio = new fc.ComponentAudio();
            let coinScript = new Script.CoinComponentScript();
            this.addComponent(coinMesh);
            this.addComponent(coinMatComp);
            this.addComponent(coinTransform);
            this.addComponent(coinRigidBody);
            this.addComponent(coinAudio);
            this.addComponent(coinScript);
            let animseqRot = new fc.AnimationSequence();
            animseqRot.addKey(new fc.AnimationKey(0, 1));
            animseqRot.addKey(new fc.AnimationKey(750, 1.3));
            animseqRot.addKey(new fc.AnimationKey(1500, 1));
            let animStructure = {
                components: {
                    ComponentTransform: [
                        {
                            "ƒ.ComponentTransform": {
                                mtxLocal: {
                                    scaling: {
                                        x: animseqRot,
                                        z: animseqRot
                                    }
                                }
                            }
                        }
                    ]
                }
            };
            let fps = 30;
            let animation = new fc.Animation("testAnimation", animStructure, fps);
            let cmpAnimator = new fc.ComponentAnimator(animation);
            cmpAnimator.scale = 1;
            this.addComponent(cmpAnimator);
            cmpAnimator.activate(true);
        }
    }
    Script.CoinNode = CoinNode;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var ƒ = FudgeCore;
    ƒ.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    class CustomComponentScript extends ƒ.ComponentScript {
        // Register the script as component for use in the editor via drag&drop
        static iSubclass = ƒ.Component.registerSubclass(CustomComponentScript);
        // Properties may be mutated by users in the editor via the automatically created user interface
        message = "CustomComponentScript added to ";
        constructor() {
            super();
            // Don't start when running in editor
            if (ƒ.Project.mode == ƒ.MODE.EDITOR)
                return;
            // Listen to this component being added to or removed from a node
            this.addEventListener("componentAdd" /* ƒ.EVENT.COMPONENT_ADD */, this.hndEvent);
            this.addEventListener("componentRemove" /* ƒ.EVENT.COMPONENT_REMOVE */, this.hndEvent);
            this.addEventListener("nodeDeserialized" /* ƒ.EVENT.NODE_DESERIALIZED */, this.hndEvent);
        }
        // Activate the functions of this component as response to events
        hndEvent = (_event) => {
            switch (_event.type) {
                case "componentAdd" /* ƒ.EVENT.COMPONENT_ADD */:
                    ƒ.Debug.log(this.message, this.node);
                    break;
                case "componentRemove" /* ƒ.EVENT.COMPONENT_REMOVE */:
                    this.removeEventListener("componentAdd" /* ƒ.EVENT.COMPONENT_ADD */, this.hndEvent);
                    this.removeEventListener("componentRemove" /* ƒ.EVENT.COMPONENT_REMOVE */, this.hndEvent);
                    break;
                case "nodeDeserialized" /* ƒ.EVENT.NODE_DESERIALIZED */:
                    // if deserialized the node is now fully reconstructed and access to all its components and children is possible
                    break;
            }
        };
    }
    Script.CustomComponentScript = CustomComponentScript;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    class FenceNode extends fc.Node {
        constructor(_cords) {
            super("Fence");
            let Leg1 = new fc.Node("leg1");
            let Leg2 = new fc.Node("leg2");
            let FenceCube = new fc.MeshCube("fence");
            let Leg1Cube = new fc.MeshCube("Leg1C");
            let Leg2Cube = new fc.MeshCube("Leg2C");
            let FenceMesh = new fc.ComponentMesh(FenceCube);
            let Leg1Mesh = new fc.ComponentMesh(Leg1Cube);
            let Leg2Mesh = new fc.ComponentMesh(Leg2Cube);
            FenceMesh.mtxPivot.scaling = new fc.Vector3(0.3, 1, 4);
            Leg1Mesh.mtxPivot.scaling = new fc.Vector3(0.4, 2, 0.4);
            Leg2Mesh.mtxPivot.scaling = new fc.Vector3(0.4, 2, 0.4);
            // Preloaded resources use the same proven path as the snow and sky
            // materials, preventing a black/unfinished runtime texture.
            let woodMat = fc.Project.resources["Material|2026-09-07T18:10:00.000Z|33143"];
            let woodMatComp = new fc.ComponentMaterial(woodMat);
            let woodMatComp2 = new fc.ComponentMaterial(woodMat);
            let woodMatComp3 = new fc.ComponentMaterial(woodMat);
            let FenceTransform = new fc.ComponentTransform();
            let Leg1Transform = new fc.ComponentTransform();
            let Leg2Transform = new fc.ComponentTransform();
            FenceTransform.mtxLocal.translation = _cords;
            Leg1Transform.mtxLocal.translation = new fc.Vector3(0.2, -0.2, 1.2);
            Leg2Transform.mtxLocal.translation = new fc.Vector3(0.2, -0.2, -1.2);
            let FenceRigidBody = new fc.ComponentRigidbody();
            FenceRigidBody.typeBody = fc.BODY_TYPE.STATIC;
            FenceRigidBody.effectGravity = 0;
            FenceRigidBody.mtxPivot.translation = new fc.Vector3(0.1, -0.1, 0);
            // The visual rail stays narrow, but the physics wall is deeper
            // along the downhill X axis. This prevents tunnelling when a
            // boosted player moves a long distance in one physics frame.
            FenceRigidBody.mtxPivot.scaling = new fc.Vector3(Script.GAME_SETTINGS.fenceCollisionDepth, 2, 4.1);
            this.addComponent(FenceMesh);
            this.addComponent(woodMatComp);
            this.addComponent(FenceTransform);
            this.addComponent(FenceRigidBody);
            Leg1.addComponent(Leg1Mesh);
            Leg1.addComponent(woodMatComp2);
            Leg1.addComponent(Leg1Transform);
            Leg2.addComponent(Leg2Mesh);
            Leg2.addComponent(woodMatComp3);
            Leg2.addComponent(Leg2Transform);
            this.addChild(Leg1);
            this.addChild(Leg2);
        }
    }
    Script.FenceNode = FenceNode;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    class FinishComponentScript extends fc.ComponentScript {
        // Register the script as component for use in the editor via drag&drop
        static iSubclass = fc.Component.registerSubclass(FinishComponentScript);
        // Properties may be mutated by users in the editor via the automatically created user interface
        message = "FinishComponentScript added to ";
        finishBody;
        crossed = false;
        constructor() {
            super();
            // Don't start when running in editor
            if (fc.Project.mode == fc.MODE.EDITOR)
                return;
            // Listen to this component being added to or removed from a node
            this.addEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
            this.addEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
            this.addEventListener("nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */, this.hndEvent);
        }
        // Activate the functions of this component as response to events
        hndEvent = (_event) => {
            switch (_event.type) {
                case "componentAdd" /* fc.EVENT.COMPONENT_ADD */:
                    fc.Debug.log(this.message, this.node);
                    this.finishBody = this.node.getComponent(fc.ComponentRigidbody);
                    this.finishBody.addEventListener("TriggerEnteredCollision" /* fc.EVENT_PHYSICS.TRIGGER_ENTER */, this.crossedLine);
                    break;
                case "componentRemove" /* fc.EVENT.COMPONENT_REMOVE */:
                    this.removeEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
                    this.removeEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
                    break;
                case "nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */:
                    break;
                case "nodeActivate" /* fc.EVENT.NODE_ACTIVATE */:
                    break;
            }
        };
        crossedLine = (_event) => {
            if (!this.crossed && _event.cmpRigidbody.node == Script.avatar && Script.currentTime / 1000 > 2) {
                this.crossed = true;
                this.node.dispatchEvent(new CustomEvent("fin", { bubbles: true }));
            }
        };
    }
    Script.FinishComponentScript = FinishComponentScript;
})(Script || (Script = {}));
var Script;
(function (Script) {
    Script.GAME_SETTINGS = {
        // Course geometry
        // Must match the Slope rotation in Internal.json so placement offsets are
        // measured from the real physics surface.
        courseStyle: "straight",
        slopeAngleDegrees: -5,
        slopeHalfHeight: 20,
        courseStartX: -420,
        courseEndX: 480,
        normalCurveAmplitude: 7,
        normalCourseHalfWidth: 12,
        normalTerrainStartX: -500,
        normalTerrainEndX: 500,
        normalSegmentLength: 50,
        spawnStartMargin: 24,
        spawnEndMargin: 22,
        // Procedural object counts and spacing
        treeCount: 22,
        fenceCount: 8,
        portalCount: 10,
        coinGroupCount: 10,
        coinGroupSpacing: 5,
        coinTriggerWidth: 1.5,
        coinTriggerLength: 1.1,
        coinPickupHeight: 2,
        portalTriggerLength: 3,
        portalTriggerWidth: 3,
        portalTriggerHeight: 4,
        treeSpawnRadius: 3.5,
        fenceSpawnRadius: 2.5,
        portalSpawnRadius: 4.5,
        coinGroupSpawnRadius: 6.5,
        spawnPlacementAttempts: 40,
        spawnLaneMinZ: -8,
        spawnLaneMaxZ: 8,
        portalStartSafeDistance: 36,
        // Object placement relative to the exact physical surface of the slope.
        // These values directly raise/lower the visual object and its trigger.
        treeSurfaceOffset: 3.3,
        coinSurfaceOffset: 0.95,
        portalSurfaceOffset: 1.0,
        fenceBaseHeight: 1.2,
        // Invisible depth along the downhill axis. Keep this wider than the
        // visual rail so high-speed physics frames cannot skip a fence.
        fenceCollisionDepth: 3.2,
        physicsCollisionMargin: 0.15,
        // Player movement and physics
        initialForwardSpeed: 10,
        minimumForwardSpeed: 8,
        maximumForwardSpeed: 34,
        maximumBoostedSpeed: 60,
        forwardForce: 350,
        brakeForce: 70,
        sidewaysForce: 240,
        maximumSidewaysSpeed: 10,
        jumpChargePerFrame: 0.35,
        maximumJumpCharge: 10,
        maximumJumpForce: 5000,
        maximumJumpVelocity: 12,
        lockPlayerRotation: true,
        preventObstacleClimbing: true,
        avatarGroundOffset: 1.2,
        fallDepth: 5,
        // Rewards
        boostSpeedBonus: 14,
        coinMaximumSpeedBonus: 0.5
    };
    async function loadGameSettings(_level) {
        try {
            let response = await fetch(`Levels/${_level}.json`, { cache: "no-store" });
            if (!response.ok)
                return;
            let overrides = await response.json();
            Object.assign(Script.GAME_SETTINGS, overrides);
        }
        catch (_error) {
            // Defaults above keep the game runnable if the optional JSON file cannot load.
        }
    }
    Script.loadGameSettings = loadGameSettings;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    // Exact top-surface bounds; the chasm has no hidden collider underneath it.
    Script.HARD_COURSE_START = -500;
    Script.HARD_COURSE_END = 1000;
    Script.HARD_FINISH_X = 960;
    Script.HARD_GAP_START = -12;
    Script.HARD_GAP_END = 30;
    function isHardGap(_x) {
        return (_x > Script.HARD_GAP_START && _x < Script.HARD_GAP_END) || (_x > 690 && _x < 732);
    }
    Script.isHardGap = isHardGap;
    function hardCourseCenterZ(_x) {
        if (_x >= -240 && _x < -100)
            return 7;
        if (_x >= 400 && _x < 580)
            return -7;
        return 0;
    }
    Script.hardCourseCenterZ = hardCourseCenterZ;
    function hardCourseHalfWidth(_x) {
        if (_x >= -240 && _x < -210)
            return 5;
        if (_x >= -210 && _x < -130)
            return 1.15;
        if (_x >= -130 && _x < -100)
            return 5;
        if (_x >= 400 && _x < 430)
            return 5;
        if (_x >= 430 && _x < 550)
            return 1.15;
        if (_x >= 550 && _x < 580)
            return 5;
        return 14;
    }
    Script.hardCourseHalfWidth = hardCourseHalfWidth;
    function createHardCourse(_branch) {
        _branch.getChildrenByName("Slope")[0]?.activate(false);
        const background = _branch.getChildrenByName("Background")[0];
        if (background) {
            background.mtxLocal.translation = new fc.Vector3(250, 0, 0);
            background.getComponent(fc.ComponentMesh).mtxPivot.scaling = new fc.Vector3(1800, 1200, 1800);
            background.getComponent(fc.ComponentMesh).mtxPivot.translation = new fc.Vector3(0, -1000, 0);
        }
        let sky = _branch.getChildrenByName("Terrain")[0];
        let skyMesh = sky?.getComponent(fc.ComponentMesh);
        if (skyMesh)
            skyMesh.mtxPivot.scaling = new fc.Vector3(3000, 16, 900);
        let course = new fc.Node("GlacierDivide");
        _branch.addChild(course);
        let snow = fc.Project.resources["Material|2023-01-10T16:08:39.923Z|66013"];
        let ice = new fc.Material("GlacierIce", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.18, 0.65, 0.82)));
        let cyan = new fc.Material("RouteCyan", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.2, 0.95, 1)));
        let amber = new fc.Material("TakeoffAmber", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(1, 0.58, 0.12)));
        let angle = Script.GAME_SETTINGS.slopeAngleDegrees * Math.PI / 180;
        let finishLine = _branch.getChildrenByName("Finishline")[0];
        if (finishLine) {
            let finishPosition = new fc.Vector3(Script.HARD_FINISH_X, Script.getSlopeSurfaceY(Script.HARD_FINISH_X) + 18.5, 0);
            finishLine.getComponent(fc.ComponentTransform).mtxLocal.translation = finishPosition;
            let finishBody = finishLine.getComponent(fc.ComponentRigidbody);
            if (finishBody)
                finishBody.isInitialized = false;
        }
        function box(_name, _position, _size, _material, _solid = false, _tilt = 0) {
            let node = new fc.Node(_name);
            let transform = new fc.ComponentTransform();
            transform.mtxLocal.translation = _position;
            transform.mtxLocal.rotation = new fc.Vector3(0, 0, _tilt);
            let mesh = new fc.ComponentMesh(new fc.MeshCube(_name));
            mesh.mtxPivot.scaling = _size;
            node.addComponent(transform);
            node.addComponent(mesh);
            node.addComponent(new fc.ComponentMaterial(_material));
            if (_solid) {
                let body = new fc.ComponentRigidbody();
                body.typeBody = fc.BODY_TYPE.STATIC;
                body.effectGravity = 0;
                body.mtxPivot.scaling = _size;
                node.addComponent(body);
            }
            course.addChild(node);
        }
        let bounds = [Script.HARD_COURSE_START, -240, -210, -130, -100, Script.HARD_GAP_START, Script.HARD_GAP_END, 400, 430, 550, 580, 690, 732, Script.HARD_COURSE_END];
        for (let i = 0; i < bounds.length - 1; i++) {
            let start = bounds[i];
            let end = bounds[i + 1];
            let x = (start + end) / 2;
            if (isHardGap(x))
                continue;
            // Offset along the surface normal so the rotated top face ends exactly
            // at start/end, instead of silently extending into the jump gap.
            box("SnowDeck", new fc.Vector3(x + Math.sin(angle), Script.getSlopeSurfaceY(x) - Math.cos(angle), hardCourseCenterZ(x)), new fc.Vector3((end - start) / Math.cos(angle), 2, hardCourseHalfWidth(x) * 2), snow, true, Script.GAME_SETTINGS.slopeAngleDegrees);
            for (let markerX = start + 4; markerX < end - 2; markerX += 12) {
                for (let side of [-1, 1]) {
                    let z = hardCourseCenterZ(markerX) + side * (hardCourseHalfWidth(markerX) - 0.3);
                    box("EdgeLight", new fc.Vector3(markerX, Script.getSlopeSurfaceY(markerX) + 0.15, z), new fc.Vector3(3, 0.16, 0.24), cyan, false, Script.GAME_SETTINGS.slopeAngleDegrees);
                }
            }
        }
        // Glacial towers below/outside the route frame the bridge and open chasm.
        for (let x of [-225, -190, -155, -55, -20, 34, 70, 415, 490, 565, 720, 900]) {
            for (let side of [-1, 1]) {
                box("IceSpire", new fc.Vector3(x, Script.getSlopeSurfaceY(x) - 15, side * 21), new fc.Vector3(7, 38, 5), ice, false, side * 12);
            }
        }
        for (let x of [-360, -250, -100, 80, 280, 390, 600, 780, 910]) {
            let gateHalfWidth = Math.min(12.5, hardCourseHalfWidth(x) - 0.35);
            for (let side of [-1, 1])
                box("GatePost", new fc.Vector3(x, Script.getSlopeSurfaceY(x) + 4, side * gateHalfWidth), new fc.Vector3(0.5, 8, 0.5), cyan);
            box("GateHeader", new fc.Vector3(x, Script.getSlopeSurfaceY(x) + 8, 0), new fc.Vector3(0.5, 0.5, gateHalfWidth * 2 + 0.5), cyan);
        }
        for (let x of [-60, -48, -36, -24, -15])
            box("ChargeStripe", new fc.Vector3(x, Script.getSlopeSurfaceY(x) + 0.08, 0), new fc.Vector3(0.7, 0.1, 25), amber, false, Script.GAME_SETTINGS.slopeAngleDegrees);
        for (let side of [-1, 1])
            box("TakeoffBeacon", new fc.Vector3(-13, Script.getSlopeSurfaceY(-13) + 3, side * 13), new fc.Vector3(0.7, 6, 0.7), amber);
        for (let x of [652, 664, 676, 687])
            box("ChargeStripe", new fc.Vector3(x, Script.getSlopeSurfaceY(x) + 0.08, 0), new fc.Vector3(0.7, 0.1, 25), amber, false, Script.GAME_SETTINGS.slopeAngleDegrees);
        // Readable, repeatable slalom: each pair leaves a generous opposite lane.
        for (let [x, side] of [[-350, -1], [-290, 1], [130, 1], [210, -1], [310, 1], [600, -1], [790, 1], [840, -1]]) {
            for (let z of [0, side * 4, side * 8])
                _branch.addChild(new Script.FenceNode(new fc.Vector3(x, Script.getSlopeSurfaceY(x) + Script.GAME_SETTINGS.fenceBaseHeight, z)));
            for (let dx of [-16, -6, 4])
                _branch.addChild(new Script.CoinNode(new fc.Vector3(x + dx, Script.getSlopeSurfaceY(x + dx) + Script.GAME_SETTINGS.coinSurfaceOffset, -side * 5)));
        }
        for (let x of [-390, -265, 100, 240, 370, 620, 760, 880]) {
            for (let side of [-1, 1])
                _branch.addChild(new Script.TreeNode(new fc.Vector3(x, Script.getSlopeSurfaceY(x) + Script.GAME_SETTINGS.treeSurfaceOffset, side * 11)));
        }
        for (let x of [-202, -187, -172, -157, -142, 62, 74, 86, 445, 465, 485, 505, 525])
            _branch.addChild(new Script.CoinNode(new fc.Vector3(x, Script.getSlopeSurfaceY(x) + Script.GAME_SETTINGS.coinSurfaceOffset, hardCourseCenterZ(x))));
        // Five boost gates punctuate the full course; the jump remains possible
        // without collecting the approach gate.
        for (let x of [-320, -80, 160, 630, 900])
            _branch.addChild(new Script.RingNode(new fc.Vector3(x, Script.getSlopeSurfaceY(x) + Script.GAME_SETTINGS.portalSurfaceOffset, 0)));
        // Each random row has its own reserved downhill interval, clear of fixed
        // fences, boost frames, bridge entrances and jump run-ups/landings.
        for (let center of [-380, 265, 355, 870]) {
            const x = center + fc.random.getRange(-5, 5);
            const z = fc.random.getRange(-7, 7);
            if (Math.random() < 0.5)
                _branch.addChild(new Script.TreeNode(new fc.Vector3(x, Script.getSlopeSurfaceY(x) + Script.GAME_SETTINGS.treeSurfaceOffset, z)));
            else
                _branch.addChild(new Script.FenceNode(new fc.Vector3(x, Script.getSlopeSurfaceY(x) + Script.GAME_SETTINGS.fenceBaseHeight, z)));
        }
        for (let x of [65, 185, 815])
            _branch.addChild(new Script.SnowboarderNode(new fc.Vector3(x, Script.getSlopeSurfaceY(x) + 0.35, 0), Math.random() * Math.PI * 2, 9));
    }
    Script.createHardCourse = createHardCourse;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Debug.info("Main Program Template running!");
    Script.gateSpeedUncapped = false;
    let timeSinceStart;
    let cmpCamera;
    let gameFinished = false;
    let gamePaused = false;
    let occupiedSpawns = [];
    let selectedLevel = "easy";
    const SESSION_RESULTS_KEY = "slopedown-session-results";
    document.addEventListener("interactiveViewportStarted", (_event) => {
        void start(_event);
    });
    async function start(_event) {
        let requestedLevel = window.slopedownSelectedLevel;
        selectedLevel = requestedLevel == "normal" || requestedLevel == "hard" ? requestedLevel : "easy";
        await Script.loadGameSettings(selectedLevel);
        // FUDGE/Oimo uses a small collision skin by default. A slightly wider
        // margin catches fast impacts before a player can tunnel through a fence.
        fc.Physics.settings.defaultCollisionMargin = Script.GAME_SETTINGS.physicsCollisionMargin;
        timeSinceStart = fc.Time.game.get();
        Script.viewport = _event.detail;
        cmpCamera = Script.viewport.camera;
        if (Script.GAME_SETTINGS.courseStyle == "glacier")
            cmpCamera.projectCentral(cmpCamera.getAspect(), cmpCamera.getFieldOfView(), cmpCamera.getDirection(), cmpCamera.getNear(), 6000);
        fetchCameraPosition();
        let branch = Script.viewport.getBranch();
        configureCourse(branch);
        Script.vui = new Script.VUI();
        Script.currentTime = 0;
        Script.isAirborne = false;
        gameFinished = false;
        gamePaused = false;
        Script.avatar = branch.getChildrenByName("Avatar")[0];
        Script.currentCoins = 0;
        Script.gateSpeedUncapped = false;
        let avatarBody = Script.avatar.getComponent(fc.ComponentRigidbody);
        if (Script.GAME_SETTINGS.courseStyle != "straight") {
            let startPosition = avatarBody.getPosition();
            avatarBody.setPosition(new fc.Vector3(startPosition.x, getSlopeSurfaceY(startPosition.x) + Script.GAME_SETTINGS.avatarGroundOffset, getCourseCenterZ(startPosition.x)));
        }
        avatarBody.setVelocity(new fc.Vector3(Script.GAME_SETTINGS.initialForwardSpeed, 0, 0));
        fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, update);
        branch.addEventListener("fall", stopGame);
        branch.addEventListener("fin", endGame);
        setUpMusic();
        occupiedSpawns = [];
        if (Script.GAME_SETTINGS.courseStyle != "glacier") {
            if (Script.GAME_SETTINGS.courseStyle == "curved")
                createSnowboarders();
            createRings();
            createTrees();
            createCoins();
            createFences();
        }
        document.addEventListener("keydown", handlePauseKey);
        fc.Loop.start();
    }
    function stopGame() {
        if (gameFinished)
            return;
        gameFinished = true;
        Script.avatar.activate(false);
        Script.componentAudio.play(false);
        Script.vui.showFailure(Script.currentTime, Script.currentCoins);
    }
    function endGame() {
        if (gameFinished)
            return;
        gameFinished = true;
        Script.componentAudio.play(false);
        Script.componentAudio.setAudio(new fc.Audio(".\\Sounds\\victory.mp3"));
        Script.componentAudio.volume = 0.3;
        Script.componentAudio.play(true);
        Script.avatar.activate(false);
        let calculatedScore = Math.max(0, Math.round(Script.currentCoins * 200 + (60000 - Script.currentTime)));
        let result = { timeMs: Script.currentTime, coins: Script.currentCoins, score: calculatedScore };
        Script.vui.showFinish(result, recordSessionResult(result));
    }
    function handlePauseKey(_event) {
        if (_event.code != "Escape" || gameFinished)
            return;
        _event.preventDefault();
        gamePaused = !gamePaused;
        Script.vui.setPaused(gamePaused);
        if (gamePaused) {
            Script.componentAudio.play(false);
            fc.Loop.stop();
            return;
        }
        Script.componentAudio.play(true);
        fc.Loop.continue();
    }
    function setUpMusic() {
        Script.componentAudio = new fc.ComponentAudio();
        Script.avatar.addComponent(Script.componentAudio);
        // Autoview begins loading the track while the controls briefing is shown,
        // so the first audible frame follows the Start click instead of arriving
        // several seconds into a run.
        let music = window.slopedownBackgroundMusic;
        if (!music) {
            music = new fc.Audio();
            void music.load("Sounds/backgroundMusic.mp3");
        }
        Script.componentAudio.setAudio(music);
        Script.componentAudio.volume = 0.1;
        Script.componentAudio.play(true);
    }
    async function fetchCameraPosition() {
        let response = await fetch("config.json");
        let camAngle = await response.json();
        cmpCamera.mtxPivot.translate(new fc.Vector3(camAngle.CameraX, camAngle.CameraY, camAngle.CameraZ));
    }
    function createRings() {
        // The rendered gate is much wider than its pickup trigger. Reserve its
        // full footprint so a later fence cannot intersect its frame.
        let positions = createDistributedSpawnPoints(Script.GAME_SETTINGS.portalCount, 13, Script.GAME_SETTINGS.spawnStartMargin + Script.GAME_SETTINGS.portalStartSafeDistance, Script.GAME_SETTINGS.spawnEndMargin);
        for (let position of positions) {
            let ringY = getSlopeSurfaceY(position.x) + Script.GAME_SETTINGS.portalSurfaceOffset;
            let ring = new Script.RingNode(new fc.Vector3(position.x, ringY, position.z));
            Script.viewport.getBranch().addChild(ring);
        }
    }
    function createTrees() {
        let positions = createDistributedSpawnPoints(Script.GAME_SETTINGS.treeCount, Script.GAME_SETTINGS.treeSpawnRadius);
        for (let position of positions) {
            let treeY = getSlopeSurfaceY(position.x) + Script.GAME_SETTINGS.treeSurfaceOffset;
            let tree = new Script.TreeNode(new fc.Vector3(position.x, treeY, position.z));
            Script.viewport.getBranch().addChild(tree);
        }
    }
    function createCoins() {
        let coinGroupRadius = Math.max(Script.GAME_SETTINGS.coinGroupSpawnRadius, Script.GAME_SETTINGS.coinGroupSpacing + Script.GAME_SETTINGS.coinTriggerLength);
        let positions = createDistributedSpawnPoints(Script.GAME_SETTINGS.coinGroupCount, coinGroupRadius);
        for (let position of positions) {
            let coinX = position.x - Script.GAME_SETTINGS.coinGroupSpacing;
            let coinY = getSlopeSurfaceY(coinX) + Script.GAME_SETTINGS.coinSurfaceOffset;
            let coinZ = position.z;
            let coin1 = new Script.CoinNode(new fc.Vector3(coinX, coinY, coinZ));
            let coin2X = coinX + Script.GAME_SETTINGS.coinGroupSpacing;
            let coin3X = coin2X + Script.GAME_SETTINGS.coinGroupSpacing;
            let coin2 = new Script.CoinNode(new fc.Vector3(coin2X, getSlopeSurfaceY(coin2X) + Script.GAME_SETTINGS.coinSurfaceOffset, coinZ));
            let coin3 = new Script.CoinNode(new fc.Vector3(coin3X, getSlopeSurfaceY(coin3X) + Script.GAME_SETTINGS.coinSurfaceOffset, coinZ));
            Script.viewport.getBranch().addChild(coin1);
            Script.viewport.getBranch().addChild(coin2);
            Script.viewport.getBranch().addChild(coin3);
        }
    }
    function createFences() {
        let positions = createDistributedSpawnPoints(Script.GAME_SETTINGS.fenceCount, Script.GAME_SETTINGS.fenceSpawnRadius);
        for (let position of positions) {
            // The fence origin is raised by its measured leg height, so every fence
            // stands on the precisely calculated slope surface instead of sinking into it.
            let fenceY = getSlopeSurfaceY(position.x) + Script.GAME_SETTINGS.fenceBaseHeight;
            let fence = new Script.FenceNode(new fc.Vector3(position.x, fenceY, position.z));
            Script.viewport.getBranch().addChild(fence);
        }
    }
    function configureCourse(_branch) {
        if (Script.GAME_SETTINGS.courseStyle == "glacier") {
            Script.createHardCourse(_branch);
            return;
        }
        if (Script.GAME_SETTINGS.courseStyle != "curved")
            return;
        let originalSlope = _branch.getChildrenByName("Slope")[0];
        if (originalSlope)
            originalSlope.activate(false);
        let normalCourse = new fc.Node("NormalCourse");
        let snowMaterial = fc.Project.resources["Material|2023-01-10T16:08:39.923Z|66013"];
        let segmentCount = Math.ceil((Script.GAME_SETTINGS.normalTerrainEndX - Script.GAME_SETTINGS.normalTerrainStartX) / Script.GAME_SETTINGS.normalSegmentLength);
        for (let index = 0; index < segmentCount; index++) {
            let startX = Script.GAME_SETTINGS.normalTerrainStartX + index * Script.GAME_SETTINGS.normalSegmentLength;
            let endX = Math.min(startX + Script.GAME_SETTINGS.normalSegmentLength, Script.GAME_SETTINGS.normalTerrainEndX);
            let centerX = (startX + endX) / 2;
            let segment = new fc.Node(`NormalTerrain${index}`);
            let mesh = new fc.ComponentMesh(new fc.MeshCube(`NormalTerrainMesh${index}`));
            let material = new fc.ComponentMaterial(snowMaterial);
            let transform = new fc.ComponentTransform();
            let rigidbody = new fc.ComponentRigidbody();
            let yaw = Math.atan(getCourseCenterZSlope(centerX)) * 180 / Math.PI;
            mesh.mtxPivot.scaling = new fc.Vector3(endX - startX + 2, 40, Script.GAME_SETTINGS.normalCourseHalfWidth * 2);
            // getSlopeSurfaceY describes the top of the snow. Cube transforms are
            // positioned at their centre, so lower the segment by its half-height.
            // Previously using the surface height as the centre put the avatar
            // inside the Normal terrain on the first physics frame.
            let terrainCenterY = getSlopeSurfaceY(centerX) -
                Math.cos(Script.GAME_SETTINGS.slopeAngleDegrees * Math.PI / 180) * Script.GAME_SETTINGS.slopeHalfHeight;
            transform.mtxLocal.translation = new fc.Vector3(centerX, terrainCenterY, getCourseCenterZ(centerX));
            transform.mtxLocal.rotation = new fc.Vector3(0, yaw, Script.GAME_SETTINGS.slopeAngleDegrees);
            rigidbody.typeBody = fc.BODY_TYPE.STATIC;
            rigidbody.effectGravity = 0;
            rigidbody.mtxPivot.scaling = new fc.Vector3(endX - startX + 2, 40, Script.GAME_SETTINGS.normalCourseHalfWidth * 2);
            segment.addComponent(mesh);
            segment.addComponent(material);
            segment.addComponent(transform);
            segment.addComponent(rigidbody);
            normalCourse.addChild(segment);
        }
        _branch.addChild(normalCourse);
    }
    function createDistributedSpawnPoints(_amount, _radius, _startMargin = Script.GAME_SETTINGS.spawnStartMargin, _endMargin = Script.GAME_SETTINGS.spawnEndMargin) {
        let firstX = Script.GAME_SETTINGS.courseStartX + _startMargin;
        let lastX = Script.GAME_SETTINGS.courseEndX - _endMargin;
        let segmentWidth = (lastX - firstX) / _amount;
        let positions = [];
        for (let i = 0; i < _amount; i++) {
            let point;
            for (let attempt = 0; attempt < Script.GAME_SETTINGS.spawnPlacementAttempts; attempt++) {
                let x = attempt < Script.GAME_SETTINGS.spawnPlacementAttempts / 2
                    ? firstX + (i + fc.random.getRange(0.08, 0.92)) * segmentWidth
                    : fc.random.getRange(firstX, lastX);
                let z = getSpawnLane(x);
                if (isSpawnClear(x, z, _radius)) {
                    point = { x, z };
                    occupiedSpawns.push({ x, z, radius: _radius });
                    break;
                }
            }
            if (point)
                positions.push(point);
            else
                fc.Debug.warn(`Skipped a spawn after ${Script.GAME_SETTINGS.spawnPlacementAttempts} overlap checks.`);
        }
        return positions;
    }
    function isSpawnClear(_x, _z, _radius) {
        return occupiedSpawns.every((_occupied) => {
            let minimumDistance = _radius + _occupied.radius;
            let xDistance = _x - _occupied.x;
            let zDistance = _z - _occupied.z;
            return xDistance * xDistance + zDistance * zDistance >= minimumDistance * minimumDistance;
        });
    }
    function getSlopeSurfaceY(_x) {
        let slopeAngleRadians = Script.GAME_SETTINGS.slopeAngleDegrees * Math.PI / 180;
        return Math.tan(slopeAngleRadians) * _x + Script.GAME_SETTINGS.slopeHalfHeight / Math.cos(slopeAngleRadians);
    }
    Script.getSlopeSurfaceY = getSlopeSurfaceY;
    function getCourseCenterZ(_x) {
        if (Script.GAME_SETTINGS.courseStyle == "glacier")
            return Script.hardCourseCenterZ(_x);
        if (Script.GAME_SETTINGS.courseStyle != "curved")
            return 0;
        let progress = (_x - Script.GAME_SETTINGS.normalTerrainStartX) /
            (Script.GAME_SETTINGS.normalTerrainEndX - Script.GAME_SETTINGS.normalTerrainStartX);
        return Math.sin(progress * Math.PI * 2) * Script.GAME_SETTINGS.normalCurveAmplitude;
    }
    Script.getCourseCenterZ = getCourseCenterZ;
    function isWithinCourse(_position) {
        if (Script.GAME_SETTINGS.courseStyle == "glacier") {
            return _position.x >= Script.HARD_COURSE_START && _position.x <= Script.HARD_COURSE_END &&
                Math.abs(_position.z - Script.hardCourseCenterZ(_position.x)) <= Script.hardCourseHalfWidth(_position.x) &&
                _position.y >= getSlopeSurfaceY(_position.x) - 2;
        }
        if (Script.GAME_SETTINGS.courseStyle != "curved")
            return true;
        return _position.x >= Script.GAME_SETTINGS.normalTerrainStartX &&
            _position.x <= Script.GAME_SETTINGS.normalTerrainEndX &&
            Math.abs(_position.z - getCourseCenterZ(_position.x)) <= Script.GAME_SETTINGS.normalCourseHalfWidth;
    }
    Script.isWithinCourse = isWithinCourse;
    function createSnowboarders() {
        let positions = [-220, 60, 300];
        positions.forEach((_x, _index) => {
            let z = getCourseCenterZ(_x);
            occupiedSpawns.push({ x: _x, z, radius: 4 });
            Script.viewport.getBranch().addChild(new Script.SnowboarderNode(new fc.Vector3(_x, getSlopeSurfaceY(_x) + 0.35, z), _index * Math.PI * 2 / positions.length, Script.GAME_SETTINGS.normalCourseHalfWidth - 3));
        });
    }
    function hasFallenFarEnough(_position) {
        return _position.y <= getSlopeSurfaceY(_position.x) - Script.GAME_SETTINGS.fallDepth;
    }
    Script.hasFallenFarEnough = hasFallenFarEnough;
    function getCourseCenterZSlope(_x) {
        let courseLength = Script.GAME_SETTINGS.normalTerrainEndX - Script.GAME_SETTINGS.normalTerrainStartX;
        return Math.cos((_x - Script.GAME_SETTINGS.normalTerrainStartX) / courseLength * Math.PI * 2) *
            Script.GAME_SETTINGS.normalCurveAmplitude * Math.PI * 2 / courseLength;
    }
    function getSpawnLane(_x) {
        return getCourseCenterZ(_x) + fc.random.getRange(Script.GAME_SETTINGS.spawnLaneMinZ, Script.GAME_SETTINGS.spawnLaneMaxZ);
    }
    function recordSessionResult(_result) {
        let results = [];
        const storageKey = `${SESSION_RESULTS_KEY}-${selectedLevel}`;
        try {
            let storedResults = window.sessionStorage.getItem(storageKey);
            if (storedResults)
                results = JSON.parse(storedResults);
        }
        catch (_error) {
            // Session storage may be unavailable in a restrictive browser context.
            results = [];
        }
        results.push(_result);
        results.sort((_first, _second) => {
            return _first.timeMs - _second.timeMs || _second.coins - _first.coins;
        });
        results = results.slice(0, 5);
        try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(results));
        }
        catch (_error) {
            // The current result remains visible even if it cannot be persisted.
        }
        return results;
    }
    function update(_event) {
        fc.Physics.simulate(); // if physics is included and used
        let avatarBody = Script.avatar.getComponent(fc.ComponentRigidbody);
        let velocity = avatarBody.getVelocity();
        let maximumBoostedSpeed = Script.GAME_SETTINGS.maximumBoostedSpeed + Script.currentCoins * Script.GAME_SETTINGS.coinMaximumSpeedBonus;
        if (!Script.gateSpeedUncapped && velocity.x > maximumBoostedSpeed)
            avatarBody.setVelocity(new fc.Vector3(maximumBoostedSpeed, velocity.y, velocity.z));
        Script.viewport.draw();
        fc.AudioManager.default.update();
        if (!gameFinished)
            Script.currentTime = fc.Time.game.get() - timeSinceStart;
        Script.vui.updateRaceStats(Script.currentTime, Script.currentCoins);
    }
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    class RingComponentScript extends fc.ComponentScript {
        // Register the script as component for use in the editor via drag&drop
        static iSubclass = fc.Component.registerSubclass(RingComponentScript);
        // Properties may be mutated by users in the editor via the automatically created user interface
        message = "RingComponentScript added to ";
        boostSound;
        boostCylinder;
        hasBoosted = false;
        constructor() {
            super();
            // Don't start when running in editor
            if (fc.Project.mode == fc.MODE.EDITOR)
                return;
            // Listen to this component being added to or removed from a node
            this.addEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
            this.addEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
            this.addEventListener("nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */, this.hndEvent);
        }
        // Activate the functions of this component as response to events
        hndEvent = (_event) => {
            switch (_event.type) {
                case "componentAdd" /* fc.EVENT.COMPONENT_ADD */:
                    //fc.Debug.log(this.message, this.node);
                    this.boostCylinder = this.node.getComponent(fc.ComponentRigidbody);
                    this.boostCylinder.addEventListener("TriggerEnteredCollision" /* fc.EVENT_PHYSICS.TRIGGER_ENTER */, this.receiveBoost);
                    this.boostSound = new fc.Audio(".\\Sounds\\boost.mp3");
                    fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.checkProximity);
                    break;
                case "componentRemove" /* fc.EVENT.COMPONENT_REMOVE */:
                    this.removeEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
                    this.removeEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
                    fc.Loop.removeEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.checkProximity);
                    break;
                case "nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */:
                    break;
                case "nodeActivate" /* fc.EVENT.NODE_ACTIVATE */:
                    break;
            }
        };
        receiveBoost = (_event) => {
            if (this.hasBoosted || _event.cmpRigidbody.node != Script.avatar)
                return;
            this.applyBoost();
        };
        checkProximity = (_event) => {
            if (this.hasBoosted || !Script.avatar)
                return;
            let avatarPosition = Script.avatar.getComponent(fc.ComponentRigidbody).getPosition();
            let portalPosition = this.boostCylinder.getPosition();
            let isInsidePortal = Math.abs(avatarPosition.x - portalPosition.x) <= Script.GAME_SETTINGS.portalTriggerLength + Script.GAME_SETTINGS.avatarGroundOffset &&
                Math.abs(avatarPosition.y - portalPosition.y) <= Script.GAME_SETTINGS.portalTriggerHeight &&
                Math.abs(avatarPosition.z - portalPosition.z) <= Script.GAME_SETTINGS.portalTriggerWidth;
            if (isInsidePortal)
                this.applyBoost();
        };
        applyBoost() {
            if (this.hasBoosted)
                return;
            this.hasBoosted = true;
            Script.gateSpeedUncapped = true;
            let componentAudio = this.node.getComponent(fc.ComponentAudio);
            componentAudio.setAudio(this.boostSound);
            componentAudio.volume = 2;
            componentAudio.play(true);
            Script.avatar.getComponent(fc.ComponentRigidbody).addVelocity(new fc.Vector3(Script.GAME_SETTINGS.boostSpeedBonus, 0, 0));
        }
    }
    Script.RingComponentScript = RingComponentScript;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    class RingNode extends fc.Node {
        constructor(_cords) {
            super("Ring");
            let innerRing = new fc.Node("boostCylinder");
            let outerRingTorus = new fc.MeshTorus("outerRingM", 0.08, 15, 10);
            let innerRingTorus = new fc.MeshTorus("innerRingM", 0.05, 15, 10);
            let outerRingMesh = new fc.ComponentMesh(outerRingTorus);
            let innerRingMesh = new fc.ComponentMesh(innerRingTorus);
            outerRingMesh.mtxPivot.scaling = new fc.Vector3(10, 10, 7);
            innerRingMesh.mtxPivot.scaling = new fc.Vector3(9, 9, 6);
            let outerMat = new fc.Material("ringMaterialOut", fc.ShaderGouraud);
            let innerMat = new fc.Material("ringMaterialIn", fc.ShaderLit);
            let outerMatComp = new fc.ComponentMaterial(outerMat);
            let innerMatComp = new fc.ComponentMaterial(innerMat);
            outerMatComp.clrPrimary = new fc.Color(0.31, 0.41, 0.6);
            innerMatComp.clrPrimary = new fc.Color(0.97, 0.86, 0.21);
            let outerRingTransform = new fc.ComponentTransform();
            outerRingTransform.mtxLocal.translation = _cords;
            outerRingTransform.mtxLocal.rotateZ(85);
            let outerRingRigidBody = new fc.ComponentRigidbody();
            outerRingRigidBody.typeBody = fc.BODY_TYPE.STATIC;
            outerRingRigidBody.isTrigger = true;
            outerRingRigidBody.effectGravity = 0;
            outerRingRigidBody.mtxPivot.translateX(1);
            // The node rotation puts local Y along the downhill X axis.
            outerRingRigidBody.mtxPivot.scaling = new fc.Vector3(Script.GAME_SETTINGS.portalTriggerHeight, Script.GAME_SETTINGS.portalTriggerLength, Script.GAME_SETTINGS.portalTriggerWidth);
            let ringAudio = new fc.ComponentAudio();
            let ringScript = new Script.RingComponentScript();
            this.addComponent(outerRingMesh);
            this.addComponent(outerMatComp);
            this.addComponent(outerRingTransform);
            this.addComponent(outerRingRigidBody);
            this.addComponent(ringAudio);
            this.addComponent(ringScript);
            innerRing.addComponent(innerRingMesh);
            innerRing.addComponent(innerMatComp);
            this.addChild(innerRing);
        }
    }
    Script.RingNode = RingNode;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    class SlopeComponentScript extends fc.ComponentScript {
        // Register the script as component for use in the editor via drag&drop
        static iSubclass = fc.Component.registerSubclass(SlopeComponentScript);
        // Properties may be mutated by users in the editor via the automatically created user interface
        message = "SlopeComponentScript added to ";
        deathPlane;
        colliderPlane;
        constructor() {
            super();
            // Don't start when running in editor
            if (fc.Project.mode == fc.MODE.EDITOR)
                return;
            // Listen to this component being added to or removed from a node
            this.addEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
            this.addEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
            this.addEventListener("nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */, this.hndEvent);
        }
        // Activate the functions of this component as response to events
        hndEvent = (_event) => {
            switch (_event.type) {
                case "componentAdd" /* fc.EVENT.COMPONENT_ADD */:
                    fc.Debug.log(this.message, this.node);
                    break;
                case "componentRemove" /* fc.EVENT.COMPONENT_REMOVE */:
                    this.removeEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
                    this.removeEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
                    break;
                case "nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */:
                    this.deathPlane = this.node.getChildrenByName("Deathplane")[0].getComponent(fc.ComponentRigidbody);
                    this.colliderPlane = this.node.getChildrenByName("Colliderplane")[0].getComponent(fc.ComponentRigidbody);
                    this.deathPlane.addEventListener("TriggerEnteredCollision" /* fc.EVENT_PHYSICS.TRIGGER_ENTER */, this.playerRespawn);
                    this.colliderPlane.addEventListener("TriggerEnteredCollision" /* fc.EVENT_PHYSICS.TRIGGER_ENTER */, this.onSlope);
                    break;
            }
        };
        onSlope = (_event) => {
            if (_event.cmpRigidbody.node == Script.avatar && Script.currentTime / 1000 > 1) {
                Script.isAirborne = false;
            }
        };
        playerRespawn = (_event) => {
            if (_event.cmpRigidbody.node == Script.avatar && Script.currentTime / 1000 > 2 && Script.hasFallenFarEnough(_event.cmpRigidbody.getPosition())) {
                this.node.dispatchEvent(new CustomEvent("fall", { bubbles: true }));
            }
        };
    }
    Script.SlopeComponentScript = SlopeComponentScript;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    class SnowboarderNode extends fc.Node {
        static cube = new fc.MeshCube("SnowboarderCube");
        static sphere = new fc.MeshSphere("SnowboarderSphere", 8, 6);
        static snow = new fc.Material("SnowboarderSnow", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.93, 0.98, 1, 1)));
        static coal = new fc.Material("SnowboarderCoal", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.04, 0.07, 0.09, 1)));
        static wood = new fc.Material("SnowboarderWood", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.35, 0.17, 0.07, 1)));
        static orange = new fc.Material("SnowboarderNose", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(1, 0.35, 0.04, 1)));
        static board = new fc.Material("SnowboarderBoard", fc.ShaderLit, new fc.CoatRemissive(new fc.Color(0.12, 0.7, 0.92, 1)));
        startX;
        centerZ;
        phase;
        range;
        constructor(_position, _phase, _range) {
            super("Snowboarder");
            this.startX = _position.x;
            this.centerZ = _position.z;
            this.phase = _phase;
            this.range = _range;
            let transform = new fc.ComponentTransform();
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
            let body = new fc.ComponentRigidbody();
            body.typeBody = fc.BODY_TYPE.KINEMATIC;
            body.isTrigger = true;
            body.effectGravity = 0;
            body.mtxPivot.translation = new fc.Vector3(0, 1.8, 0);
            body.mtxPivot.scaling = new fc.Vector3(2.1, 3.8, 1.8);
            this.addComponent(body);
            fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.update);
        }
        addPart(_name, _mesh, _material, _position, _scale) {
            let part = new fc.Node(_name);
            let transform = new fc.ComponentTransform();
            transform.mtxLocal.translation = _position;
            let mesh = new fc.ComponentMesh(_mesh);
            mesh.mtxPivot.scaling = _scale;
            part.addComponent(transform);
            part.addComponent(mesh);
            part.addComponent(new fc.ComponentMaterial(_material));
            this.addChild(part);
        }
        update = (_event) => {
            let seconds = fc.Time.game.get() / 1000;
            let sweep = Math.sin(seconds * 1.15 + this.phase);
            this.mtxLocal.translation = new fc.Vector3(this.startX, Script.getSlopeSurfaceY(this.startX) + 0.35 + Math.abs(Math.cos(seconds * 2.3 + this.phase)) * 0.08, this.centerZ + sweep * this.range);
        };
    }
    Script.SnowboarderNode = SnowboarderNode;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    class TreeNode extends fc.Node {
        constructor(_cords) {
            super("Tree");
            let leaves = new fc.Node("leaves");
            let trunkRot = new fc.MeshRotation("trunk", [new fc.Vector2(0.3, 0.5), new fc.Vector2(0.4, -1)], 12);
            let leavesPyramid = new fc.MeshPyramid("leaves");
            let trunkMesh = new fc.ComponentMesh(trunkRot);
            let leavesMesh = new fc.ComponentMesh(leavesPyramid);
            trunkMesh.mtxPivot.rotation = new fc.Vector3(180, 0, 90);
            leavesMesh.mtxPivot.scaling = new fc.Vector3(2, 4, 2);
            leavesMesh.mtxPivot.rotation = new fc.Vector3(180, fc.random.getRange(0, 90), 90);
            let trunkMat = new fc.Material("trunkMat", fc.ShaderLit);
            let leavesMat = new fc.Material("leavesMat", fc.ShaderLit);
            let trunkMatComp = new fc.ComponentMaterial(trunkMat);
            let leavesMatComp = new fc.ComponentMaterial(leavesMat);
            trunkMatComp.clrPrimary = new fc.Color(0.58, 0.30, 0);
            leavesMatComp.clrPrimary = new fc.Color(0, 0.4, 0);
            let trunkTransform = new fc.ComponentTransform();
            let leavesTransform = new fc.ComponentTransform();
            trunkTransform.mtxLocal.translation = _cords;
            trunkTransform.mtxLocal.rotateZ(85);
            leavesTransform.mtxLocal.translateX(0.5);
            let trunkRigidBody = new fc.ComponentRigidbody();
            let leavesRigidBody = new fc.ComponentRigidbody();
            trunkRigidBody.typeBody = fc.BODY_TYPE.STATIC;
            trunkRigidBody.effectGravity = 0;
            trunkRigidBody.mtxPivot.scaling = new fc.Vector3(0.9, 1, 1);
            // The visible tree is rotated to stand on the slope. Keep its
            // physics boxes vertical so their faces cannot be climbed.
            trunkRigidBody.mtxPivot.rotateZ(-85);
            leavesRigidBody.typeBody = fc.BODY_TYPE.STATIC;
            leavesRigidBody.effectGravity = 0;
            leavesRigidBody.mtxPivot.translateX(1);
            leavesRigidBody.mtxPivot.scaling = new fc.Vector3(2.5, 4, 1);
            leavesRigidBody.mtxPivot.rotateZ(-85);
            this.addComponent(trunkMesh);
            this.addComponent(trunkMatComp);
            this.addComponent(trunkTransform);
            this.addComponent(trunkRigidBody);
            leaves.addComponent(leavesMesh);
            leaves.addComponent(leavesMatComp);
            leaves.addComponent(leavesTransform);
            leaves.addComponent(leavesRigidBody);
            this.addChild(leaves);
        }
    }
    Script.TreeNode = TreeNode;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    class VUI extends fc.Mutable {
        timeDisplay;
        coinsDisplay;
        speedDisplay;
        finishSummary;
        resultTime;
        resultCoins;
        resultScore;
        leaderboard;
        pauseOverlay;
        finishKicker;
        finishTitle;
        resultGrid;
        leaderboardWrap;
        jumpKey;
        resultTimeStat;
        resultCoinsStat;
        resultScoreStat;
        text;
        soundMuted = false;
        constructor() {
            super();
            this.text = window.SLOPEDOWN_TEXT;
            this.timeDisplay = this.getElement("hud-time");
            this.coinsDisplay = this.getElement("hud-coins");
            this.speedDisplay = this.getElement("hud-speed");
            this.finishSummary = this.getElement("finish-summary");
            this.resultTime = this.getElement("result-time");
            this.resultCoins = this.getElement("result-coins");
            this.resultScore = this.getElement("result-score");
            this.leaderboard = this.getElement("session-leaderboard");
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
        reduceMutator(_mutator) { }
        updateRaceStats(_timeMs, _coins) {
            this.timeDisplay.textContent = `${(_timeMs / 1000).toFixed(3)}s`;
            this.coinsDisplay.textContent = _coins.toString();
        }
        updateSpeed(_speed) {
            this.speedDisplay.textContent = Math.floor(_speed).toString();
        }
        updateInputViewer(_forward, _left, _brake, _right, _jump) {
            this.setKeyState("forward", _forward);
            this.setKeyState("left", _left);
            this.setKeyState("brake", _brake);
            this.setKeyState("right", _right);
            this.setKeyState("jump", _jump);
        }
        showFinish(_result, _topResults) {
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
            _topResults.forEach((_run) => {
                let item = document.createElement("li");
                item.classList.toggle("current-run", _run === _result);
                let runTime = document.createElement("span");
                let runCoins = document.createElement("span");
                runTime.textContent = `${(_run.timeMs / 1000).toFixed(3)}s`;
                runCoins.textContent = `${_run.coins} ${this.text.results.coinSuffix}`;
                item.append(runTime, runCoins);
                this.leaderboard.appendChild(item);
            });
            this.finishSummary.hidden = false;
            this.getElement("retry-button").focus();
        }
        showFailure(_timeMs, _coins) {
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
        setPaused(_isPaused) {
            this.pauseOverlay.hidden = !_isPaused;
        }
        setJumpCharge(_ratio) {
            let charge = Math.max(0, Math.min(1, _ratio));
            this.jumpKey.style.setProperty("--jump-fill", charge.toString());
        }
        setKeyState(_key, _isPressed) {
            this.getKey(_key).classList.toggle("is-pressed", _isPressed);
        }
        getKey(_key) {
            let key = document.querySelector(`[data-key="${_key}"]`);
            if (!key)
                throw new Error(`Missing Slopedown input key: ${_key}`);
            return key;
        }
        getElement(_id) {
            let element = document.getElementById(_id);
            if (!element)
                throw new Error(`Missing Slopedown UI element: ${_id}`);
            return element;
        }
        retry = () => {
            let level = window.slopedownSelectedLevel || "easy";
            window.location.href = `index.html?level=${encodeURIComponent(level)}&autostart=1`;
        };
        toggleSound = () => {
            this.soundMuted = !this.soundMuted;
            fc.AudioManager.default.volume = this.soundMuted ? 0 : 1;
            let button = this.getElement("sound-toggle");
            button.textContent = this.soundMuted ? this.text.results.soundOn : this.text.results.soundOff;
            button.setAttribute("aria-pressed", this.soundMuted.toString());
        };
    }
    Script.VUI = VUI;
})(Script || (Script = {}));
//# sourceMappingURL=Script.js.map