declare namespace Script {
    import fc = FudgeCore;
    class AvatarComponentScript extends fc.ComponentScript {
        static readonly iSubclass: number;
        message: string;
        private rigidbody;
        private currentVelocity;
        private jumpHeight;
        private jumpActive;
        private obstacleContacts;
        constructor();
        hndEvent: (_event: Event) => void;
        private update;
        handleInputs: (_event: Event) => void;
        addJumpVelocity(): void;
        applyJumpVelocity(velo: number): void;
        moveRight(): void;
        moveLeft(): void;
        moveForward(): void;
        private isBlockedByObstacle;
        private isGrounded;
        private isObstacle;
        private handleCollisionEnter;
        private handleCollisionExit;
        private handleTriggerEnter;
        moveBrake(): void;
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class CoinComponentScript extends fc.ComponentScript {
        static readonly iSubclass: number;
        message: string;
        private coinSound;
        private coinBody;
        private collected;
        constructor();
        hndEvent: (_event: Event) => void;
        private collectCoin;
        private checkProximity;
        private collect;
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class CoinNode extends fc.Node {
        constructor(_cords: fc.Vector3);
    }
}
declare namespace Script {
    import ƒ = FudgeCore;
    class CustomComponentScript extends ƒ.ComponentScript {
        static readonly iSubclass: number;
        message: string;
        constructor();
        hndEvent: (_event: Event) => void;
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class FenceNode extends fc.Node {
        constructor(_cords: fc.Vector3);
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class FinishComponentScript extends fc.ComponentScript {
        static readonly iSubclass: number;
        message: string;
        private finishBody;
        private crossed;
        constructor();
        hndEvent: (_event: Event) => void;
        crossedLine: (_event: fc.EventPhysics) => void;
    }
}
declare namespace Script {
    /**
     * Default gameplay values. For normal balance testing, edit GameSettings.json
     * and refresh the game; no TypeScript rebuild is needed.
     */
    interface GameSettings {
        courseStyle: "straight" | "curved" | "glacier";
        slopeAngleDegrees: number;
        slopeHalfHeight: number;
        courseStartX: number;
        courseEndX: number;
        normalCurveAmplitude: number;
        normalCourseHalfWidth: number;
        normalTerrainStartX: number;
        normalTerrainEndX: number;
        normalSegmentLength: number;
        spawnStartMargin: number;
        spawnEndMargin: number;
        treeCount: number;
        fenceCount: number;
        portalCount: number;
        coinGroupCount: number;
        coinGroupSpacing: number;
        coinTriggerWidth: number;
        coinTriggerLength: number;
        coinPickupHeight: number;
        portalTriggerLength: number;
        portalTriggerWidth: number;
        portalTriggerHeight: number;
        treeSpawnRadius: number;
        fenceSpawnRadius: number;
        portalSpawnRadius: number;
        coinGroupSpawnRadius: number;
        spawnPlacementAttempts: number;
        spawnLaneMinZ: number;
        spawnLaneMaxZ: number;
        portalStartSafeDistance: number;
        treeSurfaceOffset: number;
        coinSurfaceOffset: number;
        portalSurfaceOffset: number;
        fenceBaseHeight: number;
        fenceCollisionDepth: number;
        physicsCollisionMargin: number;
        initialForwardSpeed: number;
        minimumForwardSpeed: number;
        maximumForwardSpeed: number;
        maximumBoostedSpeed: number;
        forwardForce: number;
        brakeForce: number;
        sidewaysForce: number;
        maximumSidewaysSpeed: number;
        jumpChargePerFrame: number;
        maximumJumpCharge: number;
        maximumJumpForce: number;
        maximumJumpVelocity: number;
        lockPlayerRotation: boolean;
        preventObstacleClimbing: boolean;
        avatarGroundOffset: number;
        fallDepth: number;
        boostSpeedBonus: number;
        coinMaximumSpeedBonus: number;
    }
    const GAME_SETTINGS: GameSettings;
    function loadGameSettings(_level: "easy" | "normal" | "hard"): Promise<void>;
}
declare namespace Script {
    import fc = FudgeCore;
    const HARD_COURSE_START: number;
    const HARD_COURSE_END: number;
    const HARD_FINISH_X: number;
    const HARD_GAP_START: number;
    const HARD_GAP_END: number;
    function isHardGap(_x: number): boolean;
    function hardCourseCenterZ(_x: number): number;
    function hardCourseHalfWidth(_x: number): number;
    function createHardCourse(_branch: fc.Node): void;
}
declare namespace Script {
    import fc = FudgeCore;
    let viewport: fc.Viewport;
    let vui: VUI;
    let currentTime: number;
    let isAirborne: boolean;
    let avatar: fc.Node;
    let currentCoins: number;
    let componentAudio: fc.ComponentAudio;
    let gateSpeedUncapped: boolean;
    function getSlopeSurfaceY(_x: number): number;
    function getCourseCenterZ(_x: number): number;
    function isWithinCourse(_position: fc.Vector3): boolean;
    function hasFallenFarEnough(_position: fc.Vector3): boolean;
}
declare namespace Script {
    import fc = FudgeCore;
    class RingComponentScript extends fc.ComponentScript {
        static readonly iSubclass: number;
        message: string;
        private boostSound;
        private boostCylinder;
        private hasBoosted;
        constructor();
        hndEvent: (_event: Event) => void;
        private receiveBoost;
        private checkProximity;
        private applyBoost;
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class RingNode extends fc.Node {
        constructor(_cords: fc.Vector3);
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class SlopeComponentScript extends fc.ComponentScript {
        static readonly iSubclass: number;
        message: string;
        private deathPlane;
        private colliderPlane;
        constructor();
        hndEvent: (_event: Event) => void;
        private onSlope;
        playerRespawn: (_event: fc.EventPhysics) => void;
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class SnowboarderNode extends fc.Node {
        private static cube;
        private static sphere;
        private static snow;
        private static coal;
        private static wood;
        private static orange;
        private static board;
        private startX;
        private centerZ;
        private phase;
        private range;
        constructor(_position: fc.Vector3, _phase: number, _range: number);
        private addPart;
        private update;
    }
}
declare namespace Script {
    import fc = FudgeCore;
    class TreeNode extends fc.Node {
        constructor(_cords: fc.Vector3);
    }
}
declare namespace Script {
    import fc = FudgeCore;
    interface SessionResult {
        timeMs: number;
        coins: number;
        score: number;
    }
    class VUI extends fc.Mutable {
        private timeDisplay;
        private coinsDisplay;
        private speedDisplay;
        private finishSummary;
        private resultTime;
        private resultCoins;
        private resultScore;
        private leaderboard;
        private pauseOverlay;
        private finishKicker;
        private finishTitle;
        private resultGrid;
        private leaderboardWrap;
        private jumpKey;
        private resultTimeStat;
        private resultCoinsStat;
        private resultScoreStat;
        private text;
        private soundMuted;
        constructor();
        protected reduceMutator(_mutator: fc.Mutator): void;
        updateRaceStats(_timeMs: number, _coins: number): void;
        updateSpeed(_speed: number): void;
        updateInputViewer(_forward: boolean, _left: boolean, _brake: boolean, _right: boolean, _jump: boolean): void;
        showFinish(_result: SessionResult, _topResults: SessionResult[]): void;
        showFailure(_timeMs: number, _coins: number): void;
        setPaused(_isPaused: boolean): void;
        setJumpCharge(_ratio: number): void;
        private setKeyState;
        private getKey;
        private getElement;
        private retry;
        private toggleSound;
    }
}
