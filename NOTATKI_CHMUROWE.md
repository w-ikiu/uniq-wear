# Notatki — Technologie Chmurowe (Kubernetes)

---

## Wymagania architektoniczne (80%)

---

### Manifesty Kubernetes — 12%

**Co oznacza:**
Projekt musi mieć katalog `k8s/` lub Helm/Kustomize zawierający minimum: Namespace, Deployment, StatefulSet dla bazy, Service, Ingress, ConfigMap, Secret, PVC.

**Jak to zrobiliśmy:**
- `k8s/namespace.yaml` — **Namespace** `uniqwear`: wirtualna przestrzeń nazw w klastrze; wszystkie nasze zasoby żyją wewnątrz niej, odizolowane od innych projektów na tym samym klastrze
- `k8s/configmap.yaml` — **ConfigMap** `uniqwear-config`: słownik klucz→wartość z niepoufną konfiguracją (adresy URL serwisów, nazwy baz, porty); wstrzykiwany do kontenerów jako zmienne środowiskowe — zmiana konfiguracji bez przebudowania obrazu Docker
- `k8s/secret.yaml` — **Secret** `uniqwear-secret`: jak ConfigMap, ale dla danych wrażliwych (hasła, connection stringi); wartości zakodowane base64, Kubernetes traktuje je inaczej — można ograniczyć dostęp przez RBAC i nie są logowane
- `k8s/postgres-statefulset.yaml` — **StatefulSet** dla PostgreSQL: typ workloadu dla aplikacji stanowych (bazy danych); w odróżnieniu od Deployment każdy pod ma stałą nazwę (`postgres-0`) i własny PVC — dane nie znikają po restarcie, kolejność uruchamiania jest deterministyczna
- `k8s/mongo-statefulset.yaml` — **StatefulSet** dla MongoDB z volumeClaimTemplates (PVC 1Gi); ten sam powód co PostgreSQL — MongoDB musi pamiętać swoje dane między restartami
- `k8s/redis-statefulset.yaml` — **StatefulSet** dla Redis z volumeClaimTemplates (PVC 256Mi) + Service w tym samym pliku
- `k8s/services.yaml` — **Service**: stały adres DNS i IP wewnątrz klastra dla grupy podów; pody umierają i rodzą się z nowymi IP, Service zawsze wskazuje na żywe pody przez selektor labelek — bez tego serwisy nie mogłyby się wzajemnie odnaleźć
- `k8s/catalog-deployment.yaml` — **Deployment** dla catalog-service: zarządza bezstanowymi podami aplikacji; pilnuje żeby zawsze działała zadana liczba replik, obsługuje rolling update i rollback
- `k8s/checkout-deployment.yaml` — **Deployment** dla checkout-service (j.w.)
- `k8s/gateway-deployment.yaml` — **Deployment** dla gateway (j.w.)
- `k8s/ingress.yaml` — **Ingress** `uniqwear-ingress`: reguły routingu ruchu HTTP/HTTPS z zewnątrz klastra do serwisów wewnętrznych; działa jak odwrotny proxy — jeden punkt wejścia zamiast eksponowania każdego serwisu osobno; obsługuje też TLS termination
- `k8s/base/kustomization.yaml` + `k8s/overlays/dev/` + `k8s/overlays/prod/` — Kustomize

**Dlaczego tak:**
Każdy zasób jest w osobnym pliku — łatwo go wskazać podczas obrony. PVC tworzone są automatycznie przez `volumeClaimTemplates` w StatefulSet, nie wymagają osobnego pliku. Mamy zarówno katalog `k8s/` z płaskimi manifestami jak i Kustomize na wierzchu.

---

### Deploymenty i rolling update — 10%

**Co oznacza:**
API/backend działa jako Deployment z minimum 2 replikami i strategią RollingUpdate. Sprawdzenie: `kubectl get deploy` i `kubectl rollout status`.

**Jak to zrobiliśmy:**
- `catalog-service`: `replicas: 2`, `strategy: RollingUpdate` (maxUnavailable: 1, maxSurge: 1)
- `checkout-service`: `replicas: 2`, `strategy: RollingUpdate` (maxUnavailable: 1, maxSurge: 1)
- `gateway`: `replicas: 1`, `strategy: RollingUpdate` (maxUnavailable: 0, maxSurge: 1 — zero downtime, gateway nigdy nie pada)
- CI/CD workflow sprawdza `kubectl rollout status` dla wszystkich trzech deploymentów po każdym deploy

