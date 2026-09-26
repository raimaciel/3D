import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/** Estado do sistema. Hoje é um documento JSON só; virará tabelas de verdade. */
export const workspace = sqliteTable('workspace', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  data: text('data').notNull(),
  updated: text('updated').notNull()
});

/** Quem entra no sistema. A coluna password guarda o HASH, nunca a senha. */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('equipe'),
  password: text('password').notNull(),
  created: text('created').notNull()
});

/** Sessões abertas. O id é o HASH do token do cookie, nunca o token. */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expires: text('expires').notNull(),
  created: text('created').notNull()
});

/** Tentativas de login por e-mail, para travar forca bruta. */
export const loginAttempts = sqliteTable('login_attempts', {
  email: text('email').primaryKey(),
  fails: integer('fails').notNull().default(0),
  until: text('until').notNull()
});
