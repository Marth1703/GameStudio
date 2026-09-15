namespace Script {
  /**
   * Default gameplay values. For normal balance testing, edit GameSettings.json
   * and refresh the game; no TypeScript rebuild is needed.
   */
  export interface GameSettings {
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

  export const GAME_SETTINGS: GameSettings = {
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

  export async function loadGameSettings(_level: "easy" | "normal" | "hard"): Promise<void> {
    try {
      let response: Response = await fetch(`Levels/${_level}.json`, { cache: "no-store" });
      if (!response.ok)
        return;

      let overrides: Partial<GameSettings> = await response.json();
      Object.assign(GAME_SETTINGS, overrides);
    } catch (_error) {
      // Defaults above keep the game runnable if the optional JSON file cannot load.
    }
  }
}
