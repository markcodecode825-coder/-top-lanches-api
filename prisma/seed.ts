import { PrismaClient, type PaymentMethodCode, type ServiceModeCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { DEFAULT_BUSINESS_ID } from '../src/config/constants';
import { env } from '../src/config/env';
import { slugify } from '../src/utils/slug';

const prisma = new PrismaClient();

type ProductSeed = {
  category: string;
  name: string;
  priceInCents: number;
  volume?: string;
};

const categories = [
  'Hambúrguer',
  'Cachorro-quente',
  'Pastéis',
  'Salgados',
  'Batata frita',
  'Cuscuz',
  'Porções',
  'Espetinhos',
  'Caldinhos',
  'Refrigerantes',
  'Refrigerantes em lata',
  'Bebidas',
  'Energéticos',
  'Cervejas',
  'Bebidas alcoólicas',
  'Garrafas',
  'Vinhos',
  'Doses'
] as const;

const products: ProductSeed[] = [
  { category: 'Hambúrguer', name: 'X-Burguer', priceInCents: 1500 },
  { category: 'Cachorro-quente', name: 'Cachorro-quente de carne moída', priceInCents: 700 },
  { category: 'Salgados', name: 'Coxinha de frango', priceInCents: 400 },
  { category: 'Salgados', name: 'Enroladinho de salsicha', priceInCents: 400 },
  { category: 'Pastéis', name: 'Pastel especial', priceInCents: 800 },
  { category: 'Pastéis', name: 'Pastel de frango com queijo', priceInCents: 700 },
  { category: 'Pastéis', name: 'Pastel de frango', priceInCents: 700 },
  { category: 'Pastéis', name: 'Pastel de carne', priceInCents: 700 },
  { category: 'Pastéis', name: 'Pastel de queijo', priceInCents: 700 },
  { category: 'Pastéis', name: 'Pastel de pizza', priceInCents: 700 },
  { category: 'Pastéis', name: 'Pastel de carne com queijo', priceInCents: 700 },
  { category: 'Cuscuz', name: 'Cuscuz de charque', priceInCents: 1500 },
  { category: 'Cuscuz', name: 'Cuscuz de calabresa', priceInCents: 1500 },
  { category: 'Batata frita', name: 'Batata frita pequena', priceInCents: 1200 },
  { category: 'Batata frita', name: 'Batata frita média', priceInCents: 1700 },
  { category: 'Batata frita', name: 'Batata cheddar, calabresa e bacon', priceInCents: 2300 },
  { category: 'Batata frita', name: 'Batata com isca de frango', priceInCents: 3500 },
  { category: 'Porções', name: 'Porção de calabresa com batata frita', priceInCents: 3000 },
  { category: 'Porções', name: 'Porção de carne de sol com batata frita', priceInCents: 3000 },
  { category: 'Espetinhos', name: 'Espetinho de carne', priceInCents: 600 },
  { category: 'Espetinhos', name: 'Espetinho de frango', priceInCents: 600 },
  { category: 'Espetinhos', name: 'Espetinho de frango com queijo', priceInCents: 600 },
  { category: 'Espetinhos', name: 'Espetinho de porco', priceInCents: 600 },
  { category: 'Caldinhos', name: 'Caldo de mocotó', priceInCents: 1500 },
  { category: 'Caldinhos', name: 'Caldo verde', priceInCents: 1500 },
  { category: 'Caldinhos', name: 'Caldo de kenga', priceInCents: 1500 },
  { category: 'Caldinhos', name: 'Caldo de camarão', priceInCents: 1500 },
  { category: 'Refrigerantes', name: 'Coca-Cola 2 L', priceInCents: 1700, volume: '2 L' },
  { category: 'Refrigerantes', name: 'Coca-Cola 1 L', priceInCents: 1000, volume: '1 L' },
  { category: 'Refrigerantes', name: 'Coca-Cola KS 290 ml', priceInCents: 500, volume: '290 ml' },
  { category: 'Refrigerantes', name: 'Guaraná 1 L', priceInCents: 1000, volume: '1 L' },
  { category: 'Refrigerantes', name: 'Fanta 1 L', priceInCents: 1000, volume: '1 L' },
  { category: 'Refrigerantes em lata', name: 'Coca-Cola lata', priceInCents: 600 },
  { category: 'Refrigerantes em lata', name: 'Guaraná lata', priceInCents: 600 },
  { category: 'Refrigerantes em lata', name: 'Fanta lata', priceInCents: 500 },
  { category: 'Refrigerantes em lata', name: 'Sprite lata', priceInCents: 500 },
  { category: 'Refrigerantes em lata', name: 'Schweppes lata', priceInCents: 600 },
  { category: 'Bebidas', name: 'Água sem gás', priceInCents: 200 },
  { category: 'Bebidas', name: 'Água com gás', priceInCents: 300 },
  { category: 'Bebidas', name: 'H2O', priceInCents: 700 },
  { category: 'Bebidas', name: 'Suco natural', priceInCents: 500 },
  { category: 'Bebidas', name: 'Pitchulinha', priceInCents: 250 },
  { category: 'Energéticos', name: 'Red Bull 250 ml', priceInCents: 1500, volume: '250 ml' },
  { category: 'Energéticos', name: 'Monster 473 ml', priceInCents: 1700, volume: '473 ml' },
  { category: 'Energéticos', name: 'Outros energéticos 473 ml', priceInCents: 1200, volume: '473 ml' },
  { category: 'Cervejas', name: 'Itaipava latão', priceInCents: 600 },
  { category: 'Cervejas', name: 'Brahma latão', priceInCents: 600 },
  { category: 'Cervejas', name: 'Império latão', priceInCents: 600 },
  { category: 'Cervejas', name: 'Antarctica latão', priceInCents: 600 },
  { category: 'Cervejas', name: 'Budweiser latão', priceInCents: 800 },
  { category: 'Cervejas', name: 'Heineken latão', priceInCents: 800 },
  { category: 'Cervejas', name: 'Sub Zero latão', priceInCents: 600 },
  { category: 'Bebidas alcoólicas', name: 'Matuta Cristal 300 ml', priceInCents: 2000, volume: '300 ml' },
  { category: 'Bebidas alcoólicas', name: 'Matuta Mel e Limão 300 ml', priceInCents: 2000, volume: '300 ml' },
  { category: 'Bebidas alcoólicas', name: 'Matuta Umburana 300 ml', priceInCents: 2000, volume: '300 ml' },
  { category: 'Bebidas alcoólicas', name: 'Matuta Banana 300 ml', priceInCents: 2000, volume: '300 ml' },
  { category: 'Bebidas alcoólicas', name: 'Matuta Bálsamo 300 ml', priceInCents: 2000, volume: '300 ml' },
  { category: 'Bebidas alcoólicas', name: 'Matuta Canela 300 ml', priceInCents: 2000, volume: '300 ml' },
  { category: 'Bebidas alcoólicas', name: 'Matuta Cristal 290 ml', priceInCents: 1200, volume: '290 ml' },
  { category: 'Garrafas', name: 'Montilla 1 L', priceInCents: 6000, volume: '1 L' },
  { category: 'Garrafas', name: 'Dreher 1 L', priceInCents: 4500, volume: '1 L' },
  { category: 'Garrafas', name: 'Matuta 1 L', priceInCents: 6000, volume: '1 L' },
  { category: 'Vinhos', name: 'Quinta do Morgado 1 L', priceInCents: 2800, volume: '1 L' },
  { category: 'Doses', name: 'Dose de Brigeiro', priceInCents: 200 },
  { category: 'Doses', name: 'Dose de Montilla', priceInCents: 500 },
  { category: 'Doses', name: 'Dose de Matuta', priceInCents: 500 },
  { category: 'Doses', name: 'Dose de Dreher', priceInCents: 500 },
  { category: 'Doses', name: 'Dose de Red Label', priceInCents: 1000 }
];

const initialHours = [
  { dayOfWeek: 1, open: '07:00', close: '16:00', priority: 1 },
  { dayOfWeek: 2, open: '07:00', close: '16:00', priority: 1 },
  { dayOfWeek: 3, open: '07:00', close: '16:00', priority: 1 },
  { dayOfWeek: 3, open: '17:00', close: '22:00', priority: 2 },
  { dayOfWeek: 4, open: '07:00', close: '16:00', priority: 1 },
  { dayOfWeek: 4, open: '17:00', close: '22:00', priority: 2 },
  { dayOfWeek: 5, open: '07:00', close: '16:00', priority: 1 },
  { dayOfWeek: 5, open: '17:00', close: '22:00', priority: 2 },
  { dayOfWeek: 6, open: '17:00', close: '22:00', priority: 1 },
  { dayOfWeek: 7, open: '17:00', close: '22:00', priority: 1 }
];

async function main(): Promise<void> {
  await prisma.business.upsert({
    where: { id: DEFAULT_BUSINESS_ID },
    update: {},
    create: {
      id: DEFAULT_BUSINESS_ID,
      name: 'Top Lanches',
      whatsapp: '5583996997272',
      whatsappFormatted: '(83) 99699-7272',
      instagram: '@toplanchess.___',
      address: 'PB-095, Chã do Marinho',
      timezone: env.BUSINESS_TIMEZONE
    }
  });

  const hoursCount = await prisma.operatingHour.count({ where: { businessId: DEFAULT_BUSINESS_ID } });
  if (hoursCount === 0) {
    await prisma.operatingHour.createMany({
      data: initialHours.map((hour) => ({ ...hour, businessId: DEFAULT_BUSINESS_ID }))
    });
  }

  const serviceModes: Array<{ code: ServiceModeCode; name: string }> = [
    { code: 'delivery', name: 'Delivery' },
    { code: 'pickup', name: 'Retirada' },
    { code: 'dine_in', name: 'Presencial' }
  ];

  for (const serviceMode of serviceModes) {
    await prisma.serviceMode.upsert({
      where: { code: serviceMode.code },
      update: {},
      create: { ...serviceMode, enabled: true }
    });
  }

  const paymentMethods: Array<{ code: PaymentMethodCode; name: string }> = [
    { code: 'PIX', name: 'Pix' },
    { code: 'CASH', name: 'Dinheiro' }
  ];

  for (const paymentMethod of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { code: paymentMethod.code },
      update: {},
      create: { ...paymentMethod, enabled: true }
    });
  }

  const categoryByName = new Map<string, string>();
  for (const [index, name] of categories.entries()) {
    const slug = slugify(name);
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        name,
        slug,
        description: null,
        imageUrl: null,
        bannerUrl: null,
        priority: index + 1,
        active: true
      }
    });
    categoryByName.set(name, category.id);
  }

  for (const [index, product] of products.entries()) {
    const categoryId = categoryByName.get(product.category);
    if (!categoryId) throw new Error(`Categoria inexistente no seed: ${product.category}`);
    const slug = slugify(product.name);
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        name: product.name,
        slug,
        categoryId,
        description: null,
        priceInCents: product.priceInCents,
        promotionalPriceInCents: null,
        imageUrl: null,
        volume: product.volume ?? null,
        unit: null,
        available: true,
        active: true,
        featured: false,
        priority: index + 1
      }
    });
  }

  await prisma.setting.upsert({
    where: { key: 'acceptOrdersWhenClosed' },
    update: {},
    create: { key: 'acceptOrdersWhenClosed', value: false }
  });

  await prisma.orderCounter.upsert({
    where: { id: 'orders' },
    update: {},
    create: { id: 'orders', value: 0 }
  });

  const adminEmail = env.ADMIN_EMAIL;
  const adminPassword = env.ADMIN_PASSWORD;
  const adminName = env.ADMIN_NAME;
  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
    await prisma.admin.create({
      data: { email: adminEmail, passwordHash, name: adminName, active: true }
    });
  }

  console.log(`Seed concluído: ${categories.length} categorias e ${products.length} produtos definidos.`);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
