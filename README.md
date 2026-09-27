# TaskArcade

A gamified habit tracker built with Python and Flask.

## Features
- **Track Daily Habits**: Monitor your daily routines and habit completions.
- **Gamification**: Earn diamonds, maintain streaks, and use streak freezes.
- **Challenges**: Join global challenges and track your progress.
- **Leaderboard**: Compare your completions and streaks with other users.

## Setup and Installation

1. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install flask
   ```

3. **Run the application**:
   ```bash
   python app.py
   ```

4. **Access the web app**:
   Open your browser and navigate to [http://127.0.0.1:5001](http://127.0.0.1:5001).

## Data Storage
The application uses local CSV files located in the `data/` directory to persistently store information about users, habits, completions, and challenges.
