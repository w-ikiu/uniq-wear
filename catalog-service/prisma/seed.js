const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // czyszczenie tabel (kolejnosc ma znaczenie przez klucze obce)
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  // tworzenie kategorii z zagniezdonym produktem i wariantami
  const category = await prisma.category.create({
    data: {
      name: 'sneakers',
      products: {
        create: [
          {
            name: 'air max 1',
            description: 'klasyk na kazda okazje.',
            variants: {
              create: [
                { sku: 'AM1-BLU-42', price: 699.99, stock: 10, size: '42', color: 'blue' },
                { sku: 'AM1-BLU-43', price: 699.99, stock: 5, size: '43', color: 'blue' }
              ]
            }
          }
        ]
      }
    }
  });

  console.log('seedy prisma dodane!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });