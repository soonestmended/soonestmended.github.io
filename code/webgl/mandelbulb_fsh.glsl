#define EPSILON 0.0001
#define BIG_FLOAT 9999.9

precision highp float;

uniform float time;
uniform vec2 resolution;
uniform mat4 ctw;

float Scale = 2.5, Offset = 0.75;
const int Iterations = 12;

vec2 complexMult (vec2 a, vec2 b) {
	return vec2(a.x*b.x - a.y*b.y, a.y*b.x + a.x*b.y);
}

float complexModulusSquared(vec2 a) {
	return a.x*a.x + a.y*a.y;
}

float mandelbulb (vec3 z) {
	vec3 pos = z;
	float dr = 1.0;
	float r = 0.0;
	//int iterations = 10;
	float bailout = 100000.0;
	float Power = 8.0;
	for (int i = 0; i < 50 ; i++) {
		r = length(z);
		if (r > bailout) break;
		
		// convert to polar coordinates
		float theta = acos(z.z/r);
		float phi = atan(z.y,z.x);
		dr =  pow( r, Power-1.0)*Power*dr + 1.0;
		
		// scale and rotate the point
		float zr = pow( r,Power);
		theta = theta*Power;
		phi = phi*Power;
		
		// convert back to cartesian coordinates
		z = zr*vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
		z+=pos;
	}
	return 0.5*log(r)*r/dr; 

}

bool intersectSphere(in vec4 sph, in vec3 ro, in vec3 rd, out vec2 t )
{
    vec3 oc = ro - sph.xyz;
    
    float b = dot(oc,rd);
    float c = dot(oc,oc) - sph.w*sph.w;
    float h = b*b - c;
    
    if( h<0.0 ) return false;

    h = sqrt( h );

    t = -b + vec2(-h,h);
    return true;
}


float mandel2 (vec3 p) {
	vec3 zz = p;
    float m = dot(zz,zz);

    //vec4 trap = vec4(abs(zz.xyz),m);
    float dz = 1.0;
    
    
    for( int i=0; i<8; i++ )
    {
        float m2 = m*m;
        float m4 = m2*m2;
        dz = 8.0*sqrt(m4*m2*m)*dz + 1.0;

        float x = zz.x; float x2 = x*x; float x4 = x2*x2;
        float y = zz.y; float y2 = y*y; float y4 = y2*y2;
        float z = zz.z; float z2 = z*z; float z4 = z2*z2;

        float k3 = x2 + z2;
        float k2 = inversesqrt( k3*k3*k3*k3*k3*k3*k3 );
        float k1 = x4 + y4 + z4 - 6.0*y2*z2 - 6.0*x2*y2 + 2.0*z2*x2;
        float k4 = x2 - y2 + z2;

        zz.x = p.x +  64.0*x*y*z*(x2-z2)*k4*(x4-6.0*x2*z2+z4)*k1*k2;
        zz.y = p.y + -16.0*y2*k3*k4*k4 + k1*k1;
        zz.z = p.z +  -8.0*y*k4*(x4*x4 - 28.0*x4*x2*z2 + 70.0*x4*z4 - 28.0*x2*z2*z4 + z4*z4)*k1*k2;

        
        //trap = min( trap, vec4(abs(zz.xyz),m) );

        m = dot(zz,zz);
        if( m > 1000.0 )
            break;
    }
    //trap.x = m;
    //resColor = trap;

    return 0.25*log(m)*sqrt(m)/dz;
}

int last = 0;
vec3 gradient;

vec3 m3Iterate (vec3 p) {
	vec3 zz = p;
	float m = dot(zz,zz);
	float m2 = m*m;
    float m4 = m2*m2;
    //dz = 8.0*sqrt(m4*m2*m)*dz + 1.0;

    float x = zz.x; float x2 = x*x; float x4 = x2*x2;
    float y = zz.y; float y2 = y*y; float y4 = y2*y2;
    float z = zz.z; float z2 = z*z; float z4 = z2*z2;

    float k3 = x2 + z2;
    float k2 = inversesqrt( k3*k3*k3*k3*k3*k3*k3 );
    float k1 = x4 + y4 + z4 - 6.0*y2*z2 - 6.0*x2*y2 + 2.0*z2*x2;
    float k4 = x2 - y2 + z2;

    zz.x = p.x +  64.0*x*y*z*(x2-z2)*k4*(x4-6.0*x2*z2+z4)*k1*k2;
    zz.y = p.y + -16.0*y2*k3*k4*k4 + k1*k1;
    zz.z = p.z +  -8.0*y*k4*(x4*x4 - 28.0*x4*x2*z2 + 70.0*x4*z4 - 28.0*x2*z2*z4 + z4*z4)*k1*k2;
    return zz;
}

