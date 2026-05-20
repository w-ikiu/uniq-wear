# UniqWear — Notatki do obrony projektu

Dokument opisuje gdzie i jak każde wymaganie jest spełnione w kodzie.

---

## T1 — Sterownik pg (7%)

### Co to jest i po co?
Sterownik `pg` to natywna, niskopoziomowa biblioteka Node.js do komunikacji z PostgreSQL — bez warstwy ORM. Wymaga się jej użycia żeby pokazać, że student rozumie jak działają połączenia z bazą "od środka": pula połączeń, parametryzacja zapytań, kody błędów PostgreSQL.

### Gdzie w kodzie?

**`catalog-service/db.js`** — cały plik
- `new Pool({ connectionString })` — singleton puli połączeń. Singleton znaczy, że jedna instancja Pool jest współdzielona przez całą aplikację, nie tworzymy nowego połączenia przy każdym zapytaniu.
- `query(text, params)` — wrapper z obsługą błędów. Każde zapytanie idzie przez tę funkcję.
- `mapPgErrorToHttp(error)` — mapowanie kodów PostgreSQL na HTTP:
  - `23505` (unique violation) → `409 Conflict` — np. próba dodania SKU które już istnieje
  - `23503` (foreign key violation) → `400 Bad Request` — np. categoryId który nie istnieje
  - `42P01` (table not found) → `500` — błąd konfiguracji

**`catalog-service/app.js` linia ~21**
```js
app.get('/api/products/pg/:id', async (req, res) => {
  const result = await query('SELECT * FROM "Product" WHERE id = $1', [parseInt(req.params.id)]);
```
- `$1` — placeholder parametryzowany. Chroni przed SQL injection (nigdy nie wklejamy wartości bezpośrednio do stringa zapytania).

---

## T2 — Knex.js (7%)

### Co to jest i po co?
Knex to query builder — warstwa pośrednia między surowym SQL a ORM. Pozwala budować zapytania programistycznie (np. dynamicznie dodawać warunki WHERE) bez ryzyka SQL injection i bez pisania stringów SQL ręcznie.

### Gdzie w kodzie?

**`catalog-service/knexfile.js`** — konfiguracja połączenia dla środowiska `development`

**`catalog-service/knex-client.js`** — inicjalizacja instancji Knex (eksportowana i używana w app.js)

**`catalog-service/migrations/`** — schemat tworzony wyłącznie przez migracje:
- `20260416203557_01_create_brands.js` — pierwsza migracja addytywna: tabela `brands`
- `20260416203621_02_create_promotions.js` — druga migracja addytywna: tabela `promotions`
- "Addytywna" znaczy, że tylko dodaje coś do schematu, nic nie usuwa ani nie modyfikuje istniejących tabel.

**`catalog-service/seeds/01_init_data.js`** — seed domenowy: wstawia marki (Nike, Adidas, Jordan) i kody rabatowe. Dane domenowe = dane sensowne biznesowo, nie lorem ipsum.

**`catalog-service/app.js` linia ~43** — endpoint z dynamicznym WHERE:
```js
app.get('/products', async (req, res) => {
  const { category, minPrice, maxPrice, available } = req.query;
  const query = knex('Product')
    .select('Product.*', 'Category.name as categoryName')
    .join('Category', 'Product.categoryId', 'Category.id');

  if (category) query.where('Category.name', category);
  if (minPrice)  query.whereExists(...);  // filtr ceny minimalnej
  if (maxPrice)  query.whereExists(...);  // filtr ceny maksymalnej
  if (available === 'true') query.whereExists(...);  // filtr dostępności
```
Warunek WHERE jest dodawany programistycznie, Knex sam buduje poprawne SQL z placeholderami — nie sklejamy żadnych stringów.

**`catalog-service/start.sh`** — knex migrate i seed uruchamiają się automatycznie przy starcie kontenera:
```sh
npx knex migrate:latest
npx knex seed:run
```

---

## T3 — Sequelize v6 (7%)

