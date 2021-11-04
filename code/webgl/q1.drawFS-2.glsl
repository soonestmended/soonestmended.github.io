#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler3D;
precision highp usampler3D;

#define EPS 0.00001
#define M_PI 3.14159265359
#define M_TWO_PI 6.28318530718
#define M_INV_PI 0.31830988618
#define BVH_STACK_SIZE 64

#define PURE_DIFFUSE 0.0
#define MIRROR 1.0
#define GLASS 2.0
#define DIELECTRIC 3.0
#define CONDUCTOR 4.0
#define OREN_NAYAR 5.0
#define DIFFUSE_SPEC_SHIRLEY 6.0

uniform int u_numTris;
uniform int u_numLights;
uniform uint u_pass;
uniform sampler2D u_texMaterials;
uniform sampler2D u_texLights;
uniform sampler2D u_texBlendWith;
uniform sampler3D u_texObjects;
uniform usampler3D u_texBVH;
uniform mat4 u_imagePlane;
uniform uvec4 u_seed[3];
uniform float u_time;
uniform float u_sampleWeight;

in vec4 ray_target;
in vec2 texCoord;
in vec2 v_pointSize;
out vec4 color;

float ds = 1.0 / 2048.0;

struct RandomResult {
    uvec4 state;
    float value;
};

struct IntersectRec {
    vec4 P;
    vec4 N;
    vec2 bg;
    vec2 uv;
    float t;
    uint index;
    int materialIndex;
};

struct Triangle {
    vec3 p;
    vec3 e1;
    vec3 e2;

    vec3 np;
    vec3 nq;
    vec3 nr;

    vec2 uvp;
    vec2 uvq;
    vec2 uvr;

    int materialIndex;
};

struct BVHNode {
    vec3 min;
    vec3 max;
    uvec2 d;
};

struct Material {
    vec3 diffuse;
    vec3 specular;
    vec3 transmission;
    vec3 emission;
    float type;
    vec3 data;
};

struct Light {
    vec3 p;
    vec3 q;
    vec3 r;
    vec3 np;
    vec3 nq;
    vec3 nr;
    vec3 color;
    float area;
};

struct LightRec {
    Light light;
    vec3 lightNormal;
    vec3 vecToLight;
};

void wang_hash(inout uvec4 seed)
{
    seed = (seed ^ 61u) ^ (seed >> 16);
    seed *= 9u;
    seed = seed ^ (seed >> 4);
    seed *= 0x27d4eb2du;
    seed = seed ^ (seed >> 15);
}

uvec3 TausStep(uvec3 z, uvec3 S1, uvec3 S2, uvec3 S3, uvec3 M) {
    uvec3 b = (((z << S1) ^ z) >> S2);
    return (((z & M) << S3) ^ b);
}

uint LCGStep(uint z, uint A, uint C) {
    return A * z + C;
}

void rand_xorshift(inout uint rng_state)
{
    // Xorshift algorithm from George Marsaglia's paper
    rng_state ^= (rng_state << 13);
    rng_state ^= (rng_state >> 17);
    rng_state ^= (rng_state << 5);
}

float rand(inout uvec4 state) {
    //state.xyz = TausStep(state.xyz, uvec3(13u, 2u, 3u), uvec3(19, 25, 11), uvec3(12, 4, 17), uvec3(4294967294u, 4294967288, 4294967280));
    //state.w = LCGStep(state.w, 1664525u, 1013904223u);
    //return 2.3283064365387e-10 * float(state.x ^ state.y ^ state.z ^ state.w);
    rand_xorshift(state.x);
    return 2.3283064365387e-10 * float(state.x); // ^ state.y ^ state.z ^ state.w);
}


bool intersectBBox(in vec4 ro, in vec4 invrd, in vec3 bbmin, in vec3 bbmax, float farthest) {
    vec3 minInterval = (bbmin - ro.xyz) * invrd.xyz;
    vec3 maxInterval = (bbmax - ro.xyz) * invrd.xyz;
    
    vec3 a = min(minInterval.xyz, maxInterval.xyz);
    vec3 b = max(minInterval.xyz, maxInterval.xyz);

    float tmin = max(max(a.x, a.y), a.z); 
    float tmax = min(min(b.x, b.y), b.z);

    return (farthest > tmin) && (tmin <= tmax) && (tmax >= 0.0);    
}

bool intersectSphere(in vec4 ro, in vec4 rd, out IntersectRec ir) {
    float a = dot(rd.xyz, rd.xyz);
    float b = 2.0 * dot(rd.xyz, ro.xyz);
    float c = dot(ro.xyz, ro.xyz) - 1.0;
    float d = b*b - 4.0 * a * c;
    if (d >= 0.0) {
        float hit = (-b - sqrt(d)) / (2.0 * a);
        ir.t = hit;
        ir.P = ir.N = ro + rd * hit;
        return true;
    }
    else {
        return false;
    }
}

