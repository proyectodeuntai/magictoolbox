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
const filterMessage = document.getElementById("filterMessage"); // AÑADIDO: Mensaje de error de filtro

// ELIMINADOS: viewNormalBtn, viewWhoHasBtn (eliminados por la solicitud del usuario)

const exportResultsBtn = document.getElementById("exportResults"); // Ahora en el menú de Acciones
const compareUsersBtn = document.getElementById("compareUsers"); // Ahora en el menú de Acciones
const statsBtn = document.getElementById("statsBtn"); // Ahora en el menú de Acciones

// Modales
const compareModal = document.getElementById("compareModal");
const closeCompareModal = document.getElementById("closeCompareModal");
const compareUser1 = document.getElementById("compareUser1");
const compareUser2 = document.getElementById("compareUser2");
const runComparisonBtn = document.getElementById("runComparison");
const comparisonResults = document.getElementById("comparisonResults");

const statsModal = document.getElementById("statsModal");
const closeStatsModal = document.getElementById("closeStatsModal");
const statsContent = document.getElementById("statsContent");

// Wishlist
const toggleWishlistBtn = document.getElementById("toggleWishlist");
const wishlistModal = document.getElementById("wishlistModal");
const closeWishlistModal = document.getElementById("closeWishlistModal");
const wishlistCardName = document.getElementById("wishlistCardName");
const wishlistPriority = document.getElementById("wishlistPriority");
const wishlistFoilOnly = document.getElementById("wishlistFoilOnly");
const wishlistSpecificSet = document.getElementById("wishlistSpecificSet");
const wishlistSetCode = document.getElementById("wishlistSetCode");
const addToWishlistBtn = document.getElementById("addToWishlist");
const wishlistContent = document.getElementById("wishlistContent");
const checkWishlistAvailabilityBtn = document.getElementById("checkWishlistAvailability");
const wishlistResults = document.getElementById("wishlistResults");
const shareWishlistBtn = document.getElementById("shareWishlist");
const importWishlistBtn = document.getElementById("importWishlist");
const wishlistPercentage = document.getElementById("wishlistPercentage");
const wishlistProgressBar = document.getElementById("wishlistProgressBar");
const wishlistTotal = document.getElementById("wishlistTotal");
const wishlistAvailable = document.getElementById("wishlistAvailable");
const wishlistMissing = document.getElementById("wishlistMissing");
const wishlistValue = document.getElementById("wishlistValue");
const updatePricesBtn = document.getElementById("updatePrices");
const wishlistFetchPrice = document.getElementById("wishlistFetchPrice");

let db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
let currentMatches = null;
let currentSearchCards = null;
let currentShowFilterInfo = false;
let searchHistory = JSON.parse(localStorage.getItem("search_history") || "[]");
let wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");

// ==============================
// GESTIÓN DE LA BASE DE DATOS (DB)
// ==============================

function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    renderDB();
    updateFilterOptions();
}

function saveWishlist() {
    localStorage.setItem("wishlist", JSON.stringify(wishlist));
    renderWishlist();
    updateWishlistStats();
}

// ==============================
// PARSEO DE ARCHIVOS
// ==============================

