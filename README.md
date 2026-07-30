# Casa Clara

Aplicación web para organizar gastos compartidos, balances, tareas domésticas,
compras semanales y pagos recurrentes desde un único lugar.

## Funcionalidades de la demo

- Dashboard del hogar.
- Alta de gastos y reparto igualitario, por importes o personal.
- Balances automáticos y transferencias sugeridas.
- Registro de liquidaciones parciales o completas.
- Gastos fijos y variables.
- Tareas, responsables, prioridades y checklist.
- Lista del supermercado y conversión de la compra en gasto.
- Calendario de tareas y vencimientos.
- Historial, estadísticas e integrantes.
- Navegación adaptada para escritorio y móvil.

Mientras se desarrolla el backend, la información se guarda en `localStorage`.
Desde Configuración se pueden restaurar los datos iniciales.

## Desarrollo

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

Para validar una entrega:

```bash
npm run build
```

## Conexión con la API

Configurar:

```env
NEXT_PUBLIC_API_URL=https://tu-api.example.com/api
NEXT_PUBLIC_SITE_URL=https://tu-frontend.example.com
```

La especificación de base de datos, migración, reglas de negocio, endpoints y
ejemplos JSON está en [BACKEND_IMPLEMENTATION.md](./BACKEND_IMPLEMENTATION.md).

El adaptador inicial de API está en `src/services/householdApi.ts`; las vistas
actuales consumen `src/hooks/useHousehold.ts` para funcionar sin backend.

## Estructura

```text
src/
├── app/
├── components/
│   ├── common/
│   └── layout/
├── data/
├── features/
│   ├── dashboard/
│   ├── expenses/
│   ├── recurring/
│   ├── balances/
│   ├── shopping/
│   ├── tasks/
│   ├── calendar/
│   ├── activity/
│   ├── reports/
│   ├── members/
│   └── settings/
├── hooks/
├── services/
├── types/
└── utils/
```
