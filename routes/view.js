var express = require('express');
var router = express.Router();

var config = require('../config');
var commons = require('../commons');
var Async = require('async');
var fs = require('fs');
var marked = require('marked');

var renderPost = function (req, res, next) {
  commons.findFilenameByID(req.params.id, function (err, file) {
    console.log(file);
    if (err) throw err;
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
      res.render('view', {
        title: results[0].title,
        post: results[0],
        html: marked(results[1])
      });
    });
  });
};

router.get('/:id', renderPost);
router.get('/:id/:slug', renderPost);

module.exports = router;
