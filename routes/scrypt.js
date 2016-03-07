var express = require('express');
var router = express.Router();

var commons = require('../commons');

router.get('/', function (req, res, next) {
  res.render('scrypt', {
    title: 'Scrypt hash generator'
  });
});

router.post('/', function (req, res, next) {
  commons.generateScrypt(req.body.password, function (err, hash) {
    if (err) throw err;
    res.send({
      hash: hash.toString('base64')
    });
  });
});

module.exports = router;
