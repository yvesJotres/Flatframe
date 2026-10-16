shader_type canvas_item;

// The globe surface, per pixel. The quad's UV spans a square of 2r + 2 pixels around the globe's centre.
// Ported from the canvas drawing in EFFECTS[PLANET_EARTH] (visual_effects.js): ocean gradient, land from the mask,
// ice caps above 74 and below -68 degrees, sunlight shade, and the rim.

uniform sampler2D land_mask : filter_linear, repeat_disable;
uniform float radius = 100.0;
uniform float spin_deg = 0.0;
uniform float tilt = -0.32;
uniform vec4 ocean_light : source_color = vec4(0.239, 0.561, 0.878, 1.0);
uniform vec4 ocean_mid : source_color = vec4(0.106, 0.373, 0.706, 1.0);
uniform vec4 ocean_deep : source_color = vec4(0.027, 0.141, 0.353, 1.0);
uniform vec4 land_colour : source_color = vec4(0.298, 0.604, 0.322, 1.0);
uniform vec4 ice_colour : source_color = vec4(0.910, 0.949, 1.0, 1.0);
uniform vec4 rim_colour : source_color = vec4(0.471, 0.706, 1.0, 0.35);

const float RAD = 0.0174532925;

vec4 over(vec4 dst, vec4 src) {
	float a_out = src.a + dst.a * (1.0 - src.a);
	if (a_out <= 0.0) {
		return vec4(0.0);
	}
	vec3 c = (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a_out;
	return vec4(c, a_out);
}

// Three-stop radial gradient at distance d, stops at 0, 0.5, 1
vec4 radial3(float d, float r0, float r1, vec4 c0, vec4 c1, vec4 c2) {
	float t = clamp((d - r0) / (r1 - r0), 0.0, 1.0);
	if (t < 0.5) {
		return mix(c0, c1, t * 2.0);
	}
	return mix(c1, c2, (t - 0.5) * 2.0);
}

vec4 globe_color(vec2 p, float d) {
	if (d > radius) {
		return vec4(0.0);
	}

	// Ocean: radial gradient centred up and to the left of the globe
	float ocean_t = length(p - vec2(-0.35, -0.35) * radius);
	vec4 ocean = vec4(mix(ocean_light, ocean_mid, 0.0).rgb, 1.0);
	float t = clamp((ocean_t - 0.05 * radius) / (1.0 * radius), 0.0, 1.0);
	ocean = vec4(t < 0.5 ? mix(ocean_light, ocean_mid, t * 2.0).rgb : mix(ocean_mid, ocean_deep, (t - 0.5) * 2.0).rgb, 1.0);

	// Point on the sphere: undo the axis tilt, then unproject (x right, y up, z towards the viewer)
	vec2 q = p / radius;
	float cs = cos(tilt);
	float sn = sin(tilt);
	vec2 qr = vec2(q.x * cs + q.y * sn, -q.x * sn + q.y * cs);
	float z = sqrt(max(0.0, 1.0 - dot(qr, qr)));
	vec3 n = vec3(qr.x, -qr.y, z);
	float lat_deg = asin(clamp(n.y, -1.0, 1.0)) / RAD;
	float lam_deg = atan(n.x, n.z) / RAD;
	float lon_deg = lam_deg + spin_deg;

	vec2 uv = vec2(fract((lon_deg + 180.0) / 360.0), (90.0 - lat_deg) / 180.0);
	float land = texture(land_mask, uv).r;
	vec4 surface = mix(ocean, land_colour, land);
	if (lat_deg > 74.0 || lat_deg < -68.0) {
		surface = ice_colour;
	}

	// Shade (light from the top left, dark night edge), then the rim, as in the browser
	vec4 shade = radial3(length(p - vec2(-0.45, -0.45) * radius), 0.2 * radius, 1.15 * radius,
		vec4(1.0, 1.0, 1.0, 0.14), vec4(0.0), vec4(0.0, 0.0, 10.0 / 255.0, 0.75));
	vec4 rim = vec4(rim_colour.rgb, rim_colour.a * clamp((d - 0.82 * radius) / (0.18 * radius), 0.0, 1.0));
	return over(over(surface, shade), rim);
}

void fragment() {
	vec2 p = (UV - 0.5) * (2.0 * radius + 2.0);
	COLOR = globe_color(p, length(p));
}
