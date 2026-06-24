require('dotenv').config()
const express = require('express')
const session = require('express-session')
const axios   = require('axios')
const crypto  = require('crypto')

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
    httpOnly: true,   // js po stronie klienta nie ma dostepu do ciasteczka sesji
    secure:   false,  // false bo http (localhost bez tls)
    sameSite: 'lax',
    maxAge:   60 * 60 * 1000,
  },
}))

// cache endpointow z discovery — pobieramy raz, nie przy kazdym zadaniu
let oidcEndpoints = null

// discovery pobiera adresy endpointow keycloaka z dobrze znango url
// dzieki temu nie hardkodujemy adresow token/auth/logout endpoint
async function getEndpoints() {
  if (oidcEndpoints) return oidcEndpoints
  const res = await axios.get(
    `${KEYCLOAK_URL}/realms/${REALM}/.well-known/openid-configuration`,
    { timeout: 5000 }
  )
  oidcEndpoints = {
    auth:   res.data.authorization_endpoint,
    token:  res.data.token_endpoint,
    logout: res.data.end_session_endpoint,
  }
  return oidcEndpoints
}

// losowy state — 32 bajty = 64 znaki hex — ochrona przed atakami csrf
function generateState() {
  return crypto.randomBytes(32).toString('hex')
}

// dekoduje payload jwt bez weryfikacji podpisu
// weryfikacja podpisu odbywa sie w gateway — tutaj tylko odczytujemy dane uzytkownika
function decodeJwtPayload(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
}

// pomocnicza — pobiera dane z gateway z tokenem uzytkownika
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
      user:    req.session.user,
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
    const ep = await getEndpoints()

    // state chroni przed atakami csrf — zapisujemy w sesji, porownujemy w /callback
    const state = generateState()
    req.session.oauthState = state

    // budujemy url autoryzacji recznie — bez bibliotek
    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      scope:         'openid email profile',
      state,
    })

    res.redirect(`${ep.auth}?${params}`)
  } catch (err) {
    res.render('error', { user: null, message: 'Nie mozna polaczyc sie z Keycloak: ' + err.message })
  }
})

// callback — keycloak przekierowuje tutaj z kodem autoryzacji po udanym logowaniu
app.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query

    // weryfikacja state — jesli rozni sie od zapisanego w sesji, to mozliwy atak csrf
    if (!state || state !== req.session.oauthState) {
      return res.status(403).render('error', {
        user:    null,
        message: 'Nieprawidlowy parametr state — mozliwy atak CSRF.',
      })
    }

    const ep = await getEndpoints()

    // wymiana kodu autoryzacji na tokeny — zadanie idzie serwer-serwer z client_secret
    // przegladarka nigdy nie widzi sekretu ani tokenow
    const params = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })

    const tokenRes = await axios.post(ep.token, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000,
    })

    const { access_token, refresh_token, id_token } = tokenRes.data

    // dekodujemy payload jwt recznie — base64url -> json
    const idPayload     = decodeJwtPayload(id_token)
    // realm_access.roles jest w access_token, nie w id_token
    const accessPayload = decodeJwtPayload(access_token)

    req.session.tokens = { access_token, refresh_token, id_token }
    req.session.user   = {
      id:    idPayload.sub,
      name:  idPayload.preferred_username || idPayload.name,
      email: idPayload.email || '',
      roles: accessPayload.realm_access?.roles || [],
    }
    delete req.session.oauthState

    // jawny zapis sesji przed redirectem — zapobiega utracie danych sesji
    req.session.save(() => res.redirect('/'))
  } catch (err) {
    res.render('error', { user: null, message: 'Blad logowania: ' + err.message })
  }
})

// wylogowanie — niszczy sesje serwera i przekierowuje do logout keycloaka (single logout)
app.get('/logout', async (req, res) => {
  try {
    const ep      = await getEndpoints()
    const idToken = req.session.tokens?.id_token

    // najpierw zniszcz lokalna sesje
    req.session.destroy()

    // przekieruj na endpoint wylogowania keycloaka
    // id_token_hint pozwala keycloakowi zidentyfikowac sesje do usuniecia
    const params = new URLSearchParams({
      id_token_hint:            idToken,
      post_logout_redirect_uri: 'http://localhost:4000/',
    })

    res.redirect(`${ep.logout}?${params}`)
  } catch {
    res.redirect('/')
  }
})

// zatwierdzenie recenzji — dostepne dla admina i moderatora
app.post('/reviews/:id/approve', requireAuth, requireAdminOrModerator, async (req, res) => {
  const token = req.session.tokens.access_token
  try {
    await axios.patch(
      `${GATEWAY_URL}/catalog/api/reviews/${req.params.id}/approve`,
      null,
      { headers: { Authorization: `Bearer ${token}` } }
    )
  } catch (err) {
    console.error('blad zatwierdzania recenzji:', err.message)
  }
  res.redirect('/')
})

// endpoint diagnostyczny — pokazuje zawartosc sesji i podglad tokenow
app.get('/debug', (req, res) => {
  res.json({
    authenticated: !!req.session.tokens,
    user:          req.session.user || null,
    tokenPreview:  req.session.tokens
      ? [decodeJwtPayload(req.session.tokens.access_token)]
      : null,
  })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`ssr-panel dziala na http://localhost:${PORT}`)
  console.log(`keycloak: ${KEYCLOAK_URL}/realms/${REALM}`)
  console.log(`gateway:  ${GATEWAY_URL}`)
})
