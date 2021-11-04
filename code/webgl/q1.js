
"use strict";
twgl.setDefaults({attribPrefix: "a_"});

var drawProgramInfo, drawVS, drawFS, drawTextureProgramInfo, drawTextureVS, drawTextureFS;
var to, bto, mto, lto;
var modelSrc, modelName, modelBuffer = null;

var mouseInfo = {
    lastPos: {x: 0.0, y: 0.0},
    curPos: {x: 0.0, y: 0.0},
    buttonDown: [false, false, false],
};

var Quaternion = {
    // w, x, y, z
    mul: function(q1, q2) {
        var out = [0.0, 0.0, 0.0, 0.0];
        var a1 = q1[0], a2 = q2[0],
            b1 = q1[1], b2 = q2[1],
            c1 = q1[2], c2 = q2[2],
            d1 = q1[3], d2 = q2[3];

        out[0] = a1*a2 - b1*b2 - c1*c2 - d1*d2;
        out[1] = a1*b2 + b1*a2 + c1*d2 - d1*c2;
        out[2] = a1*c2 - b1*d2 + c1*a2 + d1*b2;
        out[3] = a1*d2 + b1*c2 - c1*b2 + d1*a2;
        return out;
    },

    fromAxisAngle: function(axis, angle) {
        var out = [0.0, 0.0, 0.0, 0.0];
        var x = axis[0], y = axis[1], z = axis[2];
        var r = 1/Math.sqrt(x*x + y*y + z*z);
        var s = Math.sin(angle/2);
        out[0] = Math.cos(angle/2);
        out[1] = s * x * r;
        out[2] = s * y * r;
        out[3] = s * z * r;
        return out;
    },

    toRotationMatrix: function(q) {
        // w, x, y, z

        var wx = q[0] * q[1];
        var wy = q[0] * q[2];
        var wz = q[0] * q[3];
        var xy = q[1] * q[2];
        var xz = q[1] * q[3];
        var yz = q[2] * q[3];
        var xx = q[1] * q[1];
        var yy = q[2] * q[2];
        var zz = q[3] * q[3];

        var out = m4.identity();
        // column major

        out[0] = 1.0 - 2.0 * yy - 2.0 * zz;
        out[4] = 2.0 * xy + 2.0 * wz;
        out[8] = 2.0 * xz - 2.0 * wy;

        out[1] = 2.0 * xy - 2.0 * wz;
        out[5] = 1.0 - 2.0 * xx - 2.0 * zz;
        out[9] = 2.0 * yz + 2.0 * wx;

        out[2] = 2.0 * xz + 2.0 * wy;
        out[6] = 2.0 * yz - 2.0 * wx;
        out[10] = 1.0 - 2.0 * xx - 2.0 * yy;

        return out;
    },

};

class Trackball {
    constructor(cam) {
        this.quat = [1.0, 0.0, 0.0, 0.0];
        this.startLook = cam.look.slice();
        this.startUp = cam.up.slice();
        this.startRight = cam.right.slice();
        this.camera = cam;
    }

    projectToUnitSphere(xy) {
        let v = v3.create(-xy[0], -xy[1], 0.0); // vec3 with x, y, 0.0
        let d = v3.lengthSq(v);

        if (d > .5) {
            v[2] = .5 / Math.sqrt(d);

        }
        else {
            v[2] = Math.sqrt(1.00001 - d);
        }
        return v3.normalize(v);
    }

