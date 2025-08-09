# 🌊 Gastos BCN - Control de Gastos Compartidos

Una aplicación moderna y elegante para controlar gastos compartidos entre Ana y Valen, con un diseño inspirado en la playa, el mar y el sol.

## ✨ Características

- **Gestión de Gastos**: Agregar gastos con monto, descripción, categoría y persona
- **Separación por Persona**: Distinguir claramente entre gastos de Ana y Valen
- **Categorías Personalizables**: Crear y personalizar categorías con colores únicos
- **Vista Organizada**: Mostrar los últimos 5 gastos con opción de ver todos
- **Diseño Responsivo**: Interfaz moderna que funciona en todos los dispositivos
- **Tema Playero**: Colores inspirados en la playa, mar y sol

## 🚀 Tecnologías Utilizadas

- **Next.js 15** - Framework de React
- **TypeScript** - Tipado estático
- **Bootstrap 5** - Framework de CSS
- **React Bootstrap** - Componentes de React para Bootstrap
- **LocalStorage** - Almacenamiento local de datos

## 📁 Estructura del Proyecto

```
src/
├── app/                 # Páginas de Next.js
├── components/          # Componentes React
│   ├── Dashboard.tsx   # Componente principal
│   ├── GastoForm.tsx   # Formulario de gastos
│   ├── GastosList.tsx  # Lista de gastos
│   └── CategoriaForm.tsx # Formulario de categorías
├── services/            # Lógica de negocio
│   └── gastosService.ts # Servicio de gastos
├── types/               # Tipos TypeScript
│   └── index.ts        # Interfaces y tipos
└── utils/               # Utilidades
    └── colors.ts       # Paleta de colores
```

## 🎨 Paleta de Colores

La aplicación utiliza una paleta de colores inspirada en la playa:

- **Azul Oceánico** (#1e3a8a) - Para encabezados principales
- **Azul Marino** (#3b82f6) - Para elementos secundarios
- **Arena** (#fbbf24) - Para botones de acción
- **Atardecer** (#f97316) - Para elementos destacados
- **Coral** (#fb7185) - Para gastos de Ana
- **Aqua** (#06b6d4) - Para gastos de Valen

## 🛠️ Instalación y Uso

1. **Clonar el repositorio**
   ```bash
   git clone [url-del-repositorio]
   cd gastos-bcn
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

4. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## 📱 Funcionalidades Principales

### Agregar Gasto
- Seleccionar persona (Ana o Valen)
- Ingresar monto en euros
- Agregar descripción
- Seleccionar categoría existente

### Crear Categoría
- Nombre de la categoría
- Descripción opcional
- Selección de color personalizado

### Visualización
- **Gastos de Ana**: Lista de gastos de Ana con total
- **Gastos de Valen**: Lista de gastos de Valen con total
- **Gastos Totales**: Vista consolidada de todos los gastos

## 🔧 Personalización

### Agregar Nuevas Categorías
La aplicación incluye categorías por defecto, pero puedes crear las tuyas propias:
- Comida
- Transporte
- Entretenimiento
- Compras

### Modificar Colores
Los colores se pueden personalizar editando `src/utils/colors.ts`

## 📊 Almacenamiento de Datos

Actualmente la aplicación utiliza localStorage para almacenar los datos. Esto significa que:
- Los datos se guardan en el navegador
- No se pierden al cerrar la aplicación
- Son específicos de cada dispositivo

## 🚀 Futuras Mejoras

- [ ] Integración con base de datos
- [ ] Autenticación de usuarios
- [ ] Exportación de datos
- [ ] Gráficos y estadísticas
- [ ] Notificaciones
- [ ] Modo oscuro

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

---

**Desarrollado con ❤️ para Ana y Valen**
