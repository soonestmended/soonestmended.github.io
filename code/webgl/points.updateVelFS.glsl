precision highp float;

#define EPSILON .0001
#define K .6

uniform float u_time;
uniform float u_clicked;
uniform vec2 u_resolution;
uniform vec2 center;
uniform vec2 attractor;
uniform sampler2D u_texPos;
uniform sampler2D u_texVel;
uniform sampler2D u_texColor;

varying vec2 v_texcoord;

vec4 bounce(vec4 pos, vec4 vel) {
	if (1.0 - abs(pos.x+.001*vel.x) < EPSILON) {
		vel.x = -vel.x;
	}
	if (1.0 - abs(pos.y+.001*vel.y) < EPSILON) {
		vel.y = -vel.y;
	}
	return vel;
}

float rand(vec2 co){
	return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_resolution;
	vec4 pos = texture2D(u_texPos, uv);
	vec4 vel = texture2D(u_texVel, uv);
    vec4 color = texture2D(u_texColor, uv);

	vec2 r = attractor - pos.xy;
	float rsq = r.x*r.x + r.y*r.y;

	float force = 1.0/rsq;
	//vel.xy += K * force * r.xy;
	/*
    vel.w -= .005;
	if (rsq < 0.15 + .05*rand(uv+u_time)) {
		if (rsq < .05 && u_clicked > 0.0) {
			vel.xy *= .9;
		} else {
			vel.xy -= dot(vel.xy, r) * r;
		}
		//vel.xy /= length(vel.xy);
		//vel.xy = vec2(0.0);
		vel.w = 1.0-rsq;
	}
    */
    if (color.w < 0.01) { 
        vec2 rand_uv = vec2(rand(uv+u_time), rand(uv-u_time));
        gl_FragColor = 5.0*vec4(rand_uv - 0.5, 0.0, 0.0);
    }
    else {
        vel.xy += K * force * r.xy;
	    gl_FragColor = vel;

    }
}
	 
