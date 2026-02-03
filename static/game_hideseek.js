
const canvas = document.getElementById('huntCanvas');
const ctx = canvas.getContext('2d');

// Config
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const PROP_SIZE = 30;
const SEEKER_RADIUS = 15;

// Game State
let gameState = {
    phase: 'setup', // 'setup', 'hiding', 'seeking', 'result'
    timer: 15,
    props: [], // Real props
    hider: { x: 0, y: 0, type: 0, locked: false }, // Player 1
    seeker: { x: 0, y: 0, ammo: 5 }, // Player 2
    resultMsg: ""
};

// Assets (Shapes for now)
const TYPES = ['box', 'barrel', 'tree']; // 0, 1, 2

// Control
const keys = { w: false, a: false, s: false, d: false, space: false };
window.addEventListener('keydown', e => {
    if (e.key === 'w') keys.w = true;
    if (e.key === 'a') keys.a = true;
    if (e.key === 's') keys.s = true;
    if (e.key === 'd') keys.d = true;
    if (e.key === ' ') handleSpace();
});
window.addEventListener('keyup', e => {
    if (e.key === 'w') keys.w = false;
    if (e.key === 'a') keys.a = false;
    if (e.key === 's') keys.s = false;
    if (e.key === 'd') keys.d = false;
});

canvas.addEventListener('click', e => {
    if (gameState.phase === 'seeking') {
        const rect = canvas.getBoundingClientRect();
        shoot(e.clientX - rect.left, e.clientY - rect.top);
    }
});

function init() {
    // Generate Map
    gameState.props = [];
    for (let i = 0; i < 30; i++) {
        gameState.props.push({
            x: Math.random() * (MAP_WIDTH - PROP_SIZE),
            y: Math.random() * (MAP_HEIGHT - PROP_SIZE),
            type: Math.floor(Math.random() * 3)
        });
    }

    // Init Players
    gameState.hider.x = MAP_WIDTH / 2;
    gameState.hider.y = MAP_HEIGHT / 2;
    gameState.hider.type = Math.floor(Math.random() * 3);
    gameState.hider.locked = false;

    gameState.seeker.x = -100; // Off screen
    gameState.seeker.ammo = 3;

    startPhase('hiding');
}

function startPhase(p) {
    gameState.phase = p;
    if (p === 'hiding') {
        gameState.timer = 15;
        gameState.resultMsg = "Hider: Move to a spot & Lock (Space)!";
    } else if (p === 'seeking') {
        gameState.timer = 30;
        gameState.resultMsg = "Seeker: Find the fake! Click to shoot.";
    }
}

function handleSpace() {
    if (gameState.phase === 'hiding') {
        gameState.hider.locked = true;
        // Early start if locked?
        // Let timer run out to give Seeker time to come back
    }
}

function shoot(x, y) {
    if (gameState.seeker.ammo <= 0) return;
    gameState.seeker.ammo--;

    // Check hit on Hider
    // Hider is just another prop visually
    // Hitbox
    let hx = gameState.hider.x;
    let hy = gameState.hider.y;

    if (x > hx && x < hx + PROP_SIZE && y > hy && y < hy + PROP_SIZE) {
        endGame('seeker');
    } else if (gameState.seeker.ammo === 0) {
        endGame('hider');
    }
}

function endGame(winner) {
    gameState.phase = 'result';
    gameState.resultMsg = winner === 'seeker' ? "SEEKER WINS! Found the fake." : "HIDER WINS! Survived.";
    setTimeout(init, 4000);
}

function update() {
    // Timer
    if (gameState.period % 60 === 0 && gameState.timer > 0) gameState.timer--;

    if (gameState.phase === 'hiding') {
        if (!gameState.hider.locked) {
            let speed = 4;
            if (keys.w) gameState.hider.y -= speed;
            if (keys.s) gameState.hider.y += speed;
            if (keys.a) gameState.hider.x -= speed;
            if (keys.d) gameState.hider.x += speed;

            // Keep in bounds
            gameState.hider.x = Math.max(0, Math.min(MAP_WIDTH - PROP_SIZE, gameState.hider.x));
            gameState.hider.y = Math.max(0, Math.min(MAP_HEIGHT - PROP_SIZE, gameState.hider.y));
        }

        if (gameState.timer <= 0) {
            startPhase('seeking');
        }
    } else if (gameState.phase === 'seeking') {
        if (gameState.timer <= 0) {
            endGame('hider');
        }
    }

    draw();
    gameState.period++;
    requestAnimationFrame(update);
}
gameState.period = 0;

function drawProp(ctx, x, y, type) {
    if (type === 0) { // Box
        ctx.fillStyle = '#8e44ad';
        ctx.fillRect(x, y, PROP_SIZE, PROP_SIZE);
        ctx.strokeStyle = '#9b59b6';
        ctx.strokeRect(x, y, PROP_SIZE, PROP_SIZE);
    } else if (type === 1) { // Barrel
        ctx.fillStyle = '#e67e22';
        ctx.beginPath(); ctx.arc(x + PROP_SIZE / 2, y + PROP_SIZE / 2, PROP_SIZE / 2, 0, Math.PI * 2); ctx.fill();
    } else { // Tree
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.moveTo(x + PROP_SIZE / 2, y);
        ctx.lineTo(x + PROP_SIZE, y + PROP_SIZE);
        ctx.lineTo(x, y + PROP_SIZE);
        ctx.fill();
    }
}

function draw() {
    ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Background Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i < MAP_WIDTH; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MAP_HEIGHT); ctx.stroke(); }
    for (let i = 0; i < MAP_HEIGHT; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MAP_WIDTH, i); ctx.stroke(); }

    // Draw Props (Decoys)
    gameState.props.forEach(p => drawProp(ctx, p.x, p.y, p.type));

    // Draw Hider
    // If Seeking phase, Hider looks EXACTLY like a prop
    // If Hiding phase, Hider might glow to show player
    if (gameState.phase !== 'result') {
        drawProp(ctx, gameState.hider.x, gameState.hider.y, gameState.hider.type);

        if (gameState.phase === 'hiding') {
            // Glow indicator
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.strokeRect(gameState.hider.x - 5, gameState.hider.y - 5, PROP_SIZE + 10, PROP_SIZE + 10);
        }
    } else {
        // Result: Reveal Hider
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(gameState.hider.x, gameState.hider.y, PROP_SIZE, PROP_SIZE);
        drawProp(ctx, gameState.hider.x, gameState.hider.y, gameState.hider.type);
    }

    // Draw Seeker (Mouse Cursor basically, or reticle)
    if (gameState.phase === 'seeking') {
        // We rely on mouse cursor, but let's show ammo
        ctx.fillStyle = 'white';
        ctx.font = '20px monospace';
        ctx.fillText(`Ammo: ${gameState.seeker.ammo}`, 10, 30);
    }

    // Update DOM
    document.getElementById('timeDisplay').innerText = gameState.timer;
    document.getElementById('phaseDisplay').innerText = gameState.resultMsg || (gameState.phase === 'hiding' ? "HIDER'S TURN" : "SEEKER'S TURN");
    document.getElementById('roleDisplay').innerText = gameState.phase === 'hiding' ? "HIDER (P1)" : "SEEKER (P2)";
}

init();
update();
