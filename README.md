Вот пример структурированной документации в формате Markdown (`README.md` или `DEPLOY.md`), составленной на основе ваших требований.

---

# Инструкция по развертыванию и эксплуатации

Данная инструкция описывает процесс подготовки внешних сервисов, настройку окружения, сборку Docker-образа и запуск приложения на сервере.

## 1. Подготовка внешних сервисов

Перед настройкой сервера необходимо получить ключи доступа от LeaderID и Telegram.

### 1.1. LeaderID
1. Перейдите на портал разработчиков: [https://leader-id.ru/developers](https://leader-id.ru/developers).
2. Авторизуйтесь и создайте **новое приложение**.
3. Заполните форму создания.
4. Выпустите ключ типа **oAuth**.
5. В настройках укажите **домен вашего сервера** (например, `https://example.com` или IP-адрес, если домена нет).
6. Скопируйте `Client ID` и `Client Secret` — они понадобятся для `.env`.

### 1.2. Telegram Bots
1. Откройте бота [@BotFather](https://t.me/BotFather) в Telegram.
2. Создайте двух ботов (команда `/newbot`):
   - **User Bot**: для взаимодействия с обычными пользователями.
   - **Admin Bot**: для панели администратора.
3. Скопируйте полученные токены (API Token) для обоих ботов.

---

## 2. Сборка Docker-образа

Приложение доставляется на сервер через Docker Registry (Docker Hub). Сборка выполняется на вашей локальной машине.

1. Склонируйте репозиторий:
   ```bash
   git clone <ссылка_на_репозиторий>
   cd <папка_проекта>
   ```

2. Соберите образ (замените `yourusername` на ваш логин Docker Hub):
   ```bash
   docker build -t yourusername/technoparkbot:latest .
   ```

3. Загрузите образ в Docker Hub:
   ```bash
   docker push yourusername/technoparkbot:latest
   ```

> **Важно:** Убедитесь, что в файле `docker-compose.yml` на сервере (см. пункт 3) указано именно это имя образа (`image: yourusername/technoparkbot:latest`).

---

## 3. Настройка сервера

1. **Подготовка хоста:**
   Вам потребуется VPS/VDS с доступом по SSH и привязанным доменным именем.
   Убедитесь, что на сервере установлены **Docker** и **Docker Compose**.

2. **Создание структуры:**
   Подключитесь к серверу и создайте директорию для проекта:
   ```bash
   mkdir technopark-app
   cd technopark-app
   ```

3. **Файлы конфигурации:**
   Вам не нужно копировать весь код проекта. Достаточно двух файлов:
   - `docker-compose.yml` (скопируйте из корня репозитория).
   - `.env` (создайте вручную).

4. **Настройка .env:**
   Создайте файл `.env`:
   ```bash
   nano .env
   ```
   Вставьте в него следующее содержимое и заполните актуальными данными:

   ```dotenv
   # --- База данных ---
   # localhost, если запускаете приложение вручную через npm run start
   # db, если запускаете приложение через docker-compose (КАК НА СЕРВЕРЕ)
   POSTGRES_HOST=db
   
   # Данные для доступа к БД
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_secure_password
   POSTGRES_DB=technopark_db
   
   # --- Telegram ---
   # Токены, полученные от BotFather
   TELEGRAM_USER_BOT_TOKEN=
   TELEGRAM_ADMIN_BOT_TOKEN=
   
   # --- LeaderID ---
   # Ключи, полученные на leader-id.ru/developers
   LEADERID_CLIENT_ID=
   LEADERID_CLIENT_SECRET=
   
   # ID точки кипения (для Точки на Жукова - 3942)
   LEADERID_PLACE_ID=3942
   
   # --- Настройки приложения ---
   # Имя домена, на котором запускается приложение (без https://)
   DOMEN_NAME=your-domain.com
   
   # Ссылка на соглашение об обработке персональных данных
   PERSONAL_DATA_AGREEMENT_URL=https://...
   ```

---

## 4. Запуск приложения

Находясь в папке с `docker-compose.yml` и `.env`, выполните команды:

1. Скачайте свежую версию образа:
   ```bash
   docker-compose pull
   ```

2. Запустите контейнеры в фоновом режиме:
   ```bash
   docker-compose up -d
   ```

Проверить статус контейнеров можно командой `docker-compose ps`.

---

## 5. Добавление администратора

При первом запуске база данных пуста. Чтобы получить доступ к админке, необходимо вручную добавить первого администратора через базу данных.

1. Узнайте свой `Telegram ID`. Это можно сделать через сторонних ботов (например, @userinfobot).

2. Подключитесь к контейнеру с базой данных:
   ```bash
   # Имя контейнера 'postgres_db' может отличаться, проверьте через docker ps
   docker exec -it postgres_db psql -U <Ваш_POSTGRES_USER> -d <Ваш_POSTGRES_DB>
   ```
   *Пример: `docker exec -it postgres_db psql -U postgres -d technopark_db`*

3. Выполните SQL-запрос для добавления админа:

   ```sql
   INSERT INTO admins (telegram_id) VALUES ('ВАШ_TELEGRAM_ID');
   ```
   *(Поля `id` и `created_at` заполнятся автоматически).*

4. Выйдите из консоли БД:
   ```sql
   \q
   ```

Теперь ваш Telegram ID имеет права администратора, и вы можете пользоваться админ-ботом.