# UniqWear - Microservices E-commerce API

Backend dla sklepu internetowego zbudowany w architekturze mikroserwisów.

## Serwisy

| Serwis | Port | Opis |
|--------|------|------|
| gateway | 3000 | API Gateway — jeden punkt wejścia dla wszystkich żądań |
| catalog-service | 3001 | Zarządzanie produktami, kategoriami, recenzjami |
| checkout-service | 3002 | Koszyk, zamówienia, stany magazynowe |

## Technologie

- **PostgreSQL** — dane relacyjne (produkty, warianty, koszyki, zamówienia)
- **MongoDB** — dane dokumentowe (opisy produktów, recenzje, szkice koszyków)
- **Prisma** — ORM dla catalog-service (PostgreSQL)
- **Sequelize** — ORM dla checkout-service (PostgreSQL)
- **Knex** — query builder i migracje (catalog-service)
- **Mongoose** — ODM dla MongoDB
- **Docker / Docker Compose** — konteneryzacja

## Wymagania

- Docker
- Docker Compose

## Instrukcja uruchomienia

1. Sklonuj repozytorium:
   ```bash
   git clone https://gitlab.com/ug_bazy_danych_2/25-26_project/project-chelminska-wiktoria-90d9.git
   cd UniqWear
   ```

2. Skonfiguruj zmienne środowiskowe — w każdym folderze serwisu zmień nazwę `.env.example` na `.env`:
   ```bash
   cp catalog-service/.env.example catalog-service/.env
   cp checkout-service/.env.example checkout-service/.env
   cp gateway/.env.example gateway/.env
   ```

3. Uruchom wszystkie kontenery:
   ```bash
   docker compose up -d
   ```

Migracje baz danych wykonują się automatycznie przy starcie kontenerów.

## Zmienne środowiskowe

### catalog-service
```
CATALOG_PORT=3001
DATABASE_URL=postgresql://uniqwear_user:uniqwear_pass@postgres:5432/uniqwear_db?schema=public
MONGO_URI=mongodb://mongo:27017/uniqwear_mongo
```

### checkout-service
```
CHECKOUT_PORT=3002
DATABASE_URL=postgres://uniqwear_user:uniqwear_pass@postgres:5432/uniqwear_db
MONGO_URI=mongodb://mongo:27017/uniqwear_mongo
```

### gateway
```
GATEWAY_PORT=3000
CATALOG_URL=http://catalog_service:3001
CHECKOUT_URL=http://checkout_service:3002
```

## Przepływ danych - co trafia do której bazy

```
PostgreSQL (dane twarde, relacyjne):
├── Category        — kategorie produktów
├── Product         — produkty z licznikiem recenzji
├── Variant         — warianty (SKU, cena, stan magazynowy)
├── Cart            — koszyki
├── CartLine        — pozycje koszyka (snapshot ceny)
├── Order           — zamówienia
└── OrderLine       — pozycje zamówienia (snapshot ceny i SKU)

MongoDB (dane miękkie, dokumentowe):
├── ProductDetails  — długi opis, specyfikacje, galeria zdjęć
├── Review          — recenzje z historią moderacji
└── CartDraft       — szkic koszyka z historią zdarzeń (dodano, usunięto)
```

### Kiedy dane trafiają do obu baz jednocześnie

**Tworzenie produktu** (`POST /catalog/api/products/hybrid`):
```
1. Zapisz produkt do PostgreSQL (Prisma)
2. Zapisz szczegóły do MongoDB (Mongoose)
3. Jeśli MongoDB zawiedzie → usuń rekord z PostgreSQL (kompensacja)
```

**Zatwierdzenie recenzji** (`PATCH /catalog/api/reviews/:id/approve`):
```
1. Zmień status recenzji na 'approved' w MongoDB
2. Zinkrementuj reviewCount w tabeli Product w PostgreSQL
3. Jeśli PostgreSQL zawiedzie → cofnij zmianę statusu w MongoDB (kompensacja)
```

**Dodanie do koszyka** (`POST /checkout/api/cart/:id/items`):
```
1. Sprawdź stan magazynowy w PostgreSQL (blokada FOR UPDATE)
2. Zapisz CartLine w PostgreSQL
3. Zaktualizuj CartDraft w MongoDB (przez osobny endpoint)
```

