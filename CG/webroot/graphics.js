window.onload = init;

const VERTEX_SHADER_SOURCE = 
`	attribute vec4 a_Position;
	attribute vec4 a_Normal;
	attribute vec2 a_TexCoord;
	uniform mat4 u_MvpMatrix;
	uniform mat4 u_ModelMatrix;
	uniform mat4 u_NormalMatrix;
	uniform vec3 u_PointLightPositions[2];
	uniform vec3 u_PointLightColors[2];
	uniform vec3 u_SpotLightPositions[2];
	uniform vec3 u_SpotLightColors[2];
	uniform vec3 u_SpotLightDirections[2];
	uniform vec2 u_SpotLightSpots[2];
	
	varying vec3 v_PointLightSurfaceDirections[2];
	varying vec3 v_PointLightColors[2];
	varying vec3 v_SpotLightPositions[2];
	varying vec3 v_SpotLightColors[2];
	varying vec3 v_SpotLightDirections[2];
	varying vec2 v_SpotLightSpots[2];
	varying vec3 v_SpotLightSurfaceDirections[2];
	varying vec4 v_Color;
	varying vec3 v_Normal;
	varying vec2 v_TexCoord;
	
	void main() {
		gl_Position = u_MvpMatrix * a_Position;
		vec4 vertexPosition = u_ModelMatrix * a_Position;
		for(int i = 0; i < 2; i++) {
			v_PointLightSurfaceDirections[i] = normalize(u_PointLightPositions[i] - vec3(vertexPosition));
			v_SpotLightSurfaceDirections[i] = normalize(u_SpotLightPositions[i] - vec3(vertexPosition));
			v_PointLightColors[i] = u_PointLightColors[i];
			v_SpotLightPositions[i] = u_SpotLightPositions[i];
			v_SpotLightColors[i] = u_SpotLightColors[i];
			v_SpotLightDirections[i] = u_SpotLightDirections[i];
			v_SpotLightSpots[i] = u_SpotLightSpots[i];
		}
		v_Color = vec4(0, 0, 1.0, 1.0);
		v_TexCoord = a_TexCoord;
		v_Normal = normalize((u_NormalMatrix * a_Normal).xyz);
	}
`;

const FRAGMENT_SHADER_SOURCE = `
	#ifdef GL_ES
	precision mediump float;
	#endif
	uniform sampler2D u_Sampler0;
	varying vec4 v_Color;
	varying vec3 v_Normal;
	varying vec2 v_TexCoord;
	varying vec3 v_PointLightSurfaceDirections[2];
	varying vec3 v_PointLightColors[2];
	varying vec3 v_SpotLightPositions[2];
	varying vec3 v_SpotLightColors[2];
	varying vec3 v_SpotLightDirections[2];
	varying vec2 v_SpotLightSpots[2];
	varying vec3 v_SpotLightSurfaceDirections[2];
	void main() {
		float pointNDotL = 0.0;
		float spotNDotL = 0.0;
		float spotDotFromDirection = 0.0;
		float spotLitRegion = 0.0; 
		vec4 texColor = texture2D(u_Sampler0, v_TexCoord);
		vec3 ambient = vec3(0.2, 0.2, 0.2) * texColor.rgb;
		vec3 diffuse = vec3(0,0,0);
		vec3 normal = vec3(0,1,0);
		for(int i = 0; i < 2; i++) {
			normal = normalize(v_Normal);
			pointNDotL = max(dot(normal, normalize(v_PointLightSurfaceDirections[i])), 0.0);
			diffuse += v_PointLightColors[i] * texColor.rgb * pointNDotL;
			spotDotFromDirection = dot(normalize(v_SpotLightSurfaceDirections[i]), -normalize(v_SpotLightDirections[i]));
			spotNDotL = max(dot(normal, normalize(v_SpotLightSurfaceDirections[i])), 0.0);
			spotLitRegion = smoothstep(v_SpotLightSpots[i].y, v_SpotLightSpots[i].x, spotDotFromDirection);
			diffuse += v_SpotLightColors[i] * texColor.rgb * spotLitRegion * spotNDotL;
		}
		gl_FragColor = vec4(diffuse + ambient, v_Color.a);
	}
`;

/**
	Create a shader of type, using the code string provided and the gl context.
*/
function createShader(gl, shaderType, shaderCode) {
	const shader = gl.createShader(shaderType);
	gl.shaderSource(shader, shaderCode);
	gl.compileShader(shader);
	let debugType = null;
	if(shaderType === gl.VERTEX_SHADER) {
		debugType = 'VERTEX_SHADER';
	}
	else if(shaderType === gl.FRAGMENT_SHADER) {
		debugType = 'FRAGMENT_SHADER';
	}
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert('Failed to create shader ' + debugType + ': ' + gl.getShaderInfoLog(shader));
		return null;
	}
	return shader;
}

/**
	Create a program on the gl context with the given vertex and fragment shader code
*/
function createProgram(gl, vertexShaderCode, fragmentShaderCode) {
	const program = gl.createProgram();
	gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShaderCode));
	gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderCode));
	gl.linkProgram(program);
	gl.useProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		alert('Failed to create shader program: ' + gl.getProgramInfoLog(program));
		return null;
	}
	return program;
}

/**
	Init. Bootstraps the scene
*/
function init() {
	//Create and init the scene. All world matrices need to be updated first, then lighting then drawing
	const scene = new Scene();
	scene.init();
	scene.sceneGraph.updateWorldMatrices(scene.sceneGraph);
	scene.updateLighting();
	scene.draw();
}

class Camera {
	constructor() {
		this.position = glMatrix.vec3.create();
		this.rx = 0;
		this.ry = 0;
		//A factor used for camera movement. Larger numbers make movement quicker/more difficult to control
		this.n = 1;
	}
	
	/**
		Degrees to radians for the camera class
	*/
	toRadians(angle) {
		return angle * (Math.PI / 180);
	}
	
	/**
		Process a key event. Since this function is used as a callback, it must be used from an arrow function
		to ensure the context of 'this' is correct.
	*/
	keyEventListener(e) {
		switch(e.keyCode) {
			case 87:
				this.move(new Float32Array([0, 0, 2 * this.n]));
				break;
			case 83:
				this.move(new Float32Array([0, 0, -2 * this.n]));
				break;
			case 65:
				this.move(new Float32Array([-2 * this.n, 0, 0]));
				break;
			case 68:
				this.move(new Float32Array([2 * this.n, 0, 0]));
				break;
			case 82:
				this.move(new Float32Array([0, 2 * this.n, 0]));
				break;
			case 70:
				this.move(new Float32Array([0, -2 * this.n, 0]));
				break;
			case 37:
				e.preventDefault();
				this.ry += 2 * this.n;
				break;
			case 39:
				e.preventDefault();
				this.ry -= 2 * this.n;
				break;
			case 38:
				e.preventDefault();
				this.rx += 2 * this.n;
				break;
			case 40:
				e.preventDefault();
				this.rx -= 2 * this.n;
				break;
		}
		if (this.ry < 0.0) this.ry += 360.0;

		if (this.rx > 89.0) {
			this.rx = 89.0;
		}
		if (this.rx <  -89.0) {
			this.rx = -89.0;
		}	
	}
	
	/**
		Move the camera by amount specified by vec array [x, y, z].
		This transformation depends on rx, ry rotations of the camera.
	*/
	move(vec) {
		if (vec[2] !== 0) {
            this.position[0] -= -Math.sin(this.toRadians(this.ry)) * vec[2];
            this.position[2] -= Math.cos(this.toRadians(this.ry)) * vec[2];
        }
        if (vec[0] !== 0) {
            this.position[0] -= -Math.sin(this.toRadians(this.ry - 90)) * vec[0];
            this.position[2] -= Math.cos(this.toRadians(this.ry - 90)) * vec[0];
        }
        this.position[1] -= vec[1];
	}
	
	rotate(vec) {
		this.rx += vec[0];
		this.ry += vec[1];
	}
	
	/**
		Get the view matrix for the camera. This will be the inverse of the camera matrix (which doesn't actually exist).
		Use order of transformations and negative positions to do this correctly.
	*/
	getViewMatrix() {
		const view = glMatrix.mat4.create();
		glMatrix.mat4.rotateX(view, view, this.toRadians(this.rx));
		glMatrix.mat4.rotateY(view, view, this.toRadians(this.ry));
		glMatrix.mat4.translate(view, view, new Float32Array([-this.position[0], -this.position[1], -this.position[2]]));
		return view;
	}
}

class Scene {
	constructor() {
		//Root node of the scene graph
		this.sceneGraph = null;
		//The gl context
		this.gl = null;
		//An object containing locations for shader uniforms
		this.uniformLocations = {};
		//The camera
		this.camera = new Camera();
		//The projection matrix
		this.projectionMatrix = null;
		//Total number of indices in this scene
		this.currentIndexCount = 0;
		//VBO offsets for each type of primitive shape
		this.vboOffsets = {};
		//All scene elements that are interactable
		this.selectableSceneElements = new SelectableSceneElements();
		//Array of scene elements that act as light sources
		this.lightSources = [];
		//Object containing point/spot light raw data arrays which will be passed to shaders
		this.lighting = new SceneLighting();
		//Object containing all textures available in this scene. We're not using texture offsets in this scene so it's simple
		this.textures = {};
	}
	
