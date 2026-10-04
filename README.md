# Kwiaty z Sercem - landing page

Strona pracowni florystycznej wykonana w czystym HTML + CSS + JavaScript (bez zależności i bez etapu budowania). Hostowana na GitHub Pages. Zgłoszenia i katalog kompozycji obsługuje Arkusz Google przez Google Apps Script (backend poza tym repozytorium).

## Uruchomienie
Strona pobiera dane z internetu (katalog), więc najlepiej uruchomić ją przez lokalny serwer, np. `python -m http.server 8765`, i otworzyć `http://localhost:8765/`.

## Funkcje

### Strona
- Jednostronicowy układ: hero, pasek zalet, oferta (3 kategorie z jednym przyciskiem kontaktu pod kartami), „O nas", **katalog gotowych kompozycji**, „Jak zamówić", galeria, CTA i stopka.
- Przycisk w hero płynnie przewija do katalogu, a przycisk w menu otwiera formularz kontaktowy.
- W pełni responsywna (telefon, tablet, desktop), z menu mobilnym, linkiem „Przejdź do treści", obsługą `prefers-reduced-motion` i atrybutami ARIA.
- Lekkie obrazy WebP (całe `assets/` poniżej 1 MB), tło hero w dwóch rozmiarach zależnie od ekranu, ikona strony (favicon SVG/ICO oraz ikona Apple).

### Katalog gotowych kompozycji
Dane są pobierane z zakładki „Katalog" w Arkuszu Google, więc ofertę edytuje się w arkuszu, bez zmian w kodzie.
- **Karty** ze zdjęciem, okazją, nazwą, opisem i ceną. Kompozycje bez własnego zdjęcia dostają zdjęcie zastępcze.
- **Wyróżnione kompozycje** pojawiają się na początku, ze złotą ramką, wstążką „Polecane" i ceną w kolorze bordo.
- **Filtry:** okazja (przyciski) oraz maksymalna cena (suwak). Filtry łączą się ze sobą, wskazują liczbę wyników i można je wyczyścić. Okazje o „uniwersalnych" nazwach (np. „Każda okazja") pasują do każdego filtra.
- **Stany:** szkielet ładowania, komunikat z ponowieniem przy błędzie, informacja o pustym katalogu, brak wyników po filtrach. Krótka pamięć podręczna w przeglądarce przyspiesza kolejne wejścia.

### Formularz kontaktowy (okno)
Natywny element `<dialog>` w dwóch trybach:
- **Kontakt** (przycisk „Zostaw kontakt" w menu, jeden pod kartami oferty, w sekcji „Jak zamówić" i CTA na końcu strony): imię, telefon, opcjonalna wiadomość i zgoda na kontakt.
- **Zamówienie kompozycji** (przycisk „Zamów" na karcie katalogu): to samo okno z widoczną wybraną kompozycją i jej ID. Do zgłoszenia dołączane są osobne pola z ID i nazwą kompozycji, a wiadomość klienta pozostaje nietknięta.
- Po wysłaniu pokazuje potwierdzenie (zielony box z ikoną), a przy błędzie komunikat bez utraty wpisanych danych. Wysyłka ma limit czasu, a przycisk blokuje się na czas wysyłania.

### Zgłoszenia w Arkuszu Google
- Każde zgłoszenie dostaje kolejny numer (`K-0001`…) i trafia do zakładki „Zgłoszenia" razem z datą i statusem. Zamówienia z katalogu zapisują dodatkowo ID i nazwę kompozycji w osobnych kolumnach.
- Nazwa kompozycji jest brana z katalogu (a nie od klienta), więc ID i nazwa w arkuszu zawsze do siebie pasują.
- Opcjonalne powiadomienie e-mail o nowym zgłoszeniu.

### Bezpieczeństwo
- Publicznie dostępny jest wyłącznie odczyt zakładki „Katalog" (nazwa na stałe w kodzie, z białą listą pól i tylko aktywne pozycje). Zakładka ze zgłoszeniami (dane osobowe) nie ma żadnej drogi odczytu.
- Zabezpieczenie przed wstrzyknięciem formuł do arkusza, walidacja numeru telefonu i limity długości pól po stronie serwera, pole-pułapka (honeypot) na boty.
- Dane z katalogu są wyświetlane wyłącznie jako tekst (bez `innerHTML`); adresy zdjęć są walidowane.

## Struktura repozytorium
- `index.html` - struktura i treść strony
- `css/styles.css` - style (zmienne, komponenty w konwencji BEM, responsywność)
- `js/main.js` - menu mobilne, okno kontaktowe i wysyłka formularza
- `js/catalog.js` - katalog: pobieranie, filtry, karty, zamawianie z karty
- `assets/images/` - logo i zdjęcia w formacie WebP
- `assets/icons/` - ikona strony

## Konfiguracja
Adres skryptu Google Apps Script jest w atrybucie `data-endpoint` formularza w `index.html` (jedno miejsce; korzysta z niego zarówno wysyłka zgłoszeń, jak i katalog).

## Konwencje
- Klasy CSS nazywane wg BEM (`blok__element--modyfikator`); kolory, cienie i promienie w zmiennych na `:root`.
- Atrybuty `data-*` (np. `data-order-open`, `data-catalog-*`) służą wyłącznie do podpięcia JS, więc zmiana klas CSS nie psuje skryptów.
- Moduły komunikują się zdarzeniami DOM (np. `order:open` otwiera okno kontaktowe z wybraną kompozycją).
