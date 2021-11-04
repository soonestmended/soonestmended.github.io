precision highp float;
uniform sampler2D u_texXY;
uniform sampler2D u_texZVx;
uniform sampler2D u_texVyVz;

varying vec4 v_color;

void main() {
  gl_FragColor = vec4(v_color);
}