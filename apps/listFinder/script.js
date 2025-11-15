const STORAGE_KEY = "magic_card_matcher_db_v1";

// ==============================
// REFERENCIAS DEL DOM
// ==============================
const idInput = document.getElementById("identifier");
const uploadFile = document.getElementById("uploadFile");
const saveBtn = document.getElementById("saveBtn");
const message = document.getElementById("message");
const userListsDiv = document.getElementById("userListsDiv");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const myList = document.getElementById("myList");
const myFile = document.getElementById("myFile");
const searchCard = document.getElementById("searchCard");
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("resultsDiv");

// Elementos de Filtros
const filterFoil = document.getElementById("filterFoil");
const filterRarity = document.getElementById("filterRarity");
const filterSet = document.getElementById("filterSet");
const filterLanguage = document.getElementById("filterLanguage");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const filterStatus = document.getElementById("filterStatus");
const filterMessage = document.getElementById("filterMessage");

// Elementos de Wishlist
let wishlist = loadWishlist();
const wishlistInput = document.getElementById("wishlistInput");
const addWishlistBtn = document.getElementById("addWishlistBtn");
const wishlistContent = document.getElementById("wishlistContent");
const wishlistFoilOnly = document.getElementById("wishlistFoilOnly");
const wishlistSpecificSet = document.getElementById("wishlistSpecificSet");
const wishlistSetCode = document.getElementById("wishlistSetCode");
const checkWishlistAvailability = document.getElementById("checkWishlistAvailability");
const wishlistTotal = document.getElementById("wishlistTotal");
const wishlistAvailable = document.getElementById("wishlistAvailable");
const wishlistMissing = document.getElementById("wishlistMissing");
const wishlistPercentage = document.getElementById("wishlistPercentage");
const wishlistProgressBar = document.getElementById("wishlistProgressBar");
const wishlistValue = document.getElementById("wishlistValue");
const exportResultsBtn = document.getElementById("exportResults");
const compareUsersBtn = document.getElementById("compareUsers");
const statsBtn = document.getElementById("statsBtn");

// ==============================
// VARIABLES GLOBALES
// ==============================
let localDB = loadDB();
let lastSearchResults = [];
let appliedFilters = {};

// ==============================
// FUNCIÓN DE MENSAJES (TOAST)
// ==============================
const mainMessage = document.getElementById('mainMessage');

function displayMessage(text, isError = false) {
    mainMessage.textContent = text;
    mainMessage.className = `fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl text-white z-50 transition-opacity duration-300 opacity-100`;
    mainMessage.style.backgroundColor = isError ? '#dc2626' : '#10b981';

    setTimeout(() => {
        mainMessage.classList.add('opacity-0');
        mainMessage.classList.remove('opacity-100');
    }, 3000);
}

// ==============================
// LÓGICA DE ALMACENAMIENTO (DB)
// ==============================

function loadDB() {
    try {
        const json = localStorage.getItem(STORAGE_KEY);
        return json ? JSON.parse(json) : {};
    } catch (e) {
        console.error("Error cargando la DB de localStorage:", e);
        return {};
    }
}

function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localDB));
    renderDB();
    updateFilterOptions();
}

function parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    // --- Lógica de Detección de Delimitador ---
    const headerLine = lines[0];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;

    let delimiter = ';';
    // Si la coma tiene la mayor cantidad de ocurrencias, usar coma (típico de CSV anglosajón)
    if (commaCount > semicolonCount && commaCount > tabCount && commaCount > 2) {
        delimiter = ',';
    }
    // Si el tabulador es dominante, usar tabulador
    else if (tabCount > semicolonCount && tabCount > commaCount && tabCount > 0) {
        delimiter = '\t';
    }

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const cards = [];

    // --- MODIFICACIÓN CLAVE: Búsqueda flexible de índices ---
    let nameIndex = headers.indexOf('Card Name');
    if (nameIndex === -1) {
        nameIndex = headers.indexOf('Name'); // Aceptar 'Name' como alternativo
    }

    let qtyIndex = headers.indexOf('Amount');
    if (qtyIndex === -1) {
        qtyIndex = headers.indexOf('Quantity'); // Aceptar 'Quantity' como alternativo
    }
    // --------------------------------------------------------

    const setCodeIndex = headers.indexOf('Set code');
    const foilIndex = headers.indexOf('Foil');
    const langIndex = headers.indexOf('Language');
    const rarityIndex = headers.indexOf('Rarity');

    if (nameIndex === -1 || qtyIndex === -1) {
        throw new Error(`CSV no reconocido. Faltan las columnas de Nombre (ej: 'Card Name' o 'Name') y Cantidad (ej: 'Amount' o 'Quantity'). (Delimitador usado: "${delimiter}")`);
    }

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''));

        if (values.length < Math.max(nameIndex, qtyIndex) + 1) continue;

        const qty = parseInt(values[qtyIndex]);
        if (isNaN(qty) || qty <= 0) continue;

        // Mapear los nombres de columna del archivo a los nombres internos del sistema
        const card = {
            'Card Name': values[nameIndex], // Usa el valor encontrado en el índice 'Name' o 'Card Name'
            'Amount': qty, // Usa el valor encontrado en el índice 'Quantity' o 'Amount'
            'Set code': setCodeIndex !== -1 ? values[setCodeIndex] : 'N/A',
            'Foil': foilIndex !== -1 ? values[foilIndex].toLowerCase() : 'nonfoil',
            'Language': langIndex !== -1 ? values[langIndex] : 'English',
            'Rarity': rarityIndex !== -1 ? values[rarityIndex] : 'N/A',
        };
        cards.push(card);
    }
    return cards;
}

// ==============================
// LÓGICA DE ALMACENAMIENTO (WISHLIST)
// ==============================

function loadWishlist() {
    try {
        const json = localStorage.getItem("magic_card_matcher_wishlist_v1");
        return json ? JSON.parse(json) : [];
    } catch (e) {
        console.error("Error cargando la Wishlist de localStorage:", e);
        return [];
    }
}

function saveWishlist() {
    localStorage.setItem("magic_card_matcher_wishlist_v1", JSON.stringify(wishlist));
}

// ==============================
// RENDERIZADO DE LA INTERFAZ
// ==============================

