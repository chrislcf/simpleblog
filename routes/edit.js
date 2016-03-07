var express = require('express');
var router = express.Router();

var config = require('../config');
var commons = require('../commons');
var fs = require('fs');
var Async = require('async');

var writePost = function (req, res, next) {
  fs.writeFile(config.posts_path + '/' + req.id + '.' +
    new Buffer(req.body.title).toString('base64') + '.md',
    req.body.content, 'utf8',
    function () {
      res.redirect('/view/' + req.id);
    });
};

var backupToCookies = function (req, res, next) {
  var settings = {
    path: '/edit/' + (req.params.id || '')
  };
  res.cookie('title', req.body.title, settings);
  res.cookie('content', req.body.content, settings);
  next();
};

router.get('/', function (req, res, next) {
  res.render('edit', {
    title: commons.errorMessageOrTitle(req, 'New post'),
    id: '',
    postTitle: ('err' in req.query ? req.cookies.title : '') || '',
    content: ('err' in req.query ? req.cookies.content : '') || ''
  });
});

router.get('/:id', function (req, res, next) {
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
      res.render('edit', {
        title: commons.errorMessageOrTitle(req, 'Edit post'),
        id: results[0].id,
        postTitle: ('err' in req.query ? req.cookies.title : results[0].title) || results[0].title,
        content: ('err' in req.query ? req.cookies.content : results[1]) || results[1]
      });
    });
  });
});

router.post('/', commons.checkInput, backupToCookies, commons.authenticate, function (req, res, next) {
  commons.nextID(function (id) {
    req.id = id;
    next();
  });
}, writePost);

router.post('/:id', commons.checkInput, backupToCookies, commons.authenticate, function (req, res, next) {
  req.id = req.params.id;
  commons.findFilenameByID(req.params.id, function (err, file) {
    if (err) throw err;
    if (!file) return res.redirect('/');
    fs.rename(config.posts_path + '/' + file, config.old_posts_path + '/' + file + '.' + Date.now(), next);
  });
}, writePost);

module.exports = router;
