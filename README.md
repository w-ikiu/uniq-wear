# UniqWear — Microservices E-commerce API

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

## Przepływ danych — co trafia do której bazy

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

**Finalizacja zamówienia** (`POST /checkout/checkout`):
```
1. Zapisz zamówienie w PostgreSQL (transakcja Sequelize)
2. Zamknij CartDraft w MongoDB (status: closed, event: completed)
3. Jeśli MongoDB zawiedzie → anuluj zamówienie i przywróć stan w PostgreSQL (kompensacja)
```

## Endpointy API

Wszystkie żądania przechodzą przez Gateway na porcie 3000.

### Katalog (`/catalog/...`)

---

#### `GET /catalog/products`
Lista produktów z filtrem dynamicznym.

Query params: `category`, `minPrice`, `maxPrice`, `available=true`

```
GET /catalog/products?category=sneakers&minPrice=100&available=true
```
```json
[
  {
    "id": 1,
    "name": "air max 1",
    "description": "klasyk na kazda okazje.",
    "categoryId": 1,
    "categoryName": "sneakers"
  }
]
```

---

#### `GET /catalog/products/:id`
Szczegóły produktu z wariantami (Prisma, eager loading).

```
GET /catalog/products/1
```
```json
{
  "id": 1,
  "name": "air max 1",
  "category": { "id": 1, "name": "sneakers" },
  "variants": [
    { "id": 1, "sku": "AM1-BLU-42", "price": "699.99", "stock": 10, "size": "42", "color": "blue" }
  ]
}
```

---

#### `GET /catalog/api/products/pg/:id`
Szczegóły produktu przez natywny sterownik pg (zapytanie parametryzowane $1).

```
GET /catalog/api/products/pg/1
```
```json
{ "id": 1, "name": "air max 1", "categoryId": 1 }
```

---

#### `GET /catalog/api/products/details`
Szczegóły wielu produktów z MongoDB (operator $in).

```
GET /catalog/api/products/details?ids=1,2,3
```
```json
[
  { "productId": 1, "long_description": "Klasyczny but...", "specs": {}, "gallery": [] }
]
```

---

#### `GET /catalog/api/products/details/search`
Wyszukiwanie pełnotekstowe w MongoDB (operatory $text, $gte).

```
GET /catalog/api/products/details/search?keyword=klasyczny&minWeight=200
```
```json
[
  { "productId": 1, "long_description": "Klasyczny but na każdą okazję..." }
]
```

---

#### `POST /catalog/api/products/hybrid`
Tworzy produkt w PostgreSQL (Prisma) i szczegóły w MongoDB. Kompensacja gdy MongoDB zawiedzie.

```json
{
  "name": "Air Force 1",
  "description": "Klasyczny but",
  "categoryId": 1,
  "price": 499.99,
  "sku": "AF1-WHT-42",
  "longDescription": "Kultowy model z białej skóry premium"
}
```
**201 Created:**
```json
{
  "message": "produkt utworzony w obu bazach",
  "pg": { "id": 2, "name": "Air Force 1", "categoryId": 1 },
  "mongo": { "_id": "...", "productId": 2, "long_description": "Kultowy model..." }
}
```

---

#### `GET /catalog/api/categories`
Lista wszystkich kategorii.

```json
[{ "id": 1, "name": "sneakers" }]
```

---

#### `POST /catalog/api/categories`
Tworzy nową kategorię.

```json
{ "name": "boots" }
```
**201 Created:**
```json
{ "id": 2, "name": "boots" }
```

---

#### `POST /catalog/api/reviews`
Dodaje recenzję (walidacja Mongoose: rating 1-5, pre-hook moderacji).

```json
{
  "productId": 1,
  "userId": 42,
  "rating": 5,
  "title": "Świetny produkt",
  "body": "Bardzo polecam, wygodne i trwałe"
}
```
**201 Created:**
```json
{
  "_id": "664abc...",
  "productId": 1,
  "userId": 42,
  "rating": 5,
  "status": "pending"
}
```
**400 Bad Request** (niepoprawna ocena):
```json
{ "error": "ocena musi byc w przedziale od 1 do 5", "code": 400, "details": null }
```

