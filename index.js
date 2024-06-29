const TelegramApi = require('node-telegram-bot-api');
const fs = require('fs');

const token = '6575965779:AAHIAB5pMXhhq-k1LuA2yoAcauXTYm1CpDU';
const bot = new TelegramApi(token, { polling: true });

// Storage for user data
const usersData = {};

// Save data to file
const saveData = () => {
  fs.writeFileSync('data.json', JSON.stringify(usersData));
};

// Load data from file
const loadData = () => {
  if (fs.existsSync('data.json')) {
    const data = fs.readFileSync('data.json', 'utf-8');
    Object.assign(usersData, JSON.parse(data));
  }
};

// Initial data loading
loadData();

// Keyboard configurations
const mainMenu = {
  reply_markup: JSON.stringify({
    keyboard: [
      [{ text: 'Посчитать заказы' }, { text: 'Бухгалтерия' }],
      [{ text: 'Сбросить заказы' }, { text: 'Сбросить бухгалтерию' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  })
};

const accountingMenu = {
  reply_markup: JSON.stringify({
    keyboard: [
      [{ text: 'Вписать прибыль' }, { text: 'Вписать количество заказов' }],
      [{ text: 'Вписать расход на рекламу' }, { text: 'Отчет' }],
      [{ text: 'Назад в меню' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  })
};

const reportMenu = {
  reply_markup: JSON.stringify({
    keyboard: [
      [{ text: 'Отчет за день' }, { text: 'Отчет за неделю' }],
      [{ text: 'Отчет за месяц' }, { text: 'Отчет за период' }],
      [{ text: 'Назад в бухгалтерию' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  })
};

// Function to retrieve user data
const getUserData = (chatId) => {
  if (!usersData[chatId]) {
    usersData[chatId] = {
      orders: [],
      debts: { gordey: 0, rodion: 0 },
      accounting: [],
      ordersToCalculate: []
    };
  } else if (!usersData[chatId].ordersToCalculate) {
    usersData[chatId].ordersToCalculate = [];
  }
  return usersData[chatId];
};

// Function to generate report
const generateReport = (accounting, period) => {
  const now = new Date();
  let filteredData;

  if (period === 'day') {
    filteredData = accounting.filter(entry => new Date(entry.date).toDateString() === now.toDateString());
  } else if (period === 'week') {
    const weekAgo = new Date(now.setDate(now.getDate() - 7));
    filteredData = accounting.filter(entry => new Date(entry.date) >= weekAgo);
  } else if (period === 'month') {
    const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
    filteredData = accounting.filter(entry => new Date(entry.date) >= monthAgo);
  } else if (period.start && period.end) {
    filteredData = accounting.filter(entry => new Date(entry.date) >= new Date(period.start) && new Date(entry.date) <= new Date(period.end));
  } else {
    return 'Некорректный период';
  }

  if (filteredData.length === 0) {
    return 'Нет данных за выбранный период.';
  }

  return filteredData.map(entry => `Дата: ${entry.date}\nПрибыль: ${entry.profit}\nКоличество заказов: ${entry.orderCount}\nРасход на рекламу: ${entry.adExpense}`).join('\n\n');
};

// Bot command handlers
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Добро пожаловать! Выберите опцию:', mainMenu);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const userData = getUserData(chatId);

  if (text === 'Посчитать заказы') {
    userData.currentMode = 'orders';
    userData.ordersToCalculate = [];
    bot.sendMessage(chatId, 'Введите суммы заказов по одному сообщению (например, 4000, затем -400). Отправьте "Посчитай", чтобы выполнить расчет.', mainMenu);
  } else if (text === 'Бухгалтерия') {
    userData.currentMode = 'accounting';
    bot.sendMessage(chatId, 'Выберите действие:', accountingMenu);
  } else if (text === 'Сбросить заказы') {
    userData.orders = [];
    userData.debts = { gordey: 0, rodion: 0 };
    saveData();
    bot.sendMessage(chatId, 'Заказы и долги сброшены.', mainMenu);
  } else if (text === 'Сбросить бухгалтерию') {
    userData.accounting = [];
    saveData();
    bot.sendMessage(chatId, 'Бухгалтерия сброшена.', mainMenu);
  } else if (text === 'Назад в меню') {
    userData.currentMode = null;
    bot.sendMessage(chatId, 'Выберите опцию:', mainMenu);
  } else if (text === 'Назад в бухгалтерию') {
    userData.currentMode = 'accounting';
    bot.sendMessage(chatId, 'Выберите действие:', accountingMenu);
  } else if (userData.currentMode === 'orders') {
    if (text.toLowerCase() === 'посчитай') {
      const sum = userData.ordersToCalculate.reduce((a, b) => a + b, 0);

      if (sum > 0) {
        userData.debts.gordey += sum;
      } else {
        userData.debts.rodion += Math.abs(sum);
      }

      userData.orders.push({ date: new Date(), orders: userData.ordersToCalculate, sum });
      userData.ordersToCalculate = [];
      saveData();

      bot.sendMessage(chatId, `Сумма заказов: ${sum}. Обновленные долги:\nГордей должен Родиону: ${userData.debts.gordey}\nРодион должен Гордею: ${userData.debts.rodion}`, mainMenu);
    } else {
      const order = parseInt(text);
      if (!isNaN(order)) {
        userData.ordersToCalculate.push(order);
      } else {
        bot.sendMessage(chatId, 'Некорректное значение заказа. Введите число или "Посчитай", чтобы завершить.', mainMenu);
      }
    }
  } else if (userData.currentMode === 'accounting') {
    if (text === 'Вписать прибыль') {
      userData.currentAction = 'profit';
      bot.sendMessage(chatId, 'Введите прибыль за день:', mainMenu);
    } else if (text === 'Вписать количество заказов') {
      userData.currentAction = 'orderCount';
      bot.sendMessage(chatId, 'Введите количество заказов за день:', mainMenu);
    } else if (text === 'Вписать расход на рекламу') {
      userData.currentAction = 'adExpense';
      bot.sendMessage(chatId, 'Введите расход на рекламу за день:', mainMenu);
    } else if (text === 'Отчет') {
      userData.currentMode = 'report';
      bot.sendMessage(chatId, 'Выберите период для отчета:', reportMenu);
    } else if (userData.currentAction) {
      const value = parseFloat(text);
      if (!isNaN(value)) {
        const today = new Date().toISOString().split('T')[0];
        let entry = userData.accounting.find((e) => e.date === today);
        if (!entry) {
          entry = { date: today, profit: 0, orderCount: 0, adExpense: 0 };
          userData.accounting.push(entry);
        }
        if (userData.currentAction === 'profit') {
          entry.profit += value;
        } else if (userData.currentAction === 'orderCount') {
          entry.orderCount += value;
        } else if (userData.currentAction === 'adExpense') {
          entry.adExpense += value;
        }
        userData.currentAction = null;
        saveData();
        bot.sendMessage(chatId, 'Данные обновлены.', mainMenu);
      } else {
        bot.sendMessage(chatId, 'Некорректное значение. Попробуйте снова.', mainMenu);
      }
    }
  } else if (userData.currentMode === 'report') {
    if (text === 'Отчет за день') {
      const report = generateReport(userData.accounting, 'day');
      bot.sendMessage(chatId, report, mainMenu);
    } else if (text === 'Отчет за неделю') {
      const report = generateReport(userData.accounting, 'week');
      bot.sendMessage(chatId, report, mainMenu);
    } else if (text === 'Отчет за месяц') {
      const report = generateReport(userData.accounting, 'month');
      bot.sendMessage(chatId, report, mainMenu);
    } else if (text === 'Отчет за период') {
      userData.currentAction = 'customReport';
      bot.sendMessage(chatId, 'Введите начальную и конечную дату в формате YYYY-MM-DD через пробел. Пример: 2023-01-01 2023-01-31', mainMenu);
    } else if (userData.currentAction === 'customReport') {
      const [start, end] = text.split(' ');
      const report = generateReport(userData.accounting, { start, end });
      userData.currentAction = null;
      bot.sendMessage(chatId, report, mainMenu);
    }
  }
});
