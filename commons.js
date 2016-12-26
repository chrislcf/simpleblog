var config = require('./config');
var fs = require('fs');
var LRU = require('lru-cache');
var scrypt = require('scrypt');
var Async = require('async');
var scryptParameters = scrypt.paramsSync(0.1);
var adminKdf = new Buffer(config.scrypt_password, 'base64');
var marked = require('marked');
var highlightAuto = require('highlight.js').highlightAuto;

var OpenCC = require('opencc');
var opencc = new OpenCC('hk2s.json');
var PlainTextRenderer = require('marked-plaintext');
var renderer = new PlainTextRenderer();
var nodejieba = require('nodejieba');
var jaccard = require('jaccard');
nodejieba.load();

var recs = null;
var rateLimiters = {};
var options = {
  maxAge: config.cache_minutes * 60 * 1000
};

marked.setOptions({
  highlight: function (code) {
    return highlightAuto(code).value;
  }
});

var cache = LRU(options);

var getIP = function (req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
};

var findFilenameByID = function (id, callback) {
  var key = 'filename-' + id;
  var fn = cache.get(key);
  if (fn) return callback(null, fn);
  fs.readdir(config.posts_path, function (err, files) {
    if (err) throw err;
    for (var i = 0; i < files.length; i++) {
      if (parseInt(files[i].split('.')[0]) === id) {
        cache.set(key, files[i]);
        return callback(null, files[i]);
      }
    }
    callback();
  });
};

var infoFromFilename = function (file, callback) {
  var spliced = file.split('.');
  var id = spliced[0];
  var title = new Buffer(spliced[1].replace(/_/g, '/'), 'base64').toString('utf8');
  var fncTime = parseInt(spliced[2], 10);
  var next = function (fncTime, mTime) {
    var displayLMTimeFull = mTime.toISOString().slice(0, 19).replace('T', ' ');
    callback(null, {
      id: parseInt(id, 10),
      title: title,
      slug: config.include_slug ? title.toLowerCase().replace(/ /g, '-').replace(/\//g, '-') : '',
      fncTime: fncTime,
      displayDate: new Date(fncTime).toISOString().slice(0, 10),
      displayLMDate: displayLMTimeFull.slice(0, 10),
      displayLMTimeFull: displayLMTimeFull
    });
  };
  fs.stat(config.posts_path + '/' + file, function (err, stat) {
    if (err) return callback(err);
    next(fncTime, stat.mtime);
  });
};

var RateLimiter = function (maxRequestCount, perSeconds) {
  this.lastTimePortion = {};
  this.ipRequestCounter = {};
  var self = this;
  this.middleware = function (req, res, next) {
    var timePortion = Math.floor(Date.now() / (perSeconds * 1000));
    if (self.lastTimePortion[maxRequestCount] !== timePortion) {
      self.ipRequestCounter = {};
      self.lastTimePortion[maxRequestCount] = timePortion;
    }
    var ip = getIP(req);
    if (!(ip in self.ipRequestCounter)) {
      self.ipRequestCounter[ip] = 1;
    }
    if (self.ipRequestCounter[ip] > maxRequestCount) {
      res.status(429).send('Too many requests. Please request again ' +
        Math.ceil(perSeconds / 60) + ' minute(s) later.');
      return;
    }
    self.ipRequestCounter[ip]++;
    next();
  };
  this.reset = function (req) {
    if (!req) {
      self.ipRequestCounter = {};
    } else {
      self.ipRequestCounter[getIP(req)] = 0;
    }
  };
};

var readFileCached = function (path, cb) {
  /*
  var data = cache.get(path);
  if (data) return cb(null, data);
  fs.readFile(path, 'utf8', function (err, data) {
    cache.set(path, data);
    console.log('Caching', path);
    cb(err, data);
  });
  */
  fs.readFile(path, 'utf8', cb);
};

var computeRecsIfNeeded = function () {
  if (!config.show_recommendations) {
    return;
  }
  if (recs !== null) {
    return;
  }
  recs = {};
  fs.readdir(config.posts_path, function (err, files) {
    if (err) return console.log(err);
    Async.map(files, function (file, cb) {
      readFileCached(config.posts_path + '/' + file, function (err, data) {
        if (err) return cb(err);
        opencc.convert(marked(data, {
          renderer: renderer
        }), function (err, converted) {
          cb(err, nodejieba.cut(converted, true).filter(function (char) {
            return char.replace(/[&/\\#,+()$@~%.'":*;?<>_[\]{}|\-:!=\\n\\t\\r\s，。？：。！]/g, '').length !== 0;
          }));
        });
      });
    }, function (err, contents) {
      if (err) return console.log(err);
      var map = {};
      for (var i = 0; i < files.length; i++) {
        renderPost(i + 1, function () {});
        map[i + 1] = contents[i];
      }
      var items = Object.keys(map).map(function (key) {
        return [key, map[key]];
      });

      for (i = 0; i < items.length; i++) {
        (function (i) {
          Async.map(items.filter(function (kv) {
            return parseInt(kv[0]) !== i + 1;
          }), function (kv, cb) {
            jaccard.index(map[i + 1], kv[1], function (result) {
              cb(null, [kv[0], result]);
            });
          }, function (err, results) {
            if (err) return console.log(err);
            results.sort(function (first, second) {
              return second[1] - first[1];
            });
            recs[i + 1] = results.slice(0, config.recommendations_per_post);
          });
        })(i);
      }
      console.log('Recommendations computed');
    });
  });
};

computeRecsIfNeeded();

var addRecs = function (id, entry, cb) {
  if (!recs) return cb();
  Async.map(recs[id], function (rec, cb) {
    findFilenameByID(rec[0], function (err, file) {
      if (err) return cb(err);
      infoFromFilename(file, function (err, info) {
        cb(err, info);
      });
    });
  }, function (err, infos) {
    entry.recs = infos;
    cb(err);
  });
};

var renderPost = function (id, cb) {
  var cached = cache.get('view-' + id);
  if (cached) {
    return cb(cached);
  }
  findFilenameByID(id, function (err, file) {
    if (err) throw err;
    if (!file) return cb(null);
    Async.parallel([
      function (cb) {
        infoFromFilename(file, function (err, info) {
          cb(err, info);
        });
      },
      function (cb) {
        readFileCached(config.posts_path + '/' + file, function (err, data) {
          cb(err, data);
        });
      }
    ], function (err, results) {
      if (err) throw err;
      // Using async version of marked
      marked(results[1], function (err, content) {
        if (err) throw err;
        var entry = {
          title: results[0].title,
          post: results[0],
          html: content,
          disqusSite: config.disqus_site
        };
        addRecs(id, entry, function (err) {
          if (err) console.log(err);
          cache.set('view-' + id, entry);
          console.log('Cached', id);
          cb(entry);
        });
      });
    });
  });
};

module.exports = {
  cache: cache,
  rateLimit: function (area, maxRequestCount, perSeconds) {
    var limiter = rateLimiters[area];
    if (!limiter) {
      limiter = new RateLimiter(maxRequestCount, perSeconds);
      rateLimiters[area] = limiter;
    }
    return limiter.middleware;
  },
  findFilenameByID: findFilenameByID,
  infoFromFilename: infoFromFilename,
  renderPost: renderPost,
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
  },
  getRecs: function () {
    return recs;
  },
  recomputeRecsLater: function () {
    recs = null;
  },
  triggerRecomputeRecs: function () {
    computeRecsIfNeeded();
  },
  readFileCached: readFileCached
};