---

#### `PATCH /catalog/api/reviews/:id/approve`
Zatwierdza recenzję: zmienia status w MongoDB, inkrementuje `reviewCount` w PostgreSQL. Kompensacja gdy PG zawiedzie.

```
PATCH /catalog/api/reviews/664abc.../approve
```
**200 OK:**
```json
{
  "message": "recenzja zatwierdzona, licznik zaktualizowany",
  "review": { "_id": "664abc...", "status": "approved" }
}
```

---

#### `GET /catalog/api/analytics/ratings`
Aggregation pipeline MongoDB: średnia ocena per produkt ($match → $group → $lookup → $unwind → $sort → $project).

```
GET /catalog/api/analytics/ratings
```
```json
[
  { "productId": 1, "averageRating": 4.75, "reviewCount": 8, "description": "Kultowy model..." }
]
```

---

#### `GET /catalog/stats/inventory`
Statystyki stanu magazynowego per kategoria (`$queryRaw` Prisma).

```
GET /catalog/stats/inventory?minStock=5
```
```json
[{ "categoryId": 1, "totalStock": 42 }]
```

---

#### `POST /catalog/api/cart-draft`
Tworzy lub aktualizuje szkic koszyka w MongoDB (Mongoose, subdokumenty).

```json
{
  "cartId": 7,
  "sessionId": "sess-abc123",
  "productDetailsId": "664def...",
  "sku": "AM1-BLU-42",
  "quantity": 2
}
```
**201 Created:**
```json
{
  "_id": "...",
  "cartId": 7,
  "items": [{ "sku": "AM1-BLU-42", "quantity": 2 }],
  "events": [{ "type": "item_added", "sku": "AM1-BLU-42" }],
  "status": "open"
}
```

---

#### `GET /catalog/api/cart-draft/:cartId`
Pobiera szkic koszyka z pełnymi szczegółami produktu (populate()).

```
GET /catalog/api/cart-draft/1
```
```json
{
  "cartId": 1,
  "items": [{
    "productDetails": { "_id": "...", "long_description": "Klasyczny but...", "gallery": [] },
    "sku": "AM1-BLU-42",
    "quantity": 2
  }],
  "status": "open"
}
```

---

### Koszyk i zamówienia (`/checkout/...`)

---

#### `POST /checkout/api/cart`
Tworzy nowy koszyk w PostgreSQL.

```json
{ "sessionId": "sess-xyz789" }
```
**201 Created:**
```json
{ "id": 7, "sessionId": "sess-xyz789", "status": "open" }
```

---

#### `GET /checkout/api/cart/:id`
Pobiera koszyk z pozycjami (eager loading).

```
GET /checkout/api/cart/7
```
```json
{
  "id": 7,
  "status": "open",
  "lines": [{ "sku": "AM1-BLU-42", "price": "699.99", "quantity": 2 }]
}
```

---

#### `POST /checkout/api/cart/:id/items`
Dodaje pozycję do koszyka z walidacją stanu magazynowego (blokada FOR UPDATE).

```json
{ "sku": "AM1-BLU-42", "quantity": 2 }
```
**201 Created:**
```json
{
  "id": 7,
  "status": "open",
  "lines": [{ "sku": "AM1-BLU-42", "price": "699.99", "quantity": 2 }]
}
```
**409 Conflict** (brak stanu):
```json
{ "error": "blad dodawania do koszyka", "code": 409, "details": "niewystarczajacy stan dla AM1-BLU-42: dostepne 1" }
```

---

#### `DELETE /checkout/api/cart/:id/items/:sku`
Usuwa pozycję z koszyka.

```
DELETE /checkout/api/cart/7/items/AM1-BLU-42
```
**200 OK:**
```json
{ "message": "pozycja usunieta z koszyka" }
```

