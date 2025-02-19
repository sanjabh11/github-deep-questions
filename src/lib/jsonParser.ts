/**
 * Utility functions for parsing and validating JSON responses
 * Version: 2.0
 */

/**
 * Extracts a JSON object from text that may contain markdown or other formatting
 */
export function extractJson(text: string): string {
    // First try: direct JSON parse
    try {
        JSON.parse(text);
        return text;
    } catch (e) {
        // If direct parse fails, try to extract JSON
        console.log('Direct parse failed, trying to extract JSON');
    }

    // Remove markdown and get the JSON content
    let cleaned = text;
    
    // Step 1: If text contains markdown code blocks, extract content
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1];
        console.log('Extracted from code block:', cleaned);
    }

    // Step 2: Find JSON-like content
    const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
        cleaned = jsonMatch[1];
        console.log('Extracted JSON-like content:', cleaned);
    }

    // Step 3: Clean up the extracted content
    cleaned = cleaned
        .replace(/\\"/g, '"')          // Fix escaped quotes
        .replace(/\s+/g, ' ')          // Normalize whitespace
        .replace(/"\s+:/g, '":')       // Fix spacing before colons
        .replace(/:\s+"/g, ':"')       // Fix spacing after colons
        .replace(/,\s+}/g, '}')        // Fix trailing commas
        .replace(/,\s+]/g, ']')        // Fix trailing commas in arrays
        .trim();

    // Validate the cleaned JSON
    try {
        JSON.parse(cleaned);
        return cleaned;
    } catch (e) {
        console.error('Failed to parse cleaned JSON:', e);
        console.error('Cleaned text that failed:', cleaned);
        throw new Error('Could not extract valid JSON');
    }
}

/**
 * Validates that an object has the required array fields
 */
export function validateArrayFields<T extends object>(
    obj: T,
    fields: string[],
    defaultValue: any[] = []
): T {
    const validated = { ...obj };
    for (const field of fields) {
        if (!Array.isArray(validated[field])) {
            console.log(`Field ${field} is not an array, setting default:`, defaultValue);
            validated[field] = defaultValue;
        }
    }
    return validated;
}
