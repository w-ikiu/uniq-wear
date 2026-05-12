const express = require('express');
const basicAuth = require('express-basic-auth');

// tworzymy instancję aplikacji
const app = express();
const port = 3000;

// konfiguracja logowania
// haslo: cat
app.use(basicAuth({
    users: { 'admin': 'cat' },
    challenge: true,
    // wiadomosc przy blednym logowaniu
    unauthorizedResponse: 'brak dostepu'
}));

// glowny adres api
app.get('/api/data', (req, res) => {
    // odpowiedz po udanym logowaniu
    res.json({
        message: 'udalo sie zalogowac!',
        status: 'ok'
    });
});

// wlaczamy serwer
app.listen(port, () => {
    console.log(`serwer dziala na porcie ${port}`);
});

// co w konsoli:

// najpierw w jednym terminalu uruchomienie serwera:
// node server.js

// w drugim terminalu:
// chelm@wika MINGW64 ~/OneDrive/Desktop/lab_1
// $ curl http://localhost:3000/api/data
// brak dostepu

// chelm@wika MINGW64 ~/OneDrive/Desktop/lab_1
// $ curl -u admin:cat http://localhost:3000/api/data
// {"message":"udalo sie zalogowac!","status":"ok"}

// chelm@wika MINGW64 ~/OneDrive/Desktop/lab_1
// $ curl -u admin:cats http://localhost:3000/api/data
// brak dostepu