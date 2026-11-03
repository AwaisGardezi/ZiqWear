/**
 * Seeds the platform and merges the old Ziqwear store data:
 *  - catalogue + categories from assets/js/data.js
 *  - store settings, hero slides, lookbook
 *  - existing orders from orders.json
 *  - admin account and a demo customer
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.join(ROOT, 'assets/js/data.js');
const LEGACY_ORDERS_FILE = path.join(ROOT, 'orders.json');

type LegacyProduct = {
  id: string;
  title: string;
  handle: string;
  category: string;
  subcategory?: string;
  price: number;
  compareAt?: number;
  images: string[];
  colors: string[];
  sizes: string[];
  stock: number;
  sku: string;
  description: string;
  details?: string[];
  tags?: string[];
  featured?: boolean;
  isNew?: boolean;
  sold?: number;
  active?: boolean;
  createdAt?: number;
};

type LegacyCategory = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  order?: number;
  children?: Array<{ name: string; slug: string; sub?: string }>;
};

type LegacyData = {
  settings: Record<string, any>;
  categories: LegacyCategory[];
  products: LegacyProduct[];
};

function readLegacyData(): LegacyData {
  const source = fs.readFileSync(DATA_FILE, 'utf8');
  const sandbox: { SEED_DATA?: LegacyData } = {};
  // The old storefront exposes its catalogue on `window.SEED_DATA`.
  new Function('window', source)(sandbox);
  if (!sandbox.SEED_DATA) throw new Error('Could not read catalogue from assets/js/data.js');
  return sandbox.SEED_DATA;
}

/** Old pages use `assets/...`; the API serves those from `/assets/...`. */
function publicImagePath(value?: string): string | null {
  if (!value) return null;
  return value.startsWith('http') ? value : `/${value.replace(/^\/+/, '')}`;
}

