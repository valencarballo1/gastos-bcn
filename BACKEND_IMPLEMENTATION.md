# Casa Clara — contrato de backend y base de datos

Este documento define el backend esperado por el nuevo frontend de Casa Clara.
La implementación recomendada es ASP.NET Core Web API + SQL Server, manteniendo
JSON en `camelCase` y todos los importes como `decimal`.

> Estado del frontend: funciona con datos de demostración en `localStorage`.
> Cuando estos endpoints estén disponibles se sustituirá el repositorio local
> por `src/services/householdApi.ts`.

## 1. Principios obligatorios

1. Todo registro pertenece a un `Hogar`.
2. Nunca usar el nombre de una persona como relación. Usar `IntegranteId`.
3. Guardar importes con `DECIMAL(18,2)` y DTOs C# con `decimal`, nunca `double`.
4. Los balances se calculan desde gastos, participantes y liquidaciones. No
   crear ni actualizar una tabla de saldo actual.
5. Crear gasto + participantes + actividad en una única transacción.
6. Crear liquidación + actividad en una única transacción.
7. Finalizar compra + crear gasto + participantes + enlazar productos +
   actividad en una única transacción.
8. Una liquidación se revierte; no se elimina.
9. Los registros financieros se desactivan o cancelan; no se borran físicamente.
10. Las ocurrencias recurrentes guardan una fotografía de la configuración con
    la que fueron generadas.
11. Todo endpoint debe comprobar que los IDs recibidos pertenecen al hogar de
    la ruta.
12. Fechas de negocio en ISO 8601 y UTC. La zona horaria del hogar se usa para
    generar vencimientos.

## 2. Orden recomendado de implementación

1. Crear las tablas del núcleo y cargar el hogar inicial.
2. Migrar categorías y gastos actuales.
3. Implementar integrantes, categorías y gastos.
4. Implementar cálculo de balances y liquidaciones.
5. Implementar tareas y supermercado.
6. Implementar gastos recurrentes y su proceso diario.
7. Implementar dashboard, calendario, actividad y reportes.
8. Conectar el frontend real y retirar los endpoints antiguos.

## 3. Creación y migración de tablas

El siguiente script está pensado para la base existente de Gastos BCN. Antes de
ejecutarlo, hacer una copia de seguridad y probarlo en una base de desarrollo.

### 3.1 Núcleo

```sql
CREATE TABLE Hogares (
    Id INT IDENTITY(1,1) NOT NULL,
    Nombre NVARCHAR(150) NOT NULL,
    Moneda CHAR(3) NOT NULL CONSTRAINT DF_Hogares_Moneda DEFAULT 'EUR',
    ZonaHoraria NVARCHAR(100) NOT NULL
        CONSTRAINT DF_Hogares_ZonaHoraria DEFAULT 'Europe/Madrid',
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_Hogares_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(7) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_Hogares_Activo DEFAULT 1,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Hogares PRIMARY KEY (Id),
    CONSTRAINT CK_Hogares_Moneda CHECK (LEN(Moneda) = 3)
);

CREATE TABLE IntegrantesHogar (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    Nombre NVARCHAR(120) NOT NULL,
    Email NVARCHAR(254) NULL,
    AvatarUrl NVARCHAR(1000) NULL,
    Iniciales NVARCHAR(4) NULL,
    Color CHAR(7) NULL,
    FechaIncorporacion DATE NOT NULL
        CONSTRAINT DF_IntegrantesHogar_FechaIncorporacion DEFAULT CAST(GETDATE() AS DATE),
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_IntegrantesHogar_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(7) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_IntegrantesHogar_Activo DEFAULT 1,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_IntegrantesHogar PRIMARY KEY (Id),
    CONSTRAINT FK_IntegrantesHogar_Hogares
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT CK_IntegrantesHogar_Color
        CHECK (Color IS NULL OR Color LIKE '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE UNIQUE INDEX UX_IntegrantesHogar_Hogar_Email
ON IntegrantesHogar(HogarId, Email)
WHERE Email IS NOT NULL;

CREATE INDEX IX_IntegrantesHogar_Hogar_Activo
ON IntegrantesHogar(HogarId, Activo);
```

Crear el hogar inicial:

```sql
INSERT INTO Hogares (Nombre, Moneda, ZonaHoraria)
VALUES (N'Casa Barcelona', 'EUR', N'Europe/Madrid');

DECLARE @HogarId INT = SCOPE_IDENTITY();

INSERT INTO IntegrantesHogar
    (HogarId, Nombre, Email, Iniciales, Color, FechaIncorporacion)
VALUES
    (@HogarId, N'Valentín', NULL, N'VA', '#516A5A', CAST(GETDATE() AS DATE)),
    (@HogarId, N'Ana', NULL, N'AN', '#D66A4A', CAST(GETDATE() AS DATE));
```

### 3.1.1 Usuarios Google, membresías e invitaciones

`Usuario` y `IntegranteHogar` no son la misma entidad:

- `Usuarios` representa la identidad autenticada con Google.
- `IntegrantesHogar` representa la membresía dentro de un hogar.
- Un usuario puede pertenecer a varios hogares.
- Una invitación pendiente todavía no es integrante y no puede recibir tareas
  ni participar en gastos.

```sql
CREATE TABLE Usuarios (
    Id INT IDENTITY(1,1) NOT NULL,
    GoogleSubject NVARCHAR(255) NOT NULL,
    Email NVARCHAR(254) NOT NULL,
    EmailNormalizado NVARCHAR(254) NOT NULL,
    Nombre NVARCHAR(150) NOT NULL,
    AvatarUrl NVARCHAR(1000) NULL,
    FechaUltimoAcceso DATETIME2(7) NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_Usuarios_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(7) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_Usuarios_Activo DEFAULT 1,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Usuarios PRIMARY KEY (Id),
    CONSTRAINT UQ_Usuarios_GoogleSubject UNIQUE (GoogleSubject),
    CONSTRAINT UQ_Usuarios_EmailNormalizado UNIQUE (EmailNormalizado)
);

ALTER TABLE IntegrantesHogar ADD
    UsuarioId INT NULL,
    Rol NVARCHAR(20) NOT NULL
        CONSTRAINT DF_IntegrantesHogar_Rol DEFAULT N'member';

ALTER TABLE IntegrantesHogar
ADD CONSTRAINT FK_IntegrantesHogar_Usuarios
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id);

ALTER TABLE IntegrantesHogar
ADD CONSTRAINT CK_IntegrantesHogar_Rol
    CHECK (Rol IN (N'owner', N'admin', N'member'));

CREATE UNIQUE INDEX UX_IntegrantesHogar_Hogar_Usuario
ON IntegrantesHogar(HogarId, UsuarioId)
WHERE UsuarioId IS NOT NULL;

-- Para el hogar migrado, marcar como propietario al integrante original.
DECLARE @HogarMigradoId INT = (SELECT TOP 1 Id FROM Hogares ORDER BY Id);

UPDATE IntegrantesHogar
SET Rol = N'owner'
WHERE Id = (
    SELECT TOP 1 Id
    FROM IntegrantesHogar
    WHERE HogarId = @HogarMigradoId
    ORDER BY Id
);

CREATE TABLE InvitacionesHogar (
    Id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_InvitacionesHogar_Id DEFAULT NEWSEQUENTIALID(),
    HogarId INT NOT NULL,
    EmailDestino NVARCHAR(254) NULL,
    EmailDestinoNormalizado NVARCHAR(254) NULL,
    TokenHash BINARY(32) NOT NULL,
    Rol NVARCHAR(20) NOT NULL
        CONSTRAINT DF_InvitacionesHogar_Rol DEFAULT N'member',
    Modo NVARCHAR(20) NOT NULL,
    Estado NVARCHAR(20) NOT NULL
        CONSTRAINT DF_InvitacionesHogar_Estado DEFAULT N'pending',
    InvitadoPorUsuarioId INT NOT NULL,
    AceptadoPorUsuarioId INT NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_InvitacionesHogar_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaExpiracion DATETIME2(7) NOT NULL,
    FechaAceptacion DATETIME2(7) NULL,
    FechaRevocacion DATETIME2(7) NULL,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_InvitacionesHogar PRIMARY KEY (Id),
    CONSTRAINT FK_InvitacionesHogar_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_InvitacionesHogar_InvitadoPor
        FOREIGN KEY (InvitadoPorUsuarioId) REFERENCES Usuarios(Id),
    CONSTRAINT FK_InvitacionesHogar_AceptadoPor
        FOREIGN KEY (AceptadoPorUsuarioId) REFERENCES Usuarios(Id),
    CONSTRAINT CK_InvitacionesHogar_Rol
        CHECK (Rol IN (N'admin', N'member')),
    CONSTRAINT CK_InvitacionesHogar_Modo
        CHECK (Modo IN (N'email', N'link')),
    CONSTRAINT CK_InvitacionesHogar_Estado
        CHECK (Estado IN (N'pending', N'accepted', N'expired', N'revoked')),
    CONSTRAINT CK_InvitacionesHogar_Expiracion
        CHECK (FechaExpiracion > FechaCreacion),
    CONSTRAINT CK_InvitacionesHogar_Email
        CHECK (
            (Modo = N'email' AND EmailDestino IS NOT NULL)
            OR Modo = N'link'
        )
);

CREATE UNIQUE INDEX UX_InvitacionesHogar_TokenHash
ON InvitacionesHogar(TokenHash);

CREATE INDEX IX_InvitacionesHogar_Hogar_Estado
ON InvitacionesHogar(HogarId, Estado, FechaExpiracion);

CREATE INDEX IX_InvitacionesHogar_Email_Estado
ON InvitacionesHogar(EmailDestinoNormalizado, Estado)
WHERE EmailDestinoNormalizado IS NOT NULL;
```