	init() {
		//Basic setup
		const canvas = document.querySelector('#glCanvas');
		const gl = canvas.getContext('webgl');
		if(gl === null) {
			alert('Your browser does not support WebGL');
			return;
		}
		this.gl = gl;
		
		if(!(this.gl.program = createProgram(this.gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE))) {
			console.log('Could not compile shaders');
			return;
		}
		this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
		//Make sure we draw Z-depth correctly
		this.gl.enable(gl.DEPTH_TEST);
		//Load all the uniforms
		if(!this.initUniform('u_MvpMatrix')) return false;
		if(!this.initUniform('u_ModelMatrix')) return false;
		if(!this.initUniform('u_NormalMatrix')) return false;
		if(!this.initUniform('u_PointLightColors')) return false;
		if(!this.initUniform('u_PointLightPositions')) return false;
		if(!this.initUniform('u_SpotLightPositions')) return false;
		if(!this.initUniform('u_SpotLightColors')) return false;
		if(!this.initUniform('u_SpotLightDirections')) return false;
		if(!this.initUniform('u_SpotLightSpots')) return false;
		if(!this.initUniform('u_Sampler0')) return false;
		//Initialise all objects available to the scene
		this.initObjects();
		//Create a scene graph from the initialised objects
		this.initSceneGraph();
		//Super simple projection matrix
		this.projectionMatrix = glMatrix.mat4.create();
		glMatrix.mat4.perspective(this.projectionMatrix, 50.0, canvas.width / canvas.height, 1.0, 1000.0);
		//Add all the keydown event listener code
		document.addEventListener('keydown', (e) => {
			if(e.keyCode === 219) {
				//[ backwards
				this.changeSelection(false);
			}
			else if(e.keyCode === 221) {
				//] forwards
				this.changeSelection(true);
			}
			//Get the currently selected element
			const selected = this.selectableSceneElements.selected;
			//If the element has a keyboard control scheme, pass the keycode and the scene graph node to it. Then do scene updates
			if(selected.keyboardControlScheme !== undefined && selected.keyboardControlScheme !== null) {
				selected.keyboardControlScheme.enact(e.keyCode, selected.sceneNode);
				this.sceneGraph.updateWorldMatrices(this.sceneGraph);
				this.updateLighting();
				this.draw();
			}
			//Let the camera check if it had a key pressed
			this.camera.keyEventListener(e);
			this.draw();
		}, true);
		//Initially, set the camera position/rotation to some sensible defaults
		this.camera.move([-80, 45, -100]);
		this.camera.rotate([-16, 316]);
		//Initialise the textures
		this.initTextures({
			floor: 'res/floor.jpg',
			seat: 'res/seat.jpg',
			wall: 'res/wall.jpg',
			woodenfurniture: 'res/woodenfurniture.jpg'
		});
		//Update the HUD information
		this.updateSelectionDOM();
	}
	
