/** Letters and spaces only, so an ampersand in a couple's name never becomes an initial. */
export function initialsName(name: string) {
  return name.replace(/[^\p{L}\s]/gu, ' ')
}
