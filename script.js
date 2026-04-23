(function initTheme() {
  const saved = localStorage.getItem('pokedex-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pokedex-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(page).classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  if (page === 'home') renderCatalog();
  if (page === 'team') renderTeam();
}

let offset   = 0;
const LIMIT  = 20;
let totalCount = 0;
let currentPage = 1;
let searchResults = null;

async function renderCatalog() {
  const grid = document.getElementById('catalogo');
  const pagination = document.getElementById('pagination');

  if (searchResults !== null) {
    renderSearchResults(searchResults);
    pagination.style.display = 'none';
    return;
  }

  pagination.style.display = 'flex';
  renderSkeletons(grid);

  try {
    const res = await fetch(
      `https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=${LIMIT}`
    );
    if (!res.ok) throw new Error('Error al obtener la lista');
    const data = await res.json();
    totalCount = data.count;

    const pokemons = await Promise.all(
      data.results.map(p => fetchPokemonBasic(p.url))
    );

    grid.innerHTML = '';
    pokemons.forEach(p => p && grid.appendChild(createCard(p)));

    updatePagination();
  } catch (err) {
    showError(grid, 'No se pudo cargar la Pokedex. Verifica tu conexión.');
  }
}

async function fetchPokemonBasic(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function renderSkeletons(container) {
  container.innerHTML = Array.from({ length: LIMIT }, () => `
    <div class="skeleton-card">
      <div class="sk sk-circle"></div>
      <div class="sk sk-line"></div>
      <div class="sk sk-line short"></div>
      <div class="sk sk-btn"></div>
    </div>
  `).join('');
}

function createCard(data) {
  const id = data.id;
  const name = data.name;
  const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  const types = data.types.map(t => t.type.name);
  const primaryType = types[0];

  const card = document.createElement('div');
  card.className = 'card';
  card.style.setProperty('--type-color', typeColor(primaryType));
  card.innerHTML = `
    <span class="card-number">#${String(id).padStart(3,'0')}</span>
    <img class="card-img" src="${img}" alt="${name}" loading="lazy">
    <span class="card-name">${name}</span>
    <div class="card-types">
      ${types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('')}
    </div>
    <button class="card-btn">Ver más</button>
  `;
  card.addEventListener('click', () => openModal(id));
  return card;
}

function typeColor(type) {
  const map = {
    fire:'#fd7d24', water:'#4592c4', grass:'#9bcc50', electric:'#eed535',
    ice:'#51c4e7', fighting:'#d56723', poison:'#b97fc9', ground:'#f7de3f',
    flying:'#3dc7ef', psychic:'#f366b9', bug:'#729f3f', rock:'#a38c21',
    ghost:'#7b62a3', dragon:'#53a4cf', dark:'#707070', steel:'#9eb7b8',
    fairy:'#fdb9e9', normal:'#a4acaf',
  };
  return map[type] || '#888';
}

function updatePagination() {
  const totalPages = Math.ceil(totalCount / LIMIT);
  currentPage = Math.floor(offset / LIMIT) + 1;
  document.getElementById('pageInfo').textContent = `Página ${currentPage} / ${totalPages}`;
  document.getElementById('btnPrev').disabled = offset === 0;
  document.getElementById('btnNext').disabled = offset + LIMIT >= totalCount;
}

function prevPage() { if (offset > 0) { offset -= LIMIT; renderCatalog(); } }
function nextPage() { offset += LIMIT; renderCatalog(); }

let searchTimer = null;

function onSearchInput() {
  const val = document.getElementById('buscarPokemon').value.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClear');
  clearBtn.style.display = val ? 'block' : 'none';

  clearTimeout(searchTimer);
  if (!val) {
    searchResults = null;
    renderCatalog();
    return;
  }
  searchTimer = setTimeout(() => doLiveSearch(val), 350);
}

function clearSearch() {
  document.getElementById('buscarPokemon').value = '';
  document.getElementById('searchClear').style.display = 'none';
  searchResults = null;
  renderCatalog();
}

async function doLiveSearch(query) {
  const grid = document.getElementById('catalogo');
  document.getElementById('pagination').style.display = 'none';
  renderSkeletons(grid);

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${query}`);
    if (res.ok) {
      const data = await res.json();
      searchResults = [data];
      renderSearchResults(searchResults);
    } else {
      const listRes = await fetch(`https://pokeapi.co/api/v2/pokemon?offset=0&limit=2000`);
      const listData = await listRes.json();
      const matches = listData.results.filter(p => p.name.includes(query)).slice(0, 20);

      if (matches.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem">
          No se encontró ningún Pokemon con ese nombre.
        </div>`;
        searchResults = [];
        return;
      }

      const pokemons = await Promise.all(matches.map(p => fetchPokemonBasic(p.url)));
      searchResults = pokemons.filter(Boolean);
      renderSearchResults(searchResults);
    }
  } catch {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem">
      Error al buscar. Intentalo de nuevo.
    </div>`;
  }
}

function renderSearchResults(list) {
  const grid = document.getElementById('catalogo');
  grid.innerHTML = '';
  if (!list.length) return;
  list.forEach(p => grid.appendChild(createCard(p)));
}

let currentPokemonId = null;

async function openModal(id) {
  currentPokemonId = id;
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modalSkeleton').style.display = 'grid';
  document.getElementById('modalContent').classList.add('hidden');
  document.body.style.overflow = 'hidden';

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!res.ok) throw new Error('No encontrado');
    const data = await res.json();
    await populateModal(data);
  } catch {
    closeModal();
    showToast('No se pudo cargar el Pokemon.');
  }
}

async function populateModal(data) {
  const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${data.id}.png`;

  document.getElementById('modalNumber').textContent = `#${String(data.id).padStart(3,'0')}`;
  document.getElementById('modalName').textContent = data.name;
  document.getElementById('modalImg').src = imgUrl;
  document.getElementById('modalImg').alt = data.name;
  document.getElementById('modalAltura').textContent = `${(data.height / 10).toeixed(1)} m`;
  document.getElementById('modalPeso').textContent = `${(data.weight / 10).toFixed(1)} kg`;

  const types = data.types.map(t => t.type.name);
  document.getElementById('modalTypes').innerHTML =
    types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('');

  document.getElementById('modalHabilidades').innerHTML =
    data.abilities
      .map(a => `<span class="ability-chip${a.is_hidden ? ' hidden-ability' : ''}">${a.ability.name}</span>`)
      .join('');

  const statNames = { hp:'HP', attack:'ATK', defense:'DEF', 'special-attack':'SP.ATK',
    'special-defense':'SP.DEF', speed:'VEL' };
  document.getElementById('modalStats').innerHTML = data.stats.map(s => {
    const pct = Math.min(100, Math.round((s.base_stat / 255) * 100));
    const label = statNames[s.stat.name] || s.stat.name;
    return `
      <div class="stat-row">
        <span class="stat-name">${label}</span>
        <span class="stat-val">${s.base_stat}</span>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill" style="width:0%" data-target="${pct}%"></div>
        </div>
      </div>`;
  }).join('');

  requestAnimationFrame(() => {
    document.querySelectorAll('.stat-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.target;
    });
  });

  loadEvolutions(data.species.url);

  document.getElementById('modalSkeleton').style.display = 'none';
  document.getElementById('modalContent').classList.remove('hidden');

  updateAddTeamButton();
}

