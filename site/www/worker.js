/**
 * www.gpuslider.com: the same address without www, for good (301), so
 * that the site has one address and search engines one page for each.
 */
export default {
	fetch( request ) {
		const url = new URL( request.url );
		url.hostname = 'gpuslider.com';
		return Response.redirect( url.toString(), 301 );
	},
};
