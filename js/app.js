/* =========================================================
   Opening Roulette Mobile — app.js
   Home screen, settings, game startup, theme toggle, SW init.
   ========================================================= */

'use strict';

// ── DOM refs ────────────────────────────────────────────────
const homeScreen          = document.getElementById('home-screen');
const gameScreen          = document.getElementById('game-screen');
const spinBtn             = document.getElementById('spin-btn');
const newGameBtn          = document.getElementById('new-game-btn');
const eloSlider           = document.getElementById('elo-slider');
const eloValue            = document.getElementById('elo-value');
const openingFilterEl     = document.getElementById('opening-filter');
const nameFilterRow       = document.getElementById('name-filter-row');
const openingNameFilter   = document.getElementById('opening-name-filter');
const varFilterRow        = document.getElementById('variation-filter-row');
const openingVarFilter    = document.getElementById('opening-variation-filter');
const subvarFilterRow     = document.getElementById('subvariation-filter-row');
const openingSubvarFilter = document.getElementById('opening-subvar-filter');

// =========================================================
// DATA — driven by actual TSV content (data/ folder).
// All L2 openings have ≥3 TSV entries. L3 variations ≥3.
// L4 subvariations ≥3. Sorted by frequency (most common first).
//
// NAMED_OPENINGS supports two item types in the array:
//   { value, label }                  → plain <option>
//   { optgroup, options: [...] }      → <optgroup> with nested options
// =========================================================

// ── Helper: render a NAMED_OPENINGS items array into HTML ────
function buildSelectHTML(items) {
  return items.map(item => {
    if (item.optgroup != null) {
      const opts = item.options
        .map(o => `<option value="${o.value}">${o.label}</option>`)
        .join('');
      return `<optgroup label="${item.optgroup}">${opts}</optgroup>`;
    }
    return `<option value="${item.value}">${item.label}</option>`;
  }).join('');
}

