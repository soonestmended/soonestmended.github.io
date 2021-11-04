var scene, camera, renderer, controls;
var container, stats;

var bodies;
var SPACE_SCALE = 1e-6, PLANET_SCALE = 1e3, dt = 1000, dt2 = dt*dt;

// TO DO:
// - figure out how to load textures first
// - add obliquity and albedo for each body
// - figure out a realistic way to model the sun
// 

function render () {
    renderer.render(scene, camera);
}

function initBodies() {
    console.log("START PROGRAM");
    bodies = [];
    var materials = [];

    // Sun
    bodies.push({
        GM: 1.3271244004193938e11,
	   radius: 6.963e5,
	x: new THREE.Vector3(3.463083126504958e5, -2.149864854315062e5, -1.862831560135746e4),
	v: new THREE.Vector3(8.303076374844115e-3,  7.642433156453070e-3, -2.024035171440966e-4)
    });

    materials.push(new THREE.MeshLambertMaterial( {color: 0xffff00, emissive: 0xffff00, shading: THREE.SmoothShading} ));

    // Mercury
    bodies.push({
        GM: 22032.09,
        radius: 2440,
        x: new THREE.Vector3(-4.112817475292420e7, -5.431854505109779e7, -6.341181040988876e5),
        v: new THREE.Vector3(2.880454647785831e1, -2.735254868898642e1, -4.877733619173689e0)
    });

    var textureMercury = THREE.ImageUtils.loadTexture("textures/planets/mercurymap.jpg");
    textureMercury.wrapS = textureMercury.wrapT = THREE.RepeatWrapping;

    materials.push(new THREE.MeshLambertMaterial( {color: 0x6f6f6f, map: textureMercury, shading: THREE.SmoothShading} ));

    // Venus 
    bodies.push({
        GM: 324858.63,
        radius: 6051.8,
        x: new THREE.Vector3(-6.410302302411748e7,  8.565854462672022e7,  4.877609866609613e6),
        v: new THREE.Vector3(-2.812329423409909e1, -2.120379038273279e1,  1.332547002586712e0)
    });

    var textureVenus = THREE.ImageUtils.loadTexture("textures/planets/venusmap.jpg");
    textureVenus.wrapS = textureVenus.wrapT = THREE.RepeatWrapping;

    materials.push(new THREE.MeshLambertMaterial( {color: 0x6f6f6f, map: textureVenus, shading: THREE.SmoothShading} ));


    // Earth
    bodies.push({
        GM: 398600.440, // km^3/s^2
    	radius: 6371,
    	x: new THREE.Vector3(1.423730730556617e8, -5.125317125046588e7, -1.767885004166645e4),
    	v: new THREE.Vector3(9.586951635782095e0,  2.793103237278907e1, -1.693043847014467e-3)
    });
    
    var textureEarth = THREE.ImageUtils.loadTexture("textures/planets/earth_atmos_2048.jpg");
    textureEarth.wrapS = textureEarth.wrapT = THREE.RepeatWrapping;

    materials.push(new THREE.MeshLambertMaterial( {color: 0x6f6f6f, map: textureEarth, shading: THREE.SmoothShading} ));

    // Mars
    bodies.push({
        GM: 42828.3, // km^3/s^2
        radius: 3389.9,
        x: new THREE.Vector3(1.672428350843589e7, -2.158997409755989e8, -4.939781396218862e6),
        v: new THREE.Vector3(2.508618175494291e1,  3.926407109087346e0, -5.336258572018341e-1)
    });

    var textureMars = THREE.ImageUtils.loadTexture("textures/planets/mars_1k_color.jpg");
    textureMars.wrapS = textureMars.wrapT = THREE.RepeatWrapping;

    materials.push(new THREE.MeshLambertMaterial( {color: 0x6f6f6f, map: textureMars, shading: THREE.SmoothShading} ));

    // Jupiter
    bodies.push({
        GM: 126686511, // km^3/s^2
        radius: 71492,
        x: new THREE.Vector3(-4.518014777062722e8, 6.475287415333122e8, 7.408789895491458e6),
        v: new THREE.Vector3(-1.087249630368972e1, -6.859587196833469e0, 2.718047511589537e-1)
    });

    var textureJupiter = THREE.ImageUtils.loadTexture("textures/planets/jupiter2_1k.jpg");
    textureJupiter.wrapS = textureJupiter.wrapT = THREE.RepeatWrapping;

    materials.push(new THREE.MeshLambertMaterial( {color: 0x6f6f6f, map: textureJupiter, shading: THREE.SmoothShading} ));

    //Saturn
    bodies.push({
        GM: 37931207.8, // km^3/s^2
        radius: 60268,
        x: new THREE.Vector3(-8.854151515386728E+08, -1.191787755398363E+09,  5.596020348571908E+07),
        v: new THREE.Vector3(7.227006224428269E+00 -5.785832925843103E+00, -1.875688277228256E-01)
    });

    var textureSaturn = THREE.ImageUtils.loadTexture("textures/planets/saturnmap.jpg");
    textureSaturn.wrapS = textureSaturn.wrapT = THREE.RepeatWrapping;

    materials.push(new THREE.MeshLambertMaterial( {color: 0x6f6f6f, map: textureSaturn, shading: THREE.SmoothShading} ));

    // Uranus
    bodies.push({
        GM: 5793966, // km^3/s^2
        radius: 25559,
        x: new THREE.Vector3(2.906496003409286E+09, 7.204210650937788E+08, -3.497897674360329E+07),
        v: new THREE.Vector3(-1.688141549002591E+00, 6.292550570602974E+00, 4.523231309696336E-02)
    });

    var textureUranus = THREE.ImageUtils.loadTexture("textures/planets/uranusmap.jpg");
    textureUranus.wrapS = textureUranus.wrapT = THREE.RepeatWrapping;

    materials.push(new THREE.MeshLambertMaterial( {color: 0x6f6f6f, map: textureUranus, shading: THREE.SmoothShading} ));

    // Neptune
    bodies.push({
        GM: 6835107, // km^3/s^2
        radius: 24766,
        x: new THREE.Vector3(4.096161267153756E+09, -1.823759565152169E+09, -5.684332395172664E+07),
        v: new THREE.Vector3(2.174933059124923E+00, 4.997109436308730E+00, -1.537373452388565E-01)
    });

    var textureNeptune = THREE.ImageUtils.loadTexture("textures/planets/neptunemap.jpg");
    textureNeptune.wrapS = textureNeptune.wrapT = THREE.RepeatWrapping;

    materials.push(new THREE.MeshLambertMaterial( {color: 0x6f6f6f, map: textureNeptune, shading: THREE.SmoothShading} ));


    // set up sphere geometries
    for (var i = 0; i < bodies.length; i++) {
    	if (i != 0) { // if not the sun
    	    geometry = new THREE.SphereGeometry(bodies[i].radius * SPACE_SCALE * PLANET_SCALE, 32, 32);
    	}
    	else {
    	    geometry = new THREE.SphereGeometry(bodies[i].radius * SPACE_SCALE * 10, 32, 32);
    	}
        
    	bodies[i].mesh = new THREE.Mesh(geometry, materials[i]);
    	bodies[i].mesh.position.copy(bodies[i].x);
    	bodies[i].mesh.position.multiplyScalar(SPACE_SCALE);
    	//bodies[i].mesh.rotation.set(0.409319755, 0, 0);
    	scene.add(bodies[i].mesh);
    }

    // set initial accelerations
    for (var i = 0; i < bodies.length; i++) {
       bodies[i].a = accel(i);
    }
   
}

