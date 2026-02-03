
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Config
const GOAL_WIDTH = 300;
const GOAL_HEIGHT = 150;
const GOAL_Z = 600; // Distance to goal

// State
let state = {
    mode: null, // 'pvc' or 'pvp'
    phase: 'idle', // idle, aiming, flight, result
    score: { shooter: 0, keeper: 0 },
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    keeper: { x: 0, width: 60, height: 100, diveX: 0, diving: false },
    resultMsg: ""
};

// Canvas Center
const CX = canvas.width / 2;
const CY = canvas.height / 2;
const GROUND_Y = 400; // Horizon line ish

// Controls
const keys = { left: false, right: false };
window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
});
window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

canvas.addEventListener('mousedown', handleClick);

function handleClick(e) {
    if (state.phase === 'aiming' && state.mode) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        shoot(mx, my);
    }
}

function startGame(mode) {
    state.mode = mode;
    state.score = { shooter: 0, keeper: 0 };
    resetRound();
    document.getElementById('gameStatus').innerText = "Click goal to Shoot!";
    draw();
}
window.startGame = startGame;

function resetRound() {
    state.phase = 'aiming';
    state.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }; // x,y relative to center bottom
    state.keeper.x = 0;
    state.keeper.diveX = 0;
    state.keeper.diving = false;
    state.resultMsg = "";

    requestAnimationFrame(gameLoop);
}

function shoot(targetX, targetY) {
    state.phase = 'flight';

    // Calculate Velocity based on click relative to ground center
    // Origin is CX, GROUND_Y
    // Goal is at Z=GOAL_Z

    // Simple projection logic
    // We want ball to reach targetX, targetY at Z=GOAL_Z
    // Flight time approx 60 frames (1 sec)
    const frames = 40;

    const dx = targetX - CX;
    const dy = targetY - GROUND_Y; // usually negative (up)

    // Physics relative to world (x is lateral, y is up, z is forward)
    // Canvas Y is inverted for World Y

    state.ball.vz = GOAL_Z / frames; // Forward speed constant
    state.ball.vx = dx / frames;
    state.ball.vy = (targetY - (GROUND_Y - 20)) / frames; // Rough vertical aim

    // Keeper Decision
    if (state.mode === 'pvc') {
        // CPU Guess
        const r = Math.random();
        // 70% chance to dive generally correct side, 30% random
        let diveDir = 0;
        if (state.ball.vx < -2) diveDir = -1;
        else if (state.ball.vx > 2) diveDir = 1;

        if (Math.random() < 0.3) diveDir = (Math.random() < 0.5 ? -1 : 1); // Mistake

        state.keeper.diveX = diveDir * (GOAL_WIDTH / 2 - 20);
        state.keeper.diving = true;
    }
}

function update() {
    if (state.phase === 'flight') {
        // PvP Keeper Control
        if (state.mode === 'pvp' && !state.keeper.diving) {
            if (keys.left) { state.keeper.diveX = -100; state.keeper.diving = true; }
            if (keys.right) { state.keeper.diveX = 100; state.keeper.diving = true; }
        }

        // Move Keeper
        if (state.keeper.diving) {
            state.keeper.x += (state.keeper.diveX - state.keeper.x) * 0.1;
        }

        // Move Ball
        state.ball.x += state.ball.vx;
        state.ball.y += state.ball.vy;
        state.ball.z += state.ball.vz;

        // Gravity on Y? Perspective is tricky.
        // Let's just simulate linear perspective flight for aim simplicity

        // Check Goal
        if (state.ball.z >= GOAL_Z) {
            checkResult();
        }
    }
}

