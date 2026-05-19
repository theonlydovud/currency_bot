const { Telegraf, Markup } = require('telegraf');
const fetch = require('node-fetch');

// Сюда вставляешь токен, который тебе дал @BotFather в Телеграме
const bot = new Telegraf('8698126409:AAF9CiXIXegaoz0LLvRBVFhb2i6o0juh6VM');

// Главная функция, которая собирает ВСЕ курсы из интернета
async function getAllRates() {
  try {
    // 1. Запрашиваем фиатные валюты у Центробанка РУз
    const cbuResponse = await fetch('https://cbu.uz/ru/arkhiv-kursov-valyut/json/');
    const cbuData = await cbuResponse.json();

    const usdData = cbuData.find(item => item.Ccy === 'USD');
    const eurData = cbuData.find(item => item.Ccy === 'EUR');
    const rubData = cbuData.find(item => item.Ccy === 'RUB');

    const usdRate = parseFloat(usdData.Rate); // Курс доллара в сумах для расчетов крипты

    // 2. Запрашиваем крипту у CoinGecko (Биткоин и TON в долларах)
    const cryptoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,the-open-network&vs_currencies=usd');
    const cryptoData = await cryptoResponse.json();

    const btcInUsd = cryptoData.bitcoin.usd;
    const tonInUsd = cryptoData['the-open-network'].usd;

    // 3. Переводим крипту в сумы
    const btcInUzs = btcInUsd * usdRate;
    const tonInUzs = tonInUsd * usdRate;

    return {
      usd: usdData.Rate,
      eur: eurData.Rate,
      rub: rubData.Rate,
      btc: btcInUzs.toFixed(2), // Округляем до 2 знаков после запятой
      ton: tonInUzs.toFixed(2)
    };
  } catch (error) {
    console.error('Ошибка при получении данных:', error);
    return null;
  }
}

// Слушаем команду /start
bot.start((ctx) => {
  const keyboard = Markup.keyboard([
    ['💵 Фиатные валюты', '🪙 Криптовалюта'],
    ['📊 Показать всё сразу']
  ]).resize();

  ctx.reply('Салам, бро! Я помогу тебе узнать актуальный курс валют в сумах (UZS). Выбирай нужный вариант:', keyboard);
});

// Кнопка 1: Фиатные валюты
bot.hears('💵 Фиатные валюты', async (ctx) => {
  ctx.reply('Запрашиваю данные у Центробанка...');
  const rates = await getAllRates();
  
  if (!rates) return ctx.reply('Бро, не получилось связаться с сервером. Попробуй позже.');

  ctx.reply(
    `🇺🇸 **1 USD** = ${rates.usd} UZS\n` +
    `🇪🇺 **1 EUR** = ${rates.eur} UZS\n` +
    `🇷🇺 **1 RUB** = ${rates.rub} UZS`,
    { parse_mode: 'Markdown' }
  );
});

// Кнопка 2: Криптовалюта
bot.hears('🪙 Криптовалюта', async (ctx) => {
  ctx.reply('Считаю актуальный курс крипты в сумах...');
  const rates = await getAllRates();
  
  if (!rates) return ctx.reply('Бро, не получилось загрузить данные бирж. Попробуй позже.');

  // Намного красивее, когда большие числа разделены пробелами (например, 800 000 000 вместо 800000000)
  const btcFormatted = Number(rates.btc).toLocaleString('ru-RU');
  const tonFormatted = Number(rates.ton).toLocaleString('ru-RU');

  ctx.reply(
    `🪙 **1 BTC** = ${btcFormatted} UZS\n` +
    `💎 **1 TON** = ${tonFormatted} UZS`,
    { parse_mode: 'Markdown' }
  );
});

// Кнопка 3: Показать всё сразу
bot.hears('📊 Показать всё сразу', async (ctx) => {
  ctx.reply('Собираю все курсы в один список...');
  const rates = await getAllRates();
  
  if (!rates) return ctx.reply('Ошибка при сборе данных.');

  const btcFormatted = Number(rates.btc).toLocaleString('ru-RU');
  const tonFormatted = Number(rates.ton).toLocaleString('ru-RU');

  ctx.reply(
    `*Актуальный курс валют в UZS:*\n\n` +
    `💵 *Фиат:*\n` +
    `• 1 USD = ${rates.usd} UZS\n` +
    `• 1 EUR = ${rates.eur} UZS\n` +
    `• 1 RUB = ${rates.rub} UZS\n\n` +
    `🪙 *Крипта:*\n` +
    `• 1 BTC = ${btcFormatted} UZS\n` +
    `• 1 TON = ${tonFormatted} UZS`,
    { parse_mode: 'Markdown' }
  );
});


module.exports = async (req, res) => {
  try {
    // Вебхуки отправляют POST-запросы, ловим их и передаем в Telegraf
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('Ошибка на Vercel:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Безопасная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));