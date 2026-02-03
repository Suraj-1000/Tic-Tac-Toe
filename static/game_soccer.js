
// Configuration defaults
const CONFIG = Object.assign({
    type: 'football',
    pitchColor: '#4CAF50',
    lineColor: '#FFF',
    ballColor: '#FFF',
    playersPerTeam: 11,
    matchDuration: 300,
    physics: {
        friction: 0.96, // Ground friction
        airDrag: 0.99,  // Air resistance
        gravity: 0.4,   // Gravity for Z axis
        ballBounce: 0.6,
        playerSpeed: 2.5,
        sprintSpeed: 4.5,
        kickPowerMax: 20
    }
}, window.SOCCER_CONFIG || {});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Vector Library ---
class Vector {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vector(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector(this.x - v.x, this.y - v.y); }
    mult(s) { return new Vector(this.x * s, this.y * s); }
    div(s) { return new Vector(this.x / s, this.y / s); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    norm() { const m = this.mag(); return m === 0 ? new Vector(0, 0) : this.div(m); }
    limit(max) { if (this.mag() > max) return this.norm().mult(max); return this; }
    dist(v) { return this.sub(v).mag(); }
    copy() { return new Vector(this.x, this.y); }
}

// --- Game State ---
let gameState = {
    running: false,
    timer: CONFIG.matchDuration,
    score: { blue: 0, red: 0 },
    ball: null,
    players: [],
    activePlayerId: 0,
    actionPower: 0,
    chargingAction: null // 'shoot', 'pass', 'cross'
};

const keys = {
    up: false, down: false, left: false, right: false,
    sprint: false,
    shoot: false, // J
    pass: false,  // K
    cross: false  // L
};

// --- Input Handling ---
window.addEventListener('keydown', e => updateKeys(e.key, true));
window.addEventListener('keyup', e => updateKeys(e.key, false));
// Mouse click mapped to Shoot for convenience
window.addEventListener('mousedown', () => keys.shoot = true);
window.addEventListener('mouseup', () => keys.shoot = false);

function updateKeys(key, pressed) {
    if (!gameState.running) return;
    switch (key.toLowerCase()) {
        case 'w': case 'arrowup': keys.up = pressed; break;
        case 's': case 'arrowdown': keys.down = pressed; break;
        case 'a': case 'arrowleft': keys.left = pressed; break;
        case 'd': case 'arrowright': keys.right = pressed; break;
        case 'shift': keys.sprint = pressed; break;

        // Action Keys
        case 'j': keys.shoot = pressed; handleAction('shoot', pressed); break;
        case 'k': keys.pass = pressed; handleAction('pass', pressed); break;
        case 'l': keys.cross = pressed; handleAction('cross', pressed); break;
        case ' ': // Space is also Shoot
            keys.shoot = pressed; handleAction('shoot', pressed); break;
    }
}

function handleAction(type, pressed) {
    if (pressed) {
        if (!gameState.chargingAction) {
            gameState.chargingAction = type;
            gameState.actionPower = 0;
        }
    } else {
        if (gameState.chargingAction === type) {
            // Release
            const p = getPlayer(gameState.activePlayerId);
            if (p) p.performAction(type, gameState.actionPower);

            gameState.chargingAction = null;
            gameState.actionPower = 0;
        }
    }
}

function getPlayer(id) {
    return gameState.players.find(p => p.id === id);
}

// --- Entities ---

class Ball {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0); // Ground velocity (xy)
        this.z = 0;    // Height
        this.vz = 0;   // Vertical velocity
        this.radius = 6;
    }

    update() {
        // Physics
        this.pos = this.pos.add(this.vel);

        // Z-Axis Physics
        this.z += this.vz;
        this.vz -= CONFIG.physics.gravity;

        // Ground Bounce
        if (this.z < 0) {
            this.z = 0;
            if (Math.abs(this.vz) > 1) {
                this.vz *= -CONFIG.physics.ballBounce;
            } else {
                this.vz = 0;
            }
            // Friction applies more on ground
            this.vel = this.vel.mult(CONFIG.physics.friction);
        } else {
            // Air Drag
            this.vel = this.vel.mult(CONFIG.physics.airDrag);
        }

        // Boundaries
        if (this.pos.x < 0 || this.pos.x > canvas.width) {
            this.vel.x *= -0.8;
            this.pos.x = Math.max(0, Math.min(canvas.width, this.pos.x));
            checkGoal(this.pos.x < canvas.width / 2 ? 'left' : 'right');
        }
        if (this.pos.y < 0 || this.pos.y > canvas.height) {
            this.vel.y *= -0.8;
            this.pos.y = Math.max(0, Math.min(canvas.height, this.pos.y));
        }

        // Stop
        if (this.vel.mag() < 0.1 && this.z <= 0) this.vel = new Vector(0, 0);
    }

    draw() {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        let shadowSize = this.radius + (this.z / 10);
        ctx.beginPath();
        ctx.ellipse(this.pos.x, this.pos.y, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ball Body (Offset by Z)
        ctx.fillStyle = CONFIG.ballColor;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y - this.z, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.stroke();
    }
}

class Player {
    constructor(id, team, x, y, role) {
        this.id = id;
        this.team = team;
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.startPos = new Vector(x, y); // Home position
        this.role = role;
        this.radius = 10;
        this.facing = new Vector(team === 'blue' ? 1 : -1, 0);
    }

    update() {
        // --- AI & Control Logic ---
        let force = new Vector(0, 0);

        if (this.id === gameState.activePlayerId) {
            // User Control
            let input = new Vector(0, 0);
            if (keys.up) input.y -= 1;
            if (keys.down) input.y += 1;
            if (keys.left) input.x -= 1;
            if (keys.right) input.x += 1;

            let speed = keys.sprint ? CONFIG.physics.sprintSpeed : CONFIG.physics.playerSpeed;
            if (input.mag() > 0) {
                this.vel = input.norm().mult(speed);
                this.facing = input.norm();
            } else {
                this.vel = this.vel.mult(0.8);
            }

            this.handleBallInteraction();

        } else {
            // AI Steering
            force = this.calculateSteering();
            this.vel = this.vel.add(force);
            this.vel.limit(this.team === 'blue' ? CONFIG.physics.playerSpeed * 0.95 : CONFIG.physics.playerSpeed * 0.9); // Blue slightly smarter

            this.handleBallInteraction();

            // AI Shoot?
            const ball = gameState.ball;
            if (this.team === 'red' && this.pos.dist(ball.pos) < 15) {
                this.performAction('shoot', 10); // Standard shot
            }
        }

        // Apply Velocity
        this.pos = this.pos.add(this.vel);

        // Boundaries
        this.pos.x = Math.max(5, Math.min(canvas.width - 5, this.pos.x));
        this.pos.y = Math.max(5, Math.min(canvas.height - 5, this.pos.y));

        // Update Facing
        if (this.vel.mag() > 0.1) this.facing = this.vel.norm();
    }

    calculateSteering() {
        const ball = gameState.ball;
        let steering = new Vector(0, 0);

        let distToBall = this.pos.dist(ball.pos);
        let isClosest = this.isClosestToBall();

        // AI Logic:
        // 1. If Closest -> Seek Ball
        // 2. If Not Closest -> Maintain Formation + Support

        if (isClosest || (this.team === 'red' && distToBall < 300)) { // Red aggressively chases
            steering = steering.add(this.seek(ball.pos).mult(this.team === 'red' ? 1.2 : 1.5));
        } else {
            // Formation State
            // Dynamic Formation: Shift X based on ball X (Team moves with ball)
            let formationShift = (ball.pos.x - canvas.width / 2) * 0.6;
            let target = new Vector(this.startPos.x + formationShift, this.startPos.y);

            steering = steering.add(this.arrive(target).mult(0.8));
        }

        // Separation (Always active)
        steering = steering.add(this.separate().mult(2.5));

        return steering;
    }