// Función mejorada para parsear CSV respetando las columnas
function parseCSV(text) {
    if (!text) return [];

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    const firstLine = lines[0].toLowerCase();
    const isCSV = firstLine.includes('name') && firstLine.includes('set');

    if (isCSV && lines.length > 1) {
        const headers = parseCSVLine(lines[0]).map(h => h.trim());
        const cards = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const card = {};
            headers.forEach((header, index) => {
                card[header] = values[index] || '';
            });

            if (card.Name && card.Name.trim()) {
                // Normalizar claves comunes si no están exactas (ej: Quantity, Set Name)
                if (!card.Quantity && card.Count) card.Quantity = card.Count;
                if (!card['Set name'] && card['Set Name']) card['Set name'] = card['Set Name'];

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

// ==============================
// RENDERIZADO DE LA DB
// ==============================

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
}

function renderDB() {
    userListsDiv.innerHTML = "";
    const userIds = Object.keys(db).sort();

    // Rellenar modales de comparación
    const compareOptionsHtml = userIds.map(id => `<option value="${id}">${id}</option>`).join('');
    compareUser1.innerHTML = `<option value="">Selecciona un jugador</option>${compareOptionsHtml}`;
    compareUser2.innerHTML = `<option value="">Selecciona un jugador</option>${compareOptionsHtml}`;


    userIds.forEach(id => {
        const div = document.createElement("div");
        div.className = "p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm";

        const cards = db[id];
        const uniqueCards = new Set(cards.map(c => c.Name));
        const totalQty = cards.reduce((sum, c) => sum + parseInt(c.Quantity || 1), 0);
        const totalVersions = cards.length;

        let content = `
            <div class="flex justify-between items-center cursor-pointer user-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                <div>
                    <div class="font-semibold text-lg">${id}</div>
                    <div class="text-xs text-gray-500">${uniqueCards.size} cartas únicas • ${totalVersions} versiones • ${totalQty} copias totales</div>
                </div>
                <div class="flex gap-2">
                    <button data-id="${id}" class="remove-user text-red-500 hover:text-red-700 text-sm">
                        [Eliminar]
                    </button>
                </div>
            </div>
            <div class="hidden pt-2 border-t mt-2 text-xs max-h-48 overflow-y-auto">
                ${cards.map(c => `<div>${c.Quantity || 1}x ${c.Name} ${c['Set name'] ? `(${c['Set name']})` : ''} ${c.Foil === 'foil' ? '⭐' : ''}</div>`).join('')}
            </div>
        `;

        div.innerHTML = content;
        div.querySelector(".remove-user").onclick = (e) => {
            e.stopPropagation(); // Evitar que se colapse/expanda la lista
            if (confirm(`¿Estás seguro de eliminar la lista de ${id}?`)) {
                delete db[id];
                saveDB();
            }
        };
        userListsDiv.appendChild(div);
    });
}

// ==============================
// GESTIÓN DE EVENTOS DE DB
// ==============================

saveBtn.onclick = () => {
    const id = idInput.value.trim();
    const file = uploadFile.files[0];

    filterMessage.textContent = ""; // Limpiar mensaje de filtro

    if (!id) {
        message.textContent = "Por favor, introduce un identificador para el usuario.";
        return;
    }
    if (!file) {
        message.textContent = "Por favor, selecciona un archivo para subir.";
        return;
    }

    message.textContent = "Procesando...";

    const reader = new FileReader();
    reader.onload = (e) => {
        const cards = parseCSV(e.target.result);

        if (cards.length === 0) {
            message.textContent = "Error: El archivo no contiene cartas válidas o está vacío.";
            return;
        }

        // Eliminar lista anterior si existe
        if (db[id] && !confirm(`Ya existe una lista para "${id}". ¿Deseas reemplazarla?`)) {
            message.textContent = "";
            return;
        }

        db[id] = cards;
        saveDB();
        message.textContent = `Lista de "${id}" guardada. Total de ${cards.length} entradas.`;
        idInput.value = "";
        uploadFile.value = "";
    };
    reader.readAsText(file);
};

exportBtn.onclick = () => {
    const dataStr = JSON.stringify(db);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'magic_card_matcher_db.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
};

importFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedDB = JSON.parse(e.target.result);

            // Validar que el objeto sea un DB válido (un mapa de objetos)
            if (typeof importedDB !== 'object' || Array.isArray(importedDB) || Object.keys(importedDB).length === 0) {
                alert("Error de importación: El archivo JSON no parece ser un formato de base de datos válido.");
                return;
            }

            // Si hay datos, pedir confirmación
            if (Object.keys(db).length > 0) {
                if (confirm("Al importar, se sobrescribirá la base de datos actual. ¿Deseas continuar?")) {
                    db = importedDB;
                    saveDB();
                    alert(`✅ Base de datos importada correctamente. ${Object.keys(db).length} listas cargadas.`);
                }
            } else {
                db = importedDB;
                saveDB();
                alert(`✅ Base de datos importada correctamente. ${Object.keys(db).length} listas cargadas.`);
            }

        } catch (error) {
            alert(`❌ Error al leer el archivo JSON: ${error.message}`);
        } finally {
            importFile.value = ""; // Limpiar el input
        }
    };
    reader.readAsText(file);
};

// ==============================
// LÓGICA DE COINCIDENCIAS (MATCHING)
// ==============================

// Función principal de procesamiento de la lista propia
function process(myCards) {
    const matches = {}; // { userId: [{ searchName: 'Name', cards: [cardObject, ...] }, ...] }

    // Iterar sobre cada usuario en la DB
    for (const userId in db) {
        const userCards = db[userId];
        const userMatches = [];

        // Para cada carta en mi lista, buscar coincidencias en la lista del usuario
        for (const myCard of myCards) {
            const searchName = myCard.Name.toLowerCase().trim();

            const foundCards = userCards.filter(userCard => {
                // Normalizar nombres para comparación
                const userCardName = userCard.Name.toLowerCase().trim();
                return userCardName === searchName;
            });

            if (foundCards.length > 0) {
                userMatches.push({
                    searchName: myCard.Name, // Nombre original
                    cards: foundCards, // Versiones encontradas
                });
            }
        }

        if (userMatches.length > 0) {
            matches[userId] = userMatches;
        }
    }
    return matches;
}

// Lógica de búsqueda avanzada
function runSearch(query, hasFilters) {
    const searchResults = [];
    const normalizedQuery = query.toLowerCase().trim();

    const foilFilter = filterFoil.value;
    const rarityFilter = filterRarity.value;
    const setFilter = filterSet.value;
    const langFilter = filterLanguage.value;

    // Iterar sobre cada usuario en la DB
    for (const userId in db) {
        const userCards = db[userId];

        // Para cada carta en la lista del usuario, aplicar filtros y búsqueda
        for (const userCard of userCards) {
            const userCardName = userCard.Name.toLowerCase().trim();
            let passesFilter = true;

            // 1. Filtro por nombre (si hay query)
            if (normalizedQuery && !userCardName.includes(normalizedQuery)) {
                passesFilter = false;
            }

            // 2. Filtro Foil
            if (passesFilter && foilFilter) {
                const isFoil = (userCard.Foil || '').toLowerCase();
                if (foilFilter === 'foil' && isFoil !== 'foil') {
                    passesFilter = false;
                } else if (foilFilter === 'nonfoil' && isFoil === 'foil') {
                    passesFilter = false;
                }
            }

            // 3. Filtro Rareza
            if (passesFilter && rarityFilter) {
                const rarity = (userCard.Rarity || '').toLowerCase();
                if (rarity !== rarityFilter) {
                    passesFilter = false;
                }
            }

            // 4. Filtro Set
            if (passesFilter && setFilter) {
                const setName = (userCard['Set name'] || '').toLowerCase();
                if (setName !== setFilter.toLowerCase()) {
                    passesFilter = false;
                }
            }

            // 5. Filtro Idioma
            if (passesFilter && langFilter) {
                const lang = (userCard.Language || '').toLowerCase();
                if (lang !== langFilter) {
                    passesFilter = false;
                }
            }

            if (passesFilter) {
                searchResults.push({
                    ...userCard,
                    user: userId, // Agregar el ID del dueño
                });
            }
        }
    }
    return searchResults;
}


