namespace Script {

    import fc = FudgeCore;

    export class TreeNode extends fc.Node {

        constructor(_cords: fc.Vector3) {
            super("Tree");
            let leaves: fc.Node = new fc.Node("leaves");

            let trunkRot: fc.MeshRotation = new fc.MeshRotation("trunk", [new fc.Vector2(0.3, 0.5), new fc.Vector2(0.4, -1)], 12);
            let leavesPyramid: fc.MeshPyramid = new fc.MeshPyramid("leaves");

            let trunkMesh: fc.ComponentMesh = new fc.ComponentMesh(trunkRot);
            let leavesMesh: fc.ComponentMesh = new fc.ComponentMesh(leavesPyramid);

            trunkMesh.mtxPivot.rotation = new fc.Vector3(180, 0, 90);
            leavesMesh.mtxPivot.scaling = new fc.Vector3(2, 4, 2);
            leavesMesh.mtxPivot.rotation = new fc.Vector3(180, fc.random.getRange(0, 90), 90);

            let trunkMat: fc.Material = new fc.Material("trunkMat", fc.ShaderLit);
            let leavesMat: fc.Material = new fc.Material("leavesMat", fc.ShaderLit);
            
            let trunkMatComp: fc.ComponentMaterial = new fc.ComponentMaterial(trunkMat);
            let leavesMatComp: fc.ComponentMaterial = new fc.ComponentMaterial(leavesMat);

            trunkMatComp.clrPrimary= new fc.Color(0.58, 0.30, 0);
            leavesMatComp.clrPrimary = new fc.Color(0, 0.4, 0);

            let trunkTransform: fc.ComponentTransform = new fc.ComponentTransform();
            let leavesTransform: fc.ComponentTransform = new fc.ComponentTransform();
            
            trunkTransform.mtxLocal.translation = _cords;
            trunkTransform.mtxLocal.rotateZ(85);

            leavesTransform.mtxLocal.translateX(0.5);

            let trunkRigidBody: fc.ComponentRigidbody = new fc.ComponentRigidbody();
            let leavesRigidBody: fc.ComponentRigidbody = new fc.ComponentRigidbody();

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
}