    seek(target) {
        let desired = target.sub(this.pos).norm().mult(CONFIG.physics.playerSpeed);
        return desired.sub(this.vel).limit(0.2);
    }

    arrive(target) {
        let desired = target.sub(this.pos);
        let d = desired.mag();
        if (d < 50) {
            let m = (d / 50) * CONFIG.physics.playerSpeed;
            desired = desired.norm().mult(m);
        } else {
            desired = desired.norm().mult(CONFIG.physics.playerSpeed);
        }
        return desired.sub(this.vel).limit(0.2);
    }

    separate() {
        let sum = new Vector(0, 0);
        let count = 0;
        gameState.players.forEach(other => {
            if (other === this) return;
            let d = this.pos.dist(other.pos);
            if (d < 30 && d > 0) { // Separation radius
                let diff = this.pos.sub(other.pos).norm().div(d);
                sum = sum.add(diff);
                count++;
            }
        });
        if (count > 0) {
            sum = sum.div(count).norm().mult(CONFIG.physics.playerSpeed);
            return sum.sub(this.vel).limit(0.3);
        }
        return new Vector(0, 0);
    }

    isClosestToBall() {
        let minDist = Infinity;
        let closest = null;
        gameState.players.forEach(p => {
            if (p.team === this.team) {
                let d = p.pos.dist(gameState.ball.pos);
                if (d < minDist) { minDist = d; closest = p; }
            }
        });
        return closest === this;
    }

    handleBallInteraction() {
        const ball = gameState.ball;
        let dist = this.pos.dist(ball.pos);
        let collisionDist = this.radius + ball.radius;

        if (dist < collisionDist && ball.z < 15) {
            // Dribble / Push
            let pushDir = ball.pos.sub(this.pos).norm();

            if (this.id === gameState.activePlayerId && this.vel.mag() > 0) {
                // Magnet dribble
                ball.vel = this.vel.mult(1.1);
                let catchPos = this.pos.add(this.vel.norm().mult(collisionDist));
                ball.pos = ball.pos.add(catchPos.sub(ball.pos).mult(0.2));
            } else {
                ball.vel = ball.vel.add(this.vel.mult(0.8));
                let overlap = collisionDist - dist;
                ball.pos = ball.pos.add(pushDir.mult(overlap));
            }
        }
    }

    performAction(type, powerTicks) {
        const ball = gameState.ball;
        if (this.pos.dist(ball.pos) > 30) return; // Must be close

        // Power calculation (0-60 ticks ~ 1sec)
        // Max power defined in config
        let powerRatio = Math.min(powerTicks, 40) / 40.0; // Cap at 40 ticks
        let maxP = CONFIG.physics.kickPowerMax;

        let dir = this.facing.copy();
        // Auto-aim towards goal if shooting? (Simplified for now: facing)

        let speed = 0;
        let vz = 0;

        if (type === 'shoot') {
            // Shoot Goal: High Speed, Medium Arc if powered
            // Needs min power to lift
            speed = 5 + (powerRatio * 15);
            vz = powerRatio * 8; // Lift

        } else if (type === 'pass') {
            // Low Pass: Ground only, precise velocity
            // Pass always goes low
            speed = 8 + (powerRatio * 5);
            vz = 0;

        } else if (type === 'cross') {
            // Cross: High Arc, Medium Speed
            speed = 8 + (powerRatio * 4);
            vz = 6 + (powerRatio * 8); // High lob
        }

        ball.vel = dir.mult(speed);
        ball.vz = vz;
    }

