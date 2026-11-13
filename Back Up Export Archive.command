#!/bin/bash
# Back Up Export Archive — double-click this. Run it again whenever you have filed new exports.
#
# Archive/ is the one copy of every tournament export, and it is never pushed to
# GitHub. The database is rebuilt from it, so a damaged or half-deleted archive
# would shrink the database to match. This copies it somewhere else.
#
# - The first run asks where (an external drive or iCloud Drive is best: a
#   different disk from this Mac). It remembers the answer.
# - It only ADDS files. A file already in the backup is never overwritten and
#   nothing is ever deleted from the backup, so a damaged archive cannot damage it.
# - It finishes by listing any file whose size no longer matches its backup copy.

cd "$(dirname "$0")" || exit 1
printf '\n\033[1mBack up the export archive\033[0m\n\n'
close() { [ -n "$OOTP_NO_PAUSE" ] && exit "${1:-0}"; echo; read -r -p "Press return to close."; exit "${1:-0}"; }

SRC="Archive"
[ -d "$SRC" ] || { echo "No Archive folder here ($(pwd))."; close 1; }

REMEMBER="$HOME/.ootp-archive-backup-destination"
PARENT=""
[ -f "$REMEMBER" ] && PARENT="$(cat "$REMEMBER")"
if [ -n "$PARENT" ] && [ ! -d "$PARENT" ]; then
  echo "The backup folder used last time is not there now:"
  echo "   $PARENT"
  echo "If it is on an external drive, plug it in and run this again. Otherwise pick another place now."
  echo
  PARENT=""
fi
if [ -z "$PARENT" ]; then
  PARENT="$(osascript -e 'POSIX path of (choose folder with prompt "Where should the export archive be backed up? An external drive or iCloud Drive is best: a different disk from this Mac.")' 2>/dev/null)"
  [ -z "$PARENT" ] && read -r -p "Folder to back up into (drag it onto this window, then press return): " PARENT
  PARENT="${PARENT%/}"
  [ -d "$PARENT" ] || { echo "No such folder: $PARENT"; close 1; }
  printf '%s\n' "$PARENT" > "$REMEMBER"
fi
PARENT="${PARENT%/}"
DEST="$PARENT/OOTP Perfect Team Archive"

HERE="$(pwd -P)"
case "$(cd "$PARENT" && pwd -P)/" in
  "$HERE"/*) echo "That folder is inside this project. Pick somewhere else: delete $REMEMBER and run this again."; close 1 ;;
esac
mkdir -p "$DEST" || { echo "Could not create $DEST"; close 1; }

count() { find "$1" -type f ! -name ".DS_Store" 2>/dev/null | wc -l | tr -d ' '; }
before=$(count "$DEST")
echo "Copying new files to:"
echo "   $DEST"
# -n: never overwrite a file the backup already has. "/." copies the folder's contents.
cp -Rpn "$SRC/." "$DEST/" 2>/dev/null
src=$(count "$SRC"); after=$(count "$DEST")

changed=0; missing=0
while IFS= read -r -d '' f; do
  rel="${f#"$SRC"/}"; b="$DEST/$rel"
  if [ ! -f "$b" ]; then missing=$((missing + 1)); continue; fi
  if [ "$(wc -c < "$f" | tr -d ' ')" != "$(wc -c < "$b" | tr -d ' ')" ]; then
    changed=$((changed + 1))
    [ "$changed" -eq 1 ] && { echo; echo "A different size from the backup copy (the backup kept its own):"; }
    [ "$changed" -le 20 ] && echo "   $rel"
  fi
done < <(find "$SRC" -type f ! -name ".DS_Store" -print0)

echo
echo "Archive: $src files. Backup: $after files ($((after - before)) new this run), $(du -sh "$DEST" 2>/dev/null | cut -f1)."
if [ "$missing" -gt 0 ]; then
  printf '\033[31m%s file(s) did not copy.\033[0m Is the backup disk full or read-only?\n' "$missing"
  close 1
fi
[ "$changed" -gt 20 ] && echo "   ...and $((changed - 20)) more."
if [ "$changed" -gt 0 ]; then
  echo "$changed file(s) changed after they were backed up. If the archive's copy is the right one, tell Claude."
else
  printf '\033[32mEvery archive file is in the backup.\033[0m\n'
fi
if [ "$(df -P "$SRC" | tail -1 | awk '{print $1}')" = "$(df -P "$DEST" | tail -1 | awk '{print $1}')" ]; then
  echo
  echo "Note: the backup is on the same disk as the archive. That covers a deleted or damaged"
  echo "file, not a dead disk. To move it: delete $REMEMBER and run this again."
fi
close 0
