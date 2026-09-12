/**
 * Extracts one version's section from a CHANGELOG.md-shaped string, for use
 * as a release body. Follows CHANGELOG.md's house style: headings of the
 * form `## <version> - <YYYY-MM-DD>`, flat bullet lists, no link brackets.
 *
 * @param changelog full CHANGELOG.md contents
 * @param version bare version, e.g. "1.1.0" (no leading "v")
 * @returns the body of that version's section, trimmed
 */
export function extractReleaseNotes(changelog: string, version: string): string {
  const escapedVersion = version.replace(/\./g, '\\.');
  const headingPattern = new RegExp(`^##\\s+${escapedVersion}(?:\\s|$).*$`, 'm');
  const headingMatch = headingPattern.exec(changelog);
  if (!headingMatch) {
    throw new Error(`No CHANGELOG.md section found for version ${version}`);
  }

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const nextHeadingMatch = /^##\s+/m.exec(changelog.slice(sectionStart));
  const sectionEnd = nextHeadingMatch ? sectionStart + nextHeadingMatch.index : changelog.length;

  return changelog.slice(sectionStart, sectionEnd).trim();
}
