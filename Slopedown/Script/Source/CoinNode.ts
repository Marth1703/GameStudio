namespace Script {

    import fc = FudgeCore;

    export class CoinNode extends fc.Node {

        constructor(_cords: fc.Vector3) {
            super("Coin");

            let coinTorus: fc.MeshTorus = new fc.MeshTorus("Cointorus", -0.250, 7, 6);

            let coinMesh: fc.ComponentMesh = new fc.ComponentMesh(coinTorus);

            coinMesh.mtxPivot.scaling = new fc.Vector3(2, 1, 2);

            // This material is preloaded from Internal.json, just like the snow
            // and sky textures. Runtime-created TextureImage instances do not
            // reliably finish loading before FUDGE renders these spawned nodes.
            let coinMat: fc.Material = fc.Project.resources["Material|2026-09-07T18:10:00.000Z|33145"] as fc.Material;
            
            let coinMatComp: fc.ComponentMaterial = new fc.ComponentMaterial(coinMat);

            coinMatComp.mtxPivot.scaling = new fc.Vector2(1, 6);

            let coinTransform: fc.ComponentTransform = new fc.ComponentTransform();
            
            coinTransform.mtxLocal.translation = _cords;
            coinTransform.mtxLocal.rotateZ(85);

            let coinRigidBody: fc.ComponentRigidbody = new fc.ComponentRigidbody();
            coinRigidBody.isTrigger = true;
            coinRigidBody.effectGravity = 0;
            // A wider trigger prevents a fast player from stepping over the
            // final coin in a three-coin row between physics frames.
            // The coin node is rotated 85 degrees around Z: its local Y axis
            // therefore follows the downhill X direction of the slope.
            coinRigidBody.mtxPivot.scaling = new fc.Vector3(0.6, GAME_SETTINGS.coinTriggerLength, GAME_SETTINGS.coinTriggerWidth);
            coinRigidBody.typeBody = fc.BODY_TYPE.STATIC;

            let coinAudio: fc.ComponentAudio = new fc.ComponentAudio();
            let coinScript: CoinComponentScript = new CoinComponentScript();

            this.addComponent(coinMesh);
            this.addComponent(coinMatComp);
            this.addComponent(coinTransform);
            this.addComponent(coinRigidBody);
            this.addComponent(coinAudio);
            this.addComponent(coinScript);


            let animseqRot: fc.AnimationSequence = new fc.AnimationSequence();
            animseqRot.addKey(new fc.AnimationKey(0, 1));
            animseqRot.addKey(new fc.AnimationKey(750, 1.3));
            animseqRot.addKey(new fc.AnimationKey(1500, 1));
        
            let animStructure: fc.AnimationStructure = {
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
        
            let fps: number = 30;
        
            let animation: fc.Animation = new fc.Animation("testAnimation", animStructure, fps);
        
            let cmpAnimator: fc.ComponentAnimator = new fc.ComponentAnimator(animation);
            cmpAnimator.scale = 1;
        
            this.addComponent(cmpAnimator);
            cmpAnimator.activate(true);
        }

    }
}
