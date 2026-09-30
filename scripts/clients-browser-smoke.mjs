const debuggerPort = process.env.E2E_DEBUG_PORT ?? '19223'
const appUrl = process.env.E2E_APP_URL ?? 'http://127.0.0.1:15175'
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD
const clientName = process.env.E2E_CLIENT_NAME
const clientEmail = process.env.E2E_CLIENT_EMAIL

if (!email || !password || !clientName || !clientEmail) throw new Error('Las credenciales y los datos del cliente E2E son requeridos')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const targets = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)).json()
const target = targets.find((entry) => entry.type === 'page' && entry.url.startsWith(appUrl))
if (!target) throw new Error('No se encontró la página de SeLava en Edge')
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
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args.map((argument) => argument.value ?? argument.description).join(' '))
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) httpErrors.push({ status: message.params.response.status, url: message.params.response.url })
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

function setNamedField(name, value) {
  return `(() => {
    const field = document.querySelector('[name="${name}"]');
    if (!field) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`
}

try {
  await send('Runtime.enable')
  await send('Network.enable')
  await evaluate(`sessionStorage.clear(); location.assign(${JSON.stringify(`${appUrl}/login`)}); true`)
  await waitFor(`Boolean(document.querySelector('input[name="email"]'))`, 'login')
  await evaluate(setNamedField('email', email))
  await evaluate(setNamedField('password', password))
  await evaluate(`document.querySelector('form').requestSubmit(); true`)
  await waitFor(`location.pathname === '/servicios'`, 'sesión de administrador')

  await evaluate(`location.assign(${JSON.stringify(`${appUrl}/clientes`)}); true`)
  await waitFor(`document.body.innerText.includes('Gestiona la información de tus clientes.') && document.body.innerText.includes('Cliente Demo')`, 'listado de clientes')
  const list = await evaluate(`({
    search: Boolean(document.querySelector('input[placeholder="Buscar por nombre, teléfono o NIT..."]')),
    filters: ['Todos','Activo','Inactivo'].every((label) => [...document.querySelectorAll('.status-tabs button')].some((button) => button.textContent === label)),
    columns: ['Cliente','Teléfono','NIT','Pedidos','Estado'].every((label) => [...document.querySelectorAll('th')].some((cell) => cell.textContent === label))
  })`)

  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Nuevo cliente')).click(); true`)
  await waitFor(`Boolean(document.querySelector('form[aria-label="Formulario de cliente"]'))`, 'modal de registro')
  const nitDisabled = await evaluate(`document.querySelector('[name="nit"]').disabled`)
  await evaluate(setNamedField('nombre', clientName))
  await evaluate(setNamedField('apellido', 'Prueba'))
  await evaluate(setNamedField('telefono', '5555-7788'))
  await evaluate(setNamedField('email', clientEmail))
  await evaluate(setNamedField('direccion', 'Zona 10'))
  await evaluate(`document.querySelector('form[aria-label="Formulario de cliente"]').requestSubmit(); true`)
  await waitFor(`document.body.innerText.includes('Cliente registrado correctamente.')`, 'cliente registrado')

  await evaluate(`(() => {
    const field = document.querySelector('input[placeholder="Buscar por nombre, teléfono o NIT..."]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(clientName)});
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  await waitFor(`document.querySelectorAll('tbody tr').length === 1 && document.body.innerText.includes(${JSON.stringify(`${clientName} Prueba`)})`, 'búsqueda del cliente creado')
  await evaluate(`document.querySelector('tbody tr a').click(); true`)
  await waitFor(`location.pathname.startsWith('/clientes/') && document.body.innerText.includes(${JSON.stringify(`${clientName} Prueba`)})`, 'detalle del cliente')

  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Editar cliente')).click(); true`)
  await waitFor(`Boolean(document.querySelector('form[aria-label="Formulario de cliente"]'))`, 'modal de edición')
  await evaluate(setNamedField('telefono', '5555-8899'))
  await evaluate(`document.querySelector('form[aria-label="Formulario de cliente"]').requestSubmit(); true`)
  await waitFor(`document.body.innerText.includes('Cliente actualizado correctamente.') && document.body.innerText.includes('5555-8899')`, 'cliente actualizado')

  await evaluate(`window.confirm = () => true; [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Desactivar')).click(); true`)
  await waitFor(`document.body.innerText.includes('Cliente desactivado correctamente.') && [...document.querySelectorAll('button')].some((button) => button.textContent.includes('Activar'))`, 'cliente desactivado')
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Activar')).click(); true`)
  await waitFor(`document.body.innerText.includes('Cliente activado correctamente.') && [...document.querySelectorAll('button')].some((button) => button.textContent.includes('Desactivar'))`, 'cliente reactivado')

  const detail = await evaluate(`({
    updatedPhone: document.body.innerText.includes('5555-8899'),
    nitUnavailable: document.body.innerText.includes('NIT') && document.body.innerText.includes('—'),
    ordersCapability: document.body.innerText.includes('La consulta de pedidos por cliente aún no está disponible.')
  })`)
  console.log(JSON.stringify({ list, nitDisabled, detail, httpErrors, consoleErrors }))
} finally {
  socket.close()
}
