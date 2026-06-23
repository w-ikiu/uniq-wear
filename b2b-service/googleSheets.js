const { google } = require('googleapis')
const path = require('path')

const SCOPES        = ['https://www.googleapis.com/auth/spreadsheets']
const KEY_FILE      = path.join(__dirname, 'google-service-account.json')
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID

// tworzy autoryzowanego klienta google uzywa service account (bez udzialu uzytkownika)
async function getSheets() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES })
  const client = await auth.getClient()
  return google.sheets({ version: 'v4', auth: client })
}

// zapisuje raport magazynowy do arkusza google sheets
// nadpisuje zawartosc od komorki A1 — kazdy eksport to swiezy zrzut stanu
async function exportReportToSheets(report) {
  const sheets = await getSheets()

  const now = new Date(report.generatedAt).toLocaleString('pl-PL')

  // naglowek + metadane
  const header = [
    ['UniqWear — Raport Magazynowy'],
    [`Wygenerowano: ${now}`],
    [`Produktow lacznie: ${report.summary.totalProducts}`, `Stan lacznie: ${report.summary.totalStock} szt.`],
    [],
    ['ID', 'Nazwa', 'Kategoria', 'Cena od (zl)', 'Srednia ocena', 'Liczba recenzji'],
  ]

  // wiersze produktow
  const rows = report.products.map(p => [
    p.id,
    p.name,
    p.category || '',
    p.minPrice || '',
    p.rating?.avg ?? '',
    p.rating?.count ?? '',
  ])

  const values = [...header, ...rows]

  // wyczysc arkusz i wpisz swiezy raport
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A1:Z1000',
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })

  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`
}

module.exports = { exportReportToSheets }
