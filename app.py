
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
    data = request.json or {}
    mode = data.get('mode', 'single') # 'single' or 'multi'
    
    # Initialize session
    session['board'] = get_empty_board()
    session['score'] = session.get('score', 0)
    session['mode'] = mode
    session['turn'] = 'X' # For multiplayer, tracking whose turn it is
    
    return jsonify({
        'board': session['board'], 
        'message': 'Game Started', 
        'score': session['score'],
        'mode': mode,
        'turn': 'X'
    })

@app.route('/api/move', methods=['POST'])
def player_move():
    if 'board' not in session:
        return jsonify({'error': 'Game not started'}), 400

    data = request.json
    row = int(data.get('row'))
    col = int(data.get('col'))
    board = session['board']
    mode = session.get('mode', 'single')
    current_turn = session.get('turn', 'X')

    # Validation
    if board[row][col] != ' ':
        return jsonify({'error': 'Invalid move'}), 400

    # Logic for Multiplayer
    if mode == 'multi':
        board[row][col] = current_turn
        
        # Check Win
        if check_for_win(board, current_turn):
            session.modified = True
            return jsonify({
                'board': board,
                'status': 'win',
                'winner': current_turn,
                'mode': mode
            })
            
        # Check Draw
        if check_for_draw(board):
            session.modified = True
            return jsonify({
                'board': board,
                'status': 'draw',
                'mode': mode
            })
            
        # Switch Turn
        next_turn = 'O' if current_turn == 'X' else 'X'
        session['turn'] = next_turn
        session['board'] = board
        return jsonify({
            'board': board,
            'status': 'ongoing',
            'turn': next_turn,
            'mode': mode
        })

    # Logic for Single Player (User is always X)
    else:
        # 1. Player Move
        board[row][col] = 'X'
        
        # Check Win/Draw for X
        if check_for_win(board, 'X'):
            session['score'] += 1
            session.modified = True
            return jsonify({
                'board': board, 
                'status': 'win', 
                'winner': 'X',
                'score': session['score'],
                'mode': mode
            })
        
        if check_for_draw(board):
            session.modified = True
            return jsonify({
                'board': board, 
                'status': 'draw',
                'score': session['score'],
                'mode': mode
            })

        # 2. Computer Move
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
                     'score': session['score'],
                     'mode': mode
                 })
                 
             if check_for_draw(board):
                 session.modified = True
                 return jsonify({
                     'board': board, 
                     'status': 'draw',
                     'score': session['score'],
                     'mode': mode
                 })
        
        session['board'] = board
        return jsonify({'board': board, 'status': 'ongoing', 'score': session['score'], 'mode': mode})

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
