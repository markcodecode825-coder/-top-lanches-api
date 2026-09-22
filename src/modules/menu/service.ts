import type { FastifyInstance } from 'fastify';
import { centsToApi, formatCents } from '../../utils/money';
import { getBusiness, getBusinessStatus } from '../business/service';

interface StaticMenuPayload {
  business: {
    name: string;
    whatsapp: string;
    whatsappFormatted: string;
    instagram: string;
    address: string;
    timezone: string;
  };
  serviceModes: Array<{ code: string; name: string; enabled: boolean }>;
  paymentMethods: Array<{ code: string; name: string; enabled: boolean }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    bannerUrl: string | null;
    priority: number;
    products: Array<Record<string, unknown>>;
  }>;
}

export async function getMenu(app: FastifyInstance) {
  let staticPayload = app.cache.get<StaticMenuPayload>('menu:static');
  if (!staticPayload) {
    const [business, serviceModes, paymentMethods, categories] = await Promise.all([
      getBusiness(app.prisma),
      app.prisma.serviceMode.findMany(),
      app.prisma.paymentMethod.findMany(),
      app.prisma.category.findMany({
        where: { active: true },
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
        include: {
          products: {
            where: { active: true, available: true },
            orderBy: [{ priority: 'asc' }, { name: 'asc' }]
          }
        }
      })
    ]);

    staticPayload = {
      business: {
        name: business.name,
        whatsapp: business.whatsapp,
        whatsappFormatted: business.whatsappFormatted,
        instagram: business.instagram,
        address: business.address,
        timezone: business.timezone
      },
      serviceModes: serviceModes
        .map(({ code, name, enabled }) => ({ code, name, enabled }))
        .sort((a, b) => ['delivery', 'pickup', 'dine_in'].indexOf(a.code) - ['delivery', 'pickup', 'dine_in'].indexOf(b.code)),
      paymentMethods: paymentMethods
        .map(({ code, name, enabled }) => ({ code, name, enabled }))
        .sort((a, b) => ['PIX', 'CASH'].indexOf(a.code) - ['PIX', 'CASH'].indexOf(b.code)),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        bannerUrl: category.bannerUrl,
        priority: category.priority,
        products: category.products.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          ...centsToApi(product.priceInCents),
          promotionalPrice: product.promotionalPriceInCents === null ? null : Number((product.promotionalPriceInCents / 100).toFixed(2)),
          promotionalPriceInCents: product.promotionalPriceInCents,
          promotionalPriceFormatted: product.promotionalPriceInCents === null ? null : formatCents(product.promotionalPriceInCents),
          imageUrl: product.imageUrl,
          volume: product.volume,
          available: product.available,
          featured: product.featured
        }))
      }))
    };
    app.cache.set('menu:static', staticPayload);
  }

  const status = await getBusinessStatus(app.prisma);
  return { ...staticPayload, status };
}
