
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.5;
const FRICTION = 0.8;
const PLAYER_SPEED = 5;
const JUMP_FORCE = 12;
const BALL_BOUNCE = 0.7; // Energy retained on bounce

// Game State
let gameRunning = false;
let score = { p1: 0, p2: 0 };

// Controls State
const keys = {
    w: false, a: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowRight: false
};

// Listeners
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

class Entity {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        // Apply Gravity
        this.vy += GRAVITY;

        // Apply Velocity
        this.x += this.vx;
        this.y += this.vy;

        // Ground Collision
        if (this.y + this.height > canvas.height - 50) { // -50 for ground offset
            this.y = canvas.height - 50 - this.height;
            this.vy = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // Wall Collision
        if (this.x < 0) {
            this.x = 0;
            this.vx = 0;
        }
        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
            this.vx = 0;
        }

        // Friction
        if (this.onGround) {
            this.vx *= FRICTION;
        }
    }
}

class Player extends Entity {
    constructor(x, y, color, controls) {
        super(x, y, 40, 60, color);
        this.controls = controls; // { up, left, right }
        this.score = 0;
    }

    update() {
        if (keys[this.controls.left]) {
            this.vx = -PLAYER_SPEED;
        }
        if (keys[this.controls.right]) {
            this.vx = PLAYER_SPEED;
        }
        if (keys[this.controls.up] && this.onGround) {
            this.vy = -JUMP_FORCE;
        }

        super.update();
    }

    // Override draw for a bit more detail (eyes?)
    draw() {
        super.draw();
        // Eye direction based on facing? Simplified for now.
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x + 10, this.y + 10, 5, 5);
        ctx.fillRect(this.x + 25, this.y + 10, 5, 5);
    }
}

class Ball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.vx = 0;
        this.vy = 0;
        this.color = 'white';
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.stroke();
        ctx.closePath();
    }

    update() {
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        // Ground Bounce
        if (this.y + this.radius > canvas.height - 50) {
            this.y = canvas.height - 50 - this.radius;
            this.vy = -this.vy * BALL_BOUNCE;
            // Stop if slow
            if (Math.abs(this.vy) < 1) this.vy = 0;
        }

        // Ceiling Bounce
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy = -this.vy * BALL_BOUNCE;
        }

        // Wall Bounce
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx = -this.vx * BALL_BOUNCE;
            checkGoal('left');
        }
        if (this.x + this.radius > canvas.width) {
            this.x = canvas.width - this.radius;
            this.vx = -this.vx * BALL_BOUNCE;
            checkGoal('right');
        }

        // Friction
        if (this.y + this.radius >= canvas.height - 50 - 1) { // Touching ground
            this.vx *= 0.98;
        }
    }
}

// Game Objects
let player1, player2, ball;

function initGame() {
    // Reset objects
    player1 = new Player(100, 300, '#4facfe', { up: 'w', left: 'a', right: 'd' }); // Blue
    player2 = new Player(700, 300, '#ff4444', { up: 'ArrowUp', left: 'ArrowLeft', right: 'ArrowRight' }); // Red
    ball = new Ball(400, 200);
}

function checkGoal(side) {
    // Simple goal check: if ball hits wall > goal height range?
    // For now, let's say "Wall Hit" is just bounce unless we define a goal area.
    // Let's define Goal Areas: Y > canvas.height - 180 (Ground is -50, Goal Height 130)

    // Actually, typically goals are "behind" the wall line, but let's just make it hitting the wall below a certain Y is a goal.
    // Let's say goal height is from Ground up to 120px.
    const goalTop = canvas.height - 50 - 120;

    if (ball.y > goalTop) {
        if (side === 'left') {
            // Player 2 Scored (Right Player)
            score.p2++;
            resetRound();
        } else {
            // Player 1 Scored (Left Player)
            score.p1++;
            resetRound();
        }
        updateScoreBoard();
    }
}

function resetRound() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 3;
    ball.vx = 0;
    ball.vy = 0;

    player1.x = 100;
    player1.y = 300;
    player1.vx = 0;
    player1.vy = 0;

    player2.x = canvas.width - 100 - player2.width;
    player2.y = 300;
    player2.vx = 0;
    player2.vy = 0;
}

function updateScoreBoard() {
    document.getElementById('scoreP1').innerText = score.p1;
    document.getElementById('scoreP2').innerText = score.p2;
}

function checkCollisions() {
    // Player - Ball Collision (AABB vs Circle approximation or proper Circle-Rect)
    // Simplified: Treat Player as Circle for bounce, or AABB. AABB is easier for "pushing", Circle for "bouncing".
    // Let's do simple AABB check then resolution.

    [player1, player2].forEach(p => {
        // Nearest point on rect to circle center
        let testX = ball.x;
        let testY = ball.y;

        if (ball.x < p.x) testX = p.x;
        else if (ball.x > p.x + p.width) testX = p.x + p.width;

        if (ball.y < p.y) testY = p.y;
        else if (ball.y > p.y + p.height) testY = p.y + p.height;

        let distX = ball.x - testX;
        let distY = ball.y - testY;
        let distance = Math.sqrt((distX * distX) + (distY * distY));

        if (distance <= ball.radius) {
            // Collision!
            // Calculate normal
            let nx = distX / distance;
            let ny = distY / distance;

            // If distance is 0 (inside), push up
            if (distance === 0) { nx = 0; ny = -1; }

            // Push ball out
            let overlap = ball.radius - distance;
            ball.x += nx * overlap;
            ball.y += ny * overlap;

            // Velocity transfer (Elastic)
            // Relative velocity
            let dvx = ball.vx - p.vx;
            let dvy = ball.vy - p.vy;

            // Impulse
            let impulse = 2 * (dvx * nx + dvy * ny) / (1 + 1); // Mass 1 vs 1 assumed
            // Actually let's just cheat and add force
            ball.vx += 5 * nx + p.vx * 0.5;
            ball.vy += 5 * ny + p.vy * 0.5;

            // Cap speed
            // ball.vx = Math.min(Math.max(ball.vx, -15), 15);
            // ball.vy = Math.min(Math.max(ball.vy, -15), 15);
        }
    });

    // Player - Player Collision? Maybe pass through for now to keep it simple/chaotic fun
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background/Grass
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    // Draw Goals
    ctx.fillStyle = 'white';
    // Left Goal
    ctx.fillRect(0, canvas.height - 50 - 120, 10, 120);
    ctx.fillRect(0, canvas.height - 50 - 120, 40, 5);
    // Right Goal
    ctx.fillRect(canvas.width - 10, canvas.height - 50 - 120, 10, 120);
    ctx.fillRect(canvas.width - 40, canvas.height - 50 - 120, 40, 5);

    player1.update();
    player1.draw();

    player2.update();
    player2.draw();

    ball.update();
    ball.draw();

    checkCollisions();

    requestAnimationFrame(gameLoop);
}

// Start
initGame();
updateScoreBoard();
gameLoop();

