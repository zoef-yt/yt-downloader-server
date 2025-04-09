const express = require('express');
const router = express.Router();
const { handleDownload } = require('../controllers/downloadController');

router.post('/download', handleDownload);

module.exports = router;
