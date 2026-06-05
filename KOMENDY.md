# KOMENDY — weryfikacja wymagań projektu

Wszystkie komendy zakładają że klaster działa lokalnie (kind) i masz dostęp do `kubectl`.

Przed sprawdzaniem — port-forward do gateway (zostaw w tle w osobnym terminalu):
```bash
kubectl port-forward svc/gateway 3000:3000 -n uniqwear
```

---

## 1. Manifesty Kubernetes (12%)

Sprawdź że wszystkie zasoby istnieją:

```bash
kubectl get namespace uniqwear
kubectl get deployment -n uniqwear
kubectl get statefulset -n uniqwear
kubectl get service -n uniqwear
kubectl get ingress -n uniqwear
kubectl get configmap -n uniqwear
kubectl get secret -n uniqwear
kubectl get pvc -n uniqwear
```

---

## 2. Deploymenty i rolling update (10%)

```bash
# lista deploymentów z liczbą replik
kubectl get deploy -n uniqwear

# status rolling update
kubectl rollout status deployment/catalog-service -n uniqwear
kubectl rollout status deployment/checkout-service -n uniqwear
kubectl rollout status deployment/gateway -n uniqwear

# historia rolloutów
kubectl rollout history deployment/catalog-service -n uniqwear
```

---

## 3. Baza danych i trwałość (12%)

```bash
# sprawdź StatefulSety
kubectl get statefulset -n uniqwear

# sprawdź PVC
kubectl get pvc -n uniqwear

# sprawdź że PVC są bound (przypisane)
kubectl get pvc -n uniqwear -o wide
```

### Dowód trwałości danych — dodaj rekord, usuń pod, sprawdź ponownie:

```bash
# 1. dodaj produkt
curl -s -X POST http://localhost:3000/catalog/api/products/hybrid \
  -H "Content-Type: application/json" \
  -d '{"name":"Air Max","description":"Buty sportowe","categoryId":1,"price":299.99,"sku":"AM-002","stock":50,"longDescription":"Klasyczne buty do biegania"}'

# 2. usuń pod bazy
kubectl delete pod postgres-0 -n uniqwear

# 3. poczekaj aż wróci
kubectl wait --for=condition=ready pod postgres-0 -n uniqwear --timeout=120s

# 4. sprawdź że dane nadal są
curl -s http://localhost:3000/catalog/api/products
```

---

## 4. Services, Ingress i izolacja (10%)

```bash
# lista serwisów
kubectl get svc -n uniqwear

# szczegóły ingressa
kubectl describe ingress uniqwear-ingress -n uniqwear

# bazy NIE mają zewnętrznego dostępu — sprawdź że są ClusterIP/headless
kubectl get svc postgres -n uniqwear
kubectl get svc mongo -n uniqwear
kubectl get svc redis -n uniqwear
```

---

## 5. ConfigMap i Secret (8%)

```bash
# sprawdź że ConfigMap istnieje i ma dane
kubectl get configmap -n uniqwear
kubectl describe configmap uniqwear-config -n uniqwear

# sprawdź że Secret istnieje (wartości zakodowane w base64, nie jawne)
kubectl get secret -n uniqwear
kubectl describe secret uniqwear-secret -n uniqwear
```

---

## 6. Probes i zasoby (10%)

```bash
# sprawdź proby i zasoby dla każdego poda
kubectl describe pod -l app=gateway -n uniqwear | grep -A 10 "Liveness\|Readiness\|Limits\|Requests"
kubectl describe pod -l app=catalog-service -n uniqwear | grep -A 10 "Liveness\|Readiness\|Limits\|Requests"
kubectl describe pod -l app=checkout-service -n uniqwear | grep -A 10 "Liveness\|Readiness\|Limits\|Requests"
```

---

## 7. SecurityContext oraz initContainer (8%)

```bash
# sprawdź securityContext i initContainers
kubectl describe pod -l app=catalog-service -n uniqwear | grep -A 5 "Init Containers\|Security Context\|Run As"
kubectl describe pod -l app=checkout-service -n uniqwear | grep -A 5 "Init Containers\|Security Context\|Run As"

# sprawdź logi initContainera (migracje)
kubectl logs -l app=catalog-service -n uniqwear -c migrate
kubectl logs -l app=checkout-service -n uniqwear -c migrate
```