    updateCamera(mi) {
        // TO DO: transform projected mouse coordinates on sphere into world coordinates.

        // map mouse positions to vector on unit sphere.
        let v1 = trackball.projectToUnitSphere(mapMouseToUnitPlane(mi.lastPos.x, mi.lastPos.y));
        let v2 = trackball.projectToUnitSphere(mapMouseToUnitPlane(mi.curPos.x, mi.curPos.y));

        // now map these to world coordinates?

        //v1 = m4.transformDirection(scene.worldInverse, v1);
        //v2 = m4.transformDirection(scene.worldInverse, v2);

        let axis = v3.cross(v1, v2); // axis of rotation

        let axisLength = v3.length(axis);
        let dotVal = v3.dot(v1, v2);
        let angle = Math.acos(dotVal);
        //if (dotVal < 0.0) {
         //  angle = -angle;
        //}
        //axis = v3.normalize(axis);
        if (axisLength > 0.00001 && angle > 0.000001) {
            axis = v3.normalize(axis);
            this.quat = Quaternion.mul(this.quat, Quaternion.fromAxisAngle(axis, -angle));

            //scene.worldInverse = m4.inverse(scene.world);

            //scene.world = m4.axisRotate(scene.world, axis, angle);
            //scene.worldInverse = m4.inverse(scene.world);
        }

        let rotation = m4.inverse(Quaternion.toRotationMatrix(this.quat));
        // now rotation has the rotation transformation starting from zero.
        // so, to get the right camera, we rotate the starting vectors by the rotation matrix and them push them out to
        // the eye point?
        //scene.eye = m4.transformPoint(scene.cameraRotation, scene.eye);



        let d = v3.length(v3.subtract(this.camera.eye, scene.centroid()));
        this.camera.up = m4.transformDirection(rotation, this.startUp);
        this.camera.look = m4.transformDirection(rotation, this.startLook); //[0, 0, -1]);
        this.camera.right = m4.transformDirection(rotation, this.startRight);
        this.camera.eye = v3.add(scene.centroid(), v3.mulScalar(this.camera.look, -d));
        this.camera.update();

        //console.log("v1: " + v1);
        //console.log("v2: " + v2);
        //console.log("axis: " + axis);
        //console.log("angle: " + angle);
    }
}

function loadShader(url, cb) {
  var xhttp;
  xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      cb(xhttp);
    }
  };
  xhttp.open("GET", url, true);
  xhttp.send();
}

function loadBinary(url, cb) {
    var xhttp;
    xhttp = new XMLHttpRequest();
    xhttp.open("GET", url, true);
    xhttp.responseType = "blob";
    xhttp.onload = function (oEvent) {
        cb(xhttp);
    }
    xhttp.send();
}

class Camera {
    constructor() {
        this.eye = [0, 0, 6];
    // worldCenter: [0, 0, 0],
        this.up = [0, 1, 0];
        this.look = [0, 0, -1];
        this.right = [1, 0, 0];
        this.imagePlaneCenter = [0, 0, 5];

    //camera: m4.identity(),
    //view: m4.identity(),
    //viewProjection: m4.identity(),
        this.rotation = m4.identity();
    //cameraInverse: m4.identity(),
    }

    zoom(ds) {
        this.eye = v3.add(this.eye, v3.mulScalar(this.look, ds));
        this.update();
    }

    update() {
        //scene.camera = m4.lookAt(scene.eye, scene.target, scene.up);
        //scene.view = m4.inverse(scene.camera);
        //scene.viewProjection = m4.multiply(scene.view, scene.projection);
        //scene.look = v3.normalize(v3.subtract(scene.worldCenter, scene.eye));
        //this.right = v3.normalize(v3.cross(this.look, this.up));
        this.imagePlaneCenter = v3.add(this.eye, this.look);
    }
}

function launch() {
   drawProgramInfo = twgl.createProgramInfo(gl, [drawVS, drawFS]);
   drawTextureProgramInfo = twgl.createProgramInfo(gl, [drawTextureVS, drawTextureFS]);
   requestAnimationFrame(render);
}

function cameraChanged() {
    drawUniforms.u_pass = 0;
}

function packTex(tris, triIndices) {
    if (!tris) {
        tris = scene.toTriangles();
    }

    let texSize = tris.length * 8; // should have more triangles than nodes but still
    let texWidth = 2048;
    let texHeight = 2048;
    let texDepth = Math.floor(texSize / (texWidth * texHeight)) + 1;
    let texData = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight*texDepth);
    // triangle class: p, q, r; np, nq, nr; uvp, uvq, uvr;

    for (let j = 0; j < tris.length; j++) {
        let tri = tris[triIndices[j]];
        texData.push(tri.p, v3.subtract(tri.q, tri.p), v3.subtract(tri.r, tri.p));
        texData.push(tri.np, tri.nq, tri.nr);
        texData.push(tri.uvp, tri.uvq, tri.uvr);

        texData.push(tri.material.ID);
        if (tri.material.ID > 0) {
            console.log (tri.material.ID);
        }

        for (let k = 0; k < 7; k++) 
            texData.push(0.0); // alignment
    }

    

    for (let i = texSize*8*4; i < texData.length; i++) {
        texData[i] = -999999;
    }

    

    return {numTris: tris.length, texWidth, texHeight, texDepth, texData};
}

function dfs(BVHNodes, node) {
    BVHNodes.push(node);
    if (node.isLeaf) return;
    dfs(BVHNodes, node.left);
    dfs(BVHNodes, node.right);
}

