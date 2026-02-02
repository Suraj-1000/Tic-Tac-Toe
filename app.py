
from flask import Flask, render_template, jsonify, request, session
import os
import json
# Importing logic from the student's existing file
from noughtsandcrosses_2357572 import (
    initialise_board,
    check_for_win,
    check_for_draw,
    choose_computer_move,
    load_scores
)

app = Flask(__name__)
# Secret key needed for session. In production, use a secure random key.
app.secret_key = 'tic-tac-toe-secret-key'

# Helper to load leaderboard
LEADERBOARD_FILE = 'leaderboard.txt'

def get_empty_board():
    # Helper to create a clean structure serialization friendly
    return [[' ']*3 for _ in range(3)]

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/start', methods=['POST'])
def start_game():
    # Initialize board in session
    # We store board as a list of lists strings
    board = get_empty_board()
    session['board'] = board
    session['score'] = session.get('score', 0) # Keep session score if exists
    return jsonify({'board': board, 'message': 'Game Started', 'score': session['score']})

@app.route('/api/move', methods=['POST'])
def player_move():
    if 'board' not in session:
        return jsonify({'error': 'Game not started'}), 400

    data = request.json
    row = int(data.get('row'))
    col = int(data.get('col'))
    board = session['board']

    # Validation
    if board[row][col] != ' ':
        return jsonify({'error': 'Invalid move'}), 400

    # 1. Player Move
    board[row][col] = 'X'
    
    # Check Win/Draw for X
    if check_for_win(board, 'X'):
        session['score'] += 1
        session.modified = True # Ensure session saves
        return jsonify({
            'board': board, 
            'status': 'win', 
            'winner': 'X',
            'score': session['score']
        })
    
    if check_for_draw(board):
        session.modified = True
        return jsonify({
            'board': board, 
            'status': 'draw',
            'score': session['score']
        })

    # 2. Computer Move
    # Ensure choose_computer_move modifies OUR board structure correctly
    # The original function modifies the list in-place and returns (row, col) or just modifies it.
    # Looking at the original code: returns (row, col), but logic inside essentially finds a move.
    # Actually checking original file content:
    # it *returns* row, col. It does NOT modify the board permanently essentially?
    # Wait, the original `choose_computer_move` in `noughtsandcrosses_2613499.py` (step 9 view):
    # It does `board[row][col] = 'O'` then BACKTRACKS `board[row][col] = ' '` when SEARCHING.
    # But when it returns, it just returns the row/col. It does NOT make the move on the board passed to it permanently.
    
    # SO we must apply the move here.
    comp_row, comp_col = choose_computer_move(board)
    
    if comp_row is not None and comp_col is not None:
         board[comp_row][comp_col] = 'O'
         
         # Check Win/Draw for O
         if check_for_win(board, 'O'):
             session['score'] -= 1
             session.modified = True
             return jsonify({
                 'board': board, 
                 'status': 'win', 
                 'winner': 'O',
                 'score': session['score']
             })
             
         if check_for_draw(board):
             session.modified = True
             return jsonify({
                 'board': board, 
                 'status': 'draw',
                 'score': session['score']
             })
    
    session['board'] = board
    return jsonify({'board': board, 'status': 'ongoing', 'score': session['score']})

@app.route('/api/save', methods=['POST'])
def save_score():
    data = request.json
    name = data.get('name')
    score = session.get('score', 0)
    
    if not name:
        return jsonify({'error': 'Name required'}), 400

    # Logic adapted from save_score to avoid input()
    leaders = load_scores()
    leaders[name] = leaders.get(name, 0) + score
    
    try:
        with open(LEADERBOARD_FILE, 'w') as file:
            json.dump(leaders, file)
        
        # Reset session score after save, similar to CLI
        session['score'] = 0 
        return jsonify({'success': True, 'score': 0})
    except IOError:
        return jsonify({'error': 'Failed to save'}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    leaders = load_scores()
    # Sort for display
    sorted_leaders = sorted(leaders.items(), key=lambda x: x[1], reverse=True)
    return jsonify(sorted_leaders)

if __name__ == '__main__':
    app.run(debug=True)
