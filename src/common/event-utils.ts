import { Event } from './api-types';

export function shortDescriptionFromEvent(event: Event) {
  const name = event.full_name;
  const dateFrom = new Date(event.date_start).toLocaleDateString('ru-RU', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
  const dateTo = new Date(event.date_end).toLocaleDateString('ru-RU', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
  const date = `${dateFrom} - ${dateTo}`;
  const info = JSON.parse(event.info ?? event.full_info)
    .blocks[0].data.text.replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const isParticipationOpen =
    new Date(event.registration_date_end) > new Date();
  return `<b>${name} - ${date}</b>\n${isParticipationOpen ? '🟢' : '🔴'}\n${ellipsisByWords(info)}`;
}

function ellipsisByWords(text, maxLength = 150) {
  if (text.length <= maxLength) return text;

  let truncated = text.slice(0, maxLength);

  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    truncated = truncated.slice(0, lastSpace);
  }

  return truncated + '…';
}

export function longDescriptionFromEvent(event: Event) {
  const name = event.full_name;
  const dateFrom = new Date(event.date_start).toLocaleDateString('ru-RU', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
  const dateTo = new Date(event.date_end).toLocaleDateString('ru-RU', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
  const date = `${dateFrom} - ${dateTo}`;
  const info = JSON.parse(event.info ?? event.full_info)
    .blocks[0].data.text.replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const link = `<a href="https://leader-id.ru/events/${event.id}">Ссылка на мероприятие</a>`;
  return `<b>${name} - ${date}</b>\n\n${info}\n\n${link}`;
}

export function groupSortAndNumberEvents(events: Event[]) {
  const groupedByDate: Record<string, Event[]> = events.reduce(
    (acc, event) => {
      const dateKey = event.date_start.split(' ')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event);
      return acc;
    },
    {} as Record<string, Event[]>,
  );

  const sortedDates = Object.keys(groupedByDate).sort();

  let counter = 1;
  const sortedGroupedNumbered: Record<string, (Event & { number: number })[]> =
    {};

  for (const date of sortedDates) {
    const sortedEvents = groupedByDate[date].sort(
      (a, b) =>
        new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
    );

    sortedGroupedNumbered[date] = sortedEvents.map((event) => ({
      ...event,
      number: counter++,
    }));
  }

  return sortedGroupedNumbered;
}