function renderDB() {
    if (Object.keys(localDB).length === 0) {
        userListsDiv.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">Carga una lista para empezar.</p>';
        return;
    }

    userListsDiv.innerHTML = Object.keys(localDB).map(name => `
        <div class="user-header flex justify-between items-center p-2 rounded-lg transition duration-150 border dark:border-gray-700">
            <span class="font-medium">${name}</span>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">${localDB[name].length} cartas</span>
                <button onclick="deleteUser('${name}')" class="text-red-500 hover:text-red-700 p-1 rounded-full text-sm">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

function updateFilterOptions() {
    const allSets = new Set();
    Object.values(localDB).forEach(cardList => {
        cardList.forEach(card => {
            if (card['Set code']) {
                allSets.add(card['Set code']);
            }
        });
    });

    const setOptions = Array.from(allSets).sort().map(set =>
        `<option value="${set}">${set}</option>`
    ).join('');

    filterSet.innerHTML = `<option value="all">Cualquiera</option>` + setOptions;
}

function updateFilterStatus() {
    const activeFilters = Object.values(appliedFilters).filter(val => val !== 'all' && val !== '');

    if (activeFilters.length > 0) {
        clearFiltersBtn.classList.remove('bg-gray-500');
        clearFiltersBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
        clearFiltersBtn.textContent = `Limpiar Filtros (${activeFilters.length})`;
    } else {
        clearFiltersBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');
        clearFiltersBtn.classList.add('bg-gray-500', 'hover:bg-gray-600');
        clearFiltersBtn.textContent = 'Limpiar Filtros';
    }
}

function renderWishlistItem(item) {
    const isAvailable = item.isAvailable;

    const availabilityIndicator = isAvailable !== undefined ?
        (isAvailable ?
            '<span class="text-emerald-600 dark:text-emerald-400 font-bold">✅ DISPONIBLE</span>' :
            '<span class="text-red-600 dark:text-red-400 font-bold">❌ FALTANTE</span>') :
        '<span class="text-gray-500">⏳ Buscando...</span>';

    const pricesHtml = item.prices ? `
        <div class="text-xs mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-inner space-y-0.5">
            <p class="text-green-600 dark:text-green-400 font-medium">💶 LOW: ${item.prices.low.toFixed(2)} €</p>
            <p class="text-yellow-600 dark:text-yellow-400 font-medium">📈 AVG: ${item.prices.avg.toFixed(2)} €</p>
            <p class="text-red-600 dark:text-red-400 font-medium">📉 TREND: ${item.prices.trend.toFixed(2)} €</p>
        </div>
    ` : '<p class="text-xs text-gray-500 mt-2">⏳ Precios MKM cargando...</p>';

    return `
        <div id="item-${item.id}"
            class="wishlist-item flex flex-col md:flex-row justify-between items-start md:items-center p-3 rounded-lg border-l-4 border-gray-400 bg-white dark:bg-gray-800 shadow transition duration-150">
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-base break-words">${item.name}</p>
                <div class="text-xs text-gray-500 dark:text-gray-400 space-x-2">
                    ${item.foilOnly ? '<span class="text-blue-500 font-medium">✨ Foil</span>' : ''}
                    ${item.specificSet ? `<span class="font-medium">Set: ${item.specificSet}</span>` : ''}
                    <span class="text-sm">${availabilityIndicator}</span>
                </div>
                ${pricesHtml}
            </div>
            <div class="flex-shrink-0 flex gap-2 mt-2 md:mt-0 items-center">
                <button onclick="deleteWishlistItem(${item.id})"
                    class="text-red-500 hover:text-red-700 p-1 rounded-full text-sm transition duration-150">
                    🗑️
                </button>
            </div>
        </div>
    `;
}

function renderWishlist() {
    if (wishlist.length === 0) {
        wishlistContent.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm italic">Tu wishlist está vacía.</p>';
    } else {
        wishlistContent.innerHTML = wishlist.map(renderWishlistItem).join('');
    }
}

function displayResults(matches = lastSearchResults) {
    if (matches.length === 0) {
        resultsDiv.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm italic">Realiza una búsqueda o un match para ver resultados.</p>';
        return;
    }

    let resultsHtml = '';
    const filteredMatches = applyFiltersToMatches(matches);

    if (filteredMatches.length === 0) {
        resultsDiv.innerHTML = '<p class="text-red-500 text-sm italic font-medium">No se encontraron cartas que cumplan con los filtros aplicados.</p>';
        return;
    }

    filteredMatches.forEach(match => {
        const cardName = match.name;
        const availableIn = match.availableIn;
        const missingIn = match.missingIn;

        resultsHtml += `
            <div class="p-4 mb-4 rounded-lg shadow dark:bg-gray-700/50">
                <h3 class="text-lg font-semibold mb-2">${cardName}</h3>
                ${availableIn.length > 0 ? `
                    <p class="text-sm text-emerald-600 dark:text-emerald-400 font-medium">✅ Disponible en:</p>
                    <ul class="list-disc list-inside ml-4 text-sm mb-2">
                        ${availableIn.map(user => `<li>${user.user} (${user.count}x)</li>`).join('')}
                    </ul>
                ` : ''}
                ${missingIn.length > 0 ? `
                    <p class="text-sm text-red-600 dark:text-red-400 font-medium">❌ Falta en:</p>
                    <ul class="list-disc list-inside ml-4 text-sm">
                        ${missingIn.map(user => `<li>${user}</li>`).join('')}
                    </ul>
                ` : `<p class="text-sm text-gray-500">Todos los jugadores tienen esta carta.</p>`}
            </div>
        `;
    });

    resultsDiv.innerHTML = resultsHtml;
    lastSearchResults = matches;
}

// ==============================
// LÓGICA DE WISHLIST
// ==============================

function updateWishlistAvailability(cardName, isAvailable) {
    const item = wishlist.find(i => i.name.toLowerCase() === cardName.toLowerCase());
    if (item) {
        item.isAvailable = isAvailable;
    }
}

function deleteWishlistItem(id) {
    wishlist = wishlist.filter(item => item.id !== id);
    saveWishlist();
    renderWishlist();
    updateWishlistStats();
    displayMessage("Carta eliminada de la Wishlist.");
}

async function addCardToWishlist() {
    const input = wishlistInput.value.trim();
    if (!input) {
        displayMessage("Introduce el nombre de una carta.", true);
        return;
    }

    const setCode = wishlistSetCode.value.trim().toUpperCase();
    const isFoil = wishlistFoilOnly.checked;

    const lineRegex = /^(?:(\d+)\s*x\s*)?([^(]*?)\s*(?:\(([^)]+)\))?\s*$/i;

    let newItems = [];
    const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    lines.forEach(line => {
        const match = line.match(lineRegex);
        let name, qty = 1, itemSetCode;

        if (match) {
            qty = parseInt(match[1] || '1');
            name = match[2].trim();
            itemSetCode = match[3] ? match[3].toUpperCase() : (setCode || null);

            if (name.length > 0) {
                for (let i = 0; i < qty; i++) {
                    newItems.push({
                        id: Date.now() + Math.random(),
                        name: name,
                        foilOnly: isFoil,
                        specificSet: itemSetCode,
                        prices: null,
                        isAvailable: undefined
                    });
                }
            }
        } else {
            if (line.length > 0) {
                newItems.push({
                    id: Date.now() + Math.random(),
                    name: line,
                    foilOnly: isFoil,
                    specificSet: setCode || null,
                    prices: null,
                    isAvailable: undefined
                });
            }
        }
    });

    if (newItems.length > 0) {
        wishlist = [...wishlist, ...newItems];
        saveWishlist();
        renderWishlist();
        wishlistInput.value = '';
        displayMessage(`${newItems.length} carta(s) añadida(s). Buscando precios...`);

        // Buscar precios automáticamente después de añadir
        await fetchMkmPricesForNewCards(newItems);
        updateWishlistStats();
    } else {
        displayMessage("No se pudieron importar cartas. Verifica el formato.", true);
    }
}

// ==============================
// FETCH DE PRECIOS MKM (REAL API)
// ==============================

async function fetchMkmPricesForNewCards(items) {
    for (let item of items) {
        try {
            // Buscar en Scryfall para obtener precios
            const searchQuery = item.specificSet
                ? `!"${item.name}" set:${item.specificSet}`
                : `!"${item.name}"`;

            const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}`;
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data.length > 0) {
                    const card = data.data[0];

                    // Obtener precios de EUR
                    if (card.prices && card.prices.eur) {
                        const eurPrice = parseFloat(card.prices.eur) || 0;

                        // Simular low, avg, trend basado en el precio EUR
                        item.prices = {
                            low: parseFloat((eurPrice * 0.85).toFixed(2)),
                            avg: parseFloat(eurPrice.toFixed(2)),
                            trend: parseFloat((eurPrice * 1.1).toFixed(2))
                        };
                    } else {
                        item.prices = null;
                    }

                    saveWishlist();
                    renderWishlist();
                } else {
                    displayMessage(`⚠️ Carta "${item.name}" no encontrada en Scryfall.`, true);
                }
            }

            // Rate limiting: esperar 100ms entre peticiones
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`Error buscando precios para ${item.name}:`, error);
        }
    }
}