**Dlaczego tak:**
2 repliki backendu zapewniają dostępność podczas aktualizacji — jedna replika obsługuje ruch, druga się aktualizuje. maxUnavailable: 0 dla gateway gwarantuje że jedyny punkt wejścia nigdy nie pada podczas rolling update.

---

### Baza danych i trwałość — 12%

**Co oznacza:**
Baza musi działać jako StatefulSet z PersistentVolumeClaim. Dane muszą przeżywać restart poda.

**Jak to zrobiliśmy:**
- `k8s/pvc.yaml` — trzy osobne obiekty `kind: PersistentVolumeClaim`: `postgres-data` (1Gi), `mongo-data` (1Gi), `redis-data` (256Mi), wszystkie ReadWriteOnce
- `postgres-statefulset.yaml` — StatefulSet `postgres` montuje PVC `postgres-data` przez `volumes.persistentVolumeClaim.claimName`
- `mongo-statefulset.yaml` — StatefulSet `mongo` montuje PVC `mongo-data` analogicznie
- `redis-statefulset.yaml` — StatefulSet `redis` montuje PVC `redis-data` analogicznie
- W postgres ustawiono `PGDATA=/var/lib/postgresql/data/pgdata` — podkatalog zapobiega błędowi "lost+found" przy pierwszym montowaniu PVC

Weryfikacja że PVC istnieją i mają status Bound:
```bash
kubectl get pvc -n uniqwear
# NAME            STATUS   CAPACITY
# postgres-data   Bound    1Gi
# mongo-data      Bound    1Gi
# redis-data      Bound    256Mi
```

**Dlaczego tak:**
StatefulSet (nie Deployment) gwarantuje stabilną tożsamość poda. Każda baza ma własny `kind: PersistentVolumeClaim` w `pvc.yaml` — PVC jest niezależny od cyklu życia poda, więc przy restarcie poda dane zostają. StatefulSet montuje ten sam PVC przez `claimName` — dane nie znikają.

---

### Services, Ingress i izolacja — 10%

**Co oznacza:**
Komunikacja wewnętrzna przez Service. Ruch zewnętrzny przez Ingress. Bazy i cache niedostępne z zewnątrz klastra.

**Jak to zrobiliśmy:**
- Bazy (`postgres`, `mongo`, `redis`) mają `clusterIP: None` (headless) — brak zewnętrznego IP, dostępne tylko wewnątrz klastra po nazwie DNS
- Serwisy aplikacji (`catalog-service`, `checkout-service`, `gateway`) mają ClusterIP — wewnętrzne, bez NodePort
- `ingress.yaml` — jedyny punkt wejścia z zewnątrz, kieruje cały ruch na host `uniqwear.local` do `gateway:3000`
- `networkpolicy.yaml` — dodatkowo blokuje ruch na poziomie sieci (patrz sekcja bonusów)

**Dlaczego tak:**
Headless service dla StatefulSet to konwencja Kubernetes. ClusterIP bez NodePort = brak dostępu z zewnątrz nawet bez NetworkPolicy. Ingress jako jedyny punkt wejścia = łatwiejsze TLS i routing w przyszłości.

---

### ConfigMap i Secret — 8%

**Co oznacza:**
Konfiguracja niepoufna w ConfigMap, dane poufne w Secret. Żadnych jawnych haseł w kodzie ani README.

**Jak to zrobiliśmy:**
- `k8s/configmap.yaml` — niepoufne: POSTGRES_USER, POSTGRES_DB, porty, CATALOG_URL, CHECKOUT_URL, REDIS_URL
- `k8s/secret.yaml` — poufne (zakodowane base64): POSTGRES_PASSWORD, DATABASE_URL_CATALOG, DATABASE_URL_CHECKOUT, MONGO_URI
- W deploymentach env zmienne wstrzykiwane przez `configMapKeyRef` i `secretKeyRef` — żadnego hardkodowania w kodzie aplikacji
- Dwa osobne klucze DATABASE_URL: `DATABASE_URL_CATALOG` (z `?schema=public` dla Prisma) i `DATABASE_URL_CHECKOUT` (bez, dla Sequelize) — oba mapowane na nazwę `DATABASE_URL` wewnątrz kontenera

**Dlaczego tak:**
Secret jest oznaczony jako poufny w API Kubernetes i można go ograniczyć przez RBAC. Komentarz w pliku zaznacza że to dane deweloperskie, nie produkcyjne — spełnia wymóg "nie zapisane jawnie".

