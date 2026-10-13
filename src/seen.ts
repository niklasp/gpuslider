/**
 * How the page draws the slider. The boxes of the page are drawn boxes:
 * inside a parent that scales they are scaled, and that is read from
 * them. Inside a parent that turns they are the upright boxes around what
 * is turned, of another shape; then what is measured is measured as it is
 * laid out, in whole pixels.
 */

/**
 * @param root The slider.
 * @param box  Its box on the page.
 * @return Whether the page turns it: laid out in whole pixels, a
 *         scaled box has its shape to about a pixel.
 */
export const turned = ( root: HTMLElement, box: DOMRect ): boolean =>
	Math.abs( box.width * root.offsetHeight - box.height * root.offsetWidth ) >
	box.width + box.height;

/**
 * @param root The slider.
 * @return For an element in it: its box from where the padding of
 *         the slider begins, in its own pixels: x, y, width, height.
 */
export function placer( root: HTMLElement ): ( el: HTMLElement ) => number[] {
	const around = root.getBoundingClientRect();
	const scale = ( root.offsetWidth && around.width / root.offsetWidth ) || 1;
	return turned( root, around )
		? ( el ) => {
				const box = [ 0, 0, el.offsetWidth, el.offsetHeight ];
				for ( let at: HTMLElement | null = el; at && at !== root; at = at.offsetParent as HTMLElement | null ) {
					box[ 0 ] += at.offsetLeft;
					box[ 1 ] += at.offsetTop;
				}
				return box;
			}
		: ( el ) => {
				const r = el.getBoundingClientRect();
				return [
					( r.left - around.left ) / scale - root.clientLeft,
					( r.top - around.top ) / scale - root.clientTop,
					r.width / scale,
					r.height / scale,
				];
			};
}
