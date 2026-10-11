// fred-pet.js: Fred, the film's sleepy green judge dragon, as a clickable pet. One file, no dependencies, transparent
// background, scales with its CSS width (height follows, 240:260). From knighthacks-2026-video pet/fred-pet.js
// (26d2e6b), minus the film's 12 fps line "boil": an SVG displacement filter re-rendered 12 times a second, forever,
// beside the WebGL galaxy. In this app the voice button owns clicks and keyboard; Fred is drawn inside it.
//
//   <script type="module" src="fred-pet.js"></script>
//   <fred-pet style="width:96px"></fred-pet>
//
//   const fred = document.querySelector('fred-pet');
//   fred.talk(2400)        // mouth babbles for 2.4 s (or fred.talking = true / false while a reply streams in)
//   fred.poke()            // the tap reaction (also on click, Enter or Space); fires a 'fred-poke' event
//   fred.sleeping = true   // eyes shut, slow breath, a little "z"
//   fred.addEventListener('fred-poke', () => openTheAssistant())
//
// States: idle (breathes, blinks, tail sways, a fin flicks now and then) · talking · poked (squash-and-stretch hop,
// happy eyes, a smoke puff) · sleeping. Honors prefers-reduced-motion (no loops; the poke is a quick nod).
// Palette and shapes follow the film's rig (src/dragon.js DRAGONS.fred): body #A5DDB8, dark #5FA987, light #DDF5E4,
// cream #F6E8CB, ink #2B2233. In React/Next: import './fred-pet.js' inside a client component ('use client'), then
// render <fred-pet /> and attach listeners with a ref.

const INK = '#2B2233', COL = '#A5DDB8', DK = '#5FA987', LT = '#DDF5E4', CREAM = '#F6E8CB', CREAM_DK = '#D8C298';
const BEAN = '#F3B9AE', BLUSH = '#F2A0A6', HATCH = '#B4545E';