bool intersectTriangle(in vec4 ro, in vec4 rd, in float tmin, in float tmax, in vec3 v0, in vec3 e1, in vec3 e2, out IntersectRec ir) {
    //vec3 e1 = v1 - v0;
    //vec3 e2 = v2 - v0;
    vec3 pvec = cross(rd.xyz, e2);
    float det = dot(e1, pvec);
    if (abs(det) < EPS) return false;

    float invDet = 1.0 / det;
    vec3 tvec = ro.xyz - v0;
    ir.bg.x = dot(tvec, pvec) * invDet;
    if (ir.bg.x < 0.0 || ir.bg.x > 1.0) return false;

    vec3 qvec =cross(tvec, e1);
    ir.bg.y = dot(rd.xyz, qvec) * invDet;
    if (ir.bg.y < 0.0 || (ir.bg.x+ir.bg.y > 1.0)) return false;

    ir.t = dot(e2, qvec) * invDet;
    if (ir.t < tmin || ir.t > tmax) return false;

    ir.P = ro + ir.t * rd;
    return true;
}

bool intersectTriangleYN(in vec4 ro, in vec4 rd, in float tmin, in float tmax, in vec3 v0, in vec3 e1, in vec3 e2) {
    //vec3 e1 = v1 - v0;
    //vec3 e2 = v2 - v0;
    vec2 bg;
    vec3 pvec = cross(rd.xyz, e2);
    float det = dot(e1, pvec);
    if (abs(det) < EPS) return false;

    float invDet = 1.0 / det;
    vec3 tvec = ro.xyz - v0;
    bg.x = dot(tvec, pvec) * invDet;
    if (bg.x < 0.0 || bg.x > 1.0) return false;

    vec3 qvec =cross(tvec, e1);
    bg.y = dot(rd.xyz, qvec) * invDet;
    if (bg.y < 0.0 || (bg.x+bg.y > 1.0)) return false;

    float t = dot(e2, qvec) * invDet;
    return (t > tmin && t < tmax);
}

ivec2 children(int nodeID, BVHNode node, ivec3 rayBits) {
    int axis = int(node.d.x >> 30);
    //if (axis == 3) return ivec2(-1);
    ivec2 ans = ivec2(nodeID + 1, node.d.x & 1073741823u);
    return ivec2(ans[rayBits[axis]], ans[1-rayBits[axis]]);
}

uvec2 leafStartNum(BVHNode node) {
   //return ivec2(int(node.d.x), int(node.d.y & 536870911u)); // = 0x1FFFFFFF 
    return uvec2(node.d.x, node.d.y & 536870911u); // = 0x1FFFFFFF 
}

bool isLeaf(BVHNode node) {
    uint bits = node.d.y >> 30;
    return (bits == 3u);
}

vec2 materialIndexToTexCoords(int index) {
    index = index * 4;
    int j = index / 256;
    int i = index - j * 256;
    return vec2(float(i) * (1.0/256.0), float(j) * (1.0/256.0));
}

vec2 lightIndexToTexCoords(int index) {
    index = index * 8;
    int j = index / 256;
    int i = index - j * 256;
    return vec2(float(i) * (1.0/256.0), float(j) * (1.0/256.0));
}

Material fetchMaterialFromTex(int index) {
    vec2 tc = materialIndexToTexCoords(index);
    float dms = 1.0 / 256.0;
    
    vec4 d1 = textureLod(u_texMaterials, tc, 0.0);
    vec4 d2 = textureLod(u_texMaterials, vec2(tc.s+dms, tc.t), 0.0);
    vec4 d3 = textureLod(u_texMaterials, vec2(tc.s+2.f*dms, tc.t), 0.0);
    vec4 d4 = textureLod(u_texMaterials, vec2(tc.s+3.f*dms, tc.t), 0.0);

    return Material(d1.xyz, vec3(d1.w, d2.xy), vec3(d2.zw, d3.x), d3.yzw, d4.x, d4.yzw);
}

Light fetchLightFromTex(int index) {
    vec2 tc = lightIndexToTexCoords(index); 
    float dms = 1.0 / 256.0;
    
    vec4 d1 = textureLod(u_texLights, tc, 0.0);
    vec4 d2 = textureLod(u_texLights, vec2(tc.s+dms, tc.t), 0.0);
    vec4 d3 = textureLod(u_texLights, vec2(tc.s+2.f*dms, tc.t), 0.0);
    vec4 d4 = textureLod(u_texLights, vec2(tc.s+3.f*dms, tc.t), 0.0);
    vec4 d5 = textureLod(u_texLights, vec2(tc.s+4.f*dms, tc.t), 0.0);
    vec4 d6 = textureLod(u_texLights, vec2(tc.s+5.f*dms, tc.t), 0.0);

    return Light(d1.xyz, vec3(d1.w, d2.xy), vec3(d2.zw, d3.x), d3.yzw, d4.xyz, vec3(d4.w, d5.xy), vec3(d5.zw, d6.x), d6.y);
}

vec3 BVHNodeIndexToTexCoords(int index) {
    index = index * 2;
    int k = index / (2048*2048);
    int j = (index - k*2048*2048) / 2048;
    int i = index - k*2048*2048 - j*2048;
    return vec3(float(i) * ds, float(j) * ds, float(k) * ds);
}