async function loadEvolutions(speciesUrl) {
  const container = document.getElementById('modalEvoluciones');
  container.innerHTML = '<span style="color:var(--text-muted);font-size:.8rem">Cargando...</span>';
  try {
    const specRes = await fetch(speciesUrl);
    const spec = await specRes.json();
    const evoRes = await fetch(spec.evolution_chain.url);
    const evoData = await evoRes.json();

    const chain = [];
    let node = evoData.chain;
    while (node) {
      chain.push(node.species.name);
      node = node.evolves_to[0] || null;
    }

    if (chain.length <= 1) {
      container.innerHTML = '<span style="color:var(--text-muted);font-size:.8rem">Sin evoluciones</span>';
      return;
    }

    const evoPokemons = await Promise.all(
      chain.map(name => fetch(`https://pokeapi.co/api/v2/pokemon/${name}`).then(r => r.json()))
    );

    container.innerHTML = '';
    evoPokemons.forEach((p, i) => {
      const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`;
      const item = document.createElement('div');
      item.className = 'evo-item';
      item.innerHTML = `<img src="${img}" alt="${p.name}" loading="lazy"><span>${p.name}</span>`;
      item.addEventListener('click', () => openModal(p.id));
      container.appendChild(item);
      if (i < evoPokemons.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'evo-arrow';
        arrow.textContent = '→';
        container.appendChild(arrow);
      }
    });
  } catch {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:.8rem">No disponible</span>';
  }
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function getTeam() { return JSON.parse(localStorage.getItem('pokedex-team') || '[]'); }
function saveTeam(t) { localStorage.setItem('pokedex-team', JSON.stringify(t)); }

function addCurrentPokemon() {
  const team = getTeam();
  if (!currentPokemonId) return;
  if (team.length >= 6) { showToast('¡Máximo 6 Pokemon en el equipo!'); return; }
  if (team.find(p => p.id === currentPokemonId)) { showToast('Este Pokemon ya está en tu equipo.'); return; }

  const name = document.getElementById('modalName').textContent;
  const img  = document.getElementById('modalImg').src;
  team.push({ id: currentPokemonId, name, img });
  saveTeam(team);
  updateAddTeamButton();
  showToast(`¡${name} fue añadido al equipo!`);
}

function updateAddTeamButton() {
  const btn = document.getElementById('btnAddTeam');
  if (!btn) return;
  const team = getTeam();
  const inTeam = team.find(p => p.id === currentPokemonId);
  btn.disabled = !!inTeam || team.length >= 6;
  btn.textContent = inTeam ? '✓ Ya está en tu equipo' : '+ Agregar al equipo';
}

function removePokemon(id) {
  const team = getTeam().filter(p => p.id !== id);
  saveTeam(team);
  renderTeam();
}

async function renderTeam() {
  const container = document.getElementById('teamList');
  const empty = document.getElementById('teamEmpty');
  const team = getTeam();

  if (!team.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  container.innerHTML = team.map(p => `
    <div class="team-card">
      <button class="btn-remove" onclick="removePokemon(${p.id})" title="Eliminar">✕</button>
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      <span>${p.name}</span>
    </div>
  `).join('');
}

async function searchMove() {
  const input = document.getElementById('buscarMove').value.trim().toLowerCase();
  if (!input) return;
  const info = document.getElementById('moveInfo');
  const list = document.getElementById('pokemonList');
  info.classList.add('hidden');
  list.innerHTML = '';

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/move/${input}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const desc = data.effect_entries.find(e => e.language.name === 'es') ||
                 data.effect_entries.find(e => e.language.name === 'en');

    info.classList.remove('hidden');
    info.innerHTML = `
      <h3>${data.name.replace('-',' ')}</h3>
      <p><strong>Tipo:</strong> <span class="type-badge type-${data.type.name}">${data.type.name}</span></p>
      <p><strong>Categoría:</strong> ${data.damage_class?.name || '–'}</p>
      <p><strong>Potencia:</strong> ${data.power ?? '–'} &nbsp; <strong>Precisión:</strong> ${data.accuracy ?? '–'} &nbsp; <strong>PP:</strong> ${data.pp ?? '–'}</p>
      ${desc ? `<p style="margin-top:.5rem;font-size:.85rem;color:var(--text-secondary)">${desc.short_effect}</p>` : ''}
    `;

    const learned = data.learned_by_pokemon.slice(0, 20);
    list.innerHTML = `<p style="width:100%;color:var(--text-muted);font-size:.8rem;text-align:center;margin-bottom:.5rem">Aprendido por:</p>` +
      learned.map(p => {
        const id = p.url.split('/').filter(Boolean).pop();
        return `<span class="chip" onclick="goToPokemon(${id})">${p.name}</span>`;
      }).join('');
  } catch {
    info.classList.remove('hidden');
    info.innerHTML = `<p style="color:var(--accent)">Movimiento no encontrado. Intenta con el nombre en ingles (ej: flamethrower).</p>`;
  }
}

function goToPokemon(id) {
  showPage('home');
  openModal(id);
}

async function searchItem() {
  const input = document.getElementById('buscarItem').value.trim().toLowerCase();
  if (!input) return;
  const info = document.getElementById('itemInfo');
  info.classList.add('hidden');

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/item/${input}`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    const desc = data.effect_entries.find(e => e.language.name === 'es') ||
                 data.effect_entries.find(e => e.language.name === 'en');
    const sprite = data.sprites?.default;

    info.classList.remove('hidden');
    info.innerHTML = `
      <h3>${data.name.replace(/-/g,' ')}</h3>
      ${sprite ? `<img src="${sprite}" alt="${data.name}" style="width:48px;height:48px;object-fit:contain;margin:.5rem 0">` : ''}
      <p><strong>Categoría:</strong> ${data.category?.name || '–'}</p>
      <p><strong>Coste:</strong> ${data.cost ?? '–'} PD</p>
      ${desc ? `<p style="margin-top:.5rem;font-size:.85rem;color:var(--text-secondary)">${desc.effect}</p>` : ''}
    `;
  } catch {
    info.classList.remove('hidden');
    info.innerHTML = `<p style="color:var(--accent)">Ítem no encontrado. Intenta con el nombre en ingles (ej: potion, master-ball).</p>`;
  }
}

function showError(container, msg) {
  container.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem">${msg}</div>`;
}

let toastTimer = null;
function showToast(msg) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

document.addEventListener('DOMContentLoaded', () => {
  renderCatalog();
});

