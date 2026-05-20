# Architektura UniqWear — notatki do obrony

---

## Widok z lotu ptaka

```
                        KLIENT (Postman / przeglądarka)
                                    |
                                    | HTTP
                                    ▼
                            ┌───────────────┐
                            │    GATEWAY    │  port 3000
                            │   (Express)   │
                            └───────┬───────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
          ┌─────────────────┐             ┌──────────────────┐
          │ catalog-service │  port 3001  │ checkout-service │  port 3002
          │    (Express)    │             │    (Express)     │
          └────────┬────────┘             └────────┬─────────┘
                   │                               │
        ┌──────────┼──────────┐                    │
        │          │          │              ┌─────┴──────┐
        ▼          ▼          ▼              ▼            ▼
   PostgreSQL   MongoDB    MongoDB       PostgreSQL    MongoDB
    (Prisma     (native    (Mongoose      (Sequelize   (Mongoose
     + Knex      driver)   – Reviews,     – Orders,    – CartDraft,
     + pg)                  CartDraft)     Carts)       Reviews)
```

---

## Trzy warstwy systemu

### Warstwa 1 — Gateway (brama wejściowa)

Plik: [gateway/app.js](gateway/app.js)

Klient nigdy nie rozmawia bezpośrednio z serwisami. Każde żądanie trafia najpierw do gateway, który przekierowuje ruch:

```
/catalog/*  →  catalog-service:3001
/checkout/* →  checkout-service:3002
```

Przykład: klient wysyła `GET /catalog/api/products` → gateway usuwa prefix `/catalog` i wysyła `GET /api/products` do catalog-service.

**Po co gateway?**
- jeden punkt wejścia — klient zna tylko jeden adres (port 3000)
- można dodać autentykację, rate limiting w jednym miejscu
- serwisy mogą zmieniać porty bez wiedzy klienta

---

### Warstwa 2 — Serwisy (logika biznesowa)

#### catalog-service

Odpowiada za: produkty, kategorie, recenzje, szczegóły produktów, statystyki, szkice koszyków.

Używa **czterech** różnych sposobów dostępu do baz danych (każdy to osobne wymaganie na zaliczenie):

| Technologia | Do czego | Plik |
|---|---|---|
| pg (natywny) | surowe zapytania SQL z $1,$2 | `db.js` |
| Knex | dynamiczne filtry, migracje addytywne | `knex-client.js` |
| Prisma | CRUD produktów, $queryRaw | `app.js` (prisma) |
| MongoDB native | szukanie po tekście, $gte, $in | `mongo-client.js` |
| Mongoose | recenzje, szkice koszyków, walidacja | `models/` |

#### checkout-service

Odpowiada za: zamówienia, koszyki (PostgreSQL), szkice koszyków w MongoDB.

| Technologia | Do czego | Plik |
|---|---|---|
| Sequelize | zamówienia, koszyki, transakcje | `models/` |
| Mongoose | szkice koszyków (CartDraft), recenzje | `models/review.js` |

---

### Warstwa 3 — Bazy danych

System używa **dwóch silników baz danych**, każdy do innych celów:

#### PostgreSQL — dane transakcyjne (pewne, niezmienne, powiązane)

```
Product ──── Variant      Order ──── OrderLine
   │                        │
Category                  Cart ──── CartLine
```

- produkty, warianty, zamówienia, koszyki
- dane które muszą być spójne (nie możemy sprzedać więcej niż mamy w stanie)
- relacje przez klucze obce
- transakcje z blokadą `FOR UPDATE` (ochrona przed oversell)

#### MongoDB — dane dokumentowe (elastyczne, denormalizowane)

```
productdetails    reviews    cartdrafts
{ productId,      { rating,  { cartId,
  gallery[],        body,      items[],
  specs{} }         status }   events[] }
```

- szczegóły produktów (galeria, specyfikacje — różne dla każdego produktu)
- recenzje (różna struktura dla różnych typów recenzji)
- historia zdarzeń koszyka (tablica zagnieżdżona, rośnie w czasie)
- dane które nie muszą mieć stałego schematu lub zawierają tablice

---

## Jak działa zamówienie — przepływ danych

