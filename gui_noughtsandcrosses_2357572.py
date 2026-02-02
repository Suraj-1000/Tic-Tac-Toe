
import tkinter as tk
from tkinter import messagebox, simpledialog
import json
import os
# Import logic from the provided existing module
# Ideally, we would refactor the original file to export specific constants/functions cleanly,
# but we are sticking to the requirement of using the existing logic.
from noughtsandcrosses_2613499 import (
    initialise_board, 
    check_for_win, 
    check_for_draw, 
    choose_computer_move, 
    load_scores
)

class TicTacToeGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Unbeatable Noughts and Crosses")
        self.root.geometry("400x500")
        
        # State
        self.board = [[' ' for _ in range(3)] for _ in range(3)]
        self.buttons = [[None for _ in range(3)] for _ in range(3)]
        self.total_score = 0
        self.game_active = False

        # Build Main UI
        self.main_frame = tk.Frame(self.root, padx=20, pady=20)
        self.main_frame.pack(expand=True, fill="both")

        self.create_main_menu()

    def clear_frame(self):
        for widget in self.main_frame.winfo_children():
            widget.destroy()

    def create_main_menu(self):
        self.clear_frame()
        self.game_active = False
        
        title_label = tk.Label(self.main_frame, text="Tic Tac Toe", font=("Helvetica", 24, "bold"))
        title_label.pack(pady=20)

        score_label = tk.Label(self.main_frame, text=f"Session Score: {self.total_score}", font=("Helvetica", 12))
        score_label.pack(pady=10)

        play_btn = tk.Button(self.main_frame, text="Play Game", font=("Helvetica", 14), width=20, command=self.start_game)
        play_btn.pack(pady=10)

        leaderboard_btn = tk.Button(self.main_frame, text="Leaderboard", font=("Helvetica", 14), width=20, command=self.show_leaderboard)
        leaderboard_btn.pack(pady=10)
        
        save_btn = tk.Button(self.main_frame, text="Save Score", font=("Helvetica", 14), width=20, command=self.save_current_score)
        save_btn.pack(pady=10)

        quit_btn = tk.Button(self.main_frame, text="Quit", font=("Helvetica", 14), width=20, command=self.root.quit)
        quit_btn.pack(pady=10)

    def start_game(self):
        self.clear_frame()
        self.game_active = True
        
        # Reset board logic
        self.board = initialise_board(self.board)

        # Header
        tk.Label(self.main_frame, text="Your Turn (X)", font=("Helvetica", 16)).pack(pady=10)

        # Board Grid
        grid_frame = tk.Frame(self.main_frame)
        grid_frame.pack(pady=10)

        for r in range(3):
            for c in range(3):
                btn = tk.Button(grid_frame, text=" ", font=("Helvetica", 20, "bold"), width=5, height=2,
                                command=lambda row=r, col=c: self.player_move(row, col))
                btn.grid(row=r, column=c, padx=2, pady=2)
                self.buttons[r][c] = btn

        back_btn = tk.Button(self.main_frame, text="Back to Menu", command=self.create_main_menu)
        back_btn.pack(pady=20)

    def player_move(self, row, col):
        if not self.game_active or self.board[row][col] != ' ':
            return

        # Execute Player Move
        self.board[row][col] = 'X'
        self.buttons[row][col].config(text='X', state="disabled", disabledforeground="blue")
        
        if self.check_game_over('X'):
            return

        # Computer Move
        self.root.after(500, self.computer_move) # Small delay for better UX

    def computer_move(self):
        if not self.game_active:
            return

        row, col = choose_computer_move(self.board)
        if row is not None and col is not None:
            self.board[row][col] = 'O'
            self.buttons[row][col].config(text='O', state="disabled", disabledforeground="red")
            self.check_game_over('O')

    def check_game_over(self, player_mark):
        if check_for_win(self.board, player_mark):
            self.game_active = False
            if player_mark == 'X':
                messagebox.showinfo("Game Over", "Congratulations! You won.")
                self.total_score += 1
            else:
                messagebox.showinfo("Game Over", "The computer won. Better luck next time!")
                self.total_score -= 1 # As per play_game logic (-1 for computer win)
            
            self.create_main_menu()
            return True
            
        if check_for_draw(self.board):
            self.game_active = False
            messagebox.showinfo("Game Over", "It is a draw!")
            # Score doesn't change on draw
            self.create_main_menu()
            return True

        return False

    def save_current_score(self):
        if self.total_score == 0:
             messagebox.showinfo("Save Score", "Score is 0, play a game first!")
             return

        name = simpledialog.askstring("Input", "Enter your name to save your score:")
        if name and name.strip():
            try:
                # Re-implementing save logic here to avoid using the console input() from the original file
                leaders = load_scores()
                leaders[name.strip()] = leaders.get(name.strip(), 0) + self.total_score
                
                with open('leaderboard.txt', 'w') as file:
                    json.dump(leaders, file)
                
                messagebox.showinfo("Success", f"Score for {name} saved successfully.")
                self.total_score = 0 # Reset session score after save
                self.create_main_menu() # Refresh UI
            except IOError:
                messagebox.showerror("Error", "Could not save the score locally.")
        else:
             if name is not None: # Only if not cancelled
                messagebox.showwarning("Warning", "Invalid name. Score not saved.")

    def show_leaderboard(self):
        self.clear_frame()
        
        tk.Label(self.main_frame, text="Leaderboard", font=("Helvetica", 24, "bold")).pack(pady=20)
        
        leaders = load_scores()
        
        list_frame = tk.Frame(self.main_frame)
        list_frame.pack(fill="both", expand=True)

        scrollbar = tk.Scrollbar(list_frame)
        scrollbar.pack(side="right", fill="y")

        lb_list = tk.Listbox(list_frame, font=("Courier", 12), yscrollcommand=scrollbar.set)
        
        if not leaders:
             lb_list.insert(tk.END, "No scores yet.")
        else:
             # Sort by score descending
            sorted_leaders = sorted(leaders.items(), key=lambda x: x[1], reverse=True)
            for name, score in sorted_leaders:
                lb_list.insert(tk.END, f"{name:20}: {score}")
        
        lb_list.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=lb_list.yview)

        tk.Button(self.main_frame, text="Back to Menu", command=self.create_main_menu).pack(pady=20)


if __name__ == "__main__":
    root = tk.Tk()
    app = TicTacToeGUI(root)
    root.mainloop()
