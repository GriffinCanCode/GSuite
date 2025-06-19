import logging
from datetime import (
    datetime,
    timedelta,
)
from pathlib import Path


class LogCleaner:
    def __init__(
        self, log_dir: str = None, max_age_days: int = 7, max_size_mb: int = 100
    ):
        """Initialize the log cleaner.

        Args:
            log_dir: Directory containing log files. If None, uses the logs directory in the project root
            max_age_days: Maximum age of log files in days before deletion
            max_size_mb: Maximum size of log files in MB before rotation
        """
        if log_dir is None:
            script_dir = Path(__file__).resolve().parent
            self.log_dir = script_dir.parent / "logs"
        else:
            self.log_dir = Path(log_dir)

        # Ensure logs directory exists
        self.log_dir.mkdir(parents=True, exist_ok=True)

        self.max_age = timedelta(days=max_age_days)
        self.max_size = max_size_mb * 1024 * 1024  # Convert MB to bytes

        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            filename=str(
                self.log_dir / "log_cleaner.log"
            ),  # Add dedicated log file for the cleaner
        )
        self.logger = logging.getLogger("LogCleaner")

    def clean_logs(self) -> None:
        """Clean old log files and rotate large ones."""
        try:
            current_time = datetime.now()

            # Get all .log files in the directory
            log_files = list(self.log_dir.glob("*.log"))
            rotated_logs = list(self.log_dir.glob("*.log.*"))

            # Process main log files
            for log_file in log_files:
                try:
                    # Check file age
                    mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                    age = current_time - mtime

                    # Check file size
                    size = log_file.stat().st_size

                    if size > self.max_size:
                        self._rotate_log(log_file)

                except Exception as e:
                    self.logger.error(f"Error processing log file {log_file}: {e}")

            # Clean up old rotated logs
            for log_file in rotated_logs:
                try:
                    mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                    age = current_time - mtime

                    if age > self.max_age:
                        log_file.unlink()
                        self.logger.info(f"Deleted old rotated log: {log_file}")

                except Exception as e:
                    self.logger.error(f"Error cleaning rotated log {log_file}: {e}")

        except Exception as e:
            self.logger.error(f"Error during log cleaning: {e}")

    def _rotate_log(self, log_file: Path) -> None:
        """Rotate a log file by creating a timestamped backup."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{log_file}.{timestamp}"

            # Rename current log to backup
            log_file.rename(backup_name)

            # Create new empty log file
            log_file.touch()

            self.logger.info(f"Rotated {log_file} to {backup_name}")

        except Exception as e:
            self.logger.error(f"Error rotating log file {log_file}: {e}")
