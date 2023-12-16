// Global variables
let gl;
let myIndexBuffer;
let myVAO;
let grid = [];
let myVertexBuffer;
let uvBuffer;
let shaderProgram;
let positionBuffer;
let projectionMatrix;
let viewMatrix;
let vertices = [];
let uProjectionMatrixLocation;
let fov = 60; // Field of view in degrees
let cameraPosition = [0, .3, 1.6];
let lookAtPoint = [0, 1, -1];
let upVector = [0, 1, 0];
let rand = Math.random();

let cameraAngleX = 0;
let cameraAngleY = 0;
let cameraSpeed = 0.1;
let rotationSpeed = 0.005;

// Other globals with default values;
var division1 = 3;
var division2 = 1;
var updateDisplay = true;
var anglesReset = [30.0, 30.0, 0.0];
var angles = [30.0, 30.0, 0.0];
var angleInc = 5.0;

let rows = 100;
let columns = 100;

let renderType;

let starPositionBuffer;

let isDebug = true;

const vertexShaderSource = `
attribute vec4 aVertexPosition;
attribute vec2 aVertexTextureCoords; // New attribute for UVs
varying vec2 vTextureCoords; // To pass UVs to the fragment shader

uniform mat4 uProjectionMatrix;

void main() {
    gl_PointSize = 2.0;
    gl_Position = uProjectionMatrix * aVertexPosition;
    vTextureCoords = aVertexTextureCoords; // Pass UVs to the fragment shader
}
`;

const fragmentShaderSource = `
precision mediump float; // Add this for WebGL1 compatibility

varying vec2 vTextureCoords; // Receive UVs
uniform sampler2D uTexture; // Texture sampler
uniform bool uUseTexture; // Flag to enable/disable texture

void main() {
    if (uUseTexture) {
        gl_FragColor = texture2D(uTexture, vTextureCoords);
        // gl_FragColor = vec4(vTextureCoords, 1.0, 1.0);
    } else {
        gl_FragColor = vec4(1.0); // White color for stars
    }
}
`;

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function loadTexture(gl, url) {
    return new Promise((resolve, reject) => {
        const texture = gl.createTexture();
        const image = new Image();
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            // Set texture wrapping mode
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // S axis (U in UV)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // T axis (V in UV)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // or gl.NEAREST, gl.LINEAR_MIPMAP_LINEAR maybe ?
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); // or gl.NEAREST ?
            gl.bindTexture(gl.TEXTURE_2D, null);
            resolve(texture);
            console.log("Texture loaded: " + url);
            console.log("Texture size: " + image.width + " x " + image.height);
            console.log("Texture loaded");
        };
        image.onerror = () => {
            reject(new Error(`Failed to load image at ${url}`));
        };
        image.src = url;
    });
}

function createGrid(rows, columns) {
    let vertices = []; // Array to store the vertices for WebGL
    let uvs = []; // Array for UVs
    let indices = []; // Array for indices
    grid = []; // Clear the grid array

    // Create vertices and UVs
    for (let z = 0; z <= rows; z++) {
        for (let x = 0; x <= columns; x++) {
            let nx = (x / columns); // Normalize X to range [0, 1]
            let nz = (z / rows); // Normalize Z to range [0, 1]
            let height = layeredNoise(nx * 2 - 1, nz * 2 - 1); // Scale to [-1, 1] for noise

            let vertex = [nx * 2 - 1, height, nz * 2 - 1]; // Position vertex within [-1, 1] range in X and Z
            vertices.push(...vertex); // Add it to the vertices array

            // Calculate and push UV coordinates
            let u = x / columns;
            let v = z / rows;
            uvs.push(u, v);

            // Log the first and last UV coordinates
            if ((z === 0 && x === 0) || (z === rows && x === columns)) {
                console.log("UV at (" + x + ", " + z + "): " + u + ", " + v);
            }
        }
    }

    // Connect vertices to form triangles (using indices)
    for (let z = 0; z < rows; z++) {
        for (let x = 0; x < columns; x++) {
            let bottomLeft = z * (columns + 1) + x;
            let topLeft = (z + 1) * (columns + 1) + x;
            let bottomRight = z * (columns + 1) + x + 1;
            let topRight = (z + 1) * (columns + 1) + x + 1;

            // Triangle 1
            indices.push(bottomLeft, topLeft, bottomRight);

            // Triangle 2
            indices.push(topLeft, topRight, bottomRight);
        }
    }

    // Return the vertices, uvs, and indices
    return { vertices, uvs, indices };
}

function createLandscape(rows, columns) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const size = 1; // Size of each grid cell

    // Generate positions, UVs, and indices
    for (let z = 0; z <= rows; z++) {
        for (let x = 0; x <= columns; x++) {
            // Position
            const xPos = (x - columns * 0.5) * size;
            const zPos = (z - rows * 0.5) * size;
            const yPos = layeredNoise(xPos, zPos); // Apply height using noise
            positions.push(xPos, yPos, zPos);

            // UVs
            const u = x / columns;
            const v = z / rows;
            uvs.push(u, v);

            // Indices (two triangles per grid cell)
            if (x < columns && z < rows) {
                const a = x + z * (columns + 1);
                const b = x + (z + 1) * (columns + 1);
                const c = (x + 1) + (z + 1) * (columns + 1);
                const d = (x + 1) + z * (columns + 1);

                // Triangle 1
                indices.push(a, b, d);
                // Triangle 2
                indices.push(b, c, d);
            }
        }
    }

    // Create buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        positionBuffer,
        uvBuffer,
        indexBuffer,
        count: indices.length
    };
}



