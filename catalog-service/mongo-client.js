const { MongoClient } = require('mongodb');

// t5: singleton mongoclient
let client;
let db;

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    // wybieramy baze - nazwa wyciagnieta z url lub domyslna
    db = client.db('uniqwear_mongo');
    console.log('polaczono z mongodb przez sterownik natywny');
    
    // t5: tworzenie indeksu tekstowego w kolekcji productdetails dla szybkiego wyszukiwania
    await db.collection('productdetails').createIndex({ long_description: "text" });
  }
  return db;
}

// t5: zamkniecie przy sigint (kiedy wylaczasz serwer np. przez ctrl+c)
process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('polaczenie natywne z mongodb zostalo zamkniete.');
    process.exit(0);
  }
});

module.exports = { connectToMongo };