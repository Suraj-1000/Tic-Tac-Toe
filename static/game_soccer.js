
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
        kickPowerMax: 15
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
    shotPower: 0,
    chargingShot: false
};

const keys = {
    up: false, down: false, left: false, right: false,
    sprint: false, shoot: false
};

// --- Input Handling ---
window.addEventListener('keydown', e => updateKeys(e.key, true));
window.addEventListener('keyup', e => updateKeys(e.key, false));
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
        case ' ':
        case 'enter':
            // Shot Charge Logic
            if (pressed) {
                if (!gameState.chargingShot) {
                    gameState.chargingShot = true;
                    gameState.shotPower = 0;
                }
            } else {
                if (gameState.chargingShot) {
                    // Release Shot
                    gameState.chargingShot = false;
                    getPlayer(gameState.activePlayerId).shoot(gameState.shotPower);
                    gameState.shotPower = 0;
                }
            }
            break;
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

        // Detail (Spin illusion)
        ctx.beginPath();
        ctx.arc(this.pos.x - 2, this.pos.y - this.z - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();
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

            // Dribble
            this.handleBallInteraction();

        } else {
            // AI Steering
            force = this.calculateSteering();
            this.vel = this.vel.add(force);
            this.vel.limit(CONFIG.physics.playerSpeed * 0.9); // AI slightly slower

            // AI Dribble/Shoot
            this.handleBallInteraction();

            // AI Shoot?
            const ball = gameState.ball;
            if (this.team === 'red' && this.pos.dist(ball.pos) < 15) {
                // Determine shot direction (Goal is Right for Blue, Left for Red)
                // Red Goal Target: (0, canvas.height/2)
                if (this.pos.x < canvas.width * 0.7) { // Only shoot if somewhat central/advanced
                    // Pass or Shoot?
                    // Simple: Shoot to goal
                    this.shoot(10); // Medium power
                }
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

        // Behaviors:
        // 1. Seek Ball (Primary if closest)
        // 2. Return Home (Formation)
        // 3. Separation (Avoid crowding)

        let distToBall = this.pos.dist(ball.pos);
        let isClosest = this.isClosestToBall();

        if (isClosest || (this.team === 'red' && distToBall < 200)) {
            // Chase State
            steering = steering.add(this.seek(ball.pos).mult(1.5));
        } else {
            // Formation State
            // Dynamic Formation: Shift X based on ball X
            let formationShift = (ball.pos.x - canvas.width / 2) * 0.6;
            let target = new Vector(this.startPos.x + formationShift, this.startPos.y);

            steering = steering.add(this.arrive(target).mult(0.8));
        }

        // Separation (All times)
        steering = steering.add(this.separate().mult(2.0));

        return steering;
    }

    seek(target) {
        let desired = target.sub(this.pos).norm().mult(CONFIG.physics.playerSpeed);
        return desired.sub(this.vel).limit(0.2); // 0.2 is steer force limit
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
            if (d < 25 && d > 0) { // Separation radius
                let diff = this.pos.sub(other.pos).norm().div(d); // Weight by distance
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
        // Optimization: Could cache this in GameLoop, but for 22 players it's fine
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

        if (dist < collisionDist && ball.z < 10) { // Can only touch if ball near ground
            // Dribble / Push
            let pushDir = ball.pos.sub(this.pos).norm();

            // If active and keys pressed, guide ball
            if (this.id === gameState.activePlayerId && this.vel.mag() > 0) {
                // Magnet dribble feel
                // Set ball velocity to match player + slight push
                ball.vel = this.vel.mult(1.1);
                // Keep ball close
                let catchPos = this.pos.add(this.vel.norm().mult(collisionDist));
                ball.pos = ball.pos.add(catchPos.sub(ball.pos).mult(0.2));
            } else {
                // Bumping into ball (Logic for opponents or idle)
                ball.vel = ball.vel.add(this.vel.mult(0.8));
                // Ensure no overlap
                let overlap = collisionDist - dist;
                ball.pos = ball.pos.add(pushDir.mult(overlap));
            }
        }
    }

    shoot(power) {
        const ball = gameState.ball;
        const dist = this.pos.dist(ball.pos);
        if (dist < 30) {
            // Direction: Facing + slight adjust to Goal
            let dir = this.facing.copy();

            // Apply Power
            let p = Math.min(power, CONFIG.physics.kickPowerMax);

            // Ground pass vs Chip vs Power Shot
            // Low power (< 5) = Ground Pass (no Z)
            // High power = Lofted (add Z velocity)

            let speed = p;
            let vz = 0;

            if (p > 5) {
                vz = p * 0.5; // height
                speed = p * 0.8; // slightly slower fwd speed if high arc
            }

            ball.vel = dir.mult(speed);
            ball.vz = vz;
        }
    }

    draw() {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(this.pos.x, this.pos.y, this.radius, this.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = this.team === 'blue' ? '#3498db' : '#e74c3c';

        // Highlight active
        if (this.id === gameState.activePlayerId) {
            ctx.shadowColor = '#f1c40f';
            ctx.shadowBlur = 10;
        }

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Direction Indicator (Shoulders)
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(Math.atan2(this.facing.y, this.facing.x));
        ctx.fillStyle = 'white';
        // Draw Rectangle representing shoulders
        ctx.fillRect(0, -5, 8, 10);
        ctx.restore();

        if (gameState.chargingShot && this.id === gameState.activePlayerId) {
            // Charge Bar
            ctx.fillStyle = 'white';
            ctx.fillRect(this.pos.x - 10, this.pos.y - 20, 20, 4);
            ctx.fillStyle = 'red';
            let pct = Math.min(gameState.shotPower, 20) / 20;
            ctx.fillRect(this.pos.x - 10, this.pos.y - 20, 20 * pct, 4);
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
    positions.blue.forEach((p, i) => {
        gameState.players.push(new Player(i, 'blue', p.x * canvas.width, p.y * canvas.height, p.role));
    });

    let offset = positions.blue.length;
    positions.red.forEach((p, i) => {
        // Red positions are mirrored X
        gameState.players.push(new Player(offset + i, 'red', (1 - p.x) * canvas.width, p.y * canvas.height, p.role));
    });

    // Active player default
    gameState.activePlayerId = 4; // Midfielder/Fwd
}

function getFutsalPos() {
    // 5v5 Positions relative (0.0 - 1.0)
    return {
        blue: [
            { role: 'gk', x: 0.05, y: 0.5 },
            { role: 'def', x: 0.2, y: 0.3 },
            { role: 'def', x: 0.2, y: 0.7 },
            { role: 'fwd', x: 0.4, y: 0.5 },
            { role: 'fwd', x: 0.45, y: 0.4 } // slightly fwd
        ],
        red: [ /* Mirror of above logic handled in loop */
            { role: 'gk', x: 0.05, y: 0.5 },
            { role: 'def', x: 0.2, y: 0.3 },
            { role: 'def', x: 0.2, y: 0.7 },
            { role: 'fwd', x: 0.4, y: 0.5 },
            { role: 'fwd', x: 0.45, y: 0.4 }
        ]
    };
}

function get11v11Pos() {
    // 4-4-2 Formation Blue
    return {
        blue: [
            { role: 'gk', x: 0.05, y: 0.5 },
            { role: 'def', x: 0.2, y: 0.2 }, { role: 'def', x: 0.2, y: 0.4 }, { role: 'def', x: 0.2, y: 0.6 }, { role: 'def', x: 0.2, y: 0.8 },
            { role: 'mid', x: 0.4, y: 0.2 }, { role: 'mid', x: 0.4, y: 0.4 }, { role: 'mid', x: 0.4, y: 0.6 }, { role: 'mid', x: 0.4, y: 0.8 },
            { role: 'fwd', x: 0.6, y: 0.4 }, { role: 'fwd', x: 0.6, y: 0.6 }
        ],
        red: [ /* Logic mirrors this */
            { role: 'gk', x: 0.05, y: 0.5 },
            { role: 'def', x: 0.2, y: 0.2 }, { role: 'def', x: 0.2, y: 0.4 }, { role: 'def', x: 0.2, y: 0.6 }, { role: 'def', x: 0.2, y: 0.8 },
            { role: 'mid', x: 0.4, y: 0.2 }, { role: 'mid', x: 0.4, y: 0.4 }, { role: 'mid', x: 0.4, y: 0.6 }, { role: 'mid', x: 0.4, y: 0.8 },
            { role: 'fwd', x: 0.6, y: 0.4 }, { role: 'fwd', x: 0.6, y: 0.6 }
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
        // Reset Ball
        gameState.ball.pos = new Vector(canvas.width / 2, canvas.height / 2);
        gameState.ball.vel = new Vector(0, 0);
        gameState.ball.z = 200; // Drop from sky
        gameState.ball.vz = 0;
    }
}

function autoSwitchPlayer() {
    if (!gameState.running) return;
    // Find closest BLUE player to ball
    let minD = Infinity;
    let closestId = -1;
    gameState.players.forEach(p => {
        if (p.team === 'blue') {
            let d = p.pos.dist(gameState.ball.pos);
            if (d < minD) { minD = d; closestId = p.id; }
        }
    });
    // Hysteresis: Only switch if current is significantly further (~50px)
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
    // Grass Stripes
    let stripeWidth = 50;
    for (let x = 0; x < canvas.width; x += stripeWidth) {
        ctx.fillStyle = (x / stripeWidth) % 2 === 0 ? CONFIG.pitchColor : shadeColor(CONFIG.pitchColor, -10);
        ctx.fillRect(x, 0, stripeWidth, canvas.height);
    }

    // Lines
    ctx.strokeStyle = CONFIG.lineColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Center
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2); ctx.stroke();

    // Goals
    const goalH = canvas.height * 0.2;
    const goalY = (canvas.height - goalH) / 2;
    ctx.strokeRect(0, goalY, 40, goalH);
    ctx.strokeRect(canvas.width - 40, goalY, 40, goalH);
}

function shadeColor(color, percent) {
    // Simple light/darken hex helper (Rough implementation for green)
    // Assuming standard hex like #4CAF50
    // Actually simple toggle:
    return color === '#4CAF50' ? '#45a049' : '#2ecc71'; // Toggles for known greens
}

function gameLoop() {
    if (!gameState.running) return;

    // Logic
    if (gameState.chargingShot) gameState.shotPower++; // Charge up

    autoSwitchPlayer();

    gameState.players.forEach(p => p.update());
    gameState.ball.update();

    // Render
    drawPitch();

    // Z-Sorting (Draw players/ball based on Y position for depth)
    // Make a render list
    let renderList = [...gameState.players];
    renderList.push(gameState.ball);
    renderList.sort((a, b) => a.pos.y - b.pos.y);

    renderList.forEach(obj => obj.draw());

    requestAnimationFrame(gameLoop);
}

// Start
initGame();
