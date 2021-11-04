#version 300 es
precision highp float;
precision highp sampler3D;
precision highp usampler3D;
#define EPS 0.00001
#define FROM_PARENT 0
#define FROM_CHILD 1
#define FROM_SIBLING 2

uniform int u_numTris;
uniform sampler3D u_texObjects;
uniform usampler3D u_texBVH;
uniform mat4 u_imagePlane;

in vec4 ray_target;
in vec2 v_pointSize;
out vec4 color;

float ds = 1.0 / 2048.0;

struct IntersectRec {
    vec4 P;
    vec4 N;
    vec2 uv;
    float t;
};

struct Triangle {
    vec3 p;
    vec3 q;
    vec3 r;

    vec3 np;
    vec3 nq;
    vec3 nr;

    vec2 uvp;
    vec2 uvq;
    vec2 uvr;
};

struct BVHNode {
    vec3 min;
    vec3 max;
    uvec2 d;
};

bool intersectBBox(in vec4 ro, in vec4 invrd, in vec4 bbmin, in vec4 bbmax, float farthest) {
    vec3 minInterval = (bbmin.xyz - ro.xyz) * invrd.xyz;
    vec3 maxInterval = (bbmax.xyz - ro.xyz) * invrd.xyz;
    
    vec3 a = min(minInterval.xyz, maxInterval.xyz);
    vec3 b = max(minInterval.xyz, maxInterval.xyz);

    float tmin = max(max(a.x, a.y), a.z); 
    float tmax = min(min(b.x, b.y), b.z);

    return (farthest > tmin) && (tmin <= tmax) && (tmax >= 0.0);    
}