// ── L2: Named openings per family ───────────────────────────
// e4 and d4 use <optgroup> (36 openings each); english and flank are flat.
const NAMED_OPENINGS = {

  e4: [
    { value: '', label: 'Any e4 opening' },
    { optgroup: 'Open Games (1.e4 e5)', options: [
      { value: 'Ruy Lopez',                             label: 'Ruy Lopez' },
      { value: 'Italian Game',                          label: 'Italian Game' },
      { value: "King's Gambit Accepted",                label: "King's Gambit Accepted" },
      { value: "King's Gambit Declined",                label: "King's Gambit Declined" },
      { value: 'Scotch Game',                           label: 'Scotch Game' },
      { value: "Petrov's Defense",                      label: "Petrov's Defense" },
      { value: 'Four Knights Game',                     label: 'Four Knights Game' },
      { value: 'Vienna Game',                           label: 'Vienna Game' },
      { value: "Bishop's Opening",                      label: "Bishop's Opening" },
      { value: 'Philidor Defense',                      label: 'Philidor Defense' },
      { value: 'Center Game',                           label: 'Center Game' },
      { value: 'Latvian Gambit',                        label: 'Latvian Gambit' },
      { value: 'Latvian Gambit Accepted',               label: 'Latvian Gambit Accepted' },
      { value: 'Vienna Gambit, with Max Lange Defense', label: 'Vienna Gambit, with Max Lange Defense' },
      { value: 'Ponziani Opening',                      label: 'Ponziani Opening' },
      { value: 'Danish Gambit Accepted',                label: 'Danish Gambit Accepted' },
      { value: 'Three Knights Opening',                 label: 'Three Knights Opening' },
      { value: 'Elephant Gambit',                       label: 'Elephant Gambit' },
      { value: 'Portuguese Opening',                    label: 'Portuguese Opening' },
    ]},
    { optgroup: 'Semi-Open Games', options: [
      { value: 'Sicilian Defense',                      label: 'Sicilian Defense' },
      { value: 'French Defense',                        label: 'French Defense' },
      { value: 'Caro-Kann Defense',                     label: 'Caro-Kann Defense' },
      { value: 'Alekhine Defense',                      label: 'Alekhine Defense' },
      { value: 'Scandinavian Defense',                  label: 'Scandinavian Defense' },
      { value: 'Pirc Defense',                          label: 'Pirc Defense' },
      { value: 'Modern Defense',                        label: 'Modern Defense' },
      { value: 'Nimzowitsch Defense',                   label: 'Nimzowitsch Defense' },
      { value: 'Pterodactyl Defense',                   label: 'Pterodactyl Defense' },
      { value: 'Owen Defense',                          label: 'Owen Defense' },
      { value: 'Lion Defense',                          label: 'Lion Defense' },
      { value: 'Rat Defense',                           label: 'Rat Defense' },
      { value: 'St. George Defense',                    label: 'St. George Defense' },
      { value: 'Borg Defense',                          label: 'Borg Defense' },
    ]},
    { optgroup: 'Irregular', options: [
      { value: "King's Pawn Game",                      label: "King's Pawn Game" },
      { value: "King's Pawn Opening",                   label: "King's Pawn Opening" },
      { value: "King's Knight Opening",                 label: "King's Knight Opening" },
    ]},
  ],

  d4: [
    { value: '', label: 'Any d4 opening' },
    { optgroup: "Queen's Gambit Systems", options: [
      { value: "Queen's Gambit Declined",               label: "Queen's Gambit Declined" },
      { value: "Queen's Gambit Accepted",               label: "Queen's Gambit Accepted" },
      { value: 'Semi-Slav Defense',                     label: 'Semi-Slav Defense' },
      { value: 'Slav Defense',                          label: 'Slav Defense' },
      { value: 'Catalan Opening',                       label: 'Catalan Opening' },
      { value: 'Tarrasch Defense',                      label: 'Tarrasch Defense' },
    ]},
    { optgroup: 'Indian Defenses', options: [
      { value: "King's Indian Defense",                 label: "King's Indian Defense" },
      { value: 'Nimzo-Indian Defense',                  label: 'Nimzo-Indian Defense' },
      { value: "Queen's Indian Defense",                label: "Queen's Indian Defense" },
      { value: 'Bogo-Indian Defense',                   label: 'Bogo-Indian Defense' },
      { value: 'Old Indian Defense',                    label: 'Old Indian Defense' },
      { value: 'Indian Defense',                        label: 'Indian Defense' },
    ]},
    { optgroup: 'Other Defenses', options: [
      { value: 'Dutch Defense',                         label: 'Dutch Defense' },
      { value: 'Benoni Defense',                        label: 'Benoni Defense' },
      { value: 'Grünfeld Defense',                      label: 'Grünfeld Defense' },
      { value: 'Neo-Grünfeld Defense',                  label: 'Neo-Grünfeld Defense' },
      { value: 'Benko Gambit',                          label: 'Benko Gambit' },
      { value: 'Benko Gambit Accepted',                 label: 'Benko Gambit Accepted' },
      { value: 'Benko Gambit Declined',                 label: 'Benko Gambit Declined' },
      { value: 'Blumenfeld Countergambit',              label: 'Blumenfeld Countergambit' },
      { value: 'English Defense',                       label: 'English Defense' },
      { value: 'Mikenas Defense',                       label: 'Mikenas Defense' },
      { value: 'Modern Defense',                        label: 'Modern Defense' },
      { value: 'Rat Defense',                           label: 'Rat Defense' },
      { value: 'Englund Gambit',                        label: 'Englund Gambit' },
      { value: 'Englund Gambit Declined',               label: 'Englund Gambit Declined' },
    ]},
    { optgroup: 'White Systems', options: [
      { value: "Queen's Pawn Game",                     label: "Queen's Pawn Game" },
      { value: 'London System',                         label: 'London System' },
      { value: 'London System, with Be2',               label: 'London System, with Be2' },
      { value: 'Trompowsky Attack',                     label: 'Trompowsky Attack' },
      { value: 'Torre Attack',                          label: 'Torre Attack' },
      { value: 'Richter-Veresov Attack',                label: 'Richter-Veresov Attack' },
      { value: 'Blackmar-Diemer Gambit',                label: 'Blackmar-Diemer Gambit' },
      { value: 'Blackmar-Diemer Gambit Accepted',       label: 'Blackmar-Diemer Gambit Accepted' },
      { value: 'Blackmar-Diemer Gambit Declined',       label: 'Blackmar-Diemer Gambit Declined' },
      { value: 'Rapport-Jobava System',                 label: 'Rapport-Jobava System' },
      { value: 'Rubinstein Opening',                    label: 'Rubinstein Opening' },
    ]},
  ],

  english: [
    { value: '', label: 'Any English / Réti' },
    { value: 'English Opening',                         label: 'English Opening' },
    { value: 'Réti Opening',                            label: 'Réti Opening' },
    { value: 'Zukertort Opening',                       label: 'Zukertort Opening' },
    { value: "King's Indian Attack",                    label: "King's Indian Attack" },
    { value: "King's Indian Attack, with Bf5",          label: "King's Indian Attack, with Bf5" },
  ],

  flank: [
    { value: '', label: 'Any flank opening' },
    { value: 'Van Geet Opening',                        label: 'Van Geet Opening' },
    { value: 'Bird Opening',                            label: 'Bird Opening' },
    { value: 'Polish Opening',                          label: 'Polish Opening' },
    { value: 'Grob Opening',                            label: 'Grob Opening' },
    { value: 'Hungarian Opening',                       label: 'Hungarian Opening' },
    { value: 'Nimzo-Larsen Attack',                     label: 'Nimzo-Larsen Attack' },
    { value: 'Kádas Opening',                           label: 'Kádas Opening' },
    { value: 'Ware Opening',                            label: 'Ware Opening' },
    { value: 'Barnes Opening',                          label: 'Barnes Opening' },
    { value: "Van't Kruijs Opening",                    label: "Van't Kruijs Opening" },
    { value: 'Mieses Opening',                          label: 'Mieses Opening' },
    { value: 'Sodium Attack',                           label: 'Sodium Attack' },
    { value: 'Amar Opening',                            label: 'Amar Opening' },
  ],

};

