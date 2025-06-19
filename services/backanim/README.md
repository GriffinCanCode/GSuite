# Dynamic Desktop Background Changer

Automatically changes your macOS desktop background based on time of day and weather conditions, with optional AI-generated black and white artistic backgrounds.

## Features

- Time-based background changes (morning, afternoon, evening, night)
- Weather-based background changes (rainy, sunny, cloudy)
- AI-generated black and white artistic backgrounds using Stable Diffusion
- Caches weather data to minimize API calls
- Runs as a background service using launchd

## Setup

1. Install the required dependencies:
   ```bash
   pip3 install -r requirements.txt
   ```

2. Create a config directory and add your backgrounds:
   ```bash
   mkdir -p config resources/generated
   ```
   Either add your own background images to the `resources` directory with the following names, or let the AI generate them:
   - morning.jpg
   - afternoon.jpg
   - evening.jpg
   - night.jpg
   - rainy.jpg
   - sunny.jpg
   - cloudy.jpg

3. Create a config.json file in the config directory:
   ```json
   {
       "weather_api_key": "YOUR-OPENWEATHER-API-KEY",
       "stability_api_key": "YOUR-STABILITY-API-KEY",
       "location": "Your City,Country",
       "use_ai_generation": true,
       "backgrounds": {
           "morning": "../resources/morning.jpg",
           "afternoon": "../resources/afternoon.jpg",
           "evening": "../resources/evening.jpg",
           "night": "../resources/night.jpg",
           "rainy": "../resources/rainy.jpg",
           "sunny": "../resources/sunny.jpg",
           "cloudy": "../resources/cloudy.jpg"
       },
       "image_settings": {
           "morning": "minimalist black and white sunrise over mountains, zen aesthetic",
           "afternoon": "high contrast black and white urban landscape, geometric patterns",
           "evening": "moody black and white twilight cityscape with dramatic shadows",
           "night": "abstract black and white starry night sky with flowing patterns",
           "rainy": "black and white rain patterns on window, minimalist composition",
           "sunny": "black and white sun rays through trees, high contrast nature",
           "cloudy": "dramatic black and white cloudscapes, abstract patterns"
       }
   }
   ```

4. Edit the launchd plist file:
   - Open `com.user.backanim.plist`
   - Replace `REPLACE_WITH_ABSOLUTE_PATH` with your actual path

5. Install the launchd service:
   ```bash
   cp com.user.backanim.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.user.backanim.plist
   ```

## Usage

The service will automatically start after installation and run every 15 minutes. To manually change the background:

```bash
python3 src/background_changer.py
```

To stop the service:
```bash
launchctl unload ~/Library/LaunchAgents/com.user.backanim.plist
```

## API Keys

This service uses two APIs:

### OpenWeather API
1. Sign up at https://openweathermap.org/
2. Get an API key
3. Add the key to your config.json file as `weather_api_key`

### Stability AI API (for AI-generated backgrounds)
1. Sign up at https://platform.stability.ai/
2. Get an API key
3. Add the key to your config.json file as `stability_api_key`

To disable AI-generated backgrounds, set `use_ai_generation` to `false` in your config.json.

## AI-Generated Backgrounds

The service uses Stable Diffusion to generate unique black and white artistic backgrounds based on the time of day and weather conditions. Each generated image is:
- 1024x1024 resolution
- Black and white artistic style
- Unique to the current conditions
- Saved in the `resources/generated` directory

You can customize the prompts for each condition by modifying the `image_settings` in your config.json file.

## Troubleshooting

Check the error and output logs in the backanim directory for any issues:
- error.log
- output.log

Common issues:
- Missing API keys: Make sure both API keys are properly set in config.json
- Image generation fails: Check your Stability AI API key and quota
- Background not changing: Check the logs for specific error messages 