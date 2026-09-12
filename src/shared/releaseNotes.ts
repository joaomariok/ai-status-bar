/**
 * Extracts one version's section from a CHANGELOG.md-shaped string, for use
 * as a release body. Follows CHANGELOG.md's house style: headings of the
 * form `## <version> - <YYYY-MM-DD>`, flat bullet lists, no link brackets.
 *
 * @param changelog full CHANGELOG.md contents
 * @param version bare version, e.g. "1.1.0" (no leading "v")
 * @returns the body of that version's section, trimmed
 */
function isHeadingLine(line: string): boolean {
  return /^##\s/.test(line.replace(/\r$/, ''));
}

/**
 * True when `line` is a `##` heading for exactly `version`: after the `##`
 * marker and its following whitespace, the rest of the line is `version`
 * itself, or `version` followed by a whitespace character. Compares plain
 * strings — `version` is never interpreted as a pattern. A trailing `\r`
 * (CRLF changelogs) is ignored.
 */
function isHeadingFor(line: string, version: string): boolean {
  const match = /^##\s+(.*)$/.exec(line.replace(/\r$/, ''));
  if (!match) {
    return false;
  }
  const rest = match[1];
  if (rest === version) {
    return true;
  }
  return rest.startsWith(version) && /\s/.test(rest.charAt(version.length));
}

export function extractReleaseNotes(
  changelog: string,
  version: string,
): string {
  const lines = changelog.split('\n');
  let offset = 0;
  let sectionStart = -1;
  let sectionEnd = changelog.length;

  for (const line of lines) {
    const lineEnd = offset + line.length;
    if (sectionStart === -1) {
      if (isHeadingFor(line, version)) {
        sectionStart = lineEnd;
      }
    } else if (isHeadingLine(line)) {
      sectionEnd = offset;
      break;
    }
    offset = lineEnd + 1; // account for the '\n' removed by split
  }

  if (sectionStart === -1) {
    throw new Error(`No CHANGELOG.md section found for version ${version}`);
  }

  return changelog.slice(sectionStart, sectionEnd).trim();
}
