var express = require('express');
var router = express.Router();

var config = require('../config');
var commons = require('../commons');
var Async = require('async');
var fs = require('fs');

/* GET home page. */
router.get('/', function (req, res, next) {
  fs.readdir(config.posts_path, function (err, files) {
    if (err) throw err;
    if (files.length === 0) {
      return res.render('index', {
        title: config.blog_name
      });
    }
    Async.map(files, commons.infoFromFilename, function (err, posts) {
      if (err) throw err;
      posts.sort(function (a, b) {
        return a.id + b.id;
      });
      res.render('index', {
        title: config.blog_name,
        posts: posts
      });
    });
  });
});

module.exports = router;
