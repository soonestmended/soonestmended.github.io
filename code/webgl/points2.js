
"use strict";
twgl.setDefaults({attribPrefix: "a_"});

var read0 = true;

var drawProgramInfo, drawVS, drawFS;
var updateProgramInfo = [];
var updateVS;
var updateFS = [];

var mouseInfo = {
    lastPos: {x: 0.0, y: 0.0},
    curPos: {x: 0.0, y: 0.0},
    buttonDown: [false, false, false],
};


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

function launch() {
   drawProgramInfo = twgl.createProgramInfo(gl, [drawVS, drawFS]);
   for (var i = 0; i < 3; ++i)
     updateProgramInfo[i] = twgl.createProgramInfo(gl, [updateVS, updateFS[i]]);
   requestAnimationFrame(render);
}

function calcTexSize(np) {
  // 4 bytes per particle
  // means 1 texels per particle
  return Math.pow(2, Math.ceil(Math.log(Math.sqrt(np))/Math.log(2)));
}

var v3 = twgl.v3;
var m4 = twgl.m4;
var gl = twgl.getWebGLContext(document.getElementById("c"));
if (!gl.getExtension("OES_texture_float")) {
  alert("Float textures not supported.");
}
if (!gl.getExtension("OES_element_index_uint")) {
    alert("Unsigned integer indices not supported.");
}

var numParticles = 1048576;
var numToDraw = numParticles;
var texWidth, texHeight;
//var texPerlinWidth = 2048;
//var texPerlinHeight = 1024;
texWidth = texHeight = calcTexSize(numParticles);
var xoffset = 1.0/texWidth;

// wrap scene variables in scene object
var scene = {
    projection: m4.perspective(30 * Math.PI / 180, texWidth / texHeight, 0.005, 1000),
    eye: [0, 0, 6],
    target: [0, 0, 0],
    up: [0, 1, 0],

    camera: m4.identity(),     
    view: m4.identity(),     
    viewProjection: m4.identity(), 
    world: m4.identity(),
    worldInverse: m4.identity(),

    cameraZoom: function (ds) {
        scene.eye = v3.add(scene.eye, v3.mulScalar(v3.add(scene.eye, scene.target), ds));
        scene.update();
    },

    update: function () {
        scene.camera = m4.lookAt(scene.eye, scene.target, scene.up);
        scene.view = m4.inverse(scene.camera);
        scene.viewProjection = m4.multiply(scene.view, scene.projection);
    },

};

scene.update();

// scene.camera = m4.lookAt(scene.eye, scene.target, scene.up);
// scene.view = m4.inverse(scene.camera);
// scene.viewProjection = m4.multiply(scene.view, scene.projection);

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

// deal with trackball controls
var trackball = {
    
    quat: [1.0, 0.0, 0.0, 0.0],

    projectToUnitSphere: function(xy) {
        var v = v3.create(xy[0], xy[1], 0.0); // vec3 with x, y, 0.0
        var d = v3.lengthSq(v);

        if (d > .5) {
            v[2] = .5 / Math.sqrt(d);

        }
        else {
            v[2] = Math.sqrt(1.00001 - d);
        }
        return v3.normalize(v);
    },

    updateCamera: function(mi) {
        // TO DO: transform projected mouse coordinates on sphere into world coordinates.

        // map mouse positions to vector on unit sphere.
        var v1 = trackball.projectToUnitSphere(mapMouseToUnitPlane(mi.lastPos.x, mi.lastPos.y));
        var v2 = trackball.projectToUnitSphere(mapMouseToUnitPlane(mi.curPos.x, mi.curPos.y));

        // now map these two world coordinates?

        //v1 = m4.transformDirection(scene.worldInverse, v1);
        //v2 = m4.transformDirection(scene.worldInverse, v2);
        
        var axis = v3.cross(v1, v2); // axis of rotation
        
        var axisLength = v3.length(axis);
        var dotVal = v3.dot(v1, v2);
        var angle = Math.acos(dotVal);
        // if (dotVal < 0.0) {
        //    angle = -angle;
        // }
        //axis = v3.normalize(axis);
        if (axisLength > 0.00001 && angle > 0.000001) {
            axis = v3.normalize(axis);
            this.quat = Quaternion.mul(this.quat, Quaternion.fromAxisAngle(axis, -angle));
    
            scene.world = Quaternion.toRotationMatrix(this.quat);
            scene.worldInverse = m4.inverse(scene.world);

            //scene.world = m4.axisRotate(scene.world, axis, angle);
            //scene.worldInverse = m4.inverse(scene.world);
        }
        
        console.log("v1: " + v1);
        console.log("v2: " + v2);
        console.log("axis: " + axis);
        console.log("angle: " + angle);
    },
};

