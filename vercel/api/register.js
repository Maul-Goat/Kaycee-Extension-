// Backwards-compatible endpoint.
// The product requirement is "no need create account" → register behaves like login (auto-create).
const loginHandler = require('./login');

module.exports = async function handler(req, res) {
  return loginHandler(req, res);
};

