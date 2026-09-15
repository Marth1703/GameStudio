"use strict";
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    class CustomComponentScript extends fc.ComponentScript {
        // Register the script as component for use in the editor via drag&drop
        static iSubclass = fc.Component.registerSubclass(CustomComponentScript);
        // Properties may be mutated by users in the editor via the automatically created user interface
        message = "CustomComponentScript added to ";
        speed = 1;
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
                    fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.rotateShip);
                    break;
                case "componentRemove" /* fc.EVENT.COMPONENT_REMOVE */:
                    this.removeEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
                    this.removeEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
                    break;
                case "nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */:
                    // if deserialized the node is now fully reconstructed and access to all its components and children is possible
                    break;
            }
        };
        rotateShip = (_event) => {
            this.node.mtxLocal.rotateY(this.speed);
        };
    }
    Script.CustomComponentScript = CustomComponentScript;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    var fui = FudgeUserInterface;
    class GameState extends fc.Mutable {
        reduceMutator(_mutator) { }
        height;
        velocity;
        controller;
        constructor() {
            super();
            this.controller = new fui.Controller(this, document.querySelector("#vui"));
            console.log(this.controller);
        }
    }
    Script.GameState = GameState;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Debug.info("Main Program Template running!");
    let cmpCamera;
    let AnimatedCube;
    document.addEventListener("interactiveViewportStarted", start);
    function generateCubes(n) {
        let cubeMesh = new fc.MeshCube("cubeMesh");
        let material = new fc.Material("cubeShader", fc.ShaderLit);
        let randZ;
        let randY;
        let randX;
        let colorR;
        let colorG;
        let colorB;
        for (let i = 0; i < n; i++) {
            let nodeCube = new fc.Node("cube" + i);
            randX = fc.random.getRange(-1000, 1000);
            randY = fc.random.getRange(15, 30);
            randZ = fc.random.getRange(-1000, 1000);
            let componentMesh = new fc.ComponentMesh(cubeMesh);
            let componentMaterial = new fc.ComponentMaterial(material);
            let componentTransform = new fc.ComponentTransform();
            let componentRigidbody = new fc.ComponentRigidbody();
            colorR = fc.random.getRange(0, 1);
            colorG = fc.random.getRange(0, 1);
            colorB = fc.random.getRange(0, 1);
            componentMaterial.clrPrimary = new fc.Color(colorR, colorG, colorB, 1);
            componentTransform.mtxLocal.translation = new fc.Vector3(randX, randY, randZ);
            componentTransform.mtxLocal.scale(new fc.Vector3(5, 5, 5));
            componentRigidbody.effectGravity = 0;
            componentRigidbody.mass = 0.001;
            componentRigidbody.setScaling(new fc.Vector3(5, 5, 5));
            nodeCube.addComponent(componentMesh);
            nodeCube.addComponent(componentMaterial);
            nodeCube.addComponent(componentTransform);
            nodeCube.addComponent(componentRigidbody);
            Script.viewport.getBranch().addChild(nodeCube);
        }
    }
    function start(_event) {
        // let response: Response = await fetch("config.json");
        // let json = await response.json();
        Script.viewport = _event.detail;
        let branch = Script.viewport.getBranch();
        let floor = branch.getChildrenByName("Floor")[0];
        AnimatedCube = branch.getChildrenByName("AnimatedCube")[0];
        if (!floor || !AnimatedCube) {
            fc.Debug.error("Skyrush could not start: the Floor or AnimatedCube node is missing from the level.");
            return;
        }
        cmpCamera = Script.viewport.camera;
        Script.gameState = new Script.GameState();
        Script.cmpTerrain = floor.getComponent(fc.ComponentMesh);
        cmpCamera.mtxPivot.translate(new fc.Vector3(0, 4, -30));
        initAnim();
        generateCubes(50);
        fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, update);
        fc.Loop.start(); // start the game loop after every scene component is ready
    }
    function initAnim() {
        let animseqRot = new fc.AnimationSequence();
        animseqRot.addKey(new fc.AnimationKey(0, 0));
        animseqRot.addKey(new fc.AnimationKey(1500, 180));
        animseqRot.addKey(new fc.AnimationKey(3000, 360));
        let animseqTra = new fc.AnimationSequence();
        animseqTra.addKey(new fc.AnimationKey(0, 20));
        animseqTra.addKey(new fc.AnimationKey(1500, 50));
        animseqTra.addKey(new fc.AnimationKey(3000, 80));
        let animStructure = {
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
        let fps = 30;
        let animation = new fc.Animation("testAnimation", animStructure, fps);
        let cmpAnimator = new fc.ComponentAnimator(animation);
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
    function update(_event) {
        fc.Physics.simulate(); // if physics is included and used
        fc.AudioManager.default.update();
        Script.viewport.draw();
    }
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    fc.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    class StarShipScript extends fc.ComponentScript {
        // Register the script as component for use in the editor via drag&drop
        static iSubclass = fc.Component.registerSubclass(StarShipScript);
        // Properties may be mutated by users in the editor via the automatically created user interface
        message = "CustomComponentScript added to ";
        speed = 1;
        rigidbody;
        relativeX;
        relativeY;
        relativeZ;
        strafeThrust = 2000;
        forwardthrust = 200;
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
                    fc.Loop.removeEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.controlShip);
                    fc.Loop.removeEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.update);
                    break;
                case "nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */:
                    this.rigidbody = this.node.getComponent(fc.ComponentRigidbody);
                    if (!this.rigidbody) {
                        fc.Debug.error("Skyrush spaceship has no rigidbody component.");
                        return;
                    }
                    this.rigidbody.addEventListener("ColliderEnteredCollision" /* fc.EVENT_PHYSICS.COLLISION_ENTER */, this.hndCollision);
                    fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.controlShip);
                    fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.update);
                    break;
            }
        };
        update = (_event) => {
            if (!Script.cmpTerrain || !Script.gameState || !this.rigidbody) {
                return;
            }
            let terrainInfo = Script.cmpTerrain.mesh.getTerrainInfo(this.node.mtxLocal.translation, Script.cmpTerrain.mtxWorld);
            //console.log(terrainInfo.distance);
            if (terrainInfo.distance < 5) {
                //Collision
            }
            Script.gameState.height = "Height: " + Math.floor(terrainInfo.distance) + " m";
            Script.gameState.velocity = "Speed: " + Math.floor(this.rigidbody.getVelocity().x) + " mph";
        };
        controlShip = (_event) => {
            if (!this.rigidbody) {
                return;
            }
            this.setRelativeAxes();
            //this.thrust();
            if (fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.W])) {
                //this.thrust();
                this.rigidbody.applyTorque(fc.Vector3.SCALE(this.relativeX, 3));
            }
            if (fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.S])) {
                //this.backwards();
                this.rigidbody.applyTorque(fc.Vector3.SCALE(this.relativeX, -3));
            }
            if (fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.ARROW_LEFT])) {
                this.rollLeft();
            }
            if (fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.ARROW_RIGHT])) {
                this.rollRight();
            }
            if (fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.A])) {
                this.rigidbody.applyTorque(fc.Vector3.SCALE(this.relativeY, 3));
            }
            if (fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.D])) {
                this.rigidbody.applyTorque(fc.Vector3.SCALE(this.relativeY, -3));
            }
            if (fc.Keyboard.isPressedOne([fc.KEYBOARD_CODE.SHIFT_LEFT])) {
                this.thrustBoost();
                //StarShipRigidComponent.applyTorque(fc.Vector3.SCALE(this.relativeX, 1));
            }
            // StarShipRigidComponent.applyTorque(new fc.Vector3(0, this.xAxis * -6, 0));
            // StarShipRigidComponent.applyTorque(fc.Vector3.SCALE(this.relativeX, this.yAxis * 1.5));
            // StarShipRigidComponent.applyTorque(fc.Vector3.SCALE(this.relativeZ, this.xAxis))
        };
        hndCollision = (_event) => {
            let audioComp = this.node.getComponent(fc.ComponentAudio);
            if (audioComp) {
                audioComp.play(true);
            }
            console.log("Boom");
        };
        setRelativeAxes() {
            this.relativeZ = fc.Vector3.TRANSFORMATION(new fc.Vector3(0, 0, 5), fc.Matrix4x4.ROTATION(this.node.mtxWorld.rotation));
            this.relativeY = fc.Vector3.TRANSFORMATION(new fc.Vector3(0, 5, 0), fc.Matrix4x4.ROTATION(this.node.mtxWorld.rotation));
            this.relativeX = fc.Vector3.TRANSFORMATION(new fc.Vector3(5, 0, 0), fc.Matrix4x4.ROTATION(this.node.mtxWorld.rotation));
        }
        backwards() {
            this.rigidbody.applyForce(fc.Vector3.SCALE(this.relativeZ, -this.forwardthrust));
        }
        thrust() {
            let scaledRotatedDirection = fc.Vector3.SCALE(this.relativeZ, this.forwardthrust);
            this.rigidbody.applyForce(scaledRotatedDirection);
        }
        thrustBoost() {
            let scaledRotatedDirection = fc.Vector3.SCALE(this.relativeZ, this.forwardthrust * 10);
            this.rigidbody.applyForce(scaledRotatedDirection);
        }
        rollLeft() {
            this.rigidbody.applyTorque(fc.Vector3.SCALE(this.relativeZ, -2));
        }
        rollRight() {
            this.rigidbody.applyTorque(fc.Vector3.SCALE(this.relativeZ, 2));
        }
    }
    Script.StarShipScript = StarShipScript;
})(Script || (Script = {}));
var Script;
(function (Script) {
    var fc = FudgeCore;
    var fAid = FudgeAid;
    fc.Project.registerScriptNamespace(Script); // Register the namespace to FUDGE for serialization
    let JOB;
    (function (JOB) {
        JOB[JOB["IDLE"] = 0] = "IDLE";
        JOB[JOB["TARGET"] = 1] = "TARGET";
    })(JOB || (JOB = {}));
    class TurretStateMachine extends fAid.ComponentStateMachine {
        static iSubclass = fc.Component.registerSubclass(TurretStateMachine);
        static instructions = TurretStateMachine.get();
        torqueIdle = 5;
        cmpTurretSphere;
        constructor() {
            super();
            this.instructions = TurretStateMachine.instructions; // setup instructions with the static set
            // Don't start when running in editor
            if (fc.Project.mode == fc.MODE.EDITOR)
                return;
            // Listen to this component being added to or removed from a node
            this.addEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
            this.addEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
            this.addEventListener("nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */, this.hndEvent);
        }
        static get() {
            let setup = new fAid.StateMachineInstructions();
            setup.transitDefault = TurretStateMachine.transitDefault;
            setup.actDefault = TurretStateMachine.actDefault;
            setup.setAction(JOB.IDLE, this.actIdle);
            setup.setAction(JOB.TARGET, this.actTarget);
            setup.setTransition(JOB.IDLE, JOB.TARGET, this.transitOutOfRange);
            return setup;
        }
        static transitDefault(_machine) {
            console.log("Transit to", _machine.stateNext);
        }
        static async actDefault(_machine) {
            console.log(JOB[_machine.stateCurrent]);
        }
        static async actIdle(_machine) {
            if (!_machine.cmpTurretSphere) {
                return;
            }
            _machine.cmpTurretSphere.mtxLocal.rotateY(2);
            TurretStateMachine.actDefault(_machine);
        }
        static async actTarget(_machine) {
            console.log(JOB[_machine.stateCurrent]);
        }
        static transitOutOfRange(_machine) {
            _machine.transit(JOB.IDLE);
        }
        // Activate the functions of this component as response to events
        hndEvent = (_event) => {
            switch (_event.type) {
                case "componentAdd" /* fc.EVENT.COMPONENT_ADD */:
                    break;
                case "componentRemove" /* fc.EVENT.COMPONENT_REMOVE */:
                    this.removeEventListener("componentAdd" /* fc.EVENT.COMPONENT_ADD */, this.hndEvent);
                    this.removeEventListener("componentRemove" /* fc.EVENT.COMPONENT_REMOVE */, this.hndEvent);
                    fc.Loop.removeEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.update);
                    break;
                case "nodeDeserialized" /* fc.EVENT.NODE_DESERIALIZED */:
                    let turretSphere = this.node.getChildrenByName("Circle")[0];
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
                    fc.Loop.addEventListener("loopFrame" /* fc.EVENT.LOOP_FRAME */, this.update);
                    break;
            }
        };
        update = (_event) => {
            this.act();
        };
    }
    Script.TurretStateMachine = TurretStateMachine;
})(Script || (Script = {}));
//# sourceMappingURL=Script.js.map