"""Cassandra combat block, scheme C.

How this file is meant to be read and edited
--------------------------------------------
1. Coordinates are the live frame's pixel grid. ``(x, y)`` is x to the right and
   y down from the top of a 64x64 canvas, so every number here can be checked by
   opening ``assets/frames/hero-cassandra.png`` in any pixel editor. The camera
   in ``scene_template.py`` is a front-facing ortho camera with ortho_scale 64
   centred on (32, 32), so at 64 one world unit is one pixel.
2. Parts are flat plates parallel to the picture plane, stacked in depth. Flat
   Workbench shading has no volume, so the only thing the third dimension buys
   is occlusion order. Keeping every plate parallel to the picture plane means
   a part's screen size is its authored size -- no cos(theta) squash.
3. Holes in the silhouette are gaps between parts, never a boolean cut. The
   waist gap is the space between the hair block and the torso block; the coat
   opening is the space between the left hem and the right hem.
4. Colours are sRGB hex in ``colors.json`` and are converted to linear before
   they reach the material. Blender's ``diffuse_color`` is linear; feeding sRGB
   straight in renders #3A1F24 as #836269.
"""

import json
import math
import os
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from scene_template import apply_scheme_c_settings

PALETTE = json.loads((ROOT / "colors.json").read_text(encoding="utf-8"))
COLORS = {key: value for key, value in PALETTE.items()
          if not key.startswith("_") and isinstance(value, str) and value.startswith("#")}

RESOLUTION = int(os.environ.get("SCHEME_C_RESOLUTION", "512"))
RES_DIR = {1024: "src1024", 512: "src", 128: "x128", 64: "x64"}[RESOLUTION]
OUT = Path(os.environ.get(
    "SCHEME_C_OUT",
    ROOT.parents[1] / "review" / "20261019-scheme-c" / RES_DIR,
))


def srgb_to_linear(channel):
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_linear(value):
    value = value.lstrip("#")
    return tuple(srgb_to_linear(int(value[i:i + 2], 16) / 255) for i in (0, 2, 4))


def make_material(name, hex_color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*hex_linear(hex_color), 1.0)
    mat.roughness = 1.0
    return mat


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def plate(name, points, depth, material, pivot=None):
    """A flat n-gon in the picture plane, extruded a little in depth.

    ``points`` are (x, y) pixel coordinates with y down. ``pivot`` moves the
    object origin so a pose can turn the part around a joint.
    """
    thickness = 0.4
    px, py = pivot if pivot else (0.0, 0.0)
    ox, oz = px, 64.0 - py
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    front = []
    back = []
    for x, y in points:
        wz = 64.0 - y
        front.append(bm.verts.new((x - ox, depth - thickness / 2, wz - oz)))
        back.append(bm.verts.new((x - ox, depth + thickness / 2, wz - oz)))
    bm.verts.ensure_lookup_table()
    count = len(points)
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(count):
        j = (i + 1) % count
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = (ox, 0.0, oz)
    obj.data.materials.append(material)
    return obj


# ------------------------------------------------------------------ the block
# Back to front. Every number was read off assets/frames/hero-cassandra.png.

# The hair is one shaded mass (right frame: #8A8074, 30 px) with a lit band over
# the crown (#C4B8A8, 29 px) and a one-pixel highlight on top (#D8D0C4). Drawing
# the whole head in the lit tone is what made the first block read as a hood.
HAIR_SHADE = [
    (26.0, 4.0), (29.0, 4.0), (29.8, 5.8), (33.5, 6.2), (37.2, 6.5),
    (37.4, 8.8), (35.0, 9.4), (32.8, 9.6), (31.4, 11.4), (30.6, 14.2),
    (29.8, 16.6), (27.0, 18.2), (26.8, 23.0), (26.2, 28.0), (25.6, 32.0),
    (24.8, 35.6), (23.4, 35.7), (23.0, 32.0), (22.8, 27.0), (22.8, 21.0),
    (22.9, 16.0), (23.0, 12.0), (23.6, 9.4), (24.4, 8.6), (24.0, 7.0),
    (24.9, 5.6),
]
HAIR_LIT = [
    (25.2, 5.6), (27.6, 5.2), (29.8, 6.0), (30.6, 8.8), (28.8, 9.6),
    (25.6, 9.4), (24.4, 8.6), (24.2, 6.8),
]
HAIR_HI = [
    (26.4, 5.0), (29.2, 4.9), (31.0, 6.0), (30.6, 6.9), (28.8, 6.2), (26.6, 6.2),
]
PART_LINE = [(27.3, 7.2), (28.2, 7.3), (28.0, 10.4), (27.1, 10.3)]

