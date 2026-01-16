/**
 * AST Utilities
 * 
 * This module contains utility functions for working with OfficeParserAST objects.
 */

import { OfficeParserAST, OfficeContentNode, OfficeParserConfig } from '../office/types';

/**
 * Converts an OfficeParserAST to plain text.
 * 
 * This function flattens the document structure and returns just the text content,
 * stripping out all formatting, metadata, and structure.
 * 
 * The text is concatenated using the delimiter specified (default: '\n').
 * 
 * @param ast - The AST to convert to text
 * @param delimiter - The delimiter to use for newlines (default: '\n')
 * @returns A plain text representation of the document
 * 
 * @example
 * ```typescript
 * const text = astToText(ast);
 * console.log(text); // "Hello world\nChapter 1\n..."
 * ```
 */
export const astToText = (ast: OfficeParserAST, delimiter: string = '\n'): string => {
    /**
     * Recursive function to extract text from content nodes
     */
    const getText = (node: OfficeContentNode): string => {
        let text = '';
        if (node.children) {
            text += node.children
                .map(getText)
                .filter(t => t !== '')
                .join(!node.children[0]?.children ? '' : delimiter);
        } else {
            text += node.text || '';
        }
        return text;
    };

    return ast.content
        .map(getText)
        .filter(t => t !== '')
        .join(delimiter);
};
