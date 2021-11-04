
"use strict";
twgl.setDefaults({attribPrefix: "a_"});

var read0 = true;

var drawProgramInfo, drawVS, drawFS;
var updateProgramInfo = [];
var updateVS;
var updateFS = [];

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

var m4 = twgl.m4;
var gl = twgl.getWebGLContext(document.getElementById("c"));
if (!gl.getExtension("OES_texture_float")) {
  alert("Float textures not supported.");
}

var numParticles = 500000;
var texWidth, texHeight;
texWidth = texHeight = calcTexSize(numParticles);
var xoffset = 1.0/texWidth;

// particle position array for later copy to texture. may not use the whole thing
var positionArray = twgl.primitives.createAugmentedTypedArray(4, numParticles);

// array for texture coordinate attribute
var texCoordArray = twgl.primitives.createAugmentedTypedArray(2, numParticles);

// do we need this?
var indexArray = twgl.primitives.createAugmentedTypedArray(1, numParticles, Uint16Array); 

// fill attribute arrays
var hpw = 0.5/texWidth;
var hph = 0.5/texHeight;
for (var i = 0; i < numParticles; ++i) {
  positionArray.push(2.0*(Math.random()-0.5), 2.0*(Math.random()-0.5), 0.0, 1.0);
  //positionArray.push(0.0, 1.0, 0.0, 1.0);
  //colorArray.push(Math.random(), Math.random(), Math.random());
  texCoordArray.push((i%texWidth)/texWidth + hpw, (Math.floor(i/texWidth))/texHeight + hph);
  indexArray.push(i);
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
    var posIndex = 4*i;
    for (var j = 0; j < 4; ++j) {
      texPosSrcArray0.push(positionArray[posIndex+j]);
      texPosSrcArray1.push(positionArray[posIndex+j]+.2);
    }

    texVelSrcArray0.push([0.0, 0.0,  0.0, 0.0]);
    texVelSrcArray1.push([0.0, 0.0, 0.0, 0.0]);

    texColorSrcArray0.push(1.0, 0.0, 0.0, Math.random());
    texColorSrcArray1.push(1.0, 1.0, 1.0, 0.0);
} 

for (var i = numParticles; i < texWidth*texHeight; ++i) {
  texPosSrcArray0.push(0.0);
  texPosSrcArray1.push(0.0);
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
  u_lightWorldPos: [1, 8, -10],
  u_lightColor: [1, 0.8, 0.8, 1],
  u_ambient: [0, 0, 0, 1],
  u_specular: [1, 1, 1, 1],
  u_shininess: 50,
  u_specularFactor: 1,
  u_time: 0.1,
  //u_texPos: tex0[0],
  u_texVel: tex0[1],
  u_texColor: tex0[2],
};

var drawArrays = {
  texcoord: texCoordArray,
  indices: {numComponents: 1, data: indexArray},
};

var drawBufferInfo = twgl.createBufferInfoFromArrays(gl, drawArrays);

// create update uniforms and bufferInfo

var updateUniforms = {
  u_texPos: tex0[0],
  u_texVel: tex0[1],
  u_texColor: tex0[2],
  u_resolution: [texWidth, texHeight],
  u_time: 0,
  u_clicked: -1.0,
  u_c1: [0.0, 1.0, 0.0],
  u_c2: [0.0, 0.2, 0.0],
  center: [0.0, 0.0],
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

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable (gl.BLEND);
  gl.blendFunc (gl.SRC_ALPHA, gl.ONE_MINUS_DST_ALPHA);

// stuff for draw

  var projection = m4.perspective(30 * Math.PI / 180, gl.canvas.clientWidth / gl.canvas.clientHeight, 0.5, 10);
  //var projection = m4.ortho(-1.5, 1.5, -1.5, 1.5, 0.5, 10);
  var eye = [0, 0, -6];
  var target = [0, 0, 0];
  var up = [0, 1, 0];

  var camera = m4.lookAt(eye, target, up);
  var view = m4.inverse(camera);
  var viewProjection = m4.multiply(view, projection);
//  var world = m4.rotationY(time);
  var world = m4.identity();

  drawUniforms.u_viewInverse = camera;
  drawUniforms.u_world = world;
  drawUniforms.u_worldInverseTranspose = m4.transpose(m4.inverse(world));
  drawUniforms.u_worldViewProjection = m4.multiply(world, viewProjection);
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
  twgl.drawBufferInfo(gl, gl.POINTS, drawBufferInfo);

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
  shadersToLoad--;
  if (shadersToLoad == 0) launch();
}

var shadersToLoad = 6;
loadShader("/code/webgl/points.drawVS.glsl", function(xhttp) {drawVS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points.drawFS.glsl", function(xhttp) {drawFS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points.updateVS.glsl", function(xhttp) {updateVS = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points.updatePosFS.glsl", function(xhttp) {updateFS[0] = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points.updateVelFS.glsl", function(xhttp) {updateFS[1] = xhttp.responseText; checkLoaded();});
loadShader("/code/webgl/points.updateColorFS.glsl", function(xhttp) {updateFS[2] = xhttp.responseText; checkLoaded();});

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
        var rect = gl.canvas.getBoundingClientRect();
        updateUniforms.center = [2.0*((event.clientX-rect.left) / gl.canvas.width)-1.0, 2.0*((rect.top-event.clientY)/ gl.canvas.height)+1.0];
        //console.log(updateUniforms.center);
    }
})();

(function() {
    document.onmousedown = handleMouseDown;
    function handleMouseDown(event) {
        
        updateUniforms.u_clicked = 1.0;
        updateUniforms.u_c2 = [1.0, 1.0, 1.0];
        updateUniforms.u_c1 = [0.1, 1.0, 0.1];
        //console.log(updateUniforms.center);
    }
})();

(function() {
    document.onmouseup = handleMouseUp;
    function handleMouseUp(event) {
        
        updateUniforms.u_clicked = -1.0;
        updateUniforms.u_c1 = [1.0, 1.0, 1.0];
        updateUniforms.u_c2 = [0.1, 1.0, 0.1];
        //console.log(updateUniforms.center);
    }
})();