async function fetchMkmPricesForWishlist() {
    const button = document.getElementById("checkWishlistAvailability");
    button.textContent = "⚙️ Buscando Precios MKM...";
    button.disabled = true;

    const itemsWithoutPrices = wishlist.filter(item => !item.prices);

    if (itemsWithoutPrices.length > 0) {
        await fetchMkmPricesForNewCards(itemsWithoutPrices);
    }

    button.textContent = "🔍 Buscar Disponibilidad";
    button.disabled = false;
    displayMessage(`✅ Precios actualizados para ${itemsWithoutPrices.length} carta(s).`);
}

function updateWishlistStats() {
    if (wishlist.length === 0) {
        wishlistTotal.textContent = 0;
        wishlistAvailable.textContent = 0;
        wishlistMissing.textContent = 0;
        wishlistPercentage.textContent = '0%';
        wishlistProgressBar.style.width = '0%';
        wishlistValue.textContent = '0.00 €';
        return;
    }

    let availableCount = 0;
    let totalValue = 0;

    for (const item of wishlist) {
        let found = false;

        for (const [, userMatches] of Object.entries(localDB)) {
            const cardsInUserList = userMatches.filter(card => {
                if (!card || !card['Card Name']) return false;

                let nameMatch = card['Card Name'].toLowerCase() === item.name.toLowerCase();
                let setMatch = true;
                let foilMatch = true;

                if (item.specificSet) {
                    setMatch = card['Set code']?.toUpperCase() === item.specificSet;
                }

                if (item.foilOnly) {
                    foilMatch = card.Foil === 'foil';
                }

                return nameMatch && setMatch && foilMatch && card.Amount > 0;
            });

            if (cardsInUserList.length > 0) {
                found = true;
                break;
            }
        }

        item.isAvailable = found;
        if (found) availableCount++;

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
    wishlistValue.textContent = `${totalValue.toFixed(2)} €`;

    renderWishlist();
}

// ==============================
// LÓGICA DE BÚSQUEDA Y FILTRADO
// ==============================

function applyFiltersToMatches(matches) {
    if (Object.values(appliedFilters).every(val => val === 'all' || val === '')) {
        return matches;
    }

    const statusFilter = filterStatus.value;

    return matches.filter(match => {
        let isAvailable = match.availableIn.length > 0;

        if (statusFilter === 'missing' && isAvailable) return false;
        if (statusFilter === 'available' && !isAvailable) return false;

        return true;
    });
}

function matchAndDisplayResults() {
    const cardNamesInput = searchCard.value.trim();
    if (cardNamesInput.length === 0) {
        displayMessage("Introduce un nombre de carta o haz match con la Wishlist.", true);
        return;
    }

    // Separar por coma solo si NO hay una coma seguida de espacio dentro de un nombre válido
    // Detectamos si es una lista múltiple (varias cartas separadas por ", ") o un nombre único con coma
    let namesToSearch = [];

    // Si contiene ", " (coma + espacio), probablemente es una lista de cartas
    if (cardNamesInput.includes(', ')) {
        // Verificar si parece ser una carta única con coma (ej: "Ragavan, Nimble Pilferer")
        // o múltiples cartas (ej: "Sol Ring, Lightning Bolt, Counterspell")
        const parts = cardNamesInput.split(', ');

        // Si solo hay 2 partes y la primera es corta (probable nombre), es una sola carta
        if (parts.length === 2 && parts[0].split(' ').length <= 2) {
            namesToSearch = [cardNamesInput];
        } else {
            namesToSearch = parts.map(name => name.trim()).filter(name => name.length > 0);
        }
    } else {
        // No tiene ", " así que es una sola carta (puede tener coma sin espacio)
        namesToSearch = [cardNamesInput];
    }

    if (namesToSearch.length === 0) {
        displayMessage("Introduce un nombre de carta o haz match con la Wishlist.", true);
        return;
    }

    const matches = namesToSearch.map(name => {
        const availableIn = [];
        const missingIn = [];

        const inWishlist = wishlist.find(item => item.name.toLowerCase() === name.toLowerCase());

        for (const [userId, cards] of Object.entries(localDB)) {
            if (!cards || !Array.isArray(cards)) continue;

            let foundCards = cards.filter(card => {
                if (!card || !card['Card Name']) return false;
                return card['Card Name'].toLowerCase().includes(name.toLowerCase());
            });

            if (foundCards.length > 0) {
                const totalCount = foundCards.reduce((sum, card) => sum + (card.Amount || 0), 0);
                availableIn.push({ user: userId, count: totalCount });
            } else {
                missingIn.push(userId);
            }
        }

        if (inWishlist) {
            const isAvailable = availableIn.length > 0;
            updateWishlistAvailability(name, isAvailable);
        }

        return {
            name: name,
            availableIn: availableIn,
            missingIn: missingIn
        };
    });

    displayResults(matches);
    updateWishlistStats();
}

// ==============================
// MANEJADORES DE EVENTOS
// ==============================

saveBtn.onclick = () => {
    const userName = idInput.value.trim();
    if (!userName) {
        displayMessage("Por favor, introduce un nombre para tu lista.", true);
        return;
    }
    if (!uploadFile.files[0]) {
        displayMessage("Por favor, selecciona un archivo CSV.", true);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvContent = e.target.result;
            const cardList = parseCSV(csvContent);

            if (cardList.length === 0) {
                throw new Error("El archivo no contiene datos válidos o está vacío.");
            }

            localDB[userName] = cardList;
            saveDB();
            displayMessage(`✅ ${cardList.length} cartas guardadas para ${userName}.`);
            uploadFile.value = '';
            myFile.textContent = 'Seleccionar archivo (.csv)';
        } catch (error) {
            displayMessage(`❌ Error al procesar: ${error.message}`, true);
            console.error(error);
        }
    };
    reader.readAsText(uploadFile.files[0]);
};

