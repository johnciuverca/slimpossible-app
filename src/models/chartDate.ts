/** Formats an ISO date for display in weight charts without timezone conversion. */
export const formatChartDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-')
  return `${day}.${month}.${year}`
}
