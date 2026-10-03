import { useState } from 'react';
import useEvents from './useEvents.js';
import MapView from '../components/MapView.jsx';
import Chip from '../components/Chip.jsx';
import { CATEGORIES } from '../lib/constants.js';

export default function MapPage() {
  const { events } = useEvents();
  const [cat, setCat] = useState('All');
  const shown = (events || []).filter((e) => cat === 'All' || e.category === cat);
  return (
    <div className="pad">
      <h1 className="page-title">Around you</h1>
      <div className="chips scroll-x">
        {['All', ...CATEGORIES].map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>
      <MapView events={shown} height="65vh" />
      <p className="small muted legend">Solid pins are exact spots. Dashed circles are general areas until you RSVP.</p>
    </div>
  );
}
