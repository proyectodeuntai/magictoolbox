const STORAGE_KEY = "magic_card_matcher_db_v1";
const idInput = document.getElementById("identifier");
const uploadFile = document.getElementById("uploadFile");
const saveBtn = document.getElementById("saveBtn");
const message = document.getElementById("message");
const userListsDiv = document.getElementById("userLists");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const myList = document.getElementById("myList");
const myFile = document.getElementById("myFile");
const matchBtn = document.getElementById("matchBtn");
const searchCard = document.getElementById("searchCard");
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");

// Nuevos elementos de filtros
const filterFoil = document.getElementById("filterFoil");
const filterRarity = document.getElementById("filterRarity");
const filterSet = document.getElementById("filterSet");
const filterLanguage = document.getElementById("filterLanguage");
const clearFiltersBtn = document.getElementById("clearFilters");
const filterStatus = document.getElementById("filterStatus");
const viewNormalBtn = document.getElementById("viewNormal");
const viewWhoHasBtn = document.getElementById("viewWhoHas");

let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
let currentMatches = null;
let currentSearchCards = null;
let currentShowFilterInfo = false;

function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    renderDB();
    updateFilterOptions();
}

// Función mejorada para parsear CSV respetando las columnas
function parseCSV(text) {
    if (!text) return [];

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    const firstLine = lines[0].toLowerCase();
    const isCSV = firstLine.includes('name') && firstLine.includes('set');

    if (isCSV && lines.length > 1) {
        const headers = parseCSVLine(lines[0]);
        const cards = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const card = {};
            headers.forEach((header, index) => {
                card[header] = values[index] || '';
            });

            if (card.Name && card.Name.trim()) {
                cards.push(card);
            }
        }

        return cards;
    } else {
        return lines.map(line => {
            const trimmed = line.trim();
            return trimmed ? { Name: trimmed } : null;
        }).filter(Boolean);
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

function parseTextToCards(text) {
    if (!text) return [];
    return text
        .split(/\r?\n|;/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map(name => ({ Name: name }));
}

// Actualizar opciones de filtros basados en la DB
function updateFilterOptions() {
    const sets = new Set();

    for (const userCards of Object.values(db)) {
        for (const card of userCards) {
            if (card['Set name']) {
                sets.add(card['Set name']);
            }
        }
    }

    // Actualizar select de sets
    const sortedSets = Array.from(sets).sort();
    filterSet.innerHTML = '<option value="">Todas</option>';
    sortedSets.forEach(set => {
        const option = document.createElement('option');
        option.value = set;
        option.textContent = set;
        filterSet.appendChild(option);
    });

    // Log para debugging
    console.log('Sets encontrados:', sortedSets.length);
}

function renderDB() {
    userListsDiv.innerHTML = "";
    const keys = Object.keys(db);
    if (keys.length === 0) {
        userListsDiv.innerHTML = `<p class='text-gray-500 text-sm'>No lists saved yet.</p>`;
        return;
    }
    for (const id of keys) {
        const cards = db[id];
        const div = document.createElement("div");
        div.className =
            "p-4 border rounded-xl bg-white dark:bg-gray-800 shadow-sm flex flex-col";

        const validCards = cards.filter(c => c && c.Name);
        const uniqueCards = new Set(validCards.map(c => c.Name.toLowerCase()));

        div.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div>
          <div class="font-semibold">${id}</div>
          <div class="text-xs text-gray-500">${validCards.length} total cards (${uniqueCards.size} unique)</div>
        </div>
        <div class="flex gap-2">
          <button class="copyBtn px-2 py-1 text-xs border rounded">Copy Names</button>
          <button class="deleteBtn px-2 py-1 text-xs border rounded">Delete</button>
        </div>
      </div>
      <details class="text-xs mt-1">
        <summary class="cursor-pointer">Show cards</summary>
        <div class="mt-2 max-h-48 overflow-y-auto">
          ${validCards.map(card => {
            const parts = [];
            parts.push(card.Name || 'Unknown');
            if (card['Set name']) parts.push(`[${card['Set name']}]`);
            if (card.Foil === 'foil') parts.push('⭐');
            if (card.Quantity && card.Quantity !== '1') parts.push(`x${card.Quantity}`);
            return `<div class="py-0.5">${parts.join(' ')}</div>`;
        }).join('')}
        </div>
      </details>
    `;
        div.querySelector(".copyBtn").onclick = () => {
            const names = validCards.map(c => c.Name).join("\n");
            navigator.clipboard.writeText(names);
            message.textContent = `Copied ${id}'s card names to clipboard`;
        };
        div.querySelector(".deleteBtn").onclick = () => {
            delete db[id];
            saveDB();
        };
        userListsDiv.appendChild(div);
    }
}

saveBtn.onclick = () => {
    const id = idInput.value.trim();
    if (!id || !uploadFile.files[0]) {
        message.textContent = "Enter an identifier and select a file.";
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const cards = parseCSV(e.target.result);
        db[id] = cards;
        saveDB();
        idInput.value = "";
        uploadFile.value = "";
        message.textContent = `Saved ${id} (${cards.length} cards).`;
    };
    reader.readAsText(uploadFile.files[0]);
};

exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "magic_card_db.json";
    a.click();
    URL.revokeObjectURL(url);
};

importFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            db = data;
            saveDB();
            message.textContent = "Database imported successfully.";
        } catch (err) {
            message.textContent = "Invalid JSON file.";
        }
    };
    reader.readAsText(file);
};

// Función para aplicar filtros a las cartas
function applyFilters(cards) {
    const foilFilter = filterFoil.value;
    const rarityFilter = filterRarity.value.toLowerCase();
    const setFilter = filterSet.value;
    const languageFilter = filterLanguage.value;

    return cards.filter(card => {
        // Filtro de foil
        if (foilFilter === 'foil' && card.Foil !== 'foil') return false;
        if (foilFilter === 'nonfoil' && card.Foil === 'foil') return false;

        // Filtro de rareza - normalizar y comparar
        if (rarityFilter) {
            const cardRarity = (card.Rarity || '').toLowerCase().trim();
            if (cardRarity !== rarityFilter) return false;
        }

        // Filtro de set - buscar en Set name o Set code
        if (setFilter) {
            const cardSetName = (card['Set name'] || '').trim();
            const cardSetCode = (card['Set code'] || '').trim();
            if (cardSetName !== setFilter && cardSetCode !== setFilter) return false;
        }

        // Filtro de idioma
        if (languageFilter && card.Language !== languageFilter) return false;

        return true;
    });
}

// Actualizar estado de filtros
function updateFilterStatus() {
    const activeFilters = [];
    if (filterFoil.value) activeFilters.push(`Foil: ${filterFoil.options[filterFoil.selectedIndex].text}`);
    if (filterRarity.value) activeFilters.push(`Rareza: ${filterRarity.options[filterRarity.selectedIndex].text}`);
    if (filterSet.value) activeFilters.push(`Set: ${filterSet.value}`);
    if (filterLanguage.value) activeFilters.push(`Idioma: ${filterLanguage.options[filterLanguage.selectedIndex].text}`);

    if (activeFilters.length > 0) {
        filterStatus.textContent = `Filtros activos: ${activeFilters.join(', ')}`;
    } else {
        filterStatus.textContent = '';
    }
}

// Event listeners para actualizar el estado cuando cambian los filtros
[filterFoil, filterRarity, filterSet, filterLanguage].forEach(filter => {
    filter.addEventListener('change', updateFilterStatus);
});

// Limpiar filtros
clearFiltersBtn.onclick = () => {
    filterFoil.value = '';
    filterRarity.value = '';
    filterSet.value = '';
    filterLanguage.value = '';
    searchCard.value = '';
    updateFilterStatus();
    resultsDiv.innerHTML = '';
    message.textContent = 'Filtros limpiados';
};

