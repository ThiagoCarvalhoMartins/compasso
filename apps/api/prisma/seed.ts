import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES } from "@compasso/shared";

const prisma = new PrismaClient();

async function main() {
  for (const category of DEFAULT_CATEGORIES) {
    const exists = await prisma.category.findFirst({ where: { userId: null, name: category.name } });
    if (!exists) await prisma.category.create({ data: { ...category, userId: null } });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: "Administrador",
        passwordHash: await bcrypt.hash(password, 12),
        role: "ADMIN",
        emailVerifiedAt: new Date(),
        settings: { create: {} },
      },
    });
    console.log(`Administrador ${email} pronto.`);
  }
  console.log("Seed concluído.");
}

main().finally(() => prisma.$disconnect());