## Endpointy API

Wszystkie żądania przechodzą przez Gateway na porcie 3000.

### Katalog (`/catalog/...`)

| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET | /catalog/products | Lista produktów z filtrem (category, minPrice) |
| GET | /catalog/products/:id | Szczegóły produktu z wariantami (Prisma) |
| GET | /catalog/api/products/pg/:id | Szczegóły produktu (natywny sterownik pg) |
| GET | /catalog/api/products/details | Szczegóły wielu produktów z Mongo ($in) |
| GET | /catalog/api/products/details/search | Wyszukiwanie pełnotekstowe ($text, $gte) |
| POST | /catalog/api/products/hybrid | Utwórz produkt w PG + Mongo z kompensacją |
| GET | /catalog/api/categories | Lista kategorii |
| POST | /catalog/api/categories | Dodaj kategorię |
| POST | /catalog/api/reviews | Dodaj recenzję |
| PATCH | /catalog/api/reviews/:id/approve | Zatwierdź recenzję (aktualizuje PG + Mongo) |
| GET | /catalog/api/analytics/ratings | Agregacja średnich ocen produktów |
| GET | /catalog/stats/inventory | Statystyki magazynowe ($queryRaw) |
| POST | /catalog/api/cart-draft | Utwórz/zaktualizuj szkic koszyka w Mongo |
| GET | /catalog/api/cart-draft/:cartId | Pobierz szkic koszyka z populate() |

### Koszyk i zamówienia (`/checkout/...`)

| Metoda | Endpoint | Opis |
|--------|----------|------|
| POST | /checkout/api/cart | Utwórz koszyk |
| GET | /checkout/api/cart/:id | Pobierz koszyk z pozycjami |
| POST | /checkout/api/cart/:id/items | Dodaj produkt do koszyka (walidacja stanu) |
| DELETE | /checkout/api/cart/:id/items/:sku | Usuń produkt z koszyka |
| POST | /checkout/checkout | Złóż zamówienie (blokada oversell) |
| GET | /checkout/orders | Historia zamówień |
| POST | /checkout/orders/:id/cancel | Anuluj zamówienie (przywraca stan) |

## Reguły biznesowe

- **Snapshot ceny** - zmiana cennika nie wpływa na już złożone zamówienia ani pozycje koszyka
- **Blokada oversell** - checkout zwraca 409 gdy brak wystarczającego stanu magazynowego
- **Anulowanie zamówienia** - przywraca stan magazynowy wszystkich pozycji
- **Polityka dla otwartych koszyków** - jeśli produkt zniknie z menu, pozycje pozostają w koszyku aż do ręcznego usunięcia lub zamknięcia koszyka
- **Unikalność SKU** - próba dodania duplikatu zwraca 409

## Bezpieczeństwo

### Zaimplementowane zabezpieczenia

- **Zapytania parametryzowane** - wszystkie zapytania SQL używają placeholderów (`$1`, `$2` w pg, `:param` w Sequelize) zamiast sklejania stringów. Chroni przed SQL injection.
- **Brak stack trace w odpowiedziach** - błędy zwracają tylko `{ error, code, details }` bez wewnętrznych szczegółów implementacji
- **Walidacja wejścia** - modele Sequelize i Mongoose walidują dane przed zapisem (typy, zakresy, wymagane pola)
- **Jednolity format błędów** - każdy błąd ma ten sam format `{ error, code, details }` co ułatwia obsługę po stronie klienta

### Potencjalne zagrożenia i ograniczenia

- **Brak autoryzacji i autentykacji** - API jest w pełni otwarte. W produkcji należy dodać JWT lub OAuth w warstwie Gateway
- **Brak rate limitingu** - Gateway nie ogranicza liczby żądań. W produkcji należy dodać np. `express-rate-limit`
- **Brak HTTPS** - komunikacja odbywa się po HTTP. W produkcji należy skonfigurować TLS/SSL
- **Zmienne środowiskowe** - hasła do baz danych są w plikach `.env` które są wykluczone z repozytorium przez `.gitignore`. Nigdy nie commituj pliku `.env`


