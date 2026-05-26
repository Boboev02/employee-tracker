const fs = require('fs');
const home = require('os').homedir();
const be = home + '/employee-tracker/apps/backend/src';
const ext = home + '/employee-tracker/apps/extension/src';

// ─── 1. BACKEND: Add proper refresh token endpoint ───────────────

// auth.controller.ts — add new endpoint
let ctrl = fs.readFileSync(be + '/auth/auth.controller.ts', 'utf8');
ctrl = ctrl.replace(
  `  @Post('refresh')
  @HttpCode(200)
  async refresh(@CurrentUser() user: any) {
    const accessToken = this.tokens.generateAccessToken({
      sub: user.id ?? user.sub, email: user.email, orgId: user.orgId,
    });
    return { accessToken, expiresIn: 900 };
  }`,
  `  // Old refresh (requires valid access token)
  @Post('refresh')
  @HttpCode(200)
  async refresh(@CurrentUser() user: any) {
    const accessToken = this.tokens.generateAccessToken({
      sub: user.id ?? user.sub, email: user.email, orgId: user.orgId, roles: user.roles,
    });
    return { accessToken, expiresIn: 900 };
  }

  // New refresh (uses refresh token from body — for extension)
  @Public()
  @Post('refresh-token')
  @HttpCode(200)
  async refreshWithToken(@Body() body: { refreshToken: string }) {
    return this.auth.refreshWithToken(body.refreshToken);
  }`
);
fs.writeFileSync(be + '/auth/auth.controller.ts', ctrl);
console.log('✓ auth.controller.ts');

// auth.service.ts — add refreshWithToken method
let svc = fs.readFileSync(be + '/auth/auth.service.ts', 'utf8');
// Add import for UnauthorizedException if not there
if (!svc.includes('UnauthorizedException')) {
  svc = svc.replace(
    `import { Injectable,`,
    `import { Injectable, UnauthorizedException,`
  );
}

// Add method before last closing brace
svc = svc.replace(
  `  async logout(userId: string, token: string) {`,
  `  async refreshWithToken(refreshToken: string) {
    try {
      const payload = this.tokens.verifyRefreshToken(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { userRoles: { include: { role: true } } },
      });
      if (!user || user.deletedAt) throw new UnauthorizedException('Invalid token');
      const roles = user.userRoles.map(ur => ur.role.name);
      const accessToken = this.tokens.generateAccessToken({
        sub: user.id, email: user.email, orgId: user.orgId, roles,
      });
      const newRefreshToken = this.tokens.generateRefreshToken({
        sub: user.id, email: user.email, orgId: user.orgId, roles,
      });
      return { accessToken, refreshToken: newRefreshToken, expiresIn: 900 };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, token: string) {`
);
fs.writeFileSync(be + '/auth/auth.service.ts', svc);
console.log('✓ auth.service.ts');

// auth.service.ts — return refreshToken on login
let svc2 = fs.readFileSync(be + '/auth/auth.service.ts', 'utf8');
// Find login return and add refreshToken
svc2 = svc2.replace(
  `    return res.json(result);`,
  `    return res.json(result);` // login is in controller, check auth.service login method
);

// Fix login in auth.service to return refreshToken
svc2 = svc2.replace(
  /return \{[\s\n]*accessToken[^}]+\}/,
  (match) => {
    if (match.includes('refreshToken')) return match;
    return match.replace('}', ', refreshToken }');
  }
);
fs.writeFileSync(be + '/auth/auth.service.ts', svc2);
console.log('✓ auth.service.ts (login returns refreshToken)');

// ─── 2. EXTENSION: Store and use refresh token ────────────────────

// popup.ts — save refreshToken on login
let popup = fs.readFileSync(home + '/employee-tracker/apps/extension/popup/popup.ts', 'utf8');
popup = popup.replace(
  `await chrome.storage.local.set({et_auth:{accessToken:s.accessToken,signingKey:s.accessToken,userId:s.user.id,orgId:s.user.orgId,expiresAt:Date.now()+1e3*(s.expiresIn??900)}})`,
  `await chrome.storage.local.set({et_auth:{accessToken:s.accessToken,refreshToken:s.refreshToken,signingKey:s.accessToken,userId:s.user.id,orgId:s.user.orgId,expiresAt:Date.now()+1e3*(s.expiresIn??900)}})`
);
popup = popup.replace(
  `await chrome.storage.local.set({et_auth:{accessToken:s.accessToken, signingKey:s.accessToken, userId:s.user.id, orgId:s.user.orgId, expiresAt:Date.now()+1000*(s.expiresIn??900)}})`,
  `await chrome.storage.local.set({et_auth:{accessToken:s.accessToken, refreshToken:s.refreshToken, signingKey:s.accessToken, userId:s.user.id, orgId:s.user.orgId, expiresAt:Date.now()+1000*(s.expiresIn??900)}})`
);
fs.writeFileSync(home + '/employee-tracker/apps/extension/popup/popup.ts', popup);
console.log('✓ popup.ts');

// base-tracker.ts — use refreshToken properly
let bt = fs.readFileSync(ext + '/content/base-tracker.ts', 'utf8');
bt = bt.replace(
  `      if (auth.expiresAt - Date.now() < 120_000) {
        try {
          // Re-login with stored credentials if refresh fails
          const res = await fetch(API_BASE_URL + '/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + auth.accessToken 
            },
            body: JSON.stringify({ token: auth.accessToken }),
          });
          if (res.ok) {
            const data = await res.json();
            const newAuth = { ...auth, accessToken: data.accessToken, expiresAt: Date.now() + 900_000 };
            await new Promise<void>(r => chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATE]: newAuth }, r));
            return data.accessToken;
          } else {
            // Token expired - extend expiry to avoid dropping events
            // User needs to re-login in popup
            console.warn('[ET] Token expired, events will queue until re-login');
            return auth.accessToken; // try anyway, server will reject but buffer keeps events
          }
        } catch {}
      }`,
  `      if (auth.expiresAt - Date.now() < 120_000) {
        try {
          // Use refresh token if available (proper long-lived token)
          if (auth.refreshToken) {
            const res = await fetch(API_BASE_URL + '/api/v1/auth/refresh-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken: auth.refreshToken }),
            });
            if (res.ok) {
              const data = await res.json();
              const newAuth = {
                ...auth,
                accessToken:  data.accessToken,
                refreshToken: data.refreshToken ?? auth.refreshToken,
                expiresAt:    Date.now() + 900_000,
              };
              await new Promise<void>(r => chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATE]: newAuth }, r));
              return data.accessToken;
            } else {
              // Refresh token expired (7 days) — user must re-login
              console.warn('[ET] Session expired, please re-login in extension popup');
              await new Promise<void>(r => chrome.storage.local.remove(STORAGE_KEYS.AUTH_STATE, r));
              return null;
            }
          } else {
            // No refresh token (old session) — try with access token
            const res = await fetch(API_BASE_URL + '/api/v1/auth/refresh', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + auth.accessToken },
            });
            if (res.ok) {
              const data = await res.json();
              const newAuth = { ...auth, accessToken: data.accessToken, expiresAt: Date.now() + 900_000 };
              await new Promise<void>(r => chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATE]: newAuth }, r));
              return data.accessToken;
            }
          }
        } catch {}
      }`
);
fs.writeFileSync(ext + '/content/base-tracker.ts', bt);
console.log('✓ base-tracker.ts');

console.log('\n✅ Refresh token fix applied');
