const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const appPort = 3000;
const apiProtectedEndpoint = 'http://localhost:4000/protected/data';

const providers = {
    keycloak: {
        clientId: 'lab4client',
        clientSecret: 'R9bEklSfQJD2cYTHqrQSgMoqbpJlQf1g',
        tokenEndpoint: 'http://keycloak:8080/realms/myrealm/protocol/openid-connect/token',
        scope: 'openid',
    },
    auth0: {
        clientId: 'sm5UQcKjGJ8TFoTRu3V6LwqoX3Yke1Vc',
        clientSecret: '_xWOTISr5LATi-G85Ab8sSGMoNZaO7LMgld9QgSAUp8aVwPOE8idHj4joT5t2gVT',
        tokenEndpoint: 'https://dev-5625qvgjlckar86k.us.auth0.com/oauth/token',
        audience: 'https://lab4',
    }
};

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/fetch/:provider', async (req, res) => {
    const providerName = req.params.provider;
    const config = providers[providerName];

    if (!config) return res.status(400).send('Nieznany dostawca');

    try {
        // krok 1: pobierz token bezposrednio (bez udzialu uzytkownika)
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', config.clientId);
        params.append('client_secret', config.clientSecret);
        if (config.scope) params.append('scope', config.scope);
        if (config.audience) params.append('audience', config.audience);

        const tokenResponse = await axios.post(config.tokenEndpoint, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;
        console.log(`[${providerName}] token pobrany pomyslnie`);

        // krok 2: uzyj tokenu do wywolania chronionego api
        const apiResponse = await axios.get(apiProtectedEndpoint, {
            headers: { 'Authorization': 'Bearer ' + accessToken }
        });

        res.render('result', {
            provider: providerName,
            apiSuccess: apiResponse.status === 200,
            data: apiResponse.data.data,
            token: accessToken
        });

    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        res.render('error', { message: 'Blad podczas pobierania tokenu. Szczegoly w terminalu.' });
    }
});

app.listen(appPort, () => {
    console.log(`klient dziala na porcie ${appPort}`);
});