### Co to jest i po co?
Sequelize to pełnoprawny ORM (Object-Relational Mapper) dla Node.js. Pozwala pracować z tabelami jak z obiektami JavaScript — zamiast pisać SQL piszemy `Order.create(...)`, `Order.findAll(...)` itd. Wymaga się go żeby pokazać umiejętność pracy z ORM: modele, walidacje, relacje, hooki, transakcje.

### Gdzie w kodzie?

**`checkout-service/models/order.js`**
- Model `Order` z walidacją `isIn: [['pending', 'paid', 'cancelled']]` — Sequelize odrzuci niepoprawny status przed zapisem do bazy
- Hook domenowy `beforeCreate`: sprawdza czy `totalAmount >= 0` — logika biznesowa wykonana automatycznie przy każdym tworzeniu zamówienia
- Relacja `Order.hasMany(OrderLine, { as: 'lines' })`
- Pole `userId` — powiązanie zamówienia z użytkownikiem

**`checkout-service/models/orderline.js`**
- Model `OrderLine` z walidacją: `price` min 0.01, `quantity` min 1
- Relacja `OrderLine.belongsTo(Order)`

**`checkout-service/models/cart.js`**
- Model `Cart` z walidacją `isIn: [['open', 'closed']]`
- Relacja `Cart.hasMany(CartLine, { as: 'lines' })`

**`checkout-service/models/cartline.js`**
- Model `CartLine` z walidacją: `price` min 0.01, `quantity` min 1

**`checkout-service/app.js`**

Transakcje zarządzane (`sequelize.transaction(async (t) => {...})`):
- `POST /checkout` linia ~16 — tworzy zamówienie + odejmuje stany w jednej transakcji. Jeśli cokolwiek zawiedzie, cała operacja jest wycofana (rollback automatyczny).
- `POST /orders/:id/cancel` linia ~93 — anulowanie + przywracanie stanów w jednej transakcji.
- `POST /api/cart/:id/items` linia ~151 — dodawanie do koszyka z blokadą `FOR UPDATE`.

Eager loading (`include`):
```js
Order.findAll({ include: [{ model: OrderLine, as: 'lines' }] })
Cart.findByPk(id, { include: [{ model: CartLine, as: 'lines' }] })
```
Eager loading = dociąganie powiązanych rekordów w jednym zapytaniu zamiast N+1 zapytań.

Blokada `FOR UPDATE` w SQL:
```js
sequelize.query(`SELECT ... FROM "Variant" WHERE sku = :sku FOR UPDATE`, ...)
```
Blokuje wiersz na czas trwania transakcji — zapobiega race condition gdy dwóch użytkowników kupuje ten sam produkt jednocześnie (oversell).

---

## T4 — Prisma (7%)

### Co to jest i po co?
Prisma to nowoczesny ORM z silnym typowaniem TypeScript/JavaScript. Wyróżnia się tym, że schemat bazy danych definiuje się w pliku `schema.prisma`, a migracje są generowane automatycznie na podstawie zmian schematu. Wymaga się jej żeby pokazać znajomość narzędzi "nowej generacji" i migracji deklaratywnych.

### Gdzie w kodzie?

**`catalog-service/prisma/schema.prisma`** — definicja 3 modeli z relacjami:
- `Category` → `Product` (jeden-do-wielu)
- `Product` → `Variant` (jeden-do-wielu)
- Pole `reviewCount Int @default(0)` — licznik zatwierdzonych recenzji (materialized field)

**`catalog-service/prisma/migrations/`** — historia migracji:
- `20260416202609_init_catalog/migration.sql` — tworzenie tabel Category, Product, Variant z kluczami obcymi i indeksami
- `20260514130000_add_review_count/migration.sql` — addytywna migracja dodająca kolumnę `reviewCount`
- Prisma śledzi historię migracji w tabeli `_prisma_migrations` — `migrate deploy` na czystej bazie odtworzy cały schemat.

**`catalog-service/start.sh`**:
```sh
npx prisma migrate deploy
```
Uruchamiane automatycznie przy starcie kontenera.

