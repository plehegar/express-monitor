# express-monitor

Node.js Express Server monitor

Use monitor.js in your express pp.

```js
const monitor  = require('./monitor.js');
var app = express();
monitor.install(app, [options]);
// options.path - HTTP root path for the monitor, default is /monitor
// options.entries - max number of entries to return in the log
// This will expose the following resources
// /monitor/logs
// /monitor/ping
/// /monitor/usage
```

if you want server timing, add the following after all router/middleware
```js
monitor.stats(app);
```

and don't forget to use next() im between for each router/middleware
you'll then see those time info added to the log

Use monitor.html?services=url[;url]* to actively monitor your service using a Web browser

