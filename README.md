# Kwiaty z Sercem - landing page

Makieta landing page wykonana w czystym HTML + CSS + JavaScript (bez zależności i bez etapu budowania).

## Uruchomienie
Otwórz `index.html` w przeglądarce.

## Struktura
- `index.html` - struktura i treść strony
- `css/styles.css` - style (zmienne, komponenty w konwencji BEM, responsywność)
- `js/main.js` - menu mobilne i okno zamówienia
- `assets/images/` - logo i zdjęcia w formacie WebP (kadry wycięte ze zdjęć w folderze `foto/`)

## Konwencje
- Klasy CSS nazywane wg BEM (`blok__element--modyfikator`); kolory, cienie i promienie w zmiennych na `:root`.
- Atrybuty `data-*` (np. `data-order-open`) służą wyłącznie do podpięcia JS, więc zmiana klas CSS nie psuje skryptów.
- Okno zamówienia to natywny element `<dialog>` (obsługa Esc i pułapki fokusu przez przeglądarkę).

Formularz zamówienia jest demonstracyjny i nie wysyła danych do backendu.
