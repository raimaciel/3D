'use client';
/*
 * Anexos de uma peça num pedido JÁ existente (02/10/2026). Pedido do dono: o
 * cliente manda o STL pelo WhatsApp depois de aprovar, e tem que haver onde pôr.
 * Aparece na janela do pedido (Pedidos e Produção), embaixo de cada peça.
 *
 * Remover só tira o anexo da peça: o arquivo continua guardado na Cloudflare
 * (decisão do dono), então um engano tem volta.
 */
import { useRef, useState } from 'react';
import { Paperclip, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Arquivo } from '@/lib/domain';

const LIMITE = 10;

export function AnexosDaPeca({ pedidoId, itemId, arquivos, ocupado, enviarArquivo, salvar }: {
  pedidoId: string;
  itemId: string;
  /** Lidos do estado salvo (não da cópia do formulário), para refletir na hora. */
  arquivos: Arquivo[];
  ocupado: boolean;
  enviarArquivo: (f: File) => Promise<{ url: string; nome: string }>;
  salvar: (acao: unknown) => Promise<boolean>;
}) {
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const travado = ocupado || enviando;
  const cheio = arquivos.length >= LIMITE;

  async function anexar(f: File | undefined) {
    if (!f) return;
    setEnviando(true);
    try {
      const enviado = await enviarArquivo(f);
      await salvar({ type: 'attachFile', id: pedidoId, itemId, arquivo: { url: enviado.url, nome: enviado.nome } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setEnviando(false);
      if (campo.current) campo.current.value = '';   // permite escolher o mesmo arquivo de novo
    }
  }

  async function remover(a: Arquivo) {
    if (!window.confirm(`Remover "${a.nome}" desta peça?`)) return;
    await salvar({ type: 'removeFile', id: pedidoId, itemId, url: a.url });
  }

  return (
    <div className="anexos-peca">
      {arquivos.length > 0
        ? <ul>
            {arquivos.map(a => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noopener noreferrer"><Paperclip size={14} />{a.nome}</a>
                <button type="button" className="anexo-remover" disabled={travado} onClick={() => remover(a)} aria-label={`Remover ${a.nome}`}>
                  <Trash2 size={14} /> remover
                </button>
              </li>
            ))}
          </ul>
        : <small className="muted">Nenhum arquivo anexado.</small>}
      <input ref={campo} type="file" hidden accept=".stl,.3mf,image/png,image/jpeg,image/webp"
        onChange={e => anexar(e.target.files?.[0])} />
      <button type="button" className="btn secondary anexo-botao" disabled={travado || cheio}
        onClick={() => campo.current?.click()}>
        <Plus size={16} /> {enviando ? 'Enviando…' : 'Anexar arquivo'}
      </button>
      {cheio && <small className="muted">Limite de {LIMITE} arquivos por peça.</small>}
    </div>
  );
}