// ==============================
// RENDERIZADO DE RESULTADOS (VISTA ÚNICA)
// ==============================

// Función única de renderizado de resultados de Match (Quién tiene qué)
function renderWhoHasWhatMatches(matches) {
    resultsDiv.innerHTML = "";

    if (!matches || Object.keys(matches).length === 0) {
        resultsDiv.innerHTML = '<p class="text-gray-500">No se encontraron coincidencias.</p>';
        exportResultsBtn.disabled = true;
        return;
    }

    const allUsers = Object.keys(db).sort();
    const cardMap = {}; // { cardName: { userId: [cardObjects], ... }, ... }

    // 1. Mapear todas las cartas encontradas a sus dueños
    for (const [userId, userMatches] of Object.entries(matches)) {
        for (const match of userMatches) {
            const cardName = match.searchName;
            if (!cardMap[cardName]) {
                cardMap[cardName] = {};
            }
            cardMap[cardName][userId] = match.cards;
        }
    }

    // 2. Mostrar cada carta con sus dueños
    const sortedCardNames = Object.keys(cardMap).sort();

    for (const cardName of sortedCardNames) {
        const owners = cardMap[cardName];

        const div = document.createElement("div");
        div.className = "p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-md";

        const totalOwners = Object.keys(owners).length;
        const totalVersionsFound = Object.values(owners).flat().length;

        let ownersHtml = allUsers.map(user => {
            const userHas = owners[user];
            if (userHas && userHas.length > 0) {
                const versionsHtml = userHas.map(c => {
                    const setInfo = c['Set name'] ? `(${c['Set name']})` : '';
                    const foilInfo = c.Foil === 'foil' ? '⭐' : '';
                    return `
                        <div class="py-0.5 text-xs">
                            ${c.Quantity || 1}x ${setInfo} ${c['Set code'] ? c['Set code'] : ''} ${foilInfo}
                        </div>
                    `;
                }).join('');

                return `
                    <details class="mb-1 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                        <summary class="font-semibold text-sm cursor-pointer">${user} (${userHas.length} versiones)</summary>
                        <div class="mt-1">${versionsHtml}</div>
                    </details>
                `;
            } else {
                return `
                    <div class="text-xs text-gray-500 mb-1 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        ${user}: No la tiene
                    </div>
                `;
            }
        }).join('');

        div.innerHTML = `
            <h3 class="font-bold text-lg mb-2">${cardName}</h3>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Encontrada en ${totalOwners} listas. (${totalVersionsFound} versiones únicas en total)
            </div>
            ${ownersHtml}
        `;
        resultsDiv.appendChild(div);
    }
    exportResultsBtn.disabled = false;
}

// Función única de renderizado de resultados de Búsqueda (Quién tiene qué)
function renderWhoHasWhatSearch(searchCards) {
    resultsDiv.innerHTML = "";

    if (!searchCards || searchCards.length === 0) {
        resultsDiv.innerHTML = '<p class="text-gray-500">No se encontraron cartas con esos filtros/nombre.</p>';
        exportResultsBtn.disabled = true;
        return;
    }

    // Agrupar por nombre de carta para la vista "Quién tiene qué"
    const cardGroups = {}; // { cardName: { user: [cardObjects], ... }, ... }
    for (const card of searchCards) {
        if (!cardGroups[card.Name]) {
            cardGroups[card.Name] = {};
        }
        if (!cardGroups[card.Name][card.user]) {
            cardGroups[card.Name][card.user] = [];
        }
        cardGroups[card.Name][card.user].push(card);
    }

    // Renderizar los grupos
    const sortedCardNames = Object.keys(cardGroups).sort();

    for (const cardName of sortedCardNames) {
        const owners = cardGroups[cardName];

        const div = document.createElement("div");
        div.className = "p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-md";

        const totalOwners = Object.keys(owners).length;

        let ownersHtml = Object.entries(owners).map(([user, userCards]) => {
            const versionsHtml = userCards.map(c => {
                const setInfo = c['Set name'] ? `(${c['Set name']})` : '';
                const foilInfo = c.Foil === 'foil' ? '⭐' : '';
                return `
                    <div class="py-0.5 text-xs">
                        ${c.Quantity || 1}x ${setInfo} ${c['Set code'] ? c['Set code'] : ''} ${foilInfo}
                    </div>
                `;
            }).join('');

            return `
                <details class="mb-1 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <summary class="font-semibold text-sm cursor-pointer">${user} (${userCards.length} versiones)</summary>
                    <div class="mt-1">${versionsHtml}</div>
                </details>
            `;
        }).join('');


        div.innerHTML = `
            <h3 class="font-bold text-lg mb-2">${cardName}</h3>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Encontrada en ${totalOwners} listas.
            </div>
            ${ownersHtml}
        `;
        resultsDiv.appendChild(div);
    }
    exportResultsBtn.disabled = false;
}