function accel(j) {
    var accel = new THREE.Vector3(0, 0, 0);
    for (var i = 0; i < bodies.length; i++) {
	if (i == j) continue;
	var r = bodies[i].x.clone();
	r.sub(bodies[j].x);
	var l = r.lengthSq();
	r.normalize();
	r.multiplyScalar(bodies[i].GM / l);
	accel.add(r);
	console.log("R: " + r.toArray());
    }
    return accel;
}

function updateBodies() {
    // compute x(i+1)
    for (var i = 0; i < bodies.length; i++) {
	// bodies[i].a = accel(i);
	// bodies[i].x = bodies[i].x + bodies[i].v * dt + 0.5 * bodies[i].a * dt2;
	bodies[i].x.x += bodies[i].v.x * dt + bodies[i].a.x * dt2 * 0.5;
	bodies[i].x.y += bodies[i].v.y * dt + bodies[i].a.y * dt2 * 0.5;
	bodies[i].x.z += bodies[i].v.z * dt + bodies[i].a.z * dt2 * 0.5;

    }

    // compute a(i+1) and v(i+1) based on x(i+1)
    for (var i = 0; i < bodies.length; i++) {
	var a1 = accel(i);
	//bodies[i].v += 0.5 * (bodies[i].a + a1) * dt;
	bodies[i].v.x += 0.5 * (bodies[i].a.x + a1.x) * dt;
	bodies[i].v.y += 0.5 * (bodies[i].a.y + a1.y) * dt;
	bodies[i].v.z += 0.5 * (bodies[i].a.z + a1.z) * dt;

	bodies[i].a.copy(a1);
    }

    for (var i = 0; i < bodies.length; i++) {
	bodies[i].mesh.position.copy(bodies[i].x);
	bodies[i].mesh.position.multiplyScalar(SPACE_SCALE);
	//console.log("Body " + i + "   V: " + bodies[i].v.toArray());
    bodies[3].mesh.rotation.x = 1.97920337179; // PI/2 + 0.408407045;
	bodies[3].mesh.rotation.y += dt * 7.2921150e-5;
    }
}   

function animate() {
    updateBodies();
    requestAnimationFrame(animate); 
    render();
    controls.update();
    stats.update();
}

function init () {
    container = document.createElement( 'div' );
    document.body.appendChild( container );

    var geometry, sphere;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 100000);
    camera.position.z = 500;

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    initBodies();
    initLights();
    initControls();

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );
}

function initLights() {
    scene.add(new THREE.AmbientLight( 0x080808 ) );
    var light1 = new THREE.PointLight( 0x8f8f8f, 5, 999999999999 );
    light1.position.copy(bodies[0].x);
    light1.position.multiplyScalar(SPACE_SCALE);
    scene.add( light1 );
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

    controls.addEventListener( 'change', render );
}

init();

// wait until everything is loaded


//render();
window.setTimeout(animate(), 2000);

