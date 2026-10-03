// Forecasts from Open-Meteo (no API key). Their free tier is for
// non-commercial use; switch to a paid plan before charging money.
const cache = new Map();

function describe(code) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 95) return 'Thunderstorms';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80) return 'Showers';
  if (code >= 51) return 'Rain';
  return 'Cloudy';
}

export async function getForecast(lat, lng, iso) {
  const when = new Date(iso).getTime();
  const daysAway = (when - Date.now()) / 86400000;
  if (daysAway < -0.2 || daysAway > 15) return null; // forecasts only cover ~16 days
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${new Date(iso).toISOString().slice(0, 13)}`;
  if (cache.has(key)) return cache.get(key);

  const day = (offset) => new Date(when + offset * 86400000).toISOString().slice(0, 10);
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lng}`
    + '&hourly=temperature_2m,precipitation_probability,weather_code'
    + '&temperature_unit=fahrenheit&timezone=auto'
    + `&start_date=${day(-1)}&end_date=${day(1)}`;

  const promise = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data?.hourly) return null;
      const offset = (data.utc_offset_seconds || 0) * 1000;
      let best = 0, bestDiff = Infinity;
      data.hourly.time.forEach((t, i) => {
        const diff = Math.abs(Date.parse(`${t}:00Z`) - offset - when);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      });
      const rain = data.hourly.precipitation_probability[best] ?? 0;
      return {
        temp: Math.round(data.hourly.temperature_2m[best]),
        rain,
        condition: describe(data.hourly.weather_code[best]),
        watch: rain >= 50,
      };
    })
    .catch(() => null);
  cache.set(key, promise);
  return promise;
}