// Función central de display (Simplificada a una sola vista)
function displayResults() {
    resultsDiv.innerHTML = '<p class="text-gray-500">Procesando...</p>';

    if (currentMatches) {
        renderWhoHasWhatMatches(currentMatches);
    } else if (currentSearchCards) {
        renderWhoHasWhatSearch(currentSearchCards);
    } else {
        resultsDiv.innerHTML = '<p class="text-gray-500">Presiona "Encontrar coincidencias" o "Buscar" para ver los resultados.</p>';
        exportResultsBtn.disabled = true;
    }
}

// ==============================
// GESTIÓN DE EVENTOS DE MATCH/SEARCH
// ==============================

matchBtn.onclick = () => {
    const text = myList.value.trim();

    filterMessage.textContent = ""; // Limpiar mensaje de filtro

    if (!text && !myFile.files[0]) {
        message.textContent = "Por favor, pega una lista o selecciona un archivo.";
        return;
    }

    if (myFile.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const myCards = parseCSV(e.target.result);
            const processedMatches = process(myCards);
            currentMatches = processedMatches;
            currentSearchCards = null;
            displayResults();
        };
        reader.readAsText(myFile.files[0]);
    } else {
        const myCards = parseTextToCards(myList.value);
        const processedMatches = process(myCards);
        currentMatches = processedMatches;
        currentSearchCards = null;
        displayResults();
    }
};

// ==============================
// FILTROS Y BÚSQUEDA
// ==============================

function updateFilterStatus() {
    const filters = [];
    if (searchCard.value.trim()) filters.push(`Nombre: "${searchCard.value.trim()}"`);
    if (filterFoil.value) filters.push(`Acabado: ${filterFoil.options[filterFoil.selectedIndex].text}`);
    if (filterRarity.value) filters.push(`Rareza: ${filterRarity.options[filterRarity.selectedIndex].text}`);
    if (filterSet.value) filters.push(`Expansión: ${filterSet.options[filterSet.selectedIndex].text}`);
    if (filterLanguage.value) filters.push(`Idioma: ${filterLanguage.options[filterLanguage.selectedIndex].text}`);

    if (filters.length > 0) {
        filterStatus.textContent = `Filtros activos: ${filters.join(', ')}`;
        return true;
    } else {
        filterStatus.textContent = '';
        return false;
    }
}

function handleFilterChange() {
    filterMessage.textContent = ""; // Limpiar mensaje de error al cambiar cualquier filtro
    updateFilterStatus();
}

filterFoil.onchange = handleFilterChange;
filterRarity.onchange = handleFilterChange;
filterSet.onchange = handleFilterChange;
filterLanguage.onchange = handleFilterChange;
searchCard.oninput = handleFilterChange; // Actualizar estado mientras se escribe

searchBtn.onclick = () => {
    const query = searchCard.value.trim();
    const hasFilters = filterFoil.value || filterRarity.value || filterSet.value || filterLanguage.value;

    message.textContent = ""; // Limpiar el mensaje de subida de lista

    if (!query && !hasFilters) {
        // Usar el elemento dedicado para errores de filtro
        filterMessage.textContent = "Por favor, introduce el nombre de una carta o selecciona al menos un filtro.";
        return;
    }

    // Si la búsqueda es válida, limpiar el mensaje de error del filtro
    filterMessage.textContent = "";

    currentSearchCards = runSearch(query, hasFilters);
    currentMatches = null;
    displayResults();
};

clearFiltersBtn.onclick = () => {
    searchCard.value = '';
    filterFoil.value = '';
    filterRarity.value = '';
    filterSet.value = '';
    filterLanguage.value = '';
    filterMessage.textContent = ""; // Limpiar el mensaje de error al limpiar filtros
    updateFilterStatus();
    currentSearchCards = null; // Limpiar resultados de búsqueda
    displayResults();
};


// ==============================
// EXPORTAR RESULTADOS (EN EL NUEVO MENÚ)
// ==============================

exportResultsBtn.onclick = () => {
    let data;
    let fileName = "resultados_matcher.txt";

    if (currentMatches) {
        // Formato para Match
        data = Object.keys(currentMatches).map(userId => {
            let userReport = `--- Cartas que ${userId} tiene ---\n`;
            userReport += currentMatches[userId].map(match => {
                const versions = match.cards.map(c =>
                    `  ${c.Quantity || 1}x ${c['Set name'] || ''} (${c['Set code'] || ''}) ${c.Foil === 'foil' ? '⭐' : ''}`
                ).join('\n');
                return `${match.searchName}\n${versions}`;
            }).join('\n\n');
            return userReport;
        }).join('\n\n=================================\n\n');
        fileName = "coincidencias_match.txt";

    } else if (currentSearchCards) {
        // Formato para Búsqueda
        const cardGroups = {}; // Agrupar por nombre
        currentSearchCards.forEach(card => {
            if (!cardGroups[card.Name]) cardGroups[card.Name] = [];
            cardGroups[card.Name].push(card);
        });

        data = Object.entries(cardGroups).map(([cardName, cards]) => {
            let cardReport = `--- ${cardName} ---\n`;
            cardReport += cards.map(c =>
                `${c.Quantity || 1}x ${c.user} - ${c['Set name'] || ''} (${c['Set code'] || ''}) ${c.Foil === 'foil' ? '⭐' : ''}`
            ).join('\n');
            return cardReport;
        }).join('\n\n');
        fileName = "resultados_busqueda.txt";
    }

    if (data) {
        const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(data);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', fileName);
        linkElement.click();
    } else {
        alert("No hay resultados para exportar.");
    }
};

