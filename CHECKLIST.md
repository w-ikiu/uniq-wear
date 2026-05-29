# CHECKLIST - UniqWear Kubernetes

Link do ostatniego udanego workflow GitHub Actions:
https://github.com/w-ikiu/uniq-wear/actions/runs/26630078544

---

## Wymagania wstepne

- Docker Desktop (uruchomiony)
- kind: `choco install kind` lub https://kind.sigs.k8s.io/docs/user/quick-start/#installation
- kubectl: `choco install kubernetes-cli`

---

## Uruchomienie na kind

### 1. Stworz klaster

```bash
kind create cluster --name uniqwear
```

### 2. Zainstaluj nginx ingress controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### 3. Zaladuj obrazy do kind

```bash
docker pull ghcr.io/w-ikiu/uniqwear-catalog:latest
docker pull ghcr.io/w-ikiu/uniqwear-checkout:latest
docker pull ghcr.io/w-ikiu/uniqwear-gateway:latest

kind load docker-image ghcr.io/w-ikiu/uniqwear-catalog:latest --name uniqwear
kind load docker-image ghcr.io/w-ikiu/uniqwear-checkout:latest --name uniqwear
kind load docker-image ghcr.io/w-ikiu/uniqwear-gateway:latest --name uniqwear
```

### 4. Aplikuj manifesty

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/mongo-statefulset.yaml
kubectl apply -f k8s/services.yaml

# poczekaj na bazy
kubectl wait --for=condition=ready pod -l app=postgres -n uniqwear --timeout=120s
kubectl wait --for=condition=ready pod -l app=mongo -n uniqwear --timeout=120s

kubectl apply -f k8s/catalog-deployment.yaml
kubectl apply -f k8s/checkout-deployment.yaml
kubectl apply -f k8s/gateway-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 5. Sprawdz status rollout

```bash
kubectl rollout status deployment/catalog-service -n uniqwear
kubectl rollout status deployment/checkout-service -n uniqwear
kubectl rollout status deployment/gateway -n uniqwear
```

### 6. Port-forward (alternatywa dla ingress)

```bash
kubectl port-forward service/gateway 3000:3000 -n uniqwear
# aplikacja dostepna pod http://localhost:3000
```

### 7. Usun klaster

```bash
kind delete cluster --name uniqwear
```

---

## Lista zasobow Kubernetes

| Rodzaj | Nazwa | Namespace |
|--------|-------|-----------|
| Namespace | uniqwear | - |
| ConfigMap | uniqwear-config | uniqwear |
| Secret | uniqwear-secret | uniqwear |
| StatefulSet | postgres | uniqwear |
| StatefulSet | mongo | uniqwear |
| StatefulSet | redis | uniqwear |
| PVC | postgres-data-postgres-0 | uniqwear |
| PVC | mongo-data-mongo-0 | uniqwear |
| PVC | redis-data-redis-0 | uniqwear |
| Deployment | catalog-service (2 repliki) | uniqwear |
| Deployment | checkout-service (2 repliki) | uniqwear |
| Deployment | gateway (1 replika) | uniqwear |
| Service | postgres (headless) | uniqwear |
| Service | mongo (headless) | uniqwear |
| Service | redis (headless) | uniqwear |
| Service | catalog-service (ClusterIP) | uniqwear |
| Service | checkout-service (ClusterIP) | uniqwear |
| Service | gateway (ClusterIP) | uniqwear |
| Ingress | uniqwear-ingress | uniqwear |
| NetworkPolicy | postgres-policy | uniqwear |
| NetworkPolicy | mongo-policy | uniqwear |
| NetworkPolicy | redis-policy | uniqwear |
| NetworkPolicy | gateway-policy | uniqwear |
| PodDisruptionBudget | catalog-pdb | uniqwear |
| PodDisruptionBudget | checkout-pdb | uniqwear |

---

## Komendy kubectl

```bash
# lista wszystkich zasobow w namespace
kubectl get all -n uniqwear

# status podow
kubectl get pods -n uniqwear

# sprawdzenie deploymentow i replik
kubectl get deploy -n uniqwear

# szczegoly poda (probes, eventy)
kubectl describe pod -l app=catalog-service -n uniqwear

# logi serwisu
kubectl logs -l app=catalog-service -n uniqwear --tail=50
kubectl logs -l app=checkout-service -n uniqwear --tail=50

# sprawdzenie PVC
kubectl get pvc -n uniqwear

# sprawdzenie ingress
kubectl get ingress -n uniqwear
```

### Przykladowe wyniki kubectl get all -n uniqwear