function findMatches(myCards, applyFiltersFlag = false) {
    const matches = {};

    for (const [id, userCards] of Object.entries(db)) {
        const userMatches = [];

        for (const myCard of myCards) {
            if (!myCard || !myCard.Name) continue;
            const myName = myCard.Name.toLowerCase();

            let foundCards = userCards.filter(c =>
                c && c.Name && c.Name.toLowerCase() === myName
            );

            // Aplicar filtros si está habilitado
            if (applyFiltersFlag && foundCards.length > 0) {
                foundCards = applyFilters(foundCards);
            }

            if (foundCards.length > 0) {
                userMatches.push({
                    searchName: myCard.Name,
                    cards: foundCards
                });
            }
        }

        if (userMatches.length > 0) {
            matches[id] = userMatches;
        }
    }

    return matches;
}

matchBtn.onclick = () => {
    const process = (cards) => {
        const matches = findMatches(cards, false);
        displayResults(cards, matches);
    };
    if (myFile.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const cards = text.includes(',') && text.toLowerCase().includes('name')
                ? parseCSV(text)
                : parseTextToCards(text);
            process(cards);
        };
        reader.readAsText(myFile.files[0]);
    } else {
        process(parseTextToCards(myList.value));
    }
};

searchBtn.onclick = () => {
    const query = searchCard.value.trim();

    // Si no hay query pero hay filtros, buscar todas las cartas con esos filtros
    const hasFilters = filterFoil.value || filterRarity.value || filterSet.value || filterLanguage.value;

    if (!query && !hasFilters) {
        message.textContent = "Por favor, introduce el nombre de una carta o selecciona al menos un filtro";
        return;
    }

    // Si hay filtros pero no query, buscar todas las cartas
    if (!query && hasFilters) {
        searchAllWithFilters();
        return;
    }

    const searchCards = [{ Name: query }];
    const matches = findMatches(searchCards, true); // Aplicar filtros en búsqueda
    displayResults(searchCards, matches, true);
};

// Nueva función para buscar todas las cartas con filtros
function searchAllWithFilters() {
    const allMatches = {};

    for (const [id, userCards] of Object.entries(db)) {
        const filteredCards = applyFilters(userCards);

        if (filteredCards.length > 0) {
            // Agrupar por nombre de carta
            const cardGroups = {};
            for (const card of filteredCards) {
                const name = card.Name;
                if (!cardGroups[name]) {
                    cardGroups[name] = [];
                }
                cardGroups[name].push(card);
            }

            // Convertir a formato de matches
            const userMatches = [];
            for (const [name, cards] of Object.entries(cardGroups)) {
                userMatches.push({
                    searchName: name,
                    cards: cards
                });
            }

            allMatches[id] = userMatches;
        }
    }

    displayResults([{ Name: "Todas las cartas con filtros aplicados" }], allMatches, true);
}