---

### Probes i zasoby — 10%

**Co oznacza:**
Każdy główny kontener musi mieć readinessProbe, livenessProbe oraz resources.requests i resources.limits.

**Jak to zrobiliśmy:**

Kontenery aplikacyjne (catalog, checkout, gateway):
- `readinessProbe` httpGet na `/health`: initialDelaySeconds: 30, periodSeconds: 10, failureThreshold: 5
- `livenessProbe` httpGet na `/health`: initialDelaySeconds: 90, periodSeconds: 15, failureThreshold: 3
- resources catalog/checkout: requests 256Mi/100m, limits 512Mi/500m
- resources gateway: requests 64Mi/50m, limits 128Mi/200m

Bazy danych:
- postgres: exec `pg_isready -U uniqwear_user -d uniqwear_db`
- mongo: exec `mongosh --eval "db.adminCommand('ping').ok" --quiet`
- redis: exec `redis-cli ping`

`/health` w catalog i checkout faktycznie sprawdza połączenie z PostgreSQL i MongoDB — zwraca 503 jeśli baza nie odpowiada, nie tylko "ok".

**Dlaczego tak:**
readinessProbe wyciąga pod z load balancera gdy baza nie odpowiada. livenessProbe restartuje pod gdy zawiesza się na stałe. Różne initialDelaySeconds — liveness musi czekać dłużej, bo zbyt wczesny restart = pętla crashów.

---

### SecurityContext oraz initContainer — 8%

**Co oznacza:**
Kontenery aplikacyjne działają jako non-root z podstawowym securityContext. Projekt używa initContainer lub Job do migracji bazy.

**Jak to zrobiliśmy:**

SecurityContext na katalog, checkout, gateway:
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000        # user "node" w obrazie node:22-alpine
  allowPrivilegeEscalation: false
