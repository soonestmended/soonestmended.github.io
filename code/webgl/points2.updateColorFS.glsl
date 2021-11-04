precision highp float;

uniform float u_time;
uniform sampler2D u_texPos;
uniform sampler2D u_texVel;
uniform sampler2D u_texColor;
uniform vec2 u_resolution;
uniform vec3 u_c1;
uniform vec3 u_c2;

varying vec2 v_texcoord;

#define WHITE vec3(1.0, 1.0, 1.0)
#define C1 vec3(.1, .2, 1.0)
#define C2 vec3(1.0, 0.4, 1.0)

vec3 lerp (vec3 v1, vec3 v2, float a) {
	//a = clamp(a, 0.0, 1.0);
	return a * v1 + (1.0-a) * v2;
}
float rand(vec2 co) {
	return fract(cos(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
	vec2 uv =  gl_FragCoord.xy/u_resolution;
	vec4 color = texture2D(u_texColor, uv);
    vec4 vel = texture2D(u_texVel, uv);
    if (color.w < 0.0005) {
        gl_FragColor = vec4(WHITE, 1.0);
    
    }
    
    else {
        color.w -= .001 + .001*rand(uv);
        gl_FragColor = vec4(mix(WHITE, C1, 1.0-color.w), color.w);
    }

    // gl_FragColor = vec4(lerp(u_c1, u_c2, f*f), vel.w); //vec4(abs(vel.xzy), vel.x);//vec4(gl_FragCoord.x/u_resolution.x, gl_FragCoord.y/u_resolution.y, 0.0, 1.0);
}
