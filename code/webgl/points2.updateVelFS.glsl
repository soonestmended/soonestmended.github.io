precision highp float;

uniform float u_time;
uniform sampler2D u_texPos;
uniform sampler2D u_texVel;
uniform sampler2D u_texColor;
uniform sampler2D u_texPerlin;
uniform float u_perlinScale;
uniform vec2 u_resolution;
uniform vec3 center;

uniform float u_Kv;
uniform float u_Kp;
uniform float u_Kg;

#define EPSILON 0.01
#define M_TWO_PI 6.28318530718

vec4 wrap(vec4 value) {
	vec3 val = 0.5*value.xyz+.5;
	val= mod(val, 1.0);
	return vec4(2.0*(val-.5), 1.0);
}

vec4 bounceOffSphere(vec4 pos, vec4 vel) {
    float distFromSphereSurface = length(pos.xyz) - 1.0;
    if (distFromSphereSurface > 0.0) {
        return vel+vel*(distFromSphereSurface*.1);
    }
    else {
        return vel;
    }
}

float rand(vec2 co){
	return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec4 bounce(vec4 pv) {
	if (1.0 - abs(pv.x+u_Kv*pv.z) < EPSILON) {
		pv.z = -pv.z;
	}
	if (1.0 - abs(pv.y+u_Kv*pv.w) < EPSILON) {
		pv.w = -pv.w;
	}
	return pv;
}

vec3 mod289(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise
float cnoise(vec3 P)
{
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
  return 2.2 * n_xyz;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
	vec4 vel = texture2D(u_texVel, uv);
    vec4 pos = texture2D(u_texPos, uv);
    vec4 color = texture2D(u_texColor, uv);

    if (color.w < 0.0005) {
        // reset to mouse position
        float theta = rand(uv+u_time) * M_TWO_PI;
        float u = rand(uv/u_time) * 2.0 - 1.0;
        float omsqu = sqrt(1.0-u*u);
        gl_FragColor = vec4(omsqu*cos(theta), omsqu*sin(theta), u, 1.0);
    }
    else {
        // calculate perlin noise vector for current location
        vec3 pv = vec3(cnoise(-pos.xyz * u_perlinScale) + cnoise(pos.xyz * (4.0*u_perlinScale)), cnoise(pos.xyz * u_perlinScale) + cnoise(-pos.xyz * u_perlinScale*2.0), cnoise(pos.xyz * u_perlinScale) + cnoise(pos.xyz * (u_perlinScale*2.0)));

        vec4 newVel = vec4(vel.xyz + u_Kp * pv + u_Kg*(pos.xyz - center), 1.0);
        gl_FragColor = bounceOffSphere(pos, newVel);
        //gl_FragColor = newVel;
        // gl_FragColor = vel;
    }

}
