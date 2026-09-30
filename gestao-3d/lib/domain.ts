import { z } from 'zod';
import { calcularPreco, analisarPreco } from './precificacao.ts';
export const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const num=z.number().finite().min(0).max(10000000);
const name=z.string().trim().min(1,'Preencha o nome.').max(200);
const txt=z.string().max(2000).default('');
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v+'T12:00:00Z')),'Data inválida');
// Formato dos itens JA SALVOS nos orcamentos e pedidos. A Precificacao que
// preenchia estes campos foi apagada em 28/09/2026 para ser refeita; o formato
// fica porque Orcamentos, Pedidos e Producao ainda leem os itens salvos.
// O nome de cada campo diz o ESCOPO de proposito: confundir "por peca" com
// "uma vez" foi a origem de um erro de 20x na calculadora antiga.
//   weight / hours  -> POR PECA (o produto cadastrado guarda assim)
//   power           -> WATTS (era kW antes; a etiqueta da impressora vem em W)
//   nao existe mais "price": o preco agora e CALCULADO a partir do ROI.
export const calculationSchema=z.object({
  quantity:z.number().int().min(1).max(100000),
  weight:num,hours:num,kgPrice:num,
  machineRate:num,power:num,energyRate:num,maintenance:num,
  paint:z.boolean(),paintRate:num,finish:num,
  modelingHours:num,modelingRate:num,
  custom:z.boolean(),customDescription:txt,customMinutes:num,customRate:num,
  customScope:z.enum(['pedido','peca']),
  finishMinutes:num,setupMinutes:num,laborRate:num,
  packaging:num,loss:num.max(100),
  tax:num.max(100),marketplace:num.max(100),fixedFee:num,roas:num,roi:num,
  // Insumos que UMA peça leva (argola, saquinho...). O custo por unidade é
  // copiado no momento do cálculo: mudar o preço do insumo depois não mexe em
  // orçamento já salvo. Default: orçamentos antigos não têm o campo.
  supplies:z.array(z.object({id:z.string(),name:z.string().max(200),kind:z.enum(['acabamento','embalagem']),qty:num,unitCost:num})).max(30).default([])
});
export type Calculation=z.infer<typeof calculationSchema>;
export type InsumoDoItem=Calculation['supplies'][number];
/** Custo dos insumos de UMA peça. */
export const custoInsumosPorPeca=(c:Pick<Calculation,'supplies'>)=>(c.supplies||[]).reduce((a,x)=>a+(Number(x.qty)||0)*(Number(x.unitCost)||0),0);

