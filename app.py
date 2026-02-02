

from flask import Flask, render_template, jsonify, request, session
import os
import json
import random
from noughtsandcrosses_2357572 import (
    initialise_board,
    check_for_win,
    check_for_draw,
    choose_computer_move,
    load_scores
)

app = Flask(__name__)
app.secret_key = 'tic-tac-toe-secret-key'
LEADERBOARD_FILE = 'leaderboard.txt'

def get_empty_board():
    return [[' ']*3 for _ in range(3)]

# --- ROUTES ---

@app.route('/')
def hub():
    return render_template('hub.html')

@app.route('/tictactoe')
def tictactoe_page():
    return render_template('tictactoe.html')

@app.route('/rockpaperscissors')
def rps_page():
    return render_template('rps.html')

@app.route('/hangman')
def hangman_page():
    return render_template('hangman.html')

@app.route('/memory')
def memory_page():
    return render_template('memory.html')

@app.route('/snake')
def snake_page():
    return render_template('snake.html')

@app.route('/drive')
def drive_page():
    return render_template('drive.html')

@app.route('/football')
def football_page():
    return render_template('football.html')

# --- HANGMAN API ---
WORDS = ["PYTHON", "FLASK", "CODING", "GAMING", "SERVER", "DATABASE", "SCRIPT", "VARIABLE", "FUNCTION", "DEVELOPER"]

@app.route('/api/hangman/start', methods=['POST'])
def hangman_start():
    word = random.choice(WORDS)
    session['hm_word'] = word
    session['hm_guessed'] = []
    session['hm_lives'] = 6
    
    return jsonify({
        'display': "_ " * len(word),
        'lives': 6,
        'guessed': [],
        'status': 'ongoing'
    })

@app.route('/api/hangman/guess', methods=['POST'])
def hangman_guess():
    if 'hm_word' not in session: return jsonify({'error': 'Game not started'}), 400
    
    letter = request.json.get('letter')
    word = session['hm_word']
    guessed = session['hm_guessed']
    
    if letter in guessed:
        return jsonify({'error': 'Already guessed'}), 400
        
    guessed.append(letter)
    session['hm_guessed'] = guessed
    
    correct = letter in word
    
    if not correct:
        session['hm_lives'] -= 1
        
    # Build display
    display_arr = [l if l in guessed else '_' for l in word]
    display = " ".join(display_arr)
    
    status = 'ongoing'
    if '_' not in display_arr:
        status = 'win'
    elif session['hm_lives'] <= 0:
        status = 'lose'

    session.modified = True
    return jsonify({
        'display': display,
        'lives': session['hm_lives'],
        'correct': correct,
        'status': status,
        'word': word if status == 'lose' else None
    })



# --- TIC TAC TOE API ---

@app.route('/api/tictactoe/start', methods=['POST'])
def ttt_start():
    data = request.json or {}
    mode = data.get('mode', 'single')
    
    session['ttt_board'] = get_empty_board()
    session['ttt_score'] = session.get('ttt_score', 0)
    session['ttt_mode'] = mode
    session['ttt_turn'] = 'X'
    
    return jsonify({
        'board': session['ttt_board'], 
        'message': 'Game Started', 
        'score': session['ttt_score'],
        'mode': mode,
        'turn': 'X'
    })

@app.route('/api/tictactoe/move', methods=['POST'])
def ttt_move():
    if 'ttt_board' not in session:
        return jsonify({'error': 'Game not started'}), 400

    data = request.json
    row = int(data.get('row'))
    col = int(data.get('col'))
    board = session['ttt_board']
    mode = session.get('ttt_mode', 'single')
    current_turn = session.get('ttt_turn', 'X')

    if board[row][col] != ' ':
        return jsonify({'error': 'Invalid move'}), 400

    if mode == 'multi':
        board[row][col] = current_turn
        
        if check_for_win(board, current_turn):
            if current_turn == 'X': session['ttt_score'] += 1
            else: session['ttt_score'] -= 1
            session.modified = True
            return jsonify({'board': board, 'status': 'win', 'winner': current_turn, 'mode': mode, 'score': session['ttt_score']})
            
        if check_for_draw(board):
            session.modified = True
            return jsonify({'board': board, 'status': 'draw', 'mode': mode, 'score': session['ttt_score']})
            
        next_turn = 'O' if current_turn == 'X' else 'X'
        session['ttt_turn'] = next_turn
        session['ttt_board'] = board
        return jsonify({'board': board, 'status': 'ongoing', 'turn': next_turn, 'mode': mode, 'score': session['ttt_score']})

    else: # Single Player
        board[row][col] = 'X'
        if check_for_win(board, 'X'):
            session['ttt_score'] += 1
            session.modified = True
            return jsonify({'board': board, 'status': 'win', 'winner': 'X', 'score': session['ttt_score'], 'mode': mode})
        
        if check_for_draw(board):
            session.modified = True
            return jsonify({'board': board, 'status': 'draw', 'score': session['ttt_score'], 'mode': mode})

        comp_row, comp_col = choose_computer_move(board)
        if comp_row is not None:
             board[comp_row][comp_col] = 'O'
             if check_for_win(board, 'O'):
                 session['ttt_score'] -= 1
                 session.modified = True
                 return jsonify({'board': board, 'status': 'win', 'winner': 'O', 'score': session['ttt_score'], 'mode': mode})
             if check_for_draw(board):
                 session.modified = True
                 return jsonify({'board': board, 'status': 'draw', 'score': session['ttt_score'], 'mode': mode})
        
        session['ttt_board'] = board
        return jsonify({'board': board, 'status': 'ongoing', 'score': session['ttt_score'], 'mode': mode})

@app.route('/api/tictactoe/save', methods=['POST'])
def ttt_save():
    # ... Score saving logic (simplified for brevity, reused) ...
    data = request.json
    name = data.get('name')
    score = session.get('ttt_score', 0)
    if not name: return jsonify({'error': 'Name required'}), 400
    
    leaders = load_scores()
    leaders[name] = leaders.get(name, 0) + score
    try:
        with open(LEADERBOARD_FILE, 'w') as file: json.dump(leaders, file)
        session['ttt_score'] = 0 
        return jsonify({'success': True, 'score': 0})
    except IOError: return jsonify({'error': 'Failed to save'}), 500

@app.route('/api/tictactoe/leaderboard', methods=['GET'])
def ttt_leaderboard():
    leaders = load_scores()
    return jsonify(sorted(leaders.items(), key=lambda x: x[1], reverse=True))


# --- ROCK PAPER SCISSORS API ---

@app.route('/api/rps/play', methods=['POST'])
def rps_play():
    if 'rps_score' not in session: session['rps_score'] = 0
    choices = ['rock', 'paper', 'scissors']
    
    user_choice = request.json.get('choice')
    if user_choice not in choices:
        return jsonify({'error': 'Invalid choice'}), 400
        
    comp_choice = random.choice(choices)
    
    # Logic
    result = 'draw'
    if user_choice == comp_choice:
        result = 'draw'
    elif (user_choice == 'rock' and comp_choice == 'scissors') or \
         (user_choice == 'scissors' and comp_choice == 'paper') or \
         (user_choice == 'paper' and comp_choice == 'rock'):
        result = 'win'
        session['rps_score'] += 1
    else:
        result = 'lose'
        session['rps_score'] -= 1
        
    return jsonify({
        'user': user_choice, 
        'computer': comp_choice, 
        'result': result,
        'score': session['rps_score']
    })


if __name__ == '__main__':
    app.run(debug=True)