// write function packLightsInTex
function packLightsInTex(lights) {
    let texWidth = 256;
    let texHeight = 256;
    let texSize = lights.length * 8;
    let texData = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight);

    for (let j = 0; j < lights.length; j++) {

        let l = lights[j];

        texData.push(l.tri.p);     
        texData.push(l.tri.q);     
        texData.push(l.tri.r);  
        texData.push(l.tri.np);
        texData.push(l.tri.nq);
        texData.push(l.tri.nr); // this is 6 * 3 = 18 floats; room for 14 more

        texData.push(l.color); // 21
        texData.push(l.area); // 22

        for (let k = 0; k < 10; k++)
            texData.push(0.0); // padding for now, reserved for future use
    } 
    let numLights = lights.length;
    return {texWidth, texHeight, texData, numLights};
}


function packBVHInTex(root) {
    // put nodes in array, depth first
    let BVHNodes = [];
    dfs(BVHNodes, root);
    
    let BVHTexWidth = 2048;
    let BVHTexHeight = 2048;
    let BVHTexSize = BVHNodes.length * 2;
    let BVHTexDepth = Math.floor(BVHTexSize / (BVHTexWidth * BVHTexHeight)) + 1;
    let BVHTexData = twgl.primitives.createAugmentedTypedArray(4, BVHTexWidth*BVHTexHeight*BVHTexDepth, Uint32Array);

    for (let j = 0; j < BVHNodes.length; j++) {

        let node = BVHNodes[j];

        let bbox_data_as_float = new Float32Array(6);
        bbox_data_as_float[0] = node.bbox.min[0];
        bbox_data_as_float[1] = node.bbox.min[1];
        bbox_data_as_float[2] = node.bbox.min[2];
        bbox_data_as_float[3] = node.bbox.max[0];
        bbox_data_as_float[4] = node.bbox.max[1];
        bbox_data_as_float[5] = node.bbox.max[2];

        BVHTexData.push(new Uint32Array(bbox_data_as_float.buffer));
        
        // next is the tough part -- two 32 bit words left. 
        // if leaf node
        // d0 is [32 bits for starting triangle id]
        // d1 is [2 bits indicating leaf] [1 bit near or far] [29 bits for number of triangles]
        
        // if internal node:
        // d0 is [2 bit split axis] [30 bit far child id]
        // d1 is [1 bit for near/far] [31 bits for parent id]
        
        let data_as_uint = new Uint32Array(2);
        if (node.isLeaf) {
            data_as_uint[0] = node.start;
            if (node.isNear) {
                data_as_uint[1] = 0xC0000000 | node.num;
            }
            else {
                data_as_uint[1] = 0xE0000000 | node.num;
            }
        }
        else {
            data_as_uint[0] = ((node.splitAxis >>> 0) << 30) | node.right.id;
            if (node.isNear) {
                data_as_uint[1] = (node.parentID >>> 0);
            }
            else {
                data_as_uint[1] = ((1 >>> 0) << 31) | node.parentID;
            }
        }
        BVHTexData.push(data_as_uint);
    }

    for (let i = BVHTexSize*2*4; i < BVHTexData.length; i++) {
        BVHTexData[i] = -999999;
    }

    return {texWidth: BVHTexWidth, texHeight: BVHTexHeight, texDepth: BVHTexDepth, texData: BVHTexData};

}

function packMaterialsInTex(materials) {
    materials.sort((a, b) => a.ID - b.ID);

    let texWidth = 256;
    let texHeight = 256;
    let texSize = materials.length * 4;
    let texData = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight);

    for (let j = 0; j < materials.length; j++) {

        let m = materials[j];

        texData.push(m.diffuse);     
        texData.push(m.specular);     
        texData.push(m.transmission);  
        texData.push(m.emission);

        
        texData.push(m.type);

        if (m.type == OREN_NAYAR) {
            texData.push(m.A);
            texData.push(m.B);
            texData.push(0.0);
        }
        else if (m.type == GLASS) {
            texData.push(m.eta);
            texData.push([0, 0]);
        }
        else if (m.type == CONDUCTOR) {
            texData.push(m.alpha);
            texData.push([0, 0]);
        }
        else {

            for (let k = 0; k < 3; k++)
                texData.push(0.0); // padding for now, reserved for future use
        }
    } 
    return {texWidth, texHeight, texData};
}


