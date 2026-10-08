/* Wspólne funkcje pomocnicze dla pozostałych skryptów strony.
   Musi być wczytany przed main.js i catalog.js. Udostępnia obiekt window.KzS. */
(() => {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 15000;

  // Pobiera JSON z limitem czasu (obejmuje też odczyt treści odpowiedzi).
  // Używa AbortController z timerem zamiast AbortSignal.timeout, którego brakuje w starszych przeglądarkach
  // (np. iOS < 16): bez tego formularz i katalog zawsze kończyłyby się błędem.
  const fetchJson = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  // Czy kliknięcie wypadło poza prostokątem okna <dialog>, czyli w tło za nim?
  const isClickOutside = (event, dialog) => {
    const box = dialog.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  };

  window.KzS = Object.freeze({ fetchJson, isClickOutside });
})();
