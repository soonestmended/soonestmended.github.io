precision highp float;

uniform sampler2D u_texParticle;
varying vec4 v_color;
varying vec2 v_pointSize;

void main() {
    
  vec4 texSample = texture2D(u_texParticle, vec2(gl_PointCoord.s, gl_PointCoord.t));
  gl_FragColor = vec4(v_color.xyz, texSample.z);
}
