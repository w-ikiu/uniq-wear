const express = require('express');

const app = express();
const port = 4000;

app.get('/protected/data', (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'brak tokenu autoryzacyjnego' });
    }

    const token = authHeader.split(' ')[1];

    res.json({
        data: 'tajne dane z resource server',
        receivedToken: token
    });
});

app.listen(port, () => {
    console.log(`resource server dziala na porcie ${port}`);
});