function displayResults(myCards, matches, showFilterInfo = false) {
    // Guardar los datos actuales para cambiar de vista
    currentMatches = matches;
    currentSearchCards = myCards;
    currentShowFilterInfo = showFilterInfo;

    resultsDiv.innerHTML = "";

    // Contar cartas únicas (no versiones)
    const uniqueCardNames = new Set(myCards.map(c => c.Name.toLowerCase()));

    const myDiv = document.createElement("div");
    myDiv.innerHTML = `<div class="mb-3">
    <div class="font-semibold">Tu búsqueda (${uniqueCardNames.size} cartas únicas):</div>
    <pre class="text-xs text-gray-700 dark:text-gray-300">${myCards.map(c => c.Name).join("\n")}</pre>
    ${showFilterInfo && filterStatus.textContent ? `<div class="text-xs text-blue-600 dark:text-blue-400 mt-1">${filterStatus.textContent}</div>` : ''}
  </div>`;
    resultsDiv.appendChild(myDiv);

    const keys = Object.keys(matches);
    if (keys.length === 0) {
        resultsDiv.innerHTML += `<p class="text-gray-500">No se encontraron coincidencias${showFilterInfo ? ' con los filtros aplicados' : ''}.</p>`;
        return;
    }

    for (const [id, userMatches] of Object.entries(matches)) {
        const div = document.createElement("div");
        div.className = "p-4 border rounded-lg bg-white dark:bg-gray-800";

        // Contar cartas únicas (por nombre, no versiones)
        const uniqueCards = new Set(userMatches.map(m => m.searchName.toLowerCase()));
        const totalVersions = userMatches.reduce((sum, m) => sum + m.cards.length, 0);
        const totalQty = userMatches.reduce((sum, m) =>
            sum + m.cards.reduce((s, c) => s + parseInt(c.Quantity || 1), 0), 0
        );

        let content = `
            <div class="flex justify-between items-center cursor-pointer user-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                <div>
                    <div class="font-semibold text-lg">${id}</div>
                    <div class="text-xs text-gray-500">${uniqueCards.size} cartas únicas • ${totalVersions} versiones • ${totalQty} copias totales</div>
                </div>
                <div class="flex gap-2 items-center">
                    <button class="px-3 py-1 text-xs border rounded copyMatches hover:bg-gray-100 dark:hover:bg-gray-700" onclick="event.stopPropagation()">
                        Copy All
                    </button>
                    <span class="text-gray-400">▼</span>
                </div>
            </div>
            <div class="hidden mt-3 space-y-3">
        `;

        // Agrupar por nombre de carta
        for (const match of userMatches) {
            const totalQty = match.cards.reduce((sum, c) => sum + parseInt(c.Quantity || 1), 0);

            content += `
                <div class="border-l-2 border-blue-500 pl-3">
                    <div class="font-medium text-sm mb-1">${match.searchName} <span class="text-gray-500">(${totalQty} total, ${match.cards.length} versiones)</span></div>
                    <div class="space-y-1">
            `;

            for (const card of match.cards) {
                const details = [];
                if (card['Set name']) details.push(card['Set name']);
                if (card['Set code']) details.push(`(${card['Set code']})`);
                if (card['Collector number']) details.push(`#${card['Collector number']}`);

                const badges = [];
                if (card.Foil === 'foil') badges.push('<span class="text-yellow-500">⭐ Foil</span>');
                if (card.Quantity && card.Quantity !== '1') badges.push(`<span class="font-semibold">x${card.Quantity}</span>`);

                // Colores de rareza
                const rarityColors = {
                    'common': 'text-gray-600 dark:text-gray-400',
                    'uncommon': 'text-blue-600 dark:text-blue-400',
                    'rare': 'text-yellow-600 dark:text-yellow-400',
                    'mythic': 'text-red-600 dark:text-red-400'
                };
                const rarityColor = rarityColors[card.Rarity?.toLowerCase()] || 'text-purple-600 dark:text-purple-400';

                if (card.Rarity) badges.push(`<span class="${rarityColor}">${card.Rarity}</span>`);
                if (card.Language && card.Language !== 'en') badges.push(`<span class="text-blue-600">🌐 ${card.Language.toUpperCase()}</span>`);

                content += `
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                        ${details.join(' ')}
                        ${badges.length > 0 ? `<span class="ml-2">${badges.join(' ')}</span>` : ''}
                    </div>
                `;
            }

            content += `
                    </div>
                </div>
            `;
        }

        content += `</div>`;
        div.innerHTML = content;

        div.querySelector(".copyMatches").onclick = (e) => {
            e.stopPropagation();
            const allCards = userMatches.flatMap(m => m.cards.map(c => c.Name));
            navigator.clipboard.writeText(allCards.join("\n"));
            message.textContent = `Copiadas ${allCards.length} coincidencias de ${id}`;
        };

        resultsDiv.appendChild(div);
    }
}

