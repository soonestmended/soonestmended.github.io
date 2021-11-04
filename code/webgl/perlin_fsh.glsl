#define EPSILON 0.00001

uniform float time;
uniform float scale;
uniform vec2 resolution;
uniform vec2 center;


vec2 map(vec2 fragCoord) {
	vec2 ans = fragCoord / resolution;
	// ans now [0, 1] x [0, 1]	
	ans = 2.0 * (ans - vec2(0.5));
	// ans now [-1, -1] x [1, 1]
	return scale * ans;
}	

vec4 escape(vec2 P) {
	vec2 Z = P;
	vec2 C = vec2(-0.8, 0.156);
	vec3 trap = vec3(9999999.0);
	vec2 p1 = vec2(0.5, -0.5);
	vec2 p2 = vec2(-0.4, 0.0);
	vec2 p3 = vec2(0.5, 0.1);
	for (int i = 0; i < 128; ++i) {
		Z = vec2(Z.x*Z.x - Z.y*Z.y + C.x, 2.0*Z.x*Z.y + C.y);
		trap = min(trap, vec3(length(Z-p1), length(Z-p2), length(Z-p3)));
		if (length(Z) > 1000.0) return vec4(float(i) / 128.0, trap);
	}
	return vec4(1.0, trap);
}

void main() {
	vec2 C = center + map(vec2(gl_FragCoord.x, gl_FragCoord.y));
	vec4 dist = escape(C);
	gl_FragColor = vec4(vec3(0.0, vec2(0.5, 0.75) - dist.yz), 1.0);
}
