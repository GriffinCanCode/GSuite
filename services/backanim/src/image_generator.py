import logging
import base64
from image_processor import ImageProcessor
import json
from pathlib import Path
import requests
import time
from typing import Optional


class ImageGenerator:
    def __init__(self, config_path: str = None):
        if config_path is None:
            # Get the directory where the script is located
            script_dir = Path(__file__).resolve().parent
            config_path = script_dir.parent / "config" / "config.json"
        self.config_path = Path(config_path)
        self.config = self._load_config()

        # Setup logging
        self.log_dir = Path(self.config_path).parent / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Configure logging
        self.logger = logging.getLogger("ImageGenerator")
        if not self.logger.handlers:  # Only add handler if none exists
            handler = logging.FileHandler(str(self.log_dir / "image_generator.log"))
            handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                )
            )
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def _load_config(self) -> dict:
        """Load configuration from JSON file."""
        try:
            with open(self.config_path) as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "stability_api_key": "",
                "image_settings": {
                    "morning": "black and white psychedelic mandala sunrise, fractal mountains dissolving into geometric patterns, M.C. Escher style impossible geometry, zen meets cyberpunk",
                    "afternoon": "black and white urban kaleidoscope, infinite recursive cityscapes, tessellated architecture morphing into abstract patterns, inspired by brutalist architecture and optical illusions",
                    "evening": "surreal black and white twilight dreamscape, melting clock towers, infinite spiral staircases to nowhere, inspired by Salvador Dali and gothic architecture",
                    "night": "cosmic black and white fractal explosion, interstellar mandala patterns, hypnotic spiral galaxies, inspired by deep space photography and sacred geometry",
                    "rainy": "abstract black and white liquid fractals, hypnotic rain patterns forming impossible shapes, water droplets creating infinite recursive patterns, inspired by microscopic photography",
                    "sunny": "psychedelic black and white nature fractals, trees morphing into sacred geometry, light rays creating impossible mathematical patterns, inspired by Alex Grey and botanical illustrations",
                    "cloudy": "ethereal black and white cloud fractals, storm systems forming mandala patterns, atmospheric vortex streets, inspired by fluid dynamics and abstract expressionism",
                },
                "generation_settings": {
                    "base_prompt_suffix": "",
                    "text_settings": "",
                    "negative_prompt": "multiple colors, rainbow, blur, noise, grain, low quality, soft, watermark, signature, blurry, deformed, smooth, gray, washed out, busy edges, asymmetric, hidden text, small text, unreadable text, text at edges, disconnected text, scattered colors, color bleeding",
                },
            }

    def generate_background(self, condition: str) -> Optional[str]:
        """Generate a black and white background image for the given condition."""
        if not self.config.get("stability_api_key"):
            print("No Stability API key found in config.")
            return None

        prompt = self.config["image_settings"].get(condition)
        if not prompt:
            print(f"No prompt found for condition: {condition}")
            return None

        try:
            # Get display resolution first
            target_width, target_height = ImageProcessor.get_display_resolution()
            print(
                f"Generating image for display resolution: {target_width}x{target_height}"
            )

            # Calculate the generation dimensions to match display aspect ratio
            aspect_ratio = target_width / target_height

            # SDXL allowed dimensions (width, height)
            allowed_dimensions = [
                (1024, 1024),
                (1152, 896),
                (1216, 832),
                (1344, 768),
                (1536, 640),
                (640, 1536),
                (768, 1344),
                (832, 1216),
                (896, 1152),
            ]

            # Find the best matching dimensions
            best_diff = float("inf")
            gen_width = 1024
            gen_height = 1024

            for w, h in allowed_dimensions:
                dim_ratio = w / h
                ratio_diff = abs(aspect_ratio - dim_ratio)
                if ratio_diff < best_diff:
                    best_diff = ratio_diff
                    gen_width = w
                    gen_height = h

            # If we're generating a vertical image but selected horizontal dimensions, flip them
            if aspect_ratio < 1 and gen_width > gen_height:
                gen_width, gen_height = gen_height, gen_width
            # If we're generating a horizontal image but selected vertical dimensions, flip them
            elif aspect_ratio > 1 and gen_width < gen_height:
                gen_width, gen_height = gen_height, gen_width

            print(f"Generating image with dimensions: {gen_width}x{gen_height}")

            response = requests.post(
                "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {self.config['stability_api_key']}",
                },
                json={
                    "text_prompts": [
                        {
                            "text": f"{prompt}, {self.config['generation_settings']['base_prompt_suffix']}, {self.config['generation_settings']['text_settings']}",
                            "weight": 1,
                        },
                        {
                            "text": self.config["generation_settings"][
                                "negative_prompt"
                            ],
                            "weight": -1,
                        },
                    ],
                    "cfg_scale": 15,
                    "height": gen_height,
                    "width": gen_width,
                    "samples": 1,
                    "steps": 50,
                    "style_preset": "digital-art",
                    "sampler": "K_DPMPP_2M",
                },
            )

            if response.status_code != 200:
                print(f"Error generating image: {response.text}")
                return None

            data = response.json()

            # Create generated directory if it doesn't exist
            script_dir = Path(__file__).resolve().parent
            output_dir = script_dir.parent / "resources" / "generated"
            output_dir.mkdir(parents=True, exist_ok=True)

            # Save the initial generated image
            initial_path = output_dir / f"{condition}_{int(time.time())}.png"
            with open(initial_path, "wb") as f:
                image_data = base64.b64decode(data["artifacts"][0]["base64"])
                f.write(image_data)

            # Enhance the image quality
            print(f"Enhancing image quality for {condition}...")
            enhanced_path = ImageProcessor.enhance_image(str(initial_path))

            # Remove the unenhanced version
            initial_path.unlink()

            return enhanced_path

        except Exception as e:
            print(f"Error generating image: {e}")
            return None
