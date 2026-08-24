const { applicationDefault, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

async function updateAdminClaim() {
    const uid = String(process.argv[2] || '').trim();
    const remove = process.argv.includes('--remove');
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
        throw new Error('Usage: npm run admin:claim -- <firebase-uid> [--remove]');
    }
    if (getApps().length === 0) {
        initializeApp({ credential: applicationDefault() });
    }

    const auth = getAuth();
    const user = await auth.getUser(uid);
    const isVerifiedGoogleAccount = user.emailVerified
        && user.providerData.some((provider) => provider.providerId === 'google.com');
    if (!remove && !isVerifiedGoogleAccount) {
        throw new Error('The administrator must use a verified Google account');
    }

    const claims = { ...(user.customClaims || {}) };
    if (remove) delete claims.admin;
    else claims.admin = true;
    await auth.setCustomUserClaims(uid, claims);
    await auth.revokeRefreshTokens(uid);
    console.log(remove ? 'Administrator claim removed' : 'Administrator claim granted');
    console.log('The user must sign in again before opening the administration panel');
}

updateAdminClaim().catch((error) => {
    console.error('Administrator claim update failed:', error?.message || 'unknown error');
    process.exitCode = 1;
});