# Projekt

<p class="editor-paragraph mb-2" dir="ltr"><span style="white-space: pre-wrap;">System serwerowy dla punktu zamówień (kiosk): katalog pozycji z wariantami i modyfikatorami, koszyk sesyjny, naliczanie cen, składanie zamówienia i potwierdzenie płatności (symulacja lub status). PostgreSQL: transakcyjna spójność stanów magazynowych, zamówień i pozycji. MongoDB: szkice konfiguracji koszyka, zdarzenia telemetryczne kroku składania (dla analityki i audytu UX po stronie serwera). Bez oceny interfejsu dotykowego — tylko API i modele danych.</span></p>

## Opis Wyzwania
<h2 class="editor-heading-h2 text-2xl font-semibold mb-3" dir="ltr" style="text-align: start;"><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">Repozytorium i wybór tematu</strong></b><span style="white-space: pre-wrap;">&nbsp;</span></h2><p class="editor-paragraph mb-2" dir="ltr" style="text-align: start;"><span style="white-space: pre-wrap;">Cały proces został przeniesiony na platformę&nbsp;</span><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">GitLab</strong></b><span style="white-space: pre-wrap;">. Repozytorium tworzy się automatycznie po kliknięciu&nbsp;</span><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">odpowiedniego przycisku</strong></b><span style="white-space: pre-wrap;">. Proszę pamiętać, że pełna lista wymagań pojawi się dopiero po&nbsp;</span><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">wybraniu konkretnego tematu</strong></b><span style="white-space: pre-wrap;">&nbsp;w systemie.</span></p><h2 class="editor-heading-h2 text-2xl font-semibold mb-3" dir="ltr" style="text-align: start;"><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">Terminy</strong></b><span style="white-space: pre-wrap;">&nbsp;</span></h2><p class="editor-paragraph mb-2" dir="ltr" style="text-align: start;"><span style="white-space: pre-wrap;">Termin oddania prac upływa&nbsp;</span><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">01.06.2026 r.</strong></b><span style="white-space: pre-wrap;">&nbsp;Jest to data graniczna pozwalająca na uzyskanie 100% punktów. W przypadku spóźnień będą naliczane kary procentowe za każdy dzień zwłoki (szczegółowe zasady u prowadzących grupy).</span></p><h2 class="editor-heading-h2 text-2xl font-semibold mb-3" dir="ltr" style="text-align: start;"><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">Zakres oceny</strong></b><span style="white-space: pre-wrap;">&nbsp;</span></h2><p class="editor-paragraph mb-2" dir="ltr" style="text-align: start;"><span style="white-space: pre-wrap;">Ocenie podlega wyłącznie część serwerowa oraz baza danych. Warstwa kliencka jest dowolna – do prezentacji działania projektu można wykorzystać prosty frontend lub po prostu kolekcję w programie Postman.</span></p><h2 class="editor-heading-h2 text-2xl font-semibold mb-3" dir="ltr" style="text-align: start;"><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">Punktacja</strong></b><span style="white-space: pre-wrap;">&nbsp;</span></h2><p class="editor-paragraph mb-2" dir="ltr" style="text-align: start;"><span style="white-space: pre-wrap;">Struktura oceny pozwala na uzyskanie łącznie 115% punktów:</span></p><ul class="editor-list-ul list-disc pl-6 mb-2"><li value="1" dir="ltr"><span style="white-space: pre-wrap;">Wymagania techniczne (T1–T8):&nbsp;</span><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">60%</strong></b></li><li value="2" dir="ltr"><span style="white-space: pre-wrap;">Wymagania dodatkowe:&nbsp;</span><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">15%</strong></b></li><li value="3" dir="ltr"><span style="white-space: pre-wrap;">Wymagania funkcjonalne (zależne od tematu):&nbsp;</span><b><strong class="editor-text-bold font-bold" style="white-space: pre-wrap;">40%</strong></b></li></ul>

## Kryteria Oceny
Całkowita liczba punktów: 26

