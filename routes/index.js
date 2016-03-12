var express = require('express');
var router = express.Router();

var config = require('../config');
var commons = require('../commons');
var Async = require('async');
var fs = require('fs');

var fitPage = function (entry, page) {
  var pageEntry = {};
  var start = (page - 1) * config.posts_per_page;
  pageEntry.title = entry.title;
  if (entry.posts) {
    pageEntry.currentPage = page;
    pageEntry.totalPage = Math.ceil(entry.posts.length / config.posts_per_page);
    pageEntry.posts = entry.posts.slice(start, start + config.posts_per_page);
  }
  return pageEntry;
};

var renderIndex = function (req, res, next) {
  var page = req.params.page || 1;
  var cached = commons.cache.get('index');
  if (cached) {
    return res.render('index', fitPage(cached, page));
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
      res.render('index', fitPage(entry, page));
    });
  });
};

router.get('/page/:page', renderIndex);
router.get('/', renderIndex);

module.exports = router;
