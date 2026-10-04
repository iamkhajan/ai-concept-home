const RING = 2 * Math.PI * 52;

const fmtTimer = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const ring = (inner, cls = '') => `
  <div class="ring ${cls}">
    <svg viewBox="0 0 120 120">
      <circle class="track" cx="60" cy="60" r="52"/>
      <circle class="prog" data-ring cx="60" cy="60" r="52" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/>
    </svg>
    <div class="ring-inner">${inner}</div>
  </div>`;

const BARS = Array.from({ length: 14 }, (_, i) => `<i style="animation-delay:${(i * 0.09) % 0.6}s"></i>`).join('');

const SCREENS = {
  assistant: `
    <div class="ai-top"><span class="ai-back">‹ Back</span><span class="ai-bell">🔔</span></div>
    <div>
      <span class="ai-kicker">Cook AI Assistant</span>
      <h3 class="ai-title">What would you like to cook?</h3>
    </div>
    <div>
      <b class="ai-label">Cook again</b>
      <span class="ai-again">↻ Steam salmon fillet, 2 portions</span>
    </div>
    <div>
      <div class="ai-row"><b class="ai-label">Pick a dish</b><span class="muted">or just say it</span></div>
      <div class="ai-tabs"><b>Popular</b><span>Fish</span><span>Meat</span><span>Veg</span><span>Bakes</span></div>
    </div>
    <div class="ai-cards">
      <div><i style="background:#e8f0fd">🐟</i><b>Salmon fillet</b><span>Steam · 18 min</span></div>
      <div><i style="background:#fbf1e4">🍞</i><b>Sourdough</b><span>Bake · 45 min</span></div>
      <div><i style="background:#eaf5ec">🥕</i><b>Roast veg</b><span>Roast · 35 min</span></div>
    </div>
    <div class="ai-voice" data-voice>
      <small>🎙 Voice mode</small>
      <div class="ai-wave">${BARS}</div>
      <p data-bind="transcript"></p>
    </div>
    <div class="ai-input">
      <span data-bind="placeholder">Or type a dish…</span>
      <i class="ai-mic" data-mic>🎙</i>
      <b class="ai-go" data-go>Generate plan</b>
    </div>
    <nav class="ai-nav"><b>🏠<br>Home</b><span>📖<br>Recipes</span><span>❓<br>Support</span><span>⚙️<br>Settings</span></nav>`,
  home: `
    <div><small class="muted">Good evening</small><h3>Alex</h3></div>
    <div class="tile">
      <div class="tile-row"><span>Wall Oven</span><span class="badge">● Connected</span></div>
      <div class="big muted">Idle · 22°C</div>
    </div>
    <div class="tile recipe-tile">
      <div class="thumb">🥩</div>
      <div><small class="muted">Tonight's pick</small><b>Ribeye, medium rare</b><span class="muted">45 min · Conv. Bake</span></div>
    </div>
    <div class="tile recipe-tile">
      <div class="thumb" style="background:linear-gradient(135deg,#ffe1d6,#f08a7a)">🐟</div>
      <div><small class="muted">Quick</small><b>Lemon Butter Salmon</b><span class="muted">18 min · Bake</span></div>
    </div>`,
  recipe: `
    <div class="hero-img steak">🥩<span class="chip-float">✦ Cook AI plan</span></div>
    <div><small class="muted">Your plan</small><h3>Ribeye, medium rare</h3></div>
    <div class="chips"><span>⏱ 45 min</span><span>🌡 135°C</span><span>🌀 Conv. Bake</span><span>🎯 54°C core</span></div>
    <ol class="steps-list">
      <li>Season with salt, pepper &amp; thyme</li>
      <li>Slow-roast on the rack to 50°C inside</li>
      <li>Rest 5 min, then slice against the grain</li>
    </ol>
    <div class="toast" data-toast></div>
    <button class="cta" data-press>Send to Oven</button>`,
  preheat: `
    <div><small class="muted">Wall Oven</small><h3>Preheating</h3></div>
    ${ring('<b data-bind="temp">22°</b><small class="muted">of 135°C</small>')}
    <div class="rows">
      <div><span>Mode</span><b>Convection Bake</b></div>
      <div><span>Status</span><b data-bind="status">Heating</b></div>
      <div><span>Notify when ready</span><i class="toggle on"></i></div>
    </div>`,
  cooking: `
    <div><small class="muted">Wall Oven · Ribeye, medium rare</small><h3>Cooking</h3></div>
    ${ring('<b data-bind="timer">45:00</b><small class="muted">remaining</small>', 'cool')}
    <div class="rows">
      <div><span>Mode</span><b>Conv. Bake · 135°C</b></div>
      <div><span>Status</span><b data-bind="status">Cooking</b></div>
    </div>
    <div class="btn-row"><span>+ Sear</span><span>💡 Light</span><span>Stop</span></div>`,
  ready: `
    <div class="done-badge">✓</div>
    <div class="center"><h3>Dinner is ready</h3><p class="muted">Ribeye · medium rare · 50 min</p></div>
    <div class="rows">
      <div><span>Core temp</span><b>54°C</b></div>
      <div><span>Doneness</span><b>Medium rare</b></div>
      <div><span>Oven</span><b>Off · rest 5 min</b></div>
    </div>
    <button class="cta ghost">Save to Cook again</button>`,
};

