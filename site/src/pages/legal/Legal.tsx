import '@/index.css';
import type { ReactNode } from 'react';
import { Footer, Nav, WIDTH } from '@/components/Frame';

/** A page of what the law asks for: plain text, as wide as it reads well. */
function Page( { title, children }: { title: string; children: ReactNode } ) {
	return (
		<>
			<Nav at="legal" />
			<main className={ `${ WIDTH } pb-32 pt-12 md:pt-20` }>
				<div className="max-w-2xl text-muted-foreground">
					<h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
						{ title }
					</h1>
					{ children }
				</div>
			</main>
			<Footer />
		</>
	);
}

export function Imprint() {
	return (
		<Page title="Imprint">
			<p className="mt-3">Information under § 5 DDG (Impressum).</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Provider</h2>
			<p className="mt-3">Niklas Jurij Plessing (eedee)<br />Luxemburger Straße 31<br />13353 Berlin<br />Germany</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Contact</h2>
			<p className="mt-3">Email: <a className="underline hover:text-foreground" href="mailto:niklas@eedee.net">niklas@eedee.net</a></p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Responsible for the content</h2>
			<p className="mt-3">Under § 18 (2) MStV: Niklas Jurij Plessing, address as above.</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Consumer dispute resolution</h2>
			<p className="mt-3">We are neither obliged nor willing to take part in dispute resolution proceedings before a consumer arbitration board.</p>
		</Page>
	);
}

export function Privacy() {
	return (
		<Page title="Privacy">
			<p className="mt-3">What happens with your data on gpuslider.com (Datenschutzerklärung).</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Who is responsible</h2>
			<p className="mt-3">The controller under the GDPR is Niklas Jurij Plessing (eedee), Luxemburger Straße 31, 13353 Berlin, Germany. Email: <a className="underline hover:text-foreground" href="mailto:niklas@eedee.net">niklas@eedee.net</a>.</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">In short</h2>
			<p className="mt-3">This site sets no cookies of its own and has no forms, comments or accounts. It counts visits with Cloudflare Web Analytics, which sets no cookies. Fonts, images, videos and scripts come from gpuslider.com; the only exception is Cloudflare's analytics script.</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Hosting and technical data</h2>
			<p className="mt-3">The site is served by Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA. To deliver a page, Cloudflare processes your IP address, the date and time, the page requested, the referring page, and your browser and operating system. This is needed to deliver the site and keep it secure (Art. 6 (1) (f) GDPR, our legitimate interest in a working and safe website). If Cloudflare's security checks need to verify a visitor, it may set a short-lived security cookie (cf_clearance), which is strictly necessary for that purpose (§ 25 (2) TDDDG). Cloudflare may process data in the USA; it takes part in the EU-U.S. Data Privacy Framework. We have a data processing agreement with Cloudflare (Art. 28 GDPR).</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Visit counting (Cloudflare Web Analytics)</h2>
			<p className="mt-3">We count visits with Cloudflare Web Analytics, so we can see which pages are read and where visitors come from. It sets no cookies and does not build profiles of visitors. It records things like the page address, the referring site, the browser type, the country and how fast the page loaded, and we only see them as totals. Our basis is our legitimate interest in understanding how the site is used (Art. 6 (1) (f) GDPR). You can object at any time (see below).</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Email</h2>
			<p className="mt-3">If you email us, we use your address and message to answer you (Art. 6 (1) (b) or (f) GDPR) and delete them when they are no longer needed, unless we have to keep them by law.</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Links to other sites</h2>
			<p className="mt-3">Links to npm, GitHub or gutenslider.org are plain links: nothing is loaded from those sites until you click one. Their own privacy policies apply there.</p>
			<h2 className="mt-10 text-xl font-semibold text-foreground">Your rights</h2>
			<p className="mt-3">You can ask for access to your data (Art. 15 GDPR), its correction (Art. 16), deletion (Art. 17), restricted processing (Art. 18) and a copy in a portable format (Art. 20), and you can object to processing based on our legitimate interests (Art. 21). Write to <a className="underline hover:text-foreground" href="mailto:niklas@eedee.net">niklas@eedee.net</a>. You also have the right to complain to a data protection supervisory authority (Art. 77 GDPR), for example the one where you live or the one responsible for us.</p>
			<p className="mt-3">Last updated: November 2026.</p>
		</Page>
	);
}