float m3Escape(vec3 pos)
{
	vec3 z = pos;
	for( int i=1; i < 8; i++ )
	{
		z = m3Iterate(z) + pos;
		float r2 = dot(z,z);
		if ((r2 > 1000.0 && last==0) || (i==last))
		{
			last = i;
			return length(z);
		}
	}	
	return length(z);
}

float mandel3 (vec3 p) {
	last = 0;
	float r = m3Escape(p);
	if (r*r<1000.0) return 0.0;
	gradient = (vec3(m3Escape(p+vec3(1.0,0.0,0.0)*EPSILON), m3Escape(p+vec3(0.0,1.0,0.0)*EPSILON), m3Escape(p+vec3(0.0,0.0,1.0)*EPSILON))-vec3(r))/EPSILON;
	return 0.5*r*log(r)/length(gradient);
}

float tetra(vec3 z)
{
    float r;
    int n = 0;
    for (int k = 0; k < Iterations; k++) {
       if(z.x+z.y<0.0) z.xy = -z.yx; // fold 1
       if(z.x+z.z<0.0) z.xz = -z.zx; // fold 2
       if(z.y+z.z<0.0) z.zy = -z.yz; // fold 3	
       z = z*Scale - Offset*(Scale-1.0);
       n++;
    }
    return (length(z) ) * pow(Scale, -float(n));
}

float tetra2(vec3 z)
{
	vec3 a1 = vec3(1.0,1.0,1.0);
	vec3 a2 = vec3(-1.0,-1.0,1.0);
	vec3 a3 = vec3(1.0,-1.0,-1.0);
	vec3 a4 = vec3(-1.0,1.0,-1.0);
	vec3 c;
	int n = 0;
	float dist, d;
	for (int k = 0; k < Iterations; k++) {
		 c = a1; dist = length(z-a1);
	        d = length(z-a2); if (d < dist) { c = a2; dist=d; }
		 d = length(z-a3); if (d < dist) { c = a3; dist=d; }
		 d = length(z-a4); if (d < dist) { c = a4; dist=d; }
		z = Scale*z-c*(Scale-1.0);
		n++;
	}

	return length(z) * pow(Scale, float(-n));
}

float distanceCappedCylinder( vec3 p, vec2 h )
{
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float distanceTorus( vec3 p, vec2 t )
{
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

float distanceSphere(vec3 p, float s) {
	return length(p) - s;
}

float distanceBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) +
         length(max(d,0.0));
}

float distanceRoundedBox(vec3 p) {
	return length(max(abs(p)-vec3(0.5, 0.0, 1.0),0.0))-.05;
}

float distanceSphereRepeat( vec3 p, vec3 c, float r )
{
    vec3 q = mod(p,c)-0.5*c;
    return distanceSphere(q, r);
}

float distanceBoxRepeat( vec3 p, vec3 c, vec3 b )
{
    vec3 q = mod(p,c)-0.5*c;
    return distanceBox(q, b);
}

float distance(vec3 p) {
	//vec3 c = vec3(1.0, 1.0, 1.0);
	//return distanceTorus(p, vec2(1, 0.2));
	//return tetra(p);
	//return distanceCappedCylinder(p, vec2(0.2, 0.2));
	//return distanceCappedCylinder(mod(p, c) - 0.5*c, vec2(0.1, 0.1));
	//return distanceTorus(mod(p, c) - 0.5*c, vec2(0.2, 0.1));
	//return max(distanceSphere(p, 4.0), distanceBoxRepeat(p, vec3(0.5, 0.5, 1.0), vec3(0.1, 0.1, 0.1)));
	//return distanceBoxRepeat(p, vec3(1.5, 0.0, 0.0), vec3(0.2, 0.1, 0.1));
	//return distanceBox(p, vec3(2.5, 2.5, 2.5));
	//return distanceSphere(p, 2.0);
	//return distanceSphereRepeat(p, vec3(2.0, 0.0, 0.0), 0.5);
	//return mandelbulb(p);
	return mandel2(p);
}

