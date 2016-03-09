var express = require('express');
var router = express.Router();

var config = require('../config');
var commons = require('../commons');
var Async = require('async');
var fs = require('fs');

/* GET home page. */
router.get('/', function (req, res, next) {
  var cached = commons.cache.get('index');
  if (cached) {
    return res.render('index', cached);
  }
  fs.readdir(config.posts_path, function (err, files) {
    if (err) throw err;
    if (files.length === 0) {
      var entry = {
        title: config.blog_name
      };
      commons.cache.set('index', entry);
      return res.render('index', entry);
    }
    Async.map(files, commons.infoFromFilename, function (err, posts) {
      if (err) throw err;
      posts.sort(function (a, b) {
        return a.id - b.id;
      });
      posts.reverse();
      var entry = {
        title: config.blog_name,
        posts: posts
      };
      commons.cache.set('index', entry);
      res.render('index', entry);
    });
  });
});

module.exports = router;
