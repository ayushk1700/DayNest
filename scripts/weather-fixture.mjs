export function weatherFixture() {
    const start = Math.floor((Date.now() + 19800000) / 86400000) * 86400 - 19800;
    return { timezone: 'Asia/Kolkata', current: { time: Math.floor(Date.now() / 1000), temperature_2m: 29, weather_code: 2 }, daily: {
        time: Array.from({ length: 7 }, (_, i) => start + i * 86400), weather_code: [0, 1, 2, 3, 61, 71, 95], temperature_2m_max: [30, 31, 32, 33, 30, 20, 25], temperature_2m_min: [20, 21, 22, 23, 20, 10, 15],
    } };
}
export async function mockWeather(context) {
    const state = { fail: false, calls: [] };
    await context.route('https://geocoding-api.open-meteo.com/**', route => {
        state.calls.push(route.request().url());
        const bad = new URL(route.request().url()).searchParams.get('name')?.includes('BadCity');
        return route.fulfill({ json: { results: bad ? [] : [{ name: 'Pune', country: 'India', latitude: 18.52, longitude: 73.86 }] }, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await context.route('https://api.open-meteo.com/**', route => {
        state.calls.push(route.request().url());
        return route.fulfill({ status: state.fail ? 503 : 200, json: state.fail ? {} : weatherFixture(), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    return state;
}
