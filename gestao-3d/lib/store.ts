import { env } from 'cloudflare:workers';
import { emptyState } from './domain';
export function database(){const db=(env as unknown as {DB:D1Database}).DB;if(!db)throw new Error('Banco de dados indisponível.');return db;}
export async function readWorkspace(){const db=database();await db.prepare('INSERT OR IGNORE INTO workspace (id,revision,data,updated) VALUES (?,0,?,?)').bind('company',JSON.stringify(emptyState()),new Date().toISOString()).run();const row=await db.prepare('SELECT revision,data FROM workspace WHERE id=?').bind('company').first<{revision:number,data:string}>();if(!row)throw new Error('Dados indisponíveis.');return {revision:row.revision,state:JSON.parse(row.data)};}