// ── L3: Variations per L2 opening (≥3 TSV entries each) ─────
// Keys are exact L2 names from the TSV data.
const VARIATIONS = {

  // ── E4 — Open Games ─────────────────────────────────────────

  'Ruy Lopez': [
    { value: '', label: 'Any Ruy Lopez' },
    { value: 'Closed',                    label: 'Closed' },
    { value: 'Morphy Defense',            label: 'Morphy Defense' },
    { value: 'Open',                      label: 'Open' },
    { value: 'Berlin Defense',            label: 'Berlin Defense' },
    { value: 'Exchange Variation',        label: 'Exchange Variation' },
    { value: 'Schliemann Defense',        label: 'Schliemann Defense' },
    { value: 'Marshall Attack',           label: 'Marshall Attack' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: 'Steinitz Defense',          label: 'Steinitz Defense' },
    { value: 'Spanish Countergambit',     label: 'Spanish Countergambit' },
    { value: 'Cozio Defense',             label: 'Cozio Defense' },
    { value: 'Classical Defense',         label: 'Classical Defense' },
  ],
  'Italian Game': [
    { value: '', label: 'Any Italian' },
    { value: 'Two Knights Defense',       label: 'Two Knights Defense' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: 'Evans Gambit',              label: 'Evans Gambit' },
    { value: 'Scotch Gambit',             label: 'Scotch Gambit' },
    { value: 'Giuoco Piano',              label: 'Giuoco Piano' },
    { value: 'Evans Gambit Declined',     label: 'Evans Gambit Declined' },
    { value: 'Giuoco Pianissimo',         label: 'Giuoco Pianissimo' },
  ],
  "King's Gambit Accepted": [
    { value: '', label: "Any King's Gambit Accepted" },
    { value: "Bishop's Gambit",           label: "Bishop's Gambit" },
    { value: 'Kieseritzky Gambit',        label: 'Kieseritzky Gambit' },
    { value: 'Salvio Gambit',             label: 'Salvio Gambit' },
    { value: 'Muzio Gambit',              label: 'Muzio Gambit' },
    { value: 'Double Muzio Gambit',       label: 'Double Muzio Gambit' },
    { value: 'Allgaier',                  label: 'Allgaier' },
    { value: 'Rosentreter Gambit',        label: 'Rosentreter Gambit' },
    { value: "King's Knight's Gambit",    label: "King's Knight's Gambit" },
    { value: 'Kieseritzky',               label: 'Kieseritzky' },
    { value: 'Cunningham Defense',        label: 'Cunningham Defense' },
    { value: 'Fischer Defense',           label: 'Fischer Defense' },
    { value: 'Allgaier Gambit',           label: 'Allgaier Gambit' },
  ],
  "King's Gambit Declined": [
    { value: '', label: "Any King's Gambit Declined" },
    { value: 'Falkbeer Countergambit',    label: 'Falkbeer Countergambit' },
    { value: 'Panteldakis Countergambit', label: 'Panteldakis Countergambit' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: 'Classical',                 label: 'Classical' },
    { value: 'Norwalde Variation',        label: 'Norwalde Variation' },
  ],
  'Scotch Game': [
    { value: '', label: 'Any Scotch' },
    { value: 'Scotch Gambit',             label: 'Scotch Gambit' },
    { value: 'Göring Gambit',             label: 'Göring Gambit' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
  ],
  "Petrov's Defense": [
    { value: '', label: "Any Petrov's" },
    { value: 'Classical Attack',          label: 'Classical Attack' },
    { value: 'Modern Attack',             label: 'Modern Attack' },
    { value: 'Cochrane Gambit',           label: 'Cochrane Gambit' },
  ],
  'Four Knights Game': [
    { value: '', label: 'Any Four Knights' },
    { value: 'Spanish Variation',         label: 'Spanish Variation' },
    { value: 'Scotch Variation',          label: 'Scotch Variation' },
    { value: 'Italian Variation',         label: 'Italian Variation' },
    { value: 'Halloween Gambit',          label: 'Halloween Gambit' },
  ],
  'Vienna Game': [
    { value: '', label: 'Any Vienna' },
    { value: 'Vienna Gambit',             label: 'Vienna Gambit' },
    { value: 'Stanley Variation',         label: 'Stanley Variation' },
    { value: 'Paulsen Variation',         label: 'Paulsen Variation' },
  ],
  "Bishop's Opening": [
    { value: '', label: "Any Bishop's Opening" },
    { value: 'Vienna Hybrid',             label: 'Vienna Hybrid' },
    { value: 'Urusov Gambit',             label: 'Urusov Gambit' },
    { value: 'McDonnell Gambit',          label: 'McDonnell Gambit' },
    { value: 'Lewis Countergambit',       label: 'Lewis Countergambit' },
  ],
  'Philidor Defense': [
    { value: '', label: 'Any Philidor' },
    { value: 'Lion Variation',            label: 'Lion Variation' },
    { value: 'Hanham Variation',          label: 'Hanham Variation' },
    { value: 'Nimzowitsch Variation',     label: 'Nimzowitsch Variation' },
    { value: 'Philidor Countergambit',    label: 'Philidor Countergambit' },
    { value: 'Exchange Variation',        label: 'Exchange Variation' },
  ],
  "King's Pawn Game": [
    { value: '', label: "Any King's Pawn Game" },
    { value: 'Tayler Opening',            label: 'Tayler Opening' },
    { value: 'Wayward Queen Attack',      label: 'Wayward Queen Attack' },
    { value: 'MacLeod Attack',            label: 'MacLeod Attack' },
    { value: 'Damiano Defense',           label: 'Damiano Defense' },
  ],
  'Latvian Gambit': [
    { value: '', label: 'Any Latvian' },
    { value: 'Mayet Attack',              label: 'Mayet Attack' },
  ],
  'Vienna Gambit, with Max Lange Defense': [
    { value: '', label: 'Any Vienna Gambit' },
    { value: 'Steinitz Gambit',           label: 'Steinitz Gambit' },
    { value: 'Hamppe-Allgaier Gambit',    label: 'Hamppe-Allgaier Gambit' },
  ],
  'Ponziani Opening': [
    { value: '', label: 'Any Ponziani' },
    { value: 'Jaenisch Counterattack',    label: 'Jaenisch Counterattack' },
  ],

  // ── E4 — Semi-Open Games ─────────────────────────────────────

  'Sicilian Defense': [
    { value: '', label: 'Any Sicilian' },
    { value: 'Dragon Variation',              label: 'Dragon Variation' },
    { value: 'Najdorf Variation',             label: 'Najdorf Variation' },
    { value: 'Richter-Rauzer Variation',      label: 'Richter-Rauzer Variation' },
    { value: "O'Kelly Variation",             label: "O'Kelly Variation" },
    { value: 'Closed',                        label: 'Closed' },
    { value: 'Scheveningen Variation',        label: 'Scheveningen Variation' },
    { value: 'Smith-Morra Gambit Accepted',   label: 'Smith-Morra Gambit Accepted' },
    { value: 'Kan Variation',                 label: 'Kan Variation' },
    { value: 'Alapin Variation',              label: 'Alapin Variation' },
    { value: 'Taimanov Variation',            label: 'Taimanov Variation' },
    { value: 'Lasker-Pelikan Variation',      label: 'Lasker-Pelikan Variation' },
    { value: 'Accelerated Dragon',            label: 'Accelerated Dragon' },
    { value: 'Wing Gambit',                   label: 'Wing Gambit' },
    { value: 'Nyezhmetdinov-Rossolimo Attack',label: 'Nyezhmetdinov-Rossolimo Attack' },
    { value: 'Sozin Attack',                  label: 'Sozin Attack' },
    { value: 'Smith-Morra Gambit Declined',   label: 'Smith-Morra Gambit Declined' },
    { value: 'Moscow Variation',              label: 'Moscow Variation' },
    { value: 'Modern Variations',             label: 'Modern Variations' },
    { value: 'Classical Variation',           label: 'Classical Variation' },
    { value: 'Nimzowitsch Variation',         label: 'Nimzowitsch Variation' },
    { value: 'Four Knights Variation',        label: 'Four Knights Variation' },
    { value: 'Delayed Alapin Variation',      label: 'Delayed Alapin Variation' },
    { value: 'Open',                          label: 'Open' },
    { value: 'French Variation',              label: 'French Variation' },
    { value: 'Pin Variation',                 label: 'Pin Variation' },
    { value: 'McDonnell Attack',              label: 'McDonnell Attack' },
    { value: 'Boleslavsky Variation',         label: 'Boleslavsky Variation' },
  ],
  'French Defense': [
    { value: '', label: 'Any French' },
    { value: 'Winawer Variation',         label: 'Winawer Variation' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: 'Tarrasch Variation',        label: 'Tarrasch Variation' },
    { value: 'Advance Variation',         label: 'Advance Variation' },
    { value: 'McCutcheon Variation',      label: 'McCutcheon Variation' },
    { value: 'Steinitz Variation',        label: 'Steinitz Variation' },
    { value: 'Rubinstein Variation',      label: 'Rubinstein Variation' },
    { value: 'Exchange Variation',        label: 'Exchange Variation' },
    { value: 'Alekhine-Chatard Attack',   label: 'Alekhine-Chatard Attack' },
    { value: 'St. George Defense',        label: 'St. George Defense' },
  ],
  'Caro-Kann Defense': [
    { value: '', label: 'Any Caro-Kann' },
    { value: 'Panov Attack',              label: 'Panov Attack' },
    { value: 'Advance Variation',         label: 'Advance Variation' },
    { value: 'Karpov Variation',          label: 'Karpov Variation' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: 'Accelerated Panov Attack',  label: 'Accelerated Panov Attack' },
    { value: 'Two Knights Attack',        label: 'Two Knights Attack' },
    { value: 'Exchange Variation',        label: 'Exchange Variation' },
    { value: 'Labahn Attack',             label: 'Labahn Attack' },
  ],
  'Alekhine Defense': [
    { value: '', label: 'Any Alekhine' },
    { value: 'Modern Variation',          label: 'Modern Variation' },
    { value: 'Four Pawns Attack',         label: 'Four Pawns Attack' },
    { value: 'Two Pawns Attack',          label: 'Two Pawns Attack' },
    { value: 'Hunt Variation',            label: 'Hunt Variation' },
    { value: 'Scandinavian Variation',    label: 'Scandinavian Variation' },
    { value: 'Mokele Mbembe',             label: 'Mokele Mbembe' },
    { value: 'Exchange Variation',        label: 'Exchange Variation' },
  ],
  'Scandinavian Defense': [
    { value: '', label: 'Any Scandinavian' },
    { value: 'Portuguese Gambit',         label: 'Portuguese Gambit' },
    { value: 'Modern Variation',          label: 'Modern Variation' },
    { value: 'Anderssen Counterattack',   label: 'Anderssen Counterattack' },
    { value: 'Valencian Variation',       label: 'Valencian Variation' },
    { value: 'Main Line',                 label: 'Main Line' },
  ],
  'Pirc Defense': [
    { value: '', label: 'Any Pirc' },
    { value: 'Austrian Attack',           label: 'Austrian Attack' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: '150 Attack',                label: '150 Attack' },
  ],
  'Modern Defense': [
    { value: '', label: 'Any Modern' },
    { value: 'Semi-Averbakh Variation',   label: 'Semi-Averbakh Variation' },
    { value: 'Two Knights Variation',     label: 'Two Knights Variation' },
    { value: 'Bishop Attack',             label: 'Bishop Attack' },
  ],
  'Nimzowitsch Defense': [
    { value: '', label: 'Any Nimzowitsch' },
    { value: 'Scandinavian Variation',    label: 'Scandinavian Variation' },
    { value: 'Kennedy Variation',         label: 'Kennedy Variation' },
    { value: 'El Columpio Defense',       label: 'El Columpio Defense' },
  ],
  'Pterodactyl Defense': [
    { value: '', label: 'Any Pterodactyl' },
    { value: 'Sicilian',                  label: 'Sicilian' },
    { value: 'Eastern',                   label: 'Eastern' },
    { value: 'Central',                   label: 'Central' },
    { value: 'Fianchetto',                label: 'Fianchetto' },
    { value: 'Western',                   label: 'Western' },
    { value: 'Austrian',                  label: 'Austrian' },
  ],
  'Lion Defense': [
    { value: '', label: 'Any Lion' },
    { value: 'Anti-Philidor',             label: 'Anti-Philidor' },
  ],
  'Rat Defense': [
    { value: '', label: 'Any Rat' },
    { value: 'English Rat',               label: 'English Rat' },
  ],

  // ── D4 ───────────────────────────────────────────────────────

  "Queen's Gambit Declined": [
    { value: '', label: 'Any QGD' },
    { value: 'Orthodox Defense',              label: 'Orthodox Defense' },
    { value: 'Semi-Tarrasch Defense',         label: 'Semi-Tarrasch Defense' },
    { value: 'Albin Countergambit',           label: 'Albin Countergambit' },
    { value: 'Chigorin Defense',              label: 'Chigorin Defense' },
    { value: 'Harrwitz Attack',               label: 'Harrwitz Attack' },
    { value: 'Lasker Defense',                label: 'Lasker Defense' },
    { value: 'Cambridge Springs Defense',     label: 'Cambridge Springs Defense' },
    { value: 'Modern Variation',              label: 'Modern Variation' },
    { value: 'Exchange Variation',            label: 'Exchange Variation' },
    { value: 'Baltic Defense',                label: 'Baltic Defense' },
    { value: 'Tartakower Defense',            label: 'Tartakower Defense' },
    { value: 'Tarrasch Defense',              label: 'Tarrasch Defense' },
    { value: 'Semi-Slav',                     label: 'Semi-Slav' },
    { value: 'Ragozin Defense',               label: 'Ragozin Defense' },
    { value: 'Pseudo-Tarrasch Variation',     label: 'Pseudo-Tarrasch Variation' },
    { value: 'Neo-Orthodox Variation',        label: 'Neo-Orthodox Variation' },
    { value: 'Capablanca Variation',          label: 'Capablanca Variation' },
    { value: 'Austrian Defense',              label: 'Austrian Defense' },
  ],
  "King's Indian Defense": [
    { value: '', label: "Any King's Indian" },
    { value: 'Fianchetto Variation',      label: 'Fianchetto Variation' },
    { value: 'Orthodox Variation',        label: 'Orthodox Variation' },
    { value: 'Sämisch Variation',         label: 'Sämisch Variation' },
    { value: 'Averbakh Variation',        label: 'Averbakh Variation' },
    { value: 'Four Pawns Attack',         label: 'Four Pawns Attack' },
    { value: 'Normal Variation',          label: 'Normal Variation' },
    { value: 'Semi-Classical Variation',  label: 'Semi-Classical Variation' },
    { value: 'Petrosian Variation',       label: 'Petrosian Variation' },
  ],
  'Nimzo-Indian Defense': [
    { value: '', label: 'Any Nimzo-Indian' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: 'Normal Variation',          label: 'Normal Variation' },
    { value: 'St. Petersburg Variation',  label: 'St. Petersburg Variation' },
    { value: 'Sämisch Variation',         label: 'Sämisch Variation' },
    { value: 'Rubinstein System',         label: 'Rubinstein System' },
    { value: 'Spielmann Variation',       label: 'Spielmann Variation' },
    { value: 'Three Knights Variation',   label: 'Three Knights Variation' },
    { value: 'Romanishin Variation',      label: 'Romanishin Variation' },
    { value: 'Leningrad Variation',       label: 'Leningrad Variation' },
  ],
  'Dutch Defense': [
    { value: '', label: 'Any Dutch' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: 'Staunton Gambit',           label: 'Staunton Gambit' },
    { value: 'Stonewall Variation',       label: 'Stonewall Variation' },
    { value: 'Leningrad Variation',       label: 'Leningrad Variation' },
    { value: 'Manhattan Gambit',          label: 'Manhattan Gambit' },
  ],
  'Semi-Slav Defense': [
    { value: '', label: 'Any Semi-Slav' },
    { value: 'Meran Variation',           label: 'Meran Variation' },
    { value: 'Stoltz Variation',          label: 'Stoltz Variation' },
    { value: 'Chigorin Defense',          label: 'Chigorin Defense' },
    { value: 'Botvinnik Variation',       label: 'Botvinnik Variation' },
    { value: 'Noteboom Variation',        label: 'Noteboom Variation' },
    { value: 'Marshall Gambit',           label: 'Marshall Gambit' },
    { value: 'Normal Variation',          label: 'Normal Variation' },
    { value: 'Main Line',                 label: 'Main Line' },
  ],
  'Benoni Defense': [
    { value: '', label: 'Any Benoni' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: "King's Pawn Line",          label: "King's Pawn Line" },
    { value: 'Old Benoni',                label: 'Old Benoni' },
    { value: 'Fianchetto Variation',      label: 'Fianchetto Variation' },
    { value: 'Zilbermints-Benoni Gambit', label: 'Zilbermints-Benoni Gambit' },
  ],
  'Grünfeld Defense': [
    { value: '', label: 'Any Grünfeld' },
    { value: 'Exchange Variation',        label: 'Exchange Variation' },
    { value: 'Russian Variation',         label: 'Russian Variation' },
    { value: 'Three Knights Variation',   label: 'Three Knights Variation' },
    { value: 'Brinckmann Attack',         label: 'Brinckmann Attack' },
  ],
  "Queen's Pawn Game": [
    { value: '', label: "Any Queen's Pawn" },
    { value: 'Chigorin Variation',        label: 'Chigorin Variation' },
    { value: 'Colle System',              label: 'Colle System' },
    { value: 'Torre Attack',              label: 'Torre Attack' },
    { value: 'Accelerated London System', label: 'Accelerated London System' },
    { value: 'Barry Attack',              label: 'Barry Attack' },
    { value: 'London System',             label: 'London System' },
    { value: 'Levitsky Attack',           label: 'Levitsky Attack' },
  ],
  'Indian Defense': [
    { value: '', label: 'Any Indian Defense' },
    { value: 'Budapest Defense',          label: 'Budapest Defense' },
    { value: 'Anti-Grünfeld',             label: 'Anti-Grünfeld' },
    { value: 'Gibbins-Weidenhagen Gambit',label: 'Gibbins-Weidenhagen Gambit' },
  ],
  "Queen's Gambit Accepted": [
    { value: '', label: 'Any QGA' },
    { value: 'Classical Defense',         label: 'Classical Defense' },
    { value: 'Central Variation',         label: 'Central Variation' },
    { value: 'Old Variation',             label: 'Old Variation' },
    { value: 'Alekhine Defense',          label: 'Alekhine Defense' },
    { value: 'Normal Variation',          label: 'Normal Variation' },
  ],
  'Slav Defense': [
    { value: '', label: 'Any Slav' },
    { value: 'Czech Variation',           label: 'Czech Variation' },
    { value: 'Quiet Variation',           label: 'Quiet Variation' },
    { value: 'Exchange Variation',        label: 'Exchange Variation' },
    { value: 'Chebanenko Variation',      label: 'Chebanenko Variation' },
  ],
  "Queen's Indian Defense": [
    { value: '', label: 'Any QID' },
    { value: 'Kasparov-Petrosian Variation', label: 'Kasparov-Petrosian Variation' },
    { value: 'Fianchetto Variation',      label: 'Fianchetto Variation' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
    { value: 'Kasparov Variation',        label: 'Kasparov Variation' },
  ],
  'Catalan Opening': [
    { value: '', label: 'Any Catalan' },
    { value: 'Closed',                    label: 'Closed' },
    { value: 'Open Defense',              label: 'Open Defense' },
  ],
  'Tarrasch Defense': [
    { value: '', label: 'Any Tarrasch' },
    { value: 'Classical Variation',       label: 'Classical Variation' },
  ],
  'Blackmar-Diemer Gambit Accepted': [
    { value: '', label: 'Any BDG Accepted' },
    { value: 'Bogoljubow Defense',        label: 'Bogoljubow Defense' },
    { value: 'Teichmann Defense',         label: 'Teichmann Defense' },
  ],
  'Blackmar-Diemer Gambit': [
    { value: '', label: 'Any BDG' },
    { value: 'Lemberger Countergambit',   label: 'Lemberger Countergambit' },
  ],
  'Bogo-Indian Defense': [
    { value: '', label: 'Any Bogo-Indian' },
    { value: 'Retreat Variation',         label: 'Retreat Variation' },
  ],
  'Trompowsky Attack': [
    { value: '', label: 'Any Trompowsky' },
    { value: 'Edge Variation',            label: 'Edge Variation' },
  ],
  'Torre Attack': [
    { value: '', label: 'Any Torre' },
    { value: 'Classical Defense',         label: 'Classical Defense' },
  ],

  // ── English / Réti ───────────────────────────────────────────

  'English Opening': [
    { value: '', label: 'Any English' },
    { value: "King's English Variation",  label: "King's English Variation" },
    { value: 'Symmetrical Variation',     label: 'Symmetrical Variation' },
    { value: 'Anglo-Indian Defense',      label: 'Anglo-Indian Defense' },
    { value: 'Agincourt Defense',         label: 'Agincourt Defense' },
    { value: 'Anglo-Scandinavian Defense',label: 'Anglo-Scandinavian Defense' },
    { value: 'Mikenas-Carls Variation',   label: 'Mikenas-Carls Variation' },
  ],
  'Réti Opening': [
    { value: '', label: 'Any Réti' },
    { value: 'Anglo-Slav Variation',      label: 'Anglo-Slav Variation' },
    { value: 'Advance Variation',         label: 'Advance Variation' },
  ],

  // ── Flank & Irregular ────────────────────────────────────────

  'Bird Opening': [
    { value: '', label: "Any Bird's" },
    { value: "From's Gambit",             label: "From's Gambit" },
    { value: 'Dutch Variation',           label: 'Dutch Variation' },
  ],
  'Polish Opening': [
    { value: '', label: 'Any Polish' },
    { value: "King's Indian Variation",   label: "King's Indian Variation" },
  ],
  'Grob Opening': [
    { value: '', label: 'Any Grob' },
    { value: 'Grob Gambit',               label: 'Grob Gambit' },
    { value: 'Zilbermints Gambit',        label: 'Zilbermints Gambit' },
  ],
};

// ── L4: Subvariations per "L2|L3" composite key (≥3 entries) ─
const SUBVARIATIONS = {

  // ── Sicilian ─────────────────────────────────────────────────
  'Sicilian Defense|Dragon Variation': [
    { value: '', label: 'Any Dragon' },
    { value: 'Yugoslav Attack',                       label: 'Yugoslav Attack' },
    { value: 'Classical Variation',                   label: 'Classical Variation' },
  ],
  'Sicilian Defense|Richter-Rauzer Variation': [
    { value: '', label: 'Any Richter-Rauzer' },
    { value: 'Classical Variation',                   label: 'Classical Variation' },
  ],
  'Sicilian Defense|Scheveningen Variation': [
    { value: '', label: 'Any Scheveningen' },
    { value: 'Modern Variation',                      label: 'Modern Variation' },
    { value: 'Classical Variation',                   label: 'Classical Variation' },
    { value: 'Classical Variation, Paulsen Variation',label: 'Classical Variation, Paulsen Variation' },
  ],
  'Sicilian Defense|Accelerated Dragon': [
    { value: '', label: 'Any Accelerated Dragon' },
    { value: 'Maróczy Bind',                          label: 'Maróczy Bind' },
  ],

  // ── Ruy Lopez ─────────────────────────────────────────────────
  'Ruy Lopez|Closed': [
    { value: '', label: 'Any Closed' },
    { value: 'Chigorin Defense',                      label: 'Chigorin Defense' },
    { value: 'Breyer Defense',                        label: 'Breyer Defense' },
  ],
  'Ruy Lopez|Morphy Defense': [
    { value: '', label: 'Any Morphy Defense' },
    { value: 'Modern Steinitz Defense',               label: 'Modern Steinitz Defense' },
  ],

  // ── French ────────────────────────────────────────────────────
  'French Defense|Winawer Variation': [
    { value: '', label: 'Any Winawer' },
    { value: 'Positional Variation',                  label: 'Positional Variation' },
    { value: 'Advance Variation',                     label: 'Advance Variation' },
    { value: 'Poisoned Pawn Variation',               label: 'Poisoned Pawn Variation' },
  ],

  // ── Italian ───────────────────────────────────────────────────
  'Italian Game|Classical Variation': [
    { value: '', label: 'Any Classical Italian' },
    { value: 'Giuoco Pianissimo',                     label: 'Giuoco Pianissimo' },
  ],

  // ── Four Knights ──────────────────────────────────────────────
  'Four Knights Game|Spanish Variation': [
    { value: '', label: 'Any Spanish Four Knights' },
    { value: 'Symmetrical Variation',                 label: 'Symmetrical Variation' },
    { value: 'Rubinstein Variation',                  label: 'Rubinstein Variation' },
  ],

  // ── QGD ───────────────────────────────────────────────────────
  "Queen's Gambit Declined|Orthodox Defense": [
    { value: '', label: 'Any Orthodox QGD' },
    { value: 'Rubinstein Attack',                     label: 'Rubinstein Attack' },
    { value: 'Classical Variation',                   label: 'Classical Variation' },
    { value: 'Main Line',                             label: 'Main Line' },
  ],
  "Queen's Gambit Declined|Modern Variation": [
    { value: '', label: 'Any Modern QGD' },
    { value: 'Knight Defense',                        label: 'Knight Defense' },
  ],

  // ── King's Indian ─────────────────────────────────────────────
  "King's Indian Defense|Sämisch Variation": [
    { value: '', label: 'Any Sämisch' },
    { value: 'with Bg5',                              label: 'with Bg5' },
  ],

  // ── Nimzo-Indian ──────────────────────────────────────────────
  'Nimzo-Indian Defense|Classical Variation': [
    { value: '', label: 'Any Classical Nimzo' },
    { value: 'Noa Variation',                         label: 'Noa Variation' },
  ],

  // ── Benoni ────────────────────────────────────────────────────
  'Benoni Defense|Classical Variation': [
    { value: '', label: 'Any Classical Benoni' },
    { value: 'Czerniak Defense',                      label: 'Czerniak Defense' },
  ],
  "Benoni Defense|King's Pawn Line": [
    { value: '', label: "Any King's Pawn Benoni" },
    { value: 'with Bg5',                              label: 'with Bg5' },
  ],

  // ── Grünfeld ──────────────────────────────────────────────────
  'Grünfeld Defense|Exchange Variation': [
    { value: '', label: 'Any Grünfeld Exchange' },
    { value: 'Modern Exchange Variation',             label: 'Modern Exchange Variation' },
    { value: 'Spassky Variation',                     label: 'Spassky Variation' },
  ],

  // ── Catalan ───────────────────────────────────────────────────
  'Catalan Opening|Closed': [
    { value: '', label: 'Any Closed Catalan' },
    { value: 'Main Line',                             label: 'Main Line' },
  ],

  // ── English ───────────────────────────────────────────────────
  "English Opening|King's English Variation": [
    { value: '', label: "Any King's English" },
    { value: 'Four Knights Variation, Fianchetto Line',label: 'Four Knights Variation, Fianchetto Line' },
    { value: 'Four Knights Variation, Quiet Line',    label: 'Four Knights Variation, Quiet Line' },
  ],
  'English Opening|Symmetrical Variation': [
    { value: '', label: 'Any Symmetrical English' },
    { value: 'Botvinnik System Reversed, with Nf3',   label: 'Botvinnik System Reversed, with Nf3' },
  ],
  'English Opening|Anglo-Indian Defense': [
    { value: '', label: 'Any Anglo-Indian' },
    { value: 'Anglo-Grünfeld Variation',              label: 'Anglo-Grünfeld Variation' },
    { value: "Queen's Indian Formation",              label: "Queen's Indian Formation" },
  ],
  'English Opening|Agincourt Defense': [
    { value: '', label: 'Any Agincourt' },
    { value: 'Neo-Catalan Declined',                  label: 'Neo-Catalan Declined' },
    { value: 'Neo-Catalan Declined, Early b3',        label: 'Neo-Catalan Declined, Early b3' },
  ],

  // ── Réti ──────────────────────────────────────────────────────
  'Réti Opening|Anglo-Slav Variation': [
    { value: '', label: 'Any Anglo-Slav' },
    { value: 'with g3',                               label: 'with g3' },
    { value: 'Gurevich System',                       label: 'Gurevich System' },
    { value: 'Bogoljubow Variation',                  label: 'Bogoljubow Variation' },
  ],

};

// =========================================================
// FILTER CASCADE — 3 levels
// =========================================================

openingFilterEl.addEventListener('change', () => {
  const items = NAMED_OPENINGS[openingFilterEl.value];

  // Always reset dependent rows
  varFilterRow.classList.add('collapsed');
  openingVarFilter.innerHTML = '';
  subvarFilterRow.classList.add('collapsed');
  openingSubvarFilter.innerHTML = '';

  if (!items) {
    nameFilterRow.classList.add('collapsed');
    openingNameFilter.innerHTML = '';
    updateSpinLabel();
    return;
  }

  openingNameFilter.innerHTML = buildSelectHTML(items);
  nameFilterRow.classList.remove('collapsed');
  updateSpinLabel();
});

openingNameFilter.addEventListener('change', () => {
  const l2 = openingNameFilter.options[openingNameFilter.selectedIndex].value;

  // Reset subvariation row
  subvarFilterRow.classList.add('collapsed');
  openingSubvarFilter.innerHTML = '';

  const varOptions = l2 ? VARIATIONS[l2] : null;
  if (varOptions) {
    openingVarFilter.innerHTML = varOptions
      .map(v => `<option value="${v.value}">${v.label}</option>`)
      .join('');
    varFilterRow.classList.remove('collapsed');
  } else {
    varFilterRow.classList.add('collapsed');
    openingVarFilter.innerHTML = '';
  }

  updateSpinLabel();
});

openingVarFilter.addEventListener('change', () => {
  const l2 = openingNameFilter.options[openingNameFilter.selectedIndex].value;
  const l3 = openingVarFilter.options[openingVarFilter.selectedIndex].value;
  const key = `${l2}|${l3}`;

  const subOptions = l3 ? SUBVARIATIONS[key] : null;
  if (subOptions) {
    openingSubvarFilter.innerHTML = subOptions
      .map(s => `<option value="${s.value}">${s.label}</option>`)
      .join('');
    subvarFilterRow.classList.remove('collapsed');
  } else {
    subvarFilterRow.classList.add('collapsed');
    openingSubvarFilter.innerHTML = '';
  }

  updateSpinLabel();
});

openingSubvarFilter.addEventListener('change', updateSpinLabel);

function updateSpinLabel() {
  const l2El = openingNameFilter.options[openingNameFilter.selectedIndex];
  const l3El = openingVarFilter.options[openingVarFilter.selectedIndex];
  const l4El = openingSubvarFilter.options[openingSubvarFilter.selectedIndex];

  const parts = [];
  if (l2El && l2El.value) parts.push(l2El.textContent);
  if (l3El && l3El.value) parts.push(l3El.textContent);
  if (l4El && l4El.value) parts.push(l4El.textContent);

  const label = parts.join(': ');
  spinBtn.innerHTML = label
    ? `<span class="spin-icon">⟳</span> New Position — ${label}`
    : '<span class="spin-icon">⟳</span> New Position';
}

// ── Side selector ────────────────────────────────────────────
document.getElementById('side-selector').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  document.querySelectorAll('#side-selector .seg-btn').forEach(b => b.classList.remove('seg-active'));
  btn.classList.add('seg-active');
});

