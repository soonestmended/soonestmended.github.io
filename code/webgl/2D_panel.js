var scene, camera, renderer;
var stats, vsh, fsh;
var buttonDown = false;
var mouseX, mouseY, deltaX, deltaY;
var panelDimensionsID;

function render () {
    renderer.render(scene, camera);
}

function animate() {
    // update panel dimensions box in page!
    panelDimensionsID.innerHTML = "Center: [" + uniforms.center.value.x.toPrecision(2).toString() + ", " + uniforms.center.value.y.toPrecision(2).toString() + "] &nbsp; &nbsp; Width: " + (2.0*uniforms.scale.value.toPrecision(2)).toString();
    requestAnimationFrame(animate); 
    uniforms.time.value += 0.05;
    render();
    //stats.update();
}

function init () {
    var params = {
        canvas: document.getElementById( 'codecanvas' )
    };
    params.canvas.innerWidth = params.canvas.innerHeight = 512;
    panelDimensionsID = document.getElementById( '2Dpanel-dimensions' );
    //document.body.appendChild( container );

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    camera.position.z = 1;
    var geometry = new THREE.PlaneGeometry( 2, 2 );
    uniforms = {
        time: { type: "f", value: 1.0 },
        resolution: { type: "v2", value: new THREE.Vector2() },
        center: {type: "v2", value: new THREE.Vector2(0.0, 0.0) },
        scale: {type: "f", value: 1.0 }
    };

    var material = new THREE.ShaderMaterial( {

    uniforms: uniforms,
    //vertexShader: document.getElementById( 'vertexShader' ).textContent,
    //fragmentShader: document.getElementById( 'fragmentShader' ).textContent
    vertexShader: vsh, 
    fragmentShader: fsh

    } );

    var mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

    renderer = new THREE.WebGLRenderer(params);
    renderer.setSize(params.canvas.innerWidth, params.canvas.innerHeight);
    //container.appendChild(renderer.domElement);
/*
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );
*/
    //onWindowResize();
    setWindowSize();
    //window.addEventListener( 'resize', onWindowResize, false );

    initEvents();

    animate();
}

function initEvents() {
    if (document.addEventListener) {                // For all major browsers, except IE 8 and earlier
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mousewheel", onMouseWheel);
        document.addEventListener("mousemove", onMouseMove);
    } else if (document.attachEvent) {              // For IE 8 and earlier versions
        document.attachEvent("onmouseup", onMouseUp);
        document.attachEvent("onmousedown", onMouseDown);
        document.attachEvent("onmousewheel", onMouseWheel);
        document.attachEvent("onmousemove", onMouseMove);
    }

//    document.addEventListener("keydown", onKeyDown, false);
//    document.addEventListener("keyup", onKeyUp, false);
}

function onMouseUp(e) {
    buttonDown = false;
}

function onMouseDown(e) {
    buttonDown = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
}

function onMouseMove(e) {
    if (buttonDown) {
        deltaX = e.clientX - mouseX;
        deltaY = e.clientY - mouseY;
        mouseX = e.clientX;
        mouseY = e.clientY;
        var dx = window.devicePixelRatio * deltaX * (uniforms.scale.value * 2.0 / uniforms.resolution.value.x);
        var dy = window.devicePixelRatio * deltaY * (uniforms.scale.value * 2.0 / uniforms.resolution.value.y);
        uniforms.center.value.x -= dx;
        uniforms.center.value.y += dy;
        console.log(dx);
    }
}

function onMouseWheel(e) {
    e.preventDefault();
    if (e.wheelDelta > 0) {
        uniforms.scale.value *= 0.9;
    } else {
        uniforms.scale.value *= 1.1;
    }
}

function onWindowResize( event ) {
    return;
/*    uniforms.resolution.value.x = window.innerWidth;
    uniforms.resolution.value.y = window.innerHeight;

    renderer.setSize( window.innerWidth, window.innerHeight );
*/
}

function setWindowSize() {
    var canvas = document.getElementById( 'codecanvas' );
    uniforms.resolution.value.x = canvas.innerWidth*window.devicePixelRatio;
    uniforms.resolution.value.y = canvas.innerHeight*window.devicePixelRatio; 
    renderer.setSize(canvas.innerWidth, canvas.innerHeight);

}

SHADER_LOADER.load(
        function (data)
        {
            vsh = data.shader.vertex;
            fsh = data.shader.fragment;
            init();
        }
    );