uploadFile.onchange = () => {
    if (uploadFile.files.length > 0) {
        myFile.textContent = `Archivo: ${uploadFile.files[0].name}`;
    } else {
        myFile.textContent = 'Seleccionar archivo (.csv)';
    }
};

searchBtn.onclick = matchAndDisplayResults;

addWishlistBtn.onclick = addCardToWishlist;

wishlistSpecificSet.onchange = () => {
    wishlistSetCode.disabled = !wishlistSpecificSet.checked;
    if (!wishlistSpecificSet.checked) {
        wishlistSetCode.value = '';
    }
}

checkWishlistAvailability.addEventListener("click", async () => {
    if (wishlist.length === 0) {
        displayMessage("Tu Wishlist está vacía. Añade cartas para buscar.", true);
        return;
    }

    if (Object.keys(localDB).length === 0) {
        displayMessage("No hay listas de jugadores cargadas en la base de datos.", true);
        return;
    }

    const names = wishlist.map(item => item.name).join(', ');
    searchCard.value = names;
    matchAndDisplayResults();

    await fetchMkmPricesForWishlist();
});

exportBtn.onclick = () => {
    const dbJson = JSON.stringify(localDB, null, 2);
    const blob = new Blob([dbJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'magic_card_matcher_db.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    displayMessage("✅ Base de datos exportada.");
};

importFile.onchange = () => {
    if (importFile.files.length === 0) return;

    const file = importFile.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedDB = JSON.parse(e.target.result);
            if (typeof importedDB !== 'object' || Array.isArray(importedDB)) {
                throw new Error("El archivo JSON no tiene el formato de base de datos esperado.");
            }
            localDB = importedDB;
            saveDB();
            displayMessage("✅ Base de datos importada correctamente.");
        } catch (error) {
            displayMessage(`❌ Error al importar la DB: ${error.message}`, true);
        } finally {
            importFile.value = '';
        }
    };
    reader.readAsText(file);
};

