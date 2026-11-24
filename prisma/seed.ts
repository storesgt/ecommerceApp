import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.ADMIN_LAST_NAME?.trim();

  if (!email || !password || !firstName || !lastName) {
    throw new Error(
      'Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME and ADMIN_LAST_NAME before seeding.'
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true
    },
    create: {
      firstName,
      lastName,
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true
    }
  });

  const objects = await prisma.category.upsert({
    where: { slug: 'objects' },
    update: {},
    create: {
      name: 'Objects',
      slug: 'objects',
      description: 'Useful objects with a point of view.'
    }
  });

  const exists = await prisma.product.findUnique({
    where: { sku: 'GROUND-001' }
  });

  if (!exists) {
    await prisma.product.create({
      data: {
        name: 'Ridge Ceramic Vase',
        slug: 'ridge-ceramic-vase',
        sku: 'GROUND-001',
        shortDescription: 'A quiet sculptural form for everyday spaces.',
        price: 64,
        status: 'ACTIVE',
        featured: true,
        categoryId: objects.id,
        images: {
          create: {
            url: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=700&q=80',
            altText: 'Ridge ceramic vase'
          }
        },
        inventory: {
          create: {
            available: 12,
            movements: {
              create: {
                type: 'RESTOCK',
                quantity: 12,
                reason: 'Seed inventory'
              }
            }
          }
        }
      }
    });
  }

  const zone = await prisma.shippingZone.upsert({
    where: { id: 'seed-zone-global' },
    update: {},
    create: {
      id: 'seed-zone-global',
      name: 'Global standard',
      countries: ['GH', 'GHANA', 'US', 'GB']
    }
  });

  await prisma.shippingMethod.upsert({
    where: { id: 'seed-shipping-standard' },
    update: {},
    create: {
      id: 'seed-shipping-standard',
      zoneId: zone.id,
      name: 'Standard delivery',
      description: 'Reliable delivery for everyday orders.',
      rateType: 'FLAT',
      flatRate: 12,
      minDays: 3,
      maxDays: 5
    }
  });

  await prisma.shippingMethod.upsert({
    where: { id: 'seed-shipping-express' },
    update: {},
    create: {
      id: 'seed-shipping-express',
      zoneId: zone.id,
      name: 'Express delivery',
      description: 'Priority delivery when you need it sooner.',
      rateType: 'WEIGHT_BASED',
      flatRate: 20,
      perKgRate: 3,
      minDays: 1,
      maxDays: 2
    }
  });

  console.log(`Seeded administrator ${admin.email} and catalog data.`);
}

main()
  .catch((error) => {
    console.error('Database seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
