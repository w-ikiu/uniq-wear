const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // czyszczenie tabel (kolejnosc odwrotna do relacji)
  await prisma.modifier.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();

  // tworzenie kategorii z produktami, wariantami i modyfikatorami
  const foodCategory = await prisma.category.create({
    data: {
      name: 'burgery',
      items: {
        create: [
          {
            name: 'cheeseburger',
            description: 'klasyczny burger z serem i wolowina.',
            variants: {
              create: [
                { sku: 'BURGER-CHEESE-STD', price: 25.00, size: 'standard' }
              ]
            },
            modifiers: {
              create: [
                { name: 'dodatkowy bekon', price: 4.50 },
                { name: 'podwojny ser', price: 3.00 }
              ]
            }
          }
        ]
      }
    }
  });

  const drinksCategory = await prisma.category.create({
    data: {
      name: 'napoje gorace',
      items: {
        create: [
          {
            name: 'caffe latte',
            description: 'delikatna kawa z duza iloscia spienionego mleka.',
            variants: {
              create: [
                { sku: 'COFFEE-LATTE-SML', price: 12.00, size: 'mala' },
                { sku: 'COFFEE-LATTE-BIG', price: 16.00, size: 'duza' }
              ]
            },
            modifiers: {
              create: [
                { name: 'mleko owsiane', price: 3.00 },
                { name: 'syrop karmelowy', price: 2.00 }
              ]
            }
          }
        ]
      }
    }
  });

  console.log('seedy menu dla kiosku dodane pomyslnie!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });