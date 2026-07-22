import { createApp } from './app.js';

const PORT = process.env.PORT ?? 3001;

const server = createApp().listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

// Found while walking through the README as a first-time user. A port that is
// already taken produced a raw Node stack trace, which reads like the project
// is broken rather than like something else is using the port.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use.\n\n` +
        `Something else is running there — most likely another copy of this API.\n` +
        `Stop it, or start this one on a different port:\n\n` +
        `  PORT=3002 npm run dev:api\n\n` +
        `If you change the port, update the proxy target in web/vite.config.js.\n`,
    );
    process.exit(1);
  }
  throw err;
});
