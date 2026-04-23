/**
 * Nice, France — neighborhood bounding boxes.
 * Used as client-side filters to partition restaurants by quartier.
 *
 * Values are approximations sufficient for v1 filtering. They are NOT
 * a substitute for Nice's actual administrative boundaries.
 *
 * bbox format: [south, west, north, east]  (lat/lat/lng/lng)
 *
 * The city-wide bbox here MUST match NICE_BBOX in app.js.
 */

window.NICE_BBOX = {
  south: 43.65,
  west:  7.20,
  north: 43.75,
  east:  7.32,
};

window.NEIGHBORHOODS = [
  {
    id: 'all',
    name_fr: 'Tout Nice',
    name_en: 'All Nice',
    bbox: [43.65, 7.20, 43.75, 7.32],
  },
  {
    id: 'vieux-nice',
    name_fr: 'Vieux Nice',
    name_en: 'Old Town',
    bbox: [43.693, 7.271, 43.700, 7.282],
  },
  {
    id: 'promenade',
    name_fr: 'Promenade des Anglais',
    name_en: 'Promenade des Anglais',
    bbox: [43.689, 7.220, 43.697, 7.270],
  },
  {
    id: 'jean-medecin',
    name_fr: 'Jean Médecin',
    name_en: 'Jean Médecin',
    bbox: [43.698, 7.263, 43.710, 7.275],
  },
  {
    id: 'liberation',
    name_fr: 'Libération',
    name_en: 'Libération',
    bbox: [43.708, 7.260, 43.720, 7.278],
  },
  {
    id: 'cimiez',
    name_fr: 'Cimiez',
    name_en: 'Cimiez',
    bbox: [43.715, 7.258, 43.740, 7.285],
  },
  {
    id: 'port',
    name_fr: 'Port Lympia',
    name_en: 'Port',
    bbox: [43.694, 7.283, 43.708, 7.298],
  },
  {
    id: 'gambetta',
    name_fr: 'Gambetta / Musiciens',
    name_en: 'Gambetta / Musiciens',
    bbox: [43.696, 7.245, 43.710, 7.263],
  },
  {
    id: 'riquier',
    name_fr: 'Riquier',
    name_en: 'Riquier',
    bbox: [43.695, 7.283, 43.710, 7.308],
  },
  {
    id: 'fabron',
    name_fr: 'Fabron / Magnan',
    name_en: 'Fabron / Magnan',
    bbox: [43.688, 7.200, 43.703, 7.232],
  },
];
