let particles = [];
const num_particles = 80; // Number of particles

// Inspired by Austin's "Arrays" and "Bouncing balls"
// In Austin's example, parallel arrays are used to keep track of
// the circles' positions and speeds individually. We reused this concept
// with posX, posY, velX, velY, and we also added accX and accY
// to apply a force to the particles (the force comes from the micro:bit)

// Empty arrays ready for data
let posX = [];
let posY = [];
let velX = [];
let velY = [];
let accX = [];
let accY = [];
const maxSpeed = 6; // Maximum allowed speed in normal mode
const particleSize = 20;

// Variables for Micro:bit data
let microbitX = 0;
let microbitY = 0;
let microbitBtn = 0;
let isConnected = false; // Keeps track of whether the serial port is connected

// AI-generated base (Gemini Hydrogen): We had an issue where a single button press could register multiple times.
// We couldn't solve it ourselves, so we let Gemini fix it.
// Button presses are only registered when the button is released, so flickering values count as a single press.
let peakBtn = 0;          // Highest button value during an active press
let lastHeldTime = 0;     // Timestamp when a button was last held down
const releaseTime = 200;  // ms the button must be released to count as released

// List of available color palettes (both RGB and accent colors)
const palettes = [
  { name: "Cyber Cyan", primary: [0, 255, 200], accent: [255, 0, 150] },
  { name: "Acid Green", primary: [55, 255, 20], accent: [255, 255, 0] },
  { name: "Ultraviolence", primary: [180, 0, 255], accent: [0, 230, 255] },
  { name: "Solar Flare", primary: [100, 0, 100], accent: [255, 230, 0] }
];

// Index for the active color palette
let currentPaletteIndex = 0;

// State management for show and glitch mode
let isShowActive = false;
let isGlitchMode = false;

function setup() {
  const canvas = createCanvas(800, 800);
  // Places the p5.js canvas inside the HTML element with the ID "canvas-holder" in index.html
  canvas.parent('canvas-holder');

  // Just like in Austin's "Bouncing ball", we use a for-loop to
  // fill our arrays with starting values
  for (let i = 0; i < num_particles; i++) {
    posX.push(random(width));
    posY.push(random(height));
    velX.push(random(-1, 1));
    velY.push(random(-1, 1));
    accX.push(0);
    accY.push(0);
  }

  // Tries to connect to the micro:bit automatically
  autoConnectMicrobit();
}

function draw() {
  // Added for Radio: if the show hasn't started, only show the standby screen (HUD)
  if (!isShowActive) {
    background(0);
    drawHUD();
    return;
  }

  handleButtonEvents(); // Check if any button has been pressed/released since the last frame
  let activePalette = palettes[currentPaletteIndex]; // Get the settings for the currently active color palette

  // Sets the background depending on whether glitch mode is active
  if (isGlitchMode) {
    background(random(40), 0, random(80), 80); // Strobing/random background effect
  } else {
    background(0, 0, 0, 35); // Standard black background with a motion-blur trail created by setting alpha to 35
  }

  // Convert the Micro:bit's tilt (-1024 to 1024) into a simple force (1024 is the max value the micro:bit can send)
  // No fix for holding the micro:bit the wrong way; once mounted properly, the direction is right
  let forceX = map(microbitX, -1024, 1024, 0.2, -0.2);
  let forceY = map(microbitY, -1024, 1024, -0.2, 0.2);

  // When glitch mode is active, the force is multiplied for more chaotic movement
  if (isGlitchMode) {
    forceX *= 4.0;
    forceY *= 4.0;
  }

  // In Austin's "Loops" and "Bouncing ball", for-loops are used in draw()
  // to draw and update multiple objects at the same time.
  // We reused this idea to update all 80 particles
  for (let i = 0; i < num_particles; i++) {

    // Takes the acceleration force from the micro:bit and adds it to the particles
    accX[i] += forceX;
    accY[i] += forceY;

    // In "Bouncing ball", position is updated with x[i] += speedX[i]
    // We changed this to get acceleration -> velocity -> position
    velX[i] += accX[i];
    velY[i] += accY[i];

    // Adds random jitter to the particles if glitch mode is active
    if (isGlitchMode) {
      velX[i] += random(-1.5, 1.5);
      velY[i] += random(-1.5, 1.5);
    } else {
      let currentSpeed = mag(velX[i], velY[i]);

      // Scales down the velocity vector if the speed exceeds maxSpeed
      if (currentSpeed > maxSpeed) {
        velX[i] = (velX[i] / currentSpeed) * maxSpeed;
        velY[i] = (velY[i] / currentSpeed) * maxSpeed;
      }
    }

    // Updates position based on the calculated velocity
    posX[i] += velX[i];
    posY[i] += velY[i];

    // Resets acceleration to 0 for the next frame so it doesn't build up infinitely
    accX[i] = 0;
    accY[i] = 0;

    // In "Conditionals" and "Bouncing ball", Austin showed if-statements that make balls
    // bounce when they hit the edge (speed *= -1). We adapted this if-statement logic into a "warp" effect:
    // if a ball leaves one side, it moves to the opposite side.
    if (posX[i] > width) posX[i] = 0;
    if (posX[i] < 0) posX[i] = width;
    if (posY[i] > height) posY[i] = 0;
    if (posY[i] < 0) posY[i] = height;

    // Removes the outline stroke on the particles
    noStroke();

    // Randomly chooses between primary and accent color in glitch mode; otherwise uses primary color
    if (isGlitchMode && random() > 0.5) {
      fill(activePalette.accent[0], activePalette.accent[1], activePalette.accent[2]);
    } else {
      fill(activePalette.primary[0], activePalette.primary[1], activePalette.primary[2]);
    }

    // Varies the size in glitch mode for visual dynamics during "drops" and draws the particle on the canvas
    let currentSize = isGlitchMode ? particleSize * random(0.5, 2.2) : particleSize;
    ellipse(posX[i], posY[i], currentSize);
  }

  // Draws a small joystick in the bottom-left corner
  drawJoystick(100, height - 100, 50);
  // Draws the HUD interface (text and control status)
  drawHUD();
}