// ── ELO slider ───────────────────────────────────────────────
eloSlider.addEventListener('input', () => {
  eloValue.textContent = eloSlider.value;
});

// ── New Game button → back to home ───────────────────────────
newGameBtn.addEventListener('click', showHomeScreen);

// Abort flag: set true when showHomeScreen() is called so any in-flight
// startGame() async chain knows to stop rather than re-hiding the home screen.
let _startAborted = false;

function showHomeScreen() {
  _startAborted = true;
  destroyGame();   // defined in game.js
  gameScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  // Re-enable spin button immediately — startGame() may still be awaiting
  // and would never reach its own resetSpinBtn() call.
  resetSpinBtn();
}

// =========================================================
// GAME START
// =========================================================

spinBtn.addEventListener('click', startGame);

async function startGame() {
  _startAborted = false;
  spinBtn.disabled = true;
  spinBtn.innerHTML = '<span class="spin-icon">⟳</span> Loading…';

  // Resolve human color
  const sideEl     = document.querySelector('#side-selector .seg-active');
  const sideChoice = sideEl?.dataset.value ?? 'random';
  const hColor = sideChoice === 'random'
    ? (Math.random() < 0.5 ? 'w' : 'b')
    : (sideChoice === 'black' ? 'b' : 'w');
  const diff = parseInt(eloSlider.value, 10);

  // Load openings (no-op if already cached)
  try {
    await Openings.ensureLoaded();
  } catch (err) {
    alert('Failed to load opening data:\n' + err.message);
    resetSpinBtn();
    return;
  }

  // "New" was pressed while ensureLoaded() was awaiting — home screen is
  // already restored; don't touch the DOM or proceed further.
  if (_startAborted) return;

  // Pick a random opening
  let data;
  try {
    data = Openings.getRandom(
      openingFilterEl.value,
      document.getElementById('depth-filter').value,
      openingNameFilter.value || '',
      openingVarFilter.value  || '',
      openingSubvarFilter.value || ''
    );
  } catch (err) {
    alert('Could not pick an opening:\n' + err.message);
    resetSpinBtn();
    return;
  }

  // Switch to game screen before engine init so the user sees progress
  homeScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  document.getElementById('eco-badge').textContent   = data.eco;
  document.getElementById('opening-name').textContent = data.name;

  // Init Stockfish engine (first time only — subsequent calls are no-ops)
  if (!sfEngine.isReady()) {
    setStatus('Loading Stockfish engine…');
    try {
      await sfEngine.init();
    } catch (err) {
      if (!_startAborted) {
        alert('Failed to load chess engine:\n' + err.message +
              '\n\nCheck your network connection and try again.');
        showHomeScreen();
      }
      return;
    }
    // "New" was pressed while the engine was initialising.
    if (_startAborted) return;
  }

  // Launch game (theory animation + hand-off).
  // Wrapped in try-catch: if destroyGame() is called mid-animation, the
  // animation loop returns early and initGame() exits cleanly; but as a
  // safety net we catch any stray error so resetSpinBtn() is always reached.
  try {
    await initGame(data, hColor, diff);
  } catch (_) {
    // showHomeScreen() already restored home-screen state; nothing to do.
  }

  if (!_startAborted) resetSpinBtn();
}

