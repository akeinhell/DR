import TelegramBot from 'node-telegram-bot-api';
import redis from 'redis';
import bluebird from 'bluebird';
import _debug from 'debug';
const debug      = new _debug('quest');
const bodyParser = require('body-parser');

const TOKEN = process.env.TELEGRAM_TOKEN;
const rtg   = require('url').parse(process.env.REDIS_URL);

const cache = redis.createClient({
    port: rtg.port,
    host: rtg.hostname
});
cache.auth(rtg.auth.split(':')[1]);

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

const answer = {
    correct: 'Отлично, Продолжаем :-)',
    wrong: 'Хм... подумай еще',
    finish: `Ура...!!!! C днем рождения`
};

const quests = [
    {
        id: 0,
        text: `Привет, у меня есть к тебе срочное дело. В этом можешь помочь только ты.
Для начала давай познакомимся.
    Я даритель подарков. И я приготовил для тебя подарок.
    Но для того чтобы ты его получила, тебе нужно ответить на несколько вопросов
    Если ты ответишь правильно, я загадаю тебе следующую загадку.

    Если ты поняла, то попробуй решить следующую загадку
    *Сколько будет три минус два*
    ФО: Слово
    `,
        answer: 'один'
    },
    {
        id: 1,
        text: `Я смотрю смысл ты поняла. 
Что ж тогда можешь смело получать свой подарок
Он находится у тебя дома, в комнате в которой можно курить.

После того как найдешь подарок, ответь мне на вопрос, в какой республике был он произведен?
`,
        answer: 'Сербия'
    },
    {
        id: 2,
        text: `Потрясающий результат. А теперь давай слегка прогуляемся.
  Вот порядок твоих действий, выполнять строго по порядку:
  1. Возьми ключи
  2. Обуйся
  3. Выйди из квартиры
  4. Закрой дверь
  5. Ответь на вопрос - По мнению соседей, ты пользуешься именно этой гардеробной. Какой фирмы?
`, answer: 'elfa'
    },
    {
        id: 3,
        text: `Чтож ты вышла из квартиры, а теперь твоя задача на этаже найти спрятанный предмет. 
  Он и будет являться ответом.

Вопрос: Что было спрятано? 
`,
        answer: 'Фонарь'
    },
    {
        id: 4,
        text: `Тебе этот артефакт пригодится на улице, а пока ты едешь в низ на лифте, найди самую свежую запись в нем.

ФО: Слово
`,
        answer: 'Свадьба'
    },
    {
        id: 5,
        text: 'Твоя следующая задача сыграть в крестики нолики. Все необходимое я оставил внутри двора',
        answer: 'алкоголик'
    },
    {
        id: 6,
        text: `А теперь давай испытаем фонарь на полную мощность, 
Видишь арку? Для прохождения тебе надо найти слово написанное мной.

Формат слова DR:слово
Формат ответа: слово
`,
        answer: 'карта'
    },
    {
        id: 7,
        text: `Проследуй по нарисованной карте, и забери свой подарок :-)
    И ответь на вопрос, что за подарок тебе подарили?
`,
        answer: 'Телефон'
    },
];

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    setState(chatId, 0)
        .then(async() => {
            const quest = await getQuest(chatId);
            sendQuest(chatId, quest);
        })
        .catch(() => {
        });
});

const setState = async(chatId, state) => {
    debug(`set state ${chatId} = ${state}`);
    const chatKey = `DR:${chatId}:STATE`;
    return await cache.setAsync(chatKey, state);
};

const getState = async(chatId) => {
    const chatKey = `DR:${chatId}:STATE`;
    const state   = parseInt(await cache.getAsync(chatKey));
    debug(`getState ${chatId} = ${state}`);
    return state;
};

const getQuest = async(chatId) => {
    const state = await getState(chatId);
    debug(`getQuest: state = ${state}`);
    return quests.find(i => i.id == state);
};

const sendQuest = (chatId, quest, add = false) => {
    debug(`sendQuest ${JSON.stringify(quest)}`);
    const msg = add ? `*${answer.correct}*\n\n${quest.text}` : quest.text;
    msg && bot.sendMessage(chatId, msg, {parse_mode: 'Markdown'});
};

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    getQuest(chatId)
        .then(async(quest) => {
            if (msg.text == '/start') {
                return;
            }
            if (!quest) {
                ///await setState(chatId, 0); // @todo delete
                return bot.sendMessage(chatId, answer.finish, {parse_mode: 'Markdown'});
            }

            if (msg.text.toLowerCase() === quest.answer.toLowerCase()) {
                const state = await getState(chatId);
                await setState(chatId, state + 1);
                const newQuest = await getQuest(chatId);
                if (newQuest) {
                    sendQuest(chatId, newQuest, answer.correct);
                } else {
                    bot.sendMessage(chatId, `${answer.finish}`, {parse_mode: 'Markdown'});
                }
            } else {
                bot.sendMessage(chatId, `*${answer.wrong}*`, {parse_mode: 'Markdown'});
            }
        });
});

const express = require('express');
const app     = express();

app.get('/', function (req, res) {
    res.sendStatus(201);
});

const port = process.env.PORT || 80;

const url = 'https://nata-dr.herokuapp.com';
bot.setWebHook(`${url}/bot${TOKEN}`);

app.use(bodyParser.json());

// We are receiving updates at the route below!
app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.listen(port, () => {
    debug(`listen port ${port}`);
});