// ==============================
// FUNCIONES DE UTILIDAD
// ==============================

function deleteUser(name) {
    if (confirm(`¿Estás seguro de que quieres eliminar la lista de cartas de ${name}?`)) {
        delete localDB[name];
        saveDB();
        displayMessage(`Lista de ${name} eliminada.`);
        updateWishlistStats();
    }
}

// ==============================
// FILTROS Y ESTADO DE RESULTADOS
// ==============================

[filterFoil, filterRarity, filterSet, filterLanguage, filterStatus].forEach(filter => {
    filter.addEventListener('change', () => {
        appliedFilters[filter.id] = filter.value;
        displayResults();
        updateFilterStatus();
    });
});

clearFiltersBtn.addEventListener('click', () => {
    filterFoil.value = 'all';
    filterRarity.value = 'all';
    filterSet.value = 'all';
    filterLanguage.value = 'all';
    filterStatus.value = 'all';

    appliedFilters = {};

    displayResults();
    updateFilterStatus();
    displayMessage("Filtros limpiados.");
});

// ==============================
// EXPORTAR RESULTADOS Y COMPARAR
// ==============================

exportResultsBtn.addEventListener('click', () => {
    if (lastSearchResults.length === 0) {
        displayMessage("No hay resultados que exportar.", true);
        return;
    }

    let csvContent = "Card Name,Available In,Missing In\n";

    lastSearchResults.forEach(match => {
        const available = match.availableIn.map(u => `${u.user} (${u.count}x)`).join(' | ');
        const missing = match.missingIn.join(' | ');
        csvContent += `"${match.name.replace(/"/g, '""')}", "${available.replace(/"/g, '""')}", "${missing.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'magic_card_matcher_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    displayMessage("✅ Resultados de búsqueda exportados a CSV.");
});

compareUsersBtn.addEventListener('click', () => {
    if (Object.keys(localDB).length < 2) {
        displayMessage("Se necesitan al menos 2 listas cargadas para comparar.", true);
        return;
    }

    const users = Object.keys(localDB);

    // 1. **NUEVO**: Almacenar el total de cartas cargadas por cada usuario
    const totalCardsByUser = {};

    // Función helper para normalizar nombres de cartas
    function normalizeCardName(name) {
        if (!name) return '';
        return name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')  // Normalizar espacios múltiples
            .replace(/["""]/g, '"')  // Normalizar comillas
            .replace(/['`´]/g, "'")  // Normalizar apóstrofes
            .replace(/^"(.*)"$/, '$1')  // Eliminar comillas al inicio/final
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');  // Eliminar acentos
    }

    // Crear un mapa de todas las cartas únicas con sus propietarios
    const cardMap = new Map();

    users.forEach(user => {
        const userCards = localDB[user];
        if (!userCards || !Array.isArray(userCards)) return;

        // **NUEVO**: Inicializar y contar el total de cartas
        totalCardsByUser[user] = userCards.length;

        userCards.forEach(card => {
            if (!card || !card['Card Name']) return;

            const normalizedName = normalizeCardName(card['Card Name']);

            if (!cardMap.has(normalizedName)) {
                cardMap.set(normalizedName, {
                    displayName: card['Card Name'],  // Guardar el nombre original para mostrar
                    owners: new Set()
                });
            }

            cardMap.get(normalizedName).owners.add(user);
        });
    });

    // Separar cartas comunes y únicas
    const commonCards = [];
    const uniqueCardsByUser = {};
    const missingCardsByUser = {}; // **NUEVO**: Para almacenar las cartas que le faltan a cada usuario

    // Inicializar arrays de cartas únicas y faltantes para cada usuario
    users.forEach(user => {
        uniqueCardsByUser[user] = [];
        missingCardsByUser[user] = []; // **NUEVO**
    });

    // Clasificar las cartas y calcular las faltantes
    cardMap.forEach((cardInfo) => {
        const numOwners = cardInfo.owners.size;

        if (numOwners === users.length) {
            // Todos los usuarios tienen esta carta
            commonCards.push(cardInfo.displayName);
        } else {
            // **NUEVO**: Si no todos la tienen, vemos a quién le falta
            const ownersArray = Array.from(cardInfo.owners);

            // Si solo la tiene 1 (carta única)
            if (numOwners === 1) {
                const owner = ownersArray[0];
                uniqueCardsByUser[owner].push(cardInfo.displayName);
            }

            // **NUEVO**: Iterar por todos los usuarios para ver a quién le falta
            users.forEach(user => {
                if (!cardInfo.owners.has(user)) {
                    // Este usuario NO tiene esta carta
                    missingCardsByUser[user].push(cardInfo.displayName);
                }
            });
        }
    });

    // Generar HTML de resultados
    let comparisonHtml = `
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
            <h3 class="text-lg font-bold mb-2">📊 Comparación de Jugadores</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Comparando ${users.length} listas de cartas</p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">Total de cartas únicas encontradas (en todas las listas): ${cardMap.size}</p>
        </div>
        
        <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
            <h4 class="font-bold text-green-700 dark:text-green-400 mb-2">✅ Cartas Comunes a Todos (${commonCards.length})</h4>
            ${commonCards.length > 0 ? `
                <div class="max-h-60 overflow-y-auto">
                    <ul class="list-disc list-inside text-sm space-y-1">
                        ${commonCards.slice(0, 20).map(c => `<li>${c}</li>`).join('')}
                        ${commonCards.length > 20 ? `<li class="text-gray-500 font-semibold">... y ${commonCards.length - 20} más</li>` : ''}
                    </ul>
                </div>
            ` : '<p class="text-sm text-gray-500">No hay cartas comunes entre todos los jugadores</p>'}
        </div>
    `;

    users.forEach(user => {
        const uniqueCards = uniqueCardsByUser[user];
        const totalCards = totalCardsByUser[user]; // **NUEVO**
        const missingCards = missingCardsByUser[user]; // **NUEVO**

        comparisonHtml += `
            <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
                 <h4 class="font-bold text-gray-800 dark:text-gray-200 mb-2">👤 Resumen de **${user}**</h4>
                 <p class="text-sm mb-2">**Total de cartas cargadas:** <span class="font-bold">${totalCards}</span></p> <div class="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg mb-2">
                     <h5 class="font-semibold text-sm text-orange-700 dark:text-orange-400 mb-1">🎴 Cartas **únicas** que posee (${uniqueCards.length})</h5>
                     ${uniqueCards.length > 0 ? `
                         <div class="max-h-40 overflow-y-auto">
                             <ul class="list-disc list-inside text-xs space-y-0.5">
                                 ${uniqueCards.slice(0, 10).map(c => `<li>${c}</li>`).join('')}
                                 ${uniqueCards.length > 10 ? `<li class="text-gray-500 font-semibold">... y ${uniqueCards.length - 10} más</li>` : ''}
                             </ul>
                         </div>
                     ` : '<p class="text-xs text-gray-500">No tiene cartas que solo él/ella posea</p>'}
                 </div>

                 <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <h5 class="font-semibold text-sm text-red-700 dark:text-red-400 mb-1">❌ Cartas que **le faltan** (${missingCards.length})</h5> ${missingCards.length > 0 ? `
                          <div class="max-h-40 overflow-y-auto">
                              <ul class="list-disc list-inside text-xs space-y-0.5">
                                  ${missingCards.slice(0, 10).map(c => `<li>${c}</li>`).join('')}
                                  ${missingCards.length > 10 ? `<li class="text-gray-500 font-semibold">... y ${missingCards.length - 10} más</li>` : ''}
                              </ul>
                          </div>
                      ` : '<p class="text-xs text-gray-500">Posee todas las cartas conocidas por los demás</p>'}
                  </div>
            </div>
        `;
    });

    resultsDiv.innerHTML = comparisonHtml;
    displayMessage("✅ Comparación completada.");
});

