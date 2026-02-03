
const canvas = document.getElementById('carromCanvas');
const ctx = canvas.getContext('2d');

const BOARD_SIZE = 600;
const POCKET_RADIUS = 25;
const STRIKER_RADIUS = 18;
const COIN_RADIUS = 12;
const FRICTION = 0.985;
const WALL_BOUNCE = 0.7;

// Pockets: TL, TR, BR, BL
const POCKETS = [
    { x: 0, y: 0 },
    { x: BOARD_SIZE, y: 0 },
    { x: BOARD_SIZE, y: BOARD_SIZE },
    { x: 0, y: BOARD_SIZE }
];

class Piece {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.type = type; // 'white', 'black', 'queen', 'striker'

        if (type === 'striker') this.radius = STRIKER_RADIUS;
        else this.radius = COIN_RADIUS;

        this.potted = false;
    }

    update() {
        if (this.potted) return;

        this.x += this.vx;
        this.y += this.vy;

        // Friction
        this.vx *= FRICTION;
        this.vy *= FRICTION;

        if (Math.abs(this.vx) < 0.05) this.vx = 0;
        if (Math.abs(this.vy) < 0.05) this.vy = 0;

        // Wall Bounce
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -WALL_BOUNCE; }
        if (this.x > BOARD_SIZE - this.radius) { this.x = BOARD_SIZE - this.radius; this.vx *= -WALL_BOUNCE; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -WALL_BOUNCE; }
        if (this.y > BOARD_SIZE - this.radius) { this.y = BOARD_SIZE - this.radius; this.vy *= -WALL_BOUNCE; }

        // Pockets
        for (let p of POCKETS) {
            let dx = this.x - p.x;
            let dy = this.y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) < POCKET_RADIUS) {
                this.potted = true;
                this.vx = 0; this.vy = 0;
                handlePot(this);
            }
        }
    }

    draw() {
        if (this.potted) return;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        if (this.type === 'striker') {
            ctx.fillStyle = '#f1c40f'; // Yellow Striker
            ctx.strokeStyle = '#fff';
        } else if (this.type === 'white') {
            ctx.fillStyle = '#ecf0f1';
            ctx.strokeStyle = '#bdc3c7';
        } else if (this.type === 'black') {
            ctx.fillStyle = '#2c3e50';
            ctx.strokeStyle = '#34495e';
        } else if (this.type === 'queen') {
            ctx.fillStyle = '#e74c3c'; // Red Queen
            ctx.strokeStyle = '#c0392b';
        }

        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Game State
let pieces = [];
let striker;
let turn = 'white'; // 'white' or 'black'
let state = 'aiming'; // 'aiming', 'shooting', 'moving'
let dragStart = null;
let dragCurrent = null;

function init() {
    pieces = [];
    // Setup Board Center
    const CX = BOARD_SIZE / 2;
    const CY = BOARD_SIZE / 2;

    // Queen
    pieces.push(new Piece(CX, CY, 'queen'));

    // Hexagon pattern around center logic simplified:
    // Just a circle of alternating pieces for now
    for (let i = 0; i < 6; i++) {
        let angle = (Math.PI * 2 / 6) * i;
        let dist = 26;
        let type = i % 2 === 0 ? 'white' : 'black';
        pieces.push(new Piece(CX + Math.cos(angle) * dist, CY + Math.sin(angle) * dist, type));
    }
    // Outer circle
    for (let i = 0; i < 12; i++) {
        let angle = (Math.PI * 2 / 12) * i;
        let dist = 50;
        let type = i % 2 === 0 ? 'white' : 'black'; // Alternating logic simplified
        type = (i === 0 || i === 3 || i === 7) ? 'white' : 'black'; // Roughly
        // Let's just alternate for simplicity
        type = i % 2 === 0 ? 'black' : 'white';
        pieces.push(new Piece(CX + Math.cos(angle) * dist, CY + Math.sin(angle) * dist, type));
    }

    resetStriker();
}

function resetStriker() {
    state = 'aiming';
    // Position based on turn
    // White plays from bottom, Black plays from top? 
    // Standard Carrom: 4 sides. Simple: Bottom baseline only, switch turns but keep view?
    // Let's implement: Active player creates striker on their baseline.

    if (turn === 'white') {
        striker = new Piece(BOARD_SIZE / 2, BOARD_SIZE - 100, 'striker');
    } else {
        striker = new Piece(BOARD_SIZE / 2, 100, 'striker');
    }
    document.getElementById('statusText').innerText = turn.toUpperCase() + "'s Turn";
}

function handlePot(piece) {
    // If striker potted -> Foul (Reset turn, maybe penalty?)
    if (piece.type === 'striker') {
        // Reset
        setTimeout(() => {
            piece.potted = false;
            resetStriker();
            // Penalize?
        }, 500);
    }
    // Logic for coins: if you pot yours, continue turn.
}

// Input
canvas.addEventListener('mousedown', e => {
    if (state !== 'aiming') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking striker
    let d = Math.sqrt(Math.pow(x - striker.x, 2) + Math.pow(y - striker.y, 2));
    if (d < striker.radius * 2) {
        state = 'shooting';
        dragStart = { x, y };
        dragCurrent = { x, y };
    }
});

canvas.addEventListener('mousemove', e => {
    if (state !== 'shooting') return;
    const rect = canvas.getBoundingClientRect();
    dragCurrent = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
});

canvas.addEventListener('mouseup', e => {
    if (state !== 'shooting') return;

    // Shoot
    let dx = dragStart.x - dragCurrent.x;
    let dy = dragStart.y - dragCurrent.y;

    // Power cap
    let mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 150) {
        let scale = 150 / mag;
        dx *= scale;
        dy *= scale;
    }

    striker.vx = dx * 0.15;
    striker.vy = dy * 0.15;

    state = 'moving';
});