// ==============================
// MODAL COMPARAR JUGADORES
// ==============================

compareUsersBtn.onclick = () => {
    if (Object.keys(db).length < 2) {
        alert("Necesitas al menos 2 listas guardadas para comparar jugadores.");
        return;
    }
    comparisonResults.innerHTML = '';
    compareModal.classList.remove("hidden");

    // Si el modal de acciones está abierto (details), lo cierro al abrir el modal
    document.getElementById('floating-actions').querySelector('details').open = false;
};

closeCompareModal.onclick = () => {
    compareModal.classList.add("hidden");
};

runComparisonBtn.onclick = () => {
    const user1Id = compareUser1.value;
    const user2Id = compareUser2.value;

    if (!user1Id || !user2Id) {
        comparisonResults.innerHTML = '<p class="text-red-500">Selecciona dos jugadores.</p>';
        return;
    }
    if (user1Id === user2Id) {
        comparisonResults.innerHTML = '<p class="text-red-500">Selecciona dos jugadores diferentes.</p>';
        return;
    }

    const cards1 = db[user1Id];
    const cards2 = db[user2Id];

    const uniqueNames1 = new Set(cards1.map(c => c.Name.toLowerCase()));
    const uniqueNames2 = new Set(cards2.map(c => c.Name.toLowerCase()));

    const only1 = [];
    const only2 = [];
    const both = [];

    // Cartas que solo tiene el Jugador 1
    uniqueNames1.forEach(name => {
        if (!uniqueNames2.has(name)) {
            only1.push(cards1.find(c => c.Name.toLowerCase() === name).Name);
        } else {
            both.push(cards1.find(c => c.Name.toLowerCase() === name).Name);
        }
    });

    // Cartas que solo tiene el Jugador 2 (y que no contamos ya en 'both')
    uniqueNames2.forEach(name => {
        if (!uniqueNames1.has(name)) {
            only2.push(cards2.find(c => c.Name.toLowerCase() === name).Name);
        }
    });

    const totalUniqueCards = new Set([...uniqueNames1, ...uniqueNames2]).size;

    comparisonResults.innerHTML = `
        <div class="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-700">
            <h4 class="font-bold text-lg mb-3">Resumen de la Comparación</h4>
            <p>Cartas únicas en total: <span class="font-semibold">${totalUniqueCards}</span></p>
            <p>${user1Id} tiene ${uniqueNames1.size} cartas únicas.</p>
            <p>${user2Id} tiene ${uniqueNames2.size} cartas únicas.</p>
            <p class="text-green-600 dark:text-green-400">Ambos tienen en común: <span class="font-semibold">${both.length}</span> cartas.</p>
        </div>

        <div class="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div class="p-3 border rounded-lg max-h-60 overflow-y-auto">
                <h5 class="font-semibold text-blue-600 dark:text-blue-400">Solo ${user1Id} (${only1.length}):</h5>
                <ul class="list-disc ml-4 text-xs">
                    ${only1.sort().map(name => `<li>${name}</li>`).join('')}
                </ul>
            </div>
            <div class="p-3 border rounded-lg max-h-60 overflow-y-auto">
                <h5 class="font-semibold text-red-600 dark:text-red-400">Solo ${user2Id} (${only2.length}):</h5>
                <ul class="list-disc ml-4 text-xs">
                    ${only2.sort().map(name => `<li>${name}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
};


// ==============================
// MODAL ESTADÍSTICAS
// ==============================

statsBtn.onclick = () => {
    if (Object.keys(db).length === 0) {
        alert("Sube al menos una lista para ver estadísticas.");
        return;
    }
    renderStats();
    statsModal.classList.remove("hidden");

    // Si el modal de acciones está abierto (details), lo cierro al abrir el modal
    document.getElementById('floating-actions').querySelector('details').open = false;
};

closeStatsModal.onclick = () => {
    statsModal.classList.add("hidden");
};

