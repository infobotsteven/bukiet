(() => {
  "use strict";

  const { fetchJson, isClickOutside } = window.KzS;

  const CACHE_KEY = "kzs:catalog:v1";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 15000;
  const SKELETON_COUNT = 3;
  const PRICE_STEP = 50;
  const PRODUCT_IMAGE_SIZE = { width: 640, height: 480 };   // proporcje 4:3 jak w CSS (zapobiega skokom układu)

  const IMAGE_DIR = "assets/images/katalog/";
  const PLACEHOLDERS = [
    "assets/images/card-klasyczne.webp",
    "assets/images/card-premium.webp",
    "assets/images/card-uroczystosc.webp",
  ];
  // Okazje oznaczające "pasuje do każdej okazji": nie tworzą własnego filtra i pokazują się pod każdym.
  const UNIVERSAL_OCCASIONS = ["kazda", "kazda okazja", "kazde", "uniwersalna", "uniwersalny", "dowolna", "dowolny"];

  /* ------------------------------------------------------------------
     Pomocnicze
     ------------------------------------------------------------------ */
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // Małe litery, bez polskich znaków (jak w skrypcie po stronie Google).
  const normalize = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/ł/g, "l")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  // Pierwsza liczba z tekstu ceny ("1 000,50 zł" -> 1000.5, "od 120 zł" -> 120). Brak liczby -> null.
  const parsePrice = (text) => {
    const match = String(text || "").match(/\d[\d\s\u00a0]*(?:[.,]\d+)?/);
    if (!match) return null;
    const value = Number(match[0].replace(/[\s\u00a0]/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : null;
  };

  // Sama liczba (też "1 250" i "3 400,50") -> "1 250 zł". Inny tekst (np. "od 120 zł", "do ustalenia") bez zmian.
  const formatPrice = (text) => {
    const value = String(text || "").trim();
    if (!value) return "Cena do ustalenia";
    if (!/^\d{1,3}(?:[\s\u00a0]\d{3})+(?:[.,]\d+)?$|^\d+(?:[.,]\d+)?$/.test(value)) return value;
    const number = Number(value.replace(/[\s\u00a0]/g, "").replace(",", "."));
    const hasDecimals = /[.,]\d/.test(value);
    const options = hasDecimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {};
    return `${number.toLocaleString("pl-PL", options)} zł`;
  };

  const pluralize = (count) => {
    const lastTwo = count % 100;
    const last = count % 10;
    if (count === 1) return "kompozycja";
    if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return "kompozycje";
    return "kompozycji";
  };

  const hashId = (id) => [...String(id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  const placeholderFor = (item) => PLACEHOLDERS[hashId(item.id) % PLACEHOLDERS.length];

  // Własne zdjęcie: adres https albo nazwa pliku z folderu katalogu. Każde inne -> zdjęcie zastępcze.
  const imageFor = (item) => {
    const image = item.image;
    if (/^https:\/\/\S+$/.test(image)) return { src: image, isPlaceholder: false };
    if (/^[\w\-./]+\.(webp|jpe?g|png|avif)$/i.test(image) && !image.includes("..")) {
      return { src: IMAGE_DIR + image, isPlaceholder: false };
    }
    return { src: placeholderFor(item), isPlaceholder: true };
  };

  const getEndpoint = () => {
    const form = document.querySelector("[data-order-form]");
    return form ? form.dataset.endpoint : "";
  };

  const requestOrder = (item) => {
    document.dispatchEvent(
      new CustomEvent("order:open", { detail: { product: { id: item.id, name: item.name } } })
    );
  };

  /* ------------------------------------------------------------------
     Dane: pobieranie i pamięć podręczna przeglądarki
     ------------------------------------------------------------------ */
  const readCache = () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (cached && Array.isArray(cached.items) && Date.now() - cached.time < CACHE_TTL_MS) {
        return cached.items;
      }
    } catch {
      /* brak pamięci podręcznej: pobieramy z sieci */
    }
    return null;
  };

  const writeCache = (items) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), items }));
    } catch {
      /* tryb prywatny / zablokowane: pomijamy */
    }
  };

  const fetchCatalog = async () => {
    const result = await fetchJson(`${getEndpoint()}?action=catalog`, {}, FETCH_TIMEOUT_MS);
    if (!result.ok || !Array.isArray(result.items)) throw new Error("Nieprawidłowa odpowiedź katalogu");
    return result.items;
  };

  // Pole „okazja" może zawierać kilka wartości rozdzielonych przecinkami ("Ślub, Chrzciny").
  // Zwraca unikalne (po normalizacji) pary { key, label }; puste fragmenty są pomijane.
  const parseOccasions = (text) => {
    const unique = new Map();
    String(text || "")
      .split(",")
      .forEach((part) => {
        const label = part.trim();
        const key = normalize(label);
        if (key && !unique.has(key)) unique.set(key, label);
      });
    return [...unique].map(([key, label]) => ({ key, label }));
  };

  // Czyści i uzupełnia pozycje; wyróżnione na początek (kolejność z arkusza poza tym zachowana).
  const prepare = (rawItems) => {
    const items = rawItems
      .filter((item) => item && item.id && item.name)
      .map((item) => {
        const listed = parseOccasions(item.occasion);
        const occasions = listed.filter(({ key }) => !UNIVERSAL_OCCASIONS.includes(key));
        // Znaczki na zdjęciu: konkretne okazje, a gdy są tylko uniwersalne ("Każda okazja"), ta uniwersalna.
        const labels = (occasions.length ? occasions : listed).map(({ label }) => capitalize(label));
        return {
          id: String(item.id),
          name: String(item.name),
          occasions,
          occasionLabels: labels,
          universal: occasions.length < listed.length || listed.length === 0,
          description: String(item.description || ""),
          price: String(item.price || ""),
          priceValue: parsePrice(item.price),
          image: String(item.image || ""),
          featured: item.featured === true,
        };
      });
    return [...items.filter((i) => i.featured), ...items.filter((i) => !i.featured)];
  };

  /* ------------------------------------------------------------------
     Widok
     ------------------------------------------------------------------ */
  const initCatalog = () => {
    const root = document.querySelector("[data-catalog]");
    if (!root) return;

    const filters = root.querySelector("[data-catalog-filters]");
    const chips = root.querySelector("[data-catalog-chips]");
    const occasionGroup = root.querySelector("[data-catalog-occasion-group]");
    const priceGroup = root.querySelector("[data-catalog-price-group]");
    const priceInput = root.querySelector("[data-catalog-price]");
    const priceOutput = root.querySelector("[data-catalog-price-output]");
    const summary = root.querySelector("[data-catalog-summary]");
    const resetButton = root.querySelector("[data-catalog-reset]");
    const count = root.querySelector("[data-catalog-count]");
    const grid = root.querySelector("[data-catalog-grid]");
    const message = root.querySelector("[data-catalog-message]");
    const notice = root.querySelector("[data-catalog-notice]");
    const lightbox = document.querySelector("[data-lightbox]");
    const lightboxImage = lightbox && lightbox.querySelector("[data-lightbox-image]");
    const lightboxCaption = lightbox && lightbox.querySelector("[data-lightbox-caption]");

    const state = { items: [], occasion: "all", maxPrice: Infinity, priceMax: 0 };
    let pendingCategory = null;   // kategoria wybrana w ofercie, zanim katalog się wczytał

    // Powiększenie zdjęcia: natywny <dialog> (Esc, pułapka fokusu i przywrócenie fokusu za darmo).
    const openLightbox = (img, item) => {
      lightboxImage.src = img.currentSrc || img.src;
      lightboxImage.alt = img.alt;
      lightboxCaption.textContent = item.name;
      lightbox.showModal();
    };

    const closeLightbox = () => {
      lightbox.close();
      lightboxImage.removeAttribute("src");   // nie trzymamy dużego obrazu w DOM po zamknięciu
    };

    // Zdjęcie karty owinięte w przycisk, żeby dało się je otworzyć myszą, dotykiem i klawiaturą.
    const createZoomButton = (img, item) => {
      const button = el("button", "product__zoom");
      button.type = "button";
      button.setAttribute("aria-label", `Powiększ zdjęcie: ${item.name}`);
      button.setAttribute("aria-haspopup", "dialog");
      button.addEventListener("click", () => openLightbox(img, item));
      button.append(img);
      return button;
    };

    const createProduct = (item) => {
      const card = el("article", `card product${item.featured ? " product--featured" : ""}`);

      const media = el("div", "product__media");
      const image = imageFor(item);
      const img = el("img", "product__image");
      img.src = image.src;
      img.alt = image.isPlaceholder ? `${item.name} (zdjęcie poglądowe)` : item.name;
      img.width = PRODUCT_IMAGE_SIZE.width;
      img.height = PRODUCT_IMAGE_SIZE.height;
      img.loading = "lazy";
      img.addEventListener(
        "error",
        () => {
          img.src = placeholderFor(item);
        },
        { once: true }
      );
      media.append(lightbox ? createZoomButton(img, item) : img);
      if (item.featured) {
        const ribbon = el("span", "product__ribbon");
        ribbon.append(el("span", "product__ribbon-star", "★"), " Polecane");
        media.append(ribbon);
      }
      if (item.occasionLabels.length) {
        const tags = el("div", "product__occasions");
        tags.append(...item.occasionLabels.map((label) => el("span", "product__occasion", label)));
        media.append(tags);
      }

      const body = el("div", "product__body");
      body.append(el("h3", "product__title", item.name));
      if (item.description) body.append(el("p", "product__text", item.description));

      const footer = el("div", "product__footer");
      footer.append(el("span", "product__price", formatPrice(item.price)));
      const button = el("button", "card__link product__cta", "Kontakt →");
      button.type = "button";
      button.setAttribute("aria-label", `Kontakt w sprawie kompozycji: ${item.name}`);
      button.addEventListener("click", () => requestOrder(item));
      footer.append(button);
      body.append(footer);

      card.append(media, body);
      return card;
    };

    // Linia z licznikiem i "Wyczyść filtry" jest ukryta, gdy zamiast listy jest szkielet lub komunikat.
    const hideSummary = () => {
      summary.hidden = true;
      count.textContent = "";
    };

    const showSkeleton = () => {
      grid.setAttribute("aria-busy", "true");
      grid.replaceChildren(
        ...Array.from({ length: SKELETON_COUNT }, () => el("div", "card product product--skeleton"))
      );
      message.hidden = true;
      notice.hidden = true;
      filters.hidden = true;
      hideSummary();
    };

    // Komunikat w miejscu listy: tekst i opcjonalny przycisk akcji.
    const setMessage = (text, actionLabel, onAction) => {
      message.replaceChildren(el("p", "catalog__message-text", text));
      if (actionLabel) {
        const action = el("button", "btn btn--outline", actionLabel);
        action.type = "button";
        action.addEventListener("click", onAction);
        message.append(action);
      }
      message.hidden = false;
    };

    // Komunikat zamiast całego katalogu (błąd, pusty katalog): chowa filtry i licznik.
    const showMessage = (text, actionLabel, onAction) => {
      grid.replaceChildren();
      grid.removeAttribute("aria-busy");
      notice.hidden = true;
      filters.hidden = true;
      hideSummary();
      setMessage(text, actionLabel, onAction);
    };

    const matches = (item) => {
      const occasionOk =
        state.occasion === "all" || item.universal || item.occasions.some(({ key }) => key === state.occasion);
      const priceOk =
        state.maxPrice >= state.priceMax || (item.priceValue !== null && item.priceValue <= state.maxPrice);
      return occasionOk && priceOk;
    };

    const renderList = () => {
      const visible = state.items.filter(matches);
      grid.removeAttribute("aria-busy");
      message.hidden = true;
      notice.hidden = true;
      grid.replaceChildren(...visible.map(createProduct));
      count.textContent = `Znaleziono: ${visible.length} ${pluralize(visible.length)}`;
      if (visible.length === 0) setMessage("Brak kompozycji dla wybranych filtrów.", "Wyczyść filtry", resetFilters);
      const isFiltered = state.occasion !== "all" || state.maxPrice < state.priceMax;
      summary.hidden = false;
      resetButton.disabled = !isFiltered;
    };

    const syncChips = () => {
      chips.querySelectorAll(".chip").forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.occasion === state.occasion))
      );
    };

    const renderChips = (occasions) => {
      const makeChip = (key, label) => {
        const chip = el("button", "chip", label);
        chip.type = "button";
        chip.dataset.occasion = key;
        chip.setAttribute("aria-pressed", String(state.occasion === key));
        chip.addEventListener("click", () => {
          state.occasion = key;
          syncChips();
          renderList();
        });
        return chip;
      };
      chips.replaceChildren(
        makeChip("all", "Wszystkie"),
        ...occasions.map(({ key, label }) => makeChip(key, label))
      );
    };

    const updatePriceLabel = () => {
      priceOutput.textContent =
        state.maxPrice >= state.priceMax ? "dowolna" : `${state.maxPrice.toLocaleString("pl-PL")} zł`;
    };

    const clearFilters = () => {
      state.occasion = "all";
      state.maxPrice = state.priceMax;
      priceInput.value = String(state.priceMax);
      syncChips();
      updatePriceLabel();
    };

    const resetFilters = () => {
      clearFilters();
      renderList();
    };

    // Pusta kategoria: zamiast listy komunikat z dwiema akcjami (lista produktów zostaje pusta, filtry widoczne).
    const showCategoryNotice = (category) => {
      grid.replaceChildren();
      grid.removeAttribute("aria-busy");
      message.hidden = true;
      hideSummary();
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));

      const showAll = el("button", "btn btn--gold", "Wyświetl wszystkie");
      showAll.type = "button";
      showAll.addEventListener("click", resetFilters);
      const contact = el("button", "btn btn--outline", "Kontakt");
      contact.type = "button";
      contact.addEventListener("click", () => document.dispatchEvent(new CustomEvent("order:open")));

      notice.replaceChildren(
        el(
          "p",
          "catalog__notice-text",
          `Obecnie nie mamy w katalogu kompozycji z kategorii „${category}”. Zobacz pozostałe kompozycje lub zostaw kontakt.`
        ),
        el("div", "catalog__notice-actions")
      );
      notice.lastElementChild.append(showAll, contact);
      notice.hidden = false;
    };

    // Kategoria z kart oferty = jedna z okazji z arkusza (porównanie bez wielkości liter i ogonków).
    const applyCategory = (category) => {
      const key = normalize(category);
      const exists = state.items.some((item) => item.occasions.some((o) => o.key === key));
      clearFilters();
      if (!exists) {
        showCategoryNotice(category);
        return;
      }
      state.occasion = key;
      syncChips();
      renderList();
    };

    // Katalog jeszcze się ładuje (lub nie ma pozycji): kategoria czeka na dane.
    const requestCategory = (category) => {
      if (state.items.length > 0) applyCategory(category);
      else pendingCategory = category;
    };

    const setupFilters = () => {
      // Okazje: grupujemy bez względu na wielkość liter i ogonki; etykieta z wariantu z polskimi znakami, jeśli jest.
      const groups = new Map();
      state.items.forEach((item) =>
        item.occasions.forEach(({ key, label }) => {
          const known = groups.get(key);
          const better = !known || (/[^\x00-\x7f]/.test(label) && !/[^\x00-\x7f]/.test(known));
          if (better) groups.set(key, label);
        })
      );
      const occasions = [...groups].map(([key, label]) => ({ key, label: capitalize(label) }));
      occasionGroup.hidden = occasions.length < 2;
      renderChips(occasions);

      // Cena: suwak od najtańszej do najdroższej (zaokrąglone do kroku). Suwak na maksimum = bez filtra.
      const prices = state.items.map((i) => i.priceValue).filter((v) => v !== null);
      const min = prices.length ? Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP : 0;
      const max = prices.length ? Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP : 0;
      priceGroup.hidden = !(prices.length && max > min);
      priceInput.min = String(min);
      priceInput.max = String(max);
      priceInput.step = String(PRICE_STEP);
      priceInput.value = String(max);
      state.priceMax = max;
      state.maxPrice = max;
      state.occasion = "all";
      updatePriceLabel();

      filters.hidden = occasionGroup.hidden && priceGroup.hidden;
    };

    const setData = (rawItems) => {
      state.items = prepare(rawItems);
      if (state.items.length === 0) {
        showMessage(
          "Katalog jest w przygotowaniu. Zostaw kontakt, a przedstawimy dostępne kompozycje.",
          "Zostaw kontakt",
          () => document.dispatchEvent(new CustomEvent("order:open"))
        );
        return;
      }
      setupFilters();
      renderList();
      if (pendingCategory) {
        const category = pendingCategory;
        pendingCategory = null;
        applyCategory(category);
      }
    };

    const load = async () => {
      const cached = readCache();
      if (cached) {
        setData(cached);
      } else {
        showSkeleton();
      }
      try {
        const fresh = await fetchCatalog();
        writeCache(fresh);
        if (!cached || JSON.stringify(cached) !== JSON.stringify(fresh)) setData(fresh);
      } catch {
        if (!cached) {
          showMessage("Nie udało się wczytać katalogu. Spróbuj ponownie za chwilę.", "Spróbuj ponownie", load);
        }
      }
    };

    priceInput.addEventListener("input", () => {
      state.maxPrice = Number(priceInput.value);
      updatePriceLabel();
      renderList();
    });
    resetButton.addEventListener("click", resetFilters);

    // Przyciski „Poznaj ofertę" w kartach oferty: link do #kompozycje przewija, a my ustawiamy filtr.
    document.querySelectorAll("[data-catalog-category]").forEach((link) =>
      link.addEventListener("click", () => requestCategory(link.dataset.catalogCategory))
    );

    if (lightbox) {
      lightbox.querySelector("[data-lightbox-close]").addEventListener("click", closeLightbox);
      // Klik w tło (poza oknem) zamyka podgląd; klik wewnątrz okna nie.
      lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox && isClickOutside(event, lightbox)) closeLightbox();
      });
      // Zamknięcie klawiszem Esc nie przechodzi przez closeLightbox, więc sprzątamy też po zdarzeniu close.
      lightbox.addEventListener("close", () => lightboxImage.removeAttribute("src"));
    }

    load();
  };

  initCatalog();
})();
