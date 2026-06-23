#!/bin/bash
# konfiguruje keycloak przez admin rest api:
# - smtp -> mailhog (reset hasla przez email)
# - rejestracja wlasna uzytkownikow (z domyslna rola user)
# - totp/2fa jako opcjonalna akcja wymagana
# uruchom po starcie dockera: bash keycloak/setup-user-management.sh

set -e

KC_URL="http://localhost:8080"
REALM="uniqwear"
ADMIN_USER="admin"
ADMIN_PASS="admin"

echo "[1/5] pobieranie tokenu admina..."
TOKEN=$(curl -s -X POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${ADMIN_USER}&password=${ADMIN_PASS}&grant_type=password&client_id=admin-cli" \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "blad: nie udalo sie pobrac tokenu — czy keycloak jest uruchomiony?"
  exit 1
fi
echo "token ok"

echo "[2/5] wlaczanie rejestracji + smtp (mailhog)..."
curl -s -X PUT "${KC_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "registrationAllowed": true,
    "registrationEmailAsUsername": false,
    "loginWithEmailAllowed": true,
    "resetPasswordAllowed": true,
    "smtpServer": {
      "host": "mailhog",
      "port": "1025",
      "from": "noreply@uniqwear.com",
      "fromDisplayName": "UniqWear",
      "ssl": "false",
      "starttls": "false",
      "auth": "false"
    }
  }'
echo " ok"

echo "[3/5] ustawianie domyslnej roli 'user' dla nowych rejestracji..."
# pobierz id roli user
ROLE_ID=$(curl -s "${KC_URL}/admin/realms/${REALM}/roles/user" \
  -H "Authorization: Bearer ${TOKEN}" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "id roli user: ${ROLE_ID}"

# pobierz id roli zlozone default-roles-uniqwear (Keycloak 24 uzywa composite role)
DEFAULT_ROLE_ID=$(curl -s "${KC_URL}/admin/realms/${REALM}/roles/default-roles-uniqwear" \
  -H "Authorization: Bearer ${TOKEN}" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "id default role: ${DEFAULT_ROLE_ID}"

# dodaj role 'user' do composites domyslnej roli
curl -s -X POST "${KC_URL}/admin/realms/${REALM}/roles-by-id/${DEFAULT_ROLE_ID}/composites" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "[{\"id\":\"${ROLE_ID}\",\"name\":\"user\"}]"
echo " ok"

echo "[4/5] rejestracja CONFIGURE_TOTP jako opcjonalna akcja wymagana..."
# wlacz akcje configure_totp (jest juz zarejestrowana w keycloak, wystarczy ustawic enabled=true)
curl -s -X PUT "${KC_URL}/admin/realms/${REALM}/authentication/required-actions/CONFIGURE_TOTP" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "CONFIGURE_TOTP",
    "name": "Configure OTP",
    "providerId": "CONFIGURE_TOTP",
    "enabled": true,
    "defaultAction": false,
    "priority": 10,
    "config": {}
  }'
echo " ok"

echo "[5/5] weryfikacja konfiguracji smtp..."
SMTP_HOST=$(curl -s "${KC_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${TOKEN}" \
  | grep -o '"host":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "smtp host: ${SMTP_HOST}"

echo ""
echo "gotowe! sprawdz:"
echo "  - rejestracja: http://localhost:8080/realms/uniqwear/account"
echo "  - reset hasla: zaloguj sie i kliknij 'Forgot Password' na stronie logowania"
echo "  - mailhog ui:  http://localhost:8025"
echo "  - 2fa/totp:    w profilu uzytkownika > Security > Two-Factor Authenticators"
