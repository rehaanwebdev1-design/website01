import bpy
import math
import os
from array import array
from mathutils import Matrix
from mathutils import Vector

# A centered, front-facing luxury-style watch model, built entirely from mesh geometry.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in bpy.data.materials:
    bpy.data.materials.remove(block)

def material(name, color, metallic=0.0, roughness=0.3):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat

steel = material('Brushed silver steel', (0.48, 0.52, 0.57), 0.88, 0.22)
bright_steel = material('Polished silver highlights', (0.82, 0.84, 0.87), 0.92, 0.14)
dark_steel = material('Recessed steel', (0.16, 0.19, 0.23), 0.8, 0.26)
blue = material('Midnight blue sunburst dial', (0.012, 0.075, 0.22), 0.62, 0.24)
hand_mat = material('Warm silver hands', (0.92, 0.83, 0.58), 0.8, 0.18)
white = material('Dial markers', (0.9, 0.88, 0.78), 0.48, 0.2)
black = material('Dial details', (0.012, 0.02, 0.035), 0.25, 0.24)

# Pack a subtle radial sunburst image into the dial material for a real surface texture.
dial_image = bpy.data.images.new('Blue dial sunburst texture', width=512, height=512, alpha=False)
pixels = array('f')
for py in range(512):
    v = (py + 0.5) / 512
    dy = (v - 0.5) * 2
    for px in range(512):
        u = (px + 0.5) / 512
        dx = (u - 0.5) * 2
        radius = min(math.sqrt(dx * dx + dy * dy), 1.0)
        angle = math.atan2(dy, dx)
        rays = math.sin(angle * 78 + radius * 20) * 0.025 + math.sin(angle * 143) * 0.009
        glow = (1 - radius) * 0.027
        pixels.extend((0.012 + glow + rays, 0.055 + glow * 1.6 + rays * 1.45, 0.15 + glow * 2 + rays * 2, 1.0))
dial_image.pixels.foreach_set(pixels)
dial_image.pack()
blue_bsdf = blue.node_tree.nodes.get('Principled BSDF')
dial_texture = blue.node_tree.nodes.new('ShaderNodeTexImage')
dial_texture.image = dial_image
dial_texture.interpolation = 'Linear'
blue.node_tree.links.new(dial_texture.outputs['Color'], blue_bsdf.inputs['Base Color'])

def assign(obj, mat):
    obj.data.materials.append(mat)
    return obj