**`catalog-service/app.js`** — CRUD przez PrismaClient:
```js
// Read
prisma.product.findUnique({ where: { id }, include: { category: true, variants: true } })
// Create
prisma.product.create({ data: { name, categoryId, variants: { create: {...} } } })
// Update
prisma.product.update({ where: { id }, data: { reviewCount: { increment: 1 } } })
// Delete (kompensacja)
prisma.product.delete({ where: { id } })
```

**`catalog-service/app.js` linia ~97** — `$queryRaw` tagged template literal:
```js
const stats = await prisma.$queryRaw`
  SELECT p."categoryId", SUM(v.stock) as "totalStock"
  FROM "Variant" v JOIN "Product" p ON v."productId" = p.id
  WHERE v.stock >= ${minStock}
  GROUP BY p."categoryId"
`;
```
Tagged template = Prisma automatycznie parametryzuje `${minStock}` — bezpieczne przed SQL injection.

**`catalog-service/prisma/seed.js`** — seed domenowy przez PrismaClient: kategoria sneakers z produktem i wariantami.

---

## T5 — MongoDB native driver (6%)

### Co to jest i po co?
Natywny sterownik MongoDB (`mongodb` npm package) to najniższy poziom dostępu do bazy — bez schematu, bez ODM. Wymaga się go żeby pokazać znajomość bezpośredniej pracy z MongoDB: połączenie, operatory zapytań, indeksy.

### Gdzie w kodzie?

**`catalog-service/mongo-client.js`** — cały plik:
- Singleton `MongoClient` — `let client; if (!client) { client = new MongoClient(...); await client.connect(); }`
- Tworzenie indeksu tekstowego przy połączeniu:
  ```js
  await db.collection('productdetails').createIndex({ long_description: "text" })
  ```
  Indeks tekstowy umożliwia wyszukiwanie pełnotekstowe (`$text`).
- `getClient: () => client` — eksportuje klienta do zamknięcia przy SIGINT.

**`catalog-service/app.js` linia ~473** — zamknięcie przy SIGINT:
```js
process.on('SIGINT', async () => {
  const nativeClient = getClient();
  if (nativeClient) await nativeClient.close();
})
```
SIGINT = sygnał wysyłany przy Ctrl+C lub `docker stop`. Czyste zamknięcie zapobiega utracie danych i zwisa połączeń.

**`catalog-service/app.js`** — min. 3 różne operatory MongoDB w realnych endpointach:
1. `$text` + `$search` — wyszukiwanie pełnotekstowe po `long_description`:
   ```js
   query.$text = { $search: keyword }  // GET /api/products/details/search
   ```
2. `$gte` (greater than or equal) — filtr po specyfikacji (np. waga):
   ```js
   query['specs.weight'] = { $gte: parseInt(minWeight) }
   ```
3. `$in` — pobieranie szczegółów wielu produktów naraz:
   ```js
   db.collection('productdetails').find({ productId: { $in: ids } })  // GET /api/products/details
   ```

---

## T6 — Mongoose (6%)

### Co to jest i po co?
Mongoose to ODM (Object-Document Mapper) dla MongoDB — odpowiednik Sequelize/Prisma, ale dla bazy dokumentowej. Pozwala definiować schematy z walidacją, hookami i metodami dla dokumentów MongoDB. Wymaga się go żeby pokazać umiejętność pracy z MongoDB "z warstwą abstrakcji".

### Gdzie w kodzie?

**`catalog-service/models/Review.js`**
- Schema z polami: productId, userId, rating, title, body, status (enum: pending/approved/rejected)
- **Walidator niestandardowy nr 1** na `rating`:
  ```js
  validate: {
    validator: function(v) { return v >= 1 && v <= 5; },
    message: 'ocena musi byc w przedziale od 1 do 5'
  }
  ```
- **Pre hook** `pre('save')` — automatyczna moderacja treści przed zapisem. Sprawdza listę zakazanych słów i ustawia `status = 'rejected'` jeśli znaleziono.
- Indeksy: `{ status: 1, productId: 1 }` (złożony, pod T7) i `{ createdAt: -1 }` (pod listę ostatnich recenzji)

