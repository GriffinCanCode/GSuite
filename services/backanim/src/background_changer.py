#!/Users/griffinstrier/custom/.venv/bin/python

import logging
import os
from datetime import datetime
from image_generator import ImageGenerator
import json
from log_cleaner import LogCleaner
from pathlib import Path
import requests
import subprocess
import time
from typing import (
    Any,
    Dict,
    Optional,
)


class BackgroundChanger:
    def __init__(self, config_path: str = None):
        if config_path is None:
            # Get the directory where the script is located
            script_dir = Path(__file__).resolve().parent
            config_path = script_dir.parent / "config" / "config.json"
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.weather_cache: Dict[str, Any] = {}
        self.weather_cache_time = 0
        self.weather_cache_duration = 1800  # 30 minutes
        self.image_generator = ImageGenerator(str(self.config_path))

        # Setup logging directory
        self.log_dir = Path(script_dir).parent / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Configure logging for background changer
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler(str(self.log_dir / "background_changer.log")),
                logging.StreamHandler(),  # Also log to console
            ],
        )
        self.logger = logging.getLogger("BackgroundChanger")

        # Initialize log cleaner with explicit log directory
        self.log_cleaner = LogCleaner(str(self.log_dir))

    def _load_config(self) -> dict:
        """Load configuration from JSON file."""
        try:
            with open(self.config_path) as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "weather_api_key": "",
                "stability_api_key": "",
                "location": "San Francisco,US",
                "use_ai_generation": True,
                "backgrounds": {
                    "morning": "../resources/morning.jpg",
                    "afternoon": "../resources/afternoon.jpg",
                    "evening": "../resources/evening.jpg",
                    "night": "../resources/night.jpg",
                    "rainy": "../resources/rainy.jpg",
                    "sunny": "../resources/sunny.jpg",
                    "cloudy": "../resources/cloudy.jpg",
                },
            }

    def get_time_of_day(self) -> str:
        """Determine the time of day."""
        hour = datetime.now().hour
        if 5 <= hour < 12:
            return "morning"
        elif 12 <= hour < 17:
            return "afternoon"
        elif 17 <= hour < 21:
            return "evening"
        else:
            return "night"

    def get_weather(self) -> Optional[str]:
        """Fetch current weather conditions."""
        if not self.config.get("weather_api_key"):
            print("No Weather API key found in config.")
            return None

        current_time = time.time()
        if current_time - self.weather_cache_time < self.weather_cache_duration:
            return self.weather_cache.get("condition")

        try:
            url = "http://api.openweathermap.org/data/2.5/weather"
            params = {
                "q": self.config["location"],
                "appid": self.config["weather_api_key"],
                "units": "metric",
            }
            response = requests.get(url, params=params)
            response.raise_for_status()  # Raise an exception for bad status codes
            data = response.json()

            if "weather" not in data or not data["weather"]:
                print(f"Unexpected weather API response: {data}")
                return None

            weather_main = data["weather"][0]["main"].lower()
            self.weather_cache = {"condition": weather_main}
            self.weather_cache_time = current_time

            if "rain" in weather_main or "drizzle" in weather_main:
                return "rainy"
            elif "clear" in weather_main:
                return "sunny"
            elif "cloud" in weather_main:
                return "cloudy"
            return None
        except requests.exceptions.RequestException as e:
            print(f"Error fetching weather: {e}")
            print(
                f"Response: {e.response.text if hasattr(e, 'response') else 'No response'}"
            )
            return None
        except Exception as e:
            print(f"Error processing weather data: {e}")
            return None

    def set_desktop_background(self, image_path: str) -> None:
        """Set the desktop background using osascript."""
        abs_path = os.path.abspath(image_path)
        script = f"""
        tell application "System Events"
            tell every desktop
                set picture to "{abs_path}"
            end tell
        end tell
        """
        subprocess.run(["osascript", "-e", script], check=True)

    def update_background(self) -> None:
        """Update the desktop background based on time and weather."""
        # Clean logs before updating background
        self.log_cleaner.clean_logs()

        weather_condition = self.get_weather()
        time_of_day = self.get_time_of_day()

        # Determine which condition to use for the background
        # Temporarily use time_of_day while weather API key is being activated
        condition = time_of_day

        # Try to generate a new background if AI generation is enabled
        if self.config.get("use_ai_generation", True):
            self.logger.info(f"Generating background for condition: {condition}")
            generated_path = self.image_generator.generate_background(condition)
            if generated_path:
                try:
                    self.logger.info(f"Setting background to: {generated_path}")
                    self.set_desktop_background(generated_path)
                    return
                except subprocess.CalledProcessError as e:
                    self.logger.error(f"Error setting generated background: {e}")

        # Fall back to pre-existing backgrounds if generation fails or is disabled
        background = self.config["backgrounds"][condition]
        try:
            self.logger.info(f"Falling back to default background: {background}")
            self.set_desktop_background(background)
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Error setting background: {e}")


def main() -> None:
    changer = BackgroundChanger()
    changer.update_background()


if __name__ == "__main__":
    main()
