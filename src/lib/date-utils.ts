import { format, subDays, startOfWeek, subWeeks, startOfMonth, subMonths, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";

export interface FiltroFecha {
  bActual: boolean;
  FechaInicio: Date;
  FechaFin: Date;
  FechaTexto: string;
}

export function obtenerRangosDeFechas(criterio: string): FiltroFecha[] {
  const rangos: FiltroFecha[] = [];
  const hoy = new Date();

  switch (criterio) {
    case "Hoy": {
      const texto = format(hoy, "dd MMM", { locale: es }).toLowerCase();
      rangos.push({ bActual: true, FechaInicio: hoy, FechaFin: hoy, FechaTexto: texto });
      break;
    }

    case "Dia": {
      for (let i = 0; i < 30; i++) {
        const fecha = subDays(hoy, i);
        const texto = format(fecha, "dd MMM", { locale: es }).toLowerCase();
        rangos.push({ bActual: i === 0, FechaInicio: fecha, FechaFin: fecha, FechaTexto: texto });
      }
      break;
    }

    case "Semana": {
      let inicioSemana = startOfWeek(hoy, { weekStartsOn: 0 }); // Domingo
      for (let i = 0; i < 6; i++) {
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(finSemana.getDate() + 6);
        const texto =
          format(inicioSemana, "dd MMM", { locale: es }) +
          "-" +
          format(finSemana, "dd MMM", { locale: es });
        rangos.push({
          bActual: i === 0,
          FechaInicio: inicioSemana,
          FechaFin: finSemana,
          FechaTexto: texto.toLowerCase(),
        });
        inicioSemana = subWeeks(inicioSemana, 1);
      }
      break;
    }

    case "Mes": {
      const mesActual = startOfMonth(hoy);
      for (let i = 0; i < 6; i++) {
        const inicioMes = subMonths(mesActual, i);
        const finMes = endOfMonth(inicioMes);
        const texto = format(inicioMes, "MMM yy", { locale: es });
        rangos.push({
          bActual: i === 0,
          FechaInicio: inicioMes,
          FechaFin: finMes,
          FechaTexto: texto.toLowerCase(),
        });
      }
      break;
    }

    case "Ano": {
      const añoActual = hoy.getFullYear();
      for (let i = 0; i < 3; i++) {
        const año = añoActual - i;
        const inicioAño = startOfYear(new Date(año, 0, 1));
        const finAño = endOfYear(new Date(año, 0, 1));
        const texto = format(inicioAño, "yyyy");
        rangos.push({
          bActual: i === 0,
          FechaInicio: inicioAño,
          FechaFin: finAño,
          FechaTexto: texto.toLowerCase(),
        });
      }
      break;
    }

    default:
      throw new Error(`Criterio no válido: ${criterio}. Usa: 'Hoy', 'Dia', 'Semana', 'Mes', 'Ano'.`);
  }

  return rangos;
}