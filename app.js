/* ==========================================================================
   Restaurant Finder — Nice, France
   Pure static vanilla JS. No build step.

   Architecture guardrails (enforced here):
   - Geographic lock:   every Overpass query uses NICE_BBOX (hardcoded).
                        responses re-validated client-side before render.
   - Data integrity:    no silent fallback to mock data; explicit error UI.
   - Input validation:  all user inputs come from <select>/<input type=checkbox>
                        (whitelisted); no free-text surface.
   - No hardcoded keys: keyless API by design (Overpass).
   ========================================================================== */

(() => {
  'use strict';

  /* ----------------------------- Constants ----------------------------- */

  // Must match window.NICE_BBOX in data/neighborhoods.js. We re-assert here
  // defensively so the guard works even if neighborhoods.js is tampered with.
  const NICE_BBOX = Object.freeze({
    south: 43.65,
    west:  7.20,
    north: 43.75,
    east:  7.32,
  });

  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  const QUERY_TIMEOUT_S = 25;

  /* -------------------------------- State ------------------------------ */

  const state = {
    lang: 'fr',
    restaurants: [],
    filtered: [],
    filters: {
      neighborhood: 'all',
      cuisine: '',
      openNow: false,
    },
  };

  /* ---------------------------- Translations --------------------------- */

  const STRINGS = {
    fr: {
      'app.title':              'Restaurants à Nice',
      'app.tagline':            'Uniquement Nice, France — données OpenStreetMap.',
      'label.neighborhood':     'Quartier',
      'label.cuisine':          'Cuisine',
      'label.openNow':          'Ouvert maintenant',
      'status.loading':         'Chargement des restaurants…',
      'status.error.network':   'Impossible de joindre OpenStreetMap. Vérifiez votre connexion.',
      'status.error.shape':     'Réponse invalide du serveur. Réessayez.',
      'status.error.outOfScope':'Seule Nice est prise en charge dans cette version.',
      'status.retry':           'Réessayer',
      'status.resultsOne':      '{n} restaurant trouvé',
      'status.resultsMany':     '{n} restaurants trouvés',
      'status.empty':           'Aucun restaurant ne correspond à vos critères.',
      'card.noCuisine':         'Cuisine non précisée',
      'card.noAddress':         'Adresse non précisée',
      'card.open':              'Ouvert',
      'card.closed':            'Fermé',
      'card.hoursUnknown':      'Horaires inconnus',
      'card.details':           'Détails',
      'detail.cuisine':         'Cuisine',
      'detail.address':         'Adresse',
      'detail.hours':           'Horaires',
      'detail.phone':           'Téléphone',
      'detail.website':         'Site web',
      'cuisine.any':            'Toutes',
      'footer.attribution':     'Données © contributeurs OpenStreetMap — ODbL',
    },
    en: {
      'app.title':              'Restaurants in Nice',
      'app.tagline':            'Nice, France only — OpenStreetMap data.',
      'label.neighborhood':     'Neighborhood',
      'label.cuisine':          'Cuisine',
      'label.openNow':          'Open now',
      'status.loading':         'Loading restaurants…',
      'status.error.network':   'Could not reach OpenStreetMap. Check your connection.',
      'status.error.shape':     'Invalid response from server. Try again.',
      'status.error.outOfScope':'Only Nice is supported in this version.',
      'status.retry':           'Retry',
      'status.resultsOne':      '{n} restaurant found',
      'status.resultsMany':     '{n} restaurants found',
      'status.empty':           'No restaurants match your filters.',
      'card.noCuisine':         'Cuisine not specified',
      'card.noAddress':         'Address not specified',
      'card.open':              'Open',
      'card.closed':            'Closed',
      'card.hoursUnknown':      'Hours unknown',
      'card.details':           'Details',
      'detail.cuisine':         'Cuisine',
      'detail.address':         'Address',
      'detail.hours':           'Hours',
      'detail.phone':           'Phone',
      'detail.website':         'Website',
      'cuisine.any':            'Any',
      'footer.attribution':     'Data © OpenStreetMap contributors — ODbL',
    },
  };

  function t(key, vars) {
    const table = STRINGS[state.lang] || STRINGS.fr;
    let s = table[key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
      }
    }
    return s;
  }

  /* ----------------------------- Utilities ----------------------------- */

  function escapeHtml(input) {
    return String(input ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function isInBbox(lat, lng, bbox) {
    const [s, w, n, e] = bbox;
    return (
      typeof lat === 'number' && typeof lng === 'number' &&
      lat >= s && lat <= n && lng >= w && lng <= e
    );
  }

  function isInNice(lat, lng) {
    return isInBbox(lat, lng, [
      NICE_BBOX.south, NICE_BBOX.west, NICE_BBOX.north, NICE_BBOX.east,
    ]);
  }

  function safeUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `https://${u}`;
  }

  function formatCuisine(raw) {
    if (!raw) return '';
    return raw
      .split(';')
      .map(c => c.trim().replace(/_/g, ' '))
      .filter(Boolean)
      .join(', ');
  }

  /* ------------------------------ Overpass ----------------------------- */

  function buildOverpassQuery() {
    const { south, west, north, east } = NICE_BBOX;
    const b = `${south},${west},${north},${east}`;
    return `
[out:json][timeout:${QUERY_TIMEOUT_S}];
(
  node["amenity"="restaurant"](${b});
  way["amenity"="restaurant"](${b});
  relation["amenity"="restaurant"](${b});
);
out center tags;
    `.trim();
  }

  async function fetchOverpass() {
    const body = `data=${encodeURIComponent(buildOverpassQuery())}`;
    let lastError;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (!res.ok) {
          lastError = new NetworkError(`HTTP ${res.status}`);
          continue;
        }
        const json = await res.json();
        if (!json || !Array.isArray(json.elements)) {
          throw new ShapeError('Missing "elements" array');
        }
        return json.elements;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new NetworkError('Unknown network failure');
  }

  class NetworkError extends Error {
    constructor(msg) { super(msg); this.name = 'NetworkError'; }
  }
  class ShapeError extends Error {
    constructor(msg) { super(msg); this.name = 'ShapeError'; }
  }

  /* ---------------------------- Parse / guard -------------------------- */

  function parseElement(el) {
    if (!el || typeof el !== 'object') return null;
    const tags = el.tags || {};
    if (!tags.name) return null; // skip unnamed POIs

    const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
    const lng = typeof el.lon === 'number' ? el.lon : el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;

    return {
      id: `${el.type}/${el.id}`,
      name: String(tags.name).slice(0, 200),
      cuisine: tags.cuisine ? String(tags.cuisine).slice(0, 200) : '',
      address: buildAddress(tags),
      phone: (tags.phone || tags['contact:phone'] || '').toString().slice(0, 64),
      website: (tags.website || tags['contact:website'] || '').toString().slice(0, 512),
      opening_hours: tags.opening_hours ? String(tags.opening_hours).slice(0, 512) : '',
      lat,
      lng,
    };
  }

  function buildAddress(tags) {
    const line1 = [tags['addr:housenumber'], tags['addr:street']]
      .filter(Boolean).join(' ');
    const line2 = [tags['addr:postcode'], tags['addr:city']]
      .filter(Boolean).join(' ');
    return [line1, line2].filter(Boolean).join(', ');
  }

  function validateAndNormalize(elements) {
    const out = [];
    for (const el of elements) {
      const r = parseElement(el);
      if (!r) continue;
      // Geographic guard: re-check every result against Nice bbox.
      if (!isInNice(r.lat, r.lng)) continue;
      out.push(r);
    }
    // Stable sort by name for predictable display
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return out;
  }

  /* ----------------------------- Open-now ------------------------------ */



  function computeOpenState(hoursStr) {
    const OH = (typeof window !== 'undefined' && window.opening_hours) || null;
    if (!hoursStr) return null;
    if (!OH) return null;
    try {
      const oh = new OH(hoursStr);
      return oh.getState(); // true | false
    } catch (_) {
      return null; // malformed → treat as unknown
    }
  }

  /* ----------------------------- Filtering ----------------------------- */

  function neighborhoodBbox(id) {
    const n = (window.NEIGHBORHOODS || []).find(x => x.id === id);
    return n ? n.bbox : null;
  }

  function restaurantCuisines(r) {
    return r.cuisine
      ? r.cuisine.split(';').map(c => c.trim()).filter(Boolean)
      : [];
  }

  function applyFilters() {
    const { neighborhood, cuisine, openNow } = state.filters;
    const nbBbox = neighborhood !== 'all' ? neighborhoodBbox(neighborhood) : null;

    state.filtered = state.restaurants.filter(r => {
      if (nbBbox && !isInBbox(r.lat, r.lng, nbBbox)) return false;
      if (cuisine && !restaurantCuisines(r).includes(cuisine)) return false;
      if (openNow) {
        if (computeOpenState(r.opening_hours) !== true) return false;
      }
      return true;
    });
  }

  function extractCuisineVocabulary(restaurants) {
    const set = new Set();
    for (const r of restaurants) {
      for (const c of restaurantCuisines(r)) set.add(c);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  /* ----------------------------- Rendering ----------------------------- */

  function $(id) { return document.getElementById(id); }

  function renderStatus() {
    const el = $('status');
    const n = state.filtered.length;
    if (n === 0) {
      el.innerHTML = `<p>${escapeHtml(t('status.empty'))}</p>`;
      return;
    }
    const key = n === 1 ? 'status.resultsOne' : 'status.resultsMany';
    el.innerHTML = `<p>${escapeHtml(t(key, { n }))}</p>`;
  }

  function renderResults() {
    const root = $('results');
    root.innerHTML = '';

    const frag = document.createDocumentFragment();
    for (const r of state.filtered) {
      frag.appendChild(renderCard(r));
    }
    root.appendChild(frag);
  }

  function renderCard(r) {
    const article = document.createElement('article');

    const openState = computeOpenState(r.opening_hours);
    const badge = renderBadge(openState);
    const cuisineText = r.cuisine
      ? escapeHtml(formatCuisine(r.cuisine))
      : `<em>${escapeHtml(t('card.noCuisine'))}</em>`;

    article.innerHTML = `
      <h3 class="card-title">${escapeHtml(r.name)}</h3>
      <div class="card-meta">
        ${badge}
        <span class="card-cuisine">${cuisineText}</span>
      </div>
      ${
        r.address
          ? `<p class="card-address">${escapeHtml(r.address)}</p>`
          : `<p class="card-address muted">${escapeHtml(t('card.noAddress'))}</p>`
      }
      <div class="card-actions">
        <button class="secondary outline" data-action="details" data-id="${escapeHtml(r.id)}">
          ${escapeHtml(t('card.details'))}
        </button>
      </div>
    `;
    return article;
  }

  function renderBadge(openState) {
    if (openState === true) {
      return `<span class="badge badge-open">${escapeHtml(t('card.open'))}</span>`;
    }
    if (openState === false) {
      return `<span class="badge badge-closed">${escapeHtml(t('card.closed'))}</span>`;
    }
    return `<span class="badge badge-unknown">${escapeHtml(t('card.hoursUnknown'))}</span>`;
  }

  function renderDetail(r) {
    $('detail-title').textContent = r.name;
    const parts = [];
    const openState = computeOpenState(r.opening_hours);

    if (r.cuisine) {
      parts.push(`<p><strong>${escapeHtml(t('detail.cuisine'))}</strong> ${escapeHtml(formatCuisine(r.cuisine))}</p>`);
    }
    if (r.address) {
      parts.push(`<p><strong>${escapeHtml(t('detail.address'))}</strong> ${escapeHtml(r.address)}</p>`);
    }
    if (r.opening_hours) {
      parts.push(
        `<p><strong>${escapeHtml(t('detail.hours'))}</strong> ${renderBadge(openState)} ` +
        `<code>${escapeHtml(r.opening_hours)}</code></p>`
      );
    }
    if (r.phone) {
      parts.push(`<p><strong>${escapeHtml(t('detail.phone'))}</strong> <a href="tel:${escapeHtml(r.phone)}">${escapeHtml(r.phone)}</a></p>`);
    }
    if (r.website) {
      const url = safeUrl(r.website);
      parts.push(
        `<p><strong>${escapeHtml(t('detail.website'))}</strong> ` +
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.website)}</a></p>`
      );
    }
    $('detail-body').innerHTML = parts.join('');
    $('detail-modal').showModal();
  }

  /* ------------------------------- Errors ------------------------------ */

  function renderError(messageKey) {
    $('status').innerHTML = `
      <div class="error-box" role="alert">
        <p>${escapeHtml(t(messageKey))}</p>
        <button class="secondary" id="retry-btn">${escapeHtml(t('status.retry'))}</button>
      </div>
    `;
    $('results').innerHTML = '';
    $('retry-btn').addEventListener('click', loadAndRender);
  }

  function renderLoading() {
    $('status').innerHTML = `<p aria-busy="true">${escapeHtml(t('status.loading'))}</p>`;
    $('results').innerHTML = '';
  }

  /* ------------------------------- Loader ------------------------------ */

  async function loadAndRender() {
    renderLoading();
    try {
      const raw = await fetchOverpass();
      const normalized = validateAndNormalize(raw);

      // Architectural sanity check: if the normalizer returned nothing at all,
      // that means either zero restaurants exist (unlikely for Nice) or the
      // response was non-conforming. Treat as a shape error.
      if (normalized.length === 0) {
        throw new ShapeError('Empty normalized result set');
      }

      state.restaurants = normalized;
      populateCuisineSelect();
      applyFilters();
      renderStatus();
      renderResults();
    } catch (err) {
      console.error('[restaurants]', err);
      const key = err instanceof ShapeError
        ? 'status.error.shape'
        : 'status.error.network';
      renderError(key);
    }
  }

  /* ------------------------- Selects & UI plumbing --------------------- */

  function populateNeighborhoodSelect() {
    const sel = $('filter-neighborhood');
    const current = state.filters.neighborhood;
    sel.innerHTML = '';
    for (const n of (window.NEIGHBORHOODS || [])) {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = state.lang === 'fr' ? n.name_fr : n.name_en;
      sel.appendChild(opt);
    }
    sel.value = current;
  }

  function populateCuisineSelect() {
    const sel = $('filter-cuisine');
    const current = state.filters.cuisine;
    sel.innerHTML = '';

    const any = document.createElement('option');
    any.value = '';
    any.textContent = t('cuisine.any');
    sel.appendChild(any);

    for (const c of extractCuisineVocabulary(state.restaurants)) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = formatCuisine(c);
      sel.appendChild(opt);
    }
    sel.value = current;
  }

  function updateUIStrings() {
    document.documentElement.lang = state.lang;
    document.title = t('app.title');
    $('app-title').textContent = t('app.title');
    $('lang-toggle').textContent = state.lang === 'fr' ? 'EN' : 'FR';

    for (const el of document.querySelectorAll('[data-i18n]')) {
      el.textContent = t(el.dataset.i18n);
    }
  }

  function wireEvents() {
    $('lang-toggle').addEventListener('click', () => {
      state.lang = state.lang === 'fr' ? 'en' : 'fr';
      updateUIStrings();
      populateNeighborhoodSelect();
      populateCuisineSelect();
      if (state.restaurants.length > 0) {
        renderStatus();
        renderResults();
      }
    });

    $('filter-neighborhood').addEventListener('change', (e) => {
      state.filters.neighborhood = e.target.value;
      applyFilters(); renderStatus(); renderResults();
    });
    $('filter-cuisine').addEventListener('change', (e) => {
      state.filters.cuisine = e.target.value;
      applyFilters(); renderStatus(); renderResults();
    });
    $('filter-open-now').addEventListener('change', (e) => {
      state.filters.openNow = !!e.target.checked;
      applyFilters(); renderStatus(); renderResults();
    });

    $('results').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="details"]');
      if (!btn) return;
      const id = btn.dataset.id;
      const r = state.restaurants.find(x => x.id === id);
      if (r) renderDetail(r);
    });

    $('close-modal').addEventListener('click', () => {
      $('detail-modal').close();
    });
  }

  /* -------------------------------- Init ------------------------------- */

  function init() {
    // Initial language: browser pref if French, otherwise English.
    const browserLang = (navigator.language || 'fr').toLowerCase();
    state.lang = browserLang.startsWith('fr') ? 'fr' : 'en';

    populateNeighborhoodSelect();
    populateCuisineSelect();
    updateUIStrings();
    wireEvents();
    loadAndRender();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
