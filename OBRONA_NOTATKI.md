# Notatki na obronę — UniqWear Kubernetes

> Oparte na pytaniach z poprzednich obron + dokładnej analizie kodu projektu.

---

## Wskazówki od koleżanek (co się działo na obronie)

- Obrona szła po **jednym pliku deploymentu** — otwórz `k8s/catalog-deployment.yaml` i zacznij od niego opisywać wszystko
- Egzaminator przerywa jak widzi że umiesz — nie musisz opisywać każdej linii
- Pytał o **API gateway** — co to robi, jaka jest struktura projektu
- Pytał o **`/health` vs `/ready`** — to był osobny punkt (patrz niżej)
- Pytał o **Helm** — co to jest, jakie benefity
- Pytał czy masz **workflowy CI/CD** i jakie
- Wejście do terminala niekoniecznie potrzebne — wystarczyło pokazywać pliki

---

## Struktura projektu — jak go opisać

Projekt to **mikroserwisy** bez osobnego frontendu. Architektura:

```
Internet → Ingress (nginx) → gateway (port 3000)
                                  ├── /catalog/* → catalog-service (port 3001)
                                  └── /checkout/* → checkout-service (port 3002)

catalog-service ──→ PostgreSQL (StatefulSet)
                ──→ MongoDB    (StatefulSet)
                ──→ Redis      (StatefulSet, cache)

checkout-service ─→ PostgreSQL (StatefulSet)
                 ─→ MongoDB    (StatefulSet)
```

---

## Pytania techniczne — odpowiedzi

### Ile mam podów backendu?

**5 podów aplikacyjnych + 3 bazy = 8 podów łącznie**

| Deployment/StatefulSet | Repliki | Pody |
|------------------------|---------|------|
| catalog-service | 2 | catalog-service-xxx-1, catalog-service-xxx-2 |
| checkout-service | 2 | checkout-service-xxx-1, checkout-service-xxx-2 |
| gateway | 1 | gateway-xxx-1 |
| postgres (StatefulSet) | 1 | postgres-0 |
| mongo (StatefulSet) | 1 | mongo-0 |
| redis (StatefulSet) | 1 | redis-0 |

Plik: `k8s/catalog-deployment.yaml` linia 7 — `replicas: 2`

---

### Jakie bazy mam użyte?

**Trzy bazy, każda z innym zastosowaniem:**

1. **PostgreSQL** — relacyjna, główne dane: produkty, kategorie, warianty, zamówienia, koszyki (Prisma ORM w catalog, Sequelize w checkout)
2. **MongoDB** — dokumentowa, szczegóły produktów (`productdetails`), recenzje (`reviews`), szkice koszyków (`cartdrafts`)
3. **Redis** — in-memory cache, cachuje odpowiedzi `GET /api/products` na 60 sekund

---

### Czemu PostgreSQL jako StatefulSet, a nie Deployment?

**StatefulSet daje trzy rzeczy których Deployment nie gwarantuje:**

1. **Stabilna tożsamość** — pod zawsze nazywa się `postgres-0`, nie losowy hash. Ważne przy reconnektach i replikacji
2. **Stabilny storage** — PVC jest przypisany do konkretnego poda i przeżywa restart
3. **Ordered deployment** — pody startują i kończą się w określonej kolejności (ważne przy klastrach baz)

Deployment mógłby działać przy 1 replice, ale StatefulSet jest właściwym zasobem do baz danych w Kubernetes.

---

### Czego używam żeby mieć trwałe dane oprócz StatefulSetu?

**PersistentVolumeClaim (PVC)** — plik `k8s/pvc.yaml`

Trzy osobne PVC:
```yaml
postgres-data  →  1Gi   (montowany w /var/lib/postgresql/data)
mongo-data     →  1Gi   (montowany w /data/db)
redis-data     →  256Mi (montowany w /data)
```

StatefulSet sam w sobie nie przechowuje danych — PVC to osobny zasób w klastrze, który przeżywa usunięcie poda. Dlatego `kubectl delete pod postgres-0` nie niszczy danych — Kubernetes odtworzy pod i ponownie zamontuje ten sam PVC.

---

### Do czego używam Redisa?

**Cache wyników `GET /api/products`** — żeby nie odpytywać PostgreSQL przy każdym zapytaniu.

- Klucz: `products:{parametry_zapytania}` (np. `products:{"category":"sneakers"}`)
- TTL: 60 sekund
- Nagłówek `X-Cache: HIT` lub `X-Cache: MISS` w odpowiedzi — widać czy dane przyszły z cache

