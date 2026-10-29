# React + TypeScript + Vite

## Desarrollo local

Requiere Node.js y npm. El backend debe estar disponible en `http://localhost:8080`.

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

Con `VITE_API_URL=/api`, Vite redirige las llamadas API al backend local. La aplicación queda disponible en `http://localhost:5173`. `VITE_LOGIN_URL` apunta al login único del portal cliente. El callback consume el JWT desde el fragmento URL, lo elimina y conserva la sesión en `sessionStorage` hasta que vence o el usuario cierra sesión.

## Autenticación y usuarios (SEL-204)

El login administrativo anterior redirige a `http://localhost:5174/login`.
Administrador y Recepcionista regresan por `/auth/callback`; Operario conserva
su vista de pedidos. Solo Administrador ve `/usuarios`, métodos de pago y
reportes. Recepcionista gestiona pedidos, clientes, promociones e insumos, y
consulta tipos de prenda y servicio sin acciones de edición. Las rutas directas
no autorizadas redirigen a Pedidos y el backend vuelve a comprobar el rol.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## SEL-107: precios de prendas

Tipos de prenda administra `precio` en quetzales, positivo y con hasta dos decimales.
Los registros anteriores sin tarifa aparecen como **Pendiente de configurar** y no
pueden seleccionarse para nuevos pedidos. Servicios conserva su catalogo y asociaciones,
sin campos ni columnas de precio. El resumen de pedido estima el cobro desde el tipo
de prenda una sola vez por prenda; el servidor confirma y congela la tarifa.
El detalle usa `prendas.precio_aplicado` para pedidos nuevos y conserva los importes
por servicio en pedidos anteriores. Requiere el backend y migracion 023 de SEL-107.
No incluye modalidades de SEL-108 ni promociones de SEL-109.
## Promociones (SEL-109)

`/promociones` permite al administrador crear, editar y activar/desactivar
paquetes por tipo de prenda. Recepción puede consultarlos. La modalidad del
formulario procede del tipo seleccionado; UNIDAD exige enteros y LIBRA/METRO
admiten hasta tres decimales.

En el resumen de Nuevo pedido se consulta `POST /api/pedidos/cotizacion` y se
elige una promoción por tipo. Aplicaciones, cubiertas, sobrantes y total proceden
del servidor. Guardar requiere una cotización válida y vuelve a comprobarla en
backend. El detalle muestra el snapshot persistido, incluso después de editar
o desactivar la promoción. Requiere backend SEL-109 y migración 025; no requiere
cambios de dependencias ni nuevas variables de entorno.
