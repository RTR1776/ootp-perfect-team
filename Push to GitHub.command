#!/bin/bash
# Push to GitHub — double-click this. It syncs both ways.
#
# 1. Data this Mac produced — League Data/, Tourney Data/, web/src/data/
#    (the filer's recalibration, the dump loader's lines), reference/ — is
#    committed, after you say yes, so it goes up with the sync. Only those
#    folders go into that commit; other local edits stay on this Mac.
# 2. What Claude merged on GitHub comes down. Any other local edits are set
#    aside first and put back afterwards (git's autostash), so they no longer
#    stop the pull with "unstaged changes".
# 3. Your commits go up, after you say yes. Vercel deploys from the push.
#
# When a local edit and a change on GitHub touch the same file, putting the
# edit back can fail and leave the file half-merged, which then blocks every
# commit and pull. The script checks for that before and after the pull,
# keeps GitHub's copy, and saves this Mac's version in _sync-conflicts/.
#
# Claude's cloud sessions work on GitHub directly and cannot reach this Mac,
# so this script is how their changes arrive here and how this Mac's data
# reaches them. Run it after Claude says something was merged, and before
# asking Claude to use data you exported here.

cd "$(dirname "$0")" || exit 1
printf '\n\033[1mOOTP Command Center — sync with GitHub\033[0m\n\n'
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }

git rev-parse --git-dir >/dev/null 2>&1 || { echo "Not a git repository: $(pwd)"; close 1; }
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "This folder is on branch '$BRANCH', not main. Switch with:  git checkout main"
  close 1
fi

# Half-merged files: keep GitHub's copy, save this Mac's version first.
resolve_unmerged() {
  local files dest f
  files=$(git -c core.quotePath=false diff --name-only --diff-filter=U)
  [ -z "$files" ] && return 0
  echo "These files are half-merged (this Mac changed them and so did GitHub):"
  echo "$files" | sed 's/^/   /'
  echo
  read -r -p "Keep GitHub's copy and save this Mac's version in _sync-conflicts/? [Y/n] " ok
  case "$ok" in
    n|N|no|NO) echo "Left as they are. Nothing can be committed or pulled until they are resolved."; close 1 ;;
  esac
  dest="_sync-conflicts/$(date +%Y-%m-%d_%H%M%S)"
  git reset -q   # clears the half-merge; other local edits stay, unstaged
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if git cat-file -e "HEAD:$f" 2>/dev/null; then
      if [ -e "$f" ] && ! git diff --quiet HEAD -- "$f"; then
        mkdir -p "$dest/$(dirname "$f")" && cp -p "$f" "$dest/$f"
      fi
      git checkout -q HEAD -- "$f"
    elif [ -e "$f" ]; then
      mkdir -p "$dest/$(dirname "$f")" && mv "$f" "$dest/$f"
    fi
  done <<< "$files"
  if [ -d "$dest" ]; then echo "Done. GitHub's copy kept; this Mac's version is in $dest"
  else echo "Done. GitHub's copy kept (this Mac had deleted or moved them, so there was nothing to save)."; fi
  echo
}

resolve_unmerged

# 1. data first, so it rides along with this sync
DATA=()
for p in "League Data" "Tourney Data" "web/src/data" "reference"; do [ -e "$p" ] && DATA+=("$p"); done
CHANGED=""
[ ${#DATA[@]} -gt 0 ] && CHANGED=$(git status --porcelain -- "${DATA[@]}" 2>/dev/null)
if [ -n "$CHANGED" ]; then
  echo "Data on this Mac that GitHub does not have yet:"
  echo "$CHANGED" | sed 's/^/   /'
  echo
  read -r -p "Commit it so it goes up with this sync? [Y/n] " ok
  case "$ok" in
    n|N|no|NO) echo "Left as it is." ;;
    *) if git add -- "${DATA[@]}" && git commit -q -m "Data from the Mac, $(date +%Y-%m-%d)" -- "${DATA[@]}"; then
         echo "Committed."
       else
         echo "Could not commit it (see above). Carrying on with the pull; nothing is lost."
       fi ;;
  esac
  echo
fi

# 2. down
echo "Checking GitHub…"
if ! git fetch origin --quiet; then echo "Could not reach GitHub."; close 1; fi
BEHIND=$(git rev-list --count HEAD..origin/main)
if [ "$BEHIND" != "0" ]; then
  echo "GitHub has $BEHIND new commit(s):"
  git --no-pager log --oneline HEAD..origin/main | sed 's/^/   /'
  echo
  if ! git pull --rebase --autostash origin main; then
    echo
    if [ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ]; then
      echo "The pull stopped part-way. To put everything back as it was:  git rebase --abort"
    else
      echo "The pull did not run, so nothing changed."
    fi
    echo "Tell Claude what it said above. Nothing is lost."
    close 1
  fi
  printf '\033[32mPulled.\033[0m\n'
  echo
  resolve_unmerged   # the autostash can conflict even when the pull succeeds
fi

# 3. up
AHEAD=$(git rev-list --count origin/main..HEAD)
if [ "$AHEAD" = "0" ]; then
  echo
  echo "Up to date with GitHub."
  close 0
fi
echo
echo "$AHEAD commit(s) of yours to push:"
echo
git --no-pager log --oneline origin/main..HEAD | sed 's/^/   /'
echo
read -r -p "Push to origin/main? [y/N] " ok
case "$ok" in
  y|Y|yes|YES) ;;
  *) echo "Not pushed."; close 0 ;;
esac

echo
if git push origin main; then
  printf '\n\033[32mPushed.\033[0m Vercel builds from this automatically —\n'
  echo "ootp-command-center.vercel.app will be live in a minute or two."
else
  printf '\n\033[31mPush failed.\033[0m\n'
  echo "If it asked for a username and password: GitHub stopped accepting passwords."
  echo "Run this once to store a credential in your Keychain, then try again:"
  echo
  echo "    git config --global credential.helper osxkeychain"
  echo
  echo "The next push will prompt for your GitHub username and a Personal Access"
  echo "Token (github.com > Settings > Developer settings > Tokens), and remember it."
fi
close 0
