// Everything Jaskinia's 3D windows use, from one copy of three.js (so instanceof checks hold across windows).
export * as THREE from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
export { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'; // for a place editor (Feniks Studio)
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
export * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
export { MeshBVH, StaticGeometryGenerator, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