BVHNode fetchBVHNodeFromTex(int index) {
    vec3 tc = BVHNodeIndexToTexCoords(index);
    uvec4 d1 = textureLod(u_texBVH, tc, 0.0);
    uvec4 d2 = textureLod(u_texBVH, vec3(tc.s+ds, tc.t, tc.r), 0.0);
    BVHNode ans;
    ans.min = uintBitsToFloat(d1.xyz);
    ans.max = uintBitsToFloat(uvec3(d1.w, d2.xy));
    ans.d = d2.zw;
    return ans;
}

vec3 triIndexToTexCoords(uint index) {
    index *= 8u;
    uint k = index / (2048u*2048u);
    uint j = (index - k*2048u*2048u) / 2048u;
    uint i = index - k*2048u*2048u - j*2048u;
    return vec3(float(i) * ds, float(j) * ds, float(k) * ds);
}

Triangle fetchTriFromTex(uint index) {
    vec3 tc = triIndexToTexCoords(index);
    vec4 d1 = textureLod(u_texObjects, tc, 0.0);
    vec4 d2 = textureLod(u_texObjects, vec3(tc.s+ds, tc.t, tc.r), 0.0);
    vec4 d3 = textureLod(u_texObjects, vec3(tc.s+2.f*ds, tc.t, tc.r), 0.0);
    //vec4 d4 = textureLod(u_texObjects, vec3(tc.s+3.f*ds, tc.t, tc.r), 0.0);
    //vec4 d5 = textureLod(u_texObjects, vec3(tc.s+4.f*ds, tc.t, tc.r), 0.0);
    //vec4 d6 = textureLod(u_texObjects, vec3(tc.s+5.f*ds, tc.t, tc.r), 0.0);
    //vec4 d7 = textureLod(u_texObjects, vec3(tc.s+6.f*ds, tc.t, tc.r), 0.0);

    Triangle ans;

    ans.p = d1.xyz;
    ans.e1 = vec3(d1.w, d2.xy);
    ans.e2 = vec3(d2.zw, d3.x);

    //ans.np = d3.yzw;
    //ans.nq = d4.xyz;
    //ans.nr = vec3(d4.w, d5.xy);

    //ans.uvp = d5.zw;
    //ans.uvq = d6.xy;
    //ans.uvr = d6.zw;

    //ans.materialIndex = int(d7.x);

    return ans;
}

void finishIntersectRec(inout IntersectRec ir) {

    vec3 tc = triIndexToTexCoords(ir.index);
    vec4 d3 = textureLod(u_texObjects, vec3(tc.s+2.f*ds, tc.t, tc.r), 0.0);
    vec4 d4 = textureLod(u_texObjects, vec3(tc.s+3.f*ds, tc.t, tc.r), 0.0);
    vec4 d5 = textureLod(u_texObjects, vec3(tc.s+4.f*ds, tc.t, tc.r), 0.0);
    vec4 d6 = textureLod(u_texObjects, vec3(tc.s+5.f*ds, tc.t, tc.r), 0.0);
    vec4 d7 = textureLod(u_texObjects, vec3(tc.s+6.f*ds, tc.t, tc.r), 0.0);

    ir.N = vec4(vec3(ir.bg.x * d4.xyz + ir.bg.y * vec3(d4.w, d5.xy) + (1.0f - ir.bg.x - ir.bg.y) * d3.yzw), 0.0);

    ir.uv = ir.bg.x * d5.zw + ir.bg.y * d6.xy + (1.0f - ir.bg.x - ir.bg.y) * d6.zw;

    ir.materialIndex = int(d7.x);

}

bool BVHIntersect(vec4 ro, vec4 rd, out IntersectRec bestir) {
    vec4 invrd = vec4(1.0) / rd;
    ivec3 rayBits = ivec3(rd.x > 0.0, rd.y > 0.0, rd.z > 0.0);
    
    bestir.t = 999999.0;
    bool hit = false;

    int stack[BVH_STACK_SIZE];
    int stackptr = 0;

    stack[stackptr++] = 0;

    while (stackptr > 0 && stackptr < BVH_STACK_SIZE) {
        int current = stack[--stackptr];
        BVHNode node = fetchBVHNodeFromTex(current);
        if (intersectBBox(ro, invrd, node.min, node.max, bestir.t)) {
            if (isLeaf(node)) {
                uvec2 startNum = leafStartNum(node);
                for (uint j = startNum.x; j < startNum.x+startNum.y; j++) {
                    Triangle tri = fetchTriFromTex(j);
                    IntersectRec tir;
                    if (intersectTriangle(ro, rd, EPS, bestir.t, tri.p, tri.e1, tri.e2, tir)) {
                        hit = true;
                        bestir = tir;
                        bestir.index = j;
                        //bestir.P = ro + rd*bestir.t;
                        //bestir.N = vec4(vec3(bestir.uv.x * tri.nq + bestir.uv.y * tri.nr + (1.0f - bestir.uv.x - bestir.uv.y) * tri.np), 0.0);
                        //bestir.materialIndex = tri.materialIndex;
                    }
                }
            }
            else {
                ivec2 nearFar = children(current, node, rayBits);
                stack[stackptr++] = nearFar.y;
                stack[stackptr++] = nearFar.x;
            }
        }
    }
    finishIntersectRec(bestir);
    bestir.P = ro + rd*bestir.t;

    return hit;
}

