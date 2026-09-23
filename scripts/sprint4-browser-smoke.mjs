const debuggerPort = process.env.E2E_DEBUG_PORT ?? '9222'
const appUrl = process.env.E2E_APP_URL ?? 'http://127.0.0.1:5174'
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD
const orderId = process.env.E2E_ORDER_ID
const expectedInput = process.env.E2E_INPUT_NAME

if (!email || !password || !orderId || !expectedInput) {
  throw new Error('E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ORDER_ID y E2E_INPUT_NAME son requeridos')
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json()
const target = targets.find((entry) => entry.type === 'page' && entry.url.startsWith(appUrl))
if (!target) throw new Error('No se encontro una pagina del frontend en el depurador de Edge')

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

async function waitFor(expression, label, timeout = 10000) {
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
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`
}

try {
  await send('Runtime.enable')
  await send('Network.enable')
  await waitFor(`Boolean(document.querySelector('input[name="email"]'))`, 'formulario de login')
  await evaluate(setField('email', email))
  await evaluate(setField('password', password))
  await evaluate(`document.querySelector('form').requestSubmit(); true`)
  await waitFor(`location.pathname === '/servicios'`, 'login de administrador')

  await evaluate(`location.assign(${JSON.stringify(`${appUrl}/pedidos/${orderId}`)}); true`)
  await waitFor(`document.body.innerText.includes('Cobro y pagos') && document.body.innerText.includes('STABILIZATION-30')`, 'cobro e historial de pagos')
  const paymentScreen = await evaluate(`({
    hasBalance: document.body.innerText.includes('Saldo pendiente') && document.body.innerText.includes('70.00'),
    hasUser: document.body.innerText.includes('Admin SeLava'),
    hasReference: document.body.innerText.includes('STABILIZATION-30')
  })`)

  await evaluate(`location.assign(${JSON.stringify(`${appUrl}/insumos`)}); true`)
  await waitFor(`document.body.innerText.includes(${JSON.stringify(expectedInput)})`, 'listado de insumos')
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Nuevo insumo')).click(); true`)
  await waitFor(`Boolean(document.querySelector('form[aria-label="Formulario de insumo"]'))`, 'formulario de insumo')
  await evaluate(setField('nombre', 'Insumo navegador'))
  await evaluate(setField('unidad_medida', 'kg'))
  await evaluate(setField('stock_actual', '8'))
  await evaluate(setField('stock_minimo', '3'))
  await evaluate(`document.querySelector('form[aria-label="Formulario de insumo"]').requestSubmit(); true`)
  await waitFor(`document.body.innerText.includes('Insumo creado correctamente.') && document.body.innerText.includes('Insumo navegador')`, 'creacion de insumo')

  await evaluate(`(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((entry) => entry.textContent.includes('Insumo navegador'));
    row.querySelector('button').click();
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('form[aria-label="Formulario de insumo"]'))`, 'edicion de insumo')
  await evaluate(setField('stock_minimo', '7'))
  await evaluate(`document.querySelector('form[aria-label="Formulario de insumo"]').requestSubmit(); true`)
  await waitFor(`document.body.innerText.includes('Insumo actualizado correctamente.')`, 'actualizacion de insumo')

  const inventoryScreen = await evaluate(`(() => {
    const row = [...document.querySelectorAll('tbody tr')].find((entry) => entry.textContent.includes('Insumo navegador'));
    return { listed: Boolean(row), updatedMinimum: Boolean(row && row.textContent.includes('7')) };
  })()`)

  console.log(JSON.stringify({ paymentScreen, inventoryScreen, httpErrors, consoleErrors }))
} finally {
  socket.close()
}
