const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const appPort = 3000;
const apiProtectedEndpoint = 'http://localhost:4000/protected/data';

const providers = {
    keycloak: {
        clientId: 'myclient',
        clientSecret: '',
        authEndpoint: 'http://localhost:8082/realms/myrealm/protocol/openid-connect/auth',
        tokenEndpoint: 'http://keycloak:8080/realms/myrealm/protocol/openid-connect/token',
        redirectUrl: 'http://localhost:3010/myredirect',
        scope: 'openid offline_access',
    },
    okta: {
        clientId: '9ssUNN5tBijkDQ46LVFFYuCKkhJ7X4xQ',
        clientSecret: 'NWUntqrAMpibG0EPQ-U6MYWalVbYqAlXwzodrPa5VByS1U-QSI',
        authEndpoint: 'https://dev-5625qvgjlckar86k.us.auth0.com/authorize',
        tokenEndpoint: 'https://dev-5625qvgjlckar86k.us.auth0.com/oauth/token',
        redirectUrl: 'http://localhost:3010/myredirect',
        scope: 'openid',
    }
};

const pkceStore = {};

const generateRandomString = (length) =>
    crypto.randomBytes(length).toString('base64url');

const generateCodeChallenge = (verifier) =>
    crypto.createHash('sha256').update(verifier).digest('base64url');

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login/:provider', (req, res) => {
    const providerName = req.params.provider;
    const config = providers[providerName];
    if (!config) return res.status(400).send('Nieznany dostawca autoryzacji');

    const state = generateRandomString(16);
    const codeVerifier = generateRandomString(32);
    const codeChallenge = generateCodeChallenge(codeVerifier);

    pkceStore[state] = { verifier: codeVerifier, provider: providerName };

    const authUrl = `${config.authEndpoint}?response_type=code&client_id=${config.clientId}&state=${state}&redirect_uri=${encodeURIComponent(config.redirectUrl)}&code_challenge=${codeChallenge}&code_challenge_method=S256&scope=${encodeURIComponent(config.scope)}`;

    res.redirect(authUrl);
});

app.get('/myredirect', (req, res) => {
    const { code, state: returnedState } = req.query;

    const stored = pkceStore[returnedState];
    if (!stored) {
        return res.status(400).render('error', { message: 'Nieprawidłowy state — możliwe ponowne użycie kodu.' });
    }
    delete pkceStore[returnedState];

    const { verifier: codeVerifier, provider: providerName } = stored;
    const config = providers[providerName];

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', config.redirectUrl);
    params.append('client_id', config.clientId);
    if (config.clientSecret) params.append('client_secret', config.clientSecret);
    params.append('code_verifier', codeVerifier);
    params.append('code', code);

    let accessToken = '';

    axios.post(config.tokenEndpoint, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    .then(result => {
        accessToken = result.data.access_token || '';
        console.log(`[${providerName}] wymiana kodu na token zakonczona sukcesem`);
        return axios.get(apiProtectedEndpoint, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });
    })
    .then(result => {
        res.render('success', {
            provider: providerName,
            apiSuccess: result.status === 200,
            data: result.data.data,
            token: accessToken
        });
    })
    .catch(error => {
        console.error(error.response ? error.response.data : error.message);
        res.render('error', { message: 'Blad wymiany kodu na token. Szczegoly w terminalu.' });
    });
});

app.listen(appPort, () => {
    console.log(`klient dziala na porcie ${appPort}`);
});