Reglas de seguridad del token:

1. Generar al menos 32 bytes aleatorios con un generador criptográfico.
2. Enviar el token original únicamente dentro del enlace.
3. Guardar en SQL solamente `SHA-256(token)` dentro de `TokenHash`.
4. La invitación caduca a los 7 días y es de un único uso.
5. Si la invitación tiene correo, la cuenta Google que la acepta debe tener el
   mismo correo normalizado.
6. Al aceptar, crear `IntegrantesHogar` y actualizar la invitación en la misma
   transacción.

### 3.2 Adaptar `Categorias`

La tabla ya existe. Se amplía para que las categorías sean propias de cada
hogar y puedan distinguir gastos, tareas y supermercado.

```sql
DECLARE @HogarInicialId INT = (SELECT TOP 1 Id FROM Hogares ORDER BY Id);

ALTER TABLE Categorias ADD
    HogarId INT NULL,
    Tipo NVARCHAR(20) NULL;

UPDATE Categorias
SET HogarId = @HogarInicialId,
    Tipo = N'expense'
WHERE HogarId IS NULL;

ALTER TABLE Categorias ALTER COLUMN HogarId INT NOT NULL;
ALTER TABLE Categorias ALTER COLUMN Tipo NVARCHAR(20) NOT NULL;

ALTER TABLE Categorias
ADD CONSTRAINT FK_Categorias_Hogares
    FOREIGN KEY (HogarId) REFERENCES Hogares(Id);

ALTER TABLE Categorias
ADD CONSTRAINT CK_Categorias_Tipo
    CHECK (Tipo IN (N'expense', N'task', N'shopping'));

ALTER TABLE Categorias DROP CONSTRAINT UQ_Categorias_Nombre;

CREATE UNIQUE INDEX UX_Categorias_Hogar_Tipo_Nombre
ON Categorias(HogarId, Tipo, Nombre);

CREATE INDEX IX_Categorias_Hogar_Tipo_Activo
ON Categorias(HogarId, Tipo, Activo);
```

Categorías adicionales:

```sql
DECLARE @HogarIdCategorias INT = (SELECT TOP 1 Id FROM Hogares ORDER BY Id);

INSERT INTO Categorias (HogarId, Tipo, Nombre, Descripcion, Color)
SELECT @HogarIdCategorias, valores.Tipo, valores.Nombre, valores.Descripcion, valores.Color
FROM (VALUES
    (N'expense', N'Alquiler', N'Alquiler y vivienda', '#8D6E63'),
    (N'expense', N'Supermercado', N'Compra habitual', '#4F7C65'),
    (N'expense', N'Servicios', N'Luz, agua, gas e internet', '#547A93'),
    (N'expense', N'Limpieza', N'Productos y servicios de limpieza', '#6F8C7A'),
    (N'expense', N'Muebles', N'Mobiliario y decoración', '#8B6FA8'),
    (N'expense', N'Reparaciones', N'Mantenimiento del hogar', '#B16F55'),
    (N'expense', N'Ocio', N'Planes compartidos', '#D39A3B'),
    (N'expense', N'Otros', N'Otros gastos', '#7C8580'),
    (N'task', N'Limpieza', N'Tareas de limpieza', '#4F7C65'),
    (N'task', N'Cocina', N'Tareas de cocina', '#D47B55'),
    (N'task', N'Lavandería', N'Ropa y lavandería', '#547A93'),
    (N'task', N'Compras', N'Compras para la casa', '#D39A3B'),
    (N'task', N'Mantenimiento', N'Mantenimiento y reparaciones', '#8D6E63'),
    (N'task', N'Organización', N'Organización general', '#8B6FA8'),
    (N'shopping', N'Frutas y verduras', NULL, '#4F7C65'),
    (N'shopping', N'Lácteos', NULL, '#547A93'),
    (N'shopping', N'Bebidas', NULL, '#6A86A0'),
    (N'shopping', N'Limpieza', NULL, '#6F8C7A'),
    (N'shopping', N'Higiene', NULL, '#8B6FA8'),
    (N'shopping', N'Despensa', NULL, '#D39A3B'),
    (N'shopping', N'Otros', NULL, '#7C8580')
) valores(Tipo, Nombre, Descripcion, Color)
WHERE NOT EXISTS (
    SELECT 1
    FROM Categorias c
    WHERE c.HogarId = @HogarIdCategorias
      AND c.Tipo = valores.Tipo
      AND c.Nombre = valores.Nombre
);
```

### 3.3 Gastos recurrentes

Estas tablas se crean antes de agregar la relación desde `Gastos`.

