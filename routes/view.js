var express = require('express');
var router = express.Router();
var commons = require('../commons');

var renderPostRoute = function (req, res, next) {
  commons.renderPost(req.params.id, function (entry) {
    if (!entry) return res.redirect('/');
    res.render('view', entry);
  });
};

router.get('/:id', renderPostRoute);
router.get('/:id/:slug', renderPostRoute);

module.exports = router;
