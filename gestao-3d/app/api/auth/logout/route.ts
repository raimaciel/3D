import { COOKIE, lerCookie, encerrarSessao, cookieDeSaida, origemInvalida } from '@/lib/sessao';

export async function POST(request: Request) {
  const barrado = origemInvalida(request);
  if (barrado) return barrado;
  try { await encerrarSessao(lerCookie(request, COOKIE)); } catch { /* sair sempre funciona */ }
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookieDeSaida(request), 'Cache-Control': 'no-store' } });
}
