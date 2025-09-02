-- =============================================
-- Esquema de Base de Datos para Gastos BCN
-- Aplicación de Control de Gastos Compartidos
-- =============================================

-- Crear la base de datos (opcional - descomenta si necesitas crearla)
-- CREATE DATABASE GastosBCN;
-- GO

-- Usar la base de datos
-- USE GastosBCN;
-- GO

-- =============================================
-- Tabla: Categorias
-- Almacena las categorías de gastos disponibles
-- =============================================
CREATE TABLE Categorias (
    Id INT IDENTITY(1,1) NOT NULL,
    Nombre NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(500) NULL,
    Color NVARCHAR(7) NOT NULL, -- Formato hexadecimal (#RRGGBB)
    FechaCreacion DATETIME2(7) NOT NULL DEFAULT GETDATE(),
    Activo BIT NOT NULL DEFAULT 1,
    
    -- Restricciones
    CONSTRAINT PK_Categorias PRIMARY KEY (Id),
    CONSTRAINT UQ_Categorias_Nombre UNIQUE (Nombre),
    CONSTRAINT CK_Categorias_Color CHECK (Color LIKE '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

-- =============================================
-- Tabla: Gastos
-- Almacena todos los gastos registrados
-- =============================================
CREATE TABLE Gastos (
    Id INT IDENTITY(1,1) NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    Descripcion NVARCHAR(500) NOT NULL,
    CategoriaId INT NOT NULL,
    Persona NVARCHAR(10) NOT NULL, -- 'Ana' o 'Valen'
    Fecha DATETIME2(7) NOT NULL DEFAULT GETDATE(),
    FechaCreacion DATETIME2(7) NOT NULL DEFAULT GETDATE(),
    Activo BIT NOT NULL DEFAULT 1,
    
    -- Restricciones
    CONSTRAINT PK_Gastos PRIMARY KEY (Id),
    CONSTRAINT FK_Gastos_Categorias FOREIGN KEY (CategoriaId) REFERENCES Categorias(Id),
    CONSTRAINT CK_Gastos_Monto CHECK (Monto > 0),
    CONSTRAINT CK_Gastos_Persona CHECK (Persona IN ('Ana', 'Valen')),
    CONSTRAINT CK_Gastos_Fecha CHECK (Fecha <= GETDATE())
);

-- =============================================
-- Índices para optimizar consultas
-- =============================================

-- Índice para búsquedas por persona
CREATE NONCLUSTERED INDEX IX_Gastos_Persona 
ON Gastos(Persona) 
INCLUDE (Monto, Descripcion, CategoriaId, Fecha);

-- Índice para búsquedas por categoría
CREATE NONCLUSTERED INDEX IX_Gastos_CategoriaId 
ON Gastos(CategoriaId) 
INCLUDE (Monto, Descripcion, Persona, Fecha);

-- Índice para búsquedas por fecha
CREATE NONCLUSTERED INDEX IX_Gastos_Fecha 
ON Gastos(Fecha DESC) 
INCLUDE (Monto, Descripcion, CategoriaId, Persona);

-- Índice compuesto para consultas de gastos por persona y fecha
CREATE NONCLUSTERED INDEX IX_Gastos_Persona_Fecha 
ON Gastos(Persona, Fecha DESC) 
INCLUDE (Monto, Descripcion, CategoriaId);

-- =============================================
-- Datos iniciales de ejemplo
-- =============================================

-- Insertar categorías por defecto
INSERT INTO Categorias (Nombre, Descripcion, Color) VALUES
('Comida', 'Gastos en alimentación, restaurantes y supermercados', '#1e3a8a'),
('Transporte', 'Gasolina, transporte público, taxis', '#3b82f6'),
('Entretenimiento', 'Cine, conciertos, actividades de ocio', '#fbbf24'),
('Hogar', 'Gastos de la casa, muebles, decoración', '#f97316'),
('Salud', 'Médicos, medicamentos, seguros', '#06b6d4'),
('Ropa', 'Vestimenta y accesorios', '#fb7185'),
('Viajes', 'Vacaciones, hoteles, actividades turísticas', '#f59e0b');

-- =============================================
-- Vistas útiles para consultas comunes
-- =============================================

-- Vista para gastos con información completa
CREATE VIEW vw_GastosCompletos AS
SELECT 
    g.Id,
    g.Monto,
    g.Descripcion,
    g.Persona,
    g.Fecha,
    c.Nombre AS CategoriaNombre,
    c.Descripcion AS CategoriaDescripcion,
    c.Color AS CategoriaColor
FROM Gastos g
INNER JOIN Categorias c ON g.CategoriaId = c.Id
WHERE g.Activo = 1 AND c.Activo = 1;

-- Vista para resumen de gastos por persona
CREATE VIEW vw_ResumenGastosPorPersona AS
SELECT 
    Persona,
    COUNT(*) AS TotalGastos,
    SUM(Monto) AS TotalMonto,
    AVG(Monto) AS PromedioMonto,
    MIN(Fecha) AS PrimerGasto,
    MAX(Fecha) AS UltimoGasto
FROM Gastos
WHERE Activo = 1
GROUP BY Persona;

-- Vista para resumen de gastos por categoría
CREATE VIEW vw_ResumenGastosPorCategoria AS
SELECT 
    c.Nombre AS CategoriaNombre,
    c.Color AS CategoriaColor,
    COUNT(g.Id) AS TotalGastos,
    SUM(g.Monto) AS TotalMonto,
    AVG(g.Monto) AS PromedioMonto
FROM Categorias c
LEFT JOIN Gastos g ON c.Id = g.CategoriaId AND g.Activo = 1
WHERE c.Activo = 1
GROUP BY c.Id, c.Nombre, c.Color;

-- =============================================
-- Procedimientos almacenados útiles
-- =============================================

-- Procedimiento para obtener los últimos N gastos de una persona
CREATE PROCEDURE sp_ObtenerUltimosGastosPorPersona
    @Persona NVARCHAR(10),
    @Cantidad INT = 5
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@Cantidad)
        g.Id,
        g.Monto,
        g.Descripcion,
        g.Fecha,
        c.Nombre AS CategoriaNombre,
        c.Color AS CategoriaColor
    FROM Gastos g
    INNER JOIN Categorias c ON g.CategoriaId = c.Id
    WHERE g.Persona = @Persona 
        AND g.Activo = 1 
        AND c.Activo = 1
    ORDER BY g.Fecha DESC;
END;

-- Procedimiento para obtener gastos por rango de fechas
CREATE PROCEDURE sp_ObtenerGastosPorFechas
    @FechaInicio DATE,
    @FechaFin DATE,
    @Persona NVARCHAR(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        g.Id,
        g.Monto,
        g.Descripcion,
        g.Persona,
        g.Fecha,
        c.Nombre AS CategoriaNombre,
        c.Color AS CategoriaColor
    FROM Gastos g
    INNER JOIN Categorias c ON g.CategoriaId = c.Id
    WHERE g.Fecha >= @FechaInicio 
        AND g.Fecha <= @FechaFin
        AND g.Activo = 1 
        AND c.Activo = 1
        AND (@Persona IS NULL OR g.Persona = @Persona)
    ORDER BY g.Fecha DESC, g.Id DESC;
END;

-- =============================================
-- Triggers para auditoría (opcional)
-- =============================================

-- Crear tabla de auditoría
CREATE TABLE GastosAuditoria (
    Id INT IDENTITY(1,1) NOT NULL,
    GastoId INT NOT NULL,
    Accion NVARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    FechaAccion DATETIME2(7) NOT NULL DEFAULT GETDATE(),
    Usuario NVARCHAR(100) NULL,
    DatosAnteriores NVARCHAR(MAX) NULL,
    DatosNuevos NVARCHAR(MAX) NULL,
    
    CONSTRAINT PK_GastosAuditoria PRIMARY KEY (Id)
);

-- Trigger para auditoría de gastos
CREATE TRIGGER tr_GastosAuditoria
ON Gastos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Accion NVARCHAR(10);
    DECLARE @GastoId INT;
    DECLARE @DatosAnteriores NVARCHAR(MAX);
    DECLARE @DatosNuevos NVARCHAR(MAX);
    
    -- Determinar la acción
    IF EXISTS(SELECT * FROM INSERTED) AND EXISTS(SELECT * FROM DELETED)
        SET @Accion = 'UPDATE';
    ELSE IF EXISTS(SELECT * FROM INSERTED)
        SET @Accion = 'INSERT';
    ELSE
        SET @Accion = 'DELETE';
    
    -- Procesar registros
    IF @Accion = 'INSERT'
    BEGIN
        INSERT INTO GastosAuditoria (GastoId, Accion, DatosNuevos)
        SELECT Id, @Accion, 
            (SELECT * FROM INSERTED FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        FROM INSERTED;
    END
    ELSE IF @Accion = 'UPDATE'
    BEGIN
        INSERT INTO GastosAuditoria (GastoId, Accion, DatosAnteriores, DatosNuevos)
        SELECT 
            i.Id, 
            @Accion,
            (SELECT * FROM DELETED WHERE Id = i.Id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            (SELECT * FROM INSERTED WHERE Id = i.Id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        FROM INSERTED i;
    END
    ELSE IF @Accion = 'DELETE'
    BEGIN
        INSERT INTO GastosAuditoria (GastoId, Accion, DatosAnteriores)
        SELECT Id, @Accion,
            (SELECT * FROM DELETED FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        FROM DELETED;
    END
END;

-- =============================================
-- Comentarios y documentación
-- =============================================

-- Agregar comentarios a las tablas
EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Tabla que almacena las categorías de gastos disponibles',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Categorias';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Tabla que almacena todos los gastos registrados por Ana y Valen',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Gastos';

-- Agregar comentarios a las columnas principales
EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Identificador único de la categoría',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Categorias',
    @level2type = N'COLUMN',
    @level2name = N'Id';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Nombre de la categoría (debe ser único)',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Categorias',
    @level2type = N'COLUMN',
    @level2name = N'Nombre';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Descripción opcional de la categoría',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Categorias',
    @level2type = N'COLUMN',
    @level2name = N'Descripcion';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Color en formato hexadecimal para la interfaz',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Categorias',
    @level2type = N'COLUMN',
    @level2name = N'Color';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Identificador único del gasto',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Gastos',
    @level2type = N'COLUMN',
    @level2name = N'Id';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Monto del gasto en euros',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Gastos',
    @level2type = N'COLUMN',
    @level2name = N'Monto';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Descripción del gasto realizado',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Gastos',
    @level2type = N'COLUMN',
    @level2name = N'Descripcion';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Referencia a la categoría del gasto',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Gastos',
    @level2type = N'COLUMN',
    @level2name = N'CategoriaId';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Persona que realizó el gasto (Ana o Valen)',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Gastos',
    @level2type = N'COLUMN',
    @level2name = N'Persona';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Fecha en que se realizó el gasto',
    @level0type = N'SCHEMA',
    @level0name = N'dbo',
    @level1type = N'TABLE',
    @level1name = N'Gastos',
    @level2type = N'COLUMN',
    @level2name = N'Fecha';

-- =============================================
-- Script de verificación
-- =============================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    TABLE_NAME,
    TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME IN ('Categorias', 'Gastos')
ORDER BY TABLE_NAME;

-- Verificar las relaciones de clave foránea
SELECT 
    fk.name AS FK_Name,
    OBJECT_NAME(fk.parent_object_id) AS Table_Name,
    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS Column_Name,
    OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table_Name,
    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS Referenced_Column_Name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
WHERE OBJECT_NAME(fk.parent_object_id) = 'Gastos';

-- Verificar los índices creados
SELECT 
    t.name AS Table_Name,
    i.name AS Index_Name,
    i.type_desc AS Index_Type,
    i.is_unique AS Is_Unique
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('Categorias', 'Gastos')
ORDER BY t.name, i.name;

PRINT 'Esquema de base de datos creado exitosamente!';
PRINT 'Tablas: Categorias, Gastos';
PRINT 'Vistas: vw_GastosCompletos, vw_ResumenGastosPorPersona, vw_ResumenGastosPorCategoria';
PRINT 'Procedimientos: sp_ObtenerUltimosGastosPorPersona, sp_ObtenerGastosPorFechas';
PRINT 'Triggers: tr_GastosAuditoria (para auditoría)'; 

CREATE TABLE SaldoActual (
    Id INT IDENTITY(1,1) PRIMARY KEY,       -- Clave primaria autoincremental
    Valor DECIMAL(18, 2) NOT NULL,          -- Valor numérico con 2 decimales
    Fecha DATETIME NULL                     -- Fecha opcional
);
