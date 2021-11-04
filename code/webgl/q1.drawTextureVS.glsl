#version 300 es
precision highp float;

in vec4 a_position;
in vec2 a_texCoord;

out vec2 texCoord;

void main() {
  gl_Position = a_position; // corners of quad 
  texCoord = vec2(a_texCoord.s, 1.0 - a_texCoord.t);
}
