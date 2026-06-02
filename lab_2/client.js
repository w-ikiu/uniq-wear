const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const appPort = 3000;

// KONFIGURACJA
// te dane bedziesz podmieniac w zaleznosci od tego czy testujesz keycloak czy okta
const config = {
    clientId: 'myclient',
    clientSecret: '',
    authEndpoint: 'http://localhost:8080/realms/myrealm/protocol/openid-connect/auth',
    tokenEndpoint: 'http://keycloak:8080/realms/myrealm/protocol/openid-connect/token',
    redirectUrl: 'http://localhost:3005/myredirect',
    apiProtectedEndpoint: 'http://localhost:4000/protected/data'
};

// tymczasowy magazyn w pamieci do przechowywania code_verifier
// uzywamy parametru 'state' jako klucza aby powiazac verifier z konkretnym logowaniem
const pkceStore = {};

// funkcje kryptograficzne do generowania wymagan pkce
// uzywamy base64url zgodnie ze specyfikacja (zastepujemy znaki +, / oraz usuwamy =)
const generateRandomString = (length) => {
    return crypto.randomBytes(length).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const generateCodeChallenge = (verifier) => {
    return crypto.createHash('sha256').update(verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

app.get('/', (req, res) => {
    // 1. generujemy nowe parametry dla kazdego wejscia uzytkownika (wymog zadania)
    const state = generateRandomString(16);
    const codeVerifier = generateRandomString(32);
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // 2. zapisujemy verifier w pamieci przypisujac go do wygenerowanego state
    pkceStore[state] = codeVerifier;

    // 3. budujemy urla do logowania u dostawcy tozsamosci
    // dodalismy scope openid aby uzyskac odpowiedni rodzaj tokenu
    const authRequest = `${config.authEndpoint}?response_type=code&client_id=${config.clientId}&state=${state}&redirect_uri=${config.redirectUrl}&code_challenge=${codeChallenge}&code_challenge_method=S256&scope=openid offline_access`;

    res.set('Content-Type', 'text/html');
    res.send(`
    <!DOCTYPE html>
    <body>
    <h2>witaj w aplikacji klienta</h2>
    <div>
    <a href="${authRequest}">zaloguj sie przez serwer autoryzacyjny</a>
    </div>
    </body>
    </html>
    `);
});

app.get('/myredirect', (req, res) => {
    const code = req.query.code;
    const returnedState = req.query.state;

    // 4. odzyskujemy verifier ze store na podstawie zwroconego parametru state
    const codeVerifier = pkceStore[returnedState];

    if (!codeVerifier) {
        return res.status(400).send('blad: nie znaleziono parametru code_verifier dla tego zadania. mozliwe ponowne wykorzystanie kodu.');
    }

    // 5. usuwamy verifier z pamieci (moze byc uzyty tylko raz wg wytycznych bezpieczenstwa)
    delete pkceStore[returnedState];

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', config.redirectUrl);
    params.append('client_id', config.clientId);
    // client_secret moze byc wymagany zaleznie od konfiguracji klienta na serwerze (public vs confidential)
    if (config.clientSecret) {
        params.append('client_secret', config.clientSecret);
    }
    params.append('code_verifier', codeVerifier);
    params.append('code', code);

    let accessToken = '';

    // 6. wysylamy kod do serwera auth aby otrzymac token
    axios.post(config.tokenEndpoint, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    .then(result => {
        accessToken = result.data.access_token || '';
        console.log("rezultat wymiany kodu na token uzyskany z serwera:");
        console.log(result.data);

        // 7. wysylamy odebrany token jako bearer do naszego wlasnego api (resource server)
        return axios.get(config.apiProtectedEndpoint, {
            headers: {
                'Authorization': 'Bearer ' + accessToken
            }
        });
    })
    .then(result => {
        let success = result.status === 200;
        
        res.set('Content-Type', 'text/html');
        res.send(`
        <!DOCTYPE html>
        <body>
        <h2>sukces logowania! zapytanie do api: ${success}</h2>
        <p><b>dane zwrocone przez chronione api:</b> ${result.data.data}</p>
        <hr>
        <p>skopiuj ponizszy token i sprawdz go na stronie <a href="https://jwt.io" target="_blank">jwt.io</a></p>
        <textarea rows="6" cols="80">${accessToken}</textarea>
        </body>
        </html>
        `);
    })
    .catch(error => {
        console.log(error.response ? error.response.data : error.message);
        res.set('Content-Type', 'text/html');
        res.send(`
        <!DOCTYPE html>
        <body>
        <h2>wystapil blad</h2>
        <p>sprawdz konsole serwera (terminal) aby zobaczyc szczegoly.</p>
        </body>
        </html>
        `);
    });
});

app.listen(appPort, () => {
    console.log(`klient (front-end) dziala na porcie ${appPort}`);
});