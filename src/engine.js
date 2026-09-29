/**
 * The motion: one position, its velocity and a spring that pulls it to a
 * target.
 *
 * The spring is critically damped and solved exactly for each frame's
 * duration, so the move looks the same at 30 and at 120 frames per second
 * and cannot overshoot or explode.
 *
 * With an easing curve a move to a slide is not the spring but the curve,
 * in the time of a move; a drag that is let go is the spring all the same,
 * as it has a speed to go on with.
 *
 * Frames are requested only while something changes. At rest the engine
 * does nothing at all.
 *
 * @typedef {Object} Motion
 * @property {number}  pos      Position, px.
 * @property {number}  target   Where the spring pulls to.
 * @property {number}  vel      Velocity, px per second.
 * @property {number}  smooth   Velocity with the jitter filtered out, for
 *                              effects.
 * @property {boolean} dragging A pointer holds the position.
 */

// The spring has covered 99.9% of the way after about 9 / omega seconds;
// what is left of a slide then is less than a pixel.
const SETTLE = 9;

// How fast `smooth` follows `vel`, per second.
const FOLLOW = 10;

/**
 * @param {Window}   win              The slider's window.
 * @param {Object}   handlers         Callbacks.
 * @param {Function} handlers.frame   Called on every frame with the motion,
 *                                    the seconds since the last frame and
 *                                    the time.
 * @param {Function} handlers.settle  Called when the position has arrived.
 * @param {Function} [handlers.busy]  Whether something else needs frames.
 */
export function createEngine( win, { frame, settle, busy } ) {
	/** @type {Motion} */
	const motion = { pos: 0, target: 0, vel: 0, smooth: 0, dragging: false };
	let omega = SETTLE / 0.6;
	let time = 600;
	let curve = null;
	// The move along the curve: where from, and since when.
	let eased = null;
	let request = 0;
	let last = 0;
	let before = 0;
	let moving = false;
	// How far it was pushed since the last frame.
	let pushed = 0;

	const tick = ( now ) => {
		request = 0;
		let dt = ( now - last ) / 1000;
		// The first frame after a rest, or after the tab was hidden.
		if ( ! ( dt > 0 ) || dt > 0.05 ) {
			dt = 1 / 60;
		}
		last = now;

		if ( motion.dragging ) {
			motion.vel = ( motion.pos - before ) / dt;
		} else if ( eased ) {
			eased.since ??= now - dt * 1000;
			const u = Math.min( 1, ( now - eased.since ) / time );
			motion.pos =
				eased.from + ( motion.target - eased.from ) * curve( u );
			motion.vel = ( motion.pos - before ) / dt;
			if ( u === 1 ) {
				motion.pos = motion.target;
				motion.vel = 0;
				eased = null;
			}
		} else if ( motion.pos !== motion.target || motion.vel !== 0 ) {
			const a = motion.pos - motion.target;
			const b = motion.vel + omega * a;
			const e = Math.exp( -omega * dt );
			motion.pos = motion.target + ( a + b * dt ) * e;
			motion.vel = ( b - omega * ( a + b * dt ) ) * e;
			if (
				Math.abs( motion.pos - motion.target ) < 0.05 &&
				Math.abs( motion.vel ) < 3
			) {
				motion.pos = motion.target;
				motion.vel = 0;
			}
		}
		before = motion.pos;

		const vel = motion.vel + pushed / dt;
		pushed = 0;
		motion.smooth +=
			( vel - motion.smooth ) * ( 1 - Math.exp( -FOLLOW * dt ) );
		if ( vel === 0 && Math.abs( motion.smooth ) < 1 ) {
			motion.smooth = 0;
		}

		const arrived =
			! motion.dragging &&
			motion.pos === motion.target &&
			motion.vel === 0;
		if ( arrived && moving ) {
			moving = false;
			settle( motion );
		}
		frame( motion, dt, now );

		if ( ! arrived || motion.smooth !== 0 || busy?.() ) {
			wake();
		}
	};

	/** Requests a frame, unless one is on its way. */
	function wake() {
		if ( ! request ) {
			if ( ! last || win.performance.now() - last > 50 ) {
				last = win.performance.now();
			}
			request = win.requestAnimationFrame( tick );
		}
	}

	return {
		motion,
		wake,

		/** @return {boolean} Nothing moves and no frame is on its way. */
		resting: () => ! request,

		/**
		 * @param {number} ms Time a move takes, in milliseconds.
		 */
		duration( ms ) {
			time = Math.max( 1, ms );
			omega = SETTLE / ( time / 1000 );
		},

		/**
		 * @param {((u: number) => number) | null} to Easing curve of a move,
		 *        from 0 to 1 in its time; null for the spring.
		 */
		ease( to ) {
			curve = to;
		},

		/**
		 * Moves to a position.
		 *
		 * @param {number}  target  Position.
		 * @param {boolean} instant Jump instead of moving.
		 */
		to( target, instant ) {
			// The same move, asked again: it goes on as it was.
			if ( ! eased || instant || target !== motion.target ) {
				eased =
					curve && ! instant && ! motion.dragging && motion.pos !== target
						? { from: motion.pos }
						: null;
			}
			motion.target = target;
			if ( instant ) {
				motion.pos = target;
				motion.vel = 0;
			}
			moving = true;
			wake();
		},

		/**
		 * Shifts everything by a distance. The speed of the slider does not
		 * know of it, unless it is a push: so the position is brought back
		 * into the first round of a loop without anyone seeing it.
		 *
		 * @param {number}  by     Distance.
		 * @param {boolean} [push] Whether it counts as speed.
		 */
		shift( by, push ) {
			motion.pos += by;
			motion.target += by;
			before += by;
			if ( eased ) {
				eased.from += by;
			}
			if ( push ) {
				pushed += by;
			}
		},

		/** A pointer takes the position. */
		grab() {
			eased = null;
			motion.dragging = true;
			motion.vel = 0;
			before = motion.pos;
			moving = true;
			wake();
		},

		/**
		 * The pointer moved.
		 *
		 * @param {number} pos Position.
		 */
		drag( pos ) {
			motion.pos = pos;
			wake();
		},

		/**
		 * The pointer let go.
		 *
		 * @param {number} vel    Velocity of the pointer, px per second.
		 * @param {number} target Where to come to rest.
		 */
		release( vel, target ) {
			motion.dragging = false;
			motion.vel = vel;
			motion.target = target;
			wake();
		},

		destroy() {
			win.cancelAnimationFrame( request );
			request = 0;
		},
	};
}
