#version 300 es
precision highp float;
precision highp sampler2D;


uniform sampler2D u_texImage;


in vec2 texCoord;
out vec4 color;

void main() {
	color = texture(u_texImage, texCoord);
    color.xyz = 1.0 * pow(color.xyz, vec3(.5));
	color.w = 1.0;
}
