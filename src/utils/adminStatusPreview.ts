export const ADMIN_STATUS_PREVIEW_MODE = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('adminStatusPreview') === '1';