bool BVHIntersectYN(vec4 ro, vec4 rd, float tmax) {
    vec4 invrd = vec4(1.0) / rd;
    ivec3 rayBits = ivec3(rd.x > 0.0, rd.y > 0.0, rd.z > 0.0);
    
//    bestir.t = tmax;
    bool hit = false;

    int stack[BVH_STACK_SIZE];
    int stackptr = 0;

    stack[stackptr++] = 0;

    while (stackptr > 0 && stackptr < BVH_STACK_SIZE) {
        int current = stack[--stackptr];
        BVHNode node = fetchBVHNodeFromTex(current);
        if (intersectBBox(ro, invrd, node.min, node.max, tmax)) {
            if (isLeaf(node)) {
                uvec2 startNum = leafStartNum(node);
                for (uint j = startNum.x; j < startNum.x+startNum.y; j++) {
                    Triangle tri = fetchTriFromTex(j);
                    if (intersectTriangleYN(ro, rd, EPS, tmax, tri.p, tri.e1, tri.e2)) {
                        return true;
                        //bestir.P = ro + rd*bestir.t;
                        //bestir.N = vec4(vec3(bestir.uv.x * tri.nq + bestir.uv.y * tri.nr + (1.0f - bestir.uv.x - bestir.uv.y) * tri.np), 0.0);
                        //bestir.materialIndex = tri.materialIndex;
                    }
                }
            }
            else {
                ivec2 nearFar = children(current, node, rayBits);
                stack[stackptr++] = nearFar.y;
                stack[stackptr++] = nearFar.x;
            }
        }
    }
    return false;
}

mat3 makeONB(vec3 W) {
    vec3 U;
    if (abs(W.x) > abs(W.y)) {
        float invLen = 1.0 / sqrt(W.x*W.x+W.z*W.z);
        U = vec3(-W.z*invLen, 0.0, W.x*invLen);
    }
    else {
        float invLen = 1.0 / sqrt(W.y*W.y + W.z*W.z);
        U = vec3(0.0, W.z*invLen, -W.y*invLen);
    }
    vec3 V = cross(W, U);
    return mat3(U, V, W);
}

vec3 cosineHemisphericSample(inout uvec4 state1) { 
    float r1 = rand(state1);
    float r2 = rand(state1);
    
    float cosTheta = sqrt(1.0 - r1);
    float phi = M_TWO_PI * r2;
    float sinTheta = sqrt(max(0.0, 1.0 - cosTheta*cosTheta));
    float sinPhi = sin(phi);
    float cosPhi = cos(phi);

    return vec3(cosPhi * sinTheta, sinPhi * sinTheta, cosTheta);
}

void getRandomPointOnLight(Light l, inout vec3 lightPoint, inout vec3 lightNormal, inout uvec4 state) {
    float r1 = rand(state);
    float r2 = rand(state);
    float sqrtr1 = sqrt(r1);
    vec3 C = vec3(1.0 - sqrtr1, sqrtr1 * (1.0 - r2), r2 * sqrtr1);
    lightPoint = C.x * l.p + C.y * l.q + C.z * l.r;
    lightNormal = C.x * l.np + C.y * l.nq + C.z * l.nr;
    //lightPoint += 0.001 * lightNormal;
}
/*
vec3 larBVH2(vec4 ro, vec4 rd, inout uvec4 state1, inout uvec4 state2) {
    vec3 frac = vec3(1.0);
    vec3 ans = vec3(0.0);
    int rayBounce = 0;
    do {
        IntersectRec ir;
        if (BVHIntersect(ro, rd, ir)) {
            Material mat = fetchMaterialFromTex(ir.materialIndex);

            ans += frac * mat.emission; // count emissive component

            rayBounce++;

            if (rayBounce == 4 || length(frac) < .01) break;

            ro = ir.P; // ray origin for next bounce is intersection point

            rd.xyz =  diffuseReflect(rd.xyz, ir.N.xyz, state1, state2); // get reflected direction for next bounce
            //rd.xyz = vec3(300.0, 548.8, 300.0) - ir.P.xyz;
            rd.xyz /= length(rd.xyz);
            ro.xyz += ir.N.xyz*.001;
            frac *= mat.diffuse * M_PI; 
        } else {
            break;
        }
    } while (true);

    return ans;
}
*/


// get random point on random light
LightRec getRandomLightRec(IntersectRec ir, inout uvec4 state) {
    LightRec lr;
    // randomly choose a light to sample
    int lightIndex = int(floor(rand(state) * float(u_numLights)));
    lr.light = fetchLightFromTex(lightIndex);

    // generate ray to random point on that light
    vec3 lightPoint;
    getRandomPointOnLight(lr.light, lightPoint, lr.lightNormal, state);
    lr.vecToLight = lightPoint - ir.P.xyz;
    return lr;
}

// oren_nayar_brdf

// ultimately want to calculate EDL with arbitrary rays, i.e. generated to conform to surface brdf