function drawHUD() {
  push(); // Saves current style and canvas settings
  let activePalette = palettes[currentPaletteIndex];
  let p = activePalette.primary;

  textFont('sans-serif');
  fill(p[0], p[1], p[2], 220); // One color for all text

  // Connection status in the top-left corner
  textAlign(LEFT, TOP);
  textSize(14);
  if (isConnected) {
    text("TRANSMITTER CONNECTED (USB)", 30, 30);
  } else {
    text("NOT CONNECTED — CLICK CANVAS TO PAIR TRANSMITTER", 30, 30);
  }

  // Indicator for the current palette
  textAlign(RIGHT, BOTTOM);
  textSize(12);
  text("PALETTE: " + activePalette.name.toUpperCase(), width - 30, height - 10);

  // Standby text in the center
  if (!isShowActive) {
    textAlign(CENTER, CENTER);
    textSize(20);
    text("PRESS A ON TRANSMITTER TO START", width / 2, height / 2);
  }

  pop(); // Restores previous style settings
}

// Resets all particle positions to the center of the canvas with new velocities
function resetParticles() {
  for (let i = 0; i < num_particles; i++) {
    posX[i] = width / 2;
    posY[i] = height / 2;
    velX[i] = random(-3, 3);
    velY[i] = random(-3, 3);
  }
}

function handleButtonEvents() {
  if (microbitBtn !== 0) {
    // Button pressed: save the highest value and the timestamp
    peakBtn = max(peakBtn, microbitBtn);
    lastHeldTime = millis();
  } else if (peakBtn !== 0 && millis() - lastHeldTime > releaseTime) {
    // Button has been released long enough: trigger one (1) action
    if (peakBtn === 1) resetParticles(); // Button A
    if (peakBtn === 2) {                 // Button B
      currentPaletteIndex = (currentPaletteIndex + 1) % palettes.length;
      updatePanelColors();
    }
    peakBtn = 0; // Reset for the next press
  }

  // A+B held down: glitch mode
  isGlitchMode = (microbitBtn === 3);
  document.body.classList.toggle('glitch', isGlitchMode);
}

