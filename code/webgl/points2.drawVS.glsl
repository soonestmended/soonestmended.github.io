precision highp float;

uniform mat4 u_worldViewProjection;
uniform vec3 u_lightWorldPos;
uniform mat4 u_world;
uniform mat4 u_viewInverse;
uniform mat4 u_worldInverseTranspose;
uniform sampler2D u_texPos;
uniform sampler2D u_texVel;
uniform sampler2D u_texColor;
uniform float u_time;

attribute vec2 a_texcoord;

varying vec4 v_position;
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;
varying vec4 v_color;
varying vec2 v_pointSize;

vec4 wrap(vec4 value) {
	vec3 val = 0.5*value.xyz+.5;
	val= mod(val, 1.0);
	return vec4(2.0*(val-.5), value.w);
    
}

void main() {
	
	vec4 pos = texture2D(u_texPos, a_texcoord);
	v_color = texture2D(u_texColor, a_texcoord);
	gl_PointSize = 2.0;
    //v_color.w = max(0.0,1.0/(1.0+mod(u_time, val.w*5.0)) - 0.5);
	//val = map (val);
	//float r = abs(val.x);
	//float phase = val.z * 3.14156;
  //v_position = u_worldViewProjection * vec4(r*cos(r*4.0*u_time+phase), val.y, r*sin(r*4.0*u_time+phase), 1.0);
  //v_position = u_worldViewProjection * val;

  v_position = u_worldViewProjection*pos;
  gl_Position = v_position;
  v_pointSize = vec2(gl_PointSize, gl_PointSize);
}