Kod: `catalog-service/app.js` linia ~99-151

---

### Gdzie jest połączenie do Redisa i kod komunikacji?

**Połączenie:** `catalog-service/redis-client.js`
```js
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
```
`REDIS_URL` pochodzi z ConfigMap: `redis://redis:6379` — gdzie `redis` to nazwa Kubernetes Service.

**Kod zapisu/odczytu:** `catalog-service/app.js`
```js
// odczyt (linia ~99)
const cached = await redis.get(cacheKey);
if (cached) return res.json(JSON.parse(cached));

// zapis (linia ~150)
await redis.set(cacheKey, JSON.stringify(products), 'EX', 60);
```

---

### Co zapisuję do Redisa i gdzie?

Zapisuję **JSON z listą produktów** (wynik zapytania do PostgreSQL przez Knex) pod klucz zbudowany z parametrów URL. Tylko endpoint `GET /api/products` korzysta z cache — reszta endpointów idzie bezpośrednio do bazy.

Dowód działania:
```bash
kubectl exec -it redis-0 -n uniqwear -- redis-cli keys "products:*"
kubectl exec -it redis-0 -n uniqwear -- redis-cli ttl "products:{}"
```

---

### Jak działa Ingress i co robi?

**Ingress to reguła routingu** — sam w sobie nic nie robi, potrzebuje **Ingress Controllera** (u nas nginx).

Plik: `k8s/ingress.yaml`
```yaml
host: uniqwear.local → serwis gateway:3000
```

Przepływ:
1. Request `http://uniqwear.local/catalog/api/products` trafia do nginx Ingress Controller (osobny pod w namespace `ingress-nginx`)
2. Nginx sprawdza reguły Ingress i przekierowuje ruch do **Serwisu** `gateway` port 3000
3. Serwis `gateway` rozkłada ruch na pody gateway (load balancing)

**Ingress Controller (nginx) to osobny komponent** — instalowany przez:
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/...
```
Nie jest częścią naszego kodu.

---

### Gdzie mam proxy?

**API Gateway** — `gateway/app.js`

Używa biblioteki `http-proxy-middleware`:
```js
app.use('/catalog', createProxyMiddleware({
  target: CATALOG_URL,   // http://catalog-service:3001
  pathRewrite: { '^/catalog': '' }  // /catalog/api/products → /api/products
}));

app.use('/checkout', createProxyMiddleware({
  target: CHECKOUT_URL,  // http://checkout-service:3002
  pathRewrite: { '^/checkout': '' }
}));
```

Gateway to **reverse proxy** — przyjmuje wszystkie requesty z zewnątrz i przekazuje je do odpowiedniego mikroserwisu. Klient nie wie że rozmawiał z dwoma różnymi serwisami.

---

### Jak frontend komunikuje się z backendem?

Projekt **nie ma osobnego frontendu** — to backend-only API. Klient (np. curl, przeglądarka, aplikacja mobilna) komunikuje się przez:

```
curl http://uniqwear.local/catalog/api/products
                ↓
        Ingress (nginx)
                ↓
     Service gateway (ClusterIP)
                ↓
          Pod gateway
                ↓
  Service catalog-service (ClusterIP)
                ↓
     Pod catalog-service-xxx
```

---

### Ingress przekierowuje ruch na poda czy na serwis? Dlaczego?

**Na Serwis** — nigdy bezpośrednio na poda.

Dlaczego:
- Pody są **efemeryczne** — mogą się restartować, zmieniać IP, być usuwane podczas rolling update
- Serwis ma **stały ClusterIP** i wewnętrzny load balancer — sam pilnuje żeby zawsze znać aktualne IP podów przez endpoint slice
- Dzięki temu Ingress nie musi wiedzieć nic o podach — deleguje to do Serwisu

---

### ConfigMap i Secrety — gdzie są?

| Plik | Zawiera |
|------|---------|
| `k8s/configmap.yaml` | Niepoufne: porty, nazwy baz, adresy wewnętrznych serwisów, REDIS_URL |
| `k8s/secret.yaml` | Poufne: POSTGRES_PASSWORD, DATABASE_URL_CATALOG, DATABASE_URL_CHECKOUT, MONGO_URI (zakodowane base64) |

---

### Jak dodam coś do Secretu i żeby backend to przeczytał?

**Trzy kroki:**

1. Zakoduj wartość w base64:
   ```bash
   echo -n "nowe_haslo" | base64
   ```
2. Dodaj do `k8s/secret.yaml` i zaaplikuj:
   ```bash
   kubectl apply -f k8s/secret.yaml
   ```
3. **Zrestartuj deployment** — pody muszą się na nowo uruchomić żeby dostać nowe env vars:
   ```bash
   kubectl rollout restart deployment/catalog-service -n uniqwear
   ```

Secrety są wstrzykiwane jako **zmienne środowiskowe przy starcie kontenera** — działający pod nie widzi zmian automatycznie.

---

### Która linijka w backendzie używa Secretu?

**`k8s/catalog-deployment.yaml` linie 63–68:**
```yaml
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: uniqwear-secret
      key: DATABASE_URL_CATALOG
