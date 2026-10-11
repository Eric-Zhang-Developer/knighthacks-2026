// fred-bubble.js: the film's speech bubble ("pop chat") as a component. Cream paper, a speaker-tinted ink edge, a tail
// toward the speaker, typed out at 40 characters a second, then the blinking ▼ "more" cursor. No dependencies.
//
//   <script type="module" src="fred-bubble.js"></script>
//   <fred-bubble who="fred" tail="bottom-right"></fred-bubble>
//
//   const b = document.querySelector('fred-bubble');
//   await b.say('Smells familiar.')    // pops in, types; resolves when the last letter is down
//   b.close()                          // pops out (or b.say('…', { hold: 2500 }) closes itself after reading time)
//   b.typingMs('Smells familiar.')     // how long the typing takes: pair it with fred.talk(ms) on <fred-pet>
//
// Attributes: who = fred | lenny | pip (edge colour), tail = bottom-left | bottom | bottom-right | left | right | none,
// size = font px (default 18; the film uses 24-34 at 1080p). Text set as children shows at once (no typing).
// The style matches src/bubble.js exactly; BUBBLE_STYLE below lists the tokens.
//
// From knighthacks-2026-video pet/fred-bubble.js, minus the film's 12 fps edge "boil" (the wobble filter re-seeded 12
// times a second) beside the WebGL galaxy, like components/mentor/fred-pet.js; the edge keeps its still wobble.

export const BUBBLE_STYLE = {
  font: '"Pixelify Sans", "Silkscreen", ui-monospace, monospace',   // weight 500; Google Fonts, SIL Open Font License
  fontFile: 'fonts/PixelifySans500-latin.woff2',
  fill: '#FFF5E2',            // the film's cream paper (PAL.cream)
  text: '#2B2233',            // the film's ink (PAL.ink)
  edge: { fred: '#486C61', lenny: '#885546', pip: '#5D4F81', ink: '#2B2233' },   // speaker's dark colour, 45% toward ink
  radius: .55,                // x font size
  cps: 40,                    // typing speed, characters per second (the babble sound is timed to this)
  popIn: 220, popOut: 250,    // ms; pop-in overshoots (back-out), pop-out eases in
  cursorHz: 2.5,              // the ▼ blink once typing is done
};

// the font is declared once on the document (an @font-face inside a shadow root is ignored)
const FONT_URL = new URL('./fonts/PixelifySans500-latin.woff2', import.meta.url).href;
if (!document.getElementById('fred-bubble-font')) {
  const st = document.createElement('style'); st.id = 'fred-bubble-font';
  st.textContent = `@font-face { font-family: "Pixelify Sans"; font-weight: 500; font-display: swap; src: url("${FONT_URL}") format("woff2"); }`;
  document.head.append(st);
}

const CSS = `
:host { --size: 18px; --edge: ${BUBBLE_STYLE.edge.ink}; display: inline-block; max-width: 22ch; font-size: var(--size); }
:host([hidden]) { display: none; }
.b { position: relative; display: inline-block; background: ${BUBBLE_STYLE.fill}; color: ${BUBBLE_STYLE.text};
  font: 500 1em/1.25 ${BUBBLE_STYLE.font}; padding: .45em .85em .55em; border: max(2px, .11em) solid var(--edge);
  border-radius: ${BUBBLE_STYLE.radius}em; box-shadow: 0 .12em 0 rgba(43,34,51,.18); transform-origin: var(--origin, 50% 100%);
  filter: url(#wobble); }
.b.in { animation: pop-in ${BUBBLE_STYLE.popIn}ms cubic-bezier(.34,1.56,.64,1) both; }
.b.out { animation: pop-out ${BUBBLE_STYLE.popOut}ms cubic-bezier(.5,0,.75,0) both; }
.text { white-space: pre-wrap; overflow-wrap: anywhere; }
.ghost { visibility: hidden; }            /* untyped letters hold the final size, so the bubble doesn't grow as it types */
.more { position: absolute; right: .45em; bottom: .12em; font: .5em/1 sans-serif; color: var(--edge); opacity: 0; }
.more.on { animation: blink ${1000 / BUBBLE_STYLE.cursorHz}ms steps(1) infinite; }
/* the tail: two stacked triangles (edge colour, then fill) so it reads as one inked wedge */
.b::before, .b::after { content: ""; position: absolute; width: 0; height: 0; border: solid transparent; }
:host([tail="none"]) .b::before, :host([tail="none"]) .b::after { display: none; }
:host(:not([tail])) .b, :host([tail^="bottom"]) .b { --origin: 50% 120%; }
:host(:not([tail])) .b::before, :host([tail^="bottom"]) .b::before { top: 100%; border-width: .62em .42em 0; border-top-color: var(--edge); }
:host(:not([tail])) .b::after, :host([tail^="bottom"]) .b::after { top: calc(100% - max(2px, .11em) * 1.4); border-width: .48em .3em 0; border-top-color: ${BUBBLE_STYLE.fill}; }
:host(:not([tail])) .b::before, :host([tail="bottom"]) .b::before { left: calc(50% - .42em); }
:host(:not([tail])) .b::after, :host([tail="bottom"]) .b::after { left: calc(50% - .3em); }
:host([tail="bottom-left"]) .b { --origin: 15% 120%; }
:host([tail="bottom-left"]) .b::before { left: 1em; } :host([tail="bottom-left"]) .b::after { left: calc(1em + .12em); }
:host([tail="bottom-right"]) .b { --origin: 85% 120%; }
:host([tail="bottom-right"]) .b::before { right: 1em; } :host([tail="bottom-right"]) .b::after { right: calc(1em + .12em); }
:host([tail="left"]) .b { --origin: -10% 50%; }
:host([tail="left"]) .b::before { right: 100%; top: calc(50% - .42em); border-width: .42em .62em .42em 0; border-right-color: var(--edge); }
:host([tail="left"]) .b::after { right: calc(100% - max(2px, .11em) * 1.4); top: calc(50% - .3em); border-width: .3em .48em .3em 0; border-right-color: ${BUBBLE_STYLE.fill}; }
:host([tail="right"]) .b { --origin: 110% 50%; }
:host([tail="right"]) .b::before { left: 100%; top: calc(50% - .42em); border-width: .42em 0 .42em .62em; border-left-color: var(--edge); }
:host([tail="right"]) .b::after { left: calc(100% - max(2px, .11em) * 1.4); top: calc(50% - .3em); border-width: .3em 0 .3em .48em; border-left-color: ${BUBBLE_STYLE.fill}; }
@keyframes pop-in { from { transform: scale(.2); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes pop-out { to { transform: scale(.4); opacity: 0; } }
@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .b.in, .b.out { animation-duration: 1ms; } .more.on { animation: none; opacity: 1; } .b { filter: none; } }`;

