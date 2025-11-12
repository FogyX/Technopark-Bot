import { Injectable, OnModuleInit } from '@nestjs/common';
import { Bot, Context, InlineKeyboard, MiddlewareFn } from 'grammy';
import { UserService } from '../user/user.service';
import { LeaderIdTokenService } from '../leader-id/leader-id-token.service';

@Injectable()
export class UserBotService implements OnModuleInit {
  private bot: Bot<Context>;

  constructor(
    private userService: UserService,
    private leaderIdTokenService: LeaderIdTokenService,
  ) {}

  async onModuleInit() {
    this.bot = new Bot(process.env.TELEGRAM_USER_BOT_TOKEN);

    // Middleware для авто-создания пустого пользователя
    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        await this.userService.createOrUpdateFromTelegram(ctx.from);
      }
      return next();
    });

    // /start — только для неавторизованных
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
        `${process.env.LEADERID_REDIRECT_URI}/oauth/callback`,
      );
      const clientId = process.env.LEADERID_CLIENT_ID;
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

    this.bot.start();
  }

  // Middleware для команд, которым нужна авторизация Leader-ID
  ensureLeaderIdAuth(): MiddlewareFn {
    return async (ctx, next) => {
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
        await this.leaderIdTokenService.getValidAccessToken(
          ctx.from.id.toString(),
        );
        return next(); // токен действующий — продолжаем обработку команды
      } catch (e) {
        return ctx.reply(
          'Ваш токен истёк. Сначала авторизуйтесь через Leader-ID заново.',
        );
      }
    };
  }
}
