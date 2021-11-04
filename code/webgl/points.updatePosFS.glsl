precision highp float;

uniform float u_time;
uniform sampler2D u_texNoise;
uniform vec2 u_resolution;


vec4 wrap(vec4 value) {
	vec3 val = 0.5*value.xyz+.5;
	val= mod(val, 1.0);
	return vec4(2.0*(val-.5), 1.0);
}

float rand(vec2 co){
	return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
	gl_FragColor = texture2D(u_texNoise, uv);
}
