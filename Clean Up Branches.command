#!/bin/bash
# Clean Up Branches — double-click once, after PR 202 is merged and Push to GitHub.command has pulled it.
#
# Step 2 of Docs/GitHub Cleanup Plan 2026-11-22 (Claude).md. A cloud session can push only to its own
# branch, so the branch cleanup runs here, where git can push anywhere.
#
# It reads Docs/Branch Cleanup 2026-11-22.tsv (one line a branch: "tag" or "-", the branch, its last
# commit), the same 75 branches as Docs/Branch Restore List 2026-11-22.md, and:
#   1. tags the 30 marked "tag" as archive/<name>, keeping commits no merged PR carried;
#   2. deletes all 75 from GitHub, each only if it still ends at the commit on the list.
#      A branch that has moved since 11-22 is left alone and named.
# main and claude/elegant-cannon-nu9vrr (PR 202) are not on the list.
# Safe to run twice: done tags and deleted branches are skipped.

cd "$(dirname "$0")" || exit 1
close() { echo; read -r -p "Press return to close."; exit "${1:-0}"; }
LIST="Docs/Branch Cleanup 2026-11-22.tsv"
printf '\n\033[1mClean up GitHub branches\033[0m\n\n'
[ -f "$LIST" ] || { echo "Can't find $LIST. Run Push to GitHub.command first (PR 202 must be merged)."; close 1; }

echo "Fetching every branch from GitHub…"
git fetch origin --prune --quiet || { echo "git fetch failed."; close 1; }

total=$(grep -c . "$LIST"); tags=$(grep -c '^tag' "$LIST")
echo "$total branches to delete, $tags of them archived as tags first (archive/<name>)."
echo "The restore list is Docs/Branch Restore List 2026-11-22.md."
read -r -p "Go ahead? (y/n) " ok
[ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "Nothing changed."; close 0; }

tagged=0; deleted=0; moved=0; gone=0; failed=0
while IFS=$'\t' read -r mark branch sha; do
  [ -n "$branch" ] || continue
  name="${branch#claude/}"
  now="$(git rev-parse -q --verify "refs/remotes/origin/$branch" 2>/dev/null)"
  if [ -z "$now" ]; then gone=$((gone + 1)); continue; fi
  if [ "$now" != "$sha" ]; then echo "  left alone, it has moved since 11-22: $branch"; moved=$((moved + 1)); continue; fi
  if [ "$mark" = "tag" ]; then
    if git ls-remote --exit-code --tags origin "refs/tags/archive/$name" >/dev/null 2>&1 </dev/null; then :
    elif git push --quiet origin "$sha:refs/tags/archive/$name" </dev/null; then tagged=$((tagged + 1))
    else echo "  tag failed, branch kept: $branch"; failed=$((failed + 1)); continue; fi
  fi
  if git push --quiet --force-with-lease="refs/heads/$branch:$sha" origin ":refs/heads/$branch" </dev/null; then deleted=$((deleted + 1))
  else echo "  delete failed: $branch"; failed=$((failed + 1)); fi
done < "$LIST"

git fetch origin --prune --quiet
echo
echo "Tagged $tagged, deleted $deleted, already gone $gone, moved $moved, failed $failed."
echo "Branches left on GitHub:"; git branch -r | grep -v HEAD | sed 's/^/  /'
[ "$failed" -eq 0 ] || close 1
close 0
