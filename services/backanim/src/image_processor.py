import logging
from PIL import Image
import json
from pathlib import Path
import subprocess


class ImageProcessor:
    @staticmethod
    def _get_logger():
        """Get or create a logger for ImageProcessor."""
        logger = logging.getLogger("ImageProcessor")
        if not logger.handlers:  # Only add handler if none exists
            # Setup logging directory
            script_dir = Path(__file__).resolve().parent
            log_dir = script_dir.parent / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)

            # Configure handler
            handler = logging.FileHandler(str(log_dir / "image_processor.log"))
            handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                )
            )
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
        return logger

    @staticmethod
    def get_display_resolution() -> tuple[int, int]:
        """Get the main display resolution using system_profiler."""
        logger = ImageProcessor._get_logger()
        try:
            # First try using NSScreen through osascript
            cmd = [
                "osascript",
                "-e",
                'tell application "Finder" to get bounds of window of desktop',
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 0:
                # Parse "0, 0, width, height"
                bounds = result.stdout.strip().split(", ")
                if len(bounds) == 4:
                    width, height = int(bounds[2]), int(bounds[3])
                    logger.info(f"Got display resolution from Finder: {width}x{height}")
                    return width, height

            # Fallback to system_profiler
            cmd = ["system_profiler", "SPDisplaysDataType", "-json"]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            data = json.loads(result.stdout)

            # Get the resolution of the main display
            displays = data.get("SPDisplaysDataType", [{}])[0].get(
                "spdisplays_ndrvs", [{}]
            )
            if displays:
                resolution = displays[0].get("_spdisplays_resolution", "")
                if resolution:
                    # Handle different resolution string formats
                    # Format 1: "1117 @ 120.00Hz" -> extract first number
                    # Format 2: "2560 x 1600" -> extract both numbers
                    parts = resolution.split("@")[0].strip().split("x")
                    if len(parts) == 2:
                        width, height = map(lambda x: int(x.strip()), parts)
                        logger.info(
                            f"Got display resolution from system_profiler: {width}x{height}"
                        )
                        return width, height
                    else:
                        # Try to find any numbers in the string
                        import re

                        numbers = re.findall(r"\d+", resolution)
                        if len(numbers) >= 2:
                            width, height = int(numbers[0]), int(numbers[1])
                            logger.info(
                                f"Got display resolution from regex: {width}x{height}"
                            )
                            return width, height

            # If all else fails, try getting resolution through NSWorkspace
            cmd = [
                "osascript",
                "-e",
                """
                tell application "System Events"
                    tell process "Finder"
                        tell window 1
                            get size
                        end tell
                    end tell
                end tell
            """,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if result.returncode == 0:
                width, height = map(int, result.stdout.strip().split(", "))
                logger.info(
                    f"Got display resolution from System Events: {width}x{height}"
                )
                return width, height

            # Final fallback to a common high resolution
            logger.warning("Using fallback resolution 2560x1600")
            return (2560, 1600)
        except Exception as e:
            logger.error(f"Error getting display resolution: {e}")
            # Fallback to a common high resolution
            return (2560, 1600)

    @staticmethod
    def enhance_image(input_path: str) -> str:
        """Process the image to match display resolution while maintaining aspect ratio."""
        logger = ImageProcessor._get_logger()
        try:
            img = Image.open(input_path)

            # Get the display resolution
            target_width, target_height = ImageProcessor.get_display_resolution()
            logger.info(
                f"Processing image for display resolution: {target_width}x{target_height}"
            )

            # Convert to grayscale
            img = img.convert("L")

            # Calculate the scaling factors for both dimensions
            width_scale = target_width / img.width
            height_scale = target_height / img.height

            # Use the larger scaling factor to ensure the image covers the screen
            # while maintaining aspect ratio
            scale_factor = max(width_scale, height_scale)

            # Calculate new dimensions
            new_width = int(img.width * scale_factor)
            new_height = int(img.height * scale_factor)

            # Resize the image using Lanczos
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            # Create a new black background image of the target resolution
            background = Image.new("L", (target_width, target_height), 0)  # 0 = black

            # Calculate position to paste the resized image (centering both horizontally and vertically)
            paste_x = (target_width - new_width) // 2
            paste_y = (target_height - new_height) // 2

            # Paste the resized image onto the background
            background.paste(img, (paste_x, paste_y))
            img = background

            # Save with high quality
            output_path = str(Path(input_path).with_suffix("")) + "_enhanced.png"
            img.save(output_path, "PNG", quality=100, optimize=False)
            logger.info(f"Enhanced image saved to: {output_path}")

            return output_path
        except Exception as e:
            logger.error(f"Error enhancing image: {e}")
            return input_path  # Return original path if enhancement fails