function regenerateGrid() {
    let vertices = createGrid(rows, columns);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
}

// general call to make and bind a new object based on current
// settings..Basically a call to shape specfic calls in cgIshape.js
function createNewShape() {

    // clear your points and elements
    points = [];
    indices = [];

    // make your shape based on type
    let shapeData = createGrid(rows, columns);
    points = shapeData.vertices;
    uvs = shapeData.uvs;
    console.log(shapeData.uvs);

    //create and bind VAO
    if (myVAO == null) myVAO = gl.createVertexArray();
    gl.bindVertexArray(myVAO);

    uvBuffer = gl.createBuffer(); // Ensure uvBuffer is created
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);

    // create and bind vertex buffer
    if (myVertexBuffer == null) myVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, myVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(shaderProgram.aVertexPosition);
    gl.vertexAttribPointer(shaderProgram.aVertexPosition, 4, gl.FLOAT, false, 0, 0);

    // gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW); // Buffer the UV data
    gl.vertexAttribPointer(shaderProgram.aVertexTextureCoords, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderProgram.aVertexTextureCoords);

    // uniform values
    gl.uniform3fv(shaderProgram.uTheta, new Float32Array(angles));

    // Setting up the IBO
    if (myIndexBuffer == null) myIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, myIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // After setting up the buffer data, read it back for debugging
    if (gl instanceof WebGL2RenderingContext) {
        // Only available in WebGL2
        let readBackData = new Float32Array(uvs.length);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readBackData);
        console.log('Buffer data:', readBackData);
    }


    // Clean
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}


function createStarField(numStars) {
    let stars = [];
    for (let i = 0; i < numStars; i++) {
        // Random positions far away
        let x = (Math.random() - 0.5) * 100;
        let y = (Math.random() - 0.5) * 100;
        let z = (Math.random() - 0.5) * 100;
        stars.push(x, y, z);
    }
    return stars;
}




async function init() {
    const canvas = document.getElementById('glCanvas');
    gl = canvas.getContext('webgl2');

    if (!gl) {
        alert('Unable to initialize WebGL. Your browser may not support it.');
        return;
    }

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return;
    }

    // Initialize shader attribute and uniform locations
    shaderProgram.vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    shaderProgram.aVertexTextureCoords = gl.getAttribLocation(shaderProgram, 'aVertexTextureCoords');
    shaderProgram.uUseTexture = gl.getUniformLocation(shaderProgram, "uUseTexture");
    uProjectionMatrixLocation = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');

    try {
        texture = await loadTexture(gl, 'moontext.jpeg');
    } catch (error) {
        alert('Texture loading failed: ' + error.message);
        return;
    }

    // Create the landscape and star field
    landscape = createLandscape(rows, columns);
    // In your init function
    starPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, starPositionBuffer);
    starVertices = createStarField(1000); // Adjust the number of stars as needed
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starVertices), gl.STATIC_DRAW);

    // Setup the camera and projection matrix
    projectionMatrix = mat4.create();
    viewMatrix = mat4.create();
    setupCamera();

    // Set event listeners for user interaction
    setupEventListeners();

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);

    // Start the rendering loop
    render();
}


function render() {
    if (!gl) {
        console.error('WebGL context is not available.');
        return;
    }

    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the shader program
    gl.useProgram(shaderProgram);

    // Set the projection matrix uniform
    gl.uniformMatrix4fv(uProjectionMatrixLocation, false, projectionMatrix);

    // Render the landscape
    renderLandscape();

    // Render the star field
    renderStarField();

    // Request the next frame
    requestAnimationFrame(render);
}

function renderLandscape() {
    // Check if the buffer is bound to the attribute
    if (!landscape.positionBuffer || !landscape.uvBuffer || !landscape.indexBuffer) {
        console.error('Landscape buffers are not initialized properly.');
        return;
    }

    // Bind the buffers and attributes for the landscape
    gl.bindBuffer(gl.ARRAY_BUFFER, landscape.positionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderProgram.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, landscape.uvBuffer);
    gl.vertexAttribPointer(shaderProgram.aVertexTextureCoords, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderProgram.aVertexTextureCoords);

    // Bind the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shaderProgram.uUseTexture, true);

    // Bind the index buffer and draw the landscape
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, landscape.indexBuffer);
    gl.drawElements(gl.TRIANGLES, landscape.count, gl.UNSIGNED_SHORT, 0);
}

function renderStarField() {
    // Check if the buffer is bound to the attribute
    if (!starPositionBuffer) {
        console.error('Star position buffer is not initialized properly.');
        return;
    }

    // Render the stars
    gl.uniform1i(shaderProgram.uUseTexture, false); // Don't use the texture for the stars
    gl.bindBuffer(gl.ARRAY_BUFFER, starPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderProgram.vertexPosition);

    // Draw the stars as points
    gl.drawArrays(gl.POINTS, 0, 1000); // Assume 1000 stars
}


// Call the init function when the window loads
window.onload = init;

