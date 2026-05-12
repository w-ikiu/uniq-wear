const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();

// konfiguracja silnika szablonow ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// struktura uzytkownikow mapujaca login na hash hasla i role
const users = {
    'admin1': { hash: bcrypt.hashSync('admin123', 10), role: 'admin' },
    'admin2': { hash: bcrypt.hashSync('admin456', 10), role: 'admin' },
    'user1':  { hash: bcrypt.hashSync('user123', 10), role: 'user' },
    'user2':  { hash: bcrypt.hashSync('user456', 10), role: 'user' }
};

// middleware obslugujacy basic auth i weryfikacje rol
const authMiddleware = (requiredRole) => {
    return (req, res, next) => {
        // parsowanie naglowka authorization z formatu base64
        const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
        const [login, pass] = Buffer.from(b64auth, 'base64').toString().split(':');

        // sprawdzenie czy uzytkownik istnieje w strukturze
        if (login && pass && users[login]) {
            const user = users[login];
            
            // bezpieczne porownanie hasla z hashem
            const isPasswordValid = bcrypt.compareSync(pass, user.hash);

            if (isPasswordValid) {
                // weryfikacja uprawnien do obszaru chronionego
                // zakladamy ze admin ma rowniez dostep do strefy zwyklego uzytkownika
                if (user.role === requiredRole || user.role === 'admin') {
                    // przekazanie danych do requestu dla kolejnych funkcji
                    req.userData = { login: login, role: user.role };
                    return next();
                }
            }
        }

        // odmowa dostepu - odeslanie naglowka www-authenticate
        res.set('WWW-Authenticate', 'Basic realm="zabezpieczona strefa"');
        res.status(401).render('error', { message: 'brak dostepu lub wymagana autoryzacja' });
    };
};

// routing

// obszar publiczny - dostepny dla wszystkich bez logowania
app.get('/', (req, res) => {
    res.render('index', { title: 'Strona Główna' });
});

// obszar chroniony dla userow i adminow - prefix /user
app.use('/user', authMiddleware('user'));
app.get('/user', (req, res) => {
    res.render('dashboard', { 
        title: 'Panel Użytkownika', 
        login: req.userData.login,
        role: req.userData.role
    });
});

// obszar chroniony tylko dla adminow - prefix /admin
app.use('/admin', authMiddleware('admin'));
app.get('/admin', (req, res) => {
    res.render('dashboard', { 
        title: 'Panel Administratora', 
        login: req.userData.login,
        role: req.userData.role
    });
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`serwer uruchomiony na porcie ${PORT}`);
});