	/**
		Build the scene graph
	*/
	initSceneGraph() {
		const root = new SceneNode();
		
		//Table
		const table = new SceneNode();
		table.name = 'table';
		const leftFrontTableLeg = new SceneNode(this.vboOffsets.cube, 'left-front-leg');
		const rightFrontTableLeg = new SceneNode(this.vboOffsets.cube, 'right-front-leg');
		const leftBackTableLeg = new SceneNode(this.vboOffsets.cube, 'left-back-leg');
		const rightBackTableLeg = new SceneNode(this.vboOffsets.cube, 'right-back-leg');
		const tableTop = new SceneNode(this.vboOffsets.cube, 'top');
		leftFrontTableLeg.setScale(.5, 4, .5).setPosition(-5, 0, 3).setTexture('woodenfurniture');
		rightFrontTableLeg.setScale(.5, 4, .5).setPosition(5, 0, 3).setTexture('woodenfurniture');
		leftBackTableLeg.setScale(.5, 4, .5).setPosition(-5, 0, -3).setTexture('woodenfurniture');
		rightBackTableLeg.setScale(.5, 4, .5).setPosition(5, 0, -3).setTexture('woodenfurniture');
		tableTop.setScale(7,.5,5).setPosition(0,4.5,0).setTexture('woodenfurniture');
		table.addChildren([leftFrontTableLeg, rightFrontTableLeg, leftBackTableLeg, rightBackTableLeg, tableTop]);
		
		//Chair
		const chair = new SceneNode();
		chair.name = 'chair1';
		const leftFrontChairLeg = new SceneNode(this.vboOffsets.cube, 'left-front-leg');
		const rightFrontChairLeg = new SceneNode(this.vboOffsets.cube, 'right-front-leg');
		const leftBackChairLeg = new SceneNode(this.vboOffsets.cube, 'left-back-leg');
		const rightBackChairLeg = new SceneNode(this.vboOffsets.cube, 'right-back-leg');
		const chairSeat = new SceneNode(this.vboOffsets.cube, 'seat');
		const chairBack = new SceneNode(this.vboOffsets.cube, 'backrest');
		chair.setPosition(6, -1.5, 0);
		chair.setRotation(0, 90, 0);
		leftFrontChairLeg.setScale(.3, 2.5, .3).setPosition(-2, 0, 2).setTexture('woodenfurniture');
		rightFrontChairLeg.setScale(.3, 2.5, .3).setPosition(2, 0, 2).setTexture('woodenfurniture');
		leftBackChairLeg.setScale(.3, 2.5, .3).setPosition(-2, 0, -2).setTexture('woodenfurniture');
		rightBackChairLeg.setScale(.3, 2.5, .3).setPosition(2, 0, -2).setTexture('woodenfurniture');
		chairSeat.setScale(2.5, .25, 2.5).setPosition(0, 2.25, 0).setTexture('woodenfurniture');
		chairBack.setScale(2.5, 4, .25).setPosition(0, 6, 2.25).setTexture('woodenfurniture');
		chair.addChildren([leftFrontChairLeg, rightFrontChairLeg, leftBackChairLeg, rightBackChairLeg, chairSeat, chairBack]);
		
		//Chair 2
		const chair2 = chair.clone();
		chair2.name = 'chair2';
		chair2.setPosition(-6,-1.5,0).setRotation(0, -90, 0);
		
		//Chair 3
		const chair3 = chair.clone();
		chair3.name = 'chair3';
		chair3.setPosition(0, -1.5, 4).setRotation(0);
		
		//Chair 4
		const chair4 = chair.clone();
		chair4.name = 'chair4';
		chair4.setPosition(0, -1.5, -4).setRotation(0, 180, 0);
		
		//Couch
		const couch = new SceneNode();
		couch.name = 'couch';
		couch.setPosition(20,-2,15);
		const couchBase = new SceneNode(this.vboOffsets.cube, 'base');
		couchBase.setScale(10, 2, 4).setTexture('seat');
		const couchBack = new SceneNode(this.vboOffsets.cube, 'back');
		couchBack.setScale(10, 3, 1).setPosition(0, 3.5, 3).setTexture('seat');
		const couchLeft = new SceneNode(this.vboOffsets.cube, 'left');
		couchLeft.setScale(1.5, 1.25, 3).setPosition(-8.5, 3.25, -1).setTexture('seat');
		const couchRight = couchLeft.clone().setPosition(8.5, 3.25, -1).setTexture('seat');
		couch.addChildren([couchBase, couchBack, couchLeft, couchRight]);
		
		//Van
		const van = new SceneNode();
		van.name = 'van-tipped';
		const vanBack = new SceneNode(this.vboOffsets.cube, 'back');
		vanBack.setScale(3, 2, 2);
		const vanCabBack = new SceneNode(this.vboOffsets.cube, 'cab-back');
		vanCabBack.setScale(1.25, 1.8, 2).setPosition(4.5, -.2, 0).setTexture('woodenfurniture');
		const vanCabFront = new SceneNode(this.vboOffsets.cube, 'cab-front');
		vanCabFront.setScale(1, 1.2, 2).setPosition(6, -.8, 0).setTexture('woodenfurniture');
		const vanCabConnector = new SceneNode(this.vboOffsets.cube, 'cab-connector');
		vanCabConnector.setPosition(3.5, -.75, 0).setScale(1, 1.25, .8).setTexture('woodenfurniture');
		const vanWheels = new SceneNode();
		vanWheels.name = 'wheels';
		const vanRightFrontWheel = new SceneNode(this.vboOffsets.dodecagon, 'right-front-wheel');
		vanRightFrontWheel.setPosition(5.5, -1.5, -2).setScale(2, 2, .5).setTexture('woodenfurniture');
		const vanLeftFrontWheel = new SceneNode(this.vboOffsets.dodecagon, 'left-front-wheel');
		vanLeftFrontWheel.setPosition(5.5, -1.5, 2).setScale(2, 2, .5).setTexture('woodenfurniture');
		const vanRightBackWheel = new SceneNode(this.vboOffsets.dodecagon, 'right-back-wheel');
		vanRightBackWheel.setPosition(-1.5, -1.5, -2).setScale(2, 2, .5).setTexture('woodenfurniture');
		const vanLeftBackWheel = new SceneNode(this.vboOffsets.dodecagon, 'left-back-wheel');
		vanLeftBackWheel.setPosition(-1.5, -1.5, 2).setScale(2, 2, .5).setTexture('woodenfurniture');
		
		vanWheels.addChildren([vanRightFrontWheel, vanLeftFrontWheel, vanRightBackWheel, vanLeftBackWheel]);
		
		van.addChildren([vanBack, vanCabBack, vanCabFront, vanCabConnector, vanWheels]);
		van.setScale(.5).setPosition(15, -3, 3).setRotation(92, 0, 0);
		
		const vanMovable = van.clone();
		vanMovable.setRotation(0).setPosition(-10, -2.5, -15);
		vanMovable.name = 'van-movable';
		
		//The long spindly lamp
		const lamp = new SceneNode();
		lamp.name = 'lamp1';
		lamp.setPosition(32, -3.85, 15).setScale(1.5).setRotation(0, 30, 0);
		const lampBase = new SceneNode(this.vboOffsets.cube, 'base');
		lampBase.setScale(1, .1, 1).setTexture('darkgray');
		const lampPole = new SceneNode(this.vboOffsets.dodecagon, 'pole');
		lampPole.setScale(.25, .25, 15).setRotation(90, 0, 0).setPosition(0, 7.5, 0).setTexture('screen');
		const lampConnector = new SceneNode(this.vboOffsets.cube, 'connector');
		lampConnector.setScale(.25, .25, 1).setPosition(0, 15, -.75).setTexture('darkgray');
		const lampShade = new SceneNode(this.vboOffsets.cube, 'shade');
		lampShade.setScale(.75).setPosition(0, 15, -1.5).setRotation(-45, 0, 0).setTexture('deepblue');
		const lampBulb = new SceneNode(this.vboOffsets.cube, 'bulb');
		lampBulb.setScale(.2).setPosition(0, 0, -1).setTexture('white');
		lampShade.addChild(lampBulb);
		const lampBulbLight = new SceneNodeLight('spot', 'bulb-light');
		lampBulbLight.setRotation(0, 0, 0).setSpot(10, 30).setColor(1, 1, 1);
		lampBulb.addChild(lampBulbLight);
		this.lightSources.push(lampBulbLight);
		lamp.addChildren([lampBase, lampPole, lampConnector, lampShade]);
		//Constrain movement of the shade before we clone
		lampShade.setMinRotation(-45, null, null).setMaxRotation(45, null, null);
		
		const lamp2 = lamp.clone().setName('lamp2');
		lamp2.setPosition(-12, -3.85, 15).setRotation(0, -30, 0);
		const lamp2BulbLight = lamp2.getNestedChildByName('bulb-light').setColor(0, 0, 0).setSavedLightColor(0.5, 0.1, 0.1);
		this.lightSources.push(lamp2BulbLight);
		
		//We need walls and a floor
		const walls = new SceneNode();
		walls.name = 'walls';
		const wall1 = new SceneNode(this.vboOffsets.cube, 'wall1');
		wall1.setPosition(10, 11, 20).setScale(25, 15, 1).setTexture('wall');
		const wall2 = wall1.clone().setName('wall2');
		wall2.setPosition(35, 11, -4).setRotation(0, 90, 0).setTexture('wall');
		const floor = new SceneNode(this.vboOffsets.cube, 'floor');
		floor.setScale(25.5, .25, 25).setPosition(10.5, -4.25, -4).setTexture('floor');
		walls.addChildren([wall1, wall2, floor]);
		
		
		//Bookshelf
		const bookshelf = new SceneNode();
		bookshelf.setPosition(32, 2, -10).setScale(2, 1.5, 1.5);
		const bookshelfShelf1 = new SceneNode(this.vboOffsets.cube, 'shelf1');
		bookshelfShelf1.setScale(1, .1, 3).setPosition(0, -3, 0).setTexture('woodenfurniture');
		const bookshelfShelf2 = bookshelfShelf1.clone().setPosition(0, 0, 0).setName('shelf2');
		const bookshelfShelf3 = bookshelfShelf1.clone().setPosition(0, 3, 0).setName('shelf3');
		const bookshelfShelf4 = bookshelfShelf1.clone().setPosition(0, 6, 0).setName('shelf4');
		const bookshelfShelf5 = bookshelfShelf1.clone().setPosition(0, 9, 0).setName('shelf5');
		const bookshelfLeft = new SceneNode(this.vboOffsets.cube, 'left');
		bookshelfLeft.setScale(1, 7.5, .1).setPosition(0, 3.5, 3).setTexture('woodenfurniture');
		const bookshelfRight = bookshelfLeft.clone().setName('right');
		bookshelfRight.setPosition(0, 3.5, -3).setTexture('woodenfurniture');
		bookshelf.addChildren([bookshelfShelf1, bookshelfShelf2, bookshelfShelf3, bookshelfShelf4, bookshelfShelf5, bookshelfLeft, bookshelfRight]);
		
		
		//TV stand
		const tvStand = new SceneNode();
		const leftFrontTvStandLeg = new SceneNode(this.vboOffsets.cube, 'left-front-leg');
		const rightFrontTvStandLeg = new SceneNode(this.vboOffsets.cube, 'right-front-leg');
		const leftBackTvStandLeg = new SceneNode(this.vboOffsets.cube, 'left-back-leg');
		const rightBackTvStandLeg = new SceneNode(this.vboOffsets.cube, 'right-back-leg');
		const tvStandTop = new SceneNode(this.vboOffsets.cube, 'top');
		tvStandTop.setScale(5.5, .5, 3.5).setPosition(0, 3, 0).setTexture('woodenfurniture');
		const tvStandShelf = new SceneNode(this.vboOffsets.cube, 'shelf');
		tvStandShelf.setScale(5.5, .5, 3.5).setPosition(0, 0, 0).setTexture('woodenfurniture');
		leftFrontTvStandLeg.setScale(.5, 2.5, .5).setPosition(-5, 0, 3).setTexture('woodenfurniture');
		rightFrontTvStandLeg.setScale(.5, 2.5, .5).setPosition(5, 0, 3).setTexture('woodenfurniture');
		leftBackTvStandLeg.setScale(.5, 2.5, .5).setPosition(-5, 0, -3).setTexture('woodenfurniture');
		rightBackTvStandLeg.setScale(.5, 2.5, .5).setPosition(5, 0, -3).setTexture('woodenfurniture');
		const tvStandBottomBack = new SceneNode(this.vboOffsets.cube, 'bottom-back');
		tvStandBottomBack.setScale(5.5, 1, .5).setPosition(0, -1.5, -3).setTexture('woodenfurniture');
		const tvStandBottomRight = new SceneNode(this.vboOffsets.cube, 'bottom-right');
		tvStandBottomRight.setScale(.5, 1, 3.5).setPosition(-5, -1.5, 0).setTexture('woodenfurniture');
		const tvStandBottomLeft = tvStandBottomRight.clone();
		tvStandBottomLeft.name = 'bottom-left';
		tvStandBottomLeft.setPosition(5, -1.5, 0).setTexture('woodenfurniture');
		const tvStandDrawer = new SceneNode();
		tvStandDrawer.name = 'tv-stand-drawer';
		const tvStandDrawerBottom = new SceneNode(this.vboOffsets.cube, 'drawer-bottom');
		tvStandDrawerBottom.setScale(4.5, .1, 3.1).setPosition(0, -2.5, 0.5).setTexture('woodenfurniture');
		const tvStandDrawerBack = new SceneNode(this.vboOffsets.cube, 'drawer-back');
		tvStandDrawerBack.setScale(4.5, 1, .1).setPosition(0, -1.5, -2.5).setTexture('woodenfurniture');
		const tvStandDrawerFront = tvStandDrawerBack.clone();
		tvStandDrawerFront.name = 'drawer-front';
		tvStandDrawerFront.setPosition(0, -1.5, 3.5).setTexture('woodenfurniture');
		const tvStandDrawerLeft = new SceneNode(this.vboOffsets.cube, 'drawer-left');
		tvStandDrawerLeft.setScale(.1, 1, 3).setPosition(4.4, -1.5, 0.5).setTexture('woodenfurniture');
		const tvStandDrawerRight = tvStandDrawerLeft.clone();
		tvStandDrawerRight.name = 'drawer-right';
		tvStandDrawerRight.setPosition(-4.4, -1.5, 0.5).setTexture('woodenfurniture');
		const tvStandDrawerHandle = new SceneNode(this.vboOffsets.cube, 'drawer-handle');
		tvStandDrawerHandle.setScale(1, 0.25, 0.25).setPosition(0, -1.5, 3.6).setTexture('woodenfurniture');
		tvStandDrawer.addChildren([tvStandDrawerBottom, tvStandDrawerBack, tvStandDrawerFront, tvStandDrawerLeft, tvStandDrawerRight, tvStandDrawerHandle]);
		tvStand.addChildren([
			leftFrontTvStandLeg, 
			rightFrontTvStandLeg, 
			leftBackTvStandLeg, 
			rightBackTvStandLeg, 
			tvStandTop, 
			tvStandShelf, 
			tvStandBottomBack, 
			tvStandBottomRight,
			tvStandBottomLeft,
			tvStandDrawer
		]);
		tvStand.setPosition(20, -1.5, -25.5);
		
		//Fruit bowl
		const fruitBowl = tvStandDrawer.clone();
		fruitBowl.name = 'fruit-bowl';
		fruitBowl.removeChildByName('drawer-handle');
		fruitBowl.setScale(0.3, 0.25, 0.35).setPosition(0, 0, 0);
		const orange = new SceneNode(this.vboOffsets.sphere, 'orange1');
		orange.setPosition(.5, -.15, -.2).setTexture('orange');
		const orange2 = orange.clone();
		orange2.setPosition(-.5, -.15, -.2);
		const orange3 = orange.clone();
		orange3.setPosition(0, -.15, .6);
		const fruit = new SceneNode();
		fruit.name = 'fruit';
		fruit.setPosition(0, 5.5, 0);
		fruit.addChildren([orange, orange2, orange3, fruitBowl]);
		
		//TV
		const tv = new SceneNode();
		tv.name = 'tv';
		const tvScreen = new SceneNode(this.vboOffsets.cube, 'tv-screen');
		tvScreen.setScale(4.5, 2.53, .1).setPosition(0, -.25, 0).setTexture('screen');
		const tvLegLeft = new SceneNode(this.vboOffsets.cube, 'left-leg');
		tvLegLeft.setScale(.25, .25, 1).setPosition(3, -3, 0).setTexture('darkgray');
		const tvLegRight = new SceneNode(this.vboOffsets.cube, 'right-leg');
		tvLegRight.setScale(.25, .25, 1).setPosition(-3, -3, 0).setTexture('darkgray');
		tv.addChildren([tvScreen, tvLegLeft, tvLegRight]);
		tv.setPosition(20, 5, -25.5);
		
		
		//Group the entire table because we can
		const tableGroup = new SceneNode();
		tableGroup.name = 'table-group';
		tableGroup.addChild(table);
		tableGroup.addChild(chair);
		tableGroup.addChild(chair2);
		tableGroup.addChild(chair3);
		tableGroup.addChild(chair4);
		
		const sceneLight = new SceneNodeLight('point', 'scene-light');
		sceneLight.setPosition(-70, 0, -90).setColor(1, 1, 1);
		root.addChild(sceneLight);
		this.lightSources.push(sceneLight);
		
		const sceneLight2 = new SceneNodeLight('point', 'scene-light-2');
		sceneLight2.setPosition(-50, 0, 0).setColor(0.5, 0.225, 0);
		root.addChild(sceneLight2);
		this.lightSources.push(sceneLight2);
		
		//Add to scene graph
		root.addChild(couch);
		root.addChild(tableGroup);
		root.addChild(van);
		root.addChild(fruit);
		root.addChild(lamp);
		root.addChild(lamp2);
		root.addChild(walls);
		root.addChild(bookshelf);
		root.addChild(tvStand);
		root.addChild(tv);
		root.addChild(vanMovable);
		
		//Constrain movement for scene objects
		chair.setMinPosition(5, null, null).setMaxPosition(10, null, null);
		chair2.setMinPosition(-10, null, null).setMaxPosition(-5, null, null);
		chair3.setMinPosition(null, null, 3).setMaxPosition(null, null, 9);
		chair4.setMinPosition(null, null, -9).setMaxPosition(null, null, -3);
		tvStandDrawer.setMinPosition(0, 0, 0).setMaxPosition(0, 0, 10);
		lamp.setMinRotation(null, -10, null).setMaxRotation(null, 190, null);
		lamp2.setMinRotation(null, -100, null).setMaxRotation(null, 100, null);
		vanMovable.setMinPosition(-12, null, null).setMaxPosition(20, null, null);
		//Add keyboard controls for movable elements
		this.selectableSceneElements.add('chair1', chair, new KeyboardControlScheme({
			73: new KeyboardControl('I', 'Tuck chair in', (target) => {
				target.move(-1, 0, 0);
			}),
			75:	new KeyboardControl('K', 'Pull chair out', (target) => {
				target.move(1, 0, 0);
			})
		}));
		this.selectableSceneElements.add('chair2', chair2, new KeyboardControlScheme({
			73: new KeyboardControl('I', 'Tuck chair in', (target) => {
				target.move(1, 0, 0);
			}),
			75:	new KeyboardControl('K', 'Pull chair out', (target) => {
				target.move(-1, 0, 0);
			})
		}));
		this.selectableSceneElements.add('chair3', chair3, new KeyboardControlScheme({
			73: new KeyboardControl('I', 'Tuck chair in', (target) => {
				target.move(0, 0, -1);
			}),
			75:	new KeyboardControl('K', 'Pull chair out', (target) => {
				target.move(0, 0, 1);
			})
		}));
		this.selectableSceneElements.add('chair4', chair4, new KeyboardControlScheme({
			73: new KeyboardControl('I', 'Tuck chair in', (target) => {
				target.move(0, 0, 1);
			}),
			75:	new KeyboardControl('K', 'Pull chair out', (target) => {
				target.move(0, 0, -1);
			})
		}));
		const lampControls = new KeyboardControlScheme({
			74: new KeyboardControl('J', 'Rotate right', (target) => {
				target.rotate(0, -5, 0);
			}),
			76: new KeyboardControl('L', 'Rotate left', (target) => {
				target.rotate(0, 5, 0);
			}),
			73: new KeyboardControl('I', 'Tilt up', (target) => {
				const shade = target.getNestedChildByName('shade');
				shade.rotate(1, 0, 0);
			}),
			75:	new KeyboardControl('K', 'Tilt down', (target) => {
				const shade = target.getNestedChildByName('shade');
				shade.rotate(-1, 0, 0);
			}),
			85:	new KeyboardControl('U', 'Toggle light', (target) => {
				const light = target.getNestedChildByName('bulb-light');
				light.toggle();
			})
		});
		this.selectableSceneElements.add('lamp1', lamp, lampControls);
		this.selectableSceneElements.add('lamp2', lamp2, lampControls);
		this.selectableSceneElements.add('vanMovable', vanMovable, new KeyboardControlScheme({
			73: new KeyboardControl('I', 'Drive van forwards', (target) => {
				const wheels = target.getNestedChildByName('wheels').children;
				target.move(1, 0, 0);
				wheels.forEach((wheel) => {
					wheel.rotate(0, 0, 90);
				});
			}),
			75:	new KeyboardControl('K', 'Drive van backwards', (target) => {
				const wheels = target.getNestedChildByName('wheels').children;
				target.move(-1, 0, 0);
				wheels.forEach((wheel) => {
					wheel.rotate(0, 0, -90);
				});
			})
		}));
		this.selectableSceneElements.add('tv-stand-drawer', tvStandDrawer, new KeyboardControlScheme({
			73: new KeyboardControl('I', 'Close drawer', (target) => {
				target.move(0, 0, -1);
			}),
			75:	new KeyboardControl('K', 'Open drawer', (target) => {
				target.move(0, 0, 1);
			})
		}));
		//Add the root node to the scene's scene graph
		this.sceneGraph = root;
	}
	