// Physics Logic
function resolveCollisions() {
    let all = [striker, ...pieces];

    for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
            let p1 = all[i];
            let p2 = all[j];
            if (p1.potted || p2.potted) continue;

            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < p1.radius + p2.radius) {
                // Collision
                let angle = Math.atan2(dy, dx);
                let sin = Math.sin(angle);
                let cos = Math.cos(angle);

                // Rotate velocities
                let vx1 = p1.vx * cos + p1.vy * sin;
                let vy1 = p1.vy * cos - p1.vx * sin;
                let vx2 = p2.vx * cos + p2.vy * sin;
                let vy2 = p2.vy * cos - p2.vx * sin;

                // Elastic collision (Equal mass assumption mostly ok for game feel, Striker heavier?)
                // Assuming Striker is 2x mass of coin
                let m1 = p1.type === 'striker' ? 2 : 1;
                let m2 = p2.type === 'striker' ? 2 : 1;

                let vx1Final = ((m1 - m2) * vx1 + 2 * m2 * vx2) / (m1 + m2);
                let vx2Final = ((m2 - m1) * vx2 + 2 * m1 * vx1) / (m1 + m2);

                // Update velocities
                p1.vx = vx1Final * cos - vy1 * sin;
                p1.vy = vx1Final * sin + vy1 * cos;
                p2.vx = vx2Final * cos - vy2 * sin;
                p2.vy = vx2Final * sin + vy2 * cos;

                // Separate circles to prevent overlap stickiness
                let overlap = (p1.radius + p2.radius - dist) / 2;
                p1.x -= overlap * Math.cos(angle);
                p1.y -= overlap * Math.sin(angle);
                p2.x += overlap * Math.cos(angle);
                p2.y += overlap * Math.sin(angle);
            }
        }
    }
}

function loop() {
    ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    // Draw Pockets
    ctx.fillStyle = '#000';
    for (let p of POCKETS) {
        ctx.beginPath(); ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2); ctx.fill();
    }

    // Update & Draw
    let moving = false;

    pieces.forEach(p => {
        p.update();
        p.draw();
        if (Math.abs(p.vx) > 0.01 || Math.abs(p.vy) > 0.01) moving = true;
    });

    if (striker && !striker.potted) {
        striker.update();
        striker.draw();
        if (Math.abs(striker.vx) > 0.01 || Math.abs(striker.vy) > 0.01) moving = true;
    }

    resolveCollisions();

    if (state === 'moving' && !moving) {
        // Turn ended
        // Simple logic: Change turn
        state = 'aiming';
        turn = turn === 'white' ? 'black' : 'white';
        resetStriker();
    }

    // UI Line
    if (state === 'shooting' && dragStart && dragCurrent) {
        ctx.beginPath();
        ctx.moveTo(striker.x, striker.y);
        ctx.lineTo(striker.x + (dragStart.x - dragCurrent.x), striker.y + (dragStart.y - dragCurrent.y));
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    requestAnimationFrame(loop);
}

init();
loop();
