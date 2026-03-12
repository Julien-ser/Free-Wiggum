#!/bin/bash

# 1. Environment & Dependency Check
if ! command -v opencode &> /dev/null; then
    echo "❌ opencode-ai is not installed! Run: npm i -g opencode-ai"
    exit 1
fi

if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
else
    echo "❌ .env file not found! Ensure OPENROUTER_API_KEY is set."
    exit 1
fi

# 2. Project Initialization (The OpenCode Way)
# Ensures AGENTS.md exists so the AI has project context
if [ ! -f "AGENTS.md" ]; then
    echo "🔍 AGENTS.md not found. Running opencode /init..."
    opencode /init --yes
fi

# 3. Backup & Iteration Setup
[ ! -f TASKS_original.md ] && cp TASKS.md TASKS_original.md

# Create logs directory if it doesn't exist
mkdir -p logs

iteration=$(ls logs/iteration-*.md 2>/dev/null | sed 's/.*iteration-//;s/.md//' | sort -n | tail -1)
iteration=${iteration:-0}

# Token counter for 64k limit
total_tokens=0
TOKEN_LIMIT=64000

echo "🚀 Starting OpenCode Autonomous Task Loop..."

while true; do
    iteration=$((iteration + 1))
    echo "📍 Iteration $iteration..."
    
    # 4. Extract Next Task
    next_task=$(grep -m1 '^\- \[ \]' TASKS.md | sed 's/^- \[ \] //')
    
    if [ -z "$next_task" ]; then
        echo "🎉 No more tasks found in TASKS.md. Mission Accomplished!"
        break
    fi

    # 5. Build the Dynamic Prompt
    # Include prompt.txt for system instructions, plus AGENTS.md and TASKS.md context
    dynamic_prompt=$(cat <<'PROMPT'
$(cat prompt.txt)

---

### ⚠️ CRITICAL TOKEN CONSTRAINTS:
- Iteration: $iteration / 64k Token Budget
- **Mandate:** Operate efficiently. Use partial edits, not full file rewrites when possible.
- **If context feels large:** Use '/compact' internally or break into smaller steps.
- **Output:** No unnecessary verbose output. Be concise and action-oriented.

## CURRENT PROJECT STATE (Iteration $iteration)

Context: @AGENTS.md

```
$(cat TASKS.md)
```

## NEXT TASK TO COMPLETE:
$next_task

**Instructions:** Complete this task. Mark [x] in TASKS.md when done. No permission needed—just act.
PROMPT
)
    
    # 6. Save Iteration Log (formatted markdown)
    LOG_FILE="logs/iteration-${iteration}.md"
    {
        echo "# Iteration $iteration"
        echo ""
        echo "**Timestamp:** $(date)"
        echo ""
        echo "**Task:** $next_task"
        echo ""
        echo "## Prompt Sent"
        echo ""
        echo '```'
        echo "$dynamic_prompt"
        echo '```'
        echo ""
        echo "## OpenCode Output"
        echo ""
        echo '```'
    } > "$LOG_FILE"

    # 7. Execution (Using OpenRouter Free Models)
    # Uses model specified in .env (WIGGUM_MODEL)
    echo "🤖 OpenCode is processing: $next_task"
    
    # Run OpenCode with the message and capture output to log and terminal
    opencode run \
             --model "${WIGGUM_MODEL:-openrouter/google/gemini-2.0-flash-exp:free}" \
             "$dynamic_prompt" 2>&1 | tee -a "$LOG_FILE"

    # Close the code block in the log file
    {
        echo '```'
        echo ""
        echo "## TASKS.md After Iteration"
        echo ""
        echo '```markdown'
        cat TASKS.md
        echo '```'
    } >> "$LOG_FILE"

    echo "📝 Iteration log saved to: $LOG_FILE"

    # 8. Active Token Management (Pre-emptive)
    # Check log size and warn if approaching 64k token limit (~100KB ≈ 25-30k tokens)
    LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || stat -f%z "$LOG_FILE" 2>/dev/null)
    LOG_SIZE_KB=$((LOG_SIZE / 1024))
    
    if [ "$LOG_SIZE" -gt 102400 ]; then
        echo "⚠️  CONTEXT BLOAT DETECTED! Log size: ${LOG_SIZE_KB}KB (≈ 25-30k tokens)"
        echo "🔄 Adding compaction mandate to next iteration..."
        total_tokens=$((total_tokens + 30000))
    else
        # Estimate tokens (rough: 1000 tokens ≈ 750 words)
        iteration_words=$(wc -w < "$LOG_FILE")
        iteration_tokens=$((iteration_words * 4 / 3))
        total_tokens=$((total_tokens + iteration_tokens))
    fi
    
    if [ $total_tokens -gt $TOKEN_LIMIT ]; then
        echo "⚠️  Token limit ($TOKEN_LIMIT) reached! Total tokens: $total_tokens"
        echo "🔄 Resetting token counter for next iteration cycle..."
        total_tokens=0
    fi
    
    echo "📊 Log Size: ${LOG_SIZE_KB}KB | Cumulative Tokens: $total_tokens / $TOKEN_LIMIT"

    # 9. Error Handling (Context Length Exceeded)
    if grep -q "context_length_exceeded\|Context.*exceed\|too.*long\|token.*limit" "$LOG_FILE" 2>/dev/null; then
        echo "🚨 CONTEXT LENGTH ERROR DETECTED!"
        echo "⛔ OpenRouter returned context limit exceeded error."
        echo "🔄 Forcing fresh iteration with compaction..."
        total_tokens=0
    fi

    # 10. Safety Sleep & Loop Control
    if grep -q '\[x\].*MISSION ACCOMPLISHED' TASKS.md; then
        echo "✅ Final task reached. Loop exiting."
        break
    fi
    
    sleep 3
done

# 11. Post-Completion: GitHub Push & Summary
echo ""
echo "=========================================="
echo "🎉 AUTONOMOUS BUILD COMPLETE!"
echo "=========================================="
echo ""

# Count completed tasks
completed=$(grep -c '^\- \[x\]' TASKS.md)
total=$(grep -c '^\- \[' TASKS.md)
echo "✅ Tasks Completed: $completed / $total"
echo "📊 Total Iterations: $iteration"
echo "📈 Final Token Count: $total_tokens / $TOKEN_LIMIT"
echo ""

# Git operations
echo "📦 Pushing to GitHub..."
if [ -d .git ]; then
    git add -A
    git commit -m "🤖 Autonomous build complete - all tasks finished via OpenCode iterations" 2>/dev/null
    
    if git push origin main 2>/dev/null || git push origin master 2>/dev/null; then
        echo "✅ Code pushed to GitHub"
    else
        echo "⚠️  Git push failed (remote may not be configured)"
    fi
else
    echo "⚠️  Not a git repository. Skipping push."
fi

echo ""
echo "=========================================="
echo "📝 Build Artifacts:"
echo "  - Build Logs: logs/iteration-*.md"
echo "  - Task Tracking: TASKS.md"
echo "  - Agent Context: AGENTS.md"
echo ""
echo "🚀 Project is ready!"
echo "=========================================="
echo ""