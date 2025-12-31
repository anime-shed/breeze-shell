import * as shell from "mshell"

/**
 * Get a translated string by key using the unified i18n system.
 * @param key The translation key
 * @param params Optional interpolation parameters
 * @returns Translated string with placeholders replaced
 */
export const t = (key: string, params?: Record<string, string>): string => {
    // If params provided, use the C++ interpolation binding
    if (params && Object.keys(params).length > 0) {
        return shell.breeze.get_translation_with_params(key, params);
    }

    // Otherwise use simple translation lookup
    return shell.breeze.get_translation(key);
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
