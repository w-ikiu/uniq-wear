const express = require('express');

const app = express();
const port = 4000;

// prosty chroniony endpoint api
app.get('/protected/data', (req, res) => {
    // pobieramy naglowek authorization
    const authHeader = req.headers.authorization;

    // sprawdzamy czy istnieje i czy zaczyna sie od slowa bearer
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'brak dostepu - wymagany token autoryzacyjny' 
        });
    }

    // wyluskujemy sam token pomijajac slowo bearer
    const token = authHeader.split(' ')[1];

    // w tym miejscu normalnie weryfikowalibysmy kryptograficznie podpis jwt
    // dla celow zadania po prostu zwracamy sukces i wysylamy dane
    res.json({
        data: 'oto twoje tajne dane z resource server',
        receivedToken: token // zwracamy token aby ulatwic jego skopiowanie do jwt.io
    });
});

app.listen(port, () => {
    console.log(`resource server dziala na porcie ${port}`);
});