// the film's hand-drawn edge: a faint displacement (still here; the film re-seeds it 12 times a second)
const WOBBLE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="wobble">
  <feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="1"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></svg>`;

class FredBubble extends HTMLElement {
  static observedAttributes = ['who', 'size'];
  #b; #text; #ghost; #more; #timer = null; #token = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style>${WOBBLE}<div class="b" part="bubble"><span class="text" aria-live="polite"><slot></slot></span><span class="ghost" aria-hidden="true"></span><span class="more" aria-hidden="true">▼</span></div>`;
    this.#b = root.querySelector('.b'); this.#text = root.querySelector('.text');
    this.#ghost = root.querySelector('.ghost'); this.#more = root.querySelector('.more');
  }
  connectedCallback() { this.#apply(); }
  disconnectedCallback() { clearTimeout(this.#timer); }
  attributeChangedCallback() { this.#apply(); }
  #apply() {
    const who = this.getAttribute('who'), size = this.getAttribute('size');
    this.style.setProperty('--edge', BUBBLE_STYLE.edge[who] || BUBBLE_STYLE.edge.ink);
    if (size) this.style.setProperty('--size', `${parseFloat(size)}px`);
  }

  typingMs(text, cps = BUBBLE_STYLE.cps) { return Math.round([...text].length / cps * 1000); }
  /** The shortest time a line should stay up after it appears: typing, a beat to find it, then reading. */
  holdMs(text) { return this.typingMs(text) + 800 + [...text].length / 15 * 1000; }

  /** Pop in and type `text`. Resolves when typing finishes. opts.cps, opts.hold (ms after it appears, then closes). */
  say(text, opts = {}) {
    const token = ++this.#token, cps = opts.cps ?? BUBBLE_STYLE.cps, chars = [...text];
    clearTimeout(this.#timer);
    this.hidden = false;
    this.#text.textContent = ''; this.#ghost.textContent = text; this.#more.classList.remove('on');
    this.#b.classList.remove('out', 'in'); void this.#b.offsetWidth; this.#b.classList.add('in');
    const t0 = performance.now();
    if (opts.hold) setTimeout(() => token === this.#token && this.close(), opts.hold);
    return new Promise((done) => {
      const tick = () => {
        if (token !== this.#token) return done();
        const n = Math.min(chars.length, Math.floor((performance.now() - t0) / 1000 * cps));
        this.#text.textContent = chars.slice(0, n).join(''); this.#ghost.textContent = chars.slice(n).join('');
        if (n < chars.length) this.#timer = setTimeout(tick, 1000 / cps);
        else { this.#timer = setTimeout(() => this.#more.classList.add('on'), 150); done(); }
      };
      tick();
    });
  }

  /** Pop out. Resolves once it's gone (the element is then hidden). */
  close() {
    const token = ++this.#token;
    clearTimeout(this.#timer); this.#more.classList.remove('on');
    this.#b.classList.remove('in'); this.#b.classList.add('out');
    return new Promise((done) => setTimeout(() => { if (token === this.#token) this.hidden = true; done(); }, BUBBLE_STYLE.popOut));
  }
}

if (!customElements.get('fred-bubble')) customElements.define('fred-bubble', FredBubble);
export { FredBubble };
