import { PROJECT_EMAIL } from '../lib/constants.js';

export default function Guidelines() {
  return (
    <div className="pad narrow prose">
      <h1 className="page-title">Community guidelines &amp; safety</h1>
      <p>We're here to get people outside and together. That only works if everyone feels safe showing up.</p>
      <ol>
        <li><strong>Be who you say you are.</strong> Real name, one account, no impersonation.</li>
        <li><strong>Respect everyone.</strong> No harassment, hate, threats, or discrimination based on who someone is.</li>
        <li><strong>Consent comes first.</strong> Gatherings are social, not dating services. Unwanted advances or messages after someone says no will get you removed.</li>
        <li><strong>Keep private things private.</strong> Don't share a host's address, other guests' details, or photos of people (especially children) who didn't agree to be posted.</li>
        <li><strong>No selling or scamming.</strong> No spam, fake events, or collecting money for events that don't exist.</li>
        <li><strong>Drink and act responsibly.</strong> Follow the law and park rules. Nobody under 21 drinks. No selling alcohol or drugs.</li>
        <li><strong>Leave it better.</strong> Clean up, respect neighbors, keep noise reasonable.</li>
        <li><strong>Speak up.</strong> If something feels off, leave and report it. In an emergency, call 911 first.</li>
      </ol>
      <h2>Host agreement</h2>
      <p>By posting a gathering, you agree that your details are accurate; you're responsible for your gathering, including cleanup, laws, park rules, and permits; you won't sell alcohol or include it in any price; you'll keep home addresses private until RSVP; you'll post a rain plan and update guests if plans change; and you'll treat guests fairly. Each child at a gathering is supervised by their own parent or guardian.</p>
      <h2>Safety tips</h2>
      <ul>
        <li>Try public-place gatherings first, and tell a friend where you'll be.</li>
        <li>Arrange your own ride and keep your phone charged.</li>
        <li>Leave anytime something feels wrong. You don't owe anyone an explanation.</li>
      </ul>
      <p>Questions or concerns: <a href={`mailto:${PROJECT_EMAIL}`}>{PROJECT_EMAIL}</a></p>
    </div>
  );
}