function slugSku(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Resolve a seed password from the environment.
 *
 * Hard-coded credentials in this file meant anyone reading the repo could log
 * into a store seeded with defaults. Passwords now come from
 * SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD. In production we refuse to
 * seed without them; in development we print an unmistakable warning when a
 * fallback is used.
 */
function resolveSeedPassword(envName: string, fallback: string, label: string): string {
  const value = process.env[envName];
  if (value && value.trim().length > 0) return value;

  if (IS_PRODUCTION) {
    throw new Error(
      `${envName} is required to seed ${label} in production. Refusing to create a default credential.`
    );
  }

  console.warn('');
  console.warn('==================================================================');
  console.warn(`  WARNING: ${envName} is not set.`);
  console.warn(`  Seeding ${label} with the INSECURE development fallback: "${fallback}"`);
  console.warn(`  Anyone with access to this repo can log in. Set ${envName} before deploying.`);
  console.warn('==================================================================');
  console.warn('');

  return fallback;
}

async function main() {
  console.log('Seeding ZIQWEAR platform...');

  // ---------------------------------------------------------------- admin user
  const adminPassword = resolveSeedPassword('SEED_ADMIN_PASSWORD', 'ziqwear-admin', 'the admin account');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@ziqwear.com' },
    update: {},
    create: {
      email: 'admin@ziqwear.com',
      passwordHash: adminPasswordHash,
      name: 'ZIQWEAR Admin',
      role: 'SUPER_ADMIN',
      permissions: JSON.stringify(['*']),
    },
  });
  console.log('  admin ready:', admin.email);

  // ------------------------------------------------------------ demo customer
  const customerPassword = resolveSeedPassword('SEED_CUSTOMER_PASSWORD', 'ziqwear123', 'the demo customer');
  const customerPasswordHash = await bcrypt.hash(customerPassword, 10);
  const demoCustomer = await prisma.customer.upsert({
    where: { email: 'customer@ziqwear.com' },
    update: {},
    create: {
      email: 'customer@ziqwear.com',
      passwordHash: customerPasswordHash,
      firstName: 'Demo',
      lastName: 'Customer',
      phone: '03001234567',
      isVerified: true,
      emailVerifiedAt: new Date(),
      loyaltyAccount: { create: { tier: 'SILVER', pointsBalance: 500 } },
    },
  });

  const data = readLegacyData();
  const settings = data.settings || {};

  // ----------------------------------------------------------------- settings
  await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    update: {
      storeName: settings.storeName || 'ZIQWEAR',
      tagline: settings.tagline,
      brandMeaning: settings.brandMeaning,
      contactEmail: settings.email,
      contactPhone: settings.phone,
      whatsappNumber: settings.whatsapp,
      address: settings.address,
      businessHours: settings.hours,
      currencySymbol: settings.currency || 'Rs',
      socialLinks: JSON.stringify(settings.socials || {}),
      themeColors: JSON.stringify(settings.theme || {}),
      announcementBar: JSON.stringify({ messages: settings.announcements || [] }),
      shippingSettings: JSON.stringify({
        freeShippingThreshold: settings.freeShipping ?? 5000,
        shippingFee: settings.shippingFee ?? 250,
        codFee: settings.codFee ?? 0,
      }),
      paymentSettings: JSON.stringify({ cod: true, bankTransfer: true, card: false }),
    },
    create: {
      id: 'singleton',
      storeName: settings.storeName || 'ZIQWEAR',
      tagline: settings.tagline,
      brandMeaning: settings.brandMeaning,
      contactEmail: settings.email,
      contactPhone: settings.phone,
      whatsappNumber: settings.whatsapp,
      address: settings.address,
      businessHours: settings.hours,
      currencySymbol: settings.currency || 'Rs',
      socialLinks: JSON.stringify(settings.socials || {}),
      themeColors: JSON.stringify(settings.theme || {}),
      announcementBar: JSON.stringify({ messages: settings.announcements || [] }),
      shippingSettings: JSON.stringify({
        freeShippingThreshold: settings.freeShipping ?? 5000,
        shippingFee: settings.shippingFee ?? 250,
        codFee: settings.codFee ?? 0,
      }),
      paymentSettings: JSON.stringify({ cod: true, bankTransfer: true, card: false }),
    },
  });
  console.log('  store settings imported');

  // ----------------------------------------------------------------- shipping
  const existingZone = await prisma.shippingZone.findFirst({ where: { name: 'Pakistan' } });
  if (!existingZone) {
    await prisma.shippingZone.create({
      data: {
        name: 'Pakistan',
        countries: JSON.stringify(['Pakistan']),
        isActive: true,
        rates: {
          create: [
            {
              name: 'Standard Delivery',
              price: settings.shippingFee ?? 250,
              freeShippingThreshold: settings.freeShipping ?? 5000,
              estimatedDaysMin: 2,
              estimatedDaysMax: 5,
              isActive: true,
            },
            {
              name: 'Express Delivery',
              price: 450,
              freeShippingThreshold: 10000,
              estimatedDaysMin: 1,
              estimatedDaysMax: 2,
              isActive: true,
              sortOrder: 1,
            },
          ],
        },
      },
    });
    console.log('  shipping zones created');
  }

  // --------------------------------------------------------------- categories
  const categoryIdBySlug = new Map<string, string>();

  for (const category of data.categories || []) {
    const parent = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        name: category.name,
        slug: category.slug,
        image: publicImagePath(category.image),
        sortOrder: category.order ?? 0,
        description: `${category.name} from the ZIQWEAR archive`,
      },
    });
    categoryIdBySlug.set(category.slug, parent.id);

    for (const child of category.children || []) {
      const created = await prisma.category.upsert({
        where: { slug: child.slug },
        update: {},
        create: {
          name: child.name,
          slug: child.slug,
          parentId: parent.id,
          sortOrder: 0,
          description: `${child.name} ${category.name.toLowerCase()}`,
        },
      });
      categoryIdBySlug.set(child.slug, created.id);
    }
  }
  console.log(`  ${categoryIdBySlug.size} categories imported`);

  // --------------------------------------------------------------- collections
  const dropCollection = await prisma.collection.upsert({
    where: { slug: 'drop-01-core-archive' },
    update: {},
    create: {
      name: 'Drop 01 — Core Archive',
      slug: 'drop-01-core-archive',
      description: 'The first ZIQWEAR drop. Limited pieces, no restocks.',
      image: publicImagePath('assets/img/ziq/cut-freedom.png'),
      isFeatured: true,
    },
  });

  // ----------------------------------------------------------------- products
  let productCount = 0;

  for (const legacy of data.products || []) {
    if (legacy.active === false) continue;

    const categorySlug = legacy.subcategory || legacy.category;
    const categoryId = categoryIdBySlug.get(categorySlug) || categoryIdBySlug.get(legacy.category);
    if (!categoryId) {
      console.warn(`  skipping ${legacy.handle}: no category`);
      continue;
    }

    const colors = legacy.colors?.length ? legacy.colors : ['Default'];
    const sizes = legacy.sizes?.length ? legacy.sizes : ['One Size'];
    const variantCount = colors.length * sizes.length;
    const stockPerVariant = Math.max(1, Math.ceil((legacy.stock ?? 10) / variantCount));

    const product = await prisma.product.upsert({
      where: { handle: legacy.handle },
      update: {},
      create: {
        title: legacy.title,
        handle: legacy.handle,
        description: legacy.description,
        shortDescription: legacy.details?.[0],
        sku: legacy.sku,
        categoryId,
        basePrice: legacy.price,
        compareAtPrice: legacy.compareAt ?? undefined,
        isActive: true,
        isFeatured: !!legacy.featured,
        isNewArrival: !!legacy.isNew,
        isBestseller: (legacy.sold ?? 0) >= 200,
        soldCount: legacy.sold ?? 0,
        fabric: 'Combed cotton',
        gsm: 240,
        fit: 'Oversized',
        tags: JSON.stringify(legacy.tags || []),
        careInstructions: 'Cold wash inside out. Do not iron over the print.',
        launchDate: legacy.createdAt ? new Date(legacy.createdAt) : undefined,
        createdById: admin.id,
        updatedById: admin.id,
        images: {
          create: (legacy.images || []).map((url, index) => ({
            url: publicImagePath(url) || '',
            altText: legacy.title,
            position: index,
            isPrimary: index === 0,
          })),
        },
        collections: { create: [{ collectionId: dropCollection.id }] },
      },
    });

    const existingVariants = await prisma.productVariant.count({ where: { productId: product.id } });
    if (existingVariants > 0) continue;

    let position = 0;
    for (const color of colors) {
      for (const size of sizes) {
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: `${legacy.sku}-${slugSku(color)}-${slugSku(size)}`,
            title: `${legacy.title} — ${color} / ${size}`,
            color,
            size,
            price: legacy.price,
            compareAtPrice: legacy.compareAt ?? undefined,
            position: position++,
          },
        });

        await prisma.inventory.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            quantity: stockPerVariant,
            lowStockThreshold: 5,
          },
        });
      }
    }

    productCount += 1;
  }
  console.log(`  ${productCount} products imported from the old store`);

  // -------------------------------------------------------------- hero slides
  const heroSlides: any[] = settings.heroSlides || [];
  for (let index = 0; index < heroSlides.length; index += 1) {
    const slide = heroSlides[index];
    const linkedProduct = (data.products || []).find((p) => p.id === slide.product);
    await prisma.cmsContent.upsert({
      where: { key: `hero-${index + 1}` },
      update: {},
      create: {
        key: `hero-${index + 1}`,
        type: 'hero',
        title: slide.title,
        isActive: true,
        content: JSON.stringify({
          eyebrow: slide.eyebrow,
          subtitle: slide.subtitle,
          backgroundImage: publicImagePath(slide.image),
          ctaLabel: slide.cta,
          ctaLink: linkedProduct ? `/product/${linkedProduct.handle}` : '/shop',
          word: slide.word,
          theme: slide.theme,
          price: slide.price,
          compareAt: slide.compareAt,
        }),
      },
    });
  }
  console.log(`  ${heroSlides.length} hero slides imported`);

  if (settings.lookbook?.length) {
    await prisma.cmsContent.upsert({
      where: { key: 'lookbook' },
      update: {},
      create: {
        key: 'lookbook',
        type: 'lookbook',
        title: 'Drop 01 Lookbook',
        isActive: true,
        content: JSON.stringify(settings.lookbook),
      },
    });
  }

  // ----------------------------------------------------------- legacy orders
  let importedOrders = 0;

  if (fs.existsSync(LEGACY_ORDERS_FILE)) {
    const raw = fs.readFileSync(LEGACY_ORDERS_FILE, 'utf8').replace(/^\uFEFF/, '');
    let legacyOrders: any[] = [];
    try {
      legacyOrders = JSON.parse(raw || '[]');
    } catch {
      console.warn('  orders.json could not be parsed, skipping');
    }

    for (const legacy of legacyOrders) {
      const orderNumber = String(legacy.id || `ZQ-${Date.now()}`);
      const existing = await prisma.order.findFirst({
        where: { OR: [{ orderNumber }, { legacyOrderId: orderNumber }] },
      });
      if (existing) continue;

      const customerInfo = legacy.customer || {};
      const email = (customerInfo.email || 'guest@ziqwear.com').toLowerCase();

      let customer = await prisma.customer.findUnique({ where: { email } });
      if (!customer) {
        const nameParts = String(customerInfo.name || 'Guest Customer').split(' ');
        customer = await prisma.customer.create({
          data: {
            email,
            phone: customerInfo.phone || null,
            firstName: nameParts[0] || 'Guest',
            lastName: nameParts.slice(1).join(' ') || null,
            loyaltyAccount: { create: { tier: 'SILVER' } },
          },
        });
      }

      const items = [];
      for (const legacyItem of legacy.items || []) {
        const product = await prisma.product.findFirst({
          where: {
            OR: [{ handle: legacyItem.handle }, { sku: legacyItem.sku }],
          },
          include: { variants: true },
        });
        if (!product) continue;

        const variant =
          product.variants.find(
            (v) => v.color === legacyItem.color && v.size === legacyItem.size
          ) || product.variants[0];

        const unitPrice = Number(legacyItem.price ?? product.basePrice);
        const quantity = Number(legacyItem.qty ?? 1);

        items.push({
          productId: product.id,
          variantId: variant?.id,
          title: legacyItem.title || product.title,
          sku: variant?.sku || product.sku,
          color: legacyItem.color || null,
          size: legacyItem.size || null,
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
        });
      }

      if (items.length === 0) continue;

      const status = String(legacy.status || 'pending').toUpperCase();
      const allowedStatus = [
        'PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED',
        'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED',
      ].includes(status)
        ? status
        : 'PENDING';

      const subtotal = Number(legacy.subtotal ?? items.reduce((sum, i) => sum + i.totalPrice, 0));
      const shippingTotal = Number(legacy.shipping ?? 0);

      await prisma.order.create({
        data: {
          orderNumber,
          legacyOrderId: orderNumber,
          customerId: customer.id,
          email,
          phone: customerInfo.phone || customer.phone || '0000000000',
          status: allowedStatus,
          paymentStatus: 'PENDING',
          paymentMethod: String(legacy.payment || 'cod').toUpperCase() === 'COD' ? 'COD' : 'BANK_TRANSFER',
          subtotal,
          shippingTotal,
          total: Number(legacy.total ?? subtotal + shippingTotal),
          notes: legacy.notes || null,
          shippingAddress: JSON.stringify({
            addressLine1: customerInfo.address || '',
            city: customerInfo.city || '',
            province: customerInfo.province || '',
            postalCode: customerInfo.postal || '',
            country: 'Pakistan',
            phone: customerInfo.phone || '',
            landmark: customerInfo.landmark || '',
          }),
          createdAt: legacy.createdAt ? new Date(legacy.createdAt) : new Date(),
          items: { create: items },
          statusHistory: {
            create: { status: allowedStatus, note: 'Imported from the previous Ziqwear store' },
          },
        },
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: Number(legacy.total ?? 0) },
          lastOrderAt: legacy.createdAt ? new Date(legacy.createdAt) : new Date(),
        },
      });

      importedOrders += 1;
    }
  }
  console.log(`  ${importedOrders} legacy orders imported`);

  console.log('');
  console.log('Seed complete.');
  console.log('  Admin login   : admin@ziqwear.com /', adminPassword);
  console.log('  Customer login: customer@ziqwear.com /', customerPassword);
  console.log('  Demo customer :', demoCustomer.email);
  console.log('');
  console.log('  Passwords come from SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD.');
  console.log('  In production the seed aborts unless both are set.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
