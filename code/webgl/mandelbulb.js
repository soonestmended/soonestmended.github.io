var scene, camera, renderer;
var container, stats, vsh, fsh;

function render () {
    renderer.render(scene, camera);
}

function animate() {
    requestAnimationFrame(animate); 
    uniforms.time.value += 0.02;
    //handleControls();
    uniforms.ctw.value.copy(camera.matrixWorld);
    //console.log(uniforms.ctw.value);
    
    controls.update();

//    stats.update();
    console.log(camera.position);
    render();
}

function init () {

    var params = {
        canvas: document.getElementById( 'codecanvas' )
    };

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    camera.position.z = -5.0;
    camera.lookAt(new THREE.Vector3(0,0,0));
    camera.up = new THREE.Vector3(0, 1, 0);
    var geometry = new THREE.PlaneGeometry( 2, 2 );
    uniforms = {
        time: { type: "f", value: 1.0 },
        resolution: { type: "v2", value: new THREE.Vector2() },
        ctw: {type: "m4", value: new THREE.Matrix4() }
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

    initControls();
    
/*
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );
*/
    setWindowSize();
//    onWindowResize();
    //window.addEventListener( 'resize', onWindowResize, false );
    animate();
}

function initControls() {
    controls = new THREE.TrackballControls( camera );

    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    controls.noZoom = false;
    controls.noPan = false;

    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.3;

    controls.keys = [ 65, 83, 68 ];

    //controls.addEventListener( 'change', render );
}

/*
function onWindowResize( event ) {

    uniforms.resolution.value.x = window.innerWidth;
    uniforms.resolution.value.y = window.innerHeight;

    renderer.setSize( window.innerWidth, window.innerHeight );

}
*/
function setWindowSize() {
    uniforms.resolution.value.x = 512*window.devicePixelRatio;
    uniforms.resolution.value.y = 512*window.devicePixelRatio;
    renderer.setSize(512, 512);

}

SHADER_LOADER.load(
        function (data)
        {
            vsh = data.shader.vertex;
            fsh = data.shader.fragment;
            init();
        }
    );

