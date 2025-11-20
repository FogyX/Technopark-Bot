import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import {
  Conversation,
  ConversationFlavor,
  conversations,
  createConversation,
} from '@grammyjs/conversations';
import { AdminService } from '../admin/admin.service';
import { UserBotService } from '../user-bot/user-bot.service';

interface AdminSession {
  newsletterDraft?: string;
}

type AdminBotContext = ConversationFlavor<
  Context & SessionFlavor<AdminSession>
>;

@Injectable()
export class AdminBotService implements OnModuleInit {
  private bot: Bot<AdminBotContext>;

  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UserBotService))
    private readonly userBotService: UserBotService,
  ) {}

  async onModuleInit() {
    this.bot = new Bot<AdminBotContext>(
      this.configService.get('TELEGRAM_ADMIN_BOT_TOKEN'),
    );

    this.bot.use(session({ initial: (): AdminSession => ({}) }));
    this.bot.use(conversations());
    this.bot.use(
      createConversation(this.newsletterConversation.bind(this), 'newsletter'),
    );

    this.bot.command('myid', async (ctx) => {
      if (!ctx.from) return ctx.reply('Не удалось определить пользователя.');

      await ctx.reply(`Ваш Telegram ID:\n<code>${ctx.from.id}</code>`, {
        parse_mode: 'HTML',
      });
    });

    this.bot.use(this.checkAdminAccess.bind(this));

    this.bot.command('start', (ctx) => {
      ctx.reply('Добро пожаловать в админ панель!');
    });

    this.bot.command('help', async (ctx) => {
      const helpText = `
Список доступных команд:
/start - Добро пожаловать в админ панель
/myid - Показать ваш Telegram ID
/addadmin - Добавить нового администратора
/newsletter - Создать рассылку
/help - Показать это сообщение
    `.trim();

      await ctx.reply(helpText);
    });

    await this.bot.api.setMyCommands([
      { command: 'start', description: 'Добро пожаловать в админ панель' },
      { command: 'myid', description: 'Показать ваш Telegram ID' },
      { command: 'addadmin', description: 'Добавить нового администратора' },
      { command: 'newsletter', description: 'Создать рассылку' },
      { command: 'help', description: 'Показать список команд' },
    ]);

    this.bot.command('addadmin', async (ctx) => {
      const idRaw = ctx.match?.trim();

      if (!idRaw) {
        return ctx.reply(
          'Введите ID пользователя, которого хотите добавить.\nПример: /addadmin 123456789',
        );
      }

      const telegramId = idRaw.replace(/[^0-9]/g, '');

      if (!telegramId) {
        return ctx.reply('ID должен быть числом.');
      }

      if (await this.adminService.checkIfIsAdmin(telegramId)) {
        return ctx.reply('Этот пользователь уже является администратором.');
      }

      try {
        await this.adminService.createAdmin(telegramId);
        await ctx.reply(
          `Пользователь с ID ${telegramId} добавлен как администратор.`,
        );

        try {
          await ctx.api.sendMessage(
            telegramId,
            'Вы были добавлены в список администраторов.',
          );
        } catch {}
      } catch (e) {
        ctx.reply('Произошла ошибка при добавлении администратора: ' + e);
      }
    });

    this.bot.command('newsletter', async (ctx) => {
      await ctx.conversation.enter('newsletter');
    });

    this.registerNewsletterHandlers();
    this.bot.start();
  }

  private async checkAdminAccess(
    ctx: AdminBotContext,
    next: () => Promise<void>,
  ) {
    if (!ctx.from) return ctx.reply('Не удалось определить пользователя.');

    const isAdmin = await this.adminService.checkIfIsAdmin(
      ctx.from.id.toString(),
    );

    if (isAdmin) return next();
    return ctx.reply('Вы не являетесь администратором. Доступ запрещён.');
  }

  private async newsletterConversation(
    conversation: Conversation,
    ctx: AdminBotContext,
  ) {
    await ctx.reply('Введите текст рассылки:');
    const { message } = await conversation.waitFor('message:text');

    if (!message.text) {
      await ctx.reply('Не удалось получить текст. Попробуйте снова.');
      return;
    }

    await conversation.external(async (ctx: AdminBotContext) => {
      ctx.session.newsletterDraft = message.text;
    });

    const keyboard = new InlineKeyboard()
      .text('📨 Отправить', 'newsletter:send')
      .row()
      .text('✏️ Редактировать', 'newsletter:edit')
      .row()
      .text('❌ Отмена', 'newsletter:cancel');

    return ctx.reply('Предпросмотр рассылки:\n\n' + message.text, {
      reply_markup: keyboard,
    });
  }

  private registerNewsletterHandlers() {
    this.bot.callbackQuery('newsletter:send', async (ctx) => {
      const text = ctx.session.newsletterDraft;
      if (!text) return ctx.answerCallbackQuery();

      this.userBotService.sendNewsletter(text);

      ctx.session.newsletterDraft = undefined;
      await ctx.editMessageText('Рассылка успешно отправлена.');
      await ctx.answerCallbackQuery();
    });

    this.bot.callbackQuery('newsletter:edit', async (ctx) => {
      ctx.session.newsletterDraft = undefined;
      await ctx.answerCallbackQuery();
      await ctx.conversation.enter('newsletter');
    });

    this.bot.callbackQuery('newsletter:cancel', async (ctx) => {
      ctx.session.newsletterDraft = undefined;
      await ctx.editMessageText('Рассылка отменена.');
      await ctx.answerCallbackQuery();
    });
  }

  async sendPartnershipProposal(
    name: string,
    phoneNumber: string,
    email: string,
  ) {
    const admins = await this.adminService.getAdmins();

    await Promise.all(
      admins.map((admin) =>
        this.bot.api.sendMessage(
          admin.telegram_id,
          `<b>Партнёрская заявка:</b>\nИмя: ${name}\nТелефон: <code>${phoneNumber}</code>\nEmail: <code>${email}</code>`,
          { parse_mode: 'HTML' },
        ),
      ),
    );
  }
}