```
1. POST /catalog/api/cart-draft
   → catalog-service zapisuje szkic koszyka w MongoDB (CartDraft)
   → status: 'open', events: [{type:'item_added'}]

2. POST /checkout/api/cart
   → checkout-service tworzy koszyk w PostgreSQL (Cart)

3. POST /checkout/api/cart/:id/items
   → checkout-service dodaje pozycje do Cart w PostgreSQL
   → blokada FOR UPDATE na Variant — sprawdza stan magazynowy

4. POST /checkout/api/checkout  { items, userId, cartId }
   → TRANSAKCJA PostgreSQL (Sequelize):
      a. blokada FOR UPDATE na każdy Variant
      b. sprawdzenie stanu (409 jeśli brak)
      c. odjęcie stanu: stock = stock - quantity
      d. utworzenie Order z totalAmount
      e. zapisanie OrderLines (snapshot ceny)
   → po transakcji: aktualizacja CartDraft w MongoDB
      { status: 'closed', events: [{type:'completed'}] }
   → jeśli MongoDB zawiedzie: KOMPENSACJA
      (przywrócenie stanu + Order.status = 'cancelled')

5. GET /checkout/api/orders?userId=X
   → historia zamówień z eager loading (OrderLines dołączone przez include)
```

---

## Dlaczego dwie bazy, nie jedna?

### PostgreSQL dla transakcji

Zamówienie musi być atomowe — albo wszystko się udaje (stan odjęty + zamówienie zapisane + linie zapisane), albo nic. MongoDB nie obsługuje wielodokumentowych transakcji tak niezawodnie jak Postgres.