const SVG = `
<svg viewBox="0 0 240 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g class="all" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">
    <ellipse class="shadow" cx="120" cy="252" rx="78" ry="7" fill="${INK}" opacity=".18" stroke="none"/>
    <g class="hop">
      <g class="tail">
        <path d="M160 226 C192 232 214 218 218 196 C220 186 214 178 208 182 C206 200 190 212 160 206 Z" fill="${COL}"/>
        <path d="M197 205 l9 -11 l2 13 Z M211 188 l11 -6 l-3 13 Z" fill="${CREAM}" stroke-width="3"/>
      </g>
      <g class="wings">
        <path d="M70 150 L40 136 L46 152 L32 160 L50 166 L44 180 L72 176 Z" fill="${CREAM}" stroke-width="3.5"/>
        <path d="M170 150 L200 136 L194 152 L208 160 L190 166 L196 180 L168 176 Z" fill="${CREAM}" stroke-width="3.5"/>
      </g>
      <g class="body">
        <ellipse cx="120" cy="178" rx="54" ry="54" fill="${COL}"/>
        <ellipse cx="120" cy="182" rx="35" ry="42" fill="${CREAM}" stroke-width="3"/>
        <path d="M92 166 Q120 174 148 166 M89 184 Q120 192 151 184 M93 202 Q120 209 147 202" fill="none" stroke="${CREAM_DK}" stroke-width="2.5"/>
        <g class="arms">
          <path d="M84 146 C76 156 78 174 90 180 C98 176 100 160 96 148 Z" fill="${COL}"/>
          <path d="M156 146 C164 156 162 174 150 180 C142 176 140 160 144 148 Z" fill="${COL}"/>
          <g fill="#FFFBF2" stroke-width="2"><circle cx="88" cy="181" r="2.6"/><circle cx="94" cy="180" r="2.6"/><circle cx="146" cy="180" r="2.6"/><circle cx="152" cy="181" r="2.6"/></g>
        </g>
      </g>
      <g class="feet">
        <g transform="translate(84 228)">
          <path d="M-14 -24 l4 -9 l3 9 M-2 -27 l4 -9 l3 9 M10 -24 l4 -8 l2 9" fill="#FFFBF2" stroke-width="2.5"/>
          <circle r="27" fill="${COL}"/><ellipse cy="3" rx="20" ry="18" fill="${CREAM}" stroke-width="2.5"/>
          <g fill="${BEAN}" stroke-width="2"><circle cx="-9" cy="-6" r="3.6"/><circle cx="0" cy="-8" r="3.6"/><circle cx="9" cy="-6" r="3.6"/><ellipse cy="8" rx="8.5" ry="7"/></g>
        </g>
        <g transform="translate(156 228)">
          <path d="M-16 -24 l3 -9 l4 9 M-5 -27 l3 -9 l4 9 M7 -24 l3 -9 l4 9" fill="#FFFBF2" stroke-width="2.5"/>
          <circle r="27" fill="${COL}"/><ellipse cy="3" rx="20" ry="18" fill="${CREAM}" stroke-width="2.5"/>
          <g fill="${BEAN}" stroke-width="2"><circle cx="-9" cy="-6" r="3.6"/><circle cx="0" cy="-8" r="3.6"/><circle cx="9" cy="-6" r="3.6"/><ellipse cy="8" rx="8.5" ry="7"/></g>
        </g>
      </g>
      <g class="head">
        <path class="horn hl" d="M90 52 C82 30 68 18 46 14 C60 24 66 38 70 60 Z" fill="${CREAM}"/>
        <path class="horn hr" d="M150 52 C158 30 172 18 194 14 C180 24 174 38 170 60 Z" fill="${CREAM}"/>
        <path d="M114 40 L120 24 L126 40 Z" fill="${CREAM}" stroke-width="3.5"/>
        <path class="fin fl" d="M58 86 L14 74 L26 92 L16 110 L60 106 Z" fill="${COL}"/>
        <path class="fin fr" d="M182 86 L226 74 L214 92 L224 110 L180 106 Z" fill="${COL}"/>
        <path d="M24 82 L50 90 M24 102 L50 100 M216 82 L190 90 M216 102 L190 100" stroke="${DK}" stroke-width="2.5" fill="none"/>
        <ellipse cx="120" cy="96" rx="68" ry="60" fill="${COL}"/>
        <ellipse cx="120" cy="120" rx="52" ry="30" fill="${LT}" stroke="none" opacity=".75"/>
        <g class="blush" stroke="none">
          <ellipse cx="76" cy="116" rx="13" ry="8" fill="${BLUSH}" opacity=".5"/><ellipse cx="164" cy="116" rx="13" ry="8" fill="${BLUSH}" opacity=".5"/>
          <path d="M71 111 v9 M76 111 v9 M81 111 v9 M159 111 v9 M164 111 v9 M169 111 v9" stroke="${HATCH}" stroke-width="1.8"/>
        </g>
        <g class="eyes">
          <g class="open">
            <g class="iris"><path d="M85 95 a11 9 0 0 0 22 0 Z M133 95 a11 9 0 0 0 22 0 Z" fill="${INK}" stroke="none"/>
              <circle cx="91" cy="99" r="2" fill="#fff" stroke="none"/><circle cx="139" cy="99" r="2" fill="#fff" stroke="none"/></g>
            <path class="lid" d="M81 99 Q93 89 110 93 M130 93 Q147 89 159 99" fill="none" stroke-width="4"/>
          </g>
          <path class="shut" d="M84 98 Q96 106 108 98 M132 98 Q144 106 156 98" fill="none" stroke-width="4"/>
          <path class="happy" d="M85 101 Q96 88 107 101 M133 101 Q144 88 155 101" fill="none" stroke-width="4"/>
        </g>
        <g fill="${INK}" stroke="none"><ellipse cx="112" cy="116" rx="2.6" ry="3.4"/><ellipse cx="128" cy="116" rx="2.6" ry="3.4"/></g>
        <ellipse class="mouth" cx="120" cy="131" rx="7" ry="5" fill="#5A2A3A" stroke-width="3"/>
        <path d="M109 127 l3 7 l3 -7 Z M125 127 l3 7 l3 -7 Z" fill="#FFFBF2" stroke-width="2"/>
      </g>
    </g>
    <circle class="puff" cx="168" cy="118" r="9" fill="none" stroke="${CREAM_DK}" stroke-width="3.5"/>
    <text class="zzz" x="186" y="44" font-family="ui-rounded, system-ui, sans-serif" font-weight="700" font-size="22" fill="${CREAM}" stroke="none">z</text>
  </g>
</svg>`;

const CSS = `
:host { display: inline-block; width: 96px; aspect-ratio: 240 / 260; cursor: pointer; -webkit-tap-highlight-color: transparent; }
:host(:focus-visible) { outline: 2px solid #7FE3F5; outline-offset: 4px; border-radius: 12px; }
svg { width: 100%; height: 100%; overflow: visible; display: block;
  filter: drop-shadow(0 0 1.2px rgba(255,245,226,.7)) drop-shadow(0 0 5px rgba(165,221,184,.22)); }   /* a sticker rim: the ink outline vanishes on the app's near-black */
g, path, ellipse, circle { transform-box: fill-box; }
.hop { transform-origin: 50% 100%; }
.head { transform-origin: 50% 85%; animation: bob 3.2s ease-in-out infinite; }
.body { transform-origin: 50% 100%; animation: breathe 3.2s ease-in-out infinite; }
.tail { transform-origin: 0% 80%; animation: sway 4.4s ease-in-out infinite; }
.wings { transform-origin: 50% 50%; }
.fl { transform-origin: 100% 50%; } .fr { transform-origin: 0% 50%; }
.fr { animation: flick 7s ease-in-out infinite 2s; }
.iris { transform-origin: 50% 0%; }
.mouth { transform-origin: 50% 0%; transform: scaleY(0); transition: transform .07s; }
.shut, .happy, .zzz, .puff { opacity: 0; }
.puff { transform-origin: 50% 50%; }
.blink .iris { transform: scaleY(.08); } .blink .lid { transform: translateY(5px); }
:host([talking]) .head { animation: chatter .32s ease-in-out infinite; }
:host([sleeping]) .open { opacity: 0; } :host([sleeping]) .shut { opacity: 1; }
:host([sleeping]) .head, :host([sleeping]) .body { animation-duration: 5s; }
:host([sleeping]) .zzz { animation: zzz 2.6s ease-in-out infinite; }
.poked .hop { animation: hop .62s cubic-bezier(.3,.7,.4,1); }
.poked .open { opacity: 0; } .poked .happy { opacity: 1; }
.poked .fl { animation: wiggle .62s ease-in-out; } .poked .fr { animation: wiggle .62s ease-in-out reverse; }
.poked .wings { animation: flap .62s ease-in-out; }
.poked .blush { filter: saturate(1.8) brightness(1.05); }
.poked .puff { animation: puff .9s ease-out; }
@keyframes breathe { 50% { transform: scale(1.025, 1.035); } }
@keyframes bob { 50% { transform: translateY(1.6px) rotate(-.6deg); } }
@keyframes sway { 50% { transform: rotate(7deg); } }
@keyframes flick { 0%, 90%, 100% { transform: none; } 94% { transform: rotate(-14deg); } 97% { transform: rotate(5deg); } }
@keyframes chatter { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-1.8px) rotate(.8deg); } }
@keyframes hop { 0% { transform: none; } 18% { transform: scale(1.08, .88); } 45% { transform: translateY(-16px) scale(.94, 1.08); }
  72% { transform: translateY(0) scale(1.06, .93); } 100% { transform: none; } }
@keyframes wiggle { 30% { transform: rotate(-16deg); } 65% { transform: rotate(10deg); } }
@keyframes flap { 35% { transform: scaleY(1.25) translateY(-4px); } }
@keyframes puff { 0% { opacity: .9; transform: translate(0, 0) scale(.6); } 100% { opacity: 0; transform: translate(10px, -34px) scale(1.6); } }
@keyframes zzz { 0% { opacity: 0; transform: translate(0, 6px); } 30% { opacity: .9; } 100% { opacity: 0; transform: translate(8px, -14px); } }
@media (prefers-reduced-motion: reduce) {
  .head, .body, .tail, .fr, :host([talking]) .head, :host([sleeping]) .zzz { animation: none; }
  .poked .hop { animation: nod .3s ease-out; } .poked .puff, .poked .fl, .poked .fr, .poked .wings { animation: none; }
  @keyframes nod { 50% { transform: translateY(-3px); } }
}`;

