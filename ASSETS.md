# Local asset setup

Wildframe loads assets from `public/assets/`. The exact URLs are defined in [`src/scenes/outdoor/assets.js`](src/scenes/outdoor/assets.js); preserve their filenames and directory structure when copying downloaded assets into the project.

## Download the complete asset pack

Source code is kept in Git; binary assets are distributed as `wildframe-assets-v1.tar.gz` in the [v0.1.0 release](https://github.com/crapthings/wildframe/releases/tag/v0.1.0). The archive preserves `public/assets/` and includes these setup instructions and the asset credits. A separate `SHA256SUMS` file verifies the archive.

From a fresh clone's root directory, using GitHub CLI:

```sh
gh release download v0.1.0 --repo crapthings/wildframe --pattern 'wildframe-assets-v1.tar.gz' --pattern 'SHA256SUMS'
shasum -a 256 -c SHA256SUMS
tar -xzf wildframe-assets-v1.tar.gz public/assets
```

Only extract after checksum verification succeeds. Linux users can substitute `sha256sum -c SHA256SUMS` for `shasum`. Alternatively, download both files from the release page and use the same verification and extraction steps. Extraction restores the scene's expected paths; back up any locally modified assets before extracting over an existing asset directory.

This keeps the 208,307,808-byte tree binary out of ordinary Git history without depending on Git LFS. GitHub currently allows release files under 2 GiB and documents no total release-size or bandwidth limit. See [GitHub's release documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases). Git LFS remains an alternative, but has separate [storage and bandwidth allowances](https://docs.github.com/en/billing/concepts/product-billing/git-lfs).

See [the asset source and license record](THIRD_PARTY_ASSETS.md) for Poly Haven and Quaternius source pages and CC0 licenses.

## Environment

Place `kloofendal_43d_clear_puresky_2k.hdr` in `public/assets/environments/`. The scene uses this environment for lighting; the night background and stars are generated separately. `qwantani_night_2k.hdr` is not used by the current scene.

## Terrain and ground stones

Place each texture set in `public/assets/textures/terrain/<asset-name>/`:

| Asset name | Role | Required 2K JPEG maps |
| --- | --- | --- |
| `rocky_terrain_02` | Ground base | `diff`, `nor_gl`, `arm` |
| `grass_ground` | Ground blend | `diff`, `nor_gl`, `arm` |
| `aerial_rocks_02` | Mountain transition | `diff`, `nor_gl`, `rough` |
| `coast_land_rocks_01` | Foothill transition | `diff`, `nor_gl`, `rough` |
| `rock_01` | Exposed rock transition | `diff`, `nor_gl`, `rough` |
| `marble_cliff_05` | Occasional cliff patches | `diff`, `nor_gl`, `arm` |
| `rock_face_04` | Main steep cliff surface | `diff`, `nor_gl`, `arm` |
| `rock_face_03` | Generated ground stones | `diff`, `nor_gl`, `arm` |

For example, the ground base needs `rocky_terrain_02_diff_2k.jpg`, `rocky_terrain_02_nor_gl_2k.jpg`, and `rocky_terrain_02_arm_2k.jpg`. Use the OpenGL normal maps (`nor_gl`), not DirectX variants. These source asset names correspond to the Poly Haven assets used during development, licensed under CC0 as recorded in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md).

## Character

The current character URL is `public/assets/models/characters/Zombie_Male.gltf`. The development copy contains embedded data and provides `Idle`, `Walk`, and `Run` animations.

The model is from [Quaternius — Ultimate Animated Character Pack](https://quaternius.com/packs/ultimatedanimatedcharacter.html), licensed under CC0. The project owner confirmed this source; the original page and license are recorded in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md).

## Sample tree

Preserve the glTF download's relative file structure under `public/assets/models/vegetation/jacaranda_tree/`:

```text
jacaranda_tree_1k.gltf
jacaranda_tree.bin
textures/
```

The release asset pack contains the source tree. Vite generates a lighter `jacaranda_tree_runtime.glb` from its geometry and reuses the files in `textures/`. The browser loads the generated model after scene entry.

The tree, terrain sets, and environment were supplied as local development assets. Their ownership and licenses are separate from the Wildframe source code. No project-code license should be assumed to cover them.
