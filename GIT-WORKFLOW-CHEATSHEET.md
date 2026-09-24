# Working with Claude Code (on the web) — Git Workflow Cheatsheet

## The big picture

```
 Your PC (VS Code)            GitHub (the "remote")             Claude's cloud session
 ─────────────────            ─────────────────────             ──────────────────────
   main  ── git push ──────▶   main  ──── clones ────────────▶   works on its own branch
                                                                 e.g. claude/some-task-name
                              claude/some-task-name  ◀── push ──
                                   │
                         Pull Request (PR) → Merge
                                   ▼
   main  ◀── git pull ───────  main  (now includes Claude's work)
```

- **`main`** is your real, official copy of the game.
- **A branch** is a separate copy where changes can be made safely without touching `main`.
- Claude **never** changes `main` directly. It pushes its work to a `claude/...` branch.
- **A Pull Request (PR)** is a request to merge a branch into `main`. Nothing changes until you click **Merge**.
- Your **local** code in VS Code only changes when you **pull**.

---

## 1. Before starting a Claude session

Make sure Claude can see your latest work. It clones from GitHub, not from your PC.

```bash
git status                 # anything unsaved / uncommitted?
git add .
git commit -m "Describe what you changed"
git push origin main
```

> Tip: tell Claude which branch your latest work is on if it's not `main`.

---

## 2. When Claude has finished

Claude will say it has **committed and pushed** to a branch like `claude/previous-conversations-31p40i`.

On GitHub you'll see a yellow banner: **"… had recent pushes"** with a **Compare & pull request** button.

### Option A — Try it locally first (recommended)

```bash
git fetch origin
git checkout claude/<branch-name>
npm run dev                # play-test the changes
```

Go back to your own code at any time:

```bash
git checkout main
```

> Commit or stash your own unsaved changes before switching branches (see *Troubleshooting*).

### Option B — Merge it into `main`

1. On GitHub click **Compare & pull request**.
   - Check: **base: `main`** ← **compare: `claude/<branch-name>`**
   - Click **Create pull request**.
2. (Optional) Look at the **Files changed** tab to review the code.
3. Click **Merge pull request** → **Confirm merge**.
4. (Optional) Click **Delete branch** — safe, the work is now in `main`.
5. Bring it down to your PC:

```bash
git checkout main
git pull origin main
```

VS Code now shows all the new code. ✅

---

## 3. Everyday Git commands

| What you want to do                    | Command                                   |
|----------------------------------------|-------------------------------------------|
| See what's changed / which branch      | `git status`                              |
| See recent commits                     | `git log --oneline -10`                   |
| List branches (local and remote)       | `git branch -a`                           |
| Get latest info from GitHub            | `git fetch origin`                        |
| Switch branch                          | `git checkout <branch-name>`              |
| Update current branch from GitHub      | `git pull origin <branch-name>`           |
| Save your work                         | `git add .` then `git commit -m "msg"`    |
| Upload your work                       | `git push origin <branch-name>`           |
| Temporarily shelve unsaved changes     | `git stash`                               |
| Bring shelved changes back             | `git stash pop`                           |

In VS Code, the **Source Control** panel (branch icon on the left) and the branch name in the
**bottom-left corner** do most of these with clicks.

---

## 4. Troubleshooting

**"Checking for the ability to merge automatically…" spinner never finishes**
→ Just refresh the page (F5). It's usually a display glitch.

**`git checkout` / `git pull` refuses: "Your local changes would be overwritten"**
→ You have unsaved local edits. Either commit them, or:
```bash
git stash          # shelve them
git pull origin main
git stash pop      # bring them back
```

**The PR says "This branch has conflicts that must be resolved"**
→ You and Claude edited the same lines. Easiest fix: ask Claude
*"Please merge main into your branch and resolve the conflicts"* — then refresh the PR.

**VS Code still shows old code after merging**
→ You haven't pulled yet: `git checkout main` then `git pull origin main`.

**Merged something by mistake**
→ On the merged PR page, GitHub offers a **Revert** button, which creates a new PR that undoes it.

---

## 5. Quick-reference flow

```
push your work → start Claude session → Claude pushes to claude/… branch
      → (optional) checkout branch & test → Create PR → Merge
      → git checkout main → git pull origin main → carry on coding
```
