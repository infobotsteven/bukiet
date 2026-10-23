/* Mapa w sekcji „Odbiór zamówień": Leaflet (plik w assets/vendor/leaflet) + kafelki OpenStreetMap
   i pinezka w kolorze marki. Biblioteka ładuje się dopiero, gdy sekcja zbliża się do okna przeglądarki.
   Bez JS albo przy błędzie ładowania zostaje awaryjny link do mapy wewnątrz kontenera [data-map]. */
(() => {
  "use strict";

  const LEAFLET_JS = "assets/vendor/leaflet/leaflet.js";
  const LEAFLET_CSS = "assets/vendor/leaflet/leaflet.css";
  const TILES_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PIN_SIZE = { width: 36, height: 46 };
  const PRELOAD_MARGIN = "600px 0px";   // zaczynamy ładować, zanim sekcja wjedzie w widok

  const loadStyle = (href) =>
    new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", reject, { once: true });
      document.head.append(link);
    });

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.append(script);
    });

  // Pinezka jako SVG; kolory pochodzą z CSS (.map-pin__*), więc zmiana marki nie wymaga zmiany kodu.
  const createPin = () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "map-pin__svg");
    svg.setAttribute("viewBox", `0 0 ${PIN_SIZE.width} ${PIN_SIZE.height}`);
    svg.setAttribute("aria-hidden", "true");
    const shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("class", "map-pin__shape");
    shape.setAttribute("d", "M18 2C9.7 2 3 8.7 3 17c0 11 15 27 15 27s15-16 15-27C33 8.7 26.3 2 18 2z");
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("class", "map-pin__dot");
    dot.setAttribute("cx", "18");
    dot.setAttribute("cy", "17");
    dot.setAttribute("r", "6");
    svg.append(shape, dot);
    return svg;
  };

  // Wyrównuje kontener mapy do siatki pikseli urządzenia. Gdy kontener leży na ułamkowej pozycji strony
  // (np. 256,06 px na ekranie 2×), krawędzie kafelków wypadają między pikselami i na styku widać jasne szwy.
  // Przesunięcie jest mniejsze niż piksel urządzenia i nie zmienia układu strony (transform, nie margines).
  const alignToPixels = (container) => {
    const dpr = window.devicePixelRatio || 1;
    container.style.transform = "";
    const rect = container.getBoundingClientRect();
    const shift = (position) => {
      const fraction = (position * dpr) % 1;
      if (fraction < 0.001 || fraction > 0.999) return 0;
      return (fraction < 0.5 ? -fraction : 1 - fraction) / dpr;
    };
    const dx = shift(rect.left + window.scrollX);
    const dy = shift(rect.top + window.scrollY);
    if (dx || dy) container.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const keepAligned = (container) => {
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        alignToPixels(container);
      });
    };
    alignToPixels(container);
    window.addEventListener("resize", schedule);
    if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(document.body);   // zmiany układu nad mapą
  };

  const initMap = (container) => {
    const lat = Number(container.dataset.lat);
    const lng = Number(container.dataset.lng);
    const zoom = Number(container.dataset.zoom) || 17;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !window.L) return;

    container.replaceChildren();   // usuwa awaryjny link
    const map = window.L.map(container, {
      center: [lat, lng],
      zoom,
      scrollWheelZoom: false,                    // kółko myszy przewija stronę, a nie mapę
      dragging: !window.L.Browser.mobile,        // na telefonie jeden palec przewija stronę, dwa palce przybliżają mapę
    });
    // detectRetina: na ekranach 2× kafelki idą w podwójnej rozdzielczości (bez skalowania 256 px → 512 px),
    // dzięki czemu nie powstają jasne szwy na styku kafelków, a mapa jest ostrzejsza.
    window.L.tileLayer(TILES_URL, { maxZoom: 19, detectRetina: true, attribution: ATTRIBUTION }).addTo(map);

    const icon = window.L.divIcon({
      className: "map-pin",
      html: createPin(),
      iconSize: [PIN_SIZE.width, PIN_SIZE.height],
      iconAnchor: [PIN_SIZE.width / 2, PIN_SIZE.height],   // czubek pinezki dokładnie w punkcie
    });
    window.L.marker([lat, lng], { icon, title: container.dataset.label || "", keyboard: false }).addTo(map);

    keepAligned(container);

    // Po kliknięciu w mapę kółko myszy przybliża ją, po opuszczeniu mapy znowu przewija stronę.
    container.addEventListener("click", () => map.scrollWheelZoom.enable());
    container.addEventListener("mouseleave", () => map.scrollWheelZoom.disable());
  };

  const start = (container) =>
    Promise.all([loadStyle(LEAFLET_CSS), loadScript(LEAFLET_JS)])
      .then(() => initMap(container))
      .catch(() => {
        /* biblioteka się nie wczytała: zostaje awaryjny link do mapy */
      });

  const container = document.querySelector("[data-map]");
  if (!container) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        start(container);
      },
      { rootMargin: PRELOAD_MARGIN }
    );
    observer.observe(container);
  } else {
    start(container);
  }
})();
