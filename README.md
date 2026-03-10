

# 🕵️‍♂️ Free Wiggum: The Autonomous Agent Loop
Free Wiggum is a lightweight, recursive bash-driven agent. It uses [Aider](https://aider.chat) to force an LLM to work through a task list by checking progress and looping until a specific "Mission Accomplished" state is met.
## 🛠 Prerequisites- **Python 3.12** (Mandatory: Aider is not yet compatible with Python 3.13+)- **OpenRouter API Key** (For access to free/low-cost models)- **Linux/macOS** (Bash environment)
## 🚀 Quick Start Setup### 1. Create the EnvironmentSince many systems now default to Python 3.13, you must explicitly target **3.12**:

```bash
# Install Python 3.12 if you don't have it
sudo apt update && sudo apt install python3.12 python3.12-venv -y

# Create and activate the venv
python3.12 -m venv venv_wiggum
source venv_wiggum/bin/activate

# Install Aider
pip install aider-chat
```

2. Configure Your Keys
Add your API key to your environment variables:

export OPENROUTER_API_KEY="your_openrouter_key_here"

3. Create the Core Files
You need three files in your project folder for Wiggum to function:
A. TASKS.md (The Memory)
The agent uses this to track its own state.
Important: It must include the exact completion string for the script to stop.

# Current Tasks- [ ] Task 1: [Your instruction here]
- [ ] Task 2: [Your instruction here]
- [ ] [ ] MISSION ACCOMPLISHED

B. prompt.txt (The Logic)
This is the system instruction sent to the agent on every loop.

"Act as a senior engineer. Read TASKS.md. Perform the next incomplete task. If you use the browser, save findings to a new file. Use the WHOLE edit format to update files. If all tasks are done, check the box: [x] MISSION ACCOMPLISHED."

C. wiggum.sh (The Engine)
The bash script that drives the loop.
4. Launch

chmod +x wiggum.sh
./wiggum.sh

📉 Choosing a Model
To avoid the "yapping" loop (where the model talks but doesn't code), use models with high instruction-following capabilities.
Recommended Free/Cheap Models:

* openrouter/google/gemini-2.0-flash-exp:free (Best performance)
* openrouter/qwen/qwen3-next-80b-a3b-instruct (Good for logic)
* openrouter/arcee-ai/trinity-mini (Good for agents)

⚠️ Known Issues

* Python 3.13: Aider will crash on startup. Use a 3.12 venv.
* Login Walls: Models will often hang on login screens. Instruct the agent in prompt.txt to skip these.