**`catalog-service/models/ProductDetails.js`**
- Schema: productId (unique), long_description, specs (Map), gallery (tablica subdokumentów `{url, altText}`)
- **Walidator niestandardowy nr 2** na `long_description`:
  ```js
  validate: {
    validator: function(v) { return v && v.trim().split(/\s+/).length >= 3; },
    message: 'long_description musi zawierac co najmniej 3 slowa'
  }
  ```
- **Statics** — metoda statyczna `findByProductId(pid)`: `ProductDetails.findByProductId(1)` zamiast `ProductDetails.findOne({ productId: 1 })`

**`catalog-service/models/CartDraft.js`**
- **Subdokumenty i tablice zagnieżdżone**:
  - `items: [cartItemSchema]` — tablica pozycji koszyka
  - `events: [cartEventSchema]` — historia zdarzeń (item_added, item_removed, quantity_changed, completed)
- Referencja do ProductDetails przez ObjectId (`ref: 'ProductDetails'`) — umożliwia `populate()`

**`catalog-service/app.js`** — populate w endpoincie:
```js
CartDraft.findOne({ cartId }).populate('items.productDetails')
// GET /api/cart-draft/:cartId
```
Populate = Mongoose zastępuje ObjectId pełnym dokumentem ProductDetails — zamiast `"productDetails": "664abc..."` dostajemy cały obiekt ze specyfikacją produktu.

---

## T7 — Aggregation Pipeline (6%)

### Co to jest i po co?
Aggregation Pipeline to mechanizm MongoDB do przetwarzania danych bezpośrednio w bazie — zamiast pobierać wszystkie dokumenty do Node.js i liczyć średnią w JavaScript, robimy to w MongoDB. Jest wydajniejszy dla dużych zbiorów danych.

### Gdzie w kodzie?

**`catalog-service/app.js` linia ~207** — endpoint `GET /api/analytics/ratings`:

```js
const pipeline = [
  // Stage 1: $match - filtruje tylko zatwierdzone recenzje
  // WAŻNE: pierwszy $match powinien używać indeksu — mamy indeks { status: 1, productId: 1 }
  { $match: { status: 'approved' } },

  // Stage 2: $group - grupuje po productId, liczy średnią i liczbę recenzji
  { $group: {
    _id: "$productId",
    averageRating: { $avg: "$rating" },
    reviewCount: { $sum: 1 }
  }},

  // Stage 3: $lookup - JOIN z kolekcją productdetails (pobiera opis produktu)
  { $lookup: {
    from: "productdetails",
    localField: "_id",
    foreignField: "productId",
    as: "details"
  }},

  // Stage 4 (dodatkowy): $unwind - rozpakowanie tablicy zwróconej przez $lookup
  { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },

  // Stage 5 (dodatkowy): $sort - sortowanie od najlepiej ocenianych
  { $sort: { averageRating: -1 } },

  // Stage 6: $project - formatowanie wyniku końcowego
  { $project: {
    _id: 0,
    productId: "$_id",
    averageRating: { $round: ["$averageRating", 2] },
    reviewCount: 1,
    description: "$details.long_description"
  }}
];
```

Wymogi spełnione:
- ✅ `$match` + `$group` + `$project` + dodatkowe stage'e (`$unwind`, `$sort`)
- ✅ `$lookup` (JOIN między kolekcjami)
- ✅ Pierwszy `$match` pod indeks `{ status: 1, productId: 1 }` zdefiniowany w Review.js
- ✅ Endpoint analityczny — agregacja dzieje się w bazie, nie w Node.js

---

## T8a — Konteneryzacja (4%)

### Co to jest i po co?
Docker Compose pozwala uruchomić całą infrastrukturę (bazy danych + serwisy) jedną komendą. Healthchecki zapewniają, że serwisy startują dopiero gdy bazy są gotowe. Multi-stage Dockerfile tworzy lżejszy obraz produkcyjny.

