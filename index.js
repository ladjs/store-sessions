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

    // return early if the user is not authenticated
    if (
      typeof ctx.state.user !== 'object' ||
      typeof ctx.state.user.save !== 'function' ||
      typeof ctx.isAuthenticated !== 'function' ||
      !ctx.isAuthenticated() ||
      !ctx.sessionId
    )
      return next();

    // add helper function to ctx
    // will be able to invalidate all other sessions
    ctx.invalidateOtherSessions = async () => {
      if (Array.isArray(ctx.state.user[this.config.fields.sessions])) {
        const newSessions = [];

        await Promise.all(
          ctx.state.user[this.config.fields.sessions].map(async (session) => {
            // move on if this is the current session
            if (session[this.config.fields.sid] === ctx.sessionId) {
              newSessions.push(session);
              return;
            }

            // remove session from store
            return ctx.sessionStore.destroy(ctx.sessionId);
          })
        );

        ctx.state.user[this.config.fields.sessions] = newSessions;

        ctx.state.user = await ctx.state.user.save();
      }
    };

    debug(`storing sessionId ${ctx.sessionId} for user ${ctx.state.user.id}`);
    if (Array.isArray(ctx.state.user[this.config.fields.sessions])) {
      const idx = ctx.state.user[this.config.fields.sessions].findIndex(
        (s) => s.sid === ctx.sessionId
      );

      if (idx === -1) {
        ctx.state.user[this.config.fields.sessions].push({
          [this.config.fields.ip]: ctx.ip,
          [this.config.fields.sid]: ctx.sessionId,
          [this.config.fields.lastActivity]: new Date()
        });
      } else {
        ctx.state.user[this.config.fields.sessions][idx].ip = ctx.ip;
        ctx.state.user[this.config.fields.sessions][idx].lastActivity =
          new Date();
      }
    } else {
      ctx.state.user[this.config.fields.sessions] = [
        {
          [this.config.fields.ip]: ctx.ip,
          [this.config.fields.sid]: ctx.sessionId,
          [this.config.fields.lastActivity]: new Date()
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
