const debuggerPort = process.env.E2E_DEBUG_PORT ?? '19222'
const appUrl = process.env.E2E_APP_URL ?? 'http://127.0.0.1:15174'
const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const operatorEmail = process.env.E2E_OPERATOR_EMAIL
const operatorPassword = process.env.E2E_OPERATOR_PASSWORD
const orderId = process.env.E2E_ORDER_ID
const inputName = process.env.E2E_INPUT_NAME

if (!adminEmail || !adminPassword || !operatorEmail || !operatorPassword || !orderId || !inputName) {
  throw new Error('Las credenciales, E2E_ORDER_ID y E2E_INPUT_NAME son requeridos')
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json()
const target = targets.find((entry) => entry.type === 'page' && entry.url.startsWith(appUrl))
if (!target) throw new Error('No se encontró una página del frontend en el depurador de Edge')

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let nextId = 1
const pending = new Map()
const consoleErrors = []
const httpErrors = []

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const handler = pending.get(message.id)
    if (handler) {
      pending.delete(message.id)
      if (message.error) handler.reject(new Error(message.error.message))
      else handler.resolve(message.result)
    }
    return
  }
  if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.text)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
  }
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
    httpErrors.push({ status: message.params.response.status, url: message.params.response.url })
  }
})

function send(method, params = {}) {
  const id = nextId++
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result.value
}

async function waitFor(expression, label, timeout = 12000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await delay(150)
  }
  throw new Error(`Tiempo agotado esperando: ${label}`)
}

function setField(name, value) {
  return `(() => {
    const element = document.querySelector('[name="${name}"]');
    if (!element) return false;
    const prototype = element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`
}

async function login(email, password, expectedPath) {
  await waitFor(`Boolean(document.querySelector('input[name="email"]'))`, 'formulario de login')
  await evaluate(setField('email', email))
  await evaluate(setField('password', password))
  await evaluate(`document.querySelector('form').requestSubmit(); true`)
  await waitFor(`location.pathname === ${JSON.stringify(expectedPath)}`, `login hacia ${expectedPath}`)
}

async function openMovement(type, quantity, reason) {
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Registrar movimiento')).click(); true`)
  await waitFor(`Boolean(document.querySelector('form[aria-label="Formulario de movimiento de inventario"]'))`, 'formulario de movimiento')
  await evaluate(`(() => {
    const select = document.querySelector('[name="insumo_id"]');
    const option = [...select.options].find((entry) => entry.textContent === ${JSON.stringify(inputName)});
    if (!option) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`)
  await evaluate(setField('tipo_movimiento', type))
  await evaluate(setField('cantidad', quantity))
  await evaluate(setField('motivo', reason))
}

function rowHas(...parts) {
  return `(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((entry) => entry.textContent.includes(${JSON.stringify(inputName)}));
    return Boolean(row ${parts.map((part) => `&& row.textContent.includes(${JSON.stringify(part)})`).join(' ')});
  })()`
}