//float opRep( vec3 p, vec3 c )

 //   vec3 q = mod(p,c)-0.5*c;
 //   return primitve( q );
//}

vec4 rayMarch(vec3 o, vec3 d) {
	vec2 t;
	if (!intersectSphere(vec4(0.0, 0.0, 0.0, 3.0), o, d, t)) return vec4(0.0);
	float lastDist, dist = BIG_FLOAT;
	o = o + min(t.x, t.y) * d;
	for (int i = 0; i < 128; i++) { 
		lastDist = dist;
		dist = distance(o);
		if (dist > BIG_FLOAT) return vec4(0.0, 0.0, 0.0, 0.0);
		if (dist < EPSILON) return vec4(i, 0.0, 0.0, 1.0);
		//if (dist < EPSILON) return vec4(o, 1.0);
		o += dist * d;
	}
	return vec4(0.0, 0.0, 0.0, 0.0);
}

vec3 normal(vec3 p) {
	return normalize (vec3(
		distance(vec3(p.x+EPSILON, p.y, p.z)) - distance(vec3(p.x-EPSILON, p.y, p.z)),
		distance(vec3(p.x, p.y+EPSILON, p.z)) - distance(vec3(p.x, p.y-EPSILON, p.z)),
		distance(vec3(p.x, p.y, p.z+EPSILON)) - distance(vec3(p.x, p.y, p.z-EPSILON)) 
		));
}

vec4 shadeDiffuse(vec3 p, vec3 n) {
	return vec4(vec3(1.0, 1.0, 1.0) * dot(n, vec3(0.57735, 0.57735, -0.57735)), 1.0);
	//return vec4(n.x, n.y, -n.z, 1.0);
}

vec4 shadeSpecular(vec3 p, vec3 vi, vec3 n) {
	vec3 specDir = reflect(vi, n);
	float spec = max(0.0, dot(specDir, vec3(0.57735, 0.57735, -0.57735)));
	return vec4(spec*spec*spec*spec*spec*vec3(0.7, 0.7, 0.7), 1.0) + vec4(dot(n, vec3(0.0, 1.0, 0.0)) * vec3(0.2, 0.2, 0.2), 0.0) + vec4(0.05, 0.05, 0.05, 0.0);
}

vec4 bgColor(vec3 d) {
	return vec4(0.0, 0.0, 0.0, 1.0);
}

void main() {
	//wtc[3][1] = sin(time);
	//mat4 ctw2 = mat4(1.0);
	//ctw2[3] = vec4(ctw, 1.0);
	//ctw2[3][2] = -time;
	//ctw2[3][2] = -15.0;
	vec3 o = vec3(0.0, 0.0, 1.0); // eye point in camera space
    //vec3 o = vec3(0.0, 0.0, 5.0 + sin(time));
    vec2 p = 2.0 * (gl_FragCoord.xy / resolution.xy - 0.5); // 2D point on image plane in camera space
    p.x *= resolution.x/resolution.y;

    vec3 s = vec3(p.x, p.y, o.z - 1.0); // 3D point on image plane in camera space

    o = (ctw * vec4(o, 1.0)).xyz; // eye point transformed to world coordinates
    s = (ctw * vec4(s, 1.0)).xyz; // image plane point transformed to world coordinates
    vec3 d = normalize(s - o);    // ray direction in world coordinates
    // p is a point in [-1, -1] - [1, 1] on the image plane z = 0

    vec4 isect = rayMarch(o, d);
    if (isect.w < EPSILON) gl_FragColor = bgColor(d);
 	//else gl_FragColor = shadeSpecular(hitPoint.xyz, d, normal(hitPoint.xyz));
    else gl_FragColor = vec4(vec3(1.0,1.0,1.0) * (1.0 - (isect.x / 64.0)), 1.0); 
    //else gl_FragColor = shadeDiffuse(isect.xyz, gradient);
	//else gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
}