function renderStats() {
    statsContent.innerHTML = '<p>Calculando estadísticas...</p>';

    const allUsers = Object.keys(db).sort();
    const globalStats = {
        totalUniqueCards: new Set(),
        totalCopies: 0,
        rarityCounts: {},
        setCounts: {},
        userReports: {},
    };

    allUsers.forEach(userId => {
        const userCards = db[userId];
        const userReport = {
            unique: new Set(),
            total: 0,
            foil: 0,
            common: 0,
            uncommon: 0,
            rare: 0,
            mythic: 0,
        };

        userCards.forEach(card => {
            const qty = parseInt(card.Quantity || 1);
            const rarity = (card.Rarity || 'unknown').toLowerCase();
            const setName = card['Set name'] || 'Unknown Set';

            // Global
            globalStats.totalCopies += qty;
            globalStats.totalUniqueCards.add(card.Name.toLowerCase());

            globalStats.rarityCounts[rarity] = (globalStats.rarityCounts[rarity] || 0) + qty;
            globalStats.setCounts[setName] = (globalStats.setCounts[setName] || 0) + qty;

            // User
            userReport.unique.add(card.Name.toLowerCase());
            userReport.total += qty;
            if (card.Foil === 'foil') userReport.foil += qty;
            if (rarity === 'common') userReport.common += qty;
            if (rarity === 'uncommon') userReport.uncommon += qty;
            if (rarity === 'rare') userReport.rare += qty;
            if (rarity === 'mythic') userReport.mythic += qty;
        });

        globalStats.userReports[userId] = userReport;
    });

    // 1. Resumen Global
    let globalHtml = `
        <h3 class="text-xl font-bold mb-3">Resumen Global de Colección</h3>
        <div class="grid md:grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <div><span class="font-semibold">${globalStats.totalUniqueCards.size}</span> Cartas Únicas</div>
            <div><span class="font-semibold">${globalStats.totalCopies}</span> Copias Totales</div>
            <div><span class="font-semibold">${allUsers.length}</span> Listas de Jugadores</div>
        </div>
    `;

    // 2. Estadísticas por Jugador
    let userHtml = `
        <h3 class="text-xl font-bold mb-3 mt-6">Estadísticas por Jugador</h3>
        <div class="space-y-4">
        ${allUsers.map(userId => {
        const report = globalStats.userReports[userId];
        return `
                <div class="p-4 border rounded-lg dark:border-gray-700">
                    <h4 class="font-bold text-lg">${userId}</h4>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-2">
                        <div>Total Copias: <span class="font-semibold">${report.total}</span></div>
                        <div>Cartas Únicas: <span class="font-semibold">${report.unique.size}</span></div>
                        <div>Foils: <span class="font-semibold text-yellow-600">${report.foil}</span></div>
                        <div>Mythics: <span class="font-semibold text-red-600">${report.mythic}</span></div>
                    </div>
                </div>
            `;
    }).join('')}
        </div>
    `;

    // 3. Distribución de Rareza Global
    const sortedRarities = Object.entries(globalStats.rarityCounts).sort(([, a], [, b]) => b - a);
    let rarityHtml = `
        <h3 class="text-xl font-bold mb-3 mt-6">Distribución Global por Rareza</h3>
        <div class="grid md:grid-cols-4 gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            ${sortedRarities.map(([rarity, count]) => {
        const percentage = ((count / globalStats.totalCopies) * 100).toFixed(1);
        return `
                    <div class="text-sm">
                        <span class="capitalize font-semibold">${rarity}:</span> ${count} (${percentage}%)
                    </div>
                `;
    }).join('')}
        </div>
    `;

    // 4. Top Sets Global
    const sortedSets = Object.entries(globalStats.setCounts).sort(([, a], [, b]) => b - a).slice(0, 10);
    let setHtml = `
        <h3 class="text-xl font-bold mb-3 mt-6">Top 10 de Expansiones (Copias)</h3>
        <ol class="space-y-1 list-decimal list-inside p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            ${sortedSets.map(([set, count], index) =>
        `<li class="text-sm"><span class="font-semibold">${set}</span>: ${count} copias</li>`
    ).join('')}
        </ol>
    `;


    statsContent.innerHTML = globalHtml + userHtml + rarityHtml + setHtml;
}


// ==============================
// GESTIÓN DE WISHLIST
// ==============================

toggleWishlistBtn.onclick = () => {
    wishlistModal.classList.remove("hidden");
    updateWishlistStats();
};

closeWishlistModal.onclick = () => {
    wishlistModal.classList.add("hidden");
};

wishlistSpecificSet.onchange = () => {
    wishlistSetCode.disabled = !wishlistSpecificSet.checked;
    if (!wishlistSpecificSet.checked) {
        wishlistSetCode.value = '';
    }
}

addToWishlistBtn.onclick = () => {
    const cardName = wishlistCardName.value.trim();
    if (!cardName) {
        alert("Introduce el nombre de una carta.");
        return;
    }

    const newItem = {
        id: Date.now(),
        name: cardName,
        priority: wishlistPriority.value,
        foilOnly: wishlistFoilOnly.checked,
        specificSet: wishlistSpecificSet.checked ? wishlistSetCode.value.trim().toUpperCase() : null,
        prices: null, // Para guardar precios
    };

    wishlist.push(newItem);
    saveWishlist();

    // Limpiar campos
    wishlistCardName.value = '';
    wishlistPriority.value = 'medium';
    wishlistFoilOnly.checked = false;
    wishlistSpecificSet.checked = false;
    wishlistSetCode.value = '';
    wishlistSetCode.disabled = true;
};


function renderWishlist() {
    wishlistContent.innerHTML = '';
    if (wishlist.length === 0) {
        wishlistContent.innerHTML = '<p class="text-gray-500 italic">Tu Wishlist está vacía.</p>';
        return;
    }

    const priorityMap = {
        'high': '🔴',
        'medium': '🟡',
        'low': '🟢'
    };

    wishlist.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-700";

        let details = [];
        if (item.foilOnly) details.push('⭐ Foil');
        if (item.specificSet) details.push(`[Set: ${item.specificSet}]`);

        const priceInfo = item.prices && item.prices.avg > 0 ?
            `<span class="text-xs text-blue-600 dark:text-blue-400 font-semibold">${item.prices.avg.toFixed(2)}€</span>` :
            `<span class="text-xs text-gray-500">-</span>`;

        div.innerHTML = `
            <div>
                <span class="font-bold">${priorityMap[item.priority]} ${item.name}</span>
                <span class="text-xs text-gray-500 ml-2">(${details.join(', ')})</span>
            </div>
            <div class="flex items-center gap-2">
                ${priceInfo}
                <button data-id="${item.id}" class="remove-wishlist-item text-red-500 hover:text-red-700 text-sm">
                    &times;
                </button>
            </div>
        `;

        div.querySelector(".remove-wishlist-item").onclick = () => {
            wishlist = wishlist.filter(i => i.id !== item.id);
            saveWishlist();
        };

        wishlistContent.appendChild(div);
    });
}

