// Efekty dźwiękowe syntezowane w przeglądarce (Web Audio) – bez plików audio.
// Sfx.play('hitmark'|'hurt'|'hit'|'die'|'frag'|'boom'|'pick'|'shot'|'cannon'|'splash'|'explode'|'sunk'|'place'|'turn'|'sonar'|'lose', { w: broń, vol: 0..1 }); Sfx.toggle() włącza/wyłącza dźwięk.
(function () {
  const KEY = 'dzwiek';
  let ctx = null, master = null, noiseBuf = null, muted = false, lastAt = {};
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) { /* bez pamięci – dźwięk włączony */ }

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  // przeglądarki blokują dźwięk do pierwszego kliknięcia/klawisza – wtedy go odblokowujemy
  const unlock = () => { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));

  // pojedynczy ton z obwiednią głośności i opcjonalnym przesunięciem częstotliwości
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  // szum filtrowany (strzały, wybuchy)
  function noise(dur, vol, freq, type, delay, q) {
    const t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const SHOT = { // [szum Hz, długość, głośność, ton Hz]
    pistol: [2200, 0.09, 0.35, 220], smg: [2600, 0.06, 0.25, 260], rifle: [1900, 0.08, 0.32, 180], revolver: [1200, 0.16, 0.5, 120],
    shotgun: [900, 0.22, 0.6, 90], minigun: [3000, 0.04, 0.2, 300], flame: [1400, 0.07, 0.2, 0], sniper: [700, 0.35, 0.6, 70], rocket: [500, 0.3, 0.5, 60]
  };
  const SOUNDS = {
    shot(o) { const c = SHOT[o.w] || SHOT.pistol, v = o.vol; noise(c[1], c[2] * v, c[0], o.w === 'flame' ? 'bandpass' : 'lowpass'); if (c[3]) tone('square', c[3] * 1.6, c[3] * 0.5, c[1], 0.12 * v); },
    hitmark(o) { tone('sine', 1500, 1500, 0.06, 0.35 * o.vol); tone('sine', 2200, 2200, 0.09, 0.3 * o.vol, 0.05); },   // trafiłeś wroga
    hurt(o) { tone('square', 190, 70, 0.14, 0.4 * o.vol); noise(0.12, 0.35 * o.vol, 700); },                         // oberwałeś
    hit(o) { tone('triangle', 420, 200, 0.07, 0.2 * o.vol); },                                                        // ktoś trafił kogoś
    die(o) { tone('sawtooth', 420, 45, 0.7, 0.45 * o.vol); noise(0.5, 0.4 * o.vol, 500); tone('square', 160, 40, 0.5, 0.25 * o.vol, 0.1); }, // własna śmierć
    death(o) { tone('sawtooth', 330, 60, 0.45, 0.25 * o.vol); noise(0.35, 0.25 * o.vol, 600); },                    // śmierć innego gracza
    frag(o) { [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.12, 0.2 * o.vol, i * 0.07)); },        // twój frag
    boom(o) { noise(0.7, 0.7 * o.vol, 420); tone('sine', 110, 30, 0.6, 0.6 * o.vol); },
    pick(o) { tone('triangle', 660, 660, 0.07, 0.25 * o.vol); tone('triangle', 990, 990, 0.1, 0.25 * o.vol, 0.06); },
    win(o) { [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.2, 0.28 * o.vol, i * 0.11)); },
    // ---- Statki ----
    cannon(o) { noise(0.35, 0.6 * o.vol, 520); tone('sine', 150, 38, 0.32, 0.55 * o.vol); noise(0.12, 0.3 * o.vol, 2400, 'highpass'); },          // wystrzał z armaty
    whistle(o) { tone('sine', 1500, 520, 0.38, 0.1 * o.vol); },                                                                                  // pocisk w locie
    splash(o) { noise(0.5, 0.45 * o.vol, 900, 'bandpass', 0, 0.9); noise(0.35, 0.3 * o.vol, 2600, 'bandpass', 0.08, 1.2); [420, 560, 380].forEach((f, i) => tone('sine', f, f * 1.8, 0.09, 0.14 * o.vol, 0.12 + i * 0.07)); }, // pudło: plusk i bąbelki
    explode(o) { noise(0.55, 0.75 * o.vol, 700); tone('sine', 120, 30, 0.5, 0.6 * o.vol); noise(0.35, 0.3 * o.vol, 3200, 'highpass', 0.05); tone('sawtooth', 220, 60, 0.3, 0.18 * o.vol); }, // trafienie
    sunk(o) { noise(0.9, 0.8 * o.vol, 500); tone('sine', 100, 25, 0.9, 0.7 * o.vol); tone('sawtooth', 380, 50, 1.2, 0.3 * o.vol, 0.15); [300, 260, 220, 180].forEach((f, i) => tone('sine', f, f * 0.6, 0.18, 0.2 * o.vol, 0.5 + i * 0.16)); }, // zatopiony
    place(o) { tone('square', 180, 90, 0.08, 0.25 * o.vol); noise(0.06, 0.25 * o.vol, 1800); },                                                   // postawienie statku
    turn(o) { tone('sine', 880, 880, 0.12, 0.22 * o.vol); tone('sine', 1320, 1320, 0.16, 0.22 * o.vol, 0.1); },                                   // twoja kolej
    sonar(o) { tone('sine', 1000, 1000, 0.7, 0.3 * o.vol); tone('sine', 1000, 1000, 0.9, 0.12 * o.vol, 0.35); },                                  // początek bitwy
    lose(o) { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.3, 0.28 * o.vol, i * 0.2)); }
  };

  window.Sfx = {
    play(name, o) {
      if (muted || !SOUNDS[name] || !init() || ctx.state !== 'running') return;
      o = Object.assign({ vol: 1 }, o);
      const now = performance.now(), key = name + (o.w || ''); // zabezpieczenie przed zalewem dźwięków (np. minigun)
      if (lastAt[key] && now - lastAt[key] < (name === 'shot' ? 35 : 25)) return;
      lastAt[key] = now;
      try { SOUNDS[name](o); } catch (e) { /* dźwięk nie jest ważny dla gry */ }
    },
    isMuted: () => muted,
    toggle() { muted = !muted; try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (e) { /* trudno */ } if (!muted) { unlock(); this.play('pick'); } return muted; }
  };
})();