### Gdzie w kodzie?

**`docker-compose.yml`**

Healthchecki na bazach:
```yaml
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ..."]
    interval: 5s
    retries: 5

mongo:
  healthcheck:
    test: echo 'db.runCommand("ping").ok' | mongosh ...
```

`depends_on` z warunkiem `service_healthy` — serwisy startują dopiero gdy bazy są zdrowe:
```yaml
catalog-service:
  depends_on:
    postgres:
      condition: service_healthy
    mongo:
      condition: service_healthy
```

**`catalog-service/Dockerfile`** i **`checkout-service/Dockerfile`** — multi-stage:
```dockerfile
# Stage 1: builder — instaluje wszystkie zależności, generuje Prismę
FROM node:22-alpine AS builder
RUN npm install
RUN npx prisma generate

# Stage 2: produkcja — tylko zależności produkcyjne (--omit=dev)
FROM node:22-alpine
RUN npm install --omit=dev
COPY --from=builder /app ./
```
Multi-stage = obraz produkcyjny nie zawiera devDependencies → mniejszy, bezpieczniejszy.

**`.env.example`** w każdym serwisie — szablon zmiennych środowiskowych, bezpieczny do commitowania (bez prawdziwych haseł).

---

## T8b — Mikroserwisy (5%)

### Co to jest i po co?
Architektura mikroserwisów = każda odpowiedzialność to oddzielny serwis. API Gateway to pojedynczy punkt wejścia — klient nie musi wiedzieć o wewnętrznych adresach serwisów. Podział per silnik BD = każdy serwis używa ORM/narzędzia pasującego do jego potrzeb.

### Gdzie w kodzie?

**`catalog-service/`** — serwis katalogu (port 3001):
- Obsługuje: produkty, kategorie, recenzje, szczegóły produktów
- Silniki BD: Prisma (PG), Knex (PG), pg natywny, MongoDB native driver, Mongoose

**`checkout-service/`** — serwis koszyka i zamówień (port 3002):
- Obsługuje: koszyki, zamówienia, checkout
- Silniki BD: Sequelize (PG), Mongoose (Mongo)

**`gateway/app.js`** — API Gateway (port 3000):
```js
app.use('/catalog', createProxyMiddleware({ target: CATALOG_URL, pathRewrite: { '^/catalog': '' } }))
app.use('/checkout', createProxyMiddleware({ target: CHECKOUT_URL, pathRewrite: { '^/checkout': '' } }))
```
Proxy przekierowuje `/catalog/*` → catalog-service i `/checkout/*` → checkout-service, usuwając prefix z URL.

Migracje uruchamiane automatycznie przy starcie kontenerów:
- catalog-service: `npx prisma migrate deploy` + `npx knex migrate:latest` + `npx knex seed:run`
- checkout-service: `npx sequelize-cli db:migrate`

---

## T8c — Architektura hybrydowa (5%)

### Co to jest i po co?
Hybryda = jedna operacja biznesowa wymaga zapisu do dwóch różnych baz (PG i Mongo). Problem: nie możemy zrobić atomowej transakcji między dwiema bazami. Rozwiązanie: kompensacja — jeśli drugi zapis zawiedzie, cofamy pierwszy (ręczny rollback).

### Gdzie w kodzie?

**Operacja 1: Tworzenie produktu** — `catalog-service/app.js` linia ~329, `POST /api/products/hybrid`:
```
1. Zapisz produkt do PostgreSQL (Prisma) → createdProductPg
2. Zapisz szczegóły do MongoDB (Mongoose) → ProductDetails
3. JEŚLI MongoDB zawiedzie → kompensacja: usuń produkt z PG
   prisma.product.delete({ where: { id: createdProductPg.id } })
```

**Operacja 2: Zatwierdzenie recenzji** — `catalog-service/app.js` linia ~383, `PATCH /api/reviews/:id/approve`:
```
1. Zmień status recenzji na 'approved' w MongoDB (Mongoose)
2. Inkrementuj reviewCount w PostgreSQL (Prisma)
3. JEŚLI PostgreSQL zawiedzie → kompensacja: cofnij status w MongoDB
   review.status = poprzedniStatus; await review.save()
```

