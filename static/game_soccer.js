
// Configuration defaults (will be overridden by window.SOCCER_CONFIG)
const CONFIG = Object.assign({
    type: 'football', // football | futsal
    pitchColor: '#4CAF50',
    lineColor: '#FFF',
    ballColor: '#FFF',
    playersPerTeam: 11,
    matchDuration: 300, // seconds
    physics: {
        friction: 0.98, // 1.0 = no friction
        ballBounce: 0.7,
        playerSpeed: 3.0,
        sprintSpeed: 5.0,
        kickForce: 8.0
    }
}, window.SOCCER_CONFIG || {});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = {
    running: false,
    paused: false,
    timer: CONFIG.matchDuration,
    score: { blue: 0, red: 0 },
    ball: null,
    players: [], // All players
    activePlayerId: null // ID of player controlled by user (always Blue team for now)
};

// Controls
const keys = {
    up: false, down: false, left: false, right: false,
    sprint: false, shoot: false
};

window.addEventListener('keydown', e => updateKeys(e.key, true));
window.addEventListener('keyup', e => updateKeys(e.key, false));
window.addEventListener('mousedown', () => keys.shoot = true);
window.addEventListener('mouseup', () => keys.shoot = false);

function updateKeys(key, pressed) {
    switch (key.toLowerCase()) {
        case 'w': case 'arrowup': keys.up = pressed; break;
        case 's': case 'arrowdown': keys.down = pressed; break;
        case 'a': case 'arrowleft': keys.left = pressed; break;
        case 'd': case 'arrowright': keys.right = pressed; break;
        case 'shift': keys.sprint = pressed; break;
        case ' ': keys.shoot = pressed; break;
    }
}

// Classes
class Vector {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vector(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector(this.x - v.x, this.y - v.y); }
    mult(s) { return new Vector(this.x * s, this.y * s); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    norm() { const m = this.mag(); return m === 0 ? new Vector(0, 0) : new Vector(this.x / m, this.y / m); }
    limit(max) { if (this.mag() > max) return this.norm().mult(max); return this; }
}

class Ball {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.radius = 6;
        this.drag = CONFIG.physics.friction;
    }

    update() {
        this.pos = this.pos.add(this.vel);
        this.vel = this.vel.mult(this.drag);

        // Boundaries (Bounce)
        if (this.pos.x < 0 || this.pos.x > canvas.width) {
            this.vel.x *= -CONFIG.physics.ballBounce;
            this.pos.x = Math.max(0, Math.min(canvas.width, this.pos.x));
            checkGoal(this.pos.x < canvas.width / 2 ? 'left' : 'right');
        }
        if (this.pos.y < 0 || this.pos.y > canvas.height) {
            this.vel.y *= -CONFIG.physics.ballBounce;
            this.pos.y = Math.max(0, Math.min(canvas.height, this.pos.y));
        }

        // Stop small movements
        if (this.vel.mag() < 0.1) this.vel = new Vector(0, 0);
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.ballColor;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        ctx.closePath();
    }
}

class Player {
    constructor(id, team, x, y, role = 'mf') {
        this.id = id;
        this.team = team; // 'blue' or 'red'
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.radius = 10;
        // Roles: 'gk', 'def', 'mf', 'fwd'
        this.role = role;
        this.startPos = new Vector(x, y);
    }

