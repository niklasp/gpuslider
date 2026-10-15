/**
 * The license key that unlocks Pro (see `plan.ts`), and where this browser
 * keeps it.
 *
 * There is no payment provider yet, so `check()` unlocks nothing that is
 * real: it says yes to one key only, `DEV_KEY`, and only where the page
 * runs on this machine (localhost), for working on the Pro path and for
 * its test. Everywhere else every key is refused.
 *
 * TODO: once a provider is chosen, `check()` asks it (its license API, or
 * a Worker of the site that does) whether the key is a key of Pro, and
 * nothing else here changes.
 */

/** The key that unlocks Pro on localhost, and nowhere else. */
export const DEV_KEY = 'GPUSLIDER-DEV-PRO';

const KEPT = 'gs-studio-license';

const local = () =>
	typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test( location.hostname );

/**
 * @param key A license key, as it was entered.
 * @return Whether it unlocks Pro.
 */
export async function check( key: string ): Promise< boolean > {
	return local() && key.trim() === DEV_KEY;
}

/** @return The key this browser keeps, if any. */
export function kept(): string | null {
	try {
		return localStorage.getItem( KEPT );
	} catch {
		return null;
	}
}

/** @param key Keeps it in this browser; null lets go of it. */
export function keep( key: string | null ) {
	try {
		if ( key ) {
			localStorage.setItem( KEPT, key.trim() );
		} else {
			localStorage.removeItem( KEPT );
		}
	} catch {}
}