def cylinder(name, radius, depth, location, mat, vertices=96, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation or (0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    bevel = obj.modifiers.new('Soft machined edges', 'BEVEL')
    bevel.width = min(depth * 0.2, 0.035)
    bevel.segments = 3
    obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return obj

def rounded_box(name, location, dimensions, mat, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    modifier = obj.modifiers.new('Rounded edges', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 3
    obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return obj

# Case, bezel, dial, and raised polished rim; dial faces +Z toward the camera.
cylinder('Watch case', 0.99, 0.34, (0, 0, 0), steel)
cylinder('Polished bezel', 0.95, 0.105, (0, 0, 0.205), bright_steel)
cylinder('Bezel inset', 0.875, 0.055, (0, 0, 0.266), dark_steel)
cylinder('Blue watch dial', 0.825, 0.035, (0, 0, 0.305), blue)
bpy.ops.mesh.primitive_torus_add(major_radius=0.9, minor_radius=0.024, major_segments=96, minor_segments=12, location=(0, 0, 0.285))
assign(bpy.context.object, bright_steel)
bpy.context.object.name = 'Bezel highlight ring'

# Twelve applied hour batons and small lume centers.
for i in range(12):
    angle = i * math.tau / 12
    x = math.sin(angle)
    y = math.cos(angle)
    marker = rounded_box(f'Hour baton {i + 1:02d}', (x * 0.69, y * 0.69, 0.337), (0.055, 0.13, 0.026), bright_steel, 0.018)
    marker.rotation_euler[2] = -angle
    if i % 3:
        rounded_box(f'Lume inset {i + 1:02d}', (x * 0.69, y * 0.69, 0.352), (0.018, 0.075, 0.008), white, 0.003).rotation_euler[2] = -angle

# Fine minute track.
for i in range(60):
    angle = i * math.tau / 60
    x, y = math.sin(angle), math.cos(angle)
    rounded_box(f'Minute index {i + 1:02d}', (x * 0.79, y * 0.79, 0.33), (0.012, 0.034 if i % 5 else 0.055, 0.008), white, 0.004).rotation_euler[2] = -angle

# Date aperture and a small date disc at three o'clock.
rounded_box('Date window surround', (0.49, 0.015, 0.353), (0.19, 0.19, 0.025), bright_steel, 0.025)
rounded_box('Date window', (0.49, 0.015, 0.369), (0.14, 0.14, 0.012), white, 0.012)
bpy.ops.object.text_add(location=(0.49, -0.025, 0.379))
date_text = bpy.context.object
date_text.name = 'Date numeral'
date_text.data.body = '28'
date_text.data.align_x = 'CENTER'
date_text.data.align_y = 'CENTER'
date_text.data.size = 0.095
date_text.data.extrude = 0.001
assign(date_text, black)

# Classic 10:10 hand position keeps both hands distinct and readable.
minute_hand = rounded_box('Minute hand', (0.145, 0.23, 0.365), (0.035, 0.55, 0.025), hand_mat, 0.012)
minute_hand.rotation_euler[2] = -0.58
hour_hand = rounded_box('Hour hand', (-0.13, 0.16, 0.382), (0.065, 0.38, 0.03), bright_steel, 0.018)
hour_hand.rotation_euler[2] = 0.72
cylinder('Central pin', 0.065, 0.045, (0, 0, 0.39), hand_mat, vertices=48)
cylinder('Pin jewel', 0.022, 0.05, (0, 0, 0.42), blue, vertices=32)

# A rounded, closed oval bracelet with three flexible metal link rows.
# The ellipse lies around the wrist in the YZ plane, so the band remains connected
# when the watch turns edge-on during the scroll animation.
loop_segments = 72
loop_radius_y = 1.98
loop_center_z = -0.65
loop_radius_z = 0.8
for i in range(loop_segments):
    angle = math.tau * (i + 0.5) / loop_segments
    y = loop_radius_y * math.cos(angle)
    z = loop_center_z + loop_radius_z * math.sin(angle)
    tangent_y = -loop_radius_y * math.sin(angle)
    tangent_z = loop_radius_z * math.cos(angle)
    link_angle = math.atan2(tangent_z, tangent_y)
    for row, x in enumerate((-0.32, 0.0, 0.32)):
        link = rounded_box(
            f'Oval bracelet link {i + 1:02d}-{row + 1}',
            (x, y, z),
            (0.30, 0.108, 0.16),
            bright_steel if row == 1 else steel,
            0.024,
        )
        link.rotation_euler[0] = link_angle

# Detailed deployment clasp, set well behind the watch case on the rear of the loop.
clasp_back = loop_center_z - loop_radius_z
rounded_box('Rear folding clasp body', (0, 0, clasp_back - 0.015), (0.8, 0.5, 0.16), dark_steel, 0.065)
rounded_box('Clasp cover plate', (0, 0, clasp_back - 0.12), (0.62, 0.36, 0.055), bright_steel, 0.05)
rounded_box('Clasp center seam', (0, 0, clasp_back - 0.153), (0.36, 0.028, 0.012), dark_steel, 0.008)
for side in (-1, 1):
    cylinder(f'Clasp hinge barrel {side}', 0.07, 0.22, (side * 0.3, 0.22, clasp_back - 0.04), bright_steel, vertices=40, rotation=(0, math.pi / 2, 0))
    cylinder(f'Clasp release button {side}', 0.065, 0.045, (side * 0.25, -0.01, clasp_back - 0.16), steel, vertices=40)
rounded_box('Clasp safety latch', (0, -0.2, clasp_back - 0.16), (0.28, 0.09, 0.05), steel, 0.025)

# Four case lugs and a fluted crown on the right side.
for side in (-1, 1):
    for x in (-0.48, 0.48):
        rounded_box(f'{"upper" if side > 0 else "lower"} lug {x}', (x, side * 0.88, 0), (0.22, 0.34, 0.25), bright_steel, 0.06)
cylinder('Crown', 0.125, 0.22, (0.98, 0, 0.01), bright_steel, vertices=48, rotation=(0, math.pi / 2, 0))
for i in range(7):
    z = -0.08 + i * 0.03
    cylinder(f'Crown groove {i}', 0.128, 0.012, (1.092, 0, z), dark_steel, vertices=48, rotation=(0, math.pi / 2, 0))

# Export a clean, front-facing GLB with all geometry and materials embedded.
axis_fix = Matrix.Rotation(math.pi / 2, 4, 'X')
for obj in bpy.context.scene.objects:
    obj.matrix_world = axis_fix @ obj.matrix_world
for obj in bpy.context.scene.objects:
    obj.select_set(False)
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'josta.glb')
bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', use_selection=True, export_apply=True)
