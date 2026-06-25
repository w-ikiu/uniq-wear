require('dotenv').config()
const express = require('express')
const session = require('express-session')
const axios   = require('axios')
const crypto  = require('crypto')

const app = express()
app.set('view engine', 'ejs')
app.set('views', './views')
app.use(express.urlencoded({ extended: false }))

const KEYCLOAK_URL  = process.env.KEYCLOAK_URL    || 'http://localhost:8080'
// publiczny adres keycloaka — uzywany do redirectow przegladarki (auth, logout)
// rozny od KEYCLOAK_URL ktory wskazuje na kontener w sieci docker
const KC_PUBLIC_URL = process.env.KC_PUBLIC_URL   || 'http://localhost:8080'
const REALM         = process.env.KEYCLOAK_REALM  || 'uniqwear'
const CLIENT_ID     = 'ssr-panel'
// sekret klienta — przechowywany tylko po stronie serwera, nigdy nie trafia do przegladarki
const CLIENT_SECRET = process.env.CLIENT_SECRET   || 'ssr-panel-secret-dev'
const REDIRECT_URI  = process.env.REDIRECT_URI    || 'http://localhost:4000/callback'
const GATEWAY_URL   = process.env.GATEWAY_URL     || 'http://localhost:3000'
// dane admina keycloaka — uzywane do wywolan admin rest api (zarzadzanie uzytkownikami)
const KC_ADMIN_USER = process.env.KC_ADMIN      || 'admin'
const KC_ADMIN_PASS = process.env.KC_ADMIN_PASS || 'admin'
// role aplikacyjne dostepne do przypisania
const APP_ROLES     = ['admin', 'moderator', 'user']

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

// keycloak 24 ma bug w discovery endpoint przy wywolaniach z sieci docker (requestHost is null)
// endpointy sa zawsze pod tymi samymi sciezkami — pomijamy discovery call
// auth i logout uzywaja KC_PUBLIC_URL bo przeglądarka jest tam przekierowywana
// token uzywaja KEYCLOAK_URL (wywolanie serwer-serwer przez siec docker)
function getEndpoints() {
  const pub  = `${KC_PUBLIC_URL}/realms/${REALM}/protocol/openid-connect`
  const priv = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect`
  return {
    auth:   `${pub}/auth`,
    token:  `${priv}/token`,
    logout: `${pub}/logout`,
  }
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

// pobiera token admina z realmu master — potrzebny do keycloak admin rest api
// token uzytkownika z realmu uniqwear nie ma uprawnien do admin api
async function getAdminToken() {
  const res = await axios.post(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: 'password',
      client_id:  'admin-cli',
      username:   KC_ADMIN_USER,
      password:   KC_ADMIN_PASS,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
  )
  return res.data.access_token
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

// middleware — wymaga roli admin
function requireAdmin(req, res, next) {
  const roles = req.session.user?.roles || []
  if (!roles.includes('admin')) {
    return res.status(403).render('error', {
      user:    req.session.user,
      message: 'Brak uprawnien — wymagana rola admin.',
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
    let orders = [], stats = [], analytics = [], users = []
    // moderator pobiera tylko recenzje — nie ma dostepu do zamowien i statystyk
    const pendingReviews = await apiGet('/catalog/api/reviews?status=pending', token)

    if (isAdmin) {
      // admin pobiera dane aplikacyjne i liste uzytkownikow rownolegле
      const [appData, adminToken] = await Promise.all([
        Promise.all([
          apiGet('/checkout/api/orders', token).then(d => d.slice(0, 10)),
          apiGet('/catalog/api/stats/inventory', token),
          axios.get(`${GATEWAY_URL}/catalog/api/analytics/ratings`, { timeout: 5000 }).then(r => r.data.slice(0, 10)),
        ]),
        getAdminToken(),
      ])
      ;[orders, stats, analytics] = appData

      // pobierz liste uzytkownikow z keycloak admin api
      const usersRes = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users?max=50`,
        { headers: { Authorization: `Bearer ${adminToken}` }, timeout: 5000 }
      )

      // dla kazdego uzytkownika pobierz jego role (rownolegле)
      users = await Promise.all(usersRes.data.map(async u => {
        const rolesRes = await axios.get(
          `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${u.id}/role-mappings/realm`,
          { headers: { Authorization: `Bearer ${adminToken}` }, timeout: 5000 }
        )
        const appRoles = rolesRes.data
          .filter(r => APP_ROLES.includes(r.name))
          .map(r => r.name)
        return { id: u.id, username: u.username, email: u.email || '', enabled: u.enabled, roles: appRoles }
      }))
    }

    res.render('dashboard', {
      user:    req.session.user,
      isAdmin,
      orders,
      reviews: pendingReviews.slice(0, 20),
      stats,
      analytics,
      users,
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

// przypisanie roli uzytkownikowi — tylko admin, przez keycloak admin api
app.post('/users/:id/role/add', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body
  if (!APP_ROLES.includes(role)) return res.redirect('/')
  try {
    const adminToken = await getAdminToken()
    // pobierz obiekt roli zeby uzyskac jej id — keycloak wymaga id przy przypisaniu
    const roleRes = await axios.get(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role}`,
      { headers: { Authorization: `Bearer ${adminToken}` }, timeout: 5000 }
    )
    await axios.post(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${req.params.id}/role-mappings/realm`,
      [roleRes.data],
      { headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('blad przypisywania roli:', err.message)
  }
  res.redirect('/')
})

// usuniecie roli uzytkownikowi — z ochrona: zawsze musi istniec co najmniej jeden admin
app.post('/users/:id/role/remove', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body
  if (!APP_ROLES.includes(role)) return res.redirect('/')
  try {
    const adminToken = await getAdminToken()

    // zabezpieczenie — nie pozwol usunac roli admin jesli to ostatni administrator
    if (role === 'admin') {
      const adminsRes = await axios.get(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/admin/users`,
        { headers: { Authorization: `Bearer ${adminToken}` }, timeout: 5000 }
      )
      if (adminsRes.data.length <= 1) {
        return res.status(400).render('error', {
          user:    req.session.user,
          message: 'Nie mozna usunac roli admin — musi istniec co najmniej jeden administrator.',
        })
      }
    }

    const roleRes = await axios.get(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role}`,
      { headers: { Authorization: `Bearer ${adminToken}` }, timeout: 5000 }
    )
    await axios.delete(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${req.params.id}/role-mappings/realm`,
      {
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        data:    [roleRes.data],
      }
    )
  } catch (err) {
    console.error('blad usuwania roli:', err.message)
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