# Shoulder line slopes down-left; the left edge stops at y22 so the hair block
# and the torso block leave a two-pixel gap over the waist.
TORSO = [
    (23.0, 16.6), (26.0, 14.2), (31.0, 13.0), (34.2, 13.0), (36.0, 17.0),
    (37.0, 20.2), (36.0, 25.5), (34.6, 29.0), (33.0, 34.2), (27.0, 34.2),
    (27.0, 29.6), (29.0, 29.6), (29.0, 20.2), (23.0, 20.2),
]
# High collar with a neck slot: the U opens at the bottom so the jaw and the
# neck stay skin, which is what makes the head read as a head and not a hood.
COLLAR = [
    (28.4, 12.8), (36.6, 12.6), (36.8, 17.4), (34.8, 19.6), (34.6, 16.6),
    (31.6, 16.6), (31.4, 19.6), (29.2, 19.4), (28.0, 16.2),
]

# The coat opens between these two panels: the gap at x32..36, y35..48 is
# background, not a punched hole. Left hem is long and pointed, right hem is a
# narrow ribbon that stops at the knee.
SKIRT_LEFT = [
    (22.6, 34.6), (31.6, 34.4), (31.4, 38.0), (30.8, 42.0), (30.0, 45.5),
    (28.8, 48.5), (27.2, 51.2), (25.8, 53.4), (24.4, 52.4), (23.4, 50.0),
    (21.2, 48.0), (22.2, 44.0), (23.8, 41.0), (24.4, 38.0), (23.4, 36.0),
]
SKIRT_RIGHT = [
    (36.6, 22.4), (38.6, 22.0), (39.2, 27.0), (39.8, 32.0), (40.0, 37.0),
    (40.0, 42.0), (40.2, 46.6), (39.4, 49.0), (37.8, 47.6), (37.6, 42.0),
    (36.8, 36.0), (36.2, 30.0),
]
# Light comes from the right in the live frame, so the right half of the coat
# carries the mid tone. One flat dark slab is what made the body read wide.
TORSO_LIT = [
    (31.4, 13.2), (34.2, 13.0), (36.0, 17.0), (37.0, 20.2), (36.0, 25.5),
    (34.6, 29.0), (33.0, 34.2), (31.6, 32.6), (31.6, 22.0),
]
SKIRT_LIT = [
    (28.0, 34.5), (31.6, 34.4), (31.4, 38.0), (30.8, 42.0), (30.0, 45.5),
    (28.6, 48.5), (28.0, 44.0), (27.8, 39.0),
]

# 128-only details. One world unit is two pixels at 128 and one at 64, so a
# half-unit plate is a single 128 pixel and a sub-pixel at 64. These are the
# features a 64 grid has nowhere to put.
HAIR_STRAND_1 = [(24.6, 10.2), (25.2, 10.2), (25.0, 26.0), (24.4, 25.8)]
HAIR_STRAND_2 = [(26.2, 11.0), (26.8, 11.0), (26.7, 22.0), (26.1, 21.8)]
COAT_SEAM = [(30.2, 35.4), (30.8, 35.4), (30.6, 45.0), (30.0, 44.8)]

# Both boots bottom out on y = 60 so row 59 at 64 and row 119 at 128 both land
# on the same foot line.
BOOT_LEFT = [
    (22.9, 49.6), (27.0, 49.6), (26.0, 53.5), (25.6, 60.0), (23.6, 60.0),
    (23.4, 55.0), (23.0, 52.0),
]
BOOT_RIGHT = [
    (35.0, 49.0), (37.2, 49.0), (38.6, 55.0), (42.0, 60.0), (40.0, 60.0),
    (36.6, 55.0), (35.0, 52.0),
]

