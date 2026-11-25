// Vite supplies the deployment prefix; local development still uses '/'.
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`

export const OUTDOOR_ASSETS = {
  jacarandaTree: assetUrl('assets/models/vegetation/jacaranda_tree/jacaranda_tree_runtime.glb'),
  player: assetUrl('assets/models/characters/Zombie_Male.gltf'),
  rockFace: {
    color: assetUrl('assets/textures/terrain/rock_face_04/rock_face_04_diff_2k.jpg'),
    normal: assetUrl('assets/textures/terrain/rock_face_04/rock_face_04_nor_gl_2k.jpg'),
    roughness: assetUrl('assets/textures/terrain/rock_face_04/rock_face_04_arm_2k.jpg')
  },
  // Reserved for generated ground stones; not loaded by the terrain material.
  groundStone: {
    color: assetUrl('assets/textures/terrain/rock_face_03/rock_face_03_diff_2k.jpg'),
    normal: assetUrl('assets/textures/terrain/rock_face_03/rock_face_03_nor_gl_2k.jpg'),
    roughness: assetUrl('assets/textures/terrain/rock_face_03/rock_face_03_arm_2k.jpg')
  },
  cliff: {
    color: assetUrl('assets/textures/terrain/marble_cliff_05/marble_cliff_05_diff_2k.jpg'),
    normal: assetUrl('assets/textures/terrain/marble_cliff_05/marble_cliff_05_nor_gl_2k.jpg'),
    roughness: assetUrl('assets/textures/terrain/marble_cliff_05/marble_cliff_05_arm_2k.jpg')
  },
  foothill: {
    color: assetUrl('assets/textures/terrain/coast_land_rocks_01/coast_land_rocks_01_diff_2k.jpg'),
    normal: assetUrl('assets/textures/terrain/coast_land_rocks_01/coast_land_rocks_01_nor_gl_2k.jpg'),
    roughness: assetUrl('assets/textures/terrain/coast_land_rocks_01/coast_land_rocks_01_rough_2k.jpg')
  },
  bareRock: {
    color: assetUrl('assets/textures/terrain/rock_01/rock_01_diff_2k.jpg'),
    normal: assetUrl('assets/textures/terrain/rock_01/rock_01_nor_gl_2k.jpg'),
    roughness: assetUrl('assets/textures/terrain/rock_01/rock_01_rough_2k.jpg')
  },
  mountain: {
    color: assetUrl('assets/textures/terrain/aerial_rocks_02/aerial_rocks_02_diff_2k.jpg'),
    normal: assetUrl('assets/textures/terrain/aerial_rocks_02/aerial_rocks_02_nor_gl_2k.jpg'),
    roughness: assetUrl('assets/textures/terrain/aerial_rocks_02/aerial_rocks_02_rough_2k.jpg')
  },
  environment: assetUrl('assets/environments/kloofendal_43d_clear_puresky_2k.hdr'),
  grass: {
    color: assetUrl('assets/textures/terrain/grass_ground/grass_ground_diff_2k.jpg'),
    normal: assetUrl('assets/textures/terrain/grass_ground/grass_ground_nor_gl_2k.jpg'),
    roughness: assetUrl('assets/textures/terrain/grass_ground/grass_ground_arm_2k.jpg')
  },
  terrain: {
    color: assetUrl('assets/textures/terrain/rocky_terrain_02/rocky_terrain_02_diff_2k.jpg'),
    normal: assetUrl('assets/textures/terrain/rocky_terrain_02/rocky_terrain_02_nor_gl_2k.jpg'),
    roughness: assetUrl('assets/textures/terrain/rocky_terrain_02/rocky_terrain_02_arm_2k.jpg')
  }
}