Przykład z kodu — `sequelize.transaction()` w [checkout-service/app.js:24](checkout-service/app.js#L24):
```js
const result = await sequelize.transaction(async (t) => {
  // blokada FOR UPDATE - nikt inny nie może zmienić tego wiersza
  const [variants] = await sequelize.query(
    `SELECT id, price, stock FROM "Variant" WHERE sku = :sku FOR UPDATE`,
    { transaction: t }
  );
  // ... odjęcie stanu, stworzenie zamówienia — wszystko w jednej transakcji
});
```

Bez transakcji i `FOR UPDATE`: dwie osoby kupują ostatnią parę butów jednocześnie → obie dostaną potwierdzenie → stan spada do -1 (oversell).

### MongoDB dla dokumentów niejednorodnych

Specyfikacje produktu różnią się w zależności od kategorii — but ma rozmiar i kolor, kurtka ma gramaturę i wodoodporność, czapka ma obwód głowy. W PostgreSQL musiałabyś mieć osobne tabele lub kolumnę JSON. W MongoDB naturalnie przechowujesz to jako `specs: { rozmiar: '42', kolor: 'czarny' }`.

Historia zdarzeń koszyka (tablica `events[]`) naturalnie rośnie — każde dodanie produktu to nowy element tablicy w tym samym dokumencie, bez osobnych tabel i JOIN-ów.

---

## Wzorce architektoniczne w projekcie

### Singleton (T1, T5)

Jedno połączenie z bazą współdzielone przez cały serwis, nie tworzone na nowo przy każdym żądaniu.

```js
// catalog-service/db.js
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// ta sama instancja pool używana przy każdym zapytaniu
```

```js
// catalog-service/mongo-client.js
let client;  // raz stworzony, nigdy ponownie
async function connectToMongo() {
  if (!client) { client = new MongoClient(...); await client.connect(); }
  return db;
}
```

**Dlaczego?** Tworzenie połączenia z bazą danych to kosztowna operacja (handshake TCP, autentykacja). Przy 100 żądaniach/sekundę tworzenie 100 połączeń zamiast jednego = katastrofa wydajnościowa.

### Snapshot ceny (T3)

Cena jest kopiowana do `OrderLine` i `CartLine` w momencie dodania do koszyka / zamówienia. `OrderLine` nie ma klucza obcego do `Variant.price`.

```js
// checkout-service/app.js
const linePrice = parseFloat(variant.price);  // kopiujemy wartość
orderLinesData.push({
  sku: item.sku,
  price: linePrice,  // zapisujemy kopię, nie referencję
  quantity: item.quantity
});
```

**Dlaczego?** Jeśli sklep zmieni cenę butów jutro, zamówienia złożone dziś muszą zachować cenę z momentu zakupu. Bez snapshotu historyczne zamówienia pokazywałyby aktualną (błędną) cenę.

### Kompensacja zamiast transakcji rozproszonych (T8c)

System łączy dwa silniki baz danych (PG + MongoDB) bez koordynatora transakcji. Zamiast tego używa wzorca kompensacji: jeśli drugi zapis zawiedzie, cofamy pierwszy.

```
catalog-service/app.js — POST /api/products/hybrid:
  1. Prisma: utwórz Product w PostgreSQL  ✓
  2. Mongoose: zapisz ProductDetails w MongoDB
     → jeśli błąd: Prisma: usuń Product z PostgreSQL  ← kompensacja

checkout-service/app.js — POST /api/checkout:
  1. Sequelize: transakcja (odjęcie stanu + Order)  ✓
  2. MongoDB: zamknij CartDraft
     → jeśli błąd: przywróć stan + Order.status = 'cancelled'  ← kompensacja
```

**Dlaczego nie transakcja rozproszona (2PC)?** Wymaga koordynatora (np. XA), jest skomplikowana, wolna i podatna na deadlocki. Kompensacja jest prosta, czytelna i wystarczająca dla tego przypadku.

### Migracje jako historia schematu (T2, T3, T4)

Każda zmiana struktury bazy danych to osobny plik z timestampem. Nigdy nie edytujemy starych migracji.

```
Sequelize (checkout):
20260419103733-create-order.js       ← tworzy tabelę Orders
20260419103745-create-order-line.js  ← tworzy tabelę OrderLines
20260514120002-add-userid-to-order.js ← dodaje kolumnę userId

Prisma (catalog):
20260416202609_init_catalog/         ← tworzy Category, Product, Variant
20260514130000_add_review_count/     ← dodaje kolumnę reviewCount

Knex (catalog):
20260416203557_01_create_brands.js   ← tworzy tabelę brands
20260416203621_02_create_promotions.js ← tworzy tabelę promotions
```

**Dlaczego?** Na czystej bazie (np. nowy serwer) wystarczy uruchomić wszystkie migracje po kolei — baza buduje się do aktualnego stanu. Każdy developer w zespole ma tę samą strukturę. Historia zmian schematu jest widoczna w git.

---

## Dlaczego ta architektura jest dobrym wyborem?

### 1. Każde narzędzie do właściwego zadania

Projekt nie używa jednej technologii do wszystkiego. Każde wymaganie jest obsłużone przez technologię, która do niego pasuje:
- transakcje i spójność → PostgreSQL
- elastyczne dokumenty i wyszukiwanie pełnotekstowe → MongoDB
- dynamiczne zapytania bez SQL injection → Knex
- typowany dostęp do bazy z migracjami → Prisma
- walidacja i hooki na poziomie modelu → Mongoose/Sequelize

### 2. Izolacja serwisów

catalog-service i checkout-service nie wiedzą o swoim istnieniu — komunikują się tylko przez HTTP (przez gateway). Można zatrzymać jeden serwis, drugi dalej działa. Można zmieniać wewnętrzną implementację jednego bez wpływu na drugi.

### 3. Automatyczne uruchamianie

`docker compose up` uruchamia cały system bez żadnych ręcznych kroków:
- bazy danych startują z healthcheckami
- serwisy czekają (`depends_on: service_healthy`) aż bazy będą gotowe
- `start.sh` uruchamia migracje automatycznie przy starcie kontenera
- seedy wypełniają bazę danymi domenowymi

### 4. Ochrona przed błędami współbieżności

`FOR UPDATE` w SQL blokuje wiersz na czas transakcji — dwie osoby nie mogą kupić tej samej ostatniej pary butów jednocześnie. Bez tego: race condition → oversell → klient płaci za towar który nie istnieje.

---

## Szybka mapa — co gdzie szukać

| Chcę zobaczyć... | Plik |
|---|---|
| routing gateway | `gateway/app.js` |
| listę produktów z filtrami | `catalog-service/app.js` → `GET /api/products` |
| logikę zamówienia | `checkout-service/app.js` → `POST /api/checkout` |
| ochronę przed oversell | `checkout-service/app.js:29` — `FOR UPDATE` |
| kompensację | `checkout-service/app.js:80` i `catalog-service/app.js:380` |
| transakcje Sequelize | `checkout-service/app.js` — każde `sequelize.transaction(...)` |
| agregację MongoDB | `catalog-service/app.js` → `GET /api/analytics/ratings` |
| modele Mongoose | `catalog-service/models/` i `checkout-service/models/review.js` |
| migracje Sequelize | `checkout-service/migrations/` |
| migracje Prisma | `catalog-service/prisma/migrations/` |
| migracje Knex | `catalog-service/migrations/` |
| seedy Knex | `catalog-service/seeds/` |
| singleton pg | `catalog-service/db.js` |
| singleton MongoDB native | `catalog-service/mongo-client.js` |