function updateStatusBar(msg, line) {
    if (line == 1) {
    document.getElementById("statsline1").innerHTML = msg;

    } else {
    document.getElementById("statsline2").innerHTML = msg;

    }
}


var v3 = twgl.v3;
var m4 = twgl.m4;
var gl = document.getElementById("c").getContext('webgl2', {
    premultipliedAlpha: false
});
if (!gl) alert("Could not get WebGL2 context.");
const ext = gl.getExtension("EXT_color_buffer_float");
if (!ext) {
    alert("need EXT_color_buffer_float");
}

var camera, scene, trackball, tex0, tex1, tex2, tex3, framebufferTextures, fbi, seeds, drawUniforms, drawTextureUniforms;
var drawBufferInfo, drawTextureBufferInfo, blendWith, drawTo, lastFrameTime;

function init() {

    camera = new Camera();
    camera.eye = [278, 273, -500];
    camera.look = [0, 0, 1];
    camera.up = [0, 1, 0];
    camera.right = [1, 0, 0];
    camera.update();
    //camera.update();

    
    
    let preBVH = window.performance.now();         
    
    if (!modelName) {
        scene = Scene.makeCornellBox();
    }
    else if (modelName == "sphere" && modelBuffer == null) {
        scene = Scene.makeCornellBoxWithSphere();
    }
    else if (modelBuffer == null) {
        scene = Scene.makeModelInBox(modelSrc);
    }
    if (modelBuffer != null) {
        // have already split BVH etc., now load that data into memory
        let header = new Uint32Array(modelBuffer, 0, 18);
        to =  {byteOffset: header[0], texWidth: header[1], texHeight: header[2], texDepth: header[3], numTris: header[4]};
        bto = {byteOffset: header[5], texWidth: header[6], texHeight: header[7], texDepth: header[8]};
        mto = {byteOffset: header[9], texWidth: header[10], texHeight: header[11], texDepth: header[12]};
        lto = {byteOffset: header[13], texWidth: header[14], texHeight: header[15], texDepth: header[16], numLights: header[17]};
        
        to.texData = new Float32Array(modelBuffer, to.byteOffset, to.texWidth * to.texHeight * to.texDepth * 4);
        bto.texData = new Uint32Array(modelBuffer, bto.byteOffset, bto.texWidth * bto.texHeight * bto.texDepth*4);
        mto.texData = new Float32Array(modelBuffer, mto.byteOffset, mto.texWidth * mto.texHeight * mto.texDepth*4);
        lto.texData = new Float32Array(modelBuffer, lto.byteOffset, lto.texWidth * lto.texHeight * lto.texDepth*4);

        let footer = new Float32Array(modelBuffer, modelBuffer.byteLength - (7*4), 7);
        scene = new Scene([], []); // kind of a dummy scene
        scene.scale = footer[0];
        scene.bbox = new BBox([footer[1], footer[2], footer[3]], [footer[4], footer[5], footer[6]]);
    }
    else {
        // haven't yet processed scene, do it here
        updateStatusBar("Converting to triangles... ", 1);
        let allTris = scene.toTriangles();
        let triIndices = new Int32Array(allTris.length);
        for (let i = 0; i < triIndices.length; i++)
            triIndices[i] = i;

        updateStatusBar("Building BVH... ", 1);

         
        let BVHroot = new BVHNode(0, allTris.length, scene.bbox);
        BVHroot.split(allTris, triIndices);
        bto = packBVHInTex(BVHroot);
        
        
        updateStatusBar("Packing textures... ", 1);

        to = packTex(allTris, triIndices);
        // let foo = JSON.stringify(to);
        mto = packMaterialsInTex(scene.materials);
        lto = packLightsInTex(scene.lights);

        mto.texDepth = lto.texDepth = 1;
        to.byteOffset = 18*4;
        bto.byteOffset = to.byteOffset + to.texWidth*to.texHeight*to.texDepth*4*4;
        mto.byteOffset = bto.byteOffset + bto.texWidth*bto.texHeight*bto.texDepth*4*4;
        lto.byteOffset = mto.byteOffset + mto.texWidth*mto.texHeight*mto.texDepth*4*4;

        if (modelName) {
            // if we're working from a raw file, save a data version so we don't have to process again.
            let header = new Uint32Array([
                to.byteOffset, to.texWidth, to.texHeight, to.texDepth, to.numTris, 
                bto.byteOffset, bto.texWidth, bto.texHeight, bto.texDepth, 
                mto.byteOffset, mto.texWidth, mto.texHeight, mto.texDepth, 
                lto.byteOffset, lto.texWidth, lto.texHeight, lto.texDepth, lto.numLights]);

            let footer = new Float32Array([scene.scale, scene.bbox.min[0], scene.bbox.min[1], scene.bbox.min[2], scene.bbox.max[0], scene.bbox.max[1], scene.bbox.max[2]]);

            let blob = new Blob([header, to.texData, bto.texData, mto.texData, lto.texData, footer], {type: "application/octet-stream"});
            let zip = new JSZip();
            zip.file(modelName, blob);
            zip.generateAsync({type: "blob", compression: "DEFLATE"}).then(function(content) {saveAs(content, modelName+".dat");});
        }
    }
     
    let BVHtime = window.performance.now() - preBVH;
    trackball = new Trackball(camera);
    // Data textures -- triangles, BVH nodes, materials

    tex0 =
      twgl.createTexture(gl, {
        target: gl.TEXTURE_3D,
        min: gl.NEAREST,
        mag: gl.NEAREST,
        internalFormat: gl.RGBA32F,
        width: to.texWidth,
        height: to.texHeight,
        depth: to.texDepth,
        src: to.texData,
      });

    tex1 = 
        twgl.createTexture(gl, {
            target: gl.TEXTURE_3D,
            min: gl.NEAREST,
            mag: gl.NEAREST,
            format: gl.RGBA_INTEGER,
            internalFormat: gl.RGBA32UI,
            width: bto.texWidth,
            height: bto.texHeight,
            depth: bto.texDepth,
            src: bto.texData,
        });

    tex2 = 
      twgl.createTexture(gl, {
        target: gl.TEXTURE_2D,
        min: gl.NEAREST,
        mag: gl.NEAREST,
        internalFormat: gl.RGBA32F,
        width: mto.texWidth,
        height: mto.texHeight,
        src: mto.texData,
      });

    tex3 = 
      twgl.createTexture(gl, {
        target: gl.TEXTURE_2D,
        min: gl.NEAREST,
        mag: gl.NEAREST,
        internalFormat: gl.RGBA32F,
        width: lto.texWidth,
        height: lto.texHeight,
        src: lto.texData,
      });

    // Textures for framebuffers -- flip between these for blending

    framebufferTextures = [
      twgl.createTexture(gl, {
        min: gl.NEAREST,
        mag: gl.NEAREST,
        internalFormat:gl.RGBA32F,
        type: gl.FLOAT,
        width: gl.canvas.width,
        height: gl.canvas.height,
      }),

      twgl.createTexture(gl, {
        min: gl.NEAREST,
        mag: gl.NEAREST,
        internalFormat: gl.RGBA32F,
        type: gl.FLOAT,
        width: gl.canvas.width,
        height: gl.canvas.height,
      }),
    ];

    fbi = [
        twgl.createFramebufferInfo(gl, [{type: gl.FLOAT, attachment: framebufferTextures[0]}]), 
        twgl.createFramebufferInfo(gl, [{type: gl.FLOAT, attachment: framebufferTextures[1]}]),
    ];


    // create draw uniforms and bufferInfo
    seeds = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
        seeds[i] = Math.random();
    }


    drawUniforms = {
      u_time: 0.1,
      u_texObjects: tex0,
      u_texBVH: tex1,
      u_texMaterials: tex2,
      u_texLights: tex3,
      u_numLights: lto.numLights,
      u_numTris: to.numTris,
      u_seed: new Uint32Array(seeds.buffer),
      u_pass: 0,
    };

    drawTextureUniforms = {
        u_texImage: framebufferTextures[1]
    }

    let drawArrays = {
        position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
        texCoord: [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0],
    };

    let drawTextureArrays = {
        position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
        texCoord: [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0],
    }

    drawBufferInfo = twgl.createBufferInfoFromArrays(gl, drawArrays);
    drawTextureBufferInfo = twgl.createBufferInfoFromArrays(gl, drawTextureArrays);
    blendWith = 0;
    drawTo = 1;
    updateStatusBar("tris: " + to.numTris, 2);
    lastFrameTime = window.performance.now();
}


