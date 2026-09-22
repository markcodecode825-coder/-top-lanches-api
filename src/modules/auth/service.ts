import type { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { AppError } from '../../errors/app-error';

export async function validateAdminCredentials(prisma: PrismaClient, email: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin?.active) throw new AppError('UNAUTHORIZED', 401, 'E-mail ou senha inválidos');
  const valid = await argon2.verify(admin.passwordHash, password);
  if (!valid) throw new AppError('UNAUTHORIZED', 401, 'E-mail ou senha inválidos');
  return { id: admin.id, email: admin.email, name: admin.name };
}

export function durationToSeconds(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) return 3600;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  return amount * 86400;
}