- name: MONGO_URI
  valueFrom:
    secretKeyRef:
      name: uniqwear-secret
      key: MONGO_URI
```

W kodzie aplikacji używane jako `process.env.DATABASE_URL` i `process.env.MONGO_URI`.

---

### Czy mam readinessProbe i livenessProbe?

**Tak — wszystkie 6 kontenerów (3 aplikacje + 3 bazy) mają oba probe'y.**

Przykład z `k8s/catalog-deployment.yaml`:
```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 90
  periodSeconds: 15
```

Bazy mają inne typy probe'y — exec zamiast httpGet:
```yaml
# postgres
exec:
  command: ["pg_isready", "-U", "uniqwear_user", "-d", "uniqwear_db"]

# redis
exec:
  command: ["redis-cli", "ping"]
```

---

### Do czego używamy readinessProbe i livenessProbe?

**readinessProbe** — "czy pod jest gotowy do przyjęcia ruchu?"
- Dopóki probe nie przejdzie, Kubernetes **nie dodaje poda do puli Serwisu**
- Używane przy starcie (aplikacja startuje, ale baza jeszcze nie gotowa) i podczas rolling update
- Jeśli readiness nie przechodzi — ruch nie trafi do tego poda (ale pod nie jest restartowany)

**livenessProbe** — "czy pod żyje?"
- Jeśli probe nie przechodzi — Kubernetes **restartuje kontener**
- Chroni przed zamrożonym procesem, infinite loop, memory leak
- Ma wyższe `initialDelaySeconds` niż readiness — dajemy aplikacji czas na start zanim zaczniemy sprawdzać żywotność

---

### To są Kubernetesowe endpointy czy my je implementujemy?

**My implementujemy** — Kubernetes tylko wywołuje zdefiniowany URL.

Endpoint `/health` jest w kodzie aplikacji:
- `catalog-service/app.js` linia 50 — sprawdza połączenie z PostgreSQL i MongoDB
- `checkout-service/app.js` linia 42 — sprawdza PostgreSQL (Sequelize) i MongoDB
- `gateway/app.js` linia 59 — zwraca status gateway i adresy serwisów

```js
// catalog-service/app.js
app.get('/health', async (req, res) => {
  const health = { status: 'ok', postgres: 'ok', mongo: 'ok' };
  try { await prisma.$queryRaw`SELECT 1`; } 
  catch { health.postgres = 'error'; health.status = 'degraded'; }
  // ...
  res.status(statusCode).json(health);
});
```

---

### /health vs /ready — czym się różnią?

W tym projekcie jest tylko `/health`, który pełni obie role (readiness i liveness wskazują na ten sam endpoint). Różnica koncepcyjna:

| | `/health` (liveness) | `/ready` (readiness) |
|--|---|---|
| Pytanie | Czy aplikacja żyje? | Czy aplikacja jest gotowa na ruch? |
| Gdy nie przechodzi | Kubernetes restartuje pod | Kubernetes usuwa pod z puli serwisu |
| Typowo sprawdza | Czy proces odpowiada | Połączenia z bazami, cache, zależności |

W projekcie `/health` sprawdza oba — połączenie z PostgreSQL i MongoDB. Jeśli baza jest niedostępna, zwraca `503 degraded`.

---

### SecurityContext i initContainer

**SecurityContext** — każdy kontener aplikacyjny ma:
```yaml
securityContext:
  runAsNonRoot: true        # zakaz uruchamiania jako root
  runAsUser: 1000           # UID procesu (lub 999 dla mongo/redis)
  allowPrivilegeEscalation: false  # zakaz zdobywania uprawnień roota
