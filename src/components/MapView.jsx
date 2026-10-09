import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { TINTS, AUSTIN } from '../lib/constants.js';
import { eventDateParts } from '../lib/format.js';

function pinIcon(event) {
  const d = eventDateParts(event.starts_at);
  const priv = event.is_private_location;
  const size = priv ? 56 : 40;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="pin ${priv ? 'pin-area' : ''}" style="width:${size}px;height:${size}px;background:${TINTS[event.category]}">${priv ? '' : d.date}</div>`,
  });
}

export default function MapView({ events, height = 520 }) {
  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer center={AUSTIN} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {events.map((e) => {
          const d = eventDateParts(e.starts_at);
          return (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={pinIcon(e)} title={e.title}>
              <Popup>
                <strong>{e.title}</strong><br />
                {d.day} {d.month} {d.date} · {d.time}<br />
                {e.area_label}{e.is_private_location ? ' (general area until you RSVP)' : ''}<br />
                <Link to={`/events/${e.id}`}>See details</Link>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (ev) => onPick([ev.latlng.lat, ev.latlng.lng]) });
  return null;
}

// Glides the map to a spot when an address is chosen (focus = { pos, key })
function FlyTo({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus?.pos) map.flyTo(focus.pos, Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function LocationPicker({ value, onPick, focus }) {
  const icon = L.divIcon({ className: '', iconSize: [36, 36], iconAnchor: [18, 18], html: '<div class="pin pin-pick" style="width:36px;height:36px"></div>' });
  return (
    <div className="map-wrap" style={{ height: 300 }}>
      <MapContainer center={value || AUSTIN} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPlace onPick={onPick} />
        <FlyTo focus={focus} />
        {value && <Marker position={value} icon={icon} />}
      </MapContainer>
    </div>
  );
}
