/**
 * The stories of the journal. They are made up; the photos are from
 * Pexels (see `media.ts`), and `n` is the place of one in `image()`.
 */
export type Story = {
	slug: string;
	n: number;
	/** The number of the photo on pexels.com/photo/. */
	pexels: number;
	title: string;
	/** What it is about, in a sentence: under the title, and for search. */
	about: string;
	text: string[];
};

export const STORIES: Story[] = [
	{
		slug: 'laser-set',
		n: 2,
		pexels: 18671362,
		title: 'The laser set',
		about: 'A guitarist who plays with his back to the lights, and a room that watches the rays instead of him.',
		text: [
			'He asked for the haze machine to be turned up until the front row could not see him. What they saw was the light: green lines that started behind his shoulders and ended somewhere over the bar.',
			'The songs were quiet ones. Every time he changed a chord the lasers moved a few degrees, and the room moved with them, heads tilting to follow a line that was no longer there.',
			'Afterwards someone asked him why he hides. He said he does not; he stands where the light starts, and that is the best seat in the house.',
		],
	},
	{
		slug: 'between-the-letters',
		n: 1,
		pexels: 6835833,
		title: 'Between the letters',
		about: 'A sign shop at closing time, and the one customer who came to stand inside the words.',
		text: [
			'The shop bends glass tubes into words for bars that have not opened yet. At the end of the day the finished ones hang from the ceiling and are switched on once, to see if they hold.',
			'She comes by on those evenings and stands between them. Half a word on one side, half of another on the other, none of it meant for her.',
			'The owner lets her. A sign, he says, is only finished when someone has stood in its light and not read it.',
		],
	},
	{
		slug: 'last-credit',
		n: 4,
		pexels: 5767690,
		title: 'Last credit',
		about: 'Two regulars, one machine, and the hour before the arcade turns its screens off.',
		text: [
			'At eleven the arcade dims the ceiling and leaves the screens on. For an hour the room is lit only by the games, each in its own colour.',
			'They play the same machine every week, one player each, and have never finished it. They do not want to; the last level is said to be dull.',
			'When the screens go dark they stay a minute longer in the violet the cabinets leave behind, and then walk home by the light of the street.',
		],
	},
	{
		slug: 'storm-indoors',
		n: 5,
		pexels: 11584969,
		title: 'A storm, indoors',
		about: 'A projector, a white shirt and a dark room: weather you can switch off.',
		text: [
			'The film was of a storm over the sea, and the screen was her. Lightning ran down a sleeve, rain fell across a collar, and none of it was wet.',
			'The trick is to stand still. Move, and the weather slides off; hold, and it settles on you as if it had always been there.',
			'At the end the projector clicks off and the storm stops at once, which no storm has ever done.',
		],
	},
	{
		slug: 'lost-in-red',
		n: 3,
		pexels: 11439378,
		title: 'Lost, in red',
		about: 'Words that land on a face, and are read differently there.',
		text: [
			'On a wall the word is a sign. On a face it becomes a mood, and people who pass stop to decide whose.',
			'The projection was meant for the building behind him. He stepped into it by chance, and the photographer asked him to stay.',
			'He never read what was written on him. He says he would rather not know which word it was.',
		],
	},
	{
		slug: 'blue-hour',
		n: 8,
		pexels: 39688121,
		title: 'Blue hour',
		about: 'A stripe of warm light that finds its way into a blue room, and a laugh caught in it.',
		text: [
			'The room is lit blue from the window side and warm from a door left open. Between them there is one line where the two meet.',
			'Stand in it and half of you is evening, half of you is kitchen. It is hard not to laugh at that.',
			'The door was closed a minute later, and the room was only blue again.',
		],
	},
	{
		slug: 'sound-check',
		n: 6,
		pexels: 8112576,
		title: 'Sound check',
		about: 'A boombox on the pavement, the neon over it, and a street that is a stage for one song.',
		text: [
			'He sets it down under the signs, kneels, and turns it up one notch at a time until the street answers from the other side.',
			'Nobody gathers. People walk slower, that is all, for the length of one song.',
			'Then he turns it off, and the signs keep humming as if they had been part of it.',
		],
	},
];
