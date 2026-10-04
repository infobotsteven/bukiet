(() => {
  "use strict";

  const CACHE_KEY = "kzs:catalog:v1";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const FETCH_TIMEOUT_MS = 15000;
  const SKELETON_COUNT = 3;
  const PRICE_STEP = 50;

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
      .replace(/[̀-ͯ]/g, "")
      .trim();

  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  // Pierwsza liczba z tekstu ceny ("1 000,50 zł" -> 1000.5, "od 120 zł" -> 120). Brak liczby -> null.
  const parsePrice = (text) => {
    const match = String(text || "").match(/\d[\d\s ]*(?:[.,]\d+)?/);
    if (!match) return null;
    const value = Number(match[0].replace(/[\s ]/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : null;
  };

  // Sama liczba (też "1 250" i "3 400,50") -> "1 250 zł". Inny tekst (np. "od 120 zł", "do ustalenia") bez zmian.
  const formatPrice = (text) => {
    const value = String(text || "").trim();
    if (!value) return "Cena do ustalenia";
    if (!/^\d{1,3}(?:[\s ]\d{3})+(?:[.,]\d+)?$|^\d+(?:[.,]\d+)?$/.test(value)) return value;
    const number = Number(value.replace(/[\s ]/g, "").replace(",", "."));
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
    const response = await fetch(`${getEndpoint()}?action=catalog`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.items)) throw new Error("Nieprawidłowa odpowiedź katalogu");
    return result.items;
  };

  // Czyści i uzupełnia pozycje; wyróżnione na początek (kolejność z arkusza poza tym zachowana).
  const prepare = (rawItems) => {
    const items = rawItems
      .filter((item) => item && item.id && item.name)
      .map((item) => {
        const occasion = String(item.occasion || "").trim();
        const occasionKey = normalize(occasion);
        return {
          id: String(item.id),
          name: String(item.name),
          occasion,
          occasionKey,
          universal: occasionKey === "" || UNIVERSAL_OCCASIONS.includes(occasionKey),
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

    const state = { items: [], occasion: "all", maxPrice: Infinity, priceMax: 0 };

    const createProduct = (item) => {
      const card = el("article", `card product${item.featured ? " product--featured" : ""}`);

      const media = el("div", "product__media");
      const image = imageFor(item);
      const img = el("img", "product__image");
      img.src = image.src;
      img.alt = image.isPlaceholder ? `${item.name} (zdjęcie poglądowe)` : item.name;
      img.width = 640;
      img.height = 480;
      img.loading = "lazy";
      img.addEventListener(
        "error",
        () => {
          img.src = placeholderFor(item);
        },
        { once: true }
      );
      media.append(img);
      if (item.featured) {
        const ribbon = el("span", "product__ribbon");
        ribbon.append(el("span", "product__ribbon-star", "★"), " Polecane");
        media.append(ribbon);
      }
      if (item.occasion) media.append(el("span", "product__occasion", capitalize(item.occasion)));

      const body = el("div", "product__body");
      body.append(el("h3", "product__title", item.name));
      if (item.description) body.append(el("p", "product__text", item.description));

      const footer = el("div", "product__footer");
      footer.append(el("span", "product__price", formatPrice(item.price)));
      const button = el("button", "card__link product__cta", "Zamów →");
      button.type = "button";
      button.setAttribute("aria-label", `Zamów kompozycję: ${item.name}`);
      button.addEventListener("click", () => requestOrder(item));
      footer.append(button);
      body.append(footer);

      card.append(media, body);
      return card;
    };

    const showSkeleton = () => {
      grid.setAttribute("aria-busy", "true");
      grid.replaceChildren(
        ...Array.from({ length: SKELETON_COUNT }, () => el("div", "card product product--skeleton"))
      );
      message.hidden = true;
      filters.hidden = true;
      summary.hidden = true;
      count.textContent = "";
    };

    const showMessage = (text, actionLabel, onAction) => {
      grid.replaceChildren();
      grid.removeAttribute("aria-busy");
      filters.hidden = true;
      summary.hidden = true;
      count.textContent = "";
      message.replaceChildren(el("p", "catalog__message-text", text));
      if (actionLabel) {
        const action = el("button", "btn btn--outline", actionLabel);
        action.type = "button";
        action.addEventListener("click", onAction);
        message.append(action);
      }
      message.hidden = false;
    };

    const matches = (item) => {
      const occasionOk = state.occasion === "all" || item.universal || item.occasionKey === state.occasion;
      const priceOk =
        state.maxPrice >= state.priceMax || (item.priceValue !== null && item.priceValue <= state.maxPrice);
      return occasionOk && priceOk;
    };

    const renderList = () => {
      const visible = state.items.filter(matches);
      grid.removeAttribute("aria-busy");
      message.hidden = true;
      grid.replaceChildren(...visible.map(createProduct));
      count.textContent = `Znaleziono: ${visible.length} ${pluralize(visible.length)}`;
      if (visible.length === 0) {
        message.replaceChildren(
          el("p", "catalog__message-text", "Brak kompozycji dla wybranych filtrów.")
        );
        const action = el("button", "btn btn--outline", "Wyczyść filtry");
        action.type = "button";
        action.addEventListener("click", resetFilters);
        message.append(action);
        message.hidden = false;
      }
      const isFiltered = state.occasion !== "all" || state.maxPrice < state.priceMax;
      summary.hidden = false;
      resetButton.disabled = !isFiltered;
    };

    const renderChips = (occasions) => {
      const makeChip = (key, label) => {
        const chip = el("button", "chip", label);
        chip.type = "button";
        chip.dataset.occasion = key;
        chip.setAttribute("aria-pressed", String(state.occasion === key));
        chip.addEventListener("click", () => {
          state.occasion = key;
          chips.querySelectorAll(".chip").forEach((c) =>
            c.setAttribute("aria-pressed", String(c.dataset.occasion === key))
          );
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

    function resetFilters() {
      state.occasion = "all";
      state.maxPrice = state.priceMax;
      priceInput.value = String(state.priceMax);
      chips.querySelectorAll(".chip").forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.occasion === "all"))
      );
      updatePriceLabel();
      renderList();
    }

    const setupFilters = () => {
      // Okazje: grupujemy bez względu na wielkość liter i ogonki; etykieta z wariantu z polskimi znakami, jeśli jest.
      const groups = new Map();
      state.items.forEach((item) => {
        if (item.universal) return;
        const known = groups.get(item.occasionKey);
        const better = !known || (/[^\x00-\x7f]/.test(item.occasion) && !/[^\x00-\x7f]/.test(known));
        if (better) groups.set(item.occasionKey, item.occasion);
      });
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

    load();
  };

  initCatalog();
})();