| Wymaganie | Opis | Waga |
|-----------|------|------|
| Wymaganie | Pula połączeń singleton, zapytania parametryzowane ($1, $2), mapowanie kodów PostgreSQL (np. 23505, 23503) na HTTP. | 7% |
| Wymaganie | Schemat wyłącznie przez migracje (min. 2 addytywne), seedy domenowe, min. 1 endpoint z dynamicznym where bez sklejania SQL z stringów. | 7% |
| Wymaganie | Min. 2 modele z walidacją, relacje użyte w endpointach, eager loading (include), hook domenowy, transakcja zarządzana. | 7% |
| Wymaganie | Min. 2 modele z relacjami, historia migracji (migrate deploy na czystej bazie), CRUD przez PrismaClient bez any, min. 1 $queryRaw (tagged template). | 7% |
| Wymaganie | Singleton MongoClient, zamknięcie przy SIGINT, zasób domenowy sterownikiem natywnym, min. 3 różne operatory w realnych endpointach, indeks złożony lub tekstowy. | 6% |
| Wymaganie | Min. 2 schematy z walidatorami niestandardowymi, subdokument lub tablica zagnieżdżona, pre hook, populate w endpoincie, methods lub statics. | 6% |
| Wymaganie | Pipeline z $match, $group, $project i min. jednym dodatkowym stage; $lookup; pierwszy $match pod indeks; endpoint analityczny — agregacja w bazie. | 6% |
| Wymaganie | docker compose up bez kroków ręcznych, multi-stage Dockerfile, healthchecki, depends_on service_healthy, .env.example. | 4% |
| Wymaganie | Min. 2 serwisy Node w osobnych kontenerach, podział per silnik BD, komunikacja HTTP/broker, API Gateway, migracje/seedy z compose. | 5% |
| Wymaganie | Min. 1 operacja zapisu do PG i Mongo z rollbackiem lub kompensacją; jednolity format błędów { error, code, details }. | 5% |
| Wymaganie | Repozytorium zawiera README: jak uruchomić (compose), zmienne środowiskowe, podział serwisów, diagram lub opis przepływu danych PG/Mongo. | 4% |
| Wymaganie | Publikowalna specyfikacja OpenAPI 3.x lub równoważna lista endpointów z przykładowymi żądaniami/odpowiedziami. | 4% |
| Wymaganie | Min. zestaw testów integracyjnych lub e2e krytycznych ścieżek API (np. supertest + baza testowa). | 4% |
| Wymaganie | Walidacja wejścia, brak wycieku stack trace do klienta, jawna obsługa błędów SQL/Mongo; krótki opis zagrożeń w README. | 3% |
| Wymaganie | PostgreSQL: kategorie i pozycje menu; warianty rozmiaru/wersji; modyfikatory z ceną; zamówienia i order_lines ze snapshotem ceny; stany magazynowe lub limity dzienne (prosty model wystarczalny). Transakcje przy finalizacji. | 10% |
| Wymaganie | MongoDB: dokument cart_draft (sessionId lub userId, wybrane pozycje z konfiguracją); event_log kroków (dodanie pozycji, zmiana modyfikatora, anulowanie) pod raporty i pipeline agregujący (T7). | 8% |
| Wymaganie | Endpointy listy menu z filtrowaniem (dynamiczny where). Dodawanie/usuwanie pozycji w koszyku (serwerowy stan, nie localStorage). POST checkout z walidacją dostępności i sumy; idempotencja lub klucz żądania przy powtórzeniu (opcjonalnie). | 8% |
| Wymaganie | Niedostępna pozycja lub przekroczony limit — 409/400 z kodem domenowym. Zmiana cennika nie wpływa na już złożone zamówienia (snapshot w liniach). Usunięcie pozycji z menu — polityka dla otwartych koszyków (jawnie opisana). | 8% |
| Wymaganie | Finalizacja zamówienia: zapis w PG + zamknięcie/zarchiwizowanie draftu i dopisanie zdarzenia „completed” w Mongo z kompensacją przy błędzie drugiego zapisu (T8c). | 6% |

## Zgłoszenie Rozwiązania
Proszę zaimplementować swoje rozwiązanie w tym repozytorium. Kiedy będziesz gotowy, prześlij link do tego repozytorium na platformie Cursora (cursora.org).
