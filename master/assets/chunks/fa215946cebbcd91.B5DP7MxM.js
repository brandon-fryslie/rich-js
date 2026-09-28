const n=`//#region node_modules/ansi-regex/index.js
function ansiRegex({ onlyFirst = false } = {}) {
	return new RegExp(\`(?:\\\\u001B\\\\][\\\\s\\\\S]*?(?:\\\\u0007|\\\\u001B\\\\u005C|\\\\u009C))|[\\\\u001B\\\\u009B][[\\\\]()#;?]*(?:\\\\d{1,4}(?:[;:]\\\\d{0,4})*)?[\\\\dA-PR-TZcf-nq-uy=><~]\`, onlyFirst ? void 0 : "g");
}
//#endregion
//#region node_modules/strip-ansi/index.js
var regex = ansiRegex();
function stripAnsi(string) {
	if (typeof string !== "string") throw new TypeError(\`Expected a \\\`string\\\`, got \\\`\${typeof string}\\\`\`);
	if (!string.includes("\\x1B") && !string.includes("")) return string;
	return string.replace(regex, "");
}
//#endregion
//#region node_modules/get-east-asian-width/lookup-data.js
var ambiguousRanges = [
	161,
	161,
	164,
	164,
	167,
	168,
	170,
	170,
	173,
	174,
	176,
	180,
	182,
	186,
	188,
	191,
	198,
	198,
	208,
	208,
	215,
	216,
	222,
	225,
	230,
	230,
	232,
	234,
	236,
	237,
	240,
	240,
	242,
	243,
	247,
	250,
	252,
	252,
	254,
	254,
	257,
	257,
	273,
	273,
	275,
	275,
	283,
	283,
	294,
	295,
	299,
	299,
	305,
	307,
	312,
	312,
	319,
	322,
	324,
	324,
	328,
	331,
	333,
	333,
	338,
	339,
	358,
	359,
	363,
	363,
	462,
	462,
	464,
	464,
	466,
	466,
	468,
	468,
	470,
	470,
	472,
	472,
	474,
	474,
	476,
	476,
	593,
	593,
	609,
	609,
	708,
	708,
	711,
	711,
	713,
	715,
	717,
	717,
	720,
	720,
	728,
	731,
	733,
	733,
	735,
	735,
	768,
	879,
	913,
	929,
	931,
	937,
	945,
	961,
	963,
	969,
	1025,
	1025,
	1040,
	1103,
	1105,
	1105,
	8208,
	8208,
	8211,
	8214,
	8216,
	8217,
	8220,
	8221,
	8224,
	8226,
	8228,
	8231,
	8240,
	8240,
	8242,
	8243,
	8245,
	8245,
	8251,
	8251,
	8254,
	8254,
	8308,
	8308,
	8319,
	8319,
	8321,
	8324,
	8364,
	8364,
	8451,
	8451,
	8453,
	8453,
	8457,
	8457,
	8467,
	8467,
	8470,
	8470,
	8481,
	8482,
	8486,
	8486,
	8491,
	8491,
	8531,
	8532,
	8539,
	8542,
	8544,
	8555,
	8560,
	8569,
	8585,
	8585,
	8592,
	8601,
	8632,
	8633,
	8658,
	8658,
	8660,
	8660,
	8679,
	8679,
	8704,
	8704,
	8706,
	8707,
	8711,
	8712,
	8715,
	8715,
	8719,
	8719,
	8721,
	8721,
	8725,
	8725,
	8730,
	8730,
	8733,
	8736,
	8739,
	8739,
	8741,
	8741,
	8743,
	8748,
	8750,
	8750,
	8756,
	8759,
	8764,
	8765,
	8776,
	8776,
	8780,
	8780,
	8786,
	8786,
	8800,
	8801,
	8804,
	8807,
	8810,
	8811,
	8814,
	8815,
	8834,
	8835,
	8838,
	8839,
	8853,
	8853,
	8857,
	8857,
	8869,
	8869,
	8895,
	8895,
	8978,
	8978,
	9312,
	9449,
	9451,
	9547,
	9552,
	9587,
	9600,
	9615,
	9618,
	9621,
	9632,
	9633,
	9635,
	9641,
	9650,
	9651,
	9654,
	9655,
	9660,
	9661,
	9664,
	9665,
	9670,
	9672,
	9675,
	9675,
	9678,
	9681,
	9698,
	9701,
	9711,
	9711,
	9733,
	9734,
	9737,
	9737,
	9742,
	9743,
	9756,
	9756,
	9758,
	9758,
	9792,
	9792,
	9794,
	9794,
	9824,
	9825,
	9827,
	9829,
	9831,
	9834,
	9836,
	9837,
	9839,
	9839,
	9886,
	9887,
	9919,
	9919,
	9926,
	9933,
	9935,
	9939,
	9941,
	9953,
	9955,
	9955,
	9960,
	9961,
	9963,
	9969,
	9972,
	9972,
	9974,
	9977,
	9979,
	9980,
	9982,
	9983,
	10045,
	10045,
	10102,
	10111,
	11094,
	11097,
	12872,
	12879,
	57344,
	63743,
	65024,
	65039,
	65533,
	65533,
	127232,
	127242,
	127248,
	127277,
	127280,
	127337,
	127344,
	127373,
	127375,
	127376,
	127387,
	127404,
	917760,
	917999,
	983040,
	1048573,
	1048576,
	1114109
];
var fullwidthRanges = [
	12288,
	12288,
	65281,
	65376,
	65504,
	65510
];
var halfwidthRanges = [
	8361,
	8361,
	65377,
	65470,
	65474,
	65479,
	65482,
	65487,
	65490,
	65495,
	65498,
	65500,
	65512,
	65518
];
var narrowRanges = [
	32,
	126,
	162,
	163,
	165,
	166,
	172,
	172,
	175,
	175,
	10214,
	10221,
	10629,
	10630
];
var wideRanges = [
	4352,
	4447,
	8986,
	8987,
	9001,
	9002,
	9193,
	9196,
	9200,
	9200,
	9203,
	9203,
	9725,
	9726,
	9748,
	9749,
	9776,
	9783,
	9800,
	9811,
	9855,
	9855,
	9866,
	9871,
	9875,
	9875,
	9889,
	9889,
	9898,
	9899,
	9917,
	9918,
	9924,
	9925,
	9934,
	9934,
	9940,
	9940,
	9962,
	9962,
	9970,
	9971,
	9973,
	9973,
	9978,
	9978,
	9981,
	9981,
	9989,
	9989,
	9994,
	9995,
	10024,
	10024,
	10060,
	10060,
	10062,
	10062,
	10067,
	10069,
	10071,
	10071,
	10133,
	10135,
	10160,
	10160,
	10175,
	10175,
	11035,
	11036,
	11088,
	11088,
	11093,
	11093,
	11904,
	11929,
	11931,
	12019,
	12032,
	12245,
	12272,
	12287,
	12289,
	12350,
	12353,
	12438,
	12441,
	12543,
	12549,
	12591,
	12593,
	12686,
	12688,
	12773,
	12783,
	12830,
	12832,
	12871,
	12880,
	42124,
	42128,
	42182,
	43360,
	43388,
	44032,
	55203,
	63744,
	64255,
	65040,
	65049,
	65072,
	65106,
	65108,
	65126,
	65128,
	65131,
	94176,
	94180,
	94192,
	94198,
	94208,
	101589,
	101631,
	101662,
	101760,
	101874,
	110576,
	110579,
	110581,
	110587,
	110589,
	110590,
	110592,
	110882,
	110898,
	110898,
	110928,
	110930,
	110933,
	110933,
	110948,
	110951,
	110960,
	111355,
	119552,
	119638,
	119648,
	119670,
	126980,
	126980,
	127183,
	127183,
	127374,
	127374,
	127377,
	127386,
	127488,
	127490,
	127504,
	127547,
	127552,
	127560,
	127568,
	127569,
	127584,
	127589,
	127744,
	127776,
	127789,
	127797,
	127799,
	127868,
	127870,
	127891,
	127904,
	127946,
	127951,
	127955,
	127968,
	127984,
	127988,
	127988,
	127992,
	128062,
	128064,
	128064,
	128066,
	128252,
	128255,
	128317,
	128331,
	128334,
	128336,
	128359,
	128378,
	128378,
	128405,
	128406,
	128420,
	128420,
	128507,
	128591,
	128640,
	128709,
	128716,
	128716,
	128720,
	128722,
	128725,
	128728,
	128732,
	128735,
	128747,
	128748,
	128756,
	128764,
	128992,
	129003,
	129008,
	129008,
	129292,
	129338,
	129340,
	129349,
	129351,
	129535,
	129648,
	129660,
	129664,
	129674,
	129678,
	129734,
	129736,
	129736,
	129741,
	129756,
	129759,
	129770,
	129775,
	129784,
	131072,
	196605,
	196608,
	262141
];
//#endregion
//#region node_modules/get-east-asian-width/utilities.js
/**
Binary search on a sorted flat array of [start, end] pairs.

@param {number[]} ranges - Flat array of inclusive [start, end] range pairs, e.g. [0, 5, 10, 20].
@param {number} codePoint - The value to search for.
@returns {boolean} Whether the value falls within any of the ranges.
*/
var isInRange = (ranges, codePoint) => {
	let low = 0;
	let high = Math.floor(ranges.length / 2) - 1;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const i = mid * 2;
		if (codePoint < ranges[i]) high = mid - 1;
		else if (codePoint > ranges[i + 1]) low = mid + 1;
		else return true;
	}
	return false;
};
//#endregion
//#region node_modules/get-east-asian-width/lookup.js
var minimumAmbiguousCodePoint = ambiguousRanges[0];
var maximumAmbiguousCodePoint = ambiguousRanges.at(-1);
var minimumFullWidthCodePoint = fullwidthRanges[0];
var maximumFullWidthCodePoint = fullwidthRanges.at(-1);
halfwidthRanges[0];
halfwidthRanges.at(-1);
narrowRanges[0];
narrowRanges.at(-1);
var minimumWideCodePoint = wideRanges[0];
var maximumWideCodePoint = wideRanges.at(-1);
var commonCjkCodePoint = 19968;
var [wideFastPathStart, wideFastPathEnd] = findWideFastPathRange(wideRanges);
function findWideFastPathRange(ranges) {
	let fastPathStart = ranges[0];
	let fastPathEnd = ranges[1];
	for (let index = 0; index < ranges.length; index += 2) {
		const start = ranges[index];
		const end = ranges[index + 1];
		if (commonCjkCodePoint >= start && commonCjkCodePoint <= end) return [start, end];
		if (end - start > fastPathEnd - fastPathStart) {
			fastPathStart = start;
			fastPathEnd = end;
		}
	}
	return [fastPathStart, fastPathEnd];
}
var isAmbiguous = (codePoint) => {
	if (codePoint < minimumAmbiguousCodePoint || codePoint > maximumAmbiguousCodePoint) return false;
	return isInRange(ambiguousRanges, codePoint);
};
var isFullWidth = (codePoint) => {
	if (codePoint < minimumFullWidthCodePoint || codePoint > maximumFullWidthCodePoint) return false;
	return isInRange(fullwidthRanges, codePoint);
};
var isWide = (codePoint) => {
	if (codePoint >= wideFastPathStart && codePoint <= wideFastPathEnd) return true;
	if (codePoint < minimumWideCodePoint || codePoint > maximumWideCodePoint) return false;
	return isInRange(wideRanges, codePoint);
};
//#endregion
//#region node_modules/get-east-asian-width/index.js
function validate(codePoint) {
	if (!Number.isSafeInteger(codePoint)) throw new TypeError(\`Expected a code point, got \\\`\${typeof codePoint}\\\`.\`);
}
function eastAsianWidth(codePoint, { ambiguousAsWide = false } = {}) {
	validate(codePoint);
	if (isFullWidth(codePoint) || isWide(codePoint) || ambiguousAsWide && isAmbiguous(codePoint)) return 2;
	return 1;
}
//#endregion
//#region node_modules/string-width/index.js
/**
Logic:
- Segment graphemes to match how terminals render clusters.
- Width rules:
1. Skip non-printing clusters (Default_Ignorable, Control, pure nonspacing/enclosing Mark, lone Surrogates). Tabs are ignored by design.
2. RGI emoji clusters (\\p{RGI_Emoji}) are double-width.
3. Minimally-qualified/unqualified emoji clusters (ZWJ sequences with 2+ Extended_Pictographic, or keycap sequences) are double-width.
4. Hangul jamo collapse each standard modern Hangul L+V or L+V+T syllable piece to width 2.
Unmatched repeated leading/vowel/trailing jamo stay additive because that matches how the terminals we target render them.
5. Otherwise use East Asian Width of the cluster's first visible code point, and add widths for trailing spacing marks and Halfwidth/Fullwidth Forms within the same cluster (e.g., dakuten/handakuten/prolonged sound mark).
*/
var segmenter = new Intl.Segmenter();
var zeroWidthClusterRegex = new RegExp("^(?:\\\\p{Default_Ignorable_Code_Point}|\\\\p{Control}|\\\\p{Format}|\\\\p{Nonspacing_Mark}|\\\\p{Enclosing_Mark}|\\\\p{Surrogate})+$", "v");
var leadingNonPrintingRegex = new RegExp("^[\\\\p{Default_Ignorable_Code_Point}\\\\p{Control}\\\\p{Format}\\\\p{Nonspacing_Mark}\\\\p{Enclosing_Mark}\\\\p{Surrogate}]+", "v");
var spacingMarkRegex = new RegExp("\\\\p{Spacing_Mark}", "v");
var rgiEmojiRegex = new RegExp("^\\\\p{RGI_Emoji}$", "v");
var unqualifiedKeycapRegex = /^[\\d#*]\\u20E3$/;
var extendedPictographicRegex = /\\p{Extended_Pictographic}/gu;
function isDoubleWidthNonRgiEmojiSequence(segment) {
	if (segment.length > 50) return false;
	if (unqualifiedKeycapRegex.test(segment)) return true;
	if (segment.includes("‍")) {
		const pictographics = segment.match(extendedPictographicRegex);
		return pictographics !== null && pictographics.length >= 2;
	}
	return false;
}
function baseVisible(segment) {
	return segment.replace(leadingNonPrintingRegex, "");
}
function isZeroWidthCluster(segment) {
	return zeroWidthClusterRegex.test(segment);
}
function isHangulLeadingJamo(codePoint) {
	return codePoint >= 4352 && codePoint <= 4447 || codePoint >= 43360 && codePoint <= 43388;
}
function isHangulVowelJamo(codePoint) {
	return codePoint >= 4448 && codePoint <= 4519 || codePoint >= 55216 && codePoint <= 55238;
}
function isHangulTrailingJamo(codePoint) {
	return codePoint >= 4520 && codePoint <= 4607 || codePoint >= 55243 && codePoint <= 55291;
}
function isHangulJamo(codePoint) {
	return isHangulLeadingJamo(codePoint) || isHangulVowelJamo(codePoint) || isHangulTrailingJamo(codePoint);
}
function hangulClusterWidth(visibleSegment, eastAsianWidthOptions) {
	const codePoints = [];
	for (const character of visibleSegment) {
		if (zeroWidthClusterRegex.test(character)) continue;
		codePoints.push(character.codePointAt(0));
	}
	if (codePoints.length === 0) return;
	let width = 0;
	for (let index = 0; index < codePoints.length; index++) {
		const codePoint = codePoints[index];
		if (!isHangulJamo(codePoint)) {
			if (width === 0) return;
			for (let remaining = index; remaining < codePoints.length; remaining++) width += eastAsianWidth(codePoints[remaining], eastAsianWidthOptions);
			return width;
		}
		if (isHangulLeadingJamo(codePoint) && isHangulVowelJamo(codePoints[index + 1])) {
			width += 2;
			index += isHangulTrailingJamo(codePoints[index + 2]) ? 2 : 1;
			continue;
		}
		width += eastAsianWidth(codePoint, eastAsianWidthOptions);
	}
	return width;
}
function trailingWidth(visibleSegment, eastAsianWidthOptions) {
	let extra = 0;
	let first = true;
	for (const character of visibleSegment) {
		if (first) {
			first = false;
			continue;
		}
		if (spacingMarkRegex.test(character) || character >= "＀" && character <= "￯") extra += eastAsianWidth(character.codePointAt(0), eastAsianWidthOptions);
	}
	return extra;
}
function stringWidth(input, options = {}) {
	if (typeof input !== "string" || input.length === 0) return 0;
	const { ambiguousIsNarrow = true, countAnsiEscapeCodes = false } = options;
	let string = input;
	if (!countAnsiEscapeCodes && (string.includes("\\x1B") || string.includes(""))) string = stripAnsi(string);
	if (string.length === 0) return 0;
	if (/^[\\u0020-\\u007E]*$/.test(string)) return string.length;
	let width = 0;
	const eastAsianWidthOptions = { ambiguousAsWide: !ambiguousIsNarrow };
	for (const { segment } of segmenter.segment(string)) {
		if (isZeroWidthCluster(segment)) continue;
		if (rgiEmojiRegex.test(segment) || isDoubleWidthNonRgiEmojiSequence(segment)) {
			width += 2;
			continue;
		}
		const visibleSegment = baseVisible(segment);
		const hangulWidth = hangulClusterWidth(visibleSegment, eastAsianWidthOptions);
		if (hangulWidth !== void 0) {
			width += hangulWidth;
			continue;
		}
		const codePoint = visibleSegment.codePointAt(0);
		width += eastAsianWidth(codePoint, eastAsianWidthOptions);
		width += trailingWidth(visibleSegment, eastAsianWidthOptions);
	}
	return width;
}
//#endregion
//#region src/core/cells.ts
/**
* Terminal cell width calculation.
* Handles ASCII, CJK (double-width), and emoji characters.
*/
var cellLenCache = /* @__PURE__ */ new Map();
var CACHE_MAX = 4096;
/**
* Returns the terminal cell width of a string.
*/
function cellLen(text) {
	if (text.length === 0) return 0;
	if (text.length <= 64) {
		const cached = cellLenCache.get(text);
		if (cached !== void 0) return cached;
	}
	const width = stringWidth(text);
	if (text.length <= 64) {
		if (cellLenCache.size >= CACHE_MAX) cellLenCache.clear();
		cellLenCache.set(text, width);
	}
	return width;
}
/** Brand a raw number as a CellCol. Use only at trust boundaries. */
function asCellCol(n) {
	return n;
}
/** Brand a raw number as a CodePoint. Use only when the value is known to be
*  on a Unicode code-point boundary. */
function asCodePoint(n) {
	return n;
}
/**
* [LAW:parse-dont-validate] A caller's number as a count of cells — the checked
* counterpart to \`asCellCol\`'s unchecked brand, and the one place the rule "a
* cell count is a non-negative integer" is written.
*
* [LAW:one-source-of-truth] Every renderable is handed \`RenderOptions.maxWidth\`
* as a plain \`number\`, so every renderable used to answer this for itself and
* they disagreed: at NaN, \`Table\` collapsed to one cell of garbage, \`Columns\`
* and \`Layout\` threw \`Invalid array length\`, and \`RichText\` ignored the request
* and emitted its full natural width. Parse at the entry to \`render\`/\`measure\`
* and nothing downstream re-asks.
*
* The comparison is the point, not \`Math.max(0, n)\`: NaN fails every comparison
* and so floors here, where \`Math.max\` would return it and let it poison every
* bounds check downstream. Integral because a cell is not divisible — a
* fractional budget reaches a largest-remainder division, which grants a whole
* cell against a fractional residue and hands out more width than it was given.
*
* \`Infinity\` is outside what the comparison floors, so it passes through
* unchanged, and no clamp belongs here: the finite answer to an unbounded offer
* is the renderable's own natural width, which this function cannot see from
* the number alone. \`withBoundedWidth\` in \`protocol.ts\` is the second half of
* the parse and the only place that value is resolved.
*/
function cellCount(n) {
	return n > 0 ? Math.floor(n) : 0;
}
/**
* Pads or crops a string to exactly \`totalWidth\` terminal cells.
* Invariant: cellLen(setCellSize(text, n)) === n (unless n is 0)
*/
function setCellSize(text, totalWidth) {
	if (totalWidth === 0) return "";
	const currentWidth = cellLen(text);
	if (currentWidth === totalWidth) return text;
	if (currentWidth < totalWidth) return text + " ".repeat(totalWidth - currentWidth);
	return cropToWidth(text, totalWidth);
}
/**
* Splits text at a cell position. Returns [left, right].
* When the position falls mid-wide-character, the left side is padded
* to reach exactly \`position\` cells. The wide char remains in the right side.
*/
function splitText(text, position) {
	if (position <= 0) return ["", text];
	if (position >= cellLen(text)) return [text, ""];
	let width = 0;
	let charIndex = 0;
	for (const char of text) {
		const charWidth = cellLen(char);
		if (width + charWidth > position) break;
		width += charWidth;
		charIndex += char.length;
	}
	const left = text.slice(0, charIndex);
	const right = text.slice(charIndex);
	if (width < position) return [left + " ".repeat(position - width), right];
	return [left, right];
}
/**
* Wraps text into lines of at most \`maxWidth\` cells, preserving every code
* point: \`chopCells(t, w).join("") === t\`. Unlike \`splitText\` this never pads,
* so a line ending before a wide glyph is narrower than \`maxWidth\` rather than
* padded out to it.
*
* A line overflows exactly where the budget cannot be met: a glyph wider than
* \`maxWidth\` is force-taken whole rather than dropped, and a \`maxWidth\` of zero
* or less is no budget at all, so the text comes back as one line.
*/
function chopCells(text, maxWidth) {
	if (maxWidth <= 0 || text.length === 0) return [text];
	const lines = [];
	let start = asCodePoint(0);
	while (start < text.length) {
		const end = cellStepFrom(text, start, maxWidth);
		lines.push(text.slice(start, end));
		start = end;
	}
	return lines;
}
/**
* Returns the largest code-unit end offset starting from \`startCU\` whose
* prefix (from \`startCU\`) has cell width ≤ \`cap\`. Iterates from the given
* offset without slicing the tail, avoiding O(N²) allocation when called
* repeatedly across a long string.
*
* [LAW:types-are-the-program] returns CodePoint because for...of always
* stops on a code-point boundary.
*/
function cellFitFrom(text, startCU, cap) {
	let w = 0;
	let i = startCU;
	while (i < text.length) {
		const cp = text.codePointAt(i);
		const ch = String.fromCodePoint(cp);
		const cw = cellLen(ch);
		if (w + cw > cap) break;
		w += cw;
		i = asCodePoint(i + ch.length);
	}
	return i;
}
/**
* Like \`cellFitFrom\`, but for any \`startCU\` inside \`text\` the result is
* strictly past it: a glyph too wide for \`cap\` is force-taken whole and
* overflows \`cap\` by its own width. So a \`while (i < text.length)\` loop driven
* by this terminates by construction, and the re-brand is honest — both
* operands land on code-point boundaries, so their max does too.
*
* [LAW:single-enforcer] \`cellFit\` documents that its caller must choose between
* force-taking and skipping; this is that choice, made once. It was made twice
* before and the copies drifted — the textarea's soft wrap force-took,
* \`chopCells\` did neither and hung.
*/
function cellStepFrom(text, startCU, cap) {
	return asCodePoint(Math.max(cellFitFrom(text, startCU, cap), nextCodePoint(text, startCU)));
}
/**
* Advance one full Unicode code point from \`cu\`, returning the code-unit
* offset of the start of the *next* code point. Returns \`s.length\` when
* already at or past the end.
*
* Handles surrogate pairs: when the code point at \`cu\` is a supplementary
* character (U+10000…U+10FFFF) it occupies 2 UTF-16 code units, so the
* returned offset advances by 2.
*/
function nextCodePoint(s, cu) {
	if (cu >= s.length) return asCodePoint(s.length);
	return asCodePoint(cu + (s.codePointAt(cu) > 65535 ? 2 : 1));
}
function cropToWidth(text, targetWidth) {
	let width = 0;
	let i = 0;
	for (const char of text) {
		const charWidth = cellLen(char);
		if (width + charWidth > targetWidth) break;
		width += charWidth;
		i += char.length;
	}
	const cropped = text.slice(0, i);
	const diff = targetWidth - width;
	return diff > 0 ? cropped + " ".repeat(diff) : cropped;
}
//#endregion
//#region src/themes/palette.ts
/**
* A semantic palette: a named map from variable name → ColorRgba.
*
* Distinct from \`ColorTable\` (the integer-indexed quantization LUT used by
* the downgrade pipeline). Palettes carry aesthetic intent — \`primary\`,
* \`accent\`, \`error\`, etc. — and are the foundation of the theming system.
*
* Storage is uniformly ColorRgba; consumers that load from hex JSON
* parse to ColorRgba at load time. \`get\` is a bare lookup — turning an
* author-written *reference* (a name, or a \`#RRGGBB\` literal) into a colour
* is \`resolveColorRef\`'s job in \`colorRef.ts\`, so a Palette never has to
* know about the syntax callers write.
*/
var Palette = class {
	name;
	dark;
	vars;
	constructor(name, dark, vars) {
		this.name = name;
		this.dark = dark;
		this.vars = new Map(vars);
	}
	get(key) {
		return this.vars.get(key);
	}
};
//#endregion
//#region src/core/color.ts
/**
* Terminal color representation, parsing, downgrading, and ANSI code generation.
*/
function hex2(byte) {
	return byte.toString(16).padStart(2, "0");
}
function assertChannel(name, v) {
	if (!Number.isInteger(v) || v < 0 || v > 255) throw new RangeError(\`ColorRgba.\${name} must be an integer in [0, 255]; got \${v}\`);
}
/**
* Immutable RGBA color value. Alpha defaults to 1 (fully opaque).
*
* [LAW:single-enforcer] The constructor is the sole validation site for
* channel/alpha invariants. Float-arithmetic callers (HSL roundtrips, blends,
* lerps) are responsible for \`Math.round\` + clamp before construction; the
* constructor throws rather than silently masking out-of-range input.
*/
var ColorRgba = class ColorRgba {
	red;
	green;
	blue;
	alpha;
	constructor(red, green, blue, alpha = 1) {
		this.red = red;
		this.green = green;
		this.blue = blue;
		this.alpha = alpha;
		assertChannel("red", red);
		assertChannel("green", green);
		assertChannel("blue", blue);
		if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new RangeError(\`ColorRgba.alpha must be a finite number in [0, 1]; got \${alpha}\`);
	}
	/** 6-char \`#RRGGBB\` when fully opaque, 8-char \`#RRGGBBAA\` otherwise. */
	get hex() {
		const rgb = "#" + hex2(this.red) + hex2(this.green) + hex2(this.blue);
		return this.alpha === 1 ? rgb : rgb + hex2(Math.round(this.alpha * 255));
	}
	/** \`rgb(r,g,b)\` when fully opaque, \`rgba(r,g,b,a)\` otherwise. */
	get rgb() {
		return this.alpha === 1 ? \`rgb(\${this.red},\${this.green},\${this.blue})\` : \`rgba(\${this.red},\${this.green},\${this.blue},\${this.alpha})\`;
	}
	/** [r/255, g/255, b/255, alpha] — alpha is already 0..1, no division. */
	get normalized() {
		return [
			this.red / 255,
			this.green / 255,
			this.blue / 255,
			this.alpha
		];
	}
	/**
	* Composite this color over an opaque background. Returns a fully opaque
	* ColorRgba (alpha=1). Per-channel linear interpolation by alpha.
	*
	* [LAW:dataflow-not-control-flow] alpha=1 short-circuits to \`this\`, so
	* callers can invoke this unconditionally; the data decides whether work
	* happens.
	*/
	compositeOver(bg) {
		if (this.alpha === 1) return this;
		const t = this.alpha;
		return new ColorRgba(Math.round(bg.red + (this.red - bg.red) * t), Math.round(bg.green + (this.green - bg.green) * t), Math.round(bg.blue + (this.blue - bg.blue) * t), 1);
	}
};
/**
* The surface a terminal draws a translucent colour over. A terminal cannot
* know what lies under its cells, so the SGR writer (\`Style.toSgrCodes\`), the
* strip's seam test and the contrast choosers (\`themes/colorMath\`) all
* composite over this one colour. [LAW:one-source-of-truth] One constant, so
* the colour text is chosen against is the colour the writer draws.
*/
var SURFACE_BLACK = new ColorRgba(0, 0, 0);
/**
* WCAG 2.x relative luminance (0..1) of an opaque color. The single
* luminance function in the codebase — \`contrastFor\`, \`contrastRatio\`, and
* any caller that needs to reason about readability all funnel through it.
* [LAW:one-source-of-truth]
*/
function relativeLuminance(c) {
	const ch = (v) => {
		const x = v / 255;
		return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
	};
	return .2126 * ch(c.red) + .7152 * ch(c.green) + .0722 * ch(c.blue);
}
function luminanceRatio(la, lb) {
	return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05);
}
/**
* An indexed palette: entry \`i\` of \`colors\` is terminal index \`firstIndex + i\`.
* \`firstIndex\` lets a table hold only the part of a palette a downgrade may
* choose (the 256-colour cube and grey ramp start at 16) while every index it
* reports is the terminal's own.
*/
var TABLE_CACHE_MAX = 4096;
function remember(cache, key, index) {
	if (cache.size >= TABLE_CACHE_MAX) cache.clear();
	cache.set(key, index);
	return index;
}
function rgbDistance(a, b) {
	const dr = a.red - b.red;
	const dg = a.green - b.green;
	const db = a.blue - b.blue;
	return dr * dr + dg * dg + db * db;
}
var ColorTable = class {
	colors;
	firstIndex;
	matchCache = /* @__PURE__ */ new Map();
	readableCache = /* @__PURE__ */ new Map();
	constructor(colors, firstIndex = 0) {
		this.colors = colors;
		this.firstIndex = firstIndex;
	}
	get(index) {
		return this.colors[index - this.firstIndex];
	}
	luminanceCache;
	/** Each entry's relative luminance, computed once per table. */
	luminances() {
		this.luminanceCache ??= this.colors.map(relativeLuminance);
		return this.luminanceCache;
	}
	/** How many entries the table holds (terminal indices \`firstIndex\`…). */
	get size() {
		return this.colors.length;
	}
	/**
	* Finds the nearest table index to the given color (Euclidean RGB distance, cached).
	* Alpha is part of the cache key so two values that differ only in alpha
	* don't collide, but is not used in the distance metric.
	*/
	match(value) {
		const key = \`\${value.red},\${value.green},\${value.blue},\${value.alpha}\`;
		const cached = this.matchCache.get(key);
		if (cached !== void 0) return cached;
		let bestIndex = 0;
		let bestDist = Infinity;
		for (let i = 0; i < this.colors.length; i++) {
			const c = this.colors[i];
			const dist = rgbDistance(c, value);
			if (dist < bestDist) {
				bestDist = dist;
				bestIndex = i;
			}
		}
		return remember(this.matchCache, key, this.firstIndex + bestIndex);
	}
	/**
	* The nearest entry to \`value\` (the distance \`match\` uses) among those that
	* clear \`minRatio\` against \`on\`; when none does, the entry with the most
	* contrast against \`on\`. Text downgraded on its own background: \`match\`
	* moves text and background independently, and two independent roundings
	* can meet in the middle, so a pair that read at 4.5:1 in truecolor can
	* draw at 2:1. [LAW:dataflow-not-control-flow] One scan scores every entry;
	* the ratio decides which one wins.
	*/
	matchReadable(value, on, minRatio) {
		const key = \`\${value.red},\${value.green},\${value.blue}|\${on.red},\${on.green},\${on.blue}|\${minRatio}\`;
		const cached = this.readableCache.get(key);
		if (cached !== void 0) return cached;
		const lOn = relativeLuminance(on);
		let best = 0;
		let bestPasses = false;
		let bestScore = -Infinity;
		for (let i = 0; i < this.colors.length; i++) {
			const c = this.colors[i];
			const lc = this.luminances()[i];
			const ratio = luminanceRatio(lc, lOn);
			const passes = ratio >= minRatio;
			const score = passes ? -rgbDistance(c, value) : ratio;
			if (passes && !bestPasses || passes === bestPasses && score > bestScore) {
				best = i;
				bestPasses = passes;
				bestScore = score;
			}
		}
		return remember(this.readableCache, key, this.firstIndex + best);
	}
	/**
	* The nearest entry to \`value\` (the distance \`match\` uses) among those
	* \`accept\` takes, given each entry's colour and terminal index; \`undefined\`
	* when it takes none. Entries are offered nearest-first (ties to the lower
	* index) and the first taken wins, so an expensive predicate runs only as
	* far out as the answer. Uncached: the predicate is the caller's, and a
	* closure has no key.
	*/
	matchWhere(value, accept) {
		const dist = this.colors.map((c) => rgbDistance(c, value));
		const found = [...dist.keys()].sort((a, b) => dist[a] - dist[b]).find((i) => accept(this.colors[i], this.firstIndex + i));
		return found === void 0 ? void 0 : this.firstIndex + found;
	}
};
var ColorDepth;
(function(ColorDepth) {
	ColorDepth[ColorDepth["DEFAULT"] = 0] = "DEFAULT";
	ColorDepth[ColorDepth["STANDARD"] = 1] = "STANDARD";
	ColorDepth[ColorDepth["EIGHT_BIT"] = 2] = "EIGHT_BIT";
	ColorDepth[ColorDepth["TRUECOLOR"] = 3] = "TRUECOLOR";
	ColorDepth[ColorDepth["WINDOWS"] = 4] = "WINDOWS";
})(ColorDepth || (ColorDepth = {}));
var STRING_TO_DEPTH = {
	truecolor: ColorDepth.TRUECOLOR,
	"256": ColorDepth.EIGHT_BIT,
	ansi: ColorDepth.STANDARD,
	none: null,
	"0": null,
	false: null,
	"1": ColorDepth.STANDARD,
	true: ColorDepth.STANDARD,
	"2": ColorDepth.EIGHT_BIT,
	"3": ColorDepth.TRUECOLOR,
	"iTerm.app": ColorDepth.TRUECOLOR,
	Apple_Terminal: ColorDepth.EIGHT_BIT,
	vscode: ColorDepth.TRUECOLOR,
	Tabby: ColorDepth.TRUECOLOR,
	"xterm-kitty": ColorDepth.TRUECOLOR,
	"xterm-ghostty": ColorDepth.TRUECOLOR,
	wezterm: ColorDepth.TRUECOLOR,
	alacritty: ColorDepth.TRUECOLOR,
	foot: ColorDepth.TRUECOLOR,
	contour: ColorDepth.TRUECOLOR
};
/**
* Detect the terminal's color capability from env + TTY state.
*
* Probes (in priority order): NO_COLOR (per https://no-color.org —
* any non-empty value disables color), FORCE_COLOR (numeric/boolean override),
* TTY presence, TERM=dumb/unknown, COLORTERM, known terminal/TERM_PROGRAM
* names, and TERM regex patterns. Returns \`null\` for "no color".
*
* [LAW:dataflow-not-control-flow] Same probes run every call; variability is
* in the env values, not in which checks execute.
*/
function detectColorSystem(options = {}) {
	const noColor = envOf(options)["NO_COLOR"];
	if (noColor !== void 0 && noColor !== "") return null;
	const forced = forcedColorSystem(envOf(options));
	return forced !== void 0 ? forced : terminalColorSystem(options);
}
function forcedColorSystem(env) {
	const force = env["FORCE_COLOR"];
	if (force === void 0 || force === "") return void 0;
	const mapped = STRING_TO_DEPTH[force];
	return mapped !== void 0 ? mapped : ColorDepth.STANDARD;
}
function envOf(options) {
	return options.env ?? (typeof process !== "undefined" ? process.env : {});
}
function terminalColorSystem(options) {
	const env = envOf(options);
	if (!(options.isTTY ?? (typeof process !== "undefined" ? process.stdout?.isTTY ?? false : false))) return null;
	const term = env["TERM"] ?? "";
	if (term === "dumb" || term === "unknown") return null;
	const colorterm = env["COLORTERM"];
	if (colorterm === "truecolor" || colorterm === "24bit") return ColorDepth.TRUECOLOR;
	const termDepth = STRING_TO_DEPTH[term];
	if (termDepth !== void 0) return termDepth;
	const termProgram = env["TERM_PROGRAM"];
	if (termProgram !== void 0) {
		const mapped = STRING_TO_DEPTH[termProgram];
		if (mapped !== void 0) return mapped;
	}
	if (/-256(color)?$/i.test(term)) return ColorDepth.EIGHT_BIT;
	if (/-truecolor$/i.test(term)) return ColorDepth.TRUECOLOR;
	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(term)) return ColorDepth.STANDARD;
	if (colorterm !== void 0 && colorterm !== "") return ColorDepth.STANDARD;
	return ColorDepth.STANDARD;
}
/**
* Resolve a colour spec into a \`Destination\`.
*
* [LAW:single-enforcer] The one place a spec becomes both facts. A hyperlink is
* not a colour: an explicit depth — \`"none"\` and \`null\` included — states a
* colour choice and keeps links, and under \`"auto"\` links follow what the
* terminal can take (no TTY, TERM=dumb: none) while NO_COLOR and FORCE_COLOR=0,
* colour preferences, leave them alone. A FORCE_COLOR that forces colour on
* declares the destination takes escapes, so it keeps links on a pipe too.
*/
function resolveDestination(spec, options) {
	if (spec !== "auto") return {
		colorSystem: typeof spec === "string" ? resolveColorSystem(spec) : spec,
		hyperlinks: true
	};
	return {
		colorSystem: detectColorSystem(options),
		hyperlinks: (forcedColorSystem(envOf(options ?? {})) ?? null) !== null || terminalColorSystem(options ?? {}) !== null
	};
}
/**
* Resolve a string spec into a \`ColorDepth\` (or \`null\` for no color).
*
* \`"auto"\` triggers env-based detection; all other recognized specs are
* direct table lookups against \`STRING_TO_DEPTH\`. Throws on unknown specs
* — silent fallback would mask user typos.
*
* [LAW:single-enforcer] All string→ColorDepth resolution flows through here.
*/
function resolveColorSystem(spec, options) {
	if (spec === "auto") return detectColorSystem(options);
	if (Object.hasOwn(STRING_TO_DEPTH, spec)) return STRING_TO_DEPTH[spec];
	throw new ColorParseError(\`Unknown color depth spec: \${JSON.stringify(spec)} (expected "auto", "truecolor", "256", "ansi", or "none")\`);
}
var ColorParseError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "ColorParseError";
	}
};
var parseCache = /* @__PURE__ */ new Map();
var ColorSpec = class ColorSpec {
	name;
	type;
	number;
	value;
	downgradeCache = /* @__PURE__ */ new Map();
	constructor(name, type, number, value) {
		this.name = name;
		this.type = type;
		this.number = number;
		this.value = value;
	}
	get isDefault() {
		return this.type === ColorDepth.DEFAULT;
	}
	/**
	* The colour every terminal draws this spec as, where that is fixed — before
	* any alpha is flattened, so a translucent value is drawn composited over
	* its ground (\`flattenAlpha\`) and should be measured that way: a
	* truecolor value, or a 256-colour cube or grey-ramp entry (xterm fixes
	* indices 16–255, and \`fromAnsi\` types only those as EIGHT_BIT). ANSI 0–15
	* and the default colour are the terminal theme's own, so they have none.
	*/
	get fixedValue() {
		switch (this.type) {
			case ColorDepth.TRUECOLOR: return this.value;
			case ColorDepth.EIGHT_BIT: return this.number < 16 ? void 0 : EIGHT_BIT_TABLE.get(this.number);
			case ColorDepth.DEFAULT:
			case ColorDepth.STANDARD:
			case ColorDepth.WINDOWS: return;
		}
	}
	get isSystemDefined() {
		return this.type === ColorDepth.STANDARD || this.type === ColorDepth.WINDOWS;
	}
	/**
	* Generates SGR parameter strings for this color.
	*/
	getAnsiCodes(foreground = true) {
		switch (this.type) {
			case ColorDepth.DEFAULT: return [foreground ? "39" : "49"];
			case ColorDepth.STANDARD: {
				const n = this.number;
				if (foreground) return n < 8 ? [\`\${30 + n}\`] : [\`\${90 + n - 8}\`];
				return n < 8 ? [\`\${40 + n}\`] : [\`\${100 + n - 8}\`];
			}
			case ColorDepth.EIGHT_BIT: return [
				foreground ? "38" : "48",
				"5",
				\`\${this.number}\`
			];
			case ColorDepth.TRUECOLOR: {
				const t = this.value;
				return [
					foreground ? "38" : "48",
					"2",
					\`\${t.red}\`,
					\`\${t.green}\`,
					\`\${t.blue}\`
				];
			}
			case ColorDepth.WINDOWS: {
				const n = this.number;
				if (foreground) return n < 8 ? [\`\${30 + n}\`] : [\`\${90 + n - 8}\`];
				return n < 8 ? [\`\${40 + n}\`] : [\`\${100 + n - 8}\`];
			}
		}
	}
	/**
	* Composite this color's alpha (if any) against an opaque background,
	* returning a fully-opaque ColorSpec. Non-truecolor specs (palette
	* indices, default) have no alpha and pass through unchanged.
	*
	* [LAW:single-enforcer] Sole alpha-flattening site for the render
	* pipeline. Run *before* downgrade — otherwise palette matching on the
	* still-translucent RGB silently drops alpha (the "flatten then lose
	* alpha" path the unification ticket forbids).
	*
	* [LAW:dataflow-not-control-flow] \`ColorRgba.compositeOver\` is a no-op
	* when alpha=1, so callers invoke this unconditionally; the data
	* (alpha value) decides whether work happens.
	*/
	flattenAlpha(bg) {
		if (this.type !== ColorDepth.TRUECOLOR || !this.value) return this;
		const flat = this.value.compositeOver(bg);
		return flat === this.value ? this : ColorSpec.fromRgba(flat);
	}
	/**
	* Downgrade to a lower-fidelity color depth. Cached.
	*/
	downgrade(targetSystem) {
		if (this.type === ColorDepth.DEFAULT) return this;
		if (this.type <= targetSystem) return this;
		const cached = this.downgradeCache.get(targetSystem);
		if (cached) return cached;
		const result = this.performDowngrade(targetSystem);
		this.downgradeCache.set(targetSystem, result);
		return result;
	}
	/**
	* Resolves to an actual RGB(A) value for any color type.
	*/
	getTruecolor(theme, foreground = true) {
		switch (this.type) {
			case ColorDepth.TRUECOLOR: return this.value;
			case ColorDepth.EIGHT_BIT: return this.number < 16 ? (theme ?? INTERNAL_DEFAULT_THEME).ansiColors.get(this.number) : EIGHT_BIT_TABLE.get(this.number);
			case ColorDepth.STANDARD: return (theme ?? INTERNAL_DEFAULT_THEME).ansiColors.get(this.number);
			case ColorDepth.DEFAULT: {
				const t = theme ?? INTERNAL_DEFAULT_THEME;
				return foreground ? t.foregroundColor : t.backgroundColor;
			}
			case ColorDepth.WINDOWS: return (theme ?? INTERNAL_DEFAULT_THEME).ansiColors.get(this.number);
		}
	}
	static default() {
		return new ColorSpec("default", ColorDepth.DEFAULT);
	}
	static fromAnsi(n) {
		const type = n < 16 ? ColorDepth.STANDARD : ColorDepth.EIGHT_BIT;
		return new ColorSpec(\`color(\${n})\`, type, n);
	}
	static fromRgba(value) {
		return new ColorSpec(value.hex, ColorDepth.TRUECOLOR, void 0, value);
	}
	static fromRgb(r, g, b) {
		return ColorSpec.fromRgba(new ColorRgba(r, g, b));
	}
	/**
	* Parse a color string. Cached — identical strings return the same instance.
	*/
	static parse(colorString) {
		const key = colorString.toLowerCase().trim();
		const cached = parseCache.get(key);
		if (cached) return cached;
		const result = parseSingle(key);
		parseCache.set(key, result);
		return result;
	}
	performDowngrade(targetSystem) {
		const triplet = this.getTruecolor();
		switch (targetSystem) {
			case ColorDepth.EIGHT_BIT: {
				const index = EIGHT_BIT_DOWNGRADE_TABLE.match(triplet);
				return ColorSpec.fromAnsi(index);
			}
			case ColorDepth.STANDARD: {
				const index = STANDARD_TABLE.match(triplet);
				return new ColorSpec(\`color(\${index})\`, ColorDepth.STANDARD, index);
			}
			case ColorDepth.WINDOWS:
			case ColorDepth.TRUECOLOR: return this;
			case ColorDepth.DEFAULT: return ColorSpec.default();
		}
	}
};
var HEX_RE = /^#([0-9a-f]{6})$/;
var HEX_RGBA_RE = /^#([0-9a-f]{8})$/;
var RGB_RE = /^rgb\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*\\)$/;
var COLOR_NUMBER_RE = /^color\\((\\d{1,3})\\)$/;
function parseSingle(key) {
	if (key === "default" || key === "") return ColorSpec.default();
	const namedIndex = ANSI_COLOR_NAMES[key];
	if (namedIndex !== void 0) return new ColorSpec(key, namedIndex < 16 ? ColorDepth.STANDARD : ColorDepth.EIGHT_BIT, namedIndex);
	const hexRgbaMatch = HEX_RGBA_RE.exec(key);
	if (hexRgbaMatch) return new ColorSpec(key, ColorDepth.TRUECOLOR, void 0, parseRgbaHex(hexRgbaMatch[1]));
	const hexMatch = HEX_RE.exec(key);
	if (hexMatch) return new ColorSpec(key, ColorDepth.TRUECOLOR, void 0, parseRgbHex(hexMatch[1]));
	const rgbMatch = RGB_RE.exec(key);
	if (rgbMatch) {
		const r = parseInt(rgbMatch[1], 10);
		const g = parseInt(rgbMatch[2], 10);
		const b = parseInt(rgbMatch[3], 10);
		return new ColorSpec(key, ColorDepth.TRUECOLOR, void 0, new ColorRgba(r, g, b));
	}
	const numMatch = COLOR_NUMBER_RE.exec(key);
	if (numMatch) {
		const n = parseInt(numMatch[1], 10);
		if (n > 255) throw new ColorParseError(\`ColorSpec number \${n} is out of range (0-255)\`);
		return new ColorSpec(key, n < 16 ? ColorDepth.STANDARD : ColorDepth.EIGHT_BIT, n);
	}
	throw new ColorParseError(\`Failed to parse color: "\${key}"\`);
}
function parseRgbHex(hex) {
	return new ColorRgba(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
}
function parseRgbaHex(hex) {
	return new ColorRgba(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), parseInt(hex.slice(6, 8), 16) / 255);
}
function blendRgb(color1, color2, crossFade = .5) {
	return new ColorRgba(Math.round(color1.red + (color2.red - color1.red) * crossFade), Math.round(color1.green + (color2.green - color1.green) * crossFade), Math.round(color1.blue + (color2.blue - color1.blue) * crossFade), color1.alpha + (color2.alpha - color1.alpha) * crossFade);
}
/**
* A terminal theme — surface/foreground baseline, the ANSI 16/256 LUT, and a
* semantic palette.
*
* **\`ansiColors\` is the theme's own sixteen colours**, the shades a terminal
* showing this theme draws \`red\`, \`blue\` and the rest in. \`ColorSpec.parse("red")\`
* is ANSI colour 1 under every theme; which red that is, is the theme's to say,
* as it is in Rich, where each \`TerminalTheme\` carries its own table.
*/
var TerminalTheme = class {
	backgroundColor;
	foregroundColor;
	ansiColors;
	palette;
	constructor(backgroundColor, foregroundColor, ansiColors, palette) {
		this.backgroundColor = backgroundColor;
		this.foregroundColor = foregroundColor;
		this.ansiColors = ansiColors;
		this.palette = palette;
	}
};
function buildStandard16() {
	return [
		new ColorRgba(0, 0, 0),
		new ColorRgba(128, 0, 0),
		new ColorRgba(0, 128, 0),
		new ColorRgba(128, 128, 0),
		new ColorRgba(0, 0, 128),
		new ColorRgba(128, 0, 128),
		new ColorRgba(0, 128, 128),
		new ColorRgba(192, 192, 192),
		new ColorRgba(128, 128, 128),
		new ColorRgba(255, 0, 0),
		new ColorRgba(0, 255, 0),
		new ColorRgba(255, 255, 0),
		new ColorRgba(0, 0, 255),
		new ColorRgba(255, 0, 255),
		new ColorRgba(0, 255, 255),
		new ColorRgba(255, 255, 255)
	];
}
function build256Table() {
	const colors = buildStandard16();
	const levels = [
		0,
		95,
		135,
		175,
		215,
		255
	];
	for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) colors.push(new ColorRgba(levels[r], levels[g], levels[b]));
	for (let i = 0; i < 24; i++) {
		const grey = 8 + 10 * i;
		colors.push(new ColorRgba(grey, grey, grey));
	}
	return colors;
}
function buildWindowsTable() {
	return [
		new ColorRgba(0, 0, 0),
		new ColorRgba(0, 0, 128),
		new ColorRgba(0, 128, 0),
		new ColorRgba(0, 128, 128),
		new ColorRgba(128, 0, 0),
		new ColorRgba(128, 0, 128),
		new ColorRgba(128, 128, 0),
		new ColorRgba(192, 192, 192),
		new ColorRgba(128, 128, 128),
		new ColorRgba(0, 0, 255),
		new ColorRgba(0, 255, 0),
		new ColorRgba(0, 255, 255),
		new ColorRgba(255, 0, 0),
		new ColorRgba(255, 0, 255),
		new ColorRgba(255, 255, 0),
		new ColorRgba(255, 255, 255)
	];
}
var STANDARD_TABLE = new ColorTable(buildStandard16());
var EIGHT_BIT_TABLE = new ColorTable(build256Table());
/**
* What a downgrade to 256 colours may choose: the cube and the grey ramp,
* indices 16–255. Indices 0–15 are the terminal's own ANSI colours, which
* every theme redefines, so their RGB is unknown and a match against them is
* a guess; Python Rich never picks them either.
*/
var EIGHT_BIT_DOWNGRADE_TABLE = new ColorTable(build256Table().slice(16), 16);
new ColorTable(buildWindowsTable());
var INTERNAL_DEFAULT_THEME = new TerminalTheme(new ColorRgba(0, 0, 0), new ColorRgba(255, 255, 255), STANDARD_TABLE, new Palette("default", true, /* @__PURE__ */ new Map()));
/**
* The table with every \`greyNN\` name repeated under the \`grayNN\` spelling.
*
* Rich accepts both spellings and the xterm palette only defines one, so the
* aliases are part of what this table *is* rather than a patch applied to it.
*
* [LAW:no-ambient-temporal-coupling] Which is why they arrive as an initializer
* and not as the loop that used to mutate the finished map: that loop made "has
* the aliases yet" a fact about module evaluation order, so the table had two
* shapes and nothing in its type said which one you were holding. It also made
* this module do work at import time, which is the claim \`package.json\`'s
* \`sideEffects: false\` makes on its behalf — see
* \`test/seam/import-time-effects.ts\`.
*/
function withGrayAliases(names) {
	const aliases = Object.entries(names).filter(([name]) => name.includes("grey")).map(([name, index]) => [name.replace("grey", "gray"), index]);
	return {
		...names,
		...Object.fromEntries(aliases)
	};
}
var ANSI_COLOR_NAMES = withGrayAliases({
	black: 0,
	red: 1,
	green: 2,
	yellow: 3,
	blue: 4,
	magenta: 5,
	cyan: 6,
	white: 7,
	bright_black: 8,
	bright_red: 9,
	bright_green: 10,
	bright_yellow: 11,
	bright_blue: 12,
	bright_magenta: 13,
	bright_cyan: 14,
	bright_white: 15,
	grey0: 16,
	navy_blue: 17,
	dark_blue: 18,
	blue3: 19,
	blue2: 20,
	blue1: 21,
	dark_green: 22,
	deep_sky_blue4: 23,
	deep_sky_blue5: 24,
	deep_sky_blue6: 25,
	dodger_blue3: 26,
	dodger_blue2: 27,
	green4: 28,
	spring_green4: 29,
	turquoise4: 30,
	deep_sky_blue3: 31,
	deep_sky_blue7: 32,
	dodger_blue1: 33,
	green3: 34,
	spring_green3: 35,
	dark_cyan: 36,
	light_sea_green: 37,
	deep_sky_blue2: 38,
	deep_sky_blue1: 39,
	green5: 40,
	spring_green5: 41,
	spring_green2: 42,
	cyan3: 43,
	dark_turquoise: 44,
	turquoise2: 45,
	green1: 46,
	spring_green6: 47,
	spring_green1: 48,
	medium_spring_green: 49,
	cyan2: 50,
	cyan1: 51,
	dark_red: 52,
	deep_pink4: 53,
	purple4: 54,
	purple5: 55,
	purple3: 56,
	blue_violet: 57,
	orange4: 58,
	grey37: 59,
	medium_purple4: 60,
	slate_blue3: 61,
	slate_blue4: 62,
	royal_blue1: 63,
	chartreuse4: 64,
	dark_sea_green4: 65,
	pale_turquoise4: 66,
	steel_blue: 67,
	steel_blue3: 68,
	cornflower_blue: 69,
	chartreuse3: 70,
	dark_sea_green5: 71,
	cadet_blue: 72,
	cadet_blue2: 73,
	sky_blue3: 74,
	steel_blue1: 75,
	chartreuse5: 76,
	pale_green3: 77,
	sea_green3: 78,
	aquamarine3: 79,
	medium_turquoise: 80,
	steel_blue2: 81,
	chartreuse2: 82,
	sea_green2: 83,
	sea_green1: 84,
	sea_green4: 85,
	aquamarine1: 86,
	dark_slate_gray2: 87,
	dark_red2: 88,
	deep_pink5: 89,
	dark_magenta: 90,
	dark_magenta2: 91,
	dark_violet: 92,
	purple2: 93,
	orange5: 94,
	light_pink4: 95,
	plum4: 96,
	medium_purple3: 97,
	medium_purple5: 98,
	slate_blue1: 99,
	yellow4: 100,
	wheat4: 101,
	grey53: 102,
	light_slate_grey: 103,
	medium_purple: 104,
	light_slate_blue: 105,
	yellow5: 106,
	dark_olive_green3: 107,
	dark_sea_green: 108,
	light_sky_blue3: 109,
	light_sky_blue4: 110,
	sky_blue2: 111,
	chartreuse6: 112,
	dark_olive_green4: 113,
	pale_green4: 114,
	dark_sea_green3: 115,
	dark_slate_gray3: 116,
	sky_blue1: 117,
	chartreuse1: 118,
	light_green: 119,
	light_green2: 120,
	pale_green1: 121,
	aquamarine2: 122,
	dark_slate_gray1: 123,
	red3: 124,
	deep_pink6: 125,
	medium_violet_red: 126,
	magenta3: 127,
	dark_violet2: 128,
	purple: 129,
	dark_orange3: 130,
	indian_red: 131,
	hot_pink3: 132,
	medium_orchid3: 133,
	medium_orchid: 134,
	medium_purple2: 135,
	dark_goldenrod: 136,
	light_salmon3: 137,
	rosy_brown: 138,
	grey63: 139,
	medium_purple6: 140,
	medium_purple1: 141,
	gold3: 142,
	dark_khaki: 143,
	navajo_white3: 144,
	grey69: 145,
	light_steel_blue3: 146,
	light_steel_blue: 147,
	yellow3: 148,
	dark_olive_green5: 149,
	dark_sea_green6: 150,
	dark_sea_green2: 151,
	light_cyan3: 152,
	light_sky_blue1: 153,
	green_yellow: 154,
	dark_olive_green2: 155,
	pale_green2: 156,
	dark_sea_green7: 157,
	dark_sea_green1: 158,
	pale_turquoise1: 159,
	red4: 160,
	deep_pink3: 161,
	deep_pink8: 162,
	magenta4: 163,
	magenta5: 164,
	magenta2: 165,
	dark_orange4: 166,
	indian_red2: 167,
	hot_pink4: 168,
	hot_pink2: 169,
	orchid: 170,
	medium_orchid1: 171,
	orange3: 172,
	light_salmon4: 173,
	light_pink3: 174,
	pink3: 175,
	plum3: 176,
	violet: 177,
	gold4: 178,
	light_goldenrod3: 179,
	tan: 180,
	misty_rose3: 181,
	thistle3: 182,
	plum2: 183,
	yellow6: 184,
	khaki3: 185,
	light_goldenrod2: 186,
	light_yellow3: 187,
	grey84: 188,
	light_steel_blue1: 189,
	yellow2: 190,
	dark_olive_green1: 191,
	dark_olive_green6: 192,
	dark_sea_green8: 193,
	honeydew2: 194,
	light_cyan1: 195,
	red1: 196,
	deep_pink2: 197,
	deep_pink1: 198,
	deep_pink9: 199,
	magenta6: 200,
	magenta1: 201,
	orange_red1: 202,
	indian_red1: 203,
	indian_red3: 204,
	hot_pink5: 205,
	hot_pink: 206,
	medium_orchid2: 207,
	dark_orange: 208,
	salmon1: 209,
	light_coral: 210,
	pale_violet_red1: 211,
	orchid2: 212,
	orchid1: 213,
	orange1: 214,
	sandy_brown: 215,
	light_salmon1: 216,
	light_pink1: 217,
	pink1: 218,
	plum1: 219,
	gold1: 220,
	light_goldenrod4: 221,
	light_goldenrod5: 222,
	navajo_white1: 223,
	misty_rose1: 224,
	thistle1: 225,
	yellow1: 226,
	light_goldenrod1: 227,
	khaki1: 228,
	wheat1: 229,
	cornsilk1: 230,
	grey100: 231,
	grey3: 232,
	grey7: 233,
	grey11: 234,
	grey15: 235,
	grey19: 236,
	grey23: 237,
	grey27: 238,
	grey30: 239,
	grey35: 240,
	grey39: 241,
	grey42: 242,
	grey46: 243,
	grey50: 244,
	grey54: 245,
	grey58: 246,
	grey62: 247,
	grey66: 248,
	grey70: 249,
	grey74: 250,
	grey78: 251,
	grey82: 252,
	grey85: 253,
	grey89: 254,
	grey93: 255
});
/**
* Every word \`ColorSpec.parse\` accepts as a name rather than a \`#hex\`,
* \`rgb()\` or \`color(N)\` form: \`default\` and the named palette entries, which
* are exactly the two name checks \`parseSingle\` makes.
*/
var COLOR_NAMES = ["default", ...Object.keys(ANSI_COLOR_NAMES)];
//#endregion
//#region src/core/style.ts
/**
* Immutable style descriptors — colors, text attributes, links, metadata.
*/
/**
* Canonical text-attribute inventory. Single source of truth consumed by
* \`Style.parse\` / \`Style.toString\` and the template bindings — adding an
* attribute here propagates to every styling surface without a second
* list to keep in sync. [LAW:one-source-of-truth]
*/
var ATTRIBUTE_NAMES = [
	"bold",
	"dim",
	"italic",
	"underline",
	"blink",
	"blink2",
	"reverse",
	"conceal",
	"strike",
	"underline2",
	"frame",
	"encircle",
	"overline"
];
var ATTRIBUTE_SGR = {
	bold: 1,
	dim: 2,
	italic: 3,
	underline: 4,
	blink: 5,
	blink2: 6,
	reverse: 7,
	conceal: 8,
	strike: 9,
	underline2: 21,
	frame: 51,
	encircle: 52,
	overline: 53
};
/**
* Canonical short-attribute aliases (\`b\` → \`bold\`, \`i\` → \`italic\`, …).
* Single source of truth consumed by \`Style.parse\` and the template
* bindings — adding an alias here makes it available everywhere.
* [LAW:one-source-of-truth]
*/
var ATTRIBUTE_SHORT_ALIASES = {
	b: "bold",
	d: "dim",
	i: "italic",
	u: "underline",
	s: "strike",
	r: "reverse",
	o: "overline",
	uu: "underline2"
};
var StyleSyntaxError = class extends Error {
	constructor(message, options) {
		super(message, options);
		this.name = "StyleSyntaxError";
	}
};
var styleParseCache = /* @__PURE__ */ new Map();
var Style = class Style {
	color;
	bgcolor;
	bold;
	dim;
	italic;
	underline;
	blink;
	blink2;
	reverse;
	conceal;
	strike;
	underline2;
	frame;
	encircle;
	overline;
	link;
	meta;
	constructor(options) {
		if (!options) {
			this.color = void 0;
			this.bgcolor = void 0;
			this.bold = void 0;
			this.dim = void 0;
			this.italic = void 0;
			this.underline = void 0;
			this.blink = void 0;
			this.blink2 = void 0;
			this.reverse = void 0;
			this.conceal = void 0;
			this.strike = void 0;
			this.underline2 = void 0;
			this.frame = void 0;
			this.encircle = void 0;
			this.overline = void 0;
			this.link = void 0;
			this.meta = void 0;
			return;
		}
		this.color = resolveColor(options.color);
		this.bgcolor = resolveColor(options.bgcolor);
		this.bold = options.bold;
		this.dim = options.dim;
		this.italic = options.italic;
		this.underline = options.underline;
		this.blink = options.blink;
		this.blink2 = options.blink2;
		this.reverse = options.reverse;
		this.conceal = options.conceal;
		this.strike = options.strike;
		this.underline2 = options.underline2;
		this.frame = options.frame;
		this.encircle = options.encircle;
		this.overline = options.overline;
		this.link = options.link;
		this.meta = options.meta;
	}
	get isNull() {
		return this.color === void 0 && this.bgcolor === void 0 && this.bold === void 0 && this.dim === void 0 && this.italic === void 0 && this.underline === void 0 && this.blink === void 0 && this.blink2 === void 0 && this.reverse === void 0 && this.conceal === void 0 && this.strike === void 0 && this.underline2 === void 0 && this.frame === void 0 && this.encircle === void 0 && this.overline === void 0 && this.link === void 0 && this.meta === void 0;
	}
	get transparentBackground() {
		return this.bgcolor === void 0 || this.bgcolor.isDefault;
	}
	get backgroundStyle() {
		return new Style({ bgcolor: this.bgcolor });
	}
	get withoutColor() {
		return new Style({
			bold: this.bold,
			dim: this.dim,
			italic: this.italic,
			underline: this.underline,
			blink: this.blink,
			blink2: this.blink2,
			reverse: this.reverse,
			conceal: this.conceal,
			strike: this.strike,
			underline2: this.underline2,
			frame: this.frame,
			encircle: this.encircle,
			overline: this.overline,
			link: this.link,
			meta: this.meta
		});
	}
	withLink(link) {
		return new Style({
			color: this.color,
			bgcolor: this.bgcolor,
			bold: this.bold,
			dim: this.dim,
			italic: this.italic,
			underline: this.underline,
			blink: this.blink,
			blink2: this.blink2,
			reverse: this.reverse,
			conceal: this.conceal,
			strike: this.strike,
			underline2: this.underline2,
			frame: this.frame,
			encircle: this.encircle,
			overline: this.overline,
			link,
			meta: this.meta
		});
	}
	clearMetaAndLinks() {
		return new Style({
			color: this.color,
			bgcolor: this.bgcolor,
			bold: this.bold,
			dim: this.dim,
			italic: this.italic,
			underline: this.underline,
			blink: this.blink,
			blink2: this.blink2,
			reverse: this.reverse,
			conceal: this.conceal,
			strike: this.strike,
			underline2: this.underline2,
			frame: this.frame,
			encircle: this.encircle,
			overline: this.overline
		});
	}
	/**
	* Merges two styles. \`other\`'s values take priority.
	*/
	add(other) {
		if (!other || other.isNull) return this;
		if (this.isNull) return other;
		return new Style({
			color: other.color ?? this.color,
			bgcolor: other.bgcolor ?? this.bgcolor,
			bold: other.bold ?? this.bold,
			dim: other.dim ?? this.dim,
			italic: other.italic ?? this.italic,
			underline: other.underline ?? this.underline,
			blink: other.blink ?? this.blink,
			blink2: other.blink2 ?? this.blink2,
			reverse: other.reverse ?? this.reverse,
			conceal: other.conceal ?? this.conceal,
			strike: other.strike ?? this.strike,
			underline2: other.underline2 ?? this.underline2,
			frame: other.frame ?? this.frame,
			encircle: other.encircle ?? this.encircle,
			overline: other.overline ?? this.overline,
			link: other.link ?? this.link,
			meta: other.meta && this.meta ? {
				...this.meta,
				...other.meta
			} : other.meta ?? this.meta
		});
	}
	equals(other) {
		if (this === other) return true;
		return this.color?.name === other.color?.name && this.bgcolor?.name === other.bgcolor?.name && this.bold === other.bold && this.dim === other.dim && this.italic === other.italic && this.underline === other.underline && this.blink === other.blink && this.blink2 === other.blink2 && this.reverse === other.reverse && this.conceal === other.conceal && this.strike === other.strike && this.underline2 === other.underline2 && this.frame === other.frame && this.encircle === other.encircle && this.overline === other.overline && this.link === other.link;
	}
	/**
	* The colours this style puts on screen at \`colorSystem\`: each flattened
	* onto what lies beneath it — the background onto the terminal's black, the
	* foreground onto that background — then downgraded to the depth. The one
	* account of what a style draws: \`toSgrCodes\` encodes exactly these, and a
	* renderable choosing between two ways of drawing measures them.
	*/
	drawnColors(colorSystem) {
		const surface = SURFACE_BLACK;
		const bgFlat = this.bgcolor?.flattenAlpha(surface);
		const fgSubstrate = bgFlat?.getTruecolor(void 0, false) ?? surface;
		const fgFlat = this.color?.flattenAlpha(fgSubstrate);
		const at = (c) => colorSystem !== void 0 ? c.downgrade(colorSystem) : c;
		return {
			color: fgFlat === void 0 ? void 0 : at(fgFlat),
			bgcolor: bgFlat === void 0 ? void 0 : at(bgFlat)
		};
	}
	/**
	* Returns the SGR parameter list this style emits (e.g. \`"1;31;48;2;0;0;255"\`),
	* or \`""\` when the style has no SGR contribution. Excludes OSC 8 link bytes —
	* links are not SGR. The segment encoder (\`segmentsToString\`) uses this
	* string as the group key for adjacent-same-style coalescing and wraps it in
	* \`\\x1b[...m\`; styled text reaches the wire only through that encoder.
	*
	* [LAW:one-source-of-truth] One computation of SGR codes.
	*/
	toSgrCodes(colorSystem) {
		if (this.isNull) return "";
		const attrs = [];
		const drawn = this.drawnColors(colorSystem);
		if (drawn.color) attrs.push(...drawn.color.getAnsiCodes(true));
		if (drawn.bgcolor) attrs.push(...drawn.bgcolor.getAnsiCodes(false));
		attrs.push(...ATTRIBUTE_NAMES.filter((name) => this[name] === true).map((name) => \`\${ATTRIBUTE_SGR[name]}\`));
		return attrs.join(";");
	}
	/**
	* Serializes to a canonical string that round-trips through \`Style.parse()\`.
	*/
	toString() {
		if (this.isNull) return "none";
		const parts = [];
		for (const name of ATTRIBUTE_NAMES) if (this[name] === false) parts.push(\`not \${name}\`);
		for (const name of ATTRIBUTE_NAMES) if (this[name] === true) parts.push(name);
		if (this.color) parts.push(this.color.name);
		if (this.bgcolor) parts.push(\`on \${this.bgcolor.name}\`);
		if (this.link) parts.push(\`link \${this.link}\`);
		return parts.join(" ") || "none";
	}
	static null() {
		return NULL_STYLE;
	}
	static fromColor(color, bgcolor) {
		return new Style({
			color,
			bgcolor
		});
	}
	static fromMeta(meta) {
		return new Style({ meta });
	}
	static pickFirst(...args) {
		for (const a of args) if (a !== void 0) return a;
		throw new Error("All arguments are undefined");
	}
	static combine(styles) {
		let result = NULL_STYLE;
		for (const s of styles) if (s) result = result.add(s);
		return result;
	}
	static chain(...styles) {
		return Style.combine(styles);
	}
	static normalize(definition) {
		return definition.trim().replace(/\\s+/g, " ");
	}
	/**
	* Parse a space-separated style definition. Cached.
	*
	* A definition only: \`"bold red"\` parses, \`"repr.number"\` does not. Names
	* belong to a \`Theme\`, and \`Theme.resolve\` is where one is looked up.
	*/
	static parse(definition) {
		const normalized = Style.normalize(definition);
		if (normalized === "" || normalized === "none") return NULL_STYLE;
		const cached = styleParseCache.get(normalized);
		if (cached) return cached;
		const result = parseStyleDefinition(normalized);
		styleParseCache.set(normalized, result);
		return result;
	}
};
var NULL_STYLE = new Style();
var STYLE_NAME_RE = /^[a-z][a-z0-9._-]*$/;
var Theme = class {
	styles;
	constructor(definitions = {}, options) {
		this.styles = /* @__PURE__ */ new Map();
		if (options?.inherit !== false) for (const [name, style] of Object.entries(DEFAULT_STYLES)) this.styles.set(name, style);
		for (const [name, def] of Object.entries(definitions)) {
			if (!STYLE_NAME_RE.test(name)) throw new Error(\`Invalid style name: "\${name}" (must be lowercase, start with letter, contain only letters, digits, ".", "-", "_")\`);
			this.styles.set(name, Style.parse(def));
		}
	}
	get(name) {
		return this.styles.get(name);
	}
	/**
	* The style a \`string | Style\` stands for under this theme: a name this
	* theme defines, otherwise a definition for \`Style.parse\`, which throws
	* \`StyleSyntaxError\` when the string is neither.
	*
	* [LAW:one-source-of-truth] The theme is the one map from names to styles.
	* The lookup stays outside \`Style.parse\`'s process-wide cache on purpose:
	* cached there, the first console to resolve \`repr.number\` would decide it
	* for every console after it, whatever theme each was given.
	*/
	resolve(style) {
		if (style instanceof Style) return style;
		return this.styles.get(style) ?? Style.parse(style);
	}
	has(name) {
		return this.styles.has(name);
	}
};
var ATTRIBUTE_SET = new Set(ATTRIBUTE_NAMES);
var FOREGROUND_WORDS = [
	"not",
	"on",
	"link",
	...ATTRIBUTE_NAMES,
	...COLOR_NAMES
];
/**
* Optimal string alignment distance: insertions, deletions, substitutions, and
* swaps of two neighbouring letters each cost one edit, so \`cyna\` is as near
* \`cyan\` as \`rd\` is to \`red\`. Kept to three rows, since only the two before the
* current one are ever read.
*/
function editDistance(a, b) {
	let before = [];
	let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const swap = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]), swap ? before[j - 2] + 1 : Infinity);
		}
		[before, previous] = [previous, current];
	}
	return previous[b.length];
}
/**
* The \` (did you mean …?)\` clause for a word no position accepted, or \`""\`
* when nothing in \`words\` is a plausible typo of it.
*
* Plausible means within one edit per three letters, at least one, which lets
* \`rd\` reach \`red\` and keeps \`hello\` from reaching \`yellow\`. Every name tied
* for nearest is offered: \`gold\` is one edit from \`bold\` and from three
* \`goldN\` colours, and choosing among them would be a guess the reader cannot
* tell from a finding. Case is not an edit, because the colour parser ignores
* it: \`Cyna\` is as near \`cyan\` as \`cyna\` is.
*
* This runs on every render that meets the bad style, since only successful
* parses are cached. Two words differ by at least their difference in length,
* so a name outside the budget on length alone is never measured — which is
* also what keeps a long garbage token from costing length × length per name.
*/
function nearMiss(word, words) {
	const typed = word.toLowerCase();
	const budget = Math.max(1, Math.floor(typed.length / 3));
	const scored = words.filter((name) => Math.abs(name.length - typed.length) <= budget).map((name) => ({
		name,
		distance: editDistance(typed, name)
	}));
	const nearest = Math.min(budget, ...scored.map((s) => s.distance));
	const names = scored.filter((s) => s.distance === nearest).map((s) => \`"\${s.name}"\`).sort();
	return names.length === 0 ? "" : \` (did you mean \${names.join(" or ")}?)\`;
}
/**
* A style token read as a colour. The colour parser's own error is the reason
* the token failed, so it rides along twice: in the message, for a reader with
* only the text, and as \`cause\`, for code that wants the original error.
*
* [LAW:single-enforcer] Both colour positions in a definition rewrap here, and
* the near miss is named here rather than by the colour parser: only a
* definition knows whether the token could also have been an attribute.
*/
function parseStyleColor(token, failure, words) {
	try {
		return ColorSpec.parse(token);
	} catch (cause) {
		throw new StyleSyntaxError(\`\${failure} "\${token}"\${nearMiss(token, words)}: \${String(cause)}\`, { cause });
	}
}
function parseStyleDefinition(definition) {
	const tokens = definition.split(/\\s+/);
	const opts = {};
	let i = 0;
	while (i < tokens.length) {
		const token = tokens[i];
		if (token === "not") {
			i++;
			const next = tokens[i];
			if (!next) throw new StyleSyntaxError(\`Expected attribute after "not" in style definition\`);
			const attrName = ATTRIBUTE_SHORT_ALIASES[next] ?? next;
			if (!ATTRIBUTE_SET.has(attrName)) throw new StyleSyntaxError(\`Invalid attribute: "\${next}"\${nearMiss(next, ATTRIBUTE_NAMES)}\`);
			opts[attrName] = false;
			i++;
			continue;
		}
		if (token === "on") {
			i++;
			const next = tokens[i];
			if (!next) throw new StyleSyntaxError(\`Expected color after "on" in style definition\`);
			opts.bgcolor = parseStyleColor(next, "Invalid background color", COLOR_NAMES);
			i++;
			continue;
		}
		if (token === "link") {
			i++;
			const url = tokens[i];
			if (url) opts.link = url;
			i++;
			continue;
		}
		const resolvedAttr = ATTRIBUTE_SHORT_ALIASES[token] ?? token;
		if (ATTRIBUTE_SET.has(resolvedAttr)) {
			opts[resolvedAttr] = true;
			i++;
			continue;
		}
		opts.color = parseStyleColor(token, "Invalid style definition", FOREGROUND_WORDS);
		i++;
	}
	return new Style(opts);
}
function resolveColor(c) {
	if (c === void 0) return void 0;
	if (c instanceof ColorSpec) return c;
	return ColorSpec.parse(c);
}
var DEFAULT_STYLES = {
	none: NULL_STYLE,
	reset: new Style({
		color: ColorSpec.default(),
		bgcolor: ColorSpec.default(),
		bold: false,
		dim: false,
		italic: false,
		underline: false,
		blink: false,
		blink2: false,
		reverse: false,
		conceal: false,
		strike: false,
		underline2: false,
		frame: false,
		encircle: false,
		overline: false
	}),
	bold: new Style({ bold: true }),
	dim: new Style({ dim: true }),
	italic: new Style({ italic: true }),
	underline: new Style({ underline: true }),
	blink: new Style({ blink: true }),
	blink2: new Style({ blink2: true }),
	reverse: new Style({ reverse: true }),
	conceal: new Style({ conceal: true }),
	strike: new Style({ strike: true }),
	underline2: new Style({ underline2: true }),
	frame: new Style({ frame: true }),
	encircle: new Style({ encircle: true }),
	overline: new Style({ overline: true }),
	"table.header": new Style({ bold: true }),
	"table.footer": new Style({ bold: true }),
	"table.cell": NULL_STYLE,
	"table.title": new Style({ italic: true }),
	"table.caption": new Style({
		italic: true,
		dim: true
	}),
	"repr.str": Style.parse("green"),
	"repr.number": Style.parse("cyan"),
	"repr.bool": Style.parse("italic bright_magenta"),
	"repr.none": Style.parse("italic magenta"),
	"repr.url": Style.parse("not italic underline bright_blue"),
	"repr.uuid": Style.parse("bright_yellow"),
	"repr.error": Style.parse("bold red"),
	"repr.indent": Style.parse("dim green"),
	"repr.attrib_name": Style.parse("yellow"),
	"repr.attrib_value": Style.parse("magenta"),
	"repr.attrib_equal": Style.parse("bold"),
	"repr.tag_start": Style.parse("bold"),
	"repr.tag_name": Style.parse("bright_magenta"),
	"repr.tag_contents": Style.parse("default"),
	"repr.tag_end": Style.parse("bold"),
	"log.time": Style.parse("cyan dim"),
	"log.message": NULL_STYLE,
	"log.path": Style.parse("dim"),
	"log.line_no": Style.parse("cyan"),
	"log.level": NULL_STYLE,
	"rule.line": Style.parse("green"),
	"rule.text": Style.parse("bold"),
	"json.brace": Style.parse("bold"),
	"json.bool_true": Style.parse("italic bright_green"),
	"json.bool_false": Style.parse("italic bright_red"),
	"json.key": Style.parse("bold blue"),
	"json.null": Style.parse("italic magenta"),
	"json.number": Style.parse("bold not italic cyan"),
	"json.str": Style.parse("not bold not italic green"),
	"markdown.h1": Style.parse("bold underline"),
	"markdown.h2": Style.parse("bold"),
	"markdown.h3": Style.parse("bold dim"),
	"markdown.h4": Style.parse("bold dim italic"),
	"markdown.code": Style.parse("cyan on grey11"),
	"markdown.hr": Style.parse("yellow"),
	"markdown.link": Style.parse("bright_blue"),
	"markdown.link_url": Style.parse("blue"),
	"progress.description": NULL_STYLE,
	"progress.percentage": Style.parse("cyan"),
	"progress.remaining": Style.parse("cyan"),
	"progress.elapsed": Style.parse("cyan"),
	"progress.spinner": Style.parse("green"),
	"progress.download": Style.parse("green"),
	"progress.filesize": Style.parse("green"),
	"progress.filesize.total": Style.parse("green"),
	"progress.data.speed": Style.parse("red"),
	"bar.back": Style.parse("grey23"),
	"bar.complete": Style.parse("magenta"),
	"bar.finished": Style.parse("green"),
	"bar.pulse": Style.parse("magenta"),
	"scrollbar.thumb": NULL_STYLE,
	"scrollbar.track": Style.parse("grey37"),
	"tree": NULL_STYLE,
	"tree.guide": NULL_STYLE,
	"status.spinner": Style.parse("green"),
	"status.message": NULL_STYLE,
	"prompt": Style.parse("bold"),
	"prompt.choices": Style.parse("magenta"),
	"prompt.default": Style.parse("cyan"),
	"inspect.attr": Style.parse("yellow italic"),
	"inspect.attr.dunder": Style.parse("yellow italic dim"),
	"inspect.callable": Style.parse("bold magenta"),
	"inspect.error": Style.parse("bold red"),
	"inspect.help": Style.parse("cyan"),
	"inspect.doc": Style.parse("dim"),
	"inspect.value.border": Style.parse("green"),
	"traceback.border": Style.parse("red"),
	"traceback.text": Style.parse("red"),
	"traceback.title": Style.parse("bold red"),
	"traceback.exc_type": Style.parse("bold bright_red"),
	"traceback.exc_value": NULL_STYLE,
	"traceback.offset": Style.parse("bold bright_red"),
	"scope.border": Style.parse("blue"),
	"scope.key": Style.parse("italic"),
	"scope.key.special": Style.parse("dim italic"),
	"pretty": NULL_STYLE,
	"iso8601.date": Style.parse("cyan"),
	"iso8601.time": Style.parse("cyan"),
	"iso8601.timezone": Style.parse("bright_blue")
};
/**
* The theme a render resolves names against when nothing supplied one — what
* a renderable sees outside a \`Console\`, as in \`renderToString\`.
*/
var DEFAULT_THEME = new Theme();
//#endregion
//#region src/core/segment.ts
/**
* Segment — the atomic rendering unit. Every piece of styled terminal output
* is represented as a Segment: (text, style?, control?).
*/
var ControlType;
(function(ControlType) {
	ControlType["BELL"] = "bell";
	ControlType["CARRIAGE_RETURN"] = "carriage_return";
	ControlType["HOME"] = "home";
	ControlType["CLEAR"] = "clear";
	ControlType["SHOW_CURSOR"] = "show_cursor";
	ControlType["HIDE_CURSOR"] = "hide_cursor";
	ControlType["ENABLE_ALT_SCREEN"] = "enable_alt_screen";
	ControlType["DISABLE_ALT_SCREEN"] = "disable_alt_screen";
	ControlType["CURSOR_UP"] = "cursor_up";
	ControlType["CURSOR_DOWN"] = "cursor_down";
	ControlType["CURSOR_FORWARD"] = "cursor_forward";
	ControlType["CURSOR_BACKWARD"] = "cursor_backward";
	ControlType["CURSOR_MOVE_TO_COLUMN"] = "cursor_move_to_column";
	ControlType["CURSOR_MOVE_TO"] = "cursor_move_to";
	ControlType["ERASE_IN_LINE"] = "erase_in_line";
	ControlType["SET_WINDOW_TITLE"] = "set_window_title";
})(ControlType || (ControlType = {}));
var Segment = class Segment {
	text;
	style;
	control;
	constructor(text, style, control) {
		this.text = text;
		this.style = style;
		this.control = control;
	}
	get cellLength() {
		return this.control ? 0 : cellLen(this.text);
	}
	get hasText() {
		return this.text.length > 0;
	}
	get isControl() {
		return this.control !== void 0;
	}
	/**
	* Splits at a cell position. Returns [left, right].
	*/
	splitCells(position) {
		if (position >= this.cellLength) return [this, new Segment("")];
		if (position <= 0) return [new Segment(""), this];
		const [leftText, rightText] = splitText(this.text, position);
		return [new Segment(leftText, this.style), new Segment(rightText, this.style)];
	}
	static _line;
	static line() {
		return Segment._line ??= new Segment("\\n");
	}
	/**
	* Yields segments with combined styles.
	*/
	static *applyStyle(segments, style, postStyle) {
		for (const segment of segments) {
			if (segment.isControl) {
				yield segment;
				continue;
			}
			let s = segment.style;
			if (style) s = style.add(s);
			if (postStyle) s = s ? s.add(postStyle) : postStyle;
			yield new Segment(segment.text, s, segment.control);
		}
	}
	/**
	* Filters segments by control status.
	*/
	static *filterControl(segments, isControl) {
		for (const segment of segments) if (segment.isControl === isControl) yield segment;
	}
	/**
	* Splits segments at newlines. Yields arrays of segments per line.
	*/
	static splitLines(segments) {
		const lines = [];
		let currentLine = [];
		for (const segment of segments) {
			if (segment.isControl) {
				currentLine.push(segment);
				continue;
			}
			const text = segment.text;
			if (!text.includes("\\n")) {
				currentLine.push(segment);
				continue;
			}
			const parts = text.split("\\n");
			for (let i = 0; i < parts.length; i++) {
				if (i > 0) {
					lines.push(currentLine);
					currentLine = [];
				}
				const part = parts[i];
				if (part.length > 0) currentLine.push(new Segment(part, segment.style));
			}
		}
		if (currentLine.length > 0) lines.push(currentLine);
		return lines;
	}
	/**
	* Adjusts a line of segments to exactly \`width\` cells.
	*/
	static adjustLineLength(line, width, style, pad = true) {
		const currentWidth = Segment.getLineLength(line);
		if (currentWidth === width) return line;
		if (currentWidth < width) {
			if (!pad) return line;
			return [...line, new Segment(" ".repeat(width - currentWidth), style)];
		}
		const result = [];
		let remaining = width;
		for (const segment of line) {
			if (segment.isControl) {
				result.push(segment);
				continue;
			}
			const segWidth = segment.cellLength;
			if (segWidth <= remaining) {
				result.push(segment);
				remaining -= segWidth;
			} else {
				const [left] = segment.splitCells(asCellCol(remaining));
				result.push(left);
				remaining = 0;
				break;
			}
		}
		return result;
	}
	/**
	* Crops a renderable's output so no line exceeds \`width\`, leaving short lines
	* alone and the line structure exactly as it arrived.
	*
	* [LAW:single-enforcer] \`adjustLineLength\` is where a width is enforced, but
	* it takes one line and a container holding arbitrary content has a stream of
	* them. Without this step the container has to trust content to honour the
	* offer, and content that ignores it overflows the region — which is how a
	* \`Layout\` leaf and a \`Tree\` label came to emit forty cells into a one-cell
	* offer while \`Panel\` and \`Padding\`, which split and adjust, did not.
	*
	* One segment in, one segment out, shortening text and nothing else — so the
	* line structure that arrives is the line structure that leaves. Two earlier
	* shapes of this both decided how many lines there were and both were wrong:
	* built on \`splitLines\`, which cannot tell \`"abc"\` from \`"abc\\n"\`, it invented
	* a trailing newline and dropped the row of an empty \`Tree\` label entirely,
	* running its guides into the next row; rebuilt to accumulate lines, it
	* dropped the zero-width-but-present line \`RichText\` emits at an offer of 0,
	* and a row split rendered nothing at all. A crop shortens; it does not count.
	*
	* A wide glyph the edge cuts through leaves a space in the cell it would have
	* half-filled, so a cropped line still reaches the edge — the reference's
	* \`set_cell_size\`, which \`splitText\` already is. An unbounded \`width\` crops
	* nothing, and a segment the crop did not change leaves as itself.
	*/
	static *cropLines(segments, width) {
		const cap = Math.max(0, width);
		let used = 0;
		for (const segment of segments) {
			if (segment.isControl) {
				yield segment;
				continue;
			}
			const parts = segment.text.split("\\n");
			for (let i = 0; i < parts.length; i++) {
				if (i > 0) used = 0;
				const [piece] = splitText(parts[i], asCellCol(cap - used));
				used += cellLen(piece);
				parts[i] = piece;
			}
			const cropped = parts.join("\\n");
			yield cropped === segment.text ? segment : new Segment(cropped, segment.style);
		}
	}
	/**
	* Returns total cell width of a line. Ignores control segments.
	*/
	static getLineLength(line) {
		let width = 0;
		for (const segment of line) if (!segment.isControl) width += segment.cellLength;
		return width;
	}
	/**
	* Returns [width, height] of a set of lines.
	*/
	static getShape(lines) {
		if (lines.length === 0) return [0, 0];
		let maxWidth = 0;
		for (const line of lines) {
			const w = Segment.getLineLength(line);
			if (w > maxWidth) maxWidth = w;
		}
		return [maxWidth, lines.length];
	}
	/**
	* Composes cells side by side into full lines. Each cell contributes its
	* own lines cropped/padded to its declared width; a cell shorter than the
	* tallest is filled with blank space so the grid stays aligned. Adjacent
	* cells are separated by a gutter of spaces, and each merged row ends with a
	* line break. This is the single side-by-side merge used by every horizontal
	* layout (Columns grid rows, Layout row splits).
	*/
	static *mergeHorizontal(cells, gutter = 0) {
		let height = 0;
		for (const cell of cells) if (cell.lines.length > height) height = cell.lines.length;
		const gap = gutter > 0 ? [new Segment(" ".repeat(gutter))] : [];
		for (let row = 0; row < height; row++) {
			for (let col = 0; col < cells.length; col++) {
				if (col > 0) yield* gap;
				const cell = cells[col];
				yield* Segment.adjustLineLength(cell.lines[row] ?? [], cell.width);
			}
			yield Segment.line();
		}
	}
	/**
	* Merges contiguous segments with the same style.
	*/
	static *simplify(segments) {
		let pending;
		for (const segment of segments) {
			if (!pending) {
				pending = segment;
				continue;
			}
			if (stylesEqual(pending.style, segment.style) && !segment.isControl && !pending.isControl) pending = new Segment(pending.text + segment.text, pending.style);
			else {
				yield pending;
				pending = segment;
			}
		}
		if (pending) yield pending;
	}
	/**
	* Yields segments with links removed.
	*/
	static *stripLinks(segments) {
		for (const segment of segments) if (segment.style?.link) yield new Segment(segment.text, segment.style.clearMetaAndLinks(), segment.control);
		else yield segment;
	}
	/**
	* Yields segments with all styles removed.
	*/
	static *stripStyles(segments) {
		for (const segment of segments) yield new Segment(segment.text, void 0, segment.control);
	}
	/**
	* Yields segments with colors removed but attributes preserved.
	*/
	static *removeColor(segments) {
		for (const segment of segments) if (segment.style) yield new Segment(segment.text, segment.style.withoutColor, segment.control);
		else yield segment;
	}
	/**
	* Divides segments at cell positions. Yields arrays of segments for each section.
	*/
	static divide(segments, cuts) {
		if (cuts.length === 0) return [segments];
		const result = [];
		let segmentIndex = 0;
		let cellOffset = 0;
		let currentSegment = segments[segmentIndex];
		for (const cut of cuts) {
			const section = [];
			while (currentSegment && cellOffset + currentSegment.cellLength <= cut) {
				if (currentSegment.isControl) section.push(currentSegment);
				else {
					section.push(currentSegment);
					cellOffset += currentSegment.cellLength;
				}
				segmentIndex++;
				currentSegment = segments[segmentIndex];
			}
			if (currentSegment && !currentSegment.isControl && cellOffset < cut) {
				const splitAt = asCellCol(cut - cellOffset);
				const [left, right] = currentSegment.splitCells(splitAt);
				if (left.hasText) section.push(left);
				cellOffset += left.cellLength;
				currentSegment = right;
			}
			result.push(section);
		}
		const tail = [];
		if (currentSegment?.hasText) tail.push(currentSegment);
		segmentIndex++;
		while (segmentIndex < segments.length) {
			tail.push(segments[segmentIndex]);
			segmentIndex++;
		}
		if (tail.length > 0) result.push(tail);
		return result;
	}
	/**
	* Pads below to fill height.
	*/
	static alignTop(lines, width, height, style) {
		const result = lines.map((line) => Segment.adjustLineLength(line, width, style));
		const blankLine = [new Segment(" ".repeat(width), style)];
		while (result.length < height) result.push([...blankLine]);
		return result.slice(0, height);
	}
	/**
	* Pads above to fill height. Content at bottom.
	*/
	static alignBottom(lines, width, height, style) {
		const adjusted = lines.map((line) => Segment.adjustLineLength(line, width, style));
		const blankLine = [new Segment(" ".repeat(width), style)];
		const padCount = Math.max(0, height - adjusted.length);
		const result = [];
		for (let i = 0; i < padCount; i++) result.push([...blankLine]);
		result.push(...adjusted);
		return result.slice(0, height);
	}
	/**
	* Pads above and below. Content in middle.
	*/
	static alignMiddle(lines, width, height, style) {
		const adjusted = lines.map((line) => Segment.adjustLineLength(line, width, style));
		const blankLine = [new Segment(" ".repeat(width), style)];
		const padAbove = Math.max(0, Math.floor((height - adjusted.length) / 2));
		const result = [];
		for (let i = 0; i < padAbove; i++) result.push([...blankLine]);
		result.push(...adjusted);
		while (result.length < height) result.push([...blankLine]);
		return result.slice(0, height);
	}
	/**
	* Forces lines to exactly width x height.
	*/
	static setShape(lines, width, height, style) {
		const result = lines.map((line) => Segment.adjustLineLength(line, width, style));
		const blankLine = [new Segment(" ".repeat(width), style)];
		while (result.length < height) result.push([...blankLine]);
		return result.slice(0, height);
	}
	/**
	* Splits segments into lines and adjusts each to exactly \`width\` cells.
	*/
	static splitAndCropLines(segments, width, pad = true, includeNewLines = false, style) {
		const rawLines = Segment.splitLines(segments);
		const result = [];
		for (const line of rawLines) {
			const adjusted = Segment.adjustLineLength(line, width, style, pad);
			result.push(adjusted);
			if (includeNewLines) result[result.length - 1].push(Segment.line());
		}
		return result;
	}
};
function stylesEqual(a, b) {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.equals(b);
}
//#endregion
//#region src/core/box.ts
/**
* Box-drawing character sets for borders and table grids.
*
* A style is declared as an 8x4 character grid — one line per row a table can
* draw, one column per position within that row:
*
*     ┌─┬┐   top border
*     │ ││   header content
*     ├─┼┤   header separator
*     │ ││   body content
*     ├─┼┤   row separator
*     ├─┼┤   footer separator
*     │ ││   footer content
*     └─┴┘   bottom border
*
* [LAW:one-source-of-truth] The grid is the shape the reference implementation
* (Python Rich's \`box.py\`) publishes these glyphs in, so a constant below can
* be diffed against it character for character. The eighteen named fields this
* replaced were a second, differently-shaped map of the same territory, and it
* had drifted: seven of the nineteen constants carried wrong glyphs, and the
* field named \`mid\` held the reference's line 3 while the reference's \`mid_*\`
* is line 4 — so reading the reference name-for-name swapped a separator for a
* content row. Named row fields are gone for that reason; a row is reached by
* what it is (\`getRow\`, \`getContentChars\`), never by a name that can be
* mismatched to a line.
*/
var GRID_ROWS = 8;
var GRID_COLUMNS = 4;
/**
* A grid a terminal without unicode support can already draw as written.
*
* [LAW:one-source-of-truth] Derived from the grid rather than declared per
* constant the way the reference's \`ascii=True\` is. A \`Box\` is wholly its grid,
* so the grid already answers this; a second, hand-written answer could
* disagree with it. It also reaches boxes no constant can speak for —
* \`safeSubstitute\` builds a fresh \`Box\` from an edited grid, and a flag carried
* on the shipped constants would say nothing about that one.
*/
var ASCII_GRID = /^[\\x00-\\x7F]*$/;
/** Corners that a legacy Windows terminal cannot draw, and their square kin. */
var SAFE_SUBSTITUTIONS = {
	"╭": "┌",
	"╮": "┐",
	"╰": "└",
	"╯": "┘"
};
var edgeOf = (row) => ({
	left: row[0],
	horizontal: row[1],
	cross: row[2],
	right: row[3]
});
var contentOf = (row) => ({
	left: row[0],
	vertical: row[2],
	right: row[3]
});
var Box = class Box {
	top;
	bottom;
	grid;
	ascii;
	headContent;
	headSeparator;
	bodyContent;
	rowSeparator;
	footSeparator;
	footContent;
	/**
	* [LAW:parse-dont-validate] The one crossing between a grid string and box
	* glyphs. A \`Box\` cannot exist without eight rows of four characters, so no
	* consumer below ever re-checks the shape of the data it reads.
	*/
	constructor(grid) {
		const lines = grid.split("\\n");
		if (lines.length !== GRID_ROWS || lines.some((line) => Array.from(line).length !== GRID_COLUMNS) || lines.some((line) => cellLen(line) !== GRID_COLUMNS)) throw new Error(\`A box grid is \${GRID_ROWS} lines of \${GRID_COLUMNS} single-cell characters; got \${lines.length} line(s) measuring \` + lines.map((line) => \`\${Array.from(line).length}/\${cellLen(line)}\`).join(", ") + " characters/cells");
		const rows = lines.map((line) => Array.from(line));
		this.grid = grid;
		this.ascii = ASCII_GRID.test(grid);
		this.top = edgeOf(rows[0]);
		this.headContent = contentOf(rows[1]);
		this.headSeparator = edgeOf(rows[2]);
		this.bodyContent = contentOf(rows[3]);
		this.rowSeparator = edgeOf(rows[4]);
		this.footSeparator = edgeOf(rows[5]);
		this.footContent = contentOf(rows[6]);
		this.bottom = edgeOf(rows[7]);
	}
	/**
	* Renders the top border row for given column widths.
	*/
	getTop(widths, style, edge = true) {
		return this.getEdge(widths, this.top, style, edge);
	}
	/**
	* Renders the separator drawn *above* a row at \`level\` — the head separator
	* under the header, the row separator between body rows, the foot separator
	* above the footer.
	*/
	getRow(widths, level, style, edge = true) {
		return this.getEdge(widths, this.getRowChars(level), style, edge);
	}
	/**
	* The verticals that frame a content row at \`level\` — the counterpart to
	* \`getRow\`, which draws the separator between two such rows.
	*/
	getContentChars(level) {
		switch (level) {
			case "head": return this.headContent;
			case "row":
			case "mid": return this.bodyContent;
			case "foot": return this.footContent;
		}
	}
	/**
	* Renders the bottom border row.
	*/
	getBottom(widths, style, edge = true) {
		return this.getEdge(widths, this.bottom, style, edge);
	}
	/**
	* The box to draw with when the platform cannot render this one as written.
	*
	* \`asciiOnly\` gives up a box that spends non-ASCII glyphs for \`ASCII\`, and
	* leaves the four already-ASCII styles as they are — a caller that chose
	* MARKDOWN or ASCII_DOUBLE_HEAD asked for that frame and it is already
	* drawable, so answering with \`ASCII\` would trade a frame the terminal
	* supports for a different one it equally supports. \`safe\` squares off the
	* rounded corners a legacy Windows terminal draws as blanks.
	*/
	substitute(options = {}) {
		if (options.asciiOnly && !this.ascii) return ASCII;
		if (options.safe) return this.safeSubstitute();
		return this;
	}
	safeSubstitute() {
		return new Box(Array.from(this.grid, (char) => SAFE_SUBSTITUTIONS[char] ?? char).join(""));
	}
	/**
	* The nearest box that spends no special glyphs on a header — what a table
	* with \`showHeader: false\` draws with. A box whose head row already matches
	* its body is its own answer, so this is the identity for fourteen of the
	* nineteen shipped styles.
	*
	* It stands beside \`substitute\` rather than joining it because the two ask
	* unrelated questions: \`substitute\` asks what the *platform* can draw, this
	* asks what the *table* contains. Nothing correlates them, so a caller that
	* wants both wants both, and a shared options bag would only multiply the
	* combinations either one has to reason about. [LAW:no-mode-explosion]
	*
	* [LAW:types-are-the-program] The relation is keyed on the grid, not on
	* object identity as the reference's dict is. A \`Box\` is wholly determined by
	* its grid — that is what the constructor takes and all eight rows derive
	* from — so two boxes with one grid must answer this alike. Identity keying
	* would say otherwise the moment a box arrived by any route but the shipped
	* constant, and \`safeSubstitute\` above builds exactly such a box: a fresh
	* instance carrying an unchanged grid.
	*/
	plainHeaded() {
		return PLAIN_HEADED_SUBSTITUTIONS.find(([headed]) => headed.grid === this.grid)?.[1] ?? this;
	}
	/**
	* [LAW:dataflow-not-control-flow] Every full-width rule the box can draw is
	* this one loop; which rule it is arrives as four characters, not a branch.
	*/
	getEdge(widths, chars, style, edge) {
		const segments = [];
		if (edge) segments.push(new Segment(chars.left, style));
		for (let i = 0; i < widths.length; i++) {
			if (i > 0) segments.push(new Segment(chars.cross, style));
			segments.push(new Segment(chars.horizontal.repeat(widths[i]), style));
		}
		if (edge) segments.push(new Segment(chars.right, style));
		segments.push(Segment.line());
		return segments;
	}
	getRowChars(level) {
		switch (level) {
			case "head": return this.headSeparator;
			case "row": return this.rowSeparator;
			case "foot": return this.footSeparator;
			case "mid": return {
				left: this.bodyContent.left,
				horizontal: " ",
				cross: this.bodyContent.vertical,
				right: this.bodyContent.right
			};
		}
	}
};
var ASCII = new Box("+--+\\n| ||\\n|-+|\\n| ||\\n|-+|\\n|-+|\\n| ||\\n+--+");
var ASCII2 = new Box("+-++\\n| ||\\n+-++\\n| ||\\n+-++\\n+-++\\n| ||\\n+-++");
var ASCII_DOUBLE_HEAD = new Box("+-++\\n| ||\\n+=++\\n| ||\\n+-++\\n+-++\\n| ||\\n+-++");
var SQUARE = new Box("┌─┬┐\\n│ ││\\n├─┼┤\\n│ ││\\n├─┼┤\\n├─┼┤\\n│ ││\\n└─┴┘");
var SQUARE_DOUBLE_HEAD = new Box("┌─┬┐\\n│ ││\\n╞═╪╡\\n│ ││\\n├─┼┤\\n├─┼┤\\n│ ││\\n└─┴┘");
var MINIMAL = new Box("  ╷ \\n  │ \\n╶─┼╴\\n  │ \\n╶─┼╴\\n╶─┼╴\\n  │ \\n  ╵ ");
var MINIMAL_HEAVY_HEAD = new Box("  ╷ \\n  │ \\n╺━┿╸\\n  │ \\n╶─┼╴\\n╶─┼╴\\n  │ \\n  ╵ ");
var MINIMAL_DOUBLE_HEAD = new Box("  ╷ \\n  │ \\n ═╪ \\n  │ \\n ─┼ \\n ─┼ \\n  │ \\n  ╵ ");
new Box("    \\n    \\n ── \\n    \\n    \\n ── \\n    \\n    ");
new Box("    \\n    \\n ── \\n    \\n    \\n    \\n    \\n    ");
new Box("    \\n    \\n ━━ \\n    \\n    \\n ━━ \\n    \\n    ");
new Box(" ── \\n    \\n ── \\n    \\n ── \\n ── \\n    \\n ── ");
var ROUNDED = new Box("╭─┬╮\\n│ ││\\n├─┼┤\\n│ ││\\n├─┼┤\\n├─┼┤\\n│ ││\\n╰─┴╯");
new Box("┏━┳┓\\n┃ ┃┃\\n┣━╋┫\\n┃ ┃┃\\n┣━╋┫\\n┣━╋┫\\n┃ ┃┃\\n┗━┻┛");
new Box("┏━┯┓\\n┃ │┃\\n┠─┼┨\\n┃ │┃\\n┠─┼┨\\n┠─┼┨\\n┃ │┃\\n┗━┷┛");
var HEAVY_HEAD = new Box("┏━┳┓\\n┃ ┃┃\\n┡━╇┩\\n│ ││\\n├─┼┤\\n├─┼┤\\n│ ││\\n└─┴┘");
new Box("╔═╦╗\\n║ ║║\\n╠═╬╣\\n║ ║║\\n╠═╬╣\\n╠═╬╣\\n║ ║║\\n╚═╩╝");
new Box("╔═╤╗\\n║ │║\\n╟─┼╢\\n║ │║\\n╟─┼╢\\n╟─┼╢\\n║ │║\\n╚═╧╝");
new Box("    \\n| ||\\n|-||\\n| ||\\n|-||\\n|-||\\n| ||\\n    ");
/**
* Boxes whose header glyphs differ from their body's, paired with the kin that
* draws the same frame without them. Transcribed from the reference's
* \`PLAIN_HEADED_SUBSTITUTIONS\`; the fourteen styles absent here already draw a
* plain head, and \`plainHeaded\` returns them unchanged.
*/
var PLAIN_HEADED_SUBSTITUTIONS = [
	[HEAVY_HEAD, SQUARE],
	[SQUARE_DOUBLE_HEAD, SQUARE],
	[MINIMAL_HEAVY_HEAD, MINIMAL],
	[MINIMAL_DOUBLE_HEAD, MINIMAL],
	[ASCII_DOUBLE_HEAD, ASCII2]
];
//#endregion
//#region src/core/protocol.ts
/**
* Rendering protocol interfaces — Renderable, Measurable, RenderOptions.
* [LAW:one-source-of-truth] These interfaces are the single authority for the rendering contract.
*/
/**
* The budget a renderable hands the one child filling its space: its own, less
* the \`rows\` it draws itself, and of the same kind.
*/
function insetHeight(height, rows) {
	return height && {
		rows: cellCount(height.rows - rows),
		exact: height.exact
	};
}
/**
* The budget a renderable hands each of several children it stacks: its rows,
* as a ceiling.
*/
function stackedHeight(height) {
	return height && {
		rows: cellCount(height.rows),
		exact: false
	};
}
/**
* The rows a region holds, parsed as a cell count, or \`undefined\` when there
* is no region to fill: a ceiling, no budget, or a region of \`Infinity\` rows,
* which names no count — as an unbounded width resolves to a natural one in
* \`withBoundedWidth\`.
*/
function regionRows(height) {
	return height?.exact && height.rows !== Infinity ? cellCount(height.rows) : void 0;
}
/**
* What came back from a child, held to the region \`height\` names — blank rows
* padded below, overflow cropped from the bottom — or left at its own height
* when \`height\` is no region. This is the shaping a region's setter owes.
*/
function fitHeight(lines, height) {
	const rows = regionRows(height) ?? lines.length;
	const fitted = lines.slice(0, rows);
	while (fitted.length < rows) fitted.push([]);
	return fitted;
}
/**
* The style a \`string | Style\` stands for in this render.
*
* [LAW:single-enforcer] Every renderable resolves a style name here, at render
* time, because only the render knows whose theme it is drawing for. Resolved
* when a renderable was built instead, a name was fixed to the built-in
* defaults before any \`Console\` could offer its theme, and \`new Console({
* theme })\` changed nothing.
*/
function getStyle(options, style) {
	return (options.theme ?? DEFAULT_THEME).resolve(style);
}
/**
* The options a renderable should work from: the caller's, with \`maxWidth\`
* parsed into an actual count of cells.
*
* [LAW:parse-dont-validate] The stamp has to travel, which is the whole reason
* this returns options rather than a number. Parsing \`options.maxWidth\` into a
* local leaves the caller's raw value sitting in \`options\` for whatever the
* renderable forwards it to — and every renderable forwards it, to a child's
* \`render\`, to \`Measurement.get\`, to a nested layout. \`Columns\` was fixed that
* way first and still threw \`Invalid array length\` on a NaN width, because it
* handed the unparsed original to \`Measurement.get\` and got a NaN column count
* back. Replace the field, and nothing downstream can see the number the
* caller actually wrote.
*
* [LAW:single-enforcer] This is the width checkpoint for the render contract.
* There is no second one: a renderable that re-derives its own answer is how
* \`Panel\`, \`Table\`, \`Tree\`, \`Columns\` and \`Layout\` came to disagree about what
* a NaN width means — one collapsed to a cell of garbage, two threw, one
* ignored the request and emitted its full natural width.
*/
function withCellWidth(options) {
	return {
		...options,
		maxWidth: cellCount(options.maxWidth)
	};
}
/**
* The options a renderable should *lay out against*: \`withCellWidth\`, with an
* unbounded offer resolved to the renderable's own natural width.
*
* [LAW:parse-dont-validate] \`cellCount\` cannot finish the job alone. It floors
* a negative width and NaN to zero from the number alone, but \`Infinity\` is not
* a quantity it can floor — the only finite answer is "as wide as this
* renderable's content wants", which is a question about the renderable and not
* about the number. So the parse is completed here, where the renderable is in
* hand, and the stamped options travel exactly as \`withCellWidth\`'s do.
*
* [LAW:single-enforcer] One checkpoint for the whole rule, not one per
* renderable. \`Panel\`, \`Padding\`, \`Columns\` and \`Layout\` each expand into the
* width they are offered, and each independently reached \`" ".repeat(Infinity)\`
* — Columns twice over, since its column *count* is derived from the width too
* and \`new Array(Infinity)\` throws a different error again.
*
* The natural width comes from \`measure\`, which every one of them already
* implements, and the recursion terminates because \`measure\` reports content
* rather than the offer: \`Panel.measure({maxWidth: Infinity})\` is \`{9, 9}\` for
* nine cells of content and frame, not \`{9, Infinity}\`.
*
* So this belongs at the top of \`render\` and never at the top of \`measure\`:
* \`measure\` is the method being asked, and asking it through here would ask it
* with itself. \`measure\` parses with \`withCellWidth\` and reports a natural
* width of its own — that is the half of the contract that makes this half work.
*
* A \`maximum\` of \`Infinity\` means the renderable genuinely cannot answer. Two
* ways in: it wraps a \`Renderable\` with no \`measure\`, so nothing in the tree
* knows how wide the content wants to be; or something inside it asked for an
* unbounded width of its own, as a \`Table\` column declared
* \`{ ratio: Infinity }\` does. [LAW:no-silent-failure] Both are unanswerable
* rather than zero, and saying so names the cause — where \`String.repeat\` and
* \`new Array\` only ever name their own argument.
*/
function withBoundedWidth(options, self) {
	const parsed = withCellWidth(options);
	if (Number.isFinite(parsed.maxWidth)) return parsed;
	const natural = self.measure(parsed).maximum;
	if (!Number.isFinite(natural)) throw new RangeError("maxWidth is unbounded and this renderable has no natural width to fall back on: its content does not implement measure(), or something inside it asked for an unbounded width of its own. Render it at a finite width, or give the content a measure() that reports a finite maximum.");
	return {
		...parsed,
		maxWidth: cellCount(natural)
	};
}
function isRenderable(obj) {
	return typeof obj === "object" && obj !== null && "render" in obj && typeof obj.render === "function";
}
function isMeasurable(obj) {
	return typeof obj === "object" && obj !== null && "measure" in obj && typeof obj.measure === "function";
}
//#endregion
//#region src/core/measure.ts
/**
* Measurement — min/max cell width calculation for renderables.
*/
var Measurement = class Measurement {
	minimum;
	maximum;
	constructor(minimum, maximum) {
		this.minimum = minimum;
		this.maximum = maximum;
	}
	get span() {
		return this.maximum - this.minimum;
	}
	/**
	* A range with no cell meaning becomes one with the nearest meaning there is:
	* negative floors to zero, an inverted pair collapses to its ceiling, and NaN
	* reads as zero cells the same way \`cellCount\` reads it.
	*
	* NaN and Infinity are not treated alike here, and the difference is the whole
	* point. \`Infinity\` is a maximum a renderable means — \`Table\` reports it when
	* a column asks for every cell there is, and \`withBoundedWidth\` throws on it
	* so a caller learns their offer was unanswerable. Flooring it to zero would
	* turn that loud failure into a table measured at no width at all.
	*/
	normalize() {
		const cells = (n) => Number.isNaN(n) ? 0 : n;
		const min = Math.max(0, Math.min(cells(this.minimum), cells(this.maximum)));
		const max = Math.max(0, cells(this.maximum));
		return new Measurement(min, max);
	}
	withMaximum(width) {
		return new Measurement(Math.min(this.minimum, width), Math.min(this.maximum, width));
	}
	withMinimum(width) {
		const min = Math.max(this.minimum, width);
		const max = Math.max(this.maximum, min);
		return new Measurement(min, max);
	}
	clamp(minWidth, maxWidth) {
		return new Measurement(Math.min(Math.max(this.minimum, minWidth), maxWidth), Math.min(Math.max(this.maximum, minWidth), maxWidth));
	}
	static get(options, measurable) {
		if (options.maxWidth < 1) return new Measurement(0, 0);
		const { minimum, maximum } = measurable.measure(options);
		return new Measurement(minimum, Math.min(maximum, options.maxWidth)).normalize();
	}
};
//#endregion
//#region src/core/wrap.ts
/**
* Word wrapping: the offsets one logical line is cut at so its pieces fit a
* cell budget.
*
* This is deliberately not in \`cells.ts\` next door. That module answers
* geometry — how wide is this, where does cell column N fall — and knows
* nothing about language. This one answers where a line may *break*, which is
* a fact about words, and the only thing it borrows from geometry is how to
* measure one.
*
* It returns offsets rather than pieces because the caller holds styled
* \`Segment[]\`, not a string: cutting the text here would drop every span
* attached to it. Offsets are the one representation both sides can act on —
* \`Segment.divide\` cuts the styled line at exactly the places this function
* found in the plain one.
*
* Wrapping is the *first* step, and overflow is the last resort applied to a
* line still too wide once wrapping is done. That order is the whole reason a
* long sentence in a table cell grows the row while an unbreakable word in the
* same cell still ellipsizes.
*/
/**
* Each word of \`text\` in order, where a "word" carries its own trailing
* whitespace — the run of spaces that follows it belongs to it, because that
* is the whitespace a break at the *next* word leaves hanging past the edge.
*
* The matches tile the text: each begins exactly where the last ended, so a
* caller can track absolute offsets by accumulating widths alone. Text with no
* non-whitespace character yields nothing, which is the honest answer — there
* is nowhere to break.
*/
function* words(text) {
	const re = /\\s*\\S+\\s*/y;
	for (let match = re.exec(text); match !== null; match = re.exec(text)) yield match[0];
}
/**
* A word chopped into pieces of at most \`width\` cells, as the reference chops
* it.
*
* \`chopCells\` next door and Rich's \`chop_cells\` disagree in exactly one place.
* Rich opens a new line for any glyph that does not fit and emits whatever line
* it was already on, so a word beginning with a glyph wider than the entire
* canvas folds with an empty piece in front of it — and that piece reaches the
* output as a blank line. \`chopCells\` force-takes the glyph instead and never
* returns an empty piece.
*
* Restoring the blank is what keeps \`test/core/text-wrap.golden.txt\`
* regenerable from the reference. A fixture is only an oracle while the command
* in its header reproduces it byte for byte; smoothing away one byte the
* reference emits costs that, everywhere, to tidy a blank line reachable only
* by folding a two-cell glyph onto a one-cell canvas.
*/
function foldWord(word, width) {
	const pieces = chopCells(word, width);
	return cellLen(pieces[0]) > width ? ["", ...pieces] : pieces;
}
/**
* The cell offsets \`text\` should be cut at to wrap it into lines of at most
* \`width\` cells, for \`Segment.divide\` to apply to the styled line.
*
* \`fold\` decides what happens to a word that fits on no line at all: folded,
* it is chopped across as many lines as it needs; unfolded, it is left whole
* on its own line for the caller's overflow method to cut. Only the \`fold\`
* overflow method folds — \`crop\` and \`ellipsis\` want the word intact so they
* can truncate it, which is what makes an unbreakable word ellipsize while the
* sentence around it merely wraps.
*
* Requires \`width >= 1\`. A zero-cell canvas gets no cuts, because "no cut
* fits" and "no cell fits" are different facts and only one of them is a list
* of offsets — the caller answers the second one by cropping the single
* uncut piece to nothing, which is what every overflow method does there.
*/
function divideLine(text, width, options) {
	if (width <= 0) return [];
	const cuts = [];
	const cutAt = (cell) => {
		if (cell > 0) cuts.push(asCellCol(cell));
	};
	let used = 0;
	let wordStart = 0;
	for (const word of words(text)) {
		const wordWidth = cellLen(word.trimEnd());
		if (width - used >= wordWidth) used += cellLen(word);
		else if (options.fold && wordWidth > width) {
			const pieces = foldWord(word, width);
			let pieceStart = wordStart;
			for (let index = 0; index < pieces.length; index += 1) {
				cutAt(pieceStart);
				const piece = pieces[index];
				if (index === pieces.length - 1) used = cellLen(piece);
				else pieceStart += cellLen(piece);
			}
		} else {
			cutAt(wordStart);
			used = cellLen(word);
		}
		wordStart += cellLen(word);
	}
	return cuts;
}
//#endregion
//#region src/core/osc8.ts
/**
* The OSC 8 hyperlink wire grammar — which bytes may not appear inside a
* link, how a link becomes bytes, and how bytes are read back as a link.
*
* [LAW:one-source-of-truth] The producer (\`segmentsToString\`, the one encoder
* every link reaches the wire through) opens a link with \`osc8Open\` and closes
* it with \`OSC8_CLOSE\`; every consumer that reads rendered bytes (a width measure, a
* test extracting URLs) matches them with \`OSC8\`; the data-model boundary
* (RichText) cleans URLs with \`stripOscTerminators\`. All four read the one
* terminator set below, so the bytes a sanitizer removes and the bytes a
* reader stops at cannot disagree.
*
* [LAW:locality-or-seam] This module depends on nothing; every consumer
* imports downward.
*
* The \`id=\` parameter is what makes one link hover as one link. A terminal
* treats cells as the same hyperlink when they share BOTH the URI and the id
* (the OSC 8 spec, and VTE / iTerm2 / kitty / WezTerm alike); without an id,
* each open sequence is its own link. The coalescer can only share one OSC 8
* pair across a run of identical SGR, so a link whose text changes style
* mid-span — a bold glyph beside plain text, a padded cell — is emitted as
* several pairs, and would highlight piecewise on hover.
*
* [LAW:types-are-the-program] The id is a pure function of the URI, so the
* byte stream stays a pure function of (style, text, destination): no counter,
* no construction-order dependence. The consequence is deliberate: two spans
* with the same URI hover as one link wherever they sit on screen, adjacent
* or not — a click on either does the same thing, so they ARE one link.
* Because terminals key on the (id, URI) PAIR, a hash collision between two
* different URIs merges nothing — the URIs still differ — so a 32-bit hash is
* exact, not approximate.
*/
/**
* The bytes that prematurely terminate an OSC 8 sequence: ESC (\`\\x1b\`, which
* begins ST \`ESC \\\`), BEL (\`\\x07\`), and the 8-bit ST (\`\\x9c\`).
*/
var TERMINATORS = "\\\\x1b\\\\x07\\\\x9c";
var TERMINATOR_RE = new RegExp(\`[\${TERMINATORS}]\`, "g");
/** Remove every byte that could break a URL out of its OSC 8 wrap. */
function stripOscTerminators(url) {
	return url.replace(TERMINATOR_RE, "");
}
var utf8 = new TextEncoder();
/**
* FNV-1a, 32-bit, over the URL's UTF-8 bytes, as 8 lowercase hex digits — a
* legal \`id=\` value (no \`:\`/\`;\`). UTF-8 rather than UTF-16 code units, so any
* other runtime computing standard FNV-1a over the same URL gets the same id.
*/
function linkId(url) {
	let h = 2166136261;
	for (const byte of utf8.encode(url)) {
		h ^= byte;
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(16).padStart(8, "0");
}
/**
* The bytes that open a hyperlink to \`url\`.
*
* [LAW:single-enforcer] Wire-byte trust boundary — the URL is sanitized at
* the one place it becomes an OSC 8 sequence, whichever upstream API attached
* it to the Style (RichText sanitizes at its data-model boundary too; a Style
* built directly with \`new Style({ link })\` reaches here unsanitized).
*/
function osc8Open(url) {
	const clean = stripOscTerminators(url);
	return \`\\x1b]8;id=\${linkId(clean)};\${clean}\\x1b\\\\\`;
}
/** The bytes that close the current hyperlink. */
var OSC8_CLOSE = "\\x1B]8;;\\x1B\\\\";
/**
* Matches one OSC 8 sequence — an open or a close — terminated by \`ESC \\\`,
* BEL, or the 8-bit ST. Group 1 is the params, group 2 the URI; both are empty
* on a close. To read bytes back use \`osc8Sequences\`; this pattern is exported
* for composing into a larger one (a width measure's zero-width alternation).
*/
var OSC8 = new RegExp(\`\\\\x1b\\\\]8;([^;\${TERMINATORS}]*);([^\${TERMINATORS}]*)(?:\\\\x1b\\\\\\\\|\\\\x07|\\\\x9c)\`);
new RegExp(OSC8.source, "g");
//#endregion
//#region src/core/text.ts
/**
* RichText — styled text with spans. The primary text type for the library.
*/
var CONTROL_CHARS_RE = /[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g;
function stripControlChars(text) {
	return text.replace(CONTROL_CHARS_RE, "");
}
var TRAILING_WHITESPACE_RE = /\\s+$/;
/**
* The plain text of one line of segments, in the coordinate system
* \`divideLine\` and \`Segment.divide\` share: cell offsets into the styled line
* are cell offsets into this string. [LAW:one-source-of-truth] for that
* correspondence — the offsets are found in this text and applied to the
* segments it came from.
*/
function plainOf(line) {
	return line.map((segment) => segment.text).join("");
}
/**
* The cells of trailing whitespace on a wrapped line.
*
* A wrap cuts before a word, so the line it closes ends with the whitespace
* that followed *its* last word — padding the break created, not content the
* author wrote. Measuring it is what lets the overflow method tell "this line
* was cut" from "this line ends in spaces" and stamp an ellipsis only on the
* first, and what keeps a centred line from drifting half a space off true.
*
* Asked of the line's text rather than walked back through its segments,
* because where a line ends is a fact about the characters and not about how
* they were split. Walking the segments made it a fact about both: it read a
* segment with no trailing whitespace as content and stopped there, which an
* empty segment also looks like — and a crop leaves one behind. A styled line
* whose last cells were cropped therefore reported no hanging whitespace at
* all and was centred as though it were content to the edge, so a span landing
* anywhere in a wrap's whitespace un-centred the line it closed.
*/
function hangingWhitespace(line) {
	return cellLen(TRAILING_WHITESPACE_RE.exec(plainOf(line))?.[0] ?? "");
}
function sanitizeStyleLink(style) {
	const link = style.link;
	if (!link) return style;
	const cleaned = stripOscTerminators(link);
	if (cleaned === link) return style;
	return style.withLink(cleaned);
}
/**
* A style as a RichText keeps it: as given. A name stays a name because what
* it stands for depends on the theme of the render that draws it, which no
* RichText knows when the name arrives — the reference stores span styles the
* same way. A string holds no link until it is parsed, so only a \`Style\` has
* one to sanitize here.
*/
function admitStyle(style) {
	return style instanceof Style ? sanitizeStyleLink(style) : style;
}
/** A style that adds nothing: the empty definition, or a null \`Style\`. */
function isEmptyStyle(style) {
	return style instanceof Style ? style.isNull : style === "";
}
/**
* The style a stored \`string | Style\` stands for in this render.
*
* A parsed string can carry a link, so the result is sanitized on the way out
* as well.
*/
function resolveStyle(options, style) {
	return sanitizeStyleLink(style instanceof Style ? style : resolveDefinition(options, style));
}
/**
* [LAW:single-enforcer] Styling is non-critical — an unrecognized style name
* (typo, missing theme key, bad concatenation) degrades to unstyled rather
* than crashing, as the reference's \`Text.render\` resolves with a null
* default. Absorb only StyleSyntaxError here; other errors are genuine bugs
* and must surface. The render's \`onStyleError\` hears about each one first,
* and a handler that throws turns the degrade into a failure.
*/
function resolveDefinition(options, style) {
	try {
		return getStyle(options, style);
	} catch (err) {
		if (!(err instanceof StyleSyntaxError)) throw err;
		options.onStyleError?.(err, style);
		return NULL_STYLE;
	}
}
var Span = class Span {
	start;
	end;
	style;
	constructor(start, end, style) {
		this.start = start;
		this.end = end;
		this.style = style;
	}
	get hasLength() {
		return this.end > this.start;
	}
	toString() {
		return \`Span(\${this.start}, \${this.end})\`;
	}
	split(offset) {
		if (offset <= this.start || offset >= this.end) return [this, void 0];
		return [new Span(this.start, offset, this.style), new Span(offset, this.end, this.style)];
	}
	move(delta) {
		return new Span(this.start + delta, this.end + delta, this.style);
	}
	rightCrop(offset) {
		if (offset >= this.end) return this;
		return new Span(this.start, Math.min(this.end, offset), this.style);
	}
	extend(count) {
		return new Span(this.start, this.end + count, this.style);
	}
};
var RichText = class RichText {
	_text;
	_spans;
	_style;
	_justify;
	_overflow;
	_end;
	_tabSize;
	_noWrap;
	constructor(text, options) {
		this._text = text ? stripControlChars(text) : "";
		this._spans = [];
		this._style = admitStyle(options?.style ?? NULL_STYLE);
		this._justify = options?.justify;
		this._overflow = options?.overflow;
		this._end = options?.end ?? "\\n";
		this._tabSize = options?.tabSize ?? 8;
		this._noWrap = options?.noWrap ?? false;
	}
	get plain() {
		return this._text;
	}
	set plain(value) {
		const sanitized = stripControlChars(value);
		this._text = sanitized;
		const len = sanitized.length;
		this._spans = this._spans.map((s) => s.end > len ? new Span(s.start, Math.min(s.end, len), s.style) : s).filter((s) => s.start < len);
	}
	get length() {
		return this._text.length;
	}
	get cellLength() {
		return cellLen(this._text);
	}
	get hasContent() {
		return this._text.length > 0;
	}
	/** The base style every span layers over: a \`Style\`, or a name resolved at render. */
	get style() {
		return this._style;
	}
	set style(value) {
		this._style = admitStyle(value);
	}
	get justify() {
		return this._justify;
	}
	set justify(value) {
		this._justify = value;
	}
	get overflow() {
		return this._overflow;
	}
	set overflow(value) {
		this._overflow = value;
	}
	get end() {
		return this._end;
	}
	set end(value) {
		this._end = value;
	}
	get noWrap() {
		return this._noWrap;
	}
	set noWrap(value) {
		this._noWrap = value;
	}
	get spans() {
		return this._spans;
	}
	/**
	* This text's own style, spans aside, as the render drawing it resolves it.
	* A name the render's theme does not define resolves to no style, because
	* text forgives a missing name.
	*/
	resolvedStyle(options) {
		return resolveStyle(options, this._style);
	}
	/**
	* The style of the cell-column at the named edge — base style merged with
	* any spans covering the leftmost (side="left") or rightmost (side="right")
	* character.
	*
	* [LAW:locality-or-seam] Used by \`Joiner\`s to paint the transition between
	* adjacent \`Strip\` items. Joiners only ever need the column adjacent to
	* them, so the cell type exposes that column rather than constraining its
	* interior to be uniform. For RichText with uniform styling, both edges
	* return the same style; for RichText with edge variation, each edge
	* accurately reports the column the joiner actually meets.
	*
	* Position is by character index (not cell column). For wide-character
	* text, the last character occupies the rightmost cell column — the bg
	* of that character covers both columns, so character-index lookup gives
	* the correct edge color.
	*
	* Takes the render's options because the edge is reported as it will be
	* drawn, and a style name draws as whatever the render's theme says.
	*/
	edgeStyle(side, options) {
		const base = this.resolvedStyle(options);
		if (this._text.length === 0) return base;
		const pos = side === "left" ? 0 : this._text.length - 1;
		let result = base;
		for (const span of this._spans) if (span.start <= pos && pos < span.end) result = result.add(resolveStyle(options, span.style));
		return result;
	}
	append(content, style) {
		if (content instanceof RichText) {
			if (style !== void 0) throw new Error("Style argument must not be provided when appending RichText");
			const offset = this._text.length;
			this._text += content._text;
			for (const span of content._spans) this._spans.push(span.move(offset));
			return this;
		}
		const sanitized = stripControlChars(content);
		const start = this._text.length;
		this._text += sanitized;
		this._addSpan(start, this._text.length, style ?? "");
		return this;
	}
	contains(needle) {
		const searchText = needle instanceof RichText ? needle._text : needle;
		return this._text.includes(searchText);
	}
	at(index) {
		const resolved = index < 0 ? this._text.length + index : index;
		if (this._text[resolved] === void 0) return new RichText("");
		return this.slice(resolved, resolved + 1);
	}
	slice(start, end) {
		const text = this._text;
		const len = text.length;
		const s = start ?? 0;
		const e = end ?? len;
		const resolvedStart = s < 0 ? Math.max(0, len + s) : Math.min(s, len);
		const resolvedEnd = e < 0 ? Math.max(0, len + e) : Math.min(e, len);
		if (resolvedStart >= resolvedEnd) return this.blankCopy();
		const slicedText = text.slice(resolvedStart, resolvedEnd);
		const result = this.blankCopy(slicedText);
		for (const span of this._spans) {
			const spanStart = Math.max(span.start, resolvedStart) - resolvedStart;
			const spanEnd = Math.min(span.end, resolvedEnd) - resolvedStart;
			if (spanStart < spanEnd) result._spans.push(new Span(spanStart, spanEnd, span.style));
		}
		return result;
	}
	/**
	* The one way a span enters this text. [LAW:single-enforcer] An empty style
	* adds nothing, as the reference's \`if style:\` has it, and every other style
	* is admitted as given.
	*/
	_addSpan(start, end, style) {
		if (isEmptyStyle(style)) return;
		this._spans.push(new Span(start, end, admitStyle(style)));
	}
	stylize(style, start, end) {
		const len = this._text.length;
		const s = start !== void 0 ? start < 0 ? len + start : start : 0;
		const e = end !== void 0 ? end < 0 ? len + end : end : len;
		if (s >= e || s >= len || e <= 0) return this;
		const clampedStart = Math.max(0, s);
		const clampedEnd = Math.min(len, e);
		this._addSpan(clampedStart, clampedEnd, style);
		return this;
	}
	highlightRegex(pattern, style) {
		const text = this._text;
		let count = 0;
		const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
		const re = new RegExp(pattern.source, flags);
		let match;
		while ((match = re.exec(text)) !== null) {
			if (match[0].length === 0) {
				re.lastIndex++;
				continue;
			}
			if (match.groups) {
				let searchFrom = 0;
				for (const [groupName, groupValue] of Object.entries(match.groups)) if (groupValue !== void 0) {
					const posInMatch = match[0].indexOf(groupValue, searchFrom);
					if (posInMatch >= 0) {
						const groupStart = match.index + posInMatch;
						this._addSpan(groupStart, groupStart + groupValue.length, groupName);
						searchFrom = posInMatch + groupValue.length;
					}
				}
				count++;
				continue;
			}
			this._addSpan(match.index, match.index + match[0].length, style ?? "");
			count++;
		}
		return count;
	}
	highlightWords(words, style, options) {
		const caseSensitive = options?.caseSensitive !== false;
		let count = 0;
		for (const word of words) {
			if (word.length === 0) continue;
			const escaped = word.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
			const flags = caseSensitive ? "g" : "gi";
			const re = new RegExp(\`\\\\b\${escaped}\\\\b\`, flags);
			let match;
			while ((match = re.exec(this._text)) !== null) {
				this._addSpan(match.index, match.index + match[0].length, style);
				count++;
			}
		}
		return count;
	}
	copy() {
		const result = new RichText(this._text, {
			style: this._style,
			justify: this._justify,
			overflow: this._overflow,
			end: this._end,
			tabSize: this._tabSize,
			noWrap: this._noWrap
		});
		result._spans = this._spans.slice();
		return result;
	}
	blankCopy(text) {
		return new RichText(text ?? "", {
			style: this._style,
			justify: this._justify,
			overflow: this._overflow,
			end: this._end,
			tabSize: this._tabSize,
			noWrap: this._noWrap
		});
	}
	split(separator) {
		const sep = separator ?? "\\n";
		const text = this._text;
		const parts = [];
		let start = 0;
		while (true) {
			const idx = text.indexOf(sep, start);
			if (idx === -1) {
				parts.push(this.slice(start));
				break;
			}
			parts.push(this.slice(start, idx));
			start = idx + sep.length;
		}
		return parts;
	}
	divide(offsets) {
		if (offsets.length === 0) return [this.copy()];
		const parts = [];
		let prev = 0;
		for (const offset of offsets) {
			parts.push(this.slice(prev, offset));
			prev = offset;
		}
		parts.push(this.slice(prev));
		return parts;
	}
	rstrip() {
		const trimmed = this._text.replace(/\\s+$/, "");
		if (trimmed.length < this._text.length) this.plain = trimmed;
		return this;
	}
	pad(count, char) {
		const padding = (char ?? " ").repeat(count);
		this._spans = this._spans.map((s) => s.move(count));
		this._text = padding + this._text + padding;
		return this;
	}
	padLeft(count, char) {
		const c = char ?? " ";
		this._spans = this._spans.map((s) => s.move(count));
		this._text = c.repeat(count) + this._text;
		return this;
	}
	padRight(count, char) {
		const c = char ?? " ";
		this._text += c.repeat(count);
		return this;
	}
	setLength(length) {
		if (this._text.length < length) this._text += " ".repeat(length - this._text.length);
		else if (this._text.length > length) this.plain = this._text.slice(0, length);
		return this;
	}
	extendStyle(count) {
		const oldLen = this._text.length;
		this._text += " ".repeat(count);
		this._spans = this._spans.map((s) => s.end === oldLen ? s.extend(count) : s);
		return this;
	}
	/**
	* Truncate to a fixed cell-column width, in one of three modes.
	*
	* - \`mode: "right"\` (default) \\u2014 drop characters from the right; append
	*   \`marker\` (if any) at the cut.
	* - \`mode: "left"\` \\u2014 drop characters from the left; prepend \`marker\` at
	*   the cut.
	* - \`mode: "middle"\` \\u2014 keep equal halves from both ends; place \`marker\`
	*   in the middle.
	*
	* Marker default is \`"\\u2026"\`. Pass \`marker: ""\` for raw cropping without an
	* indicator glyph.
	*
	* Spans are preserved through the cut: characters that survive keep their
	* styling; the marker (if any) is inserted as plain text with no span.
	* Use \`stylize(...)\` on the result to color the marker if needed.
	*
	* [LAW:dataflow-not-control-flow] mode/marker/width all flow as values;
	* the walk is the same shape regardless. No "if truncated then rebuild"
	* branch \\u2014 the unchanged path just early-returns when content fits.
	*/
	truncate(width, options) {
		if (this.cellLength <= width) return this;
		const mode = options?.mode ?? "right";
		const marker = options?.marker ?? "…";
		const markerWidth = cellLen(marker);
		if (width <= 0) {
			this.plain = "";
			return this;
		}
		const budget = Math.max(0, width - markerWidth);
		if (mode === "right") {
			this._cropRightTo(budget);
			if (marker) this._text += marker;
			return this;
		}
		if (mode === "left") {
			this._cropLeftTo(budget);
			if (marker) {
				this._spans = this._spans.map((s) => s.move(marker.length));
				this._text = marker + this._text;
			}
			return this;
		}
		const leftBudget = Math.floor(budget / 2);
		const rightBudget = budget - leftBudget;
		const leftEndCharIdx = this._cellPrefixCharLength(leftBudget);
		const rightStartCharIdx = this._cellSuffixStartCharIndex(rightBudget);
		const leftText = this._text.slice(0, leftEndCharIdx);
		const rightText = this._text.slice(rightStartCharIdx);
		const droppedStart = leftEndCharIdx;
		const droppedEnd = rightStartCharIdx;
		const shift = marker.length - (droppedEnd - droppedStart);
		const newSpans = [];
		for (const s of this._spans) if (s.end <= droppedStart) newSpans.push(s);
		else if (s.start >= droppedEnd) newSpans.push(s.move(shift));
		else {
			if (s.start < droppedStart) newSpans.push(new Span(s.start, droppedStart, s.style));
			if (s.end > droppedEnd) newSpans.push(new Span(droppedEnd + shift, s.end + shift, s.style));
		}
		this._text = leftText + marker + rightText;
		this._spans = newSpans;
		return this;
	}
	_cropRightTo(targetWidth) {
		const charIdx = this._cellPrefixCharLength(targetWidth);
		this.plain = this._text.slice(0, charIdx);
	}
	_cropLeftTo(targetWidth) {
		const charIdx = this._cellSuffixStartCharIndex(targetWidth);
		const shift = -charIdx;
		this._spans = this._spans.map((s) => {
			if (s.end <= charIdx) return void 0;
			return new Span(Math.max(0, s.start + shift), s.end + shift, s.style);
		}).filter((s) => s !== void 0);
		this._text = this._text.slice(charIdx);
	}
	/** Number of char-index code units that fit within \`targetWidth\` cell columns from the left. */
	_cellPrefixCharLength(targetWidth) {
		let width = 0;
		let charIndex = 0;
		for (const char of this._text) {
			const charWidth = cellLen(char);
			if (width + charWidth > targetWidth) break;
			width += charWidth;
			charIndex += char.length;
		}
		return charIndex;
	}
	/** Char-index at which the suffix of \`targetWidth\` cell columns starts. */
	_cellSuffixStartCharIndex(targetWidth) {
		const chars = [...this._text];
		let width = 0;
		let kept = 0;
		for (let i = chars.length - 1; i >= 0; i--) {
			const w = cellLen(chars[i]);
			if (width + w > targetWidth) break;
			width += w;
			kept += chars[i].length;
		}
		return this._text.length - kept;
	}
	align(justify, width) {
		const currentWidth = this.cellLength;
		if (currentWidth >= width) return this;
		const gap = width - currentWidth;
		switch (justify) {
			case "left":
				this.padRight(gap);
				break;
			case "right":
				this.padLeft(gap);
				break;
			case "center": {
				const leftPad = Math.floor(gap / 2);
				const rightPad = gap - leftPad;
				this.padLeft(leftPad);
				this.padRight(rightPad);
				break;
			}
		}
		return this;
	}
	removeSuffix(suffix) {
		if (this._text.endsWith(suffix)) this.plain = this._text.slice(0, -suffix.length);
		return this;
	}
	appendTokens(tokens) {
		for (const [text, style] of tokens) this.append(text, style);
		return this;
	}
	static assemble(parts, options) {
		const result = new RichText("", { style: options?.style });
		for (const part of parts) if (typeof part === "string") result.append(part);
		else if (part instanceof RichText) result.append(part);
		else {
			const [text, style] = part;
			result.append(text, style);
		}
		return result;
	}
	static styled(text, style) {
		const result = new RichText(text);
		result.stylize(style);
		return result;
	}
	/**
	* Concatenate a sequence of \`RichText\` fragments into a single \`RichText\`,
	* flattening each fragment's wrapping \`style\` onto a span over that
	* fragment's range so downstream rendering preserves the original styling.
	*
	* Designed for the template engine's \`RichText[]\` output: a top-level
	* \`{{ red "x" }}{{ blue "y" }}\` evaluates to two fragments — one with
	* wrapping \`style = red\`, one with \`blue\` — and consumers that want a
	* single styled string for downstream rendering need both styles
	* preserved as spans on the concatenated result. The plain \`append()\`
	* propagates spans only, so this static does the additional work of
	* lifting \`frag.style\` into a span before appending.
	*
	* Empty input → empty \`RichText\` with \`end: ""\`. Caller can override
	* \`end\` (defaults to \`""\` — the engine-output case rarely wants a
	* trailing newline added by the container).
	*/
	static fromFragments(fragments, options) {
		const result = new RichText("", { end: options?.end ?? "" });
		for (const frag of fragments) {
			const start = result.length;
			result.append(frag.plain);
			result.stylize(frag.style, start, result.length);
			for (const span of frag.spans) result.stylize(span.style, start + span.start, start + span.end);
		}
		return result;
	}
	*render(options) {
		const text = this._expandTabs(this._text);
		const base = this.resolvedStyle(options);
		const allSegments = this._buildSegments(text, base, options);
		const logicalLines = Segment.splitLines(allSegments);
		const maxWidth = cellCount(withBoundedWidth(options, this).maxWidth);
		const overflow = this._overflow ?? options.overflow ?? "fold";
		const justify = this._justify ?? options.justify;
		const budget = this._noWrap || (options.noWrap ?? false) ? cellCount(Infinity) : maxWidth;
		const endsWithNewline = text.endsWith("\\n");
		for (let index = 0; index < logicalLines.length; index += 1) {
			const line = logicalLines[index];
			const terminateLine = index < logicalLines.length - 1 || endsWithNewline;
			const cuts = divideLine(plainOf(line), budget, { fold: overflow === "fold" });
			const wrapped = Segment.divide(line, cuts);
			const placed = this._justifyLines(wrapped.map((piece) => [...this._fitLine(piece, budget, overflow)]), maxWidth, base, justify);
			for (let piece = 0; piece < placed.length; piece += 1) {
				yield* placed[piece];
				if (piece < placed.length - 1 || terminateLine) yield Segment.line();
			}
		}
		if (this._end) yield new Segment(this._end);
	}
	measure(options) {
		const lines = this._expandTabs(this._text).split("\\n");
		let maxLineWidth = 0;
		let maxWordWidth = 0;
		for (const line of lines) {
			const lineWidth = cellLen(line);
			maxLineWidth = Math.max(maxLineWidth, lineWidth);
			const words = line.split(/\\s+/);
			for (const word of words) if (word.length > 0) maxWordWidth = Math.max(maxWordWidth, cellLen(word));
		}
		const ceiling = cellCount(options.maxWidth);
		return {
			minimum: Math.min(maxWordWidth, ceiling),
			maximum: Math.min(maxLineWidth, ceiling)
		};
	}
	_expandTabs(text) {
		if (!text.includes("	")) return text;
		return text.replace(/\\t/g, " ".repeat(this._tabSize));
	}
	/**
	* The rendered text cut at every span edge, each piece carrying the base
	* style plus every span covering it.
	*
	* Walked span-first rather than piece-first, and that direction is the whole
	* performance argument. The pieces are cut at the span edges themselves, so
	* a span covers a piece exactly when it covers the piece's first character —
	* which makes each span's run of pieces a contiguous range it can be written
	* into once, instead of a question every piece asks of every span. The
	* piece-first form charged \`spans x pieces\`, and the pieces are themselves
	* cut by the spans, so anything styling densely paid the square in ordinary
	* use: 8,000 one-character spans took 211ms where 1,000 took 3.2ms. Every
	* \`Highlighter\` over a large value reaches that, and so does \`Pretty\`, whose
	* indent guides emit a span per indent character.
	*
	* Span-first is also what keeps the composition honest, for free. \`Style.add\`
	* is order-dependent and the last writer wins, so the pieces have to fold
	* their styles in \`_spans\` order — which iterating \`_spans\` is, and which a
	* sweep ordered by position would have had to reconstruct.
	*
	* [LAW:dataflow-not-control-flow] A span covering nothing — empty, reversed,
	* or entirely past the text — still cuts the text where its edges land, as it
	* always did, and then folds into no piece at all: its range comes out empty
	* and no case handles it.
	*/
	_buildSegments(text, base, options) {
		const clamp = (offset) => Math.max(0, Math.min(offset, text.length));
		const positions = /* @__PURE__ */ new Set([0, text.length]);
		for (const span of this._spans) {
			positions.add(clamp(span.start));
			positions.add(clamp(span.end));
		}
		const boundaries = [...positions].sort((a, b) => a - b);
		const pieceAt = new Map(boundaries.map((position, piece) => [position, piece]));
		const styles = boundaries.slice(0, -1).map(() => base);
		for (const span of this._spans) {
			const end = clamp(span.end);
			const style = resolveStyle(options, span.style);
			const opensAt = pieceAt.get(clamp(span.start));
			for (let piece = opensAt; boundaries[piece] < end; piece++) styles[piece] = styles[piece].add(style);
		}
		return styles.map((style, piece) => new Segment(text.slice(boundaries[piece], boundaries[piece + 1]), style.isNull ? void 0 : style));
	}
	/**
	* The pieces one logical line wrapped into, each placed in a canvas
	* \`maxWidth\` wide, as Rich's \`Lines.justify\` places them — pinned block for
	* block against the reference in \`test/core/text-justify.test.ts\`.
	*
	* It is handed the whole wrapped line because \`full\` is the one mode a
	* piece cannot answer alone: the reference leaves a paragraph's last line
	* ragged, so where the piece sits decides its answer where the other three
	* modes need only the piece itself. The set that decides "last" is this one
	* and not the whole render — \`Text.wrap\` calls \`Lines.justify\` once per
	* *logical* line — and \`Segment.divide\` already handed it over whole.
	*/
	_justifyLines(lines, maxWidth, base, justify) {
		if (justify !== "full") return lines.map((line) => [...this._justifyLine(line, maxWidth, justify)]);
		return lines.map((line, index) => index === lines.length - 1 ? line : this._fillLine(line, maxWidth, base));
	}
	/**
	* One line placed in a canvas \`maxWidth\` wide.
	*
	* Centre and right align on the line's *content*. The whitespace a wrap
	* leaves on the end of the line it closed is the break's own padding, not
	* text, and aligning around it pushes the text half a gap off true — a
	* centred title that wraps drifts left on every line that happens to end in
	* a space. Left keeps that whitespace, because there it is already on the
	* side the padding goes.
	*
	* \`undefined\` is not \`"left"\`: it is Rich's \`"default"\`, which places the
	* line without padding it at all. That distinction is what lets a soft-wrapped
	* \`Console.print\` leave its lines at their natural width.
	*/
	*_justifyLine(line, maxWidth, justify) {
		switch (justify) {
			case "center":
			case "right": {
				const body = Segment.adjustLineLength(line, Segment.getLineLength(line) - hangingWhitespace(line), void 0, false);
				const gap = Math.max(maxWidth - Segment.getLineLength(body), 0);
				const leftPad = justify === "center" ? Math.floor(gap / 2) : gap;
				if (leftPad > 0) yield new Segment(" ".repeat(leftPad));
				yield* body;
				const rightPad = gap - leftPad;
				if (rightPad > 0) yield new Segment(" ".repeat(rightPad));
				break;
			}
			case "left":
				yield* Segment.adjustLineLength(line, Math.max(maxWidth, Segment.getLineLength(line)));
				break;
			default: yield* line;
		}
	}
	/**
	* One line of a wrapped paragraph, its gaps widened until it fills the
	* canvas — what \`justify: "full"\` promises, and what the reference's
	* \`Lines.justify\` does to every line of a paragraph but the last.
	*
	* Slack goes in a cell at a time, starting at the rightmost gap and walking
	* left, round and round until the line is full. That order is the
	* reference's own, and what it decides is where an odd cell lands when the
	* slack will not divide evenly: the right-hand gaps take it.
	*
	* The words come from the line's *text* split on a single space, with the
	* blank a trailing separator leaves behind dropped — \`Text.split\` and
	* \`String.prototype.split\` agree on that list, empty words and all. Two
	* consequences read as bugs until you know whose they are: a run of n
	* spaces is n gaps rather than one, so spacing an author widened stretches
	* instead of collapsing, and the whitespace a wrap left hanging is a gap
	* like the rest, which is why a filled line does not keep it. Both are
	* pinned in \`text-justify.golden.txt\`, by the \`uneven\` and \`sentence\`
	* blocks respectively.
	*/
	_fillLine(line, maxWidth, base) {
		const plain = plainOf(line);
		const words = plain.split(" ");
		if (plain.endsWith(" ")) words.pop();
		const gaps = words.length - 1;
		const spaces = new Array(gaps).fill(1);
		let filled = words.reduce((total, word) => total + cellLen(word), 0) + gaps;
		for (let turn = 0; filled < maxWidth && gaps > 0; turn = (turn + 1) % gaps) {
			spaces[gaps - 1 - turn] += 1;
			filled += 1;
		}
		const cuts = [];
		let edge = 0;
		for (let index = 0; index < words.length; index += 1) {
			edge += cellLen(words[index]);
			cuts.push(edge);
			edge += 1;
			if (index < gaps) cuts.push(edge);
		}
		const pieces = Segment.divide(line, cuts);
		const edgeStyle = (word, at) => word.filter((segment) => segment.hasText).at(at)?.style ?? base;
		const result = [];
		for (let index = 0; index < words.length; index += 1) {
			result.push(...pieces[index * 2]);
			if (index < gaps) {
				const before = edgeStyle(pieces[index * 2], -1);
				const after = edgeStyle(pieces[index * 2 + 2], 0);
				const style = before.equals(after) ? before : base;
				result.push(new Segment(" ".repeat(spaces[index]), style.isNull ? void 0 : style));
			}
		}
		return result;
	}
	/**
	* One wrapped line cut to the canvas.
	*
	* Everything reaching here already survived wrapping, so the only text still
	* too wide is text no break could help: a word longer than the canvas under
	* a non-folding overflow method, a glyph wider than the budget, or a canvas
	* with no cells at all. That is what makes the overflow method a last
	* resort rather than the first thing a long cell meets.
	*/
	*_fitLine(line, maxWidth, overflow) {
		const lineWidth = Segment.getLineLength(line);
		if (lineWidth - hangingWhitespace(line) <= maxWidth) {
			yield* Segment.adjustLineLength(line, Math.min(lineWidth, maxWidth), void 0, false);
			return;
		}
		if (overflow === "ellipsis" && maxWidth > 0) {
			yield* Segment.adjustLineLength(line, maxWidth - 1, void 0, false);
			yield new Segment("…");
			return;
		}
		yield* Segment.adjustLineLength(line, maxWidth, void 0, false);
	}
};
//#endregion
//#region src/core/render.ts
function segmentToPiece(segment, destination) {
	if (segment.isControl) return void 0;
	if (segment.text.length === 0) return void 0;
	const style = segment.style;
	if (!style || style.isNull) return {
		text: segment.text,
		sgrCodes: "",
		link: void 0
	};
	return {
		text: segment.text,
		sgrCodes: destination.colorSystem === null ? "" : style.toSgrCodes(destination.colorSystem),
		link: destination.hyperlinks ? style.link : void 0
	};
}
/**
* Encodes a sequence of segments as ANSI bytes for \`destination\`, coalescing
* adjacent same-SGR segments under a single SGR open/close pair, with OSC 8
* link pairs nested inside per same-link sub-run.
*/
function segmentsToString(segments, destination) {
	const pieces = [];
	for (const s of segments) {
		const p = segmentToPiece(s, destination);
		if (p) pieces.push(p);
	}
	if (pieces.length === 0) return "";
	const parts = [];
	let i = 0;
	while (i < pieces.length) {
		const sgr = pieces[i].sgrCodes;
		let j = i + 1;
		while (j < pieces.length && pieces[j].sgrCodes === sgr) j++;
		if (sgr.length > 0) parts.push(\`\\x1b[\${sgr}m\`);
		let k = i;
		while (k < j) {
			const link = pieces[k].link;
			let l = k + 1;
			while (l < j && pieces[l].link === link) l++;
			if (link) {
				parts.push(osc8Open(link));
				for (let m = k; m < l; m++) parts.push(pieces[m].text);
				parts.push(OSC8_CLOSE);
			} else for (let m = k; m < l; m++) parts.push(pieces[m].text);
			k = l;
		}
		if (sgr.length > 0) parts.push("\\x1B[0m");
		i = j;
	}
	return parts.join("");
}
//#endregion
//#region src/core/emoji.ts
var EMOJI = {
	smile: "😄",
	laugh: "😂",
	grinning: "😀",
	wink: "😉",
	blush: "😊",
	innocent: "😇",
	heart_eyes: "😍",
	kissing: "😘",
	thinking: "🤔",
	shushing: "🤫",
	zipper_mouth: "🤐",
	raised_eyebrow: "🤨",
	neutral: "😐",
	expressionless: "😑",
	unamused: "😒",
	rolling_eyes: "🙄",
	grimacing: "😬",
	lying: "🤥",
	relieved: "😌",
	pensive: "😔",
	sleepy: "😪",
	sleeping: "😴",
	mask: "😷",
	thermometer_face: "🤒",
	bandage_face: "🤕",
	nauseated: "🤢",
	sneezing: "🤧",
	cold_face: "🥶",
	hot_face: "🥵",
	dizzy_face: "😵",
	exploding_head: "🤯",
	cowboy: "🤠",
	party_face: "🥳",
	sunglasses: "😎",
	nerd: "🤓",
	monocle: "🧐",
	confused: "😕",
	worried: "😟",
	frowning: "☹",
	open_mouth: "😮",
	hushed: "😯",
	astonished: "😲",
	flushed: "😳",
	pleading: "🥺",
	cry: "😢",
	sob: "😭",
	scream: "😱",
	sweat: "😰",
	angry: "😡",
	rage: "🤬",
	devil: "😈",
	skull: "💀",
	poop: "💩",
	clown: "🤡",
	ghost: "👻",
	alien: "👽",
	robot: "🤖",
	wave: "👋",
	raised_hand: "✋",
	ok_hand: "👌",
	pinching: "🤏",
	victory: "✌",
	crossed_fingers: "🤞",
	love_you: "🤟",
	rock_on: "🤘",
	thumbs_up: "👍",
	thumbs_down: "👎",
	fist: "✊",
	punch: "👊",
	left_fist: "🤛",
	right_fist: "🤜",
	clap: "👏",
	raised_hands: "🙌",
	open_hands: "👐",
	palms_up: "🤲",
	handshake: "🤝",
	pray: "🙏",
	writing_hand: "✍",
	nail_polish: "💅",
	muscle: "💪",
	point_up: "☝",
	point_up_2: "👆",
	point_down: "👇",
	point_left: "👈",
	point_right: "👉",
	middle_finger: "🖕",
	heart: "❤",
	orange_heart: "🧡",
	yellow_heart: "💛",
	green_heart: "💚",
	blue_heart: "💙",
	purple_heart: "💜",
	black_heart: "🖤",
	white_heart: "🤍",
	brown_heart: "🤎",
	broken_heart: "💔",
	heart_exclamation: "❣",
	two_hearts: "💕",
	revolving_hearts: "💞",
	heartbeat: "💓",
	heartpulse: "💗",
	sparkling_heart: "💖",
	growing_heart: "💗",
	cupid: "💘",
	gift_heart: "💝",
	fire: "🔥",
	star: "⭐",
	star2: "🌟",
	sparkles: "✨",
	zap: "⚡",
	boom: "💥",
	droplet: "💧",
	rainbow: "🌈",
	sun: "☀",
	moon: "🌙",
	cloud: "☁",
	snowflake: "❄",
	umbrella: "☂",
	check: "✅",
	check_mark: "✔",
	cross_mark: "❌",
	warning: "⚠",
	info: "ℹ",
	question: "❓",
	exclamation: "❗",
	no_entry: "⛔",
	prohibited: "🚫",
	stop_sign: "🛑",
	arrow_up: "⬆",
	arrow_down: "⬇",
	arrow_left: "⬅",
	arrow_right: "➡",
	arrow_upper_left: "↖",
	arrow_upper_right: "↗",
	arrow_lower_left: "↙",
	arrow_lower_right: "↘",
	left_right_arrow: "↔",
	up_down_arrow: "↕",
	arrows_clockwise: "🔃",
	arrows_counterclockwise: "🔄",
	computer: "💻",
	keyboard: "⌨",
	desktop: "🖥",
	printer: "🖨",
	mouse: "🖱",
	cd: "💿",
	dvd: "📀",
	floppy: "💾",
	battery: "🔋",
	plug: "🔌",
	bulb: "💡",
	flashlight: "🔦",
	gear: "⚙",
	wrench: "🔧",
	hammer: "🔨",
	nut_and_bolt: "🔩",
	link: "🔗",
	chains: "⛓",
	lock: "🔒",
	unlock: "🔓",
	key: "🔑",
	shield: "🛡",
	bug: "🐛",
	magnifying_glass: "🔍",
	speech_balloon: "💬",
	thought_balloon: "💭",
	megaphone: "📣",
	loudspeaker: "📢",
	bell: "🔔",
	no_bell: "🔕",
	envelope: "✉",
	email: "📧",
	inbox: "📥",
	outbox: "📤",
	package: "📦",
	clipboard: "📋",
	memo: "📝",
	page: "📄",
	bookmark: "🔖",
	label: "🏷",
	hourglass: "⌛",
	hourglass_flowing: "⏳",
	watch: "⌚",
	alarm_clock: "⏰",
	stopwatch: "⏱",
	timer: "⏲",
	clock: "🕐",
	zero: "0️⃣",
	one: "1️⃣",
	two: "2️⃣",
	three: "3️⃣",
	four: "4️⃣",
	five: "5️⃣",
	six: "6️⃣",
	seven: "7️⃣",
	eight: "8️⃣",
	nine: "9️⃣",
	ten: "🔟",
	hash: "#️⃣",
	coffee: "☕",
	tea: "🍵",
	beer: "🍺",
	wine: "🍷",
	cocktail: "🍸",
	pizza: "🍕",
	hamburger: "🍔",
	fries: "🍟",
	hotdog: "🌭",
	taco: "🌮",
	cake: "🎂",
	cookie: "🍪",
	chocolate: "🍫",
	candy: "🍬",
	apple: "🍎",
	banana: "🍌",
	dog: "🐕",
	cat: "🐈",
	snake: "🐍",
	turtle: "🐢",
	whale: "🐳",
	dolphin: "🐬",
	fish: "🐟",
	butterfly: "🦋",
	bee: "🐝",
	ladybug: "🐞",
	spider: "🕷",
	tree: "🌲",
	flower: "🌸",
	rose: "🌹",
	sunflower: "🌻",
	cactus: "🌵",
	trophy: "🏆",
	medal: "🏅",
	crown: "👑",
	gem: "💎",
	money_bag: "💰",
	dollar: "💵",
	rocket: "🚀",
	airplane: "✈",
	car: "🚗",
	bicycle: "🚲",
	house: "🏠",
	building: "🏢",
	globe: "🌍",
	world_map: "🗺",
	flag: "🏁",
	party: "🎉",
	confetti: "🎊",
	balloon: "🎈",
	gift: "🎁",
	art: "🎨",
	music: "🎵",
	notes: "🎶",
	microphone: "🎤",
	headphones: "🎧",
	movie: "🎬",
	camera: "📷",
	book: "📖",
	books: "📚",
	scroll: "📜",
	newspaper: "📰",
	person: "🧑",
	man: "👨",
	woman: "👩",
	child: "🧒",
	baby: "👶",
	eyes: "👀",
	eye: "👁",
	brain: "🧠",
	tongue: "👅",
	ear: "👂",
	nose: "👃",
	foot: "🦶",
	hand: "🤚",
	red_circle: "🔴",
	orange_circle: "🟠",
	yellow_circle: "🟡",
	green_circle: "🟢",
	blue_circle: "🔵",
	purple_circle: "🟣",
	black_circle: "⚫",
	white_circle: "⚪",
	red_square: "🟥",
	orange_square: "🟧",
	yellow_square: "🟨",
	green_square: "🟩",
	blue_square: "🟦",
	purple_square: "🟪",
	black_square: "⬛",
	white_square: "⬜",
	checkered_flag: "🏁",
	triangular_flag: "🚩",
	crossed_flags: "🎌",
	pirate_flag: "🏴‍☠️",
	white_flag: "🏳",
	100: "💯",
	infinity: "♾",
	recycle: "♻",
	peace: "☮",
	yin_yang: "☯",
	cross: "✝",
	atom: "⚛",
	radioactive: "☢",
	biohazard: "☣"
};
var EMOJI_PATTERN = /:([a-z0-9_]+(?:-(?:emoji|text))?):/g;
/**
* Replaces :shortcode: patterns in text with emoji characters.
*/
function emojiReplace(text, defaultVariant) {
	return text.replace(EMOJI_PATTERN, (_match, code) => {
		let variant = defaultVariant;
		let name = code;
		if (name.endsWith("-emoji")) {
			variant = "emoji";
			name = name.slice(0, -6);
		} else if (name.endsWith("-text")) {
			variant = "text";
			name = name.slice(0, -5);
		}
		const emoji = EMOJI[name];
		if (emoji === void 0) return _match;
		return emoji + (variant === "emoji" ? "️" : variant === "text" ? "︎" : "");
	});
}
//#endregion
//#region src/core/markup.ts
/**
* Markup — BBCode-inspired markup parser for inline styling.
* Parses \`[bold red]text[/bold red]\` into RichText with styled spans.
*
* Plugin tags ([LAW:locality-or-seam]): a \`MarkupRegistry\` lets consumers
* register tag handlers without forking the parser. When the parser sees
* \`[name attrs...]inner[/name]\` and \`name\` is registered, it parses attrs,
* recursively renders the inner markup as a child Renderable, and calls the
* handler — splicing the handler's returned Renderable into the output. The
* built-in style dialect and the plugin dialect are routed by the registry,
* which is the single trust boundary between them.
*
* Plugin pairs must nest. The built-in dialect admits non-strict nesting
* (\`[bold]a[italic]b[/bold]c[/italic]\`) because a style is an annotation and
* annotations may overlap freely; a plugin tag is a replacement whose handler
* takes one contiguous \`inner\`, so an overlapping pair has no slice to hand it
* and is rejected with a \`MarkupSyntaxError\`.
*/
var MarkupError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "MarkupError";
	}
};
/**
* A markup string that cannot be parsed, with where it went wrong.
*
* [LAW:types-are-the-program] A subclass rather than optional fields on
* \`MarkupError\`, because the parent is also what \`MarkupRegistry.register\`
* throws, and a registration has no source text to point into. Every error this
* class describes has a location, so none of its fields is optional and no
* caller has to ask whether one is present — \`instanceof\` is the only question.
*
* [LAW:one-source-of-truth] The constructor takes the facts the parser holds —
* the string, the offset of the offending tag, what was open — and derives
* \`line\`, \`column\` and the message from them, so the numbers a caller reads
* and the caret the message draws cannot disagree.
*/
var MarkupSyntaxError = class extends MarkupError {
	/** The problem alone, with no location, for callers building their own message. */
	reason;
	/** The whole markup string that failed, as the caller passed it. */
	markup;
	/** Index into \`markup\` of the tag the parser rejected. */
	offset;
	/** 1-based line of \`offset\`; lines are separated by \`\\n\`. */
	line;
	/** 1-based column of \`offset\` within its line, in UTF-16 code units. */
	column;
	/**
	* The opening tags still open at \`offset\`, outermost first, as written. For
	* overlapping plugin tags, only plugin tags are named.
	*/
	openTags;
	constructor(reason, markup, offset, openTags) {
		const lineStart = markup.lastIndexOf("\\n", offset - 1) + 1;
		const lineEnd = markup.indexOf("\\n", offset);
		const text = markup.slice(lineStart, lineEnd === -1 ? markup.length : lineEnd);
		const line = countNewlines(markup.slice(0, lineStart)) + 1;
		const column = offset - lineStart + 1;
		const open = openTags.length > 0 ? openTags.join(" ") : "none";
		super(\`\${printable(reason)} (line \${line}, column \${column})\\n\${excerpt(text, offset - lineStart)}\\nOpen tags: \${printable(open)}\`);
		this.name = "MarkupSyntaxError";
		this.reason = reason;
		this.markup = markup;
		this.offset = offset;
		this.line = line;
		this.column = column;
		this.openTags = openTags;
	}
};
function countNewlines(text) {
	return text.split("\\n").length - 1;
}
var EXCERPT_CONTEXT = 30;
/**
* \`text\` with each C0 control and DEL shown as one space.
*
* [LAW:single-enforcer] Every part of the message that quotes the caller's
* markup passes through here: the reason and the open tags quote tag text, and
* the tag grammar admits control characters, so an \`ESC ]\` inside a tag would
* otherwise open an OSC sequence in the terminal printing the error. In the
* excerpt it also keeps the caret aligned, since a control occupies no cell.
* The fields keep the text as written; only the message is made printable.
*/
function printable(text) {
	return text.replace(/[\\x00-\\x1f\\x7f]/g, " ");
}
/**
* Two lines: the source line around \`index\`, and a caret under it.
*
* The window is cut in code points, so a surrogate pair is never split, and the
* caret is placed by cell width, so a wide character before the error still
* leaves it under the right cell.
*/
function excerpt(text, index) {
	const chars = Array.from(printable(text));
	const at = Array.from(text.slice(0, index)).length;
	const from = Math.max(0, at - EXCERPT_CONTEXT);
	const to = Math.min(chars.length, at + EXCERPT_CONTEXT);
	const head = from > 0 ? "…" : "";
	const tail = to < chars.length ? "…" : "";
	const before = head + chars.slice(from, at).join("");
	return \`  \${before + chars.slice(at, to).join("") + tail}\\n  \${" ".repeat(cellLen(before))}^\`;
}
var HAS_TAG_RE = /\\[/;
var TAG_RE = /(?:\\\\\\[)|(\\[[a-z#/@][^[]*?\\])/g;
function parseTags(markup) {
	const tags = [];
	const re = new RegExp(TAG_RE.source, TAG_RE.flags);
	let match;
	while ((match = re.exec(markup)) !== null) {
		if (match[0] === "\\\\[") continue;
		const captured = match[1];
		if (!captured) continue;
		const inner = captured.slice(1, -1);
		const isClose = inner.startsWith("/");
		const stylePart = isClose ? inner.slice(1) : inner;
		const eqIdx = stylePart.indexOf("=");
		const styleName = eqIdx >= 0 ? stylePart.slice(0, eqIdx).trim() : stylePart.trim();
		const parameters = eqIdx >= 0 ? stylePart.slice(eqIdx + 1) : void 0;
		const isImplicitClose = isClose && styleName === "";
		const isClosing = isClose && !isImplicitClose;
		tags.push({
			fullMatch: captured,
			isClosing,
			isImplicitClose,
			styleName,
			parameters,
			start: match.index,
			end: match.index + match[0].length
		});
	}
	return tags;
}
function wholeString(markup) {
	return {
		source: markup,
		base: 0,
		enclosing: []
	};
}
/**
* Parses the built-in style dialect — \`[bold red]text[/bold red]\` — into a
* \`RichText\` with styled spans. Module-private on purpose: \`renderMarkup\` is
* this module's one crossing, and it delegates straight here the moment a
* string carries no paired plugin tag.
*
* [LAW:single-enforcer] Exporting this is what let a caller bind to the inner
* layer, and two of them did — \`console.ts\` and \`prompt.ts\` imported it as
* \`render as renderMarkup\`, so the import line read identically to the
* plugin-aware sites and the difference was invisible at every point of use. A
* tag registered on \`globalMarkupRegistry\` resolved in a table cell and was
* silently eaten by \`console.print\`, the path almost every consumer takes
* (rich-markup-pcp). Unexported, that drift is a compile error rather than a
* rule someone has to keep remembering.
*
* [LAW:dataflow-not-control-flow] Rendering *without* plugins stays reachable
* as a value rather than a second name: \`renderMarkup(s, { registry: new
* MarkupRegistry() })\`. Two exported functions put that variability in the
* function names; an empty registry puts it in the data, where the one
* boundary admits both.
*/
function render(markup, origin, baseStyle, options) {
	if (!HAS_TAG_RE.test(markup)) {
		let text = markup;
		if (options?.emoji !== false) text = emojiReplace(text);
		const result = new RichText(text);
		if (baseStyle) result.stylize(baseStyle);
		return result;
	}
	const tags = parseTags(markup);
	const doEmoji = options?.emoji !== false;
	let plainText = "";
	const spans = [];
	const openStack = [];
	const unparsable = (reason, tag) => new MarkupSyntaxError(reason, origin.source, origin.base + tag.start, [...origin.enclosing, ...openStack.map((opened) => opened.tag)]);
	let lastEnd = 0;
	for (const tag of tags) {
		const textBefore = markup.slice(lastEnd, tag.start);
		const processed = unescapeBrackets(doEmoji ? emojiReplace(textBefore) : textBefore);
		plainText += processed;
		if (tag.isImplicitClose) {
			if (openStack.length === 0) throw unparsable(\`Closing tag \${tag.fullMatch} has no open style tag to close\`, tag);
			const opened = openStack.pop();
			spans.push(new Span(opened.textStart, plainText.length, openTagStyle(opened)));
		} else if (tag.isClosing) {
			const idx = findLastOpen(openStack, tag.styleName);
			if (idx === -1) throw unparsable(\`Closing tag \${tag.fullMatch} doesn't match any open tag\`, tag);
			const opened = openStack[idx];
			spans.push(new Span(opened.textStart, plainText.length, openTagStyle(opened)));
			openStack.splice(idx, 1);
		} else openStack.push({
			tag: tag.fullMatch,
			styleName: tag.styleName,
			parameters: tag.parameters,
			textStart: plainText.length
		});
		lastEnd = tag.end;
	}
	const trailing = markup.slice(lastEnd);
	const processedTrailing = unescapeBrackets(doEmoji ? emojiReplace(trailing) : trailing);
	plainText += processedTrailing;
	while (openStack.length > 0) {
		const opened = openStack.pop();
		spans.push(new Span(opened.textStart, plainText.length, openTagStyle(opened)));
	}
	spans.reverse();
	spans.sort((a, b) => a.start - b.start);
	const result = new RichText(plainText);
	if (baseStyle) result.stylize(baseStyle);
	for (const span of spans) {
		const style = typeof span.style === "string" ? span.style : span.style.toString();
		const linkMatch = /^link\\s+(.+)$/.exec(style);
		if (linkMatch) result.stylize(new Style({ link: linkMatch[1] }), span.start, span.end);
		else result.stylize(style, span.start, span.end);
	}
	return result;
}
/**
* The style string an open tag closes into — \`name\`, or \`name parameters\` when
* the tag carried an \`=\`.
*
* [LAW:one-source-of-truth] One answer for the four sites that ask it: the three
* ways a tag can close (\`[/name]\`, \`[/]\`, and end of input) and the search that
* matches \`[/red on blue]\` back to \`[red on blue]\`. It was written out at each,
* which is how the three closing paths could — and did — drift apart on
* something none of the four copies was about.
*/
function openTagStyle(opened) {
	return opened.parameters !== void 0 ? \`\${opened.styleName} \${opened.parameters}\` : opened.styleName;
}
function findLastOpen(stack, name) {
	const normalized = name.trim();
	for (let i = stack.length - 1; i >= 0; i--) {
		const entry = stack[i];
		if (openTagStyle(entry) === normalized || entry.styleName === normalized) return i;
	}
	return -1;
}
function unescapeBrackets(text) {
	return text.replace(/\\\\\\[/g, "[");
}
var PLUGIN_TAG_NAME_SRC = "[a-z][A-Za-z0-9_-]*";
var LEGAL_PLUGIN_TAG_NAME = new RegExp(\`^\${PLUGIN_TAG_NAME_SRC}$\`);
var MarkupRegistry = class {
	_handlers = /* @__PURE__ */ new Map();
	register(name, handler) {
		if (!LEGAL_PLUGIN_TAG_NAME.test(name)) throw new MarkupError(\`Cannot register markup tag "\${name}": a tag name must be a lowercase letter followed by letters, digits, "_" or "-", so markup could never address this name.\`);
		if (isReservedTagName(name)) throw new MarkupError(\`Cannot register markup tag "\${name}": name is reserved by a built-in style.\`);
		this._handlers.set(name, handler);
	}
	unregister(name) {
		this._handlers.delete(name);
	}
	has(name) {
		return this._handlers.has(name);
	}
	get(name) {
		return this._handlers.get(name);
	}
};
function isReservedTagName(name) {
	try {
		Style.parse(name);
		return true;
	} catch (err) {
		if (err instanceof StyleSyntaxError) return false;
		throw err;
	}
}
var globalMarkupRegistry = new MarkupRegistry();
function isAlpha(c) {
	const cc = c.charCodeAt(0);
	return cc >= 65 && cc <= 90 || cc >= 97 && cc <= 122;
}
function isIdentChar(c) {
	if (isAlpha(c)) return true;
	const cc = c.charCodeAt(0);
	return cc >= 48 && cc <= 57 || c === "_" || c === "-";
}
function isSpace(c) {
	return c === " " || c === "	";
}
var PLUGIN_TAG_HEAD = new RegExp(\`^(\${PLUGIN_TAG_NAME_SRC})(?=$|[ \\\\t])\`);
function parsePluginAttrs(after) {
	const attrs = {};
	let i = 0;
	while (i < after.length) {
		while (i < after.length && isSpace(after[i])) i++;
		if (i >= after.length) break;
		if (!isAlpha(after[i])) {
			i++;
			continue;
		}
		const nameStart = i;
		while (i < after.length && isIdentChar(after[i])) i++;
		const name = after.slice(nameStart, i);
		while (i < after.length && isSpace(after[i])) i++;
		if (after[i] !== "=") continue;
		i++;
		while (i < after.length && isSpace(after[i])) i++;
		let value = "";
		const quote = after[i];
		if (quote === "\\"" || quote === "'") {
			i++;
			const valStart = i;
			while (i < after.length && after[i] !== quote) i++;
			value = after.slice(valStart, i);
			if (i < after.length) i++;
		} else {
			const valStart = i;
			while (i < after.length && !isSpace(after[i]) && after[i] !== "]") i++;
			value = after.slice(valStart, i);
		}
		attrs[name] = value;
	}
	return attrs;
}
/**
* Plugin-aware markup render. Always returns a \`RichText\`. Built-in style
* tags become spans; registered plugin tags are resolved by their handler,
* whose returned \`RichText\` is appended (text + spans) into the output. The
* recursion is over markup *slices* — between top-level plugin tag pairs and
* inside each pair — and every recursion node returns a \`RichText\`, so the
* append path is uniform.
*/
function renderMarkup(markup, options) {
	return renderSlice(markup, wholeString(markup), options);
}
function renderSlice(markup, origin, options) {
	const registry = options?.registry ?? globalMarkupRegistry;
	const baseStyle = options?.baseStyle;
	const doEmoji = options?.emoji !== false;
	if (!HAS_TAG_RE.test(markup)) return render(markup, origin, baseStyle, { emoji: doEmoji });
	const { annotated, topLevel: tagPairs } = pairPluginTags(parseTags(markup), registry, origin);
	if (tagPairs.size === 0) return render(markup, origin, baseStyle, { emoji: doEmoji });
	const out = new RichText("");
	let cursor = 0;
	for (const [openIdx, closeIdx] of tagPairs) {
		const open = annotated[openIdx];
		const close = annotated[closeIdx];
		if (open.start > cursor) out.append(render(markup.slice(cursor, open.start), offsetBy(origin, cursor), baseStyle, { emoji: doEmoji }));
		const innerRaw = markup.slice(open.end, close.start);
		const innerRichText = renderSlice(innerRaw, {
			...offsetBy(origin, open.end),
			enclosing: [...origin.enclosing, open.fullMatch]
		}, options);
		const handler = registry.get(open.pluginName);
		out.append(handler({
			attrs: open.attrs,
			children: innerRichText,
			raw: innerRaw
		}));
		cursor = close.end;
	}
	if (cursor < markup.length) out.append(render(markup.slice(cursor), offsetBy(origin, cursor), baseStyle, { emoji: doEmoji }));
	if (baseStyle) out.stylize(baseStyle);
	return out;
}
/** The origin of a sub-slice starting \`offset\` into the slice \`origin\` describes. */
function offsetBy(origin, offset) {
	return {
		...origin,
		base: origin.base + offset
	};
}
function pairPluginTags(tags, registry, origin) {
	const annotated = tags.map((t) => annotatePluginTag(t, registry));
	const stack = [];
	const pairs = /* @__PURE__ */ new Map();
	for (let i = 0; i < annotated.length; i++) {
		const t = annotated[i];
		if (!t.pluginName) continue;
		if (t.isImplicitClose) continue;
		if (t.isClosing) for (let j = stack.length - 1; j >= 0; j--) {
			const openIdx = stack[j];
			if (annotated[openIdx].pluginName === t.pluginName) {
				pairs.set(openIdx, i);
				stack.splice(j, 1);
				break;
			}
		}
		else stack.push(i);
	}
	const topLevel = /* @__PURE__ */ new Map();
	let outerEnd = -1;
	let outerOpenIdx = -1;
	const sortedOpens = [...pairs.keys()].sort((a, b) => a - b);
	for (const openIdx of sortedOpens) {
		const closeIdx = pairs.get(openIdx);
		if (annotated[openIdx].start < outerEnd) {
			if (annotated[closeIdx].end > outerEnd) {
				const inner = annotated[openIdx];
				const outer = annotated[outerOpenIdx];
				const caret = annotated[pairs.get(outerOpenIdx)].start;
				const openAtCaret = sortedOpens.filter((o) => annotated[o].start < caret && annotated[pairs.get(o)].start >= caret).map((o) => annotated[o].fullMatch);
				throw new MarkupSyntaxError(\`Plugin tag [\${inner.pluginName}] overlaps [\${outer.pluginName}]: plugin tags must nest, because a handler receives one contiguous slice. Close [/\${inner.pluginName}] before [/\${outer.pluginName}].\`, origin.source, origin.base + caret, [...origin.enclosing, ...openAtCaret]);
			}
			continue;
		}
		topLevel.set(openIdx, closeIdx);
		outerOpenIdx = openIdx;
		outerEnd = annotated[closeIdx].end;
	}
	return {
		annotated,
		topLevel
	};
}
function annotatePluginTag(tag, registry) {
	const inner = tag.fullMatch.slice(1, -1).replace(/^\\//, "");
	const name = PLUGIN_TAG_HEAD.exec(inner)?.[1];
	if (name === void 0 || !registry.has(name)) return tag;
	const after = inner.slice(name.length);
	const attrs = tag.isClosing ? {} : parsePluginAttrs(after);
	return {
		...tag,
		pluginName: name,
		attrs
	};
}
//#endregion
//#region src/core/highlighter.ts
/**
* Highlighters — apply styled spans to RichText based on pattern matching.
*/
var Highlighter = class {
	call(input) {
		const text = new RichText(input);
		this.highlight(text);
		return text;
	}
};
var NullHighlighter = class extends Highlighter {
	highlight(_text) {}
};
var RegexHighlighter = class extends Highlighter {
	static highlights = [];
	/** Style applied to matches. When ending with "." it acts as a namespace
	*  prefix: named groups become \`baseStyle + groupName\` (e.g. "repr." + "url"
	*  → "repr.url"). Otherwise it's used as a literal style for all matches
	*  (e.g. "bold red" applies "bold red" to every named group). */
	static baseStyle = "";
	highlight(text) {
		const ctor = this.constructor;
		const baseStyle = ctor.baseStyle;
		const isNamespace = baseStyle.endsWith(".");
		for (const pattern of ctor.highlights) {
			const re = pattern instanceof RegExp ? new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g") : new RegExp(pattern, "g");
			let match;
			while ((match = re.exec(text.plain)) !== null) {
				if (match[0].length === 0) {
					re.lastIndex++;
					continue;
				}
				if (match.groups) {
					let searchFrom = 0;
					for (const [groupName, groupValue] of Object.entries(match.groups)) if (groupValue !== void 0) {
						const posInMatch = match[0].indexOf(groupValue, searchFrom);
						if (posInMatch >= 0) {
							const start = match.index + posInMatch;
							const style = isNamespace ? \`\${baseStyle}\${groupName}\` : baseStyle || groupName;
							text.stylize(style, start, start + groupValue.length);
							searchFrom = posInMatch + groupValue.length;
						}
					}
				}
			}
		}
	}
};
var ReprHighlighter = class extends RegexHighlighter {
	static baseStyle = "repr.";
	static highlights = [
		/(?<url>https?:\\/\\/[^\\s<>"']+)/g,
		/(?<uuid>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
		/(?<str>'[^']*'|"[^"]*")/g,
		/(?<bool>\\btrue\\b|\\bfalse\\b)/g,
		/(?<none>\\bnull\\b|\\bundefined\\b|\\bNone\\b)/g,
		/(?<number>(?<!\\w)-?(?:0x[0-9a-f]+|\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)(?!\\w))/gi
	];
};
var JSON_STR = String.raw\`(?<![\\\\\\w])(?<str>b?".*?(?<!\\\\)")\`;
var JSONHighlighter = class extends RegexHighlighter {
	static baseStyle = "json.";
	static highlights = [[
		String.raw\`(?<brace>[\\{\\[\\(\\)\\]\\}])\`,
		String.raw\`\\b(?<bool_true>true)\\b|\\b(?<bool_false>false)\\b|\\b(?<null>null)\\b\`,
		String.raw\`(?<number>(?<!\\w)\\-?[0-9]+\\.?[0-9]*(e[\\-\\+]?\\d+?)?\\b|0x[0-9a-fA-F]*)\`,
		JSON_STR
	].join("|")];
	highlight(text) {
		super.highlight(text);
		const colon = /[ \\n\\r\\t]*:/y;
		for (const { index, 0: str } of text.plain.matchAll(new RegExp(JSON_STR, "g"))) {
			const end = index + str.length;
			colon.lastIndex = end;
			if (colon.test(text.plain)) text.stylize("json.key", index, end);
		}
	}
};
//#endregion
//#region src/core/pretty.ts
/**
* Pretty — formats JavaScript data structures with highlighting.
*
* Lives in \`core/\` beside \`markup\` and \`emoji\` because it does their job: turn
* foreign input into \`RichText\`. It composes no other renderable — the trait
* every file in \`renderables/\` shares and this one does not — and its imports
* are core primitives only. \`Console.print\` accepts \`unknown\` and must turn any
* of it into something renderable, so the formatter has to sit where \`console\`
* can reach it without an upward edge. [LAW:one-way-deps]
*
* Two traversals share this file, and the split is the whole design. \`_format\`
* lays a value out across lines; \`_oneLine\` answers only "does this fit on one
* line, and if so what is it?". They meet at \`_shape\`, which describes a
* container without committing to either layout. One traversal answering both
* questions is what made this formatter exponential: every child was rendered
* once to probe it and again to place it, so a node at depth d was visited 2^d
* times.
*/
var reprHighlighter = new ReprHighlighter();
var rootFrame = (maxWidth) => ({
	inset: 0,
	level: 0,
	maxWidth,
	column: 0,
	reserve: 0,
	open: /* @__PURE__ */ new WeakSet()
});
/**
* The column reached after \`text\` is appended to a line currently at \`column\`.
*
* A hole's formatted value can itself span multiple lines — a nested
* container that failed its own compact try. What comes after it (a Map
* entry's tail, the next hole) sits after \`text\`'s *last* line, not at
* \`column + cellLen(text)\`, so a multi-line insert resets the column to that
* last line's width instead of accumulating across lines that were never on
* the same row.
*/
function lineColumn(column, text) {
	const lastNewline = text.lastIndexOf("\\n");
	return lastNewline === -1 ? column + cellLen(text) : cellLen(text.slice(lastNewline + 1));
}
/**
* The text, when it is a single line no wider than \`budget\` — otherwise \`null\`.
*
* The one definition of "fits on one line" in this file, and it has to name
* both halves: \`cellLen\` scores a newline as zero cells, so a width check alone
* accepted multi-line text as compact. That is how a \`Map\` nested in an object
* used to render as \`{ m: Map {\` — a one-line object with an expansion wedged
* inside it and the closing brace back at column 0.
*/
function fitOneLine(text, budget) {
	return text.includes("\\n") || cellLen(text) > budget ? null : text;
}
/**
* The elements of an indexed sequence, or \`null\` for anything that isn't one.
*
* A typed array is an array with a fixed element type, and neither of the two
* questions asked elsewhere in this file recognises it: \`Array.isArray\` says
* false, and its own \`toString\` answers the bare \`1,2,3\` — no brackets, nothing
* for the highlighter to colour per element. Both spellings reach the one arm
* that knows what a sequence looks like. \`DataView\` is excluded because it is a
* window onto bytes, not a sequence of values.
*
* Returned as \`ArrayLike\` rather than a materialised array because both
* spellings already are one. Converting here would box every element of a
* multi-megabyte \`Buffer\` to keep the first \`maxLength\` of them — bounding the
* output while leaving the cost of producing it unbounded.
*/
function indexedElements(value) {
	if (Array.isArray(value)) return value;
	if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return value;
	return null;
}
/**
* The first \`limit\` items of a sequence, pulled and no more.
*
* A \`Map\` or \`Set\` reaches its size through \`.size\`, which iterates nothing, so
* spreading one only ever served to throw the tail away — \`print\` of a
* half-million-entry cache walked all of it to show a hundred. \`Infinity\` is
* the unbounded case and never breaks.
*/
function take(source, limit) {
	const taken = [];
	if (limit <= 0) return taken;
	for (const item of source) {
		taken.push(item);
		if (taken.length >= limit) break;
	}
	return taken;
}
/**
* What a value renders as when reading it threw instead of producing it.
*
* \`Pretty\` reflects on data it did not create, and every reflection it performs
* — a property getter, \`Object.keys\`, an iterator, \`toString\` — can throw. The
* message travels into the output, so the failure stays visible and attributed
* to the position that produced it. [LAW:no-silent-failure] the error is
* carried rather than swallowed; a marker naming its cause is not an
* answer-shaped void, and a diagnostic that takes the program down over one
* lazily-computed field is unusable on the objects it is most wanted for.
*/
function threw(error) {
	return \`[Threw: \${error instanceof Error ? error.message : String(error)}]\`;
}
/**
* Does this value carry its own string form, or must we reflect on its keys?
*
* A \`Date\`, an \`Error\`, a \`RegExp\`, or any object that defines \`toString\`
* answers the display question itself, and reflecting on such a value throws
* that answer away — \`Object.keys(new Date())\` is empty, so key-reflection
* renders it \`{}\`. Inheriting \`Object.prototype.toString\` is the opposite
* signal: it yields \`[object Object]\`, a non-answer, so the keys are all the
* information there is.
*
* Both clauses are load-bearing. The identity check separates the two
* populations; the \`typeof\` check is what makes \`Object.create(null)\` — which
* has no \`toString\` at all — reflect rather than throw.
*/
function describesItself(value) {
	const asRecord = value;
	return typeof asRecord[Symbol.toPrimitive] === "function" || typeof asRecord.toString === "function" && asRecord.toString !== Object.prototype.toString;
}
/** What joins a container's positions on one line. Its width is charged for, so it is named once. */
var SEPARATOR = ", ";
/**
* What joins a container's positions across lines, once it has expanded —
* \`SEPARATOR\` without the trailing space a newline already provides.
* rich-pretty-xms: named, and derived rather than a second hand-typed
* literal, so the width it costs a non-last slot's own compact try —
* reserved via \`Frame.reserve\` — cannot drift from what \`_formatObject\`
* actually joins with.
*/
var EXPAND_SEPARATOR = SEPARATOR.trimEnd();
/** The marker for positions the bound dropped, or nothing when it dropped none. */
var elided = (dropped) => dropped > 0 ? [{
	head: \`... +\${dropped}\`,
	holes: []
}] : [];
var Pretty = class {
	data;
	indent;
	expandAll;
	maxLength;
	maxString;
	maxDepth;
	indentGuides;
	highlighter;
	constructor(data, options) {
		this.data = data;
		this.indent = options?.indent ?? 4;
		this.expandAll = options?.expandAll ?? false;
		this.maxLength = options?.maxLength;
		this.maxString = options?.maxString;
		this.maxDepth = options?.maxDepth ?? Infinity;
		this.indentGuides = options?.indentGuides !== false;
		this.highlighter = options?.highlighter ?? reprHighlighter;
	}
	*render(options) {
		const text = new RichText(this._format(this.data, rootFrame(options.maxWidth)), { end: "" });
		this.highlighter.highlight(text);
		if (this.indentGuides) this._addIndentGuides(text);
		yield* text.render(options);
	}
	measure(_options) {
		const lines = this._format(this.data, rootFrame(_options.maxWidth)).split("\\n");
		let max = 0;
		for (const line of lines) max = Math.max(max, cellLen(line));
		return {
			minimum: 1,
			maximum: Math.min(max, _options.maxWidth)
		};
	}
	/**
	* The text a value shows without being reflected on, or \`null\` when it is an
	* object and the shape arms own it.
	*
	* Every kind answered here renders the same wherever it sits — no
	* indentation, no width to fit — which is why one method serves both
	* traversals.
	*/
	_scalar(value) {
		if (value === null) return "null";
		if (value === void 0) return "undefined";
		switch (typeof value) {
			case "string":
				if (this.maxString === void 0 || value.length <= this.maxString) return JSON.stringify(value);
				return JSON.stringify(value.slice(0, this.maxString)) + \`+\${value.length - this.maxString}\`;
			case "number":
			case "bigint":
			case "boolean": return String(value);
			case "symbol": return value.toString();
			case "function": return \`[Function: \${value.name || "anonymous"}]\`;
		}
		return null;
	}
	/**
	* A container, or the text standing in for one that is empty or past the
	* depth cap.
	*
	* \`positions\` is a thunk because both of those answers are reachable from
	* \`size\` alone, and reaching a position is not free: a \`Map\` or \`Set\` reaches
	* its own through an iterator, so enumerating one only to elide it drains a
	* container to print \`Set {...}\`. \`size\` also says how many positions were
	* dropped, which is where the elision marker comes from — one derivation, so
	* the count and the bound cannot disagree.
	*/
	_container(open, close, pad, size, level, positions) {
		if (size === 0) return {
			kind: "text",
			text: open + close
		};
		if (level >= this.maxDepth) return {
			kind: "text",
			text: open + "..." + close
		};
		const slots = positions();
		return {
			kind: "container",
			open,
			close,
			pad,
			slots: [...slots, ...elided(size - slots.length)]
		};
	}
	/**
	* The brackets and positions of an object, layout-free. See \`Shape\`.
	*
	* \`bound\` is the most positions the caller could ever use. Laying out passes
	* \`Infinity\`, because it prints every position it is handed. A probe passes
	* what is left of its line, which is already more positions than a fitting
	* one could hold — \`SEPARATOR\` charges two cells apiece, so a container with
	* more positions than \`budget\` overruns however narrow its contents are.
	* Reaching past it only ever feeds a join that returns \`null\`, and reaching a
	* position is what drains a \`Map\` or \`Set\`.
	*/
	_shape(value, level, bound) {
		const cap = Math.max(0, Math.min(this.maxLength ?? Infinity, bound));
		const elements = indexedElements(value);
		if (elements !== null) return this._container("[", "]", "", elements.length, level, () => {
			const shown = Math.min(elements.length, cap);
			return Array.from({ length: shown }, (_, i) => ({
				head: "",
				holes: [{
					read: () => elements[i],
					tail: ""
				}]
			}));
		});
		if (value instanceof Map) return this._container("Map {", "}", " ", value.size, level, () => take(value.entries(), cap).map(([k, v]) => ({
			head: "",
			holes: [{
				read: () => k,
				tail: " => "
			}, {
				read: () => v,
				tail: ""
			}]
		})));
		if (value instanceof Set) return this._container("Set {", "}", " ", value.size, level, () => take(value, cap).map((v) => ({
			head: "",
			holes: [{
				read: () => v,
				tail: ""
			}]
		})));
		if (describesItself(value)) return {
			kind: "text",
			text: String(value)
		};
		const obj = value;
		const keys = Object.keys(obj);
		return this._container("{", "}", " ", keys.length, level, () => keys.slice(0, cap).map((k) => ({
			head: \`\${k}: \`,
			holes: [{
				read: () => obj[k],
				tail: ""
			}]
		})));
	}
	/** The laid-out form of a value, expanded across lines wherever one line will not do. */
	_format(value, at) {
		const scalar = this._scalar(value);
		if (scalar !== null) return scalar;
		const object = value;
		if (at.open.has(object)) return "[Circular]";
		at.open.add(object);
		try {
			return this._formatObject(object, at);
		} catch (error) {
			return threw(error);
		} finally {
			at.open.delete(object);
		}
	}
	/** The arms for a non-null object, with \`value\` already on the open path. */
	_formatObject(value, at) {
		const shape = this._shape(value, at.level, Infinity);
		if (shape.kind === "text") return shape.text;
		if (!this.expandAll) {
			const compact = this._joinOneLine(shape, {
				level: at.level + 1,
				budget: at.maxWidth - at.column - at.reserve,
				open: at.open
			});
			if (compact !== null) return compact;
		}
		const indentStr = " ".repeat(this.indent * at.inset);
		const innerIndent = " ".repeat(this.indent * (at.inset + 1));
		const base = {
			inset: at.inset + 1,
			level: at.level + 1,
			maxWidth: at.maxWidth,
			column: cellLen(innerIndent),
			open: at.open
		};
		const midFrame = {
			...base,
			reserve: cellLen(EXPAND_SEPARATOR)
		};
		const lastFrame = {
			...base,
			reserve: 0
		};
		const lastSlot = shape.slots.length - 1;
		const parts = shape.slots.map((slot, i) => innerIndent + this._expandSlot(slot, i === lastSlot ? lastFrame : midFrame));
		return shape.open + "\\n" + parts.join(",\\n") + "\\n" + indentStr + shape.close;
	}
	/**
	* One position, with every value in it laid out.
	*
	* \`at.column\` is where \`slot.head\` begins. Rather than hand-tracking a
	* second, parallel "column so far" alongside \`out\` — two values a future
	* edit could update out of step, silently reintroducing a stale-budget bug
	* of the same shape this file just fixed — each hole derives its own
	* column fresh from \`out\` via \`lineColumn\`, the one place "text just
	* emitted" becomes "column now". [LAW:one-source-of-truth] \`out\` is
	* already the complete record; \`column\` is a read of it, not a second copy
	* of the same fact. \`_joinOneLine\`'s probe sibling tracks the analogous
	* thing via \`budget\` shrinking instead, because a probe already discards
	* anything that overruns and so never needs to know where a multi-line
	* insert's last line ends.
	*
	* Each hole's \`reserve\` is its own \`tail\` plus, only for the slot's last
	* hole, whatever \`at.reserve\` already asked this whole slot to leave room
	* for (\`_formatObject\`'s trailing \`,\`). An earlier hole's tail is never
	* folded into a later hole's reserve — it is spent, not carried, the moment
	* \`out\` grows past it.
	*/
	_expandSlot(slot, at) {
		let out = slot.head;
		const lastHole = slot.holes.length - 1;
		for (let i = 0; i < slot.holes.length; i++) {
			const hole = slot.holes[i];
			let text;
			try {
				const reserve = cellLen(hole.tail) + (i === lastHole ? at.reserve : 0);
				text = this._format(hole.read(), {
					...at,
					column: lineColumn(at.column, out),
					reserve
				});
			} catch (error) {
				text = threw(error);
			}
			out += text + hole.tail;
		}
		return out;
	}
	/** The one-line form of a value, or \`null\` when it will not fit \`at.budget\`. */
	_oneLine(value, at) {
		const scalar = this._scalar(value);
		if (scalar !== null) return fitOneLine(scalar, at.budget);
		const object = value;
		if (at.open.has(object)) return fitOneLine("[Circular]", at.budget);
		at.open.add(object);
		try {
			const shape = this._shape(object, at.level, at.budget);
			if (shape.kind === "text") return fitOneLine(shape.text, at.budget);
			return this._joinOneLine(shape, {
				level: at.level + 1,
				budget: at.budget,
				open: at.open
			});
		} catch (error) {
			return fitOneLine(threw(error), at.budget);
		} finally {
			at.open.delete(object);
		}
	}
	/**
	* A container's positions on one line, or \`null\` as soon as they overrun.
	*
	* The budget is spent as it goes and each position is asked for only what is
	* left, so a subtree that has already outgrown the line is abandoned where it
	* outgrew it rather than formatted in full and then measured.
	*
	* The brackets are charged before anything is read, and that ordering is what
	* bounds the traversal: a budget checked only against the finished text still
	* reads the whole subtree to produce text it then throws away. Charged first,
	* every level costs at least the two cells of its own brackets, so a probe
	* descends at most \`budget / 2\` levels however deep the data goes.
	*/
	_joinOneLine(shape, at) {
		let used = cellLen(shape.open) + cellLen(shape.close) + 2 * cellLen(shape.pad);
		if (used > at.budget) return null;
		const pieces = [];
		for (const slot of shape.slots) {
			used += pieces.length > 0 ? cellLen(SEPARATOR) : 0;
			const piece = this._slotOneLine(slot, {
				...at,
				budget: at.budget - used
			});
			if (piece === null) return null;
			used += cellLen(piece);
			pieces.push(piece);
		}
		return shape.open + shape.pad + pieces.join(SEPARATOR) + shape.pad + shape.close;
	}
	/** One position on one line, or \`null\` when any value in it will not fit. */
	_slotOneLine(slot, at) {
		let out = slot.head;
		for (const hole of slot.holes) {
			const left = at.budget - cellLen(out);
			let text;
			try {
				text = this._oneLine(hole.read(), {
					...at,
					budget: left
				});
			} catch (error) {
				text = fitOneLine(threw(error), left);
			}
			if (text === null) return null;
			out += text + hole.tail;
		}
		return fitOneLine(out, at.budget);
	}
	_addIndentGuides(text) {
		const lines = text.plain.split("\\n");
		let offset = 0;
		for (const line of lines) {
			const leadingSpaces = line.length - line.trimStart().length;
			for (let i = 0; i < leadingSpaces; i += this.indent) if (i + offset < text.length) text.stylize("repr.indent", offset + i, offset + i + 1);
			offset += line.length + 1;
		}
	}
};
//#endregion
//#region src/core/json.ts
/**
* JSON — renders JSON data with syntax highlighting and pretty-printing.
*
* Lives in \`core/\` for the reason \`pretty.ts\` does, argued in its header: it
* turns foreign input into \`RichText\`, composes no other renderable, and
* imports core primitives only. \`Console.printJson\` delegates here, so this is
* where the console can reach it without an upward edge. [LAW:one-way-deps]
*/
var highlighter = new JSONHighlighter();
var JSONRenderable = class JSONRenderable {
	text;
	constructor(text) {
		this.text = text;
	}
	static fromString(jsonString, options) {
		const indent = options?.indent ?? 2;
		const sortKeys = options?.sortKeys ?? false;
		const data = JSON.parse(jsonString);
		return JSONRenderable.fromData(data, {
			...options,
			indent,
			sortKeys
		});
	}
	static fromData(data, options) {
		const indent = options?.indent ?? 2;
		const sortKeys = options?.sortKeys ?? false;
		const doHighlight = options?.highlight !== false;
		const text = new RichText(JSON.stringify(data, sortKeys ? (_key, value) => {
			if (value !== null && typeof value === "object" && !Array.isArray(value)) {
				const sorted = {};
				for (const k of Object.keys(value).sort()) sorted[k] = value[k];
				return sorted;
			}
			return value;
		} : void 0, indent), { end: "" });
		if (doHighlight) highlighter.highlight(text);
		return new JSONRenderable(text);
	}
	*render(options) {
		yield* this.text.render(options);
	}
	measure(options) {
		return this.text.measure(options);
	}
};
//#endregion
//#region src/core/export-lines.ts
/**
* export-lines — recorded segments resolved against a \`TerminalTheme\` into the
* lines every exporter draws.
*
* The HTML and SVG exporters are two encodings of one picture, and this module
* is the picture. What a styled cell *looks like* — which colour its glyph is,
* whether its background is painted, which decorations it carries, where it
* links — is decided here, once, and an exporter decides only how to write
* that down. Before it existed the decision was made twice, by a CSS method
* on \`Style\` and by a private converter on \`Console\`, and the two had already
* disagreed: one honoured \`underline2\`, the other dropped it.
*
* [LAW:types-are-the-program] \`ExportLook\` has no \`reverse\`, \`dim\`, \`conceal\`
* or default colour, because all four are consumed by \`resolveLook\` and turned
* into plain RGB. An exporter holding a look cannot forget to swap a reversed
* run or to fade a dim one: there is nothing left in its hands to forget. That
* is the whole reason the representation is resolved rather than a \`Style\`
* handed through.
*
* Runs rather than a cell grid. A grid gives a wide character a phantom
* continuation cell every consumer must know to skip, and gives an HTML
* exporter — which lays text out by flowing it — nothing it needs. A run's
* column and cell width are \`cellLen\` of the text before it and of its own
* text; they are not stored, so they cannot disagree with the text
* [LAW:one-source-of-truth]. The SVG exporter, the one consumer that positions
* anything, derives them.
*
* Browser-safe by construction: this imports \`color\`, \`style\`, \`segment\` and
* nothing that touches the host, so \`Console\` can reach it from the main
* barrel and the fs half of exporting stays in \`src/node/save.ts\`.
*/
/**
* The URL schemes an export will link.
*
* A terminal hands an OSC 8 target to the user's opener; an exported page hands
* it to whoever loads the page, and exports are made to be published. A
* \`javascript:\` target that was inert in a terminal is script in a README. The
* list is an allowance, not a denylist, so a scheme nobody considered is
* refused rather than trusted.
*/
var LINKABLE_SCHEMES = /* @__PURE__ */ new Set([
	"http:",
	"https:",
	"mailto:",
	"ftp:",
	"file:"
]);
/**
* \`Style.link\` as a link an export may write, or \`null\` when it may not.
*
* A refused link loses only its target: the run keeps its text and every other
* attribute, so nothing the terminal showed disappears from the export. The
* canonical \`URL.href\` is what comes back, since the parse is what vouches for
* it.
*/
function parseHref(link) {
	if (!URL.canParse(link)) return null;
	const url = new URL(link);
	return LINKABLE_SCHEMES.has(url.protocol) ? url.href : null;
}
/**
* How far a dim glyph moves toward its background — Rich's own factor, so an
* export of the same program matches the library this ports.
*/
var DIM_FADE = .4;
var DEFAULT_COLOR = ColorSpec.default();
/**
* The ground every export is drawn on under \`theme\`.
*
* An exporter paints its page or window with this; \`resolveLook\` flattens
* every run over the same \`background\`, so a run showing the canvas and the
* page around it cannot come out different colours.
*/
function exportCanvas(theme) {
	return {
		background: DEFAULT_COLOR.getTruecolor(theme, false),
		foreground: DEFAULT_COLOR.getTruecolor(theme, true)
	};
}
/**
* A \`Style\` as it appears on screen under \`theme\`.
*
* The order is the terminal's: colours resolve through the theme and lose
* their alpha — paper over the canvas, ink over the paper, as \`toSgrCodes\`
* flattens them — \`reverse\` swaps them, \`dim\` fades the glyph toward whatever
* background it ended up on, and \`conceal\` finally paints the glyph in that
* background. Every step after flattening works on opaque colour, so no
* exporter ever draws a translucent one. Text under \`conceal\` is still
* present, and still selectable, in both formats.
*
* The one difference from \`toSgrCodes\` is the substrate: a terminal cannot
* know what lies under its cells and assumes black, while an export draws its
* own canvas and flattens over that.
*
* \`theme\` omitted is \`ColorSpec.getTruecolor\`'s own fallback — black canvas,
* white ink, the standard ANSI table. Choosing it there rather than naming a
* preset here is what keeps \`core/\` from a third upward edge into \`themes/\`.
*/
function resolveLook(style, theme) {
	const inkSpec = style.color ?? DEFAULT_COLOR;
	const paperSpec = style.bgcolor ?? DEFAULT_COLOR;
	const canvas = exportCanvas(theme).background;
	const paper = paperSpec.flattenAlpha(canvas).getTruecolor(theme, false);
	const ink = inkSpec.flattenAlpha(paper).getTruecolor(theme, true);
	const glyph = style.reverse ? paper : ink;
	const ground = style.reverse ? ink : paper;
	const background = style.reverse || !paperSpec.isDefault ? ground : "canvas";
	const faded = style.dim ? blendRgb(glyph, ground, DIM_FADE) : glyph;
	return {
		foreground: style.conceal ? ground : faded,
		background,
		bold: style.bold === true,
		italic: style.italic === true,
		underline: style.underline2 ? "double" : style.underline ? "single" : "none",
		strike: style.strike === true,
		overline: style.overline === true,
		blink: style.blink2 ? "fast" : style.blink ? "slow" : "none",
		outline: style.encircle ? "encircle" : style.frame ? "frame" : "none",
		href: style.link === void 0 ? null : parseHref(style.link)
	};
}
/**
* Recorded segments as terminal rows under \`theme\`.
*
* \`"\\n"\` ends a row, so output that ends with a newline — every \`print\` does —
* has no empty row after it, and \`"a\\n\\nb"\` keeps its blank row. Callers pass
* the recording buffer, which already holds no control segments.
*/
function exportLines(segments, theme) {
	const rows = [[]];
	for (const segment of segments) {
		const look = resolveLook(segment.style ?? NULL_STYLE, theme);
		segment.text.split("\\n").forEach((piece, index) => {
			if (index > 0) rows.push([]);
			if (piece.length > 0) rows[rows.length - 1].push({
				text: piece,
				look
			});
		});
	}
	return rows[rows.length - 1].length === 0 ? rows.slice(0, -1) : rows;
}
//#endregion
//#region src/core/export-html.ts
/**
* export-html — recorded segments drawn as HTML: a fragment that can sit in
* a page this library does not own, and a standalone document around it.
*
* An encoding of \`export-lines\` and nothing more. What a run looks like under
* a theme is decided there; this module decides only how CSS says it. It never
* sees a \`Style\`, so it cannot disagree with the SVG exporter about what
* \`reverse\` or \`dim\` means — the two old converters that did disagree were
* deleted when this replaced them.
*
* The rows are already laid out at console width, so \`pre\` never re-wraps
* them: \`white-space: pre\`, and a scrollbar rather than a reflow when the page
* is narrower than the terminal was.
*/
var ENTITIES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\\"": "&quot;"
};
var escapeText = (text) => text.replace(/[&<>]/g, (c) => ENTITIES[c]);
var escapeAttribute = (value) => value.replace(/[&"<>]/g, (c) => ENTITIES[c]);
var BLINK_KEYFRAMES = "rich-blink";
var UNDERLINE_LINE = {
	none: [],
	single: ["underline"],
	double: []
};
var BLINK = {
	none: [],
	slow: [\`animation:\${BLINK_KEYFRAMES} 1s step-end infinite\`],
	fast: [\`animation:\${BLINK_KEYFRAMES} 0.5s step-end infinite\`]
};
var FRAME = "box-shadow:inset 0 0 0 1px currentColor";
var OUTLINE = {
	none: [],
	frame: [FRAME],
	encircle: [FRAME, "border-radius:0.5em"]
};
/**
* The glyph colour, and the background when one is painted.
*
* Dim arrives already blended into \`foreground\`. \`opacity\` is never written:
* it fades a painted background along with the glyph, which is the bug the
* blend exists to avoid.
*/
function paintCss(look) {
	return [\`color:\${look.foreground.hex}\`, ...look.background === "canvas" ? [] : [\`background-color:\${look.background.hex}\`]];
}
/** What is drawn on the glyph: weight, slant, single-style lines, blink, outline. */
function glyphCss(look) {
	const lines = [
		...UNDERLINE_LINE[look.underline],
		...look.strike ? ["line-through"] : [],
		...look.overline ? ["overline"] : []
	];
	return [
		...look.bold ? ["font-weight:bold"] : [],
		...look.italic ? ["font-style:italic"] : [],
		...lines.length === 0 ? [] : [\`text-decoration-line:\${lines.join(" ")}\`],
		...BLINK[look.blink],
		...OUTLINE[look.outline]
	];
}
var ANCHOR_CSS = "all:unset;cursor:revert;outline:revert";
var span = (css, content) => \`<span style="\${escapeAttribute(css.join(";"))}">\${content}</span>\`;
/**
* One run as markup.
*
* An element has one \`text-decoration-style\`, so a double underline sharing a
* span with a strike would double the strike too. It gets an outer span of its
* own instead. That span carries the paint, because a descendant's background
* may be painted over an ancestor's underline, and the blink, so the underline
* blinks with the glyph.
*/
function runHtml({ text, look }) {
	const glyph = escapeText(text);
	const drawn = look.underline === "double" ? span([
		...paintCss(look),
		"text-decoration-line:underline",
		"text-decoration-style:double",
		...BLINK[look.blink]
	], span([\`color:\${look.foreground.hex}\`, ...glyphCss(look)], glyph)) : span([...paintCss(look), ...glyphCss(look)], glyph);
	return look.href === null ? drawn : \`<a href="\${escapeAttribute(look.href)}" style="\${ANCHOR_CSS}">\${drawn}</a>\`;
}
/**
* The CSS a page includes once, wherever fragments appear: what an inline
* style cannot say. A fragment that blinks draws steadily without it.
*/
var HTML_FRAGMENT_CSS = \`@keyframes \${BLINK_KEYFRAMES}{50%{color:transparent}}\`;
/**
* \`segments\` under \`theme\` as one \`pre\` carrying its canvas, for embedding.
*
* [LAW:locality-or-seam] Every rule is inline on the \`pre\` or below it, so the
* fragment styles nothing outside itself; the host page keeps its own \`body\`,
* \`pre\` and \`a\` rules. The seam holds the other way too: \`all:initial\` stops
* the host's \`pre\` rules and inherited typography from reaching the rows, and
* the two properties \`all\` does not cover pin the rows left to right.
*
* The one way in is the \`--rich-fragment-font\` custom property, read as the
* \`font\` shorthand (\`14px/1.3 "JetBrains Mono", monospace\`). \`all\` resets no
* custom property, so a host sets it on any ancestor to draw the rows in its
* own code font; unset, the rows are the browser's default monospace. It must
* be a whole shorthand, a size and a family at least: any other value is
* invalid when computed, and the rows then inherit the host's font.
*
* A browser draws no line for a newline at either edge of a \`pre\`: the parser
* drops the one straight after the open tag, and the one before \`</pre>\` ends a
* line without starting another. So the fragment opens with a newline of its
* own and every row ends with one, and a blank first or last row is still drawn.
*/
function encodeHtmlFragment(segments, theme) {
	const canvas = exportCanvas(theme);
	const rows = exportLines(segments, theme).map((row) => \`\${row.map(runHtml).join("")}\\n\`);
	return \`<pre style="\${[
		"all:initial",
		"direction:ltr",
		"unicode-bidi:isolate",
		"display:block",
		\`background:\${canvas.background.hex}\`,
		\`color:\${canvas.foreground.hex}\`,
		"padding:1em",
		"font:var(--rich-fragment-font,medium monospace)",
		"white-space:pre",
		"overflow-x:auto"
	].join(";")}">\\n\${rows.join("")}</pre>\`;
}
/**
* \`segments\` under \`theme\` as a complete HTML document.
*
* [LAW:one-source-of-truth] The document is the fragment in a shell, so the
* two cannot draw different pictures. The shell paints the page around the
* \`pre\` in the same canvas and includes the fragment CSS once.
*/
function encodeHtml(segments, theme) {
	const canvas = exportCanvas(theme);
	return [
		"<!DOCTYPE html>",
		\`<html><head><meta charset="utf-8"><style>\\n\${\`body{background:\${canvas.background.hex};color:\${canvas.foreground.hex};margin:0}\\n\${HTML_FRAGMENT_CSS}\`}\\n</style></head>\`,
		\`<body>\${encodeHtmlFragment(segments, theme)}</body></html>\`
	].join("\\n");
}
//#endregion
//#region src/renderables/embed.ts
/**
* The one crossing where content a caller hands a renderable — a table cell, a
* panel's body, title or subtitle, a tree label, a column item, a layout pane,
* a rule's title — becomes something that renderable can lay out.
* [LAW:single-enforcer]
*
* Each of those sites used to build its own \`RichText\` straight from the
* constructor, which does not parse markup, so \`[red]Solo[/red]\` reached the
* terminal with its tags intact. Table cells were fixed on their own first; the
* rest kept the defect until the rule moved here.
*
* Markup is parsed because Rich parses it: every one of these positions
* reaches the wire through Rich's \`render_str\`, and a console's markup is on by
* default. Rich's \`render_str\` also honours \`Console(markup=False)\` and runs the
* console's highlighter; this crossing does neither, because the console's
* settings do not reach it (rich-markup-3sw).
*
* \`end\` is cleared because embedded text is a fragment rather than a printed
* line; left at the default \`"\\n"\` it draws a trailing blank row. A \`RichText\`
* is copied first, since clearing in place would reach back into the caller's
* object.
*/
/**
* Caller content as the text an embedding site lays out, \`end\` cleared. A
* string is the only kind of content that can contain markup, so it is the only
* kind parsed; any other value is its \`String\` form as written, so an object's
* \`[object Object]\` is not eaten as a tag.
*/
function embeddedText(content) {
	const text = content instanceof RichText ? content.copy() : typeof content === "string" ? renderMarkup(content) : new RichText(String(content ?? ""));
	text.end = "";
	return text;
}
/**
* Caller content as something an embedding site can render. A non-text
* \`Renderable\` (a nested \`Panel\` or \`Table\`) passes through: it carries no
* \`end\` to clear and no markup to parse. Everything else is \`embeddedText\`.
*/
function embed(content) {
	if (!(content instanceof RichText) && typeof content === "object" && content !== null && "render" in content) return content;
	return embeddedText(content);
}
/**
* Caller content set into a line it shares with other drawing — a panel's
* title or subtitle in its border, a rule's title — as one line of segments:
* a space either side, its own styles over \`base\`. The caller cuts it to the
* room it has with \`Segment.adjustLineLength\`, which is cell-aware.
*
* Content with no text is no label at all, not two spaces: an absent title, an
* empty string, an empty \`RichText\` and markup that styles nothing all draw
* the plain line, as Rich's do (an empty \`Text\` is falsy there).
*/
function inlineLabel(content, options, base) {
	const bare = embeddedText(content);
	const text = bare.plain === "" ? bare : bare.pad(1);
	text.justify = void 0;
	const line = text.render({
		...options,
		maxWidth: text.cellLength,
		noWrap: true,
		justify: "left"
	});
	return [...Segment.applyStyle(line, base)];
}
//#endregion
//#region src/renderables/rule.ts
/**
* Rule — a horizontal divider line, optionally with a centered title.
*/
var ASCII_RULE_CHAR = "-";
var DEFAULT_RULE_CHAR = "─";
var Rule = class {
	title;
	characters;
	align;
	style;
	constructor(title, options) {
		const chars = options?.characters ?? DEFAULT_RULE_CHAR;
		if (chars.length === 0) throw new Error("Rule characters must not be empty");
		const align = options?.align;
		if (align !== void 0 && align !== "left" && align !== "center" && align !== "right") throw new Error(\`Invalid align value: "\${align}"\`);
		this.title = title;
		this.characters = chars;
		this.align = align ?? "center";
		this.style = options?.style ?? NULL_STYLE;
	}
	*render(options) {
		const maxWidth = options.maxWidth;
		const ruleChar = options.asciiOnly ? ASCII_RULE_CHAR : this.characters;
		const style = getStyle(options, this.style);
		const ruleStyle = style.isNull ? void 0 : style;
		const title = inlineLabel(this.title, options, ruleStyle);
		const titleWidth = Segment.getLineLength(title);
		if (titleWidth === 0) {
			yield new Segment(repeatToWidth(ruleChar, maxWidth), ruleStyle);
			yield Segment.line();
			return;
		}
		if (titleWidth >= maxWidth) {
			yield* Segment.adjustLineLength(title, maxWidth, ruleStyle);
			yield Segment.line();
			return;
		}
		const remaining = maxWidth - titleWidth;
		const leftWidth = this.align === "right" ? remaining : this.align === "center" ? Math.floor(remaining / 2) : 0;
		const rightWidth = remaining - leftWidth;
		if (leftWidth > 0) yield new Segment(repeatToWidth(ruleChar, leftWidth), ruleStyle);
		yield* title;
		if (rightWidth > 0) yield new Segment(repeatToWidth(ruleChar, rightWidth), ruleStyle);
		yield Segment.line();
	}
	measure(_options) {
		return {
			minimum: 1,
			maximum: _options.maxWidth
		};
	}
};
function repeatToWidth(char, width) {
	const charWidth = cellLen(char);
	if (charWidth === 0) return " ".repeat(width);
	const repeats = Math.ceil(width / charWidth);
	const full = char.repeat(repeats);
	let w = 0;
	let i = 0;
	for (const c of full) {
		const cw = cellLen(c);
		if (w + cw > width) break;
		w += cw;
		i += c.length;
	}
	const result = full.slice(0, i);
	const gap = width - w;
	return gap > 0 ? result + " ".repeat(gap) : result;
}
//#endregion
//#region src/core/console.ts
/**
* Console — the central orchestrator for rendering styled output to the terminal.
*/
var DETACHED_ENVIRONMENT = Object.freeze({ env: Object.freeze({}) });
function ambientEnvironment() {
	return typeof process === "undefined" ? DETACHED_ENVIRONMENT : process;
}
function boundStream(environment, useStderr) {
	return useStderr ? environment.stderr : environment.stdout;
}
function effectiveIsTTY(options, stream) {
	if (options?.forceTerminal) return true;
	if (options?.file) return false;
	return stream?.isTTY ?? false;
}
function terminalSize(environment, stream) {
	const cols = environment.env["COLUMNS"];
	const lines = environment.env["LINES"];
	const w = cols ? parseInt(cols, 10) : stream?.columns ?? 80;
	const h = lines ? parseInt(lines, 10) : stream?.rows ?? 24;
	return {
		width: w || 80,
		height: h || 24
	};
}
function defaultSink(stream) {
	if (stream === void 0) throw new Error("Console: no \`file\` provided and the environment has no stream to write to (e.g. running in a browser). Pass \`file: hostStream(host)\` or any other ConsoleSink so output has somewhere to go.");
	return stream;
}
function resolveGetSize(options, environment, stream) {
	if (options?.getSize) return options.getSize;
	const staticWidth = options?.width;
	const staticHeight = options?.height;
	if (staticWidth !== void 0 && staticHeight !== void 0) {
		const fixed = Object.freeze({
			width: staticWidth,
			height: staticHeight
		});
		return () => fixed;
	}
	return () => {
		const term = terminalSize(environment, stream);
		return {
			width: staticWidth ?? term.width,
			height: staticHeight ?? term.height
		};
	};
}
/** Shared because it is stateless: highlighting nothing has nothing to own. */
var NO_HIGHLIGHT = new NullHighlighter();
/**
* What \`print\` bounds a data argument by when the caller said nothing.
*
* \`print\` formats whatever it is handed, so it is the one place that has to
* assume nothing about the value's size, in any of the three ways a value can
* be large. Unbounded, \`print(buffer)\` emits a line per byte,
* \`print(deeplyNested)\` descends until the stack gives out, and a single
* response body assigned to a field arrives in full — each of them a debug line
* that costs megabytes or hangs the terminal. All three bounds announce
* themselves in the output (\`... +N\`, \`{...}\`, \`+N\` after the closing quote),
* so this truncates visibly and never silently. [LAW:no-silent-failure]
*
* \`maxString\` reaches only strings nested inside data; a string argument is
* printed by the arm above, where the caller asked for that string by name.
*
* A caller constructing a \`Pretty\` has seen their data and gets no defaults;
* these belong to the convenience path, not to the formatter.
*/
var PRINT_DATA_BOUNDS = {
	maxLength: 100,
	maxDepth: 16,
	maxString: 1e3
};
var Console = class {
	_destination;
	_getSize;
	_style;
	_isTerminal;
	_forceInteractive;
	_file;
	_stream;
	_record;
	_markup;
	_highlight;
	_theme;
	_onStyleError;
	_highlighter;
	_recorded;
	_capture;
	constructor(options) {
		const environment = options?.environment ?? ambientEnvironment();
		const stream = boundStream(environment, options?.stderr ?? false);
		this._stream = stream;
		this._isTerminal = effectiveIsTTY(options, stream);
		const resolved = resolveDestination(options?.colorSystem === void 0 ? "auto" : options.colorSystem, {
			isTTY: this._isTerminal,
			env: environment.env
		});
		this._destination = {
			colorSystem: resolved.colorSystem,
			hyperlinks: options?.hyperlinks ?? resolved.hyperlinks
		};
		this._getSize = resolveGetSize(options, environment, stream);
		this._theme = options?.theme ?? DEFAULT_THEME;
		this._style = this._theme.resolve(options?.style ?? NULL_STYLE);
		this._forceInteractive = options?.forceInteractive;
		this._file = options?.file;
		this._record = options?.record ?? false;
		this._markup = options?.markup !== false;
		this._highlight = options?.highlight !== false;
		this._highlighter = options?.highlighter ?? new ReprHighlighter();
		this._onStyleError = options?.onStyleError;
		this._recorded = [];
		this._capture = null;
	}
	get size() {
		return this._getSize();
	}
	get width() {
		return this._getSize().width;
	}
	get height() {
		return this._getSize().height;
	}
	get encoding() {
		return "utf-8";
	}
	get isTerminal() {
		return this._isTerminal;
	}
	get isInteractive() {
		if (this._forceInteractive !== void 0) return this._forceInteractive;
		return this.isTerminal;
	}
	get colorSystem() {
		return this._destination.colorSystem;
	}
	/**
	* Where this console writes: the colour depth it draws at and whether it
	* emits OSC 8 hyperlinks, overrides applied — the value its output is
	* encoded for, for anything that encodes on its behalf (\`Live\`).
	*/
	get destination() {
		return this._destination;
	}
	get file() {
		return this._file ?? defaultSink(this._stream);
	}
	get theme() {
		return this._theme;
	}
	get options() {
		const { width, height } = this.size;
		return {
			maxWidth: width,
			height: {
				rows: height,
				exact: false
			},
			isTerminal: this.isTerminal,
			encoding: this.encoding,
			asciiOnly: false,
			theme: this._theme,
			onStyleError: this._onStyleError,
			colorSystem: this._destination.colorSystem
		};
	}
	print(...args) {
		let opts = {};
		let items;
		const lastArg = args[args.length - 1];
		if (args.length > 1 && typeof lastArg === "object" && lastArg !== null && !isRenderable(lastArg) && ("style" in lastArg || "justify" in lastArg || "markup" in lastArg || "highlight" in lastArg || "overflow" in lastArg || "end" in lastArg || "softWrap" in lastArg || "crop" in lastArg || "sep" in lastArg)) {
			opts = lastArg;
			items = args.slice(0, -1);
		} else items = args;
		const doMarkup = opts.markup ?? this._markup;
		const doHighlight = opts.highlight ?? this._highlight;
		const sep = opts.sep ?? " ";
		const end = opts.end ?? "\\n";
		const softWrap = opts.softWrap ?? false;
		const printStyle = this._theme.resolve(opts.style ?? NULL_STYLE);
		const blocks = items.length === 0 ? [{
			kind: "text",
			items: []
		}] : [];
		for (const item of items) {
			let text;
			if (item instanceof RichText) {
				const richText = item.copy();
				richText.end = "";
				text = richText;
			} else if (isRenderable(item)) {
				blocks.push({
					kind: "lines",
					renderable: item
				});
				continue;
			} else if (typeof item === "string") {
				const richText = doMarkup ? renderMarkup(item) : new RichText(item);
				richText.end = "";
				if (doHighlight) this._highlighter.highlight(richText);
				text = richText;
			} else text = new Pretty(item, {
				...PRINT_DATA_BOUNDS,
				highlighter: doHighlight ? this._highlighter : NO_HIGHLIGHT,
				indentGuides: doHighlight
			});
			const run = blocks.at(-1);
			if (run?.kind === "text") run.items.push(new RichText(sep, { end: "" }), text);
			else blocks.push({
				kind: "text",
				items: [text]
			});
		}
		const renderOpts = {
			...this.options,
			justify: opts.justify === "default" ? void 0 : opts.justify,
			overflow: opts.overflow === "ignore" ? void 0 : opts.overflow,
			noWrap: softWrap || opts.overflow === "ignore"
		};
		const styles = [printStyle, this._style].filter((style) => !style.isNull);
		const styleContent = (segments) => styles.reduce((styled, style) => Segment.applyStyle(styled, style), segments);
		const terminator = end === "\\n" ? Segment.line() : new Segment(end);
		const output = [];
		for (const block of blocks) if (block.kind === "text") output.push(...styleContent(block.items.flatMap((item) => [...item.render(renderOpts)])), terminator);
		else for (const line of Segment.splitLines(block.renderable.render(renderOpts))) output.push(...styleContent(line), Segment.line());
		const cropWidth = !softWrap && (opts.crop ?? true) ? this.width : Infinity;
		this._writeSegments([...Segment.cropLines(output, cropWidth)]);
	}
	log(...args) {
		const timeText = new RichText(\`[\${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] \`, { end: "" });
		timeText.stylize("log.time");
		this.print(timeText, ...args);
	}
	rule(title, options) {
		const segments = [...new Rule(title, options).render(this.options)];
		this._writeSegments(segments);
	}
	printJson(json, options) {
		const renderable = typeof json === "string" ? JSONRenderable.fromString(json, options) : JSONRenderable.fromData(json, options);
		this.print(renderable, { softWrap: true });
	}
	beginCapture() {
		this._capture = "";
	}
	endCapture() {
		const result = this._capture ?? "";
		this._capture = null;
		return result;
	}
	exportText({ clear = true } = {}) {
		const text = this._recorded.map((s) => s.text).join("");
		if (clear) this._recorded = [];
		return text;
	}
	exportHtml({ theme, clear = true } = {}) {
		const html = encodeHtml(this._recorded, theme);
		if (clear) this._recorded = [];
		return html;
	}
	_writeSegments(segments) {
		if (this._record) {
			for (const segment of segments) if (!segment.isControl) this._recorded.push(segment);
		}
		const encoded = segmentsToString(segments, this._destination);
		if (encoded.length > 0) this._write(encoded);
	}
	_write(text) {
		if (this._capture !== null) {
			this._capture += text;
			return;
		}
		(this._file ?? defaultSink(this._stream)).write(text);
	}
};
//#endregion
//#region src/renderables/padding.ts
/**
* Parses the shapes a caller may write padding in — one number, a vertical/
* horizontal pair, or all four sides — into the four-sided form every
* renderable indexes by, flooring each side at zero.
*
* [LAW:parse-dont-validate] This is the one crossing between the public
* padding vocabulary and the internal tuple, which is why the floor lives
* here and nowhere downstream: past this point \`" ".repeat(left)\` is safe in
* any renderable without asking what the caller passed. A negative side used
* to reach the renderers, where \`Panel\` drew content rows wider than its own
* border and \`Table\` threw outright.
*/
function normalizePadding(padding) {
	const side = (n) => Number.isFinite(n) ? cellCount(n) : 0;
	const sides = typeof padding === "number" ? [
		padding,
		padding,
		padding,
		padding
	] : padding.length === 2 ? [
		padding[0],
		padding[1],
		padding[0],
		padding[1]
	] : padding;
	return [
		side(sides[0]),
		side(sides[1]),
		side(sides[2]),
		side(sides[3])
	];
}
//#endregion
//#region src/renderables/panel.ts
/**
* Panel — a bordered box that wraps content, with optional title and subtitle.
*/
function layoutPanel(outerWidth, padding) {
	const [, padRightWanted, , padLeftWanted] = padding;
	let budget = cellCount(outerWidth);
	const take = (want) => {
		const got = Math.min(want, budget);
		budget -= got;
		return got;
	};
	const left = take(1);
	const right = take(1);
	const firstContentCell = take(1);
	const padLeft = take(padLeftWanted);
	const padRight = take(padRightWanted);
	const contentWidth = firstContentCell + budget;
	return {
		left,
		right,
		padLeft,
		contentWidth,
		padRight,
		spanWidth: padLeft + contentWidth + padRight
	};
}
/**
* Every cell of a panel that is not content canvas. Read off the geometry
* rather than recomputed as \`2 + padLeft + padRight\`, because the two differ
* exactly where this panel is squeezed: a width that cannot afford its right
* frame column or its padding does not spend cells on them, and a measurement
* that assumed it did would report a minimum larger than its own maximum.
*/
function frameOverhead(geometry) {
	return geometry.left + geometry.right + geometry.padLeft + geometry.padRight;
}
/**
* The style of text set into a border: its own when one was given, the
* border's otherwise — the one rule for "what colour is the title text in".
*/
function borderTextStyle(options, own, border) {
	return own === void 0 ? border : getStyle(options, own);
}
var Panel = class Panel {
	renderable;
	box;
	title;
	subtitle;
	bottomRightAccessory;
	expand;
	style;
	borderStyle;
	titleStyle;
	subtitleStyle;
	width;
	padding;
	constructor(content, options) {
		this.renderable = embed(content);
		this.box = options?.box ?? ROUNDED;
		this.title = options?.title;
		this.subtitle = options?.subtitle;
		this.bottomRightAccessory = options?.bottomRightAccessory;
		this.expand = options?.expand !== false;
		this.style = options?.style ?? NULL_STYLE;
		this.borderStyle = options?.borderStyle ?? NULL_STYLE;
		this.titleStyle = options?.titleStyle;
		this.subtitleStyle = options?.subtitleStyle;
		this.width = options?.width;
		this.padding = normalizePadding(options?.padding ?? [
			0,
			1,
			0,
			1
		]);
	}
	*render(rawOptions) {
		const options = withBoundedWidth(rawOptions, this);
		const box = options.asciiOnly ? this.box.substitute({ asciiOnly: true }) : this.box;
		const borderStyle = getStyle(options, this.borderStyle);
		const style = getStyle(options, this.style);
		const border = borderStyle.isNull ? void 0 : borderStyle;
		const contentStyle = style.isNull ? void 0 : style;
		const geometry = layoutPanel(this._getPanelWidth(options), this.padding);
		const [padTop, , padBottom] = this.padding;
		const contentLines = this._renderContent(options, geometry.contentWidth);
		yield* this._renderTopBorder(options, box, geometry, border);
		for (let i = 0; i < padTop; i++) yield* this._renderRow(box, geometry, [], border, contentStyle);
		for (const line of contentLines) yield* this._renderRow(box, geometry, line, border, contentStyle);
		for (let i = 0; i < padBottom; i++) yield* this._renderRow(box, geometry, [], border, contentStyle);
		yield* this._renderBottomBorder(options, box, geometry, border);
	}
	/**
	* The wrapped renderable's lines, laid out on a canvas \`contentWidth\` cells
	* wide. Below width 3 a panel is all frame and the canvas holds no lines —
	* but the render still happens, because a \`bottomRightAccessory\` thunk
	* fires at every width and reads state this render populates.
	*/
	_renderContent(options, contentWidth) {
		const [padTop, , padBottom] = this.padding;
		const height = insetHeight(options.height, 2 + padTop + padBottom);
		const innerOptions = {
			...options,
			maxWidth: contentWidth,
			height
		};
		const lines = fitHeight(Segment.splitLines([...this.renderable.render(innerOptions)]), height);
		return contentWidth === 0 ? [] : lines;
	}
	/**
	* One row of the panel body: frame column, span, frame column.
	*
	* [LAW:single-enforcer] \`adjustLineLength\` is the one place a width is
	* decided here, and it runs twice against two different widths. The first
	* pass crops content that rendered wider than the canvas it was handed (a
	* \`Table\` at its natural width, say) back to the canvas, so an oversized
	* child is trimmed rather than allowed to eat the right-hand padding. The
	* second fills the rest of the span, which is the trailing padding and any
	* shortfall in one stroke.
	*/
	*_renderRow(box, geometry, line, border, contentStyle) {
		const frame = box.getContentChars("row");
		yield new Segment(frame.left.repeat(geometry.left), border);
		const content = Segment.adjustLineLength(line, geometry.contentWidth, contentStyle, false);
		const span = [new Segment(" ".repeat(geometry.padLeft), contentStyle), ...content];
		yield* Segment.adjustLineLength(span, geometry.spanWidth, contentStyle);
		yield new Segment(frame.right.repeat(geometry.right), border);
		yield Segment.line();
	}
	measure(rawOptions) {
		const options = withCellWidth(rawOptions);
		const declared = this._declaredWidth;
		if (declared !== void 0) {
			const width = Math.min(options.maxWidth, declared);
			return {
				minimum: width,
				maximum: width
			};
		}
		return this._fitRange(options);
	}
	/**
	* The width this panel wants when nothing declared one for it: its content
	* plus its own frame, both read off the division it will render against.
	*
	* [LAW:one-source-of-truth] \`measure\` and \`_getPanelWidth\` ask this same
	* question, and each used to work it out itself — the same \`layoutPanel\`, the
	* same \`frameOverhead\`, the same \`Math.min(maxWidth, maximum + overhead)\`,
	* written twice. That is the pattern \`_declaredWidth\` below was extracted to
	* stop, left standing for the fit case; changing how overhead is derived in
	* one copy is all it would take to put \`measure\` and \`render\` back into the
	* disagreement this epic spent itself closing.
	*/
	_fitRange(options) {
		const geometry = layoutPanel(options.maxWidth, this.padding);
		const overhead = frameOverhead(geometry);
		if (isMeasurable(this.renderable)) {
			const innerOptions = {
				...options,
				maxWidth: geometry.contentWidth
			};
			const measurement = Measurement.get(innerOptions, this.renderable);
			const maximum = Math.min(options.maxWidth, measurement.maximum + overhead);
			return {
				minimum: Math.min(measurement.minimum + overhead, maximum),
				maximum
			};
		}
		return {
			minimum: Math.min(overhead, options.maxWidth),
			maximum: options.maxWidth
		};
	}
	/**
	* The width this panel was told to be, as a count of cells.
	*
	* [LAW:one-source-of-truth] \`measure\` and \`_getPanelWidth\` answer the same
	* question about the same field, so they read it from here. Answered
	* separately, \`measure\` reported nine cells of content while \`render\` drew the
	* declared twelve, and the parent that divided space from the range got a
	* panel three cells wider than the share it granted.
	*/
	get _declaredWidth() {
		return this.width === void 0 ? void 0 : cellCount(this.width);
	}
	_getPanelWidth(options) {
		const declared = this._declaredWidth;
		if (declared !== void 0) return Math.min(declared, options.maxWidth);
		if (this.expand) return options.maxWidth;
		return this._fitRange(options).maximum;
	}
	*_renderTopBorder(options, box, geometry, border) {
		const innerBorderWidth = geometry.spanWidth;
		const titleSeg = borderTextStyle(options, this.titleStyle, border);
		const title = inlineLabel(this.title, options, titleSeg);
		const titleWidth = Segment.getLineLength(title);
		if (titleWidth === 0) {
			yield new Segment(box.top.left.repeat(geometry.left), border);
			yield new Segment(box.top.horizontal.repeat(innerBorderWidth), border);
			yield new Segment(box.top.right.repeat(geometry.right), border);
			yield Segment.line();
			return;
		}
		yield new Segment(box.top.left.repeat(geometry.left), border);
		if (titleWidth >= innerBorderWidth) yield* Segment.adjustLineLength(title, innerBorderWidth, titleSeg);
		else {
			const leftRuleWidth = Math.floor((innerBorderWidth - titleWidth) / 2);
			const rightRuleWidth = innerBorderWidth - titleWidth - leftRuleWidth;
			if (leftRuleWidth > 0) yield new Segment(box.top.horizontal.repeat(leftRuleWidth), border);
			yield* title;
			if (rightRuleWidth > 0) yield new Segment(box.top.horizontal.repeat(rightRuleWidth), border);
		}
		yield new Segment(box.top.right.repeat(geometry.right), border);
		yield Segment.line();
	}
	*_renderBottomBorder(options, box, geometry, border) {
		const innerBorderWidth = geometry.spanWidth;
		const accessory = this._resolveAccessory(this.bottomRightAccessory);
		const accessoryDisplay = accessory === void 0 ? "" : typeof accessory === "string" ? \` \${accessory} \` : \` \${accessory.plain} \`;
		const accessoryWidth = cellLen(accessoryDisplay);
		const accessoryOwn = accessory instanceof RichText ? accessory.resolvedStyle(options) : NULL_STYLE;
		const accessoryStyle = accessoryOwn.isNull ? border : accessoryOwn;
		yield new Segment(box.bottom.left.repeat(geometry.left), border);
		const centerWidth = Math.max(0, innerBorderWidth - accessoryWidth);
		const subtitleSeg = borderTextStyle(options, this.subtitleStyle, border);
		const subtitle = inlineLabel(this.subtitle, options, subtitleSeg);
		const subtitleWidth = Segment.getLineLength(subtitle);
		if (subtitleWidth === 0) {
			if (centerWidth > 0) yield new Segment(box.bottom.horizontal.repeat(centerWidth), border);
		} else if (subtitleWidth >= centerWidth) yield* Segment.adjustLineLength(subtitle, centerWidth, subtitleSeg);
		else {
			const leftRuleWidth = Math.floor((centerWidth - subtitleWidth) / 2);
			const rightRuleWidth = centerWidth - subtitleWidth - leftRuleWidth;
			if (leftRuleWidth > 0) yield new Segment(box.bottom.horizontal.repeat(leftRuleWidth), border);
			yield* subtitle;
			if (rightRuleWidth > 0) yield new Segment(box.bottom.horizontal.repeat(rightRuleWidth), border);
		}
		if (accessoryWidth > 0) yield new Segment(accessoryWidth > innerBorderWidth ? setCellSize(accessoryDisplay, asCellCol(innerBorderWidth)) : accessoryDisplay, accessoryStyle);
		yield new Segment(box.bottom.right.repeat(geometry.right), border);
		yield Segment.line();
	}
	_resolveAccessory(a) {
		if (a === void 0) return void 0;
		if (typeof a === "function") return a();
		return a;
	}
	static fit(content, options) {
		return new Panel(content, {
			...options,
			expand: false
		});
	}
};
//#endregion
//#region src/renderables/table.ts
/**
* Table — tabular data with headers, borders, auto-sizing, and alignment.
*/
/** A \`want\` no budget can satisfy: the column takes every cell its weight earns. */
var UNBOUNDED = Number.MAX_SAFE_INTEGER;
/**
* A column's \`want\` or \`weight\`. Finite, because \`UNBOUNDED\` is this model's
* own infinity: a literal \`Infinity\` reaching \`distribute\` makes a column's
* weighted share \`Infinity / Infinity\`, which is NaN, and the NaN then skews
* every other elastic column in the table.
*/
var demandCells = (n) => Math.min(cellCount(n), UNBOUNDED);
/**
* Hand out \`total\` cells across \`demands\`, weighted, and never past a demand's
* \`want\`.
*
* A column whose proportional share would overshoot its cap is granted its
* whole want and dropped, and the cells it could not use are reopened to the
* columns still under their caps. That repeats until everyone still open fits
* within their share; one largest-remainder pass then places the cells the
* shares left as fractions, so the granted widths sum to \`total\` exactly — or
* to the point where every column is capped, which is how a table stays
* narrower than a width it was offered.
*
* Each round caps at least one column or is the last, so the work is bounded by
* the number of columns and never by the width. That bound is the point rather
* than an optimization: handing cells out one at a time made the iteration
* count the width itself, which stalled on a very wide table and — since
* \`Infinity - 1 === Infinity\` — never terminated at all for a \`maxWidth\` of
* \`Infinity\` held open by a ratio column. Capping by want reaches that case in
* one round.
*/
function distribute(total, demands) {
	const granted = demands.map(() => 0);
	let open = demands.map((_, index) => index).filter((index) => demands[index].weight > 0 && demands[index].want > 0);
	let remaining = Math.max(0, total);
	const weightOf = (indices) => indices.reduce((sum, index) => sum + demands[index].weight, 0);
	while (open.length > 0 && remaining > 0) {
		const weightSum = weightOf(open);
		const capped = open.filter((index) => remaining * demands[index].weight / weightSum >= demands[index].want);
		if (capped.length === 0) break;
		for (const index of capped) {
			granted[index] = demands[index].want;
			remaining -= demands[index].want;
		}
		open = open.filter((index) => !capped.includes(index));
	}
	if (open.length > 0 && remaining > 0) {
		const weightSum = weightOf(open);
		const shares = open.map((index) => remaining * demands[index].weight / weightSum);
		const whole = shares.map(Math.floor);
		let residue = remaining - whole.reduce((sum, cells) => sum + cells, 0);
		const byFraction = open.map((_, slot) => slot).sort((a, b) => shares[b] - whole[b] - (shares[a] - whole[a]) || a - b);
		for (const slot of byFraction) {
			if (residue <= 0) break;
			whole[slot]++;
			residue--;
		}
		open.forEach((index, slot) => {
			granted[index] = whole[slot];
		});
	}
	return granted;
}
function layoutTable(outerWidth, demands, padding, frame) {
	const [, padRightWanted, , padLeftWanted] = padding;
	let budget = cellCount(outerWidth);
	const take = (want) => {
		const got = Math.min(Math.max(0, want), budget);
		budget -= got;
		return got;
	};
	const edge = budget >= frame.edge * 2 ? frame.edge : 0;
	take(edge * 2);
	const seats = [];
	while (seats.length < demands.length) {
		const seat = Math.min(1, demands[seats.length].want);
		const cost = (seats.length > 0 ? frame.divider : 0) + seat;
		if (budget < cost) break;
		take(cost);
		seats.push(seat);
	}
	const seated = seats.length;
	const takePerColumn = (want) => {
		const per = seated === 0 ? 0 : Math.min(Math.max(0, want), Math.floor(budget / seated));
		budget -= per * seated;
		return per;
	};
	const padLeft = takePerColumn(padLeftWanted);
	const padRight = takePerColumn(padRightWanted);
	const seatedDemands = demands.slice(0, seated);
	const reserved = seatedDemands.map((demand, index) => take(demand.reserved - seats[index]));
	const wanted = distribute(budget, seatedDemands.map((demand, index) => ({
		want: Math.max(0, demand.want - seats[index] - reserved[index]),
		weight: demand.weight
	})));
	const stretched = distribute(budget - wanted.reduce((sum, cells) => sum + cells, 0), seatedDemands.map((demand) => ({
		want: UNBOUNDED,
		weight: demand.stretch
	})));
	const columns = wanted.map((cells, index) => seats[index] + reserved[index] + cells + stretched[index]);
	const cellWidths = columns.map((width) => padLeft + width + padRight);
	return {
		edge,
		divider: frame.divider,
		padLeft,
		padRight,
		columns,
		cellWidths,
		totalWidth: edge * 2 + Math.max(0, seated - 1) * frame.divider + cellWidths.reduce((sum, width) => sum + width, 0)
	};
}
var Column = class Column {
	_header;
	_footer;
	headerStyle;
	footerStyle;
	style;
	justify;
	width;
	minWidth;
	maxWidth;
	ratio;
	noWrap;
	overflow;
	_cells;
	constructor(options) {
		this.header = options?.header;
		this.footer = options?.footer;
		this.headerStyle = options?.headerStyle ?? NULL_STYLE;
		this.footerStyle = options?.footerStyle ?? NULL_STYLE;
		this.style = options?.style ?? NULL_STYLE;
		this.justify = options?.justify ?? "left";
		this.width = options?.width;
		this.minWidth = options?.minWidth;
		this.maxWidth = options?.maxWidth;
		this.ratio = options?.ratio;
		this.noWrap = options?.noWrap ?? false;
		this.overflow = options?.overflow ?? "ellipsis";
		this._cells = [];
	}
	/**
	* The two stamped cells, parsed on assignment rather than at the constructor.
	* \`Table.columns\` hands out the live column and both fields are public, so a
	* constructor-only stamp held only until the first \`columns[0].footer = mine\`
	* — which installed content that had parsed no markup, still carried its
	* \`end\`, and was still owned by the caller, into a slot every reader below
	* assumes \`embeddedText\` has been through. [LAW:parse-dont-validate] The setter
	* is the border, so the guarantee holds for the object's whole lifetime and
	* the constructor is one caller of it rather than the one place it is true.
	*
	* Absent and empty are the same header, and the same footer.
	* [LAW:types-are-the-program] Rich declares \`footer: RenderableType = ""\`, so
	* a column always has one and \`show_footer\` alone decides whether it is
	* drawn. Modelling the absence as \`undefined\` instead made "no column has a
	* footer" a state the render path could ask about — and it did, skipping the
	* row a caller had asked for. \`embeddedText\` already maps nothing onto empty,
	* which is why the setters take \`undefined\` rather than defaulting around it.
	*/
	get header() {
		return this._header;
	}
	set header(content) {
		this._header = embeddedText(content);
	}
	get footer() {
		return this._footer;
	}
	set footer(content) {
		this._footer = embeddedText(content);
	}
	get flexible() {
		return this.ratio !== void 0 && this.ratio > 0;
	}
	/** @internal */
	addCell(cell) {
		this._cells.push(cell);
	}
	/** @internal */
	getCells() {
		return this._cells;
	}
	copy() {
		const col = new Column({
			header: this.header,
			footer: this.footer,
			justify: this.justify,
			width: this.width,
			minWidth: this.minWidth,
			maxWidth: this.maxWidth,
			ratio: this.ratio,
			noWrap: this.noWrap,
			overflow: this.overflow
		});
		col.headerStyle = this.headerStyle;
		col.footerStyle = this.footerStyle;
		col.style = this.style;
		return col;
	}
};
var Table = class Table {
	_columns;
	_rows;
	box;
	title;
	caption;
	expand;
	showHeader;
	showFooter;
	showLines;
	showEdge;
	padding;
	style;
	headerStyle;
	footerStyle;
	borderStyle;
	titleStyle;
	captionStyle;
	titleJustify;
	captionJustify;
	tableWidth;
	minWidth;
	rowStyles;
	constructor(options) {
		this._columns = [];
		this._rows = [];
		this.box = options?.box !== void 0 ? options.box : HEAVY_HEAD;
		const titleVal = options?.title;
		this.title = titleVal !== void 0 ? embeddedText(titleVal) : void 0;
		const captionVal = options?.caption;
		this.caption = captionVal !== void 0 ? embeddedText(captionVal) : void 0;
		this.expand = options?.expand ?? false;
		this.showHeader = options?.showHeader !== false;
		this.showFooter = options?.showFooter ?? false;
		this.showLines = options?.showLines ?? false;
		this.showEdge = options?.showEdge !== false;
		this.padding = normalizePadding(options?.padding ?? [
			0,
			1,
			0,
			1
		]);
		this.style = options?.style ?? NULL_STYLE;
		this.headerStyle = options?.headerStyle ?? "table.header";
		this.footerStyle = options?.footerStyle ?? "table.footer";
		this.borderStyle = options?.borderStyle ?? NULL_STYLE;
		this.titleStyle = options?.titleStyle ?? "table.title";
		this.captionStyle = options?.captionStyle ?? "table.caption";
		this.titleJustify = options?.titleJustify ?? "center";
		this.captionJustify = options?.captionJustify ?? "center";
		this.tableWidth = options?.width;
		this.minWidth = options?.minWidth;
		this.rowStyles = options?.rowStyles ?? [];
	}
	get columns() {
		return this._columns;
	}
	get rowCount() {
		return this._rows.length;
	}
	addColumn(header, options) {
		const col = new Column({
			...options,
			header: header ?? options?.header
		});
		this._columns.push(col);
		return this;
	}
	addRow(...cells) {
		let endSection = false;
		const lastArg = cells[cells.length - 1];
		if (typeof lastArg === "object" && lastArg !== null && !(lastArg instanceof RichText) && !("render" in lastArg) && "endSection" in lastArg) {
			endSection = lastArg.endSection;
			cells = cells.slice(0, -1);
		}
		const resolved = cells.map(embed);
		while (this._columns.length < resolved.length) this.addColumn();
		this._rows.push({
			cells: resolved,
			endSection
		});
		return this;
	}
	addSection() {
		if (this._rows.length > 0) this._rows[this._rows.length - 1].endSection = true;
		return this;
	}
	*render(rawOptions) {
		if (this._columns.length === 0) {
			yield Segment.line();
			return;
		}
		const options = withBoundedWidth(rawOptions, this);
		const drawable = this.box?.substitute({ asciiOnly: options.asciiOnly });
		const box = (this.showHeader ? drawable : drawable?.plainHeaded()) ?? null;
		const borderStyle = getStyle(options, this.borderStyle);
		const border = borderStyle.isNull ? void 0 : borderStyle;
		const geometry = this._geometry(this._outerWidth(options));
		const edge = geometry.edge === 1;
		if (this.title) yield* this._renderTitle(options, this.title, geometry.totalWidth, this.titleStyle, this.titleJustify);
		if (box && this.showEdge) yield* box.getTop(geometry.cellWidths, border, edge);
		if (this.showHeader) {
			const headerCells = this._columns.map((c) => c.header);
			yield* this._renderRow(options, headerCells, geometry, box, "head", border, this.headerStyle);
			if (box) yield* box.getRow(geometry.cellWidths, "head", border, edge);
		}
		for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
			const row = this._rows[rowIdx];
			const rowCells = this._columns.map((_, colIdx) => row.cells[colIdx] ?? embeddedText(void 0));
			const rowStyle = this.rowStyles.length > 0 ? this.rowStyles[rowIdx % this.rowStyles.length] : NULL_STYLE;
			yield* this._renderRow(options, rowCells, geometry, box, "row", border, rowStyle);
			if ((this.showLines || row.endSection) && box && rowIdx < this._rows.length - 1) yield* box.getRow(geometry.cellWidths, "row", border, edge);
		}
		if (this.showFooter) {
			if (box) yield* box.getRow(geometry.cellWidths, "foot", border, edge);
			const footerCells = this._columns.map((c) => c.footer);
			yield* this._renderRow(options, footerCells, geometry, box, "foot", border, this.footerStyle);
		}
		if (box && this.showEdge) yield* box.getBottom(geometry.cellWidths, border, edge);
		if (this.caption) yield* this._renderTitle(options, this.caption, geometry.totalWidth, this.captionStyle, this.captionJustify);
	}
	/**
	* [LAW:one-source-of-truth] Both ends of the range are widths the geometry
	* actually produced — the maximum from the demands as they stand, the
	* minimum from the same layout with every column asking for a single cell.
	* Neither end stretches: a stretch only spends cells an offer happens to
	* leave over, and a renderable reports the width its content wants rather
	* than the width it was offered. Letting it in made an expanding table
	* measure \`Infinity\` against an unbounded offer, where \`withBoundedWidth\`
	* needs a natural width to fall back on.
	* Neither can exceed the width offered and the tighter request cannot exceed
	* the looser one, so the range cannot invert. Deriving the minimum from raw
	* column and padding counts instead is what used to return
	* \`{minimum: 6, maximum: 1}\` at \`maxWidth: 1\` — a floor above its own ceiling.
	*/
	measure(rawOptions) {
		const options = withCellWidth(rawOptions);
		const outerWidth = this._outerWidth(options);
		const frame = this._frame();
		const demands = this._columnDemands();
		const laidOut = layoutTable(outerWidth, demands.map((demand) => ({
			...demand,
			stretch: 0
		})), this.padding, frame).totalWidth;
		const maximum = laidOut >= UNBOUNDED ? Infinity : laidOut;
		const tightest = layoutTable(outerWidth, demands.map((demand) => ({
			reserved: 0,
			want: Math.min(1, demand.want),
			weight: 1,
			stretch: 0
		})), this.padding, frame).totalWidth;
		return {
			minimum: Math.min(maximum, Math.max(tightest, this.minWidth ?? 0)),
			maximum
		};
	}
	static grid(options) {
		return new Table({
			...options,
			box: null,
			showHeader: false,
			showEdge: false,
			padding: options?.padding ?? [
				0,
				1,
				0,
				0
			]
		});
	}
	_frame() {
		return {
			divider: this.box ? 1 : 0,
			edge: this.box && this.showEdge ? 1 : 0
		};
	}
	/**
	* The width this table lays itself out against: what it was told to be, as a
	* count of cells, never wider than what it was offered.
	*
	* [LAW:one-source-of-truth] \`render\` and \`measure\` divide the same two fields
	* and once did it in two places. \`measure\` bounded the declared width by the
	* offer and \`render\` preferred it outright, walking past the value
	* \`withBoundedWidth\` had just resolved — so \`new Table({width: Infinity})\`
	* with a \`{ratio: 1}\` column granted that column \`UNBOUNDED\` cells and threw
	* \`RangeError: Invalid string length\` out of the top border, at a perfectly
	* ordinary 80-cell offer.
	*/
	_outerWidth(options) {
		return Math.min(this.tableWidth === void 0 ? options.maxWidth : cellCount(this.tableWidth), options.maxWidth);
	}
	_geometry(outerWidth) {
		return layoutTable(outerWidth, this._columnDemands(), this.padding, this._frame());
	}
	/**
	* [LAW:dataflow-not-control-flow] The three ways a column can be sized —
	* declared width, ratio, natural content — differ only in the demand they
	* produce, and \`expand\` only in its \`stretch\`. They are resolved once, here, into uniform data, so
	* \`layoutTable\` runs the same apportionment for every table and no sizing
	* mode gets its own path through the width division.
	*/
	_columnDemands() {
		const elastic = this._columns.some((col) => col.flexible);
		return this._columns.map((col, index) => {
			if (col.width !== void 0) {
				const declared = demandCells(col.width);
				return {
					reserved: declared,
					want: declared,
					weight: 0,
					stretch: 0
				};
			}
			if (elastic) return {
				reserved: 0,
				want: UNBOUNDED,
				weight: demandCells(col.ratio ?? 1),
				stretch: 0
			};
			const natural = demandCells(this._naturalWidth(col, index));
			return {
				reserved: 0,
				want: natural,
				weight: natural,
				stretch: this.expand ? natural : 0
			};
		});
	}
	/**
	* Every cell column \`index\` draws, in draw order.
	*
	* [LAW:one-source-of-truth] The reference's \`_get_cells\` is the one answer to
	* "which cells belong to this column", and both \`_measure_column\` and
	* \`_render\` read it. Enumerating that set a second time inside the width path
	* is how the two ends drifted: the header was measured whether or not
	* \`showHeader\` drew it, and \`col.footer\` was never measured at all, so a
	* footer wider than its column — a totals row, exactly — was cut to \`…\`.
	* A flag is the whole membership rule; nothing here asks after content.
	*/
	*_columnCells(col, index) {
		if (this.showHeader) yield col.header;
		for (const row of this._rows) yield row.cells[index] ?? embeddedText(void 0);
		if (this.showFooter) yield col.footer;
	}
	/**
	* The widest cell in a column, bounded by its own \`minWidth\`/\`maxWidth\`.
	* Zero for a column that draws nothing — a gutter asks for its padding and
	* nothing else.
	*/
	_naturalWidth(col, index) {
		let natural = 0;
		for (const cell of this._columnCells(col, index)) natural = Math.max(natural, cell instanceof RichText ? cellLen(cell.plain) : cellLen(String(cell)));
		if (col.minWidth !== void 0) natural = Math.max(natural, col.minWidth);
		if (col.maxWidth !== void 0) natural = Math.min(natural, col.maxWidth);
		return natural;
	}
	*_renderRow(options, cells, geometry, box, level, border, ownStyle) {
		const { padLeft, padRight, columns } = geometry;
		const rowStyle = getStyle(options, ownStyle);
		const frame = box?.getContentChars(level);
		const cellLines = columns.map((cellWidth, index) => {
			const col = this._columns[index];
			const segs = [...(cells[index] ?? embed("")).render({
				...options,
				maxWidth: cellWidth,
				justify: col.justify,
				overflow: col.overflow,
				noWrap: col.noWrap,
				height: void 0
			})];
			const lines = Segment.splitLines(segs).map((line) => Segment.adjustLineLength(line, cellWidth));
			return lines.length > 0 ? lines : [[new Segment(" ".repeat(cellWidth))]];
		});
		const maxLines = cellLines.reduce((most, lines) => Math.max(most, lines.length), 1);
		for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
			if (frame && geometry.edge === 1) yield new Segment(frame.left, border);
			for (let colIdx = 0; colIdx < columns.length; colIdx++) {
				if (colIdx > 0 && frame) yield new Segment(frame.vertical, border);
				const cellWidth = columns[colIdx];
				if (padLeft > 0) yield new Segment(" ".repeat(padLeft));
				const line = cellLines[colIdx][lineIdx] ?? [new Segment(" ".repeat(cellWidth))];
				yield* rowStyle.isNull ? line : Segment.applyStyle(line, rowStyle);
				if (padRight > 0) yield new Segment(" ".repeat(padRight));
			}
			if (frame && geometry.edge === 1) yield new Segment(frame.right, border);
			yield Segment.line();
		}
	}
	*_renderTitle(options, text, tableWidth, ownStyle, justify) {
		const style = getStyle(options, ownStyle);
		const titleStyle = style.isNull ? void 0 : style;
		const source = text.copy();
		source.justify = void 0;
		source.noWrap = false;
		const rendered = [...source.render({
			...options,
			maxWidth: tableWidth,
			justify,
			overflow: void 0,
			noWrap: false,
			height: void 0
		})];
		for (const line of Segment.splitLines(rendered)) {
			yield* Segment.applyStyle(line, titleStyle);
			yield Segment.line();
		}
	}
};
//#endregion
//#region src/renderables/live.ts
/**
* Live — animates a portion of the terminal by continuously re-rendering.
*
* Two modes:
* - **Inline** (default): clears and redraws N lines in the current scroll
*   region. Good for spinners/progress bars below other output.
* - **Alt-screen** (\`altScreen: true\`): enters the alternate screen buffer
*   on start, cursor-homes on each refresh (no clear flicker), and restores
*   the original buffer on stop. The screen is the frame's region, so a
*   \`Layout\` fills it. Good for full-screen TUI apps.
*/
var Live = class {
	_renderable;
	_console;
	_refreshPerSecond;
	_autoRefresh;
	_transient;
	_verticalOverflow;
	_altScreen;
	_timer;
	_lastLineCount;
	_started;
	_firstRefresh;
	constructor(renderable, options) {
		this._renderable = renderable;
		this._console = options?.console ?? new Console({ forceTerminal: true });
		this._refreshPerSecond = options?.refreshPerSecond ?? 4;
		this._autoRefresh = options?.autoRefresh !== false;
		this._transient = options?.transient ?? false;
		this._verticalOverflow = options?.verticalOverflow ?? "ellipsis";
		this._altScreen = options?.altScreen ?? false;
		this._lastLineCount = 0;
		this._started = false;
		this._firstRefresh = true;
	}
	get console() {
		return this._console;
	}
	get renderable() {
		return this._renderable;
	}
	start() {
		if (this._started) return;
		this._started = true;
		this._firstRefresh = true;
		const stream = this._console.file;
		if (this._altScreen) stream.write("\\x1B[?1049h");
		this._writeCursorControl(false);
		if (this._autoRefresh) {
			const interval = Math.floor(1e3 / this._refreshPerSecond);
			this._timer = setInterval(() => this.refresh(), interval);
		}
	}
	stop() {
		if (!this._started) return;
		this._started = false;
		if (this._timer) {
			clearInterval(this._timer);
			this._timer = void 0;
		}
		if (!this._transient) this.refresh();
		else this._clearLast();
		this._writeCursorControl(true);
		if (this._altScreen) this._console.file.write("\\x1B[0m\\x1B[?1049l");
	}
	update(renderable, options) {
		if (renderable !== void 0) this._renderable = renderable;
		if (options?.refresh) this.refresh();
	}
	refresh() {
		if (!this._renderable) return;
		if (this._altScreen) {
			this._console.file.write(this._firstRefresh ? "\\x1B[2J\\x1B[H" : "\\x1B[H");
			this._firstRefresh = false;
		} else this._clearLast();
		const options = this._console.options;
		const height = {
			rows: options.height.rows,
			exact: this._altScreen
		};
		const lines = Segment.splitLines(this._renderable.render({
			...options,
			height
		}));
		const displayLines = fitHeight(this._overflow(lines, height.rows), height);
		const lead = this._altScreen ? "\\x1B[2K" : "";
		const destination = this._console.destination;
		const output = displayLines.map((line) => lead + segmentsToString(line, destination)).join("\\n");
		this._console.file.write(this._altScreen ? output : output + "\\n");
		this._lastLineCount = this._altScreen ? 0 : displayLines.length;
	}
	_overflow(lines, rows) {
		if (this._verticalOverflow === "visible" || lines.length <= rows) return lines;
		const kept = lines.slice(0, rows);
		if (this._verticalOverflow === "ellipsis" && kept.length > 0) kept[kept.length - 1] = [new Segment("...")];
		return kept;
	}
	_clearLast() {
		if (this._lastLineCount > 0) {
			const stream = this._console.file;
			for (let i = 0; i < this._lastLineCount; i++) stream.write("\\x1B[1A\\x1B[2K");
			this._lastLineCount = 0;
		}
	}
	_writeCursorControl(show) {
		this._console.file.write(show ? "\\x1B[?25h" : "\\x1B[?25l");
	}
};
//#endregion
//#region src/renderables/layout.ts
/**
* Layout — divides the screen into rectangular regions.
*/
/**
* A share weight, not a cell count: fractions divide space meaningfully, so
* this parses where \`cellCount\` would floor. A weight that cannot name a share
* — negative, NaN, infinite — reads as zero, which already means "this pane
* does not grow" and is filtered out before any division. That is what makes
* every ratio reaching \`_distributeSpace\` and \`_rowBudgetFor\` positive.
*/
function growthRatio(ratio) {
	return Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
}
/**
* A pane rendered into a region of \`rows\` and held to exactly that many lines,
* or — with \`rows\` undefined — rendered under the layout's own budget, as a
* ceiling, at its natural height.
*
* [LAW:single-enforcer] The region's setter shapes it (\`fitHeight\`). Forwarded
* unshaped, a pane whose content ran short pulled every pane below it up, and
* one that ran long pushed them down.
*/
function paneLines(pane, options, rows) {
	const height = rows === void 0 ? stackedHeight(options.height) : {
		rows,
		exact: true
	};
	return fitHeight(Segment.splitLines(pane.render({
		...options,
		height
	})), height);
}
var Layout = class {
	name;
	visible;
	_ratio;
	_size;
	_minimumSize;
	_renderable;
	_children;
	_splitDirection;
	constructor(renderable, options) {
		if (renderable !== void 0) this._renderable = embed(renderable);
		this.name = options?.name;
		this.ratio = options?.ratio ?? 1;
		this.size = options?.size;
		this.minimumSize = options?.minimumSize ?? 1;
		this.visible = options?.visible !== false;
		this._children = [];
		this._splitDirection = void 0;
	}
	/**
	* The three declared numbers, parsed on assignment rather than at the
	* constructor. All three are public and a caller reaches them long after
	* construction — \`layout.getByName("pane")!.ratio = -1\` walked straight past a
	* constructor-only parse and put a negative weight back into the division that
	* \`_rowBudgetFor\` and \`_distributeSpace\` are written to trust.
	*
	* [LAW:parse-dont-validate] The setter is the border, so the guarantee holds
	* for the object's whole lifetime and nothing downstream re-checks. \`size\` and
	* \`minimumSize\` are cell counts; \`ratio\` is a share weight and keeps its
	* fractions. Absence is preserved rather than parsed: an undefined \`size\`
	* selects a flex pane, and \`cellCount\` would read it as a declared zero.
	*/
	get ratio() {
		return this._ratio;
	}
	set ratio(value) {
		this._ratio = growthRatio(value);
	}
	get size() {
		return this._size;
	}
	set size(value) {
		this._size = value === void 0 ? void 0 : cellCount(value);
	}
	get minimumSize() {
		return this._minimumSize;
	}
	set minimumSize(value) {
		this._minimumSize = cellCount(value);
	}
	get children() {
		return this._children;
	}
	/**
	* Whether this layout draws \`_renderable\` or its children.
	*
	* [LAW:one-source-of-truth] \`render\` and \`_naturalWidth\` must answer this the
	* same way. Asked separately they did not: \`_naturalWidth\` read it off the
	* *visible* children, so a layout holding content and a single hidden child
	* reported that content's width while \`render\` emitted nothing at all, and a
	* fit-mode \`Panel\` framed twelve cells of air.
	*/
	get _isLeaf() {
		return this._children.length === 0;
	}
	splitColumn(...layouts) {
		this._children = layouts;
		this._splitDirection = "column";
	}
	splitRow(...layouts) {
		this._children = layouts;
		this._splitDirection = "row";
	}
	update(renderable) {
		this._renderable = embed(renderable);
	}
	getByName(name) {
		if (this.name === name) return this;
		for (const child of this._children) {
			const found = child.getByName(name);
			if (found) return found;
		}
	}
	*render(rawOptions) {
		if (!this.visible) return;
		const options = withBoundedWidth(rawOptions, this);
		if (this._isLeaf) {
			if (this._renderable) yield* Segment.cropLines(this._renderable.render(options), options.maxWidth);
			return;
		}
		const visibleChildren = this._children.filter((c) => c.visible);
		if (visibleChildren.length === 0) return;
		if (this._splitDirection === "row") yield* this._renderRow(visibleChildren, options);
		else yield* this._renderColumn(visibleChildren, options);
	}
	*_renderColumn(children, options) {
		const region = regionRows(options.height);
		const shares = region === void 0 ? children.map((child) => child.size) : this._distributeSpace(children, region);
		for (let i = 0; i < children.length; i++) for (const line of paneLines(children[i], options, shares[i])) {
			yield* line;
			yield Segment.line();
		}
	}
	*_renderRow(children, options) {
		const widths = this._distributeSpace(children, options.maxWidth);
		const region = regionRows(options.height);
		const cells = children.map((child, i) => ({
			width: widths[i],
			lines: paneLines(child, {
				...options,
				maxWidth: widths[i]
			}, region)
		}));
		yield* Segment.mergeHorizontal(cells);
	}
	_distributeSpace(children, totalSpace) {
		const sizes = new Array(children.length).fill(0);
		let remaining = totalSpace;
		const growing = [];
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			if (child.size !== void 0) sizes[i] = Math.min(child.size, remaining);
			else if (child.ratio === 0) sizes[i] = Math.min(child.minimumSize, remaining);
			else {
				growing.push(i);
				continue;
			}
			remaining -= sizes[i];
		}
		if (growing.length > 0 && remaining > 0) {
			const budget = remaining;
			const totalRatio = growing.reduce((s, idx) => s + children[idx].ratio, 0);
			for (const idx of growing) {
				const child = children[idx];
				const share = Math.floor(budget * child.ratio / totalRatio);
				const allocated = Math.min(remaining, Math.max(child.minimumSize, share));
				sizes[idx] = allocated;
				remaining -= allocated;
			}
		}
		return sizes;
	}
	/**
	* The width this layout would take if nothing constrained it: its content's
	* for a leaf, its children's laid out the way the split lays them out.
	*
	* A \`size\` counts only across a row, which is the one direction in which it
	* is a width — down a column the same field is a height, and reading it as a
	* width there would report a two-line pane as two cells wide.
	*/
	_naturalWidth(options) {
		if (!this.visible) return 0;
		if (this._isLeaf) {
			if (this._renderable === void 0) return 0;
			return isMeasurable(this._renderable) ? Measurement.get(options, this._renderable).maximum : options.maxWidth;
		}
		const visible = this._children.filter((c) => c.visible);
		if (visible.length === 0) return 0;
		const widths = visible.map((c) => c._naturalWidth(options));
		if (this._splitDirection === "row") return this._rowBudgetFor(visible, widths);
		let widest = 0;
		for (const width of widths) widest = Math.max(widest, width);
		return widest;
	}
	/**
	* The budget at which \`_distributeSpace\` gives every child of a row at least
	* the width it wants — the inverse of the ratio rule above, and the reason
	* this is not the sum of those widths.
	*
	* [LAW:one-source-of-truth] A growing child receives \`floor(budget * ratio /
	* totalRatio)\`, so to receive \`want\` cells it needs the budget to reach
	* \`want * totalRatio / ratio\`, and one budget serves them all: the row needs
	* the largest demand, never their total. Summed instead, a 1:1 split of
	* "left" and "right" reported 9 and then rendered "right" into the 4 cells
	* that \`floor(9/2)\` actually hands it.
	*
	* The panes that do not grow are paid first here for the same reason they
	* are paid first there — and it is the reason this divides by no zero: a
	* \`ratio\` of 0 never reaches the division, because a pane that does not grow
	* demands nothing of a budget for growing.
	*/
	_rowBudgetFor(children, widths) {
		const totalRatio = children.filter((c) => c.size === void 0 && c.ratio !== 0).reduce((sum, c) => sum + c.ratio, 0);
		let pinned = 0;
		let budget = 0;
		for (const [i, child] of children.entries()) if (child.size !== void 0) pinned += child.size;
		else if (child.ratio === 0) pinned += child.minimumSize;
		else {
			const want = Math.max(child.minimumSize, widths[i]);
			budget = Math.max(budget, Math.ceil(want * totalRatio / child.ratio));
		}
		return pinned + budget;
	}
	measure(rawOptions) {
		const parsed = withCellWidth(rawOptions);
		const maximum = Math.min(this._naturalWidth(parsed), parsed.maxWidth);
		return {
			minimum: Math.min(this.minimumSize, maximum),
			maximum
		};
	}
};
//#endregion
//#region docs/__docs-example__.ts
new Console();
{
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const running = true;
	let tick = 0;
	const buildBodyContent = () => {
		tick += 1;
		const table = new Table({ expand: true });
		table.addColumn("service");
		table.addColumn("cpu", { justify: "right" });
		table.addColumn("load");
		for (const [i, name] of [
			"api",
			"auth",
			"worker",
			"queue",
			"cache",
			"search",
			"mail",
			"db"
		].entries()) {
			const cpu = Math.round(50 + 45 * Math.sin(tick / 6 + i * 1.7));
			const colour = cpu > 80 ? "red" : cpu > 50 ? "yellow" : "green";
			table.addRow(name, \`\${cpu}%\`, \`[\${colour}]\${"█".repeat(Math.round(cpu / 4))}[/]\`);
		}
		return new Panel(table, {
			title: "services",
			expand: true,
			borderStyle: "blue"
		});
	};
	{
		const layout = new Layout();
		layout.splitColumn(new Layout(void 0, {
			name: "header",
			size: 3
		}), new Layout(void 0, { name: "body" }));
		const live = new Live(layout, { altScreen: true });
		live.start();
		try {
			layout.getByName("header").update(new Panel("[bold magenta]My App[/]", {
				expand: true,
				borderStyle: "magenta"
			}));
			while (running) {
				layout.getByName("body").update(buildBodyContent());
				await sleep(250);
			}
		} finally {
			live.stop();
		}
	}
}
//#endregion
`;export{n as default};
