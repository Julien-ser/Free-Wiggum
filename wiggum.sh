#!/bin/bash
# Activate the virtual environment
# Update the path below if your venv is named differently or in a different location
if [ -f venv_wiggum/bin/activate ]; then
    source venv_wiggum/bin/activate
elif [ -f venv/bin/activate ]; then
    source venv/bin/activate
else
    echo "❌ Virtual environment not found! Please create one:"
    echo "   python3.12 -m venv venv_wiggum && source venv_wiggum/bin/activate && pip install aider-chat"
    exit 1
fi

# Load environment variables from .env
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
else
    echo "❌ .env file not found! Create .env with OPENROUTER_API_KEY"
    exit 1
fi

# Preserve original TASKS.md
if [ ! -f TASKS_original.md ]; then
    cp TASKS.md TASKS_original.md
    echo "📝 Backed up original TASKS.md → TASKS_original.md"
fi

echo "🚀 Starting True Wiggum Loop (Python 3.12 compatibility mode)..."

# Find the highest numbered prompt file and resume from next iteration
iteration=0
if ls prompt-*.md 1> /dev/null 2>&1; then
    highest=$(ls -1 prompt-*.md | sed 's/prompt-//;s/.md//' | sort -n | tail -1)
    iteration=$highest
    echo "📖 Found prompt-${iteration}.md, resuming from iteration $((iteration + 1))..."
fi

iteration=$((iteration + 1))
while true; do
    iteration=$((iteration + 1))
    echo "📍 Iteration $iteration..."
    
    # Extract the next uncompleted task from TASKS.md
    next_task=$(grep -m1 '^\- \[ \]' TASKS.md | sed 's/^- \[ \] //')
    
    # Build dynamic prompt with current context
    dynamic_prompt=$(cat <<PROMPT
$(cat prompt.txt)

---

## CURRENT PROJECT STATE (Iteration $iteration)

\`\`\`
$(cat TASKS.md)
\`\`\`

## NEXT TASK TO COMPLETE:
$next_task

**Instructions:** Complete this task. When done, mark it as [x] in TASKS.md. Execute code, create files, run commands as needed. Do not ask for permission—just act.
PROMPT
)
    
    # Save prompt to iteration log file
    echo "$dynamic_prompt" > "prompt-${iteration}.md"
    echo "📄 Iteration $iteration prompt saved to prompt-${iteration}.md"
    
    # Run aider with refreshed context and error handling
    echo "🤖 Running aider iteration $iteration with OpenRouter..."
    if ! aider --model openrouter/stepfun/step-3.5-flash:free \
               --message "$dynamic_prompt" \
               --yes-always; then
        echo "⚠️  Aider failed on iteration $iteration"
        echo "Saving error state and continuing..."
        echo "Error on iteration $iteration" >> ERROR_LOG.txt
        sleep 5
    else
        echo "✅ Aider iteration $iteration completed successfully"
    fi

    # Verify TASKS.md was actually updated
    echo \"📋 Verifying TASKS.md updates...\"
    newly_completed=$(grep -c '^- \[x\]' TASKS.md)
    echo \"   Tasks marked complete: $newly_completed\"
    
    # Check if mission is accomplished
    if grep -q '\[x\].*MISSION ACCOMPLISHED' TASKS.md; then
        echo \"🎉 Mission Accomplished!\"
        break
    fi
    
    # Check if no tasks were completed this iteration (detect stuck state)
    if [ $iteration -gt 2 ] && [ $newly_completed -eq 0 ]; then
        echo \"⚠️  WARNING: No tasks completed. Check iteration logs.\"
    fi
    
    sleep 2
done

echo ""
echo "════════════════════════════════════════"
echo "📊 WIGGUM LOOP EXECUTION SUMMARY"
echo "════════════════════════════════════════"
echo "Total iterations: $iteration"
echo ""

# Count completed vs total tasks
completed=$(grep -c '^- \[x\]' TASKS.md)
total=$(grep -c '^- \[' TASKS.md)
echo "🎯 Tasks Completed: $completed / $total"

if [ "$completed" -eq 0 ]; then
    echo ""
    echo "⚠️  WARNING: No tasks were completed!"
    echo "Check the iteration logs (prompt-*.md) to see what happened."
fi

if [ -f ERROR_LOG.txt ]; then
    echo ""
    echo "⚠️  Errors encountered:"
    cat ERROR_LOG.txt
fi

echo ""
echo "📝 Iteration logs: prompt-*.md"
echo "✅ Task file: TASKS.md"
echo ""
