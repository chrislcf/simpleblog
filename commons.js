var config = require('./config');
var fs = require('fs');

var scrypt = require('scrypt');
var scryptParameters = scrypt.paramsSync(0.1);
var adminKdf = new Buffer(config.scrypt_password, 'base64');

module.exports = {
  findFilenameByID: function (id, callback) {
    fs.readdir(config.posts_path, function (err, files) {
      if (err) throw err;
      for (var i = 0; i < files.length; i++) {
        if (files[i].split('.')[0] === id) {
          return callback(null, files[i]);
        }
      }
      callback();
    });
  },
  infoFromFilename: function (file, callback) {
    fs.stat(config.posts_path + '/' + file, function (err, stat) {
      if (err) return callback(err);
      var spliced = file.split('.');
      var id = spliced[0];
      var title = new Buffer(spliced[1], 'base64').toString('utf8');
      callback(null, {
        id: parseInt(id, 10),
        title: title,
        slug: config.include_slug ? title.toLowerCase().replace(/ /g, '-') : '',
        cdate: stat.ctime.toISOString().slice(0, 10)
      });
    });
  },
  authenticate: function (req, res, next) {
    scrypt.verifyKdf(adminKdf, new Buffer(req.body.password), function (err, result) {
      if (err) throw err;
      if (!result) return res.redirect(req.originalUrl + '?err=password');
      next();
    });
  },
  generateScrypt: function (password, callback) {
    scrypt.kdf(password, scryptParameters, callback);
  },
  checkInput: function (req, res, next) {
    if (!req.body.title || !req.body.content || !req.body.password) {
      return res.redirect(req.originalUrl + '?err=input');
    }
    next();
  },
  errorMessageOrTitle: function (req, title) {
    if (!('err' in req.query)) return title;
    return {
      input: 'Please fill in all fields',
      password: 'Wrong password. Please check your input'
    }[req.query.err] || req.query.err;
  },
  nextID: function (callback) {
    fs.readdir(config.posts_path, function (err, files) {
      if (err) return callback(err);
      var max = 0;
      files.forEach(function (file) {
        var id = parseInt(file.split('.')[0], 10);
        if (id > max) {
          max = id;
        }
      });
      callback(max + 1);
    });
  }
};