```

Zasada minimalnych uprawnień — nawet jeśli ktoś przejmie kontener, nie jest rootem.

**initContainer** — w `catalog-deployment.yaml` i `checkout-deployment.yaml`:

```yaml
initContainers:
- name: migrate
  command: ["sh", "-c"]
  args:
  - |
    # 1. czeka na PostgreSQL (TCP check w pętli)
    node -e "... net.createConnection(5432, 'postgres') ..."
    # 2. uruchamia migracje
    npx prisma migrate deploy
    npx knex migrate:latest
    npx knex seed:run
```

Uruchamia się **przed głównym kontenerem** — gwarantuje że baza jest gotowa i migracje wykonane zanim aplikacja zacznie przyjmować ruch.

---

### Co to jest GHCR?

**GitHub Container Registry** — rejestr obrazów Docker hostowany przez GitHub, dostępny pod `ghcr.io`.

Nasz projekt publikuje obrazy do:
- `ghcr.io/w-ikiu/uniqwear-catalog:latest`
- `ghcr.io/w-ikiu/uniqwear-checkout:latest`
- `ghcr.io/w-ikiu/uniqwear-gateway:latest`

Uwierzytelnienie w CI przez `secrets.GITHUB_TOKEN` — automatyczny token generowany przez GitHub Actions.

Alternatywy: Docker Hub (`docker.io`), AWS ECR, Google Artifact Registry.

---

### Co robi Helm i jakie są benefity?

**Helm to package manager dla Kubernetes** — jak npm dla Node.js albo apt dla Ubuntu.

Pozwala:
1. **Parametryzować manifesty** — zamiast kopiować 10 plików YAML dla każdego środowiska, masz jeden szablon z wartościami (`values.yaml`)
2. **Wersjonować całą aplikację** — `helm install`, `helm upgrade`, `helm rollback`
3. **Bundlować zależności** — jeden `helm install` postawia całą aplikację z bazami danych

My używamy **Kustomize** (lżejsza alternatywa, wbudowana w kubectl) z dwoma overlayami:
- `k8s/overlays/dev/` — 1 replika, prefix `dev-`
- `k8s/overlays/prod/` — 3 repliki

```bash
kubectl apply -k k8s/overlays/prod/   # wdróż środowisko prod
kubectl apply -k k8s/overlays/dev/    # wdróż środowisko dev
```

---

### Jakie mam workflowy CI/CD?

Plik `.github/workflows/ci.yml` — trzy joby:

| Job | Trigger | Co robi |
|-----|---------|---------|
| `test` | push + PR na main | Instaluje deps, uruchamia migracje, startuje serwery, `npm test` |
| `build-and-push` | tylko push na main | Buduje 3 obrazy Docker, pushuje do GHCR z tagiem SHA i `latest` |
| `deploy` | tylko push na main (po test + build) | Tworzy klaster kind, ładuje obrazy, wdraża przez `kubectl apply -k overlays/prod/`, sprawdza rollout status |

Weryfikacja po deploymencie:
```bash
kubectl rollout status deployment/catalog-service -n uniqwear --timeout=300s
```

---

## Szybka ściąga — komendy do pokazania

```bash
# status wszystkiego
kubectl get all -n uniqwear

# repliki i strategia update
kubectl get deploy -n uniqwear

# szczegóły poda (probes, events, resources)
kubectl describe pod -l app=catalog-service -n uniqwear

# PVC - trwałe dane
kubectl get pvc -n uniqwear

# ingress
kubectl get ingress -n uniqwear

# sprawdzenie cache redis
kubectl exec -it redis-0 -n uniqwear -- redis-cli keys "products:*"

# port-forward (jeśli nie ma ingress-nginx)
kubectl port-forward service/gateway 3000:3000 -n uniqwear

# test /health
curl http://localhost:3000/health

# test cache (X-Cache: MISS → HIT)
curl -i http://localhost:3000/catalog/api/products
curl -i http://localhost:3000/catalog/api/products
```

---

## Na co się nastawić

1. **Zacznij od `k8s/catalog-deployment.yaml`** — opisz z góry na dół: repliki, strategia, initContainer, envFrom, probes, resources, securityContext
2. **Miej otwarte równolegle `gateway/app.js`** — jak padnie pytanie o proxy/routing, od razu możesz pokazać kod
3. **`/health` endpoint** — pokaż `catalog-service/app.js` linia 50, powiedz że sprawdza połączenia z bazami
4. **Kustomize** — pokaż `k8s/overlays/prod/kustomization.yaml`, powiedz że dev ma 1 replikę a prod 3
5. **Redis** — pokaż `redis-client.js` i kawałek `app.js` z `redis.get`/`redis.set`
