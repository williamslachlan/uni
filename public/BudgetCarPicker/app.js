// =====================================================================
// app.js: budget car picker
// Needs (loaded in this order in index.html): Bootstrap JS, Plotly, data.js
// =====================================================================


// ---------------------------------------------------------------------
// 1. Settings and helpers
// ---------------------------------------------------------------------

// colours, matching the viridis colours used in the notebook
const COL_ALL = '#440154';   // all listings bar
const COL_DEP = '#440154';   // resale value chart
const COL_FUEL = '#21918c';  // fuel economy chart
const COL_EV = '#dfe318';    // electric cars in the fuel chart

// readable names for each body type
const NAMES = {
  'convertible/cabriolet': 'convertible', 'coupe': 'coupe', 'suv': 'SUV', 'crossover': 'crossover',
  '4x4': '4x4', 'van/minivan': 'van or minivan', 'sedan': 'sedan', 'hatchback': 'hatchback', 'truck': 'truck'
};
const nameOf = body => NAMES[body] || body;

// format a price as $12,345, or 'n/a' if missing
const fmt = n => (n === null || n === undefined) ? 'n/a' : '$' + Math.round(n).toLocaleString('en-AU');


// ---------------------------------------------------------------------
// 2. Build one row per body type
// ---------------------------------------------------------------------

const rowsDiv = document.getElementById('body-rows');

// body types left out of the picker
const EXCLUDE = ['convertible/cabriolet', 'coupe', 'truck'];
const shownTypes = DATA.body_types.filter(b => !EXCLUDE.includes(b.body_type));

const maxMedian = Math.max(...shownTypes.map(b => b.median_all));

// the button for one body type (greyed out if nothing qualified for the rankings)
function menuHtml(b) {
  const name = nameOf(b.body_type);
  if (!b.has_rankings) {
    return `<button class="btn btn-outline-secondary btn-sm w-100" disabled>Not enough data for ${name}s</button>`;
  }
  return `<button class="btn btn-outline-dark btn-sm w-100 budget-btn" data-body="${b.body_type}">Choose a budget ${name}</button>`;
}

// most expensive at the top, matching the static chart
[...shownTypes].reverse().forEach(b => {
  const pct = (b.median_all / maxMedian) * 100;
  const prefix = b.banded ? 'at least ' : '';
  const hatch = b.banded
    ? 'background-image: repeating-linear-gradient(45deg, transparent 0 6px, rgba(255,255,255,0.5) 6px 9px);'
    : '';

  const row = document.createElement('div');
  row.className = 'row align-items-center mb-2';
  row.innerHTML = `
    <div class="col-4 col-md-3">${menuHtml(b)}</div>
    <div class="col-8 col-md-9">
      <div class="bar-track"><div class="bar" style="width: ${pct}%; background-color: ${COL_ALL}; ${hatch}"></div></div>
      <div class="bar-label"><strong>${nameOf(b.body_type)}</strong>: median ${prefix}${fmt(b.median_all)}
        (used ${fmt(b.median_used)}, new ${fmt(b.median_new)}), ${b.listings.toLocaleString('en-AU')} listings</div>
    </div>`;
  rowsDiv.appendChild(row);
});


// ---------------------------------------------------------------------
// 3. The choice modal: open it, handle choices, draw once it closes
// ---------------------------------------------------------------------

const modalEl = document.getElementById('choiceModal');
const choiceModal = new bootstrap.Modal(modalEl);
let pendingChoice = null;

// fill the modal for one body type, then open it
function openChoices(body) {
  document.getElementById('choiceTitle').textContent = `What matters most in a ${nameOf(body)}?`;
  document.getElementById('choiceGrid').innerHTML = `
 <button class="btn btn-outline-dark choice" data-body="${body}" data-view="resale">
      <span class="choice-icon"><i class="bi bi-cash-coin"></i></span>
      <span class="choice-label">Best resale value</span>
    </button>
    <button class="btn btn-outline-dark choice" data-body="${body}" data-view="fuel">
      <span class="choice-icon"><i class="bi bi-fuel-pump"></i></span>
      <span class="choice-label">Best fuel economy</span>
    </button>
    <button class="btn btn-dark choice" data-body="${body}" data-view="both">
      <span class="choice-icon"><i class="bi bi-cash-coin"></i> <i class="bi bi-fuel-pump"></i></span>
      <span class="choice-label">Show me both</span>
    </button>`;
  choiceModal.show();
}