function updateWishlistStats() {
    if (wishlist.length === 0) {
        wishlistPercentage.textContent = '0%';
        wishlistProgressBar.style.width = '0%';
        wishlistTotal.textContent = '0';
        wishlistAvailable.textContent = '0';
        wishlistMissing.textContent = '0';
        wishlistValue.textContent = '-';
        return;
    }

    let availableCount = 0;
    let totalValue = 0;

    // Simular un match de la wishlist contra toda la DB
    // 1. Crear una lista simple de cartas para simular el match
    const simpleWishlistCards = wishlist.map(item => ({ Name: item.name }));
    const simulatedMatch = process(simpleWishlistCards);

    // 2. Comprobar disponibilidad y calcular valor
    for (const item of wishlist) {
        let found = false;

        // El simuladoMatch agrupa por usuario, pero necesitamos saber si CUALQUIER usuario tiene la carta
        const matchesForCard = Object.values(simulatedMatch).flat().filter(m => m.searchName === item.name);

        if (matchesForCard.length > 0) {

            // Si hay coincidencias, comprobar filtros adicionales (foil, set)
            for (const match of matchesForCard) {
                let cards = match.cards;

                if (item.foilOnly) {
                    cards = cards.filter(c => c.Foil === 'foil');
                }

                if (item.specificSet) {
                    // Comprobación más flexible: código exacto o nombre de set que incluya la cadena
                    cards = cards.filter(c =>
                        c['Set code']?.toUpperCase() === item.specificSet ||
                        c['Set name']?.toUpperCase().includes(item.specificSet)
                    );
                }

                if (cards.length > 0) {
                    found = true;
                    break;
                }
            }
        }

        if (found) availableCount++;

        // Sumar precio (usar avg)
        if (item.prices && item.prices.avg > 0) {
            totalValue += item.prices.avg;
        }
    }

    const percentage = Math.round((availableCount / wishlist.length) * 100);
    const missing = wishlist.length - availableCount;

    wishlistPercentage.textContent = `${percentage}%`;
    wishlistProgressBar.style.width = `${percentage}%`;
    wishlistTotal.textContent = wishlist.length;
    wishlistAvailable.textContent = availableCount;
    wishlistMissing.textContent = missing;

    if (totalValue > 0) {
        wishlistValue.textContent = `${totalValue.toFixed(2)}€`;
    } else {
        wishlistValue.textContent = '-';
    }
}


checkWishlistAvailabilityBtn.onclick = () => {
    if (wishlist.length === 0) {
        alert("La Wishlist está vacía.");
        return;
    }

    // Cierro el modal de acciones si está abierto para evitar conflictos
    document.getElementById('floating-actions').querySelector('details').open = false;

    wishlistResults.innerHTML = '<p class="text-gray-500 italic">Buscando disponibilidad...</p>';

    // 1. Crear una lista simple de cartas a buscar
    const simpleWishlistCards = wishlist.map(item => ({ Name: item.name }));
    const finalMatches = process(simpleWishlistCards);

    // 2. Aplicar filtros específicos de la wishlist (foilOnly, specificSet)
    const filteredMatches = {}; // { cardName: { userId: [filteredCards] } }

    for (const item of wishlist) {
        const matchesForCard = Object.values(finalMatches).flat().filter(m => m.searchName === item.name);

        for (const match of matchesForCard) {
            // El proceso de encontrar el userId es algo ineficiente aquí, pero funciona con el output de 'process'
            const userId = Object.keys(db).find(id => {
                const userMatches = finalMatches[id];
                if (!userMatches) return false;
                // Comprueba si este 'match' (un objeto {searchName, cards}) pertenece al usuario
                return userMatches.some(m => m.searchName === match.searchName && m.cards === match.cards);
            });

            if (!userId) continue; // Si no encuentra el ID, salta

            let cards = match.cards;

            if (item.foilOnly) {
                cards = cards.filter(c => c.Foil === 'foil');
            }

            if (item.specificSet) {
                cards = cards.filter(c =>
                    c['Set code']?.toUpperCase() === item.specificSet ||
                    c['Set name']?.toUpperCase().includes(item.specificSet)
                );
            }

            if (cards.length > 0) {
                if (!filteredMatches[item.name]) filteredMatches[item.name] = {};
                filteredMatches[item.name][userId] = cards;
            }
        }
    }


    // 3. Renderizar resultados de disponibilidad (similar a renderWhoHasWhatMatches)
    wishlistResults.innerHTML = '';

    if (Object.keys(filteredMatches).length === 0) {
        wishlistResults.innerHTML = '<p class="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 rounded">Ninguna carta de la Wishlist está disponible en las colecciones guardadas, o no cumple los filtros de set/foil.</p>';
        return;
    }

    const allUsers = Object.keys(db).sort();

    for (const [cardName, owners] of Object.entries(filteredMatches)) {
        const wishlistCard = wishlist.find(i => i.name === cardName);

        const div = document.createElement("div");
        div.className = "p-3 border rounded-lg bg-white dark:bg-gray-800 shadow-sm mt-3";

        const totalOwners = Object.keys(owners).length;
        const totalVersionsFound = Object.values(owners).flat().length;

        let ownersHtml = allUsers.map(user => {
            const userHas = owners[user];
            if (userHas && userHas.length > 0) {
                const versionsHtml = userHas.map(c => {
                    const setInfo = c['Set name'] ? `(${c['Set name']})` : '';
                    const foilInfo = c.Foil === 'foil' ? '⭐' : '';
                    return `
                        <div class="py-0.5 text-xs">
                            ${c.Quantity || 1}x ${setInfo} ${c['Set code'] ? c['Set code'] : ''} ${foilInfo}
                        </div>
                    `;
                }).join('');

                return `
                    <details class="mb-1 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                        <summary class="font-semibold text-sm cursor-pointer">${user} (${userHas.length} versiones)</summary>
                        <div class="mt-1">${versionsHtml}</div>
                    </details>
                `;
            } else {
                return ''; // No mostrar usuarios que no tienen la versión filtrada
            }
        }).join('');

        let details = [];
        if (wishlistCard.foilOnly) details.push('Solo Foil');
        if (wishlistCard.specificSet) details.push(`Set: ${wishlistCard.specificSet}`);
        const detailsText = details.length > 0 ? `(Filtros: ${details.join(', ')})` : '';


        div.innerHTML = `
            <h3 class="font-bold text-md mb-2 text-green-700 dark:text-green-400">
                ✅ ${cardName} ${detailsText}
            </h3>
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Disponible en ${totalOwners} listas. (${totalVersionsFound} versiones).
            </div>
            ${ownersHtml}
        `;
        wishlistResults.appendChild(div);
    }

    updateWishlistStats();
};