---

## 8. CI/CD GitHub Actions (10%)

Sprawdź w GitHub Actions — workflow buduje obraz, testuje, pushuje do rejestru i deployuje przez Kustomize:

```bash
# po wdrożeniu sprawdź że obrazy mają SHA commita (nie :latest)
kubectl get deploy catalog-service -n uniqwear -o jsonpath='{.spec.template.spec.containers[0].image}'
kubectl get deploy checkout-service -n uniqwear -o jsonpath='{.spec.template.spec.containers[0].image}'
kubectl get deploy gateway -n uniqwear -o jsonpath='{.spec.template.spec.containers[0].image}'
```

---

## 9. NetworkPolicy (2.5%)

```bash
# sprawdź że NetworkPolicy istnieją
kubectl get networkpolicy -n uniqwear

# szczegóły — kto może rozmawiać z bazą
kubectl describe networkpolicy -n uniqwear
```

---

## 10. PodDisruptionBudget (2.5%)

```bash
kubectl get pdb -n uniqwear
kubectl describe pdb -n uniqwear
```

---

## 11. Kustomize — dev i prod (2.5%)

```bash
# podgląd co zostanie wdrożone dla deva
kubectl kustomize k8s/overlays/dev/

# podgląd dla proda
kubectl kustomize k8s/overlays/prod/

# różnica — dev ma 1 replikę, prod ma 3
kubectl kustomize k8s/overlays/dev/ | grep replicas
kubectl kustomize k8s/overlays/prod/ | grep replicas
```

---

## 12. Obserwowalność — metryki (2.5%)

```bash
# metryki gateway
curl -s http://localhost:3000/metrics

# metryki catalog bezpośrednio
kubectl port-forward svc/catalog-service 3001:3001 -n uniqwear
curl -s http://localhost:3001/metrics

# metryki checkout bezpośrednio
kubectl port-forward svc/checkout-service 3002:3002 -n uniqwear
curl -s http://localhost:3002/metrics
```

---

## 13. Funkcjonalność aplikacji (10%)

### Health check
```bash
curl -s http://localhost:3000/health | jq .
curl -s http://localhost:3000/catalog/health | jq .
curl -s http://localhost:3000/checkout/health | jq .
```

### Odczyt danych (produkty)
```bash
curl -s http://localhost:3000/catalog/api/products | jq .
curl -s http://localhost:3000/catalog/api/categories | jq .
curl -s http://localhost:3000/catalog/api/brands | jq .
```

### Dodanie produktu
```bash
curl -s -X POST http://localhost:3000/catalog/api/products/hybrid \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Koszulka Testowa",
    "brand": "TestBrand",
    "category_id": 1,
    "base_price": 79.99,
    "description": "Testowy produkt",
    "variants": [
      {"sku": "KT-001-M-BLK", "size": "M", "color": "black", "stock": 10}
    ]
  }' | jq .
```

### Koszyk i zamówienie
```bash
# utwórz koszyk
curl -s -X POST http://localhost:3000/checkout/api/cart \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}' | jq .

# dodaj produkt do koszyka (zastąp CART_ID i SKU rzeczywistymi wartościami)
curl -s -X POST http://localhost:3000/checkout/api/cart/CART_ID/items \
  -H "Content-Type: application/json" \
  -d '{"sku": "KT-001-M-BLK", "quantity": 1}' | jq .

# złóż zamówienie
curl -s -X POST http://localhost:3000/checkout/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"cartId": CART_ID, "userId": 1}' | jq .

# lista zamówień
curl -s http://localhost:3000/checkout/api/orders | jq .
```

---

## 14. Cache Redis (5%)

```bash
# sprawdź że Redis działa
kubectl get pod -l app=redis -n uniqwear

# sprawdź logi
kubectl logs -l app=redis -n uniqwear

# sprawdź że catalog-service łączy się z Redis (NetworkPolicy pozwala tylko catalog)
kubectl describe networkpolicy redis-policy -n uniqwear
```

---

## Szybki test wszystkiego naraz

```bash
# status wszystkich podów
kubectl get pods -n uniqwear

# wszystkie zasoby w namespace
kubectl get all -n uniqwear
```