---

#### `POST /checkout/checkout`
Składa zamówienie z blokadą oversell. Opcjonalnie zamyka CartDraft w MongoDB (T8c hybryda).

```json
{
  "items": [{ "sku": "AM1-BLU-42", "quantity": 1 }],
  "userId": 42,
  "cartId": 7
}
```
**201 Created:**
```json
{ "message": "zamowienie zlozone", "order": { "id": 3, "totalAmount": "699.99", "status": "paid", "userId": 42 } }
```
**409 Conflict** (oversell):
```json
{ "error": "blad checkoutu", "code": 409, "details": "brak wystarczajacej ilosci dla AM1-BLU-42" }
```

---

#### `GET /checkout/orders`
Historia zamówień, opcjonalnie filtrowana po użytkowniku.

```
GET /checkout/orders?userId=42
```
```json
[
  {
    "id": 3,
    "status": "paid",
    "totalAmount": "699.99",
    "userId": 42,
    "lines": [{ "sku": "AM1-BLU-42", "price": "699.99", "quantity": 1 }]
  }
]
```

---

#### `POST /checkout/orders/:id/cancel`
Anuluje zamówienie i przywraca stan magazynowy (transakcja Sequelize).

```
POST /checkout/orders/3/cancel
```
**200 OK:**
```json
{ "message": "zamowienie anulowane, stan magazynowy przywrocony" }
```
**400 Bad Request** (już anulowane):
```json
{ "error": "blad anulowania zamowienia", "code": 400, "details": "zamowienie jest juz anulowane" }
```

---

### Gateway

#### `GET /health`
Sprawdza czy gateway działa i pokazuje adresy serwisów.

```json
{ "status": "ok", "services": { "catalog": "http://catalog_service:3001", "checkout": "http://checkout_service:3002" } }
```

---

### Format błędów

Każdy błąd w API ma jednolity format:
```json
{ "error": "opis błędu", "code": 404, "details": "szczegóły dla dewelopera" }
```

## Reguły biznesowe

- **Snapshot ceny** — zmiana cennika nie wpływa na już złożone zamówienia ani pozycje koszyka
- **Blokada oversell** — checkout zwraca 409 gdy brak wystarczającego stanu magazynowego
- **Anulowanie zamówienia** — przywraca stan magazynowy wszystkich pozycji
- **Polityka dla otwartych koszyków** — jeśli produkt zniknie z menu, pozycje pozostają w koszyku aż do ręcznego usunięcia lub zamknięcia koszyka
- **Unikalność SKU** — próba dodania duplikatu zwraca 409

## Bezpieczeństwo

### Zaimplementowane zabezpieczenia

- **Zapytania parametryzowane** — wszystkie zapytania SQL używają placeholderów (`$1`, `$2` w pg, `:param` w Sequelize) zamiast sklejania stringów. Chroni przed SQL injection.
- **Brak stack trace w odpowiedziach** — błędy zwracają tylko `{ error, code, details }` bez wewnętrznych szczegółów implementacji
- **Walidacja wejścia** — modele Sequelize i Mongoose walidują dane przed zapisem (typy, zakresy, wymagane pola)
- **Jednolity format błędów** — każdy błąd ma ten sam format `{ error, code, details }` co ułatwia obsługę po stronie klienta

### Potencjalne zagrożenia i ograniczenia

- **Brak autoryzacji i autentykacji** — API jest w pełni otwarte. W produkcji należy dodać JWT lub OAuth w warstwie Gateway
- **Brak rate limitingu** — Gateway nie ogranicza liczby żądań. W produkcji należy dodać np. `express-rate-limit`
- **Brak HTTPS** — komunikacja odbywa się po HTTP. W produkcji należy skonfigurować TLS/SSL
- **Zmienne środowiskowe** — hasła do baz danych są w plikach `.env` które są wykluczone z repozytorium przez `.gitignore`. Nigdy nie commituj pliku `.env`