bool intersectBBox2(in vec4 ro, in vec4 invrd, in vec4 bbmin, in vec4 bbmax, out float enter, out float exit) {
    float tmin = (bbmin.x - ro.x) * invrd.x;
    float tmax = (bbmax.x - ro.x) * invrd.x;
    float tmp;
    if (tmin > tmax) {
        tmp = tmin;
        tmin = tmax;
        tmax = tmp;
    }

    float tymin = (bbmin.y - ro.y) * invrd.y;
    float tymax = (bbmax.y - ro.y) * invrd.y;

    if (tymin > tymax) {
        tmp = tymin;
        tymin = tymax;
        tymax = tmp;
    }

    if ((tmin > tymax) || (tymin > tmax))
        return false;

    if (tymin > tmin)
        tmin = tymin;

    if (tymax < tmax)
        tmax = tymax;

    float tzmin = (bbmin.z - ro.z) * invrd.z;
    float tzmax = (bbmax.z - ro.z) * invrd.z;

    if (tzmin > tzmax) {
        tmp = tzmin;
        tzmin = tzmax;
        tzmax = tmp;
    }

    if ((tmin > tzmax) || (tzmin > tmax))
        return false;

    if (tzmin > tmin)
        tmin = tzmin;

    if (tzmax < tmax)
        tmax = tzmax;

    return true; 
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

bool intersectTriangle(in vec4 ro, in vec4 rd, in float tmin, in float tmax, in vec3 v0, in vec3 v1, in vec3 v2, out IntersectRec ir) {
    vec3 e1 = v1 - v0;
    vec3 e2 = v2 - v0;
    vec3 pvec = cross(rd.xyz, e2);
    float det = dot(e1, pvec);
    if (abs(det) < EPS) return false;

    float invDet = 1.0 / det;
    vec3 tvec = ro.xyz - v0;
    ir.uv.x = dot(tvec, pvec) * invDet;
    if (ir.uv.x < 0.0 || ir.uv.x > 1.0) return false;

    vec3 qvec =cross(tvec, e1);
    ir.uv.y = dot(rd.xyz, qvec) * invDet;
    if (ir.uv.y < 0.0 || (ir.uv.x+ir.uv.y > 1.0)) return false;

    ir.t = dot(e2, qvec) * invDet;
    if (ir.t < tmin || ir.t > tmax) return false;

    ir.P = ro + ir.t * rd;
    return true;
}

                // if leaf node
                // d0 is [32 bits for starting triangle id]
                // d1 is [2 bits indicating leaf] [1 bit near or far] [29 bits for number of triangles]
                
                // if internal node:
                // d0 is [2 bit split axis] [30 bit far child id]
                // d1 is [1 bit for near/far] [31 bits for parent id]

ivec2 children(int nodeID, BVHNode node, bvec3 rayBits) {
    int axis = int(node.d.x >> 30);
    if (axis == 3) return ivec2(-1);
    ivec2 children = ivec2(nodeID + 1, node.d.x & 1073741823u);
    //return children.yx; 
    if (rayBits[axis]) {
        return children;
    }
    else {
        return children.yx;
    }
}

ivec2 leafStartNum(BVHNode node) {
   return ivec2(int(node.d.x), int(node.d.y & 536870911u)); // = 0x1FFFFFFF 
}

bool isLeaf(BVHNode node) {
    uint bits = node.d.y >> 30;
    return (bits == 3u);
}

int parent(int id, BVHNode node) {
    if (isLeaf(node)) {
        // 3rd bit from left is 0 if near, 1 if far
        if ((node.d.y & 536870912u) >> 29 == 0u) {
            return id - 1;
        }
        else return id - 2;
    }
    return int(node.d.y & 2147483647u);
}

int leafSibling(int id, BVHNode node) {
    if ((node.d.y & 536870912u) >> 29 == 0u) { // isLeft?
        return id + 1;
    }
    return id - 1;
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
    uvec4 d1 = texture(u_texBVH, tc);
    uvec4 d2 = texture(u_texBVH, vec3(tc.s+ds, tc.t, tc.r));
    BVHNode ans;
    ans.min = uintBitsToFloat(d1.xyz);
    ans.max = uintBitsToFloat(uvec3(d1.w, d2.xy));
    ans.d = d2.zw;
    return ans;
}

vec3 triIndexToTexCoords(int index) {
    index *= 8;
    int k = index / (2048*2048);
    int j = (index - k*2048*2048) / 2048;
    int i = index - k*2048*2048 - j*2048;
    return vec3(float(i) * ds, float(j) * ds, float(k) * ds);
}

Triangle fetchTriFromTex(int index) {

    // grab triangle from texture
    // p, q, r, np, nq, nr, uvp, uvq, uvr
    //uvec3 tc;
    //uint i8 = uint(i) * 8u;
    
    //tc.s = i8 - (2048u * (i8 / 2048u)); // (i*8) % 2048
    //tc.t = i8 - (2048u*2048u * (i8 / (2048u*2048u))); // (i*8) % 2048*2048
    //tc.r = i8 / (2048u*2048u);
    //tc.s = 2444u;
    //tc.t = 1u;
    //tc.r = 0u;
    
    //vec4 d1 = texelFetch(u_texObjects, ivec3(tc), 0);
    //vec4 d2 = texelFetch(u_texObjects, ivec3(tc.s+1u, tc.t, tc.r), 0);
    //vec4 d3 = texelFetch(u_texObjects, ivec3(tc.s+2u, tc.t, tc.r), 0);
    //vec4 d4 = texelFetch(u_texObjects, ivec3(tc.s+3u, tc.t, tc.r), 0);
    //vec4 d5 = texelFetch(u_texObjects, ivec3(tc.s+4u, tc.t, tc.r), 0);
    //vec4 d6 = texelFetch(u_texObjects, ivec3(tc.s+5u, tc.t, tc.r), 0);

    //float ds = 1.0 / 2048.0;
    //vec3 tc = vec3(float(index*8)/2048.0, 0.0, 0.0);
    vec3 tc = triIndexToTexCoords(index);
    vec4 d1 = texture(u_texObjects, tc);
    vec4 d2 = texture(u_texObjects, vec3(tc.s+ds, tc.t, tc.r));
    vec4 d3 = texture(u_texObjects, vec3(tc.s+2.f*ds, tc.t, tc.r));
    vec4 d4 = texture(u_texObjects, vec3(tc.s+3.f*ds, tc.t, tc.r));
    vec4 d5 = texture(u_texObjects, vec3(tc.s+4.f*ds, tc.t, tc.r));
    vec4 d6 = texture(u_texObjects, vec3(tc.s+5.f*ds, tc.t, tc.r));

    Triangle ans;

    ans.p = d1.xyz;
    ans.q = vec3(d1.w, d2.xy);
    ans.r = vec3(d2.zw, d3.x);

    ans.np = d3.yzw;
    ans.nq = d4.xyz;
    ans.nr = vec3(d4.w, d5.xy);

    ans.uvp = d5.zw;
    ans.uvq = d6.xy;
    ans.uvr = d6.zw;

    return ans;
}

vec3 larBVH3(vec4 ro, vec4 rd) {

    vec4 invrd = vec4(1.0) / rd;
    bvec3 rayBits = bvec3(rd.x > 0.0, rd.y > 0.0, rd.z > 0.0);
    
    IntersectRec bestir;
    bestir.t = 99999.0;
       
    bool hit = false;
    int current = 0;
    BVHNode node = fetchBVHNodeFromTex(current);
    ivec2 nearFar = children(current, node, rayBits);

    current = nearFar.x;
    int last = 0;
    int state = FROM_PARENT;

    vec3 ans;
    int i = 0;
    while (current != 0 && i < 1000) {
        i++;
        node = fetchBVHNodeFromTex(current);
        nearFar = children(current, node, rayBits);

        if (last == nearFar.y) {
            last = current;
            current = parent(current, node);
            continue;
        }
        int tryChild = (last == parent(current, node)) ? nearFar.x : nearFar.y;
        if (intersectBBox(ro, invrd, vec4(node.min, 1.0), vec4(node.max, 1.0), bestir.t)) {
            if (isLeaf(node)) {
            //    return vec3(.4);
                // process leaf

                ivec2 startNum = leafStartNum(node);
                for (int j = startNum.x; j < startNum.x+startNum.y; j++) {
                    Triangle tri = fetchTriFromTex(j);
                    IntersectRec tir;
                    if (intersectTriangle(ro, rd, EPS, bestir.t, tri.p, tri.q, tri.r, tir)) {
                        hit = true;
                        bestir = tir;
                        bestir.N = vec4(vec3(bestir.uv.x * tri.np + bestir.uv.y * tri.nq + (1.0f - bestir.uv.x - bestir.uv.y) * tri.nr), 0.0);
                        //bestir.N = vec4(.4+tc.s*8.0, 0.0, 0.0, 0.0);
                    }
                }

                // go on to sibling of leaf or back up to parent

                if (last == parent(current, node)) {
                    last = current;
                    current = leafSibling(current, node);
                } else {
                    last = current;
                    current = parent(current, node);
                }
            }
            else {
                last = current;
                current = tryChild;
            }
        }
        else {
            if (isLeaf(node)) {
                if (last == parent(current, node)) {
                    last = current;
                    current = leafSibling(current, node);
                } else {
                    last = current;
                    current = parent(current, node);
                }
            } else {
                if (tryChild == nearFar.x) {
                    last = nearFar.x;
                }
                else {
                    last = current;
                    current = parent(current, node);
                }
            }
        }
    }
    if (hit) return abs(bestir.N.xyz);
    else if (i == 1000) return vec3(1.0, 1.0, 0.0);
    return vec3(0.0);
}

vec3 larBVH2(vec4 ro, vec4 rd) {
    vec4 invrd = vec4(1.0) / rd;
    bvec3 rayBits = bvec3(rd.x > 0.0, rd.y > 0.0, rd.z > 0.0);
    
    IntersectRec bestir;
    bestir.t = 99999.0;
       
    bool hit = false;
    int current = 0;
    BVHNode node = fetchBVHNodeFromTex(current);
    ivec2 nearFar = children(current, node, rayBits);

    current = nearFar.x;
    int state = FROM_PARENT;

    vec3 ans;

    for (int i = 0; i < 1000; i++) {
        node = fetchBVHNodeFromTex(current);
        ivec2 nearFar = children(current, node, rayBits);

        //if (isLeaf(node)) return vec3();
        //if (nearFar.y == 16) return vec3(1.0, 0.0, 0.0);
        //else return vec3(0.0, 1.0, 0.0);
        if (state == FROM_CHILD) {
            if (current == 0) {
                if (hit) return abs(bestir.N.xyz);
                else return vec3(0.0);
            }
            int parentID = parent(current, node);
            BVHNode parentNode = fetchBVHNodeFromTex(parentID);
            ivec2 nf = children(parentID, parentNode, rayBits);
            if (current == nf.x) {
                current = nf.y;
                state = FROM_SIBLING;
            }
            else {
                current = parent(current, node);
                state = FROM_CHILD;
            }
        }
        else if (state == FROM_SIBLING) {
            if (!intersectBBox(ro, invrd, vec4(node.min, 1.0), vec4(node.max, 1.0), bestir.t)) {
                current = parent(current, node);
                state = FROM_CHILD;
            }
            else if (isLeaf(node)) {
                // test all triangles in node
                ivec2 startNum = leafStartNum(node);
                for (int j = startNum.x; j < startNum.x+startNum.y; j++) {
                    Triangle tri = fetchTriFromTex(j);
                    IntersectRec tir;
                    if (intersectTriangle(ro, rd, EPS, bestir.t, tri.p, tri.q, tri.r, tir)) {
                        hit = true;
                        bestir = tir;
                        bestir.N = vec4(vec3(bestir.uv.x * tri.np + bestir.uv.y * tri.nq + (1.0f - bestir.uv.x - bestir.uv.y) * tri.nr), 0.0);
                        //bestir.N = vec4(.4+tc.s*8.0, 0.0, 0.0, 0.0);
                    }
                }

                current = parent(current, node);
                state = FROM_CHILD;
            }
            else {
                current = nearFar.x;
                state = FROM_PARENT;
            }
        }
        else { // state is FROM_PARENT
            if (!intersectBBox(ro, invrd, vec4(node.min, 1.0), vec4(node.max, 1.0), bestir.t)) {
                //return vec3(0.0, 0.0, 1.0);
                int parentID = parent(current, node);
                BVHNode parentNode = fetchBVHNodeFromTex(parentID);
                ivec2 nf = children(parentID, parentNode, rayBits);
                if (current == nf.x) current = nf.y;
                else current =  nf.x;
                state = FROM_SIBLING;
            }
            else if (isLeaf(node)) {
                //return vec3(1.0);
                // easy opportunity for optimization here -- but first we'll do it all out longhand
                
                // test all triangles in node
                
                ivec2 startNum = leafStartNum(node);
                for (int j = startNum.x; j < startNum.x+startNum.y; j++) {
                    Triangle tri = fetchTriFromTex(j);
                    IntersectRec tir;
                    if (intersectTriangle(ro, rd, EPS, bestir.t, tri.p, tri.q, tri.r, tir)) {
                        hit = true;
                        bestir = tir;
                        bestir.N = vec4(vec3(bestir.uv.x * tri.np + bestir.uv.y * tri.nq + (1.0f - bestir.uv.x - bestir.uv.y) * tri.nr), 0.0);
                        //bestir.N = vec4(.4+tc.s*8.0, 0.0, 0.0, 0.0);
                    }
                }


                int parentID = parent(current, node);
                BVHNode parentNode = fetchBVHNodeFromTex(parentID);
                ivec2 nf = children(parentID, parentNode, rayBits);
                if (current == nf.x) current = nf.y;
                else current = nf.x;
                state = FROM_SIBLING;
                
            }
            
            else {

                //return vec3(0.5);
                
                current = nearFar.x;
                state = FROM_PARENT;
                
            }
        }    
    }

    return vec3(1.0, 1.0, 0.0);
}

vec3 larBVH(vec4 ro, vec4 rd) {
    vec4 invrd = vec4(1.0) / rd;
    bvec3 rayBits = bvec3(rd.x > 0.0, rd.y > 0.0, rd.z > 0.0);
    IntersectRec bestir;
    bestir.t = 99999.0;
    
    // for now, loop through BVH and, if the node is a leaf, check all triangles in it.
    
    bool hit = false;

    BVHNode root = fetchBVHNodeFromTex(0);
    
    if (!intersectBBox(ro, invrd, vec4(root.min, 0.0), vec4(root.max, 0.0), bestir.t)) {
        return vec3(0.0, 0.0, 1.0);
    }

    ivec2 rootChildren = children(0, root, rayBits);
    int current = rootChildren.x;
    int last = 0;

    do {
        BVHNode node = fetchBVHNodeFromTex(current);
        ivec2 nearFar = children(current, node, rayBits);
//        if (last == nearFar.y) {
//            last = current;
//            current = parent(node);
//            continue;
//        }

        int tryChild = (last == parent(current, node)) ? nearFar.x : nearFar.y;
       
        node = fetchBVHNodeFromTex(5);
        //node.min = vec3(0, 0, 0);
        //node.max = vec3(556, 548.8, 559.2);
        if (intersectBBox(ro, invrd, vec4(node.min, 0.0), vec4(node.max, 0.0), bestir.t)) {
            return vec3(0.0, 1.0, 0.0);
            if (isLeaf(node)) {
                // test all triangles in node
                ivec2 startNum = leafStartNum(node);
                for (int j = startNum.x; j < startNum.x+startNum.y; j++) {
                    Triangle tri = fetchTriFromTex(j);
                    IntersectRec tir;
                    if (intersectTriangle(ro, rd, EPS, bestir.t, tri.p, tri.q, tri.r, tir)) {
                        hit = true;
                        bestir = tir;
                        bestir.N = vec4(vec3(bestir.uv.x * tri.np + bestir.uv.y * tri.nq + (1.0f - bestir.uv.x - bestir.uv.y) * tri.nr), 0.0);
                        //bestir.N = vec4(.4+tc.s*8.0, 0.0, 0.0, 0.0);
                    }
                }

            }
            else {
                last = current;
                current = tryChild;
            }
        }
        else {
            if (tryChild == nearFar.x) {
                last = nearFar.x;
            }
            else {
                last = current;
                current = parent(current, node);
            }
        }
    } while (current != 0);
    


    

/*

    for (int i = 0; i < 31; i++) {
        BVHNode node = fetchBVHNodeFromTex(i);

        if (isLeaf(node)) {
            return vec3(0.0, 1.0, 0.0);
            ivec2 startNum = leafStartNum(node);
            float tEnter, tExit;
//bool intersectBBox(in vec4 ro, in vec4 invrd, in vec4 bbmin, in vec4 bbmax, out float enter, out float exit) {
            if (intersectBBox(ro, invrd, vec4(node.min, 0.0), vec4(node.max, 0.0), tEnter, tExit)) {
                for (int j = startNum.x; j < startNum.x+startNum.y; j++) {
                    Triangle tri = fetchTriFromTex(j);
                    IntersectRec tir;
                    if (intersectTriangle(ro, rd, EPS, bestir.t, tri.p, tri.q, tri.r, tir)) {
                        hit = true;
                        bestir = tir;
                        bestir.N = vec4(vec3(bestir.uv.x * tri.np + bestir.uv.y * tri.nq + (1.0f - bestir.uv.x - bestir.uv.y) * tri.nr), 0.0);
                        //bestir.N = vec4(.4+tc.s*8.0, 0.0, 0.0, 0.0);
                    }
                }
            }
        }

    }
*/
    if (hit) {
        return abs(bestir.N.xyz);
        //return vec3(1.0, 0.0, 0.0);
    }
    else {
        return vec3(1.0);
    }
    
}

vec3 lar(vec4 ro, vec4 rd) {
    IntersectRec bestir;
    bestir.t = 99999.0;
    // loop through all triangles in objects texture, keep closest hit.
    bool hit = false;
    for (int i = 0; i < u_numTris; i++) {
        Triangle tri = fetchTriFromTex(i);
        IntersectRec tir;

        if (intersectTriangle(ro, rd, EPS, bestir.t, tri.p, tri.q, tri.r, tir)) {
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

/*
    if (intersectSphere(ro, rd, tir)) {
        return dot(tir.N.xyz, vec3(0.0, 1.0, 0.0)) * vec3(.2, .2, 1.0);
    }
    else {
        return vec3(0.0, 0.0, 0.0);
    }
*/
}

void main() {
    
  //vec4 texSample = texture2D(u_texParticle, vec2(gl_PointCoord.s, gl_PointCoord.t));
  vec4 eye = u_imagePlane[3];
  vec4 rd = normalize(ray_target - eye);
  //color = vec4(lar(eye, rd), 1.0);
  color = vec4(larBVH2(eye, rd), 1.0);
}