vec3 EDL(LightRec lr, IntersectRec ir, Material mat, inout uvec4 state) {
    float lightDist = length(lr.vecToLight);
    lr.vecToLight /= lightDist;

    ir.P.xyz += ir.N.xyz * .001;

    // trace ray
    if (BVHIntersectYN(ir.P, vec4(lr.vecToLight, 1.0), lightDist - .1)) return vec3(0.0);

    // compute contribution
    return float(u_numLights) * lr.light.color * (lr.light.area / (lightDist*lightDist)) * dot(lr.lightNormal, -lr.vecToLight) * dot(ir.N.xyz, lr.vecToLight);

}
/*
vec3 larBVHEDL(vec4 ro, vec4 rd, inout uvec4 state1, inout uvec4 state2) {
    vec3 frac = vec3(1.0);
    vec3 ans = vec3(0.0);
    vec3 EDLpart = vec3(0.0);
    int rayBounce = 0;
    IntersectRec ir;
    bool CEL = true; //vec3(1.0);
    // first intersection in scene
    


    // trace shadow ray from intersection surface
    // rake ray to light for now


    // 
    do {

        if (rayBounce == 4 || !BVHIntersect(ro, rd, ir)) break;
        
        Material mat = fetchMaterialFromTex(ir.materialIndex);
        frac *= .5 * mat.diffuse * M_PI; // weight reflected ray by .5
        
        ans += .5 * frac * EDL(ir, mat, state1) * dot(-rd.xyz, ir.N.xyz); // weight EDL ray by .5
        if (CEL) {
            ans += frac * mat.emission; // if we're counting emitted light
            CEL = false; // turn off count emitted light -- will be used again once specular surfaces implemented
        }

        ro = ir.P; // ray origin for next bounce is intersection point
        rd.xyz =  diffuseReflect(rd.xyz, ir.N.xyz, state1, state1); // get reflected direction for next bounce
        //rd.xyz = vec3(300.0, 548.8, 300.0) - ir.P.xyz;
        rd.xyz /= length(rd.xyz);
        ro.xyz += ir.N.xyz*.001;

        rayBounce++;

    } while (true);

    return ans;
}
*/

float cos2Theta(vec3 w) {
    return w.z * w.z;
}

float sin2Theta(vec3 w) {
    return max(0.0, 1.0 - cos2Theta(w));
}

float cosTheta(vec3 w) {
    return w.z;
}

float absCosTheta(vec3 w) {
    return abs(w.z);
}

float sinTheta(vec3 w) {
    return sqrt(sin2Theta(w));
}

float tanTheta(vec3 w) {
    return sinTheta(w) / cosTheta(w);
}

float tan2Theta(vec3 w) {
    return sin2Theta(w) / cos2Theta(w);
}

float cosPhi(vec3 w) {
    float sinTheta = sinTheta(w);
    return (sinTheta == 0.0) ? 1.0 : clamp(w.x / sinTheta, -1.0, 1.0);
}

float sinPhi(vec3 w) {
    float sinTheta = sinTheta(w);
    return (sinTheta == 0.0) ? 0.0 : clamp(w.y / sinTheta, -1.0, 1.0);
}

float cos2Phi(vec3 w) {
    float cp = cosPhi(w);
    return cp * cp; 
}

float sin2Phi(vec3 w) {
    float sp = sinPhi(w);
    return sp*sp;
}

float cosDPhi(vec3 wa, vec3 wb) {
    return clamp ((wa.x * wb.x + wa.y * wb.y) /
        sqrt((wa.x * wa.x + wa.y * wa.y) *
             (wb.x * wb.x + wb.y * wb.y)), -1.0, 1.0);
}

vec3 sphericalDirection(float sinTheta, float cosTheta, float phi) {
    return vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
}

bool sameHemisphere(vec3 a, vec3 b) {
    return a.z * b.z > 0.0;
}


vec3 oren_nayar_brdf(vec3 wo, vec3 wi, IntersectRec ir, Material mat, inout uvec4 state) {
    // this should all be done in the coordinate system with ir.N = 0, 0, 1
    // then transformed at the end
    float sinThetaI = sinTheta(wi);
    float sinThetaO = sinTheta(wo);
    float maxCos = 0.0;
    if (sinThetaI > .0001 && sinThetaO > .0001) {
        float sinPhiI = sinPhi(wi);
        float cosPhiI = cosPhi(wi);
        float sinPhiO = sinPhi(wo);
        float cosPhiO = cosPhi(wo);
        float dCos = cosPhiI * cosPhiO + sinPhiI * sinPhiO;
        maxCos = max(0.0, dCos);
    }

    float sinAlpha, tanBeta;
    if (absCosTheta(wi) > absCosTheta(wo)) {
        sinAlpha = sinThetaO;
        tanBeta = sinThetaI / absCosTheta(wi);
    } else {
        sinAlpha = sinThetaI;
        tanBeta = sinThetaO / absCosTheta(wo);
    }
    return mat.diffuse * (mat.data.x + mat.data.y * maxCos * sinAlpha * tanBeta);
}