```sql
CREATE TABLE GastosRecurrentes (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    Nombre NVARCHAR(200) NOT NULL,
    CategoriaId INT NOT NULL,
    ImporteEstimado DECIMAL(18,2) NULL,
    ImporteVariable BIT NOT NULL
        CONSTRAINT DF_GastosRecurrentes_ImporteVariable DEFAULT 0,
    Frecuencia NVARCHAR(20) NOT NULL,
    IntervaloFrecuencia INT NOT NULL
        CONSTRAINT DF_GastosRecurrentes_Intervalo DEFAULT 1,
    DiaVencimiento TINYINT NOT NULL,
    PagadoPorIntegranteId INT NOT NULL,
    TipoDivision NVARCHAR(20) NOT NULL,
    FechaInicio DATE NOT NULL,
    FechaFin DATE NULL,
    Estado NVARCHAR(20) NOT NULL
        CONSTRAINT DF_GastosRecurrentes_Estado DEFAULT N'active',
    DiasRecordatorio TINYINT NOT NULL
        CONSTRAINT DF_GastosRecurrentes_Recordatorio DEFAULT 3,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_GastosRecurrentes_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(7) NULL,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_GastosRecurrentes PRIMARY KEY (Id),
    CONSTRAINT FK_GastosRecurrentes_Hogares
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_GastosRecurrentes_Categorias
        FOREIGN KEY (CategoriaId) REFERENCES Categorias(Id),
    CONSTRAINT FK_GastosRecurrentes_Pagador
        FOREIGN KEY (PagadoPorIntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT CK_GastosRecurrentes_Importe
        CHECK (ImporteEstimado IS NULL OR ImporteEstimado > 0),
    CONSTRAINT CK_GastosRecurrentes_Frecuencia
        CHECK (Frecuencia IN
            (N'weekly', N'monthly', N'bimonthly', N'quarterly', N'semiannual', N'annual')),
    CONSTRAINT CK_GastosRecurrentes_Dia
        CHECK (DiaVencimiento BETWEEN 1 AND 28),
    CONSTRAINT CK_GastosRecurrentes_Division
        CHECK (TipoDivision IN (N'equal', N'fixed', N'responsible')),
    CONSTRAINT CK_GastosRecurrentes_Estado
        CHECK (Estado IN (N'active', N'paused')),
    CONSTRAINT CK_GastosRecurrentes_Fechas
        CHECK (FechaFin IS NULL OR FechaFin >= FechaInicio)
);

CREATE INDEX IX_GastosRecurrentes_Hogar_Estado
ON GastosRecurrentes(HogarId, Estado);

CREATE TABLE GastoRecurrenteParticipantes (
    GastoRecurrenteId INT NOT NULL,
    IntegranteId INT NOT NULL,
    Importe DECIMAL(18,2) NULL,
    Porcentaje DECIMAL(7,4) NULL,
    CONSTRAINT PK_GastoRecurrenteParticipantes
        PRIMARY KEY (GastoRecurrenteId, IntegranteId),
    CONSTRAINT FK_GastoRecurrenteParticipantes_Gasto
        FOREIGN KEY (GastoRecurrenteId) REFERENCES GastosRecurrentes(Id),
    CONSTRAINT FK_GastoRecurrenteParticipantes_Integrante
        FOREIGN KEY (IntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT CK_GastoRecurrenteParticipantes_Importe
        CHECK (Importe IS NULL OR Importe >= 0),
    CONSTRAINT CK_GastoRecurrenteParticipantes_Porcentaje
        CHECK (Porcentaje IS NULL OR Porcentaje BETWEEN 0 AND 100)
);
```

### 3.4 Adaptar `Gastos`

Durante la transición se conserva `Persona` para no romper inmediatamente los
procedimientos antiguos. El backend nuevo no debe utilizarla.

```sql
ALTER TABLE Gastos DROP CONSTRAINT CK_Gastos_Persona;
ALTER TABLE Gastos ALTER COLUMN Persona NVARCHAR(100) NULL;

ALTER TABLE Gastos ADD
    HogarId INT NULL,
    PagadoPorIntegranteId INT NULL,
    Moneda CHAR(3) NOT NULL
        CONSTRAINT DF_Gastos_Moneda DEFAULT 'EUR',
    TipoDivision NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Gastos_TipoDivision DEFAULT N'responsible',
    Estado NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Gastos_Estado DEFAULT N'paid',
    Notas NVARCHAR(2000) NULL,
    ComprobanteUrl NVARCHAR(1000) NULL,
    GastoRecurrenteId INT NULL,
    FechaActualizacion DATETIME2(7) NULL,
    RowVersion ROWVERSION;

DECLARE @HogarGastosId INT = (SELECT TOP 1 Id FROM Hogares ORDER BY Id);
DECLARE @ValenId INT = (
    SELECT TOP 1 Id FROM IntegrantesHogar
    WHERE HogarId = @HogarGastosId AND Nombre LIKE N'Valent%'
);
DECLARE @AnaId INT = (
    SELECT TOP 1 Id FROM IntegrantesHogar
    WHERE HogarId = @HogarGastosId AND Nombre = N'Ana'
);

UPDATE Gastos
SET HogarId = @HogarGastosId,
    PagadoPorIntegranteId =
        CASE WHEN Persona = N'Ana' THEN @AnaId ELSE @ValenId END,
    TipoDivision = N'responsible',
    Estado = CASE WHEN Activo = 1 THEN N'paid' ELSE N'cancelled' END
WHERE HogarId IS NULL;

ALTER TABLE Gastos ALTER COLUMN HogarId INT NOT NULL;
ALTER TABLE Gastos ALTER COLUMN PagadoPorIntegranteId INT NOT NULL;

ALTER TABLE Gastos
ADD CONSTRAINT FK_Gastos_Hogares
    FOREIGN KEY (HogarId) REFERENCES Hogares(Id);

ALTER TABLE Gastos
ADD CONSTRAINT FK_Gastos_Pagador
    FOREIGN KEY (PagadoPorIntegranteId) REFERENCES IntegrantesHogar(Id);

ALTER TABLE Gastos
ADD CONSTRAINT FK_Gastos_GastoRecurrente
    FOREIGN KEY (GastoRecurrenteId) REFERENCES GastosRecurrentes(Id);

ALTER TABLE Gastos
ADD CONSTRAINT CK_Gastos_TipoDivision
    CHECK (TipoDivision IN (N'equal', N'fixed', N'responsible'));

ALTER TABLE Gastos
ADD CONSTRAINT CK_Gastos_Estado
    CHECK (Estado IN (N'pending', N'paid', N'cancelled'));

CREATE INDEX IX_Gastos_Hogar_Fecha
ON Gastos(HogarId, Fecha DESC)
INCLUDE (Monto, CategoriaId, PagadoPorIntegranteId, Estado);

CREATE INDEX IX_Gastos_Hogar_Pagador
ON Gastos(HogarId, PagadoPorIntegranteId, Fecha DESC);
```

Participantes:

```sql
CREATE TABLE GastoParticipantes (
    GastoId INT NOT NULL,
    IntegranteId INT NOT NULL,
    ImporteAsignado DECIMAL(18,2) NOT NULL,
    Porcentaje DECIMAL(7,4) NULL,
    CONSTRAINT PK_GastoParticipantes PRIMARY KEY (GastoId, IntegranteId),
    CONSTRAINT FK_GastoParticipantes_Gastos
        FOREIGN KEY (GastoId) REFERENCES Gastos(Id),
    CONSTRAINT FK_GastoParticipantes_Integrantes
        FOREIGN KEY (IntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT CK_GastoParticipantes_Importe CHECK (ImporteAsignado >= 0),
    CONSTRAINT CK_GastoParticipantes_Porcentaje
        CHECK (Porcentaje IS NULL OR Porcentaje BETWEEN 0 AND 100)
);

CREATE INDEX IX_GastoParticipantes_Integrante
ON GastoParticipantes(IntegranteId, GastoId)
INCLUDE (ImporteAsignado);

-- Preserva los totales históricos sin inventar deuda:
-- cada gasto anterior queda asignado al 100 % a quien lo pagó.
INSERT INTO GastoParticipantes (GastoId, IntegranteId, ImporteAsignado, Porcentaje)
SELECT g.Id, g.PagadoPorIntegranteId, g.Monto, 100
FROM Gastos g
WHERE NOT EXISTS (
    SELECT 1 FROM GastoParticipantes gp WHERE gp.GastoId = g.Id
);
```

La igualdad `SUM(GastoParticipantes.ImporteAsignado) = Gastos.Monto` no puede
resolverse con un `CHECK` simple. Debe validarse en el servicio antes de
confirmar la transacción.

### 3.5 Ocurrencias de gastos recurrentes

