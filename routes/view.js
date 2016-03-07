var express = require('express');
var router = express.Router();

var config = require('../config');
var commons = require('../commons');
var Async = require('async');
var fs = require('fs');
var marked = require('marked');

var renderPost = function (req, res, next) {
  var cached = commons.cache.get('view-' + req.params.id);
  if (cached) {
    return res.render('view', cached);
  }
  commons.findFilenameByID(req.params.id, function (err, file) {
    if (err) throw err;
    if (!file) return res.redirect('/');
    Async.parallel([
      function (cb) {
        commons.infoFromFilename(file, function (err, info) {
          cb(err, info);
        });
      },
      function (cb) {
        fs.readFile(config.posts_path + '/' + file, 'utf8', function (err, data) {
          cb(err, data);
        });
      }
    ], function (err, results) {
      if (err) throw err;
      var entry = {
        title: results[0].title,
        post: results[0],
        html: marked(results[1])
      };
      commons.cache.set('view-' + req.params.id, entry);
      res.render('view', entry);
    });
  });
};

router.get('/:id', renderPost);
router.get('/:id/:slug', renderPost);

module.exports = router;
