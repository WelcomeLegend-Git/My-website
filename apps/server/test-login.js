require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'test_render_1@example.com' } });
  console.log('USER:', u.email, u.passwordHash);
  
  const valid = await bcrypt.compare('testpassword', u.passwordHash);
  console.log('VALID:', valid);
  
  const accessToken = jwt.sign({ sub: u.id, email: u.email }, process.env.JWT_ACCESS_SECRET, { expiresIn: '7d' });
  console.log('accessToken', accessToken);
  const refreshToken = jwt.sign({ sub: u.id, email: u.email }, process.env.JWT_REFRESH_SECRET, { expiresIn: '365d' });
  console.log('refreshToken', refreshToken);
}
main().catch(console.error).finally(() => prisma.$disconnect());
