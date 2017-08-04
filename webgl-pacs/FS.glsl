precision highp float;

uniform sampler2D u_tex;
uniform sampler2D u_maskTex;
uniform vec2 u_resolution;
uniform vec2 u_wl;

varying vec2 v_texcoord;

void main() {
	vec2 uv =  gl_FragCoord.xy/u_resolution;
    vec4 raw_data = texture2D(u_tex, uv);
    vec4 mask_data = texture2D(u_maskTex, uv);
    float offset = u_wl.y - (u_wl.x / 2.0);
    float scale = 1.0 / u_wl.x;

	vec4 dataColor = clamp(vec4((raw_data.xyz - vec3(offset)) * vec3(scale), 1.0), 0.0, 1.0);
	gl_FragColor = mix(dataColor, mask_data, mask_data.w);
	//gl_FragColor = vec4(mask_data.xyz, 1.0);
}
