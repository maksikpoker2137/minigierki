// Personalizacja kolorów: tło strony oraz ziemia i lawa w Arenie Lawy – paleta gotowych kolorów albo własny kolor.
// Wybór zapamiętuje się w przeglądarce. Arena czyta go przez Theme.arena() i odświeża się na zdarzenie 'themechange'.
(function () {
  const KEY = 'motyw';
  const PAGE = [['Fiolet (domyślny)', null], ['Granat', '#14264a'], ['Morski', '#0f3b45'], ['Las', '#173a2a'], ['Burgund', '#3d1a2e'], ['Grafit', '#25262e'], ['Czekolada', '#3a2a22'], ['Śliwka', '#331d4d']];
  const GROUND = [['Z mapy', null], ['Ruda ziemia', '#7b3d28'], ['Piasek', '#a08350'], ['Trawa', '#3f6b3a'], ['Skała', '#5a5560'], ['Lód', '#5b86a3'], ['Noc', '#2a2748'], ['Różowy', '#a8477a']];
  const LAVA = [['Z mapy', null], ['Lawa', '#f7870c'], ['Kwas', '#7ed321'], ['Woda', '#2e9be6'], ['Magma', '#e0261f'], ['Fiolet', '#8a3cff'], ['Złoto', '#ffc61a'], ['Cukier', '#ff5db1']];

  let st = { page: null, ground: null, lava: null };
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o) st = Object.assign(st, o); } catch (e) { /* brak pamięci – motyw domyślny */ }
  const ok = c => (/^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null);
  st = { page: ok(st.page), ground: ok(st.ground), lava: ok(st.lava) };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* trudno */ } };

  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = h => { const [r, g, b] = rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

  // kolory strony wyprowadzone z jednego koloru tła (zbyt jasny kolor przyciemniamy, żeby biały tekst był czytelny)
  function applyPage() {
    const r = document.documentElement.style, names = ['--bg', '--bg2', '--card', '--card2', '--line'];
    if (!st.page) { names.forEach(n => r.removeProperty(n)); return; }
    let b = st.page; while (lum(b) > 0.3) b = mix(b, '#000000', 0.15);
    r.setProperty('--bg', b); r.setProperty('--bg2', mix(b, '#000000', 0.3)); r.setProperty('--card', mix(b, '#ffffff', 0.08));
    r.setProperty('--card2', mix(b, '#ffffff', 0.16)); r.setProperty('--line', mix(b, '#ffffff', 0.28));
  }
  const changed = () => { save(); applyPage(); window.dispatchEvent(new Event('themechange')); render(); };

  let box = null;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function section(key, title, list) {
    const cur = st[key];
    return `<div class="th-sec"><b>${title}</b><div class="th-sw">${list.map(([n, c]) =>
      `<button type="button" class="th-c ${cur === c ? 'on' : ''}" data-k="${key}" data-c="${c || ''}" title="${esc(n)}" aria-label="${esc(n)}" style="${c ? 'background:' + c : ''}">${c ? '' : '↺'}</button>`).join('')}
      <label class="th-own" title="Własny kolor">+<input type="color" data-own="${key}" value="${cur || '#7b3d28'}"></label></div></div>`;
  }
  function render() {
    if (!box || box.hidden) return;
    box.querySelector('.th-body').innerHTML =
      section('page', 'Tło strony', PAGE) + section('ground', 'Arena – kolor ziemi', GROUND) + section('lava', 'Arena – kolor lawy', LAVA) +
      '<p class="th-note">Kolory zapisują się w tej przeglądarce. „↺” wraca do domyślnego.</p>';
    box.querySelectorAll('.th-c').forEach(b => b.onclick = () => { st[b.dataset.k] = ok(b.dataset.c); changed(); });
    box.querySelectorAll('[data-own]').forEach(i => i.oninput = () => { st[i.dataset.own] = ok(i.value); save(); applyPage(); window.dispatchEvent(new Event('themechange')); });
    box.querySelectorAll('[data-own]').forEach(i => i.onchange = render);
  }
  function open() {
    if (!box) {
      box = document.createElement('div'); box.className = 'th-pop'; box.hidden = true;
      box.innerHTML = '<div class="th-head"><b>🎨 Kolory</b><button type="button" class="ghost th-x" aria-label="Zamknij">✕</button></div><div class="th-body"></div>';
      document.body.appendChild(box);
      box.querySelector('.th-x').onclick = () => { box.hidden = true; };
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) box.hidden = true; });
    }
    box.hidden = !box.hidden; render();
  }

  window.Theme = {
    // kolory areny (null = użyj koloru z mapy)
    arena: () => ({ ground: st.ground, lava: st.lava }), mix, open
  };
  applyPage();
  document.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('theme-btn'); if (b) b.onclick = open; });
})();
