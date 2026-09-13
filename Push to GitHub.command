#!/bin/bash
# Push to GitHub — double-click this.
#
# Claude works on this repo through a sandboxed Linux VM that has the folder
# mounted but none of your credentials: no Keychain, no SSH key, no token. So it
# can commit, but it can never push. This script runs in YOUR shell, where the
# macOS Keychain is available, and does the one step Claude cannot.
#
# Vercel deploys from the push, so there is nothing else to do afterwards.

cd "$(dirname "$0")" || exit 1
printf '\n\033[1mOOTP Command Center — push to GitHub\033[0m\n\n'

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repository: $(pwd)"; read -r -p "Press return to close."; exit 1
fi

git fetch origin --quiet 2>/dev/null
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)

if [ "$AHEAD" = "0" ]; then
  echo "Nothing to push — origin/main is already up to date."
  read -r -p "Press return to close."; exit 0
fi

echo "$AHEAD commit(s) to push:"
echo
git --no-pager log --oneline origin/main..HEAD | sed 's/^/   /'
echo

if [ "$BEHIND" != "0" ] && [ "$BEHIND" != "?" ]; then
  echo "Note: origin/main has $BEHIND commit(s) you don't have. Pulling first."
  git pull --rebase origin main || { echo; echo "Pull failed — resolve by hand, then run this again."; read -r -p "Press return to close."; exit 1; }
  echo
fi

read -r -p "Push to origin/main? [y/N] " ok
case "$ok" in
  y|Y|yes|YES) ;;
  *) echo "Cancelled."; read -r -p "Press return to close."; exit 0 ;;
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
echo
read -r -p "Press return to close."
