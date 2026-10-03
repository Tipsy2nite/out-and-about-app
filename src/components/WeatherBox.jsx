import { useEffect, useState } from 'react';
import { getForecast } from '../lib/weather.js';

export default function WeatherBox({ event }) {
  const [wx, setWx] = useState(undefined);
  useEffect(() => {
    let live = true;
    getForecast(event.lat, event.lng, event.starts_at).then((w) => live && setWx(w));
    return () => { live = false; };
  }, [event.lat, event.lng, event.starts_at]);

  const plan = event.rain_plan_note ? `${event.rain_plan}: ${event.rain_plan_note}` : event.rain_plan;
  return (
    <section className={wx?.watch ? 'panel panel-watch' : 'panel'}>
      <div className="row-between">
        <h3>Weather</h3>
        {wx?.watch && <span className="pill pill-dark">Weather watch</span>}
      </div>
      {wx === undefined && <p className="muted">Checking the forecast…</p>}
      {wx === null && <p className="muted">Forecast shows up about two weeks before the gathering.</p>}
      {wx && <p><strong>{wx.temp}° · {wx.condition}</strong> · {wx.rain}% chance of rain</p>}
      <p><strong>Rain plan:</strong> {plan}</p>
      <p className="small muted">If plans change, the host updates this page and the change shows on every guest's plans.</p>
    </section>
  );
}
