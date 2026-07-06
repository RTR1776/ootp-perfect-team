# OOTP Export Watcher (Shareable)
#
# Quick setup for anyone using this script:
# 1) Edit USER_WATCH_DIR and USER_STORAGE_DIR below.
# 2) Run: Rscript watchootpexport_portable.R
# 3) Enter tournament label once at startup.
# 4) Enter numeric tournament ID each time an export is detected.

suppressPackageStartupMessages(library(fs))

# ==========================================================
# USER SETTINGS (EDIT THESE 2 LINES)
# ==========================================================
# Folder that contains: online_data/statistics_player_statistics_-_sortable_stats_export.csv
USER_WATCH_DIR <- "<EDIT_ME_OOTP_FOLDER_PATH>"

# Folder where renamed exports should be saved
USER_STORAGE_DIR <- "<EDIT_ME_OUTPUT_FOLDER_PATH>"

# Usually no need to change:
USER_TARGET_FILE <- "online_data/statistics_player_statistics_-_sortable_stats_export.csv"
USER_CHECK_INTERVAL <- 5

validate_user_value <- function(value, field_name) {
  v <- trimws(value)
  if (!nzchar(v) || grepl("^<EDIT_ME", v)) {
    stop(
      field_name,
      " is not configured. Edit the USER SETTINGS block near the top of this file."
    )
  }
}

prompt_tourney_label <- function() {
  repeat {
    label <- trimws(readline(
      prompt = "Enter a label for this tournament batch (e.g., 'Silver', 'Diamond', etc.): "
    ))
    if (nzchar(label)) return(label)
    cat("Tournament label is required.\n")
  }
}

prompt_tourney_id <- function() {
  repeat {
    id <- trimws(readline(prompt = "Enter numeric tourney ID: "))
    if (grepl("^[0-9]+$", id)) return(id)
    cat("ID must contain numbers only.\n")
  }
}

watch_dir <- path_expand(USER_WATCH_DIR)
storage_dir <- path_expand(USER_STORAGE_DIR)
target_file <- USER_TARGET_FILE
check_interval <- suppressWarnings(as.numeric(USER_CHECK_INTERVAL))

validate_user_value(watch_dir, "Watch folder")
validate_user_value(storage_dir, "Storage folder")

if (!dir_exists(watch_dir)) {
  stop("Watch folder does not exist: ", watch_dir)
}
if (!dir_exists(storage_dir)) {
  dir_create(storage_dir, recurse = TRUE)
}
if (is.na(check_interval) || check_interval <= 0) {
  stop("USER_CHECK_INTERVAL must be a positive number. Got: ", USER_CHECK_INTERVAL)
}

cat("Startup: tournament label is required before watcher begins.\n")
tourney_label <- prompt_tourney_label()
target_path <- path(watch_dir, target_file)

cat("\nConfiguration\n")
cat("- OS detected:    ", Sys.info()[["sysname"]], "\n")
cat("- Watch folder:   ", watch_dir, "\n")
cat("- Target file:    ", target_file, "\n")
cat("- Storage folder: ", storage_dir, "\n")
cat("- Label:          ", tourney_label, "\n")
cat("- Interval (sec): ", check_interval, "\n\n")

cat("Watcher started. Press Ctrl+C to stop.\n\n")

seen_destinations <- character()

while (TRUE) {
  if (file_exists(target_path)) {
    tourney_id <- prompt_tourney_id()
    new_file_name <- paste0(tourney_label, "_", tourney_id, "_tourn_export.csv")
    new_path <- path(storage_dir, new_file_name)

    if (new_path %in% seen_destinations) {
      cat("Already handled this destination in current session:", new_file_name, "\n")
    } else {
      if (file_exists(new_path)) {
        overwrite <- tolower(trimws(readline(
          prompt = paste0("File already exists (", new_file_name, "). Overwrite? [y/N]: ")
        )))
        if (!overwrite %in% c("y", "yes")) {
          cat("Skipped move; waiting for next export event.\n")
          Sys.sleep(check_interval)
          next
        }
        file_delete(new_path)
      }

      file_move(target_path, new_path)
      seen_destinations <- c(seen_destinations, new_path)
      cat("Moved export to:", new_path, "\n")
    }
  }

  Sys.sleep(check_interval)
}
