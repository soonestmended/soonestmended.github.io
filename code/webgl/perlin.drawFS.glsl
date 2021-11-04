precision highp float;

uniform float u_time;
uniform sampler2D u_texNoise;
uniform vec2 u_resolution;
uniform float u_scale;


vec4 wrap(vec4 value) {
	vec3 val = 0.5*value.xyz+.5;
	val= mod(val, 1.0);
	return vec4(2.0*(val-.5), 1.0);
}

float rand(vec2 co){
	return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);

}

#define SCALE 16.0

float fade (float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float lerp (float f1, float f2, float a) {
    a = clamp(fade(a), 0.0, 1.0);
	return a * f1 + (1.0-a) * f2;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 gridCenter = uv * u_scale;

    vec2 LL = floor(gridCenter);
    vec2 UL = LL + vec2(0.0, 1.0);
    vec2 UR = LL + vec2(1.0, 1.0);
    vec2 LR = LL + vec2(1.0, 0.0);

    float dot1 = dot(texture2D(u_texNoise, LL/u_scale).xy, gridCenter - LL);
    float dot2 = dot(texture2D(u_texNoise, UL/u_scale).xy, gridCenter - UL);
    float dot3 = dot(texture2D(u_texNoise, UR/u_scale).xy, gridCenter - UR);
    float dot4 = dot(texture2D(u_texNoise, LR/u_scale).xy, gridCenter - LR);

    float noise = 0.5* (lerp(lerp(dot3, dot4, fract(gridCenter.y)), lerp(dot2, dot1, fract(gridCenter.y)), fract(gridCenter.x)) + 1.0);
    gl_FragColor = vec4(noise, noise, noise, 1.0);
    //texture2D(u_texNoise, uv);
    //gl_FragColor = vec4(uv, 0.0, 1.0);
}
