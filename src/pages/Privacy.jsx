import { Link } from 'react-router-dom';
import { PROJECT_EMAIL } from '../lib/constants.js';

export const PRIVACY_UPDATED = 'October 5, 2026';

export default function Privacy() {
  return (
    <div className="pad narrow prose legal">
      <h1 className="page-title">Privacy Policy</h1>
      <p className="muted">Last updated {PRIVACY_UPDATED}</p>
      <p>Out &amp; About ("we," "us") helps people in Austin find and host gatherings outside. This policy explains what we collect, why, who can see it, and the choices you have. The short version: we only collect what the app needs to work, we never sell your information, and you can delete your account at any time.</p>

      <h2>What we collect</h2>
      <h3>When you create an account</h3>
      <ul>
        <li><strong>Email address and password.</strong> Your password is stored scrambled (hashed) by our login provider. We can't see it.</li>
        <li><strong>Date of birth.</strong> Used to confirm you're 18 or older and whether you can host (21+). Your birthday is never shown to anyone. Your age is shown on your profile unless you choose to hide it.</li>
      </ul>
      <h3>What you add to your profile (all optional except your name)</h3>
      <ul>
        <li>Name or nickname, neighborhood, bio, vibes, pronouns, hometown, work, the year you moved to Austin, languages, likes, "not my thing," favorite spots, prompts like "Ask me about," and a cover color.</li>
        <li><strong>Profile photo.</strong> Before upload, the app shrinks your photo and removes hidden data inside it, including the GPS location many phones save.</li>
        <li><strong>Parent hub details,</strong> if you choose: whether you're a mom or dad and your kids' age ranges. We never ask for children's names or photos.</li>
        <li><strong>A trusted contact's email,</strong> if you add one. It's only used to fill in an email on your own device when you tap "Tell a friend where you'll be." We never email that person.</li>
      </ul>
      <h3>What you do in the app</h3>
      <ul>
        <li><strong>Gatherings you host:</strong> title, description, date and time, general area and map pin, and details like rain plan and accessibility notes. For home gatherings, the exact address is stored separately.</li>
        <li><strong>RSVPs, circles you join, circle posts, waves, host reviews, reports, and people you block.</strong></li>
        <li><strong>Email settings:</strong> which emails you want from us.</li>
      </ul>
      <p>We don't use advertising trackers or analytics tools, and we don't collect your device's location. The map only shows places you or hosts choose.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><strong>Anyone, even without an account:</strong> gatherings (title, description, time, general area, and map pin), circle names, and host star ratings.</li>
        <li><strong>Signed-in members:</strong> profiles (including your photo and age unless hidden), circle membership, and host reviews. A review posted "without my name" doesn't show who wrote it.</li>
        <li><strong>Only the host and people who RSVP'd:</strong> a home gathering's exact address and the guest list. You can hide yourself from guest lists in your settings.</li>
        <li><strong>Only circle members:</strong> posts on that circle's board.</li>
        <li><strong>Only you:</strong> your email, birthday, trusted contact, email settings, the people you block, and the reports you file.</li>
        <li><strong>Our team:</strong> reports, and the information needed to review them and keep people safe.</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To run the app: your account, gatherings, RSVPs, circles, and profiles.</li>
        <li>To keep people safe: age checks, reviewing reports, removing content or accounts that break our <Link to="/guidelines">Community Guidelines</Link>, and stopping banned people from signing up again.</li>
        <li>To email you: sign-up confirmation and password resets, plus (if turned on in your settings) changes to gatherings you're going to, day-before reminders, and new RSVPs to gatherings you host. You can turn these off on your <Link to="/me">Me page</Link>.</li>
      </ul>
      <p>We don't sell or rent your personal information, and we don't share it with advertisers.</p>

      <h2>Services we use</h2>
      <p>We rely on a few companies to run the app. They handle your information only to provide their service to us:</p>
      <ul>
        <li><strong>Supabase</strong> stores our database, logins, and profile photos (servers in the United States).</li>
        <li><strong>Resend</strong> delivers our emails.</li>
        <li><strong>GitHub Pages</strong> hosts the website.</li>
        <li><strong>OpenStreetMap</strong> provides map images, <strong>Open-Meteo</strong> provides weather forecasts for gatherings, and <strong>Google Fonts</strong> provides our fonts. Your browser contacts these directly, so they receive your IP address, like any website you visit.</li>
      </ul>
      <p>We may also share information if the law requires it, or if we believe it's needed to protect someone's safety.</p>

      <h2>Your choices</h2>
      <ul>
        <li><strong>See and change your information</strong> any time on your <Link to="/me">Me page</Link>.</li>
        <li><strong>Hide your age</strong> or <strong>hide yourself from guest lists</strong> in your settings.</li>
        <li><strong>Turn emails off</strong> under "Email me when…" on your Me page.</li>
        <li><strong>Delete your account</strong> from the bottom of your Me page. This permanently removes your profile, photo, gatherings you host, RSVPs, posts, reviews you wrote, and your settings. Emails already sent can't be unsent, and copies may remain in our providers' backups for a short time before they're overwritten.</li>
        <li>For anything else, including a copy of your information, email <a href={`mailto:${PROJECT_EMAIL}`}>{PROJECT_EMAIL}</a>.</li>
      </ul>

      <h2>How long we keep things</h2>
      <p>We keep your information while your account is open. A record of each email we send is kept for 30 days, then deleted. If we remove an account for breaking our rules, we keep its email address to stop it from signing up again.</p>

      <h2>Security</h2>
      <p>Our database uses access rules that limit who can read each piece of information, connections are encrypted, and passwords are never stored in readable form. No system is perfectly secure, so please use a strong password you don't use anywhere else.</p>

      <h2>Adults only</h2>
      <p>Out &amp; About is for people 18 and older. We don't knowingly collect information from anyone younger. If we learn an account belongs to someone under 18, we'll delete it. If you believe that's happened, email us.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we'll update the date at the top and let members know by email or in the app.</p>

      <h2>Contact</h2>
      <p>Questions or requests: <a href={`mailto:${PROJECT_EMAIL}`}>{PROJECT_EMAIL}</a>. Out &amp; About is based in Austin, Texas.</p>
      <p><Link to="/terms">Terms of Service</Link> · <Link to="/guidelines">Community Guidelines</Link></p>
    </div>
  );
}