// particle position & velocity arrays for later copy to texture. may not use the whole thing
var positionArray = twgl.primitives.createAugmentedTypedArray(4, numParticles);
var velocityArray = twgl.primitives.createAugmentedTypedArray(4, numParticles);

// array for texture coordinate attribute
var texCoordArray = twgl.primitives.createAugmentedTypedArray(2, numParticles);

// index array for drawing point sprites
var indexArray = twgl.primitives.createAugmentedTypedArray(1, numParticles, Uint32Array); 

// make Float32 array for Perlin noise vectors. We are doing simplified noise so there are only
// 12 unique vectors that a grid point can take on. Therefore we only need 1 float per grid point per noise computation.
// However, we need a random 3 vector to alter velocity. So we need 3 floats for each grid point
// In the fragment shader, these random floats will be used to index into the vector array of size 12

// var texPerlinSrcArray = twgl.primitives.createAugmentedTypedArray(4, texPerlinWidth*texPerlinHeight, Float32Array);

// Fill array

//for (var i = 0; i < texPerlinWidth * texPerlinHeight; i++) {
    // var theta = 2.0 * Math.PI * Math.random();
    // var theta2 = 2.0 * Math.PI * Math.random();
    // texPerlinSrcArray.push([Math.cos(theta), Math.sin(theta), Math.cos(theta2), Math.sin(theta2)]);
//    texPerlinSrcArray.push([Math.random(), Math.random(), Math.random(), Math.random()]);
//}

// twgl create Perlin texture
/*
var texPerlin = twgl.createTexture(gl, {
    min: gl.NEAREST,
    mag: gl.NEAREST,
    width: texPerlinWidth,
    height: texPerlinHeight,
    src: texPerlinSrcArray,
});
*/
// load particle texture
var texParticle = twgl.createTexture(gl, {
    src: "/code/webgl/particle.png"
}, function(err, tex, img) {checkLoaded();});

// fill attribute arrays
var hpw = 0.5/texWidth;
var hph = 0.5/texHeight;

var index = 0;
for (var j = 0; j < texHeight; j++) {
    var row = j / texHeight + hpw;
    for (var i = 0; i < texWidth; i++) {
        var col = i / texWidth + hph;
        positionArray.push(0.0, 0.0, 0.0, 1.0);
        velocityArray.push(0.0, 0.0, 0.0, 1.0);
        texCoordArray.push(col, row);
        indexArray.push(index++);
    }
}

// make Float32 arrays for use as textures. 
var texPosSrcArray0 = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight, Float32Array);
var texVelSrcArray0 = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight, Float32Array);
var texColorSrcArray0 = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight, Float32Array);

// we will flip between these textures, reading one, updating the other, then swapping
var texPosSrcArray1 = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight, Float32Array);
var texVelSrcArray1 = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight, Float32Array);
var texColorSrcArray1 = twgl.primitives.createAugmentedTypedArray(4, texWidth*texHeight, Float32Array);

for (var i = 0; i < numParticles; ++i) {
    // each 16 byte block of the texSrcArray has data from one particle, which is 4 values in the positionArray
    var posIndex = 2*i;
    for (var j = 0; j < 2; ++j) {
      texPosSrcArray0.push(positionArray[posIndex+j]);
      texPosSrcArray1.push(positionArray[posIndex+j]+.2);
    }

    texPosSrcArray0.push([0.0, 0.0]);
    texPosSrcArray1.push([0.0, 0.0]);

    for (var j = 0; j < 4; ++j) {
        texVelSrcArray0.push(velocityArray[posIndex+j]);
        texVelSrcArray1.push(velocityArray[posIndex+j]);
    }

    texColorSrcArray0.push(0.0, 0.0, 0.0, .00490);
    texColorSrcArray1.push(0.0, 0.0, 0.0, .10);
} 

for (var i = numParticles; i < texWidth*texHeight; ++i) {
  texPosSrcArray0.push(0.0);
  texPosSrcArray1.push(0.0);
  texVelSrcArray0.push(0.0);
  texVelSrcArray1.push(0.0);
}

var tex0 = [
  twgl.createTexture(gl, {
    min: gl.NEAREST,
    mag: gl.NEAREST,
    width: texWidth,
    height: texHeight,
    src: texPosSrcArray0,
  }),

  twgl.createTexture(gl, {
    min: gl.NEAREST,
    mag: gl.NEAREST,
    width: texWidth,
    height: texHeight,
    src: texVelSrcArray0,
  }),

  twgl.createTexture(gl, {
    min: gl.NEAREST,
    mag: gl.NEAREST,
    width: texWidth,
    height: texHeight,
    src: texColorSrcArray0,
  })
];