try {
  await send('Runtime.enable')
  await send('Network.enable')
  await evaluate(`sessionStorage.clear(); location.assign(${JSON.stringify(`${appUrl}/login`)}); true`)
  await login(adminEmail, adminPassword, '/servicios')

  await evaluate(`location.assign(${JSON.stringify(`${appUrl}/pedidos/${orderId}`)}); true`)
  await waitFor(`document.body.innerText.includes('Cobro y pagos') && document.body.innerText.includes('100.00')`, 'saldo inicial Q100')
  await evaluate(setField('amount', '30'))
  await evaluate(`(() => {
    const select = document.querySelector('[aria-label="Método de pago"]');
    const option = [...select.options].find((entry) => entry.value);
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`)
  await evaluate(setField('reference', 'FINAL-30'))
  await evaluate(`document.querySelector('.payment-form').requestSubmit(); true`)
  await waitFor(`document.body.innerText.includes('Pago registrado correctamente.') && document.body.innerText.includes('FINAL-30') && document.body.innerText.includes('70.00')`, 'pago Q30, saldo Q70 e historial')
  const payment = await evaluate(`({
    paid: document.body.innerText.includes('30.00'),
    balance: document.body.innerText.includes('70.00'),
    history: document.body.innerText.includes('FINAL-30') && document.body.innerText.includes('Admin SeLava')
  })`)

  await evaluate(`location.assign(${JSON.stringify(`${appUrl}/insumos`)}); true`)
  await waitFor(`document.body.innerText.includes('Insumos') && document.body.innerText.includes('Nuevo insumo')`, 'página de insumos')
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Nuevo insumo')).click(); true`)
  await waitFor(`Boolean(document.querySelector('form[aria-label="Formulario de insumo"]'))`, 'formulario de insumo')
  await evaluate(setField('nombre', inputName))
  await evaluate(setField('unidad_medida', 'L'))
  await evaluate(setField('stock_actual', '10'))
  await evaluate(setField('stock_minimo', '5'))
  await evaluate(`document.querySelector('form[aria-label="Formulario de insumo"]').requestSubmit(); true`)
  await waitFor(rowHas('10 L', '5 L'), 'insumo con stock inicial 10')

  await openMovement('entrada', '5', 'Entrada E2E')
  await evaluate(`document.querySelector('form[aria-label="Formulario de movimiento de inventario"]').requestSubmit(); true`)
  await waitFor(rowHas('15 L'), 'stock 15 tras entrada')

  await openMovement('salida', '4', 'Salida E2E')
  await evaluate(`document.querySelector('form[aria-label="Formulario de movimiento de inventario"]').requestSubmit(); true`)
  await waitFor(rowHas('11 L'), 'stock 11 tras salida')

  await openMovement('salida', '20', 'Salida excesiva E2E')
  await evaluate(`document.querySelector('form[aria-label="Formulario de movimiento de inventario"]').requestSubmit(); true`)
  await waitFor(`document.body.innerText.includes('La cantidad solicitada supera el stock disponible.')`, 'rechazo de salida excesiva')
  const excessiveExitRejected = await evaluate(`document.body.innerText.includes('La cantidad solicitada supera el stock disponible.')`)
  await evaluate(setField('cantidad', '7'))
  await evaluate(setField('motivo', 'Dejar bajo mínimo'))
  await evaluate(`document.querySelector('form[aria-label="Formulario de movimiento de inventario"]').requestSubmit(); true`)
  await waitFor(rowHas('4 L', 'Stock bajo'), 'stock 4 e indicador de stock bajo')
  const inventory = await evaluate(`(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((entry) => entry.textContent.includes(${JSON.stringify(inputName)}));
    return { stockFour: row.textContent.includes('4 L'), minimumFive: row.textContent.includes('5 L'), lowStock: row.textContent.includes('Stock bajo') };
  })()`)

  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Cerrar sesión')).click(); true`)
  await login(operatorEmail, operatorPassword, '/pedidos')
  await evaluate(`location.assign(${JSON.stringify(`${appUrl}/insumos`)}); true`)
  await waitFor(rowHas('4 L'), 'listado de insumos como Operario')
  const operatorPermissions = await evaluate(`({
    canList: document.body.innerText.includes(${JSON.stringify(inputName)}),
    canMove: [...document.querySelectorAll('button')].some((button) => button.textContent.includes('Registrar movimiento')),
    cannotCreate: ![...document.querySelectorAll('button')].some((button) => button.textContent.includes('Nuevo insumo')),
    cannotEdit: ![...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Editar')
  })`)
  await openMovement('entrada', '1', 'Entrada Operario E2E')
  await evaluate(`document.querySelector('form[aria-label="Formulario de movimiento de inventario"]').requestSubmit(); true`)
  await waitFor(`(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((entry) => entry.textContent.includes(${JSON.stringify(inputName)}));
    return document.body.innerText.includes('Entrada registrada correctamente.') && row && row.children[2].textContent.includes('5 L');
  })()`, 'movimiento de Operario')
  operatorPermissions.movementSaved = await evaluate(`document.body.innerText.includes('Entrada registrada correctamente.')`)

  console.log(JSON.stringify({ payment, inventory, excessiveExitRejected, operatorPermissions, httpErrors, consoleErrors }))
} finally {
  socket.close()
}