class FredPet extends HTMLElement {
  static observedAttributes = ['talking', 'sleeping'];
  #root; #svg; #mouth; #timers = new Set(); #talkTimer = null; #reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `<style>${CSS}</style>${SVG}`;
    this.#svg = this.#root.querySelector('svg');
    this.#mouth = this.#root.querySelector('.mouth');
  }

  connectedCallback() {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Fred, your guide. Tap to talk.');
    this.addEventListener('click', this.#onPoke);
    this.addEventListener('keydown', this.#onKey);
    this.#loop('blink', () => 2600 + Math.random() * 3200, () => {
      if (this.sleeping) return;
      this.#svg.classList.add('blink'); this.#later(() => this.#svg.classList.remove('blink'), 130);
    });
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onPoke);
    this.removeEventListener('keydown', this.#onKey);
    for (const t of this.#timers) clearTimeout(t);
    this.#timers.clear(); this.#stopMouth();
  }

  attributeChangedCallback(name) {
    if (name !== 'talking') return;
    if (this.hasAttribute('talking')) this.#startMouth(); else this.#stopMouth();
  }

  get talking() { return this.hasAttribute('talking'); }
  set talking(on) { this.toggleAttribute('talking', !!on); }
  get sleeping() { return this.hasAttribute('sleeping'); }
  set sleeping(on) { this.toggleAttribute('sleeping', !!on); }

  /** Babble for `ms` milliseconds (default: until talking = false). */
  talk(ms) {
    this.sleeping = false; this.talking = true;
    if (ms) this.#later(() => { this.talking = false; }, ms);
  }

  /** The tap reaction. Wakes him if asleep. */
  poke() {
    this.sleeping = false;
    this.#svg.classList.remove('poked'); void this.#svg.getBoundingClientRect();   // restart the animation
    this.#svg.classList.add('poked');
    this.#later(() => this.#svg.classList.remove('poked'), 900);
    this.dispatchEvent(new CustomEvent('fred-poke', { bubbles: true, composed: true }));
  }

  #onPoke = () => this.poke();
  #onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.poke(); } };

  // the mouth flaps in uneven syllables, not a metronome
  #startMouth() {
    this.#stopMouth();
    const step = () => {
      const open = Math.random() < .2 ? 0 : .35 + Math.random() * .65;
      this.#mouth.style.transform = `scaleY(${open})`;
      this.#talkTimer = setTimeout(step, 70 + Math.random() * 110);
    };
    step();
  }
  #stopMouth() { clearTimeout(this.#talkTimer); this.#talkTimer = null; if (this.#mouth) this.#mouth.style.transform = ''; }

  #later(fn, ms) { const t = setTimeout(() => { this.#timers.delete(t); fn(); }, ms); this.#timers.add(t); return t; }
  #loop(_name, delay, fn) { const tick = () => { fn(); this.#later(tick, delay()); }; this.#later(tick, delay()); }
}

if (!customElements.get('fred-pet')) customElements.define('fred-pet', FredPet);
export { FredPet };