**Operacja 3: Checkout z zamknięciem koszyka** — `checkout-service/app.js` linia ~16, `POST /checkout`:
```
1. Transakcja PG: utwórz zamówienie + odejmij stany magazynowe
2. JEŚLI podano cartId: aktualizuj CartDraft w MongoDB
   (status: 'closed', dodaj event 'completed')
3. JEŚLI MongoDB zawiedzie → kompensacja:
   - Nowa transakcja PG: przywróć stany + ustaw status zamówienia 'cancelled'
```
MongoDB jest tu aktualizowane przez surową kolekcję przez `mongoose.connection.db`:
```js
const db = mongoose.connection.db;
await db.collection('cartdrafts').updateOne(
  { cartId: parseInt(cartId) },
  { $set: { status: 'closed' }, $push: { events: { type: 'completed', ... } } }
)
```

**Jednolity format błędów** — używany w każdym endpoincie obu serwisów:
```json
{ "error": "opis błędu", "code": 409, "details": "szczegóły techniczne" }
```

---

## Wymagania dodatkowe

### README i opis architektury (4%)
**`README.md`** zawiera:
- Instrukcja uruchomienia przez `docker compose up -d`
- Zmienne środowiskowe dla każdego serwisu
- Tabela serwisów z portami
- Opis przepływu danych (ASCII tree: co trafia do PG, co do Mongo)
- Opis operacji hybrydowych krok po kroku
- Sekcja bezpieczeństwa z zagrożeniami

### OpenAPI / kontrakt REST (4%)
**`README.md`** — sekcja "Endpointy API" zawiera dla każdego endpointu:
- Metodę HTTP i ścieżkę
- Opis działania
- Przykładowe żądanie (request body lub query params)
- Przykładową odpowiedź (success i error)
- Kody HTTP (200, 201, 400, 404, 409, 500)

### Testy automatyczne (4%)
**`catalog-service/test/api.test.js`** — testy integracyjne (supertest):
- Tworzenie produktu hybrydowego (PG + Mongo)
- Walidacja recenzji (poprawna ocena / niepoprawna → 400)
- Lista produktów z filtrem
- Agregacja ocen (T7)
- Format błędów `{ error, code, details }`

**`checkout-service/test/api.test.js`** — testy integracyjne (supertest):
- `beforeAll` — tworzy kategorię i produkt przez catalog-service (test e2e między serwisami)
- Checkout: 409 przy braku stanu, 404 przy nieistniejącym SKU
- Koszyk: tworzenie, dodawanie (409 przy braku stanu), 404 przy nieistniejącym koszyku
- Format błędów

### Bezpieczeństwo podstawowe (3%)
**`README.md`** — sekcja "Bezpieczeństwo":

Zaimplementowane:
- **SQL injection**: zapytania parametryzowane wszędzie (`$1` w pg, `:param` w Sequelize, tagged templates w Prisma, Knex query builder)
- **Brak stack trace**: błędy zwracają tylko `{ error, code, details }` — szczegóły implementacji nie wyciekają do klienta
- **Walidacja wejścia**: Sequelize waliduje przed zapisem (isIn, min/max), Mongoose waliduje przez schematy

Opisane zagrożenia:
- Brak JWT/OAuth → API otwarte (do dodania w warstwie Gateway)
- Brak rate limitingu → podatność na DDoS
- Brak HTTPS → podatność na podsłuch (do skonfigurowania TLS)

---

## Wymagania specyficzne dla projektu

### Model relacyjny PostgreSQL (13%)
Tabele i ich cel:

| Tabela | ORM | Opis |
|--------|-----|------|
| `Category` | Prisma | Kategorie produktów |
| `Product` | Prisma | Produkty z `reviewCount` (materialized field) |
| `Variant` | Prisma | SKU, cena, stock — warianty produktu (rozmiar, kolor) |
| `Cart` | Sequelize | Koszyk (open/closed) z sessionId |
| `CartLine` | Sequelize | Pozycja koszyka: SKU + snapshot ceny |
| `Order` | Sequelize | Zamówienie z `userId` i `totalAmount` |
| `OrderLine` | Sequelize | Pozycja zamówienia: SKU + snapshot ceny |