function checkResult() {
    state.phase = 'result';

    // Hitbox check
    // Keeper Width covers?
    const bx = state.ball.x; // relative to center
    const kx = state.keeper.x;

    let caught = false;

    // Check boundaries (Goal size)
    // Goal is -GOAL_WIDTH/2 to +GOAL_WIDTH/2
    // Height 0 to -GOAL_HEIGHT
    // Ball Y is relative to GROUND_Y
    const ballCanvasY = GROUND_Y + state.ball.y; // Ball.y is offset
    const goalTop = GROUND_Y - GOAL_HEIGHT;

    const inGoalX = Math.abs(bx) < GOAL_WIDTH / 2;
    const inGoalY = ballCanvasY < GROUND_Y && ballCanvasY > goalTop;

    if (inGoalX && inGoalY) {
        // Check Keeper Interaction
        const kLeft = kx - state.keeper.width / 2;
        const kRight = kx + state.keeper.width / 2;

        // Simple 1D collision for diving
        if (bx > kLeft && bx < kRight) {
            caught = true;
        } else {
            // Keeper Dive extension?
            // Let's give keeper wider reach if diving
            if (state.keeper.diving) {
                if (bx > kLeft - 30 && bx < kRight + 30) caught = true;
            }
        }

        if (caught) {
            state.resultMsg = "SAVED!";
            state.score.keeper++;
        } else {
            state.resultMsg = "GOAL!";
            state.score.shooter++;
        }
    } else {
        state.resultMsg = "MISS!";
    }

    updateHUD();
    setTimeout(resetRound, 2000);
}

function updateHUD() {
    document.getElementById('scoreShooter').innerText = state.score.shooter;
    document.getElementById('scoreKeeper').innerText = state.score.keeper;
    document.getElementById('gameStatus').innerText = state.resultMsg;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sky / Grass
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, GROUND_Y);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

    // Penalty Spot
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(CX, GROUND_Y + 150, 5, 0, Math.PI * 2); ctx.fill();

    // Goal (Perspective)
    // Drawn at scaling based on Z? 
    // Here we simplified Z logic, so we draw Goal static "far away"
    const goalX = CX - GOAL_WIDTH / 2;
    const goalY = GROUND_Y - GOAL_HEIGHT;

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 10;
    ctx.strokeRect(goalX, goalY, GOAL_WIDTH, GOAL_HEIGHT);

    // Net logic (simple grid)
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
        let x = goalX + (i * GOAL_WIDTH / 10);
        ctx.moveTo(x, goalY); ctx.lineTo(x, GROUND_Y);
    }
    for (let i = 0; i <= 5; i++) {
        let y = goalY + (i * GOAL_HEIGHT / 5);
        ctx.moveTo(goalX, y); ctx.lineTo(goalX + GOAL_WIDTH, y);
    }
    ctx.stroke();

    // Keeper
    // Simple Rect
    const kx = CX + state.keeper.x;
    const ky = GROUND_Y - state.keeper.height;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(kx - state.keeper.width / 2, ky, state.keeper.width, state.keeper.height);

    // Hands?
    ctx.fillStyle = 'yellow';
    ctx.fillRect(kx - 35, ky + 20, 15, 15);
    ctx.fillRect(kx + 20, ky + 20, 15, 15);

    // Ball
    // Calculate Projective Scale
    let scale = 1;
    let bx = CX;
    let by = GROUND_Y + 150; // Start pos

    if (state.phase !== 'aiming') {
        const p = 1 - (state.ball.z / 800); // Fake perspective scale
        scale = Math.max(0.2, p);

        bx = CX + state.ball.x * scale; // Apply X offset
        by = (GROUND_Y + 150) + (state.ball.y - state.ball.z * 0.5) * scale; // Move "up/in"
        // Wait, my projection math is loose here. 
        // Better:
        // Start Y + ball.y (vertical offset) - ball.z (distance offset into screen visual)

        let visualY = (GROUND_Y + 140) - (state.ball.z * 0.25) + state.ball.y;
        bx = CX + state.ball.x;
        by = visualY;

        // Override scale for visual effect
        scale = 1 - (state.ball.z / 1000);
    }

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(bx, by, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.stroke();

    if (state.phase === 'result') {
        ctx.fillStyle = 'yellow';
        ctx.font = '60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(state.resultMsg, CX, CY);
    }

    if (state.mode) requestAnimationFrame(update);
    requestAnimationFrame(draw);
}

// Initial draw
draw();
