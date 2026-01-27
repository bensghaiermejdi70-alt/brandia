const express = require('express');
const router = express.Router();
const CountryController = require('./country.controller');

router.get('/', CountryController.getCountries);
router.get('/categories', CountryController.getCategories);

module.exports = router;