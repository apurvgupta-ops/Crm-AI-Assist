const express = require('express');

const router = express.Router();

/**
 * GET /health
 * Health check route to ensure the server is up and running
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