function render(time) {
  time *= 0.0001;
    for (let i = 0; i < 12; i++) {
        seeds[i] = Math.random();
    }
    drawUniforms.u_seed = new Uint32Array(seeds.buffer);
  twgl.bindFramebufferInfo(gl, fbi[drawTo]);
  drawUniforms.u_texBlendWith = framebufferTextures[blendWith];
  //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  //gl.enable(gl.CULL_FACE);
  //gl.clear(gl.DEPTH_BUFFER_BIT);
  //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//gl.enable(gl.BLEND);
//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
//if (drawUniforms.u_pass > 0)
  //  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
//else 
  //  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ZERO);
// gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO);
  drawUniforms.u_time = time;
  drawUniforms.u_pass++;
  drawUniforms.u_sampleWeight = 1.0 / drawUniforms.u_pass;

  // imagePlane is column major, a, b, c, eye
  drawUniforms.u_imagePlane = [camera.up[0], camera.up[1], camera.up[2], 0.0,
                               camera.right[0], camera.right[1], camera.right[2], 0.0,
                               camera.imagePlaneCenter[0], camera.imagePlaneCenter[1], camera.imagePlaneCenter[2], 0.0,
                               camera.eye[0], camera.eye[1], camera.eye[2], 0.0];
  gl.useProgram(drawProgramInfo.program);
  twgl.setBuffersAndAttributes(gl, drawProgramInfo, drawBufferInfo);
  twgl.setUniforms(drawProgramInfo, drawUniforms);
  twgl.drawBufferInfo(gl, /*gl.TRIANGLES, */drawBufferInfo);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  drawTextureUniforms.u_texImage = framebufferTextures[drawTo];

  gl.useProgram(drawTextureProgramInfo.program);
  twgl.setBuffersAndAttributes(gl, drawTextureProgramInfo, drawTextureBufferInfo);
  twgl.setUniforms(drawTextureProgramInfo, drawTextureUniforms);
  twgl.drawBufferInfo(gl, /*gl.TRIANGLES, */drawTextureBufferInfo);

  if (drawTo == 1) {
    drawTo = 0;
    blendWith = 1;
  }
  else {
    drawTo = 1;
    blendWith = 0;
  }

  let timeNow = window.performance.now();
  updateStatusBar("pass: " + drawUniforms.u_pass + "\t" +  Math.floor(1000 /(timeNow - lastFrameTime)) + " fps", 1);
  lastFrameTime = timeNow;
  requestAnimationFrame(render);
}

