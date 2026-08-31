/* Vercel's entry point. An Express app IS a (req, res) handler, so it can be exported straight
   through — server.js skips its own app.listen() when process.env.VERCEL is set, and exports the
   app instead.
   Everything else about the server is unchanged, which is the point: there is one server, it runs
   the same locally and hosted, and this file exists only because Vercel wants a function to call. */
module.exports = require('../server.js');
