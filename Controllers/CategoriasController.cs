using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GastosBCN.DTOs;
using GastosBCN.Data;

namespace GastosBCN.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoriasController : ControllerBase
    {
        private readonly GastosBCNContext _context;
        private readonly ILogger<CategoriasController> _logger;

        public CategoriasController(GastosBCNContext context, ILogger<CategoriasController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene todas las categorías activas
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<List<CategoriaDto>>> GetCategorias()
        {
            try
            {
                var categorias = await _context.Categorias
                    .Where(c => c.Activo)
                    .OrderBy(c => c.Nombre)
                    .Select(c => new CategoriaDto
                    {
                        Id = c.Id,
                        Nombre = c.Nombre,
                        Descripcion = c.Descripcion,
                        Color = c.Color,
                        FechaCreacion = c.FechaCreacion,
                        Activo = c.Activo
                    })
                    .ToListAsync();

                return Ok(categorias);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener categorías");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Obtiene una categoría específica por ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<CategoriaDto>> GetCategoria(int id)
        {
            try
            {
                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == id && c.Activo);

                if (categoria == null)
                    return NotFound($"Categoría con ID {id} no encontrada");

                var categoriaDto = new CategoriaDto
                {
                    Id = categoria.Id,
                    Nombre = categoria.Nombre,
                    Descripcion = categoria.Descripcion,
                    Color = categoria.Color,
                    FechaCreacion = categoria.FechaCreacion,
                    Activo = categoria.Activo
                };

                return Ok(categoriaDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener categoría con ID {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Crea una nueva categoría
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<CategoriaDto>> CreateCategoria(CrearCategoriaDto crearCategoriaDto)
        {
            try
            {
                // Verificar si ya existe una categoría con el mismo nombre
                var categoriaExistente = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Nombre.ToLower() == crearCategoriaDto.Nombre.ToLower());

                if (categoriaExistente != null)
                    return BadRequest($"Ya existe una categoría con el nombre '{crearCategoriaDto.Nombre}'");

                var categoria = new Categoria
                {
                    Nombre = crearCategoriaDto.Nombre.Trim(),
                    Descripcion = crearCategoriaDto.Descripcion?.Trim(),
                    Color = crearCategoriaDto.Color,
                    FechaCreacion = DateTime.Now,
                    Activo = true
                };

                _context.Categorias.Add(categoria);
                await _context.SaveChangesAsync();

                var categoriaDto = new CategoriaDto
                {
                    Id = categoria.Id,
                    Nombre = categoria.Nombre,
                    Descripcion = categoria.Descripcion,
                    Color = categoria.Color,
                    FechaCreacion = categoria.FechaCreacion,
                    Activo = categoria.Activo
                };

                _logger.LogInformation("Categoría creada exitosamente: {CategoriaId}", categoria.Id);

                return CreatedAtAction(nameof(GetCategoria), new { id = categoria.Id }, categoriaDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear categoría");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Actualiza una categoría existente
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCategoria(int id, ActualizarCategoriaDto actualizarCategoriaDto)
        {
            try
            {
                if (id != actualizarCategoriaDto.Id)
                    return BadRequest("El ID de la URL no coincide con el ID de la categoría");

                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (categoria == null)
                    return NotFound($"Categoría con ID {id} no encontrada");

                // Verificar si ya existe otra categoría con el mismo nombre (excluyendo la actual)
                var categoriaExistente = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id != id && 
                                           c.Nombre.ToLower() == actualizarCategoriaDto.Nombre.ToLower());

                if (categoriaExistente != null)
                    return BadRequest($"Ya existe otra categoría con el nombre '{actualizarCategoriaDto.Nombre}'");

                // Actualizar propiedades
                categoria.Nombre = actualizarCategoriaDto.Nombre.Trim();
                categoria.Descripcion = actualizarCategoriaDto.Descripcion?.Trim();
                categoria.Color = actualizarCategoriaDto.Color;
                categoria.Activo = actualizarCategoriaDto.Activo;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Categoría actualizada exitosamente: {CategoriaId}", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar categoría con ID {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Elimina lógicamente una categoría (soft delete)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCategoria(int id)
        {
            try
            {
                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (categoria == null)
                    return NotFound($"Categoría con ID {id} no encontrada");

                // Verificar si hay gastos asociados a esta categoría
                var gastosAsociados = await _context.Gastos
                    .AnyAsync(g => g.CategoriaId == id && g.Activo);

                if (gastosAsociados)
                    return BadRequest("No se puede eliminar la categoría porque tiene gastos asociados");

                // Soft delete
                categoria.Activo = false;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Categoría eliminada lógicamente: {CategoriaId}", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar categoría con ID {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Obtiene estadísticas de gastos por categoría
        /// </summary>
        [HttpGet("{id}/estadisticas")]
        public async Task<ActionResult<EstadisticaPorCategoriaDto>> GetEstadisticasCategoria(int id)
        {
            try
            {
                var categoria = await _context.Categorias
                    .FirstOrDefaultAsync(c => c.Id == id && c.Activo);

                if (categoria == null)
                    return NotFound($"Categoría con ID {id} no encontrada");

                var gastos = await _context.Gastos
                    .Where(g => g.CategoriaId == id && g.Activo)
                    .ToListAsync();

                var totalGastos = gastos.Sum(g => g.Monto);
                var totalGeneral = await _context.Gastos
                    .Where(g => g.Activo)
                    .SumAsync(g => g.Monto);

                var estadisticas = new EstadisticaPorCategoriaDto
                {
                    CategoriaId = categoria.Id,
                    NombreCategoria = categoria.Nombre,
                    ColorCategoria = categoria.Color,
                    TotalGastos = totalGastos,
                    CantidadGastos = gastos.Count,
                    PorcentajeDelTotal = totalGeneral > 0 ? (totalGastos / totalGeneral) * 100 : 0
                };

                return Ok(estadisticas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener estadísticas de categoría con ID {Id}", id);
                return StatusCode(500, "Error interno del servidor");
            }
        }

        /// <summary>
        /// Obtiene las categorías más utilizadas
        /// </summary>
        [HttpGet("mas-utilizadas")]
        public async Task<ActionResult<List<EstadisticaPorCategoriaDto>>> GetCategoriasMasUtilizadas(int top = 5)
        {
            try
            {
                var categoriasMasUtilizadas = await _context.Gastos
                    .Where(g => g.Activo)
                    .GroupBy(g => new { g.Categoria.Id, g.Categoria.Nombre, g.Categoria.Color })
                    .Select(g => new EstadisticaPorCategoriaDto
                    {
                        CategoriaId = g.Key.Id,
                        NombreCategoria = g.Key.Nombre,
                        ColorCategoria = g.Key.Color,
                        TotalGastos = g.Sum(x => x.Monto),
                        CantidadGastos = g.Count(),
                        PorcentajeDelTotal = 0 // Se calculará después
                    })
                    .OrderByDescending(x => x.CantidadGastos)
                    .Take(top)
                    .ToListAsync();

                // Calcular porcentajes del total
                var totalGeneral = await _context.Gastos
                    .Where(g => g.Activo)
                    .SumAsync(g => g.Monto);

                foreach (var categoria in categoriasMasUtilizadas)
                {
                    categoria.PorcentajeDelTotal = totalGeneral > 0 
                        ? (categoria.TotalGastos / totalGeneral) * 100 
                        : 0;
                }

                return Ok(categoriasMasUtilizadas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener categorías más utilizadas");
                return StatusCode(500, "Error interno del servidor");
            }
        }
    }
} 