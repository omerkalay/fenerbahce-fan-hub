const DEFAULT_SIGN_IN_ERROR_MESSAGE = 'Google girişi başlatılamadı. Lütfen tekrar dene.';

export const getSignInErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return DEFAULT_SIGN_IN_ERROR_MESSAGE;
};
