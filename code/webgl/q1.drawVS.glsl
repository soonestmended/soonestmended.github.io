#version 300 es
precision highp float;

//uniform sampler3D u_texObjects;
uniform float u_time;
uniform mat4 u_imagePlane;

in vec4 a_position;
in vec2 a_texCoord;

out vec4 ray_target;
out vec2 texCoord;


void main() {
  gl_Position = a_position; // corners of quad 
  ray_target = u_imagePlane[2] + vec4(a_position.x) * u_imagePlane[1] + vec4(a_position.y) * u_imagePlane[0];
  texCoord = vec2(a_texCoord.s, 1.0-a_texCoord.t);
}