float fresnelDielectric(inout float cosThetaI, inout float etaI, inout float etaT, out float cosThetaT) {
    cosThetaI = clamp(cosThetaI, -1.0, 1.0);
    cosThetaI = abs(cosThetaI);

    float sinThetaI = sqrt(max(0.0, 1.0 - cosThetaI * cosThetaI));
    float sinThetaT = (etaI / etaT) * sinThetaI;
    if (sinThetaT >= 1.0) {
        return 1.0; // TIR
    }
    cosThetaT = sqrt(max(0.0, 1.0 - sinThetaT * sinThetaT));
    float Rpara = ((etaT * cosThetaI) - (etaI * cosThetaT)) / 
                  ((etaT * cosThetaI) + (etaI * cosThetaT));
    float Rperp = ((etaI * cosThetaI) - (etaT * cosThetaT)) /
                  ((etaI * cosThetaI) + (etaT * cosThetaT));
    return 0.5 * (Rpara * Rpara + Rperp * Rperp);
}

vec3 specularReflect(vec3 wo) {
    return vec3(-wo.x, -wo.y, wo.z); // -wo - vec3(0, 0, 1) * cosTheta(-wo) * 2.0f;
}

vec3 specularReflect(vec3 wo, vec3 wh) {
    return 2.0 * dot(wo, wh) * wh - wo;
}

bool specularRefract(vec3 wo, float cosThetaI, float cosThetaT, float eta, out vec3 wi) {
    // total internal reflection gives no transmitted radiance already in the Fresnel term
    
    //vec3 N = vec3(0.0, 0.0, 1.0);
    /*
    if (wo.z < 0.0) {
        N.z = -1.0;
    }
    */
    /*
    cosThetaI = dot(N, wo);
    float sin2ThetaI = max(0.0, 1.0 - cosThetaI * cosThetaI);
    float sin2ThetaT = eta * eta * sin2ThetaI;
    if (sin2ThetaT >= 1.0) return false;
    cosThetaT = sqrt(1.0 - sin2ThetaT);
    */
    wi = eta * -wo + (eta * cosThetaI - cosThetaT) * vec3(0, 0, 1);
    //wi = -wo;
    return true;
}

vec3 fresnelConductor(inout float cosThetaI, vec3 etaI, vec3 etaT, vec3 k) {
    //cosThetaI = min(.1, cosThetaI);
    vec3 eta = etaT / etaI;
    vec3 tmp = (eta*eta + k*k) * cosThetaI*cosThetaI;
    vec3 Rpar12 = (tmp - (2.0 * eta * cosThetaI) + 1.0) / (tmp + (2.0 * eta * cosThetaI) + 1.0);
    vec3 tmp_f = eta*eta + k*k;
    vec3 Rperp2 = (tmp_f - (2.0 * eta * cosThetaI) + cosThetaI*cosThetaI) / (tmp_f + (2.0 * eta * cosThetaI) + cosThetaI*cosThetaI);
    return 0.5 * (Rpar12 + Rperp2);    
/*
    cosThetaI = clamp(cosThetaI, -1.0, 1.0);
    vec3 eta = etaT / etaI;
    vec3 etak = k / etaI;
    float cosThetaI2 = cosThetaI * cosThetaI;
    float sinThetaI2 = 1.0 - cosThetaI2;
    vec3 eta2 = eta * eta;
    vec3 etak2 = etak * etak;

    vec3 t0 = eta2 - etak2 - vec3(sinThetaI2);
    vec3 a2plusb2 = sqrt(t0 * t0 + 4.0 * eta2 * etak2);
    vec3 t1 = a2plusb2 + vec3(cosThetaI2);
    vec3 a = sqrt(0.5 * (a2plusb2 + t0));
    vec3 t2 = 2.0 * cosThetaI * a;
    vec3 Rs = (t1 - t2) / (t1 + t2);

    vec3 t3 = cosThetaI2 * a2plusb2 + vec3( sinThetaI2 * sinThetaI2);
    vec3 t4 = t2 * sinThetaI2;
    vec3 Rp = Rs * (t3 - t4) / (t3 + t4);

    return 0.5 * (Rp + Rs);
    */
    //return t1;
}

vec3 F2(vec3 etaI, vec3 etaT, float cosThetaI) {
    vec3 R0 = (etaI - etaT) / (etaI + etaT);
    R0 *= R0;
    float tmp = (1.0 - cosThetaI);
    return R0 + (vec3(1.0) - R0) * tmp*tmp*tmp*tmp*tmp;
}

vec3 sampleMicrofacetDistribution(float alpha, uvec4 state1) {
    float logSample = log(rand(state1));
    if (logSample > 9999999.0) logSample = 0.0;
    float tan2Theta = -alpha * alpha * logSample;
    float phi = rand(state1) * M_TWO_PI;
    float cosTheta = 1.0 / sqrt(1.0 + tan2Theta);
    float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
    return sphericalDirection(sinTheta, cosTheta, phi);
    //return sphericalDirection(rand(state1), rand(state1), rand(state1));
}

float D_Beckmann(vec3 wh, float cosThetaI, float alpha) {
    float t2t = tan2Theta(wh);
    if (t2t > 99999.0) return 0.0;
    float c4t = cos2Theta(wh) * cos2Theta(wh);
    float a2 = alpha * alpha;
    return exp(-t2t * (cos2Phi(wh) / a2 + sin2Phi(wh) / a2)) / (M_PI * a2 * c4t);
    /*
    float cti2 = cosThetaI * cosThetaI;
    float a2 = alpha * alpha;
    float expMe = (cti2 - 1.0) / (a2 * cti2);
    return (1.0 / (M_PI * a2 * cti2 * cti2)) * exp(expMe);
    */
}

