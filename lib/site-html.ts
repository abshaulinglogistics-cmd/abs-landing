// Landing page markup, copied verbatim from the Netlify site. Only the Calendly block was replaced.
export const NAV_HTML = `<nav>
  <div class="wrap nav-inner">
    <a href="#top" class="brand">
      <svg width="30" height="24" viewBox="0 0 60 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 34V21h5v-2h5l3-3h9l3 3h5v15" stroke="#22c974" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="24" cy="36" r="3.5" fill="#0b0d0b" stroke="#22c974" stroke-width="2.4"/>
        <circle cx="44" cy="36" r="3.5" fill="#0b0d0b" stroke="#22c974" stroke-width="2.4"/>
      </svg>
      <span class="h-font">ABS <span style="color: var(--accent);">HAULING &amp; LOGISTICS</span></span>
    </a>
    <div class="nav-links">
      <a href="#services">Services</a>
      <a href="#why">Why Us</a>
      <a href="#rates">Rates</a>
      <a href="#partners">Partners</a>
      <a href="#book">Book a Time</a>
      <a href="#contact">Contact</a>
    </div>
    <a href="tel:4047409500" class="nav-call">Call 404-740-9500</a>
  </div>
</nav>`;

export const TOP_HTML = `<div id="top" class="wrap hero">
  <div class="hero-grid">
    <div>
      <div class="pill">SOUTH FULTON &amp; THE ATLANTA METRO · 3 YEARS RUNNING</div>
      <h1 class="h-font">WE MAKE<br>THINGS <span style="color: var(--accent);">BETTER.</span></h1>
      <p class="lead">Junk removal, demolition, hauling, moving support, and pickup &amp; delivery — one dependable crew, one truck and trailer, same-day when you need it.</p>
      <div class="cta-row">
        <a href="tel:4047409500" class="btn btn-solid">Call or Text 404-740-9500</a>
        <a href="#book" class="btn btn-outline">Book a Time Online</a>
      </div>
      <p style="margin: 16px 0 0; font-size: 13px; color: var(--muted2); font-style: italic;">Serving South Fulton &amp; the greater Atlanta Metro. Don't see your area listed below? Call or text — we service additional locations by request.</p>
    </div>
    <div style="display:flex; align-items:center; justify-content:center;">
      <svg viewBox="0 0 500 300" width="100%" style="max-width: 420px;">
        <rect x="10" y="150" width="130" height="70" fill="none" stroke="#22c974" stroke-width="6" opacity="0.9"/>
        <line x1="10" y1="185" x2="140" y2="185" stroke="#22c974" stroke-width="4" opacity="0.9"/>
        <circle cx="35" cy="228" r="16" fill="#0b0d0b" stroke="#22c974" stroke-width="6"/>
        <circle cx="115" cy="228" r="16" fill="#0b0d0b" stroke="#22c974" stroke-width="6"/>
        <line x1="140" y1="200" x2="172" y2="200" stroke="#22c974" stroke-width="6"/>
        <path d="M172 220 L172 140 L226 140 L226 116 L280 116 L306 88 L384 88 L410 116 L470 116 L470 220 Z" fill="none" stroke="#22c974" stroke-width="7" stroke-linejoin="round"/>
        <line x1="306" y1="88" x2="306" y2="116" stroke="#22c974" stroke-width="5"/>
        <line x1="226" y1="140" x2="470" y2="140" stroke="#22c974" stroke-width="4" opacity="0.85"/>
        <circle cx="216" cy="228" r="18" fill="#0b0d0b" stroke="#22c974" stroke-width="7"/>
        <circle cx="440" cy="228" r="18" fill="#0b0d0b" stroke="#22c974" stroke-width="7"/>
      </svg>
    </div>
  </div>
</div>

<section id="services" class="band">
  <div class="wrap band-inner">
    <div class="section-head">
      <div class="eyebrow">WHAT WE DO</div>
      <h2 class="h-font section-title">Six Services. One Call.</h2>
    </div>
    <div class="services-grid">
      <div class="card">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c974" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6h14z"/></svg>
        <h3>Junk Removal</h3>
        <p>Furniture, appliances, e-waste, and general debris — gone the same day.</p>
      </div>
      <div class="card">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c974" stroke-width="1.8"><path d="M20 12V8a2 2 0 00-2-2h-4l-2-2H8a2 2 0 00-2 2v4M2 12h20M2 12l1.6 7.2A2 2 0 005.55 21h12.9a2 2 0 001.95-1.8L22 12"/></svg>
        <h3>Trash Service</h3>
        <p>Routine or one-time bulk trash hauling for homes and businesses.</p>
      </div>
      <div class="card">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c974" stroke-width="1.8"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/></svg>
        <h3>Pickup &amp; Delivery</h3>
        <p>Materials, equipment, inventory, and supply runs across South Fulton and the Atlanta Metro.</p>
      </div>
      <div class="card">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c974" stroke-width="1.8"><path d="M14.5 4l5.5 5.5-9 9L5.5 24l1-5.5 8-9zM3 21h18"/></svg>
        <h3>Demolition</h3>
        <p>Interior tear-outs, sheds, decks, and small structures, cleared to code.</p>
      </div>
      <div class="card">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c974" stroke-width="1.8"><path d="M20 8h-3V4H3v13h2M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM9 17h6M17 8v6h4"/></svg>
        <h3>Movers</h3>
        <p>Loading and unloading labor for unit turnovers and relocations.</p>
      </div>
      <div class="card">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#22c974" stroke-width="1.8"><path d="M1 15h13V6H1zM14 9h4l4 4v2h-8zM6 20a2 2 0 110-4 2 2 0 010 4zM17 20a2 2 0 110-4 2 2 0 010 4z"/></svg>
        <h3>Hauling</h3>
        <p>Construction debris, yard waste, and bulk item transport, by the load.</p>
      </div>
    </div>
  </div>
</section>

<section id="why" class="wrap why">
  <div class="stats-grid">
    <div class="stat"><div class="num h-font">3</div><div class="label">Years Serving the Metro</div></div>
    <div class="stat"><div class="num h-font">6</div><div class="label">Services Under One Crew</div></div>
    <div class="stat"><div class="num h-font" style="font-size:30px;">Same-Day</div><div class="label">Availability, Most Jobs</div></div>
    <div class="stat"><div class="num h-font">1</div><div class="label">Point of Contact, Every Job</div></div>
  </div>
  <div class="why-grid">
    <div>
      <div class="eyebrow">WHY PARTNER WITH US</div>
      <h2 class="h-font">Local, Reliable, No Runaround.</h2>
      <ul class="checklist">
        <li><span>✓</span>Based in South Fulton — serving the full Atlanta Metro area</li>
        <li><span>✓</span>No long-term contract required to get started</li>
        <li><span>✓</span>Flat, upfront pricing before we start any job</li>
        <li><span>✓</span>Before/after photo documentation on request</li>
        <li><span>✓</span>Covered-bed pickup + utility trailer — tight-access friendly</li>
      </ul>
    </div>
    <div class="rig-card">
      <h3 class="h-font">Our Rig</h3>
      <p>A 2015 Dodge Ram pickup with a covered bed, plus an attached utility trailer — built for the volume that makes up most property turnover and jobsite hauling, and small enough to fit where a box truck can't.</p>
      <div class="rig-list">
        <div class="rig-row"><span>Weather-protected hauling</span><span class="ck">✓</span></div>
        <div class="rig-row"><span>No permits typically required</span><span class="ck">✓</span></div>
        <div class="rig-row"><span>Fits residential &amp; breezeway access</span><span class="ck">✓</span></div>
      </div>
    </div>
  </div>
</section>

<section id="rates" class="band">
  <div class="wrap band-inner">
    <div class="section-head">
      <div class="eyebrow">TRANSPARENT PRICING</div>
      <h2 class="h-font section-title">Standard Rates</h2>
      <p style="margin:0; font-size:15px; color: var(--muted);">Every job gets a flat price up front. Businesses with recurring work get our Preferred Partner rate — ask when you call.</p>
    </div>
    <div class="rate-table-wrap">
      <table class="rates">
        <thead>
          <tr><th>Service</th><th class="center">Starting Rate</th><th class="col-note">Notes</th></tr>
        </thead>
        <tbody>
          <tr><td class="svc-name">Minimum Service Call</td><td class="center svc-rate">$95</td><td class="col-note svc-note">Trip charge + first 15 min on-site</td></tr>
          <tr><td class="svc-name">Quarter Load</td><td class="center svc-rate">$150–$175</td><td class="col-note svc-note">1–2 furniture pieces / small cleanout</td></tr>
          <tr><td class="svc-name">Half Load</td><td class="center svc-rate">$225–$275</td><td class="col-note svc-note">Studio/1BR cleanout, small demo debris</td></tr>
          <tr><td class="svc-name">Full Load (bed + trailer)</td><td class="center svc-rate">$375–$450</td><td class="col-note svc-note">2–3BR cleanout, full demo debris load</td></tr>
          <tr><td class="svc-name">Demolition Labor</td><td class="center svc-rate">$65/hr</td><td class="col-note svc-note">Per laborer; disposal billed separately</td></tr>
          <tr><td class="svc-name">Pickup &amp; Delivery</td><td class="center svc-rate">$45 + $0.95/mi</td><td class="col-note svc-note">Round-trip mileage, local</td></tr>
        </tbody>
      </table>
    </div>
    <p class="rate-fine">Dump/landfill fees passed through at cost. Final price confirmed before work begins.</p>
  </div>
</section>

<section id="partners" class="wrap partners">
  <div class="partner-card">
    <div>
      <div class="eyebrow">FOR PROPERTY MANAGERS &amp; CONTRACTORS</div>
      <h2 class="h-font">Add Us to Your Vendor List.</h2>
      <p>Property managers, general contractors, movers, and storage facilities across South Fulton and the greater Atlanta Metro call us for turnover cleanouts, jobsite hauling, and overflow work. No contract required — recurring accounts get our Preferred Partner rate and priority scheduling.</p>
    </div>
    <div class="partner-actions">
      <a href="tel:4047409500" class="btn btn-solid">Call 404-740-9500</a>
      <a href="#book" class="btn btn-outline">Book a Time Online</a>
    </div>
  </div>
</section>

`;

