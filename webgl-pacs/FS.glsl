precision highp float;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform vec2 u_wl;

varying vec2 v_texcoord;

void main() {
	vec2 uv =  gl_FragCoord.xy/u_resolution;
    vec4 raw_data = texture2D(u_tex, uv);
    float offset = u_wl.y - (u_wl.x / 2.0);
    float scale = 1.0 / u_wl.x;

	gl_FragColor = clamp(vec4((raw_data.xyz - vec3(offset)) * vec3(scale), 1.0), 0.0, 1.0);
}
