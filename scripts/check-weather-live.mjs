// Real service smoke test; build and run the integrity suite first.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { configuredProvider, requestWeather } = require('../.test-build/weather/provider.js');
try {
    const value = await requestWeather(configuredProvider, 'Pune, India', AbortSignal.timeout(20000), true);
    if (value.daily?.length !== 7 || !Number.isFinite(value.temperatureC)) throw Error('Incomplete live weather data');
    console.log(JSON.stringify({ provider: configuredProvider.id, city: value.city, temperatureC: value.temperatureC, condition: value.condition, forecastDays: value.daily.length, observedAt: new Date(value.observedAt).toISOString() }));
} catch (error) { console.error('Live Open-Meteo check failed:', error.message); process.exitCode = 1; }