// clicks on budget buttons and on choices inside the modal
document.addEventListener('click', e => {
  const choice = e.target.closest('.choice');
  const trigger = e.target.closest('.budget-btn');

  if (choice) {
    pendingChoice = { body: choice.dataset.body, view: choice.dataset.view };
    choiceModal.hide();
  } else if (trigger) {
    openChoices(trigger.dataset.body);
  }
});

// once the modal has finished closing, draw the chosen rankings
modalEl.addEventListener('hidden.bs.modal', () => {
  if (pendingChoice) {
    showRankings(pendingChoice.body, pendingChoice.view);
    pendingChoice = null;
  }
});


// ---------------------------------------------------------------------
// 4. Draw the chosen rankings
// ---------------------------------------------------------------------

function showRankings(body, view) {
  const area = document.getElementById('ranking-area');
  const r = DATA.rankings[body];
  const name = nameOf(body);
  const width = view === 'both' ? 'col-md-6' : 'col-12';

  const heading = view === 'fuel' ? 'use the least fuel'
                : view === 'resale' ? 'hold their value best'
                : 'hold their value and use the least fuel';

  area.innerHTML = `
    <h2 class="h5">Budget ${name}s that ${heading}</h2>
    <div class="row">
      ${view !== 'fuel' ? `<div id="chart-resale" class="${width}"></div>` : ''}
      ${view !== 'resale' ? `<div id="chart-fuel" class="${width}"></div>` : ''}
    </div>
    <p class="small text-muted">Top 10 brand and grade combinations with at least ${DATA.min_listings} listings.
      Resale value uses used cars priced under $40,486. Electric cars are shown at 0 L/100 km.</p>`;

if (view !== 'fuel') {
    drawBars('chart-resale', r.resale, 'depreciation_pct', 'Slowest depreciation',
      '% of value lost per year of age', d => COL_DEP,
      d => `Loses ${d.depreciation_pct.toFixed(1)}% a year<br>${d.listings} listings, ${d.first_year}–${d.last_year}`,
      d => d.depreciation_pct.toFixed(1));
  }
  if (view !== 'resale') {
    drawBars('chart-fuel', r.fuel, 'median_fuel', 'Best fuel economy',
      'Median L/100 km', d => d.electric ? COL_EV : COL_FUEL,
      d => d.electric ? `Electric: uses no fuel<br>${d.listings} listings` : `${d.median_fuel.toFixed(1)} L/100 km<br>${d.listings} listings`,
      d => d.electric ? '⚡ electric' : d.median_fuel.toFixed(1));
  }
  area.scrollIntoView({ behavior: 'smooth' });
}

// one horizontal bar chart; used for both rankings
function drawBars(elementId, rows, valueKey, title, xTitle, colourOf, hoverOf, textOf) {
  if (rows.length === 0) {
    document.getElementById(elementId).innerHTML =
      `<p class="text-muted">Not enough listings to rank ${title.toLowerCase()} for this body type.</p>`;
    return;
  }
  Plotly.newPlot(elementId, [{
    type: 'bar', orientation: 'h',
    x: rows.map(d => d[valueKey]),
    y: rows.map(d => d.label),
    marker: { color: rows.map(colourOf) },
    text: rows.map(textOf), textposition: 'outside', cliponaxis: false,
    hovertext: rows.map(hoverOf), hoverinfo: 'text'
  }], {
    title: { text: title, font: { size: 15 } },
    xaxis: { title: xTitle },
    yaxis: { autorange: 'reversed', automargin: true },
    height: 80 + 34 * rows.length,
    margin: { t: 40, r: 40 }
  }, { responsive: true, displayModeBar: false });
}
