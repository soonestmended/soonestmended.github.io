uniform float time;
uniform vec2 resolution;
uniform mat4 ctw;

void main() {
    gl_Position = vec4( position, 1.0 );
}