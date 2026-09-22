type VariantKey =
  | 'askName'
  | 'invalidName'
  | 'invalidQuantity'
  | 'emptyCart'
  | 'productUnavailable'
  | 'paymentUnavailable'
  | 'askCashChange'
  | 'invalidCashChange'
  | 'askStreet'
  | 'invalidStreet'
  | 'askNumber'
  | 'invalidNumber'
  | 'askNeighborhood'
  | 'invalidNeighborhood'
  | 'askComplement'
  | 'askReference'
  | 'orderCanceled'
  | 'lostContext'
  | 'confirmAddressAgain'
  | 'itemUnavailableAtConfirm'
  | 'nonText';

const variants: Record<VariantKey, readonly string[]> = {
  askName: [
    'Qual é o seu nome?',
    'Para continuar, informe seu nome.',
    'Antes de montar o pedido, me diga seu nome.',
    'Certo. Qual nome devo colocar no pedido?'
  ],
  invalidName: [
    'Digite um nome válido com até 120 caracteres.',
    'Não consegui identificar o nome. Digite somente o nome que deseja usar no pedido.',
    'Esse nome não parece válido. Tente novamente com até 120 caracteres.',
    'Informe um nome válido para que eu possa continuar o pedido.'
  ],
  invalidQuantity: [
    'Digite uma quantidade entre 1 e 99.',
    'A quantidade precisa ser um número de 1 a 99.',
    'Não consegui entender a quantidade. Digite um número entre 1 e 99.',
    'Informe somente a quantidade desejada, de 1 a 99.'
  ],
  emptyCart: [
    'Seu carrinho está vazio.',
    'Ainda não há produtos no seu carrinho.',
    'Você ainda não adicionou nenhum item ao pedido.'
  ],
  productUnavailable: [
    'Esse produto ficou indisponível. Escolha outra opção.',
    'Esse item não está mais disponível no momento. Escolha outro produto.',
    'A disponibilidade desse produto mudou e ele não pode mais ser pedido. Escolha outra opção.',
    'Esse produto acabou de ficar indisponível. Você pode selecionar outro item do cardápio.'
  ],
  paymentUnavailable: [
    'Essa forma de pagamento está indisponível.',
    'Essa opção de pagamento não está disponível no momento.',
    'No momento não conseguimos aceitar essa forma de pagamento. Escolha outra opção.'
  ],
  askCashChange: [
    'Precisa de troco? Digite o valor que vai pagar, por exemplo 50 ou 50,00. Se não precisar, digite SEM TROCO.',
    'Vai precisar de troco? Informe o valor do pagamento, como 50 ou 50,00. Caso não precise, digite SEM TROCO.',
    'Informe o valor em dinheiro que será entregue para calcular o troco. Se não precisar de troco, digite SEM TROCO.',
    'Para o pagamento em dinheiro, diga o valor que vai entregar. Exemplo: 50,00. Se for valor exato, digite SEM TROCO.'
  ],
  invalidCashChange: [
    'Valor inválido. Digite, por exemplo, 50 ou 50,00. Para não pedir troco, digite SEM TROCO.',
    'Não consegui entender o valor. Digite algo como 50 ou 50,00, ou SEM TROCO.',
    'Informe um valor válido em reais. Exemplo: 50,00. Se não precisar de troco, digite SEM TROCO.',
    'O valor informado não pôde ser lido. Tente novamente ou digite SEM TROCO.'
  ],
  askStreet: [
    'Digite o nome da rua do endereço de entrega.',
    'Agora informe a rua do endereço de entrega.',
    'Qual é o nome da rua para a entrega?'
  ],
  invalidStreet: [
    'Digite uma rua válida com até 180 caracteres.',
    'Não consegui identificar a rua. Informe novamente o nome da rua.',
    'A rua informada não parece válida. Digite novamente com até 180 caracteres.'
  ],
  askNumber: [
    'Digite o número do endereço.',
    'Agora informe o número do endereço.',
    'Qual é o número do imóvel para a entrega?'
  ],
  invalidNumber: [
    'Digite um número válido com até 30 caracteres.',
    'Não consegui identificar o número do endereço. Tente novamente.',
    'Informe um número de endereço válido com até 30 caracteres.'
  ],
  askNeighborhood: [
    'Digite o bairro.',
    'Agora informe o bairro da entrega.',
    'Qual é o bairro do endereço?'
  ],
  invalidNeighborhood: [
    'Digite um bairro válido com até 120 caracteres.',
    'Não consegui identificar o bairro. Informe novamente.',
    'Informe um bairro válido para continuar com o delivery.'
  ],
  askComplement: [
    'Digite o complemento. Se não houver, digite 0.',
    'Informe o complemento do endereço. Se não tiver, digite 0.',
    'Há complemento, bloco, apartamento ou outra informação? Se não houver, digite 0.'
  ],
  askReference: [
    'Digite um ponto de referência. Se não houver, digite 0.',
    'Informe um ponto de referência para facilitar a entrega. Se não houver, digite 0.',
    'Se houver um ponto de referência próximo, informe agora. Caso contrário, digite 0.'
  ],
  orderCanceled: [
    'Pedido cancelado.',
    'O pedido foi cancelado.',
    'Certo, cancelei esse pedido.'
  ],
  lostContext: [
    'A conversa perdeu informações necessárias. Vamos começar novamente.',
    'Algumas informações do pedido não estão mais disponíveis. Vou reiniciar o atendimento.',
    'Não consegui recuperar todos os dados desse pedido. Vamos começar novamente para evitar erros.'
  ],
  confirmAddressAgain: [
    'Precisamos confirmar o endereço. Digite o nome da rua.',
    'Antes de concluir, preciso confirmar novamente o endereço. Informe o nome da rua.',
    'Faltam informações do endereço para concluir o delivery. Digite o nome da rua.'
  ],
  itemUnavailableAtConfirm: [
    'Um item do pedido não está mais disponível. Revise o carrinho antes de continuar.',
    'A disponibilidade de um dos produtos mudou. Revise o carrinho para continuar.',
    'Um produto do carrinho ficou indisponível antes da confirmação. Revise os itens do pedido.'
  ],
  nonText: [
    'No momento, o atendimento automático aceita mensagens de texto. Digite MENU para iniciar.',
    'Este atendimento automático trabalha com mensagens de texto. Digite MENU para começar.',
    'Para fazer seu pedido pelo atendimento automático, envie mensagens de texto. Digite MENU para iniciar.'
  ]
};

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function botMessage(key: VariantKey, seed: string): string {
  const options = variants[key];
  return options[hashSeed(seed + ':' + key) % options.length] ?? options[0] ?? '';
}