    update() {
        let speed = CONFIG.physics.playerSpeed;

        // Input Control (Blue Team Only)
        if (this.id === gameState.activePlayerId) {
            let input = new Vector(0, 0);
            if (keys.up) input.y -= 1;
            if (keys.down) input.y += 1;
            if (keys.left) input.x -= 1;
            if (keys.right) input.x += 1;

            if (keys.sprint) speed = CONFIG.physics.sprintSpeed;

            if (input.mag() > 0) {
                this.vel = input.norm().mult(speed);
            } else {
                this.vel = this.vel.mult(0.8); // Stop fast
            }

            // Shoot/Pass
            if (keys.shoot) this.kick();
        } else {
            // AI Behavior
            this.updateAI();
        }

        this.pos = this.pos.add(this.vel);

        // Clamp to pitch
        this.pos.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.pos.x));
        this.pos.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.pos.y));

        // Ball Interaction (Dribble)
        const d = gameState.ball.pos.sub(this.pos);
        if (d.mag() < this.radius + gameState.ball.radius + 2) {
            // Gentle push (dribble)
            const push = d.norm().mult(2);
            gameState.ball.vel = gameState.ball.vel.add(push).limit(4);
        }
    }

    updateAI() {
        const ball = gameState.ball;
        const distToBall = ball.pos.sub(this.pos).mag();

        // Simple AI Logic
        let target = this.startPos; // Default return to formation

        // 1. Formation shifting based on ball X
        let formationX = this.startPos.x + (ball.pos.x - canvas.width / 2) * 0.5;
        target = new Vector(formationX, this.startPos.y);

        // 2. Chase Ball if close (Zone Defense)
        // Red team chases more aggressively if ball is on their side or close
        let chaseDist = 150;
        if (this.team === 'red' || (this.team === 'blue' && this.id !== gameState.activePlayerId)) {
            if (distToBall < chaseDist) {
                target = ball.pos;
            }
        }

        // Move towards target
        let steer = target.sub(this.pos);
        if (steer.mag() > 0) {
            this.vel = steer.norm().mult(CONFIG.physics.playerSpeed * 0.8); // AI slower than human
        }

        // AI Kick
        if (distToBall < 15 && this.team === 'red') {
            // Shoot towards goal (Left is Blue Goal, Right is Red Goal)
            // Red shoots Left (0, height/2)
            let goal = new Vector(0, canvas.height / 2);
            let shotDir = goal.sub(this.pos).norm();
            ball.vel = shotDir.mult(CONFIG.physics.kickForce);
        }
    }

    kick() {
        const ball = gameState.ball;
        const dist = ball.pos.sub(this.pos).mag();
        if (dist < 20) {
            // Kick direction: current velocity or towards goal if still
            let dir = this.vel.mag() > 0 ? this.vel.norm() : new Vector(1, 0); // Default right
            if (this.team === 'red') dir = new Vector(-1, 0); // Red kicks left

            ball.vel = dir.mult(CONFIG.physics.kickForce * 1.5);
            keys.shoot = false; // Reset key
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.team === 'blue' ? '#3498db' : '#e74c3c';

        // Active Player Highlight
        if (this.id === gameState.activePlayerId) {
            ctx.strokeStyle = '#f1c40f'; // Yellow ring
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
        }

        ctx.fill();
        ctx.stroke();
        ctx.closePath();

        // Number/Role text
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.role.toUpperCase(), this.pos.x, this.pos.y + 3);
    }
}

// Game Logic
function initGame() {
    gameState.score = { blue: 0, red: 0 };
    gameState.timer = CONFIG.matchDuration;
    createTeams();
    resetPositions();
    gameState.running = true;
    gameLoop();

    // Timer
    setInterval(() => {
        if (gameState.running && !gameState.paused && gameState.timer > 0) {
            gameState.timer--;
            updateHUD();
        }
    }, 1000);
}

function createTeams() {
    gameState.players = [];
    const pCount = CONFIG.playersPerTeam;

    // Formations (Simple static positions relative to pitch size)
    // 11v11: 1 GK, 4 DEF, 4 MID, 2 FWD
    // 5v5: 1 GK, 2 DEF, 2 FWD

    // Blue Team (Left Side) - Plays to Right
    // Red Team (Right Side) - Plays to Left behavior

    // Helper to add symmetrical players
    const addPlayer = (team, role, rx, ry) => {
        const x = team === 'blue' ? rx * canvas.width : (1 - rx) * canvas.width;
        const y = ry * canvas.height;
        const id = gameState.players.length;
        gameState.players.push(new Player(id, team, x, y, role));
    };

    if (pCount === 5) { // Futsal Formation
        // Blue
        addPlayer('blue', 'gk', 0.05, 0.5);
        addPlayer('blue', 'def', 0.2, 0.3);
        addPlayer('blue', 'def', 0.2, 0.7);
        addPlayer('blue', 'fwd', 0.4, 0.4);
        addPlayer('blue', 'fwd', 0.4, 0.6);

        // Red
        addPlayer('red', 'gk', 0.05, 0.5); // Logic handles mirroring x
        addPlayer('red', 'def', 0.2, 0.3);
        addPlayer('red', 'def', 0.2, 0.7);
        addPlayer('red', 'fwd', 0.4, 0.4);
        addPlayer('red', 'fwd', 0.4, 0.6);
    } else { // 11v11 Default
        // Blue GK
        addPlayer('blue', 'gk', 0.05, 0.5);
        // Blue Def
        addPlayer('blue', 'def', 0.2, 0.2);
        addPlayer('blue', 'def', 0.2, 0.4);
        addPlayer('blue', 'def', 0.2, 0.6);
        addPlayer('blue', 'def', 0.2, 0.8);
        // Blue Mid
        addPlayer('blue', 'mid', 0.4, 0.2);
        addPlayer('blue', 'mid', 0.4, 0.4);
        addPlayer('blue', 'mid', 0.4, 0.6);
        addPlayer('blue', 'mid', 0.4, 0.8);
        // Blue Fwd
        addPlayer('blue', 'fwd', 0.6, 0.4);
        addPlayer('blue', 'fwd', 0.6, 0.6);

        // Red (Mirror)
        addPlayer('red', 'gk', 0.05, 0.5);
        addPlayer('red', 'def', 0.2, 0.2);
        addPlayer('red', 'def', 0.2, 0.4);
        addPlayer('red', 'def', 0.2, 0.6);
        addPlayer('red', 'def', 0.2, 0.8);
        addPlayer('red', 'mid', 0.4, 0.2);
        addPlayer('red', 'mid', 0.4, 0.4);
        addPlayer('red', 'mid', 0.4, 0.6);
        addPlayer('red', 'mid', 0.4, 0.8);
        addPlayer('red', 'fwd', 0.6, 0.4);
        addPlayer('red', 'fwd', 0.6, 0.6);
    }

    // Set initial active player (First FWD or MID)
    gameState.activePlayerId = 4; // Usually a forward in 5v5 or mid in 11v11
}

