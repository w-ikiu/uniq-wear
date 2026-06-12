import { createContext, useContext, useEffect, useState } from 'react'
import Keycloak from 'keycloak-js'

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080'

// jedna instancja keycloaka wspoldzielona przez cala aplikacje
// inicjalizowana raz przy starcie — nie tworzymy nowej instancji przy kazdym renderze
const keycloak = new Keycloak({
  url: KEYCLOAK_URL,
  realm: 'uniqwear',
  clientId: 'frontend-spa',
})

// flaga modulowa — chroni przed podwojnym init() w react strict mode (dev)
// react 18 celowo montuje i odmontowuje efekty dwa razy w trybie deweloperskim
let keycloakInitialized = false

const KeycloakContext = createContext(null)

export function KeycloakProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  // ready oznacza ze keycloak skonczyl inicjalizacje (niezaleznie czy user jest zalogowany)
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (keycloakInitialized) return
    keycloakInitialized = true

    // check-sso: sprawdza przez ukryty iframe czy istnieje aktywna sesja keycloaka
    // nie przekierowuje automatycznie na strone logowania — uzytkownik klika sam
    keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      pkceMethod: 'S256',
    })
      .then(auth => {
        setAuthenticated(auth)
        if (auth) {
          setUser({
            id:    keycloak.subject,
            email: keycloak.tokenParsed?.email || '',
            name:  keycloak.tokenParsed?.preferred_username || '',
            // role realm sa w realm_access.roles w payloadzie tokenu
            roles: keycloak.tokenParsed?.realm_access?.roles || [],
          })
        }
        setReady(true)
      })
      .catch(() => {
        // blad inicjalizacji (np. keycloak niedostepny) — aplikacja dziala w trybie niezalogowanym
        setReady(true)
      })

    // automatyczne odswiezanie tokenu 60s przed wygasieciem
    // jesli odswiezenie sie nie uda — wylogowujemy uzytkownika
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(60).catch(() => keycloak.logout())
    }
  }, [])

  return (
    <KeycloakContext.Provider value={{ keycloak, authenticated, ready, user }}>
      {children}
    </KeycloakContext.Provider>
  )
}

export function useKeycloak() {
  return useContext(KeycloakContext)
}

// getter tokenu uzywany przez api.js (poza drzewem komponentow react)
export function getToken() {
  return keycloak.token || null
}
