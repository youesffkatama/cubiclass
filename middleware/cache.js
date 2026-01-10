const { redis } = require('../server');

const cache = (duration) => {
  return (req, res, next) => {
    if (redis === null) {
        return next();
    }
    const key = '__express__' + req.originalUrl || req.url;
    redis.get(key, (err, reply) => {
      if (err) {
        return next();
      }
      if (reply) {
        res.send(JSON.parse(reply));
        return;
      }
      res.sendResponse = res.send;
      res.send = (body) => {
        redis.setex(key, duration, JSON.stringify(body));
        res.sendResponse(body);
      };
      next();
    });
  };
};

module.exports = cache;