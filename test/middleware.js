const test = require('ava');

const StoreSessions = require('../');

const next = () => {};
const baseUser = () => ({
  save() {
    return this;
  }
});
const baseCtx = () => ({
  throw: (err) => {
    throw err;
  },
  session: {
    cookie: {
      httpOnly: true,
      path: '/',
      overwrite: true,
      signed: true,
      maxAge: 86_400_000,
      secure: false,
      sameSite: 'lax'
    },
    secret: 'OzHZ5KckrsUo3HQB1q_rBufT',
    passport: { user: '61e1ea20959b644333b9aa98' }
  },
  saveSession: () => {},
  state: {
    user: baseUser()
  },
  isAuthenticated: () => true,
  ip: '127.0.0.1'
});

test('throws if no ctx.session', async (t) => {
  const storeSessions = new StoreSessions();
  await t.throwsAsync(
    () => storeSessions.middleware({ ...baseCtx(), session: null }, next),
    {
      message: 'Sessions required'
    }
  );
});

test('throws if no ctx.saveSession', async (t) => {
  const storeSessions = new StoreSessions();
  await t.throwsAsync(
    () => storeSessions.middleware({ ...baseCtx(), saveSession: null }, next),
    {
      message:
        'Please use koa-generic-session v2.0.3+ which exposes a `ctx.saveSession()` method'
    }
  );
});

test('throws if ctx.saveSession is not a function', async (t) => {
  const storeSessions = new StoreSessions();
  await t.throwsAsync(
    () =>
      storeSessions.middleware(
        { ...baseCtx(), session: {}, saveSession: {} },
        next
      ),
    {
      message:
        'Please use koa-generic-session v2.0.3+ which exposes a `ctx.saveSession()` method'
    }
  );
});

const unAuthedMacro = test.macro(async (t, input) => {
  const ctx = { ...baseCtx(), ...input };
  const storeSessions = new StoreSessions();

  await storeSessions.middleware(ctx, next);
  t.is(ctx.state.user.sessions, undefined);
});

test('does nothing if no user', unAuthedMacro, { user: null });
test('does nothing if no user.save function', unAuthedMacro, {
  state: {
    user: { ...baseUser(), save: null }
  }
});
test('does nothing if no isAuthenticated function', unAuthedMacro, {
  isAuthenticated: null
});
test('does nothing if isAuthenticated return false', unAuthedMacro, {
  isAuthenticated: () => false
});
test('does nothing if no sessionId', unAuthedMacro, { sessionId: null });

test('add sessions to user if no sessions property', async (t) => {
  const ctx = { ...baseCtx(), sessionId: '42' };
  const storeSessions = new StoreSessions();

  await storeSessions.middleware(ctx, next);

  t.is(ctx.state.user.sessions.length, 1);
  t.like(ctx.state.user.sessions[0], { sid: '42', ip: '127.0.0.1' });
});

test('add sessions to user if sessions is array but no session', async (t) => {
  const ctx = {
    ...baseCtx(),
    sessionId: '42',
    state: {
      user: { ...baseUser(), sessions: [] }
    }
  };
  const storeSessions = new StoreSessions();

  await storeSessions.middleware(ctx, next);

  t.is(ctx.state.user.sessions.length, 1);
  t.like(ctx.state.user.sessions[0], { sid: '42', ip: '127.0.0.1' });
});

test('update sessions in user if session exists', async (t) => {
  const ctx = {
    ...baseCtx(),
    sessionId: '42',
    state: {
      user: {
        ...baseUser(),
        sessions: [{ last_activity: new Date(), ip: '127.0.0.3', sid: '42' }]
      }
    }
  };
  const storeSessions = new StoreSessions();

  await storeSessions.middleware(ctx, next);

  t.is(ctx.state.user.sessions.length, 1);
  t.like(ctx.state.user.sessions[0], { sid: '42', ip: '127.0.0.1' });
});

test('adds invalidateOtherSessions helper function', async (t) => {
  const ctx = { ...baseCtx(), sessionId: '42' };
  const storeSessions = new StoreSessions();

  await storeSessions.middleware(ctx, next);

  t.is(typeof ctx.invalidateOtherSessions, 'function');
});

test('invalidateOtherSessions > does nothing if there is no sessions array', async (t) => {
  const ctx = {
    ...baseCtx(),
    sessionId: '42',
    state: { user: { ...baseUser(), sessions: [] } }
  };
  const storeSessions = new StoreSessions();

  await storeSessions.middleware(ctx, next);

  t.is(ctx.state.user.sessions.length, 1);
  t.like(ctx.state.user.sessions[0], { sid: '42', ip: '127.0.0.1' });

  await ctx.invalidateOtherSessions();

  t.is(ctx.state.user.sessions.length, 1);
  t.like(ctx.state.user.sessions[0], { sid: '42', ip: '127.0.0.1' });
});

test('invalidateOtherSessions > removes other sessions if there are other sessions', async (t) => {
  const ctx = {
    ...baseCtx(),
    sessionId: '42',
    sessionStore: { destroy: () => {} },
    state: {
      user: {
        ...baseUser(),
        sessions: [{ last_activity: new Date(), ip: '127.0.0.3', sid: '15' }]
      }
    }
  };
  const storeSessions = new StoreSessions();

  await storeSessions.middleware(ctx, next);

  t.is(ctx.state.user.sessions.length, 2);
  t.like(ctx.state.user.sessions[0], { sid: '15', ip: '127.0.0.3' });
  t.like(ctx.state.user.sessions[1], { sid: '42', ip: '127.0.0.1' });

  await ctx.invalidateOtherSessions();

  t.is(ctx.state.user.sessions.length, 1);
  t.like(ctx.state.user.sessions[0], { sid: '42', ip: '127.0.0.1' });
});