float G_Beckmann(float cosThetaI, float alpha) {
    float c = cosThetaI / (alpha * sqrt(max(0.0, 1.0 - cosThetaI * cosThetaI)));
    if (c < 1.6) {
        return (3.535*c + 2.181 * c*c) / (1.0 + 2.276*c + 2.577 * c*c);
    }
    else {
        return 1.0;
    }
}

vec3 larBVHEDL2(vec4 ro, vec4 rd, inout uvec4 state1, inout uvec4 state2) {
    vec3 frac = vec3(1.0);
    vec3 ans = vec3(0.0);
    vec3 EDLpart = vec3(0.0);
    int rayBounce = 0;
    IntersectRec ir;
    bool CEL = true; //vec3(1.0);
    bool flipped = false;
    do {

        if (!BVHIntersect(ro, rd, ir)) {
            break;
        }
        
        Material mat = fetchMaterialFromTex(ir.materialIndex);
        
        if (CEL && length(mat.emission) > .01) {
            ans += frac * mat.emission; 
            //break;
        }

        if (dot(ir.N.xyz, -rd.xyz) < 0.0) {
            flipped = true;
            ir.N.xyz = -ir.N.xyz;
        }

        mat3 surfaceBasis = makeONB(ir.N.xyz);
        mat3 invSurfaceBasis = inverse(surfaceBasis);
        vec3 wo = invSurfaceBasis * -rd.xyz; // transform incoming direction into surface local coordinates
        
        vec3 wi; // filled in by samplers

        if (mat.type == PURE_DIFFUSE) {
            LightRec lr = getRandomLightRec(ir, state1);
            ans += frac * mat.diffuse * EDL(lr, ir, mat, state1) * cosTheta(wo); // add EDL component, weighted by .5

            frac *= mat.diffuse; // brdf is R * M_INV_PI, pdf is cos(theta) * M_INV_PI; cos(theta) and M_INV_PI terms cancel

            ro = ir.P; // ray origin for next bounce is intersection point
            wi = cosineHemisphericSample(state1); // get reflected direction for next bounce
            //rd.xyz = vec3(300.0, 548.8, 300.0) - ir.P.xyz;
            rd.xyz = surfaceBasis * wi;
            //rd.xyz /= length(rd.xyz);
            ro.xyz += ir.N.xyz*.001;
            CEL = false;
        }
        else if (mat.type == MIRROR) {
            // do specular stuph
            /*
            rd.xyz = rd.xyz - ir.N.xyz * dot(ir.N.xyz, rd.xyz) * 2.0f;
            rd.xyz /= length(rd.xyz);
            ro.xyz = ir.P.xyz + ir.N.xyz * .001;

            */
            wi = specularReflect(wo);
            rd.xyz = surfaceBasis * wi;
            ro = ir.P;
            ro.xyz += ir.N.xyz * .001;

            frac *= mat.specular;
            CEL = true; // count emitted light for next bounce
        }
        else if (mat.type == GLASS) {
            // compute Fresnel term
            float cosThetaI = cosTheta(wo);
            float etaI = 1.00029; 
            
            float etaT = mat.data.x; 
            float cosThetaT;
            
            
            if (flipped) {
                float tmp = etaT;
                etaT = etaI;
                etaI = tmp;
            }

            float F = fresnelDielectric(cosThetaI, etaI, etaT, cosThetaT); // one medium is always air

            if (rand(state1) < F) {
                // do perfect specular reflection
                wi = specularReflect(wo);
                frac *= mat.specular; // / absCosTheta(wi); // there is an F term in the numerator, but pdf of choosing this ray is also F so they cancel.
            }

            else {
                // do perfect specular transmission
        
                //return vec3(0, 0, .2);
                if (!specularRefract(wo, cosThetaI, cosThetaT, etaI / etaT, wi)) return vec3(0.0);
                //else return clamp(surfaceBasis * wi, 0.0, 1.0);
                frac *= mat.specular;// / absCosTheta(wi);

            }

            rd.xyz = surfaceBasis * wi;
            ro = ir.P;
            ro.xyz += rd.xyz * .001;
            CEL = true;
        }
        else if (mat.type == DIELECTRIC) {
            // compute Fresnel term

             
            // trace reflected ray with probability F

            // trace transmitted ray with probability 1 - F
        }
        
        else if (mat.type == CONDUCTOR) {
            // sample distribution to get h (half vector)
            //float alpha = mat.data.x;
            float alpha = mat.data.x;
            vec3 wh = sampleMicrofacetDistribution(alpha, state1);
            float cosThetaI = dot(wo, wh);
            if (cosThetaI < 0.0) {
                wh = -wh;
                cosThetaI = dot(wo, wh);
            }

            // compute F(v, h)
            vec3 k = mat.specular;
            vec3 etaT = mat.transmission;
            vec3 F = fresnelConductor(cosThetaI, vec3(1.00029), etaT, k);
            //vec3 F = F2(vec3(1.00029), etaT, cosThetaI);
            // compute D(h)
            //float D = D_Beckmann(wh, cosThetaI, alpha);

            // compute G(wo, h, wi)
            float G = G_Beckmann(cosThetaI, alpha);

            wi = specularReflect(wo, wh);
            if (!sameHemisphere(wo, wi)) break;

            frac *= (F*G) * cosTheta(wo) / (4.0*cosThetaI*absCosTheta(wh)); // implicit division by pdf = D(wh) * cosThetaI

            // next thing to do -- try cosine hemispheric sampling, which has a known pdf, to see what the edge looks like

            rd.xyz = surfaceBasis * wi;
            ro = ir.P;
            ro.xyz += ir.N.xyz * .1;
            CEL = true;
        }

        else if (mat.type == OREN_NAYAR) {
            // start by multiplying in material color and calculating EDL

            LightRec lr = getRandomLightRec(ir, state1);

            ans += frac * M_INV_PI * oren_nayar_brdf(wo, lr.vecToLight / length(lr.vecToLight), ir, mat, state1) * EDL(lr, ir, mat, state1) * cosTheta(wo);
            
            wi = cosineHemisphericSample(state1);
            frac *= oren_nayar_brdf(wo, wi, ir, mat, state1); 
            // this brdf actually has an INV_PI term, but the cosine sample hemisphere pdf is cos(theta) * M_INV_PI
            // so the cos(theta) and M_INV_PI terms cancel out.
            rd.xyz = surfaceBasis * wi;
            ro = ir.P;
            ro.xyz += rd.xyz * .001;

            CEL = false;

        }
        else if (mat.type == DIFFUSE_SPEC_SHIRLEY) {

        }
        /*
        else if (mat.type == PHONG_METAL) {
            CEL = true;
            float phi = 2.0 * M_PI * rand(state1);
            float r2 = rand(state1);
            float cosTheta = pow(1.0 - r2, 1.0 / (mat.data.x + 1.0));
            float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

            vec3 W = rd.xyz - ir.N.xyz * dot(ir.N.xyz, rd.xyz) * 2.0f;
            vec3 U = cross((abs(W.x) > .1 ? vec3(0, 1, 0) : vec3(1, 0, 0)), W);
            U = U / length(U);
            vec3 V = cross(W, U);

            rd.xyz = U * cos(phi) * sinTheta + V * sin(phi) * sinTheta + W * cosTheta;
            rd.xyz /= length(rd.xyz);
            ro.xyz = ir.P.xyz + rd.xyz * .001;

            frac *= mat.specular;

        }
        */
        if (rayBounce > 4) {
            float q = max(.05, 1.0 - length(frac));
            if (rand(state1) < q) {
                break;
            }
            frac /= 1.0 - q;
        }
        rayBounce++;

    } while (true);

    return ans;
}