function resetPositions() {
    gameState.ball = new Ball(canvas.width / 2, canvas.height / 2);
    // Reset players to startPos
    gameState.players.forEach(p => {
        p.pos = new Vector(p.startPos.x, p.startPos.y);
        p.vel = new Vector(0, 0);
    });
}

function checkGoal(side) {
    // Goal logic strictly by X bounds for now
    // Only count if within Y range (Goal posts)
    const goalTop = canvas.height * 0.4;
    const goalBottom = canvas.height * 0.6;

    if (gameState.ball.pos.y > goalTop && gameState.ball.pos.y < goalBottom) {
        if (side === 'left') {
            gameState.score.red++;
            showToast("GOAL RED!");
        } else {
            gameState.score.blue++;
            showToast("GOAL BLUE!");
        }
        updateHUD();
        setTimeout(resetPositions, 2000);
    }
}

function autoSwitchPlayer() {
    // Determine closest blue player to ball
    let minD = Infinity;
    let closestId = -1;

    gameState.players.forEach(p => {
        if (p.team === 'blue') {
            const d = p.pos.sub(gameState.ball.pos).mag();
            if (d < minD) {
                minD = d;
                closestId = p.id;
            }
        }
    });

    // Only switch if current active is far away or ball is loose
    // Simple logic: always switch to closest
    if (closestId !== -1) gameState.activePlayerId = closestId;
}

function drawPitch() {
    ctx.fillStyle = CONFIG.pitchColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = CONFIG.lineColor;
    ctx.lineWidth = 2;

    // Center Line & Circle
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Goals
    const goalH = canvas.height * 0.2; // 20% of height
    const topY = (canvas.height - goalH) / 2;

    // Left Goal
    ctx.strokeRect(0, canvas.height * 0.4, 20, canvas.height * 0.2);
    // Right Goal
    ctx.strokeRect(canvas.width - 20, canvas.height * 0.4, 20, canvas.height * 0.2);
}

function showToast(msg) {
    // Simply log or draw text temporarily
    // Could overlay on canvas
    ctx.font = '40px Arial';
    ctx.fillStyle = 'yellow';
    ctx.fillText(msg, canvas.width / 2 - 100, canvas.height / 2);
}

function updateHUD() {
    // Update HTML elements if they exist
    const elBlue = document.getElementById('scoreBlue');
    const elRed = document.getElementById('scoreRed');
    const elTime = document.getElementById('gameTimer');

    if (elBlue) elBlue.innerText = gameState.score.blue;
    if (elRed) elRed.innerText = gameState.score.red;
    if (elTime) {
        const m = Math.floor(gameState.timer / 60);
        const s = gameState.timer % 60;
        elTime.innerText = `${m}:${s < 10 ? '0' + s : s}`;
    }
}

function gameLoop() {
    if (!gameState.running) return;

    // Logic
    autoSwitchPlayer();
    gameState.players.forEach(p => p.update());
    gameState.ball.update();

    // Drawing
    drawPitch();
    gameState.players.forEach(p => p.draw());
    gameState.ball.draw();

    requestAnimationFrame(gameLoop);
}

// Start
initGame();
