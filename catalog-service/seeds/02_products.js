exports.seed = async function (knex) {

  // 1. clean (kolejnosc fk: variant -> product -> category)
  await knex('Variant').del()
  await knex('Product').del()
  await knex('Category').del()

  // 2. kategorie
  const cats = await knex('Category')
    .insert([
      { name: 'Sneakers'   },
      { name: 'Boots'      },
      { name: 'Sandały'    },
      { name: 'Bluzy'      },
      { name: 'T-shirty'   },
      { name: 'Akcesoria'  },
    ])
    .returning(['id', 'name'])

  const catId = (name) => cats.find(c => c.name === name).id

  // 3. produkty
  const productDefs = [
    // sneakers
    {
      name: 'Air Velocity Pro',
      description: 'Lekki but biegowy z karbonową wkładką i refleksyjnymi detalami. Kultowy krój lat 2000 w nowoczesnym wydaniu.',
      category: 'Sneakers', brand: 'AirStep',
      price: 399,
      colors: ['Bialy/Czarny', 'Srebrny/Rozowy', 'Czarny'],
      sizes: ['36','37','38','39','40','41','42','43'],
    },
    {
      name: 'Neon Flash 3K',
      description: 'Grubostronna sneaker w krzyczących neonach — ikona Y2K na nowo zdefiniowana. Podeszwa 4 cm, waga piórkowa.',
      category: 'Sneakers', brand: 'NeonKick',
      price: 449,
      colors: ['Hot Pink', 'Cyber Blue', 'Lime Green'],
      sizes: ['36','37','38','39','40','41','42'],
    },
    {
      name: 'Chrome Wave Runner',
      description: 'Metaliczna platforma inspirowana futurystyczną estetyką 2000. Wierzch z tkaniny refleksyjnej, podeszwa falista.',
      category: 'Sneakers', brand: 'ChromeStep',
      price: 529,
      colors: ['Chrome Silver', 'Rose Gold'],
      sizes: ['36','37','38','39','40','41','42'],
    },
    {
      name: 'Classic Court Low',
      description: 'Minimalistyczny but do koszykówki z czystą, skórzaną cholewką. Zero przesady — sto procent stylu.',
      category: 'Sneakers', brand: 'CourtKing',
      price: 299,
      colors: ['Bialy', 'Czarny', 'Granatowy'],
      sizes: ['36','37','38','39','40','41','42','43','44'],
    },
    {
      name: 'Platform Pixel',
      description: 'Chunky platforma z pikselową grafiką wytłoczoną na bocznej ścianie podeszwy. Statement piece sezonu.',
      category: 'Sneakers', brand: 'PixelKick',
      price: 479,
      colors: ['Czarny/Rozowy', 'Bialy/Niebieski'],
      sizes: ['36','37','38','39','40','41','42'],
    },
    // boots
    {
      name: 'Combat Zone Moto',
      description: 'Masywny but motocyklowy z 8 metalowymi klamrami i grubą podeszwą lug. Odwaga na co dzień.',
      category: 'Boots', brand: 'IronSole',
      price: 589,
      colors: ['Czarny', 'Brazowy'],
      sizes: ['36','37','38','39','40','41','42','43'],
    },
    {
      name: 'Chelsea Street Noir',
      description: 'Chelsea boot z elastyczną wstawką po bokach — klasyk w minimalistycznym wydaniu. Skóra naturalna.',
      category: 'Boots', brand: 'UrbanCraft',
      price: 499,
      colors: ['Czarny', 'Camel'],
      sizes: ['36','37','38','39','40','41','42','43'],
    },
    {
      name: 'Platform Punk Boot',
      description: 'Platforma 6 cm, błyszczące klamry, łańcuch przy kostce. Y2K punk energy w czystej postaci.',
      category: 'Boots', brand: 'PunkSole',
      price: 649,
      colors: ['Czarny', 'Bialy'],
      sizes: ['36','37','38','39','40','41','42'],
    },
    {
      name: 'Snow Angel Winter Boot',
      description: 'Ocieplana polarem podszewka, wodoodporna membrana TPU, podeszwa Vibram. Zimowy must-have.',
      category: 'Boots', brand: 'FrostStep',
      price: 439,
      colors: ['Kremowy', 'Czarny'],
      sizes: ['36','37','38','39','40','41','42','43'],
    },
    // sandaly
    {
      name: 'Y2K Jelly Slide',
      description: 'Kultowe żelowe klapki z ery pierwszych iPhonów — transparentne, lekkie, kultowe. Nostalgiczny must-have.',
      category: 'Sandały', brand: 'JellyPop',
      price: 129,
      colors: ['Rozowy', 'Transparentny', 'Fioletowy'],
      sizes: ['36','37','38','39','40','41','42'],
    },
    {
      name: 'Platform Butterfly Sandal',
      description: 'Sandał na 5 cm platformie z aplikacją motyla ze strassu. Lato w stylu Y2K — przebojowy i błyszczący.',
      category: 'Sandały', brand: 'ButterflyStep',
      price: 249,
      colors: ['Bialy', 'Czarny', 'Srebrny'],
      sizes: ['36','37','38','39','40','41','42'],
    },
    {
      name: 'Star Gladiator',
      description: 'Wielopasmowy sandał gladiatorowy do połowy łydki z gwiazdkami z metalu na każdym pasku.',
      category: 'Sandały', brand: 'StarSole',
      price: 199,
      colors: ['Zloty', 'Srebrny'],
      sizes: ['36','37','38','39','40','41','42','43'],
    },
    // bluzy
    {
      name: 'Chrome Zip Hoodie',
      description: 'Oversized bluza z zamkiem YKK i srebrną wykładką kieszeni. Esencja Y2K chrome aesthetic.',
      category: 'Bluzy', brand: 'ChromeWear',
      price: 259,
      colors: ['Srebrny', 'Czarny', 'Rozowy'],
      sizes: ['XS','S','M','L','XL','XXL'],
    },
    {
      name: 'Butterfly Crop Hoodie',
      description: 'Krótka bluza z haftowanym motylem na lewej piersi. Y2K romantica na każdy dzień.',
      category: 'Bluzy', brand: 'ButterflyWear',
      price: 229,
      colors: ['Liliowy', 'Rozowy', 'Czarny'],
      sizes: ['XS','S','M','L','XL'],
    },
    {
      name: 'Matrix Grid Pullover',
      description: 'Bluza z siateczkowym allover printiem w stylu Matrixa. Ciemna energia, premium french terry.',
      category: 'Bluzy', brand: 'GridWear',
      price: 279,
      colors: ['Czarny', 'Ciemna Zielen'],
      sizes: ['XS','S','M','L','XL','XXL'],
    },
    // t-shirty
    {
      name: 'Chrome Logo Tee',
      description: 'Oversized tee z metalicznym logo drukowanym folią chromowaną. Bawełna 280g. Bazowy, ale nie nudny.',
      category: 'T-shirty', brand: 'ChromeWear',
      price: 119,
      colors: ['Bialy', 'Czarny', 'Srebrny'],
      sizes: ['XS','S','M','L','XL','XXL'],
    },
    {
      name: 'Butterfly Graphic Tee',
      description: 'Y2K butterfly vintage fotowydruck na miękkim bawełniaku w stylu retro magazynu. Softgirl essential.',
      category: 'T-shirty', brand: 'ButterflyWear',
      price: 99,
      colors: ['Rozowy', 'Baby Blue', 'Bialy'],
      sizes: ['XS','S','M','L','XL'],
    },
    {
      name: 'Mesh Layer Top',
      description: 'Półprzezroczysty top z siateczki o regularnym logu. Layering piece sezonu — noś na bieliznę lub pod kurtkę.',
      category: 'T-shirty', brand: 'NeonWave',
      price: 149,
      colors: ['Czarny', 'Rozowy'],
      sizes: ['XS','S','M','L'],
    },
    // akcesoria
    {
      name: 'Star Chain Belt',
      description: 'Metaliczny łańcuch ze stali szlachetnej z charmsami w kształcie gwiazdek. Dopełnij każdy Y2K look.',
      category: 'Akcesoria', brand: 'SparkleUp',
      price: 89,
      colors: ['Srebrny', 'Zloty'],
      sizes: ['One Size'],
    },
    {
      name: 'Y2K Mini Bag',
      description: 'Maleńka torebka z metalizowanej skóry ekologicznej — mieści telefon, lip gloss i kartę. Kultowy Y2K accessory.',
      category: 'Akcesoria', brand: 'SparkleUp',
      price: 179,
      colors: ['Srebrny', 'Rozowy', 'Czarny'],
      sizes: ['One Size'],
    },
  ]

  const now = new Date()
  const products = await knex('Product')
    .insert(
      productDefs.map(p => ({
        name:        p.name,
        description: p.description,
        categoryId:  catId(p.category),
        brand:       p.brand,
        reviewCount: 0,
        createdAt:   now,
        updatedAt:   now,
      }))
    )
    .returning(['id', 'name'])

  const prodId = (name) => products.find(p => p.name === name).id

  // 4. warianty
  // stock: deterministyczny - co 7. wariant = 0 (testowanie brak w magazynie)
  function stock(idx) {
    if (idx % 7 === 0) return 0          // celowo brak
    return 2 + (idx % 9) * 2            // 2, 4, 6, 8, 10, 12, 14, 16 szt.
  }

  const allVariants = []

  productDefs.forEach(def => {
    const pid = prodId(def.name)
    // skrot sku z pierwszych liter nazwy (bez polskich znakow)
    const code = def.name
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .map(w => w[0] || '')
      .join('')
      .toUpperCase()
      .substring(0, 5)

    def.colors.forEach((color, ci) => {
      def.sizes.forEach((size, si) => {
        const idx = ci * def.sizes.length + si
        allVariants.push({
          productId: pid,
          sku:       `${code}-C${ci}-${size}`,
          price:     def.price,
          stock:     stock(idx),
          size,
          color,
        })
      })
    })
  })

  // wstaw w paczkach po 50 (bezpiecznie przy duzej liczbie)
  const CHUNK = 50
  for (let i = 0; i < allVariants.length; i += CHUNK) {
    await knex('Variant').insert(allVariants.slice(i, i + CHUNK))
  }

  // 5. raport
  console.log('\nseed complete:')
  console.log(`  categories : ${cats.length}`)
  console.log(`  products   : ${products.length}`)
  console.log(`  variants   : ${allVariants.length}`)
  console.log('\n  example skus for cart testing:')

  // one sku per category (with stock > 0)
  const examples = allVariants.filter(v => v.stock > 0)
  const seen = new Set()
  productDefs.forEach(def => {
    const pid = prodId(def.name)
    const v = examples.find(e => e.productId === pid)
    if (v && !seen.has(def.category)) {
      seen.add(def.category)
      console.log(`    [${def.category.padEnd(12)}] sku: ${v.sku.padEnd(16)} price: ${def.price} pln`)
    }
  })
  console.log('---\n')
}
