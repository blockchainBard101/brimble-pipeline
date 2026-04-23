import express from 'express';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.get('/', (_req, res) => {
  res.send('Hello from sample-app');
});

app.listen(PORT, () => {
  console.log(`sample-app listening on port ${PORT}`);
});