```sql
CREATE TABLE GastoRecurrenteOcurrencias (
    Id INT IDENTITY(1,1) NOT NULL,
    GastoRecurrenteId INT NOT NULL,
    HogarId INT NOT NULL,
    FechaVencimiento DATE NOT NULL,
    NombreSnapshot NVARCHAR(200) NOT NULL,
    CategoriaIdSnapshot INT NOT NULL,
    PagadoPorIntegranteIdSnapshot INT NOT NULL,
    TipoDivisionSnapshot NVARCHAR(20) NOT NULL,
    ImporteEstimado DECIMAL(18,2) NULL,
    ImporteReal DECIMAL(18,2) NULL,
    Estado NVARCHAR(20) NOT NULL
        CONSTRAINT DF_GastoRecurrenteOcurrencias_Estado DEFAULT N'pending',
    GastoGeneradoId INT NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_GastoRecurrenteOcurrencias_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(7) NULL,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_GastoRecurrenteOcurrencias PRIMARY KEY (Id),
    CONSTRAINT FK_GastoRecurrenteOcurrencias_Configuracion
        FOREIGN KEY (GastoRecurrenteId) REFERENCES GastosRecurrentes(Id),
    CONSTRAINT FK_GastoRecurrenteOcurrencias_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_GastoRecurrenteOcurrencias_Categoria
        FOREIGN KEY (CategoriaIdSnapshot) REFERENCES Categorias(Id),
    CONSTRAINT FK_GastoRecurrenteOcurrencias_Pagador
        FOREIGN KEY (PagadoPorIntegranteIdSnapshot) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT FK_GastoRecurrenteOcurrencias_Gasto
        FOREIGN KEY (GastoGeneradoId) REFERENCES Gastos(Id),
    CONSTRAINT CK_GastoRecurrenteOcurrencias_Estado
        CHECK (Estado IN (N'pending', N'paid', N'overdue', N'cancelled')),
    CONSTRAINT CK_GastoRecurrenteOcurrencias_Division
        CHECK (TipoDivisionSnapshot IN (N'equal', N'fixed', N'responsible'))
);

CREATE UNIQUE INDEX UX_GastoRecurrenteOcurrencias_Gasto_Fecha
ON GastoRecurrenteOcurrencias(GastoRecurrenteId, FechaVencimiento);

CREATE INDEX IX_GastoRecurrenteOcurrencias_Hogar_Fecha
ON GastoRecurrenteOcurrencias(HogarId, FechaVencimiento, Estado);

CREATE TABLE GastoRecurrenteOcurrenciaParticipantes (
    OcurrenciaId INT NOT NULL,
    IntegranteId INT NOT NULL,
    Importe DECIMAL(18,2) NULL,
    Porcentaje DECIMAL(7,4) NULL,
    CONSTRAINT PK_GastoRecurrenteOcurrenciaParticipantes
        PRIMARY KEY (OcurrenciaId, IntegranteId),
    CONSTRAINT FK_OcurrenciaParticipantes_Ocurrencia
        FOREIGN KEY (OcurrenciaId) REFERENCES GastoRecurrenteOcurrencias(Id),
    CONSTRAINT FK_OcurrenciaParticipantes_Integrante
        FOREIGN KEY (IntegranteId) REFERENCES IntegrantesHogar(Id)
);
```

### 3.6 Liquidaciones

```sql
CREATE TABLE Liquidaciones (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    PagadorIntegranteId INT NOT NULL,
    ReceptorIntegranteId INT NOT NULL,
    Importe DECIMAL(18,2) NOT NULL,
    Fecha DATETIME2(7) NOT NULL,
    MetodoPago NVARCHAR(30) NOT NULL,
    Concepto NVARCHAR(300) NOT NULL,
    Notas NVARCHAR(2000) NULL,
    ComprobanteUrl NVARCHAR(1000) NULL,
    Estado NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Liquidaciones_Estado DEFAULT N'active',
    FechaReversion DATETIME2(7) NULL,
    MotivoReversion NVARCHAR(500) NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_Liquidaciones_FechaCreacion DEFAULT SYSUTCDATETIME(),
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Liquidaciones PRIMARY KEY (Id),
    CONSTRAINT FK_Liquidaciones_Hogares
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_Liquidaciones_Pagador
        FOREIGN KEY (PagadorIntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT FK_Liquidaciones_Receptor
        FOREIGN KEY (ReceptorIntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT CK_Liquidaciones_Importe CHECK (Importe > 0),
    CONSTRAINT CK_Liquidaciones_Integrantes
        CHECK (PagadorIntegranteId <> ReceptorIntegranteId),
    CONSTRAINT CK_Liquidaciones_Estado
        CHECK (Estado IN (N'active', N'reversed')),
    CONSTRAINT CK_Liquidaciones_Metodo
        CHECK (MetodoPago IN
            (N'Bizum', N'Transferencia', N'Efectivo', N'PayPal', N'Revolut', N'Otro'))
);

CREATE INDEX IX_Liquidaciones_Hogar_Fecha
ON Liquidaciones(HogarId, Fecha DESC, Estado);
```

### 3.7 Tareas

```sql
CREATE TABLE TareasRecurrentes (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    Titulo NVARCHAR(200) NOT NULL,
    Descripcion NVARCHAR(2000) NULL,
    CategoriaId INT NULL,
    Prioridad NVARCHAR(20) NOT NULL,
    Frecuencia NVARCHAR(30) NOT NULL,
    IntervaloDias INT NULL,
    DiasSemana TINYINT NULL, -- máscara de bits: lunes=1 ... domingo=64
    DiaMes TINYINT NULL,
    HoraLimite TIME NULL,
    RotarResponsable BIT NOT NULL
        CONSTRAINT DF_TareasRecurrentes_Rotar DEFAULT 0,
    FechaInicio DATE NOT NULL,
    FechaFin DATE NULL,
    Estado NVARCHAR(20) NOT NULL
        CONSTRAINT DF_TareasRecurrentes_Estado DEFAULT N'active',
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_TareasRecurrentes_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(7) NULL,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_TareasRecurrentes PRIMARY KEY (Id),
    CONSTRAINT FK_TareasRecurrentes_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_TareasRecurrentes_Categoria
        FOREIGN KEY (CategoriaId) REFERENCES Categorias(Id),
    CONSTRAINT CK_TareasRecurrentes_Prioridad
        CHECK (Prioridad IN (N'low', N'medium', N'high', N'urgent')),
    CONSTRAINT CK_TareasRecurrentes_Frecuencia
        CHECK (Frecuencia IN
            (N'daily', N'weekly', N'interval_days', N'monthly', N'weekdays')),
    CONSTRAINT CK_TareasRecurrentes_Estado
        CHECK (Estado IN (N'active', N'paused'))
);

CREATE TABLE TareaRecurrenteResponsables (
    TareaRecurrenteId INT NOT NULL,
    IntegranteId INT NOT NULL,
    OrdenRotacion INT NOT NULL,
    CONSTRAINT PK_TareaRecurrenteResponsables
        PRIMARY KEY (TareaRecurrenteId, IntegranteId),
    CONSTRAINT FK_TareaRecurrenteResponsables_Tarea
        FOREIGN KEY (TareaRecurrenteId) REFERENCES TareasRecurrentes(Id),
    CONSTRAINT FK_TareaRecurrenteResponsables_Integrante
        FOREIGN KEY (IntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT UQ_TareaRecurrenteResponsables_Orden
        UNIQUE (TareaRecurrenteId, OrdenRotacion)
);

CREATE TABLE Tareas (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    Titulo NVARCHAR(200) NOT NULL,
    Descripcion NVARCHAR(2000) NULL,
    CategoriaId INT NULL,
    AsignadoAIntegranteId INT NULL,
    Prioridad NVARCHAR(20) NOT NULL,
    Estado NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Tareas_Estado DEFAULT N'pending',
    FechaLimite DATETIME2(7) NULL,
    TareaRecurrenteId INT NULL,
    FechaProgramada DATE NULL,
    EvidenciaUrl NVARCHAR(1000) NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_Tareas_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(7) NULL,
    FechaCompletada DATETIME2(7) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_Tareas_Activo DEFAULT 1,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_Tareas PRIMARY KEY (Id),
    CONSTRAINT FK_Tareas_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_Tareas_Categoria
        FOREIGN KEY (CategoriaId) REFERENCES Categorias(Id),
    CONSTRAINT FK_Tareas_Asignado
        FOREIGN KEY (AsignadoAIntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT FK_Tareas_Recurrente
        FOREIGN KEY (TareaRecurrenteId) REFERENCES TareasRecurrentes(Id),
    CONSTRAINT CK_Tareas_Prioridad
        CHECK (Prioridad IN (N'low', N'medium', N'high', N'urgent')),
    CONSTRAINT CK_Tareas_Estado
        CHECK (Estado IN (N'pending', N'in_progress', N'completed', N'cancelled'))
);

CREATE UNIQUE INDEX UX_Tareas_Recurrente_Fecha
ON Tareas(TareaRecurrenteId, FechaProgramada)
WHERE TareaRecurrenteId IS NOT NULL;

CREATE INDEX IX_Tareas_Hogar_Estado_Fecha
ON Tareas(HogarId, Estado, FechaLimite);

CREATE TABLE TareaChecklistItems (
    Id INT IDENTITY(1,1) NOT NULL,
    TareaId INT NOT NULL,
    Texto NVARCHAR(500) NOT NULL,
    Completado BIT NOT NULL
        CONSTRAINT DF_TareaChecklistItems_Completado DEFAULT 0,
    Orden INT NOT NULL CONSTRAINT DF_TareaChecklistItems_Orden DEFAULT 0,
    FechaCompletado DATETIME2(7) NULL,
    CONSTRAINT PK_TareaChecklistItems PRIMARY KEY (Id),
    CONSTRAINT FK_TareaChecklistItems_Tarea
        FOREIGN KEY (TareaId) REFERENCES Tareas(Id)
);

CREATE TABLE TareaComentarios (
    Id INT IDENTITY(1,1) NOT NULL,
    TareaId INT NOT NULL,
    IntegranteId INT NOT NULL,
    Comentario NVARCHAR(2000) NOT NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_TareaComentarios_FechaCreacion DEFAULT SYSUTCDATETIME(),
    Activo BIT NOT NULL CONSTRAINT DF_TareaComentarios_Activo DEFAULT 1,
    CONSTRAINT PK_TareaComentarios PRIMARY KEY (Id),
    CONSTRAINT FK_TareaComentarios_Tarea
        FOREIGN KEY (TareaId) REFERENCES Tareas(Id),
    CONSTRAINT FK_TareaComentarios_Integrante
        FOREIGN KEY (IntegranteId) REFERENCES IntegrantesHogar(Id)
);
```