```
NAME                                    READY   STATUS    RESTARTS   AGE
pod/catalog-service-7d9f8b6c4-k2xpq    1/1     Running   0          3m
pod/catalog-service-7d9f8b6c4-n8vlt    1/1     Running   0          3m
pod/checkout-service-6b8d7f5c3-j4mnr   1/1     Running   0          3m
pod/checkout-service-6b8d7f5c3-p9wqs   1/1     Running   0          3m
pod/gateway-5c7b9d4f2-x3kpl            1/1     Running   0          3m
pod/mongo-0                            1/1     Running   0          5m
pod/postgres-0                         1/1     Running   0          5m

NAME                       TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)     AGE
service/catalog-service    ClusterIP   10.96.45.12     <none>        3001/TCP    5m
service/checkout-service   ClusterIP   10.96.67.89     <none>        3002/TCP    5m
service/gateway            ClusterIP   10.96.23.45     <none>        3000/TCP    5m
service/mongo              ClusterIP   None            <none>        27017/TCP   5m
service/postgres           ClusterIP   None            <none>        5432/TCP    5m

NAME                               READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/catalog-service    2/2     2            2           3m
deployment.apps/checkout-service   2/2     2            2           3m
deployment.apps/gateway            1/1     1            1           3m

NAME                                        DESIRED   CURRENT   READY   AGE
statefulset.apps/mongo                      1         1         1       5m
statefulset.apps/postgres                   1         1         1       5m
```

---

## Przykladowe komendy curl

Przez port-forward (`kubectl port-forward service/gateway 3000:3000 -n uniqwear`):

### Health check

```bash
curl http://localhost:3000/health
```

```json
{"status":"ok","services":{"catalog":"http://catalog-service:3001","checkout":"http://checkout-service:3002"}}
```

### Dodanie kategorii

```bash
curl -X POST http://localhost:3000/catalog/api/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "sneakers"}'
```

```json
{"id":1,"name":"sneakers"}
```

### Dodanie produktu (zapis do PG i MongoDB)

```bash
curl -X POST http://localhost:3000/catalog/api/products/hybrid \
  -H "Content-Type: application/json" \
  -d '{"name":"Air Max","description":"Buty sportowe","categoryId":1,"price":299.99,"sku":"AM-001","longDescription":"Klasyczne buty do biegania","stock":50}'
```

```json
{"message":"produkt utworzony w obu bazach","pg":{"id":1,"name":"Air Max"},"mongo":{"_id":"..."}}
```

### Odczyt produktow

```bash
curl http://localhost:3000/catalog/api/products
```

```json
[{"id":1,"name":"Air Max","description":"Buty sportowe","categoryName":"sneakers"}]
```

### Trwalosc danych - test PVC

```bash
# dodaj produkt, usun pod bazy, sprawdz czy dane zostaly
kubectl delete pod postgres-0 -n uniqwear
kubectl wait --for=condition=ready pod -l app=postgres -n uniqwear --timeout=60s
curl http://localhost:3000/catalog/api/products
# dane nadal dostepne dzieki PVC
```

### Utworzenie koszyka i dodanie produktu

```bash
curl -X POST http://localhost:3000/checkout/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session-123"}'
```

```json
{"id":1,"sessionId":"session-123","status":"open"}
```

---

## Cache Redis - dowod dzialania

Redis cachuje odpowiedzi `GET /api/products` przez 60 sekund. Header `X-Cache` pokazuje czy odpowiedz pochodzi z cache.

```bash
# pierwsze zapytanie - MISS (pobiera z bazy, zapisuje do redis)
curl -i http://localhost:3000/catalog/api/products 2>&1 | grep -E "X-Cache|HTTP"
# X-Cache: MISS

# drugie zapytanie - HIT (pobiera z redis)
curl -i http://localhost:3000/catalog/api/products 2>&1 | grep -E "X-Cache|HTTP"
# X-Cache: HIT

# sprawdzenie kluczy w redis
kubectl exec -it redis-0 -n uniqwear -- redis-cli keys "products:*"
# 1) "products:{}"

# sprawdzenie wartosci TTL
kubectl exec -it redis-0 -n uniqwear -- redis-cli ttl "products:{}"
# (integer) 47
```

---

## Observability - metryki Prometheus

Kazdy serwis udostepnia `/metrics` w formacie Prometheus text. Pody maja adnotacje `prometheus.io/scrape: "true"` gotowe pod scrapowanie.

```bash
# metryki gateway
curl http://localhost:3000/metrics

# metryki catalog (przez port-forward bezposrednio na serwis)
kubectl port-forward service/catalog-service 3001:3001 -n uniqwear &
curl http://localhost:3001/metrics
```

Przykladowy wynik:

```
# HELP process_uptime_seconds process uptime
# TYPE process_uptime_seconds gauge
process_uptime_seconds 42.31
# HELP process_memory_bytes resident memory
# TYPE process_memory_bytes gauge
process_memory_bytes 75694080
# HELP http_requests_total total http requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 17
http_requests_total{method="POST",status="201"} 3
```

```bash
# sprawdzenie adnotacji prometheusa na podach
kubectl get pods -n uniqwear -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.prometheus\.io/scrape}{"\n"}{end}'
```

---

## Weryfikacja rolling update

```bash
# sprawdz strategie
kubectl get deploy catalog-service -n uniqwear -o jsonpath='{.spec.strategy}'

# zasymuluj update (zmiana obrazu)
kubectl set image deployment/catalog-service \
  catalog-service=ghcr.io/w-ikiu/uniqwear-catalog:latest -n uniqwear

# obserwuj rolling update
kubectl rollout status deployment/catalog-service -n uniqwear
```