	/**
		Get a uniform location. Error if we can't
	*/
	initUniform(name) {
		const u = this.gl.getUniformLocation(this.gl.program, name);
		if(!u) {
			console.log('Failed to init uniform location for: ' + name + '. Error: ' + this.gl.getError());
			return false;
		}
		this.uniformLocations[name] = u;
		return true;
	}
	
	/**
		Initialise all objects
	*/
	initObjects() {
		const cube = new SceneObjectCube();
		const dodecagon = new SceneObjectDodecagon();
		const sphere = new SceneObjectSphere();
		this.initSceneObjects([cube, sphere, dodecagon]);
		
	}
	
	/**
		Build the 4 arrays for all vertices, normals, indices, texCoords in the scene.
		Also store the offsets for each object within these arrays.
		If we needed more than the max short value number of indices in a scene, we would need multiple
		sets of VBOs. For our purposes with 3 primitives, we can store each object attribute in a single attribute VBO. 
	*/
	initSceneObjects(objects) {
		let offset = 0;
		let vOffset = 0;
		let vertices = [];
		let normals = [];
		let indices = [];
		let texCoords = [];
		for(let i = 0; i < objects.length; i++) {
			const obj = objects[i];
			this.vboOffsets[obj.name] = {};
			this.vboOffsets[obj.name].offset = offset;
			this.vboOffsets[obj.name].size = obj.indices.length;
			vertices = vertices.concat(obj.vertices);
			normals = normals.concat(obj.normals);
			texCoords = texCoords.concat(obj.texCoords);
			let objIndices = [].concat(obj.indices);
			if(i > 0) {
				const max = vOffset;
				//Adjust the indices with the vertex offset
				objIndices = objIndices.map((i) => {
					return i + max;
				});
			}
			indices = indices.concat(objIndices);
			offset += obj.indices.length;
			vOffset += objects[i].vertices.length / 3;
		}
		const vertexArray = new Float32Array(vertices);
		const normalArray = new Float32Array(normals);
		const indexArray = new Uint16Array(indices);
		const texCoordArray = new Float32Array(texCoords);
		//Now that we have the arrays, build the VBOs
		this.initBuffers(vertexArray, normalArray, indexArray, texCoordArray);
	}
	
	initBuffers(vertices, normals, indices, texCoords) {
		if (!this.initArrayBuffer('a_Position', vertices, this.gl.FLOAT, 3)) return false;
		if (!this.initArrayBuffer('a_Normal', normals, this.gl.FLOAT, 3)) return false;
		if (!this.initArrayBuffer('a_TexCoord', texCoords, this.gl.FLOAT, 2)) return false;
		if (this.initIndexBuffer(indices) < 1) return false;
		this.currentIndexCount = indices.length;
		return true;
	}
	
