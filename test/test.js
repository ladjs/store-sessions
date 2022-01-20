const test = require('ava');

const StoreSessions = require('../');

test('returns itself', (t) => {
  t.true(new StoreSessions() instanceof StoreSessions);
});

test('throws if schemaName is not a string', (t) => {
  t.throws(() => new StoreSessions({ schemaName: {} }), {
    message: `schemaName must be a String`
  });
});

const fieldsConfigMacro = test.macro({
  exec(t, propName) {
    t.throws(() => new StoreSessions({ fields: { [propName]: {} } }), {
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
