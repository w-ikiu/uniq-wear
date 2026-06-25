require('dotenv').config()
const express              = require('express')
const axios                = require('axios')
const { exportReportToSheets } = require('./googleSheets')

const app = express()
app.use(express.json())

const KEYCLOAK_URL  = process.env.KEYCLOAK_URL  || 'http://localhost:8080'
const REALM         = process.env.KEYCLOAK_REALM || 'uniqwear'
const CLIENT_ID     = 'b2b-service'
// sekret klienta — w b2b nie ma uzytkownika, tylko klient sie uwierzytelnia
const CLIENT_SECRET = process.env.CLIENT_SECRET  || 'b2b-service-secret-dev'
const GATEWAY_URL   = process.env.GATEWAY_URL    || 'http://localhost:3000'
const TOKEN_URL     = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`

// cache tokenu — pobieramy nowy tylko gdy stary wygasa
let cachedToken     = null
let tokenExpiresAt  = 0

// client credentials flow — serwis uwierzytelnia sie wlasnymi danymi, bez udzialu uzytkownika
// odpowiednik "klucza api" w swiecie oauth2
async function getToken() {
  const now = Math.floor(Date.now() / 1000)
  // zwroc cachedowany token jesli wazny przez co najmniej 30 sekund
  if (cachedToken && now < tokenExpiresAt - 30) return cachedToken

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const res = await axios.post(TOKEN_URL, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 5000,
  })

  cachedToken    = res.data.access_token
  tokenExpiresAt = now + res.data.expires_in
  return cachedToken
}

// pobierz zasob z gateway z aktualnym tokenem
async function apiGet(path) {
  const token = await getToken()
  const res   = await axios.get(`${GATEWAY_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5000,
  })
  return res.data
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'b2b-service' }))

// glowny endpoint — generuje raport magazynowy
// wywolywany przez inne systemy (np. ERP, WMS) w trybie maszyna-do-maszyny
app.get('/report', async (req, res) => {
  try {
    // rownolegle pobieramy dane z gateway (token odswiezony automatycznie jesli wygasl)
    const [products, stats, analytics] = await Promise.all([
      apiGet('/catalog/api/products'),
      apiGet('/catalog/api/stats/inventory'),
      apiGet('/catalog/api/analytics/ratings'),
    ])

    // budujemy raport — laczenie danych z postgres (produkty, stany) i mongodb (oceny)
    const ratingsMap = Object.fromEntries(
      analytics.map(a => [a.productId, { avg: a.averageRating, count: a.reviewCount }])
    )

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalProducts:  products.length,
        totalStock:     stats.reduce((s, c) => s + c.totalStock, 0),
        categoriesCount: stats.length,
      },
      inventoryByCategory: stats,
      products: products.map(p => ({
        id:           p.id,
        name:         p.name,
        category:     p.categoryName,
        minPrice:     p.minPrice,
        rating:       ratingsMap[p.id] || null,
      })),
    }

    // format: json domyslnie, ?format=text dla czytelnej wersji
    if (req.query.format === 'text') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      return res.send(formatTextReport(report))
    }

    res.json(report)
  } catch (err) {
    const status = err.response?.status || 500
    res.status(status).json({
      error:   'blad generowania raportu',
      details: err.message,
    })
  }
})

// endpoint diagnostyczny — pokazuje informacje o tokenie bez jego ujawniania
app.get('/token-info', async (req, res) => {
  try {
    const token   = await getToken()
    // dekodujemy payload jwt bez weryfikacji (token juz zweryfikowany przez gateway)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    res.json({
      client_id:  payload.azp,
      expires_at: new Date(payload.exp * 1000).toISOString(),
      issued_at:  new Date(payload.iat * 1000).toISOString(),
      roles:      payload.realm_access?.roles || [],
      scope:      payload.scope,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// eksportuje raport do google sheets i zwraca link do arkusza
app.post('/report/export', async (req, res) => {
  try {
    const [products, stats, analytics] = await Promise.all([
      apiGet('/catalog/api/products'),
      apiGet('/catalog/api/stats/inventory'),
      apiGet('/catalog/api/analytics/ratings'),
    ])

    const ratingsMap = Object.fromEntries(
      analytics.map(a => [a.productId, { avg: a.averageRating, count: a.reviewCount }])
    )

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalProducts:  products.length,
        totalStock:     stats.reduce((s, c) => s + c.totalStock, 0),
        categoriesCount: stats.length,
      },
      inventoryByCategory: stats,
      products: products.map(p => ({
        id:       p.id,
        name:     p.name,
        category: p.categoryName,
        minPrice: p.minPrice,
        rating:   ratingsMap[p.id] || null,
      })),
    }

    const url = await exportReportToSheets(report)
    res.json({ success: true, spreadsheetUrl: url, exportedAt: report.generatedAt })
  } catch (err) {
    const status = err.response?.status || 500
    res.status(status).json({ error: 'blad eksportu do google sheets', details: err.message })
  }
})

function formatTextReport(report) {
  const lines = [
    '=== RAPORT MAGAZYNOWY UNIQWEAR ===',
    `Wygenerowano: ${report.generatedAt}`,
    '',
    '--- PODSUMOWANIE ---',
    `Produktow: ${report.summary.totalProducts}`,
    `Laczny stan: ${report.summary.totalStock} szt.`,
    `Kategorii:  ${report.summary.categoriesCount}`,
    '',
    '--- STANY WG KATEGORII ---',
    ...report.inventoryByCategory.map(c => `  Kategoria #${c.categoryId}: ${c.totalStock} szt.`),
    '',
    '--- PRODUKTY ---',
    ...report.products.map(p => {
      const rating = p.rating ? ` | ocena: ${p.rating.avg} (${p.rating.count} rec.)` : ''
      return `  [${p.id}] ${p.name} | ${p.category} | od ${p.minPrice} zl${rating}`
    }),
  ]
  return lines.join('\n')
}

const PORT          = process.env.PORT || 4001
// interwal auto-eksportu w ms — domyslnie co godzine
const EXPORT_INTERVAL_MS = parseInt(process.env.EXPORT_INTERVAL_MS) || 60 * 60 * 1000

async function autoExport() {
  try {
    const [products, stats, analytics] = await Promise.all([
      apiGet('/catalog/api/products'),
      apiGet('/catalog/api/stats/inventory'),
      apiGet('/catalog/api/analytics/ratings'),
    ])
    const ratingsMap = Object.fromEntries(
      analytics.map(a => [a.productId, { avg: a.averageRating, count: a.reviewCount }])
    )
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalProducts:   products.length,
        totalStock:      stats.reduce((s, c) => s + c.totalStock, 0),
        categoriesCount: stats.length,
      },
      inventoryByCategory: stats,
      products: products.map(p => ({
        id:       p.id,
        name:     p.name,
        category: p.categoryName,
        minPrice: p.minPrice,
        rating:   ratingsMap[p.id] || null,
      })),
    }
    const url = await exportReportToSheets(report)
    console.log(`auto-eksport do sheets: ${url}`)
  } catch (err) {
    console.error('blad auto-eksportu:', err.message)
  }
}

app.listen(PORT, () => {
  console.log(`b2b-service dziala na http://localhost:${PORT}`)
  console.log(`token endpoint: ${TOKEN_URL}`)
  console.log(`gateway:        ${GATEWAY_URL}`)
  // auto-eksport uruchamia sie co EXPORT_INTERVAL_MS
  setInterval(autoExport, EXPORT_INTERVAL_MS)
  console.log(`auto-eksport co ${EXPORT_INTERVAL_MS / 60000} min`)
})
