const app = require('./app');
const port = process.env.PORT || 5000;
const server = app.listen(port, () => console.log(`KLE Hackathon 2K26 running on http://localhost:${port}`));
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] Port ${port} is already in use.\nRun this to fix it:\n  npx kill-port ${port}\nThen restart the server.\n`);
  } else {
    console.error('[SERVER ERROR]', err.message);
  }
  process.exit(1);
});