function resetSpinBtn() {
  spinBtn.disabled = false;
  spinBtn.innerHTML = '<span class="spin-icon">⟳</span> New Position';
}

// =========================================================
// THEME TOGGLE
// =========================================================

(function initTheme() {
  const toggles = [
    document.getElementById('theme-toggle'),
    document.getElementById('theme-toggle-game'),
  ];

  const saved   = localStorage.getItem('theme');
  const isLight = saved === 'light';

  if (isLight) {
    document.documentElement.classList.add('light');
    document.body.classList.add('light');
  }
  toggles.forEach(t => { if (t) t.checked = isLight; });

  function applyTheme(light) {
    document.documentElement.classList.toggle('light', light);
    document.body.classList.toggle('light', light);
    localStorage.setItem('theme', light ? 'light' : 'dark');
    toggles.forEach(t => { if (t) t.checked = light; });
  }

  toggles.forEach(t => {
    if (t) t.addEventListener('change', () => applyTheme(t.checked));
  });
}());

// =========================================================
// SERVICE WORKER
// =========================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// =========================================================
// PREVENT BOUNCE SCROLL ON iOS
// =========================================================

// Allow scrolling only inside explicitly scrollable containers
document.addEventListener('touchmove', e => {
  const scrollable = e.target.closest('#home-screen, #move-list, .game-body');
  if (!scrollable) e.preventDefault();
}, { passive: false });

// Prevent context menu on long press (would interfere with drag)
document.addEventListener('contextmenu', e => e.preventDefault());

// =========================================================
// ENGINE PRE-WARM
// =========================================================

// Start loading Stockfish in the background after the home screen
// has had a chance to paint, so WASM compilation doesn't block
// the initial render.  Errors are silently swallowed — if it fails
// here, startGame() will retry and surface any real error to the user.
setTimeout(() => sfEngine.init().catch(() => {}), 100);