export const FOOTER_HTML = `<footer id="contact">
  <div class="wrap footer-inner">
    <div class="footer-grid">
      <div>
        <div class="footer-brand">
          <svg width="26" height="21" viewBox="0 0 60 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 34V21h5v-2h5l3-3h9l3 3h5v15" stroke="#22c974" stroke-width="3" stroke-linejoin="round"/>
            <circle cx="24" cy="36" r="3.5" fill="#060706" stroke="#22c974" stroke-width="2.4"/>
            <circle cx="44" cy="36" r="3.5" fill="#060706" stroke="#22c974" stroke-width="2.4"/>
          </svg>
          <span class="h-font">ABS HAULING &amp; LOGISTICS</span>
        </div>
        <p class="footer-desc">Contracted hauling, demo, and delivery for homes and businesses across South Fulton and the Atlanta Metro. "We Make Things Better."</p>
      </div>
      <div>
        <div class="footer-h">CONTACT</div>
        <div class="footer-contact">
          <a href="tel:4047409500" class="phone">404-740-9500</a>
          <a href="mailto:ABSHaulingLogistics@gmail.com">ABSHaulingLogistics@gmail.com</a>
        </div>
      </div>
      <div>
        <div class="footer-h">SERVICE AREA</div>
        <p class="footer-area">South Fulton · Union City · Fairburn · Palmetto · East Point · College Park · Atlanta · Sandy Springs · Marietta · Decatur · Douglasville · Newnan · Peachtree City &amp; the greater Atlanta Metro</p>
        <p class="footer-note">Don't see your area listed? Call or text us — we take on jobs outside this list too.</p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 ABS Hauling &amp; Logistics. All rights reserved.</span>
      <span>A division of ABS Demo &amp; Junk Removal</span>
    </div>
  </div>
</footer>`;
