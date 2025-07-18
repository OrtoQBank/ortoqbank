export function formatWeekString(
  weekString: string,
  format: 'short' | 'long' = 'short',
): string {
  const [year, weekStr] = weekString.split('-W');
  const weekNum = Number.parseInt(weekStr);

  const startOfYear = new Date(Number.parseInt(year), 0, 1);
  const daysToAdd = (weekNum - 1) * 7 - startOfYear.getDay();
  const weekStartDate = new Date(
    startOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
  );

  const day = weekStartDate.getDate().toString().padStart(2, '0');
  const month = (weekStartDate.getMonth() + 1).toString().padStart(2, '0');

  if (format === 'short') {
    const yearShort = weekStartDate.getFullYear().toString().slice(-2);
    return `${day}/${month}/${yearShort}`;
  } else {
    const yearFull = weekStartDate.getFullYear();
    return `Semana de ${day}/${month}/${yearFull}`;
  }
}
