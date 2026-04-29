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

// Serve static frontend files
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Catch-all route to serve the React SPA
// Using fallback middleware instead of `*` wildcard since express 5 path-to-regexp syntax changed
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  } else {
    next();
  }
});

module.exports = app;
