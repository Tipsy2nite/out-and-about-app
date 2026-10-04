import { useEffect, useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { DAD_TEMPLATES, STAGES } from '../lib/constants.js';
import useEvents from './useEvents.js';
import useCircles from './useCircles.js';
import EventCard from '../components/EventCard.jsx';
import Chip from '../components/Chip.jsx';
import { CircleRow } from './CirclesPage.jsx';

function ParentFinder({ role }) {
  const { user, profile } = useAuth();
  const [people, setPeople] = useState(null);
  const [stage, setStage] = useState('All');
  const [waved, setWaved] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles')
        .select('id, display_name, neighborhood, kids_stages, vibes, avatar_url')
        .eq('parent_role', role).eq('show_in_parent_finder', true).neq('id', user.id).limit(60);
      setPeople(data || []);
      const { data: w } = await supabase.from('waves').select('to_id').eq('from_id', user.id);
      setWaved(new Set((w || []).map((x) => x.to_id)));
    })();
  }, [user, role]);

  if (!user) return <p className="muted"><Link to="/signin">Sign in</Link> to meet {role === 'mom' ? 'moms' : 'dads'} near you.</p>;
  const listed = profile?.parent_role === role && profile?.show_in_parent_finder;
  const shown = (people || []).filter((p) => stage === 'All' || p.kids_stages.includes(stage));

  const wave = async (p) => {
    await supabase.from('waves').insert({ to_id: p.id });
    setWaved(new Set([...waved, p.id]));
  };

  return (
    <section>
      <h2>{role === 'mom' ? 'Moms' : 'Dads'} near you</h2>
      {!listed && <p className="small">Want to show up here too? Turn it on in <Link to="/me">My stuff</Link>.</p>}
      <div className="chips scroll-x">
        {['All', ...STAGES].map((s) => <Chip key={s} on={stage === s} onClick={() => setStage(s)}>{s}</Chip>)}
      </div>
      <div className="person-grid">
        {shown.map((p) => (
          <div key={p.id} className="person">
            <Link to={`/people/${p.id}`} className="row"><Avatar name={p.display_name} url={p.avatar_url} />
              <span><strong>{p.display_name}</strong><br /><span className="small">{[p.kids_stages.join(', '), p.neighborhood].filter(Boolean).join(' · ')}</span></span></Link>
            {p.vibes.length > 0 && <p className="small muted">Into: {p.vibes.slice(0, 3).join(', ')}</p>}
            <button type="button" className={waved.has(p.id) ? 'btn btn-dark btn-sm' : 'btn btn-primary btn-sm'} disabled={waved.has(p.id)} onClick={() => wave(p)}>
              {waved.has(p.id) ? 'Wave sent' : 'Say hi'}
            </button>
          </div>
        ))}
      </div>
      {people && shown.length === 0 && <p className="muted">No one listed for this stage yet. Invite a friend who'd fit.</p>}
      <p className="safe-note small">Kids' names and photos are never shown. Profiles list age ranges only.</p>
    </section>
  );
}

export default function ParentsPage() {
  const { mode } = useParams();
  const isMoms = mode !== 'dads';
  const audience = isMoms ? 'moms' : 'dads';
  const { events, goingIds } = useEvents({ audience });
  const { circles, toggleJoin } = useCircles(audience);
  const { user, profile } = useAuth();

  return (
    <div>
      <header className={isMoms ? 'band band-moms' : 'band band-dads'}>
        <div className="chips">
          <Link to="/parents/moms" className={isMoms ? 'seg seg-on' : 'seg'}>For moms</Link>
          <Link to="/parents/dads" className={!isMoms ? 'seg seg-on' : 'seg'}>For dads</Link>
        </div>
        <h1>{isMoms ? 'Mom friends, made outside.' : 'Dads, put it on the calendar.'}</h1>
        <p>{isMoms
          ? 'Meet moms nearby with kids around the same age, then show up somewhere together.'
          : 'Pick a hang, set a time, and other dads will show up. Kids welcome unless you say otherwise.'}</p>
      </header>
      <div className="pad two-col">
        <div className="stack">
          {!isMoms && (
            <section>
              <h2>Start a dad hang</h2>
              <div className="template-grid">
                {DAD_TEMPLATES.map((t) => (
                  <Link key={t.title} className="template"
                    to={`/host?title=${encodeURIComponent(t.title)}&category=Families&audience=dads&size=${t.size}&kids=${t.kids ? 1 : 0}`}>
                    <strong>{t.title}</strong><span className="small muted">{t.blurb}</span><span className="pill pill-sun">Set it up</span>
                  </Link>
                ))}
              </div>
              <Link to="/host?category=Families&audience=dads" className="btn btn-outline">Or start from scratch</Link>
            </section>
          )}
          <ParentFinder role={isMoms ? 'mom' : 'dad'} />
          {isMoms && <Link to="/host?category=Families&audience=moms" className="btn btn-outline">Host a mom meetup</Link>}
        </div>
        <div className="stack">
          <h2>Coming up</h2>
          {(events || []).map((e) => <EventCard key={e.id} event={e} going={goingIds.has(e.id)} />)}
          {events?.length === 0 && <p className="muted">Nothing on the calendar yet. Be the first to host.</p>}
          <h2>Circles</h2>
          {(circles || []).map((c) => <CircleRow key={c.id} c={c} onToggle={toggleJoin} signedIn={Boolean(user && profile)} />)}
          {circles?.length === 0 && <p className="muted">No {audience} circles yet. <Link to="/circles">Start one</Link>.</p>}
        </div>
      </div>
    </div>
  );
}
