# OOTP Watcher Launcher (Beginner Friendly)
#
# WHAT THIS FILE DOES
# - Starts the watcher script: watchootpexport_portable.R
# - That watcher will then ask for:
#   1) Tournament label (once)
#   2) Tournament ID (each time an export file appears)
#
# WHERE TO PUT THESE FILES
# - Put BOTH files in the SAME folder:
#   1) run_watchootpexport.R
#   2) watchootpexport_portable.R
# - Recommended: create a folder named "OOTP Export Tool" in your Documents folder.
# - Do not rename watchootpexport_portable.R unless you also update this launcher.
#
# BEFORE FIRST RUN (one-time setup)
# 1) Install R: https://cran.r-project.org/
# 2) Install RStudio Desktop: https://posit.co/download/rstudio-desktop/
# 3) Open watchootpexport_portable.R and edit these 2 lines:
#    - USER_WATCH_DIR: the folder where OOTP exports the stats CSV file (usually inside your OOTP save folder)
#    - USER_STORAGE_DIR: the folder where you want renamed export files to be saved (can be anywhere)
#    - make sure the OOTP view is called Export
# 4) In RStudio Console, install package fs once:
#    install.packages("fs")
#
# IN OOTP
# - get the exact view from CWhit
# - make sure the view is saved as Export

# HOW TO RUN IN RSTUDIO (for first-time users)
# 1) Open RStudio.
# 2) File -> Open File... -> choose this file: run_watchootpexport.R
# 3) In the script editor, click "Source" (top-right of editor),
#    or run this in Console:
#    source("/FULL/PATH/TO/run_watchootpexport.R")
# 4) type in the tournament label (from tournament spreadsheet) when prompted in Console, then press Enter.
# 5) Keep Console open while watcher runs.
# 6) enter tourney ID in Console each time an export is detected in the watch folder, then press Enter.
#     for quicks, it's the quick ID: for dailies, it's the last 3 digits of the tourney ID (no leading 0s needed)
# 6) Stop watcher with Esc in Console (or Session -> Interrupt R).
#
# HOW TO RUN FROM TERMINAL (optional)
# Rscript "/FULL/PATH/TO/run_watchootpexport.R"

# --- helper to find this launcher's folder reliably ---
get_script_dir <- function() {
  # Works for: Rscript run_watchootpexport.R
  cmd_args <- commandArgs(trailingOnly = FALSE)
  file_arg <- "--file="
  idx <- grep(file_arg, cmd_args)
  if (length(idx) > 0) {
    return(dirname(normalizePath(sub(file_arg, "", cmd_args[idx[1]]), mustWork = TRUE)))
  }

  # Works for: source("/path/run_watchootpexport.R")
  if (!is.null(sys.frames()[[1]]$ofile)) {
    return(dirname(normalizePath(sys.frames()[[1]]$ofile, mustWork = TRUE)))
  }

  # RStudio fallback: active document path
  if (requireNamespace("rstudioapi", quietly = TRUE)) {
    ctx <- tryCatch(rstudioapi::getActiveDocumentContext(), error = function(e) NULL)
    if (!is.null(ctx) && nzchar(ctx$path)) {
      return(dirname(normalizePath(ctx$path, mustWork = TRUE)))
    }
  }

  # Last resort: current working directory
  normalizePath(getwd(), mustWork = TRUE)
}

script_dir <- get_script_dir()
watcher_path <- file.path(script_dir, "watchootpexport_portable.R")

if (!file.exists(watcher_path)) {
  stop(
    "Could not find watchootpexport_portable.R next to this launcher.\n",
    "Expected path: ", watcher_path, "\n",
    "Put BOTH files in the same folder and try again:\n",
    "  - run_watchootpexport.R\n",
    "  - watchootpexport_portable.R"
  )
}

cat("Starting watcher from:\n", watcher_path, "\n\n", sep = "")

# This is the source line you asked to include:
source(watcher_path)
