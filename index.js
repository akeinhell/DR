import TelegramBot from 'node-telegram-bot-api';
import redis from 'redis';
import bluebird from 'bluebird';
import _debug from 'debug';
const debug = new _debug('quest');
const bodyParser = require('body-parser');

let token = process.env.TELEGRAM_TOKEN;
let rtg   = require("url").parse(process.env.REDIS_URL);

console.log(rtg);

let cache = redis.createClient({
    port: rtg.port,
    host: rtg.hostname
});
cache.auth(rtg.auth.split(":")[1]);

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

const answer = {
    correct: 'Отлично, го дальше :-)',
    wrong: 'Хм... подумай еще',
    finish: 'Ура...!!!! C днем рождения'
};

const quests = [
    {id: 0, text: `Привет, у меня есть к тебе срочное дело. В этом можешь помочь только ты.
Для начала давай познакомимся.
    Я даритель подарков. И я приготовил для тебя подарок.
    Но для того чтобы ты его получила, тебе нужно ответить на несколько вопросов
    Если ты ответишь правильно, я загадаю тебе следующую загадку.

    Если ты поняла, то попробуй решить следующую загадку
    *Сколько будет три минус два*
    ФО: Слово
    `,
        answer: 'один'},
    {id: 1, text: 'а 1+1?', answer: 'два'},
    {id: 2, text: 'Какая молодец... А сколько будет 5-3?', answer: 'три'},
    {id: 3, text: 'дважды два', answer: 'четыре'},
    {id: 4, text: 'сколько пальцев на руке', answer: 'пять'},
    {id: 5, text: 'Прошлый ответ плюс один', answer: 'шесть'},
];

bot.onText(/\/start/, (msg) => {
    let chatId = msg.chat.id;
    setState(chatId, 0)
      .then(async () => {
          let quest = await getQuest(chatId);
          sendQuest(chatId, quest);
      })
      .catch(() => {});
});

const debugMessage = (chatId, msg) => {
    debug(`debugMessage chatid: ${chatId}`);
    debug(`debugMessage msg: ${msg}`);
    let chatKey = `DR:${chatId}:DEBUG`;
    cache.getAsync(chatKey)
      .then(data => data && bot.sendMessage(chatId, `*DEBUG*\n${msg}`, {parse_mode: 'Markdown'}))
};

const setState = async (chatId, state) => {
    debug(`set state ${chatId} = ${state}`);
    let chatKey = `DR:${chatId}:STATE`;
    return await cache.setAsync(chatKey, state);
};

const getState = async (chatId) => {
    let chatKey = `DR:${chatId}:STATE`;
    let state = parseInt(await cache.getAsync(chatKey));
    debug(`getState ${chatId} = ${state}`);
    return state;
};

const getQuest = async (chatId) => {
    let state = await getState(chatId);
    debug(`getQuest: state = ${state}`);
    return quests.find(i => i.id == state);
};

const sendQuest = (chatId, quest, add = false) => {
    debug(`sendQuest ${JSON.stringify(quest)}`);
    let msg = add? `*${answer.correct}*\n\n${quest.text}` : quest.text;
    msg && bot.sendMessage(chatId, msg, {parse_mode: 'Markdown'});
}

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    getQuest(chatId)
      .then(async (quest) => {
          if (msg.text == '/start') {
              return;
          }
          if (!quest) {
              await setState(chatId, 0); // @todo delete
              return bot.sendMessage(chatId, `*Hura!!!!*`, {parse_mode: 'Markdown'});
          }

          if (msg.text.toLowerCase() === quest.answer.toLowerCase()) {
              let state = await getState(chatId);
              console.log('state', state);
              await setState(chatId, state + 1);
              let newQuest = await getQuest(chatId);
              console.log('newQ', newQuest);
              if (newQuest) {
                  sendQuest(chatId, newQuest, answer.correct)
              } else {
                  bot.sendMessage(chatId, `${answer.finish}`, {parse_mode: 'Markdown'});
              }
          } else {
              bot.sendMessage(chatId, `*${answer.wrong}*`, {parse_mode: 'Markdown'});
          }
      });
});

var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.send(`<pre>${JSON.stringify(process.env, true, 4)}`);
});

let port = process.env.PORT || 80;

let url = 'https://nata-dr.herokuapp.com'
console.log('bot url', `${url}/bot${TOKEN}`);
bot.setWebHook(`${url}/bot${TOKEN}`);

app.use(bodyParser.json());

// We are receiving updates at the route below!
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(port, () => {
    console.log(`listen port ${port}`);
});
