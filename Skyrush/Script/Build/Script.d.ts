declare namespace Script {
    import fc = FudgeCore;
    class CustomComponentScript extends fc.ComponentScript {
        static readonly iSubclass: number;
        message: string;
        speed: number;
        constructor();
        hndEvent: (_event: Event) => void;
        rotateShip: (_event: Event) => void;
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class GameState extends fc.Mutable {
        protected reduceMutator(_mutator: fc.Mutator): void;
        height: string;
        velocity: string;
        private controller;
        constructor();
    }
}
declare namespace Script {
    import fc = FudgeCore;
    let gameState: GameState;
    let viewport: fc.Viewport;
    let cmpTerrain: fc.ComponentMesh;
}
declare namespace Script {
    import fc = FudgeCore;
    class StarShipScript extends fc.ComponentScript {
        static readonly iSubclass: number;
        message: string;
        speed: number;
        private rigidbody;
        private relativeX;
        private relativeY;
        private relativeZ;
        strafeThrust: number;
        forwardthrust: number;
        constructor();
        hndEvent: (_event: Event) => void;
        private update;
        controlShip: (_event: Event) => void;
        private hndCollision;
        setRelativeAxes(): void;
        backwards(): void;
        thrust(): void;
        thrustBoost(): void;
        rollLeft(): void;
        rollRight(): void;
    }
}
declare namespace Script {
    import fAid = FudgeAid;
    enum JOB {
        IDLE = 0,
        TARGET = 1
    }
    export class TurretStateMachine extends fAid.ComponentStateMachine<JOB> {
        static readonly iSubclass: number;
        private static instructions;
        torqueIdle: number;
        private cmpTurretSphere;
        constructor();
        static get(): fAid.StateMachineInstructions<JOB>;
        private static transitDefault;
        private static actDefault;
        private static actIdle;
        private static actTarget;
        private static transitOutOfRange;
        private hndEvent;
        private update;
    }
    export {};
}
