# UniqWear

Backend e-commerce clothing store built on microservices architecture, deployed on Kubernetes.

---

## EN

### About

UniqWear is a backend e-commerce project demonstrating microservices architecture with multiple database access technologies, containerization, and Kubernetes deployment with CI/CD.

### Architecture

```
Client
  |
API Gateway (port 3000)
  |-- /catalog/*   --> catalog-service (port 3001)
  |-- /checkout/*  --> checkout-service (port 3002)
```

- **catalog-service** - products, categories, reviews, full-text search, statistics
- **checkout-service** - carts, orders, inventory management
- **API Gateway** - single entry point, proxies requests to backend services

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, Express.js |
| Relational DB | PostgreSQL 15 |
| Document DB | MongoDB 7 |
| Cache | Redis 7 |
| ORMs and drivers | Prisma, Sequelize, Knex, Mongoose, pg native, MongoDB native driver |
| Containerization | Docker, Docker Compose |
| Orchestration | Kubernetes (kind) |
| CI/CD | GitHub Actions |
| Tests | Jest |

### Databases

**PostgreSQL** stores transactional data: products, variants, categories, orders, carts. Orders are executed as atomic transactions with `FOR UPDATE` locking to prevent overselling.

**MongoDB** stores document data: product details (gallery, specs), reviews with moderation history, cart drafts.

**Redis** serves as a cache for product listings in catalog-service.

The project demonstrates a compensation pattern for operations spanning both databases (e.g. product creation or review approval).

### Kubernetes

All manifests in `k8s/base/`:
- Namespace, ConfigMap, Secret, PVC
- StatefulSets for PostgreSQL, MongoDB, Redis
- Deployments for all three services
- CronJob for review stats worker (every 5 minutes)
- Ingress, NetworkPolicy, PodDisruptionBudget

Kustomize parameterizes two environments: `dev` (1 replica) and `prod` (multiple replicas).

### CI/CD

GitHub Actions pipeline:
1. Unit tests against real databases (PostgreSQL and MongoDB as GitHub Actions services)
2. Docker image build and push to GitHub Container Registry
3. Deployment to kind cluster via `kubectl apply -k`

### Running locally

**Docker Compose:**
```bash
git clone <url>
cp catalog-service/.env.example catalog-service/.env
cp checkout-service/.env.example checkout-service/.env
cp gateway/.env.example gateway/.env
docker-compose up -d
```

Database migrations run automatically on startup.

**Review stats worker (one-off run):**
```bash
docker-compose up -d mongo
MONGO_URI="mongodb://localhost:27017/uniqwear_mongo" node catalog-service/worker.js
```

---

## PL

### O projekcie

UniqWear to backendowy projekt e-commerce demonstrujący architekture mikroserwisow z wieloma technologiami dostepu do baz danych, konteneryzacje oraz wdrozenie na Kubernetes z CI/CD.

### Architektura

```
Klient
  |
API Gateway (port 3000)
  |-- /catalog/*   --> catalog-service (port 3001)
  |-- /checkout/*  --> checkout-service (port 3002)
```

- **catalog-service** - produkty, kategorie, recenzje, wyszukiwanie pelnotekstowe, statystyki
- **checkout-service** - koszyki, zamowienia, stany magazynowe
- **API Gateway** - jeden punkt wejscia, proxy do serwisow backendowych

### Technologie

| Warstwa | Technologia |
|---|---|
| Runtime | Node.js 22, Express.js |
| Baza relacyjna | PostgreSQL 15 |
| Baza dokumentowa | MongoDB 7 |
| Cache | Redis 7 |
| ORMy i drivery | Prisma, Sequelize, Knex, Mongoose, pg native, MongoDB native driver |
| Konteneryzacja | Docker, Docker Compose |
| Orkiestracja | Kubernetes (kind) |
| CI/CD | GitHub Actions |
| Testy | Jest |

### Bazy danych

**PostgreSQL** przechowuje dane transakcyjne: produkty, warianty, kategorie, zamowienia, koszyki. Zamowienia sa realizowane jako transakcje atomowe z blokada `FOR UPDATE`, ktora zapobiega oversell.

**MongoDB** przechowuje dane dokumentowe: szczegoly produktow (galeria, specyfikacje), recenzje z historia moderacji, szkice koszykow.

**Redis** sluzy jako cache dla listy produktow w catalog-service.

Projekt pokazuje wzorzec kompensacji przy operacjach obejmujacych obie bazy (np. tworzenie produktu lub zatwierdzanie recenzji).

### Kubernetes

Wszystkie manifesty w katalogu `k8s/base/`:
- Namespace, ConfigMap, Secret, PVC
- StatefulSety dla PostgreSQL, MongoDB, Redis
- Deploymenty dla trzech serwisow
- CronJob dla workera statystyk recenzji (co 5 minut)
- Ingress, NetworkPolicy, PodDisruptionBudget

Kustomize parametryzuje dwa srodowiska: `dev` (1 replika) i `prod` (wiele replik).

### CI/CD

Pipeline GitHub Actions:
1. Testy jednostkowe z prawdziwymi bazami danych (PostgreSQL i MongoDB jako serwisy GitHub Actions)
2. Budowanie obrazow Docker i push do GitHub Container Registry
3. Wdrozenie na klaster kind przez `kubectl apply -k`

### Uruchomienie lokalne

**Docker Compose:**
```bash
git clone <url>
cp catalog-service/.env.example catalog-service/.env
cp checkout-service/.env.example checkout-service/.env
cp gateway/.env.example gateway/.env
docker-compose up -d
```

Migracje baz danych uruchamiaja sie automatycznie przy starcie.

**Worker recenzji (jednorazowe uruchomienie):**
```bash
docker-compose up -d mongo
MONGO_URI="mongodb://localhost:27017/uniqwear_mongo" node catalog-service/worker.js
```