	/**
		Bind a standard array buffer with num size elements
	*/
	initArrayBuffer(attribute, data, type, num) {
		const buffer = this.gl.createBuffer();
		if (!buffer) {
			console.log('Failed to init array buffer');
			return false;
		}
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);

		const a_attribute = this.gl.getAttribLocation(this.gl.program, attribute);
		if (a_attribute < 0) {
			console.log('Failed to locate attribute ' + attribute);
			return false;
		}
		this.gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
		this.gl.enableVertexAttribArray(a_attribute);
		return true;
	}
	
	/**
		Bind an index buffer
	*/
	initIndexBuffer(indices) {
		const buffer = this.gl.createBuffer();
		if (!buffer) {
			console.log('Failed to init index buffer');
			return -1;
		}
		this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, buffer);
		this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
		return indices.length;
	}
	
	initTextures(textures) {
		/**
		Why are we generating some coloured textures instead of using vertex colours?
		Since only a few elements are using solid colours, it would make the shaders load more variables and branch more for no reason.
		We could create image files for these textures and just import them but that would mean we wait longer for all our
		async calls and redraw the entire scene more as the textures update.
		Technically it may be more performant to load vertex colours directly but since this scene is so small, it doesn't 
		matter and the time difference is likely way less significant than the lighting calculations anyway.
		*/
		this.addGeneratedTexture('orange', 255, 127, 0);
		this.addGeneratedTexture('screen', 36, 36, 36);
		this.addGeneratedTexture('darkgray', 169, 169, 169);
		this.addGeneratedTexture('deepblue', 0, 0, 89);
		this.addGeneratedTexture('white', 255, 255, 255);
		//Create a textures
		const texture = this.gl.createTexture();
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
		//Bind a temporary white image
		this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([1, 1, 1, 255]));
		for(let key of Object.keys(textures)) {
			//For every texture we declaed in the array, create an Image() with an onload callback
			this.textures[key] = texture;
			const image = new Image();
			if(!image) {
				console.log('Image class may not be supported');
				return;
			}
			image.src = textures[key];
			image.onload = () => {
				//When the image loads, create a new texture
				const loadedTexture = this.gl.createTexture();
				//Bind the texture to the gl context
				this.gl.bindTexture(this.gl.TEXTURE_2D, loadedTexture);
				//And load the image
				this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.RGB, this.gl.UNSIGNED_BYTE, image);
				//Update the scene's store of known textures with the loaded texture
				this.textures[key] = loadedTexture;
				this.draw();
			};
		}
	}
	
	/**
		Generate a named texture with the given color
	*/
	addGeneratedTexture(name, r, g, b) {
		const texture = this.gl.createTexture();
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
		this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, 255]));
		this.textures[name] = texture;
	}
	
	/**
		Wrapper to get the view matrix from the camera. Just to make calls easier
	*/
	getViewMatrix() {
		return this.camera.getViewMatrix();
	}
	
	/**
		Get the ViewProjection matrix by multiplying the camera's view matrix and the scene's projection matrix
	*/
	getViewProjectionMatrix() {
		const viewProjectionMatrix = glMatrix.mat4.create();
		glMatrix.mat4.multiply(viewProjectionMatrix, this.projectionMatrix, this.camera.getViewMatrix());
		return viewProjectionMatrix;
	}
	
	/**
		The main draw call
	*/
	draw() {
		//Clear, ready for drawing
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
		/**
		If the scene graph exists, call draw on the root node, passing the root node itself (not necessary but a future-proof partial redraw feature).
		Inject 'this' SceneGraph context since the draw functions will need to grab global data
		*/
		if(this.sceneGraph) {
			this.sceneGraph.draw(this.sceneGraph, this);
		}
	}
	
	/**
		Move the selection of scene elements to next or prev
	*/
	changeSelection(forward = true) {
		if(forward) {
			this.selectableSceneElements.selected = this.selectableSceneElements.selected.next;
		}
		else {
			this.selectableSceneElements.selected = this.selectableSceneElements.selected.prev;
		}
		this.updateSelectionDOM();
	}
	
	/**
		Just do some HUD updates. This is basic JS stuff
	*/
	updateSelectionDOM() {
		const val = document.createTextNode(this.selectableSceneElements.selected.sceneNode.name);
		const selectedDOM = document.getElementById('currently-selected');
		if(selectedDOM.firstChild !== null) selectedDOM.removeChild(selectedDOM.firstChild);
		selectedDOM.appendChild(val);
		const contextualControls = document.getElementById('contextual-controls');
		while(contextualControls.firstChild !== null) contextualControls.removeChild(contextualControls.firstChild);
		const kcs = this.selectableSceneElements.selected.keyboardControlScheme;
		for(let key of Object.keys(kcs.controls)) {
			const control = kcs.controls[key];
			const p = document.createElement('p');
			const t = document.createTextNode(control.keyLabel + ' ' + control.keyDescription);
			p.appendChild(t);
			contextualControls.appendChild(p);
		}
	}
	
	/**
		Run a lighting update. WARNING: All available lighting slots should be filled with something, even if it is 0s.
		Shaders do not like empty arrays to be passed. We could add zero-fill functionality for all empty/short arrays but since we are using
		all lighting slots, don't bother.
	*/
	updateLighting() {
		const MAX_POINT_LIGHTS = 2;
		const MAX_SPOT_LIGHTS = 2;
		const pointPositions = [];
		const pointColors = [];
		const spotPositions = [];
		const spotColors = [];
		const spotDirections = [];
		const spotSpots = [];
		for(let light of this.lightSources) {
			if(light.lightType === 'point') {
				//Grab the location of the spotlight
				pointPositions.push(light.worldMatrix[12], light.worldMatrix[13], light.worldMatrix[14]);
				pointColors.push(light.lightColor[0], light.lightColor[1], light.lightColor[2]);
			}
			else if(light.lightType === 'spot') {
				spotPositions.push(light.worldMatrix[12], light.worldMatrix[13], light.worldMatrix[14]);
				spotColors.push(light.lightColor[0], light.lightColor[1], light.lightColor[2]);
				spotSpots.push(light.lightSpot[0], light.lightSpot[1]);
				//Get the direction that the matrix considers "forwards" and use that as the direction for the spotlight
				const direction = [light.worldMatrix[8], light.worldMatrix[9], light.worldMatrix[10]];
				const length = Math.sqrt(Math.pow(direction[0], 2) + Math.pow(direction[1], 2) + Math.pow(direction[2], 2));
				if(length !== 0) {
					spotDirections.push(direction[0] / length, direction[1] / length, direction[2] / length);
				}
				else {
					spotDirections.push(0, 0, 0);
				}
			}
		}
		
		this.lighting.pointLights = {positions: pointPositions, colors: pointColors};
		this.lighting.spotLights = {positions: spotPositions, colors: spotColors, directions: spotDirections, spots: spotSpots};
	}
}

/**
	A simple class to store lighting for the scene
*/
class SceneLighting {
	constructor() {
		this.pointLights = {
			positions: [],
			colors: []
		};
		this.spotLights = {
			positions: [],
			colors: [],
			directions: [],
			/**
				Additional data for every spot light:
				0 - Spot limit: cos(angle in radians),
				1 - Spot smoothing inner,
				2 - Spot smoothing outer
				Outer > inner
			*/
			spots: []
		};
	}
}

/**
	A wrapper class for the linked list of selectable scene elements.
	Use to keep track of the currently selected element
*/
class SelectableSceneElements {
	constructor() {
		this.elements = {};
		this.selected = null;
	}
	
	/**
		Add a scene node to the selectable elements. Scene nodes have no concept of a linked list
		between selectable elements, only a graph relation between nodes. Therefore, we must wrap them
		in SelectableSceneElementNode first to build a linked list.
	*/
	add(name, sceneNode, keyboardControlScheme) {
		const els = Object.keys(this.elements);
		if(els.length === 0) {
			//If this is the first element to be added, link it to itself
			const s = new SelectableSceneElementNode(sceneNode);
			s.keyboardControlScheme = keyboardControlScheme;
			s.next = s;
			s.prev = s;
			this.elements[name] = s;
			this.selected = s;
		}
		else {
			//For all other elements, link them cyclically to the end of the list
			const s = new SelectableSceneElementNode(sceneNode);
			s.keyboardControlScheme = keyboardControlScheme;
			s.prev = this.elements[els[els.length - 1]];
			s.next = this.elements[els[0]];
			this.elements[els[0]].prev = s;
			this.elements[els[els.length - 1]].next = s;
			this.elements[name] = s;
			this.selected = s;
		}
	}
	
	getSceneNode(name) {
		return this.elements[name].sceneNode;
	}
}

class KeyboardControlScheme {
	constructor(controls = {}) {
		//All controls available on this scheme
		this.controls = controls;
	}
	
	/**
		Label is a user-friendly name for the key.
		Description is a user-friendly description for the action
		Action should be a callback function
	*/
	addControl(keyCode, label, description, action) {
		this.controls[keyCode] = new KeyboardControl(label, description, action);
		return this;
	}
	
	/**
		Perform the action specified by the keycode on the target
	*/
	enact(keyCode, target) {
		if(this.controls[keyCode] === undefined) return;
		const action = this.controls[keyCode].action;
		action(target);
	}
}

