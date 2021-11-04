precision highp float;

uniform float u_time;
uniform sampler2D u_texPos;
uniform sampler2D u_texVel;
uniform sampler2D u_texColor;
uniform sampler2D u_texPerlin;
uniform float u_perlinScale;
uniform vec2 u_resolution;
uniform vec3 center;
uniform float u_Kv;
uniform float u_Kp;
uniform float u_Kg;


#define EPSILON 0.01
#define M_TWO_PI 6.28318530718

vec4 wrap(vec4 value) {
	vec3 val = 0.5*value.xyz+.5;
	val= mod(val, 1.0);
	return vec4(2.0*(val-.5), 1.0);
}

float rand(vec2 co){
	return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec4 bounce(vec4 pv) {
	if (1.0 - abs(pv.x+u_Kv*pv.z) < EPSILON) {
		pv.z = -pv.z;
	}
	if (1.0 - abs(pv.y+u_Kv*pv.w) < EPSILON) {
		pv.w = -pv.w;
	}
	return pv;
}

float fade (float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec2 lerp2D (vec2 v1, vec2 v2, float a) {
    a = clamp(fade(a), 0.0, 1.0);
	return a * v1 + (1.0-a) * v2;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
	vec4 pos = texture2D(u_texPos, uv);
    vec4 vel = texture2D(u_texVel, uv);
    vec4 color = texture2D(u_texColor, uv);

    if (color.w < 0.0005) {
        // reset to center
        gl_FragColor = vec4(center.x, center.y, center.z, 1.0);
    }
    else {
        // update position based on velocity and constant Kv
        gl_FragColor = vec4(pos.xyz + u_Kv*vel.xyz, 1.0);
    }

}