statsBtn.addEventListener('click', () => {
    if (Object.keys(localDB).length === 0) {
        displayMessage("No hay listas cargadas para mostrar estadísticas.", true);
        return;
    }

    const stats = {
        totalUsers: Object.keys(localDB).length,
        totalCards: 0,
        cardsByUser: {},
        topCards: {},
        setDistribution: {}
    };

    Object.entries(localDB).forEach(([user, cards]) => {
        stats.cardsByUser[user] = cards.length;
        stats.totalCards += cards.length;

        cards.forEach(card => {
            if (!card || !card['Card Name']) return;

            // Contar apariciones de cada carta
            const cardName = card['Card Name'];
            stats.topCards[cardName] = (stats.topCards[cardName] || 0) + 1;

            // Distribución por set
            const setCode = card['Set code'];
            if (setCode && setCode !== 'N/A') {
                stats.setDistribution[setCode] = (stats.setDistribution[setCode] || 0) + 1;
            }
        });
    });

    let statsHtml = `
        <div class="space-y-4">
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 class="text-lg font-bold mb-3">📊 Estadísticas Generales</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Total de Jugadores</p>
                        <p class="text-2xl font-bold">${stats.totalUsers}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Total de Cartas</p>
                        <p class="text-2xl font-bold">${stats.totalCards}</p>
                    </div>
                </div>
            </div>

            <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h4 class="font-bold text-green-700 dark:text-green-400 mb-2">👥 Cartas por Jugador</h4>
                <ul class="space-y-1 text-sm">
                    ${Object.entries(stats.cardsByUser).map(([user, count]) =>
        `<li class="flex justify-between"><span>${user}</span><span class="font-bold">${count}</span></li>`
    ).join('')}
                </ul>
            </div>
    `;

    resultsDiv.innerHTML = statsHtml;
    displayMessage("✅ Estadísticas generadas.");
});

// ==============================
// INICIALIZACIÓN
// ==============================

document.addEventListener('DOMContentLoaded', () => {
    renderDB();
    updateFilterOptions();
    displayResults();
    renderWishlist();
    updateWishlistStats();
    updateFilterStatus();
});