class KeyboardControl {
	constructor(label, description, action) {
		this.keyLabel = label;
		this.keyDescription = description;
		this.action = action;
	}
}

/**
	Wrapper around a SceneNode to create a linked list of selectable elements
	Also contains a KeyboardControlScheme for the element
*/
class SelectableSceneElementNode {
	constructor(sceneNode) {
		this.next = null;
		this.prev = null;
		this.sceneNode = sceneNode;
		this.keyboardControlScheme = null;
	}
}

/**
	Superclass for scene object declarations
	Also contains helper functions
*/
class SceneObject {
	constructor() {
		this.vertices = null;
		this.normals = null;
		this.indices = null;
		this.texCoords = null;
	}
	
	/**
		Generate vertices of an n sided polygon with given size and center
	*/
	get2DPolygon(center, size, n) {
		const exteriorAngle = 360 / n;
		const vertices = [];
		vertices.push(0);
		vertices.push(0);
		vertices.push(0);
		for(let i = 0; i < n; i++) {
			const angle = exteriorAngle * i - (exteriorAngle / 2);
			const angleRad = Math.PI / 180 * angle;
			vertices.push(center + size * Math.cos(angleRad));
			vertices.push(center + size * Math.sin(angleRad));
			vertices.push(0);
		}
		return vertices;
	}
	
	/**
		Generate the texture coordinates for an n sided polygon
		The center will be about (0.5, 0.5) to correctly map to the (u, v) plane
	*/
	makeTextureCoords2DPolygon(n) {
		const exteriorAngle = 360 / n;
		const texCoords = [];
		for(let i = 0; i <= n; i++) {
			const j = i % n;
			const angle = exteriorAngle * j - (exteriorAngle / 2);
			const angleRad = Math.PI / 180 * angle;
			texCoords.push(0.5, 0.5);
			texCoords.push(0.5 + 0.5 * Math.cos(angleRad));
			texCoords.push(0.5 + 0.5 * Math.sin(angleRad));
		}
		return texCoords;
	}
	
	/**
		Take a 2D polygon and get values shifted on the Z axis to help form a cylinder base n-poly
	*/
	extrudeZ(vertices, amount) {
		if(vertices.length % 3 !== 0) return vertices;
		const extruded = [];
		for(let i = 0; i < vertices.length; i += 3) {
			extruded.push(vertices[i]);
			extruded.push(vertices[i + 1]);
			extruded.push(vertices[i + 2] + amount);
		}
		return extruded;
	}
	
	/**
		Link the extruded front and back faces to form an n-poly based cylinder
		Generate vertices, indices and texture coordinates on the fly.
		Also accept an offset to use for indices since this will probably be generated after indices
		for the front/back faces have been generated.
	*/
	linkExtruded(front, back, offset = 0) {
		if(front.length !== back.length) {
			console.log('Linking extruded faces is only possible with same vertex counts');
			return;
		}
		let linked = [];
		const indices = [];
		const texCoords = [];
		const f = front.slice(3, front.length);
		const b = back.slice(3, back.length);
		let j = 0;
		for(let i = 0; i < f.length; i += 3) {
			linked = linked.concat(this.subarray(f, i, 3));
			linked = linked.concat(this.subarray(f, i + 3, 3));
			linked = linked.concat(this.subarray(b, i + 3, 3));
			linked = linked.concat(this.subarray(b, i, 3));
			indices.push(i + offset + j);
			indices.push(i + 1 + offset + j);
			indices.push(i + 2 + offset + j);
			indices.push(i + offset + j);
			indices.push(i + 2 + offset + j);
			indices.push(i + 3 + offset + j);
			texCoords.push(0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0);
			//0, 1, 2, 0, 2, 3
			j++;
		}
		return {vertices: linked, indices: indices, texCoords: texCoords};
	}
	
	/**
		Get part of an array, looping round to the start of the array when we fall off the tail end
	*/
	subarray(array, start, count) {
		const sub = [];
		for(let i = 0; i < count; i++) {
			sub.push(array[(start + i) % array.length]);
		}
		return sub;
	}
	
	/**
		Generate the indices for a regular polygon.
		Accept an offset in case this is not the first set of indices for the object
	*/
	makeIndicesRegularPoly(vertices, offset = 0) {
		const indices = [];
		for(let i = 3; i < vertices.length - 3; i += 3) {
			indices.push(offset);
			indices.push(i / 3 + offset);
			indices.push((i / 3) + 1 + offset);
		}
		indices.push(offset);
		indices.push(1 + offset)
		indices.push(vertices.length / 3 + offset - 1);
		return indices;
	}
	
	/**
		Create normals
	*/
	makeFrontBackNormals(front, back) {
		const normals = [];
		for(let i = 0; i < front.length / 3; i++) {
			normals.push(0.0);
			normals.push(0.0);
			normals.push(1.0);
		}
		for(let i = 0; i < back.length / 3; i++) {
			normals.push(0.0);
			normals.push(0.0);
			normals.push(-1.0);
		}
		return normals;
	}
	
	
	/**
		Create the normals for each edge of a regular cylindrical polygon.
		We don't need the cross product here since we make know that the center of the
		polygon generated with extrudeZ will be at (0,0,0). Therefore, to find a normal to the plane of the square,
		it is sufficient to take the midpoint of that square (which follows the same rule of normals on a sphere).
		Essentially each normal is the direction vector from the center to the midpoint (which is just the midpoint).
	*/
	makePolyEdgeNormals(extruded) {
		let normals = [];
		for(let i = 0; i < extruded.length; i += 12) {
			const v = this.subarray(extruded, i, 3);
			const v2 = this.subarray(extruded, i + 3, 3);
			const v1 = this.subarray(extruded, i + 6, 3);
			
			const m1 = this.midpoint(v, v1);
			const m2 = this.midpoint(v, v2);
			const d = this.directionVector(v, m1);
			const squareCenter = this.addVector(m2, d);
			
			normals = normals.concat(squareCenter).concat(squareCenter).concat(squareCenter).concat(squareCenter);
		}
		return normals;
	}
	
	/**
		Generate a cycliner of given radius with given number of edges
	*/
	makeCylinder(radius, edges) {
		const p = this.get2DPolygon(0, radius, edges);
		const f = this.extrudeZ(p, .5);
		const b = this.extrudeZ(p, -.5);
		const fi = this.makeIndicesRegularPoly(f);
		const e = this.linkExtruded(f, b, f.length / 3 + b.length / 3);
		const bi = this.makeIndicesRegularPoly(b, f.length / 3);
		const ft = this.makeTextureCoords2DPolygon(edges);
		this.vertices = f.concat(b).concat(e.vertices);
		this.indices = fi.concat(bi).concat(e.indices);
		this.texCoords = ft.concat(ft).concat(e.texCoords);
		const n = this.makeFrontBackNormals(f, b);
		this.normals = n.concat(this.makePolyEdgeNormals(e.vertices));
	}
	
	/**
		Generate a UV Sphere with given radius and number of stacks/sectors for latitude/longitude.
		Icosphere's may be better but more complex to generate. For our purposes, a UV sphere is sufficient.
		There are many ways to generate a UV Sphere using polar coordinates.
	*/
	makeSphere(radius, stackCount, sectorCount) {
		const thetaStep = 2 * Math.PI / sectorCount;
		const phiStep = Math.PI / stackCount;
		let vertices = [];
		let normals = [];
		let texCoords = [];
		for(let i = 0; i <= stackCount; i++) {
			const stackAngle = Math.PI / 2 - i * phiStep;
			const rCosPhi = radius * Math.cos(stackAngle);
			const z = radius * Math.sin(stackAngle);
			
			for(let j = 0; j <= sectorCount; j++) {
				const sectorAngle = j * thetaStep;
				const x = rCosPhi * Math.cos(sectorAngle);
				const y = rCosPhi * Math.sin(sectorAngle);
				vertices = vertices.concat([x, y, z]);
				
				normals = normals.concat(this.normalize([x, y, z]));
				
				const u = j / sectorCount;
				const v = i / stackCount;
				texCoords.push(u, v);
			}
		}
		this.vertices = vertices;
		this.normals = normals;
		this.texCoords = texCoords;
		this.indices = this.makeSphereIndices(stackCount, sectorCount);
	}
	
	/**
		Indices for a UV Sphere
	*/
	makeSphereIndices(stackCount, sectorCount) {
		let indices = [];
		for(let i = 0; i < stackCount; i++) {
			let k1 = i * (sectorCount + 1);
			let k2 = k1 + sectorCount + 1;
			
			for(let j = 0; j < sectorCount; j++) {
				if(i !== 0) {
					indices = indices.concat([k1, k2, k1 + 1]);
				}
				
				if(i !== (stackCount - 1)) {
					indices = indices.concat([k1 + 1, k2, k2 + 1]);
				}
				k1++;
				k2++;
			}
		}
		return indices;
	}
	
	/**
		Get the midpoint between 2 3D position vectors
	*/
	midpoint(a, b) {
		const m = [];
		m[0] = a[0] + (b[0] - a[0]) / 2;
		m[1] = a[1] + (b[1] - a[1]) / 2;
		m[2] = a[2] + (b[2] - a[2]) / 2;
		return m;
	}
	
	/**
		Normalize a 3D vector
	*/
	normalize(a) {
		const s = Math.sqrt(Math.pow(a[0], 2) + Math.pow(a[1], 2) + Math.pow(a[2], 2));
		const n = [a[0] / s, a[1] / s, a[2] / s];
		return n;
		
	}
	
