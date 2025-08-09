using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GastosBCN.DTOs;
using GastosBCN.Data;
using System.ComponentModel.DataAnnotations;

namespace GastosBCN.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GastosController : ControllerBase
    {
        private readonly GastosBCNContext _context;
        private readonly ILogger<GastosController> _logger;

        public GastosController(GastosBCNContext context, ILogger<GastosController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene todos los gastos con paginación y filtros
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<RespuestaPaginadaDto<GastoDto>>> GetGastos([FromQuery] FiltroGastosDto filtro)
        {
            try
            {
                var query = _context.Gastos
                    .Include(g => g.Categoria)
                    .Where(g => g.Activo);

                // Aplicar filtros
                if (!string.IsNullOrEmpty(filtro.Persona))
                    query = query.Where(g => g.Persona == filtro.Persona);

                if (filtro.CategoriaId.HasValue)
                    query = query.Where(g => g.CategoriaId == filtro.CategoriaId.Value);

                if (filtro.FechaDesde.HasValue)
                    query = query.Where(g => g.Fecha >= filtro.FechaDesde.Value);

                if (filtro.FechaHasta.HasValue)
                    query = query.Where(g => g.Fecha <= filtro.FechaHasta.Value);

                if (filtro.MontoMinimo.HasValue)
                    query = query.Where(g => g.Monto >= filtro.MontoMinimo.Value);

                if (filtro.MontoMaximo.HasValue)
                    query = query.Where(g => g.Monto <= filtro.MontoMaximo.Value);

                if (!string.IsNullOrEmpty(filtro.Descripcion))
                    query = query.Where(g => g.Descripcion.Contains(filtro.Descripcion));

                // Contar total de elementos
                var totalElementos = await query.CountAsync();

                // Aplicar paginación
                var elementos = await query
                    .OrderByDescending(g => g.Fecha)
                    .ThenByDescending(g => g.Id)
                    .Skip((filtro.Pagina - 1) * filtro.ElementosPorPagina)
                    .Take(filtro.ElementosPorPagina)
                    .Select(g => new GastoDto
                    {
                        Id = g.Id,
                        Monto = g.Monto,
                        Descripcion = g.Descripcion,
                        Persona = g.Persona,
                        Fecha = g.Fecha,
                        FechaCreacion = g.FechaCreacion,
                        Activo = g.Activo,
                        Categoria = new CategoriaDto
                        {
                            Id = g.Categoria.Id,
                            Nombre = g.Categoria.Nombre,
                            Descripcion = g.Categoria.Descripcion,
                            Color = g.Categoria.Color,
                            FechaCreacion = g.Categoria.FechaCreacion,
                            Activo = g.Categoria.Activo
                        }
                    })
                    .ToListAsync();

                var totalPaginas = (int)Math.Ceiling((double)totalElementos / filtro.ElementosPorPagina);

                var respuesta = new RespuestaPaginadaDto<GastoDto>
                {
                    Elementos = elementos,
                    TotalElementos = totalElementos,
                    PaginaActual = filtro.Pagina,
                    ElementosPorPagina = filtro.ElementosPorPagina,
                    TotalPaginas = totalPaginas,
                    TienePaginaAnterior = filtro.Pagina > 1,
                    TienePaginaSiguiente = filtro.Pagina < totalPaginas
                };

                return Ok(respuesta);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener gastos");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Obtiene un gasto específico por ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<GastoDto>> GetGasto(int id)
        {
            try
            {
                var gasto = await _context.Gastos
                    .Include(g => g.Categoria)
                    .FirstOrDefaultAsync(g => g.Id == id && g.Activo);

                if (gasto == null)
                    return NotFound($"Gasto con ID {id} no encontrado");

                var gastoDto = new GastoDto
                {
                    Id = gasto.Id,
                    Monto = gasto.Monto,
                    Descripcion = gasto.Descripcion,
                    Persona = gasto.Persona,
                    Fecha = gasto.Fecha,
                    FechaCreacion = gasto.FechaCreacion,
                    Activo = gasto.Activo,
                    Categoria = new CategoriaDto
                    {
                        Id = gasto.Categoria.Id,
                        Nombre = gasto.Categoria.Nombre,
                        Descripcion = gasto.Categoria.Descripcion,
                        Color = gasto.Categoria.Color,
                        FechaCreacion = gasto.Categoria.FechaCreacion,
                        Activo = gasto.Categoria.Activo
                    }
                };

                return Ok(gastoDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener gasto con ID {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Crea un nuevo gasto
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<GastoDto>> CreateGasto(CrearGastoDto crearGastoDto)
        {
            try
            {
                // Validar que la categoría existe y está activa
                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == crearGastoDto.CategoriaId && c.Activo);

                if (categoria == null)
                    return BadRequest("La categoría especificada no existe o no está activa");

                // Validar que la persona sea válida
                if (!new[] { "Ana", "Valen" }.Contains(crearGastoDto.Persona))
                    return BadRequest("La persona debe ser 'Ana' o 'Valen'");

                var gasto = new Gasto
                {
                    Monto = crearGastoDto.Monto,
                    Descripcion = crearGastoDto.Descripcion,
                    CategoriaId = crearGastoDto.CategoriaId,
                    Persona = crearGastoDto.Persona,
                    Fecha = crearGastoDto.Fecha ?? DateTime.Now,
                    FechaCreacion = DateTime.Now,
                    Activo = true
                };

                _context.Gastos.Add(gasto);
                await _context.SaveChangesAsync();

                // Obtener el gasto creado con la categoría
                var gastoCreado = await _context.Gastos
                    .Include(g => g.Categoria)
                    .FirstAsync(g => g.Id == gasto.Id);

                var gastoDto = new GastoDto
                {
                    Id = gastoCreado.Id,
                    Monto = gastoCreado.Monto,
                    Descripcion = gastoCreado.Descripcion,
                    Persona = gastoCreado.Persona,
                    Fecha = gastoCreado.Fecha,
                    FechaCreacion = gastoCreado.FechaCreacion,
                    Activo = gastoCreado.Activo,
                    Categoria = new CategoriaDto
                    {
                        Id = gastoCreado.Categoria.Id,
                        Nombre = gastoCreado.Categoria.Nombre,
                        Descripcion = gastoCreado.Categoria.Descripcion,
                        Color = gastoCreado.Categoria.Color,
                        FechaCreacion = gastoCreado.Categoria.FechaCreacion,
                        Activo = gastoCreado.Categoria.Activo
                    }
                };

                _logger.LogInformation("Gasto creado exitosamente: {GastoId}", gasto.Id);

                return CreatedAtAction(nameof(GetGasto), new { id = gasto.Id }, gastoDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear gasto");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Actualiza un gasto existente
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateGasto(int id, ActualizarGastoDto actualizarGastoDto)
        {
            try
            {
                if (id != actualizarGastoDto.Id)
                    return BadRequest("El ID de la URL no coincide con el ID del gasto");

                var gasto = await _context.Gastos
                    .FirstOrDefaultAsync(g => g.Id == id && g.Activo);

                if (gasto == null)
                    return NotFound($"Gasto con ID {id} no encontrado");

                // Validar que la categoría existe y está activa
                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == actualizarGastoDto.CategoriaId && c.Activo);

                if (categoria == null)
                    return BadRequest("La categoría especificada no existe o no está activa");

                // Validar que la persona sea válida
                if (!new[] { "Ana", "Valen" }.Contains(actualizarGastoDto.Persona))
                    return BadRequest("La persona debe ser 'Ana' o 'Valen'");

                // Actualizar propiedades
                gasto.Monto = actualizarGastoDto.Monto;
                gasto.Descripcion = actualizarGastoDto.Descripcion;
                gasto.CategoriaId = actualizarGastoDto.CategoriaId;
                gasto.Persona = actualizarGastoDto.Persona;
                gasto.Fecha = actualizarGastoDto.Fecha;
                gasto.Activo = actualizarGastoDto.Activo;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Gasto actualizado exitosamente: {GastoId}", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar gasto con ID {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Elimina lógicamente un gasto (soft delete)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteGasto(int id)
        {
            try
            {
                var gasto = await _context.Gastos
                    .FirstOrDefaultAsync(g => g.Id == id && g.Activo);

                if (gasto == null)
                    return NotFound($"Gasto con ID {id} no encontrado");

                // Soft delete
                gasto.Activo = false;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Gasto eliminado lógicamente: {GastoId}", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar gasto con ID {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Obtiene estadísticas de gastos
        /// </summary>
        [HttpGet("estadisticas")]
        public async Task<ActionResult<EstadisticasGastosDto>> GetEstadisticas()
        {
            try
            {
                var gastos = await _context.Gastos
                    .Include(g => g.Categoria)
                    .Where(g => g.Activo)
                    .ToListAsync();

                var estadisticas = new EstadisticasGastosDto
                {
                    TotalGastos = gastos.Sum(g => g.Monto),
                    CantidadGastos = gastos.Count,
                    PromedioGastos = gastos.Any() ? gastos.Average(g => g.Monto) : 0,
                    TotalGastosAna = gastos.Where(g => g.Persona == "Ana").Sum(g => g.Monto),
                    TotalGastosValen = gastos.Where(g => g.Persona == "Valen").Sum(g => g.Monto)
                };

                // Estadísticas por categoría
                var gastosPorCategoria = gastos
                    .GroupBy(g => new { g.Categoria.Id, g.Categoria.Nombre, g.Categoria.Color })
                    .Select(g => new EstadisticaPorCategoriaDto
                    {
                        CategoriaId = g.Key.Id,
                        NombreCategoria = g.Key.Nombre,
                        ColorCategoria = g.Key.Color,
                        TotalGastos = g.Sum(x => x.Monto),
                        CantidadGastos = g.Count(),
                        PorcentajeDelTotal = estadisticas.TotalGastos > 0 
                            ? (g.Sum(x => x.Monto) / estadisticas.TotalGastos) * 100 
                            : 0
                    })
                    .OrderByDescending(x => x.TotalGastos)
                    .ToList();

                estadisticas.GastosPorCategoria = gastosPorCategoria;

                // Estadísticas por persona
                var gastosPorPersona = gastos
                    .GroupBy(g => g.Persona)
                    .Select(g => new EstadisticaPorPersonaDto
                    {
                        Persona = g.Key,
                        TotalGastos = g.Sum(x => x.Monto),
                        CantidadGastos = g.Count(),
                        PromedioGastos = g.Average(x => x.Monto),
                        PorcentajeDelTotal = estadisticas.TotalGastos > 0 
                            ? (g.Sum(x => x.Monto) / estadisticas.TotalGastos) * 100 
                            : 0,
                        PrimerGasto = g.Min(x => x.Fecha),
                        UltimoGasto = g.Max(x => x.Fecha)
                    })
                    .OrderByDescending(x => x.TotalGastos)
                    .ToList();

                estadisticas.GastosPorPersona = gastosPorPersona;

                return Ok(estadisticas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener estadísticas");
                return StatusCode(500, "Error interno del servidor");
            }
        }
    }
} 