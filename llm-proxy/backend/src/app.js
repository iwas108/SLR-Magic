const express = require('express');
const cors = require('cors');
const { apiRouter, webApiRouter } = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json());

// Proxy API
app.use('/', apiRouter);

// Web API
app.use('/', webApiRouter);

// Placeholder route to verify app is working
app.get('/', (req, res) => {
  res.send('LLM-Proxy Backend is running');
});

module.exports = app;