### 3.8 Supermercado

```sql
CREATE TABLE ListasCompra (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    Nombre NVARCHAR(200) NOT NULL,
    SemanaInicio DATE NOT NULL,
    Estado NVARCHAR(20) NOT NULL
        CONSTRAINT DF_ListasCompra_Estado DEFAULT N'open',
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_ListasCompra_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaCierre DATETIME2(7) NULL,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_ListasCompra PRIMARY KEY (Id),
    CONSTRAINT FK_ListasCompra_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT CK_ListasCompra_Estado
        CHECK (Estado IN (N'open', N'closed'))
);

CREATE INDEX IX_ListasCompra_Hogar_Semana
ON ListasCompra(HogarId, SemanaInicio DESC);

CREATE TABLE ItemsListaCompra (
    Id INT IDENTITY(1,1) NOT NULL,
    ListaCompraId INT NOT NULL,
    Nombre NVARCHAR(200) NOT NULL,
    Cantidad DECIMAL(10,3) NOT NULL,
    Unidad NVARCHAR(30) NOT NULL,
    CategoriaId INT NULL,
    AgregadoPorIntegranteId INT NOT NULL,
    Prioridad NVARCHAR(20) NOT NULL
        CONSTRAINT DF_ItemsListaCompra_Prioridad DEFAULT N'normal',
    Comprado BIT NOT NULL
        CONSTRAINT DF_ItemsListaCompra_Comprado DEFAULT 0,
    Supermercado NVARCHAR(150) NULL,
    PrecioEstimado DECIMAL(18,2) NULL,
    PrecioReal DECIMAL(18,2) NULL,
    Notas NVARCHAR(1000) NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_ItemsListaCompra_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaCompra DATETIME2(7) NULL,
    GastoGeneradoId INT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_ItemsListaCompra_Activo DEFAULT 1,
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT PK_ItemsListaCompra PRIMARY KEY (Id),
    CONSTRAINT FK_ItemsListaCompra_Lista
        FOREIGN KEY (ListaCompraId) REFERENCES ListasCompra(Id),
    CONSTRAINT FK_ItemsListaCompra_Categoria
        FOREIGN KEY (CategoriaId) REFERENCES Categorias(Id),
    CONSTRAINT FK_ItemsListaCompra_Integrante
        FOREIGN KEY (AgregadoPorIntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT FK_ItemsListaCompra_Gasto
        FOREIGN KEY (GastoGeneradoId) REFERENCES Gastos(Id),
    CONSTRAINT CK_ItemsListaCompra_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_ItemsListaCompra_Prioridad
        CHECK (Prioridad IN (N'normal', N'high')),
    CONSTRAINT CK_ItemsListaCompra_Precios
        CHECK (
            (PrecioEstimado IS NULL OR PrecioEstimado >= 0)
            AND (PrecioReal IS NULL OR PrecioReal >= 0)
        )
);

CREATE INDEX IX_ItemsListaCompra_Lista_Comprado
ON ItemsListaCompra(ListaCompraId, Comprado, Activo);

CREATE TABLE ProductosFavoritos (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    Nombre NVARCHAR(200) NOT NULL,
    CantidadHabitual DECIMAL(10,3) NULL,
    Unidad NVARCHAR(30) NULL,
    CategoriaId INT NULL,
    Supermercado NVARCHAR(150) NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_ProductosFavoritos_FechaCreacion DEFAULT SYSUTCDATETIME(),
    Activo BIT NOT NULL CONSTRAINT DF_ProductosFavoritos_Activo DEFAULT 1,
    CONSTRAINT PK_ProductosFavoritos PRIMARY KEY (Id),
    CONSTRAINT FK_ProductosFavoritos_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_ProductosFavoritos_Categoria
        FOREIGN KEY (CategoriaId) REFERENCES Categorias(Id)
);

CREATE UNIQUE INDEX UX_ProductosFavoritos_Hogar_Nombre
ON ProductosFavoritos(HogarId, Nombre);
```

### 3.9 Actividad, presupuestos y notificaciones

