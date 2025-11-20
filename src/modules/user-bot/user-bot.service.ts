import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import {
  conversations,
  createConversation,
  ConversationFlavor,
} from '@grammyjs/conversations';
import { UserService } from '../user/user.service';
import { LeaderIdUserTokenService } from '../leader-id/leader-id-user-token.service';
import { LeaderIdApiService } from '../leader-id/leader-id-api.service';
import { Event } from '../../common/api-types';
import {
  groupSortAndNumberEvents,
  longDescriptionFromEvent,
  shortDescriptionFromEvent,
} from 'src/common/event-utils';
import { ConfigService } from '@nestjs/config';
import { AdminBotService } from '../admin-bot/admin-bot.service';

interface UserBotSessionData {
  eventFilter: {
    keyword?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
  tempDateFilter: {
    dateFrom?: Date;
    dateTo?: Date;
  };
  currentEventsCache: Event[];
  lastMessageId?: number;
}

type UserBotContext = ConversationFlavor<
  Context & SessionFlavor<UserBotSessionData>
>;

const NO_OPERATION: string = 'no_operation';

@Injectable()
export class UserBotService implements OnModuleInit {
  private bot: Bot<UserBotContext>;

  constructor(
    private userService: UserService,
    private leaderIdUserTokenService: LeaderIdUserTokenService,
    private readonly leaderIdApiService: LeaderIdApiService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AdminBotService))
    private readonly adminBotService: AdminBotService,
  ) {}

  async onModuleInit() {
    this.bot = new Bot<UserBotContext>(
      this.configService.get('TELEGRAM_USER_BOT_TOKEN'),
    );

    this.bot.use(
      session({
        initial: () => ({
          eventFilter: {},
          currentEventsCache: [],
          tempDateFilter: undefined,
          lastMessageId: undefined,
        }),
      }),
    );

    this.bot.use(conversations());

    this.bot.use(
      createConversation(
        this.filterByNameConversation.bind(this),
        'filterByName',
      ),
    );
    this.bot.use(
      createConversation(
        this.filterByDayConversation.bind(this),
        'filterByDay',
      ),
    );
    this.bot.use(
      createConversation(
        this.filterByRangeConversation.bind(this),
        'filterByRange',
      ),
    );

    this.bot.use(
      createConversation(
        this.partnershipProposalConversation.bind(this),
        'partnershipProposal',
      ),
    );

    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        await this.userService.createOrUpdateFromTelegram(ctx.from);
      }
      return next();
    });

    this.bot.command('start', async (ctx) => {
      const user = ctx.from
        ? await this.userService.findByTelegramId(ctx.from.id.toString())
        : null;

      if (user && user.leader_id_access_token) {
        return ctx.reply(
          `Привет, ${ctx.from?.first_name || 'друг'}!\n` +
            `Вы уже авторизованы через Leader-ID.`,
        );
      }

      const redirectUri = encodeURIComponent(
        `https://${this.configService.get('DOMEN_NAME')}/oauth/callback`,
      );
      const clientId = this.configService.get('LEADERID_CLIENT_ID');
      const state = ctx.from?.id;

      const url = `https://leader-id.ru/apps/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;

      const keyboard = new InlineKeyboard().url(
        'Авторизоваться через Leader-ID',
        url,
      );

      await ctx.reply(
        `Привет, ${ctx.from?.first_name || 'друг'}!\n` +
          `Чтобы записываться на мероприятия, нужно авторизоваться через Leader-ID.`,
        { reply_markup: keyboard },
      );
    });

    this.bot.command('events', async (ctx) => {
      await this.showEventSearchOptions(ctx);
    });

    this.bot.command('subscribe', async (ctx) => {
      const isSubscribed = await this.userService.isSubscribed(
        ctx.from.id.toString(),
      );

      if (isSubscribed) {
        return await ctx.reply('Вы уже подписаны на рассылку.');
      }

      await this.userService.setSubscription(ctx.from.id.toString(), true);
      await ctx.reply('Вы успешно подписались на рассылку.');
    });

    this.bot.command('unsubscribe', async (ctx) => {
      const isSubscribed = await this.userService.isSubscribed(
        ctx.from.id.toString(),
      );

      if (!isSubscribed) {
        return await ctx.reply('Вы не подписаны на рассылку.');
      }

      await this.userService.setSubscription(ctx.from.id.toString(), false);
      await ctx.reply('Вы успешно отписались от рассылки.');
    });

    this.bot.command('partnership', async (ctx) => {
      await ctx.conversation.enter('partnershipProposal');
    });

    this.bot.command('help', async (ctx) => {
      const helpText = `
Список доступных команд:
/start - Начало работы с ботом
/events - Просмотр мероприятий
/subscribe - Подписка на рассылку
/unsubscribe - Отписка от рассылки
/partnership - Заявка на партнёрство
/help - Показать это сообщение
    `.trim();

      await ctx.reply(helpText);
    });

    await this.bot.api.setMyCommands([
      { command: 'start', description: 'Начало работы с ботом' },
      { command: 'events', description: 'Просмотр мероприятий' },
      { command: 'subscribe', description: 'Подписка на рассылку' },
      { command: 'unsubscribe', description: 'Отписка от рассылки' },
      { command: 'partnership', description: 'Заявка на партнёрство' },
      { command: 'help', description: 'Показать список команд' },
    ]);

    this.registerCallbackQueryHandlers();

    this.bot.start();
  }

  private async sendOrEdit(
    ctx: UserBotContext,
    text: string,
    options: any = {},
  ) {
    try {
      if (ctx.session.lastMessageId && ctx.chat?.id) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          ctx.session.lastMessageId,
          text,
          options,
        );
      } else {
        const sentMessage = await ctx.reply(text, options);
        ctx.session.lastMessageId = sentMessage.message_id;
      }
    } catch (error) {
      const sentMessage = await ctx.reply(text, options);
      ctx.session.lastMessageId = sentMessage.message_id;
    }
  }

  private registerCallbackQueryHandlers() {
    this.bot.callbackQuery('events', async (ctx) => {
      await this.showEventSearchOptions(ctx);
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery(/events:all:(\d+)/, async (ctx) => {
      try {
        let page = parseInt(ctx.match[1]);
        if (!page || page < 1) {
          page = 1;
        }

        if (page === 1) {
          ctx.session.tempDateFilter = undefined;
        }

        await this.showEvents(ctx, page);
      } catch (e) {
        await ctx.reply('Произошла ошибка: ' + e);
      }
    });

    this.bot.callbackQuery(/events:filtered:(\d+)/, async (ctx) => {
      try {
        let page = parseInt(ctx.match[1]);
        if (!page || page < 1) {
          page = 1;
        }

        await this.showEventsWithFilters(ctx, page);
        await ctx.answerCallbackQuery().catch(() => {});
      } catch (e) {
        await ctx.reply('Произошла ошибка: ' + e);
        await ctx.answerCallbackQuery().catch(() => {});
      }
    });

    this.bot.callbackQuery('events:week', async (ctx) => {
      const now = new Date();
      const weekTo = new Date();
      weekTo.setDate(now.getDate() + 7);

      ctx.session.tempDateFilter = { dateFrom: now, dateTo: weekTo };
      await this.showEvents(ctx, 1);
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('events:month', async (ctx) => {
      const now = new Date();
      const monthTo = new Date();
      monthTo.setMonth(now.getMonth() + 1);

      ctx.session.tempDateFilter = { dateFrom: now, dateTo: monthTo };
      await this.showEvents(ctx, 1);
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery(/event:(\d+)/, async (ctx) => {
      ctx.session.lastMessageId = undefined;
      const eventId = parseInt(ctx.match[1]);
      const event = ctx.session.currentEventsCache.find(
        (event) => event.id === eventId,
      );
      if (!event) return;

      const user = await this.userService.findByTelegramId(
        ctx.from.id.toString(),
      );

      let keyboard = new InlineKeyboard();
      if (
        await this.leaderIdApiService.checkParticipation(
          eventId,
          parseInt(user.leader_id),
        )
      ) {
        keyboard = keyboard.text('Вы записаны', NO_OPERATION);
      } else {
        keyboard = keyboard.text(
          'Записаться на мероприятие',
          `send-participation:${eventId}`,
        );
      }

      keyboard = keyboard.row().text('Назад', 'events');

      await ctx.replyWithPhoto(event.photo, {
        caption: longDescriptionFromEvent(event),
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery(
      /send-participation:(\d+)/,
      this.ensureLeaderIdAuth,
      async (ctx) => {
        const eventId = parseInt(ctx.match[1]);

        const user = await this.userService.findByTelegramId(
          ctx.from.id.toString(),
        );

        try {
          if (
            await this.leaderIdApiService.checkParticipation(
              eventId,
              parseInt(user.leader_id),
            )
          ) {
            await ctx
              .answerCallbackQuery('Вы уже записаны на это мероприятие!')
              .catch(() => {});
            return;
          }
          if (user && user.leader_id_access_token) {
            await this.leaderIdApiService.sendParticipation(
              eventId,
              parseInt(user.leader_id),
            );
            const keyboard = new InlineKeyboard()
              .text('Вы записаны', NO_OPERATION)
              .row()
              .text('Назад', 'events');

            await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
            await ctx
              .answerCallbackQuery('Вы успешно записаны на мероприятие!')
              .catch(() => {});
          }
        } catch (e) {
          await ctx.reply('Произошла ошибка: ' + e);
          await ctx.answerCallbackQuery().catch(() => {});
        }
      },
    );

    this.bot.callbackQuery('events:filter', async (ctx) => {
      await this.showFilterMenu(ctx);
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('filter:name', async (ctx) => {
      await ctx.conversation.enter('filterByName');
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('filter:date', async (ctx) => {
      await this.showDateFilterType(ctx);
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('filter:date:day', async (ctx) => {
      await ctx.conversation.enter('filterByDay');
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('filter:date:range', async (ctx) => {
      await ctx.conversation.enter('filterByRange');
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('filter:date:reset', async (ctx) => {
      ctx.session.eventFilter.dateFrom = undefined;
      ctx.session.eventFilter.dateTo = undefined;
      await this.showFilterMenu(ctx);
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('filter:date:back', async (ctx) => {
      await this.showFilterMenu(ctx);
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('filter:apply', async (ctx) => {
      await this.applyFilters(ctx);
      await ctx.answerCallbackQuery().catch(() => {});
    });

    this.bot.callbackQuery('filter:reset', async (ctx) => {
      ctx.session.eventFilter = {};
      await ctx.answerCallbackQuery('Фильтры сброшены').catch(() => {});
    });

    this.bot.callbackQuery('filter:change', async (ctx) => {
      await this.showFilterMenu(ctx);
      await ctx.answerCallbackQuery().catch(() => {});
    });
  }

  private async filterByNameConversation(
    conversation: any,
    ctx: UserBotContext,
  ) {
    const msg = await ctx.reply('Введите часть названия или ключевое слово:');
    await conversation.external((ctx) => {
      ctx.session.lastMessageId = msg.message_id;
    });

    const { message } = await conversation.wait();

    if (message?.text) {
      await conversation.external(async (ctx) => {
        ctx.session.eventFilter.keyword = message.text;
        await this.showFilterMenu(ctx);
      });
    } else {
      await conversation.external(async (ctx) => {
        await this.sendOrEdit(
          ctx,
          'Не удалось получить текст. Попробуйте снова.',
        );
        await this.showFilterMenu(ctx);
      });
    }
  }

  private async filterByDayConversation(
    conversation: any,
    ctx: UserBotContext,
  ) {
    const msg = await ctx.reply('Введите дату в формате ДД.ММ.ГГГГ:');
    await conversation.external((ctx) => {
      ctx.session.lastMessageId = msg.message_id;
    });

    const { message } = await conversation.wait();

    if (message?.text) {
      const date = this.parseDate(message.text);
      if (date) {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        await conversation.external(async (ctx) => {
          ctx.session.eventFilter.dateFrom = dayStart;
          ctx.session.eventFilter.dateTo = dayEnd;
          await this.showFilterMenu(ctx);
        });
      } else {
        await conversation.external(async (ctx) => {
          await this.sendOrEdit(
            ctx,
            'Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 14.11.2025)',
          );
          await this.showFilterMenu(ctx);
        });
      }
    } else {
      await conversation.external(async (ctx) => {
        await this.sendOrEdit(
          ctx,
          'Не удалось получить дату. Попробуйте снова.',
        );
        await this.showFilterMenu(ctx);
      });
    }
  }

  private async filterByRangeConversation(
    conversation: any,
    ctx: UserBotContext,
  ) {
    const msg = await ctx.reply('Введите начальную дату (ДД.ММ.ГГГГ):');
    await conversation.external((ctx) => {
      ctx.session.lastMessageId = msg.message_id;
    });

    const { message: fromMessage } = await conversation.wait();

    if (!fromMessage?.text) {
      ctx.reply('Не удалось получить дату. Попробуйте снова.');
      await conversation.external(async (ctx) => {
        await this.showFilterMenu(ctx);
      });
      return;
    }

    const fromDate = this.parseDate(fromMessage.text);
    if (!fromDate) {
      ctx.reply('Неверный формат даты. Используйте формат ДД.ММ.ГГГГ');
      await conversation.external(async (ctx) => {
        await this.showFilterMenu(ctx);
      });
      return;
    }

    await ctx.reply('Введите конечную дату (ДД.ММ.ГГГГ):');

    const { message: toMessage } = await conversation.wait();

    if (!toMessage?.text) {
      ctx.reply('Не удалось получить дату. Попробуйте снова.');
      await conversation.external(async (ctx) => {
        await this.showFilterMenu(ctx);
      });
      return;
    }

    const toDate = this.parseDate(toMessage.text);
    if (!toDate) {
      ctx.reply('Неверный формат даты. Используйте формат ДД.ММ.ГГГГ');
      await conversation.external(async (ctx) => {
        await this.showFilterMenu(ctx);
      });
      return;
    }

    if (fromDate > toDate) {
      ctx.reply('Начальная дата не может быть позже конечной.');
      await conversation.external(async (ctx) => {
        await this.showFilterMenu(ctx);
      });
      return;
    }

    const rangeStart = new Date(fromDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(toDate);
    rangeEnd.setHours(23, 59, 59, 999);

    await conversation.external(async (ctx) => {
      ctx.session.eventFilter.dateFrom = rangeStart;
      ctx.session.eventFilter.dateTo = rangeEnd;
      await this.showFilterMenu(ctx);
    });
  }

  private parseDate(dateStr: string): Date | null {
    const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;

    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = parseInt(match[3]);

    const date = new Date(year, month, day);

    if (
      date.getDate() !== day ||
      date.getMonth() !== month ||
      date.getFullYear() !== year
    ) {
      return null;
    }

    return date;
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  private async showFilterMenu(ctx: UserBotContext) {
    const filter = ctx.session.eventFilter;

    let nameStatus = 'не выбран';
    if (filter.keyword) {
      nameStatus = `✓ выбран: "${filter.keyword}"`;
    }

    let dateStatus = 'не выбран';
    if (filter.dateFrom && filter.dateTo) {
      const fromFormatted = this.formatDate(filter.dateFrom);
      const toFormatted = this.formatDate(filter.dateTo);

      if (this.isSameDay(filter.dateFrom, filter.dateTo)) {
        dateStatus = `✓ день: ${fromFormatted}`;
      } else {
        dateStatus = `✓ интервал: ${fromFormatted} — ${toFormatted}`;
      }
    }

    const keyboard = new InlineKeyboard()
      .text(`Фильтр по названию (${nameStatus})`, 'filter:name')
      .row()
      .text(`Фильтр по дате (${dateStatus})`, 'filter:date')
      .row()
      .text('Применить фильтры', 'filter:apply')
      .row()
      .text('Сбросить фильтры', 'filter:reset')
      .row()
      .text('Главное меню', 'events');

    const text =
      `Выберите фильтр (можно несколько):\n\n` +
      `Фильтр по названию: ${nameStatus}\n` +
      `Фильтр по дате: ${dateStatus}`;

    await this.sendOrEdit(ctx, text, { reply_markup: keyboard });
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private async showDateFilterType(ctx: UserBotContext) {
    const keyboard = new InlineKeyboard()
      .text('Конкретный день', 'filter:date:day')
      .row()
      .text('Интервал дат', 'filter:date:range')
      .row()
      .text('Назад', 'filter:date:back');

    await this.sendOrEdit(ctx, 'Какой тип фильтра по дате?', {
      reply_markup: keyboard,
    });
  }

  private async applyFilters(ctx: UserBotContext) {
    const filter = ctx.session.eventFilter;

    if (!filter.keyword && !filter.dateFrom && !filter.dateTo) {
      await ctx.answerCallbackQuery('Не выбрано ни одного фильтра!');
      ctx.session.lastMessageId = undefined;
      return;
    }

    let filterSummary = 'Результаты по выбранным фильтрам:\n';

    if (filter.keyword) {
      filterSummary += `Название: ${filter.keyword}\n`;
    }

    if (filter.dateFrom && filter.dateTo) {
      const fromFormatted = this.formatDate(filter.dateFrom);
      const toFormatted = this.formatDate(filter.dateTo);

      if (this.isSameDay(filter.dateFrom, filter.dateTo)) {
        filterSummary += `Дата: ${fromFormatted}\n`;
      } else {
        filterSummary += `Период: ${fromFormatted} — ${toFormatted}\n`;
      }
    }

    await this.sendOrEdit(ctx, filterSummary);
    ctx.session.lastMessageId = undefined;
    ctx.session.tempDateFilter = {
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
    };

    await this.showEventsWithFilters(ctx, 1);
  }

  private async showEventsWithFilters(ctx: UserBotContext, page: number) {
    const filter = ctx.session.tempDateFilter || ctx.session.eventFilter;
    const keyword = ctx.session.eventFilter.keyword;

    const data = await this.leaderIdApiService.getEvents(
      page,
      {
        dateFrom: filter?.dateFrom,
        dateTo: filter?.dateTo,
      },
      keyword,
    );

    const events: Event[] = data.items;
    ctx.session.currentEventsCache = events;

    if (events.length === 0) {
      const keyboard = new InlineKeyboard()
        .text('Изменить фильтры', 'filter:change')
        .row()
        .text('Сбросить', 'filter:reset')
        .row()
        .text('Главное меню', 'events');

      await this.sendOrEdit(ctx, 'По выбранным фильтрам ничего не найдено.', {
        reply_markup: keyboard,
      });
      return;
    }

    let keyboard = new InlineKeyboard();
    events.forEach((event, index) => {
      keyboard = keyboard.text(`${index + 1}`, `event:${event.id}`);
    });

    keyboard = keyboard.row().text('<<', 'events:filtered:1');
    if (page > 1) {
      keyboard.text('<', `events:filtered:${page - 1}`);
    }
    keyboard.text(`${page}`, `events:filtered:${page}`);
    if (page < data.meta.paginationPageCount) {
      keyboard.text('>', `events:filtered:${page + 1}`);
    }

    keyboard = keyboard
      .row()
      .text('Изменить фильтры', 'filter:change')
      .row()
      .text('Сбросить', 'filter:reset')
      .row()
      .text('Главное меню', 'events');

    const text = `<b>Мероприятия:</b>\n\n${Object.entries(
      groupSortAndNumberEvents(events),
    )
      .map(([date, events]) => {
        return `<b>${date}</b>\n${events.map((event) => `${event.number}. ${shortDescriptionFromEvent(event)}\n`).join('')}\n`;
      })
      .join('')}`;

    await this.sendOrEdit(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  }

  private async showEvents(ctx: UserBotContext, page: number) {
    const filter = ctx.session.tempDateFilter || ctx.session.eventFilter;
    const data = await this.leaderIdApiService.getEvents(
      page,
      {
        dateFrom: filter?.dateFrom,
        dateTo: filter?.dateTo,
      },
      ctx.session.tempDateFilter ? null : ctx.session.eventFilter?.keyword,
    );
    const events: Event[] = data.items;
    ctx.session.currentEventsCache = events;

    let keyboard = new InlineKeyboard();
    events.forEach((event, index) => {
      keyboard = keyboard.text(`${index + 1}`, `event:${event.id}`);
    });
    keyboard = keyboard.row().text('<<', 'events:all:1');
    if (page > 1) {
      keyboard.text('<', `events:all:${page - 1}`);
    }
    keyboard.text(`${page}`, `events:all:${page}`);
    if (page < data.meta.paginationPageCount) {
      keyboard.text('>', `events:all:${page + 1}`);
    }

    keyboard = keyboard.row().text('Назад', 'events');

    const text = `<b>Мероприятия:</b>\n\n${Object.entries(
      groupSortAndNumberEvents(events),
    )
      .map(([date, events]) => {
        return `<b>${date}</b>\n${events.map((event) => `${event.number}. ${shortDescriptionFromEvent(event)}\n`).join('')}\n`;
      })
      .join('')}`;

    await this.sendOrEdit(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
    await ctx.answerCallbackQuery().catch(() => {});
  }

  private async showEventSearchOptions(ctx) {
    const eventSearchOptionsKeyboard = new InlineKeyboard()
      .text('Все мероприятия', 'events:all:1')
      .row()
      .text('На неделю', 'events:week')
      .row()
      .text('На месяц', 'events:month')
      .row()
      .text('Выбрать фильтры', 'events:filter');

    await this.sendOrEdit(ctx, 'Выберите, что вы хотите просмотреть: ', {
      reply_markup: eventSearchOptionsKeyboard,
    });
  }

  async sendNewsletter(text: string) {
    const users = await this.userService.getAllSubscribedUsers();
    try {
      await Promise.all(
        users.map((user) =>
          this.bot.api.sendMessage(user.telegram_id, text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
          }),
        ),
      );
    } catch (e) {
      console.log(e);
    }
  }

  private async partnershipProposalConversation(
    conversation,
    ctx: UserBotContext,
  ) {
    const askName = await ctx.reply('Введите ваше имя:');
    await conversation.external((ctx) => {
      ctx.session.lastMessageId = askName.message_id;
    });

    const { message: nameMessage } = await conversation.wait();
    if (!nameMessage?.text) {
      await conversation.external(async (ctx) => {
        await this.sendOrEdit(
          ctx,
          'Не удалось получить имя. Попробуйте заново.',
        );
      });
      return;
    }

    const fullName = nameMessage.text.trim();

    const askPhone = await ctx.reply(
      'Введите номер телефона (например, +79991234567):',
    );
    await conversation.external((ctx) => {
      ctx.session.lastMessageId = askPhone.message_id;
    });

    const { message: phoneMessage } = await conversation.wait();
    if (!phoneMessage?.text) {
      await conversation.external(async (ctx) => {
        await this.sendOrEdit(
          ctx,
          'Не удалось получить номер телефона. Попробуйте заново.',
        );
      });
      return;
    }

    const phone = phoneMessage.text.trim();
    const phoneRegex = /^\+?\d{10,15}$/;

    if (!phoneRegex.test(phone)) {
      await conversation.external(async (ctx) => {
        await this.sendOrEdit(
          ctx,
          'Номер телефона некорректен. Операция отменена.',
        );
      });
      return;
    }

    const askEmail = await ctx.reply('Введите адрес электронной почты:');
    await conversation.external((ctx) => {
      ctx.session.lastMessageId = askEmail.message_id;
    });

    const { message: emailMessage } = await conversation.wait();

    if (!emailMessage?.text) {
      await conversation.external(async (ctx) => {
        await this.sendOrEdit(
          ctx,
          'Не удалось получить почту. Попробуйте заново.',
        );
      });
      return;
    }

    const email = emailMessage.text.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      await conversation.external(async (ctx) => {
        await this.sendOrEdit(ctx, 'Почта некорректна. Операция отменена.');
      });
      return;
    }

    const agreementUrl = this.configService.get('PERSONAL_DATA_AGREEMENT_URL');
    const keyboard = new InlineKeyboard()
      .text('Подтверждаю', 'pp:confirm')
      .row()
      .text('Отмена', 'pp:cancel');

    const agreeMsg = await ctx.reply(
      `Перед отправкой заявки подтвердите согласие на обработку персональных данных:\n${agreementUrl}`,
      { reply_markup: keyboard },
    );

    await conversation.external((ctx) => {
      ctx.session.lastMessageId = agreeMsg.message_id;
    });

    const callback = await conversation.waitForCallbackQuery([
      'pp:confirm',
      'pp:cancel',
    ]);

    if (callback.callbackQuery.data === 'pp:cancel') {
      await conversation.external(async (ctx) => {
        await this.sendOrEdit(ctx, 'Операция отменена.');
      });
      await callback.answerCallbackQuery().catch(() => {});
      return;
    }

    await conversation.external(async (ctx) => {
      await this.adminBotService.sendPartnershipProposal(
        fullName,
        phone,
        email,
      );

      await this.sendOrEdit(ctx, 'Заявка успешно отправлена!');
    });

    await callback.answerCallbackQuery().catch(() => {});
  }

  private ensureLeaderIdAuth = async (
    ctx: UserBotContext,
    next: () => Promise<void>,
  ) => {
    if (!ctx.from) {
      return ctx.reply('Не удалось определить пользователя.');
    }

    const user = await this.userService.findByTelegramId(
      ctx.from.id.toString(),
    );
    if (!user || !user.leader_id_access_token) {
      return ctx.reply(
        'Сначала авторизуйтесь через Leader-ID, нажав кнопку в /start.',
      );
    }

    try {
      await this.leaderIdUserTokenService.getValidUserAccessToken(
        ctx.from.id.toString(),
      );
      return next();
    } catch (e) {
      return ctx.reply(
        'Ваш токен истёк. Сначала авторизуйтесь через Leader-ID заново.',
      );
    }
  };
}