```

initContainer w `catalog-deployment.yaml`:
- czeka na PostgreSQL przez node TCP socket (niezawodne w Alpine, w przeciwieństwie do nc z BusyBox)
- uruchamia `npx prisma migrate deploy`
- uruchamia `npx knex migrate:latest`
- uruchamia `npx knex seed:run || true` (`|| true` bo dwa pody mogą seedować równocześnie przy 2 replikach)

initContainer w `checkout-deployment.yaml`:
- czeka na PostgreSQL przez node TCP socket
- uruchamia `npx sequelize-cli db:migrate`

Główny kontener uruchamia `node app.js` — migracje już zrobione przez initContainer.

**Dlaczego tak:**
UID 1000 to istniejący user `node` w obrazie node:22-alpine — nie trzeba tworzyć użytkownika. `allowPrivilegeEscalation: false` blokuje setuid/setgid. initContainer zamiast start.sh = właściwy podział odpowiedzialności w Kubernetes.

---

### CI/CD GitHub Actions — 10%

**Co oznacza:**
Workflow buduje obraz, uruchamia testy, publikuje do rejestru, deployuje przez kubectl i sprawdza rollout.

**Jak to zrobiliśmy:**
`.github/workflows/ci.yml` — 3 joby:

**job `test`** (uruchamia się na każdym pushu i PR):
- uruchamia postgres i mongo jako sidecar service containers na maszynie GitHub Actions
- instaluje zależności, generuje Prisma client, uruchamia migracje i seeds
- startuje catalog-service i checkout-service w tle (`node app.js &`)
- czeka na `/health` zanim odpali testy — gwarantuje że serwis jest gotowy
- uruchamia `npm test` dla catalog-service i checkout-service

**job `build-and-push`** (równolegle z test, tylko na push):
- buduje obrazy Docker dla wszystkich 3 serwisów
- pushuje do GHCR (GitHub Container Registry) z tagami `:latest` i `:<sha>`
- używa docker layer cache (type=gha) dla szybkich kolejnych buildów

**job `deploy`** (tylko po `test` i `build-and-push`, tylko na main):
- tworzy klaster kind bezpośrednio na maszynie GitHub Actions — nie wymaga zewnętrznego klastra ani sekretów
- pre-ładuje wszystkie obrazy do kind (app + bazy danych) żeby uniknąć timeoutów przy pullowaniu podczas startu
- aplikuje manifesty w kolejności: bazy → czeka na gotowość → aplikacje
- podmienia `:latest` na `:<sha>` przez sed przed kubectl apply (odtwarzalność)
- sprawdza `kubectl rollout status` dla wszystkich deploymentów
- przy błędzie: `kubectl describe pods` i logi kontenerów (debug on failure)

**Dlaczego tak:**
kind w GitHub Actions = zero potrzeby zewnętrznego klastra, zero konfiguracji sekretów. Pre-pull obrazów baz rozwiązuje problem timeout przy mongo:7 który jest duży. SHA tag zamiast latest = odtwarzalność deploymentu.

---

## Bonusy (+10%)

---

### NetworkPolicy — 2.5%

**Co oznacza:**
Polityki sieciowe ograniczające ruch między podami.

**Jak to zrobiliśmy:**
`k8s/networkpolicy.yaml` — 4 polityki:
- `postgres-policy` — postgres przyjmuje Ingress tylko od catalog-service i checkout-service (port 5432)
- `mongo-policy` — mongo przyjmuje Ingress tylko od catalog-service i checkout-service (port 27017)
- `redis-policy` — redis przyjmuje Ingress tylko od catalog-service (port 6379)
- `gateway-policy` — gateway przyjmuje Ingress z zewnątrz na porcie 3000

**Dlaczego tak:**
Nawet jeśli ktoś skompromituje jeden pod, NetworkPolicy blokuje lateralne ruchy w klastrze. redis-policy jest wąski — tylko catalog używa cache, więc checkout nie potrzebuje dostępu do Redis.

---

### PodDisruptionBudget — 2.5%

**Co oznacza:**
Ochrona minimalnej dostępności replik podczas aktualizacji węzłów klastra lub drain node.

**Jak to zrobiliśmy:**
`k8s/pdb.yaml`:
- `catalog-pdb` — `minAvailable: 1` dla catalog-service (z 2 replik zawsze co najmniej 1 działa)
- `checkout-pdb` — `minAvailable: 1` dla checkout-service

**Dlaczego tak:**
Podczas `kubectl drain node` (np. aktualizacja węzła) Kubernetes sprawdza PDB i nie usunie poda jeśli naruszyłoby to minimalną dostępność. Bez PDB oba pody mogłyby zostać usunięte jednocześnie — serwis pada.

---

### Kustomize — 2.5%

**Co oznacza:**
Parametryzacja manifestów dla minimum dwóch środowisk.

**Jak to zrobiliśmy:**
- `k8s/base/kustomization.yaml` — lista wszystkich manifestów jako wspólna baza
- `k8s/overlays/dev/kustomization.yaml` — patch: repliki 1 (tańsze środowisko deweloperskie)
- `k8s/overlays/prod/kustomization.yaml` — patch: repliki 3 dla catalog, checkout i gateway

Użycie:
```bash
kubectl apply -k k8s/overlays/dev    # środowisko dev (1 replika)
kubectl apply -k k8s/overlays/prod   # środowisko prod (3 repliki)
```

**Dlaczego tak:**
Kustomize nie wymaga templatowania jak Helm — patch JSON merguje tylko zmienione pola, reszta pochodzi z base. Dev overlay zmniejsza zużycie zasobów przy lokalnym testowaniu na kind/minikube.

---

### Obserwowalność — 2.5%

**Co oznacza:**
Aplikacja udostępnia `/metrics`, adnotacje Prometheusa lub inną formę obserwowalności z instrukcją sprawdzenia.

**Jak to zrobiliśmy:**

Endpoint `/metrics` w formacie Prometheus text (bez zewnętrznych zależności) dodany do:
- `gateway/app.js` — port 3000
- `catalog-service/app.js` — port 3001
- `checkout-service/app.js` — port 3002

Metryki: `process_uptime_seconds`, `process_memory_bytes`, `http_requests_total{method, status}`

Adnotacje w pod templates wszystkich 3 deploymentów:
```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "300x"
  prometheus.io/path: "/metrics"
