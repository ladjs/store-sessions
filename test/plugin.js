const test = require('ava');
const mongoose = require('mongoose');

const StoreSessions = require('../');

test('creates a plugin with schema', (t) => {
  const schema = new mongoose.Schema();
  const storeSessions = new StoreSessions({ schema });

  schema.plugin(storeSessions.plugin);

  t.is(typeof schema.paths.sessions, 'object');
});