// ==============================
// GESTIÓN DE PRECIOS DE WISHLIST
// ==============================

// Función dummy para simular la búsqueda de precios
updatePricesBtn.onclick = () => {
    alert("Función 'Actualizar Precios' no implementada en este script. Requiere una API externa de precios (como Scryfall o Cardmarket).");
    // Lógica futura:
    // 1. Iterar sobre `wishlist`.
    // 2. Por cada carta, hacer un fetch a la API de precios.
    // 3. Guardar el resultado (ej: precio medio) en `item.prices = { avg: 5.50 }`.
    // 4. Llamar a `saveWishlist()` y `updateWishlistStats()`.
    // 5. Mostrar un indicador de progreso.

    // EJEMPLO de cómo se actualizaría el objeto (simulado):
    wishlist.forEach(item => {
        if (!item.prices) {
            item.prices = {
                avg: (Math.random() * 10).toFixed(2) * 1 // Simular un precio de 0 a 10
            };
        }
    });
    saveWishlist();
};


// ==============================
// COMPARTIR / IMPORTAR WISHLIST
// ==============================

shareWishlistBtn.onclick = () => {
    if (wishlist.length === 0) {
        alert("La Wishlist está vacía.");
        return;
    }

    // Crear un formato de texto simple para compartir
    const wishlistText = wishlist.map(item => {
        let line = item.name;
        if (item.foilOnly) line += " (Foil)";
        if (item.specificSet) line += ` [${item.specificSet}]`;
        line += ` | Prioridad: ${item.priority.toUpperCase()}`;
        return line;
    }).join('\n');

    navigator.clipboard.writeText(wishlistText)
        .then(() => alert("Wishlist copiada al portapapeles. ¡Lista para compartir!"))
        .catch(err => alert("Error al copiar al portapapeles: " + err));
};

importWishlistBtn.onclick = () => {
    const importData = prompt("Pega aquí el texto de la Wishlist a importar:");
    if (!importData) return;

    const lines = importData.split('\n').map(line => line.trim()).filter(Boolean);
    const newItems = [];

    lines.forEach(line => {
        // Expresión regular para capturar nombre, (Foil), [Set] y Prioridad
        const match = line.match(/(.*?)(\s+\(Foil\))?(\s+\[(.*?)\])?\s*\|\s*Prioridad:\s*(.*)/i);

        if (match) {
            const name = match[1].trim();
            const foil = !!match[2];
            const setCode = match[4] ? match[4].toUpperCase() : null;
            const priority = match[5] ? match[5].toLowerCase() : 'medium';

            newItems.push({
                id: Date.now() + Math.random(), // ID único
                name: name,
                priority: priority,
                foilOnly: foil,
                specificSet: setCode,
                prices: null,
            });
        } else {
            // Intentar parsear como lista de nombres simples si falla el formato avanzado
            newItems.push({
                id: Date.now() + Math.random(),
                name: line,
                priority: 'medium',
                foilOnly: false,
                specificSet: null,
                prices: null,
            });
        }
    });

    if (newItems.length > 0) {
        wishlist = [...wishlist, ...newItems];
        saveWishlist();
        alert(`${newItems.length} cartas importadas a la Wishlist.`);
    } else {
        alert("No se pudieron importar cartas. Verifica el formato.");
    }
};


// ==============================
// INICIALIZACIÓN
// ==============================

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    renderDB();
    updateFilterOptions();
    displayResults(); // Mostrar mensaje inicial si no hay resultados
    renderWishlist();
    updateWishlistStats();
    updateFilterStatus(); // Mostrar si hay filtros pre-seleccionados
});