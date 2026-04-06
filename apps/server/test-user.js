require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'surajkrindian@gmail.com' } });
  console.log('USER:', u);
}
main().catch(console.error).finally(() => prisma.$disconnect());