// Vista "Quién tiene qué" - agrupa por carta en vez de por usuario
function displayWhoHasView(myCards, matches, showFilterInfo = false) {
    resultsDiv.innerHTML = "";

    const uniqueCardNames = new Set(myCards.map(c => c.Name.toLowerCase()));

    const myDiv = document.createElement("div");
    myDiv.innerHTML = `<div class="mb-3">
    <div class="font-semibold">Vista "Quién tiene qué" (${uniqueCardNames.size} cartas únicas):</div>
    ${showFilterInfo && filterStatus.textContent ? `<div class="text-xs text-blue-600 dark:text-blue-400 mt-1">${filterStatus.textContent}</div>` : ''}
  </div>`;
    resultsDiv.appendChild(myDiv);

    const keys = Object.keys(matches);
    if (keys.length === 0) {
        resultsDiv.innerHTML += `<p class="text-gray-500">No se encontraron coincidencias${showFilterInfo ? ' con los filtros aplicados' : ''}.</p>`;
        return;
    }

    // Reorganizar datos: agrupar por carta en vez de por usuario
    const cardMap = {};

    for (const [userId, userMatches] of Object.entries(matches)) {
        for (const match of userMatches) {
            const cardName = match.searchName;
            if (!cardMap[cardName]) {
                cardMap[cardName] = {};
            }
            cardMap[cardName][userId] = match.cards;
        }
    }

    // Mostrar cada carta con sus dueños
    for (const [cardName, owners] of Object.entries(cardMap)) {
        const div = document.createElement("div");
        div.className = "p-4 border rounded-lg bg-white dark:bg-gray-800";

        const totalOwners = Object.keys(owners).length;
        const totalCopies = Object.values(owners).reduce((sum, cards) =>
            sum + cards.reduce((s, c) => s + parseInt(c.Quantity || 1), 0), 0
        );

        let content = `
            <div class="flex justify-between items-center cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
                <div>
                    <div class="font-semibold text-lg">${cardName}</div>
                    <div class="text-xs text-gray-500">${totalOwners} jugadores tienen esta carta • ${totalCopies} copias totales</div>
                </div>
                <span class="text-gray-400">▼</span>
            </div>
            <div class="hidden mt-3 space-y-2">
        `;

        for (const [userId, cards] of Object.entries(owners)) {
            const userTotal = cards.reduce((sum, c) => sum + parseInt(c.Quantity || 1), 0);

            content += `
                <div class="border-l-2 border-green-500 pl-3">
                    <div class="font-medium text-sm mb-1">${userId} <span class="text-gray-500">(${userTotal} copias, ${cards.length} versiones)</span></div>
                    <div class="space-y-1">
            `;

            for (const card of cards) {
                const details = [];
                if (card['Set name']) details.push(card['Set name']);
                if (card['Set code']) details.push(`(${card['Set code']})`);
                if (card['Collector number']) details.push(`#${card['Collector number']}`);

                const badges = [];
                if (card.Foil === 'foil') badges.push('<span class="text-yellow-500">⭐ Foil</span>');
                if (card.Quantity && card.Quantity !== '1') badges.push(`<span class="font-semibold">x${card.Quantity}</span>`);

                const rarityColors = {
                    'common': 'text-gray-600 dark:text-gray-400',
                    'uncommon': 'text-blue-600 dark:text-blue-400',
                    'rare': 'text-yellow-600 dark:text-yellow-400',
                    'mythic': 'text-red-600 dark:text-red-400'
                };
                const rarityColor = rarityColors[card.Rarity?.toLowerCase()] || 'text-purple-600 dark:text-purple-400';

                if (card.Rarity) badges.push(`<span class="${rarityColor}">${card.Rarity}</span>`);
                if (card.Language && card.Language !== 'en') badges.push(`<span class="text-blue-600">🌐 ${card.Language.toUpperCase()}</span>`);

                content += `
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                        ${details.join(' ')}
                        ${badges.length > 0 ? `<span class="ml-2">${badges.join(' ')}</span>` : ''}
                    </div>
                `;
            }

            content += `
                    </div>
                </div>
            `;
        }

        content += `</div>`;
        div.innerHTML = content;
        resultsDiv.appendChild(div);
    }
}

// Inicialización
renderDB();
updateFilterOptions();
updateFilterStatus();

// Event listeners para cambio de vista
viewNormalBtn.onclick = () => {
    if (currentMatches && currentSearchCards) {
        displayResults(currentSearchCards, currentMatches, currentShowFilterInfo);
    }
};

viewWhoHasBtn.onclick = () => {
    if (currentMatches && currentSearchCards) {
        displayWhoHasView(currentSearchCards, currentMatches, currentShowFilterInfo);
    }
};