GUN = [(37.4, 29.2), (41.4, 29.2), (41.8, 31.0), (37.6, 31.0)]
GUN_GRIP = [(37.4, 30.8), (39.0, 30.8), (39.4, 34.4), (37.8, 34.6)]

# The head is tilted forward-left; a vertical oval reads as a mask instead.
FACE = [
    (35.2, 7.6), (37.0, 10.2), (36.3, 12.8), (34.8, 15.6), (32.6, 15.4),
    (31.0, 11.8), (31.2, 9.2),
]
NECK = [(32.4, 14.6), (34.4, 14.6), (34.2, 19.6), (32.6, 19.6)]
EYE_SHADOW = [(31.4, 9.4), (32.7, 9.6), (32.9, 11.9), (31.6, 12.0)]
EYE = [(33.3, 11.1), (34.4, 11.1), (34.4, 12.1), (33.3, 12.1)]

# Half-unit plates are a single pixel at 128 and sub-pixel at 64, where they
# come out as a dotted line. They only go into frames that have the room.
DETAIL_128 = {"hair_strand_1", "hair_strand_2", "coat_seam"}

# name -> (points, depth, colour key, pivot). Later entries sit closer to camera.
LAYERS = [
    ("hair_shade", HAIR_SHADE, 2.0, "hairShade", None),
    ("hair_lit", HAIR_LIT, 1.4, "hair", None),
    ("hair_hi", HAIR_HI, 1.2, "hairHi", None),
    ("part_line", PART_LINE, 1.1, "ink", None),
    ("torso", TORSO, 0.0, "coat", None),
    ("collar", COLLAR, 0.3, "coat", None),
    ("torso_lit", TORSO_LIT, -0.1, "coatLight", None),
    ("skirt_right", SKIRT_RIGHT, -0.4, "coat", (37.0, 23.0)),
    ("skirt_left", SKIRT_LEFT, -0.8, "coat", (23.0, 33.0)),
    ("skirt_lit", SKIRT_LIT, -0.9, "coatLight", (23.0, 33.0)),
    ("gun", GUN, -1.0, "metal", (39.0, 30.0)),
    ("gun_grip", GUN_GRIP, -1.2, "metal", (39.0, 30.0)),
    ("boot_left", BOOT_LEFT, -2.0, "ink", (25.0, 58.0)),
    ("boot_right", BOOT_RIGHT, -2.0, "ink", (37.0, 58.0)),
    ("hair_strand_1", HAIR_STRAND_1, 1.05, "hair", None),
    ("hair_strand_2", HAIR_STRAND_2, 1.03, "hairHi", None),
    ("coat_seam", COAT_SEAM, -0.82, "coatLight", None),
    ("neck", NECK, -3.2, "skin", None),
    ("face", FACE, -3.4, "skin", None),
    ("eye_shadow", EYE_SHADOW, -3.5, "coat", None),
    ("eye", EYE, -3.72, "ink", None),
]

