

# 🕵️‍♂️ Free Wiggum: Zero-Cost Autonomous Agent Loop

Run autonomous AI task loops **completely free.** No subscriptions. No API bills. No infrastructure costs.

While CrewAI, AutoGPT, and Claude API cost **$200-500+/month**, Free Wiggum uses [Aider](https://aider.chat) with OpenRouter's free models to build, test, and deploy autonomous agents on your own machine for **$0**.

This is a lightweight, recursive bash-driven agent that uses free LLM access to work through task lists methodically and loop until completion.

## 🛠 Prerequisites

- **Python 3.12** (Mandatory: Aider is not yet compatible with Python 3.13+)
- **OpenRouter API Key** (Free tier available at [openrouter.ai](https://openrouter.ai))
- **Linux/macOS/Windows with bash** (Git Bash on Windows works fine)

## 💰 Cost Comparison

| Tool | Monthly Cost | Setup | Model Quality |
|------|-------------|-------|---------------|
| **Free Wiggum** | **$0** | 5 minutes | Excellent (Gemini, Qwen, Step) |
| Claude API | $20-600+ | Easy | Excellent |
| CrewAI + GPT-4 | $400+ | Medium | Excellent |
| AutoGPT | $200+ | Complex | Good |
| AWS SageMaker Agents | $500+ | Hard | Good |

**Free Wiggum uses OpenRouter's free tier**, which provides legitimate, powerful models:
- **Google Gemini 2.0 Flash** (best overall)
- **Qwen 3** (excellent for reasoning)
- **Step 3.5 Flash** (reliable and lightweight)

1000 agent iterations = **$0.00**. Same iterations on Claude API = **$300+**.
## 🚀 Quick Start

### 1. Create the Virtual Environment

Since many systems now default to Python 3.13, you must explicitly target **3.12**:

```bash
# Create and activate the venv
python3.12 -m venv venv_wiggum
source venv_wiggum/bin/activate

# Install Aider
pip install aider-chat
```

**On Windows (PowerShell):**
```powershell
python3.12 -m venv venv_wiggum
.\venv_wiggum\Scripts\activate
pip install aider-chat
```

### 2. Configure Your API Key

Add your OpenRouter API key to a `.env` file in the project directory:

```
OPENROUTER_API_KEY=your_openrouter_key_here
```

The script will load this automatically at startup.

### 3. Create the Core Files

You need three files in your project folder for Wiggum to function:

**A. TASKS.md** (The Memory)

This tracks the agent's own state. The agent reads this, completes one task at a time, and marks it as done `[x]`.

```markdown
# Current Tasks

- [ ] Task 1: Your instruction here
- [ ] Task 2: Your instruction here  
- [ ] Task 3: Your instruction here
- [ ] MISSION ACCOMPLISHED
```

**Important:** The script stops when it finds `[x] MISSION ACCOMPLISHED`. Until the agent marks this, the loop continues.

**B. prompt.txt** (The Logic)

This is the system instruction sent to the agent on every iteration. It defines the agent's behavior and tells it what to do.

**C. wiggum.sh** (The Engine)

The bash script that drives the loop. See [prompt.txt.sample](prompt.txt.sample) and [TASKS.md.sample](TASKS.md.sample) for examples.

### 4. Launch

```bash
chmod +x wiggum.sh
./wiggum.sh
```

## 📍 How It Works

1. **Initialization**: Activates the Python virtual environment and loads the `.env` file
2. **Backup**: Creates a backup of TASKS.md before starting (TASKS_original.md)
3. **Iteration Loop**:
   - Finds the highest numbered `prompt-*.md` file to resume from the correct iteration
   - Extracts the FIRST incomplete task (marked with `- [ ]`) from TASKS.md
   - Builds a dynamic prompt that includes:
     - Your base instruction from `prompt.txt`
     - The current TASKS.md contents
     - The NEXT task to complete
   - Saves this prompt to `prompt-{iteration}.md` for your records
   - Runs Aider with the specified OpenRouter model
   - Verifies that TASKS.md was updated (checks for newly completed tasks)
   - Checks if `[x] MISSION ACCOMPLISHED` exists
4. **Completion**: When the goal is reached, summarizes the results and exits

## 🎯 Choosing a Model

The script defaults to `openrouter/stepfun/step-3.5-flash:free`. You can change this in `wiggum.sh` at the line with `--model`.

To avoid the "yapping" loop (where the model talks but doesn't code), use models with high instruction-following and action-taking capabilities.

**Recommended Free/Cheap Models:**

- `openrouter/google/gemini-2.0-flash-exp:free` - Best overall performance
- `openrouter/qwen/qwen-3-next-80b-a3b-instruct` - Good for complex logic
- `openrouter/arcee-ai/trinity-mini` - Good for agent tasks
- `openrouter/stepfun/step-3.5-flash:free` - Lightweight and reliable

## 🔍 Debugging

**Iteration Logs**: Each run creates `prompt-{iteration}.md` files showing the exact prompt sent to the model. These are helpful for understanding why a task failed.

**Status Check**: The script prints the number of completed tasks at the end. If it shows `0 / N`, the agent didn't complete anything—check the iteration logs.

**Error Log**: If Aider crashes, errors are saved to `ERROR_LOG.txt`.

## ⚠️ Known Issues

- **Python 3.13**: Aider will crash on startup. Use Python 3.12 only.
- **Login Walls**: Models often hang on login screens. Use `prompt.txt` to instruct the agent to skip authentication.
- **Stuck Loops**: If no tasks complete, the script warns you. Check `prompt-*.md` logs to see what the model received.
- **Windows**: Use Git Bash or WSL. PowerShell may have compatibility issues with the bash script.


