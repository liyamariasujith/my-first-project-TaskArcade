import os
import csv
import datetime
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

USERS_CSV = os.path.join(DATA_DIR, 'users.csv')
HABITS_CSV = os.path.join(DATA_DIR, 'habits.csv')
COMPLETIONS_CSV = os.path.join(DATA_DIR, 'completions.csv')
CHALLENGES_CSV = os.path.join(DATA_DIR, 'challenges.csv')
USER_CHALLENGES_CSV = os.path.join(DATA_DIR, 'user_challenges.csv')

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)

# Helper functions for CSV read/write
def read_csv(file_path):
    if not os.path.exists(file_path):
        return []
    with open(file_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)

def write_csv(file_path, fieldnames, rows):
    with open(file_path, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

def calculate_streak(completions, habit_id, target_date_str=None):
    dates = set()
    for c in completions:
        if str(c['habit_id']) == str(habit_id) and c['status'] == 'Completed':
            dates.add(c['date'])
            
    if not dates:
        return 0
        
    parsed_dates = []
    for d_str in dates:
        try:
            parsed_dates.append(datetime.datetime.strptime(d_str, '%Y-%m-%d').date())
        except ValueError:
            pass
            
    parsed_dates = sorted(list(set(parsed_dates)), reverse=True)
    if not parsed_dates:
        return 0
        
    # Default to today if no date specified
    today = datetime.date.today()
    if target_date_str:
        try:
            today = datetime.datetime.strptime(target_date_str, '%Y-%m-%d').date()
        except ValueError:
            pass
            
    yesterday = today - datetime.timedelta(days=1)
    
    # If not completed today and not completed yesterday, streak is broken (0)
    if today not in parsed_dates and yesterday not in parsed_dates:
        return 0
        
    streak = 0
    current_date = today if today in parsed_dates else yesterday
    
    while current_date in parsed_dates:
        streak += 1
        current_date -= datetime.timedelta(days=1)
        
    return streak

# Routes
@app.route('/')
def index():
    return render_template('index.html')

# API: Get Users
@app.route('/api/users')
def get_users():
    users = read_csv(USERS_CSV)
    return jsonify(users)

# API: Claim Reward (Update diamonds and streak freezes)
@app.route('/api/users/reward', methods=['POST'])
def claim_reward():
    data = request.json
    user_id = str(data.get('user_id'))
    diamonds_delta = int(data.get('diamonds', 0))
    freezes_delta = int(data.get('streak_freezes', 0))
    
    users = read_csv(USERS_CSV)
    
    updated_user = None
    for u in users:
        if str(u['id']) == user_id:
            # Update values
            u['diamonds'] = str(max(0, int(u.get('diamonds', 0)) + diamonds_delta))
            u['streak_freezes'] = str(max(0, int(u.get('streak_freezes', 0)) + freezes_delta))
            updated_user = u
            break
            
    if not updated_user:
        return jsonify({'error': 'User not found'}), 404
        
    write_csv(USERS_CSV, ['id', 'username', 'name', 'avatar', 'bio', 'diamonds', 'streak_freezes'], users)
    return jsonify(updated_user)

# API: Get habits for user (including dynamic streaks)
@app.route('/api/habits/<user_id>')
def get_habits(user_id):
    habits = read_csv(HABITS_CSV)
    completions = read_csv(COMPLETIONS_CSV)
    
    user_habits = [h for h in habits if str(h['user_id']) == str(user_id)]
    
    # Compute dynamic streaks for each habit
    for h in user_habits:
        h['streak'] = calculate_streak(completions, h['id'])
        # Update milestone if streak is higher
        try:
            milestone = int(h['streak_milestone'])
            current_streak = int(h['streak'])
            if current_streak > milestone:
                h['streak_milestone'] = current_streak
        except ValueError:
            pass
            
    # Save back updated milestones to habits.csv
    updated_habits = []
    for h_all in habits:
        for h_user in user_habits:
            if str(h_all['id']) == str(h_user['id']):
                h_all['streak'] = h_user['streak']
                h_all['streak_milestone'] = h_user['streak_milestone']
        updated_habits.append(h_all)
        
    write_csv(HABITS_CSV, ['id', 'user_id', 'name', 'category', 'time_of_day', 'frequency', 'streak', 'streak_milestone'], updated_habits)
    
    return jsonify(user_habits)

# API: Get completion records for a user
@app.route('/api/completions/<user_id>')
def get_completions(user_id):
    completions = read_csv(COMPLETIONS_CSV)
    user_completions = [c for c in completions if str(c['user_id']) == str(user_id)]
    return jsonify(user_completions)

# API: Toggle Habit Completion
@app.route('/api/toggle', methods=['POST'])
def toggle_habit():
    data = request.json
    user_id = str(data.get('user_id'))
    habit_id = str(data.get('habit_id'))
    date = str(data.get('date')) # YYYY-MM-DD
    
    completions = read_csv(COMPLETIONS_CSV)
    
    # Enforce only editing today's completions (2026-06-16)
    today_str = "2026-06-16"
    if date != today_str:
        return jsonify({'error': "You can only edit today's completions!"}), 400
    
    # Check if already exists
    existing = None
    for c in completions:
        if str(c['user_id']) == user_id and str(c['habit_id']) == habit_id and c['date'] == date:
            existing = c
            break
            
    if existing:
        # Toggle: Remove or set status
        if existing['status'] == 'Completed':
            completions.remove(existing)
            status = 'Pending'
        else:
            existing['status'] = 'Completed'
            status = 'Completed'
    else:
        # Add completion
        completions.append({
            'user_id': user_id,
            'habit_id': habit_id,
            'date': date,
            'status': 'Completed'
        })
        status = 'Completed'
        
    write_csv(COMPLETIONS_CSV, ['user_id', 'habit_id', 'date', 'status'], completions)
    
    # Recalculate streak
    new_streak = calculate_streak(completions, habit_id)
    
    # Update streak in habits
    habits = read_csv(HABITS_CSV)
    for h in habits:
        if str(h['id']) == habit_id:
            h['streak'] = str(new_streak)
            if new_streak > int(h['streak_milestone']):
                h['streak_milestone'] = str(new_streak)
            break
            
    write_csv(HABITS_CSV, ['id', 'user_id', 'name', 'category', 'time_of_day', 'frequency', 'streak', 'streak_milestone'], habits)
    
    return jsonify({
        'status': status,
        'streak': new_streak,
        'habit_id': habit_id
    })

# API: Add Habit
@app.route('/api/habits/add', methods=['POST'])
def add_habit():
    data = request.json
    user_id = str(data.get('user_id'))
    name = str(data.get('name')).strip()
    category = str(data.get('category')).strip()
    time_of_day = str(data.get('time_of_day')) # Morning/Afternoon/Evening
    
    if not name or not category:
        return jsonify({'error': 'Name and Category are required'}), 400
        
    habits = read_csv(HABITS_CSV)
    
    # Auto increment ID
    new_id = 1
    if habits:
        new_id = max(int(h['id']) for h in habits) + 1
        
    new_habit = {
        'id': str(new_id),
        'user_id': user_id,
        'name': name,
        'category': category,
        'time_of_day': time_of_day,
        'frequency': 'Daily',
        'streak': '0',
        'streak_milestone': '0'
    }
    
    habits.append(new_habit)
    write_csv(HABITS_CSV, ['id', 'user_id', 'name', 'category', 'time_of_day', 'frequency', 'streak', 'streak_milestone'], habits)
    
    return jsonify(new_habit)

# API: Delete Habit
@app.route('/api/habits/delete', methods=['POST'])
def delete_habit():
    data = request.json
    habit_id = str(data.get('habit_id'))
    
    # Remove from habits.csv
    habits = read_csv(HABITS_CSV)
    habits = [h for h in habits if str(h['id']) != habit_id]
    write_csv(HABITS_CSV, ['id', 'user_id', 'name', 'category', 'time_of_day', 'frequency', 'streak', 'streak_milestone'], habits)
    
    # Remove from completions.csv
    completions = read_csv(COMPLETIONS_CSV)
    completions = [c for c in completions if str(c['habit_id']) != habit_id]
    write_csv(COMPLETIONS_CSV, ['user_id', 'habit_id', 'date', 'status'], completions)
    
    return jsonify({'success': True})

# API: Get Challenges
@app.route('/api/challenges')
def get_challenges():
    challenges = read_csv(CHALLENGES_CSV)
    return jsonify(challenges)

# API: Get User Challenges
@app.route('/api/challenges/user/<user_id>')
def get_user_challenges(user_id):
    joins = read_csv(USER_CHALLENGES_CSV)
    joined_ids = [str(j['challenge_id']) for j in joins if str(j['user_id']) == str(user_id)]
    return jsonify(joined_ids)

# API: Toggle Join/Leave Challenge
@app.route('/api/challenges/toggle', methods=['POST'])
def toggle_challenge():
    data = request.json
    user_id = str(data.get('user_id'))
    challenge_id = str(data.get('challenge_id'))
    
    joins = read_csv(USER_CHALLENGES_CSV)
    
    # Check if already joined
    joined = False
    existing = None
    for j in joins:
        if str(j['user_id']) == user_id and str(j['challenge_id']) == challenge_id:
            existing = j
            break
            
    challenges = read_csv(CHALLENGES_CSV)
    
    if existing:
        # Leave
        joins.remove(existing)
        # Decrement challenge participants
        for ch in challenges:
            if str(ch['id']) == challenge_id:
                try:
                    ch['participants_count'] = str(max(0, int(ch['participants_count']) - 1))
                except ValueError:
                    pass
        joined = False
    else:
        # Join
        joins.append({
            'user_id': user_id,
            'challenge_id': challenge_id
        })
        # Increment challenge participants
        for ch in challenges:
            if str(ch['id']) == challenge_id:
                try:
                    ch['participants_count'] = str(int(ch['participants_count']) + 1)
                except ValueError:
                    pass
        joined = True
        
    write_csv(USER_CHALLENGES_CSV, ['user_id', 'challenge_id'], joins)
    write_csv(CHALLENGES_CSV, ['id', 'title', 'description', 'participants_count', 'duration', 'category', 'active'], challenges)
    
    return jsonify({
        'joined': joined,
        'challenge_id': challenge_id,
        'participants_count': [ch['participants_count'] for ch in challenges if str(ch['id']) == challenge_id][0]
    })

# API: Get Leaderboard for Challenges
@app.route('/api/leaderboard')
def get_leaderboard():
    users = read_csv(USERS_CSV)
    completions = read_csv(COMPLETIONS_CSV)
    
    # Calculate total completions for each user
    leaderboard = []
    for u in users:
        user_comps = [c for c in completions if str(c['user_id']) == str(u['id'])]
        leaderboard.append({
            'username': u['username'],
            'name': u['name'],
            'avatar': u['avatar'],
            'completions_count': len(user_comps)
        })
        
    # Sort by completions count descending
    leaderboard = sorted(leaderboard, key=lambda x: x['completions_count'], reverse=True)
    return jsonify(leaderboard)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