/** Arquivo que o cliente mandou (STL, 3MF, foto de referência), preso ao item. */
export const arquivoSchema=z.object({
  url:z.string().regex(/^\/api\/files\/[a-f0-9-]{36}$/,'Endereço de arquivo inválido.'),
  nome:z.string().trim().min(1).max(200)
});
export type Arquivo=z.infer<typeof arquivoSchema>;
export const defaults:Calculation={
  quantity:1,weight:0,hours:0,kgPrice:0,
  machineRate:0,power:150,energyRate:1.12,maintenance:1,
  paint:false,paintRate:2,finish:0,
  modelingHours:0,modelingRate:0,
  custom:false,customDescription:'',customMinutes:0,customRate:0,customScope:'pedido',
  finishMinutes:0,setupMinutes:0,laborRate:0,
  // Embalagem e outros acabamentos agora vêm dos insumos cadastrados; os
  // campos antigos ficam em zero (continuam valendo em orçamentos antigos).
  packaging:0,loss:0,
  tax:0,marketplace:0,fixedFee:0,roas:0,roi:100,
  supplies:[]
};
// A tela pede peso e tempo POR PECA; o motor trabalha com o total do trabalho.
// A conversao mora aqui, num lugar so, para nao se repetir nem divergir.
function entradaDoMotor(c:Calculation){
 return {
  quantidade:c.quantity,lote:c.quantity>1,
  peso:c.weight*c.quantity,horas:c.hours*c.quantity,precoKg:c.kgPrice,
  potencia:c.power,tarifaKwh:c.energyRate,taxaMaquina:c.machineRate,
  manutencao:c.maintenance,
  pintura:c.paint,taxaPintura:c.paintRate,acabamentoFixo:c.finish,
  modelagemHoras:c.modelingHours,modelagemHora:c.modelingRate,
  personalizacaoMin:c.custom?c.customMinutes:0,personalizacaoHora:c.customRate,
  personalizacaoEscopo:c.customScope,
  acabamentoMin:c.finishMinutes,preparoMin:c.setupMinutes,maoHora:c.laborRate,
  embalagem:c.packaging,insumos:custoInsumosPorPeca(c),falha:c.loss,
  imposto:c.tax,marketplace:c.marketplace,taxaFixa:c.fixedFee,roas:c.roas,roi:c.roi
 };
}
export function calculate(c:Calculation){
 const r=calcularPreco(entradaDoMotor(c));
 const rows=Object.entries(r.itens).filter(([,v])=>v>0) as [string,number][];
 const cost=money(r.custoTotal),revenue=money(r.preco*r.quantidade);
 // Lucro DEPOIS de imposto, marketplace, anuncios e taxa fixa, como o motor
 // calcula. (Antes era receita menos custo, sem as taxas: com imposto ou
 // marketplace, a tela mostrava um lucro maior que o de verdade.)
 // profit e do lote inteiro; unitProfit e o de cada peca. A tela mostra os dois
 // com rotulo de escopo, porque o dono vende peca avulsa e vende lote.
 const profit=money(r.lucroPeca*r.quantidade);
 return {rows,cost,revenue,profit,
  quantity:r.quantidade,unitProfit:money(r.lucroPeca),
  unitCost:r.custoPeca,unitPrice:r.preco,
  minPrice:r.precoMinimo,profitPerHour:money(r.lucroPorHora),
  hours:c.hours*c.quantity,
  margin:revenue?profit/revenue*100:0,
  roiReal:r.roiReal,blocked:r.bloqueado,percFees:r.percTaxas,
  discounts:Object.entries(r.descontos).filter(([,v])=>v>0) as [string,number][],
  // Material que sai do estoque de fato, ja contando a perda esperada.
  grams:c.weight*c.quantity*(1+c.loss/100)};
}
/** "O cliente pediu outro preço": quanto sobra se vender por `price` cada peça. */
export function analyzeOffer(c:Calculation,price:number){
 const a=analisarPreco(entradaDoMotor(c),price);
 return {unitProfit:money(a.lucroPeca),profit:money(a.lucroTotal),roiReal:a.roiReal,difference:money(a.diferenca)};
}
export function safeSupplierLink(value:unknown):string{if(typeof value!=='string'||!value.trim())return '';try{const u=new URL(value.trim());return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}}
const supplierLink=z.string().trim().max(2000).default('').refine(v=>v===''||!!safeSupplierLink(v),'Informe um link completo começando com https:// ou http://.');
export const entitySchemas={customers:z.object({name,phone:txt,email:z.string().max(200).default(''),notes:txt}),suppliers:z.object({name,phone:txt,notes:txt,supplierType:z.enum(['','online','fisico']).default(''),platform:z.string().trim().max(100).default(''),link:supplierLink,address:txt}),materials:z.object({name,brand:z.string().trim().max(200).default(''),model:z.string().trim().max(200).default(''),type:name,color:name,kgPrice:num,minimum:num,spoolCount:z.number().int().finite().min(0).max(100000).default(0),spoolWeight:num.default(0),spoolPrice:num.default(0),supplierId:z.string().default(''),paymentType:z.enum(['avista','parcelado']).default('avista'),installments:z.number().int().finite().min(1).max(120).default(1),notes:txt}),printers:z.object({name,model:z.string().trim().max(200).default(''),brand:z.string().trim().max(200).default(''),machineRate:num,power:num,value:num.default(0),lifeHours:num.default(0),notes:txt}),products:z.object({name,category:name,model:z.string().trim().max(200).default(''),color:z.string().trim().max(100).default(''),description:txt,weight:num,hours:num,photo:txt})};
export type Kind=keyof typeof entitySchemas;
export type Entity={id:string;[key:string]:any};
export type Item={id:string;name:string;category:string;materialId:string;printerId:string;calculation:Calculation;arquivos:Arquivo[];cost:number;revenue:number;grams:number};
export type Quote={id:string;number:number;customerId:string;customerName:string;date:string;due:string;notes:string;items:Item[];cost:number;revenue:number;status:string};
export type Order=Quote & {quoteId:string;stage:string;printed:boolean;painted:boolean;packed:boolean;delivered:boolean;photos:string[]};
export type State={customers:Entity[];suppliers:Entity[];materials:Entity[];printers:Entity[];products:Entity[];quotes:Quote[];orders:Order[];payments:Entity[];purchases:Entity[];movements:Entity[];investments:Entity[];supplies:Entity[];supplyMovements:Entity[];tools:Entity[];settings:{company:string;document:string;phone:string;email:string;address:string;logo:string;energyRate:number;maintenance:number;paintRate:number;laborRate:number;machineRate:number;};};
export const emptyState=():State=>({customers:[],suppliers:[],materials:[],printers:[],products:[],quotes:[],orders:[],payments:[],purchases:[],movements:[],investments:[],supplies:[],supplyMovements:[],tools:[],settings:{company:'Gestão 3D',document:'',phone:'',email:'',address:'',logo:'',energyRate:1.12,maintenance:1,paintRate:2,laborRate:0,machineRate:0}});
export const stages=['Na fila','Imprimindo','Acabamento','Embalagem','Pronto','Entregue'];
export function stock(s:State,id:string){return s.movements.filter(x=>x.materialId===id).reduce((a,b)=>a+b.grams,0)}
/** Estoque de um insumo, em unidades (soma das entradas e saídas). */
export function supplyStock(s:State,id:string){return (s.supplyMovements||[]).filter(x=>x.supplyId===id).reduce((a,b)=>a+(Number(b.qty)||0),0)}
/** Quanto de cada insumo um pedido gasta: quantidade por peça × peças de cada item. */
export function suppliesUsed(o:Quote){const used=new Map<string,{name:string;qty:number}>();for(const i of o.items)for(const x of (i.calculation.supplies||[])){const q=(Number(x.qty)||0)*(Number(i.calculation.quantity)||0);const a=used.get(x.id);used.set(x.id,{name:x.name,qty:(a?.qty||0)+q});}return used}
/** Lucro do pedido inteiro, já descontados imposto, marketplace, anúncio e taxa fixa. */
export function orderProfit(o:Quote){return money(o.items.reduce((a,i)=>a+calculate(i.calculation).profit,0))}
export function received(s:State,id:string){return money(s.payments.filter(x=>x.orderId===id).reduce((a,b)=>a+b.amount,0))}
const ref=(list:Entity[],id:string,label:string)=>{const v=list.find(x=>x.id===id);if(!v)throw new Error(label+' não encontrado.');return v;};
const uid=()=>crypto.randomUUID();
export function applyAction(s:State,action:any):State{
 if(!action||typeof action.type!=='string')throw new Error('Operação inválida.');
 if(action.type==='entity'){
  const k=z.enum(['customers','suppliers','materials','printers','products']).parse(action.kind),data=entitySchemas[k].parse(action.data),id=action.id?z.string().uuid().parse(action.id):uid();
  if(k==='materials'&&data.supplierId)ref(s.suppliers,data.supplierId,'Fornecedor');
  if(action.id)ref(s[k],id,'Cadastro');s[k]=[...s[k].filter(x=>x.id!==id),{...data,id}] as any;
  if(k==='materials'&&!action.id&&data.spoolCount>0&&data.spoolWeight>0)s.movements.push({id:uid(),materialId:id,grams:data.spoolCount*data.spoolWeight,date:new Date().toISOString().slice(0,10),reason:`Cadastro de ${data.spoolCount} bobina(s)`});
 }else if(action.type==='company'){
  const p=z.object({company:name,document:z.string().trim().max(80).default(''),phone:txt,email:z.string().trim().max(200).default('').refine(v=>v===''||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),'E-mail inválido.'),address:txt,logo:z.string().max(2000).default('')}).parse(action.data);
  s.settings={...s.settings,...p};
 }else if(action.type==='settings'){
  const p=z.object({energyRate:num,maintenance:num.max(100),paintRate:num,laborRate:num,machineRate:num}).parse(action.data);
  s.settings={...s.settings,...p};
 }
 else if(action.type==='quote'){
  const p=z.object({customerId:z.string(),date,due:date,notes:txt,items:z.array(z.object({name,category:name,materialId:z.string(),printerId:z.string(),calculation:calculationSchema,arquivos:z.array(arquivoSchema).max(10).default([])})).min(1).max(100)}).parse(action.data);
  const customer=ref(s.customers,p.customerId,'Cliente');
  const items=p.items.map(v=>{ref(s.materials,v.materialId,'Material');ref(s.printers,v.printerId,'Impressora');const c=calculate(v.calculation);return {...v,id:uid(),cost:c.cost,revenue:c.revenue,grams:c.grams}});
  s.quotes.push({...p,id:uid(),number:s.quotes.length+1,customerName:customer.name,items,cost:money(items.reduce((a,b)=>a+b.cost,0)),revenue:money(items.reduce((a,b)=>a+b.revenue,0)),status:'Aberto'});
 }else if(action.type==='approve'){
  const q=ref(s.quotes,action.id,'Orçamento') as Quote;if(q.status!=='Aberto')throw new Error('Este orçamento já foi aprovado.');q.status='Aprovado';s.orders.push({...structuredClone(q),id:uid(),quoteId:q.id,number:s.orders.length+1,stage:'Na fila',printed:false,painted:false,packed:false,delivered:false,photos:[]});
 }else if(action.type==='production'){
  const o=ref(s.orders,action.id,'Pedido') as Order,p=z.object({printed:z.boolean(),painted:z.boolean(),packed:z.boolean(),delivered:z.boolean(),stage:z.enum(['Na fila','Imprimindo','Acabamento','Embalagem','Pronto','Entregue'])}).parse(action.data),wasPrinted=o.printed,wasPacked=o.packed;
  if(wasPacked&&!p.packed)throw new Error('Embalagem já registrada. Use um ajuste de estoque dos insumos para correções.');
  if(o.delivered&&(!p.delivered||p.stage!=='Entregue'))throw new Error('O pedido já foi entregue.');
  if(['Acabamento','Embalagem','Pronto'].includes(p.stage)&&!p.printed)throw new Error('Registre a impressão para avançar de etapa.');
  if(p.stage==='Pronto'&&(!p.packed||(o.items.some(x=>x.calculation.paint)&&!p.painted)))throw new Error('Conclua pintura aplicável e embalagem para marcar como pronto.');
  if(wasPrinted&&!p.printed)throw new Error('Impressão já registrada. Use um ajuste de estoque para correções.');
  if(p.delivered&&(!p.printed||!p.packed||(o.items.some(x=>x.calculation.paint)&&!p.painted)))throw new Error('Conclua impressão, pintura aplicável e embalagem antes de entregar.');
  if((p.painted||p.packed)&&!p.printed)throw new Error('Registre a impressão primeiro.');
  if(p.stage==='Entregue'&&!p.delivered)throw new Error('Marque a entrega para concluir.');
  if(p.printed&&!wasPrinted){const used=new Map<string,number>();for(const i of o.items)used.set(i.materialId,(used.get(i.materialId)||0)+i.grams);for(const [id,g] of used){if(stock(s,id)+.00001<g)throw new Error('Estoque insuficiente de '+ref(s.materials,id,'Material').name+'. Registre uma compra ou entrada.');s.movements.push({id:uid(),materialId:id,grams:-g,date:new Date().toISOString().slice(0,10),reason:'Impressão do pedido #'+o.number,orderId:o.id});}}
  // Insumos saem do estoque quando o pedido é embalado (decisão do dono).
  // Insumo apagado do cadastro depois do orçamento é ignorado.
  if(p.packed&&!wasPacked){const hojeISO=new Date().toISOString().slice(0,10);const saidas=[...suppliesUsed(o)].filter(([id])=>(s.supplies||[]).some(x=>x.id===id));
   for(const [id,u] of saidas){const tem=supplyStock(s,id);if(tem+1e-9<u.qty)throw new Error(`Estoque insuficiente de ${u.name}: o pedido usa ${u.qty.toLocaleString('pt-BR')} e há ${tem.toLocaleString('pt-BR')}. Registre uma entrada em Materiais → Insumos.`);}
   for(const [id,u] of saidas)s.supplyMovements.push({id:uid(),supplyId:id,qty:-u.qty,date:hojeISO,reason:'Embalagem do pedido #'+o.number,orderId:o.id});}
  Object.assign(o,p,{stage:p.delivered?'Entregue':p.stage});
 }else if(action.type==='payment'){
  const p=z.object({orderId:z.string(),amount:num.positive(),date,method:name}).parse(action.data);const o=ref(s.orders,p.orderId,'Pedido');p.amount=money(p.amount);if(!p.amount||p.amount>money(o.revenue-received(s,o.id)))throw new Error('O recebimento deve ser maior que zero e não pode superar o saldo.');s.payments.push({...p,id:uid()});
 }else if(action.type==='purchase'){
  const p=z.object({description:name,supplierId:z.string(),materialId:z.string(),grams:num,amount:num.positive(),date,due:date,paid:z.boolean(),category:name,paymentType:z.enum(['avista','parcelado']).default('avista'),installments:z.number().int().finite().min(1).max(120).default(1)}).parse(action.data);if(p.supplierId)ref(s.suppliers,p.supplierId,'Fornecedor');if(p.materialId){ref(s.materials,p.materialId,'Material');if(!p.grams)throw new Error('Informe a quantidade em gramas.');}p.installments=p.paymentType==='avista'?1:p.installments;const id=uid();s.purchases.push({...p,amount:money(p.amount),id,paidDate:p.paid?p.date:''});if(p.materialId)s.movements.push({id:uid(),materialId:p.materialId,grams:p.grams,date:p.date,reason:p.description,purchaseId:id});
 }else if(action.type==='payPurchase'){
  const p=ref(s.purchases,action.id,'Conta');if(p.paid)throw new Error('Conta já paga.');p.paid=true;p.paidDate=date.parse(action.date);
 }else if(action.type==='movement'){
  const p=z.object({materialId:z.string(),grams:z.number().finite().min(-10000000).max(10000000).refine(n=>n!==0),date,reason:name}).parse(action.data);ref(s.materials,p.materialId,'Material');if(stock(s,p.materialId)+p.grams<0)throw new Error('O saldo não pode ficar negativo.');s.movements.push({...p,id:uid()});
 }else if(action.type==='supply'){
  // Insumo: argola, saquinho, caixa, ímã... contado em UNIDADES (o filamento
  // é em gramas e fica em materials). Com id, edita; sem id, cria, e a
  // quantidade inicial entra no estoque como primeira movimentação.
  // kind "consumo" = material de consumo (lâmina, lixa, cola): tem estoque,
  // mas não vai uma quantidade por peça, então não aparece na Precificação.
  const p=z.object({name,kind:z.enum(['acabamento','embalagem','consumo']),unit:z.string().trim().min(1).max(30).default('unidade'),unitCost:num,minimum:num.default(0),notes:txt,initialQty:num.default(0)}).parse(action.data);
  const id=action.id?z.string().uuid().parse(action.id):uid();
  if(action.id)ref(s.supplies,id,'Insumo');
  const {initialQty,...dados}=p;
  s.supplies=[...s.supplies.filter(x=>x.id!==id),{...dados,unitCost:money(dados.unitCost),id}];
  if(!action.id&&initialQty>0)s.supplyMovements.push({id:uid(),supplyId:id,qty:initialQty,date:new Date().toISOString().slice(0,10),reason:'Cadastro inicial'});
 }else if(action.type==='tool'){
  // Ferramenta ou equipamento (paquímetro, maçarico, alicate...): bem que a
  // empresa usa e dura anos (imobilizado). Entra sozinha no total de
  // Investimentos, na categoria "Ferramentas", sem ser lançada duas vezes.
  const p=z.object({name,category:z.string().trim().max(100).default(''),date,value:num,method:z.string().trim().max(60).default(''),bank:z.string().trim().max(100).default(''),
   status:z.enum(['em uso','quebrada','perdida','emprestada']).default('em uso'),notes:txt}).parse(action.data);
  const id=action.id?z.string().uuid().parse(action.id):uid();
  if(action.id)ref(s.tools,id,'Ferramenta');
  s.tools=[...s.tools.filter(x=>x.id!==id),{...p,value:money(p.value),id}];
 }else if(action.type==='removeTool'){
  const id=z.string().uuid().parse(action.id);ref(s.tools,id,'Ferramenta');
  s.tools=s.tools.filter(x=>x.id!==id);
 }else if(action.type==='supplyMovement'){
  // Entrada (compra), perda ou ajuste. Positivo entra, negativo sai.
  const p=z.object({supplyId:z.string().uuid(),qty:z.number().finite().refine(v=>v!==0,'Informe uma quantidade diferente de zero.'),date,reason:name}).parse(action.data);
  ref(s.supplies,p.supplyId,'Insumo');
  s.supplyMovements.push({...p,id:uid()});
 }else if(action.type==='removeSupply'){
  // Apaga o cadastro; orçamentos antigos guardam nome e custo do insumo e não mudam.
  const id=z.string().uuid().parse(action.id);ref(s.supplies,id,'Insumo');
  s.supplies=s.supplies.filter(x=>x.id!==id);
 }else if(action.type==='investment'){
  // Investimento: o que foi posto na empresa (impressora, ferramentas,
  // material inicial...). Com id, edita; sem id, cria.
  // Parcelado: quantas parcelas e o vencimento da 1ª; as parcelas pagas o
  // dono marca à mão (ação investmentParcel). À vista conta como pago.
  const p=z.object({date,description:name,category:name,amount:num.positive(),method:name,bank:z.string().trim().max(100).default(''),notes:txt,
   parcelado:z.boolean().default(false),installments:z.number().int().min(1).max(120).default(1),firstDue:z.union([date,z.literal('')]).default('')}).parse(action.data);
  if(p.parcelado&&p.installments<2)throw new Error('Parcelado precisa de pelo menos 2 parcelas.');
  if(p.parcelado&&!p.firstDue)throw new Error('Informe o vencimento da 1ª parcela.');
  if(!p.parcelado){p.installments=1;p.firstDue='';}
  const id=action.id?z.string().uuid().parse(action.id):uid();
  const antes=action.id?ref(s.investments,id,'Investimento'):null;
  // Ao editar, as parcelas já marcadas continuam marcadas (só as que ainda existem).
  const paidParcels=p.parcelado?((antes?.paidParcels as number[])||[]).filter(n=>n<=p.installments):[];
  s.investments=[...s.investments.filter(x=>x.id!==id),{...p,amount:money(p.amount),paidParcels,id}];
 }else if(action.type==='investmentParcel'){
  // Marca ou desmarca UMA parcela como paga.
  const id=z.string().uuid().parse(action.id),numero=z.number().int().min(1).max(120).parse(action.numero),paga=z.boolean().parse(action.paga);
  const inv=ref(s.investments,id,'Investimento');
  if(!inv.parcelado||numero>Number(inv.installments))throw new Error('Parcela inexistente.');
  const marcadas=new Set<number>((inv.paidParcels as number[])||[]);
  if(paga)marcadas.add(numero);else marcadas.delete(numero);
  inv.paidParcels=[...marcadas].sort((a,b)=>a-b);
 }else if(action.type==='removeInvestment'){
  const id=z.string().uuid().parse(action.id);ref(s.investments,id,'Investimento');
  s.investments=s.investments.filter(x=>x.id!==id);
 }else if(action.type==='photo'){
  const o=ref(s.orders,action.id,'Pedido') as Order;const key=z.string().regex(/^\/api\/files\/[a-f0-9-]+$/).parse(action.key);o.photos.push(key);
 }else throw new Error('Operação desconhecida.');return s;
}
