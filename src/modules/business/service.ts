import type { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { DEFAULT_BUSINESS_ID } from '../../config/constants';
import { AppError } from '../../errors/app-error';
import { timeToMinutes } from '../../utils/time';

export async function getBusiness(prisma: PrismaClient) {
  const business = await prisma.business.findUnique({ where: { id: DEFAULT_BUSINESS_ID } });
  if (!business) throw new AppError('BUSINESS_NOT_FOUND', 404, 'Estabelecimento não encontrado');
  return business;
}

export async function getGroupedHours(prisma: PrismaClient) {
  const hours = await prisma.operatingHour.findMany({
    where: { businessId: DEFAULT_BUSINESS_ID },
    orderBy: [{ dayOfWeek: 'asc' }, { open: 'asc' }, { priority: 'asc' }]
  });

  return Array.from({ length: 7 }, (_, index) => {
    const dayOfWeek = index + 1;
    return {
      dayOfWeek,
      periods: hours
        .filter((hour) => hour.dayOfWeek === dayOfWeek)
        .map((hour) => ({ open: hour.open, close: hour.close }))
    };
  });
}

export async function getBusinessStatus(prisma: PrismaClient, referenceNow?: DateTime) {
  const business = await getBusiness(prisma);
  const zone = business.timezone;
  const now = (referenceNow ?? DateTime.now()).setZone(zone);
  if (!now.isValid) throw new Error(`Timezone inválido no estabelecimento: ${zone}`);

  const hours = await prisma.operatingHour.findMany({
    where: { businessId: business.id },
    orderBy: [{ dayOfWeek: 'asc' }, { open: 'asc' }, { priority: 'asc' }]
  });

  const currentMinutes = now.hour * 60 + now.minute;
  const todayPeriods = hours.filter((hour) => hour.dayOfWeek === now.weekday);

  for (const period of todayPeriods) {
    const open = timeToMinutes(period.open);
    const close = timeToMinutes(period.close);
    if (currentMinutes >= open && currentMinutes < close) {
      return {
        isOpen: true,
        status: 'OPEN' as const,
        message: 'Aberto agora',
        closesAt: period.close,
        nextOpeningAt: null
      };
    }
    if (currentMinutes < open) {
      return {
        isOpen: false,
        status: 'CLOSED' as const,
        message: 'Fechado agora',
        closesAt: null,
        nextOpeningAt: period.open
      };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidateDate = now.plus({ days: offset });
    const nextPeriod = hours.find((hour) => hour.dayOfWeek === candidateDate.weekday);
    if (!nextPeriod) continue;
    const [hourText = '0', minuteText = '0'] = nextPeriod.open.split(':');
    const opening = candidateDate.set({
      hour: Number(hourText),
      minute: Number(minuteText),
      second: 0,
      millisecond: 0
    });
    return {
      isOpen: false,
      status: 'CLOSED' as const,
      message: 'Fechado agora',
      closesAt: null,
      nextOpeningAt: opening.toISO()
    };
  }

  return {
    isOpen: false,
    status: 'CLOSED' as const,
    message: 'Fechado agora',
    closesAt: null,
    nextOpeningAt: null
  };
}

export async function isAcceptingOrdersWhenClosed(prisma: PrismaClient): Promise<boolean> {
  const setting = await prisma.setting.findUnique({ where: { key: 'acceptOrdersWhenClosed' } });
  return setting?.value === true;
}