```sql
CREATE TABLE ActividadHogar (
    Id BIGINT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    IntegranteId INT NULL,
    TipoEntidad NVARCHAR(30) NOT NULL,
    EntidadId INT NULL,
    Accion NVARCHAR(80) NOT NULL,
    Descripcion NVARCHAR(1000) NOT NULL,
    MetadataJson NVARCHAR(MAX) NULL,
    Fecha DATETIME2(7) NOT NULL
        CONSTRAINT DF_ActividadHogar_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ActividadHogar PRIMARY KEY (Id),
    CONSTRAINT FK_ActividadHogar_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_ActividadHogar_Integrante
        FOREIGN KEY (IntegranteId) REFERENCES IntegrantesHogar(Id),
    CONSTRAINT CK_ActividadHogar_MetadataJson
        CHECK (MetadataJson IS NULL OR ISJSON(MetadataJson) = 1)
);

CREATE INDEX IX_ActividadHogar_Hogar_Fecha
ON ActividadHogar(HogarId, Fecha DESC);

CREATE TABLE PresupuestosMensuales (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    Anio SMALLINT NOT NULL,
    Mes TINYINT NOT NULL,
    Importe DECIMAL(18,2) NOT NULL,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_PresupuestosMensuales_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PresupuestosMensuales PRIMARY KEY (Id),
    CONSTRAINT FK_PresupuestosMensuales_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT UQ_PresupuestosMensuales_Periodo UNIQUE (HogarId, Anio, Mes),
    CONSTRAINT CK_PresupuestosMensuales_Mes CHECK (Mes BETWEEN 1 AND 12),
    CONSTRAINT CK_PresupuestosMensuales_Importe CHECK (Importe >= 0)
);

CREATE TABLE Recordatorios (
    Id INT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    IntegranteId INT NULL,
    Titulo NVARCHAR(200) NOT NULL,
    Descripcion NVARCHAR(1000) NULL,
    FechaRecordatorio DATETIME2(7) NOT NULL,
    TipoEntidad NVARCHAR(30) NULL,
    EntidadId INT NULL,
    Completado BIT NOT NULL CONSTRAINT DF_Recordatorios_Completado DEFAULT 0,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_Recordatorios_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Recordatorios PRIMARY KEY (Id),
    CONSTRAINT FK_Recordatorios_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_Recordatorios_Integrante
        FOREIGN KEY (IntegranteId) REFERENCES IntegrantesHogar(Id)
);

CREATE INDEX IX_Recordatorios_Hogar_Fecha
ON Recordatorios(HogarId, FechaRecordatorio, Completado);

CREATE TABLE Notificaciones (
    Id BIGINT IDENTITY(1,1) NOT NULL,
    HogarId INT NOT NULL,
    IntegranteId INT NOT NULL,
    Titulo NVARCHAR(200) NOT NULL,
    Mensaje NVARCHAR(1000) NOT NULL,
    Tipo NVARCHAR(30) NOT NULL,
    Leida BIT NOT NULL CONSTRAINT DF_Notificaciones_Leida DEFAULT 0,
    FechaCreacion DATETIME2(7) NOT NULL
        CONSTRAINT DF_Notificaciones_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaLeida DATETIME2(7) NULL,
    CONSTRAINT PK_Notificaciones PRIMARY KEY (Id),
    CONSTRAINT FK_Notificaciones_Hogar
        FOREIGN KEY (HogarId) REFERENCES Hogares(Id),
    CONSTRAINT FK_Notificaciones_Integrante
        FOREIGN KEY (IntegranteId) REFERENCES IntegrantesHogar(Id)
);

CREATE INDEX IX_Notificaciones_Integrante_Leida
ON Notificaciones(IntegranteId, Leida, FechaCreacion DESC);
```

## 4. Endpoints que debe exponer la API

Base recomendada:

```text
/api/hogares/{hogarId}
```

### 4.0 Autenticación con Google

El login de Google puede conservarse. El backend debe ser el responsable del
flujo OAuth y de la sesión; el frontend nunca debe guardar tokens de Google en
`localStorage`.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/auth/google/login?returnUrl=/` | Inicia OAuth con Google |
| `GET` | `/api/auth/google/callback` | Valida Google y crea la sesión |
| `GET` | `/api/auth/me` | Usuario autenticado |
| `POST` | `/api/auth/logout` | Cierra la sesión |
| `GET` | `/api/usuarios/me/hogares` | Hogares del usuario actual |

La sesión recomendada es una cookie propia del backend:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

Respuesta de `/api/auth/me`:

```json
{
  "id": 18,
  "name": "Valentín",
  "email": "valentin@gmail.com",
  "avatarUrl": "https://...",
  "provider": "google"
}
```

Al volver de Google:

1. Buscar `Usuarios.GoogleSubject`.
2. Si no existe, crear el usuario con el correo verificado por Google.
3. Actualizar nombre, avatar y último acceso.
4. Crear la cookie de sesión propia.
5. Redirigir únicamente a un `returnUrl` relativo y permitido.
6. Si venía desde una invitación, continuar el flujo de aceptación.

### 4.1 Hogares

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/hogares` | Hogares accesibles por el usuario |
| `POST` | `/api/hogares` | Crear hogar y categorías iniciales |
| `GET` | `/api/hogares/{hogarId}` | Detalle del hogar |
| `PATCH` | `/api/hogares/{hogarId}` | Nombre, moneda o zona horaria |

`POST /api/hogares` debe crear, dentro de una única transacción:

1. El hogar.
2. La membresía del usuario actual con rol `owner`.
3. Las categorías iniciales.
4. La primera lista de supermercado.
5. El movimiento de actividad.

Petición:

```json
{
  "name": "Piso de Barcelona",
  "currency": "EUR",
  "timezone": "Europe/Madrid"
}
```

### 4.2 Integrantes

| Método | Ruta |
|---|---|
| `GET` | `/api/hogares/{hogarId}/integrantes` |
| `POST` | `/api/hogares/{hogarId}/integrantes` |
| `GET` | `/api/hogares/{hogarId}/integrantes/{id}` |
| `PUT` | `/api/hogares/{hogarId}/integrantes/{id}` |
| `PATCH` | `/api/hogares/{hogarId}/integrantes/{id}/estado` |

Los listados de responsables para gastos y tareas solo deben devolver
integrantes con `Activo = 1`. Una invitación pendiente no es un integrante.