vec3 lar(vec4 ro, vec4 rd) {
    IntersectRec bestir;
    bestir.t = 99999.0;
    // loop through all triangles in objects texture, keep closest hit.
    bool hit = false;
    for (uint i = 0u; i < uint(u_numTris); i++) {
        Triangle tri = fetchTriFromTex(i);
        IntersectRec tir;

        if (intersectTriangle(ro, rd, EPS, bestir.t, tri.p, tri.e1, tri.e2, tir)) {
            hit = true;
            bestir = tir;
            bestir.N = vec4(vec3(bestir.uv.x * tri.np + bestir.uv.y * tri.nq + (1.0f - bestir.uv.x - bestir.uv.y) * tri.nr), 0.0);
            //bestir.N = vec4(.4+tc.s*8.0, 0.0, 0.0, 0.0);
        }
    }

    if (hit) {
        return abs(bestir.N.xyz);
        //return vec3(1.0, 0.0, 0.0);
    }
    else {
        return vec3(0.0);
    }
}

void main() {    
  uvec4 local_seed1 = u_seed[0] + floatBitsToUint(vec4(normalize(ray_target.xy), -normalize(ray_target.yx))) * uvec4(u_pass);
  //uvec4 local_seed2 = u_seed[1] + floatBitsToUint(-normalize(ray_target)) + uvec4(u_pass);
  wang_hash(local_seed1);
  float sampleID = mod(float(u_pass), 16.0);
  float sampleRow = sampleID / 4.0;
  float sampleCol = sampleID - (sampleRow * 4.0);

  vec2 dxdy = .25 * (vec2(rand(local_seed1), rand(local_seed1)) - vec2(.5));
  dxdy += vec2(sampleCol * .25, sampleRow * .25);
  dxdy *= 1.0/800.0;
  vec4 rt = ray_target + dxdy.x * u_imagePlane[1] + dxdy.y * u_imagePlane[0];
  vec4 eye = u_imagePlane[3];
  vec4 rd = normalize(rt - eye);



  color = vec4(0.0, 0.0, 0.0, 1.0);
  
      //for (int i = 0; i < numSamples; i++) {
  color.xyz = (u_sampleWeight * larBVHEDL2(eye, rd, local_seed1, local_seed1)) + (1.0 - u_sampleWeight) * texture(u_texBlendWith, texCoord).xyz;;
  //color.xyz = 1.0 * pow(color.xyz, vec3(.85)); 

    //color.xyz = larBVH2(eye, rd, local_seed1, local_seed2);
      //color.w=1.0;
  }