// Visual joystick showing the micro:bit's tilt direction
function drawJoystick(cx, cy, maxRadius) {
  push();
  // Moves the coordinate system's origin (0,0) to the center of the joystick (cx, cy)
  translate(cx, cy);

  // Draws the outer circle boundary for the joystick
  let p = palettes[currentPaletteIndex].primary;
  stroke(p[0], p[1], p[2], 200);
  strokeWeight(2);
  noFill();
  ellipse(0, 0, maxRadius * 2);

  // Scales the tilt values (-1024 to 1024) to pixel offset inside the joystick
  // No fix for holding the micro:bit the wrong way; once mounted properly, the direction is right
  let offsetX = map(microbitX, -1024, 1024, maxRadius, -maxRadius);
  let offsetY = map(microbitY, -1024, 1024, -maxRadius, maxRadius);

  // Creates a vector and limits the stick's movement inside the outer circle
  let stick = createVector(offsetX, offsetY);
  stick.limit(maxRadius);

  // Draws the line from the center out to the joystick knob
  stroke(255, 0, 0, 180);
  strokeWeight(3);
  line(0, 0, stick.x, stick.y);

  // Draws the joystick knob itself
  noStroke();
  fill(255, 0, 0);
  ellipse(stick.x, stick.y, 20);

  pop();
}

// AI-generated base (Gemini Hydrogen) based on our idea: the text panels and
// canvas border follow the active color palette.
// Our change: Originally the canvas border-shadow didn't follow the palette, which we added ourselves.
// Function sets the CSS variable --c on all elements so the glow color updates
function updatePanelColors() {
  const p = palettes[currentPaletteIndex].primary.join(',');
  document.querySelectorAll('.panel, .canvas-container').forEach(el => {
    el.style.setProperty('--c', p);
  });
}

// We built the basic serial connection ourselves and then let AI
// (Gemini Hydrogen) clean it up and fix issues that came up

// If the user clicks the canvas when the Micro:bit is not connected, open the connection dialog
function mousePressed() {
  if (!isConnected && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    connectMicrobit();
  }
}

// AI wrote the automatic connection
// Tries to automatically connect to a Micro:bit if permission was already granted earlier
async function autoConnectMicrobit() {
  // Check if the browser supports Web Serial API (works in Chrome/Edge)
  if ("serial" in navigator) {
    // Get a list of USB ports the user has already approved on previous visits
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      try {
        const port = ports[0];
        // Open the connection at 115200 baud (must match the Micro:bit's MakeCode serial speed)
        await port.open({ baudRate: 115200 });
        isConnected = true;
        readLoop(port); // Start listening for incoming data in the background
      } catch (err) {
        console.log("Requires manual click to connect", err);
      }
    }
  }
}

// Opens the browser's port picker to select and connect to the Micro:bit via USB/Serial
async function connectMicrobit() {
  try {
    // Pause here until the user selects the Micro:bit in the browser popup
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    isConnected = true;
    readLoop(port);
  } catch (err) {
    console.log("Connection cancelled or failed:", err);
  }
}

// Async loop that continuously reads incoming serial data without freezing the p5.js draw() loop
async function readLoop(port) {
  const reader = port.readable.getReader(); // Lock the incoming data stream so we can read from it
  const decoder = new TextDecoder();        // Converts raw binary bytes from USB into readable text
  let buffer = "";                          // Stores incoming text chunks until a full line arrives

  while (true) {
    // Wait for the next chunk of bytes from the Micro:bit
    const { value, done } = await reader.read();
    if (done) {
      isConnected = false; // Stop the loop if the USB cable is unplugged
      break;
    }

    // Decode the bytes to text and add them to our buffer
    buffer += decoder.decode(value);

    // USB data can arrive half a line at a time, so we split at every newline (\n)
    let lines = buffer.split("\n");
    // Keep any unfinished last piece in the buffer for the next chunk
    buffer = lines.pop();

    // Loop through all complete lines we received
    for (let line of lines) {
      let msg = trim(line); // Remove extra spaces or line-break characters (\r)
      if (msg === "START") { isShowActive = true; continue; } // Triggered by Transmitter Button A
      if (msg === "STOP") { isShowActive = false; continue; } // Triggered by Transmitter Button B

      // Split the data string at commas (expected format from Micro:bit: "X,Y,Button")
      let parts = split(msg, ',');
      if (parts.length === 3) {
        // Convert the text strings into numbers and update our global variables
        microbitX = Number(parts[0]);
        microbitY = Number(parts[1]);
        microbitBtn = Number(parts[2]);
      }
    }
  }
}