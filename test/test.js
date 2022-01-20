const test = require('ava');
const mongoose = require('mongoose');

const StoreSessions = require('../');

test('returns itself', (t) => {
  t.true(
    new StoreSessions({ schema: new mongoose.Schema() }) instanceof
      StoreSessions
  );
});

test('throws if schema is not a Schema', (t) => {
  t.throws(() => new StoreSessions(), {
    message: `schema must be a Mongoose Schema`
  });
});

const fieldsConfigMacro = test.macro({
  exec(t, propName) {
    const schema = new mongoose.Schema();
    t.throws(() => new StoreSessions({ schema, fields: { [propName]: {} } }), {
      message: `${propName} must be a String`
    });
  },
  title(providedTitle, propName) {
    return providedTitle
      ? providedTitle
      : `throws if ${propName} is not a string`;
  }
});

test(fieldsConfigMacro, 'sessions');
test(fieldsConfigMacro, 'ip');
test(fieldsConfigMacro, 'lastActivity');
test(fieldsConfigMacro, 'sid');