```

Instrukcja sprawdzenia w `CHECKLIST.md` — sekcja "Observability - metryki Prometheus".

**Dlaczego tak:**
Brak zewnętrznych zależności upraszcza obraz Docker. Adnotacje to standardowy sposób autodiscovery — wystarczy zainstalować kube-prometheus-stack żeby metryki były zbierane automatycznie bez dodatkowej konfiguracji.

---

## Wymagania specyficzne (20%)

---

### Minimalna funkcjonalność — 10%

**Co oznacza:**
Jeden główny zasób biznesowy, dodawanie danych, odczyt danych, endpoint `/health`. Sprawdzenie: 2-3 komendy curl po wdrożeniu.

**Jak to zrobiliśmy:**
Główny zasób biznesowy: **produkt** (Product w PostgreSQL + szczegóły w MongoDB)

Endpointy przez gateway (localhost:3000):
- `GET /health` — status gateway + adresy serwisów
- `GET /catalog/health` — status catalog + weryfikacja połączenia z PG i MongoDB
- `GET /checkout/health` — status checkout + weryfikacja połączeń
- `POST /catalog/api/categories` — tworzenie kategorii (wymagane przed produktem)
- `POST /catalog/api/products/hybrid` — dodanie produktu do PG i MongoDB jednocześnie
- `GET /catalog/api/products` — odczyt produktów z filtrowaniem i cache Redis
- `POST /checkout/api/cart` + `POST /checkout/api/cart/:id/items` + `POST /checkout/api/checkout` — pełny flow koszyka i zamówienia

Komendy curl po wdrożeniu w sekcji "Przykladowe komendy curl" w CHECKLIST.md.

**Dlaczego tak:**
`/health` w każdym serwisie spełnia wymóg i jednocześnie służy jako readinessProbe dla Kubernetes — dwa cele jednym endpointem.

---

### Trwałość danych — 5%

**Co oznacza:**
Dane przeżywają restart poda bazy. Sprawdzenie: dodać rekord, usunąć pod, odczytać rekord po odtworzeniu.

**Jak to zrobiliśmy:**
PVC dla postgres (1Gi) i mongo (1Gi) podmontowane do kontenerów baz. StatefulSet po restarcie poda montuje ten sam PVC przez stabilną nazwę (`postgres-data-postgres-0`).

Test w CHECKLIST.md — sekcja "Trwalosc danych - test PVC":
```bash
kubectl delete pod postgres-0 -n uniqwear
kubectl wait --for=condition=ready pod -l app=postgres -n uniqwear --timeout=60s
curl http://localhost:3000/catalog/api/products   # dane nadal dostepne
```

**Dlaczego tak:**
PVC jest zasobem niezależnym od cyklu życia poda. Deployment nie gwarantuje stabilnej nazwy PVC — dlatego używamy StatefulSet.

---

### Cache, kolejka albo worker — 5%

**Co oznacza:**
Dodatkowy komponent architektury (Redis/RabbitMQ/worker) z dowodem działania w CHECKLIST.md.

**Jak to zrobiliśmy:**
Redis jako cache dla `GET /api/products` w catalog-service:
- `k8s/redis-statefulset.yaml` — StatefulSet `redis:7-alpine` z PVC 256Mi
- `catalog-service/redis-client.js` — klient ioredis z `lazyConnect: true` i `retryStrategy: null` — graceful degradation (serwis działa nawet bez Redis)
- `catalog-service/app.js` — przed zapytaniem do bazy sprawdza klucz `products:<query>` w Redis; cache miss = zapis na 60s; header `X-Cache: HIT/MISS` jako dowód działania

Dowód działania w CHECKLIST.md — sekcja "Cache Redis - dowod dzialania":
```bash
curl -i http://localhost:3000/catalog/api/products  # X-Cache: MISS
curl -i http://localhost:3000/catalog/api/products  # X-Cache: HIT
kubectl exec -it redis-0 -n uniqwear -- redis-cli ttl "products:{}"
```

**Dlaczego tak:**
`lazyConnect` i try/catch wokół operacji Redis sprawia że brak Redis nie crashuje serwisu. Header `X-Cache` to prosty ale jednoznaczny dowód działania cache bez potrzeby instalowania Prometheusa.

---

## Podsumowanie pokrycia

| Wymaganie | Waga | Status |
|-----------|------|--------|
| Manifesty Kubernetes | 12% | ✅ |
| Deploymenty i rolling update | 10% | ✅ |
| Baza danych i trwałość | 12% | ✅ |
| Services, Ingress i izolacja | 10% | ✅ |
| ConfigMap i Secret | 8% | ✅ |
| Probes i zasoby | 10% | ✅ |
| SecurityContext i initContainer | 8% | ✅ |
| CI/CD GitHub Actions | 10% | ✅ |
| NetworkPolicy | +2.5% | ✅ |
| PodDisruptionBudget | +2.5% | ✅ |
| Kustomize | +2.5% | ✅ |
| Obserwowalność | +2.5% | ✅ |
| Minimalna funkcjonalność | 10% | ✅ |
| Trwałość danych | 5% | ✅ |
| Cache/worker | 5% | ✅ |
| **RAZEM** | **110%** | **✅** |