	/**
		Invert a 3D vector
	*/
	invert(a) {
		return [-a[0], -a[1], -a[2]];
	}
	
	/**
		Add 2 3D vectors
	*/
	addVector(a, b) {
		const v = [];
		v[0] = a[0] + b[0];
		v[1] = a[1] + b[1];
		v[2] = a[2] + b[2];
		return v;
	}
	
	/**
		Get the 3D direction vector between 2 3D position vectors
	*/
	directionVector(a, b) {
		const v = [];
		v[0] = b[0] - a[0];
		v[1] = b[1] - a[1];
		v[2] = b[2] - a[2];
		return v;
	}
	
	/**
		Dot product between 2 3D vectors
	*/
	dotProduct(a, b) {
		return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	}
	
	/**
		Cross product between 2 3D vectors
	*/
	crossProduct(a, b) {
		const c = [];
		c[0] = a[1] * b[2] - a[2] * b[1];
		c[1] = a[0] * b[2] - a[2] * b[0];
		c[2] = a[0] * b[1] - a[1] * b[0];
		return c;
	}
}

class SceneObjectCube extends SceneObject {
	constructor() {
		super();
		//We could now generate a cube with a 4-sided cylinder generator using a unit depth, but this was here first so might as well use it
		this.vertices = [
			//Front
			-1.0, -1.0,  1.0,
			1.0, -1.0,  1.0,
			1.0,  1.0,  1.0,
			-1.0,  1.0,  1.0,

			//Back
			-1.0, -1.0, -1.0,
			-1.0,  1.0, -1.0,
			1.0,  1.0, -1.0,
			1.0, -1.0, -1.0,

			//Top
			-1.0,  1.0, -1.0,
			-1.0,  1.0,  1.0,
			1.0,  1.0,  1.0,
			1.0,  1.0, -1.0,

			//Bottom
			-1.0, -1.0, -1.0,
			1.0, -1.0, -1.0,
			1.0, -1.0,  1.0,
			-1.0, -1.0,  1.0,

			//Right
			1.0, -1.0, -1.0,
			1.0,  1.0, -1.0,
			1.0,  1.0,  1.0,
			1.0, -1.0,  1.0,

			//Left
			-1.0, -1.0, -1.0,
			-1.0, -1.0,  1.0,
			-1.0,  1.0,  1.0,
			-1.0,  1.0, -1.0,
		];
	
		this.normals = [
			0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0, //Front
			0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0, //Back
			0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0, //Top
			0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0, //Bottom
			1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0, //Right
		   -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, //Left
		];
		
		this.indices = [
			0,  1,  2,  0,  2,  3, //Front
			4,  5,  6,  4,  6,  7, //Back
			8,  9,  10, 8,  10, 11, //Top
			12, 13, 14, 12, 14, 15, //Bottom
			16, 17, 18, 16, 18, 19, //Right
			20, 21, 22, 20, 22, 23, //Left
		];

		this.texCoords = [
			0.0, 0.0,	1.0, 0.0,	1.0, 1.0,	0.0, 1.0, //Front
			1.0, 1.0,	0.0, 1.0,	0.0, 0.0,	1.0, 0.0, //Back
			0.0, 1.0,	0.0, 0.0,	1.0, 0.0,	1.0, 1.0, //Top
			1.0, 1.0,	0.0, 1.0,	0.0, 0.0,	1.0, 0.0, //Bottom
			1.0, 0.0,	1.0, 1.0,	0.0, 1.0,	0.0, 0.0, //Right
			0.0, 0.0,	1.0, 0.0,	1.0, 1.0,	0.0, 1.0, //Left
		];

		this.name = 'cube';
	}
}

class SceneObjectDodecagon extends SceneObject {
	constructor() {
		super();
		this.makeCylinder(0.5, 12);
		this.name = 'dodecagon';
	}
}

class SceneObjectSphere extends SceneObject {
	constructor() {
		super();
		this.makeSphere(0.5, 20, 20);
		this.name = 'sphere';
	}
}

class SceneNode {
	constructor(drawInfo = null, name = null) {
		//The parent of this scene node. The scene graph root will always have parent null
		this.parent = null;
		this.children = [];
		//Local transformation matrix of this scene node
		this.localMatrix = glMatrix.mat4.create();
		//World transformation matrix of this scene node. This will be parent.worldMatrix * localMatrix or localMatrix if this is the root
		this.worldMatrix = glMatrix.mat4.create();
		//The transformations used to build the localMatrix. We use this to avoid stacking imprecision
		this.transformationBase = new TransformationBase();
		this.drawInfo = null;
		//Information about where to find the vertices/texture for this node.
		if(drawInfo !== null) {
			this.drawInfo = new DrawInfo();
			this.drawInfo.size = drawInfo.size;
			this.drawInfo.offset = drawInfo.offset;
			this.drawInfo.glTexture = drawInfo.glTexture;
		}
		//Name. Useful for debugging and searching for a named child element from a parent
		this.name = name;
		this.texture = null;
	}
	
	/**
		Run a depth-first traversal from the start node to the leaves, running the callback each time.
		We could not use a starting point, but if we want to traverse from deeper e.g. for a partial redraw, it is inefficient
		to traverse to find a node we already have.
		Use an explicit stack to avoid recursion so in the case of a deeply nested scene graph we don't run into issues.
	*/
	traverse(start, callback) {
		const stack = [start];
		while(stack.length > 0) {
			const node = stack.pop();
			node.children.forEach((child) => {
				stack.push(child);
			});
			const action = callback(node);
			//If the callback returned false, stop traversing. Use this to prematurely terminate the traversal.
			if(action === false) break;
		}
	}
	
	/**
		Use our traversal dfs to draw the node
	*/
	draw(start, scene) {
		let f = false;
		this.traverse(start, (node) => {
			//If there is no drawInfo, this node is special (a group transformer or light)
			if(node.drawInfo === null) return;
			//Calculate the mvp matrix once on the CPU so our shaders don't need to keep doing it
			const mvpMatrix = glMatrix.mat4.multiply(glMatrix.mat4.create(), scene.getViewProjectionMatrix(), node.worldMatrix);
			//Get the uniforms
			scene.gl.uniformMatrix4fv(scene.uniformLocations.u_ModelMatrix, false, node.worldMatrix);
			scene.gl.uniformMatrix4fv(scene.uniformLocations.u_MvpMatrix, false, mvpMatrix);
			//Create a normal matrix
			const normalMatrix = glMatrix.mat4.invert(glMatrix.mat4.create(), node.worldMatrix);
			glMatrix.mat4.transpose(normalMatrix, normalMatrix);
			scene.gl.uniformMatrix4fv(scene.uniformLocations.u_NormalMatrix, false, normalMatrix);
			scene.gl.uniform3fv(scene.uniformLocations.u_PointLightPositions, scene.lighting.pointLights.positions);
			scene.gl.uniform3fv(scene.uniformLocations.u_PointLightColors, scene.lighting.pointLights.colors);
			scene.gl.uniform3fv(scene.uniformLocations.u_SpotLightPositions, scene.lighting.spotLights.positions);
			scene.gl.uniform3fv(scene.uniformLocations.u_SpotLightColors, scene.lighting.spotLights.colors);
			scene.gl.uniform3fv(scene.uniformLocations.u_SpotLightDirections, scene.lighting.spotLights.directions);
			scene.gl.uniform2fv(scene.uniformLocations.u_SpotLightSpots, scene.lighting.spotLights.spots);
			//If this node has some texture info and the scene contains a matching texture, bind it
			if(node.texture !== null && scene.textures[node.texture] !== undefined) {
				scene.gl.pixelStorei(scene.gl.UNPACK_FLIP_Y_WEBGL, 1);
				scene.gl.activeTexture(scene.gl.TEXTURE0);
				scene.gl.uniform1i(scene.uniformLocations.u_Sampler0, 0);
				scene.gl.bindTexture(scene.gl.TEXTURE_2D, scene.textures[node.texture]);
				scene.gl.texParameteri(scene.gl.TEXTURE_2D, scene.gl.TEXTURE_MIN_FILTER, scene.gl.LINEAR);
			}
			//Draw the node
			scene.gl.drawElements(scene.gl.TRIANGLES, node.drawInfo.size, scene.gl.UNSIGNED_SHORT, node.drawInfo.offset * 2); //*2 for byte offset of SHORT
		});
	}
	
	/**
		Use our dfs traversal to update all world matrices. We can do this once, then don't need to do it again unless something changes.
		This saves recalculating a matrix/doing a push/pop to create/restore a matrix on every draw call which is inefficient
	*/
	updateWorldMatrices(start) {
		this.traverse(start, (node) => {
			node.updateLocalMatrix();
			if(node.parent === null) {
				node.worldMatrix = node.localMatrix;
				return;
			}
			glMatrix.mat4.multiply(node.worldMatrix, node.parent.worldMatrix, node.localMatrix);
		});
	}
	
	addChild(child) {
		child.parent = this;
		this.children.push(child);
		return this;
	}
	
	addChildren(children) {
		for(let child of children) {
			child.parent = this;
			this.children.push(child);
		}
		return this;
	}
	
	removeChild(child) {
		const index = this.children.indexOf(child);
		if(index > -1) {
			this.children[index].parent = null;
			this.children.splice(index, 1);
		}
	}
	
