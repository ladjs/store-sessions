const isSANB = require('is-string-and-not-blank');
const debug = require('debug')('@ladjs/store-sessions');

class StoreSessions {
  constructor(config = {}) {
    this.config = {
      logger: console,
      // schema to be used in sesssions field
      schema: false,
      ...config,
      fields: {
        sessions: 'sessions',
        ip: 'ip',
        lastActivity: 'last_activity',
        sid: 'sid'
      }
    };

    if (config.fields) {
      this.config.fields = { ...this.config.fields, ...config.fields };
    }

    // validate field props are set
    for (const prop of ['sessions', 'ip', 'lastActivity', 'sid'])
      if (!isSANB(this.config.fields[prop]))
        throw new Error(`${prop} must be a String`);

    if (!this.config.schema && typeof this.config.schema !== 'object')
      throw new Error('schema must be a Mongoose Schema');

    this.middleware = this.middleware.bind(this);
    this.plugin = this.plugin.bind(this);
  }

  async middleware(ctx, next) {
    if (!ctx.session) return ctx.throw(new Error('Sessions required'));
    if (typeof ctx.saveSession !== 'function')
      throw new Error(
        'Please use koa-generic-session v2.0.3+ which exposes a `ctx.saveSession()` method'
      );
    if (typeof ctx.logOut !== 'function')
      throw new Error(
        'Please use koa-passport which exposes a `ctx.logOut` method'
      );

    // return early if the user is not authenticated
    if (
      typeof ctx.state.user !== 'object' ||
      typeof ctx.state.user.save !== 'function' ||
      typeof ctx.isAuthenticated !== 'function' ||
      !ctx.isAuthenticated() ||
      !ctx.sessionId
    )
      return next();

    const { fields } = this.config;

    // overwrite ctx.logout to remove session on logout
    const _logOut = ctx.logOut;
    ctx.logOut = async function () {
      debug(
        `removing session ${ctx.sessionId} on logout for ${ctx.state.user.id}`
      );
      /* istanbul ignore else */
      if (Array.isArray(ctx.state.user[fields.sessions])) {
        ctx.state.user[fields.sessions] = ctx.state.user[
          fields.sessions
        ].filter((session) => !(session.sid === ctx.sessionId));

        ctx.state.user = ctx.state.user.save();
      }

      return _logOut();
    };

    ctx.logout = ctx.logOut;

    // add helper function to ctx
    // will be able to invalidate all other sessions
    ctx.invalidateOtherSessions = async () => {
      // return early if the user is not authenticated
      if (
        typeof ctx.state.user !== 'object' ||
        typeof ctx.state.user.save !== 'function' ||
        typeof ctx.isAuthenticated !== 'function' ||
        !ctx.isAuthenticated()
      )
        return next();

      debug(
        `invalidating all other sessions except ${ctx.sessionId} from user ${ctx.state.user.id}`
      );
      /* istanbul ignore else */
      if (Array.isArray(ctx.state.user[fields.sessions])) {
        const newSessions = [];

        await Promise.all(
          ctx.state.user[fields.sessions].map(async (session) => {
            // move on if this is the current session
            if (session[fields.sid] === ctx.sessionId) {
              newSessions.push(session);
              return;
            }

            // remove session from store
            return ctx.sessionStore.destroy(ctx.sessionId);
          })
        );

        ctx.state.user[fields.sessions] = newSessions;

        ctx.state.user = await ctx.state.user.save();
      }
    };

    debug(`storing sessionId ${ctx.sessionId} for user ${ctx.state.user.id}`);
    if (Array.isArray(ctx.state.user[fields.sessions])) {
      const newSessions = [];
      let found = false;

      await Promise.all(
        ctx.state.user[fields.sessions].map(async (session) => {
          if (session.sid === ctx.sessionId) {
            found = true;
            session[fields.ip] = ctx.ip;
            session[fields.lastActivity] = new Date();
            newSessions.push(session);
            return;
          }

          try {
            const sess = await ctx.sessionStore.get(session.sid);

            if (sess) {
              newSessions.push(session);
            }
          } catch (err) {
            this.config.logger.error(err);
            // still saving this session since something went wrong with getting the session
            // if it didn't exist we would have gotten 'null'
            newSessions.push(session);
          }
        })
      );

      // if we didn't find the sessionId already
      // then add it to the end of the new array
      if (!found) {
        newSessions.push({
          [fields.ip]: ctx.ip,
          [fields.sid]: ctx.sessionId,
          [fields.lastActivity]: new Date()
        });
      }

      ctx.state.user[fields.sessions] = newSessions;
    } else {
      ctx.state.user[fields.sessions] = [
        {
          [fields.ip]: ctx.ip,
          [fields.sid]: ctx.sessionId,
          [fields.lastActivity]: new Date()
        }
      ];
    }

    ctx.state.user = await ctx.state.user.save();

    return next();
  }

  async plugin(schema) {
    const obj = {};
    obj[this.config.fields.sessions] = [this.config.schema];
    schema.add(obj);
    return schema;
  }
}

module.exports = StoreSessions;
