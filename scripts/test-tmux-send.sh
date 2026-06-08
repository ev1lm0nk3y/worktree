#!/usr/bin/env bash
# Tests old vs new prompt-sending behavior using Node.js execSync,
# replicating exactly what the CLI code does.
#
# Run from any directory. Requires tmux and node.

SESSION="wt-send-test-$$"

cleanup() {
  tmux kill-session -t "$SESSION" 2>/dev/null || true
}
trap cleanup EXIT

echo "Creating tmux session with two panes..."
tmux new-session -d -s "$SESSION" -n test "cat"
tmux split-window -h -t "$SESSION:test" "cat"
sleep 0.5

PANE_OLD=$(tmux list-panes -t "$SESSION:test" -F "#{pane_id}" | head -1)
PANE_NEW=$(tmux list-panes -t "$SESSION:test" -F "#{pane_id}" | tail -1)
echo "OLD pane: $PANE_OLD  |  NEW pane: $PANE_NEW"

node - "$PANE_OLD" "$PANE_NEW" <<'NODESCRIPT'
const { execSync } = require('child_process');

const paneOld = process.argv[2];
const paneNew = process.argv[3];

// Prompt that matches real worker prompts: backticks, newlines
const prompt =
`You are Worker 2 of 3 Claude workers on issue #42.

WAITING STATE:
- Do NOT start working yet.
- You must wait for Worker 1 to create \`WORKTREE_WORKER_2.md\`.
- Once \`WORKTREE_WORKER_2.md\` exists, read it.
- Report progress inside \`WORKTREE_WORKER_2.md\`.`;

// ── OLD: double-quoted interpolation through /bin/sh (exactly as runCommand) ──
console.log('\n=== OLD: execSync with double-quoted send-keys ===');
const oldCmd = `tmux send-keys -t "${paneOld}" "${prompt}" Enter`;
try {
  execSync(oldCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  console.log('execSync: OK (no throw)');
} catch (e) {
  console.log('execSync: THREW ->', e.message.split('\n')[0]);
}

// ── NEW: load-buffer via stdin + paste-buffer + send Enter ─────────────────
console.log('\n=== NEW: load-buffer (stdin) + paste-buffer + send-keys Enter ===');
try {
  execSync('tmux load-buffer -', { input: prompt, encoding: 'utf8' });
  execSync(`tmux paste-buffer -t "${paneNew}"`, { encoding: 'utf8' });
  execSync(`tmux send-keys -t "${paneNew}" Enter`, { encoding: 'utf8' });
  console.log('execSync: OK (no throw)');
} catch (e) {
  console.log('execSync: THREW ->', e.message.split('\n')[0]);
}

// ── Capture and compare ────────────────────────────────────────────────────
setTimeout(() => {
  const captureOld = execSync(`tmux capture-pane -t "${paneOld}" -p`, { encoding: 'utf8' }).trim();
  const captureNew = execSync(`tmux capture-pane -t "${paneNew}" -p`, { encoding: 'utf8' }).trim();

  const NEEDLE = '`WORKTREE_WORKER_2.md`';
  const oldOk = captureOld.includes(NEEDLE);
  const newOk = captureNew.includes(NEEDLE);

  console.log('\n=== OLD pane output ===');
  console.log(captureOld);
  console.log('\n=== NEW pane output ===');
  console.log(captureNew);

  console.log('\n=== RESULT ===');
  console.log(`OLD path backticks preserved: ${oldOk ? 'YES' : 'NO  <-- CORRUPTED'}`);
  console.log(`NEW path backticks preserved: ${newOk ? 'YES' : 'NO  <-- CORRUPTED'}`);

  if (!oldOk && newOk) {
    console.log('\nCONFIRMED: old path corrupts prompt; new path is correct.');
    process.exit(0);
  } else if (oldOk && newOk) {
    console.log('\nBoth paths preserved backticks on this run (shell may have been lenient).');
    console.log('New path is still safer — it never invokes shell on prompt content.');
    process.exit(0);
  } else {
    console.log('\nUnexpected result — review captured output above.');
    process.exit(1);
  }
}, 600);
NODESCRIPT
