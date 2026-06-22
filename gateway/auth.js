const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM        = process.env.KEYCLOAK_REALM || 'uniqwear';

// klient jwks pobiera i cache'uje klucze publiczne keycloaka
// dzieki temu nie odpytujemy keycloaka przy kazdym zadaniu
const jwks = jwksClient({
  jwksUri: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minut
});

// pomocnicza funkcja — pobiera klucz publiczny dla danego kid z tokenu
function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// sciezki dostepne bez tokenu (publiczne endpointy)
// przeglad produktow i kategorii nie wymaga logowania
const PUBLIC_ROUTES = [
  { method: 'GET',    path: /^\/catalog\/api\/products/ },
  { method: 'GET',    path: /^\/catalog\/api\/categories/ },
  { method: 'GET',    path: /^\/catalog\/api\/analytics/ },
  { method: 'GET',    path: /^\/checkout\/api\/reviews/ },
  { method: 'GET',    path: /^\/(health|ready|metrics)$/ },
];

// endpointy tylko dla admina (zarzadzanie produktami i kategoriami)
const ADMIN_ROUTES = [
  { method: 'POST',   path: /^\/catalog\/api\/products/ },
  { method: 'PATCH',  path: /^\/catalog\/api\/products/ },
  { method: 'DELETE', path: /^\/catalog\/api\/products/ },
  { method: 'POST',   path: /^\/catalog\/api\/categories/ },
  { method: 'DELETE', path: /^\/catalog\/api\/categories/ },
];

// endpointy dla admina lub moderatora (moderacja recenzji)
const MODERATOR_ROUTES = [
  { method: 'PATCH',  path: /^\/catalog\/api\/reviews\/.+\/approve/ },
  { method: 'DELETE', path: /^\/catalog\/api\/reviews/ },
];

function isPublic(req) {
  return PUBLIC_ROUTES.some(
    r => r.method === req.method && r.path.test(req.path)
  );
}

function requiresAdmin(req) {
  return ADMIN_ROUTES.some(
    r => r.method === req.method && r.path.test(req.path)
  );
}

function requiresModerator(req) {
  return MODERATOR_ROUTES.some(
    r => r.method === req.method && r.path.test(req.path)
  );
}

// wyodrebnia role uzytkownika z payloadu tokenu keycloaka
// keycloak przechowuje role realm w polu realm_access.roles
function getRoles(payload) {
  return payload?.realm_access?.roles || [];
}

// glowny middleware — waliduje token i blokuje nieautoryzowany dostep
function authMiddleware(req, res, next) {
  // sciezki publiczne przepuszczamy bez weryfikacji
  if (isPublic(req)) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'brak tokenu autoryzacji',
      code: 401,
    });
  }

  const token = authHeader.slice(7);

  // weryfikujemy podpis tokenu za pomoca kluczy publicznych keycloaka
  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, payload) => {
    if (err) {
      return res.status(401).json({
        error: 'nieprawidlowy lub wygasly token',
        code: 401,
        details: err.message,
      });
    }

    // jesli endpoint wymaga roli admina — sprawdzamy czy uzytkownik ja ma
    if (requiresAdmin(req) && !getRoles(payload).includes('admin')) {
      return res.status(403).json({
        error: 'brak uprawnien — wymagana rola admin',
        code: 403,
      });
    }

    // moderacja recenzji dostepna dla admina lub moderatora
    if (requiresModerator(req)) {
      const roles = getRoles(payload);
      if (!roles.includes('admin') && !roles.includes('moderator')) {
        return res.status(403).json({
          error: 'brak uprawnien — wymagana rola admin lub moderator',
          code: 403,
        });
      }
    }

    // przekazujemy informacje o uzytkowniku do serwisow za pomoca naglowkow
    // serwisy moga odczytac x-user-id i x-user-roles bez ponownej walidacji tokenu
    req.headers['x-user-id']    = payload.sub;
    req.headers['x-user-email'] = payload.email || '';
    req.headers['x-user-roles'] = getRoles(payload).join(',');

    next();
  });
}

module.exports = { authMiddleware };
