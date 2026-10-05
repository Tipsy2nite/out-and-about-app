import { Link } from 'react-router-dom';
import { PROJECT_EMAIL } from '../lib/constants.js';

export const TERMS_UPDATED = 'October 5, 2026';

export default function Terms() {
  return (
    <div className="pad narrow prose legal">
      <h1 className="page-title">Terms of Service</h1>
      <p className="muted">Last updated {TERMS_UPDATED}</p>
      <p>Welcome to Out &amp; About ("we," "us"). These terms are the agreement between you and us when you use our website and services. By creating an account or using Out &amp; About, you agree to these terms, our <Link to="/privacy">Privacy Policy</Link>, and our <Link to="/guidelines">Community Guidelines</Link>. If you don't agree, please don't use the service.</p>

      <h2>1. Who can use Out &amp; About</h2>
      <ul>
        <li>You must be at least <strong>18 years old</strong> to create an account, and at least <strong>21</strong> to host a gathering.</li>
        <li>The date of birth you give us must be true. Giving a false age is grounds for removing your account.</li>
        <li>You may have one account, and it's for you only. Keep your password private. You're responsible for what happens under your account.</li>
        <li>You can't use Out &amp; About if we've previously removed you, or if the law doesn't allow you to.</li>
      </ul>

      <h2>2. What we are, and what we aren't</h2>
      <p>Out &amp; About is a place for people to post and find gatherings. <strong>We don't organize, run, supervise, or attend gatherings,</strong> and hosts aren't our employees or agents. We don't run background checks on members. A "Verified" badge means our team confirmed someone's identity at a point in time; it is not an endorsement or a guarantee of their behavior. Star ratings and reviews are opinions from other members.</p>
      <p>Meeting new people involves risk. Use your judgment, start with public places, tell a friend where you're going, and leave if something feels wrong. If you're in danger, call 911.</p>

      <h2>3. Hosting</h2>
      <p>If you host a gathering, you agree that:</p>
      <ul>
        <li>Your gathering details are accurate, and you'll update or cancel it promptly if plans change.</li>
        <li>You're responsible for your gathering, including following laws, park rules, and permit requirements, and cleaning up.</li>
        <li>You won't sell alcohol, include it in any price, or serve it to anyone under 21.</li>
        <li>You'll keep a home address private and only share it through the app with people who RSVP.</li>
        <li>You'll treat guests fairly and won't exclude people based on race, religion, disability, sex, sexual orientation, gender identity, or other protected traits (gatherings set for moms, dads, or families are fine).</li>
        <li>Each child at a gathering is supervised by their own parent or guardian.</li>
        <li>Charging money, selling things, or promoting a business requires our written permission.</li>
      </ul>

      <h2>4. Your content</h2>
      <p>You own what you post, including your profile, photo, gatherings, posts, and reviews. So that we can run the service, you give us a non-exclusive, royalty-free, worldwide license to store, display, and share that content within Out &amp; About, and to show gatherings and ratings publicly as described in our Privacy Policy. This license ends when you delete the content or your account, except for copies already shared with others (like emails already sent) or kept briefly in backups.</p>
      <p>You promise you have the right to post what you post. Your profile photo must be a real photo of you, with no children or other people in it.</p>

      <h2>5. Things you can't do</h2>
      <ul>
        <li>Harass, threaten, stalk, or discriminate against anyone, or post hateful or sexual content.</li>
        <li>Pretend to be someone else, or create fake gatherings, fake reviews, or more than one account.</li>
        <li>Use Out &amp; About for dating solicitation after someone says no, for spam, or to sell things without permission.</li>
        <li>Share another member's private information, including a host's address or photos of people who didn't agree.</li>
        <li>Post anything illegal, or use gatherings for illegal activity.</li>
        <li>Scrape, copy, or collect information about members, or try to break, overload, or get around the app's security or rules.</li>
      </ul>

      <h2>6. Reviews</h2>
      <p>Guests who RSVP'd can rate a host after a gathering. Reviews must be honest and based on your own experience. We may remove reviews that break these terms or our guidelines, but we don't edit or verify every review.</p>

      <h2>7. Reports, removal, and ending your account</h2>
      <p>Anyone can report a gathering, person, post, circle, or review. We may remove content, cancel gatherings, remove photos, or suspend or permanently remove accounts (including preventing an email address from signing up again) when we believe it's needed to keep the community safe or enforce these terms. We may do this without notice, especially for safety issues.</p>
      <p>You can delete your account at any time from your <Link to="/me">Me page</Link>.</p>

      <h2>8. Emails</h2>
      <p>We'll send account emails (like sign-up confirmation and password resets) and, unless you turn them off, emails about gatherings you're going to or hosting. You can change these on your <Link to="/me">Me page</Link>.</p>

      <h2>9. Disclaimers</h2>
      <p>Out &amp; About is provided "as is" and "as available." To the fullest extent the law allows, we make no promises about the service, gatherings, hosts, guests, weather forecasts, maps, or any information in the app, including that it will be accurate, safe, or always available. Weather and map information comes from outside providers and may be wrong.</p>

      <h2>10. Limits on our responsibility</h2>
      <p>To the fullest extent the law allows, we aren't responsible for the actions of members, hosts, or guests, or for anything that happens at or because of a gathering, including injury, loss, or damage to property. We also aren't liable for indirect, incidental, special, or punitive damages, or lost profits. If we are found liable for anything, our total responsibility is limited to $100. Some places don't allow these limits, so they may not fully apply to you.</p>

      <h2>11. Your responsibility to us</h2>
      <p>If someone makes a claim against us because of content you posted, a gathering you hosted, or your breaking these terms, you agree to cover our reasonable costs and losses from that claim, to the extent the law allows.</p>

      <h2>12. Disagreements</h2>
      <p>These terms are governed by the laws of the State of Texas and applicable U.S. law. If a dispute can't be worked out by contacting us first, it will be handled in the state or federal courts located in Travis County, Texas, and you and we agree to those courts' jurisdiction.</p>

      <h2>13. Changes to these terms</h2>
      <p>We may update these terms as the service grows. If a change is meaningful, we'll update the date at the top and let members know by email or in the app. Continuing to use Out &amp; About after that means you accept the new terms.</p>

      <h2>14. Everything else</h2>
      <p>If part of these terms can't be enforced, the rest still applies. If we don't enforce something right away, we haven't given up the right to later. You can't transfer your account or these terms to someone else.</p>

      <h2>Contact</h2>
      <p>Questions: <a href={`mailto:${PROJECT_EMAIL}`}>{PROJECT_EMAIL}</a>. Out &amp; About is based in Austin, Texas.</p>
      <p><Link to="/privacy">Privacy Policy</Link> · <Link to="/guidelines">Community Guidelines</Link></p>
    </div>
  );
}
