export const NEWS_EDITIONS = {
  morning: {
    slug: 'morning',
    label: '早报',
    title: 'AI 日报·早报',
    englishLabel: 'Morning',
    releaseTime: '08:00'
  },
  afternoon: {
    slug: 'afternoon',
    label: '午后版',
    title: 'AI 日报·午后版',
    englishLabel: 'Afternoon',
    releaseTime: '16:00'
  }
};

export function getBeijingDateTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute
  };
}

export function getBeijingDateParts(date = new Date()) {
  const values = getBeijingDateTimeParts(date);

  return {
    year: values.year,
    month: values.month,
    day: values.day
  };
}

export function getBeijingDateString(date = new Date()) {
  const { year, month, day } = getBeijingDateParts(date);
  return `${year}-${month}-${day}`;
}

export function getBeijingDisplayDate(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).format(date);
}

export function getBeijingDisplayDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function inferNewsEdition(date = new Date()) {
  const hour = Number(getBeijingDateTimeParts(date).hour);
  return hour < 12 ? 'morning' : 'afternoon';
}

export function normalizeNewsEdition(edition, referenceDate = new Date()) {
  if (edition && NEWS_EDITIONS[edition]) {
    return edition;
  }

  return inferNewsEdition(referenceDate);
}

export function getEditionMeta(edition, referenceDate = new Date()) {
  const normalizedEdition = normalizeNewsEdition(edition, referenceDate);
  return NEWS_EDITIONS[normalizedEdition];
}

export function shiftDateByDays(date = new Date(), offsetDays = 0) {
  return new Date(date.getTime() + offsetDays * 24 * 60 * 60 * 1000);
}

export function getPreviousEditionInfo(date = new Date(), edition) {
  const normalizedEdition = normalizeNewsEdition(edition, date);

  if (normalizedEdition === 'afternoon') {
    return {
      edition: 'morning',
      date: date,
      dateString: getBeijingDateString(date)
    };
  }

  const previousDate = shiftDateByDays(date, -1);
  return {
    edition: 'afternoon',
    date: previousDate,
    dateString: getBeijingDateString(previousDate)
  };
}
