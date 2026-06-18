import os
import csv
import asyncio
import dotenv
from google.antigravity import Agent, LocalAgentConfig

# Load environment variables
dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

USERS_CSV = os.path.join(DATA_DIR, 'users.csv')
HABITS_CSV = os.path.join(DATA_DIR, 'habits.csv')
COMPLETIONS_CSV = os.path.join(DATA_DIR, 'completions.csv')
CHALLENGES_CSV = os.path.join(DATA_DIR, 'challenges.csv')
USER_CHALLENGES_CSV = os.path.join(DATA_DIR, 'user_challenges.csv')

# Helper CSV functions
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

# Google Antigravity SDK Tools for the Agent
def agent_read_csv(file_name: str) -> list:
    """Reads rows from a local CSV data file.
    
    Args:
        file_name: The name of the CSV file to read. Valid options are:
                   'users.csv' (user progress/currency info),
                   'habits.csv' (habit details, categories, schedules),
                   'completions.csv' (completions history and dates),
                   'challenges.csv' (predefined challenges),
                   'user_challenges.csv' (claims and completions of challenges by users).
    """
    valid_files = {
        'users.csv': USERS_CSV,
        'habits.csv': HABITS_CSV,
        'completions.csv': COMPLETIONS_CSV,
        'challenges.csv': CHALLENGES_CSV,
        'user_challenges.csv': USER_CHALLENGES_CSV
    }
    if file_name not in valid_files:
        raise ValueError(f"Invalid file_name: {file_name}. Must be one of {list(valid_files.keys())}")
    
    return read_csv(valid_files[file_name])

def agent_write_csv(file_name: str, fieldnames: list, rows: list) -> str:
    """Writes rows to a local CSV data file.
    
    Args:
        file_name: The name of the CSV file to write. Valid options are:
                   'users.csv' (user progress/currency info),
                   'habits.csv' (habit details, categories, schedules),
                   'completions.csv' (completions history and dates),
                   'challenges.csv' (predefined challenges),
                   'user_challenges.csv' (claims and completions of challenges by users).
        fieldnames: The list of column header strings.
        rows: The list of dictionaries containing row data to write.
    """
    valid_files = {
        'users.csv': USERS_CSV,
        'habits.csv': HABITS_CSV,
        'completions.csv': COMPLETIONS_CSV,
        'challenges.csv': CHALLENGES_CSV,
        'user_challenges.csv': USER_CHALLENGES_CSV
    }
    if file_name not in valid_files:
        raise ValueError(f"Invalid file_name: {file_name}. Must be one of {list(valid_files.keys())}")
    
    write_csv(valid_files[file_name], fieldnames, rows)
    return f"Successfully wrote {len(rows)} rows to {file_name}."

# MindsetCoach System Instructions
COACH_SYSTEM_INSTRUCTIONS = """
You are 'MindsetCoach', an empathetic productivity partner and mindset mentor. Your goal is to help the user build healthy habits, stay consistent, and maintain a positive attitude toward self-improvement.

Guidelines:
1. Speak with warmth, encouragement, and understanding. Never be judgmental. Celebrate small wins!
2. If the user misses a habit, help them brainstorm why it happened and how they can adapt (e.g., scale it down, adjust the time, or set a reminder), rather than making them feel guilty.
3. You have direct function-calling access to the local CSV database files. When the user asks about their habits, completions, challenges, or user information, use `agent_read_csv` to inspect their actual data!
4. If the user wants to add, update, delete, or complete habits/challenges, you can read the data, make the necessary modifications, and use `agent_write_csv` to update their profile! (Make sure to write the updated lists back with the correct column header keys).
5. Always keep your advice practical, actionable, and structured. Use formatting (bullet points, bold text) to make it highly readable.
"""

async def chat_with_coach(user_id: str, message: str) -> str:
    # Check if API Key exists
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "ERROR_MISSING_API_KEY"
        
    save_dir = os.path.join(DATA_DIR, 'coach_sessions')
    os.makedirs(save_dir, exist_ok=True)
    
    config = LocalAgentConfig(
        api_key=api_key,
        conversation_id=f"user_{user_id}",
        save_dir=save_dir,
        system_instructions=COACH_SYSTEM_INSTRUCTIONS,
        tools=[agent_read_csv, agent_write_csv]
    )
    
    async with Agent(config) as agent:
        response = await agent.chat(message)
        return await response.text()

def ask_coach(user_id: str, message: str) -> str:
    """Synchronous entrypoint for Flask views."""
    import threading
    
    class AsyncRunnerThread(threading.Thread):
        def __init__(self, target, args):
            super().__init__()
            self.target = target
            self.args = args
            self.result = None
            
        def run(self):
            # Create a clean event loop inside the thread to execute async SDK code
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                self.result = loop.run_until_complete(self.target(*self.args))
            finally:
                loop.close()
                
    runner = AsyncRunnerThread(chat_with_coach, (user_id, message))
    runner.start()
    runner.join()
    return runner.result