	removeChildByName(name) {
		for(let i = 0; i < this.children.length; i++) {
			if(this.children[i].name === name) {
				this.children[i].parent = null;
				this.children.splice(i, 1);
				break;
			}
		}
	}
	
	/**
		Get a child by name. This can be any number of layers deeper than the current node.
		Return false once found so our traversal ceases.
	*/
	getNestedChildByName(name) {
		let foundNode = null;
		this.traverse(this, (node) => {
			if(node.name === name) {
				foundNode = node;
				return false;
			}
		});
		return foundNode;
	}
	
	setName(name) {
		this.name = name;
		return this;
	}
	
	/**
		Use our basic transformation information to construct this node's local matrix
	*/
	updateLocalMatrix() {
		const mat = glMatrix.mat4.create();
		glMatrix.mat4.translate(mat, mat, [-this.transformationBase.position[0], -this.transformationBase.position[1], -this.transformationBase.position[2]]);
		glMatrix.mat4.rotateX(mat, mat, this.toRadians(this.transformationBase.rotation[0]));
		glMatrix.mat4.rotateY(mat, mat, this.toRadians(this.transformationBase.rotation[1]));
		glMatrix.mat4.rotateZ(mat, mat, this.toRadians(this.transformationBase.rotation[2]));
		glMatrix.mat4.scale(mat, mat, this.transformationBase.scale);
		this.localMatrix = mat;
	}
	
	toRadians(angle) {
		return angle * (Math.PI / 180);
	}
	
	/**
		Check bounds for a transformation to ensure this node is able to undergo such a transformation
	*/
	isWithinBounds(axis, change, transformation) {
		const maxBound = this.transformationBase.maxes[transformation];
		const minBound = this.transformationBase.mins[transformation];
		if(change < 0){
			if(minBound[axis] === null) return true;
			return this.transformationBase[transformation][axis] + change >= minBound[axis];
		}
		if(change > 0){
			if(maxBound[axis] === null) return true;
			return this.transformationBase[transformation][axis] + change <= maxBound[axis];
		}
		return false;
	}
	
	setPosition(dx, dy = null, dz = null) {
		if(dy === null || dz === null) {
			dy = dz = dx;
		}
		this.transformationBase.position[0] = dx;
		this.transformationBase.position[1] = dy;
		this.transformationBase.position[2] = dz;
		return this;
	}
	
	move(dx, dy = null, dz = null) {
		if(dy === null || dz === null) {
			dy = dz = dx;
		}
		this.transformationBase.position[0] += this.isWithinBounds(0, dx, 'position') ? dx : 0;
		this.transformationBase.position[1] += this.isWithinBounds(1, dy, 'position') ? dy : 0;
		this.transformationBase.position[2] += this.isWithinBounds(2, dz, 'position') ? dz : 0;
		return this;
	}
	
	rotate(dx, dy = null, dz = null) {
		if(dy === null || dz === null) {
			dy = dz = dx;
		}
		this.transformationBase.rotation[0] += this.isWithinBounds(0, dx, 'rotation') ? dx : 0;
		this.transformationBase.rotation[1] += this.isWithinBounds(1, dy, 'rotation') ? dy : 0;
		this.transformationBase.rotation[2] += this.isWithinBounds(2, dz, 'rotation') ? dz : 0;
		return this;
	}
	
	setRotation(dx, dy = null, dz = null) {
		if(dy === null || dz === null) {
			dy = dz = dx;
		}
		this.transformationBase.rotation[0] = dx;
		this.transformationBase.rotation[1] = dy;
		this.transformationBase.rotation[2] = dz;
		return this;
	}
	
	scale(dx, dy = null, dz = null) {
		if(dy === null || dz === null) {
			dy = dz = dx;
		}
		this.transformationBase.scale[0] += dx;
		this.transformationBase.scale[1] += dy;
		this.transformationBase.scale[2] += dz;
		return this;
	}
	
	setScale(dx, dy = null, dz = null) {
		if(dy === null || dz === null) {
			dy = dz = dx;
		}
		this.transformationBase.scale[0] = dx;
		this.transformationBase.scale[1] = dy;
		this.transformationBase.scale[2] = dz;
		return this;
	}
	
	setMinPosition(x, y, z) {
		this.transformationBase.mins.position = [x, y, z];
		return this;
	}
	
	setMaxPosition(x, y, z) {
		this.transformationBase.maxes.position = [x, y, z];
		return this;
	}
	
	setMinRotation(x, y, z) {
		this.transformationBase.mins.rotation = [x, y, z];
		return this;
	}
	
	setMaxRotation(x, y, z) {
		this.transformationBase.maxes.rotation = [x, y, z];
		return this;
	}
	
	/**
		Create a semi-shallow clone of this node.
		For all attributes that can easily be cloned, they will be cloned.
		However, the new node will still be linked to the old nodes parent and child.
		Accept a prototype to use for creating the new object to allow subclasses to have their function prototypes cloned.
	*/
	shallowClone(proto=SceneNode.prototype) {
		const copy = Object.create(proto);
		copy.localMatrix = glMatrix.mat4.clone(this.localMatrix);
		copy.worldMatrix = glMatrix.mat4.clone(this.worldMatrix);
		copy.transformationBase = this.transformationBase.clone();
		copy.drawInfo = null;
		if(this.drawInfo !== null) {
			copy.drawInfo = this.drawInfo.clone();
		}
		copy.name = this.name;
		copy.parent = this.parent;
		copy.children = [].concat(this.children);
		copy.texture = this.texture;
		return copy;
	}
	
	/**
		Perform a deep clone of this node.
		Since we are non-recursively deep cloning a bidirectional scene graph, we need 2 stacks so our traverse function is not suitable.
		The second stack keeps track of the cloned graph so we can relink each node to new parent/children in the same order as the original.
	*/
	clone() {
		const cloneRoot = this.shallowClone();
		const stack = [this];
		const cloneStack = [cloneRoot];
		while(stack.length > 0) {
			const node = stack.pop();
			const copy = cloneStack.pop();
			for(let i = 0; i < node.children.length; i++) {
				copy.children[i] = node.children[i].shallowClone();
				copy.children[i].parent = copy;
				stack.push(node.children[i]);
				cloneStack.push(copy.children[i]);
			}
		}
		return cloneRoot;
	}
	
	setTexture(texture) {
		this.texture = texture;
		return this;
	}
}

class SceneNodeLight extends SceneNode {
	constructor(type = 'point', name = '') {
		super(null, name);
		this.lightColor = [1, 1, 1];
		this.savedLightColor = [0, 0, 0];
		this.lightSpot = [.95, .98];
		this.lightType = type;
	}
	
	toggle() {
		const temp = [].concat(this.lightColor);
		this.lightColor = [].concat(this.savedLightColor);
		this.savedLightColor = temp;
	}
	
	setColor(r, g, b) {
		this.lightColor = [r, g, b];
		return this;
	}
	
	setSavedLightColor(r, g, b) {
		this.savedLightColor = [r, g, b];
		return this;
	}
	
	setSpot(innerLimit, outerLimit) {
		//Dot space is created from cos of a radian angle
		this.lightSpot[0] = Math.cos(innerLimit * Math.PI / 180);
		this.lightSpot[1] = Math.cos(outerLimit * Math.PI / 180);
		return this;
	}
	
	/**
		Overwrite the shallowClone function with the additional attributes this class has
		Call the superclass version with this classes' prototype to ensure we get functions
	*/
	shallowClone() {
		const copy = super.shallowClone(SceneNodeLight.prototype);
		copy.lightColor = [].concat(this.lightColor);
		copy.savedLightColor = [].concat(this.savedLightColor);
		copy.lightSpot = [].concat(this.lightSpot);
		copy.lightType = this.lightType;
		return copy;
	}
	
}

class TransformationBase {
	constructor() {
		this.position = [0,0,0];
		this.rotation = [0,0,0];
		this.scale = [1,1,1];
		//Bounds
		this.maxes = new TransformationBound();
		this.mins = new TransformationBound();
	}
	
	clone() {
		const copy = new TransformationBase();
		copy.position[0] = this.position[0];
		copy.position[1] = this.position[1];
		copy.position[2] = this.position[2];
		copy.rotation[0] = this.rotation[0];
		copy.rotation[1] = this.rotation[1];
		copy.rotation[2] = this.rotation[2];
		copy.scale[0] = this.scale[0];
		copy.scale[1] = this.scale[1];
		copy.scale[2] = this.scale[2];
		copy.maxes = this.maxes.clone();
		copy.mins = this.mins.clone();
		return copy;
	}
}

class TransformationBound {
	constructor() {
		this.position = [null, null, null];
		this.rotation = [null, null, null];
	}
	
	clone() {
		const copy = new TransformationBound();
		copy.position[0] = this.position[0];
		copy.position[1] = this.position[1];
		copy.position[2] = this.position[2];
		copy.rotation[0] = this.rotation[0];
		copy.rotation[1] = this.rotation[1];
		copy.rotation[2] = this.rotation[2];
		return copy;
	}
}

class DrawInfo {
	constructor() {
		this.size = 0;
		this.offset = 0;
	}
	
	clone() {
		const copy = new DrawInfo();
		copy.size = this.size;
		copy.offset = this.offset;
		return copy;
	}
}