var tex1 = [
  twgl.createTexture(gl, {
    min: gl.NEAREST,
    mag: gl.NEAREST,
    width: texWidth,
    height: texHeight,
    src: texPosSrcArray1,
  }),

  twgl.createTexture(gl, {
    min: gl.NEAREST,
    mag: gl.NEAREST,
    width: texWidth,
    height: texHeight,
    src: texVelSrcArray1,
  }),

  twgl.createTexture(gl, {
    min: gl.NEAREST,
    mag: gl.NEAREST,
    width: texWidth,
    height: texHeight,
    src: texColorSrcArray1,
  })
];

// create draw uniforms and bufferInfo

var drawUniforms = {
//  u_lightWorldPos: [1, 8, -10],
//  u_lightColor: [1, 0.8, 0.8, 1],
//  u_ambient: [0, 0, 0, 1],
//  u_specular: [1, 1, 1, 1],
//  u_shininess: 50,
//  u_specularFactor: 1,
  u_time: 0.1,
  u_texPos: tex0[0],
  u_texVel: tex0[1],
  u_texColor: tex0[2],
  u_texParticle: texParticle,
};

var drawArrays = {
  texcoord: texCoordArray,
//  indices: {numComponents: 1, data: indexArray},
    indices: {numComponents: 1, data: indexArray},
};

var drawBufferInfo = twgl.createBufferInfoFromArrays(gl, drawArrays);

// create update uniforms and bufferInfo

var updateUniforms = {
  u_texPos: tex0[0],
  u_texVel: tex0[1],
  u_texColor: tex0[2],
//  u_texPerlin: texPerlin,
  u_perlinScale: 4.0,
  u_Kg: -.02,
  u_Kv: .0003,
  u_Kp: .2,
  u_resolution: [texWidth, texHeight],
  u_time: 0,
//  u_clicked: -1.0,
//  u_c1: [0.0, 1.0, 0.0],
//  u_c2: [0.0, 0.2, 0.0],
  center: [0.0, 0.0, 0.0],
  attractor: [0.5, 0.0],
}

var updateArrays = {
  position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
  texcoord: [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0],
}

var updateBufferInfo = twgl.createBufferInfoFromArrays(gl, updateArrays);

var tex0FBI = [
  twgl.createFramebufferInfo(gl, [{attachment: tex0[0]}], texWidth, texHeight),
  twgl.createFramebufferInfo(gl, [{attachment: tex0[1]}], texWidth, texHeight),
  twgl.createFramebufferInfo(gl, [{attachment: tex0[2]}], texWidth, texHeight),
];

var tex1FBI = [
  twgl.createFramebufferInfo(gl, [{attachment: tex1[0]}], texWidth, texHeight),
  twgl.createFramebufferInfo(gl, [{attachment: tex1[1]}], texWidth, texHeight),
  twgl.createFramebufferInfo(gl, [{attachment: tex1[2]}], texWidth, texHeight),
];

var updateFBI = tex1FBI;

