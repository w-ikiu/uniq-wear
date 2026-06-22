require('dotenv').config()
const express  = require('express')
const session  = require('express-session')
const axios    = require('axios')
const { Issuer, generators } = require('openid-client')

const app = express()
app.set('view engine', 'ejs')
app.set('views', './views')
app.use(express.urlencoded({ extended: false }))

const KEYCLOAK_URL  = process.env.KEYCLOAK_URL   || 'http://localhost:8080'
const REALM         = process.env.KEYCLOAK_REALM  || 'uniqwear'
const CLIENT_ID     = 'ssr-panel'
// sekret klienta — przechowywany tylko po stronie serwera, nigdy nie trafia do przegladarki
const CLIENT_SECRET = process.env.CLIENT_SECRET   || 'ssr-panel-secret-dev'
const REDIRECT_URI  = process.env.REDIRECT_URI    || 'http://localhost:4000/callback'
const GATEWAY_URL   = process.env.GATEWAY_URL     || 'http://localhost:3000'

// sesja serwerowa — token zyje w pamieci serwera, nie w localStorage przegladarki
app.use(session({
  secret:            process.env.SESSION_SECRET || 'ssr-dev-secret-zmien-na-produkcji',
  resave:            true,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,   // js po stronie klienta nie ma dostepu do ciasteczka
    secure:   false,  // false bo http (localhost bez tls)
    sameSite: 'lax',
    maxAge:   60 * 60 * 1000,  // 1 godzina
  },
}))

// klient oidc tworzymy raz (leniwa inicjalizacja przez discovery endpoint keycloaka)
let oidcClient = null

async function getClient() {
  if (oidcClient) return oidcClient
  // discovery pobiera konfiguracje keycloaka (adresy tokenow, jwks, logout itd.)
  const issuer = await Issuer.discover(`${KEYCLOAK_URL}/realms/${REALM}`)
  oidcClient = new issuer.Client({
    client_id:      CLIENT_ID,
    client_secret:  CLIENT_SECRET,
    redirect_uris:  [REDIRECT_URI],
    response_types: ['code'],
  })
  return oidcClient
}

// pomocnicza — pobiera dane z gateway z tokenem admina
async function apiGet(path, token) {
  const res = await axios.get(`${GATEWAY_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5000,
  })
  return res.data
}

// middleware — wymaga zalogowanej sesji
function requireAuth(req, res, next) {
  if (!req.session.tokens) return res.redirect('/login')
  next()
}

// middleware — wymaga roli admin lub moderator
function requireAdminOrModerator(req, res, next) {
  const roles = req.session.user?.roles || []
  if (!roles.includes('admin') && !roles.includes('moderator')) {
    return res.status(403).render('error', {
      user: req.session.user,
      message: 'Brak uprawnien — wymagana rola admin lub moderator.',
    })
  }
  next()
}

// dashboard — admin widzi wszystko, moderator tylko recenzje
app.get('/', requireAuth, requireAdminOrModerator, async (req, res) => {
  const token   = req.session.tokens.access_token
  const roles   = req.session.user?.roles || []
  const isAdmin = roles.includes('admin')

  try {
    let orders = [], stats = [], analytics = []
    // moderator pobiera tylko recenzje — nie ma dostepu do zamowien i statystyk
    const pendingReviews = await apiGet('/catalog/api/reviews?status=pending', token)

    if (isAdmin) {
      // admin pobiera wszystkie dane rownolegле
      ;[orders, stats, analytics] = await Promise.all([
        apiGet('/checkout/api/orders', token).then(d => d.slice(0, 10)),
        apiGet('/catalog/api/stats/inventory', token),
        axios.get(`${GATEWAY_URL}/catalog/api/analytics/ratings`, { timeout: 5000 }).then(r => r.data.slice(0, 10)),
      ])
    }

    res.render('dashboard', {
      user:    req.session.user,
      isAdmin,
      orders,
      reviews: pendingReviews.slice(0, 20),
      stats,
      analytics,
    })
  } catch (err) {
    const status = err.response?.status || 500
    res.status(status).render('error', {
      user:    req.session.user,
      message: `Blad pobierania danych (${status}): ${err.message}`,
    })
  }
})

// poczatek authorization code flow — redirect do strony logowania keycloaka
app.get('/login', async (req, res) => {
  try {
    const client = await getClient()
    // state chroni przed atakami csrf
    const state  = generators.state()
    req.session.oauthState = state

    const url = client.authorizationUrl({
      scope: 'openid email profile',
      state,
    })
    res.redirect(url)
  } catch (err) {
    res.render('error', { user: null, message: 'Nie mozna polaczyc sie z Keycloak: ' + err.message })
  }
})

// callback — keycloak przekierowuje tutaj po udanym logowaniu z kodem autoryzacji
app.get('/callback', async (req, res) => {
  try {
    const client = await getClient()
    const params = client.callbackParams(req)

    // wymiana kodu autoryzacji na access_token, id_token, refresh_token
    // klient uzywa client_secret — bezpieczne, bo odbywa sie serwer-serwer
    const tokens = await client.callback(REDIRECT_URI, params, {
      state: req.session.oauthState,
    })

    const idClaims = tokens.claims()
    // realm_access.roles jest w access_token, nie w id_token — dekodujemy payload
    const accessPayload = JSON.parse(
      Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString()
    )

    req.session.tokens = {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token:      tokens.id_token,
      expires_at:    tokens.expires_at,
    }
    req.session.user = {
      id:    idClaims.sub,
      name:  idClaims.preferred_username || idClaims.name,
      email: idClaims.email || '',
      roles: accessPayload.realm_access?.roles || [],
    }
    delete req.session.oauthState

    // jawny zapis sesji przed redirectem — zapobiega utracie danych przy szybkim przekierowaniu
    req.session.save(() => res.redirect('/'))
  } catch (err) {
    res.render('error', { user: null, message: 'Blad logowania: ' + err.message })
  }
})

// wylogowanie — niszczy sesje serwera i przekierowuje do logout keycloaka
app.get('/logout', async (req, res) => {
  try {
    const client   = await getClient()
    const idToken  = req.session.tokens?.id_token

    // najpierw zniszcz lokalna sesje
    req.session.destroy()

    // potem przekieruj na endpoint wylogowania keycloaka (single logout)
    const logoutUrl = client.endSessionUrl({
      id_token_hint:             idToken,
      post_logout_redirect_uri:  'http://localhost:4000/',
    })
    res.redirect(logoutUrl)
  } catch {
    res.redirect('/')
  }
})

// zatwierdzenie recenzji — dostepne dla admina i moderatora
app.post('/reviews/:id/approve', requireAuth, requireAdminOrModerator, async (req, res) => {
  const token = req.session.tokens.access_token
  try {
    await axios.patch(`${GATEWAY_URL}/catalog/api/reviews/${req.params.id}/approve`, null, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    console.error('blad zatwierdzania recenzji:', err.message)
  }
  res.redirect('/')
})

// tymczasowy endpoint diagnostyczny — pokazuje zawartosc sesji
app.get('/debug', (req, res) => {
  res.json({
    authenticated: !!req.session.tokens,
    user:          req.session.user || null,
    tokenPreview:  req.session.tokens
      ? req.session.tokens.access_token.split('.').slice(0,2).map(p => {
          try { return JSON.parse(Buffer.from(p, 'base64').toString()) } catch { return p }
        })
      : null,
  })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`ssr-panel dziala na http://localhost:${PORT}`)
  console.log(`keycloak: ${KEYCLOAK_URL}/realms/${REALM}`)
  console.log(`gateway:  ${GATEWAY_URL}`)
})
