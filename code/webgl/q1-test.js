"use strict";

var v3 = twgl.v3;
var m4 = twgl.m4;
var gl = twgl.getWebGLContext(document.getElementById("c"));
if (!gl.getExtension("OES_texture_float")) {
  alert("Float textures not supported.");
}
if (!gl.getExtension("OES_element_index_uint")) {
    alert("Unsigned integer indices not supported.");
}


function packTrisInTex(prims) {
    let numTris = 0;

    for (let i = 0; i < prims.length; i++) {
        numTris += prims[i].numTriangles();
    }

    let triTexSize = numTris * 6;
    let triTexWidth = 2048;
    let triTexHeight = 2048;
    let triTexDepth = Math.floor(triTexSize / (triTexWidth * triTexHeight)) + 1;

    let texData = twgl.primitives.createAugmentedTypedArray(4, triTexWidth*triTexHeight*triTexDepth);

    // triangle class: p, q, r; np, nq, nr; uvp, uvq, uvr;

    for (let i = 0; i < prims.length; i++) {
        let tris = prims[i].toTriangles();
        for (let j = 0; j < tris.length; j++) {
            let tri = tris[j];
            texData.push(tri.p, tri.q, tri.r);
            texData.push(tri.np, tri.nq, tri.nr);
            texData.push(tri.uvp, tri.uvq, tri.uvr);
        }
    }

    for (let i = prims.length*6*4; i < texData.length; i++) {
        texData[i] = -999999;
    }

    return texData;
}

var s = Scene.makeCornellBox();

var texData = packTrisInTex(s.primitives);

console.log(s.bbox);
