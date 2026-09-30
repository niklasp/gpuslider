/**
 * The stories of the journal. They are made up; the photos are from
 * Pexels (see `media.ts`), and `n` is the place of one in `image()`.
 * All of them happen in one night, between eight and two.
 */
export type Story = {
	slug: string;
	n: number;
	/** The number of the photo on pexels.com/photo/. */
	pexels: number;
	title: string;
	/** What it is about, in a sentence: under the title, and for search. */
	about: string;
	/** Where the photo was taken. */
	place: string;
	/** When, as hours and minutes of the night. */
	time: string;
	/** What lit the people in it. */
	lit: string;
	/** Something said by someone in it, in the middle of the story. */
	said: { text: string; by: string };
	text: string[];
};

export const STORIES: Story[] = [
	{
		slug: 'laser-set',
		n: 2,
		pexels: 18671362,
		title: 'The laser set',
		about: 'A guitarist who plays with his back to the lights, and a room that watches the rays instead of him.',
		place: 'A basement club, Leipzig',
		time: '00:40',
		lit: 'Green lasers through haze',
		said: {
			text: 'I stand where the light starts. That is the best seat in the house.',
			by: 'The guitarist',
		},
		text: [
			'He asked for the haze machine to be turned up until the front row could not see him. What they saw was the light: green lines that started behind his shoulders and ended somewhere over the bar.',
			'The club is a cellar that was a coal store once, low enough that the tall ones duck under the pipes. The lasers came from a friend who builds them in a garage, and who stood by the desk all night with his hand over the switch, as if they might get away.',
			'The songs were quiet ones. Every time he changed a chord the lasers moved a few degrees, and the room moved with them, heads tilting to follow a line that was no longer there.',
			'Afterwards someone asked him why he hides.',
			'Nobody filmed much. It is hard to film haze; the phones saw a grey fog with a man-shaped hole in it, and put them away again.',
			'At the end the haze machine was turned off first. For a minute the lines hung in what was left of it, thinner and thinner, until there was only a guitarist in a cellar, bowing, a little surprised to be seen.',
		],
	},
	{
		slug: 'between-the-letters',
		n: 1,
		pexels: 6835833,
		title: 'Between the letters',
		about: 'A sign shop at closing time, and the one customer who came to stand inside the words.',
		place: 'A neon workshop, Lisbon',
		time: '20:40',
		lit: 'New signs, switched on once',
		said: {
			text: 'A sign is only finished when someone has stood in its light and not read it.',
			by: 'The owner of the shop',
		},
		text: [
			'The shop bends glass tubes into words for bars that have not opened yet. At the end of the day the finished ones hang from the ceiling and are switched on once, to see if they hold.',
			'It takes a day to bend a word. The glass is heated over a ribbon of flame until it sags, then turned by hand against a drawing on the bench, backwards, because the letters are read from the other side.',
			'She comes by on those evenings and stands between them. Half a word on one side, half of another on the other, none of it meant for her.',
			'The owner lets her. He says she is the test the gas cannot do.',
			'Tonight there were three: the name of a café, the word open in a script nobody will be able to read from the street, and a heart for a bar that has not decided what it is called.',
			'She stood under the heart for longest. Then the switch went off, the tubes ticked as they cooled, and she said goodnight to the room as if there were someone else in it.',
		],
	},
	{
		slug: 'last-credit',
		n: 4,
		pexels: 5767690,
		title: 'Last credit',
		about: 'Two regulars, one machine, and the hour before the arcade turns its screens off.',
		place: 'An arcade, Osaka',
		time: '23:40',
		lit: 'The screens of the cabinets',
		said: {
			text: 'We could finish it. We just like it better when it is still ahead of us.',
			by: 'One of the two',
		},
		text: [
			'At eleven the arcade dims the ceiling and leaves the screens on. For an hour the room is lit only by the games, each in its own colour.',
			'The attendant does a last round with a cloth, wiping the buttons, and knows everyone who is still there by the game they play rather than by name.',
			'They play the same machine every week, one player each, and have never finished it. They do not want to; the last level is said to be dull.',
			'The machine is older than both of them. Its screen has a shadow burnt into it, the score of someone from long ago, and they play through it without seeing it any more.',
			'At twenty to twelve they stopped for the photo, still in the glow of the continue screen, the countdown running behind them from nine.',
			'When the screens go dark they stay a minute longer in the violet the cabinets leave behind, and then walk home by the light of the street.',
		],
	},
	{
		slug: 'storm-indoors',
		n: 5,
		pexels: 11584969,
		title: 'A storm, indoors',
		about: 'A projector, a white shirt and a dark room: weather you can switch off.',
		place: 'A photo studio, Glasgow',
		time: '23:15',
		lit: 'A projector and a film of a storm',
		said: {
			text: 'Move, and the weather slides off you. Hold still, and it stays.',
			by: 'The woman in the white shirt',
		},
		text: [
			'The film was of a storm over the sea, and the screen was her. Lightning ran down a sleeve, rain fell across a collar, and none of it was wet.',
			'Outside, the real weather was doing very little: a fine rain that did not make a sound on the skylight. Inside, the projector hummed and the room was very dark around one bright white shirt.',
			'The trick is to stand still.',
			'The photographer waited for the lightning. It came every forty seconds or so, never where it had been, and she pressed the shutter by the sound of the film rather than by what she saw, a half second early each time.',
			'Between the flashes the sea on the shirt was almost black, a slow roll of it from shoulder to hip, and it was easy to forget there was a person under it.',
			'At the end the projector clicks off and the storm stops at once, which no storm has ever done.',
		],
	},
	{
		slug: 'lost-in-red',
		n: 3,
		pexels: 11439378,
		title: 'Lost, in red',
		about: 'Words that land on a face, and are read differently there.',
		place: 'A square, Marseille',
		time: '01:50',
		lit: 'A projection meant for the wall behind',
		said: {
			text: 'I would rather not know which word it was.',
			by: 'The man in the projection',
		},
		text: [
			'On a wall the word is a sign. On a face it becomes a mood, and people who pass stop to decide whose.',
			'The projection was part of a festival of light that had officially ended an hour before. Someone had forgotten to switch off the last projector, and it went on throwing a poem, one red word at a time, onto the front of the old post office.',
			'He stepped into it by chance, on his way across the square, and the photographer asked him to stay.',
			'He stood there for the length of the poem, which was longer than either of them expected. The words came and went over his eyes and mouth, too big to read and too close to ignore.',
			'Two people at the café on the corner started guessing what he was thinking. They agreed it was something sad, and then that it was something he had not said yet.',
			'He never read what was written on him.',
		],
	},
	{
		slug: 'blue-hour',
		n: 8,
		pexels: 39688121,
		title: 'Blue hour',
		about: 'A stripe of warm light that finds its way into a blue room, and a laugh caught in it.',
		place: 'A flat, Copenhagen',
		time: '21:05',
		lit: 'Dusk from a window, a kitchen from a door',
		said: {
			text: 'Half of me is evening and half of me is dinner.',
			by: 'The woman in the stripe',
		},
		text: [
			'The room is lit blue from the window side and warm from a door left open. Between them there is one line where the two meet.',
			'In June it stays light until late here, and the blue hour is long: an hour and more when the sky outside is brighter than anything in the flat, and every lamp looks yellow against it.',
			'Stand in the line and half of you is evening, half of you is kitchen. It is hard not to laugh at that.',
			'Someone in the kitchen was frying onions, and asked through the door what was so funny. Nobody could explain it well enough to be heard over the pan.',
			'The photo was taken with the camera on a stack of books, because nobody wanted to move and lose the line.',
			'The door was closed a minute later, and the room was only blue again.',
		],
	},
	{
		slug: 'sound-check',
		n: 6,
		pexels: 8112576,
		title: 'Sound check',
		about: 'A boombox on the pavement, the neon over it, and a street that is a stage for one song.',
		place: 'A side street, Hong Kong',
		time: '22:15',
		lit: 'Shop signs, and one speaker',
		said: {
			text: 'I turn it up until the street answers. Then I know it is loud enough.',
			by: 'The man with the boombox',
		},
		text: [
			'He sets it down under the signs, kneels, and turns it up one notch at a time until the street answers from the other side.',
			'The street is narrow and the signs lean over it from both sides, so that at night it is roofed with light: a noodle bar in pink, a pharmacy in green, a mahjong parlour whose sign has lost two of its letters and kept its glow.',
			'He plays one song a night, never the same one, and never says which it will be.',
			'Nobody gathers. People walk slower, that is all, for the length of one song. A delivery rider stopped at the corner and did not get off his bike until it was over.',
			'The boombox is from a flea market and needs eight batteries. He says they last for about forty songs, which he thinks is a fair number for anything.',
			'Then he turns it off, and the signs keep humming as if they had been part of it.',
		],
	},
];

/** A story's minutes after eight in the evening, for its place in the night. */
export const minutesIn = ( time: string ) => {
	const [ h, m ] = time.split( ':' ).map( Number );
	return ( ( h + 24 - 20 ) % 24 ) * 60 + m;
};
