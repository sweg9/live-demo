// Where the 3D scan files are served. Kept apart from HomeMap3D so the 2D side can know them
// without loading three.js.
export const SHAPE_URL = '/scan/home-shape.glb'
// Dev server on the owner's computer only; empty in a build, so the Dashboard image never asks for it (C-05).
export const TEXTURED_URL = import.meta.env.DEV ? '/scan-local/home-textured.glb' : ''
