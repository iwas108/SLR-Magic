const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Placeholder route to verify app is working
app.get('/', (req, res) => {
  res.send('LLM-Proxy Backend is running');
});

module.exports = app;