**Snapshot ceny**: przy dodaniu do koszyka i przy checkout zapisujemy `price` z wariantu w momencie operacji. Późniejsza zmiana cennika nie wpływa na istniejące zamówienia ani pozycje.

**Transakcje przy checkout** (`checkout-service/app.js`):
- `POST /checkout` — `sequelize.transaction()` + `FOR UPDATE` blokada
- `POST /orders/:id/cancel` — `sequelize.transaction()` z przywracaniem stanów

**Spójność magazynowa**: brak tabeli `inventory_movements`, zamiast tego bezpośredni `UPDATE "Variant" SET stock = stock ± quantity` wewnątrz transakcji z blokadą `FOR UPDATE`. Zapobiega race condition przy równoczesnych zamówieniach.

### Model dokumentowy MongoDB (10%)

**`ProductDetails`** (`catalog-service/models/ProductDetails.js`):
- `productId` — referencja do PostgreSQL (Number, unique)
- `long_description` — długi opis (walidator: min. 3 słowa)
- `specs` — mapa specyfikacji (`Map of String`): `{ "material": "skóra", "weight": "350" }`
- `gallery` — tablica subdokumentów `[{ url, altText }]`

**`Review`** (`catalog-service/models/Review.js`):
- `productId`, `userId`, `rating` (1-5), `title`, `body`, `status` (pending/approved/rejected)
- Indeks `{ status: 1, productId: 1 }` — pod agregację T7
- Indeks `{ createdAt: -1 }` — pod listę ostatnich recenzji

### API — katalog, koszyk, checkout (9%)

| Endpoint | Wymaganie | Jak spełnione |
|----------|-----------|---------------|
| `GET /catalog/products` | Filtr dynamiczny | Knex: `?category`, `?minPrice`, `?maxPrice`, `?available=true` |
| `POST /checkout/api/cart/:id/items` | Walidacja stanu | `FOR UPDATE` + 409 przy braku stanu |
| `POST /checkout/checkout` | Blokada oversell | `FOR UPDATE` + `if (stock < quantity) throw 409` |
| `GET /checkout/orders?userId=X` | Historia zamówień użytkownika | Sequelize `where: { userId }` |

### Reguły biznesowe (5%)

| Reguła | Gdzie |
|--------|-------|
| Snapshot ceny | `CartLine.price` i `OrderLine.price` — kopiowane z `Variant.price` przy tworzeniu |
| Anulowanie przywraca stan | `POST /orders/:id/cancel` — pętla `UPDATE Variant stock + quantity` w transakcji |
| Unikalność SKU | `Variant.sku UNIQUE` w Prisma + mapowanie `23505 → 409` w db.js |
| Konflikt koszyka przy braku stanu | `POST /api/cart/:id/items` — 409 z komunikatem ile jest dostępne |
| Jednolite kody błędów | `{ error, code, details }` — w każdym catch w obu serwisach |

### Hybryda specyficzna (3%)

**Tworzenie produktu** (`POST /catalog/api/products/hybrid`):
- Rekord w PG (Prisma: Category + Variant) + dokument w Mongo (ProductDetails)
- Kompensacja: jeśli Mongo zawiedzie → `prisma.product.delete()`

**Zatwierdzenie recenzji** (`PATCH /catalog/api/reviews/:id/approve`):
- Zmiana statusu w Mongo + inkrementacja `reviewCount` w PG
- Kompensacja: jeśli PG zawiedzie → revert statusu w Mongo

**Checkout** (`POST /checkout/checkout`):
- Zamówienie w PG + zamknięcie CartDraft w Mongo (status: closed, event: completed)
- Kompensacja: jeśli Mongo zawiedzie → anulowanie zamówienia w PG + przywracanie stanów
