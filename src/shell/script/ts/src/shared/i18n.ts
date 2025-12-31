import * as shell from "mshell"

/**
 * Get a translated string by key using the unified i18n system.
 * @param key The translation key
 * @param params Optional interpolation parameters
 * @returns Translated string with placeholders replaced
 */
export const t = (key: string, params?: Record<string, string>): string => {
    // Get the translation from the unified i18n system
    const translation = shell.breeze.get_translation(key);

    // If params provided, perform local interpolation
    if (params && Object.keys(params).length > 0) {
        return translation.replace(/{(\w+)}/g, (match, k) => {
            return params.hasOwnProperty(k) ? params[k] : match;
        });
    }

    return translation;
};

/**
 * Check if current language is RTL.
 */
export const isRTL = (): boolean => {
    return shell.breeze.is_rtl();
};

/**
 * Get current language code from unified system.
 */
export const currentLanguage = (): string => {
    return shell.breeze.user_language();
};