function render(time) {
  time *= 0.0001;
  
  // twgl.bindFramebufferInfo(gl, updateFBI);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  //gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable (gl.BLEND);
  gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


// stuff for draw

  //var projection = m4.perspective(30 * Math.PI / 180, texWidth / texHeight, 0.5, 10);
  //var projection = m4.ortho(-1.5, 1.5, -1.5, 1.5, 0.5, 10);
  //var eye = [0, 0, -6];
  //var target = [0, 0, 0];
  //var up = [0, 1, 0];

  //var camera = m4.lookAt(eye, target, up);
  //var view = m4.inverse(camera);
  //var viewProjection = m4.multiply(view, projection);
  //scene.world = m4.rotationY(time*3);
  //var world = m4.identity();

  drawUniforms.u_viewInverse = scene.camera;
  drawUniforms.u_world = scene.world;
  drawUniforms.u_worldInverseTranspose = m4.transpose(m4.inverse(scene.world));
  drawUniforms.u_worldViewProjection = m4.multiply(scene.world, scene.viewProjection);
  drawUniforms.u_time = time;


  if (read0) {
    drawUniforms.u_texPos = tex0[0];
    drawUniforms.u_texVel = tex0[1];
    drawUniforms.u_texColor = tex0[2];
  } else {
    drawUniforms.u_texPos = tex1[0];
    drawUniforms.u_texVel = tex1[1];
    drawUniforms.u_texColor = tex1[2];
  }

  gl.useProgram(drawProgramInfo.program);
  twgl.setBuffersAndAttributes(gl, drawProgramInfo, drawBufferInfo);
  twgl.setUniforms(drawProgramInfo, drawUniforms);
  twgl.drawBufferInfo(gl, gl.POINTS, drawBufferInfo, numToDraw);

// stuff for update

  gl.disable (gl.BLEND); // very important...

  //updateUniforms.center = [.2*Math.cos(time), .2*Math.sin(time)];

    updateUniforms.attractor = [.6*Math.cos(20.0*time), .6*Math.sin(5.0*time)];

  for (var i = 0; i < 3; ++i) {

    if (read0) {
      twgl.bindFramebufferInfo(gl, tex1FBI[i]);
      updateUniforms.u_texPos = tex0[0];
      updateUniforms.u_texVel = tex0[1];
      updateUniforms.u_texColor = tex0[2];
      updateUniforms.u_time = time;
      gl.useProgram(updateProgramInfo[i].program);
      twgl.setBuffersAndAttributes(gl, updateProgramInfo[i], updateBufferInfo);
      twgl.setUniforms(updateProgramInfo[i], updateUniforms);

      //gl.viewport(0, 0, texWidth, texHeight);

      //gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      twgl.drawBufferInfo(gl, gl.TRIANGLES, updateBufferInfo);
    } else {
      twgl.bindFramebufferInfo(gl, tex0FBI[i]);
      updateUniforms.u_texPos = tex1[0];
      updateUniforms.u_texVel = tex1[1];
      updateUniforms.u_texColor = tex1[2];
      gl.useProgram(updateProgramInfo[i].program);
      twgl.setBuffersAndAttributes(gl, updateProgramInfo[i], updateBufferInfo);
      twgl.setUniforms(updateProgramInfo[i], updateUniforms);

      //gl.viewport(0, 0, texWidth, texHeight);

      //gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      twgl.drawBufferInfo(gl, gl.TRIANGLES, updateBufferInfo);
    }
  }

  if (read0) {
    read0 = false;
  } else {
    read0 = true;
  }
  

  requestAnimationFrame(render);
}

function checkLoaded() {
  stuffToLoad--;
  console.log(stuffToLoad);
  console.log(updateVS);
  console.log(updateFS);
  if (stuffToLoad == 0) launch();
}

var stuffToLoad = 7; // shaders plus one texture above
loadShader("/code/webgl/points2.drawVS.glsl", function(xhttp) {drawVS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points2.drawFS.glsl", function(xhttp) {drawFS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points2.updateVS.glsl", function(xhttp) {updateVS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points2.updatePosFS.glsl", function(xhttp) {updateFS[0] = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points2.updateVelFS.glsl", function(xhttp) {updateFS[1] = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points2.updateColorFS.glsl", function(xhttp) {updateFS[2] = xhttp.responseText; checkLoaded();});

// Event handlers below

function mapMouseToUnitPlane(sx, sy) {
    var rect = gl.canvas.getBoundingClientRect();
    return [2.0*((sx-rect.left) / gl.canvas.width)-1.0, 2.0*((rect.top-sy)/ gl.canvas.height)+1.0];
}

// mouse wheel
(function() {
    document.onmousewheel = handleMouseWheel;
    function handleMouseWheel(event) {
        event = event || window.event;
        if (event.deltaY > 0) {
            scene.cameraZoom(.1);
        }
        else {
            scene.cameraZoom(-.1);
        }
        event.preventDefault();
        event.stopPropagation();
    }
})();

// mouse move
(function() {
    document.onmousemove = handleMouseMove;
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
        }
        event.preventDefault();
        event.stopPropagation();
        //console.log(mousePosition);
    }
})();

// mouse down
(function() {
    document.onmousedown = handleMouseDown;
    function handleMouseDown(event) {
        event = event || window.event; // IE-ism

        mouseInfo.buttonDown[event.button] = true;
        console.log("Button " + event.button + " pressed.");
        updateUniforms.u_clicked = 1.0;
        updateUniforms.u_c2 = [1.0, 1.0, 1.0];
        updateUniforms.u_c1 = [0.1, 1.0, 0.1];
        event.preventDefault();
        event.stopPropagation();
        //console.log(updateUniforms.center);
    }
})();

// mouse up
(function() {
    document.onmouseup = handleMouseUp;
    function handleMouseUp(event) {
        event = event || window.event; // IE-ism

        mouseInfo.buttonDown[event.button] = false;
        console.log("Button " + event.button + " released.");
    
        updateUniforms.u_clicked = -1.0;
        updateUniforms.u_c1 = [1.0, 1.0, 1.0];
        updateUniforms.u_c2 = [0.1, 1.0, 0.1];
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
        console.log("blockContextMenu");
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
