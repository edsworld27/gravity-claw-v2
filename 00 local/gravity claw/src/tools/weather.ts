import axios from 'axios';
import { config } from '../config.js';

export const weatherTools = [
    {
        name: 'weather_get',
        description: 'Get the current weather and forecast for a specific city.',
        parameters: {
            type: 'object',
            properties: {
                city: { type: 'string', description: 'City name (e.g. "London, UK")' }
            },
            required: ['city']
        },
        execute: async ({ city }: { city: string }) => {
            if (!config.openWeatherApiKey) {
                return 'Error: OpenWeather API key is not configured.';
            }

            try {
                const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${config.openWeatherApiKey}&units=metric`;
                const response = await axios.get(url);
                const data = response.data as any;

                const weather = data.weather[0].description;
                const temp = data.main.temp;
                const humidity = data.main.humidity;

                return `Weather in ${data.name}: ${weather}, Temperature: ${temp}°C, Humidity: ${humidity}%`;
            } catch (error: any) {
                console.error('[Weather Error]:', error.response?.data || error.message);
                return `Failed to fetch weather for ${city}. Please check the city name and try again.`;
            }
        }
    }
];
