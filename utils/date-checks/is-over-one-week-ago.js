/**
 * Checks if the provided date is over one week ago from the current time.
 * @param {Date} lastSentDate - The date to compare.
 * @returns {boolean} True if the provided date is over one week ago from the current time, false otherwise.
 */
export const isOverOneWeekAgo = (lastSentDate) => {
  if (!(lastSentDate instanceof Date)) {
    throw new TypeError('Parameter "lastSentDate" must be an instance of Date.');
  }

  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
  return (Date.now() - lastSentDate.getTime()) > oneWeekInMs;
}
