shader_type canvas_item;
// The shared menu background from java_build/src/ui/theme.js drawMenuBackground:
// a radial gradient #0d0d1a -> #06060e (at 40%) -> #020205, centred at 50% / 45% of the screen,
// reaching its edge colour at 80% of the longer screen side.

uniform vec2 size = vec2(1920.0, 1080.0);
uniform vec4 center_color : source_color = vec4(0.0509, 0.0509, 0.1019, 1.0);
uniform vec4 mid_color : source_color = vec4(0.0235, 0.0235, 0.0549, 1.0);
uniform vec4 edge_color : source_color = vec4(0.0078, 0.0078, 0.0196, 1.0);

void fragment() {
	vec2 p = UV * size;
	vec2 c = vec2(size.x * 0.5, size.y * 0.45);
	float t = clamp(length(p - c) / (max(size.x, size.y) * 0.8), 0.0, 1.0);
	vec4 col = t < 0.4 ? mix(center_color, mid_color, t / 0.4) : mix(mid_color, edge_color, (t - 0.4) / 0.6);
	COLOR = col;
}
