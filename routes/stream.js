const express = require('express');
const { handleProgressStream } = require('../controllers/streamController');
const router = express.Router();

router.get('/progress/:id', handleProgressStream);

module.exports = router;
