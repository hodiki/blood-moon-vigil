import bpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from scene_template import apply_scheme_c_settings

scene = bpy.data.scenes[0]
apply_scheme_c_settings(scene)
shading = scene.display.shading
checks = [
    scene.render.engine == "BLENDER_WORKBENCH",
    shading.light == "FLAT",
    shading.color_type == "MATERIAL",
    shading.show_shadows is False,
    shading.show_cavity is False,
    shading.show_object_outline is False,
    scene.display.render_aa == "OFF",
    scene.render.film_transparent is True,
    scene.render.resolution_x == 512,
    scene.render.resolution_y == 512,
    scene.render.resolution_percentage == 100,
    scene.render.image_settings.file_format == "PNG",
    scene.render.image_settings.color_mode == "RGBA",
    scene.render.image_settings.color_depth == "8",
    scene.view_settings.view_transform == "Standard",
    scene.view_settings.exposure == 0.0,
    scene.view_settings.gamma == 1.0,
    scene.camera is not None,
    scene.camera.data.type == "ORTHO",
    scene.camera.name == "SchemeCCamera",
]
if not all(checks):
    sys.exit(1)
print("ok")
