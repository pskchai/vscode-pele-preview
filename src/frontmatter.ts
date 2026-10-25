
const COMMENT_REGEX = /^\s*%%(?!{)[^\n]+\n?/gm;
const DIRECTIVE_REGEX = /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi;
const FIRST_WORD_REGEX = /^\s*(\w+)/;
const DIAGRAM_KEYWORD_REGEX = /^\s*([\w-]+)/;

export function splitFrontMatter(text: string) {
    // Normalize line endings and trim the text
    const normalizedText = text.replace(/\r\n?/g, '\n').trim();
    
    // More flexible regex that handles indentation before front matter
    const frontMatterRegex = /^\s*-{3}[\s\S]*?[\n\r]\s*-{3}/;
    
    const matches = normalizedText.match(frontMatterRegex);
    
    if (!matches) {
        return {
            diagramText: normalizedText,
            frontMatter: '',
        };
    }

    const frontMatter = matches[0]
        .replace(/^\s*---/, '') // Remove opening dashes with any preceding whitespace
        .replace(/\s*---$/, '') // Remove closing dashes with any trailing whitespace
        .trim();

    return {
        diagramText: normalizedText.slice(matches[0].length).trim(),
        frontMatter: frontMatter,
    };
}

const cleanupText = (code: string) => {
  return (
    code
      // parser problems on CRLF ignore all CR and leave LF;;
      .replace(/\r\n?/g, '\n')
      // clean up html tags so that all attributes use single quotes, parser throws error on double quotes
      .replace(
        /<(\w+)([^>]*)>/g,
        (match, tag, attributes) => '<' + tag + attributes.replace(/="([^"]*)"/g, "='$1'") + '>'
      )
  );
};


/**
 * Removes Mermaid-specific directives enclosed in `%%{ ... }%%`.
 * 
 * @param text - The diagram text.
 * @returns The text with directives removed.
 */
export const removeDirectives = function (text: string): string {
  return text.replace(DIRECTIVE_REGEX, '');
};

/**
 * Remove all lines starting with `%%` from the text that don't contain a `%%{`
 * @param text - The text to remove comments from
 * @returns cleaned text
 */
export const cleanupComments = (text: string): string => {
  return text.replace(COMMENT_REGEX, '').trimStart();
};


/**
 * Extracts the first word from a Mermaid diagram after cleaning directives and comments.
 * 
 * @param text - The raw Mermaid diagram text.
 * @returns The first word in lowercase, or an empty string if not found.
 */
export function getFirstWordFromDiagram(text: string): string {
  // Callers use this to look up tmLanguage files, which are keyed without the suffix,
  // so `stateDiagram-v2` has to keep resolving to `statediagram`.
  const match = getDiagramKeyword(text).match(FIRST_WORD_REGEX);
  return match ? match[1] : '';
}

/**
 * Extracts the leading diagram keyword, keeping any suffix, after cleaning directives and
 * comments. Unlike {@link getFirstWordFromDiagram} this tells `stateDiagram-v2` apart from
 * `stateDiagram`, which mermaid reports as two different diagram types.
 *
 * @param text - The raw Mermaid diagram text.
 * @returns The keyword in lowercase, or an empty string if not found.
 */
export function getDiagramKeyword(text: string): string {
  const cleanedCode = cleanupText(text);
  const { diagramText } = splitFrontMatter(cleanedCode); // Extract diagram text

  const directiveResult = removeDirectives(diagramText);
  const code = cleanupComments(directiveResult);

  const match = code.match(DIAGRAM_KEYWORD_REGEX);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Normalizes Mermaid diagram text by properly formatting the front matter and content.
 * @param code The original diagram code.
 * @returns The normalized diagram code.
 */
export function normalizeMermaidText(code: string): string {
  const { diagramText, frontMatter } = splitFrontMatter(code);
  
  if (!frontMatter) {
    return diagramText;
  }

  // Reconstruct the text with proper formatting
  return `---\n${frontMatter.trim()}\n---\n${diagramText}`;
}