    draw() {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(this.pos.x, this.pos.y, this.radius, this.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        // Ensure distinct colors
        ctx.fillStyle = this.team === 'blue' ? '#3498db' : '#e74c3c';

        // Highlight active
        if (this.id === gameState.activePlayerId) {
            ctx.shadowColor = '#f1c40f'; // Yellow Glow
            ctx.shadowBlur = 15;
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Shoulders
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(Math.atan2(this.facing.y, this.facing.x));
        ctx.fillStyle = 'white';
        ctx.fillRect(0, -5, 8, 10);
        ctx.restore();

        // Charge Bar
        if (gameState.chargingAction && this.id === gameState.activePlayerId) {
            let color = 'white';
            if (gameState.chargingAction === 'shoot') color = 'red';
            if (gameState.chargingAction === 'pass') color = 'yellow';
            if (gameState.chargingAction === 'cross') color = 'cyan';

            ctx.fillStyle = 'black';
            ctx.fillRect(this.pos.x - 12, this.pos.y - 22, 24, 6);
            ctx.fillStyle = color;
            let pct = Math.min(gameState.actionPower, 40) / 40;
            ctx.fillRect(this.pos.x - 11, this.pos.y - 21, 22 * pct, 4);
        }
    }
}

// --- Init & Loop ---

function initGame() {
    gameState.ball = new Ball(canvas.width / 2, canvas.height / 2);
    createTeams();
    gameState.timer = CONFIG.matchDuration;
    gameState.running = true;
    requestAnimationFrame(gameLoop);

    // Timer
    setInterval(() => {
        if (gameState.running && gameState.timer > 0) {
            gameState.timer--;
            updateHUD();
        }
    }, 1000);
}

function createTeams() {
    gameState.players = [];
    const positions = CONFIG.playersPerTeam === 5 ? getFutsalPos() : get11v11Pos();

    // Create Players based on positions
    // Debug log
    console.log("Creating Blue Team. Count:", positions.blue.length);
    positions.blue.forEach((p, i) => {
        gameState.players.push(new Player(i, 'blue', p.x * canvas.width, p.y * canvas.height, p.role));
    });

    console.log("Creating Red Team. Count:", positions.red.length);
    let offset = positions.blue.length;
    positions.red.forEach((p, i) => {
        gameState.players.push(new Player(offset + i, 'red', (1 - p.x) * canvas.width, p.y * canvas.height, p.role));
    });

    gameState.activePlayerId = 4;
}

function getFutsalPos() {
    return {
        blue: [
            { role: 'gk', x: 0.05, y: 0.5 },
            { role: 'def', x: 0.2, y: 0.3 },
            { role: 'def', x: 0.2, y: 0.7 },
            { role: 'fwd', x: 0.4, y: 0.5 },
            { role: 'fwd', x: 0.45, y: 0.4 }
        ],
        red: [
            { role: 'gk', x: 0.05, y: 0.5 },
            { role: 'def', x: 0.2, y: 0.3 },
            { role: 'def', x: 0.2, y: 0.7 },
            { role: 'fwd', x: 0.4, y: 0.5 },
            { role: 'fwd', x: 0.45, y: 0.4 }
        ]
    };
}

function get11v11Pos() {
    return {
        blue: [
            { role: 'gk', x: 0.04, y: 0.5 },
            { role: 'def', x: 0.15, y: 0.2 }, { role: 'def', x: 0.15, y: 0.4 }, { role: 'def', x: 0.15, y: 0.6 }, { role: 'def', x: 0.15, y: 0.8 },
            { role: 'mid', x: 0.35, y: 0.2 }, { role: 'mid', x: 0.35, y: 0.4 }, { role: 'mid', x: 0.35, y: 0.6 }, { role: 'mid', x: 0.35, y: 0.8 },
            { role: 'fwd', x: 0.55, y: 0.4 }, { role: 'fwd', x: 0.55, y: 0.6 }
        ],
        red: [
            { role: 'gk', x: 0.04, y: 0.5 },
            { role: 'def', x: 0.15, y: 0.2 }, { role: 'def', x: 0.15, y: 0.4 }, { role: 'def', x: 0.15, y: 0.6 }, { role: 'def', x: 0.15, y: 0.8 },
            { role: 'mid', x: 0.35, y: 0.2 }, { role: 'mid', x: 0.35, y: 0.4 }, { role: 'mid', x: 0.35, y: 0.6 }, { role: 'mid', x: 0.35, y: 0.8 },
            { role: 'fwd', x: 0.55, y: 0.4 }, { role: 'fwd', x: 0.55, y: 0.6 }
        ]
    };
}

function checkGoal(side) {
    const goalTop = canvas.height * 0.4;
    const goalBottom = canvas.height * 0.6;
    if (gameState.ball.pos.y > goalTop && gameState.ball.pos.y < goalBottom) {
        if (side === 'left') gameState.score.red++;
        else gameState.score.blue++;

        updateHUD();
        gameState.ball.pos = new Vector(canvas.width / 2, canvas.height / 2);
        gameState.ball.vel = new Vector(0, 0);
        gameState.ball.z = 200;
        gameState.ball.vz = 0;
    }
}

function autoSwitchPlayer() {
    if (!gameState.running) return;
    let minD = Infinity;
    let closestId = -1;
    gameState.players.forEach(p => {
        if (p.team === 'blue') {
            let d = p.pos.dist(gameState.ball.pos);
            if (d < minD) { minD = d; closestId = p.id; }
        }
    });
    if (closestId !== -1) {
        let currentP = getPlayer(gameState.activePlayerId);
        if (currentP) {
            let curD = currentP.pos.dist(gameState.ball.pos);
            if (minD < curD - 40) gameState.activePlayerId = closestId;
        } else {
            gameState.activePlayerId = closestId;
        }
    }
}

function updateHUD() {
    const elBlue = document.getElementById('scoreBlue');
    const elRed = document.getElementById('scoreRed');
    const elTime = document.getElementById('gameTimer');
    if (elBlue) elBlue.innerText = gameState.score.blue;
    if (elRed) elRed.innerText = gameState.score.red;
    if (elTime) {
        let m = Math.floor(gameState.timer / 60);
        let s = gameState.timer % 60;
        elTime.innerText = `${m}:${s < 10 ? '0' + s : s}`;
    }
}

function drawPitch() {
    let stripeWidth = 50;
    for (let x = 0; x < canvas.width; x += stripeWidth) {
        ctx.fillStyle = (x / stripeWidth) % 2 === 0 ? CONFIG.pitchColor : shadeColor(CONFIG.pitchColor, -10);
        ctx.fillRect(x, 0, stripeWidth, canvas.height);
    }

    ctx.strokeStyle = CONFIG.lineColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2); ctx.stroke();

    const goalH = canvas.height * 0.2;
    const goalY = (canvas.height - goalH) / 2;
    ctx.strokeRect(0, goalY, 40, goalH);
    ctx.strokeRect(canvas.width - 40, goalY, 40, goalH);
}

function shadeColor(color, percent) {
    return color === '#4CAF50' ? '#45a049' : '#2ecc71';
}

// Debug Overlay
function drawDebug() {
    ctx.fillStyle = 'yellow';
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`C: ${gameState.players.length} | T: ${gameState.timer} | Mode: ${CONFIG.type}`, 10, 20);

    // Check if players exist but off screen?
    if (gameState.players.length > 0) {
        let p0 = gameState.players[0];
        ctx.fillText(`P0: ${Math.round(p0.pos.x)},${Math.round(p0.pos.y)}`, 10, 40);
    }
}

function gameLoop() {
    if (!gameState.running) return;

    if (gameState.chargingAction) gameState.actionPower++;

    autoSwitchPlayer();

    gameState.players.forEach(p => p.update());
    gameState.ball.update();

    drawPitch();

    // Sort by Y for depth
    let renderList = [...gameState.players];
    renderList.push(gameState.ball);
    renderList.sort((a, b) => a.pos.y - b.pos.y);

    renderList.forEach(obj => obj.draw());

    drawDebug(); // Add Debug info

    requestAnimationFrame(gameLoop);
}

// Ensure load
window.onload = function () {
    console.log("Window Load - Init Game");
    initGame();
};
// Fallback if already loaded
if (document.readyState === 'complete') {
    initGame();
}