export class PhoneUI {
  constructor(root) {
    this.root = root;
    this.app = root.querySelector('#app');
    this.notif = root.querySelector('#notif');
    this.timeEl = root.querySelector('#phone-time');
    this.screenEl = root.querySelector('.screen');
    this.screen = null;
    this.cache = {};
    this.notifKey = null;
  }

  set(key, val, fn) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    fn(val);
  }

  update(p, visible, clockMin) {
    this.root.classList.toggle('show', visible);

    if (p.screen !== this.screen) {
      this.screen = p.screen;
      this.cache = {};
      this.app.innerHTML = SCREENS[p.screen];
      this.app.dataset.screen = this.screenEl.dataset.screen = p.screen;
      this.app.classList.remove('enter');
      void this.app.offsetWidth; // restart entrance animation
      this.app.classList.add('enter');
    }

    const bind = (name, val) =>
      this.set(name, val, (v) => this.app.querySelectorAll(`[data-bind="${name}"]`).forEach((el) => (el.textContent = v)));
    bind('temp', `${Math.round(p.temp)}°`);
    bind('timer', fmtTimer(p.timer));
    bind('status', p.status);

    const ringEl = this.app.querySelector('[data-ring]');
    if (ringEl) this.set('ring', (RING * (1 - Math.min(1, p.progress))).toFixed(1), (v) => ringEl.setAttribute('stroke-dashoffset', v));

    const btn = this.app.querySelector('[data-press]');
    if (btn)
      this.set('pressed', p.pressed, (v) => {
        btn.classList.toggle('pressed', v);
        btn.textContent = v ? 'Sent ✓' : 'Send to Oven';
      });
    const toast = this.app.querySelector('[data-toast]');
    if (toast)
      this.set('toast', p.toast, (v) => {
        if (v) toast.textContent = v;
        toast.classList.toggle('show', !!v);
      });

    const voice = this.app.querySelector('[data-voice]');
    if (voice) {
      const v = p.voice || {};
      bind('transcript', v.text ? `“${v.text}”` : 'Listening…');
      bind('placeholder', v.listening ? 'Listening…' : v.text || 'Or type a dish…');
      this.set('filled', !v.listening && !!v.text, (f) => this.app.querySelector('[data-bind="placeholder"]').classList.toggle('filled', f));
      this.set('listening', !!v.listening, (on) => {
        voice.classList.toggle('show', on || !!v.text);
        voice.classList.toggle('live', on);
        this.app.querySelector('[data-mic]').classList.toggle('live', on);
      });
      this.set('go', `${!!v.text && !v.listening}|${!!v.pressed}`, () => {
        const go = this.app.querySelector('[data-go]');
        go.classList.toggle('ready', !!v.text && !v.listening);
        go.classList.toggle('pressed', !!v.pressed);
      });
    }

    const nk = p.notif ? p.notif.title + p.notif.body : null;
    if (nk !== this.notifKey) {
      this.notifKey = nk;
      if (p.notif) {
        this.notif.querySelector('b').textContent = p.notif.title;
        this.notif.querySelector('p').textContent = p.notif.body;
      }
      this.notif.classList.toggle('show', !!p.notif);
    }

    const h = Math.floor(clockMin / 60) % 12 || 12;
    const m = String(Math.floor(clockMin % 60)).padStart(2, '0');
    this.set('time', `${h}:${m}`, (v) => (this.timeEl.textContent = v));
  }
}