# Only four things move: the two boots, the two hem panels and the gun. The
# amplitudes follow the live frames' bounding boxes -- contact widens the figure
# (walk-a 20..43 against idle 21..41), passing narrows it (walk-b 24..39).
# The hem turns around the waist; translating it instead tears a notch at the
# seam under the torso. Boots translate only: turning them tips a corner below
# the foot line and the ten frames stop sharing row 59.
POSES = {
    "hero-cassandra": {},
    # a: contact, the forward boot lands
    "hero-cassandra-walk-a": {"boot_right": (2.5, 0.0, 0.0), "boot_left": (-1.5, 0.0, 0.0),
                              "skirt_left": (0.0, 0.0, 7.0), "skirt_lit": (0.0, 0.0, 7.0),
                              "skirt_right": (0.0, 0.0, -4.0)},
    # e: down, weight settles
    "hero-cassandra-walk-e": {"boot_right": (1.5, 0.0, 0.0), "boot_left": (-1.0, 0.0, 0.0),
                              "skirt_left": (0.0, 0.0, 4.0), "skirt_lit": (0.0, 0.0, 4.0),
                              "skirt_right": (0.0, 0.0, -2.0)},
    # b: passing, the rear boot lifts 4px and the hem swings back
    "hero-cassandra-walk-b": {"boot_right": (-3.0, 0.0, 0.0), "boot_left": (1.0, -4.0, 0.0),
                              "skirt_left": (0.0, 0.0, -9.0), "skirt_lit": (0.0, 0.0, -9.0),
                              "skirt_right": (0.0, 0.0, 5.0), "gun": (-2.0, 0.0, 0.0),
                              "gun_grip": (-2.0, 0.0, 0.0)},
    # c: opposite contact
    "hero-cassandra-walk-c": {"boot_right": (2.0, 0.0, 0.0), "boot_left": (2.0, 0.0, 0.0),
                              "skirt_left": (0.0, 0.0, 8.0), "skirt_lit": (0.0, 0.0, 8.0),
                              "skirt_right": (0.0, 0.0, -5.0)},
    # f: down on the other side
    "hero-cassandra-walk-f": {"boot_right": (1.5, 0.0, 0.0), "boot_left": (2.5, 0.0, 0.0),
                              "skirt_left": (0.0, 0.0, 4.0), "skirt_lit": (0.0, 0.0, 4.0),
                              "skirt_right": (0.0, 0.0, -2.0)},
    # d: second passing, the front boot lifts this time
    "hero-cassandra-walk-d": {"boot_right": (-3.0, -4.0, 0.0), "boot_left": (1.0, 0.0, 0.0),
                              "skirt_left": (0.0, 0.0, -9.0), "skirt_lit": (0.0, 0.0, -9.0),
                              "skirt_right": (0.0, 0.0, 5.0), "gun": (-2.0, 0.0, 0.0),
                              "gun_grip": (-2.0, 0.0, 0.0)},
    # skills: the gun is the read, the coat swings out hard
    "hero-cassandra-skill-a": {"gun": (-3.0, -7.0, 0.0), "gun_grip": (-3.0, -7.0, 0.0),
                               "boot_right": (3.0, 0.0, 0.0), "boot_left": (-4.0, 0.0, 0.0),
                               "skirt_left": (0.0, 0.0, 13.0), "skirt_lit": (0.0, 0.0, 13.0),
                               "skirt_right": (0.0, 0.0, -7.0)},
    "hero-cassandra-skill-b": {"gun": (3.0, 4.0, 0.0), "gun_grip": (3.0, 4.0, 0.0),
                               "boot_right": (5.0, 0.0, 0.0), "boot_left": (3.0, 0.0, 0.0),
                               "skirt_left": (0.0, 0.0, 15.0), "skirt_lit": (0.0, 0.0, 15.0),
                               "skirt_right": (0.0, 0.0, -8.0)},
}


def build():
    clear_scene()
    scene = bpy.context.scene
    apply_scheme_c_settings(scene, RESOLUTION)
    materials = {key: make_material(key, COLORS[key]) for key in COLORS}
    parts = {}
    for name, points, depth, color, pivot in LAYERS:
        if name in DETAIL_128 and RESOLUTION < 128:
            continue
        obj = plate(name, points, depth, materials[color], pivot)
        parts[name] = {"object": obj, "home": obj.location.copy()}
    return parts


def apply_pose(parts, pose):
    """(dx, dy, turn): pixels to the right, pixels down, degrees around the pivot."""
    for name, part in parts.items():
        dx, dy, turn = pose.get(name, (0.0, 0.0, 0.0))
        home = part["home"]
        obj = part["object"]
        obj.location = Vector((home.x + dx, home.y, home.z - dy))
        obj.rotation_euler = (0.0, math.radians(turn), 0.0)


def main():
    only = os.environ.get("SCHEME_C_ONLY")
    parts = build()
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "cassandra-block.blend"))
    scene = bpy.context.scene
    for name, pose in POSES.items():
        if only and name != only:
            continue
        apply_pose(parts, pose)
        scene.render.filepath = str(OUT / name)
        bpy.ops.render.render(write_still=True)
    if not only or only == "hero-cassandra":
        idle = OUT / "hero-cassandra.png"
        if idle.exists():
            (OUT / "hero-cassandra-v.png").write_bytes(idle.read_bytes())


if __name__ == "__main__":
    main()
