import './database/index.js';
import { bot } from './bot.js';
import { startServer } from './webhook/server.js';
import { startRateRefresher } from './services/exchangeRate.js';
import { cleanupExpiredOrders } from './models/order.js';

// Fetch VCB exchange rate immediately, then refresh every 6 minutes
await startRateRefresher();

// Clean up expired orders every 5 minutes
setInterval(() => {
  const n = cleanupExpiredOrders();
  if (n > 0) console.log(`Cleaned up ${n} expired order(s)`);
}, 5 * 60 * 1000);

startServer(bot);

console.log('Starting Telegram Shop Bot…');
bot.start({
  onStart: info => console.log(`Bot running as @${info.username}`),
});