export function quantityPrompt(productName: string, seed: string): string {
  const options = [
    `Quantas unidades de ${productName} você deseja? Digite de 1 a 99.`,
    `Informe a quantidade de ${productName}. Você pode pedir de 1 a 99 unidades.`,
    `Certo. Quantas unidades de ${productName} deseja adicionar ao carrinho? Digite de 1 a 99.`,
    `Escolha a quantidade de ${productName}: digite um número entre 1 e 99.`
  ] as const;
  return options[hashSeed(seed + ':quantityPrompt') % options.length] ?? options[0];
}

export function cashBelowTotalMessage(totalFormatted: string, seed: string): string {
  const options = [
    `O valor informado é menor que o total de ${totalFormatted}. Informe um valor igual ou maior, ou digite SEM TROCO.`,
    `O pedido totaliza ${totalFormatted}, então o valor para troco precisa ser igual ou maior. Informe outro valor ou digite SEM TROCO.`,
    `Esse valor não cobre o total de ${totalFormatted}. Digite um valor maior ou igual ao total, ou SEM TROCO.`
  ] as const;
  return options[hashSeed(seed + ':cashBelowTotal') % options.length] ?? options[0];
}

export function modalityUnavailableMessage(menu: string, seed: string): string {
  const options = [
    'Essa modalidade está indisponível no momento.',
    'Essa opção de atendimento não está disponível agora.',
    'No momento não conseguimos atender por essa modalidade.'
  ] as const;
  const prefix = options[hashSeed(seed + ':modalityUnavailable') % options.length] ?? options[0];
  return prefix + '\n\n' + menu;
}

export function genericOrderErrorMessage(message: string, seed: string): string {
  const options = [
    `Não foi possível concluir o pedido: ${message}\nDigite 1 para tentar novamente ou 2 para cancelar.`,
    `O pedido ainda não foi concluído: ${message}\nDigite 1 para tentar novamente ou 2 para cancelar.`,
    `Encontramos um problema ao concluir: ${message}\nDigite 1 para tentar novamente ou 2 para cancelar.`
  ] as const;
  return options[hashSeed(seed + ':genericOrderError') % options.length] ?? options[0];
}

export function businessClosedMessage(message: string, seed: string): string {
  const options = [
    `${message}\nO pedido ficou salvo nesta conversa para você tentar novamente depois.`,
    `${message}\nSeu carrinho continua salvo nesta conversa para você tentar novamente quando estivermos abertos.`,
    `${message}\nMantive os itens desta conversa para facilitar uma nova tentativa depois.`
  ] as const;
  return options[hashSeed(seed + ':businessClosed') % options.length] ?? options[0];
}

export function orderConfirmedMessage(orderNumber: string, totalFormatted: string, seed: string): string {
  const options = [
    ['Pedido confirmado.', `Número: ${orderNumber}`, `Total: ${totalFormatted}`, 'A Top Lanches recebeu seu pedido.'],
    ['Seu pedido foi confirmado.', `Pedido: ${orderNumber}`, `Total: ${totalFormatted}`, 'O pedido já foi registrado na Top Lanches.'],
    ['Pedido registrado com sucesso.', `Número do pedido: ${orderNumber}`, `Total: ${totalFormatted}`, 'A Top Lanches já recebeu as informações do pedido.'],
    ['Tudo certo com o pedido.', `Número: ${orderNumber}`, `Total: ${totalFormatted}`, 'Seu pedido foi enviado para a Top Lanches.']
  ] as const;
  return (options[hashSeed(seed + ':orderConfirmed') % options.length] ?? options[0]).join('\n');
}
