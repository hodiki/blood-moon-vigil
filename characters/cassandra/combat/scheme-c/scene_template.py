import math

import bpy

# Scheme C render contract. Do not change these when only the model changes.
# Workbench / Flat / Material / no shadow / no cavity / no outline / no AA /
# transparent film / Standard view transform / PNG RGBA 8 bit.
#
# The camera is a front-facing orthographic camera with ortho_scale = 64 centred
# on (32, 32) of a 64x64 pixel grid, so at 64 one world unit is one pixel and the
# model can be authored in the live sprite's pixel coordinates.
# The 3/4 read lives in the shapes, not in a rotated camera: rotating the camera
# on top of a shape that was already drawn as a 3/4 view squashes the authored
# width by cos(angle) -- that is why the first block came out 33% too wide.


def apply_scheme_c_settings(scene, resolution=512):
    if resolution not in (64, 128, 512, 1024):
        raise ValueError(resolution)
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "FLAT"
    shading.color_type = "MATERIAL"
    shading.show_shadows = False
    shading.show_cavity = False
    shading.show_object_outline = False
    scene.display.render_aa = "OFF"
    scene.render.film_transparent = True
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    cam_data = bpy.data.cameras.new("SchemeCCamera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 64.0
    cam_data.sensor_fit = "VERTICAL"
    cam = bpy.data.objects.new("SchemeCCamera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (32.0, -40.0, 32.0)
    cam.rotation_euler = (math.radians(90), 0.0, 0.0)
    scene.camera = cam
    return cam