function checkLoaded() {
  stuffToLoad--;
  console.log(stuffToLoad);
  //console.log(updateVS);
  //console.log(updateFS);
  if (stuffToLoad == 0) {
    init();
    launch();
    }
}

function getQueryVariable(variable)
{
   var query = window.location.search.substring(1);
   var vars = query.split("&");
   for (var i=0;i<vars.length;i++) {
           var pair = vars[i].split("=");
           if(pair[0] == variable){return pair[1];}
   }
   return(false);
}

var stuffToLoad = 4; // shaders plus one texture above
loadShader("/code/webgl/q1.drawVS.glsl", function(xhttp) {drawVS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/q1.drawFS-2.glsl", function(xhttp) {drawFS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/q1.drawTextureFS.glsl", function(xhttp) {drawTextureFS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/q1.drawTextureVS.glsl", function(xhttp) {drawTextureVS = xhttp.responseText; checkLoaded();});
modelName = getQueryVariable("model");
if (modelName) { // && modelName != "sphere") {
    stuffToLoad++;
    loadBinary("/code/webgl/"+modelName+".dat", function(xhttp) {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            let zip = new JSZip();
            zip.loadAsync(xhttp.response).then(function(zip) {
                zip.file(modelName).async("blob").then(function (blob) {
                    let reader = new FileReader();
                    reader.onload = function(e) {
                        modelBuffer = reader.result;
                        checkLoaded();
                    }
                    reader.readAsArrayBuffer(blob);
                });
            });
        }
        else {
            console.log("Binary version not available. Loading from source... ");
            if (!modelName.startsWith("sphere")) {
                loadShader("/code/webgl/"+modelName, function(xhttp) {modelSrc = xhttp.responseText; checkLoaded();});
            }
            else {
                console.log("will make sphere dynamically.");
                checkLoaded();
            }
        }
    });

}
//loadShader("/code/webgl/cube.ply", function(xhttp) {bunnyPLYText = xhttp.responseText; checkLoaded();});

//loadShader("/code/webgl/points2.updatePosFS.glsl", function(xhttp) {updateFS[0] = xhttp.responseText; checkLoaded();});
//loadShader("/code/webgl/points2.updateVelFS.glsl", function(xhttp) {updateFS[1] = xhttp.responseText; checkLoaded();});
//loadShader("/code/webgl/points2.updateColorFS.glsl", function(xhttp) {updateFS[2] = xhttp.responseText; checkLoaded();});

// Event handlers below

function mapMouseToUnitPlane(sx, sy) {
    var rect = gl.canvas.getBoundingClientRect();
    return [2.0*((sx-rect.left) / gl.canvas.width)-1.0, 2.0*((rect.top-sy)/ gl.canvas.height)+1.0];
}

// mouse wheel
(function() {
    let elem = document.getElementById("c");
    if (elem.addEventListener) {
        elem.addEventListener("mousewheel", handleMouseWheel, false);
        elem.addEventListener("DOMMouseScroll", handleMouseWheel, false);
    }
//    document.onmousewheel = handleMouseWheel;
//    document.DOMMouseScroll = handleMouseWheel;
    function handleMouseWheel(event) {
        event = event || window.event;
        var rolled = 0;
        if ('wheelDelta' in event) {
            rolled = event.wheelDelta;
        }
        else {
            rolled = -40*event.detail;
        }
        if (rolled > 0) {
            camera.zoom(.1*scene.scale);
        }
        else {
            camera.zoom(-.1*scene.scale);
        }
        event.preventDefault();
        event.stopPropagation();
        cameraChanged();
    }
})();

// mouse move
(function() {
    //document.onmousemove = handleMouseMove;
    let elem = document.getElementById("c");
    if (elem.addEventListener) {
        elem.addEventListener("mousemove", handleMouseMove, false);
        //elem.addEventListener("DOMMouseScroll", handleMouseWheel, false);
    }
    function handleMouseMove(event) {
        var dot, eventDoc, doc, body, pageX, pageY;

        event = event || window.event; // IE-ism

        // If pageX/Y aren't available and clientX/Y are,
        // calculate pageX/Y - logic taken from jQuery.
        // (This is to support old IE)
        if (event.pageX == null && event.clientX != null) {
            eventDoc = (event.target && event.target.ownerDocument) || document;
            doc = eventDoc.documentElement;
            body = eventDoc.body;

            event.pageX = event.clientX +
              (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
              (doc && doc.clientLeft || body && body.clientLeft || 0);
            event.pageY = event.clientY +
              (doc && doc.scrollTop  || body && body.scrollTop  || 0) -
              (doc && doc.clientTop  || body && body.clientTop  || 0 );
        }

        // Use event.pageX / event.pageY here
        mouseInfo.lastPos.x = mouseInfo.curPos.x;
        mouseInfo.lastPos.y = mouseInfo.curPos.y;
        mouseInfo.curPos.x = event.clientX;
        mouseInfo.curPos.y = event.clientY;
        if (mouseInfo.buttonDown[0] == true) { // left button pressed
            trackball.updateCamera(mouseInfo);
            cameraChanged();
        }
        event.preventDefault();
        event.stopPropagation();
        //console.log(mousePosition);
    }
})();

// mouse down
(function() {
    let elem = document.getElementById("c");
    if (elem.addEventListener) {
        elem.addEventListener("mousedown", handleMouseDown, false);
        //elem.addEventListener("DOMMouseScroll", handleMouseWheel, false);
    }
    function handleMouseDown(event) {
        event = event || window.event; // IE-ism

        mouseInfo.buttonDown[event.button] = true;
//        updateUniforms.u_clicked = 1.0;
//        updateUniforms.u_c2 = [1.0, 1.0, 1.0];
//        updateUniforms.u_c1 = [0.1, 1.0, 0.1];
        event.preventDefault();
        event.stopPropagation();
        //console.log(updateUniforms.center);
    }
})();

// mouse up
(function() {
    let elem = document.getElementById("c");
    if (elem.addEventListener) {
        elem.addEventListener("mouseup", handleMouseUp, false);
        //elem.addEventListener("DOMMouseScroll", handleMouseWheel, false);
    }
    document.onmouseup = handleMouseUp;
    function handleMouseUp(event) {
        event = event || window.event; // IE-ism

        mouseInfo.buttonDown[event.button] = false;
//        updateUniforms.u_clicked = -1.0;
//        updateUniforms.u_c1 = [1.0, 1.0, 1.0];
//        updateUniforms.u_c2 = [0.1, 1.0, 0.1];
        //console.log(updateUniforms.center);
        event.preventDefault();
        if (event.stopPropagation) {
            event.stopPropagation();
        }
        else {
            event.cancelBubble = true;
        }
    }
})();

// contextmenu
(function() {
    gl.canvas.oncontextmenu = blockContextMenu;
    function blockContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();
    }
})();

function expandOptionsMenu() {
    document.getElementById("floating-menu-tab").style.visibility = "hidden";
    document.getElementById("floating-menu").style.visibility = "visible";
}

function closeOptionsMenu() {
    document.getElementById("floating-menu-tab").style.visibility = "visible";
    document.getElementById("floating-menu").style.visibility = "hidden";
}

function processNumParticlesSlider() {
    var el = document.getElementById("numParticlesSlider");
    numToDraw = Math.pow(2, el.value);
    document.getElementById("numParticles").innerHTML = el.value;


}

//  u_Kg: -.02,
//  u_Kv: .0003,
//  u_Kp: .2,

function processVelocitySlider() {
    var el = document.getElementById("velocitySlider");
    var v = el.value;
    updateUniforms.u_Kv = v * .00003;
    document.getElementById("velocity").innerHTML = v;
}
function processGravitySlider() {
    var el = document.getElementById("gravitySlider");
    var g = el.value;
    updateUniforms.u_Kg = g * -.02;
    document.getElementById("gravity").innerHTML = g;

}
function processNoiseSlider() {
    var n = document.getElementById("noiseSlider").value;
    //updateUniforms.u_Kp = .02 * n;
    updateUniforms.u_perlinScale = -12.0+(100-n)/4.0; //* ((100.0-n)/100.0);
    document.getElementById("noise").innerHTML = n;

}
function stopEvents(ev) {
    ev.stopPropagation();
}

function changeMaterial() {
    let elem = document.getElementById("material-selector");
    console.log("Change material to: " + elem.selectedIndex);
    // change relevant material using bare metal
    /* 
    const PURE_DIFFUSE = 0.0;
    const MIRROR = 1.0;
    const GLASS = 2.0;
    NOT IMPLEMENTED const DIELECTRIC = 3.0;
    const CONDUCTOR = 4.0;
    const OREN_NAYAR = 5.0;
    NOT IMPLEMENTED const DIFFUSE_SPEC_SHIRLEY = 6.0;
    */
    let m;
    switch (elem.selectedIndex) {
        case 0: // diffuse
            m = new Material({diffuse: [0, 0, 1], type: PURE_DIFFUSE});
            break;
        case 1: // mirror
            m = new Material({specular: [.8, .8, .8], type: MIRROR});
            break;
        case 2: // glass
            m = new Material({specular: [.7, .7, .7], transmission: [.5, .5, .5], eta: 1.1, type: GLASS});
            break;
        case 3: // dielectric
        //case 4: // conductor
            m = new Material({eta: [.155, .424, 1.38], k: [3.60, 2.47, 1.92], alpha: .2, type: CONDUCTOR});
            break;
        case 4: // OREN NAYAR
        //case 6: // DIFFUSE SPEC
            m = new Material({diffuse: [.6, .2, .8], sigma: 1.5, type: OREN_NAYAR});
            break;
    }
    for (let i = 0; i < 3; i++) {
        mto.texData[i] = m.diffuse[i];
        mto.texData[i+3] = m.specular[i];
        mto.texData[i+6] = m.transmission[i];
        mto.texData[i+9] = m.emission[i];
    }
    mto.texData[12] = m.type;
    if (m.type == OREN_NAYAR) {
        mto.texData[13] = m.A;
        mto.texData[14] = m.B;
        mto.texData[15] = 0.0;
    }
    else if (m.type == GLASS) {
        mto.texData[13] = m.eta;
        mto.texData[14] = 0.0;
        mto.texData[15] = 0.0;
    }
    else if (m.type == CONDUCTOR) {
        mto.texData[13] = m.alpha;
        mto.texData[14] = 0.0;
        mto.texData[15] = 0.0;
    }
    else {
        mto.texData[13] = 0.0;
        mto.texData[14] = 0.0;
        mto.texData[15] = 0.0;
    }

    tex2 = twgl.createTexture(gl, {
        target: gl.TEXTURE_2D,
        min: gl.NEAREST,
        mag: gl.NEAREST,
        internalFormat: gl.RGBA32F,
        width: mto.texWidth,
        height: mto.texHeight,
        src: mto.texData,
    });


    drawUniforms.u_texMaterials = tex2;
    drawUniforms.u_pass = 0;
}