/* node --experimental-strip-types lib/auth.teste.ts */
import { hashSenha, conferirSenha, senhaPrecisaRehash, novoToken, hashToken,
         comparaSegura, normalizarEmail, emailValido, problemaNaSenha } from './auth.ts';

let passou = 0, falhou = 0;
const ok = (n: string, c: boolean, d?: string) => {
  if (c) { passou++; console.log('  ok   ' + n); }
  else { falhou++; console.log('  FALHA ' + n + (d ? '\n        ' + d : '')); }
};
const titulo = (s: string) => console.log('\n' + s);

titulo('1. Senha');
{
  const h = await hashSenha('uma-senha-boa-123');
  ok('a senha certa confere', await conferirSenha('uma-senha-boa-123', h));
  ok('a senha errada não confere', !(await conferirSenha('uma-senha-boa-124', h)));
  ok('senha vazia não confere', !(await conferirSenha('', h)));
  ok('o hash não contém a senha em texto', !h.includes('uma-senha-boa-123'));

  const h2 = await hashSenha('uma-senha-boa-123');
  ok('duas senhas iguais geram hashes diferentes (sal aleatório)', h !== h2);
  ok('mas as duas conferem', await conferirSenha('uma-senha-boa-123', h2));

  ok('hash corrompido não derruba, só recusa', !(await conferirSenha('x', 'lixo')));
  ok('hash vazio não derruba', !(await conferirSenha('x', '')));
  ok('iterações absurdas são recusadas', !(await conferirSenha('x', 'pbkdf2$99999999$aa$bb')));
  ok('algoritmo desconhecido é recusado', !(await conferirSenha('x', 'md5$1000$aa$bb')));

  const antigo = await hashSenha('abc123456789', 20000);
  ok('detecta hash feito com custo menor', senhaPrecisaRehash(antigo));
  ok('não pede rehash do hash atual', !senhaPrecisaRehash(h));
  ok('hash antigo ainda confere', await conferirSenha('abc123456789', antigo));
}

titulo('2. Token de sessão');
{
  const a = novoToken(), b = novoToken();
  ok('tem 64 hex (256 bits)', /^[0-9a-f]{64}$/.test(a));
  ok('dois tokens nunca se repetem', a !== b);
  const ha = await hashToken(a);
  ok('o hash tem 64 hex', /^[0-9a-f]{64}$/.test(ha));
  ok('o hash não revela o token', ha !== a);
  ok('o mesmo token dá sempre o mesmo hash', ha === await hashToken(a));
  ok('tokens diferentes dão hashes diferentes', ha !== await hashToken(b));
}

titulo('3. Comparação em tempo constante');
{
  ok('iguais', comparaSegura('abc', 'abc'));
  ok('diferentes', !comparaSegura('abc', 'abd'));
  ok('tamanhos diferentes', !comparaSegura('abc', 'abcd'));
  ok('não quebra com tipo errado', !comparaSegura(null as never, 'abc'));
  ok('vazios iguais', comparaSegura('', ''));
}

titulo('4. E-mail');
{
  ok('normaliza espaços e maiúsculas', normalizarEmail('  Joao@Exemplo.COM  ') === 'joao@exemplo.com');
  ok('nulo vira string vazia', normalizarEmail(null) === '');
  ok('aceita e-mail comum', emailValido('joao@exemplo.com'));
  ok('recusa sem arroba', !emailValido('joaoexemplo.com'));
  ok('recusa sem domínio', !emailValido('joao@'));
  ok('recusa com espaço', !emailValido('jo ao@exemplo.com'));
  ok('recusa gigante', !emailValido('a'.repeat(250) + '@x.com'));
}

titulo('5. Regra de senha');
{
  ok('recusa curta', problemaNaSenha('12345') !== null);
  ok('recusa só números', problemaNaSenha('1234567890123') !== null);
  ok('aceita razoável', problemaNaSenha('filamento2026') === null);
  ok('recusa gigante', problemaNaSenha('a'.repeat(300)) !== null);
  ok('não quebra com tipo errado', problemaNaSenha(null as never) !== null);
}

console.log('\n' + '='.repeat(56));
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
