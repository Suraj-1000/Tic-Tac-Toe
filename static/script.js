
const API_BASE = '/api';

// UI Elements
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score-display');
const statusEl = document.getElementById('status-display');
const gameArea = document.getElementById('game-area');
const menuArea = document.getElementById('menu-area');

// Modals
const msgModal = document.getElementById('message-modal');
const lbModal = document.getElementById('leaderboard-modal');
const saveModal = document.getElementById('save-modal');

let isGameActive = false;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Show Menu initially
});

// --- API Interactions ---

async function startGame() {
    try {
        const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
        const data = await res.json();

        isGameActive = true;
        renderBoard(data.board);
        updateScore(data.score);
        statusEl.textContent = "Your Turn (X)";

        // Show Game Area, Hide Menu/Modals
        menuArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        hideModals();

    } catch (e) {
        console.error("Error starting game", e);
        alert("Failed to start game. Is the server running?");
    }
}

async function makeMove(row, col) {
    if (!isGameActive) return;

    // Optimistic UI update (optional, but good for response time)
    // For now we'll wait for server for simplicity and correctness with "computer thinking"

    try {
        statusEl.textContent = "Computer Thinking...";

        const res = await fetch(`${API_BASE}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ row, col })
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        renderBoard(data.board);
        updateScore(data.score ?? 0); // Handle updated score if returned

        if (data.status === 'win') {
            isGameActive = false;
            showEndGame(data.winner === 'X' ? "You Won!" : "Computer Won!", data.winner === 'X' ? "Great job!" : "Better luck next time.");
        } else if (data.status === 'draw') {
            isGameActive = false;
            showEndGame("Draw!", "No moves left.");
        } else {
            statusEl.textContent = "Your Turn (X)";
        }

    } catch (e) {
        console.error("Move error", e);
    }
}

async function showLeaderboard() {
    try {
        const res = await fetch(`${API_BASE}/leaderboard`);
        const data = await res.json();

        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';

        if (data.length === 0) {
            list.innerHTML = '<li>No scores yet</li>';
        } else {
            data.forEach(([name, score], index) => {
                list.innerHTML += `<li><span>${index + 1}. ${name}</span> <span>${score}</span></li>`;
            });
        }

        lbModal.classList.remove('hidden');
    } catch (e) {
        console.error("Leaderboard error", e);
    }
}

async function submitScore() {
    const input = document.getElementById('username-input');
    const name = input.value.trim();

    if (!name) return;

    try {
        const res = await fetch(`${API_BASE}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await res.json();
        if (data.success) {
            updateScore(0); // Score resets after save
            closeModal('save-modal');
            showLeaderboard(); // Show them where they rank
        } else {
            alert("Error saving score");
        }
    } catch (e) {
        console.error("Save error", e);
    }
}

// --- Helpers ---

function renderBoard(boardState) {
    boardEl.innerHTML = ''; // Clear

    boardState.forEach((row, rIndex) => {
        row.forEach((cell, cIndex) => {
            const el = document.createElement('div');
            el.className = `cell ${cell === ' ' ? '' : 'taken'} ${cell === 'X' ? 'x' : ''} ${cell === 'O' ? 'o' : ''}`;
            el.textContent = cell;
            el.onclick = () => {
                if (cell === ' ' && isGameActive) {
                    makeMove(rIndex, cIndex);
                }
            };
            boardEl.appendChild(el);
        });
    });
}

function updateScore(val) {
    scoreEl.textContent = val;
}

function showMenu() {
    gameArea.classList.add('hidden');
    menuArea.classList.remove('hidden');
    hideModals();
}

function saveScorePrompt() {
    document.getElementById('username-input').value = '';
    saveModal.classList.remove('hidden');
}

function showEndGame(title, msg) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-msg').textContent = msg;
    msgModal.classList.remove('hidden');
}

function hideModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}
