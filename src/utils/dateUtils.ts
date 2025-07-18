import { format,setISOWeek, setYear, startOfISOWeek } from 'date-fns';

export function formatWeekString(
  weekString: string,
  formatType: 'short' | 'long' = 'short',
): string {
  // Parse ISO week string (YYYY-Www format)
  const [year, weekStr] = weekString.split('-W');
  const yearNum = Number.parseInt(year);
  const weekNum = Number.parseInt(weekStr);

  // Create a date for the given ISO week
  // Start with January 1st of the year, then set the ISO week
  let date = setYear(new Date(), yearNum);
  date = setISOWeek(date, weekNum);

  // Get the start of the ISO week (Monday)
  const weekStartDate = startOfISOWeek(date);

  return formatType === 'short' ? format(weekStartDate, 'dd/MM/yy') : `Semana de ${format(weekStartDate, 'dd/MM/yyyy')}`;
}