### 4.2.1 Invitaciones al hogar

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/hogares/{hogarId}/invitaciones` | Pendientes y recientes |
| `POST` | `/api/hogares/{hogarId}/invitaciones` | Invitar por email o enlace |
| `DELETE` | `/api/hogares/{hogarId}/invitaciones/{id}` | Revocar |
| `GET` | `/api/invitaciones/{token}` | Datos públicos mínimos |
| `POST` | `/api/invitaciones/{token}/aceptar` | Aceptar autenticado |

Solo `owner` y `admin` pueden crear o revocar invitaciones.

Invitación por correo:

```json
{
  "mode": "email",
  "email": "persona@gmail.com",
  "role": "member"
}
```

Invitación por enlace:

```json
{
  "mode": "link",
  "role": "member"
}
```

Respuesta:

```json
{
  "id": "7f97ac0c-7e44-4d98-94e2-891cc2c1dd53",
  "householdId": 1,
  "email": "persona@gmail.com",
  "mode": "email",
  "role": "member",
  "status": "pending",
  "inviteUrl": "https://app.example.com/?invite=token-original",
  "expiresAt": "2026-08-06T12:00:00Z"
}
```

Para `mode=email`, el backend debe enviar un correo que incluya:

- nombre del hogar;
- nombre de quien invita;
- fecha de caducidad;
- botón con el enlace de aceptación.

`GET /api/invitaciones/{token}` no debe revelar integrantes ni datos
financieros:

```json
{
  "householdName": "Piso de Barcelona",
  "invitedByName": "Valentín",
  "email": "persona@gmail.com",
  "expiresAt": "2026-08-06T12:00:00Z",
  "requiresLogin": true
}
```

Al aceptar:

1. Exigir login con Google.
2. Validar token, estado y expiración.
3. Comparar el correo cuando la invitación sea por email.
4. Evitar membresías duplicadas.
5. Crear `IntegrantesHogar` vinculado a `UsuarioId`.
6. Marcar la invitación como `accepted`.
7. Registrar actividad.
8. Devolver el hogar para que el frontend lo seleccione.

Alta:

```json
{
  "name": "María",
  "email": "maria@example.com",
  "initials": "MA",
  "color": "#6F7E91"
}
```

### 4.3 Categorías

| Método | Ruta |
|---|---|
| `GET` | `/api/hogares/{hogarId}/categorias?tipo=expense` |
| `POST` | `/api/hogares/{hogarId}/categorias` |
| `PUT` | `/api/hogares/{hogarId}/categorias/{id}` |
| `DELETE` | `/api/hogares/{hogarId}/categorias/{id}` |

`DELETE` debe marcar `Activo = 0` y devolver `204`.

### 4.4 Gastos

| Método | Ruta |
|---|---|
| `GET` | `/api/hogares/{hogarId}/gastos` |
| `GET` | `/api/hogares/{hogarId}/gastos/{id}` |
| `POST` | `/api/hogares/{hogarId}/gastos` |
| `PUT` | `/api/hogares/{hogarId}/gastos/{id}` |
| `DELETE` | `/api/hogares/{hogarId}/gastos/{id}` |
| `POST` | `/api/hogares/{hogarId}/gastos/lote` |

Filtros:

```text
?desde=2026-07-01
&hasta=2026-07-31
&integranteId=1
&categoriaId=2
&estado=paid
&busqueda=supermercado
&pagina=1
&tamanio=20
```

Crear gasto:

```json
{
  "description": "Compra semanal",
  "categoryId": 2,
  "amount": 100.00,
  "currency": "EUR",
  "paidByMemberId": 1,
  "date": "2026-07-30T12:00:00Z",
  "splitType": "fixed",
  "status": "paid",
  "participants": [
    { "memberId": 1, "amount": 50.00 },
    { "memberId": 2, "amount": 50.00 }
  ],
  "notes": null
}
```

Reglas del servicio:

- `paidByMemberId` es obligatorio.
- Debe existir al menos un participante.
- En `equal`, el servidor calcula los céntimos y asigna el resto al último
  participante para que la suma sea exacta.
- En `fixed`, la suma de importes debe ser igual al total.
- En porcentajes, si se incorpora `percentage`, debe sumar exactamente 100.
- Los participantes omitidos se consideran excluidos.
- Solo los gastos con estado `paid` afectan el balance.

Respuesta:

```json
{
  "id": 42,
  "householdId": 1,
  "description": "Compra semanal",
  "categoryId": 2,
  "amount": 100.00,
  "currency": "EUR",
  "paidByMemberId": 1,
  "date": "2026-07-30T12:00:00Z",
  "splitType": "fixed",
  "status": "paid",
  "participants": [
    { "memberId": 1, "amount": 50.00 },
    { "memberId": 2, "amount": 50.00 }
  ],
  "createdAt": "2026-07-30T12:04:10Z",
  "rowVersion": "AAAAAAAAB9E="
}
```

### 4.5 Balances y liquidaciones

| Método | Ruta |
|---|---|
| `GET` | `/api/hogares/{hogarId}/balances?desde=&hasta=` |
| `GET` | `/api/hogares/{hogarId}/liquidaciones?desde=&hasta=` |
| `POST` | `/api/hogares/{hogarId}/liquidaciones` |
| `POST` | `/api/hogares/{hogarId}/liquidaciones/{id}/revertir` |

Cálculo:

```text
balance = totalPagado
        - totalAsignado
        + liquidacionesEnviadas
        - liquidacionesRecibidas
