using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace GastosBCN.DTOs
{
    /// <summary>
    /// DTO para crear una nueva categoría
    /// </summary>
    public class CrearCategoriaDto
    {
        [Required(ErrorMessage = "El nombre de la categoría es obligatorio")]
        [StringLength(100, ErrorMessage = "El nombre no puede exceder los 100 caracteres")]
        [Display(Name = "Nombre de la Categoría")]
        public string Nombre { get; set; } = string.Empty;

        [StringLength(500, ErrorMessage = "La descripción no puede exceder los 500 caracteres")]
        [Display(Name = "Descripción")]
        public string? Descripcion { get; set; }

        [Required(ErrorMessage = "El color es obligatorio")]
        [RegularExpression(@"^#[0-9A-Fa-f]{6}$", ErrorMessage = "El color debe estar en formato hexadecimal (#RRGGBB)")]
        [Display(Name = "Color")]
        public string Color { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO para actualizar una categoría existente
    /// </summary>
    public class ActualizarCategoriaDto
    {
        [Required(ErrorMessage = "El ID de la categoría es obligatorio")]
        [Display(Name = "ID de la Categoría")]
        public int Id { get; set; }

        [Required(ErrorMessage = "El nombre de la categoría es obligatorio")]
        [StringLength(100, ErrorMessage = "El nombre no puede exceder los 100 caracteres")]
        [Display(Name = "Nombre de la Categoría")]
        public string Nombre { get; set; } = string.Empty;

        [StringLength(500, ErrorMessage = "La descripción no puede exceder los 500 caracteres")]
        [Display(Name = "Descripción")]
        public string? Descripcion { get; set; }

        [Required(ErrorMessage = "El color es obligatorio")]
        [RegularExpression(@"^#[0-9A-Fa-f]{6}$", ErrorMessage = "El color debe estar en formato hexadecimal (#RRGGBB)")]
        [Display(Name = "Color")]
        public string Color { get; set; } = string.Empty;

        [Display(Name = "Activo")]
        public bool Activo { get; set; } = true;
    }

    /// <summary>
    /// DTO para crear un nuevo gasto
    /// </summary>
    public class CrearGastoDto
    {
        [Required(ErrorMessage = "El monto es obligatorio")]
        [Range(0.01, double.MaxValue, ErrorMessage = "El monto debe ser mayor a 0")]
        [Display(Name = "Monto (€)")]
        public decimal Monto { get; set; }

        [Required(ErrorMessage = "La descripción es obligatoria")]
        [StringLength(500, ErrorMessage = "La descripción no puede exceder los 500 caracteres")]
        [Display(Name = "Descripción del Gasto")]
        public string Descripcion { get; set; } = string.Empty;

        [Required(ErrorMessage = "La categoría es obligatoria")]
        [Display(Name = "Categoría")]
        public int CategoriaId { get; set; }

        [Required(ErrorMessage = "La persona es obligatoria")]
        [RegularExpression("^(Ana|Valen)$", ErrorMessage = "La persona debe ser 'Ana' o 'Valen'")]
        [Display(Name = "Persona")]
        public string Persona { get; set; } = string.Empty;

        [Display(Name = "Fecha del Gasto")]
        public DateTime? Fecha { get; set; } = DateTime.Now;
    }

    /// <summary>
    /// DTO para actualizar un gasto existente
    /// </summary>
    public class ActualizarGastoDto
    {
        [Required(ErrorMessage = "El ID del gasto es obligatorio")]
        [Display(Name = "ID del Gasto")]
        public int Id { get; set; }

        [Required(ErrorMessage = "El monto es obligatorio")]
        [Range(0.01, double.MaxValue, ErrorMessage = "El monto debe ser mayor a 0")]
        [Display(Name = "Monto (€)")]
        public decimal Monto { get; set; }

        [Required(ErrorMessage = "La descripción es obligatoria")]
        [StringLength(500, ErrorMessage = "La descripción no puede exceder los 500 caracteres")]
        [Display(Name = "Descripción del Gasto")]
        public string Descripcion { get; set; } = string.Empty;

        [Required(ErrorMessage = "La categoría es obligatoria")]
        [Display(Name = "Categoría")]
        public int CategoriaId { get; set; }

        [Required(ErrorMessage = "La persona es obligatoria")]
        [RegularExpression("^(Ana|Valen)$", ErrorMessage = "La persona debe ser 'Ana' o 'Valen'")]
        [Display(Name = "Persona")]
        public string Persona { get; set; } = string.Empty;

        [Display(Name = "Fecha del Gasto")]
        public DateTime Fecha { get; set; }

        [Display(Name = "Activo")]
        public bool Activo { get; set; } = true;
    }

    /// <summary>
    /// DTO para respuesta de categoría
    /// </summary>
    public class CategoriaDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string Color { get; set; } = string.Empty;
        public DateTime FechaCreacion { get; set; }
        public bool Activo { get; set; }
    }

    /// <summary>
    /// DTO para respuesta de gasto con información completa
    /// </summary>
    public class GastoDto
    {
        public int Id { get; set; }
        public decimal Monto { get; set; }
        public string Descripcion { get; set; } = string.Empty;
        public string Persona { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }
        public DateTime FechaCreacion { get; set; }
        public bool Activo { get; set; }
        public CategoriaDto Categoria { get; set; } = new();
    }

    /// <summary>
    /// DTO para filtros de búsqueda de gastos
    /// </summary>
    public class FiltroGastosDto
    {
        [Display(Name = "Persona")]
        public string? Persona { get; set; }

        [Display(Name = "Categoría")]
        public int? CategoriaId { get; set; }

        [Display(Name = "Fecha Desde")]
        public DateTime? FechaDesde { get; set; }

        [Display(Name = "Fecha Hasta")]
        public DateTime? FechaHasta { get; set; }

        [Display(Name = "Monto Mínimo")]
        [Range(0, double.MaxValue, ErrorMessage = "El monto mínimo debe ser mayor o igual a 0")]
        public decimal? MontoMinimo { get; set; }

        [Display(Name = "Monto Máximo")]
        [Range(0, double.MaxValue, ErrorMessage = "El monto máximo debe ser mayor o igual a 0")]
        public decimal? MontoMaximo { get; set; }

        [Display(Name = "Descripción")]
        public string? Descripcion { get; set; }

        [Display(Name = "Página")]
        [Range(1, int.MaxValue, ErrorMessage = "La página debe ser mayor a 0")]
        public int Pagina { get; set; } = 1;

        [Display(Name = "Elementos por Página")]
        [Range(1, 100, ErrorMessage = "Los elementos por página deben estar entre 1 y 100")]
        public int ElementosPorPagina { get; set; } = 20;
    }

    /// <summary>
    /// DTO para respuesta paginada
    /// </summary>
    public class RespuestaPaginadaDto<T>
    {
        public List<T> Elementos { get; set; } = new();
        public int TotalElementos { get; set; }
        public int PaginaActual { get; set; }
        public int ElementosPorPagina { get; set; }
        public int TotalPaginas { get; set; }
        public bool TienePaginaAnterior { get; set; }
        public bool TienePaginaSiguiente { get; set; }
    }

    /// <summary>
    /// DTO para estadísticas de gastos
    /// </summary>
    public class EstadisticasGastosDto
    {
        public decimal TotalGastos { get; set; }
        public int CantidadGastos { get; set; }
        public decimal PromedioGastos { get; set; }
        public decimal TotalGastosAna { get; set; }
        public decimal TotalGastosValen { get; set; }
        public List<EstadisticaPorCategoriaDto> GastosPorCategoria { get; set; } = new();
        public List<EstadisticaPorPersonaDto> GastosPorPersona { get; set; } = new();
    }

    /// <summary>
    /// DTO para estadísticas por categoría
    /// </summary>
    public class EstadisticaPorCategoriaDto
    {
        public int CategoriaId { get; set; }
        public string NombreCategoria { get; set; } = string.Empty;
        public string ColorCategoria { get; set; } = string.Empty;
        public decimal TotalGastos { get; set; }
        public int CantidadGastos { get; set; }
        public decimal PorcentajeDelTotal { get; set; }
    }

    /// <summary>
    /// DTO para estadísticas por persona
    /// </summary>
    public class EstadisticaPorPersonaDto
    {
        public string Persona { get; set; } = string.Empty;
        public decimal TotalGastos { get; set; }
        public int CantidadGastos { get; set; }
        public decimal PromedioGastos { get; set; }
        public decimal PorcentajeDelTotal { get; set; }
        public DateTime PrimerGasto { get; set; }
        public DateTime UltimoGasto { get; set; }
    }
} 