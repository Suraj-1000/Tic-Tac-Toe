import random
import os.path
import json

# Set seed for random movements
random.seed()


def draw_board(board):
    """
    Draws the 3x3 noughts and crosses board on the console.
    
    Args:
        board (list): A 3x3 list of lists representing the game board.
    """
    row_sep = '-------------'
    print(row_sep)
    for row in range(3):
        print(f'| {board[row][0]} | {board[row][1]} | {board[row][2]} |')
        print(row_sep)


def welcome(board):
    """
    Prints a welcome message and displays the initial board layout.
    
    Args:
        board (list): A 3x3 list of lists representing the game board.
    """
    print('Welcome to the "Unbeatable Noughts and Crosses" game.')
    print('The board layout is as follows:')
    draw_board(board)


def initialise_board(board):
    """
    Sets all elements of the board to a single space.
    
    Args:
        board (list): A 3x3 list of lists representing the game board.
        
    Returns:
        list: The initialised 3x3 board.
    """
    for row in range(3):
        for col in range(3):
            board[row][col] = ' '
    return board


def get_player_move(board):
    """
    Asks the user for a cell index (1-9) and returns its row and column.
    
    Args:
        board (list): A 3x3 list of lists representing the game board.
        
    Returns:
        tuple: (row, col) indices for the chosen cell.
    """
    while True:
        try:
            move = input('Choose your move (1-9): ')
            if not move.isdigit() or int(move) < 1 or int(move) > 9:
                print('Invalid input. Please enter a number between 1 and 9.')
                continue

            val = int(move)
            row = (val - 1) // 3
            col = (val - 1) % 3

            if board[row][col] != ' ':
                print('That cell is already occupied. Try again.')
                continue

            return row, col
        except ValueError:
            print('Invalid input. Please enter a number.')


def choose_computer_move(board):
    """
    Chooses a move for the computer ('O') using a basic win/block strategy.
    
    Args:
        board (list): A 3x3 list of lists representing the game board.
        
    Returns:
        tuple: (row, col) indices for the computer's move.
    """
    # 1. Check if computer can win
    for row in range(3):
        for col in range(3):
            if board[row][col] == ' ':
                board[row][col] = 'O'
                if check_for_win(board, 'O'):
                    return row, col
                board[row][col] = ' '

    # 2. Check if player can win and block
    for row in range(3):
        for col in range(3):
            if board[row][col] == ' ':
                board[row][col] = 'X'
                if check_for_win(board, 'X'):
                    board[row][col] = ' '
                    return row, col
                board[row][col] = ' '

    # 3. Choose a random available cell
    available_moves = []
    for r in range(3):
        for c in range(3):
            if board[r][c] == ' ':
                available_moves.append((r, c))

    if available_moves:
        return random.choice(available_moves)
    return None, None


def check_for_win(board, mark):
    """
    Checks if the specified mark ('X' or 'O') has won the game.
    
    Args:
        board (list): A 3x3 list of lists representing the game board.
        mark (str): 'X' or 'O' to check for a win.
        
    Returns:
        bool: True if the mark has won, False otherwise.
    """
    # Check rows
    for row in range(3):
        if board[row][0] == board[row][1] == board[row][2] == mark:
            return True

    # Check columns
    for col in range(3):
        if board[0][col] == board[1][col] == board[2][col] == mark:
            return True

    # Check diagonals
    if board[0][0] == board[1][1] == board[2][2] == mark:
        return True
    if board[0][2] == board[1][1] == board[2][0] == mark:
        return True

    return False


def check_for_draw(board):
    """
    Checks if the game resulted in a draw (all cells filled).
    
    Args:
        board (list): A 3x3 list of lists representing the game board.
        
    Returns:
        bool: True if it's a draw, False otherwise.
    """
    for row in range(3):
        for col in range(3):
            if board[row][col] == ' ':
                return False
    return True


def play_game(board):
    """
    Orchestrates the Noughts and Crosses game loop.
    
    Args:
        board (list): A 3x3 list of lists representing the game board.
        
    Returns:
        int: Score for the game (1 for player win, -1 for computer win, 0 for draw).
    """
    initialise_board(board)
    draw_board(board)

    while True:
        # Player Move
        row, col = get_player_move(board)
        board[row][col] = 'X'
        draw_board(board)
        if check_for_win(board, 'X'):
            print('Congratulations! You won.')
            return 1
        if check_for_draw(board):
            print('It is a draw!')
            return 0

        # Computer Move
        print('Computer is thinking...')
        row, col = choose_computer_move(board)
        board[row][col] = 'O'
        draw_board(board)
        if check_for_win(board, 'O'):
            print('The computer won. Better luck next time!')
            return -1
        if check_for_draw(board):
            print('It is a draw!')
            return 0


def menu():
    """
    Displays the game menu and returns the user selection with validation.
    
    Returns:
        str: Selection ('1', '2', '3', or 'q').
    """
    valid_choices = ['1', '2', '3', 'q']
    while True:
        print('\nMenu:')
        print('1 - Play the game')
        print('2 - Save score in file')
        print('3 - Load and display the leaderboard')
        print('q - End the program')
        choice = input('Enter your choice: ').strip().lower()
        
        if choice in valid_choices:
            return choice
        else:
            print('Invalid choice. Please enter 1, 2, 3, or q.')


def load_scores():
    """
    Loads leaderboard from 'leaderboard.txt'.
    
    Returns:
        dict: A dictionary of player names and their total scores.
    """
    leaders = {}
    if os.path.exists('leaderboard.txt'):
        try:
            with open('leaderboard.txt', 'r') as file:
                leaders = json.load(file)
        except (json.JSONDecodeError, IOError, ValueError):
            # ValueError handles case where file exists but is empty
            print('Starting with a fresh leaderboard.')
    return leaders


def save_score(score):
    """
    Asks the player for their name and persists their score.
    
    Args:
        score (int): The current session score to add to the leaderboard.
    """
    name = input('Enter your name to save your score: ').strip()
    if not name:
        print('Invalid name. Score not saved.')
        return

    leaders = load_scores()
    leaders[name] = leaders.get(name, 0) + score

    try:
        with open('leaderboard.txt', 'w') as file:
            json.dump(leaders, file)
        print(f'Score for {name} saved successfully.')
    except IOError:
        print('Error saving score to file.')


def display_leaderboard(leaders):
    """
    Pretty prints the current leaderboard.
    
    Args:
        leaders (dict): The leaderboard dictionary to display.
    """
    if not leaders:
        print('\nThe leaderboard is currently empty.')
        return

    print('\n--- LEADERBOARD ---')
    # Sort by score descending
    sorted_leaders = sorted(leaders.items(), key=lambda x: x[1], reverse=True)
    for name, score in sorted_leaders:
        print(f'{name:15}: {score}')
    print('-------------------')