```

Un balance positivo significa que el integrante debe recibir dinero. La
respuesta debe incluir una lista `suggestedTransfers` calculada con acreedores
y deudores para minimizar la cantidad de transferencias.

Respuesta:

```json
{
  "members": [
    {
      "memberId": 1,
      "paid": 900.00,
      "owed": 650.00,
      "settlementsSent": 0.00,
      "settlementsReceived": 0.00,
      "balance": 250.00
    }
  ],
  "suggestedTransfers": [
    {
      "fromMemberId": 2,
      "toMemberId": 1,
      "amount": 250.00
    }
  ]
}
```

Crear liquidación:

```json
{
  "fromMemberId": 2,
  "toMemberId": 1,
  "amount": 125.00,
  "date": "2026-07-30T18:00:00Z",
  "method": "Bizum",
  "concept": "Liquidación parcial",
  "notes": null
}
```

Revertir:

```json
{
  "reason": "Pago registrado por error"
}
```

### 4.6 Gastos recurrentes

| Método | Ruta |
|---|---|
| `GET` | `/api/hogares/{hogarId}/gastos-recurrentes` |
| `POST` | `/api/hogares/{hogarId}/gastos-recurrentes` |
| `GET` | `/api/hogares/{hogarId}/gastos-recurrentes/{id}` |
| `PUT` | `/api/hogares/{hogarId}/gastos-recurrentes/{id}` |
| `PATCH` | `/api/hogares/{hogarId}/gastos-recurrentes/{id}/estado` |
| `GET` | `/api/hogares/{hogarId}/gastos-recurrentes/ocurrencias` |
| `POST` | `/api/hogares/{hogarId}/gastos-recurrentes/ocurrencias/{id}/registrar-pago` |
| `POST` | `/api/hogares/{hogarId}/gastos-recurrentes/ocurrencias/{id}/cancelar` |

Registrar pago de ocurrencia:

```json
{
  "actualAmount": 67.45,
  "paidByMemberId": 1,
  "paidAt": "2026-08-12T10:30:00Z",
  "participants": [
    { "memberId": 1, "amount": 33.73 },
    { "memberId": 2, "amount": 33.72 }
  ]
}
```

Debe crear el gasto real y enlazarlo con `GastoGeneradoId`.

### 4.7 Tareas

| Método | Ruta |
|---|---|
| `GET` | `/api/hogares/{hogarId}/tareas` |
| `POST` | `/api/hogares/{hogarId}/tareas` |
| `GET` | `/api/hogares/{hogarId}/tareas/{id}` |
| `PUT` | `/api/hogares/{hogarId}/tareas/{id}` |
| `PATCH` | `/api/hogares/{hogarId}/tareas/{id}/estado` |
| `DELETE` | `/api/hogares/{hogarId}/tareas/{id}` |
| `POST` | `/api/hogares/{hogarId}/tareas/{id}/checklist` |
| `PATCH` | `/api/hogares/{hogarId}/tareas/{id}/checklist/{itemId}` |
| `DELETE` | `/api/hogares/{hogarId}/tareas/{id}/checklist/{itemId}` |
| `GET` | `/api/hogares/{hogarId}/tareas/{id}/comentarios` |
| `POST` | `/api/hogares/{hogarId}/tareas/{id}/comentarios` |
| `GET` | `/api/hogares/{hogarId}/tareas-recurrentes` |
| `POST` | `/api/hogares/{hogarId}/tareas-recurrentes` |
| `PUT` | `/api/hogares/{hogarId}/tareas-recurrentes/{id}` |
| `PATCH` | `/api/hogares/{hogarId}/tareas-recurrentes/{id}/estado` |

Crear tarea:

```json
{
  "title": "Limpiar el baño",
  "description": null,
  "categoryId": 12,
  "assignedToMemberId": 1,
  "priority": "high",
  "dueDate": "2026-08-01T18:00:00Z",
  "checklist": [
    { "text": "Ducha y lavabo", "order": 1 },
    { "text": "Suelo y espejo", "order": 2 }
  ]
}
```

Estado:

```json
{
  "status": "completed",
  "completedAt": "2026-08-01T16:20:00Z"
}
```

### 4.8 Supermercado

| Método | Ruta |
|---|---|
| `GET` | `/api/hogares/{hogarId}/listas-compra` |
| `POST` | `/api/hogares/{hogarId}/listas-compra` |
| `GET` | `/api/hogares/{hogarId}/listas-compra/{listaId}` |
| `POST` | `/api/hogares/{hogarId}/listas-compra/{listaId}/duplicar` |
| `POST` | `/api/hogares/{hogarId}/listas-compra/{listaId}/items` |
| `PATCH` | `/api/hogares/{hogarId}/listas-compra/{listaId}/items/{itemId}` |
| `DELETE` | `/api/hogares/{hogarId}/listas-compra/{listaId}/items/{itemId}` |
| `DELETE` | `/api/hogares/{hogarId}/listas-compra/{listaId}/items-comprados` |
| `POST` | `/api/hogares/{hogarId}/listas-compra/{listaId}/finalizar-compra` |
| `GET` | `/api/hogares/{hogarId}/productos/frecuentes` |
| `GET` | `/api/hogares/{hogarId}/productos-favoritos` |
| `POST` | `/api/hogares/{hogarId}/productos-favoritos` |

Agregar producto:

```json
{
  "name": "Café",
  "quantity": 1,
  "unit": "u",
  "categoryId": 21,
  "addedByMemberId": 2,
  "priority": "normal",
  "supermarket": "Mercadona",
  "estimatedPrice": 4.95,
  "notes": null
}
```

Marcar comprado:

```json
{
  "purchased": true,
  "actualPrice": 4.75
}
```

Finalizar compra:

```json
{
  "itemIds": [101, 102, 108],
  "totalAmount": 43.80,
  "paidByMemberId": 2,
  "splitType": "equal",
  "participants": [
    { "memberId": 1 },
    { "memberId": 2 }
  ],
  "date": "2026-07-30T19:00:00Z"
}
```

Respuesta:

```json
{
  "shoppingListId": 7,
  "processedItemIds": [101, 102, 108],
  "expense": {
    "id": 58,
    "description": "Compra semanal",
    "amount": 43.80,
    "categoryName": "Supermercado"
  }
}
```

### 4.9 Vistas agregadas

| Método | Ruta |
|---|---|
| `GET` | `/api/hogares/{hogarId}/dashboard` |
| `GET` | `/api/hogares/{hogarId}/calendario?desde=&hasta=` |
| `GET` | `/api/hogares/{hogarId}/actividad?pagina=1&tamanio=30` |
| `GET` | `/api/hogares/{hogarId}/reportes/gastos?desde=&hasta=` |
| `GET` | `/api/hogares/{hogarId}/reportes/tareas?desde=&hasta=` |

`dashboard` debería devolver en una sola llamada:

```json
{
  "balance": {
    "members": [],
    "suggestedTransfers": []
  },
  "monthExpenses": {
    "total": 1420.00,
    "count": 18
  },
  "tasks": {
    "pending": 5,
    "overdue": 1,
    "next": []
  },
  "shopping": {
    "listId": 7,
    "pending": 12,
    "purchased": 4
  },
  "upcomingRecurringExpenses": [],
  "recentActivity": []
}
```

`calendario` agrega tareas, ocurrencias recurrentes y recordatorios en un
contrato común:

```json
{
  "events": [
    {
      "id": "task-42",
      "type": "task",
      "title": "Limpiar el baño",
      "startsAt": "2026-08-01T18:00:00Z",
      "status": "pending",
      "color": "#4F7C65",
      "entityId": 42
    }
  ]
}
```

## 5. Respuestas HTTP y errores

- `200 OK`: lecturas y modificaciones con cuerpo.
- `201 Created`: altas, incluyendo cabecera `Location`.
- `204 No Content`: desactivaciones sin cuerpo.
- `400 Bad Request`: formato o reglas simples inválidas.
- `404 Not Found`: entidad inexistente dentro del hogar.
- `409 Conflict`: reparto incorrecto, duplicado o `rowVersion` desactualizado.
- `422 Unprocessable Entity`: operación válida sintácticamente pero no
  permitida por el estado actual.

Formato de error:

```json
{
  "error": true,
  "code": "EXPENSE_SPLIT_MISMATCH",
  "message": "La suma del reparto debe coincidir con el importe del gasto.",
  "fieldErrors": {
    "participants": ["La suma actual es 99,99 €."]
  },
  "traceId": "00-..."
}
```

El frontend actual acepta respuesta directa o el contenedor histórico
`{ "result": ... }`, pero para los endpoints nuevos se recomienda devolver el
recurso directamente.

## 6. Procesos automáticos

Crear un `BackgroundService`, Hangfire o tarea programada que se ejecute una vez
al día:

1. Obtiene gastos recurrentes activos.
2. Genera las ocurrencias que falten.
3. Copia nombre, categoría, pagador, división y participantes.
4. Usa el índice único para evitar duplicados.
5. Marca como `overdue` las ocurrencias vencidas que siguen pendientes.
6. Genera las tareas recurrentes que falten.
7. Selecciona el siguiente responsable cuando la rotación está activa.
8. Crea recordatorios/notificaciones.
9. Escribe la actividad correspondiente.

La generación debe ser idempotente: ejecutar el proceso dos veces no puede
crear dos ocurrencias para la misma fecha.

## 7. Seguridad y autorización

Google autentica la identidad; la base de datos de Casa Clara decide a qué
hogares puede entrar esa identidad.

En cada endpoint con `{hogarId}`:

1. Obtener el usuario desde la sesión del servidor.
2. Buscar una fila activa en `IntegrantesHogar` para ese usuario y hogar.
3. Rechazar con `403` si no pertenece al hogar.
4. Para administración e invitaciones, exigir rol `owner` o `admin`.
5. Para transferir propiedad o eliminar un hogar, exigir `owner`.

No confiar en `userId`, `memberId`, rol o correo enviados por el cliente. No
autorizar una petición únicamente porque conoce `hogarId`.

El secreto OAuth de Google, las claves de correo y la clave de firma de sesión
deben existir únicamente como secretos del backend. Nunca utilizar variables
`NEXT_PUBLIC_*` para esos valores.

Si el frontend y la API usan dominios distintos:

- CORS debe aceptar únicamente el dominio real del frontend;
- habilitar credenciales;
- no usar `Access-Control-Allow-Origin: *`;
- añadir protección CSRF a escrituras basadas en cookie.

## 8. Configuración del frontend al conectar la API

Crear:

```text
.env.local
```

Con:

```env
NEXT_PUBLIC_API_URL=https://tu-api.example.com/api
NEXT_PUBLIC_SITE_URL=https://tu-frontend.example.com
NEXT_PUBLIC_AUTH_ENABLED=true
```

Después:

1. Configurar Google OAuth y la cookie de sesión en el backend.
2. Sustituir `useHousehold` por un repositorio que use `householdApi`.
3. Mantener las firmas de las acciones actuales.
4. Invalidar/refrescar dashboard, balance y actividad después de cada escritura.
5. Enviar `rowVersion` en actualizaciones para evitar que una persona pise los
   cambios de otra.
6. Configurar CORS para el dominio real del frontend.

## 9. Checklist de aceptación

- [ ] El login Google crea o recupera un único usuario por `GoogleSubject`.
- [ ] El frontend no recibe ni guarda tokens OAuth de Google.
- [ ] Un usuario puede crear y cambiar entre varios hogares.
- [ ] Se puede invitar por correo o por enlace de un solo uso.
- [ ] Una invitación vencida, revocada o ya aceptada no puede reutilizarse.
- [ ] Una invitación por correo solo puede aceptarla ese correo de Google.
- [ ] Solo integrantes activos aparecen como responsables o participantes.
- [ ] Se pueden crear hogares e integrantes.
- [ ] Un gasto siempre tiene pagador y participantes.
- [ ] Los céntimos del reparto suman exactamente el total.
- [ ] Un gasto cancelado no afecta balances.
- [ ] Una liquidación parcial actualiza el balance.
- [ ] Revertir una liquidación restaura el balance anterior.
- [ ] Editar una recurrencia no cambia ocurrencias ya generadas.
- [ ] Finalizar una compra no puede procesar dos veces el mismo producto.
- [ ] Completar una tarea recurrente no reutiliza la misma fila.
- [ ] Dashboard y calendario respetan la zona horaria del hogar.
- [ ] Toda escritura relevante crea actividad.
- [ ] No se usa `SaldoActual` para obtener balances.
