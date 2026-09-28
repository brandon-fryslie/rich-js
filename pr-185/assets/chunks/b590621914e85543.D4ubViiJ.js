const n=`var __richLibrary = (function() {
	//#region \\0rolldown/runtime.js
	var __defProp = Object.defineProperty;
	var __exportAll = (all, no_symbols) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return target;
	};
	//#endregion
	//#region node_modules/ansi-regex/index.js
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
	* Returns the largest prefix of \`text\` whose cell width fits within \`cap\` cells.
	* No padding — the returned string may be narrower than \`cap\` when the next
	* character is wide and would overshoot. Never wider than \`cap\` cells.
	*
	* When the first character already exceeds \`cap\` cells, returns "" (the caller
	* must decide whether to force-take the character or skip it).
	*/
	function cellFit(text, cap) {
		let w = 0;
		let i = 0;
		for (const ch of text) {
			const cw = cellLen(ch);
			if (w + cw > cap) break;
			w += cw;
			i += ch.length;
		}
		return text.slice(0, i);
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
	* Returns the largest code-unit offset into \`content\` whose prefix has
	* cell width ≤ \`cellCol\`. When \`cellCol\` falls mid-wide-character the
	* function stops before that character (never advances into it).
	* Clamps to \`content.length\` if \`cellCol\` exceeds the string's total
	* cell width.
	*
	* This is the inverse of \`cellLen(content.slice(0, codeUnit))\` — given a
	* visual column, return the corresponding string index.
	*
	* Returns \`CodePoint\` because \`for...of\` iteration always stops on a
	* code-point boundary.
	*/
	function cellColToCodeUnitOffset(content, cellCol) {
		let w = 0;
		let i = 0;
		for (const ch of content) {
			if (w >= cellCol) break;
			const cw = cellLen(ch);
			if (w + cw > cellCol) break;
			w += cw;
			i += ch.length;
		}
		return asCodePoint(i);
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
	/**
	* Step back one full Unicode code point from \`cu\`, returning the code-unit
	* offset of the start of the *previous* code point. Returns 0 when already
	* at the start.
	*
	* Handles surrogate pairs: when the code unit at \`cu - 1\` is a low surrogate
	* AND the code unit at \`cu - 2\` is a high surrogate, steps back 2 code units.
	* Unpaired surrogates are treated as 1-CU characters.
	*/
	function prevCodePoint(s, cu) {
		if (cu <= 0) return asCodePoint(0);
		const low = s.charCodeAt(cu - 1);
		if (low >= 56320 && low <= 57343 && cu >= 2) {
			const high = s.charCodeAt(cu - 2);
			if (high >= 55296 && high <= 56319) return asCodePoint(cu - 2);
		}
		return asCodePoint(cu - 1);
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
	/**
	* WCAG 2.x contrast ratio between two colors, in [1, 21]. Symmetric — the
	* order of arguments does not matter. 4.5 is the AA threshold for normal
	* text, 3.0 for large text.
	*
	* Assumes opaque inputs: alpha is ignored, since the displayed contrast of a
	* translucent color depends on what it composites over. For a translucent
	* foreground, flatten it first (or use \`ensureContrast\`, which does).
	*/
	function contrastRatio(a, b) {
		return luminanceRatio(relativeLuminance(a), relativeLuminance(b));
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
	var HEX_RE$1 = /^#([0-9a-f]{6})$/;
	var HEX_RGBA_RE = /^#([0-9a-f]{8})$/;
	var RGB_RE = /^rgb\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*\\)$/;
	var COLOR_NUMBER_RE = /^color\\((\\d{1,3})\\)$/;
	function parseSingle(key) {
		if (key === "default" || key === "") return ColorSpec.default();
		const namedIndex = ANSI_COLOR_NAMES[key];
		if (namedIndex !== void 0) return new ColorSpec(key, namedIndex < 16 ? ColorDepth.STANDARD : ColorDepth.EIGHT_BIT, namedIndex);
		const hexRgbaMatch = HEX_RGBA_RE.exec(key);
		if (hexRgbaMatch) return new ColorSpec(key, ColorDepth.TRUECOLOR, void 0, parseRgbaHex(hexRgbaMatch[1]));
		const hexMatch = HEX_RE$1.exec(key);
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
	var WINDOWS_TABLE = new ColorTable(buildWindowsTable());
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
	//#region src/core/oklch.ts
	/**
	* OKLCH color space — perceptually-uniform polar form of OKLab.
	*
	* Math from Björn Ottosson's OKLab specification:
	*   https://bottosson.github.io/posts/oklab/
	*
	* The full pipeline:
	*   sRGB (0..255 int)  ↔  sRGB linear (0..1 float)  ↔  OKLab  ↔  OKLCH polar
	* \`fromRgba\` walks left→right, \`toRgba\` walks right→left. The only lossy
	* step is the final 0..255 quantization; the float math itself is
	* reversible to within a few ULP.
	*
	* [LAW:one-type-per-behavior] OKLCH and sRGB are different *behaviors*:
	* sRGB is the wire format terminals consume (what ANSI escape codes
	* carry); OKLCH is the perceptual manipulation space (where equal
	* numerical deltas mean equal perceptual deltas, which is the property
	* "transposition" requires). Two types, mutual conversion, no hybrid.
	*
	* [LAW:one-way-deps] This module imports \`ColorRgba\` from core/color and
	* nothing else from inside the project. Nothing in core/ depends back on
	* this file.
	*/
	var _a;
	var OKLCH_AXES = [
		"l",
		"c",
		"h",
		"alpha"
	];
	var IDENTITY = Object.freeze({
		hueShift: 0,
		chromaScale: 1,
		lightnessScale: 1,
		lightnessShift: 0
	});
	/**
	* Flip lightness around the midpoint (\`L' = 1 - L\`) with hue and chroma
	* untouched. Combined with the anchor logic in \`transposePalette\`, this
	* converts a dark theme to its light "octave": semantic anchors
	* (error/success/warning) still lightness-invert — only their *hue* is
	* preserved — so errors stay red and dark-on-light becomes light-on-dark.
	*/
	var INVERT_LIGHTNESS = Object.freeze({
		hueShift: 0,
		chromaScale: 1,
		lightnessScale: -1,
		lightnessShift: 1
	});
	/**
	* Whether a key is the no-op transform. Exported so that callers
	* (\`transposePalette\`) can fast-path byte-exact identity without going
	* through the lossy sRGB↔OKLCH round-trip. [LAW:one-source-of-truth] —
	* the predicate lives once, here.
	*/
	function isIdentityKey(k) {
		return k.hueShift % 360 === 0 && k.chromaScale === 1 && k.lightnessScale === 1 && k.lightnessShift === 0;
	}
	function srgbToLinear(v) {
		return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
	}
	function linearToSrgb(v) {
		return v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055;
	}
	function clamp01$1(v) {
		return v < 0 ? 0 : v > 1 ? 1 : v;
	}
	var ACHROMATIC_EPS = 1e-7;
	var hueOf = (c, h) => c < ACHROMATIC_EPS ? 0 : h;
	var lerp = (a, b, t) => a * (1 - t) + b * t;
	var wrapHue = (h) => {
		const w = h % 360;
		return w < 0 ? w + 360 : w;
	};
	function inGamut(r, g, b) {
		return r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;
	}
	/**
	* Immutable OKLCH color. \`l\` ∈ [0, 1] (lightness), \`c\` ≥ 0 (chroma; typical
	* sRGB-representable colors top out near 0.32), \`h\` ∈ [0, 360) (hue
	* degrees), \`alpha\` ∈ [0, 1].
	*
	* [LAW:single-enforcer] Constructor is the only validation site, matching
	* the \`ColorRgba\` pattern. Out-of-range \`alpha\` throws. l/c/h must be
	* finite but are *not* clamped at construction — they're clamped during
	* \`toRgba\` instead, so transforms can pass through intermediate
	* representations (e.g. h = 720°, c = -0.1 mid-pipeline) before the final
	* sRGB-quantization step normalizes them.
	*/
	var Oklch = class {
		l;
		c;
		h;
		alpha;
		constructor(l, c, h, alpha = 1) {
			this.l = l;
			this.c = c;
			this.h = h;
			this.alpha = alpha;
			if (!Number.isFinite(l)) throw new RangeError(\`Oklch.l must be finite; got \${l}\`);
			if (!Number.isFinite(c)) throw new RangeError(\`Oklch.c must be finite; got \${c}\`);
			if (!Number.isFinite(h)) throw new RangeError(\`Oklch.h must be finite; got \${h}\`);
			if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new RangeError(\`Oklch.alpha must be a finite number in [0,1]; got \${alpha}\`);
		}
		/** sRGB → linear → OKLab → polar. Pure; no I/O, no allocation beyond the result. */
		static fromRgba(color) {
			const [r, g, b, a] = color.normalized;
			const lr = srgbToLinear(r);
			const lg = srgbToLinear(g);
			const lb = srgbToLinear(b);
			const lLong = .4122214708 * lr + .5363325363 * lg + .0514459929 * lb;
			const mLong = .2119034982 * lr + .6806995451 * lg + .1073969566 * lb;
			const sLong = .0883024619 * lr + .2817188376 * lg + .6299787005 * lb;
			const lCube = Math.cbrt(lLong);
			const mCube = Math.cbrt(mLong);
			const sCube = Math.cbrt(sLong);
			const L = .2104542553 * lCube + .793617785 * mCube - .0040720468 * sCube;
			const aLab = 1.9779984951 * lCube - 2.428592205 * mCube + .4505937099 * sCube;
			const bLab = .0259040371 * lCube + .7827717662 * mCube - .808675766 * sCube;
			const C = Math.sqrt(aLab * aLab + bLab * bLab);
			const H = wrapHue(Math.atan2(bLab, aLab) * (180 / Math.PI));
			return new _a(L, C, hueOf(C, H), a);
		}
		/**
		* Polar → OKLab → linear → sRGB (with chroma-bisection gamut clamping).
		*
		* [LAW:single-enforcer] All sRGB-gamut clamping for OKLCH happens here.
		* Callers don't see intermediate float channels; they get a valid
		* \`ColorRgba\` or a thrown error.
		*/
		toRgba() {
			const l = clamp01$1(this.l);
			const c = Math.max(0, this.c);
			const cInGamut = this.findInGamutChroma(l, c, this.h);
			const { r, g, b } = this.toLinearRgb(l, cInGamut, this.h);
			return new ColorRgba(Math.round(clamp01$1(linearToSrgb(r)) * 255), Math.round(clamp01$1(linearToSrgb(g)) * 255), Math.round(clamp01$1(linearToSrgb(b)) * 255), this.alpha);
		}
		/**
		* Apply a \`ThemeKey\`. Returns a new \`Oklch\`; pure.
		*
		* [LAW:dataflow-not-control-flow] Identity short-circuits to \`this\` —
		* same shape as \`ColorRgba.compositeOver(bg)\` returning \`this\` when
		* \`alpha === 1\`. Callers invoke unconditionally; the data decides.
		*/
		applyKey(k) {
			if (isIdentityKey(k)) return this;
			const newL = clamp01$1(this.l * k.lightnessScale + k.lightnessShift);
			const newC = Math.max(0, this.c * k.chromaScale);
			const newH = wrapHue(this.h + k.hueShift);
			return new _a(newL, newC, hueOf(newC, newH), this.alpha);
		}
		/**
		* The color \`t\` of the way from this one toward \`toward\`, in OKLCH.
		* \`t = 0\` is this color, \`t = 1\` is \`toward\`; pure.
		*
		* Lightness, chroma and alpha interpolate linearly. Hue takes the shorter
		* arc around the wheel, so blue → red passes through magenta rather than
		* sweeping across green. An achromatic endpoint has no hue of its own —
		* \`fromRgba\` pins it to 0, which is red — so it adopts the other
		* endpoint's hue (CSS Color 4's "powerless" rule): gray → red stays a red
		* that gains chroma, instead of rotating through the wheel from 0°.
		*
		* \`t\` must lie in [0, 1]: this is interpolation, not extrapolation, and a
		* \`t\` outside it (NaN included) is a RangeError, never a colour off the
		* far end of the segment. [LAW:no-silent-failure]
		*
		* [LAW:one-source-of-truth] Achromatic means the same \`ACHROMATIC_EPS\`
		* that \`fromRgba\` and \`applyKey\` pin hue by, so a gray produced by either
		* is a gray here — and the result's hue goes through the same \`hueOf\`, so
		* a gray produced HERE (t = 0 from a gray, t = 1 toward one) is a gray
		* there too.
		*/
		mix(toward, t) {
			if (!(t >= 0 && t <= 1)) throw new RangeError(\`Oklch.mix: t must be in [0, 1]; got \${t}\`);
			return this.#interpolate(toward, t, t, t, t);
		}
		/**
		* \`mix\` with each axis moved its own share of the way: \`weights.l\` of the
		* lightness gap, \`weights.c\` of the chroma gap, and so on, each in [0, 1].
		* \`mix(toward, t)\` is \`mixAxes\` with every weight \`t\` — one interpolation,
		* so the shorter-arc hue and the powerless-endpoint rule are the same
		* whichever is called.
		*
		* It exists because perceptual axes are independent: a tint can take most of
		* a hue's colourfulness while keeping close to the lightness it started at,
		* which a single \`t\` cannot say — raising \`t\` for chroma drags lightness with
		* it. Every weight is required: an axis left out would need a default, and
		* "unchanged" (0) and "same as the others" are both plausible readings.
		*
		* A weak \`h\` beside a strong \`c\` shows the starting colour's hue at high
		* chroma. The powerless rule covers only a truly achromatic start, so a
		* near-grey whose hue is noise (a theme surface at c ≈ 0.004) keeps that
		* noise in proportion. To land on the target's hue, pass \`h: 1\`.
		*/
		mixAxes(toward, weights) {
			for (const axis of OKLCH_AXES) {
				const w = weights[axis];
				if (!(w >= 0 && w <= 1)) throw new RangeError(\`Oklch.mixAxes: \${axis} weight must be in [0, 1]; got \${w}\`);
			}
			return this.#interpolate(toward, weights.l, weights.c, weights.h, weights.alpha);
		}
		#interpolate(toward, wl, wc, wh, walpha) {
			const thisHasHue = this.c >= ACHROMATIC_EPS;
			const towardHasHue = toward.c >= ACHROMATIC_EPS;
			const fromH = wrapHue(thisHasHue ? this.h : towardHasHue ? toward.h : 0);
			const toH = wrapHue(towardHasHue ? toward.h : fromH);
			const arc = toH - fromH;
			const fromU = arc < -180 ? fromH - 360 : fromH;
			const toU = arc > 180 ? toH - 360 : toH;
			const c = lerp(this.c, toward.c, wc);
			return new _a(lerp(this.l, toward.l, wl), c, hueOf(c, wrapHue(lerp(fromU, toU, wh))), lerp(this.alpha, toward.alpha, walpha));
		}
		/**
		* ΔE_OK — the Euclidean distance between this colour and \`other\` in OKLab
		* (CSS Color 4's \`deltaEOK\`), where ~0.02 is the smallest difference the eye
		* resolves. Alpha is not a coordinate of the space and does not count.
		* Symmetric and pure.
		*/
		deltaE(other) {
			const a = this.h * Math.PI / 180;
			const b = other.h * Math.PI / 180;
			return Math.hypot(this.l - other.l, this.c * Math.cos(a) - other.c * Math.cos(b), this.c * Math.sin(a) - other.c * Math.sin(b));
		}
		/** Linear-sRGB coordinates for an explicit (l, C, h). Pure; \`toRgba\` passes
		* already-normalized values so this never sees out-of-range inputs. */
		toLinearRgb(l, C, h) {
			const hRad = h * (Math.PI / 180);
			const aLab = C * Math.cos(hRad);
			const bLab = C * Math.sin(hRad);
			const lCube = l + .3963377774 * aLab + .2158037573 * bLab;
			const mCube = l - .1055613458 * aLab - .0638541728 * bLab;
			const sCube = l - .0894841775 * aLab - 1.291485548 * bLab;
			const lLong = lCube * lCube * lCube;
			const mLong = mCube * mCube * mCube;
			const sLong = sCube * sCube * sCube;
			return {
				r: 4.0767416621 * lLong - 3.3077115913 * mLong + .2309699292 * sLong,
				g: -1.2684380046 * lLong + 2.6097574011 * mLong - .3413193965 * sLong,
				b: -.0041960863 * lLong - .7034186147 * mLong + 1.707614701 * sLong
			};
		}
		/**
		* Largest chroma ≤ \`c\` whose (l, h) projection lies in sRGB.
		* Standard chroma-reduction-by-bisection: 24 iterations gives ~1e-7
		* precision, more than enough since the next step quantizes to 1/255.
		*/
		findInGamutChroma(l, c, h) {
			const direct = this.toLinearRgb(l, c, h);
			if (inGamut(direct.r, direct.g, direct.b)) return c;
			let lo = 0;
			let hi = c;
			for (let i = 0; i < 24; i++) {
				const mid = (lo + hi) / 2;
				const probe = this.toLinearRgb(l, mid, h);
				if (inGamut(probe.r, probe.g, probe.b)) lo = mid;
				else hi = mid;
			}
			return lo;
		}
	};
	_a = Oklch;
	//#endregion
	//#region src/themes/colorRef.ts
	/**
	* A **color reference** is the one string form an author uses to name a
	* concrete color: a palette variable name (\`"primary"\`, \`"surface-active"\`,
	* \`"text-primary"\`) or a literal \`#RRGGBB\` / \`#RRGGBBAA\`.
	*
	* [LAW:parse-dont-validate] \`resolveColorRef\` is the single checkpoint that
	* turns an untrusted reference string into a \`ColorRgba\`. Everything
	* downstream — color math, \`Style\` construction, serialization — takes
	* \`ColorRgba\` and therefore cannot ask again whether the name existed. There
	* is no \`isValidColorRef\` companion, deliberately: a validator would hand back
	* the same \`string\` it was given and every consumer would re-check.
	*
	* [LAW:no-silent-failure] A miss throws. An unknown palette name is a broken
	* config, and the author needs to see which name and what was available — not
	* a silently substituted default that makes the bar merely look wrong.
	*/
	var ColorRefError = class extends Error {
		ref;
		constructor(ref, detail) {
			super(\`color reference \${JSON.stringify(ref)} did not resolve — \${detail}\`);
			this.ref = ref;
			this.name = "ColorRefError";
		}
	};
	var HEX_LEAD = "#";
	/**
	* The literal-color shape, exported so the template bindings gate on the same
	* pattern this module parses. [LAW:one-source-of-truth] — one regex, one
	* parser body; the bindings add only their own error wording.
	*/
	var HEX_COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
	var OPAQUE_HEX_LENGTH = 7;
	/**
	* Parse a \`#RRGGBB\` / \`#RRGGBBAA\` literal. The hex arm of
	* {@link resolveColorRef}, separated so callers that accept *only* literal
	* colors (color math, which cannot meaningfully operate on a palette name)
	* share the one implementation instead of re-deriving it.
	*
	* @throws {ColorRefError} when \`hex\` is not a well-formed literal.
	*/
	function parseHexColor(hex) {
		const trimmed = hex.trim();
		if (!HEX_COLOR_RE.test(trimmed)) throw new ColorRefError(hex, "expected #RRGGBB or #RRGGBBAA");
		const digits = trimmed.slice(1);
		return trimmed.length > OPAQUE_HEX_LENGTH ? parseRgbaHex(digits) : parseRgbHex(digits);
	}
	var SUGGESTION_LIMIT = 8;
	/**
	* Resolve a color reference against \`palette\`.
	*
	* Accepting hex alongside names is what makes this **idempotent**:
	* \`resolveColorRef(p, resolveColorRef(p, r).hex)\` equals
	* \`resolveColorRef(p, r)\` for every \`r\` this function accepts. Callers
	* therefore never branch on "is this a palette name or already a color" —
	* they call it unconditionally on whatever the author wrote, whether that is
	* \`"surface-active"\` or the output of a chain of color math.
	* [LAW:dataflow-not-control-flow]
	*
	* @throws {ColorRefError} on malformed hex or an unknown palette name.
	*/
	function resolveColorRef(palette, ref) {
		const trimmed = ref.trim();
		if (trimmed.startsWith(HEX_LEAD)) return parseHexColor(trimmed);
		const hit = palette.get(trimmed);
		if (hit === void 0) throw new ColorRefError(ref, \`no such variable in palette \${JSON.stringify(palette.name)}\` + suggest(palette, trimmed));
		return hit;
	}
	function suggest(palette, miss) {
		const parts = miss.split("-");
		const near = [...palette.vars.keys()].filter((name) => parts.some((part) => part !== "" && name.includes(part))).slice(0, SUGGESTION_LIMIT);
		return near.length === 0 ? "" : \`; did you mean: \${near.join(", ")}\`;
	}
	//#endregion
	//#region src/themes/colorMath.ts
	var LEVEL_STEP = .1;
	function rgbToHsl(c) {
		const r = c.red / 255;
		const g = c.green / 255;
		const b = c.blue / 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const l = (max + min) / 2;
		const d = max - min;
		if (d === 0) return {
			h: 0,
			s: 0,
			l
		};
		const s = d / (l > .5 ? 2 - max - min : max + min);
		let h;
		if (max === r) h = (g - b) / d % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h = (h * 60 + 360) % 360;
		return {
			h,
			s,
			l
		};
	}
	function clampChannel(v) {
		const r = Math.round(v);
		return r < 0 ? 0 : r > 255 ? 255 : r;
	}
	function hslToRgb(hsl) {
		const { h, s, l } = hsl;
		if (s === 0) {
			const v = clampChannel(l * 255);
			return new ColorRgba(v, v, v);
		}
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const hp = h / 60;
		const x = c * (1 - Math.abs(hp % 2 - 1));
		let r = 0, g = 0, b = 0;
		if (hp < 1) [r, g, b] = [
			c,
			x,
			0
		];
		else if (hp < 2) [r, g, b] = [
			x,
			c,
			0
		];
		else if (hp < 3) [r, g, b] = [
			0,
			c,
			x
		];
		else if (hp < 4) [r, g, b] = [
			0,
			x,
			c
		];
		else if (hp < 5) [r, g, b] = [
			x,
			0,
			c
		];
		else [r, g, b] = [
			c,
			0,
			x
		];
		const m = l - c / 2;
		return new ColorRgba(clampChannel((r + m) * 255), clampChannel((g + m) * 255), clampChannel((b + m) * 255));
	}
	function clamp01(v) {
		return v < 0 ? 0 : v > 1 ? 1 : v;
	}
	/**
	* Darken a color by N levels, where each level reduces HSL lightness by 10%.
	* Negative levels lighten. Level 0 returns an equivalent triplet (after the
	* RGB↔HSL roundtrip; values may differ by ±1 due to rounding).
	*/
	function darken(color, levels) {
		const hsl = rgbToHsl(color);
		hsl.l = clamp01(hsl.l - LEVEL_STEP * levels);
		return hslToRgb(hsl);
	}
	/**
	* Lighten a color by N levels. Equivalent to \`darken(color, -levels)\`.
	*/
	function lighten(color, levels) {
		return darken(color, -levels);
	}
	/**
	* Composite \`fg\` over \`bg\` with the given alpha (0..1). At alpha=0 returns bg;
	* at alpha=1 returns fg.
	*/
	function alphaBlend(fg, bg, alpha) {
		return blendRgb(bg, fg, clamp01(alpha));
	}
	/**
	* Pick a contrasting foreground (black or white) for a background, using the
	* WCAG relative-luminance threshold of 0.179 (the perceptually correct cutoff
	* where black and white are equally readable). A translucent \`bg\` is judged
	* as drawn: composited over \`substrate\` (see \`drawnBackground\`).
	*/
	function contrastFor(bg, substrate = SURFACE_BLACK) {
		return relativeLuminance(drawnBackground(bg, substrate)) > .179 ? new ColorRgba(0, 0, 0) : new ColorRgba(255, 255, 255);
	}
	var CONTRAST_ITERS = 20;
	/**
	* Return a foreground guaranteed to clear \`minRatio\` against \`bg\`, keeping the
	* color *recognizably itself*. If the themed \`fg\` already passes it is returned
	* untouched. Otherwise its OKLCH lightness is slid toward the pole that raises
	* contrast — holding hue, and chroma where it stays in gamut (near the poles
	* gamut clamping may reduce chroma, but hue is preserved) — until the ratio is
	* met, so a blue on a dark-blue background becomes a lighter blue, not white.
	* Only when no lightness of that hue can meet the ratio (a mid-toned
	* background where even pure black-or-white tops out below the target) does it
	* fall back to \`contrastFor\`'s black/white — the true maximum-contrast pick.
	*
	* A translucent \`bg\` is measured as it is drawn — composited over
	* \`substrate\`, the SGR writer's black by default — and a translucent \`fg\` is
	* then flattened over that drawn background, the order the writer composites
	* in, so the ratio is measured on what the eye actually sees and the returned
	* color is opaque.
	*
	* \`drawnAt\` is the depth the terminal will draw the pair at. At 256 colours
	* the terminal rounds text and background independently, and two roundings
	* can meet in the middle, so the ratio is measured on the drawn pair: a
	* colour that loses the floor there is replaced by the nearest cube/grey entry
	* that clears it (whose own rounding is itself). At ANSI the terminal draws
	* its own theme's colours, so the ratio is measured on the table's nominal
	* ones (\`DRAWN_FROM\`): they say which side of the ground text belongs on, and
	* text on its background's index measures 1:1 and is always replaced.
	* Truecolor draws the colour chosen.
	*
	* [LAW:single-enforcer] The one place "is this text readable, and if not fix
	* it" is decided. Callers route every fg/bg pair through here and the
	* unreadable state never reaches output. [LAW:dataflow-not-control-flow] the
	* function always runs; the measured ratio (data) decides how far the
	* lightness moves — there is no caller-side "should I check contrast" branch.
	*/
	function ensureContrast(fg, bg, minRatio = 4.5, drawnAt = ColorDepth.TRUECOLOR, substrate = SURFACE_BLACK) {
		const ground = drawnBackground(bg, substrate);
		const chosen = ensureTruecolorContrast(fg, ground, minRatio);
		const table = DRAWN_FROM[drawnAt];
		if (table === void 0) return chosen;
		const drawnBg = drawnColour(ground, drawnAt, substrate);
		if (contrastRatio(drawnColour(chosen, drawnAt, substrate), drawnBg) >= minRatio) return chosen;
		return table.get(table.matchReadable(chosen, drawnBg, minRatio));
	}
	/**
	* \`chosen\` (composited opaque over \`substrate\`), or — when the depth the
	* terminal draws at rounds it to a colour \`accept\` refuses — the nearest colour that depth draws as itself which
	* \`accept\` takes. \`accept\` sees the candidate as drawn, and \`drawn\`, the same
	* rounding for any other colour it measures against, so the caller states a
	* floor once and it holds on the colours the terminal shows — at ANSI, on
	* the table's nominal colours, as \`ensureContrast\` measures there. Truecolor
	* draws from no table, so a colour refused there has no replacement;
	* \`undefined\` means nothing the depth draws is accepted.
	*
	* \`ensureContrast\` is this with a contrast ratio as the floor; this is for a
	* floor that is not text on its background (an open state standing off every
	* closed cell, two planes standing off each other).
	*/
	function ensureDrawn(chosen, drawnAt, accept, substrate = SURFACE_BLACK) {
		const opaque = drawnBackground(chosen, substrate);
		const drawn = (c) => drawnColour(c, drawnAt, substrate);
		if (accept(drawn(opaque), drawn)) return opaque;
		const table = DRAWN_FROM[drawnAt];
		const index = table?.matchWhere(opaque, (entry) => accept(entry, drawn));
		return index === void 0 ? void 0 : table.get(index);
	}
	/**
	* The colour a ground is shown as at \`drawnAt\`: composited over \`substrate\`
	* (the SGR writer's black by default), then rounded to the table that depth
	* draws from — at ANSI, that table's nominal colour stands in for the
	* theme's. The one account \`ensureDrawn\` and \`ensureContrast\` measure by, for
	* a caller that measures a floor of its own.
	*/
	function drawnColour(colour, drawnAt, substrate = SURFACE_BLACK) {
		const opaque = drawnBackground(colour, substrate);
		const table = DRAWN_FROM[drawnAt];
		return table === void 0 ? opaque : table.get(table.match(opaque));
	}
	/**
	* A background as it is drawn: composited over the surface beneath it. That
	* surface is a fact about where the pair is drawn, so it arrives as a value:
	* the SGR writer (\`Style.toSgrCodes\`) composites over \`SURFACE_BLACK\`, the
	* default here; a caller choosing text for a different surface — an export's
	* canvas, \`exportCanvas(theme).background\` — names that one.
	* [LAW:no-silent-failure] A surface has nothing under it, so a translucent one
	* has no drawn colour to offer; \`compositeOver\` would read its raw RGB as if
	* it were opaque, so it is refused here rather than measured wrong.
	* [LAW:one-source-of-truth] Text is chosen against the colour the surface will
	* show — measuring the raw RGBA reads a colour that is drawn nowhere, and text
	* that "clears" it can land below the floor. Opaque colours composite to
	* themselves.
	*/
	function drawnBackground(bg, substrate) {
		if (substrate.alpha !== 1) throw new RangeError(\`a contrast substrate is the opaque surface under a translucent background; got \${substrate.hex}\`);
		return bg.compositeOver(substrate);
	}
	/**
	* The downgrade table the terminal draws from, by depth, measured at each
	* entry's colour. The 256-colour cube and grey ramp are fixed by xterm, so
	* those measurements are exact. ANSI 0–15 are the terminal theme's own, so
	* the table's nominal colours stand in for them: they are wrong in hue from
	* theme to theme, but not about which side of a ground an entry sits on —
	* and two colours on one index are one colour in every theme, which the
	* nominal ratio of 1 refuses. Truecolor draws the chosen colour itself.
	*/
	var DRAWN_FROM = {
		[ColorDepth.EIGHT_BIT]: EIGHT_BIT_DOWNGRADE_TABLE,
		[ColorDepth.STANDARD]: STANDARD_TABLE
	};
	function ensureTruecolorContrast(fg, bg, minRatio) {
		const opaqueFg = fg.compositeOver(bg);
		if (contrastRatio(opaqueFg, bg) >= minRatio) return opaqueFg;
		const lab = Oklch.fromRgba(opaqueFg);
		const poleL = relativeLuminance(bg) > .179 ? 0 : 1;
		if (contrastRatio(new Oklch(poleL, lab.c, lab.h, lab.alpha).toRgba(), bg) < minRatio) return contrastFor(bg);
		let fail = lab.l;
		let pass = poleL;
		for (let i = 0; i < CONTRAST_ITERS; i++) {
			const mid = (fail + pass) / 2;
			if (contrastRatio(new Oklch(mid, lab.c, lab.h, lab.alpha).toRgba(), bg) >= minRatio) pass = mid;
			else fail = mid;
		}
		return new Oklch(pass, lab.c, lab.h, lab.alpha).toRgba();
	}
	//#endregion
	//#region src/themes/buildPalette.ts
	var MUTED_BLEND = .7;
	var TEXT_ALPHA = .66;
	var SURFACE_LIFT = .05;
	var ACCENT_KEYS = [
		"primary",
		"secondary",
		"accent",
		"success",
		"warning",
		"error"
	];
	/**
	* Build a full semantic palette from base colors.
	*
	* Derived entries follow Textual's formulas:
	* - \`*-muted\` = color blended 70% toward its opposite base role. Defined for
	*              every accent AND for the two base roles themselves
	*              (\`foreground-muted\` blends toward \`background\`,
	*              \`background-muted\` blends toward \`foreground\`) — a caller
	*              de-emphasizing body/structural text reaches for
	*              \`foreground-muted\` the same way it reaches for
	*              \`primary-muted\` to de-emphasize an accent.
	* - \`text-*\`  = contrast text tinted 66% with the accent color (use as
	*              foreground in muted/background-tinted contexts)
	* - \`on-*\`    = WCAG-correct contrast colour (black or white) for use as
	*              foreground when the FULL accent is the background. Picked
	*              by relative luminance — single source of truth so widgets
	*              never need to invert / reverse fg/bg to get readable text.
	* - \`surface\` = background blended 5% toward foreground
	*/
	function buildPalette(name, dark, base) {
		const vars = /* @__PURE__ */ new Map();
		vars.set("background", base.background);
		vars.set("foreground", base.foreground);
		for (const key of ACCENT_KEYS) vars.set(key, base[key]);
		vars.set("foreground-muted", blendRgb(base.foreground, base.background, MUTED_BLEND));
		vars.set("background-muted", blendRgb(base.background, base.foreground, MUTED_BLEND));
		vars.set("surface", blendRgb(base.background, base.foreground, SURFACE_LIFT));
		const contrastText = contrastFor(base.background);
		for (const key of ACCENT_KEYS) {
			const color = base[key];
			vars.set(\`\${key}-muted\`, blendRgb(color, base.background, MUTED_BLEND));
			vars.set(\`text-\${key}\`, alphaBlend(color, contrastText, TEXT_ALPHA));
			vars.set(\`on-\${key}\`, contrastFor(color));
		}
		return new Palette(name, dark, vars);
	}
	//#endregion
	//#region src/themes/data/atom-one-dark.ts
	var theme$22 = {
		name: "atom-one-dark",
		dark: true,
		ansi: {
			black: "#282C34",
			red: "#E06C75",
			green: "#98C379",
			yellow: "#E5C07B",
			blue: "#61AFEF",
			magenta: "#C678DD",
			cyan: "#56B6C2",
			white: "#DCDFE4",
			brightBlack: "#5D677A",
			brightRed: "#E06C75",
			brightGreen: "#98C379",
			brightYellow: "#E5C07B",
			brightBlue: "#61AFEF",
			brightMagenta: "#C678DD",
			brightCyan: "#56B6C2",
			brightWhite: "#DCDFE4"
		},
		vars: {
			"accent": "#A378C2",
			"accent-darken-1": "#8E65AD",
			"accent-darken-2": "#7A5299",
			"accent-darken-3": "#674085",
			"accent-lighten-1": "#B78BD6",
			"accent-lighten-2": "#CC9FEC",
			"accent-lighten-3": "#E2B3FF",
			"accent-muted": "#4C425E",
			"background": "#282C34",
			"background-darken-1": "#181C23",
			"background-darken-2": "#050A14",
			"background-darken-3": "#000000",
			"background-lighten-1": "#383C44",
			"background-lighten-2": "#494D56",
			"background-lighten-3": "#5B5F68",
			"block-cursor-background": "#61AFEF",
			"block-cursor-blurred-background": "#61AFEF4C",
			"block-cursor-blurred-foreground": "#ABB2BF",
			"block-cursor-foreground": "#FFFFFFDD",
			"block-hover-background": "#FFFFFF19",
			"boost": "#FFFFFF0A",
			"boost-darken-1": "#E9E9E90A",
			"boost-darken-2": "#D4D4D40A",
			"boost-darken-3": "#BFBFBF0A",
			"boost-lighten-1": "#FFFFFF0A",
			"boost-lighten-2": "#FFFFFF0A",
			"boost-lighten-3": "#FFFFFF0A",
			"border": "#61AFEF",
			"border-blurred": "#353B47",
			"button-color-foreground": "#FFFFFFDD",
			"button-foreground": "#ABB2BF",
			"error": "#EF6262",
			"error-darken-1": "#D84D50",
			"error-darken-2": "#C1373E",
			"error-darken-3": "#AA1F2E",
			"error-lighten-1": "#FF7674",
			"error-lighten-2": "#FF8B87",
			"error-lighten-3": "#FFA09B",
			"error-muted": "#643C41",
			"footer-background": "#4F5666",
			"footer-description-background": "#00000000",
			"footer-description-foreground": "#ABB2BF",
			"footer-foreground": "#ABB2BF",
			"footer-item-background": "#00000000",
			"footer-key-background": "#00000000",
			"footer-key-foreground": "#A378C2",
			"foreground": "#ABB2BF",
			"foreground-darken-1": "#979DAA",
			"foreground-darken-2": "#838A96",
			"foreground-darken-3": "#707783",
			"foreground-disabled": "#ABB2BF60",
			"foreground-lighten-1": "#BFC6D3",
			"foreground-lighten-2": "#D4DBE8",
			"foreground-lighten-3": "#E9F0FE",
			"foreground-muted": "#ABB2BF99",
			"input-cursor-background": "#ABB2BF",
			"input-cursor-foreground": "#282C34",
			"input-selection-background": "#77C3FF66",
			"link-background": "#00000000",
			"link-background-hover": "#61AFEF",
			"link-color": "#FFFFFFDD",
			"link-color-hover": "#FFFFFFDD",
			"markdown-h1-background": "#00000000",
			"markdown-h1-color": "#61AFEF",
			"markdown-h2-background": "#00000000",
			"markdown-h2-color": "#61AFEF",
			"markdown-h3-background": "#00000000",
			"markdown-h3-color": "#61AFEF",
			"markdown-h4-background": "#00000000",
			"markdown-h4-color": "#ABB2BF",
			"markdown-h5-background": "#00000000",
			"markdown-h5-color": "#ABB2BF",
			"markdown-h6-background": "#00000000",
			"markdown-h6-color": "#ABB2BF99",
			"panel": "#4F5666",
			"panel-darken-1": "#3D4453",
			"panel-darken-2": "#2C3342",
			"panel-darken-3": "#1C2331",
			"panel-lighten-1": "#616878",
			"panel-lighten-2": "#737A8B",
			"panel-lighten-3": "#868E9F",
			"primary": "#61AFEF",
			"primary-background": "#4F5B6A",
			"primary-background-darken-1": "#3F4D5D",
			"primary-background-darken-2": "#303F50",
			"primary-background-darken-3": "#303F50",
			"primary-background-lighten-1": "#5E6A77",
			"primary-background-lighten-2": "#6E7884",
			"primary-background-lighten-3": "#7D8791",
			"primary-darken-1": "#489BD9",
			"primary-darken-2": "#2C87C4",
			"primary-darken-3": "#0074AF",
			"primary-lighten-1": "#77C3FF",
			"primary-lighten-2": "#8ED8FF",
			"primary-lighten-3": "#A4EDFF",
			"primary-muted": "#39536C",
			"scrollbar": "#355674",
			"scrollbar-active": "#61AFEF",
			"scrollbar-background": "#181C23",
			"scrollbar-background-active": "#181C23",
			"scrollbar-background-hover": "#181C23",
			"scrollbar-corner-color": "#181C23",
			"scrollbar-hover": "#3C6589",
			"secondary": "#C678DD",
			"secondary-background": "#5B5567",
			"secondary-background-darken-1": "#4D465A",
			"secondary-background-darken-2": "#3F374D",
			"secondary-background-darken-3": "#3F374D",
			"secondary-background-lighten-1": "#6A6475",
			"secondary-background-lighten-2": "#787382",
			"secondary-background-lighten-3": "#87828F",
			"secondary-darken-1": "#B064C7",
			"secondary-darken-2": "#9B50B3",
			"secondary-darken-3": "#873D9E",
			"secondary-lighten-1": "#DB8CF2",
			"secondary-lighten-2": "#F1A0FF",
			"secondary-lighten-3": "#FFB5FF",
			"secondary-muted": "#574266",
			"success": "#62F062",
			"success-darken-1": "#48DA4D",
			"success-darken-2": "#29C438",
			"success-darken-3": "#00AF22",
			"success-lighten-1": "#7AFF76",
			"success-lighten-2": "#91FF8A",
			"success-lighten-3": "#A8FF9F",
			"success-muted": "#396641",
			"surface": "#3B414D",
			"surface-active": "#484E5B",
			"surface-darken-1": "#2A303B",
			"surface-darken-2": "#1A202B",
			"surface-darken-3": "#09101B",
			"surface-lighten-1": "#4C525E",
			"surface-lighten-2": "#5E6471",
			"surface-lighten-3": "#707684",
			"text": "#FFFFFFDD",
			"text-accent": "#C2A5D6",
			"text-disabled": "#FFFFFF60",
			"text-error": "#F59797",
			"text-muted": "#FFFFFF99",
			"text-primary": "#96CAF4",
			"text-secondary": "#D9A5E8",
			"text-success": "#97F597",
			"text-warning": "#E9CC92",
			"warning": "#DDB25B",
			"warning-darken-1": "#C79D47",
			"warning-darken-2": "#B28A34",
			"warning-darken-3": "#9C7721",
			"warning-lighten-1": "#F4C66E",
			"warning-lighten-2": "#FFDB82",
			"warning-lighten-3": "#FFF096",
			"warning-muted": "#5E543F"
		}
	};
	//#endregion
	//#region src/themes/data/atom-one-light.ts
	var theme$21 = {
		name: "atom-one-light",
		dark: false,
		ansi: {
			black: "#383A42",
			red: "#E45649",
			green: "#50A14F",
			yellow: "#C18401",
			blue: "#0184BC",
			magenta: "#A626A4",
			cyan: "#0997B3",
			white: "#BABABA",
			brightBlack: "#4F525E",
			brightRed: "#E06C75",
			brightGreen: "#98C379",
			brightYellow: "#D8B36E",
			brightBlue: "#61AFEF",
			brightMagenta: "#C678DD",
			brightCyan: "#56B6C2",
			brightWhite: "#FFFFFF"
		},
		vars: {
			"accent": "#BE9232",
			"accent-darken-1": "#A97E1D",
			"accent-darken-2": "#936B01",
			"accent-darken-3": "#7E5900",
			"accent-lighten-1": "#D5A545",
			"accent-lighten-2": "#EBB959",
			"accent-lighten-3": "#FFCE6C",
			"accent-muted": "#E8DABE",
			"background": "#FAFAFA",
			"background-darken-1": "#E4E4E4",
			"background-darken-2": "#CFCFCF",
			"background-darken-3": "#BABABA",
			"background-lighten-1": "#FFFFFF",
			"background-lighten-2": "#FFFFFF",
			"background-lighten-3": "#FFFFFF",
			"block-cursor-background": "#4078F2",
			"block-cursor-blurred-background": "#4078F24C",
			"block-cursor-blurred-foreground": "#383A42",
			"block-cursor-foreground": "#000000DD",
			"block-hover-background": "#00000019",
			"boost": "#0000000A",
			"boost-darken-1": "#0000000A",
			"boost-darken-2": "#0000000A",
			"boost-darken-3": "#0000000A",
			"boost-lighten-1": "#1616160A",
			"boost-lighten-2": "#2525250A",
			"boost-lighten-3": "#3535350A",
			"border": "#4078F2",
			"border-blurred": "#D8D8D8",
			"button-color-foreground": "#000000DD",
			"button-foreground": "#383A42",
			"error": "#F13F3F",
			"error-darken-1": "#D9232D",
			"error-darken-2": "#C1001D",
			"error-darken-3": "#A9000D",
			"error-lighten-1": "#FF5650",
			"error-lighten-2": "#FF6C62",
			"error-lighten-3": "#FF8275",
			"error-muted": "#F7C1C1",
			"footer-background": "#CCCCCC",
			"footer-description-background": "#00000000",
			"footer-description-foreground": "#383A42",
			"footer-foreground": "#383A42",
			"footer-item-background": "#00000000",
			"footer-key-background": "#00000000",
			"footer-key-foreground": "#BF9232",
			"foreground": "#383A42",
			"foreground-darken-1": "#272931",
			"foreground-darken-2": "#181A21",
			"foreground-darken-3": "#040612",
			"foreground-disabled": "#383A4260",
			"foreground-lighten-1": "#494B53",
			"foreground-lighten-2": "#5A5C65",
			"foreground-lighten-3": "#6D6F78",
			"foreground-muted": "#383A4299",
			"input-cursor-background": "#383A42",
			"input-cursor-foreground": "#FAFAFA",
			"input-selection-background": "#5C8AFF66",
			"link-background": "#00000000",
			"link-background-hover": "#4078F2",
			"link-color": "#000000DD",
			"link-color-hover": "#000000DD",
			"markdown-h1-background": "#00000000",
			"markdown-h1-color": "#4078F2",
			"markdown-h2-background": "#00000000",
			"markdown-h2-color": "#4078F2",
			"markdown-h3-background": "#00000000",
			"markdown-h3-color": "#4078F2",
			"markdown-h4-background": "#00000000",
			"markdown-h4-color": "#383A42",
			"markdown-h5-background": "#00000000",
			"markdown-h5-color": "#383A42",
			"markdown-h6-background": "#00000000",
			"markdown-h6-color": "#383A4299",
			"panel": "#CCCCCC",
			"panel-darken-1": "#B7B7B7",
			"panel-darken-2": "#A3A3A3",
			"panel-darken-3": "#8F8F8F",
			"panel-lighten-1": "#E1E1E1",
			"panel-lighten-2": "#F6F6F6",
			"panel-lighten-3": "#FFFFFF",
			"primary": "#4078F2",
			"primary-background": "#4078F2",
			"primary-background-darken-1": "#1865DC",
			"primary-background-darken-2": "#0053C6",
			"primary-background-darken-3": "#0043B1",
			"primary-background-lighten-1": "#5C8AFF",
			"primary-background-lighten-2": "#759EFF",
			"primary-background-lighten-3": "#8DB2FF",
			"primary-darken-1": "#1865DC",
			"primary-darken-2": "#0053C6",
			"primary-darken-3": "#0043B1",
			"primary-lighten-1": "#5C8AFF",
			"primary-lighten-2": "#759EFF",
			"primary-lighten-3": "#8DB2FF",
			"primary-muted": "#C2D3F7",
			"scrollbar": "#A2B8E9",
			"scrollbar-active": "#4078F2",
			"scrollbar-background": "#E4E4E4",
			"scrollbar-background-active": "#E4E4E4",
			"scrollbar-background-hover": "#E4E4E4",
			"scrollbar-corner-color": "#E4E4E4",
			"scrollbar-hover": "#92AEEB",
			"secondary": "#A626A4",
			"secondary-background": "#A626A4",
			"secondary-background-darken-1": "#90008F",
			"secondary-background-darken-2": "#7B007C",
			"secondary-background-darken-3": "#670069",
			"secondary-background-lighten-1": "#BB3EB8",
			"secondary-background-lighten-2": "#D154CD",
			"secondary-background-lighten-3": "#E769E2",
			"secondary-darken-1": "#90008F",
			"secondary-darken-2": "#7B007C",
			"secondary-darken-3": "#670069",
			"secondary-lighten-1": "#BB3EB8",
			"secondary-lighten-2": "#D154CD",
			"secondary-lighten-3": "#E769E2",
			"secondary-muted": "#E0BAE0",
			"success": "#6BF23F",
			"success-darken-1": "#52DC25",
			"success-darken-2": "#36C600",
			"success-darken-3": "#05B100",
			"success-lighten-1": "#83FF55",
			"success-lighten-2": "#9BFF6B",
			"success-lighten-3": "#B2FF80",
			"success-muted": "#CFF7C1",
			"surface": "#E0E0E0",
			"surface-active": "#F1F1F1",
			"surface-darken-1": "#CACACA",
			"surface-darken-2": "#B6B6B6",
			"surface-darken-3": "#A2A2A2",
			"surface-lighten-1": "#F5F5F5",
			"surface-lighten-2": "#FFFFFF",
			"surface-lighten-3": "#FFFFFF",
			"text": "#000000DD",
			"text-accent": "#7E6021",
			"text-disabled": "#00000060",
			"text-error": "#9F2929",
			"text-muted": "#00000099",
			"text-primary": "#2A4F9F",
			"text-secondary": "#6D196C",
			"text-success": "#479F29",
			"text-warning": "#8E8F24",
			"warning": "#D7D938",
			"warning-darken-1": "#C1C41C",
			"warning-darken-2": "#ABAF00",
			"warning-darken-3": "#969B00",
			"warning-lighten-1": "#EEEE4E",
			"warning-lighten-2": "#FFFF64",
			"warning-lighten-3": "#FFFF79",
			"warning-muted": "#EFF0BF"
		}
	};
	//#endregion
	//#region src/themes/data/catppuccin-frappe.ts
	var theme$20 = {
		name: "catppuccin-frappe",
		dark: true,
		ansi: {
			black: "#51576D",
			red: "#E78284",
			green: "#A6D189",
			yellow: "#E5C890",
			blue: "#8CAAEE",
			magenta: "#F4B8E4",
			cyan: "#81C8BE",
			white: "#B5BFE2",
			brightBlack: "#626880",
			brightRed: "#EDA0A2",
			brightGreen: "#B9DBA2",
			brightYellow: "#ECD7AE",
			brightBlue: "#ADC2F3",
			brightMagenta: "#F38ED8",
			brightCyan: "#98D2CA",
			brightWhite: "#A5ADCE"
		},
		vars: {
			"accent": "#F4B8E4",
			"accent-darken-1": "#DEA3CE",
			"accent-darken-2": "#C98FBA",
			"accent-darken-3": "#B47BA5",
			"accent-lighten-1": "#FFCCF9",
			"accent-lighten-2": "#FFE2FF",
			"accent-lighten-3": "#FFF7FF",
			"accent-muted": "#6A5B75",
			"background": "#303446",
			"background-darken-1": "#1F2435",
			"background-darken-2": "#101424",
			"background-darken-3": "#000016",
			"background-lighten-1": "#404457",
			"background-lighten-2": "#525669",
			"background-lighten-3": "#64687C",
			"block-cursor-background": "#CA9EE6",
			"block-cursor-blurred-background": "#CA9EE64C",
			"block-cursor-blurred-foreground": "#C6D0F5",
			"block-cursor-foreground": "#292C3C",
			"block-hover-background": "#FFFFFF19",
			"boost": "#FFFFFF0A",
			"boost-darken-1": "#E9E9E90A",
			"boost-darken-2": "#D4D4D40A",
			"boost-darken-3": "#BFBFBF0A",
			"boost-lighten-1": "#FFFFFF0A",
			"boost-lighten-2": "#FFFFFF0A",
			"boost-lighten-3": "#FFFFFF0A",
			"border": "#BABBF1",
			"border-blurred": "#838BA7",
			"button-color-foreground": "#303446",
			"button-foreground": "#C6D0F5",
			"error": "#E68284",
			"error-darken-1": "#D06E71",
			"error-darken-2": "#BA5A5E",
			"error-darken-3": "#A4474C",
			"error-lighten-1": "#FD9697",
			"error-lighten-2": "#FFAAAB",
			"error-lighten-3": "#FFBFBF",
			"error-muted": "#664B58",
			"footer-background": "#51576D",
			"footer-description-background": "#00000000",
			"footer-description-foreground": "#C6D0F5",
			"footer-foreground": "#C6D0F5",
			"footer-item-background": "#00000000",
			"footer-key-background": "#00000000",
			"footer-key-foreground": "#F4B8E4",
			"foreground": "#C6D0F5",
			"foreground-darken-1": "#B1BBDF",
			"foreground-darken-2": "#9CA7CA",
			"foreground-darken-3": "#8993B5",
			"foreground-disabled": "#C6D0F560",
			"foreground-lighten-1": "#DBE5FF",
			"foreground-lighten-2": "#F0FAFF",
			"foreground-lighten-3": "#FFFFFF",
			"foreground-muted": "#C6D0F599",
			"input-cursor-background": "#F2D5CF",
			"input-cursor-foreground": "#232634",
			"input-selection-background": "#949CBB4C",
			"link-background": "#00000000",
			"link-background-hover": "#CA9EE6",
			"link-color": "#FFFFFFDD",
			"link-color-hover": "#FFFFFFDD",
			"markdown-h1-background": "#00000000",
			"markdown-h1-color": "#CA9EE6",
			"markdown-h2-background": "#00000000",
			"markdown-h2-color": "#CA9EE6",
			"markdown-h3-background": "#00000000",
			"markdown-h3-color": "#CA9EE6",
			"markdown-h4-background": "#00000000",
			"markdown-h4-color": "#C6D0F5",
			"markdown-h5-background": "#00000000",
			"markdown-h5-color": "#C6D0F5",
			"markdown-h6-background": "#00000000",
			"markdown-h6-color": "#C6D0F599",
			"panel": "#51576D",
			"panel-darken-1": "#3F455A",
			"panel-darken-2": "#2E3448",
			"panel-darken-3": "#1D2437",
			"panel-lighten-1": "#63697F",
			"panel-lighten-2": "#767B93",
			"panel-lighten-3": "#898FA7",
			"primary": "#CA9EE6",
			"primary-background": "#625F76",
			"primary-background-darken-1": "#54516A",
			"primary-background-darken-2": "#47435E",
			"primary-background-darken-3": "#47435E",
			"primary-background-lighten-1": "#706D82",
			"primary-background-lighten-2": "#7E7B8E",
			"primary-background-lighten-3": "#8C899A",
			"primary-darken-1": "#B58AD0",
			"primary-darken-2": "#A076BB",
			"primary-darken-3": "#8C63A7",
			"primary-lighten-1": "#DFB2FB",
			"primary-lighten-2": "#F4C7FF",
			"primary-lighten-3": "#FFDCFF",
			"primary-muted": "#5E5376",
			"scrollbar": "#63547B",
			"scrollbar-active": "#CA9EE6",
			"scrollbar-background": "#1F2435",
			"scrollbar-background-active": "#1F2435",
			"scrollbar-background-hover": "#1F2435",
			"scrollbar-corner-color": "#1F2435",
			"scrollbar-hover": "#74618D",
			"secondary": "#EE9F76",
			"secondary-background": "#666067",
			"secondary-background-darken-1": "#59525A",
			"secondary-background-darken-2": "#4C444D",
			"secondary-background-darken-3": "#4C444D",
			"secondary-background-lighten-1": "#746E75",
			"secondary-background-lighten-2": "#817C82",
			"secondary-background-lighten-3": "#8F8A8F",
			"secondary-darken-1": "#D88B63",
			"secondary-darken-2": "#C27750",
			"secondary-darken-3": "#AC643E",
			"secondary-lighten-1": "#FFB389",
			"secondary-lighten-2": "#FFC89D",
			"secondary-lighten-3": "#FFDDB1",
			"secondary-muted": "#695454",
			"success": "#A6D189",
			"success-darken-1": "#91BC75",
			"success-darken-2": "#7DA762",
			"success-darken-3": "#6A9350",
			"success-lighten-1": "#BAE69C",
			"success-lighten-2": "#CFFBB1",
			"success-lighten-3": "#E5FFC5",
			"success-muted": "#53635A",
			"surface": "#414559",
			"surface-active": "#4F5267",
			"surface-darken-1": "#303447",
			"surface-darken-2": "#1F2436",
			"surface-darken-3": "#101526",
			"surface-lighten-1": "#52566B",
			"surface-lighten-2": "#64687E",
			"surface-lighten-3": "#777B91",
			"text": "#FFFFFFDD",
			"text-accent": "#F7D0ED",
			"text-disabled": "#FFFFFF60",
			"text-error": "#EFACAD",
			"text-muted": "#FFFFFF99",
			"text-primary": "#DCBEEE",
			"text-secondary": "#F4BFA4",
			"text-success": "#C4E0B1",
			"text-warning": "#EDDAB5",
			"warning": "#E4C890",
			"warning-darken-1": "#CFB37C",
			"warning-darken-2": "#BA9F69",
			"warning-darken-3": "#A58B56",
			"warning-lighten-1": "#FADCA4",
			"warning-lighten-2": "#FFF2B8",
			"warning-lighten-3": "#FFFFCD",
			"warning-muted": "#66605C"
		}
	};
	//#endregion
	//#region src/themes/data/catppuccin-latte.ts
	var theme$19 = {
		name: "catppuccin-latte",
		dark: false,
		ansi: {
			black: "#BCC0CC",
			red: "#D20F39",
			green: "#40A02B",
			yellow: "#DF8E1D",
			blue: "#1E66F5",
			magenta: "#EA76CB",
			cyan: "#179299",
			white: "#5C5F77",
			brightBlack: "#ACB0BE",
			brightRed: "#E7103F",
			brightGreen: "#46B02F",
			brightYellow: "#E49931",
			brightBlue: "#3878F6",
			brightMagenta: "#EF95D7",
			brightCyan: "#19A1A8",
			brightWhite: "#6C6F85"
		},
		vars: {
			"accent": "#FD640B",
			"accent-darken-1": "#E54F00",
			"accent-darken-2": "#CC3900",
			"accent-darken-3": "#B42200",
			"accent-lighten-1": "#FF7825",
			"accent-lighten-2": "#FF8D3A",
			"accent-lighten-3": "#FFA24F",
			"accent-muted": "#F3C6AE",
			"background": "#EFF1F5",
			"background-darken-1": "#D9DBDF",
			"background-darken-2": "#C4C6CA",
			"background-darken-3": "#B0B2B5",
			"background-lighten-1": "#FFFFFF",
			"background-lighten-2": "#FFFFFF",
			"background-lighten-3": "#FFFFFF",
			"block-cursor-background": "#8839EF",
			"block-cursor-blurred-background": "#8839EF4C",
			"block-cursor-blurred-foreground": "#4C4F69",
			"block-cursor-foreground": "#000000DD",
			"block-hover-background": "#00000019",
			"boost": "#0000000A",
			"boost-darken-1": "#0000000A",
			"boost-darken-2": "#0000000A",
			"boost-darken-3": "#0000000A",
			"boost-lighten-1": "#1616160A",
			"boost-lighten-2": "#2525250A",
			"boost-lighten-3": "#3535350A",
			"border": "#8839EF",
			"border-blurred": "#DEE1E7",
			"button-color-foreground": "#EFF1F5",
			"button-foreground": "#4C4F69",
			"error": "#D10F39",
			"error-darken-1": "#BA0028",
			"error-darken-2": "#A20019",
			"error-darken-3": "#8A0008",
			"error-lighten-1": "#EA324A",
			"error-lighten-2": "#FF4B5B",
			"error-lighten-3": "#FF626E",
			"error-muted": "#E6ADBC",
			"footer-background": "#CCD0DA",
			"footer-description-background": "#00000000",
			"footer-description-foreground": "#4C4F69",
			"footer-foreground": "#4C4F69",
			"footer-item-background": "#00000000",
			"footer-key-background": "#00000000",
			"footer-key-foreground": "#FE640B",
			"foreground": "#4C4F69",
			"foreground-darken-1": "#3A3D56",
			"foreground-darken-2": "#292D45",
			"foreground-darken-3": "#191D34",
			"foreground-disabled": "#4C4F6960",
			"foreground-lighten-1": "#5E607B",
			"foreground-lighten-2": "#70738F",
			"foreground-lighten-3": "#8386A2",
			"foreground-muted": "#4C4F6999",
			"input-cursor-background": "#4C4F69",
			"input-cursor-foreground": "#EFF1F5",
			"input-selection-background": "#9E4DFF66",
			"link-background": "#00000000",
			"link-background-hover": "#8839EF",
			"link-color": "#000000DD",
			"link-color-hover": "#000000DD",
			"markdown-h1-background": "#00000000",
			"markdown-h1-color": "#8839EF",
			"markdown-h2-background": "#00000000",
			"markdown-h2-color": "#8839EF",
			"markdown-h3-background": "#00000000",
			"markdown-h3-color": "#8839EF",
			"markdown-h4-background": "#00000000",
			"markdown-h4-color": "#4C4F69",
			"markdown-h5-background": "#00000000",
			"markdown-h5-color": "#4C4F69",
			"markdown-h6-background": "#00000000",
			"markdown-h6-color": "#4C4F6999",
			"panel": "#CCD0DA",
			"panel-darken-1": "#B7BBC5",
			"panel-darken-2": "#A3A6B0",
			"panel-darken-3": "#8F939C",
			"panel-lighten-1": "#E1E5EF",
			"panel-lighten-2": "#F6FAFF",
			"panel-lighten-3": "#FFFFFF",
			"primary": "#8839EF",
			"primary-background": "#8839EF",
			"primary-background-darken-1": "#7122D9",
			"primary-background-darken-2": "#5901C3",
			"primary-background-darken-3": "#4000AE",
			"primary-background-lighten-1": "#9E4DFF",
			"primary-background-lighten-2": "#B562FF",
			"primary-background-lighten-3": "#CC76FF",
			"primary-darken-1": "#7122D9",
			"primary-darken-2": "#5901C3",
			"primary-darken-3": "#4000AE",
			"primary-lighten-1": "#9E4DFF",
			"primary-lighten-2": "#B562FF",
			"primary-lighten-3": "#CC76FF",
			"primary-muted": "#D0B9F3",
			"scrollbar": "#B89AE5",
			"scrollbar-active": "#8839EF",
			"scrollbar-background": "#D9DBDF",
			"scrollbar-background-active": "#D9DBDF",
			"scrollbar-background-hover": "#D9DBDF",
			"scrollbar-corner-color": "#D9DBDF",
			"scrollbar-hover": "#B08AE7",
			"secondary": "#DB8A78",
			"secondary-background": "#DB8A78",
			"secondary-background-darken-1": "#C57665",
			"secondary-background-darken-2": "#B06353",
			"secondary-background-darken-3": "#9A5041",
			"secondary-background-lighten-1": "#F29D8B",
			"secondary-background-lighten-2": "#FFB29E",
			"secondary-background-lighten-3": "#FFC7B3",
			"secondary-darken-1": "#C57665",
			"secondary-darken-2": "#B06353",
			"secondary-darken-3": "#9A5041",
			"secondary-lighten-1": "#F29D8B",
			"secondary-lighten-2": "#FFB29E",
			"secondary-lighten-3": "#FFC7B3",
			"secondary-muted": "#E9D2CF",
			"success": "#40A02B",
			"success-darken-1": "#278B14",
			"success-darken-2": "#007800",
			"success-darken-3": "#006400",
			"success-lighten-1": "#56B43F",
			"success-lighten-2": "#6BC952",
			"success-lighten-3": "#81DE66",
			"success-muted": "#BAD8B8",
			"surface": "#E6E9EF",
			"surface-active": "#F7FAFF",
			"surface-darken-1": "#D0D3D9",
			"surface-darken-2": "#BCBFC4",
			"surface-darken-3": "#A7AAB0",
			"surface-lighten-1": "#FBFEFF",
			"surface-lighten-2": "#FFFFFF",
			"surface-lighten-3": "#FFFFFF",
			"text": "#000000DD",
			"text-accent": "#A74207",
			"text-disabled": "#00000060",
			"text-error": "#8A0925",
			"text-muted": "#00000099",
			"text-primary": "#59259D",
			"text-secondary": "#915B4F",
			"text-success": "#2A691C",
			"text-warning": "#935D13",
			"warning": "#DE8E1D",
			"warning-darken-1": "#C77A00",
			"warning-darken-2": "#B06700",
			"warning-darken-3": "#9A5500",
			"warning-lighten-1": "#F6A134",
			"warning-lighten-2": "#FFB648",
			"warning-lighten-3": "#FFCA5D",
			"warning-muted": "#EAD3B4"
		}
	};
	//#endregion
	//#region src/themes/data/catppuccin-macchiato.ts
	var theme$18 = {
		name: "catppuccin-macchiato",
		dark: true,
		ansi: {
			black: "#494D64",
			red: "#ED8796",
			green: "#A6DA95",
			yellow: "#EED49F",
			blue: "#8AADF4",
			magenta: "#F5BDE6",
			cyan: "#8BD5CA",
			white: "#B8C0E0",
			brightBlack: "#5B6078",
			brightRed: "#F2A7B2",
			brightGreen: "#BDE3B0",
			brightYellow: "#F4E3C1",
			brightBlue: "#ADC5F7",
			brightMagenta: "#F493DA",
			brightCyan: "#A5DED6",
			brightWhite: "#A5ADCB"
		},
		vars: {
			"accent": "#F5BDE6",
			"accent-darken-1": "#DFA8D0",
			"accent-darken-2": "#CA94BC",
			"accent-darken-3": "#B580A7",
			"accent-lighten-1": "#FFD1FB",
			"accent-lighten-2": "#FFE7FF",
			"accent-lighten-3": "#FFFCFF",
			"accent-muted": "#62546D",
			"background": "#24273A",
			"background-darken-1": "#141729",
			"background-darken-2": "#00021A",
			"background-darken-3": "#000007",
			"background-lighten-1": "#34374B",
			"background-lighten-2": "#45485C",
			"background-lighten-3": "#57596F",
			"block-cursor-background": "#C6A0F6",
			"block-cursor-blurred-background": "#C6A0F64C",
			"block-cursor-blurred-foreground": "#CAD3F5",
			"block-cursor-foreground": "#1E2030",
			"block-hover-background": "#FFFFFF19",
			"boost": "#FFFFFF0A",
			"boost-darken-1": "#E9E9E90A",
			"boost-darken-2": "#D4D4D40A",
			"boost-darken-3": "#BFBFBF0A",
			"boost-lighten-1": "#FFFFFF0A",
			"boost-lighten-2": "#FFFFFF0A",
			"boost-lighten-3": "#FFFFFF0A",
			"border": "#B7BDF8",
			"border-blurred": "#737994",
			"button-color-foreground": "#24273A",
			"button-foreground": "#CAD3F5",
			"error": "#ED8796",
			"error-darken-1": "#D67382",
			"error-darken-2": "#C05F6F",
			"error-darken-3": "#AB4C5D",
			"error-lighten-1": "#FF9BA9",
			"error-lighten-2": "#FFAFBE",
			"error-lighten-3": "#FFC4D3",
			"error-muted": "#604355",
			"footer-background": "#494D64",
			"footer-description-background": "#00000000",
			"footer-description-foreground": "#CAD3F5",
			"footer-foreground": "#CAD3F5",
			"footer-item-background": "#00000000",
			"footer-key-background": "#00000000",
			"footer-key-foreground": "#F5BDE6",
			"foreground": "#CAD3F5",
			"foreground-darken-1": "#B5BEDF",
			"foreground-darken-2": "#A0A9CA",
			"foreground-darken-3": "#8C95B5",
			"foreground-disabled": "#CAD3F560",
			"foreground-lighten-1": "#DFE8FF",
			"foreground-lighten-2": "#F4FDFF",
			"foreground-lighten-3": "#FFFFFF",
			"foreground-muted": "#CAD3F599",
			"input-cursor-background": "#F4DBD6",
			"input-cursor-foreground": "#181926",
			"input-selection-background": "#838BA74C",
			"link-background": "#00000000",
			"link-background-hover": "#C6A0F6",
			"link-color": "#FFFFFFDD",
			"link-color-hover": "#FFFFFFDD",
			"markdown-h1-background": "#00000000",
			"markdown-h1-color": "#C6A0F6",
			"markdown-h2-background": "#00000000",
			"markdown-h2-color": "#C6A0F6",
			"markdown-h3-background": "#00000000",
			"markdown-h3-color": "#C6A0F6",
			"markdown-h4-background": "#00000000",
			"markdown-h4-color": "#CAD3F5",
			"markdown-h5-background": "#00000000",
			"markdown-h5-color": "#CAD3F5",
			"markdown-h6-background": "#00000000",
			"markdown-h6-color": "#CAD3F599",
			"panel": "#494D64",
			"panel-darken-1": "#373B51",
			"panel-darken-2": "#262B40",
			"panel-darken-3": "#161C2F",
			"panel-lighten-1": "#5A5E76",
			"panel-lighten-2": "#6D7189",
			"panel-lighten-3": "#80849D",
			"primary": "#C6A0F6",
			"primary-background": "#59566F",
			"primary-background-darken-1": "#4A4762",
			"primary-background-darken-2": "#3C3956",
			"primary-background-darken-3": "#3C3956",
			"primary-background-lighten-1": "#67657C",
			"primary-background-lighten-2": "#767488",
			"primary-background-lighten-3": "#858395",
			"primary-darken-1": "#B08CE0",
			"primary-darken-2": "#9C78CB",
			"primary-darken-3": "#8865B6",
			"primary-lighten-1": "#DBB4FF",
			"primary-lighten-2": "#F1C9FF",
			"primary-lighten-3": "#FFDEFF",
			"primary-muted": "#544B72",
			"scrollbar": "#5B4D7B",
			"scrollbar-active": "#C6A0F6",
			"scrollbar-background": "#141729",
			"scrollbar-background-active": "#141729",
			"scrollbar-background-hover": "#141729",
			"scrollbar-corner-color": "#141729",
			"scrollbar-hover": "#6D5B8F",
			"secondary": "#F4A97F",
			"secondary-background": "#5F5760",
			"secondary-background-darken-1": "#514852",
			"secondary-background-darken-2": "#433A44",
			"secondary-background-darken-3": "#433A44",
			"secondary-background-lighten-1": "#6D666E",
			"secondary-background-lighten-2": "#7B757C",
			"secondary-background-lighten-3": "#89838A",
			"secondary-darken-1": "#DE946B",
			"secondary-darken-2": "#C88159",
			"secondary-darken-3": "#B26E47",
			"secondary-lighten-1": "#FFBD92",
			"secondary-lighten-2": "#FFD2A6",
			"secondary-lighten-3": "#FFE7BB",
			"secondary-muted": "#624E4E",
			"success": "#A6DA95",
			"success-darken-1": "#91C481",
			"success-darken-2": "#7DB06E",
			"success-darken-3": "#6A9C5B",
			"success-lighten-1": "#BAEFA9",
			"success-lighten-2": "#CFFFBD",
			"success-lighten-3": "#E5FFD2",
			"success-muted": "#4B5C55",
			"surface": "#363A4F",
			"surface-active": "#43475D",
			"surface-darken-1": "#25293D",
			"surface-darken-2": "#151A2D",
			"surface-darken-3": "#03061D",
			"surface-lighten-1": "#474B60",
			"surface-lighten-2": "#595C73",
			"surface-lighten-3": "#6B6F86",
			"text": "#FFFFFFDD",
			"text-accent": "#F8D3EE",
			"text-disabled": "#FFFFFF60",
			"text-error": "#F3AFB9",
			"text-muted": "#FFFFFF99",
			"text-primary": "#D9C0F9",
			"text-secondary": "#F8C6AA",
			"text-success": "#C4E6B9",
			"text-warning": "#F3E2BF",
			"warning": "#EED49F",
			"warning-darken-1": "#D8BF8B",
			"warning-darken-2": "#C3AA77",
			"warning-darken-3": "#AE9664",
			"warning-lighten-1": "#FFE9B3",
			"warning-lighten-2": "#FFFEC7",
			"warning-lighten-3": "#FFFFDD",
			"warning-muted": "#605A58"
		}
	};
	//#endregion
	//#region src/themes/data/catppuccin-mocha.ts
	var theme$17 = {
		name: "catppuccin-mocha",
		dark: true,
		ansi: {
			black: "#45475A",
			red: "#F38BA8",
			green: "#A6E3A1",
			yellow: "#F9E2AF",
			blue: "#89B4FA",
			magenta: "#F5C2E7",
			cyan: "#94E2D5",
			white: "#BAC2DE",
			brightBlack: "#585B70",
			brightRed: "#F7AEC2",
			brightGreen: "#C2ECBF",
			brightYellow: "#FCD682",
			brightBlue: "#AECCFC",
			brightMagenta: "#F398DA",
			brightCyan: "#B1EAE1",
			brightWhite: "#A6ADC8"
		},
		vars: {
			"accent": "#F9B387",
			"accent-darken-1": "#E39E73",
			"accent-darken-2": "#CD8A60",
			"accent-darken-3": "#B7774E",
			"accent-lighten-1": "#FFC79A",
			"accent-lighten-2": "#FFDCAE",
			"accent-lighten-3": "#FFF2C3",
			"accent-muted": "#5B4642",
			"background": "#181825",
			"background-darken-1": "#040216",
			"background-darken-2": "#000000",
			"background-darken-3": "#000000",
			"background-lighten-1": "#272735",
			"background-lighten-2": "#373746",
			"background-lighten-3": "#484857",
			"block-cursor-background": "#F5C2E7",
			"block-cursor-blurred-background": "#F5C2E74C",
			"block-cursor-blurred-foreground": "#CDD6F4",
			"block-cursor-foreground": "#1E1E2E",
			"block-hover-background": "#FFFFFF19",
			"boost": "#FFFFFF0A",
			"boost-darken-1": "#E9E9E90A",
			"boost-darken-2": "#D4D4D40A",
			"boost-darken-3": "#BFBFBF0A",
			"boost-lighten-1": "#FFFFFF0A",
			"boost-lighten-2": "#FFFFFF0A",
			"boost-lighten-3": "#FFFFFF0A",
			"border": "#B4BEFE",
			"border-blurred": "#585B70",
			"button-color-foreground": "#181825",
			"button-foreground": "#CDD6F4",
			"error": "#F28FAD",
			"error-darken-1": "#DB7A99",
			"error-darken-2": "#C66785",
			"error-darken-3": "#B05372",
			"error-lighten-1": "#FFA3C1",
			"error-lighten-2": "#FFB8D6",
			"error-lighten-3": "#FFCDEB",
			"error-muted": "#593B4D",
			"footer-background": "#45475A",
			"footer-description-background": "#00000000",
			"footer-description-foreground": "#CDD6F4",
			"footer-foreground": "#CDD6F4",
			"footer-item-background": "#00000000",
			"footer-key-background": "#00000000",
			"footer-key-foreground": "#FAB387",
			"foreground": "#CDD6F4",
			"foreground-darken-1": "#B8C1DE",
			"foreground-darken-2": "#A3ACC9",
			"foreground-darken-3": "#8F98B4",
			"foreground-disabled": "#CDD6F460",
			"foreground-lighten-1": "#E2EBFF",
			"foreground-lighten-2": "#F7FFFF",
			"foreground-lighten-3": "#FFFFFF",
			"foreground-muted": "#CDD6F499",
			"input-cursor-background": "#F5E0DC",
			"input-cursor-foreground": "#11111B",
			"input-selection-background": "#9399B24C",
			"link-background": "#00000000",
			"link-background-hover": "#F5C2E7",
			"link-color": "#FFFFFFDD",
			"link-color-hover": "#FFFFFFDD",
			"markdown-h1-background": "#00000000",
			"markdown-h1-color": "#F5C2E7",
			"markdown-h2-background": "#00000000",
			"markdown-h2-color": "#F5C2E7",
			"markdown-h3-background": "#00000000",
			"markdown-h3-color": "#F5C2E7",
			"markdown-h4-background": "#00000000",
			"markdown-h4-color": "#CDD6F4",
			"markdown-h5-background": "#00000000",
			"markdown-h5-color": "#CDD6F4",
			"markdown-h6-background": "#00000000",
			"markdown-h6-color": "#CDD6F499",
			"panel": "#45475A",
			"panel-darken-1": "#333648",
			"panel-darken-2": "#232637",
			"panel-darken-3": "#131627",
			"panel-lighten-1": "#56586C",
			"panel-lighten-2": "#696A7F",
			"panel-lighten-3": "#7B7D92",
			"primary": "#F5C2E7",
			"primary-background": "#564F5E",
			"primary-background-darken-1": "#474050",
			"primary-background-darken-2": "#393142",
			"primary-background-darken-3": "#393142",
			"primary-background-lighten-1": "#655F6C",
			"primary-background-lighten-2": "#746E7A",
			"primary-background-lighten-3": "#837E88",
			"primary-darken-1": "#DFADD1",
			"primary-darken-2": "#CA99BD",
			"primary-darken-3": "#B585A8",
			"primary-lighten-1": "#FFD6FC",
			"primary-lighten-2": "#FFECFF",
			"primary-lighten-3": "#FFFFFF",
			"primary-muted": "#5A4B5F",
			"scrollbar": "#644E69",
			"scrollbar-active": "#F5C2E7",
			"scrollbar-background": "#040216",
			"scrollbar-background-active": "#040216",
			"scrollbar-background-hover": "#040216",
			"scrollbar-corner-color": "#040216",
			"scrollbar-hover": "#7C627E",
			"secondary": "#CBA6F7",
			"secondary-background": "#504C60",
			"secondary-background-darken-1": "#413C52",
			"secondary-background-darken-2": "#322D44",
			"secondary-background-darken-3": "#322D44",
			"secondary-background-lighten-1": "#605C6E",
			"secondary-background-lighten-2": "#6F6C7C",
			"secondary-background-lighten-3": "#7E7B8A",
			"secondary-darken-1": "#B592E1",
			"secondary-darken-2": "#A17ECC",
			"secondary-darken-3": "#8C6BB7",
			"secondary-lighten-1": "#E0BAFF",
			"secondary-lighten-2": "#F6CFFF",
			"secondary-lighten-3": "#FFE4FF",
			"secondary-muted": "#4D4264",
			"success": "#ABE9B3",
			"success-darken-1": "#96D39E",
			"success-darken-2": "#82BE8B",
			"success-darken-3": "#6EAA77",
			"success-lighten-1": "#BFFEC7",
			"success-lighten-2": "#D5FFDC",
			"success-lighten-3": "#EAFFF2",
			"success-muted": "#44564F",
			"surface": "#313244",
			"surface-active": "#3E3F51",
			"surface-darken-1": "#202233",
			"surface-darken-2": "#111223",
			"surface-darken-3": "#000014",
			"surface-lighten-1": "#414255",
			"surface-lighten-2": "#535467",
			"surface-lighten-3": "#65667A",
			"text": "#FFFFFFDD",
			"text-accent": "#FBCCAF",
			"text-disabled": "#FFFFFF60",
			"text-error": "#F6B5C8",
			"text-muted": "#FFFFFF99",
			"text-primary": "#F8D6EF",
			"text-secondary": "#DCC4F9",
			"text-success": "#C7F0CC",
			"text-warning": "#FBECCA",
			"warning": "#FAE3B0",
			"warning-darken-1": "#E4CD9B",
			"warning-darken-2": "#CEB988",
			"warning-darken-3": "#B9A574",
			"warning-lighten-1": "#FFF8C4",
			"warning-lighten-2": "#FFFFD9",
			"warning-lighten-3": "#FFFFEF",
			"warning-muted": "#5B544E"
		}
	};
	//#endregion
	//#region src/themes/data/types.ts
	/**
	* ANSI colour numbers 0–15 in order: the eight normal colours, then their
	* bright forms. Named rather than positional so a data file cannot shift a
	* colour into its neighbour's slot by miscounting.
	*/
	var ANSI_SLOTS = [
		"black",
		"red",
		"green",
		"yellow",
		"blue",
		"magenta",
		"cyan",
		"white",
		"brightBlack",
		"brightRed",
		"brightGreen",
		"brightYellow",
		"brightBlue",
		"brightMagenta",
		"brightCyan",
		"brightWhite"
	];
	//#endregion
	//#region src/themes/data/ansi-tables.ts
	/**
	* The VGA colours a terminal draws with no theme of its own: Rich's
	* \`DEFAULT_TERMINAL_THEME\`, and what \`textual-ansi\` spells its palette in.
	*/
	var VGA_ANSI = Object.fromEntries(ANSI_SLOTS.map((slot, n) => [slot, STANDARD_TABLE.get(n).hex]));
	/**
	* The ANSI tables Textual draws named colours in for a theme that has no
	* terminal scheme of its own: \`MONOKAI\` under a dark theme and \`ALABASTER\`
	* under a light one (\`ansi_theme_dark\` / \`ansi_theme_light\` in Textual's
	* \`app.py\`, values from its \`_ansi_theme.py\`).
	*/
	var TEXTUAL_DARK_ANSI = {
		black: "#1A1A1A",
		red: "#F4005F",
		green: "#98E024",
		yellow: "#FD971F",
		blue: "#9D65FF",
		magenta: "#F4005F",
		cyan: "#58D1EB",
		white: "#C4C5B5",
		brightBlack: "#625E4C",
		brightRed: "#F4005F",
		brightGreen: "#98E024",
		brightYellow: "#E0D561",
		brightBlue: "#9D65FF",
		brightMagenta: "#F4005F",
		brightCyan: "#58D1EB",
		brightWhite: "#F6F6EF"
	};
	//#endregion
	//#region src/themes/data/index.ts
	/**
	* All bundled theme palettes, keyed by name (20 Textual-ported + 2 rich-js
	* synthetic: \`default\` and \`svg-export\`). \`as const\` preserves the literal-
	* type keys so \`ThemeName\` (below) is \`"atom-one-dark" | "..."\`, not
	* \`string\`. Callers must type their input as \`ThemeName\` explicitly to get
	* compile-time safety; \`getThemePalette(string)\` still returns nullable.
	*/
	var THEMES = {
		"atom-one-dark": theme$22,
		"atom-one-light": theme$21,
		"catppuccin-frappe": theme$20,
		"catppuccin-latte": theme$19,
		"catppuccin-macchiato": theme$18,
		"catppuccin-mocha": theme$17,
		"cyberpunk": {
			name: "cyberpunk",
			dark: true,
			ansi: TEXTUAL_DARK_ANSI,
			vars: {
				"background": "#070714",
				"background-darken-1": "#03030A",
				"background-darken-2": "#000003",
				"background-darken-3": "#000000",
				"background-lighten-1": "#11111E",
				"background-lighten-2": "#1A1A2B",
				"background-lighten-3": "#25253A",
				"foreground": "#E2E2FF",
				"foreground-darken-1": "#CACAE4",
				"foreground-darken-2": "#B3B3CC",
				"foreground-darken-3": "#9C9CB5",
				"foreground-disabled": "#E2E2FF60",
				"foreground-lighten-1": "#EEEEFF",
				"foreground-lighten-2": "#F6F6FF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#E2E2FF99",
				"primary": "#00E5FFD9",
				"primary-darken-1": "#00CCE6D9",
				"primary-darken-2": "#00B2CCD9",
				"primary-darken-3": "#0099B3D9",
				"primary-lighten-1": "#1AF0FFD9",
				"primary-lighten-2": "#33F5FFD9",
				"primary-lighten-3": "#4DFAFFD9",
				"primary-muted": "#054A5BF4",
				"primary-background": "#0A3340",
				"primary-background-darken-1": "#072833",
				"primary-background-darken-2": "#051E27",
				"primary-background-darken-3": "#051E27",
				"primary-background-lighten-1": "#0F404F",
				"primary-background-lighten-2": "#154E5F",
				"primary-background-lighten-3": "#1A5C6F",
				"secondary": "#FF1E8ECC",
				"secondary-darken-1": "#E60A76CC",
				"secondary-darken-2": "#CC005FCC",
				"secondary-darken-3": "#B20048CC",
				"secondary-lighten-1": "#FF3CA2CC",
				"secondary-lighten-2": "#FF5AB6CC",
				"secondary-lighten-3": "#FF78CACC",
				"secondary-muted": "#510E39EF",
				"secondary-background": "#3A0A28",
				"secondary-background-darken-1": "#2E071F",
				"secondary-background-darken-2": "#220517",
				"secondary-background-darken-3": "#220517",
				"secondary-background-lighten-1": "#470D33",
				"secondary-background-lighten-2": "#54103F",
				"secondary-background-lighten-3": "#61134B",
				"accent": "#EEFF00CC",
				"accent-darken-1": "#D6E600CC",
				"accent-darken-2": "#BECC00CC",
				"accent-darken-3": "#A5B200CC",
				"accent-lighten-1": "#FFFF26CC",
				"accent-lighten-2": "#FFFF4DCC",
				"accent-lighten-3": "#FFFF73CC",
				"accent-muted": "#4C510EEF",
				"success": "#39FF14BF",
				"success-darken-1": "#23E60ABF",
				"success-darken-2": "#0FCC00BF",
				"success-darken-3": "#00B200BF",
				"success-lighten-1": "#4DFF32BF",
				"success-lighten-2": "#69FF5ABF",
				"success-lighten-3": "#87FF82BF",
				"success-muted": "#164D14F0",
				"warning": "#FF6E00CC",
				"warning-darken-1": "#E65800CC",
				"warning-darken-2": "#CC4300CC",
				"warning-darken-3": "#B23000CC",
				"warning-lighten-1": "#FF8C26CC",
				"warning-lighten-2": "#FFA54DCC",
				"warning-lighten-3": "#FFBE73CC",
				"warning-muted": "#51260EEF",
				"error": "#FF1133BF",
				"error-darken-1": "#E6051EBF",
				"error-darken-2": "#CC000CBF",
				"error-darken-3": "#B20000BF",
				"error-lighten-1": "#FF3758BF",
				"error-lighten-2": "#FF5A78BF",
				"error-lighten-3": "#FF7D96BF",
				"error-muted": "#510A1DF0",
				"surface": "#0F0F22",
				"surface-active": "#161630",
				"surface-darken-1": "#08081A",
				"surface-darken-2": "#040411",
				"surface-darken-3": "#020209",
				"surface-lighten-1": "#17172E",
				"surface-lighten-2": "#1F1F3C",
				"surface-lighten-3": "#28284A",
				"panel": "#0C0C1E",
				"panel-darken-1": "#060614",
				"panel-darken-2": "#03030C",
				"panel-darken-3": "#010108",
				"panel-lighten-1": "#14142C",
				"panel-lighten-2": "#1C1C3A",
				"panel-lighten-3": "#242448",
				"scrollbar": "#151535",
				"scrollbar-active": "#00E5FFD9",
				"scrollbar-background": "#040412",
				"scrollbar-background-active": "#040412",
				"scrollbar-background-hover": "#040412",
				"scrollbar-corner-color": "#040412",
				"scrollbar-hover": "#1F1F48",
				"block-cursor-background": "#00E5FF",
				"block-cursor-blurred-background": "#00E5FF4C",
				"block-cursor-blurred-foreground": "#E2E2FF",
				"block-cursor-foreground": "#070714",
				"block-hover-background": "#00E5FF19",
				"boost": "#00E5FF0A",
				"boost-darken-1": "#00CCE60A",
				"boost-darken-2": "#00B2CC0A",
				"boost-darken-3": "#0099B30A",
				"boost-lighten-1": "#00E5FF0A",
				"boost-lighten-2": "#00E5FF0A",
				"boost-lighten-3": "#00E5FF0A",
				"border": "#00E5FFD9",
				"border-blurred": "#1A1A35",
				"button-color-foreground": "#070714",
				"button-foreground": "#E2E2FF",
				"footer-background": "#0C0C1E",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#E2E2FF",
				"footer-foreground": "#E2E2FF",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#00E5FFD9",
				"input-cursor-background": "#E2E2FF",
				"input-cursor-foreground": "#070714",
				"input-selection-background": "#00E5FF40",
				"link-background": "#00000000",
				"link-background-hover": "#00E5FFD9",
				"link-color": "#E2E2FFDD",
				"link-color-hover": "#070714",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#00E5FFD9",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#00E5FFD9",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#FF1E8ECC",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#E2E2FF",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#E2E2FF",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#E2E2FF99",
				"text": "#E2E2FFDD",
				"text-accent": "#F4FF66CC",
				"text-disabled": "#E2E2FF60",
				"text-error": "#FF6677BF",
				"text-muted": "#E2E2FF99",
				"text-primary": "#66F0FFD9",
				"text-secondary": "#FF80B0CC",
				"text-success": "#80FF55BF",
				"text-warning": "#FFB055CC"
			}
		},
		"default": {
			name: "default",
			dark: true,
			ansi: VGA_ANSI,
			vars: {
				"accent": "#006FB8",
				"accent-darken-1": "#005CA3",
				"accent-darken-2": "#004B8F",
				"accent-darken-3": "#003A7B",
				"accent-lighten-1": "#3081CC",
				"accent-lighten-2": "#4C95E2",
				"accent-lighten-3": "#64A8F7",
				"accent-muted": "#002137",
				"background": "#000000",
				"background-darken-1": "#000000",
				"background-darken-2": "#000000",
				"background-darken-3": "#000000",
				"background-lighten-1": "#161616",
				"background-lighten-2": "#252525",
				"background-lighten-3": "#353535",
				"block-cursor-background": "#006FB8",
				"block-cursor-blurred-background": "#006FB84C",
				"block-cursor-blurred-foreground": "#FFFFFF",
				"block-cursor-foreground": "#FFFFFFDD",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#006FB8",
				"border-blurred": "#191919",
				"button-color-foreground": "#FFFFFFDD",
				"button-foreground": "#FFFFFF",
				"error": "#7F0000",
				"error-darken-1": "#6A0000",
				"error-darken-2": "#560000",
				"error-darken-3": "#450000",
				"error-lighten-1": "#961E12",
				"error-lighten-2": "#AD3423",
				"error-lighten-3": "#C44934",
				"error-muted": "#260000",
				"footer-background": "#242E35",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#FFFFFF",
				"footer-foreground": "#FFFFFF",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#006FB8",
				"foreground": "#FFFFFF",
				"foreground-darken-1": "#E9E9E9",
				"foreground-darken-2": "#D4D4D4",
				"foreground-darken-3": "#BFBFBF",
				"foreground-disabled": "#FFFFFF60",
				"foreground-lighten-1": "#FFFFFF",
				"foreground-lighten-2": "#FFFFFF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#FFFFFF99",
				"input-cursor-background": "#FFFFFF",
				"input-cursor-foreground": "#000000",
				"input-selection-background": "#3081CC66",
				"link-background": "#00000000",
				"link-background-hover": "#006FB8",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#006FB8",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#006FB8",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#006FB8",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#FFFFFF",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#FFFFFF",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#FFFFFF99",
				"panel": "#242E35",
				"panel-darken-1": "#141E24",
				"panel-darken-2": "#000D15",
				"panel-darken-3": "#000000",
				"panel-lighten-1": "#343E45",
				"panel-lighten-2": "#454F57",
				"panel-lighten-3": "#566169",
				"primary": "#006FB8",
				"primary-background": "#26333D",
				"primary-background-darken-1": "#13212C",
				"primary-background-darken-2": "#00101B",
				"primary-background-darken-3": "#00101B",
				"primary-background-lighten-1": "#39454E",
				"primary-background-lighten-2": "#4C575F",
				"primary-background-lighten-3": "#5F6970",
				"primary-darken-1": "#005CA3",
				"primary-darken-2": "#004B8F",
				"primary-darken-3": "#003A7B",
				"primary-lighten-1": "#3081CC",
				"primary-lighten-2": "#4C95E2",
				"primary-lighten-3": "#64A8F7",
				"primary-muted": "#002137",
				"scrollbar": "#002C49",
				"scrollbar-active": "#006FB8",
				"scrollbar-background": "#000000",
				"scrollbar-background-active": "#000000",
				"scrollbar-background-hover": "#000000",
				"scrollbar-corner-color": "#000000",
				"scrollbar-hover": "#00375C",
				"secondary": "#762671",
				"secondary-background": "#342A33",
				"secondary-background-darken-1": "#221721",
				"secondary-background-darken-2": "#110510",
				"secondary-background-darken-3": "#110510",
				"secondary-background-lighten-1": "#463D45",
				"secondary-background-lighten-2": "#585057",
				"secondary-background-lighten-3": "#6A6269",
				"secondary-darken-1": "#620F5E",
				"secondary-darken-2": "#4E004C",
				"secondary-darken-3": "#3B003A",
				"secondary-lighten-1": "#8A3984",
				"secondary-lighten-2": "#9E4C97",
				"secondary-lighten-3": "#B360AB",
				"secondary-muted": "#230B21",
				"success": "#008000",
				"success-darken-1": "#006C00",
				"success-darken-2": "#005900",
				"success-darken-3": "#004600",
				"success-lighten-1": "#29931C",
				"success-lighten-2": "#42A832",
				"success-lighten-3": "#58BD46",
				"success-muted": "#002600",
				"surface": "#1E1E1E",
				"surface-active": "#2A2A2A",
				"surface-darken-1": "#0D0D0D",
				"surface-darken-2": "#000000",
				"surface-darken-3": "#000000",
				"surface-lighten-1": "#2D2D2D",
				"surface-lighten-2": "#3E3E3E",
				"surface-lighten-3": "#4F4F4F",
				"text": "#FFFFFFDD",
				"text-accent": "#569FD0",
				"text-disabled": "#FFFFFF60",
				"text-error": "#AB5656",
				"text-muted": "#FFFFFF99",
				"text-primary": "#569FD0",
				"text-secondary": "#A46FA1",
				"text-success": "#56AB56",
				"text-warning": "#ABAB56",
				"warning": "#7F8000",
				"warning-darken-1": "#6B6D00",
				"warning-darken-2": "#575A00",
				"warning-darken-3": "#454900",
				"warning-lighten-1": "#94931E",
				"warning-lighten-2": "#A9A734",
				"warning-lighten-3": "#BFBB48",
				"warning-muted": "#262600"
			}
		},
		"dracula": {
			name: "dracula",
			dark: true,
			ansi: {
				black: "#21222C",
				red: "#FF5555",
				green: "#50FA7B",
				yellow: "#F1FA8C",
				blue: "#BD93F9",
				magenta: "#FF79C6",
				cyan: "#8BE9FD",
				white: "#F8F8F2",
				brightBlack: "#6272A4",
				brightRed: "#FF6E6E",
				brightGreen: "#69FF94",
				brightYellow: "#FFFFA5",
				brightBlue: "#D6ACFF",
				brightMagenta: "#FF92DF",
				brightCyan: "#A4FFFF",
				brightWhite: "#FFFFFF"
			},
			vars: {
				"accent": "#FF79C6",
				"accent-darken-1": "#E864B1",
				"accent-darken-2": "#D24F9D",
				"accent-darken-3": "#BC3989",
				"accent-lighten-1": "#FF8DDA",
				"accent-lighten-2": "#FFA3F0",
				"accent-lighten-3": "#FFB8FF",
				"accent-muted": "#684161",
				"background": "#282A36",
				"background-darken-1": "#181A25",
				"background-darken-2": "#050716",
				"background-darken-3": "#000000",
				"background-lighten-1": "#383A46",
				"background-lighten-2": "#494B58",
				"background-lighten-3": "#5B5D6A",
				"block-cursor-background": "#BD93F9",
				"block-cursor-blurred-background": "#BD93F94C",
				"block-cursor-blurred-foreground": "#F8F8F2",
				"block-cursor-foreground": "#FFFFFFDD",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#BD93F9",
				"border-blurred": "#252835",
				"button-color-foreground": "#282A36",
				"button-foreground": "#F8F8F2",
				"error": "#FE5555",
				"error-darken-1": "#E63E43",
				"error-darken-2": "#CE2332",
				"error-darken-3": "#B70022",
				"error-lighten-1": "#FF6A67",
				"error-lighten-2": "#FF807A",
				"error-lighten-3": "#FF958D",
				"error-muted": "#68363F",
				"footer-background": "#313442",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#F8F8F2",
				"footer-foreground": "#F8F8F2",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#FF79C6",
				"foreground": "#F8F8F2",
				"foreground-darken-1": "#E2E2DC",
				"foreground-darken-2": "#CDCDC7",
				"foreground-darken-3": "#B8B8B3",
				"foreground-disabled": "#F8F8F260",
				"foreground-lighten-1": "#FFFFFF",
				"foreground-lighten-2": "#FFFFFF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#F8F8F299",
				"input-cursor-background": "#F8F8F2",
				"input-cursor-foreground": "#282A36",
				"input-selection-background": "#D2A7FF66",
				"link-background": "#00000000",
				"link-background-hover": "#BD93F9",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#BD93F9",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#BD93F9",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#BD93F9",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#F8F8F2",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#F8F8F2",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#F8F8F299",
				"panel": "#313442",
				"panel-darken-1": "#202431",
				"panel-darken-2": "#111421",
				"panel-darken-3": "#000012",
				"panel-lighten-1": "#414453",
				"panel-lighten-2": "#535665",
				"panel-lighten-3": "#656878",
				"primary": "#BD93F9",
				"primary-background": "#5A566C",
				"primary-background-darken-1": "#4C475F",
				"primary-background-darken-2": "#3E3953",
				"primary-background-darken-3": "#3E3953",
				"primary-background-lighten-1": "#696579",
				"primary-background-lighten-2": "#777486",
				"primary-background-lighten-3": "#868393",
				"primary-darken-1": "#A77FE3",
				"primary-darken-2": "#936CCE",
				"primary-darken-3": "#7E59B9",
				"primary-lighten-1": "#D2A7FF",
				"primary-lighten-2": "#E8BBFF",
				"primary-lighten-3": "#FED0FF",
				"primary-muted": "#544970",
				"scrollbar": "#5A4A79",
				"scrollbar-active": "#BD93F9",
				"scrollbar-background": "#181A25",
				"scrollbar-background-active": "#181A25",
				"scrollbar-background-hover": "#181A25",
				"scrollbar-corner-color": "#181A25",
				"scrollbar-hover": "#6A568F",
				"secondary": "#6272A4",
				"secondary-background": "#4F5261",
				"secondary-background-darken-1": "#3F4353",
				"secondary-background-darken-2": "#303446",
				"secondary-background-darken-3": "#303446",
				"secondary-background-lighten-1": "#5E616F",
				"secondary-background-lighten-2": "#6E707D",
				"secondary-background-lighten-3": "#7D808B",
				"secondary-darken-1": "#4E5F90",
				"secondary-darken-2": "#3B4D7C",
				"secondary-darken-3": "#283C69",
				"secondary-lighten-1": "#7584B8",
				"secondary-lighten-2": "#8998CD",
				"secondary-lighten-3": "#9DACE2",
				"secondary-muted": "#393F57",
				"success": "#50FA7B",
				"success-darken-1": "#2FE467",
				"success-darken-2": "#00CE53",
				"success-darken-3": "#00B83F",
				"success-lighten-1": "#6AFF8F",
				"success-lighten-2": "#83FFA3",
				"success-lighten-3": "#9BFFB8",
				"success-muted": "#34684A",
				"surface": "#2B2E3B",
				"surface-active": "#383B48",
				"surface-darken-1": "#1B1E2A",
				"surface-darken-2": "#0A0D1B",
				"surface-darken-3": "#000009",
				"surface-lighten-1": "#3B3E4C",
				"surface-lighten-2": "#4C4F5D",
				"surface-lighten-3": "#5E6170",
				"text": "#FFFFFFDD",
				"text-accent": "#FFA6D9",
				"text-disabled": "#FFFFFF60",
				"text-error": "#FF8E8E",
				"text-muted": "#FFFFFF99",
				"text-primary": "#D3B7FB",
				"text-secondary": "#97A1C2",
				"text-success": "#8BFBA7",
				"text-warning": "#FFD09D",
				"warning": "#FEB86C",
				"warning-darken-1": "#E8A358",
				"warning-darken-2": "#D18F45",
				"warning-darken-3": "#BB7C33",
				"warning-lighten-1": "#FFCC7F",
				"warning-lighten-2": "#FFE193",
				"warning-lighten-3": "#FFF7A7",
				"warning-muted": "#685446"
			}
		},
		"flexoki": {
			name: "flexoki",
			dark: true,
			ansi: {
				black: "#100F0F",
				red: "#D14D41",
				green: "#879A39",
				yellow: "#D0A215",
				blue: "#4385BE",
				magenta: "#CE5D97",
				cyan: "#3AA99F",
				white: "#878580",
				brightBlack: "#575653",
				brightRed: "#AF3029",
				brightGreen: "#66800B",
				brightYellow: "#AD8301",
				brightBlue: "#205EA6",
				brightMagenta: "#A02F6F",
				brightCyan: "#24837B",
				brightWhite: "#CECDC3"
			},
			vars: {
				"accent": "#9B76C8",
				"accent-darken-1": "#8663B3",
				"accent-darken-2": "#72509E",
				"accent-darken-3": "#5F3E8B",
				"accent-lighten-1": "#AF89DD",
				"accent-lighten-2": "#C49DF2",
				"accent-lighten-3": "#D9B1FF",
				"accent-muted": "#392D46",
				"background": "#100F0F",
				"background-darken-1": "#000000",
				"background-darken-2": "#000000",
				"background-darken-3": "#000000",
				"background-lighten-1": "#1F1F1F",
				"background-lighten-2": "#2F2E2E",
				"background-lighten-3": "#403F3F",
				"block-cursor-background": "#205EA6",
				"block-cursor-blurred-background": "#205EA64C",
				"block-cursor-blurred-foreground": "#FFFCF0",
				"block-cursor-foreground": "#FFFFFFDD",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#205EA6",
				"border-blurred": "#171614",
				"button-color-foreground": "#FFFCF0",
				"button-foreground": "#FFFCF0",
				"error": "#AE3029",
				"error-darken-1": "#981818",
				"error-darken-2": "#810007",
				"error-darken-3": "#6B0000",
				"error-lighten-1": "#C64539",
				"error-lighten-2": "#DD594B",
				"error-lighten-3": "#F46D5D",
				"error-muted": "#3F1816",
				"footer-background": "#282726",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#FFFCF0",
				"footer-foreground": "#FFFCF0",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#9B76C8",
				"foreground": "#FFFCF0",
				"foreground-darken-1": "#E9E6DA",
				"foreground-darken-2": "#D4D1C5",
				"foreground-darken-3": "#BFBCB1",
				"foreground-disabled": "#FFFCF060",
				"foreground-lighten-1": "#FFFFFF",
				"foreground-lighten-2": "#FFFFFF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#FFFCF099",
				"input-cursor-background": "#FFFCF0",
				"input-cursor-foreground": "#5E409D",
				"input-selection-background": "#6F6E6959",
				"link-background": "#00000000",
				"link-background-hover": "#205EA6",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#205EA6",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#205EA6",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#205EA6",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#FFFCF0",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#FFFCF0",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#FFFCF099",
				"panel": "#282726",
				"panel-darken-1": "#181716",
				"panel-darken-2": "#040200",
				"panel-darken-3": "#000000",
				"panel-lighten-1": "#383736",
				"panel-lighten-2": "#494846",
				"panel-lighten-3": "#5A5958",
				"primary": "#205EA6",
				"primary-background": "#353C45",
				"primary-background-darken-1": "#232B35",
				"primary-background-darken-2": "#121A25",
				"primary-background-darken-3": "#121A25",
				"primary-background-lighten-1": "#474D56",
				"primary-background-lighten-2": "#595E66",
				"primary-background-lighten-3": "#6A6F76",
				"primary-darken-1": "#004C91",
				"primary-darken-2": "#003B7E",
				"primary-darken-3": "#002B6B",
				"primary-lighten-1": "#3C70BA",
				"primary-lighten-2": "#5383CF",
				"primary-lighten-3": "#6996E4",
				"primary-muted": "#14263C",
				"scrollbar": "#0C2542",
				"scrollbar-active": "#205EA6",
				"scrollbar-background": "#000000",
				"scrollbar-background-active": "#000000",
				"scrollbar-background-hover": "#000000",
				"scrollbar-corner-color": "#000000",
				"scrollbar-hover": "#102F53",
				"secondary": "#24837B",
				"secondary-background": "#364140",
				"secondary-background-darken-1": "#24302F",
				"secondary-background-darken-2": "#13201F",
				"secondary-background-darken-3": "#13201F",
				"secondary-background-lighten-1": "#485251",
				"secondary-background-lighten-2": "#596262",
				"secondary-background-lighten-3": "#6B7373",
				"secondary-darken-1": "#006F68",
				"secondary-darken-2": "#005D56",
				"secondary-darken-3": "#004A44",
				"secondary-lighten-1": "#3C968E",
				"secondary-lighten-2": "#52AAA1",
				"secondary-lighten-3": "#67BFB6",
				"secondary-muted": "#16312F",
				"success": "#65800B",
				"success-darken-1": "#526D00",
				"success-darken-2": "#3E5A00",
				"success-darken-3": "#2D4800",
				"success-lighten-1": "#7A9324",
				"success-lighten-2": "#8EA738",
				"success-lighten-3": "#A3BB4C",
				"success-muted": "#29300D",
				"surface": "#1C1B1A",
				"surface-active": "#282726",
				"surface-darken-1": "#0A0806",
				"surface-darken-2": "#000000",
				"surface-darken-3": "#000000",
				"surface-lighten-1": "#2B2A29",
				"surface-lighten-2": "#3B3A39",
				"surface-lighten-3": "#4D4B4A",
				"text": "#FFFFFFDD",
				"text-accent": "#BDA4DA",
				"text-disabled": "#FFFFFF60",
				"text-error": "#CA7671",
				"text-muted": "#FFFFFF99",
				"text-primary": "#6B94C4",
				"text-secondary": "#6EADA7",
				"text-success": "#9AAB5D",
				"text-warning": "#C8AD57",
				"warning": "#AC8301",
				"warning-darken-1": "#977000",
				"warning-darken-2": "#815D00",
				"warning-darken-3": "#6C4C00",
				"warning-lighten-1": "#C39621",
				"warning-lighten-2": "#D9AA37",
				"warning-lighten-3": "#F0BE4B",
				"warning-muted": "#3F310A"
			}
		},
		"gruvbox": {
			name: "gruvbox",
			dark: true,
			ansi: {
				black: "#282828",
				red: "#CC241D",
				green: "#98971A",
				yellow: "#D79921",
				blue: "#458588",
				magenta: "#B16286",
				cyan: "#689D6A",
				white: "#A89984",
				brightBlack: "#928374",
				brightRed: "#FB4934",
				brightGreen: "#B8BB26",
				brightYellow: "#FABD2F",
				brightBlue: "#83A598",
				brightMagenta: "#D3869B",
				brightCyan: "#8EC07C",
				brightWhite: "#EBDBB2"
			},
			vars: {
				"accent": "#F9BD2F",
				"accent-darken-1": "#E2A811",
				"accent-darken-2": "#CB9400",
				"accent-darken-3": "#B48100",
				"accent-lighten-1": "#FFD146",
				"accent-lighten-2": "#FFE65B",
				"accent-lighten-3": "#FFFC70",
				"accent-muted": "#67542A",
				"background": "#282828",
				"background-darken-1": "#181818",
				"background-darken-2": "#040404",
				"background-darken-3": "#000000",
				"background-lighten-1": "#383838",
				"background-lighten-2": "#494949",
				"background-lighten-3": "#5A5A5A",
				"block-cursor-background": "#85A598",
				"block-cursor-blurred-background": "#85A5984C",
				"block-cursor-blurred-foreground": "#FBF1C7",
				"block-cursor-foreground": "#FBF1C7",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#85A598",
				"border-blurred": "#363230",
				"button-color-foreground": "#282828",
				"button-foreground": "#FBF1C7",
				"error": "#FA4934",
				"error-darken-1": "#E23022",
				"error-darken-2": "#C90D10",
				"error-darken-3": "#B10000",
				"error-lighten-1": "#FF5F45",
				"error-lighten-2": "#FF7558",
				"error-lighten-3": "#FF8B6B",
				"error-muted": "#67312B",
				"footer-background": "#504945",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#FBF1C7",
				"footer-foreground": "#FBF1C7",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#FABD2F",
				"foreground": "#FBF1C7",
				"foreground-darken-1": "#E5DBB2",
				"foreground-darken-2": "#D0C69E",
				"foreground-darken-3": "#BBB28A",
				"foreground-disabled": "#FBF1C760",
				"foreground-lighten-1": "#FFFFDC",
				"foreground-lighten-2": "#FFFFF1",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#FBF1C799",
				"input-cursor-background": "#FBF1C7",
				"input-cursor-foreground": "#282828",
				"input-selection-background": "#689D6A40",
				"link-background": "#00000000",
				"link-background-hover": "#85A598",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#85A598",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#85A598",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#85A598",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#FBF1C7",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#FBF1C7",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#FBF1C799",
				"panel": "#504945",
				"panel-darken-1": "#3E3834",
				"panel-darken-2": "#2E2724",
				"panel-darken-3": "#1E1815",
				"panel-lighten-1": "#615A56",
				"panel-lighten-2": "#746C68",
				"panel-lighten-3": "#877F7B",
				"primary": "#85A598",
				"primary-background": "#535755",
				"primary-background-darken-1": "#444846",
				"primary-background-darken-2": "#353A38",
				"primary-background-darken-3": "#353A38",
				"primary-background-lighten-1": "#626664",
				"primary-background-lighten-2": "#717573",
				"primary-background-lighten-3": "#808382",
				"primary-darken-1": "#719184",
				"primary-darken-2": "#5F7D71",
				"primary-darken-3": "#4C6A5F",
				"primary-lighten-1": "#98B9AB",
				"primary-lighten-2": "#ACCEC0",
				"primary-lighten-3": "#C1E3D5",
				"primary-muted": "#434D49",
				"scrollbar": "#43504B",
				"scrollbar-active": "#85A598",
				"scrollbar-background": "#181818",
				"scrollbar-background-active": "#181818",
				"scrollbar-background-hover": "#181818",
				"scrollbar-corner-color": "#181818",
				"scrollbar-hover": "#4E5E58",
				"secondary": "#A89A85",
				"secondary-background": "#585653",
				"secondary-background-darken-1": "#494744",
				"secondary-background-darken-2": "#3B3935",
				"secondary-background-darken-3": "#3B3935",
				"secondary-background-lighten-1": "#676562",
				"secondary-background-lighten-2": "#757471",
				"secondary-background-lighten-3": "#848380",
				"secondary-darken-1": "#938671",
				"secondary-darken-2": "#80735F",
				"secondary-darken-3": "#6D604D",
				"secondary-lighten-1": "#BCAE98",
				"secondary-lighten-2": "#D1C2AC",
				"secondary-lighten-3": "#E6D7C1",
				"secondary-muted": "#4E4A43",
				"success": "#B7BB26",
				"success-darken-1": "#A2A601",
				"success-darken-2": "#8C9300",
				"success-darken-3": "#777F00",
				"success-lighten-1": "#CDCF3D",
				"success-lighten-2": "#E4E453",
				"success-lighten-3": "#FAFA68",
				"success-muted": "#535427",
				"surface": "#3C3836",
				"surface-active": "#494543",
				"surface-darken-1": "#2B2725",
				"surface-darken-2": "#1C1816",
				"surface-darken-3": "#0A0300",
				"surface-lighten-1": "#4D4846",
				"surface-lighten-2": "#5F5A58",
				"surface-lighten-3": "#716C6A",
				"text": "#FFFFFFDD",
				"text-accent": "#FBD375",
				"text-disabled": "#FFFFFF60",
				"text-error": "#FC8679",
				"text-muted": "#FFFFFF99",
				"text-primary": "#AEC3BB",
				"text-secondary": "#C5BCAE",
				"text-success": "#D0D26F",
				"text-warning": "#FEAB67",
				"warning": "#FD8019",
				"warning-darken-1": "#E56C00",
				"warning-darken-2": "#CD5800",
				"warning-darken-3": "#B54500",
				"warning-lighten-1": "#FF9430",
				"warning-lighten-2": "#FFA845",
				"warning-lighten-3": "#FFBD5A",
				"warning-muted": "#684223"
			}
		},
		"monokai": {
			name: "monokai",
			dark: true,
			ansi: {
				black: "#333333",
				red: "#C4265E",
				green: "#86B42B",
				yellow: "#B3B42B",
				blue: "#6A7EC8",
				magenta: "#8C6BC8",
				cyan: "#56ADBC",
				white: "#E3E3DD",
				brightBlack: "#666666",
				brightRed: "#F92672",
				brightGreen: "#A6E22E",
				brightYellow: "#E2E22E",
				brightBlue: "#819AFF",
				brightMagenta: "#AE81FF",
				brightCyan: "#66D9EF",
				brightWhite: "#F8F8F2"
			},
			vars: {
				"accent": "#66D9EF",
				"accent-darken-1": "#4DC3D9",
				"accent-darken-2": "#31AFC4",
				"accent-darken-3": "#009BB0",
				"accent-lighten-1": "#7DEEFF",
				"accent-lighten-2": "#94FFFF",
				"accent-lighten-3": "#AAFFFF",
				"accent-muted": "#395D5F",
				"background": "#272822",
				"background-darken-1": "#171812",
				"background-darken-2": "#020400",
				"background-darken-3": "#000000",
				"background-lighten-1": "#373831",
				"background-lighten-2": "#484942",
				"background-lighten-3": "#595A54",
				"block-cursor-background": "#AE81FF",
				"block-cursor-blurred-background": "#AE81FF4C",
				"block-cursor-blurred-foreground": "#D6D6D6",
				"block-cursor-foreground": "#FFFFFFDD",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#AE81FF",
				"border-blurred": "#282828",
				"button-color-foreground": "#272822",
				"button-foreground": "#D6D6D6",
				"error": "#F82672",
				"error-darken-1": "#E1005F",
				"error-darken-2": "#C9004E",
				"error-darken-3": "#B1003D",
				"error-lighten-1": "#FF4484",
				"error-lighten-2": "#FF5D98",
				"error-lighten-3": "#FF75AC",
				"error-muted": "#66273A",
				"footer-background": "#3E3D32",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#D6D6D6",
				"footer-foreground": "#D6D6D6",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#66D9EF",
				"foreground": "#D6D6D6",
				"foreground-darken-1": "#C1C1C1",
				"foreground-darken-2": "#ACACAC",
				"foreground-darken-3": "#989898",
				"foreground-disabled": "#D6D6D660",
				"foreground-lighten-1": "#EBEBEB",
				"foreground-lighten-2": "#FFFFFF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#797979",
				"input-cursor-background": "#D6D6D6",
				"input-cursor-foreground": "#272822",
				"input-selection-background": "#575B6190",
				"link-background": "#00000000",
				"link-background-hover": "#AE81FF",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#AE81FF",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#AE81FF",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#AE81FF",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#D6D6D6",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#D6D6D6",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#797979",
				"panel": "#3E3D32",
				"panel-darken-1": "#2D2C22",
				"panel-darken-2": "#1D1C12",
				"panel-darken-3": "#0D0B00",
				"panel-lighten-1": "#4F4E42",
				"panel-lighten-2": "#616054",
				"panel-lighten-3": "#737266",
				"primary": "#AE81FF",
				"primary-background": "#58535F",
				"primary-background-darken-1": "#494451",
				"primary-background-darken-2": "#3B3543",
				"primary-background-darken-3": "#3B3543",
				"primary-background-lighten-1": "#67626D",
				"primary-background-lighten-2": "#75717B",
				"primary-background-lighten-3": "#848089",
				"primary-darken-1": "#986DE9",
				"primary-darken-2": "#835AD3",
				"primary-darken-3": "#6E48BE",
				"primary-lighten-1": "#C394FF",
				"primary-lighten-2": "#D9A9FF",
				"primary-lighten-3": "#EFBDFF",
				"primary-muted": "#4F4264",
				"scrollbar": "#534270",
				"scrollbar-active": "#AE81FF",
				"scrollbar-background": "#171812",
				"scrollbar-background-active": "#171812",
				"scrollbar-background-hover": "#171812",
				"scrollbar-corner-color": "#171812",
				"scrollbar-hover": "#624C88",
				"secondary": "#F82672",
				"secondary-background": "#61474D",
				"secondary-background-darken-1": "#53373D",
				"secondary-background-darken-2": "#46272E",
				"secondary-background-darken-3": "#46272E",
				"secondary-background-lighten-1": "#6F575D",
				"secondary-background-lighten-2": "#7D676C",
				"secondary-background-lighten-3": "#8B787C",
				"secondary-darken-1": "#E1005F",
				"secondary-darken-2": "#C9004E",
				"secondary-darken-3": "#B1003D",
				"secondary-lighten-1": "#FF4484",
				"secondary-lighten-2": "#FF5D98",
				"secondary-lighten-3": "#FF75AC",
				"secondary-muted": "#66273A",
				"success": "#A5E22E",
				"success-darken-1": "#90CC09",
				"success-darken-2": "#7AB700",
				"success-darken-3": "#64A300",
				"success-lighten-1": "#BBF746",
				"success-lighten-2": "#D2FF5D",
				"success-lighten-3": "#E8FF72",
				"success-muted": "#4D5F25",
				"surface": "#2E2E2E",
				"surface-active": "#3B3B3B",
				"surface-darken-1": "#1E1E1E",
				"surface-darken-2": "#0D0D0D",
				"surface-darken-3": "#000000",
				"surface-lighten-1": "#3E3E3E",
				"surface-lighten-2": "#4F4F4F",
				"surface-lighten-3": "#616161",
				"text": "#FFFFFFDD",
				"text-accent": "#9AE5F4",
				"text-disabled": "#FFFFFF60",
				"text-error": "#FB6FA1",
				"text-muted": "#FFFFFF99",
				"text-primary": "#C9ABFF",
				"text-secondary": "#FB6FA1",
				"text-success": "#C4EB75",
				"text-warning": "#FDBA6B",
				"warning": "#FC971F",
				"warning-darken-1": "#E58300",
				"warning-darken-2": "#CD6F00",
				"warning-darken-3": "#B65D00",
				"warning-lighten-1": "#FFAB36",
				"warning-lighten-2": "#FFBF4C",
				"warning-lighten-3": "#FFD460",
				"warning-muted": "#674921"
			}
		},
		"nord": {
			name: "nord",
			dark: true,
			ansi: {
				black: "#3B4252",
				red: "#BF616A",
				green: "#A3BE8C",
				yellow: "#EBCB8B",
				blue: "#81A1C1",
				magenta: "#B48EAD",
				cyan: "#88C0D0",
				white: "#E5E9F0",
				brightBlack: "#596377",
				brightRed: "#BF616A",
				brightGreen: "#A3BE8C",
				brightYellow: "#EBCB8B",
				brightBlue: "#81A1C1",
				brightMagenta: "#B48EAD",
				brightCyan: "#8FBCBB",
				brightWhite: "#ECEFF4"
			},
			vars: {
				"accent": "#B48EAD",
				"accent-darken-1": "#9F7A98",
				"accent-darken-2": "#8B6785",
				"accent-darken-3": "#785572",
				"accent-lighten-1": "#C8A1C1",
				"accent-lighten-2": "#DDB6D6",
				"accent-lighten-3": "#F3CAEB",
				"accent-muted": "#564F60",
				"background": "#2E3440",
				"background-darken-1": "#1E242F",
				"background-darken-2": "#0E141F",
				"background-darken-3": "#000010",
				"background-lighten-1": "#3E4451",
				"background-lighten-2": "#505663",
				"background-lighten-3": "#626875",
				"block-cursor-background": "#88C0D0",
				"block-cursor-blurred-background": "#88C0D04C",
				"block-cursor-blurred-foreground": "#D8DEE9",
				"block-cursor-foreground": "#2E3440",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#88C0D0",
				"border-blurred": "#353C4C",
				"button-color-foreground": "#2E3440",
				"button-foreground": "#D8DEE9",
				"error": "#BE616A",
				"error-darken-1": "#A94D57",
				"error-darken-2": "#933A46",
				"error-darken-3": "#7E2735",
				"error-lighten-1": "#D4747C",
				"error-lighten-2": "#EB8890",
				"error-lighten-3": "#FF9CA3",
				"error-muted": "#59414C",
				"footer-background": "#434C5E",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#D8DEE9",
				"footer-foreground": "#D8DEE9",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#88C0D0",
				"foreground": "#D8DEE9",
				"foreground-darken-1": "#C3C9D3",
				"foreground-darken-2": "#AEB4BF",
				"foreground-darken-3": "#9AA0AA",
				"foreground-disabled": "#D8DEE960",
				"foreground-lighten-1": "#EDF3FE",
				"foreground-lighten-2": "#FFFFFF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#D8DEE999",
				"input-cursor-background": "#D8DEE9",
				"input-cursor-foreground": "#2E3440",
				"input-selection-background": "#81A1C159",
				"link-background": "#00000000",
				"link-background-hover": "#88C0D0",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#88C0D0",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#88C0D0",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#88C0D0",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#D8DEE9",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#D8DEE9",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#D8DEE999",
				"panel": "#434C5E",
				"panel-darken-1": "#313A4C",
				"panel-darken-2": "#212A3A",
				"panel-darken-3": "#111B2A",
				"panel-lighten-1": "#545D70",
				"panel-lighten-2": "#677083",
				"panel-lighten-3": "#798396",
				"primary": "#88C0D0",
				"primary-background": "#58646E",
				"primary-background-darken-1": "#495661",
				"primary-background-darken-2": "#3B4955",
				"primary-background-darken-3": "#3B4955",
				"primary-background-lighten-1": "#67717B",
				"primary-background-lighten-2": "#757F88",
				"primary-background-lighten-3": "#848D94",
				"primary-darken-1": "#73ABBB",
				"primary-darken-2": "#5F97A6",
				"primary-darken-3": "#4B8393",
				"primary-lighten-1": "#9CD4E5",
				"primary-lighten-2": "#B1EAFA",
				"primary-lighten-3": "#C6FFFF",
				"primary-muted": "#495E6B",
				"scrollbar": "#48626F",
				"scrollbar-active": "#88C0D0",
				"scrollbar-background": "#1E242F",
				"scrollbar-background-active": "#1E242F",
				"scrollbar-background-hover": "#1E242F",
				"scrollbar-corner-color": "#1E242F",
				"scrollbar-hover": "#53727F",
				"secondary": "#81A1C1",
				"secondary-background": "#57606C",
				"secondary-background-darken-1": "#48525F",
				"secondary-background-darken-2": "#3A4453",
				"secondary-background-darken-3": "#3A4453",
				"secondary-background-lighten-1": "#666E79",
				"secondary-background-lighten-2": "#757C86",
				"secondary-background-lighten-3": "#838A93",
				"secondary-darken-1": "#6D8DAC",
				"secondary-darken-2": "#597A98",
				"secondary-darken-3": "#466784",
				"secondary-lighten-1": "#95B5D5",
				"secondary-lighten-2": "#A9C9EB",
				"secondary-lighten-3": "#BEDEFF",
				"secondary-muted": "#465466",
				"success": "#A3BE8C",
				"success-darken-1": "#8FA978",
				"success-darken-2": "#7B9565",
				"success-darken-3": "#688253",
				"success-lighten-1": "#B7D29F",
				"success-lighten-2": "#CCE8B4",
				"success-lighten-3": "#E1FDC8",
				"success-muted": "#515D56",
				"surface": "#3B4252",
				"surface-active": "#484F60",
				"surface-darken-1": "#2A3140",
				"surface-darken-2": "#1A212F",
				"surface-darken-3": "#0A1120",
				"surface-lighten-1": "#4C5364",
				"surface-lighten-2": "#5E6576",
				"surface-lighten-3": "#707889",
				"text": "#FFFFFFDD",
				"text-accent": "#CDB4C8",
				"text-disabled": "#FFFFFF60",
				"text-error": "#D4969C",
				"text-muted": "#FFFFFF99",
				"text-primary": "#B0D5DF",
				"text-secondary": "#ABC0D6",
				"text-success": "#C2D4B3",
				"text-warning": "#F1DCB2",
				"warning": "#EACB8B",
				"warning-darken-1": "#D5B677",
				"warning-darken-2": "#BFA264",
				"warning-darken-3": "#AA8E51",
				"warning-lighten-1": "#FFE09E",
				"warning-lighten-2": "#FFF5B3",
				"warning-lighten-3": "#FFFFC8",
				"warning-muted": "#666156"
			}
		},
		"rose-pine": {
			name: "rose-pine",
			dark: true,
			ansi: {
				black: "#26233A",
				red: "#EB6F92",
				green: "#31748F",
				yellow: "#F6C177",
				blue: "#9CCFD8",
				magenta: "#C4A7E7",
				cyan: "#EBBCBA",
				white: "#E0DEF4",
				brightBlack: "#6E6A86",
				brightRed: "#EB6F92",
				brightGreen: "#31748F",
				brightYellow: "#F6C177",
				brightBlue: "#9CCFD8",
				brightMagenta: "#C4A7E7",
				brightCyan: "#EBBCBA",
				brightWhite: "#E0DEF4"
			},
			vars: {
				"accent": "#EBBCBA",
				"accent-darken-1": "#D5A7A5",
				"accent-darken-2": "#C09391",
				"accent-darken-3": "#AB807E",
				"accent-lighten-1": "#FFD0CE",
				"accent-lighten-2": "#FFE5E3",
				"accent-lighten-3": "#FFFBF9",
				"accent-muted": "#584851",
				"background": "#191724",
				"background-darken-1": "#060015",
				"background-darken-2": "#000000",
				"background-darken-3": "#000000",
				"background-lighten-1": "#282634",
				"background-lighten-2": "#383644",
				"background-lighten-3": "#4A4756",
				"block-cursor-background": "#C4A7E7",
				"block-cursor-blurred-background": "#C4A7E74C",
				"block-cursor-blurred-foreground": "#E0DEF4",
				"block-cursor-foreground": "#191724",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#524F67",
				"border-blurred": "#6E6A86",
				"button-color-foreground": "#FFFFFFDD",
				"button-foreground": "#E0DEF4",
				"error": "#EA6F92",
				"error-darken-1": "#D45A7E",
				"error-darken-2": "#BE466B",
				"error-darken-3": "#A83159",
				"error-lighten-1": "#FF83A5",
				"error-lighten-2": "#FF98BA",
				"error-lighten-3": "#FFADCE",
				"error-muted": "#583145",
				"footer-background": "#26233A",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#E0DEF4",
				"footer-foreground": "#E0DEF4",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#EBBCBA",
				"foreground": "#E0DEF4",
				"foreground-darken-1": "#CAC9DE",
				"foreground-darken-2": "#B6B4C9",
				"foreground-darken-3": "#A2A0B4",
				"foreground-disabled": "#E0DEF460",
				"foreground-lighten-1": "#F5F3FF",
				"foreground-lighten-2": "#FFFFFF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#E0DEF499",
				"input-cursor-background": "#F4EDE8",
				"input-cursor-foreground": "#191724",
				"input-selection-background": "#403D52",
				"link-background": "#00000000",
				"link-background-hover": "#C4A7E7",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#C4A7E7",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#C4A7E7",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#C4A7E7",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#E0DEF4",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#E0DEF4",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#E0DEF499",
				"panel": "#26233A",
				"panel-darken-1": "#161329",
				"panel-darken-2": "#04001A",
				"panel-darken-3": "#000008",
				"panel-lighten-1": "#36324B",
				"panel-lighten-2": "#47435D",
				"panel-lighten-3": "#59556F",
				"primary": "#C4A7E7",
				"primary-background": "#504B5D",
				"primary-background-darken-1": "#413B4F",
				"primary-background-darken-2": "#322C41",
				"primary-background-darken-3": "#322C41",
				"primary-background-lighten-1": "#605B6B",
				"primary-background-lighten-2": "#6F6B7A",
				"primary-background-lighten-3": "#7E7B88",
				"primary-darken-1": "#AF93D1",
				"primary-darken-2": "#9A7FBC",
				"primary-darken-3": "#866CA8",
				"primary-lighten-1": "#D9BBFC",
				"primary-lighten-2": "#EED0FF",
				"primary-lighten-3": "#FFE5FF",
				"primary-muted": "#4C425E",
				"scrollbar": "#524269",
				"scrollbar-active": "#C4A7E7",
				"scrollbar-background": "#060015",
				"scrollbar-background-active": "#060015",
				"scrollbar-background-hover": "#060015",
				"scrollbar-corner-color": "#060015",
				"scrollbar-hover": "#65537E",
				"secondary": "#31748F",
				"secondary-background": "#3E4452",
				"secondary-background-darken-1": "#2D3443",
				"secondary-background-darken-2": "#1C2434",
				"secondary-background-darken-3": "#1C2434",
				"secondary-background-lighten-1": "#4F5561",
				"secondary-background-lighten-2": "#606570",
				"secondary-background-lighten-3": "#717680",
				"secondary-darken-1": "#17617B",
				"secondary-darken-2": "#004F68",
				"secondary-darken-3": "#003E56",
				"secondary-lighten-1": "#4687A2",
				"secondary-lighten-2": "#5B9AB7",
				"secondary-lighten-3": "#70AECB",
				"secondary-muted": "#203244",
				"success": "#9CCFD8",
				"success-darken-1": "#87BAC3",
				"success-darken-2": "#73A5AE",
				"success-darken-3": "#60929A",
				"success-lighten-1": "#B0E4ED",
				"success-lighten-2": "#C5F9FF",
				"success-lighten-3": "#DAFFFF",
				"success-muted": "#404E5A",
				"surface": "#1F1D2E",
				"surface-active": "#2B293B",
				"surface-darken-1": "#100B1E",
				"surface-darken-2": "#00000E",
				"surface-darken-3": "#000000",
				"surface-lighten-1": "#2F2C3E",
				"surface-lighten-2": "#3F3D4F",
				"surface-lighten-3": "#514E61",
				"text": "#FFFFFFDD",
				"text-accent": "#F1D2D1",
				"text-disabled": "#FFFFFF60",
				"text-error": "#F19FB7",
				"text-muted": "#FFFFFF99",
				"text-primary": "#D8C4EF",
				"text-secondary": "#77A3B5",
				"text-success": "#BDDFE5",
				"text-warning": "#F9D6A5",
				"warning": "#F5C177",
				"warning-darken-1": "#DFAC63",
				"warning-darken-2": "#C99850",
				"warning-darken-3": "#B3853E",
				"warning-lighten-1": "#FFD58A",
				"warning-lighten-2": "#FFEB9E",
				"warning-lighten-3": "#FFFFB3",
				"warning-muted": "#5B4A3C"
			}
		},
		"rose-pine-dawn": {
			name: "rose-pine-dawn",
			dark: false,
			ansi: {
				black: "#F2E9E1",
				red: "#B4637A",
				green: "#286983",
				yellow: "#EA9D34",
				blue: "#56949F",
				magenta: "#907AA9",
				cyan: "#D7827E",
				white: "#575279",
				brightBlack: "#9893A5",
				brightRed: "#B4637A",
				brightGreen: "#286983",
				brightYellow: "#EA9D34",
				brightBlue: "#56949F",
				brightMagenta: "#907AA9",
				brightCyan: "#D7827E",
				brightWhite: "#575279"
			},
			vars: {
				"accent": "#D6827E",
				"accent-darken-1": "#C16E6B",
				"accent-darken-2": "#AB5B58",
				"accent-darken-3": "#964847",
				"accent-lighten-1": "#ED9591",
				"accent-lighten-2": "#FFAAA5",
				"accent-lighten-3": "#FFBEB9",
				"accent-muted": "#EFD1CB",
				"background": "#FAF4ED",
				"background-darken-1": "#E4DED7",
				"background-darken-2": "#CFC9C2",
				"background-darken-3": "#BAB5AE",
				"background-lighten-1": "#FFFFFF",
				"background-lighten-2": "#FFFFFF",
				"background-lighten-3": "#FFFFFF",
				"block-cursor-background": "#575279",
				"block-cursor-blurred-background": "#907AA94C",
				"block-cursor-blurred-foreground": "#575279",
				"block-cursor-foreground": "#FAF4ED",
				"block-hover-background": "#00000019",
				"boost": "#0000000A",
				"boost-darken-1": "#0000000A",
				"boost-darken-2": "#0000000A",
				"boost-darken-3": "#0000000A",
				"boost-lighten-1": "#1616160A",
				"boost-lighten-2": "#2525250A",
				"boost-lighten-3": "#3535350A",
				"border": "#CECACD",
				"border-blurred": "#9893A5",
				"button-color-foreground": "#000000DD",
				"button-foreground": "#575279",
				"error": "#B4637A",
				"error-darken-1": "#9E5067",
				"error-darken-2": "#8A3D55",
				"error-darken-3": "#752A43",
				"error-lighten-1": "#C9768D",
				"error-lighten-2": "#DF8AA0",
				"error-lighten-3": "#F59EB5",
				"error-muted": "#E5C8CA",
				"footer-background": "#F2E9E1",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#575279",
				"footer-foreground": "#575279",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#D7827E",
				"foreground": "#575279",
				"foreground-darken-1": "#444066",
				"foreground-darken-2": "#332F53",
				"foreground-darken-3": "#222042",
				"foreground-disabled": "#57527960",
				"foreground-lighten-1": "#69648C",
				"foreground-lighten-2": "#7C76A0",
				"foreground-lighten-3": "#9089B4",
				"foreground-muted": "#57527999",
				"input-cursor-background": "#575279",
				"input-cursor-foreground": "#FAF4ED",
				"input-selection-background": "#DFDAD9",
				"link-background": "#00000000",
				"link-background-hover": "#907AA9",
				"link-color": "#000000DD",
				"link-color-hover": "#000000DD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#907AA9",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#907AA9",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#907AA9",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#575279",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#575279",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#57527999",
				"panel": "#F2E9E1",
				"panel-darken-1": "#DCD3CB",
				"panel-darken-2": "#C7BFB7",
				"panel-darken-3": "#B3AAA3",
				"panel-lighten-1": "#FFFEF6",
				"panel-lighten-2": "#FFFFFF",
				"panel-lighten-3": "#FFFFFF",
				"primary": "#907AA9",
				"primary-background": "#907AA9",
				"primary-background-darken-1": "#7C6795",
				"primary-background-darken-2": "#695481",
				"primary-background-darken-3": "#56436E",
				"primary-background-lighten-1": "#A48DBD",
				"primary-background-lighten-2": "#B8A1D2",
				"primary-background-lighten-3": "#CDB5E7",
				"primary-darken-1": "#7C6795",
				"primary-darken-2": "#695481",
				"primary-darken-3": "#56436E",
				"primary-lighten-1": "#A48DBD",
				"primary-lighten-2": "#B8A1D2",
				"primary-lighten-3": "#CDB5E7",
				"primary-muted": "#DACFD8",
				"scrollbar": "#C2B6C4",
				"scrollbar-active": "#907AA9",
				"scrollbar-background": "#E4DED7",
				"scrollbar-background-active": "#E4DED7",
				"scrollbar-background-hover": "#E4DED7",
				"scrollbar-corner-color": "#E4DED7",
				"scrollbar-hover": "#BAACC0",
				"secondary": "#286983",
				"secondary-background": "#286983",
				"secondary-background-darken-1": "#0A566F",
				"secondary-background-darken-2": "#00455D",
				"secondary-background-darken-3": "#00344B",
				"secondary-background-lighten-1": "#3E7B96",
				"secondary-background-lighten-2": "#538FAA",
				"secondary-background-lighten-3": "#67A2BE",
				"secondary-darken-1": "#0A566F",
				"secondary-darken-2": "#00455D",
				"secondary-darken-3": "#00344B",
				"secondary-lighten-1": "#3E7B96",
				"secondary-lighten-2": "#538FAA",
				"secondary-lighten-3": "#67A2BE",
				"secondary-muted": "#BBCACD",
				"success": "#56949F",
				"success-darken-1": "#41808B",
				"success-darken-2": "#2D6D78",
				"success-darken-3": "#155B65",
				"success-lighten-1": "#6AA7B3",
				"success-lighten-2": "#7EBCC7",
				"success-lighten-3": "#92D1DC",
				"success-muted": "#C8D7D5",
				"surface": "#FFFAF3",
				"surface-active": "#FFFFFF",
				"surface-darken-1": "#E9E4DD",
				"surface-darken-2": "#D4CFC8",
				"surface-darken-3": "#BFBAB4",
				"surface-lighten-1": "#FFFFFF",
				"surface-lighten-2": "#FFFFFF",
				"surface-lighten-3": "#FFFFFF",
				"text": "#000000DD",
				"text-accent": "#8D5553",
				"text-disabled": "#00000060",
				"text-error": "#764150",
				"text-muted": "#00000099",
				"text-primary": "#5F506F",
				"text-secondary": "#1A4556",
				"text-success": "#386168",
				"text-warning": "#9A6722",
				"warning": "#E99D34",
				"warning-darken-1": "#D2891D",
				"warning-darken-2": "#BC7600",
				"warning-darken-3": "#A56300",
				"warning-lighten-1": "#FFB148",
				"warning-lighten-2": "#FFC55C",
				"warning-lighten-3": "#FFDA70",
				"warning-muted": "#F5D9B5"
			}
		},
		"rose-pine-moon": {
			name: "rose-pine-moon",
			dark: true,
			ansi: {
				black: "#393552",
				red: "#EB6F92",
				green: "#3E8FB0",
				yellow: "#F6C177",
				blue: "#9CCFD8",
				magenta: "#C4A7E7",
				cyan: "#EA9A97",
				white: "#E0DEF4",
				brightBlack: "#6E6A86",
				brightRed: "#EB6F92",
				brightGreen: "#3E8FB0",
				brightYellow: "#F6C177",
				brightBlue: "#9CCFD8",
				brightMagenta: "#C4A7E7",
				brightCyan: "#EA9A97",
				brightWhite: "#E0DEF4"
			},
			vars: {
				"accent": "#EA9A97",
				"accent-darken-1": "#D48683",
				"accent-darken-2": "#BE7270",
				"accent-darken-3": "#A95F5E",
				"accent-lighten-1": "#FFAEAA",
				"accent-lighten-2": "#FFC3BF",
				"accent-lighten-3": "#FFD8D4",
				"accent-muted": "#5E4553",
				"background": "#232136",
				"background-darken-1": "#131125",
				"background-darken-2": "#000017",
				"background-darken-3": "#000001",
				"background-lighten-1": "#333046",
				"background-lighten-2": "#444158",
				"background-lighten-3": "#56526A",
				"block-cursor-background": "#C4A7E7",
				"block-cursor-blurred-background": "#C4A7E74C",
				"block-cursor-blurred-foreground": "#E0DEF4",
				"block-cursor-foreground": "#232136",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#56526E",
				"border-blurred": "#6E6A86",
				"button-color-foreground": "#FFFFFFDD",
				"button-foreground": "#E0DEF4",
				"error": "#EA6F92",
				"error-darken-1": "#D45A7E",
				"error-darken-2": "#BE466B",
				"error-darken-3": "#A83159",
				"error-lighten-1": "#FF83A5",
				"error-lighten-2": "#FF98BA",
				"error-lighten-3": "#FFADCE",
				"error-muted": "#5F3851",
				"footer-background": "#393552",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#E0DEF4",
				"footer-foreground": "#E0DEF4",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#EA9A97",
				"foreground": "#E0DEF4",
				"foreground-darken-1": "#CAC9DE",
				"foreground-darken-2": "#B6B4C9",
				"foreground-darken-3": "#A2A0B4",
				"foreground-disabled": "#E0DEF460",
				"foreground-lighten-1": "#F5F3FF",
				"foreground-lighten-2": "#FFFFFF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#E0DEF499",
				"input-cursor-background": "#F4EDE8",
				"input-cursor-foreground": "#232136",
				"input-selection-background": "#44415A",
				"link-background": "#00000000",
				"link-background-hover": "#C4A7E7",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#C4A7E7",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#C4A7E7",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#C4A7E7",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#E0DEF4",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#E0DEF4",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#E0DEF499",
				"panel": "#393552",
				"panel-darken-1": "#282440",
				"panel-darken-2": "#17152F",
				"panel-darken-3": "#080020",
				"panel-lighten-1": "#4A4564",
				"panel-lighten-2": "#5C5776",
				"panel-lighten-3": "#6F6989",
				"primary": "#C4A7E7",
				"primary-background": "#58536A",
				"primary-background-darken-1": "#49445D",
				"primary-background-darken-2": "#3B3550",
				"primary-background-darken-3": "#3B3550",
				"primary-background-lighten-1": "#676277",
				"primary-background-lighten-2": "#757184",
				"primary-background-lighten-3": "#848091",
				"primary-darken-1": "#AF93D1",
				"primary-darken-2": "#9A7FBC",
				"primary-darken-3": "#866CA8",
				"primary-lighten-1": "#D9BBFC",
				"primary-lighten-2": "#EED0FF",
				"primary-lighten-3": "#FFE5FF",
				"primary-muted": "#53496B",
				"scrollbar": "#594D72",
				"scrollbar-active": "#C4A7E7",
				"scrollbar-background": "#131125",
				"scrollbar-background-active": "#131125",
				"scrollbar-background-hover": "#131125",
				"scrollbar-corner-color": "#131125",
				"scrollbar-hover": "#6B5C86",
				"secondary": "#3E8FB0",
				"secondary-background": "#474F63",
				"secondary-background-darken-1": "#374055",
				"secondary-background-darken-2": "#273148",
				"secondary-background-darken-3": "#273148",
				"secondary-background-lighten-1": "#575F71",
				"secondary-background-lighten-2": "#676E7E",
				"secondary-background-lighten-3": "#787E8C",
				"secondary-darken-1": "#237B9B",
				"secondary-darken-2": "#006888",
				"secondary-darken-3": "#005674",
				"secondary-lighten-1": "#54A2C4",
				"secondary-lighten-2": "#6AB7D9",
				"secondary-lighten-3": "#80CBEE",
				"secondary-muted": "#2B425A",
				"success": "#9CCFD8",
				"success-darken-1": "#87BAC3",
				"success-darken-2": "#73A5AE",
				"success-darken-3": "#60929A",
				"success-lighten-1": "#B0E4ED",
				"success-lighten-2": "#C5F9FF",
				"success-lighten-3": "#DAFFFF",
				"success-muted": "#475566",
				"surface": "#2A273F",
				"surface-active": "#37334C",
				"surface-darken-1": "#19172E",
				"surface-darken-2": "#0A021E",
				"surface-darken-3": "#00000F",
				"surface-lighten-1": "#3A3750",
				"surface-lighten-2": "#4C4862",
				"surface-lighten-3": "#5E5975",
				"text": "#FFFFFFDD",
				"text-accent": "#F1BCBA",
				"text-disabled": "#FFFFFF60",
				"text-error": "#F19FB7",
				"text-muted": "#FFFFFF99",
				"text-primary": "#D8C4EF",
				"text-secondary": "#7FB5CA",
				"text-success": "#BDDFE5",
				"text-warning": "#F9D6A5",
				"warning": "#F5C177",
				"warning-darken-1": "#DFAC63",
				"warning-darken-2": "#C99850",
				"warning-darken-3": "#B3853E",
				"warning-lighten-1": "#FFD58A",
				"warning-lighten-2": "#FFEB9E",
				"warning-lighten-3": "#FFFFB3",
				"warning-muted": "#625149"
			}
		},
		"solarized-dark": {
			name: "solarized-dark",
			dark: true,
			ansi: {
				black: "#073642",
				red: "#DC322F",
				green: "#859900",
				yellow: "#B58900",
				blue: "#268BD2",
				magenta: "#D33682",
				cyan: "#2AA198",
				white: "#EEE8D5",
				brightBlack: "#335E69",
				brightRed: "#CB4B16",
				brightGreen: "#586E75",
				brightYellow: "#657B83",
				brightBlue: "#839496",
				brightMagenta: "#6C71C4",
				brightCyan: "#93A1A1",
				brightWhite: "#FDF6E3"
			},
			vars: {
				"accent": "#6C71C4",
				"accent-darken-1": "#575EAF",
				"accent-darken-2": "#424C9A",
				"accent-darken-3": "#2D3B87",
				"accent-lighten-1": "#8083D9",
				"accent-lighten-2": "#9597EE",
				"accent-lighten-3": "#AAABFF",
				"accent-muted": "#204060",
				"background": "#002B36",
				"background-darken-1": "#001B25",
				"background-darken-2": "#000A17",
				"background-darken-3": "#000000",
				"background-lighten-1": "#143B46",
				"background-lighten-2": "#274C58",
				"background-lighten-3": "#3A5E6A",
				"block-cursor-background": "#268BD2",
				"block-cursor-blurred-background": "#268BD24C",
				"block-cursor-blurred-foreground": "#839496",
				"block-cursor-foreground": "#FFFFFFDD",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#268BD2",
				"border-blurred": "#00303C",
				"button-color-foreground": "#FDF6E3",
				"button-foreground": "#839496",
				"error": "#DB322F",
				"error-darken-1": "#C3121E",
				"error-darken-2": "#AB000D",
				"error-darken-3": "#940000",
				"error-lighten-1": "#F44940",
				"error-lighten-2": "#FF6052",
				"error-lighten-3": "#FF7564",
				"error-muted": "#422D33",
				"footer-background": "#268BD2",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#FDF6E3",
				"footer-foreground": "#839496",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#FDF6E3",
				"foreground": "#839496",
				"foreground-darken-1": "#6F8082",
				"foreground-darken-2": "#5D6D6F",
				"foreground-darken-3": "#4B5B5D",
				"foreground-disabled": "#83949660",
				"foreground-lighten-1": "#96A7A9",
				"foreground-lighten-2": "#AABCBE",
				"foreground-lighten-3": "#BED0D3",
				"foreground-muted": "#83949699",
				"input-cursor-background": "#839496",
				"input-cursor-foreground": "#002B36",
				"input-selection-background": "#073642",
				"link-background": "#00000000",
				"link-background-hover": "#268BD2",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#268BD2",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#268BD2",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#268BD2",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#839496",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#839496",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#83949699",
				"panel": "#073642",
				"panel-darken-1": "#002531",
				"panel-darken-2": "#001721",
				"panel-darken-3": "#000112",
				"panel-lighten-1": "#1D4653",
				"panel-lighten-2": "#305865",
				"panel-lighten-3": "#436A78",
				"primary": "#268BD2",
				"primary-background": "#2A5667",
				"primary-background-darken-1": "#17475A",
				"primary-background-darken-2": "#05394D",
				"primary-background-darken-3": "#05394D",
				"primary-background-lighten-1": "#3D6575",
				"primary-background-lighten-2": "#507482",
				"primary-background-lighten-3": "#62838F",
				"primary-darken-1": "#0077BD",
				"primary-darken-2": "#0065A8",
				"primary-darken-3": "#005394",
				"primary-lighten-1": "#459EE7",
				"primary-lighten-2": "#5FB2FD",
				"primary-lighten-3": "#77C7FF",
				"primary-muted": "#0B4764",
				"scrollbar": "#0F476A",
				"scrollbar-active": "#268BD2",
				"scrollbar-background": "#001B25",
				"scrollbar-background-active": "#001B25",
				"scrollbar-background-hover": "#001B25",
				"scrollbar-corner-color": "#001B25",
				"scrollbar-hover": "#13537B",
				"secondary": "#2AA198",
				"secondary-background": "#2B5960",
				"secondary-background-darken-1": "#184A52",
				"secondary-background-darken-2": "#063C44",
				"secondary-background-darken-3": "#063C44",
				"secondary-background-lighten-1": "#3E676E",
				"secondary-background-lighten-2": "#50767C",
				"secondary-background-lighten-3": "#63858A",
				"secondary-darken-1": "#008C84",
				"secondary-darken-2": "#007971",
				"secondary-darken-3": "#00665F",
				"secondary-lighten-1": "#44B5AB",
				"secondary-lighten-2": "#5BCAC0",
				"secondary-lighten-3": "#72DFD5",
				"secondary-muted": "#0C4E53",
				"success": "#849900",
				"success-darken-1": "#708500",
				"success-darken-2": "#5B7200",
				"success-darken-3": "#485F00",
				"success-lighten-1": "#99AC22",
				"success-lighten-2": "#AFC139",
				"success-lighten-3": "#C4D64E",
				"success-muted": "#274C25",
				"surface": "#073642",
				"surface-active": "#19434F",
				"surface-darken-1": "#002531",
				"surface-darken-2": "#001721",
				"surface-darken-3": "#000112",
				"surface-lighten-1": "#1D4653",
				"surface-lighten-2": "#305865",
				"surface-lighten-3": "#436A78",
				"text": "#FFFFFFDD",
				"text-accent": "#9DA1D8",
				"text-disabled": "#FFFFFF60",
				"text-error": "#E77775",
				"text-muted": "#FFFFFF99",
				"text-primary": "#6FB2E1",
				"text-secondary": "#72C0BB",
				"text-success": "#AEBB56",
				"text-warning": "#DC8865",
				"warning": "#CA4B16",
				"warning-darken-1": "#B33600",
				"warning-darken-2": "#9C2000",
				"warning-darken-3": "#850100",
				"warning-lighten-1": "#E25F29",
				"warning-lighten-2": "#FA733C",
				"warning-lighten-3": "#FF874E",
				"warning-muted": "#3C342C"
			}
		},
		"solarized-light": {
			name: "solarized-light",
			dark: false,
			ansi: {
				black: "#073642",
				red: "#DC322F",
				green: "#859900",
				yellow: "#B58900",
				blue: "#268BD2",
				magenta: "#D33682",
				cyan: "#2AA198",
				white: "#BBB5A2",
				brightBlack: "#002B36",
				brightRed: "#CB4B16",
				brightGreen: "#586E75",
				brightYellow: "#657B83",
				brightBlue: "#839496",
				brightMagenta: "#6C71C4",
				brightCyan: "#93A1A1",
				brightWhite: "#FDF6E3"
			},
			vars: {
				"accent": "#6C71C4",
				"accent-darken-1": "#575EAF",
				"accent-darken-2": "#424C9A",
				"accent-darken-3": "#2D3B87",
				"accent-lighten-1": "#8083D9",
				"accent-lighten-2": "#9597EE",
				"accent-lighten-3": "#AAABFF",
				"accent-muted": "#D1CED9",
				"background": "#FDF6E3",
				"background-darken-1": "#E7E0CD",
				"background-darken-2": "#D2CBB9",
				"background-darken-3": "#BDB6A4",
				"background-lighten-1": "#FFFFF8",
				"background-lighten-2": "#FFFFFF",
				"background-lighten-3": "#FFFFFF",
				"block-cursor-background": "#268BD2",
				"block-cursor-blurred-background": "#268BD24C",
				"block-cursor-blurred-foreground": "#586E75",
				"block-cursor-foreground": "#000000DD",
				"block-hover-background": "#00000019",
				"boost": "#0000000A",
				"boost-darken-1": "#0000000A",
				"boost-darken-2": "#0000000A",
				"boost-darken-3": "#0000000A",
				"boost-lighten-1": "#1616160A",
				"boost-lighten-2": "#2525250A",
				"boost-lighten-3": "#3535350A",
				"border": "#268BD2",
				"border-blurred": "#E6E0CE",
				"button-color-foreground": "#FDF6E3",
				"button-foreground": "#586E75",
				"error": "#DB322F",
				"error-darken-1": "#C3121E",
				"error-darken-2": "#AB000D",
				"error-darken-3": "#940000",
				"error-lighten-1": "#F44940",
				"error-lighten-2": "#FF6052",
				"error-lighten-3": "#FF7564",
				"error-muted": "#F3BBAD",
				"footer-background": "#268BD2",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#FDF6E3",
				"footer-foreground": "#586E75",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#FDF6E3",
				"foreground": "#586E75",
				"foreground-darken-1": "#465B62",
				"foreground-darken-2": "#344950",
				"foreground-darken-3": "#23383F",
				"foreground-disabled": "#586E7560",
				"foreground-lighten-1": "#6A8088",
				"foreground-lighten-2": "#7D949B",
				"foreground-lighten-3": "#91A8AF",
				"foreground-muted": "#586E7599",
				"input-cursor-background": "#586E75",
				"input-cursor-foreground": "#FDF6E3",
				"input-selection-background": "#459EE766",
				"link-background": "#00000000",
				"link-background-hover": "#268BD2",
				"link-color": "#000000DD",
				"link-color-hover": "#000000DD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#268BD2",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#268BD2",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#268BD2",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#586E75",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#586E75",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#586E7599",
				"panel": "#EEE8D5",
				"panel-darken-1": "#D8D2C0",
				"panel-darken-2": "#C3BEAB",
				"panel-darken-3": "#AFA997",
				"panel-lighten-1": "#FFFDEA",
				"panel-lighten-2": "#FFFFFF",
				"panel-lighten-3": "#FFFFFF",
				"primary": "#268BD2",
				"primary-background": "#268BD2",
				"primary-background-darken-1": "#0077BD",
				"primary-background-darken-2": "#0065A8",
				"primary-background-darken-3": "#005394",
				"primary-background-lighten-1": "#459EE7",
				"primary-background-lighten-2": "#5FB2FD",
				"primary-background-lighten-3": "#77C7FF",
				"primary-darken-1": "#0077BD",
				"primary-darken-2": "#0065A8",
				"primary-darken-3": "#005394",
				"primary-lighten-1": "#459EE7",
				"primary-lighten-2": "#5FB2FD",
				"primary-lighten-3": "#77C7FF",
				"primary-muted": "#BCD5DD",
				"scrollbar": "#99BECF",
				"scrollbar-active": "#268BD2",
				"scrollbar-background": "#E7E0CD",
				"scrollbar-background-active": "#E7E0CD",
				"scrollbar-background-hover": "#E7E0CD",
				"scrollbar-corner-color": "#E7E0CD",
				"scrollbar-hover": "#86B5CF",
				"secondary": "#2AA198",
				"secondary-background": "#2AA198",
				"secondary-background-darken-1": "#008C84",
				"secondary-background-darken-2": "#007971",
				"secondary-background-darken-3": "#00665F",
				"secondary-background-lighten-1": "#44B5AB",
				"secondary-background-lighten-2": "#5BCAC0",
				"secondary-background-lighten-3": "#72DFD5",
				"secondary-darken-1": "#008C84",
				"secondary-darken-2": "#007971",
				"secondary-darken-3": "#00665F",
				"secondary-lighten-1": "#44B5AB",
				"secondary-lighten-2": "#5BCAC0",
				"secondary-lighten-3": "#72DFD5",
				"secondary-muted": "#BDDCCC",
				"success": "#849900",
				"success-darken-1": "#708500",
				"success-darken-2": "#5B7200",
				"success-darken-3": "#485F00",
				"success-lighten-1": "#99AC22",
				"success-lighten-2": "#AFC139",
				"success-lighten-3": "#C4D64E",
				"success-muted": "#D9DA9E",
				"surface": "#EEE8D5",
				"surface-active": "#FFF9E5",
				"surface-darken-1": "#D8D2C0",
				"surface-darken-2": "#C3BEAB",
				"surface-darken-3": "#AFA997",
				"surface-lighten-1": "#FFFDEA",
				"surface-lighten-2": "#FFFFFF",
				"surface-lighten-3": "#FFFFFF",
				"text": "#000000DD",
				"text-accent": "#474A81",
				"text-disabled": "#00000060",
				"text-error": "#91211F",
				"text-muted": "#00000099",
				"text-primary": "#195B8A",
				"text-secondary": "#1B6A64",
				"text-success": "#576400",
				"text-warning": "#85310E",
				"warning": "#CA4B16",
				"warning-darken-1": "#B33600",
				"warning-darken-2": "#9C2000",
				"warning-darken-3": "#850100",
				"warning-lighten-1": "#E25F29",
				"warning-lighten-2": "#FA733C",
				"warning-lighten-3": "#FF874E",
				"warning-muted": "#EEC2A5"
			}
		},
		"svg-export": {
			name: "svg-export",
			dark: true,
			ansi: {
				black: "#4B4E55",
				red: "#CC555A",
				green: "#98A84B",
				yellow: "#D0B344",
				blue: "#608AB1",
				magenta: "#98729F",
				cyan: "#68A0B3",
				white: "#C5C8C6",
				brightBlack: "#9A9B99",
				brightRed: "#FF2627",
				brightGreen: "#00823D",
				brightYellow: "#D08442",
				brightBlue: "#1984E9",
				brightMagenta: "#FF2C7A",
				brightCyan: "#398280",
				brightWhite: "#FDFDC5"
			},
			vars: {
				"accent": "#56B6C2",
				"accent-darken-1": "#3EA1AD",
				"accent-darken-2": "#238D99",
				"accent-darken-3": "#007A85",
				"accent-lighten-1": "#6CCAD6",
				"accent-lighten-2": "#81DFEC",
				"accent-lighten-3": "#97F5FF",
				"accent-muted": "#365356",
				"background": "#292929",
				"background-darken-1": "#191919",
				"background-darken-2": "#050505",
				"background-darken-3": "#000000",
				"background-lighten-1": "#393939",
				"background-lighten-2": "#4A4A4A",
				"background-lighten-3": "#5C5C5C",
				"block-cursor-background": "#61AFEF",
				"block-cursor-blurred-background": "#61AFEF4C",
				"block-cursor-blurred-foreground": "#C5C8C6",
				"block-cursor-foreground": "#FFFFFFDD",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#61AFEF",
				"border-blurred": "#191919",
				"button-color-foreground": "#FFFFFFDD",
				"button-foreground": "#C5C8C6",
				"error": "#CB555A",
				"error-darken-1": "#B54048",
				"error-darken-2": "#9F2C37",
				"error-darken-3": "#891427",
				"error-lighten-1": "#E2686C",
				"error-lighten-2": "#F97D7F",
				"error-lighten-3": "#FF9192",
				"error-muted": "#593637",
				"footer-background": "#2C343A",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#C5C8C6",
				"footer-foreground": "#C5C8C6",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#56B6C2",
				"foreground": "#C5C8C6",
				"foreground-darken-1": "#B0B3B1",
				"foreground-darken-2": "#9C9F9D",
				"foreground-darken-3": "#888B89",
				"foreground-disabled": "#C5C8C660",
				"foreground-lighten-1": "#D9DCDA",
				"foreground-lighten-2": "#EFF2F0",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#C5C8C699",
				"input-cursor-background": "#C5C8C6",
				"input-cursor-foreground": "#292929",
				"input-selection-background": "#77C3FF66",
				"link-background": "#00000000",
				"link-background-hover": "#61AFEF",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#61AFEF",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#61AFEF",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#61AFEF",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#C5C8C6",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#C5C8C6",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#C5C8C699",
				"panel": "#2C343A",
				"panel-darken-1": "#1C2429",
				"panel-darken-2": "#0C141A",
				"panel-darken-3": "#000007",
				"panel-lighten-1": "#3C444B",
				"panel-lighten-2": "#4D565C",
				"panel-lighten-3": "#5F686F",
				"primary": "#61AFEF",
				"primary-background": "#4F5A61",
				"primary-background-darken-1": "#404B53",
				"primary-background-darken-2": "#313D46",
				"primary-background-darken-3": "#313D46",
				"primary-background-lighten-1": "#5F686F",
				"primary-background-lighten-2": "#6E777D",
				"primary-background-lighten-3": "#7E858B",
				"primary-darken-1": "#489BD9",
				"primary-darken-2": "#2C87C4",
				"primary-darken-3": "#0074AF",
				"primary-lighten-1": "#77C3FF",
				"primary-lighten-2": "#8ED8FF",
				"primary-lighten-3": "#A4EDFF",
				"primary-muted": "#395164",
				"scrollbar": "#35556E",
				"scrollbar-active": "#61AFEF",
				"scrollbar-background": "#191919",
				"scrollbar-background-active": "#191919",
				"scrollbar-background-hover": "#191919",
				"scrollbar-corner-color": "#191919",
				"scrollbar-hover": "#3D6484",
				"secondary": "#C678DD",
				"secondary-background": "#5C5260",
				"secondary-background-darken-1": "#4E4352",
				"secondary-background-darken-2": "#403444",
				"secondary-background-darken-3": "#403444",
				"secondary-background-lighten-1": "#6A616E",
				"secondary-background-lighten-2": "#79707C",
				"secondary-background-lighten-3": "#87808A",
				"secondary-darken-1": "#B064C7",
				"secondary-darken-2": "#9B50B3",
				"secondary-darken-3": "#873D9E",
				"secondary-lighten-1": "#DB8CF2",
				"secondary-lighten-2": "#F1A0FF",
				"secondary-lighten-3": "#FFB5FF",
				"secondary-muted": "#58405F",
				"success": "#98C379",
				"success-darken-1": "#83AE65",
				"success-darken-2": "#709A53",
				"success-darken-3": "#5C8641",
				"success-lighten-1": "#ACD78C",
				"success-lighten-2": "#C1EDA0",
				"success-lighten-3": "#D6FFB4",
				"success-muted": "#4A5741",
				"surface": "#1E1E1E",
				"surface-active": "#2A2A2A",
				"surface-darken-1": "#0D0D0D",
				"surface-darken-2": "#000000",
				"surface-darken-3": "#000000",
				"surface-lighten-1": "#2D2D2D",
				"surface-lighten-2": "#3E3E3E",
				"surface-lighten-3": "#4F4F4F",
				"text": "#FFFFFFDD",
				"text-accent": "#8FCED6",
				"text-disabled": "#FFFFFF60",
				"text-error": "#DD8E92",
				"text-muted": "#FFFFFF99",
				"text-primary": "#96CAF4",
				"text-secondary": "#D9A5E8",
				"text-success": "#BBD7A6",
				"text-warning": "#EDD5A7",
				"warning": "#E4C07B",
				"warning-darken-1": "#CFAB67",
				"warning-darken-2": "#B99754",
				"warning-darken-3": "#A48442",
				"warning-lighten-1": "#FBD48E",
				"warning-lighten-2": "#FFE9A2",
				"warning-lighten-3": "#FFFFB7",
				"warning-muted": "#615641"
			}
		},
		"textual-ansi": {
			name: "textual-ansi",
			dark: true,
			ansi: VGA_ANSI,
			vars: {
				"accent": "#0000FF",
				"accent-darken-1": "#0000FF",
				"accent-darken-2": "#0000FF",
				"accent-darken-3": "#0000FF",
				"accent-lighten-1": "#0000FF",
				"accent-lighten-2": "#0000FF",
				"accent-lighten-3": "#0000FF",
				"accent-muted": "#0178D4",
				"background": "#121212",
				"background-darken-1": "#121212",
				"background-darken-2": "#121212",
				"background-darken-3": "#121212",
				"background-lighten-1": "#121212",
				"background-lighten-2": "#121212",
				"background-lighten-3": "#121212",
				"block-cursor-background": "#000080",
				"block-cursor-blurred-background": "#0000804C",
				"block-cursor-blurred-foreground": "#E0E0E0",
				"block-cursor-foreground": "#E0E0E0",
				"block-hover-background": "#00000019",
				"boost": "#0178D4",
				"boost-darken-1": "#0178D4",
				"boost-darken-2": "#0178D4",
				"boost-darken-3": "#0178D4",
				"boost-lighten-1": "#0178D4",
				"boost-lighten-2": "#0178D4",
				"boost-lighten-3": "#0178D4",
				"border": "#0000FF",
				"border-blurred": "#000080",
				"button-color-foreground": "#E0E0E0",
				"button-foreground": "#E0E0E0",
				"error": "#800000",
				"error-darken-1": "#800000",
				"error-darken-2": "#800000",
				"error-darken-3": "#800000",
				"error-lighten-1": "#800000",
				"error-lighten-2": "#800000",
				"error-lighten-3": "#800000",
				"error-muted": "#0178D4",
				"footer-background": "#121212",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#E0E0E0",
				"footer-foreground": "#E0E0E0",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#0000FF",
				"foreground": "#E0E0E0",
				"foreground-darken-1": "#E0E0E0",
				"foreground-darken-2": "#E0E0E0",
				"foreground-darken-3": "#E0E0E0",
				"foreground-disabled": "#00000060",
				"foreground-lighten-1": "#E0E0E0",
				"foreground-lighten-2": "#E0E0E0",
				"foreground-lighten-3": "#E0E0E0",
				"foreground-muted": "#00000099",
				"input-cursor-background": "#121212",
				"input-cursor-foreground": "#E0E0E0",
				"input-selection-background": "#000080",
				"link-background": "#00000000",
				"link-background-hover": "#000080",
				"link-color": "#E0E0E0",
				"link-color-hover": "#0178D4",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#000080",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#000080",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#000080",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#E0E0E0",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#E0E0E0",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#00000099",
				"panel": "#121212",
				"panel-darken-1": "#121212",
				"panel-darken-2": "#121212",
				"panel-darken-3": "#121212",
				"panel-lighten-1": "#121212",
				"panel-lighten-2": "#121212",
				"panel-lighten-3": "#121212",
				"primary": "#000080",
				"primary-background": "#000080",
				"primary-background-darken-1": "#000080",
				"primary-background-darken-2": "#000080",
				"primary-background-darken-3": "#000080",
				"primary-background-lighten-1": "#000080",
				"primary-background-lighten-2": "#000080",
				"primary-background-lighten-3": "#000080",
				"primary-darken-1": "#000080",
				"primary-darken-2": "#000080",
				"primary-darken-3": "#000080",
				"primary-lighten-1": "#000080",
				"primary-lighten-2": "#000080",
				"primary-lighten-3": "#000080",
				"primary-muted": "#0178D4",
				"scrollbar": "#000080",
				"scrollbar-active": "#000080",
				"scrollbar-background": "#121212",
				"scrollbar-background-active": "#121212",
				"scrollbar-background-hover": "#121212",
				"scrollbar-corner-color": "#E0E0E0",
				"scrollbar-hover": "#000040",
				"secondary": "#008080",
				"secondary-background": "#008080",
				"secondary-background-darken-1": "#008080",
				"secondary-background-darken-2": "#008080",
				"secondary-background-darken-3": "#008080",
				"secondary-background-lighten-1": "#008080",
				"secondary-background-lighten-2": "#008080",
				"secondary-background-lighten-3": "#008080",
				"secondary-darken-1": "#008080",
				"secondary-darken-2": "#008080",
				"secondary-darken-3": "#008080",
				"secondary-lighten-1": "#008080",
				"secondary-lighten-2": "#008080",
				"secondary-lighten-3": "#008080",
				"secondary-muted": "#0178D4",
				"success": "#008000",
				"success-darken-1": "#008000",
				"success-darken-2": "#008000",
				"success-darken-3": "#008000",
				"success-lighten-1": "#008000",
				"success-lighten-2": "#008000",
				"success-lighten-3": "#008000",
				"success-muted": "#0178D4",
				"surface": "#121212",
				"surface-active": "#131313",
				"surface-darken-1": "#121212",
				"surface-darken-2": "#121212",
				"surface-darken-3": "#121212",
				"surface-lighten-1": "#121212",
				"surface-lighten-2": "#121212",
				"surface-lighten-3": "#121212",
				"text": "#E0E0E0",
				"text-accent": "#5656FF",
				"text-disabled": "#E0E0E0",
				"text-error": "#AB5656",
				"text-muted": "#E0E0E0",
				"text-primary": "#5656AB",
				"text-secondary": "#56ABAB",
				"text-success": "#56AB56",
				"text-warning": "#ABAB56",
				"warning": "#808000",
				"warning-darken-1": "#808000",
				"warning-darken-2": "#808000",
				"warning-darken-3": "#808000",
				"warning-lighten-1": "#808000",
				"warning-lighten-2": "#808000",
				"warning-lighten-3": "#808000",
				"warning-muted": "#0178D4"
			}
		},
		"textual-dark": {
			name: "textual-dark",
			dark: true,
			ansi: TEXTUAL_DARK_ANSI,
			vars: {
				"accent": "#FEA62B",
				"accent-darken-1": "#E7920D",
				"accent-darken-2": "#CF7E00",
				"accent-darken-3": "#B86B00",
				"accent-lighten-1": "#FFBA41",
				"accent-lighten-2": "#FFCF56",
				"accent-lighten-3": "#FFE46B",
				"accent-muted": "#593E19",
				"background": "#121212",
				"background-darken-1": "#000000",
				"background-darken-2": "#000000",
				"background-darken-3": "#000000",
				"background-lighten-1": "#212121",
				"background-lighten-2": "#313131",
				"background-lighten-3": "#414141",
				"block-cursor-background": "#0178D4",
				"block-cursor-blurred-background": "#0178D44C",
				"block-cursor-blurred-foreground": "#E0E0E0",
				"block-cursor-foreground": "#FFFFFFDD",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#0178D4",
				"border-blurred": "#191919",
				"button-color-foreground": "#FFFFFFDD",
				"button-foreground": "#E0E0E0",
				"error": "#B93C5B",
				"error-darken-1": "#A32549",
				"error-darken-2": "#8D0638",
				"error-darken-3": "#780028",
				"error-lighten-1": "#D0506D",
				"error-lighten-2": "#E76580",
				"error-lighten-3": "#FE7993",
				"error-muted": "#441E27",
				"footer-background": "#242F38",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#E0E0E0",
				"footer-foreground": "#E0E0E0",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#FFA62B",
				"foreground": "#E0E0E0",
				"foreground-darken-1": "#CACACA",
				"foreground-darken-2": "#B6B6B6",
				"foreground-darken-3": "#A2A2A2",
				"foreground-disabled": "#E0E0E060",
				"foreground-lighten-1": "#F5F5F5",
				"foreground-lighten-2": "#FFFFFF",
				"foreground-lighten-3": "#FFFFFF",
				"foreground-muted": "#E0E0E099",
				"input-cursor-background": "#E0E0E0",
				"input-cursor-foreground": "#121212",
				"input-selection-background": "#368AE966",
				"link-background": "#00000000",
				"link-background-hover": "#0178D4",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#0178D4",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#0178D4",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#0178D4",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#E0E0E0",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#E0E0E0",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#E0E0E099",
				"panel": "#242F38",
				"panel-darken-1": "#141F27",
				"panel-darken-2": "#000F18",
				"panel-darken-3": "#000003",
				"panel-lighten-1": "#343F49",
				"panel-lighten-2": "#45505A",
				"panel-lighten-3": "#57626D",
				"primary": "#0178D4",
				"primary-background": "#33424E",
				"primary-background-darken-1": "#21313E",
				"primary-background-darken-2": "#0F212F",
				"primary-background-darken-3": "#0F212F",
				"primary-background-lighten-1": "#45525D",
				"primary-background-lighten-2": "#57636D",
				"primary-background-lighten-3": "#69747D",
				"primary-darken-1": "#0065BE",
				"primary-darken-2": "#0053AA",
				"primary-darken-3": "#004295",
				"primary-lighten-1": "#368AE9",
				"primary-lighten-2": "#539EFF",
				"primary-lighten-3": "#6DB2FF",
				"primary-muted": "#0C304C",
				"scrollbar": "#003054",
				"scrollbar-active": "#0178D4",
				"scrollbar-background": "#000000",
				"scrollbar-background-active": "#000000",
				"scrollbar-background-hover": "#000000",
				"scrollbar-corner-color": "#000000",
				"scrollbar-hover": "#003C6A",
				"secondary": "#004578",
				"secondary-background": "#333B42",
				"secondary-background-darken-1": "#212A31",
				"secondary-background-darken-2": "#0F1921",
				"secondary-background-darken-3": "#0F1921",
				"secondary-background-lighten-1": "#454C52",
				"secondary-background-lighten-2": "#575E63",
				"secondary-background-lighten-3": "#696F74",
				"secondary-darken-1": "#003465",
				"secondary-darken-2": "#002452",
				"secondary-darken-3": "#001541",
				"secondary-lighten-1": "#23568B",
				"secondary-lighten-2": "#3B689F",
				"secondary-lighten-3": "#507BB3",
				"secondary-muted": "#0C2130",
				"success": "#4EBF71",
				"success-darken-1": "#36AA5E",
				"success-darken-2": "#18954B",
				"success-darken-3": "#008139",
				"success-lighten-1": "#64D484",
				"success-lighten-2": "#7AE998",
				"success-lighten-3": "#8FFFAC",
				"success-muted": "#24452E",
				"surface": "#1E1E1E",
				"surface-active": "#2A2A2A",
				"surface-darken-1": "#0D0D0D",
				"surface-darken-2": "#000000",
				"surface-darken-3": "#000000",
				"surface-lighten-1": "#2D2D2D",
				"surface-lighten-2": "#3E3E3E",
				"surface-lighten-3": "#4F4F4F",
				"text": "#FFFFFFDD",
				"text-accent": "#FFC473",
				"text-disabled": "#FFFFFF60",
				"text-error": "#D17E92",
				"text-muted": "#FFFFFF99",
				"text-primary": "#57A5E2",
				"text-secondary": "#5684A5",
				"text-success": "#8AD4A1",
				"text-warning": "#FFC473",
				"warning": "#FEA62B",
				"warning-darken-1": "#E7920D",
				"warning-darken-2": "#CF7E00",
				"warning-darken-3": "#B86B00",
				"warning-lighten-1": "#FFBA41",
				"warning-lighten-2": "#FFCF56",
				"warning-lighten-3": "#FFE46B",
				"warning-muted": "#593E19"
			}
		},
		"textual-light": {
			name: "textual-light",
			dark: false,
			ansi: {
				black: "#000000",
				red: "#AA3731",
				green: "#448C27",
				yellow: "#CB9000",
				blue: "#325CC0",
				magenta: "#7A3E9D",
				cyan: "#0083B2",
				white: "#F7F7F7",
				brightBlack: "#777777",
				brightRed: "#F05050",
				brightGreen: "#60CB00",
				brightYellow: "#FFBC5D",
				brightBlue: "#007ACC",
				brightMagenta: "#E64CE6",
				brightCyan: "#00AACB",
				brightWhite: "#F7F7F7"
			},
			vars: {
				"accent": "#FEA62B",
				"accent-darken-1": "#E7920D",
				"accent-darken-2": "#CF7E00",
				"accent-darken-3": "#B86B00",
				"accent-lighten-1": "#FFBA41",
				"accent-lighten-2": "#FFCF56",
				"accent-lighten-3": "#FFE46B",
				"accent-muted": "#E9CEA9",
				"background": "#E0E0E0",
				"background-darken-1": "#CACACA",
				"background-darken-2": "#B6B6B6",
				"background-darken-3": "#A2A2A2",
				"background-lighten-1": "#F5F5F5",
				"background-lighten-2": "#FFFFFF",
				"background-lighten-3": "#FFFFFF",
				"block-cursor-background": "#004578",
				"block-cursor-blurred-background": "#0045784C",
				"block-cursor-blurred-foreground": "#1F1F1F",
				"block-cursor-foreground": "#000000DD",
				"block-hover-background": "#00000019",
				"boost": "#0000000A",
				"boost-darken-1": "#0000000A",
				"boost-darken-2": "#0000000A",
				"boost-darken-3": "#0000000A",
				"boost-lighten-1": "#1616160A",
				"boost-lighten-2": "#2525250A",
				"boost-lighten-3": "#3535350A",
				"border": "#004578",
				"border-blurred": "#D0D1D0",
				"button-color-foreground": "#000000DD",
				"button-foreground": "#1F1F1F",
				"error": "#B93C5B",
				"error-darken-1": "#A32549",
				"error-darken-2": "#8D0638",
				"error-darken-3": "#780028",
				"error-lighten-1": "#D0506D",
				"error-lighten-2": "#E76580",
				"error-lighten-3": "#FE7993",
				"error-muted": "#D4AEB8",
				"footer-background": "#D0D0D0",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#1F1F1F",
				"footer-foreground": "#1F1F1F",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#0178D4",
				"foreground": "#1F1F1F",
				"foreground-darken-1": "#0E0E0E",
				"foreground-darken-2": "#000000",
				"foreground-darken-3": "#000000",
				"foreground-disabled": "#1F1F1F60",
				"foreground-lighten-1": "#2E2E2E",
				"foreground-lighten-2": "#3F3F3F",
				"foreground-lighten-3": "#505050",
				"foreground-muted": "#1F1F1F99",
				"input-cursor-background": "#1F1F1F",
				"input-cursor-foreground": "#E0E0E0",
				"input-selection-background": "#23568B66",
				"link-background": "#00000000",
				"link-background-hover": "#004578",
				"link-color": "#000000DD",
				"link-color-hover": "#000000DD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#004578",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#004578",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#004578",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#1F1F1F",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#1F1F1F",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#1F1F1F99",
				"panel": "#D0D0D0",
				"panel-darken-1": "#BBBBBB",
				"panel-darken-2": "#A6A6A6",
				"panel-darken-3": "#939393",
				"panel-lighten-1": "#E5E5E5",
				"panel-lighten-2": "#FAFAFA",
				"panel-lighten-3": "#FFFFFF",
				"primary": "#004578",
				"primary-background": "#004578",
				"primary-background-darken-1": "#003465",
				"primary-background-darken-2": "#002452",
				"primary-background-darken-3": "#001541",
				"primary-background-lighten-1": "#23568B",
				"primary-background-lighten-2": "#3B689F",
				"primary-background-lighten-3": "#507BB3",
				"primary-darken-1": "#003465",
				"primary-darken-2": "#002452",
				"primary-darken-3": "#001541",
				"primary-lighten-1": "#23568B",
				"primary-lighten-2": "#3B689F",
				"primary-lighten-3": "#507BB3",
				"primary-muted": "#9CB1C0",
				"scrollbar": "#7994A9",
				"scrollbar-active": "#004578",
				"scrollbar-background": "#CACACA",
				"scrollbar-background-active": "#CACACA",
				"scrollbar-background-hover": "#CACACA",
				"scrollbar-corner-color": "#CACACA",
				"scrollbar-hover": "#6587A1",
				"secondary": "#0178D4",
				"secondary-background": "#0178D4",
				"secondary-background-darken-1": "#0065BE",
				"secondary-background-darken-2": "#0053AA",
				"secondary-background-darken-3": "#004295",
				"secondary-background-lighten-1": "#368AE9",
				"secondary-background-lighten-2": "#539EFF",
				"secondary-background-lighten-3": "#6DB2FF",
				"secondary-darken-1": "#0065BE",
				"secondary-darken-2": "#0053AA",
				"secondary-darken-3": "#004295",
				"secondary-lighten-1": "#368AE9",
				"secondary-lighten-2": "#539EFF",
				"secondary-lighten-3": "#6DB2FF",
				"secondary-muted": "#9DC0DC",
				"success": "#4EBF71",
				"success-darken-1": "#36AA5E",
				"success-darken-2": "#18954B",
				"success-darken-3": "#008139",
				"success-lighten-1": "#64D484",
				"success-lighten-2": "#7AE998",
				"success-lighten-3": "#8FFFAC",
				"success-muted": "#B4D6BE",
				"surface": "#D8D8D8",
				"surface-active": "#E8E8E8",
				"surface-darken-1": "#C3C3C3",
				"surface-darken-2": "#AEAEAE",
				"surface-darken-3": "#9A9A9A",
				"surface-lighten-1": "#EDEDED",
				"surface-lighten-2": "#FFFFFF",
				"surface-lighten-3": "#FFFFFF",
				"text": "#000000DD",
				"text-accent": "#A86D1C",
				"text-disabled": "#00000060",
				"text-error": "#7A273C",
				"text-muted": "#00000099",
				"text-primary": "#002D4F",
				"text-secondary": "#004F8B",
				"text-success": "#337E4A",
				"text-warning": "#A86D1C",
				"warning": "#FEA62B",
				"warning-darken-1": "#E7920D",
				"warning-darken-2": "#CF7E00",
				"warning-darken-3": "#B86B00",
				"warning-lighten-1": "#FFBA41",
				"warning-lighten-2": "#FFCF56",
				"warning-lighten-3": "#FFE46B",
				"warning-muted": "#E9CEA9"
			}
		},
		"tokyo-night": {
			name: "tokyo-night",
			dark: true,
			ansi: {
				black: "#15161E",
				red: "#F7768E",
				green: "#9ECE6A",
				yellow: "#E0AF68",
				blue: "#7AA2F7",
				magenta: "#BB9AF7",
				cyan: "#7DCFFF",
				white: "#A9B1D6",
				brightBlack: "#414868",
				brightRed: "#F7768E",
				brightGreen: "#9ECE6A",
				brightYellow: "#E0AF68",
				brightBlue: "#7AA2F7",
				brightMagenta: "#BB9AF7",
				brightCyan: "#7DCFFF",
				brightWhite: "#C0CAF5"
			},
			vars: {
				"accent": "#FE9E64",
				"accent-darken-1": "#E78A51",
				"accent-darken-2": "#D0763E",
				"accent-darken-3": "#BA632C",
				"accent-lighten-1": "#FFB277",
				"accent-lighten-2": "#FFC78A",
				"accent-lighten-3": "#FFDC9E",
				"accent-muted": "#5E4238",
				"background": "#1A1B26",
				"background-darken-1": "#070817",
				"background-darken-2": "#000000",
				"background-darken-3": "#000000",
				"background-lighten-1": "#292A36",
				"background-lighten-2": "#3A3A47",
				"background-lighten-3": "#4B4B58",
				"block-cursor-background": "#BB9AF7",
				"block-cursor-blurred-background": "#BB9AF74C",
				"block-cursor-blurred-foreground": "#A9B1D6",
				"block-cursor-foreground": "#FFFFFFDD",
				"block-hover-background": "#FFFFFF19",
				"boost": "#FFFFFF0A",
				"boost-darken-1": "#E9E9E90A",
				"boost-darken-2": "#D4D4D40A",
				"boost-darken-3": "#BFBFBF0A",
				"boost-lighten-1": "#FFFFFF0A",
				"boost-lighten-2": "#FFFFFF0A",
				"boost-lighten-3": "#FFFFFF0A",
				"border": "#BB9AF7",
				"border-blurred": "#1E2235",
				"button-color-foreground": "#24283B",
				"button-foreground": "#A9B1D6",
				"error": "#F6768E",
				"error-darken-1": "#E0617A",
				"error-darken-2": "#C94D68",
				"error-darken-3": "#B33856",
				"error-lighten-1": "#FF8AA1",
				"error-lighten-2": "#FF9FB5",
				"error-lighten-3": "#FFB4CA",
				"error-muted": "#5C3645",
				"footer-background": "#414868",
				"footer-description-background": "#00000000",
				"footer-description-foreground": "#A9B1D6",
				"footer-foreground": "#A9B1D6",
				"footer-item-background": "#00000000",
				"footer-key-background": "#00000000",
				"footer-key-foreground": "#FF9E64",
				"foreground": "#A9B1D6",
				"foreground-darken-1": "#949CC1",
				"foreground-darken-2": "#8189AC",
				"foreground-darken-3": "#6D7698",
				"foreground-disabled": "#A9B1D660",
				"foreground-lighten-1": "#BDC5EB",
				"foreground-lighten-2": "#D2DAFF",
				"foreground-lighten-3": "#E7EFFF",
				"foreground-muted": "#A9B1D699",
				"input-cursor-background": "#A9B1D6",
				"input-cursor-foreground": "#1A1B26",
				"input-selection-background": "#D0AEFF66",
				"link-background": "#00000000",
				"link-background-hover": "#BB9AF7",
				"link-color": "#FFFFFFDD",
				"link-color-hover": "#FFFFFFDD",
				"markdown-h1-background": "#00000000",
				"markdown-h1-color": "#BB9AF7",
				"markdown-h2-background": "#00000000",
				"markdown-h2-color": "#BB9AF7",
				"markdown-h3-background": "#00000000",
				"markdown-h3-color": "#BB9AF7",
				"markdown-h4-background": "#00000000",
				"markdown-h4-color": "#A9B1D6",
				"markdown-h5-background": "#00000000",
				"markdown-h5-color": "#A9B1D6",
				"markdown-h6-background": "#00000000",
				"markdown-h6-color": "#A9B1D699",
				"panel": "#414868",
				"panel-darken-1": "#2F3755",
				"panel-darken-2": "#1E2744",
				"panel-darken-3": "#0C1733",
				"panel-lighten-1": "#53597A",
				"panel-lighten-2": "#656B8E",
				"panel-lighten-3": "#787EA1",
				"primary": "#BB9AF7",
				"primary-background": "#504D60",
				"primary-background-darken-1": "#413D52",
				"primary-background-darken-2": "#322E45",
				"primary-background-darken-3": "#322E45",
				"primary-background-lighten-1": "#605D6E",
				"primary-background-lighten-2": "#6F6C7C",
				"primary-background-lighten-3": "#7E7C8A",
				"primary-darken-1": "#A686E1",
				"primary-darken-2": "#9173CC",
				"primary-darken-3": "#7D60B7",
				"primary-lighten-1": "#D0AEFF",
				"primary-lighten-2": "#E5C2FF",
				"primary-lighten-3": "#FBD7FF",
				"primary-muted": "#4A4164",
				"scrollbar": "#4F4270",
				"scrollbar-active": "#BB9AF7",
				"scrollbar-background": "#070817",
				"scrollbar-background-active": "#070817",
				"scrollbar-background-hover": "#070817",
				"scrollbar-corner-color": "#070817",
				"scrollbar-hover": "#615187",
				"secondary": "#7AA2F7",
				"secondary-background": "#484E60",
				"secondary-background-darken-1": "#383E52",
				"secondary-background-darken-2": "#282F45",
				"secondary-background-darken-3": "#282F45",
				"secondary-background-lighten-1": "#585D6E",
				"secondary-background-lighten-2": "#686D7C",
				"secondary-background-lighten-3": "#787D8A",
				"secondary-darken-1": "#648EE1",
				"secondary-darken-2": "#4D7BCC",
				"secondary-darken-3": "#3468B7",
				"secondary-lighten-1": "#8FB6FF",
				"secondary-lighten-2": "#A5CAFF",
				"secondary-lighten-3": "#BBDFFF",
				"secondary-muted": "#364364",
				"success": "#9ECE6A",
				"success-darken-1": "#89B956",
				"success-darken-2": "#75A443",
				"success-darken-3": "#619030",
				"success-lighten-1": "#B2E37D",
				"success-lighten-2": "#C8F891",
				"success-lighten-3": "#DDFFA6",
				"success-muted": "#41503A",
				"surface": "#24283B",
				"surface-active": "#313448",
				"surface-darken-1": "#14182A",
				"surface-darken-2": "#00031B",
				"surface-darken-3": "#000009",
				"surface-lighten-1": "#34384C",
				"surface-lighten-2": "#45495E",
				"surface-lighten-3": "#575A70",
				"text": "#FFFFFFDD",
				"text-accent": "#FFBE98",
				"text-disabled": "#FFFFFF60",
				"text-error": "#F9A4B4",
				"text-muted": "#FFFFFF99",
				"text-primary": "#D2BCF9",
				"text-secondary": "#A7C1F9",
				"text-success": "#BEDE9C",
				"text-warning": "#EACA9B",
				"warning": "#DFAF68",
				"warning-darken-1": "#C99A55",
				"warning-darken-2": "#B48742",
				"warning-darken-3": "#9E7430",
				"warning-lighten-1": "#F6C37B",
				"warning-lighten-2": "#FFD88F",
				"warning-lighten-3": "#FFEDA3",
				"warning-muted": "#554739"
			}
		}
	};
	//#endregion
	//#region src/themes/registry.ts
	var THEME_NAMES = Object.freeze(Object.keys(THEMES).sort());
	var cache = /* @__PURE__ */ new Map();
	/**
	* Returns the static list of available theme names. Pure and synchronous.
	*/
	function listThemePalettes() {
		return THEME_NAMES;
	}
	function getThemePalette(name) {
		if (!isThemeName(name)) return null;
		const cached = cache.get(name);
		if (cached !== void 0) return cached;
		const palette = hydrate(THEMES[name]);
		cache.set(name, palette);
		return palette;
	}
	function isThemeName(name) {
		return Object.hasOwn(THEMES, name);
	}
	/**
	* Read just the eight base colors from a theme's data file. Cheap — parses
	* 8 hex strings, allocates no Palette, touches no cache. Use this when you
	* want a \`TerminalTheme\`-shaped substrate without forcing the full ~150-var
	* palette through the registry's hydration path.
	*/
	function getThemeBaseColors(name) {
		const data = THEMES[name];
		return {
			name: data.name,
			dark: data.dark,
			bg: requireBaseVar(data, "background"),
			fg: requireBaseVar(data, "foreground"),
			primary: requireBaseVar(data, "primary"),
			secondary: requireBaseVar(data, "secondary"),
			accent: requireBaseVar(data, "accent"),
			success: requireBaseVar(data, "success"),
			warning: requireBaseVar(data, "warning"),
			error: requireBaseVar(data, "error"),
			ansi: new ColorTable(ANSI_SLOTS.map((slot) => parseOpaqueHex(data.ansi[slot], data.name, \`ansi.\${slot}\`)))
		};
	}
	function requireBaseVar(data, key) {
		const v = data.vars[key];
		if (v === void 0) throw new Error(\`Theme \${data.name}: required base var "\${key}" missing from data file\`);
		return parseHex(v, data.name, key);
	}
	/**
	* Parse a \`ThemePaletteData\`'s hex strings into a Palette of ColorRgba.
	*
	* [LAW:single-enforcer] Hex → ColorRgba conversion for theme data lives
	* here, not on Palette. Keeping the parser in this module preserves the
	* \`core/color → themes/palette\` one-way edge (palette.ts must not import
	* ColorRgba as a value, or it cycles with core/color's own use of Palette
	* for INTERNAL_DEFAULT_THEME).
	*/
	function hydrate(data) {
		const map = /* @__PURE__ */ new Map();
		for (const [k, v] of Object.entries(data.vars)) map.set(k, parseHex(v, data.name, k));
		return new Palette(data.name, data.dark, map);
	}
	var HEX_RE = /^[0-9a-fA-F]+$/;
	/**
	* An ANSI slot is a colour a terminal paints, never a blend, so it takes no
	* alpha: \`flattenAlpha\` leaves a STANDARD spec alone and would pass one through.
	*/
	function parseOpaqueHex(value, theme, key) {
		if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new Error(\`Theme \${theme}: \${key} has invalid hex \${JSON.stringify(value)} (expected #RRGGBB)\`);
		return parseRgbHex(value.slice(1));
	}
	function parseHex(value, theme, key) {
		const hex = value.startsWith("#") ? value.slice(1) : value;
		if (hex.length !== 6 && hex.length !== 8 || !HEX_RE.test(hex)) throw new Error(\`Theme \${theme}: var \${key} has invalid hex \${JSON.stringify(value)} (expected #RRGGBB or #RRGGBBAA)\`);
		return hex.length === 6 ? parseRgbHex(hex) : parseRgbaHex(hex);
	}
	//#endregion
	//#region src/themes/terminalThemes.ts
	/**
	* Pre-built \`TerminalTheme\` constants — every theme in the registry has a
	* matching \`<NAME>\` export here. There is no inline-only theme; the data
	* file is the single source of truth for every theme's hex values.
	*
	* Editing \`data/<name>.ts\` updates both the registry's full ~150-var
	* palette (via \`getThemePalette(name)\`) AND the matching \`TerminalTheme\`
	* constant exported below (via \`getThemeBaseColors(name)\`, which pulls
	* just the 8 substrate keys). The two views never drift because both
	* derive from the same authored data.
	*
	* [LAW:one-source-of-truth] Hex values live in \`data/<name>.ts\`. This
	* module is a derived view that builds a \`TerminalTheme\` from each
	* theme's eight base colors via \`buildPalette\` for the substrate palette,
	* and from the theme's own ANSI table for the sixteen named colours.
	*
	* [LAW:one-type-per-behavior] Every theme has the same shape — name,
	* \`dark\` flag, full Palette in the registry, \`TerminalTheme\` constant
	* here. Consumers can pick any theme by name without branching on which
	* APIs work for it.
	*
	* [LAW:one-way-deps] \`core/color → themes/palette\` remains the only edge
	* into themes/. This file imports only sibling theme modules and core
	* color primitives; nothing in \`core/\` imports back.
	*/
	function defineTheme(d) {
		return new TerminalTheme(d.bg, d.fg, d.ansi, buildPalette(d.name, d.dark, {
			primary: d.primary,
			secondary: d.secondary,
			accent: d.accent,
			success: d.success,
			warning: d.warning,
			error: d.error,
			background: d.bg,
			foreground: d.fg
		}));
	}
	var DEFAULT_TERMINAL_THEME = defineTheme(getThemeBaseColors("default"));
	var SVG_EXPORT_THEME = defineTheme(getThemeBaseColors("svg-export"));
	var MONOKAI = defineTheme(getThemeBaseColors("monokai"));
	var NORD = defineTheme(getThemeBaseColors("nord"));
	var GRUVBOX = defineTheme(getThemeBaseColors("gruvbox"));
	var DRACULA = defineTheme(getThemeBaseColors("dracula"));
	var TOKYO_NIGHT = defineTheme(getThemeBaseColors("tokyo-night"));
	var FLEXOKI = defineTheme(getThemeBaseColors("flexoki"));
	var CYBERPUNK = defineTheme(getThemeBaseColors("cyberpunk"));
	var CATPPUCCIN_MOCHA = defineTheme(getThemeBaseColors("catppuccin-mocha"));
	var CATPPUCCIN_LATTE = defineTheme(getThemeBaseColors("catppuccin-latte"));
	var CATPPUCCIN_FRAPPE = defineTheme(getThemeBaseColors("catppuccin-frappe"));
	var CATPPUCCIN_MACCHIATO = defineTheme(getThemeBaseColors("catppuccin-macchiato"));
	var SOLARIZED_DARK = defineTheme(getThemeBaseColors("solarized-dark"));
	var SOLARIZED_LIGHT = defineTheme(getThemeBaseColors("solarized-light"));
	var ROSE_PINE = defineTheme(getThemeBaseColors("rose-pine"));
	var ROSE_PINE_MOON = defineTheme(getThemeBaseColors("rose-pine-moon"));
	var ROSE_PINE_DAWN = defineTheme(getThemeBaseColors("rose-pine-dawn"));
	var ATOM_ONE_DARK = defineTheme(getThemeBaseColors("atom-one-dark"));
	var ATOM_ONE_LIGHT = defineTheme(getThemeBaseColors("atom-one-light"));
	var TEXTUAL_DARK = defineTheme(getThemeBaseColors("textual-dark"));
	var TEXTUAL_LIGHT = defineTheme(getThemeBaseColors("textual-light"));
	var TEXTUAL_ANSI = defineTheme(getThemeBaseColors("textual-ansi"));
	//#endregion
	//#region src/themes/transpose.ts
	/**
	* Transpose a Palette to a new "key" — analogous to transposing a melody.
	*
	*   melody / chord progression  ::  Palette (relationships between colors)
	*                key (signature) ::  ThemeKey (hue / chroma / lightness deltas)
	*      "in C major" / "in D…"   ::  the resulting transposed Palette
	*
	* Because OKLCH is perceptually uniform, "+30° hue" looks like a
	* consistent jump everywhere on the color wheel — the way a perfect-fifth
	* interval sounds the same in every musical key. Transposition is closed
	* under composition: \`transpose(transpose(p, k1), k2)\` produces the same
	* colors as a single transpose with the combined deltas, modulo round-trip
	* quantization.
	*
	* [LAW:dataflow-not-control-flow] A single uniform per-color transform
	* runs for every var in the palette. Anchor protection selects *which*
	* \`ThemeKey\` to apply (data), not *whether* to apply one (branch).
	*
	* [LAW:one-source-of-truth] Anchor classification lives only in
	* \`ANCHORED_ROOTS\` below. The buildPalette derivation guarantees every
	* variant of a semantic root shares the root as its hyphen prefix
	* (\`error\`, \`error-darken-1\`, \`error-lighten-2\`, ...), so one set covers
	* the whole family.
	*
	* [LAW:one-way-deps] Imports flow \`core/oklch → themes/transpose\`;
	* nothing in core/ depends back on this file.
	*/
	/**
	* Semantic roots whose hue is locked under transposition. \`error\` must
	* look red-ish, \`success\` green-ish, \`warning\` amber-ish — rotating the
	* hue would make the UI lie about meaning. Lightness and chroma *still*
	* transform for these roles, so they invert correctly during dark↔light
	* flips and respond to chroma scaling alongside everything else.
	*/
	var ANCHORED_ROOTS = /* @__PURE__ */ new Set([
		"error",
		"success",
		"warning"
	]);
	function rootOf(varName) {
		const dash = varName.indexOf("-");
		return dash === -1 ? varName : varName.slice(0, dash);
	}
	/**
	* Whether a palette var's hue is locked under transposition. The single
	* predicate used by \`transposePalette\`. Exported so callers building
	* higher-level theme machinery can stay consistent with the locking rule.
	*/
	function isAnchored(varName) {
		return ANCHORED_ROOTS.has(rootOf(varName));
	}
	/**
	* Return a new \`Palette\` whose colors are the transposition of \`palette\`'s
	* colors by \`key\`. Pure. Identity (\`IDENTITY\`) returns a Palette with byte-exact
	* colors — fast-pathed so identity does not pay the sRGB↔OKLCH round-trip
	* quantization cost.
	*
	* The \`dark\` flag of the result is derived from the actual lightness of
	* the resulting \`background\` var (\`Oklch.fromRgba(bg).l < 0.5\`) — *not*
	* from the key's coefficients. The strongest theorem: "dark iff
	* background is dark." This is honest under every transform — pure
	* lightness shifts, mirror-inversions, hue rotations that don't touch L,
	* and combinations of all three. [LAW:types-are-the-program]
	*
	* The transposing path throws if the palette has no \`background\` var (the
	* \`dark\`-flag derivation has nothing to read). Failing loudly is preferred
	* over a silent fallback because the alternative — trusting the source
	* \`palette.dark\` after an arbitrary L-transform — produces flags that lie.
	* The identity fast-path is exempt: it preserves the source \`dark\` flag
	* verbatim (no derivation), so it needs no \`background\` and never throws.
	*
	* @param name Optional override for the resulting palette name. Defaults
	*   to the source palette's name. Callers building a family of transposed
	*   palettes (e.g. "gruvbox +60°") supply their own.
	*/
	function transposePalette(palette, key, name) {
		if (isIdentityKey(key)) return new Palette(name ?? palette.name, palette.dark, palette.vars);
		const anchorKey = {
			...key,
			hueShift: 0
		};
		const next = /* @__PURE__ */ new Map();
		for (const [varName, color] of palette.vars) {
			const effective = isAnchored(varName) ? anchorKey : key;
			next.set(varName, Oklch.fromRgba(color).applyKey(effective).toRgba());
		}
		const newBackground = next.get("background");
		if (newBackground === void 0) throw new Error(\`transposePalette: palette "\${palette.name}" has no "background" var; cannot derive the dark flag without a background color.\`);
		const newDark = Oklch.fromRgba(newBackground).l < .5;
		return new Palette(name ?? palette.name, newDark, next);
	}
	/**
	* Build the \`ThemeKey\` that rotates \`palette\` so its *tonic* var lands on
	* \`targetHueDeg\`. The musical operation directly: a key is the set of
	* intervals from the tonic, so "play this theme in the key of <hue>" means
	* "shift every color by exactly the interval that carries the tonic's
	* current hue to the target." Pick the tonic's pitch and the rest follows.
	*
	* Returns a hue-only key (chroma and lightness untouched). Callers that also
	* want to scale chroma or shift lightness spread their own axes over the
	* result — those are independent transposition dimensions, not part of
	* choosing the key. [LAW:one-type-per-behavior] a degree-shift key and a
	* root-note key are the *same* transform; this is just a second constructor
	* for it, so \`transposePalette\` stays untouched.
	*
	* Throws if \`tonicVar\` is absent — the interval has no anchor to measure
	* from, so there is no honest key to return. Failing loudly beats inventing
	* a zero shift that would silently mean "no transposition."
	*/
	function themeKeyForRoot(palette, tonicVar, targetHueDeg) {
		if (!Number.isFinite(targetHueDeg)) throw new RangeError(\`themeKeyForRoot: targetHueDeg must be a finite number; got \${targetHueDeg}\`);
		const tonic = palette.get(tonicVar);
		if (tonic === void 0) throw new Error(\`themeKeyForRoot: palette "\${palette.name}" has no "\${tonicVar}" var to use as the tonic; cannot measure the transposition interval.\`);
		let hueShift = (targetHueDeg - Oklch.fromRgba(tonic).h) % 360;
		if (hueShift < 0) hueShift += 360;
		return {
			hueShift,
			chromaScale: 1,
			lightnessScale: 1,
			lightnessShift: 0
		};
	}
	//#endregion
	//#region src/themes/ramp.ts
	/**
	* A color ramp: a number mapped onto a color through ordered stops.
	*
	* "What does 73 % spent look like" has no answer in a vocabulary of discrete
	* adjustments (\`darken\`, \`mix\`, \`contrastOn\`): each takes colors and returns a
	* color, and none takes a *measurement*. Without a ramp the answer gets
	* computed outside the theme system — a script emits a hex, a template
	* branches \`if ge .pct 80 … else if ge .pct 50 …\` — and that color decision
	* can no longer transpose with the palette it was meant to belong to. A ramp
	* is the one function whose input is a number, so the decision stays inside.
	*
	* A threshold cascade is a ramp too: the same stops with a \`step\` easing hold
	* each color until the next position, which is exactly \`≥ threshold → hotter\`
	* written as data. [LAW:one-type-per-behavior] One primitive; the easing is a
	* value, so a gradient and a cascade differ by one word, not by which function
	* was called.
	*
	* Interpolation is in OKLCH (\`Oklch.mix\`), so a \`linear\` ramp between two
	* theme colors passes through perceptually even steps rather than the muddy
	* midpoints of an sRGB blend.
	*
	* [LAW:one-way-deps] Imports \`core/color\` and \`core/oklch\` only; nothing here
	* knows what a palette is. Resolving stop *names* is the template binding's
	* job (\`paletteFuncs\`), which hands this module resolved colors.
	*/
	/**
	* How a value between two stops maps to progress along them. Each easing is
	* a function on segment progress \`t ∈ [0, 1)\` — \`linear\` keeps it, \`step\`
	* holds the left stop for the whole segment.
	*
	* [LAW:dataflow-not-control-flow] The easing is looked up by name and applied
	* unconditionally; \`at\` runs the same code for a gradient and a cascade.
	*/
	var RAMP_EASINGS = {
		linear: (t) => t,
		step: () => 0
	};
	var RAMP_EASING_NAMES = Object.keys(RAMP_EASINGS);
	/**
	* The gate a spelled easing crosses. [LAW:parse-dont-validate] — returns the
	* narrowed name, so \`ColorRamp\` never re-checks. Unknown names throw naming
	* every legal one. [LAW:no-silent-failure]
	*/
	function parseRampEasing(name) {
		if (!Object.hasOwn(RAMP_EASINGS, name)) throw new RangeError(\`unknown ramp easing \${JSON.stringify(name)}; expected one of \` + RAMP_EASING_NAMES.map((n) => JSON.stringify(n)).join(", "));
		return name;
	}
	/**
	* An immutable ramp over stops sorted by position.
	*
	* [LAW:single-enforcer] The constructor is the one place a ramp's shape is
	* checked — at least one stop, every position finite, positions
	* non-decreasing — matching the \`ColorRgba\`/\`Oklch\` pattern. Positions are
	* required to arrive in order rather than being sorted here: a ramp whose
	* stops are read from configuration (\`warning at 80, error at 50\`) is an
	* authoring mistake, and sorting would quietly render a different ramp than
	* the one written. [LAW:no-silent-failure]
	*
	* Two stops may share a position: that is a hard edge, the later color
	* taking over at exactly that value (CSS gradients spell a hard stop the
	* same way).
	*/
	var ColorRamp = class {
		easing;
		stops;
		constructor(easing, stops) {
			this.easing = easing;
			this.stops = stops;
			if (stops.length === 0) throw new RangeError("a ColorRamp needs at least one stop");
			for (const [i, stop] of stops.entries()) {
				if (!Number.isFinite(stop.at)) throw new RangeError(\`ColorRamp stop \${i} has a non-finite position \${stop.at}\`);
				const prev = stops[i - 1];
				if (prev !== void 0 && stop.at < prev.at) throw new RangeError(\`ColorRamp stops must be in ascending position order; stop \${i} at \${stop.at} follows stop \${i - 1} at \${prev.at}\`);
			}
		}
		/**
		* The color at \`value\`. Below the first stop it is the first color; at or
		* above the last stop it is the last; between two stops it is \`easing\`
		* of the way from the lower to the upper, so a value exactly on a stop is
		* that stop's color, byte for byte.
		*
		* The two endpoint returns are the exactness contract, not a shortcut:
		* the sRGB → OKLCH → sRGB round-trip can land a channel one unit off, and a
		* ramp that does not hit its own stops exactly would make a \`step\` ramp
		* paint a color the author never wrote.
		*/
		at(value) {
			if (!Number.isFinite(value)) throw new RangeError(\`ColorRamp.at needs a finite value, got \${value}\`);
			const stops = this.stops;
			let lower = -1;
			while (lower + 1 < stops.length && stops[lower + 1].at <= value) lower++;
			if (lower < 0) return stops[0].color;
			const from = stops[lower];
			if (lower === stops.length - 1) return from.color;
			const to = stops[lower + 1];
			const t = RAMP_EASINGS[this.easing]((value - from.at) / (to.at - from.at));
			if (t <= 0) return from.color;
			if (t >= 1) return to.color;
			return Oklch.fromRgba(from.color).mix(Oklch.fromRgba(to.color), t).toRgba();
		}
	};
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
	var StyleStack = class {
		stack;
		constructor(base = NULL_STYLE) {
			this.stack = [base];
		}
		get current() {
			return this.stack[this.stack.length - 1];
		}
		push(style) {
			this.stack.push(this.current.add(style));
		}
		pop() {
			if (this.stack.length <= 1) throw new Error("Cannot pop the base style from StyleStack");
			return this.stack.pop();
		}
	};
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
	var SIMPLE = new Box("    \\n    \\n ── \\n    \\n    \\n ── \\n    \\n    ");
	var SIMPLE_HEAD = new Box("    \\n    \\n ── \\n    \\n    \\n    \\n    \\n    ");
	var SIMPLE_HEAVY = new Box("    \\n    \\n ━━ \\n    \\n    \\n ━━ \\n    \\n    ");
	var HORIZONTALS = new Box(" ── \\n    \\n ── \\n    \\n ── \\n ── \\n    \\n ── ");
	var ROUNDED = new Box("╭─┬╮\\n│ ││\\n├─┼┤\\n│ ││\\n├─┼┤\\n├─┼┤\\n│ ││\\n╰─┴╯");
	var HEAVY = new Box("┏━┳┓\\n┃ ┃┃\\n┣━╋┫\\n┃ ┃┃\\n┣━╋┫\\n┣━╋┫\\n┃ ┃┃\\n┗━┻┛");
	var HEAVY_EDGE = new Box("┏━┯┓\\n┃ │┃\\n┠─┼┨\\n┃ │┃\\n┠─┼┨\\n┠─┼┨\\n┃ │┃\\n┗━┷┛");
	var HEAVY_HEAD = new Box("┏━┳┓\\n┃ ┃┃\\n┡━╇┩\\n│ ││\\n├─┼┤\\n├─┼┤\\n│ ││\\n└─┴┘");
	var DOUBLE = new Box("╔═╦╗\\n║ ║║\\n╠═╬╣\\n║ ║║\\n╠═╬╣\\n╠═╬╣\\n║ ║║\\n╚═╩╝");
	var DOUBLE_EDGE = new Box("╔═╤╗\\n║ │║\\n╟─┼╢\\n║ │║\\n╟─┼╢\\n╟─┼╢\\n║ │║\\n╚═╧╝");
	var MARKDOWN = new Box("    \\n| ||\\n|-||\\n| ||\\n|-||\\n|-||\\n| ||\\n    ");
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
	function measureRenderables(options, measurables) {
		if (measurables.length === 0) return new Measurement(0, 0);
		let minOfAll = 0;
		let maxOfAll = 0;
		for (const m of measurables) {
			const measurement = Measurement.get(options, m);
			minOfAll = Math.max(minOfAll, measurement.minimum);
			maxOfAll = Math.max(maxOfAll, measurement.maximum);
		}
		return new Measurement(minOfAll, maxOfAll);
	}
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
	var OSC8_SCAN = new RegExp(OSC8.source, "g");
	/**
	* Every OSC 8 sequence in \`text\`, in order — the typed way to read rendered
	* bytes back.
	*/
	function osc8Sequences(text) {
		return [...text.matchAll(OSC8_SCAN)].map((m) => ({
			index: m.index,
			length: m[0].length,
			params: m[1],
			uri: m[2]
		}));
	}
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
	//#region src/core/strip.ts
	/**
	* Strip + Joiner — edge-aware horizontal layout primitive.
	*
	* A \`Strip\` renders a horizontal sequence of styled items with a \`Joiner\`
	* deciding how each transition between adjacent items looks. The joiner is
	* a pure function of \`(leftItem | null, rightItem | null) -> Renderable\`,
	* so endpoint joins (the start and end of the strip) are explicit positions
	* in the protocol — the joiner names what an endpoint looks like rather than
	* the strip guessing.
	*
	* [LAW:one-source-of-truth] The render walk
	*   joiner(null, items[0]), items[0],
	*   joiner(items[0], items[1]), items[1], ...,
	*   joiner(items[N-1], null)
	* is the single authority for how strips lay out. Every joiner participates
	* in the same protocol; "look up the previous segment's bg" is no longer a
	* powerline-specific hack but the contract every joiner shares.
	*
	* [LAW:locality-or-seam] The joiner protocol asks each item only for its
	* *edge* style — the column adjacent to the joiner — not for a single
	* whole-item style. This pushes the bg-uniformity requirement out of the
	* cell type and into the narrowest place that actually needs it: the column
	* boundary. Items with uniform styling report the same style at both edges;
	* items with varying styling report the actual boundary column. There is no
	* single-style invariant on the cell type — the terminal supports per-column
	* styling, so the cell type does too.
	*/
	var Strip = class {
		items;
		joiner;
		constructor(items, joiner) {
			this.items = items;
			this.joiner = joiner;
		}
		*render(options) {
			const items = this.items;
			if (items.length === 0) return;
			yield* this.joiner.join(null, items[0]).render(options);
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				yield* item.render(options);
				const next = i + 1 < items.length ? items[i + 1] : null;
				yield* this.joiner.join(item, next).render(options);
			}
			yield Segment.line();
		}
	};
	var EMPTY = { *render(_options) {} };
	var FixedSegment = class {
		_text;
		_style;
		constructor(text, style) {
			this._text = text;
			this._style = style;
		}
		*render(_options) {
			yield new Segment(this._text, this._style);
		}
	};
	/** A renderable whose segments are computed from the options it is rendered with. */
	function deferred(emit) {
		return { render: emit };
	}
	function bgAsFg(edge) {
		return new Style({ color: edge.bgcolor });
	}
	function paintableBg(bg) {
		return bg !== void 0 && !bg.isDefault ? bg : void 0;
	}
	function drawnGround(bg) {
		return new Style({ bgcolor: bg }).drawnColors().bgcolor;
	}
	function* cap(glyph, bg) {
		if (glyph !== "") yield new Segment(glyph, new Style({ color: drawnGround(bg) }));
	}
	/**
	* The least ΔE_OK two neighbouring backgrounds must differ by for the powerline
	* arrow between them to be seen. Below it the arrow is drawn in a colour the
	* eye cannot tell from its own background, so the joiner draws the divider
	* instead. Twice the ~.02 threshold of a visible difference, because a seam is
	* one cell wide.
	*/
	var SEAM_MIN_DELTA_E = .04;
	function vanishes(arrow, colorSystem) {
		const { color, bgcolor } = arrow.drawnColors(colorSystem ?? ColorDepth.TRUECOLOR);
		if (color === void 0 || bgcolor === void 0) return false;
		const av = color.fixedValue;
		const bv = bgcolor.fixedValue;
		return av !== void 0 && bv !== void 0 ? Oklch.fromRgba(av).deltaE(Oklch.fromRgba(bv)) < SEAM_MIN_DELTA_E : color.number === bgcolor.number;
	}
	/**
	* The powerline set: U+E0B0 (right-arrow) divided by U+E0B1 (thin right-arrow),
	* led by U+E0D7 (Nerd Fonts ple-left_hard_divider_inverse, the right-arrow's
	* inverse) and tailed by the arrow itself. The lead leaves empty a triangle
	* whose base is its cell's left edge and whose point touches the first item, so
	* the run opens notched — as if an arrow before it pointed in — rather than
	* with a shape pointing out. The notch is the terminal's own background showing
	* through, never a colour painted to imitate it, so it matches under a
	* translucent terminal background too. The lead is a Powerline Extra glyph: a
	* classic powerline font lacks it.
	*/
	var POWERLINE_JOINER_GLYPHS = Object.freeze({
		glyph: "",
		divider: "",
		lead: "",
		tail: ""
	});
	var PowerlineJoiner = class {
		_glyph;
		_divider;
		_lead;
		_tail;
		constructor(options = POWERLINE_JOINER_GLYPHS) {
			this._glyph = options.glyph;
			this._divider = options.divider;
			this._lead = options.lead;
			this._tail = options.tail;
		}
		join(left, right) {
			const glyph = this._glyph;
			const divider = this._divider;
			const lead = this._lead;
			const tail = this._tail;
			return deferred(function* (options) {
				const leftEdge = left?.edgeStyle("right", options);
				const leftBg = paintableBg(leftEdge?.bgcolor);
				const rightBg = paintableBg(right?.edgeStyle("left", options).bgcolor);
				if (leftBg === void 0) {
					if (rightBg !== void 0) yield* cap(lead, rightBg);
					return;
				}
				if (rightBg === void 0) {
					yield* cap(tail, leftBg);
					return;
				}
				const arrow = new Style({
					color: drawnGround(leftBg),
					bgcolor: rightBg
				});
				yield vanishes(arrow, options.colorSystem) ? new Segment(divider, new Style({
					color: leftEdge?.color,
					bgcolor: leftBg
				})) : new Segment(glyph, arrow);
			});
		}
	};
	var CapsuleJoiner = class {
		_left;
		_right;
		_separator;
		constructor(options) {
			this._left = options?.left ?? "";
			this._right = options?.right ?? "";
			this._separator = options?.separator ?? " ";
		}
		*_emit(left, right, options) {
			if (left === null && right === null) return;
			if (left === null) {
				yield new Segment(this._left, bgAsFg(right.edgeStyle("left", options)));
				return;
			}
			if (right === null) {
				yield new Segment(this._right, bgAsFg(left.edgeStyle("right", options)));
				return;
			}
			yield new Segment(this._right, bgAsFg(left.edgeStyle("right", options)));
			if (this._separator.length > 0) yield new Segment(this._separator);
			yield new Segment(this._left, bgAsFg(right.edgeStyle("left", options)));
		}
		join(left, right) {
			return deferred((options) => this._emit(left, right, options));
		}
	};
	var PlainJoiner = class {
		_separator;
		_style;
		constructor(options) {
			this._separator = options?.separator ?? " | ";
			this._style = options?.style ?? Style.parse("dim");
		}
		join(left, right) {
			if (left === null || right === null) return EMPTY;
			return new FixedSegment(this._separator, this._style);
		}
	};
	/**
	* Half-block dithering glyph: paints the cell's left half with the foreground
	* colour and the right half with the background colour. Lets each cell carry
	* two colour samples — \`2 * steps\` samples in \`steps\` cells — so the gradient
	* looks twice as smooth as one-colour-per-cell at the same width.
	*/
	var HALF_BLOCK = "▌";
	var GradientJoiner = class {
		_steps;
		constructor(options) {
			this._steps = options?.steps ?? 4;
		}
		join(left, right) {
			if (left === null || right === null) return EMPTY;
			const steps = this._steps;
			return deferred(function* (options) {
				const lbg = left.edgeStyle("right", options).bgcolor;
				const rbg = right.edgeStyle("left", options).bgcolor;
				if (!lbg || !rbg) return;
				const lTrip = lbg.getTruecolor();
				const rTrip = rbg.getTruecolor();
				const samples = 2 * steps;
				for (let i = 0; i < steps; i++) {
					const tLeft = (2 * i + .5) / samples;
					const tRight = (2 * i + 1.5) / samples;
					yield new Segment(HALF_BLOCK, new Style({
						color: ColorSpec.fromRgba(blendRgb(lTrip, rTrip, tLeft)),
						bgcolor: ColorSpec.fromRgba(blendRgb(lTrip, rTrip, tRight))
					}));
				}
			});
		}
	};
	//#endregion
	//#region src/core/render.ts
	/**
	* \`renderToString\` — stateless one-shot emission of a \`Renderable\` to a string
	* of ANSI-encoded text. Pure function: same inputs produce byte-identical
	* output. Does not write to \`process.stdout\` and does not require a \`Console\`
	* instance.
	*
	* Note on \`colorSystem: "auto"\`: the \`"auto"\` spec resolves via
	* \`detectColorSystem\`, which reads \`process.env\` and \`process.stdout?.isTTY\`
	* by default. Callers that want a fully deterministic render must either pass
	* an explicit \`ColorDepth\` enum / non-\`"auto"\` spec, or supply \`env\` and
	* \`isTTY\` in the options so detection does not consult ambient process state.
	*
	* [LAW:single-enforcer] The Segment-to-ANSI conversion lives in \`segmentsToString\`
	* and is the single way segments become wire bytes. \`Console._writeSegments\`,
	* \`Live.refresh\`, \`Screen\`'s frame paint, \`renderToString\`, and
	* \`segmentToString\` all delegate here, so terminal output, live frames, widget
	* frames, string export, and single-segment encoding agree by construction.
	*
	* [LAW:one-source-of-truth] What the encoding needs from where it writes
	* arrives as one \`Destination\` value. Each caller resolves its destination
	* once — spec, detection, and its own overrides — and hands it through whole,
	* so a depth is never paired with a link setting taken from somewhere else.
	*
	* [LAW:dataflow-not-control-flow] The same pipeline runs every render: collect
	* non-control non-empty pieces, partition by SGR-codes (SGR-runs), partition
	* each run by link (link-runs), emit one SGR open/close per run with link
	* open/close pairs sitting inside. Colour and hyperlinks are two facts about
	* the destination: \`colorSystem === null\` empties every piece's SGR-codes, and
	* \`hyperlinks === false\` empties every piece's link. A colour depth never
	* removes a link — a hyperlink is not a colour, and a NO_COLOR terminal still
	* follows OSC 8.
	*
	* [LAW:types-are-the-program] Adjacent same-style segments share an SGR wrap
	* because the SGR-codes string is the same group key for both — the
	* partitioning shape (data) encodes the byte structure; the emit walk is a
	* mechanical fold over it.
	*/
	var DEFAULT_WIDTH$1 = 80;
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
	* Encodes a single segment as ANSI bytes for \`destination\`. Equivalent to
	* \`segmentsToString([segment], destination)\` — same SGR / OSC 8 layout.
	*/
	function segmentToString(segment, destination) {
		return segmentsToString([segment], destination);
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
	function renderToString(renderable, options) {
		const width = options?.width ?? DEFAULT_WIDTH$1;
		const detectOptions = {};
		if (options?.env !== void 0) detectOptions.env = options.env;
		if (options?.isTTY !== void 0) detectOptions.isTTY = options.isTTY;
		const rawSpec = options?.colorSystem;
		const resolved = resolveDestination(rawSpec === void 0 ? ColorDepth.TRUECOLOR : rawSpec, detectOptions);
		const destination = {
			colorSystem: options?.noColor ? null : resolved.colorSystem,
			hyperlinks: options?.hyperlinks ?? resolved.hyperlinks
		};
		const renderOptions = {
			maxWidth: width,
			isTerminal: false,
			encoding: "utf-8",
			asciiOnly: false,
			colorSystem: destination.colorSystem
		};
		return segmentsToString(renderable.render(renderOptions), destination);
	}
	//#endregion
	//#region src/core/ansi.ts
	/**
	* ANSI bytes back into styled text — a port of Rich's \`AnsiDecoder\`
	* (rich/ansi.py) and \`Text.from_ansi\`.
	*
	* The rendering pipeline runs one way, \`Style\` → SGR bytes; this runs it
	* backwards, for output some program already wrote: a capture of an example's
	* own \`new Console()\`, a CLI's output shown inside a Panel, a log replayed into
	* a Table cell.
	*
	* [LAW:types-are-the-program] Every colour decodes to the \`ColorSpec\` its
	* escape names — \`31\` the standard colour 1, \`38;5;n\` palette index n,
	* \`38;2;r;g;b\` that truecolor — and none is resolved to RGB here. A standard
	* colour is a slot in whatever theme draws it, so one captured run exports
	* correctly under a light theme and a dark one; resolved here, dark mode would
	* show light mode's colours. Resolution belongs to \`export-lines\`.
	*
	* [LAW:types-are-the-program] The link is decoder state of its own, beside
	* the SGR style, not a field of it: a terminal ends a hyperlink only at an OSC
	* 8 close, and an SGR reset inside the link leaves it open. Rich keeps the
	* link in the SGR style, so its reset drops it.
	*
	* Carriage returns are the other departure, and the same argument. Rich splits
	* lines with Python's \`splitlines\`, which also breaks at \`\\r\`, so its \`a\\rb\`
	* is two lines. Here a line ends only at \`\\n\`, and \`\\r\` returns to the first
	* column, so later text overwrites earlier text character by character:
	* \`50%\\r100%\` is \`100%\`, \`Downloading\\rDone\` is \`Doneloading\`, and \`done\\r\`
	* is still \`done\`. Columns are counted in characters, not cells, so a wide
	* character overwritten by a narrow one is where this and a terminal differ.
	* Erase in line (\`\\x1b[K\`) is honoured for the same reason, because a redraw
	* is usually \`\\r\\x1b[K\` and the old text must not show through a shorter new
	* one.
	*
	* Everything else follows Rich: malformed SGR parameters are skipped rather
	* than refused, and every other escape is dropped. It is not a terminal
	* emulator — any other cursor movement is dropped, not performed.
	*
	* Tier 5 of \`src/core/\`: it builds \`RichText\`, so it sits above \`text\`, and
	* \`RichText\` cannot offer a \`fromAnsi\` static without importing upward.
	*/
	/**
	* Every escape but OSC 8, which \`osc8Sequences\` reads before this runs. In
	* order: a carriage return; an SGR sequence (group 1, its parameters — a
	* private marker such as the \`>\` of \`\\x1b[>4;2m\` makes it some other CSI);
	* erase in line (group 2, its mode); any other CSI sequence; any other string
	* escape — OSC, DCS, APC, PM, SOS — run to the terminators OSC 8 accepts or
	* cut off by the end of the line; any other escape, ECMA-48's intermediates
	* and one final byte (\`\\x1b(B\`, \`\\x1b)0\`, \`\\x1b#8\`, \`\\x1bc\`). Only the first
	* three become tokens.
	*/
	var ESCAPE = /\\r|\\x1b\\[([0-9;:]*)m|\\x1b\\[([012]?)K|\\x1b\\[[0-?]*[ -/]*[@-~]|\\x1b[\\]P_^X][\\s\\S]*?(?:\\x07|\\x1b\\\\|\\x9c|$)|\\x1b[ -/]*[0-~]/g;
	function* escapeTokens(bytes) {
		let at = 0;
		for (const match of bytes.matchAll(ESCAPE)) {
			if (match.index > at) yield {
				kind: "text",
				text: bytes.slice(at, match.index)
			};
			if (match[0] === "\\r") yield { kind: "return" };
			if (match[1] !== void 0) yield {
				kind: "sgr",
				params: match[1]
			};
			if (match[2] !== void 0) yield {
				kind: "erase",
				mode: match[2] || "0"
			};
			at = match.index + match[0].length;
		}
		if (at < bytes.length) yield {
			kind: "text",
			text: bytes.slice(at)
		};
	}
	function* tokens(line) {
		let at = 0;
		for (const sequence of osc8Sequences(line)) {
			yield* escapeTokens(line.slice(at, sequence.index));
			yield {
				kind: "link",
				uri: sequence.uri
			};
			at = sequence.index + sequence.length;
		}
		yield* escapeTokens(line.slice(at));
	}
	function adding(options) {
		const added = new Style(options);
		return (style) => style.add(added);
	}
	function next(rest) {
		const step = rest.next();
		return step.done ? void 0 : step.value;
	}
	/**
	* \`5;n\` or \`2;r;g;b\`, the arguments of \`38\` and \`48\`. A sequence cut short
	* names no colour, and the codes it did consume are spent, as in Rich.
	*/
	function extendedColor(rest) {
		const kind = next(rest);
		if (kind === 5) {
			const n = next(rest);
			return n === void 0 ? void 0 : ColorSpec.fromAnsi(n);
		}
		if (kind === 2) {
			const [r, g, b] = [
				next(rest),
				next(rest),
				next(rest)
			];
			return b === void 0 ? void 0 : ColorSpec.fromRgb(r, g, b);
		}
	}
	var SGR_OPS = new Map([
		[0, () => NULL_STYLE],
		...ATTRIBUTE_NAMES.map((name) => [ATTRIBUTE_SGR[name], adding({ [name]: true })]),
		[22, adding({
			bold: false,
			dim: false
		})],
		[23, adding({ italic: false })],
		[24, adding({
			underline: false,
			underline2: false
		})],
		[25, adding({
			blink: false,
			blink2: false
		})],
		[27, adding({ reverse: false })],
		[28, adding({ conceal: false })],
		[29, adding({ strike: false })],
		[38, (style, rest) => style.add(new Style({ color: extendedColor(rest) }))],
		[39, adding({ color: ColorSpec.default() })],
		[48, (style, rest) => style.add(new Style({ bgcolor: extendedColor(rest) }))],
		[49, adding({ bgcolor: ColorSpec.default() })],
		[58, (style, rest) => (extendedColor(rest), style)],
		[54, adding({
			frame: false,
			encircle: false
		})],
		[55, adding({ overline: false })],
		...Array.from({ length: 8 }, (_, n) => [
			[30 + n, adding({ color: ColorSpec.fromAnsi(n) })],
			[40 + n, adding({ bgcolor: ColorSpec.fromAnsi(n) })],
			[90 + n, adding({ color: ColorSpec.fromAnsi(n + 8) })],
			[100 + n, adding({ bgcolor: ColorSpec.fromAnsi(n + 8) })]
		]).flat()
	]);
	var identity = (style) => style;
	/**
	* \`params\` applied to \`style\`. An empty parameter is 0 and one above 255 is
	* 255; one that is not a number — a colon sub-parameter — is skipped, as in
	* Rich.
	*/
	function applySgr(style, params) {
		const codes = params.split(";").filter((code) => /^\\d*$/.test(code)).map((code) => Math.min(255, Number(code))).values();
		let result = style;
		for (const code of codes) result = (SGR_OPS.get(code) ?? identity)(result, codes);
		return result;
	}
	var BLANK = [" ", NULL_STYLE];
	/** Erase in line: the cells before the cursor go blank, the ones from it on go. */
	function erase(cells, column, mode) {
		if (mode !== "0") cells.fill(BLANK, 0, Math.min(column + 1, cells.length));
		if (mode !== "1") cells.length = Math.min(column, cells.length);
	}
	/**
	* A stateful decoder: the style an escape sets carries on across lines, and
	* across calls, as it does on a terminal. Use one decoder per stream and hand
	* it whole lines, so output read a line at a time decodes as it would have
	* all at once. It buffers nothing: a chunk cut mid-line or mid-escape decodes
	* as the line it appears to be.
	*/
	var AnsiDecoder = class {
		sgr = NULL_STYLE;
		link = void 0;
		/** One \`RichText\` per line of \`ansi\`; a final newline ends a line rather than starting one. */
		decode(ansi) {
			return (ansi.match(/[^\\n]*\\n|[^\\n]+/g) ?? []).map((line) => this.decodeLine(line.replace(/\\r?\\n$/, "")));
		}
		/**
		* One line of output, holding no \`\\n\`, written the way a terminal writes
		* it: \`\\r\` returns to the first column, and text overwrites from there.
		*/
		decodeLine(line) {
			const cells = [];
			let column = 0;
			for (const token of tokens(line)) switch (token.kind) {
				case "text": {
					const style = this.sgr.withLink(this.link);
					for (const char of token.text) cells[column++] = [char, style];
					break;
				}
				case "return":
					column = 0;
					break;
				case "erase":
					erase(cells, column, token.mode);
					break;
				case "sgr":
					this.sgr = applySgr(this.sgr, token.params);
					break;
				case "link": this.link = token.uri === "" ? void 0 : token.uri;
			}
			const runs = [];
			for (const [char, style] of cells) {
				const last = runs.at(-1);
				if (last?.[1].equals(style)) last[0] += char;
				else runs.push([char, style]);
			}
			return RichText.assemble(runs);
		}
	};
	/**
	* \`ansi\` as one \`RichText\`, its lines joined by \`\\n\` — Rich's
	* \`Text.from_ansi\`. \`options\` describe the result the way they describe any
	* \`RichText\`.
	*/
	function decodeAnsi(ansi, options) {
		const result = new RichText("", options);
		new AnsiDecoder().decode(ansi).forEach((line, index) => {
			if (index > 0) result.append("\\n");
			result.append(line);
		});
		return result;
	}
	//#endregion
	//#region src/core/emoji.ts
	/**
	* Emoji shortcode support — dictionary, replacement, and renderable.
	*/
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
	var NoEmoji = class extends Error {
		constructor(name) {
			super(\`No emoji with name: "\${name}"\`);
			this.name = "NoEmoji";
		}
	};
	var Emoji = class {
		name;
		_char;
		_style;
		_variant;
		constructor(name, style, variant) {
			const emoji = EMOJI[name];
			if (emoji === void 0) throw new NoEmoji(name);
			this.name = name;
			this._char = emoji;
			this._style = style;
			this._variant = variant;
		}
		toString() {
			const suffix = this._variant === "emoji" ? "️" : this._variant === "text" ? "︎" : "";
			return this._char + suffix;
		}
		*render(_options) {
			yield new Segment(this.toString(), this._style);
		}
		static replace(text) {
			return emojiReplace(text);
		}
	};
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
	/**
	* Escapes markup characters so they render as literal text.
	*/
	function escape(text) {
		return text.replace(/\\[/g, "\\\\[");
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
	var ISO8601Highlighter = class extends RegexHighlighter {
		static baseStyle = "iso8601.";
		static highlights = [
			/(?<date>\\d{4}-\\d{2}-\\d{2})/g,
			/(?<time>\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?)/g,
			/(?<timezone>[+-]\\d{2}:\\d{2}|Z)/g
		];
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
	//#region src/core/spinnerData.ts
	/**
	* Built-in spinner frame data.
	* [LAW:one-type-per-behavior] All spinners are instances of SpinnerData — differ only by frame data.
	*/
	var SPINNERS = {
		dots: {
			frames: [
				"⠋",
				"⠙",
				"⠹",
				"⠸",
				"⠼",
				"⠴",
				"⠦",
				"⠧",
				"⠇",
				"⠏"
			],
			interval: 80
		},
		dots2: {
			frames: [
				"⣾",
				"⣽",
				"⣻",
				"⢿",
				"⡿",
				"⣟",
				"⣯",
				"⣷"
			],
			interval: 80
		},
		dots3: {
			frames: [
				"⠋",
				"⠙",
				"⠚",
				"⠞",
				"⠖",
				"⠦",
				"⠴",
				"⠲",
				"⠳",
				"⠓"
			],
			interval: 80
		},
		line: {
			frames: [
				"-",
				"\\\\",
				"|",
				"/"
			],
			interval: 130
		},
		line2: {
			frames: [
				"⠂",
				"-",
				"–",
				"—",
				"–",
				"-"
			],
			interval: 100
		},
		pipe: {
			frames: [
				"┤",
				"┘",
				"┴",
				"└",
				"├",
				"┌",
				"┬",
				"┐"
			],
			interval: 100
		},
		simpleDots: {
			frames: [
				".  ",
				".. ",
				"...",
				"   "
			],
			interval: 400
		},
		simpleDotsScrolling: {
			frames: [
				".  ",
				".. ",
				"...",
				" ..",
				"  .",
				"   "
			],
			interval: 200
		},
		star: {
			frames: [
				"✶",
				"✸",
				"✹",
				"✺",
				"✹",
				"✷"
			],
			interval: 70
		},
		star2: {
			frames: [
				"+",
				"x",
				"*"
			],
			interval: 80
		},
		flip: {
			frames: [
				"_",
				"_",
				"_",
				"-",
				"\`",
				"\`",
				"'",
				"´",
				"-",
				"_",
				"_",
				"_"
			],
			interval: 70
		},
		hamburger: {
			frames: [
				"☱",
				"☲",
				"☴"
			],
			interval: 100
		},
		growVertical: {
			frames: [
				"▁",
				"▃",
				"▄",
				"▅",
				"▆",
				"▇",
				"▆",
				"▅",
				"▄",
				"▃"
			],
			interval: 120
		},
		growHorizontal: {
			frames: [
				"▏",
				"▎",
				"▍",
				"▌",
				"▋",
				"▊",
				"▉",
				"▊",
				"▋",
				"▌",
				"▍",
				"▎"
			],
			interval: 120
		},
		balloon: {
			frames: [
				" ",
				".",
				"o",
				"O",
				"@",
				"*",
				" "
			],
			interval: 140
		},
		balloon2: {
			frames: [
				".",
				"o",
				"O",
				"°",
				"O",
				"o",
				"."
			],
			interval: 120
		},
		noise: {
			frames: [
				"▓",
				"▒",
				"░"
			],
			interval: 100
		},
		bounce: {
			frames: [
				"⠁",
				"⠂",
				"⠄",
				"⠂"
			],
			interval: 120
		},
		boxBounce: {
			frames: [
				"▖",
				"▘",
				"▝",
				"▗"
			],
			interval: 120
		},
		boxBounce2: {
			frames: [
				"▌",
				"▀",
				"▐",
				"▄"
			],
			interval: 100
		},
		triangle: {
			frames: [
				"◢",
				"◣",
				"◤",
				"◥"
			],
			interval: 50
		},
		arc: {
			frames: [
				"◜",
				"◠",
				"◝",
				"◞",
				"◡",
				"◟"
			],
			interval: 100
		},
		circle: {
			frames: [
				"◡",
				"⊙",
				"◠"
			],
			interval: 120
		},
		squareCorners: {
			frames: [
				"◰",
				"◳",
				"◲",
				"◱"
			],
			interval: 180
		},
		circleQuarters: {
			frames: [
				"◴",
				"◷",
				"◶",
				"◵"
			],
			interval: 120
		},
		circleHalves: {
			frames: [
				"◐",
				"◓",
				"◑",
				"◒"
			],
			interval: 50
		},
		squish: {
			frames: ["╫", "╪"],
			interval: 100
		},
		toggle: {
			frames: ["⊶", "⊷"],
			interval: 250
		},
		toggle2: {
			frames: ["▫", "▪"],
			interval: 80
		},
		toggle3: {
			frames: ["□", "■"],
			interval: 120
		},
		toggle4: {
			frames: [
				"■",
				"□",
				"▪",
				"▫"
			],
			interval: 100
		},
		toggle5: {
			frames: ["▮", "▯"],
			interval: 100
		},
		toggle6: {
			frames: ["ဝ", "၀"],
			interval: 300
		},
		toggle7: {
			frames: ["⦾", "⦿"],
			interval: 80
		},
		toggle8: {
			frames: ["◍", "◌"],
			interval: 100
		},
		toggle9: {
			frames: ["◉", "◎"],
			interval: 100
		},
		toggle10: {
			frames: [
				"㊂",
				"㊀",
				"㊁"
			],
			interval: 100
		},
		toggle11: {
			frames: ["⧇", "⧆"],
			interval: 50
		},
		toggle12: {
			frames: ["☗", "☖"],
			interval: 120
		},
		toggle13: {
			frames: [
				"=",
				"*",
				"-"
			],
			interval: 80
		},
		arrow: {
			frames: [
				"←",
				"↖",
				"↑",
				"↗",
				"→",
				"↘",
				"↓",
				"↙"
			],
			interval: 100
		},
		arrow2: {
			frames: [
				"⬆️ ",
				"↗️ ",
				"➡️ ",
				"↘️ ",
				"⬇️ ",
				"↙️ ",
				"⬅️ ",
				"↖️ "
			],
			interval: 80
		},
		arrow3: {
			frames: [
				"▹▹▹▹▹",
				"▸▹▹▹▹",
				"▹▸▹▹▹",
				"▹▹▸▹▹",
				"▹▹▹▸▹",
				"▹▹▹▹▸"
			],
			interval: 120
		},
		bouncingBar: {
			frames: [
				"[    ]",
				"[=   ]",
				"[==  ]",
				"[=== ]",
				"[ ===]",
				"[  ==]",
				"[   =]",
				"[    ]",
				"[   =]",
				"[  ==]",
				"[ ===]",
				"[====]",
				"[=== ]",
				"[==  ]",
				"[=   ]"
			],
			interval: 80
		},
		bouncingBall: {
			frames: [
				"( ●    )",
				"(  ●   )",
				"(   ●  )",
				"(    ● )",
				"(     ●)",
				"(    ● )",
				"(   ●  )",
				"(  ●   )",
				"( ●    )",
				"(●     )"
			],
			interval: 80
		},
		smiley: {
			frames: ["😄 ", "😝 "],
			interval: 200
		},
		monkey: {
			frames: [
				"🙈 ",
				"🙈 ",
				"🙉 ",
				"🙊 "
			],
			interval: 300
		},
		hearts: {
			frames: [
				"💛 ",
				"💙 ",
				"💜 ",
				"💚 ",
				"❤️ "
			],
			interval: 100
		},
		clock: {
			frames: [
				"🕛 ",
				"🕐 ",
				"🕑 ",
				"🕒 ",
				"🕓 ",
				"🕔 ",
				"🕕 ",
				"🕖 ",
				"🕗 ",
				"🕘 ",
				"🕙 ",
				"🕚 "
			],
			interval: 100
		},
		earth: {
			frames: [
				"🌍 ",
				"🌎 ",
				"🌏 "
			],
			interval: 180
		},
		moon: {
			frames: [
				"🌑 ",
				"🌒 ",
				"🌓 ",
				"🌔 ",
				"🌕 ",
				"🌖 ",
				"🌗 ",
				"🌘 "
			],
			interval: 80
		},
		runner: {
			frames: ["🚶 ", "🏃 "],
			interval: 140
		},
		pong: {
			frames: [
				"▐⠂       ▌",
				"▐⠈       ▌",
				"▐ ⠂      ▌",
				"▐ ⠠      ▌",
				"▐  ⡀     ▌",
				"▐  ⠠     ▌",
				"▐   ⠂    ▌",
				"▐   ⠈    ▌",
				"▐    ⠂   ▌",
				"▐    ⠠   ▌",
				"▐     ⡀  ▌",
				"▐     ⠠  ▌",
				"▐      ⠂ ▌",
				"▐      ⠈ ▌",
				"▐       ⠂▌",
				"▐       ⠠▌",
				"▐       ⡀▌",
				"▐      ⠠ ▌",
				"▐      ⠂ ▌",
				"▐     ⠈  ▌",
				"▐     ⠂  ▌",
				"▐    ⠠   ▌",
				"▐    ⡀   ▌",
				"▐   ⠠    ▌",
				"▐   ⠂    ▌",
				"▐  ⠈     ▌",
				"▐  ⠂     ▌",
				"▐ ⠠      ▌",
				"▐ ⡀      ▌",
				"▐⠠       ▌"
			],
			interval: 80
		},
		material: {
			frames: [
				"█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
				"██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
				"███▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
				"████▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
				"██████▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
				"██████▁▁▁▁▁▁▁▁▁▁▁▁▁▁",
				"███████▁▁▁▁▁▁▁▁▁▁▁▁▁",
				"████████▁▁▁▁▁▁▁▁▁▁▁▁",
				"█████████▁▁▁▁▁▁▁▁▁▁▁",
				"█████████▁▁▁▁▁▁▁▁▁▁▁",
				"██████████▁▁▁▁▁▁▁▁▁▁",
				"███████████▁▁▁▁▁▁▁▁▁",
				"█████████████▁▁▁▁▁▁▁",
				"██████████████▁▁▁▁▁▁",
				"██████████████▁▁▁▁▁▁",
				"▁██████████████▁▁▁▁▁",
				"▁██████████████▁▁▁▁▁",
				"▁██████████████▁▁▁▁▁",
				"▁▁██████████████▁▁▁▁",
				"▁▁▁██████████████▁▁▁",
				"▁▁▁▁█████████████▁▁▁",
				"▁▁▁▁██████████████▁▁",
				"▁▁▁▁██████████████▁▁",
				"▁▁▁▁▁██████████████▁",
				"▁▁▁▁▁██████████████▁",
				"▁▁▁▁▁██████████████▁",
				"▁▁▁▁▁▁██████████████",
				"▁▁▁▁▁▁██████████████",
				"▁▁▁▁▁▁▁█████████████",
				"▁▁▁▁▁▁▁█████████████",
				"▁▁▁▁▁▁▁▁████████████",
				"▁▁▁▁▁▁▁▁████████████",
				"▁▁▁▁▁▁▁▁▁███████████",
				"▁▁▁▁▁▁▁▁▁███████████",
				"▁▁▁▁▁▁▁▁▁▁██████████",
				"▁▁▁▁▁▁▁▁▁▁██████████",
				"▁▁▁▁▁▁▁▁▁▁▁▁████████",
				"▁▁▁▁▁▁▁▁▁▁▁▁▁███████",
				"▁▁▁▁▁▁▁▁▁▁▁▁▁▁██████",
				"▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████",
				"▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█████",
				"█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████",
				"██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███",
				"██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███",
				"███▁▁▁▁▁▁▁▁▁▁▁▁▁▁███",
				"████▁▁▁▁▁▁▁▁▁▁▁▁▁▁██",
				"█████▁▁▁▁▁▁▁▁▁▁▁▁▁▁█",
				"█████▁▁▁▁▁▁▁▁▁▁▁▁▁▁█",
				"██████▁▁▁▁▁▁▁▁▁▁▁▁▁█",
				"████████▁▁▁▁▁▁▁▁▁▁▁▁",
				"█████████▁▁▁▁▁▁▁▁▁▁▁",
				"█████████▁▁▁▁▁▁▁▁▁▁▁",
				"█████████▁▁▁▁▁▁▁▁▁▁▁",
				"█████████▁▁▁▁▁▁▁▁▁▁▁",
				"███████████▁▁▁▁▁▁▁▁▁",
				"████████████▁▁▁▁▁▁▁▁",
				"████████████▁▁▁▁▁▁▁▁",
				"██████████████▁▁▁▁▁▁",
				"██████████████▁▁▁▁▁▁",
				"▁██████████████▁▁▁▁▁",
				"▁██████████████▁▁▁▁▁",
				"▁▁▁██████████████▁▁▁",
				"▁▁▁▁▁████████████▁▁▁",
				"▁▁▁▁▁████████████▁▁▁",
				"▁▁▁▁▁▁███████████▁▁▁",
				"▁▁▁▁▁▁▁▁█████████▁▁▁",
				"▁▁▁▁▁▁▁▁█████████▁▁▁",
				"▁▁▁▁▁▁▁▁▁█████████▁▁",
				"▁▁▁▁▁▁▁▁▁█████████▁▁",
				"▁▁▁▁▁▁▁▁▁▁█████████▁"
			],
			interval: 17
		},
		aesthetic: {
			frames: [
				"▰▱▱▱▱▱▱",
				"▰▰▱▱▱▱▱",
				"▰▰▰▱▱▱▱",
				"▰▰▰▰▱▱▱",
				"▰▰▰▰▰▱▱",
				"▰▰▰▰▰▰▱",
				"▰▰▰▰▰▰▰",
				"▰▱▱▱▱▱▱"
			],
			interval: 80
		}
	};
	var DEFAULT_SPINNER = "dots";
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
	//#region src/renderables/constrain.ts
	/**
	* Constrain — wraps a renderable and constrains its maximum width.
	*/
	var Constrain = class {
		renderable;
		width;
		constructor(renderable, width) {
			this.renderable = renderable;
			this.width = width;
		}
		*render(options) {
			const constrainedWidth = this.width !== void 0 ? Math.min(this.width, options.maxWidth) : options.maxWidth;
			const innerOptions = {
				...options,
				maxWidth: constrainedWidth
			};
			yield* this.renderable.render(innerOptions);
		}
		measure(options) {
			if (isMeasurable(this.renderable)) {
				const measurement = Measurement.get(options, this.renderable);
				const maxWidth = this.width !== void 0 ? Math.min(this.width, options.maxWidth) : options.maxWidth;
				return {
					minimum: measurement.minimum,
					maximum: Math.min(measurement.maximum, maxWidth)
				};
			}
			return {
				minimum: 1,
				maximum: options.maxWidth
			};
		}
	};
	//#endregion
	//#region src/renderables/align.ts
	/**
	* Align — wraps a renderable and aligns its output horizontally.
	*/
	var Align = class {
		renderable;
		align;
		constructor(renderable, align = "center") {
			this.renderable = renderable;
			this.align = align;
		}
		*render(options) {
			const maxWidth = options.maxWidth;
			const segments = [...this.renderable.render(options)];
			const lines = Segment.splitLines(segments);
			for (const line of lines) {
				const gap = maxWidth - Segment.getLineLength(line);
				const leftPad = this.align === "right" ? gap : this.align === "center" ? Math.floor(gap / 2) : 0;
				if (leftPad > 0) yield new Segment(" ".repeat(leftPad));
				yield* line;
				const rightPad = gap - leftPad;
				if (rightPad > 0) yield new Segment(" ".repeat(rightPad));
				yield Segment.line();
			}
		}
		measure(options) {
			if (isMeasurable(this.renderable)) {
				const measurement = Measurement.get(options, this.renderable);
				return {
					minimum: Math.max(1, measurement.minimum),
					maximum: measurement.maximum
				};
			}
			return {
				minimum: 1,
				maximum: options.maxWidth
			};
		}
	};
	//#endregion
	//#region src/renderables/padding.ts
	/**
	* Padding — wraps a renderable with whitespace padding on all four sides.
	*/
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
	/**
	* Divides the requested width once into the three spans a padded row is made
	* of, in the order they are worth spending cells on.
	*
	* The three used to be derived separately and disagree where it matters:
	* \`render\` took the canvas as \`Math.max(1, maxWidth - left - right)\`, which
	* clamps *up*, so a padding of 1 inside a 2-cell request drew 3-cell content
	* rows beside 2-cell blank rows — an open frame the terminal then soft-wraps.
	* Content takes its first cell before padding takes any, for the reason
	* \`layoutPanel\` gives: a squeeze should cost you the decoration, not the thing
	* being decorated.
	*/
	function layoutPadding(outerWidth, leftWanted, rightWanted) {
		let budget = cellCount(outerWidth);
		const take = (want) => {
			const got = Math.min(want, budget);
			budget -= got;
			return got;
		};
		const firstContentCell = take(1);
		const left = take(leftWanted);
		const right = take(rightWanted);
		return {
			left,
			contentWidth: firstContentCell + budget,
			right
		};
	}
	/** The full width of a padded row — the division, added back up. */
	function rowWidth(geometry) {
		return geometry.left + geometry.contentWidth + geometry.right;
	}
	var Padding = class {
		renderable;
		top;
		right;
		bottom;
		left;
		style;
		expand;
		constructor(renderable, padding, options) {
			const [top, right, bottom, left] = normalizePadding(padding);
			this.renderable = renderable;
			this.top = top;
			this.right = right;
			this.bottom = bottom;
			this.left = left;
			this.style = options?.style ?? NULL_STYLE;
			this.expand = options?.expand !== false;
		}
		*render(rawOptions) {
			const options = withBoundedWidth(rawOptions, this);
			const geometry = layoutPadding(options.maxWidth, this.left, this.right);
			const innerOptions = {
				...options,
				maxWidth: geometry.contentWidth,
				height: insetHeight(options.height, this.top + this.bottom)
			};
			const segments = [...this.renderable.render(innerOptions)];
			const lines = fitHeight(Segment.splitLines(segments), innerOptions.height);
			const resolved = getStyle(options, this.style);
			const style = resolved.isNull ? void 0 : resolved;
			const leftPad = new Segment(" ".repeat(geometry.left), style);
			const rightPad = new Segment(" ".repeat(geometry.right), style);
			const blankLine = new Segment(" ".repeat(rowWidth(geometry)), style);
			for (let i = 0; i < this.top; i++) {
				yield blankLine;
				yield Segment.line();
			}
			for (const line of lines) {
				yield leftPad;
				yield* Segment.adjustLineLength(line, geometry.contentWidth, style, this.expand);
				yield rightPad;
				yield Segment.line();
			}
			for (let i = 0; i < this.bottom; i++) {
				yield blankLine;
				yield Segment.line();
			}
		}
		measure(rawOptions) {
			const options = withCellWidth(rawOptions);
			const geometry = layoutPadding(options.maxWidth, this.left, this.right);
			const overhead = geometry.left + geometry.right;
			if (isMeasurable(this.renderable)) {
				const measurement = Measurement.get({
					...options,
					maxWidth: geometry.contentWidth
				}, this.renderable);
				const maximum = Math.min(options.maxWidth, measurement.maximum + overhead);
				return {
					minimum: Math.min(measurement.minimum + overhead, maximum),
					maximum
				};
			}
			return {
				minimum: overhead,
				maximum: options.maxWidth
			};
		}
	};
	//#endregion
	//#region src/renderables/viewport.ts
	/**
	* Viewport — a fixed number of rows onto a taller renderable, scrolled by an
	* offset that cannot leave the content.
	*
	* Its rows, under the \`Height\` contract in \`../core/protocol.ts\`: the region's
	* when it is given one; otherwise its own configured rows, or the content's
	* full length when it has none, capped by any ceiling. It renders its content
	* with no height, because the content's natural length is the scroll extent,
	* and pads or crops what comes back to its rows — its rows are its own height,
	* not a region someone else will shape.
	*
	* Its width is the width it is given, in both directions: each row is cropped
	* or padded to it, so content that ignores its width cannot spill past the
	* viewport's edge and the scrollbar, drawn in a gutter at that edge, lines up
	* down every row. [LAW:dataflow-not-control-flow] A viewport with no scrollbar
	* has a gutter zero cells wide, and every row takes the same path either way.
	*
	* [LAW:no-ambient-temporal-coupling] Neither half of what an offset is clamped
	* against exists before a render: the rows come from the budget the render is
	* handed, and the content's length from rendering it at the width it is handed.
	* So \`scrollTo\`, \`scrollBy\` and \`ensureVisible\` do not move anything when they
	* are called. Each queues a move, and the next render resolves the queue in
	* call order, clamping after every move, against the rows and length that
	* render found. Calling an operation before the first render, or three of them
	* between two renders, is the same code path as calling one.
	*/
	/** A heavy line for the thumb on a light line for the track. */
	var SCROLLBAR = {
		thumb: {
			glyph: "┃",
			style: "scrollbar.thumb"
		},
		track: {
			glyph: "│",
			style: "scrollbar.track"
		}
	};
	/** The absence of a scrollbar, as a gutter zero cells wide. */
	var NO_SCROLLBAR = {
		thumb: {
			glyph: "",
			style: NULL_STYLE
		},
		track: {
			glyph: "",
			style: NULL_STYLE
		}
	};
	var Viewport = class {
		/**
		* What the viewport shows. Replace it to show new content from the same
		* scroll position — a view rebuilt every frame keeps one \`Viewport\`.
		*/
		content;
		rows;
		scrollbar;
		_offset = 0;
		_moves = [];
		constructor(content, options = {}) {
			this.content = content;
			this.rows = options.rows;
			this.scrollbar = options.scrollbar ?? NO_SCROLLBAR;
		}
		/**
		* The first content line the last render showed. A move requested since is
		* not reflected until the next render resolves it.
		*/
		get offset() {
			return this._offset;
		}
		/** Scroll so \`line\` is the first line shown. */
		scrollTo(line) {
			this._moves.push(() => line);
		}
		/** Scroll by \`lines\`: down when positive, up when negative. */
		scrollBy(lines) {
			this._moves.push((offset) => offset + lines);
		}
		/**
		* Scroll the least distance that shows lines \`start\` up to but not
		* including \`end\` — lines of the content as it renders at the viewport's
		* width, so an item that wraps spans more than one. A range already in view does not move; one taller than
		* the viewport shows its first line at the top.
		*/
		ensureVisible(start, end) {
			this._moves.push((offset, { rows }) => Math.min(start, Math.max(offset, end - rows)));
		}
		*render(rawOptions) {
			const { height, ...options } = withBoundedWidth(rawOptions, this);
			const gutter = gutterWidth(this.scrollbar);
			const contentWidth = cellCount(options.maxWidth - gutter);
			const lines = Segment.splitLines(this.content.render({
				...options,
				maxWidth: contentWidth
			}));
			const extent = {
				rows: viewRows(height, this.rows, lines.length),
				lines: lines.length
			};
			this._offset = this._moves.reduce((offset, move) => clampOffset(move(offset, extent), extent), clampOffset(this._offset, extent));
			this._moves = [];
			const shown = fitHeight(lines.slice(this._offset, this._offset + extent.rows), {
				rows: extent.rows,
				exact: true
			});
			const thumb = thumbRows(extent, this._offset);
			const drawn = Math.min(gutter, options.maxWidth);
			const cell = ({ glyph, style }) => {
				const resolved = getStyle(options, style);
				return Segment.adjustLineLength([new Segment(glyph, resolved)], drawn, resolved);
			};
			const thumbCell = cell(this.scrollbar.thumb);
			const trackCell = cell(this.scrollbar.track);
			for (const [row, line] of shown.entries()) {
				yield* Segment.adjustLineLength(line, contentWidth);
				yield* row >= thumb.start && row < thumb.end ? thumbCell : trackCell;
				yield Segment.line();
			}
		}
		measure(rawOptions) {
			const options = withCellWidth(rawOptions);
			const gutter = gutterWidth(this.scrollbar);
			const inner = {
				...options,
				maxWidth: cellCount(options.maxWidth - gutter)
			};
			const content = isMeasurable(this.content) ? Measurement.get(inner, this.content) : new Measurement(Math.min(1, inner.maxWidth), inner.maxWidth);
			return new Measurement(content.minimum + gutter, content.maximum + gutter).withMaximum(options.maxWidth);
		}
	};
	/** The cells a scrollbar's gutter takes from the content: its wider glyph. */
	function gutterWidth({ thumb, track }) {
		return Math.max(cellLen(thumb.glyph), cellLen(track.glyph));
	}
	/**
	* The rows of the track the thumb covers, from \`start\` up to but not including
	* \`end\`: its length is the share of the content in view, and its position the
	* share of the scroll travelled. Content that fits fills the track.
	*
	* An end of the track means an end of the content. Rounded alone, the position
	* reached the bottom while lines were still hidden below — at 10 rows of 20
	* lines, offset 9 rounds onto the last position. So an offset short of an end
	* is held one row off it, wherever the track has a row between its ends.
	*/
	function thumbRows({ rows, lines }, offset) {
		const size = Math.min(rows, Math.max(1, Math.round(rows * rows / Math.max(lines, rows, 1))));
		const travel = rows - size;
		const last = Math.max(1, lines - rows);
		const proportional = Math.round(offset * travel / last);
		const start = Math.max(Math.min(proportional, travel - Math.min(last - offset, 1)), Math.min(offset, 1, travel));
		return {
			start,
			end: start + size
		};
	}
	/** The rows a viewport shows, from its budget, its own configured rows, and its content's length. */
	function viewRows(height, rows, lines) {
		return regionRows(height) ?? cellCount(Math.min(rows ?? lines, height?.rows ?? Infinity));
	}
	/** An offset held to the lines that exist: never above the first, never past the last full view. */
	function clampOffset(offset, { rows, lines }) {
		return cellCount(Math.min(offset, lines - rows));
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
	//#region src/renderables/group.ts
	/**
	* Group — renders multiple renderables in sequence.
	* No visual chrome — purely a container.
	*/
	var Group = class {
		renderables;
		constructor(...renderables) {
			this.renderables = renderables;
		}
		*render(options) {
			const memberOptions = {
				...options,
				height: stackedHeight(options.height)
			};
			for (const renderable of this.renderables) yield* renderable.render(memberOptions);
		}
	};
	//#endregion
	//#region src/renderables/progressBar.ts
	/**
	* ProgressBar — a visual progress bar rendered with block characters.
	*/
	var FULL_BLOCK = "━";
	var EMPTY_BLOCK$1 = "━";
	var ProgressBar = class {
		total;
		completed;
		width;
		pulse;
		style;
		completeStyle;
		finishedStyle;
		constructor(options) {
			this.total = options?.total ?? 100;
			this.completed = options?.completed ?? 0;
			this.width = options?.width;
			this.pulse = options?.pulse ?? false;
			this.style = options?.style ?? NULL_STYLE;
			this.completeStyle = options?.completeStyle ?? "bar.complete";
			this.finishedStyle = options?.finishedStyle ?? "bar.finished";
		}
		get percentComplete() {
			if (this.total <= 0) return 0;
			return Math.min(1, Math.max(0, this.completed / this.total));
		}
		*render(options) {
			const barWidth = this.width ?? Math.min(40, options.maxWidth);
			const percent = this.percentComplete;
			const isFinished = percent >= 1;
			const filledWidth = Math.round(barWidth * percent);
			const emptyWidth = barWidth - filledWidth;
			const fill = getStyle(options, isFinished ? this.finishedStyle : this.completeStyle);
			const back = getStyle(options, this.style);
			const fillStyle = fill.isNull ? void 0 : fill;
			const bgStyle = back.isNull ? void 0 : back;
			if (filledWidth > 0) yield new Segment(FULL_BLOCK.repeat(filledWidth), fillStyle);
			if (emptyWidth > 0) yield new Segment(EMPTY_BLOCK$1.repeat(emptyWidth), bgStyle);
		}
		measure(_options) {
			return {
				minimum: 4,
				maximum: this.width ?? 40
			};
		}
	};
	//#endregion
	//#region src/renderables/spinner.ts
	/**
	* Spinner — animated terminal spinner with optional text label.
	*/
	var Spinner = class {
		name;
		text;
		speed;
		style;
		_data;
		_frameIndex;
		_lastUpdate;
		constructor(name, text, options) {
			const spinnerName = name ?? "dots";
			const data = SPINNERS[spinnerName];
			if (!data) throw new Error(\`Unknown spinner: "\${spinnerName}"\`);
			this.name = spinnerName;
			this.text = text;
			this.speed = options?.speed ?? 1;
			this.style = options?.style ?? NULL_STYLE;
			this._data = data;
			this._frameIndex = 0;
			this._lastUpdate = Date.now();
		}
		get frames() {
			return this._data.frames;
		}
		get interval() {
			return this._data.interval;
		}
		/** Advance frame based on elapsed time and return current frame. */
		_currentFrame() {
			const now = Date.now();
			const elapsed = now - this._lastUpdate;
			const effectiveInterval = this.interval / this.speed;
			if (elapsed >= effectiveInterval) {
				const steps = Math.floor(elapsed / effectiveInterval);
				this._frameIndex = (this._frameIndex + steps) % this._data.frames.length;
				this._lastUpdate = now;
			}
			return this._data.frames[this._frameIndex];
		}
		*render(options) {
			const frame = this._currentFrame();
			const style = getStyle(options, this.style);
			yield new Segment(frame, style.isNull ? void 0 : style);
			if (this.text) yield new Segment(\` \${this.text}\`);
		}
		measure(_options) {
			const frameWidth = Math.max(...this._data.frames.map((f) => cellLen(f)));
			return {
				minimum: frameWidth,
				maximum: frameWidth + (this.text ? cellLen(this.text) + 1 : 0)
			};
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
	//#region src/renderables/tree.ts
	/**
	* Tree — hierarchical view with guide lines.
	*/
	var GUIDE_BRANCH = "├── ";
	var GUIDE_LAST = "└── ";
	var GUIDE_VERT = "│   ";
	var GUIDE_SPACE = "    ";
	var GUIDE_BRANCH_ASCII = "+-- ";
	var GUIDE_LAST_ASCII = "+-- ";
	var GUIDE_VERT_ASCII = "|   ";
	/**
	* How wide a label wants to be. A label with no \`measure\` cannot say, and the
	* offer is the honest stand-in — including when the offer is unbounded, which
	* is where \`withBoundedWidth\` reports it rather than guessing a number.
	*/
	function labelWidth(options, label) {
		if (!isMeasurable(label)) return options.maxWidth;
		return Measurement.get(options, label).maximum;
	}
	var Tree = class Tree {
		label;
		children;
		expanded;
		hideRoot;
		guideStyle;
		style;
		constructor(label, options) {
			this.label = embed(label);
			this.children = [];
			this.expanded = options?.expanded !== false;
			this.hideRoot = options?.hideRoot ?? false;
			this.guideStyle = options?.guide_style ?? NULL_STYLE;
			this.style = options?.style ?? NULL_STYLE;
		}
		add(label, options) {
			const child = new Tree(label, {
				guide_style: options?.guide_style,
				style: options?.style,
				expanded: options?.expanded
			});
			this.children.push(child);
			return child;
		}
		*render(rawOptions) {
			const options = withBoundedWidth(rawOptions, this);
			for (const row of this._rows(options, [], !this.hideRoot)) yield* this._renderRow(options, row);
		}
		/**
		* The tree walked into the rows it emits, one row per label, guides first.
		*
		* [LAW:one-source-of-truth] The walk that decides which rows exist and what
		* leads them is here and only here. \`render\` turns each row into segments and
		* \`measure\` reads each row's width off the same sequence, so the two cannot
		* come to disagree about how many rows there are or how wide the guides on
		* them run — which they would the moment a second walk existed.
		*/
		*_rows(options, prefixes, showLabel) {
			const ascii = options.asciiOnly ?? false;
			if (showLabel) yield {
				guides: prefixes,
				guideStyles: [this.guideStyle],
				label: this.label
			};
			if (!this.expanded) return;
			for (let i = 0; i < this.children.length; i++) {
				const child = this.children[i];
				const isLast = i === this.children.length - 1;
				const branch = ascii ? isLast ? GUIDE_LAST_ASCII : GUIDE_BRANCH_ASCII : isLast ? GUIDE_LAST : GUIDE_BRANCH;
				const continuation = ascii ? isLast ? GUIDE_SPACE : GUIDE_VERT_ASCII : isLast ? GUIDE_SPACE : GUIDE_VERT;
				yield {
					guides: [...prefixes, branch],
					guideStyles: [child.guideStyle, this.guideStyle],
					label: child.label
				};
				if (child.expanded && child.children.length > 0) {
					const grandPrefixes = [...prefixes, continuation];
					for (let j = 0; j < child.children.length; j++) yield* child.children[j]._rows(options, grandPrefixes, true);
				}
			}
		}
		/**
		* One row of the tree: its guides, then its label in whatever width the
		* guides left.
		*
		* [LAW:single-enforcer] The row's width is divided in exactly one place, here.
		* Before this, each call site emitted its guides and then handed the label
		* \`options\` unchanged — the label was told it had the whole outer width while
		* the guides had already spent four cells of it, so a tree at maxWidth 5
		* emitted rows of 9. That is the same defect Panel and Table were fixed for,
		* and the same fix: divide the requested width once and let every part read
		* its share off the division. \`options\` arrives parsed from \`render\`.
		*
		* [LAW:single-enforcer] Tree also owns its row boundaries here rather than
		* depending on label renderables to invent trailing newlines.
		*/
		*_renderRow(options, row) {
			const guideStyle = row.guideStyles.map((style) => getStyle(options, style)).find((style) => !style.isNull);
			let left = options.maxWidth;
			for (const text of row.guides) {
				const piece = cellFit(text, asCellCol(left));
				if (piece.length > 0) yield new Segment(piece, guideStyle);
				left -= cellLen(piece);
			}
			yield* Segment.cropLines(row.label.render({
				...options,
				maxWidth: left,
				height: stackedHeight(options.height)
			}), left);
			yield Segment.line();
		}
		measure(options) {
			const parsed = withCellWidth(options);
			const ceiling = parsed.maxWidth;
			let natural = 0;
			for (const row of this._rows(parsed, [], !this.hideRoot)) {
				const guideWidth = row.guides.reduce((sum, text) => sum + cellLen(text), 0);
				natural = Math.max(natural, guideWidth + labelWidth(parsed, row.label));
			}
			const maximum = Math.min(natural, ceiling);
			return {
				minimum: Math.min(4, maximum),
				maximum
			};
		}
	};
	//#endregion
	//#region src/renderables/columns.ts
	/**
	* Columns — arranges renderables in a multi-column layout.
	*/
	var Columns = class {
		renderables;
		expand;
		equal;
		colWidth;
		columnFirst;
		gutterWidth;
		constructor(items, options) {
			this.renderables = items ? [...items].map(embed) : [];
			this.expand = options?.expand ?? false;
			this.equal = options?.equal ?? false;
			this.colWidth = options?.width === void 0 ? void 0 : cellCount(options.width);
			this.columnFirst = options?.columnFirst ?? false;
			this.gutterWidth = 2;
		}
		*render(rawOptions) {
			const items = this.renderables;
			if (items.length === 0) return;
			const options = withBoundedWidth(rawOptions, this);
			const { numCols, colWidths } = this._divide(options);
			const numRows = Math.ceil(items.length / numCols);
			for (let row = 0; row < numRows; row++) {
				const cells = colWidths.map((width, col) => {
					const idx = this.columnFirst ? col * numRows + row : row * numCols + col;
					const item = items[idx];
					return {
						lines: item === void 0 ? [] : Segment.splitLines([...item.render({
							...options,
							maxWidth: width,
							height: stackedHeight(options.height)
						})]),
						width
					};
				});
				yield* Segment.mergeHorizontal(cells, this.gutterWidth);
			}
		}
		/**
		* The requested width divided into columns, once.
		*
		* [LAW:single-enforcer] The three modes disagree only about how many columns
		* there are and how wide each one is, so they disagree in one place. \`render\`
		* lays out against this division and \`_naturalWidth\` is the width at which it
		* comes out as one row of every item.
		*/
		_divide(options) {
			const maxWidth = options.maxWidth;
			const gutter = this.gutterWidth;
			const declared = this._declaredWidth(options);
			if (declared !== void 0) {
				const numCols = Math.max(1, Math.floor((maxWidth + gutter) / (declared + gutter)));
				return {
					numCols,
					colWidths: new Array(numCols).fill(declared)
				};
			}
			if (this.equal) {
				const itemWidth = this._itemWidth(options);
				const numCols = Math.max(1, Math.floor((maxWidth + gutter) / (itemWidth + gutter)));
				const equalWidth = Math.floor((maxWidth - gutter * (numCols - 1)) / numCols);
				return {
					numCols,
					colWidths: new Array(numCols).fill(equalWidth)
				};
			}
			const itemWidth = this._itemWidth(options);
			const numCols = Math.min(this.renderables.length, Math.max(1, Math.floor((maxWidth + gutter) / (itemWidth + gutter))));
			const colW = Math.floor((maxWidth - gutter * (numCols - 1)) / numCols);
			return {
				numCols,
				colWidths: new Array(numCols).fill(colW)
			};
		}
		/**
		* The widest any one item wants to be.
		*
		* An item that cannot measure itself wants the offer, which is what \`Panel\`,
		* \`Padding\`, \`Layout\` and \`Tree\` all answer for the same case — and under an
		* unbounded offer that is \`Infinity\`, so \`withBoundedWidth\` throws and says
		* the request was unanswerable. Counting it as one cell instead reported a
		* natural width of 1, which resolved an unbounded offer to a single column and
		* cropped forty cells of content down to \`"x"\` with no error at all.
		*/
		_itemWidth(options) {
			let widest = 1;
			for (const item of this.renderables) widest = Math.max(widest, isMeasurable(item) ? Measurement.get(options, item).maximum : options.maxWidth);
			return widest;
		}
		/**
		* The declared column width, bounded by the width offered.
		*
		* [LAW:single-enforcer] A declared width is what a column asks for, not what
		* it takes — the contract \`Table._outerWidth\` keeps for a declared table
		* width. Read by \`_divide\` for render and by \`_naturalWidth\` for measure, so
		* the two answer from one number: laid out at the raw declared width, a
		* six-cell column offered three emitted six-cell lines while \`measure\`
		* reported three, and the terminal's soft wrap took the frame of everything
		* printed after it.
		*/
		_declaredWidth(options) {
			return this.colWidth === void 0 ? void 0 : Math.min(this.colWidth, options.maxWidth);
		}
		/** The width at which every item sits on one row: n columns and the gutters between them. */
		_naturalWidth(options) {
			const count = this.renderables.length;
			if (count === 0) return 0;
			return count * (this._declaredWidth(options) ?? this._itemWidth(options)) + this.gutterWidth * (count - 1);
		}
		measure(rawOptions) {
			const parsed = withCellWidth(rawOptions);
			const maximum = Math.min(this._naturalWidth(parsed), parsed.maxWidth);
			return {
				minimum: Math.min(1, maximum),
				maximum
			};
		}
	};
	//#endregion
	//#region src/renderables/flexStrip.ts
	/**
	* FlexStrip — wrap-to-width horizontal layout for \`StyledRenderable\` items.
	*
	* Pack as many items as fit on a line, then break and continue. Each line is
	* an independent sub-strip: optional \`Joiner\` end-caps fire at every line
	* boundary (not just the strip's first/last position), so a line break looks
	* the same as an endpoint to the joiner. Composes with the Strip + Joiner
	* primitive in \`core/strip\` — same \`Joiner\` protocol, no new join semantics.
	*
	* [LAW:dataflow-not-control-flow] The pack walk is the same shape every
	* render: measure each item, render every joiner form (start-cap, end-cap,
	* mid-join) up-front, then sweep items into lines. Line breaks are decided by
	* width data, not by control-flow special cases.
	*
	* [LAW:one-source-of-truth] The Strip primitive owns the join protocol;
	* FlexStrip reuses it verbatim. There is no second concept of "join."
	*/
	function renderToBlock(r, options) {
		const segments = [...r.render(options)];
		let width = 0;
		for (const s of segments) width += s.cellLength;
		return {
			segments,
			width
		};
	}
	var EMPTY_BLOCK = {
		segments: [],
		width: 0
	};
	var PAD_LEFT_BY_ALIGN = {
		left: () => 0,
		justify: () => 0,
		center: (spare) => Math.floor(spare / 2),
		right: (spare) => spare
	};
	function computePadLeft(align, spare) {
		return PAD_LEFT_BY_ALIGN[align](spare);
	}
	function computeSlotFills(align, isFinalLine, spare, itemCount) {
		const slots = Math.max(0, itemCount - 1);
		const totalFill = align === "justify" && !isFinalLine && slots > 0 && spare > 0 ? spare : 0;
		const base = slots > 0 ? Math.floor(totalFill / slots) : 0;
		const extra = totalFill - base * slots;
		return Array.from({ length: slots }, (_, k) => base + (k < extra ? 1 : 0));
	}
	var FlexStrip = class {
		items;
		joiner;
		gap;
		align;
		constructor(items, options) {
			this.items = items;
			this.joiner = options?.joiner;
			this.gap = options?.gap ?? 0;
			this.align = options?.align ?? "left";
		}
		*render(options) {
			const items = this.items;
			if (items.length === 0) return;
			const maxWidth = Math.max(1, options.maxWidth);
			const gap = this.gap;
			const joiner = this.joiner;
			const itemBlocks = items.map((it) => renderToBlock(it, options));
			const startCap = (i) => joiner ? renderToBlock(joiner.join(null, items[i]), options) : EMPTY_BLOCK;
			const endCap = (i) => joiner ? renderToBlock(joiner.join(items[i], null), options) : EMPTY_BLOCK;
			const midJoin = (i, j) => joiner ? renderToBlock(joiner.join(items[i], items[j]), options) : EMPTY_BLOCK;
			const lines = [];
			let line = null;
			const gapBlock = gap > 0 ? {
				segments: [new Segment(" ".repeat(gap))],
				width: gap
			} : EMPTY_BLOCK;
			for (let i = 0; i < items.length; i++) {
				const item = itemBlocks[i];
				if (line === null) {
					const sc = startCap(i);
					const ec = endCap(i);
					const blocks = sc.width > 0 ? [sc, item] : [item];
					const itemBlockIndices = [blocks.length - 1];
					line = {
						blocks,
						width: sc.width + item.width,
						lastIndex: i,
						itemBlockIndices
					};
					line.endCap = ec;
					continue;
				}
				const prev = line.lastIndex;
				const mid = midJoin(prev, i);
				const newEndCap = endCap(i);
				const addCost = (gap > 0 ? gap : 0) + mid.width + (gap > 0 ? gap : 0) + item.width;
				if (line.width + addCost + newEndCap.width <= maxWidth) {
					if (gap > 0) line.blocks.push(gapBlock);
					if (mid.width > 0) line.blocks.push(mid);
					if (gap > 0) line.blocks.push(gapBlock);
					line.blocks.push(item);
					line.itemBlockIndices.push(line.blocks.length - 1);
					line.width += addCost;
					line.lastIndex = i;
					line.endCap = newEndCap;
				} else {
					const closing = line.endCap;
					if (closing.width > 0) line.blocks.push(closing);
					line.width += closing.width;
					lines.push(line);
					const sc = startCap(i);
					const ec = endCap(i);
					const blocks = sc.width > 0 ? [sc, item] : [item];
					const itemBlockIndices = [blocks.length - 1];
					line = {
						blocks,
						width: sc.width + item.width,
						lastIndex: i,
						itemBlockIndices
					};
					line.endCap = ec;
				}
			}
			const finalLine = line;
			{
				const closing = finalLine.endCap;
				if (closing.width > 0) finalLine.blocks.push(closing);
				finalLine.width += closing.width;
				lines.push(finalLine);
			}
			const align = this.align;
			for (let li = 0; li < lines.length; li++) {
				const ln = lines[li];
				const isLast = li === lines.length - 1;
				const spare = Math.max(0, maxWidth - ln.width);
				const padLeft = computePadLeft(align, spare);
				const slotFills = computeSlotFills(align, isLast, spare, ln.itemBlockIndices.length);
				const itemRankOf = /* @__PURE__ */ new Map();
				ln.itemBlockIndices.forEach((blockIdx, rank) => itemRankOf.set(blockIdx, rank));
				if (padLeft > 0) yield new Segment(" ".repeat(padLeft));
				for (let bi = 0; bi < ln.blocks.length; bi++) {
					const rank = itemRankOf.get(bi);
					if (rank !== void 0 && rank > 0) {
						const fill = slotFills[rank - 1];
						if (fill > 0) yield new Segment(" ".repeat(fill));
					}
					yield* ln.blocks[bi].segments;
				}
				yield Segment.line();
			}
		}
		measure(options) {
			const items = this.items;
			if (items.length === 0) return {
				minimum: 0,
				maximum: 0
			};
			let minimum = 0;
			let maximum = 0;
			for (let i = 0; i < items.length; i++) {
				const itemWidth = renderToBlock(items[i], options).width;
				const sc = this.joiner ? renderToBlock(this.joiner.join(null, items[i]), options).width : 0;
				const ec = this.joiner ? renderToBlock(this.joiner.join(items[i], null), options).width : 0;
				minimum = Math.max(minimum, itemWidth + sc + ec);
				maximum += itemWidth;
				if (i > 0) {
					maximum += this.gap * 2;
					if (this.joiner) maximum += renderToBlock(this.joiner.join(items[i - 1], items[i]), options).width;
				}
			}
			if (this.joiner) {
				maximum += renderToBlock(this.joiner.join(null, items[0]), options).width;
				maximum += renderToBlock(this.joiner.join(items[items.length - 1], null), options).width;
			}
			return {
				minimum,
				maximum
			};
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
	//#region src/renderables/status.ts
	/**
	* Status — displays a spinner animation with a status message.
	*/
	/** A renderable that shows spinner + message */
	var StatusRenderable = class {
		message;
		_spinner;
		_style;
		constructor(message, spinner, style) {
			this.message = message;
			this._spinner = spinner;
			this._style = style;
		}
		*render(options) {
			yield* this._spinner.render(options);
			const style = getStyle(options, this._style);
			const msgStyle = style.isNull ? void 0 : style;
			yield new Segment(\` \${this.message}\`, msgStyle);
		}
	};
	var Status = class {
		_live;
		_renderable;
		_console;
		constructor(message, options) {
			this._console = options?.console ?? new Console({ forceTerminal: true });
			const spinner = new Spinner(options?.spinner ?? "dots", void 0, { speed: options?.speed });
			this._renderable = new StatusRenderable(message, spinner, options?.style ?? NULL_STYLE);
			this._live = new Live(this._renderable, {
				console: this._console,
				transient: true,
				refreshPerSecond: 12.5
			});
		}
		get console() {
			return this._console;
		}
		get message() {
			return this._renderable.message;
		}
		set message(value) {
			this._renderable.message = value;
		}
		start() {
			this._live.start();
		}
		stop() {
			this._live.stop();
		}
		update(message) {
			this._renderable.message = message;
			this._live.update(this._renderable, { refresh: true });
		}
	};
	//#endregion
	//#region src/renderables/progress.ts
	/**
	* Progress — displays continuously updated progress bars.
	*/
	var TextColumn = class {
		format;
		constructor(format) {
			this.format = format ?? "{task.description}";
		}
		*render(options, task) {
			const description = escape(task?.description ?? "");
			yield* embeddedText(this.format.replace(/\\{task\\.description\\}/g, () => description)).render(options);
		}
	};
	var BarColumn = class {
		barWidth;
		constructor(barWidth) {
			this.barWidth = barWidth ?? 40;
		}
		*render(_options, task) {
			yield* new ProgressBar({
				total: task?.total ?? 100,
				completed: task?.completed ?? 0,
				width: this.barWidth
			}).render(_options);
		}
	};
	var TaskProgressColumn = class {
		*render(options, task) {
			yield new Segment(\`\${task && task.total ? Math.min(100, Math.round(task.completed / task.total * 100)) : 0}%\`, getStyle(options, "progress.percentage"));
		}
	};
	var TimeRemainingColumn = class {
		*render(options, task) {
			const style = getStyle(options, "progress.remaining");
			if (!task || !task.total || !task.started || task.completed <= 0) {
				yield new Segment("-:--:--", style);
				return;
			}
			const elapsed = (Date.now() - task.startTime) / 1e3;
			const rate = task.completed / elapsed;
			yield new Segment(formatTime((task.total - task.completed) / rate), style);
		}
	};
	var TimeElapsedColumn = class {
		*render(options, task) {
			const style = getStyle(options, "progress.elapsed");
			if (!task || !task.started) {
				yield new Segment("0:00:00", style);
				return;
			}
			yield new Segment(formatTime((Date.now() - task.startTime) / 1e3), style);
		}
	};
	var SpinnerColumn = class {
		_spinner;
		constructor(spinnerName) {
			this._spinner = new Spinner(spinnerName);
		}
		*render(options, _task) {
			yield* this._spinner.render(options);
		}
	};
	var MofNCompleteColumn = class {
		*render(_options, task) {
			yield new Segment(\`\${task?.completed ?? 0}/\${task?.total ?? "?"}\`);
		}
	};
	function formatTime(seconds) {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor(seconds % 3600 / 60);
		const s = Math.floor(seconds % 60);
		return \`\${h}:\${String(m).padStart(2, "0")}:\${String(s).padStart(2, "0")}\`;
	}
	var Progress = class {
		_columns;
		_tasks;
		_nextId;
		_live;
		_console;
		expand;
		constructor(...columns) {
			let opts = {};
			const cols = [];
			for (const arg of columns) if ("render" in arg) cols.push(arg);
			else opts = arg;
			if (cols.length === 0) cols.push(new TextColumn("[progress.description]{task.description}"), new BarColumn(), new TaskProgressColumn(), new TimeRemainingColumn());
			this._columns = cols;
			this._tasks = /* @__PURE__ */ new Map();
			this._nextId = 1;
			this._console = opts.console ?? new Console({ forceTerminal: true });
			this.expand = opts.expand ?? false;
			this._live = new Live(this, {
				console: this._console,
				refreshPerSecond: opts.refreshPerSecond ?? 10,
				autoRefresh: opts.autoRefresh,
				transient: opts.transient
			});
		}
		get console() {
			return this._console;
		}
		get finished() {
			for (const task of this._tasks.values()) if (!task.started || task.total !== void 0 && task.completed < task.total) return false;
			return this._tasks.size > 0;
		}
		static getDefaultColumns() {
			return [
				new TextColumn("[progress.description]{task.description}"),
				new BarColumn(),
				new TaskProgressColumn(),
				new TimeRemainingColumn()
			];
		}
		addTask(description, options) {
			const id = this._nextId++;
			const task = {
				id,
				description,
				total: options?.total,
				completed: 0,
				started: options?.start !== false,
				visible: options?.visible !== false,
				startTime: Date.now(),
				elapsed: 0
			};
			this._tasks.set(id, task);
			return id;
		}
		updateTask(taskId, options) {
			const task = this._tasks.get(taskId);
			if (!task) return;
			if (options.completed !== void 0) task.completed = options.completed;
			if (options.advance !== void 0) task.completed += options.advance;
			if (options.description !== void 0) task.description = options.description;
			if (options.visible !== void 0) task.visible = options.visible;
			if (options.refresh) this._live.update(this, { refresh: true });
		}
		startTask(taskId) {
			const task = this._tasks.get(taskId);
			if (task) {
				task.started = true;
				task.startTime = Date.now();
			}
		}
		start() {
			this._live.start();
		}
		stop() {
			this._live.stop();
		}
		refresh() {
			this._live.refresh();
		}
		*render(options) {
			const table = Table.grid({ expand: this.expand });
			for (const _col of this._columns) table.addColumn();
			for (const task of this._tasks.values()) {
				if (!task.visible) continue;
				const cells = this._columns.map((col) => {
					const segs = [...col.render(options, task)];
					const text = new RichText("", { end: "" });
					for (const seg of segs) text.append(seg.text, seg.style);
					return text;
				});
				table.addRow(...cells);
			}
			yield* table.render(options);
		}
	};
	function* track(iterable, options) {
		const items = [...iterable];
		const total = options?.total ?? items.length;
		const progress = new Progress({ console: options?.console });
		const taskId = progress.addTask(options?.description ?? "Working...", { total });
		progress.start();
		try {
			for (let i = 0; i < items.length; i++) {
				yield items[i];
				progress.updateTask(taskId, { completed: i + 1 });
			}
		} finally {
			progress.stop();
		}
	}
	//#endregion
	//#region src/renderables/prompt.ts
	/**
	* Prompt — interactive prompts for user input.
	*
	* [LAW:locality-or-seam] The renderable owns prompt logic (display, choice
	* validation, default fallback, retry loop) — but not where the answer comes
	* from. The input source is a required \`PromptInput\` capability passed at the
	* call site. Node consumers pass \`nodeAsk\` from
	* \`@promptctl/rich-js/node/prompt\`; tests pass a fake; the browser bundle
	* gets the classes without dragging \`node:readline\` into the main barrel.
	*
	* [LAW:types-are-the-program] The \`input: PromptInput\` parameter is
	* positional and required on every \`*.ask()\` static — not an optional in
	* \`PromptOptions\`. The previous shape allowed \`Prompt.ask("name?")\` at the
	* type level and threw at runtime; the new shape makes the missing-capability
	* state unrepresentable to TS callers.
	*
	* A trust-boundary \`typeof === "function"\` check remains because the public
	* API surface is reachable from JS (no compile-time types) and from
	* \`any\`-typed TS callers. The check makes the failure *diagnostic* (points
	* the caller at the node helper), not gatekeep-against-bugs — TS users
	* never see it because the type already forbids the bad state.
	*/
	function ask(promptText, input) {
		if (typeof input !== "function") throw new TypeError("Prompt: \`input\` must be a \`PromptInput\` function. Pass \`nodeAsk\` from \`@promptctl/rich-js/node/prompt\` for Node, or supply a custom \`PromptInput\` for tests/browsers.");
		return input(renderMarkup(promptText).plain + " ");
	}
	var Prompt = class {
		static async ask(promptText, input, options) {
			const showDefault = options?.showDefault !== false;
			const showChoices = options?.showChoices !== false;
			let display = promptText;
			if (showChoices && options?.choices) display += \` [\${options.choices.join("/")}]\`;
			if (showDefault && options?.default !== void 0) display += \` (\${options.default})\`;
			display += ":";
			while (true) {
				const value = (await ask(display, input)).trim();
				if (value === "" && options?.default !== void 0) return options.default;
				if (options?.choices) {
					const caseSensitive = options.caseSensitive !== false;
					const match = options.choices.find((c) => caseSensitive ? c === value : c.toLowerCase() === value.toLowerCase());
					if (match) return match;
					continue;
				}
				return value;
			}
		}
	};
	var IntPrompt = class {
		static async ask(promptText, input, options) {
			const showDefault = options?.showDefault !== false;
			let display = promptText;
			if (showDefault && options?.default !== void 0) display += \` (\${options.default})\`;
			display += ":";
			while (true) {
				const value = (await ask(display, input)).trim();
				if (value === "" && options?.default !== void 0) return options.default;
				const num = parseInt(value, 10);
				if (!isNaN(num) && String(num) === value) return num;
			}
		}
	};
	var FloatPrompt = class {
		static async ask(promptText, input, options) {
			const showDefault = options?.showDefault !== false;
			let display = promptText;
			if (showDefault && options?.default !== void 0) display += \` (\${options.default})\`;
			display += ":";
			while (true) {
				const value = (await ask(display, input)).trim();
				if (value === "" && options?.default !== void 0) return options.default;
				const num = parseFloat(value);
				if (!isNaN(num)) return num;
			}
		}
	};
	var Confirm = class {
		static async ask(promptText, input, options) {
			const defaultVal = options?.default;
			const display = \`\${promptText} [\${defaultVal === true ? "Y/n" : defaultVal === false ? "y/N" : "y/n"}]:\`;
			while (true) {
				const value = (await ask(display, input)).trim().toLowerCase();
				if (value === "" && defaultVal !== void 0) return defaultVal;
				if (value === "y" || value === "yes") return true;
				if (value === "n" || value === "no") return false;
			}
		}
	};
	//#endregion
	//#region src/renderables/traceback.ts
	/**
	* Traceback — renders error tracebacks with formatting.
	*
	* [LAW:effects-at-boundaries] Pure rendering: an \`Error\` in, \`Segment\`s out.
	* Installing this as the process-wide crash handler touches \`process.on\` and
	* \`process.exit\`, so that lives behind the node seam as \`installTraceback\` in
	* \`src/node/traceback.ts\` — which is what keeps this module, and therefore the
	* main barrel, importable in a browser.
	*
	* [LAW:types-are-the-program] \`TracebackOptions\` names only what the renderer
	* reads. There is no \`showLocals\`: an \`Error\` carries a stack of locations and
	* nothing of the values in scope at them. The one way to get those in node —
	* an inspector session pausing on exceptions — would have to pause on every
	* throw, caught ones included, to serve \`new Traceback(caughtError)\`, and it
	* cannot exist in a browser at all. Nor is there a \`width\` or \`theme\`: those
	* sized and coloured a source-code excerpt this renderer does not produce.
	*/
	function parseStack(error) {
		const lines = (error.stack ?? "").split("\\n");
		const frames = [];
		for (const line of lines) {
			const trimmed = line.trim();
			const match = /^\\s*at\\s+(?:(.+?)\\s+\\()?(.+?):(\\d+):(\\d+)\\)?/.exec(trimmed);
			if (match) frames.push({
				function: match[1] || void 0,
				file: match[2],
				line: parseInt(match[3], 10),
				column: parseInt(match[4], 10)
			});
		}
		return frames;
	}
	var Traceback = class {
		error;
		maxFrames;
		suppress;
		constructor(error, options) {
			this.error = error;
			this.maxFrames = options?.maxFrames ?? 100;
			this.suppress = options?.suppress ?? [];
		}
		*render(options) {
			const excTypeStyle = getStyle(options, "traceback.exc_type");
			const textStyle = getStyle(options, "traceback.text");
			const errorName = this.error.name || "Error";
			const errorMessage = this.error.message || "";
			yield new Segment(errorName, excTypeStyle);
			yield new Segment(": ");
			yield new Segment(errorMessage, textStyle);
			yield Segment.line();
			yield Segment.line();
			const frames = parseStack(this.error);
			let displayFrames = this.suppress.length > 0 ? frames.map((f) => ({
				...f,
				suppressed: this.suppress.some((s) => f.file.includes(s))
			})) : frames;
			if (this.maxFrames > 0 && displayFrames.length > this.maxFrames) {
				const head = Math.floor(this.maxFrames / 2);
				const first = displayFrames.slice(0, head);
				const last = displayFrames.slice(displayFrames.length - (this.maxFrames - head));
				const omitted = displayFrames.length - this.maxFrames;
				for (const frame of first) yield* this._renderFrame(frame, options);
				yield new Segment(\`  ... \${omitted} frames omitted ...\`, textStyle);
				yield Segment.line();
				for (const frame of last) yield* this._renderFrame(frame, options);
			} else for (const frame of displayFrames) yield* this._renderFrame(frame, options);
		}
		*_renderFrame(frame, options) {
			const pathStyle = Style.parse("dim");
			const lineNoStyle = getStyle(options, "traceback.offset");
			yield new Segment("  ");
			if (frame.function && !frame.suppressed) {
				yield new Segment(frame.function, Style.parse("bold"));
				yield new Segment(" ");
			}
			yield new Segment(frame.file, pathStyle);
			if (frame.line !== void 0) {
				yield new Segment(":");
				yield new Segment(String(frame.line), lineNoStyle);
			}
			yield Segment.line();
		}
	};
	//#endregion
	//#region src/renderables/syntax.ts
	/**
	* Syntax — renders source code with basic syntax highlighting.
	* Uses built-in tokenization (no external dependency).
	*/
	var TOKEN_PATTERNS = { _default: [
		[/\\/\\/.*$/gm, "comment"],
		[/\\/\\*[\\s\\S]*?\\*\\//g, "comment"],
		[/#.*$/gm, "comment"],
		[/"(?:[^"\\\\]|\\\\.)*"/g, "string"],
		[/'(?:[^'\\\\]|\\\\.)*'/g, "string"],
		[/\`(?:[^\`\\\\]|\\\\.)*\`/g, "string"],
		[/\\b(?:true|false|null|undefined|NaN|Infinity)\\b/g, "keyword.constant"],
		[/\\b(?:function|class|const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|throw|try|catch|finally|import|export|from|default|async|await|yield|of|in|typeof|instanceof|void|delete)\\b/g, "keyword"],
		[/\\b(?:def|lambda|with|as|pass|raise|elif|except|print|self|cls|None|True|False)\\b/g, "keyword"],
		[/\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b/g, "number"],
		[/\\b0x[0-9a-fA-F]+\\b/g, "number"]
	] };
	var TOKEN_STYLES = {
		"keyword": Style.parse("bold magenta"),
		"keyword.constant": Style.parse("italic bright_magenta"),
		"string": Style.parse("green"),
		"number": Style.parse("cyan"),
		"comment": Style.parse("dim italic")
	};
	var Syntax = class {
		code;
		language;
		lineNumbers;
		startLine;
		lineRange;
		highlightLines;
		wordWrap;
		tabSize;
		constructor(code, language, options) {
			this.code = code;
			this.language = language ?? "text";
			this.lineNumbers = options?.lineNumbers ?? false;
			this.startLine = options?.startLine ?? 1;
			this.lineRange = options?.lineRange;
			this.highlightLines = options?.highlightLines ?? /* @__PURE__ */ new Set();
			this.wordWrap = options?.wordWrap ?? false;
			this.tabSize = options?.tabSize ?? 4;
		}
		*render(options) {
			let lines = this.code.replace(/\\t/g, " ".repeat(this.tabSize)).split("\\n");
			if (this.lineRange) {
				const [start, end] = this.lineRange;
				lines = lines.slice(start - 1, end);
			}
			const lineNumWidth = this.lineNumbers ? String(this.startLine + lines.length - 1).length + 1 : 0;
			const text = new RichText(lines.join("\\n"), { end: "" });
			this._highlight(text);
			const textLines = text.split("\\n");
			for (let i = 0; i < textLines.length; i++) {
				const lineNo = this.startLine + i;
				const isHighlighted = this.highlightLines.has(lineNo);
				if (this.lineNumbers) {
					yield new Segment(String(lineNo).padStart(lineNumWidth - 1) + " ", isHighlighted ? Style.parse("bold on grey27") : Style.parse("dim"));
					yield new Segment("│ ", Style.parse("dim"));
				}
				const segs = [...textLines[i].render({
					...options,
					maxWidth: options.maxWidth - lineNumWidth - 2
				})];
				for (const seg of segs) if (seg.text !== "\\n") yield seg;
				yield Segment.line();
			}
		}
		measure(options) {
			const lines = this.code.split("\\n");
			let maxLine = 0;
			for (const line of lines) maxLine = Math.max(maxLine, cellLen(line));
			const lineNumWidth = this.lineNumbers ? String(this.startLine + lines.length - 1).length + 3 : 0;
			return {
				minimum: 10,
				maximum: Math.min(maxLine + lineNumWidth, options.maxWidth)
			};
		}
		_highlight(text) {
			const patterns = TOKEN_PATTERNS["_default"] ?? [];
			for (const [pattern, tokenType] of patterns) {
				const style = TOKEN_STYLES[tokenType];
				if (style) text.highlightRegex(pattern, style);
			}
		}
		static fromPath(_filePath, _options) {
			throw new Error("Syntax.fromPath requires file system access — use the constructor with code string instead");
		}
	};
	//#endregion
	//#region src/renderables/markdown.ts
	/**
	* Markdown — renders Markdown content to the terminal.
	* Uses built-in parsing (no external dependency).
	*/
	function tokenize(markdown) {
		const lines = markdown.split("\\n");
		const tokens = [];
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			if (line.trim() === "") {
				tokens.push({ type: "blank" });
				i++;
				continue;
			}
			const headingMatch = /^(#{1,6})\\s+(.+)$/.exec(line);
			if (headingMatch) {
				tokens.push({
					type: "heading",
					level: headingMatch[1].length,
					text: headingMatch[2]
				});
				i++;
				continue;
			}
			if (/^(?:---+|===+|\\*\\*\\*+)$/.test(line.trim())) {
				tokens.push({ type: "hr" });
				i++;
				continue;
			}
			const codeMatch = /^\`\`\`(\\w*)/.exec(line);
			if (codeMatch) {
				const lang = codeMatch[1] ?? "";
				const codeLines = [];
				i++;
				while (i < lines.length && !lines[i].startsWith("\`\`\`")) {
					codeLines.push(lines[i]);
					i++;
				}
				i++;
				tokens.push({
					type: "code_block",
					language: lang,
					code: codeLines.join("\\n")
				});
				continue;
			}
			if (line.startsWith("> ")) {
				const quoteLines = [];
				while (i < lines.length && lines[i].startsWith("> ")) {
					quoteLines.push(lines[i].slice(2));
					i++;
				}
				tokens.push({
					type: "blockquote",
					text: quoteLines.join("\\n")
				});
				continue;
			}
			const ulMatch = /^([*\\-+])\\s+(.+)$/.exec(line);
			if (ulMatch) {
				tokens.push({
					type: "list_item",
					ordered: false,
					index: 0,
					text: ulMatch[2]
				});
				i++;
				continue;
			}
			const olMatch = /^(\\d+)\\.\\s+(.+)$/.exec(line);
			if (olMatch) {
				tokens.push({
					type: "list_item",
					ordered: true,
					index: parseInt(olMatch[1], 10),
					text: olMatch[2]
				});
				i++;
				continue;
			}
			const paraLines = [];
			while (i < lines.length && lines[i].trim() !== "" && !/^#{1,6}\\s/.test(lines[i]) && !/^\`\`\`/.test(lines[i])) {
				paraLines.push(lines[i]);
				i++;
			}
			tokens.push({
				type: "paragraph",
				text: paraLines.join(" ")
			});
		}
		return tokens;
	}
	function applyInlineStyles(text) {
		const result = new RichText("", { end: "" });
		const inlineRe = /(\\*\\*(.+?)\\*\\*|\\*(.+?)\\*|\`(.+?)\`|\\[(.+?)\\]\\((.+?)\\))/g;
		let lastIdx = 0;
		let match;
		while ((match = inlineRe.exec(text)) !== null) {
			if (match.index > lastIdx) result.append(text.slice(lastIdx, match.index));
			if (match[2]) result.append(match[2], "bold");
			else if (match[3]) result.append(match[3], "italic");
			else if (match[4]) result.append(match[4], "markdown.code");
			else if (match[5] && match[6]) result.append(match[5], new Style({ link: match[6] }));
			lastIdx = match.index + match[0].length;
		}
		if (lastIdx < text.length) result.append(text.slice(lastIdx));
		return result;
	}
	var Markdown = class {
		markdown;
		inlineCodeStyle;
		hyperlinks;
		constructor(markdown, options) {
			this.markdown = markdown;
			this.inlineCodeStyle = options?.inlineCodeStyle ?? "markdown.code";
			this.hyperlinks = options?.hyperlinks !== false;
		}
		*render(rawOptions) {
			const options = {
				...rawOptions,
				height: stackedHeight(rawOptions.height)
			};
			const tokens = tokenize(this.markdown);
			for (const token of tokens) switch (token.type) {
				case "heading": {
					const style = getStyle(options, \`markdown.h\${Math.min(token.level, 4)}\`);
					const text = applyInlineStyles(token.text);
					yield* Segment.applyStyle([...text.render(options)], style);
					yield Segment.line();
					break;
				}
				case "paragraph":
					yield* applyInlineStyles(token.text).render(options);
					yield Segment.line();
					break;
				case "code_block": {
					const codeStyle = getStyle(options, "markdown.code");
					const lines = token.code.split("\\n");
					for (const line of lines) {
						yield new Segment(line, codeStyle);
						yield Segment.line();
					}
					break;
				}
				case "hr":
					yield* new Rule(void 0, { style: "markdown.hr" }).render(options);
					break;
				case "list_item": {
					const bullet = token.ordered ? \`\${token.index}. \` : "  • ";
					yield new Segment(bullet);
					yield* applyInlineStyles(token.text).render({
						...options,
						maxWidth: options.maxWidth - bullet.length
					});
					break;
				}
				case "blockquote": {
					const quoteStyle = Style.parse("dim italic");
					yield new Segment("▎ ", getStyle(options, "markdown.hr"));
					const text = applyInlineStyles(token.text);
					yield* Segment.applyStyle([...text.render(options)], quoteStyle);
					yield Segment.line();
					break;
				}
				case "blank": yield Segment.line();
			}
		}
		measure(options) {
			return {
				minimum: 1,
				maximum: options.maxWidth
			};
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
	//#region src/index.ts
	var src_exports = /* @__PURE__ */ __exportAll({
		ANCHORED_ROOTS: () => ANCHORED_ROOTS,
		ANSI_COLOR_NAMES: () => ANSI_COLOR_NAMES,
		ASCII: () => ASCII,
		ASCII2: () => ASCII2,
		ASCII_DOUBLE_HEAD: () => ASCII_DOUBLE_HEAD,
		ATOM_ONE_DARK: () => ATOM_ONE_DARK,
		ATOM_ONE_LIGHT: () => ATOM_ONE_LIGHT,
		Align: () => Align,
		AnsiDecoder: () => AnsiDecoder,
		BarColumn: () => BarColumn,
		Box: () => Box,
		CATPPUCCIN_FRAPPE: () => CATPPUCCIN_FRAPPE,
		CATPPUCCIN_LATTE: () => CATPPUCCIN_LATTE,
		CATPPUCCIN_MACCHIATO: () => CATPPUCCIN_MACCHIATO,
		CATPPUCCIN_MOCHA: () => CATPPUCCIN_MOCHA,
		CYBERPUNK: () => CYBERPUNK,
		CapsuleJoiner: () => CapsuleJoiner,
		ColorDepth: () => ColorDepth,
		ColorParseError: () => ColorParseError,
		ColorRamp: () => ColorRamp,
		ColorRefError: () => ColorRefError,
		ColorRgba: () => ColorRgba,
		ColorSpec: () => ColorSpec,
		ColorTable: () => ColorTable,
		Column: () => Column,
		Columns: () => Columns,
		Confirm: () => Confirm,
		Console: () => Console,
		Constrain: () => Constrain,
		ControlType: () => ControlType,
		DEFAULT_SPINNER: () => DEFAULT_SPINNER,
		DEFAULT_STYLES: () => DEFAULT_STYLES,
		DEFAULT_TERMINAL_THEME: () => DEFAULT_TERMINAL_THEME,
		DOUBLE: () => DOUBLE,
		DOUBLE_EDGE: () => DOUBLE_EDGE,
		DRACULA: () => DRACULA,
		EIGHT_BIT_TABLE: () => EIGHT_BIT_TABLE,
		EMOJI: () => EMOJI,
		Emoji: () => Emoji,
		FLEXOKI: () => FLEXOKI,
		FlexStrip: () => FlexStrip,
		FloatPrompt: () => FloatPrompt,
		GRUVBOX: () => GRUVBOX,
		GradientJoiner: () => GradientJoiner,
		Group: () => Group,
		HEAVY: () => HEAVY,
		HEAVY_EDGE: () => HEAVY_EDGE,
		HEAVY_HEAD: () => HEAVY_HEAD,
		HEX_COLOR_RE: () => HEX_COLOR_RE,
		HORIZONTALS: () => HORIZONTALS,
		Highlighter: () => Highlighter,
		IDENTITY: () => IDENTITY,
		INVERT_LIGHTNESS: () => INVERT_LIGHTNESS,
		ISO8601Highlighter: () => ISO8601Highlighter,
		IntPrompt: () => IntPrompt,
		JSONHighlighter: () => JSONHighlighter,
		JSONRenderable: () => JSONRenderable,
		Layout: () => Layout,
		Live: () => Live,
		MARKDOWN: () => MARKDOWN,
		MINIMAL: () => MINIMAL,
		MINIMAL_DOUBLE_HEAD: () => MINIMAL_DOUBLE_HEAD,
		MINIMAL_HEAVY_HEAD: () => MINIMAL_HEAVY_HEAD,
		MONOKAI: () => MONOKAI,
		Markdown: () => Markdown,
		MarkupError: () => MarkupError,
		MarkupRegistry: () => MarkupRegistry,
		MarkupSyntaxError: () => MarkupSyntaxError,
		Measurement: () => Measurement,
		MofNCompleteColumn: () => MofNCompleteColumn,
		NORD: () => NORD,
		NULL_STYLE: () => NULL_STYLE,
		NoEmoji: () => NoEmoji,
		NullHighlighter: () => NullHighlighter,
		OSC8: () => OSC8,
		Oklch: () => Oklch,
		POWERLINE_JOINER_GLYPHS: () => POWERLINE_JOINER_GLYPHS,
		Padding: () => Padding,
		Palette: () => Palette,
		Panel: () => Panel,
		PlainJoiner: () => PlainJoiner,
		PowerlineJoiner: () => PowerlineJoiner,
		Pretty: () => Pretty,
		Progress: () => Progress,
		ProgressBar: () => ProgressBar,
		Prompt: () => Prompt,
		RAMP_EASING_NAMES: () => RAMP_EASING_NAMES,
		ROSE_PINE: () => ROSE_PINE,
		ROSE_PINE_DAWN: () => ROSE_PINE_DAWN,
		ROSE_PINE_MOON: () => ROSE_PINE_MOON,
		ROUNDED: () => ROUNDED,
		RegexHighlighter: () => RegexHighlighter,
		ReprHighlighter: () => ReprHighlighter,
		RichText: () => RichText,
		Rule: () => Rule,
		SCROLLBAR: () => SCROLLBAR,
		SEAM_MIN_DELTA_E: () => SEAM_MIN_DELTA_E,
		SIMPLE: () => SIMPLE,
		SIMPLE_HEAD: () => SIMPLE_HEAD,
		SIMPLE_HEAVY: () => SIMPLE_HEAVY,
		SOLARIZED_DARK: () => SOLARIZED_DARK,
		SOLARIZED_LIGHT: () => SOLARIZED_LIGHT,
		SPINNERS: () => SPINNERS,
		SQUARE: () => SQUARE,
		SQUARE_DOUBLE_HEAD: () => SQUARE_DOUBLE_HEAD,
		STANDARD_TABLE: () => STANDARD_TABLE,
		SVG_EXPORT_THEME: () => SVG_EXPORT_THEME,
		Segment: () => Segment,
		Span: () => Span,
		Spinner: () => Spinner,
		SpinnerColumn: () => SpinnerColumn,
		Status: () => Status,
		Strip: () => Strip,
		Style: () => Style,
		StyleStack: () => StyleStack,
		StyleSyntaxError: () => StyleSyntaxError,
		Syntax: () => Syntax,
		TEXTUAL_ANSI: () => TEXTUAL_ANSI,
		TEXTUAL_DARK: () => TEXTUAL_DARK,
		TEXTUAL_LIGHT: () => TEXTUAL_LIGHT,
		TOKYO_NIGHT: () => TOKYO_NIGHT,
		Table: () => Table,
		TaskProgressColumn: () => TaskProgressColumn,
		TerminalTheme: () => TerminalTheme,
		TextColumn: () => TextColumn,
		Theme: () => Theme,
		TimeElapsedColumn: () => TimeElapsedColumn,
		TimeRemainingColumn: () => TimeRemainingColumn,
		Traceback: () => Traceback,
		Tree: () => Tree,
		Viewport: () => Viewport,
		WINDOWS_TABLE: () => WINDOWS_TABLE,
		asCellCol: () => asCellCol,
		asCodePoint: () => asCodePoint,
		blendRgb: () => blendRgb,
		buildPalette: () => buildPalette,
		cellFit: () => cellFit,
		cellLen: () => cellLen,
		chopCells: () => chopCells,
		contrastFor: () => contrastFor,
		contrastRatio: () => contrastRatio,
		darken: () => darken,
		decodeAnsi: () => decodeAnsi,
		detectColorSystem: () => detectColorSystem,
		drawnColour: () => drawnColour,
		emojiReplace: () => emojiReplace,
		ensureContrast: () => ensureContrast,
		ensureDrawn: () => ensureDrawn,
		escapeMarkup: () => escape,
		fitHeight: () => fitHeight,
		getThemePalette: () => getThemePalette,
		globalMarkupRegistry: () => globalMarkupRegistry,
		insetHeight: () => insetHeight,
		isAnchored: () => isAnchored,
		isIdentityKey: () => isIdentityKey,
		isMeasurable: () => isMeasurable,
		isRenderable: () => isRenderable,
		lighten: () => lighten,
		listThemePalettes: () => listThemePalettes,
		measureRenderables: () => measureRenderables,
		osc8Sequences: () => osc8Sequences,
		parseHexColor: () => parseHexColor,
		parseRampEasing: () => parseRampEasing,
		parseRgbHex: () => parseRgbHex,
		parseRgbaHex: () => parseRgbaHex,
		regionRows: () => regionRows,
		relativeLuminance: () => relativeLuminance,
		renderMarkup: () => renderMarkup,
		renderToString: () => renderToString,
		resolveColorRef: () => resolveColorRef,
		resolveColorSystem: () => resolveColorSystem,
		resolveDestination: () => resolveDestination,
		segmentToString: () => segmentToString,
		segmentsToString: () => segmentsToString,
		setCellSize: () => setCellSize,
		splitText: () => splitText,
		stackedHeight: () => stackedHeight,
		themeKeyForRoot: () => themeKeyForRoot,
		track: () => track,
		transposePalette: () => transposePalette,
		withBoundedWidth: () => withBoundedWidth,
		withCellWidth: () => withCellWidth
	});
	//#endregion
	//#region src/node/terminal-host.ts
	var terminal_host_exports = /* @__PURE__ */ __exportAll({ NodeTerminalHost: () => NodeTerminalHost });
	/**
	* node:terminal-host — the \`TerminalHost\` implementation backed by node's
	* process streams.
	*
	* [LAW:locality-or-seam] The \`TerminalHost\` interface is the seam and lives
	* in \`widgets/terminal-host.ts\`, importable anywhere. *This* file is one
	* value satisfying that interface, and it reads \`process.stdin\` /
	* \`process.stdout\`, so it is a node subpath:
	*
	*     import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
	*     const screen = new Screen(new NodeTerminalHost());
	*
	* The ambient \`process\` global is not an import, so it slips past the
	* module-graph reasoning that keeps the main barrel browser-safe: reading
	* \`process.stdin\` inside a constructor throws in a browser only when someone
	* constructs it. Moving the class here makes the boundary structural — a
	* browser bundle that never reaches for this subpath cannot reach the global
	* either.
	*
	* [LAW:no-shared-mutable-globals] Which files may read the host, and what
	* each takes off it, is \`HOST_ACCESS\` in \`test/seam/ambient-process.ts\` —
	* this file's entry carries its \`why\`, and a test fails when anything joins
	* the list. Deliberately not restated here: the sole-ownership sentence that
	* used to stand in this spot is what that list replaced.
	*
	* So if you find yourself reaching for \`process.stdin\`, \`process.stdout\`, or
	* \`setRawMode\` in the runtime or in a demo, take a \`TerminalHost\` parameter
	* instead. The seam is already here.
	*/
	var DEFAULT_COLS = 80;
	var DEFAULT_ROWS = 24;
	var NodeTerminalHost = class {
		stdin;
		stdout;
		dataHandlers = /* @__PURE__ */ new Set();
		resizeHandlers = /* @__PURE__ */ new Set();
		dataListener;
		resizeListener;
		rawModeRequested = false;
		constructor(options = {}) {
			this.stdin = options.stdin ?? process.stdin;
			this.stdout = options.stdout ?? process.stdout;
		}
		get isTTY() {
			return !!this.stdin.isTTY && !!this.stdout.isTTY;
		}
		write(data) {
			this.stdout.write(data);
		}
		size() {
			return {
				cols: this.stdout.columns ?? DEFAULT_COLS,
				rows: this.stdout.rows ?? DEFAULT_ROWS
			};
		}
		setRawMode(raw) {
			this.rawModeRequested = raw;
			this.applyRawMode(raw);
		}
		applyRawMode(raw) {
			try {
				this.stdin.setRawMode?.(raw);
			} catch {}
		}
		onData(handler) {
			this.dataHandlers.add(handler);
			if (!this.dataListener) {
				this.dataListener = (chunk) => {
					for (const h of this.dataHandlers) h(chunk);
				};
				this.stdin.on("data", this.dataListener);
				this.stdin.resume?.();
			}
			return () => {
				this.dataHandlers.delete(handler);
				if (this.dataHandlers.size === 0 && this.dataListener) {
					this.stdin.off("data", this.dataListener);
					this.dataListener = void 0;
					this.stdin.pause?.();
				}
			};
		}
		onResize(handler) {
			this.resizeHandlers.add(handler);
			if (!this.resizeListener) {
				this.resizeListener = () => {
					const size = this.size();
					for (const h of this.resizeHandlers) h(size);
				};
				this.stdout.on("resize", this.resizeListener);
			}
			return () => {
				this.resizeHandlers.delete(handler);
				if (this.resizeHandlers.size === 0 && this.resizeListener) {
					this.stdout.off("resize", this.resizeListener);
					this.resizeListener = void 0;
				}
			};
		}
		start() {}
		stop() {
			if (this.dataListener) {
				this.stdin.off("data", this.dataListener);
				this.dataListener = void 0;
				this.stdin.pause?.();
			}
			if (this.resizeListener) {
				this.stdout.off("resize", this.resizeListener);
				this.resizeListener = void 0;
			}
			this.dataHandlers.clear();
			this.resizeHandlers.clear();
			if (this.rawModeRequested) {
				this.applyRawMode(false);
				this.rawModeRequested = false;
			}
		}
	};
	//#endregion
	//#region src/widgets/types.ts
	/**
	* Interactive widget event types and core interfaces.
	* [LAW:one-source-of-truth] These types are the single authority for the widget contract.
	* Widgets are MobX-observable state machines that implement Renderable,
	* producing Segment[] from current state. They have no knowledge of stdin,
	* terminal escape sequences, or their host environment.
	*/
	var KeyEvent = class {
		key;
		character;
		shift;
		ctrl;
		meta;
		_stopped = false;
		constructor(init) {
			this.key = init.key;
			this.character = init.character;
			this.shift = init.shift;
			this.ctrl = init.ctrl;
			this.meta = init.meta;
		}
		get stopped() {
			return this._stopped;
		}
		stop() {
			this._stopped = true;
		}
	};
	var FLOW = { kind: "flow" };
	function hasOverlay(value) {
		return "renderOverlay" in value && typeof value.renderOverlay === "function";
	}
	//#endregion
	//#region node_modules/mobx/dist/mobx.mjs
	var __MOBX_DEV__ = process.env.NODE_ENV !== "production";
	var errors = __MOBX_DEV__ ? {
		0: \`Invalid value for configuration 'enforceActions', expected 'never', 'always' or 'observed'\`,
		1(annotationType, key) {
			return \`Cannot apply '\${annotationType}' to '\${key.toString()}': Field not found.\`;
		},
		5: "'keys()' can only be used on observable objects, arrays, sets and maps",
		6: "'values()' can only be used on observable objects, arrays, sets and maps",
		7: "'entries()' can only be used on observable objects, arrays and maps",
		8: "'set()' can only be used on observable objects, arrays and maps",
		9: "'remove()' can only be used on observable objects, arrays and maps",
		10: "'has()' can only be used on observable objects, arrays and maps",
		11: "'get()' can only be used on observable objects, arrays and maps",
		12: \`Invalid annotation\`,
		13: \`Dynamic observable objects cannot be frozen. If you're passing observables to 3rd party component/function that calls Object.freeze, pass copy instead: toJS(observable)\`,
		14: "Intercept handlers should return nothing or a change object",
		15: \`Observable arrays cannot be frozen. If you're passing observables to 3rd party component/function that calls Object.freeze, pass copy instead: toJS(observable)\`,
		16: \`Modification exception: the internal structure of an observable array was changed.\`,
		19(other) {
			return "Cannot initialize from classes that inherit from Map: " + other.constructor.name;
		},
		20(other) {
			return "Cannot initialize map from " + other;
		},
		21(dataStructure) {
			return \`Cannot convert to map from '\${dataStructure}'\`;
		},
		23: "It is not possible to get index atoms from arrays",
		24(thing) {
			return "Cannot obtain administration from " + thing;
		},
		25(property, name) {
			return \`the entry '\${property}' does not exist in the observable map '\${name}'\`;
		},
		26: "please specify a property",
		27(property, name) {
			return \`no observable property '\${property.toString()}' found on the observable object '\${name}'\`;
		},
		28(thing) {
			return "Cannot obtain atom from " + thing;
		},
		29: "Expecting some object",
		30: "invalid action stack. did you forget to finish an action?",
		31: "missing option for computed: get",
		32(name, derivation) {
			return \`Cycle detected in computation \${name}: \${derivation}\`;
		},
		33(name) {
			return \`The setter of computed value '\${name}' is trying to update itself. Did you intend to update an _observable_ value, instead of the computed property?\`;
		},
		34(name) {
			return \`[ComputedValue '\${name}'] It is not possible to assign a new value to a computed value.\`;
		},
		35: "There are multiple, different versions of MobX active. Make sure MobX is loaded only once or use \`configure({ isolateGlobalState: true })\`",
		36: "isolateGlobalState should be called before MobX is running any reactions",
		37(method) {
			return \`[mobx] \\\`observableArray.\${method}()\\\` mutates the array in-place, which is not allowed inside a derivation. Use \\\`array.slice().\${method}()\\\` instead\`;
		},
		38: "'ownKeys()' can only be used on observable objects",
		39: "'defineProperty()' can only be used on observable objects",
		40(length) {
			return "Out of range: " + length;
		},
		41(other) {
			return "Cannot initialize set from " + other;
		},
		42(key) {
			return \`Invalid index: '\${key}'\`;
		},
		43(annotationType, name, kind) {
			return \`Cannot apply '\${annotationType}' to '\${name}' (kind: \${kind}):\\n'\${annotationType}' can only be used on properties with a function value.\`;
		},
		44(annotationType) {
			return \`'\${annotationType}' can only be used with 'makeObservable'\`;
		}
	} : {};
	function die(error, ...args) {
		if (__MOBX_DEV__) {
			let e = typeof error === "string" ? error : errors[error];
			if (typeof e === "function") e = e.apply(null, args);
			throw new Error(\`[MobX] \${e}\`);
		}
		throw new Error(\`[MobX] minified error nr: \${error}\${args.length ? " " + args.map(String).join(",") : ""}. See mobx.js.org/errors\`);
	}
	var assign = Object.assign;
	var getDescriptor = Object.getOwnPropertyDescriptor;
	var defineProperty = Object.defineProperty;
	var objectPrototype = Object.prototype;
	var EMPTY_ARRAY = [];
	Object.freeze(EMPTY_ARRAY);
	var EMPTY_OBJECT = {};
	Object.freeze(EMPTY_OBJECT);
	var plainObjectString = /*#__PURE__*/ Object.toString();
	function getNextId() {
		return ++globalState.mobxGuid;
	}
	/**
	* Makes sure that the provided function is invoked at most once.
	*/
	function once(func) {
		let invoked = false;
		return function() {
			if (invoked) return;
			invoked = true;
			return func.apply(this, arguments);
		};
	}
	var noop = () => {};
	function isFunction(fn) {
		return typeof fn === "function";
	}
	function isStringish(value) {
		switch (typeof value) {
			case "string":
			case "symbol":
			case "number": return true;
		}
		return false;
	}
	function isObject(value) {
		return value !== null && typeof value === "object";
	}
	function isPlainObject(value) {
		if (!isObject(value)) return false;
		const proto = Object.getPrototypeOf(value);
		if (proto == null) return true;
		const protoConstructor = hasProp(proto, "constructor") && proto.constructor;
		return typeof protoConstructor === "function" && protoConstructor.toString() === plainObjectString;
	}
	function isGenerator(obj) {
		const constructor = obj == null ? void 0 : obj.constructor;
		if (!constructor) return false;
		if ("GeneratorFunction" === constructor.name || "GeneratorFunction" === constructor.displayName) return true;
		return false;
	}
	function addHiddenProp(object, propName, value) {
		defineProperty(object, propName, {
			enumerable: false,
			writable: true,
			configurable: true,
			value
		});
	}
	function addHiddenFinalProp(object, propName, value) {
		defineProperty(object, propName, {
			enumerable: false,
			writable: false,
			configurable: true,
			value
		});
	}
	function createInstanceofPredicate(name, theClass) {
		const propName = "isMobX" + name;
		theClass.prototype[propName] = true;
		return function(x) {
			return isObject(x) && x[propName] === true;
		};
	}
	/**
	* Yields true for both native and observable Map, even across different windows.
	*/
	function isES6Map(thing) {
		return thing != null && Object.prototype.toString.call(thing) === "[object Map]";
	}
	/**
	* Makes sure a Map is an instance of non-inherited native or observable Map.
	*/
	function isPlainES6Map(thing) {
		const mapProto = Object.getPrototypeOf(thing);
		const objectProto = Object.getPrototypeOf(mapProto);
		return Object.getPrototypeOf(objectProto) === null;
	}
	/**
	* Yields true for both native and observable Set, even across different windows.
	*/
	function isES6Set(thing) {
		return thing != null && Object.prototype.toString.call(thing) === "[object Set]";
	}
	/**
	* Returns the following: own enumerable keys and symbols.
	*/
	function getPlainObjectKeys(object) {
		const keys = Object.keys(object);
		const symbols = Object.getOwnPropertySymbols(object);
		if (!symbols.length) return keys;
		return [...keys, ...symbols.filter((s) => objectPrototype.propertyIsEnumerable.call(object, s))];
	}
	var ownKeys = Reflect.ownKeys;
	function stringifyKey(key) {
		if (typeof key === "string") return key;
		if (typeof key === "symbol") return key.toString();
		return new String(key).toString();
	}
	function toPrimitive(value) {
		return value === null ? null : typeof value === "object" ? "" + value : value;
	}
	function hasProp(target, prop) {
		return objectPrototype.hasOwnProperty.call(target, prop);
	}
	var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
	function getFlag(flags, mask) {
		return !!(flags & mask);
	}
	function setFlag(flags, mask, newValue) {
		if (newValue) flags |= mask;
		else flags &= ~mask;
		return flags;
	}
	function assert20223DecoratorType(context, types) {
		if (__MOBX_DEV__ && !types.includes(context.kind)) die(\`The decorator applied to '\${String(context.name)}' cannot be used on a \${context.kind} element\`);
	}
	var $mobx = /*#__PURE__*/ Symbol("mobx administration");
	var Atom = class {
		/**
		* Create a new atom. For debugging purposes it is recommended to give it a name.
		* The onBecomeObserved and onBecomeUnobserved callbacks can be used for resource management.
		*/
		constructor(name_ = __MOBX_DEV__ ? "Atom@" + getNextId() : "Atom") {
			this.name_ = void 0;
			this.flags_ = 0;
			this.observers_ = null;
			this.lastAccessedBy_ = 0;
			this.lowestObserverState_ = -1;
			this.onBOL = void 0;
			this.onBUOL = void 0;
			this.name_ = name_;
		}
		get isBeingObserved() {
			return getFlag(this.flags_, 1);
		}
		set isBeingObserved(newValue) {
			this.flags_ = setFlag(this.flags_, 1, newValue);
		}
		get isPendingUnobservation() {
			return getFlag(this.flags_, 2);
		}
		set isPendingUnobservation(newValue) {
			this.flags_ = setFlag(this.flags_, 2, newValue);
		}
		get diffValue() {
			return getFlag(this.flags_, 4) ? 1 : 0;
		}
		set diffValue(newValue) {
			this.flags_ = setFlag(this.flags_, 4, newValue === 1 ? true : false);
		}
		onBO() {
			if (this.onBOL) this.onBOL.forEach((listener) => listener());
		}
		onBUO() {
			if (this.onBUOL) this.onBUOL.forEach((listener) => listener());
		}
		/**
		* Invoke this method to notify mobx that your atom has been used somehow.
		* Returns true if there is currently a reactive context.
		*/
		reportObserved() {
			return reportObserved(this);
		}
		/**
		* Invoke this method _after_ this method has changed to signal mobx that all its observers should invalidate.
		*/
		reportChanged() {
			startBatch();
			propagateChanged(this);
			endBatch();
		}
		toString() {
			return this.name_;
		}
	};
	var isAtom = /*#__PURE__*/ createInstanceofPredicate("Atom", Atom);
	function createAtom(name, onBecomeObservedHandler = noop, onBecomeUnobservedHandler = noop) {
		const atom = new Atom(name);
		if (onBecomeObservedHandler !== noop) atom.onBOL = /* @__PURE__ */ new Set([onBecomeObservedHandler]);
		if (onBecomeUnobservedHandler !== noop) atom.onBUOL = /* @__PURE__ */ new Set([onBecomeUnobservedHandler]);
		return atom;
	}
	var compareDefault = Object.is;
	function deepEnhancer(v, _, name) {
		if (v === null || typeof v !== "object" && typeof v !== "function") return v;
		if (isObservable(v)) return v;
		if (Array.isArray(v)) return observable.array(v, { name });
		if (isPlainObject(v)) return observable.object(v, void 0, { name });
		if (isES6Map(v)) return observable.map(v, { name });
		if (isES6Set(v)) return observable.set(v, { name });
		if (typeof v === "function" && !isAction(v) && !isFlow(v)) {
			if (isGenerator(v)) return flow(v);
			else return autoAction(name, v);
		}
		return v;
	}
	function shallowEnhancer(v, _, name) {
		if (v === void 0 || v === null) return v;
		if (isObservableObject(v) || isObservableArray(v) || isObservableMap(v) || isObservableSet(v)) return v;
		if (Array.isArray(v)) return observable.array(v, {
			name,
			deep: false
		});
		if (isPlainObject(v)) return observable.object(v, void 0, {
			name,
			deep: false
		});
		if (isES6Map(v)) return observable.map(v, {
			name,
			deep: false
		});
		if (isES6Set(v)) return observable.set(v, {
			name,
			deep: false
		});
		if (__MOBX_DEV__) die("The shallow modifier / decorator can only used in combination with arrays, objects, maps and sets");
	}
	function referenceEnhancer(newValue) {
		return newValue;
	}
	var OVERRIDE = "override";
	function isOverride(annotation) {
		return annotation.annotationType_ === OVERRIDE;
	}
	function createActionAnnotation(name, options) {
		return {
			annotationType_: name,
			options_: options,
			make_: make_$5,
			extend_: extend_$4
		};
	}
	function make_$5(adm, key, descriptor, source) {
		var _this$options_;
		if ((_this$options_ = this.options_) != null && _this$options_.bound) return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
		if (source === adm.target_) return this.extend_(adm, key, descriptor, false) === null ? 0 : 2;
		if (isAction(descriptor.value)) return 1;
		defineProperty(source, key, createActionDescriptor(adm, this, key, descriptor, false));
		return 2;
	}
	function extend_$4(adm, key, descriptor, proxyTrap) {
		const actionDescriptor = createActionDescriptor(adm, this, key, descriptor);
		return adm.defineProperty_(key, actionDescriptor, proxyTrap);
	}
	function decorateAction20223_(annotation, mthd, context) {
		if (__MOBX_DEV__) assert20223DecoratorType(context, ["method", "field"]);
		const { kind, name, addInitializer } = context;
		const ann = annotation;
		const _createAction = (m) => {
			var _ann$options_$name, _ann$options_, _ann$options_$autoAct, _ann$options_2;
			return createAction((_ann$options_$name = (_ann$options_ = ann.options_) == null ? void 0 : _ann$options_.name) != null ? _ann$options_$name : name.toString(), m, (_ann$options_$autoAct = (_ann$options_2 = ann.options_) == null ? void 0 : _ann$options_2.autoAction) != null ? _ann$options_$autoAct : false);
		};
		if (kind == "field") return function(initMthd) {
			var _ann$options_3;
			let mthd = initMthd;
			if (!isAction(mthd)) mthd = _createAction(mthd);
			if ((_ann$options_3 = ann.options_) != null && _ann$options_3.bound) {
				mthd = mthd.bind(this);
				mthd.isMobxAction = true;
			}
			return mthd;
		};
		if (kind == "method") {
			var _ann$options_4;
			if (!isAction(mthd)) mthd = _createAction(mthd);
			if ((_ann$options_4 = ann.options_) != null && _ann$options_4.bound) addInitializer(function() {
				const self = this;
				const bound = self[name].bind(self);
				bound.isMobxAction = true;
				self[name] = bound;
			});
			return mthd;
		}
		die(43, ann.annotationType_, String(name), kind);
	}
	function assertActionDescriptor(adm, { annotationType_ }, key, { value }) {
		if (__MOBX_DEV__ && !isFunction(value)) die(\`Cannot apply '\${annotationType_}' to '\${adm.name_}.\${key.toString()}':\\n'\${annotationType_}' can only be used on properties with a function value.\`);
	}
	function createActionDescriptor(adm, annotation, key, descriptor, safeDescriptors = globalState.safeDescriptors) {
		var _annotation$options_, _annotation$options_$, _annotation$options_2, _annotation$options_$2, _annotation$options_3, _annotation$options_4, _adm$proxy_2;
		assertActionDescriptor(adm, annotation, key, descriptor);
		let { value } = descriptor;
		if ((_annotation$options_ = annotation.options_) != null && _annotation$options_.bound) {
			var _adm$proxy_;
			value = value.bind((_adm$proxy_ = adm.proxy_) != null ? _adm$proxy_ : adm.target_);
		}
		return {
			value: createAction((_annotation$options_$ = (_annotation$options_2 = annotation.options_) == null ? void 0 : _annotation$options_2.name) != null ? _annotation$options_$ : key.toString(), value, (_annotation$options_$2 = (_annotation$options_3 = annotation.options_) == null ? void 0 : _annotation$options_3.autoAction) != null ? _annotation$options_$2 : false, (_annotation$options_4 = annotation.options_) != null && _annotation$options_4.bound ? (_adm$proxy_2 = adm.proxy_) != null ? _adm$proxy_2 : adm.target_ : void 0),
			configurable: safeDescriptors ? adm.isPlainObject_ : true,
			enumerable: false,
			writable: safeDescriptors ? false : true
		};
	}
	function createFlowAnnotation(name, options) {
		return {
			annotationType_: name,
			options_: options,
			make_: make_$4,
			extend_: extend_$3
		};
	}
	function make_$4(adm, key, descriptor, source) {
		var _this$options_;
		if (source === adm.target_) return this.extend_(adm, key, descriptor, false) === null ? 0 : 2;
		if ((_this$options_ = this.options_) != null && _this$options_.bound && (!hasProp(adm.target_, key) || !isFlow(adm.target_[key]))) {
			if (this.extend_(adm, key, descriptor, false) === null) return 0;
		}
		if (isFlow(descriptor.value)) return 1;
		defineProperty(source, key, createFlowDescriptor(adm, this, key, descriptor, false, false));
		return 2;
	}
	function extend_$3(adm, key, descriptor, proxyTrap) {
		var _this$options_2;
		const flowDescriptor = createFlowDescriptor(adm, this, key, descriptor, (_this$options_2 = this.options_) == null ? void 0 : _this$options_2.bound);
		return adm.defineProperty_(key, flowDescriptor, proxyTrap);
	}
	function decorateFlow20223_(annotation, mthd, context) {
		var _annotation$options_;
		if (__MOBX_DEV__) assert20223DecoratorType(context, ["method"]);
		const { name, addInitializer } = context;
		if (!isFlow(mthd)) mthd = flow(mthd);
		if ((_annotation$options_ = annotation.options_) != null && _annotation$options_.bound) addInitializer(function() {
			const self = this;
			const bound = self[name].bind(self);
			bound.isMobXFlow = true;
			self[name] = bound;
		});
		return mthd;
	}
	function assertFlowDescriptor(adm, { annotationType_ }, key, { value }) {
		if (__MOBX_DEV__ && !isFunction(value)) die(\`Cannot apply '\${annotationType_}' to '\${adm.name_}.\${key.toString()}':\\n'\${annotationType_}' can only be used on properties with a generator function value.\`);
	}
	function createFlowDescriptor(adm, annotation, key, descriptor, bound, safeDescriptors = globalState.safeDescriptors) {
		assertFlowDescriptor(adm, annotation, key, descriptor);
		let { value } = descriptor;
		if (!isFlow(value)) value = flow(value);
		if (bound) {
			var _adm$proxy_;
			value = value.bind((_adm$proxy_ = adm.proxy_) != null ? _adm$proxy_ : adm.target_);
			value.isMobXFlow = true;
		}
		return {
			value,
			configurable: safeDescriptors ? adm.isPlainObject_ : true,
			enumerable: false,
			writable: safeDescriptors ? false : true
		};
	}
	function createComputedAnnotation(name, options) {
		return {
			annotationType_: name,
			options_: options,
			make_: make_$3,
			extend_: extend_$2
		};
	}
	function make_$3(adm, key, descriptor) {
		return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
	}
	function extend_$2(adm, key, descriptor, proxyTrap) {
		assertComputedDescriptor(adm, this, key, descriptor);
		return adm.defineComputedProperty_(key, assign({}, this.options_, {
			get: descriptor.get,
			set: descriptor.set
		}), proxyTrap);
	}
	function decorateComputed20223_(annotation, get, context) {
		if (__MOBX_DEV__) assert20223DecoratorType(context, ["getter"]);
		const ann = annotation;
		const { name: key, addInitializer } = context;
		let computedValues;
		function createComputedValue(target, adm) {
			const options = assign({}, ann.options_, {
				get,
				context: target
			});
			options.name || (options.name = __MOBX_DEV__ ? \`\${adm.name_}.\${key.toString()}\` : \`ObservableObject.\${key.toString()}\`);
			return new ComputedValue(options);
		}
		addInitializer(function() {
			var _adm$lazyComputedKeys;
			const adm = asObservableObject(this)[$mobx];
			const target = this;
			const observable = adm.values_.get(key);
			if (observable instanceof ComputedValue && observable.derivation !== get) adm.values_.delete(key);
			((_adm$lazyComputedKeys = adm.lazyComputedKeys_) != null ? _adm$lazyComputedKeys : adm.lazyComputedKeys_ = /* @__PURE__ */ new Map()).set(key, () => createComputedValue(target, adm));
		});
		return function() {
			const adm = this[$mobx];
			const observable = adm.values_.get(key);
			if (observable instanceof ComputedValue && observable.derivation !== get) {
				var _computedValues;
				let computed = (_computedValues = computedValues) == null ? void 0 : _computedValues.get(this);
				if (!computed) {
					var _computedValues2;
					computed = createComputedValue(this, adm);
					((_computedValues2 = computedValues) != null ? _computedValues2 : computedValues = /* @__PURE__ */ new WeakMap()).set(this, computed);
				}
				return computed.get();
			}
			return adm.getObservablePropValue_(key);
		};
	}
	function assertComputedDescriptor(adm, { annotationType_ }, key, { get }) {
		if (__MOBX_DEV__ && !get) die(\`Cannot apply '\${annotationType_}' to '\${adm.name_}.\${key.toString()}':\\n'\${annotationType_}' can only be used on getter(+setter) properties.\`);
	}
	function createObservableAnnotation(name, options) {
		return {
			annotationType_: name,
			options_: options,
			make_: make_$2,
			extend_: extend_$1
		};
	}
	function make_$2(adm, key, descriptor) {
		return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
	}
	function extend_$1(adm, key, descriptor, proxyTrap) {
		var _this$options_$enhanc, _this$options_;
		assertObservableDescriptor(adm, this, key, descriptor);
		return adm.defineObservableProperty_(key, descriptor.value, (_this$options_$enhanc = (_this$options_ = this.options_) == null ? void 0 : _this$options_.enhancer_) != null ? _this$options_$enhanc : deepEnhancer, proxyTrap);
	}
	function decorateObservable20223_(annotation, desc, context) {
		if (__MOBX_DEV__) {
			if (context.kind === "field") throw die(\`Please use \\\`@observable accessor \${String(context.name)}\\\` instead of \\\`@observable \${String(context.name)}\\\`\`);
			assert20223DecoratorType(context, ["accessor"]);
		}
		const ann = annotation;
		const { kind, name } = context;
		if (kind !== "accessor") return;
		function registerLazy(target, value) {
			var _adm$lazyObservableKe;
			const adm = asObservableObject(target)[$mobx];
			((_adm$lazyObservableKe = adm.lazyObservableKeys_) != null ? _adm$lazyObservableKe : adm.lazyObservableKeys_ = /* @__PURE__ */ new Map()).set(name, () => {
				var _ann$options_$enhance, _ann$options_;
				return new ObservableValue(value, (_ann$options_$enhance = (_ann$options_ = ann.options_) == null ? void 0 : _ann$options_.enhancer_) != null ? _ann$options_$enhance : deepEnhancer, __MOBX_DEV__ ? \`\${adm.name_}.\${name.toString()}\` : \`ObservableObject.\${name.toString()}\`, false);
			});
			return adm;
		}
		return {
			get() {
				var _this$$mobx;
				return ((_this$$mobx = this[$mobx]) != null ? _this$$mobx : registerLazy(this, desc.get.call(this))).getObservablePropValue_(name);
			},
			set(value) {
				var _this$$mobx2;
				return ((_this$$mobx2 = this[$mobx]) != null ? _this$$mobx2 : registerLazy(this, value)).setObservablePropValue_(name, value);
			},
			init(value) {
				registerLazy(this, value);
				return value;
			}
		};
	}
	function assertObservableDescriptor(adm, { annotationType_ }, key, descriptor) {
		if (__MOBX_DEV__ && !("value" in descriptor)) die(\`Cannot apply '\${annotationType_}' to '\${adm.name_}.\${key.toString()}':\\n'\${annotationType_}' cannot be used on getter/setter properties\`);
	}
	var AUTO = "true";
	var autoAnnotation = /*#__PURE__*/ createAutoAnnotation();
	function createAutoAnnotation(options) {
		return {
			annotationType_: AUTO,
			options_: options,
			make_: make_$1,
			extend_
		};
	}
	function make_$1(adm, key, descriptor, source) {
		var _this$options_3, _this$options_4;
		if (descriptor.get) return computed.make_(adm, key, descriptor, source);
		if (descriptor.set) {
			const set = isAction(descriptor.set) ? descriptor.set : createAction(key.toString(), descriptor.set);
			if (source === adm.target_) return adm.defineProperty_(key, {
				configurable: globalState.safeDescriptors ? adm.isPlainObject_ : true,
				set
			}) === null ? 0 : 2;
			defineProperty(source, key, {
				configurable: true,
				set
			});
			return 2;
		}
		if (source !== adm.target_ && typeof descriptor.value === "function") {
			var _this$options_2;
			if (isGenerator(descriptor.value)) {
				var _this$options_;
				return ((_this$options_ = this.options_) != null && _this$options_.autoBind ? flowBound : flow).make_(adm, key, descriptor, source);
			}
			return ((_this$options_2 = this.options_) != null && _this$options_2.autoBind ? autoActionBound : autoAction).make_(adm, key, descriptor, source);
		}
		let observableAnnotation = ((_this$options_3 = this.options_) == null ? void 0 : _this$options_3.deep) === false ? observableRef : observable;
		if (typeof descriptor.value === "function" && (_this$options_4 = this.options_) != null && _this$options_4.autoBind) {
			var _adm$proxy_;
			descriptor.value = descriptor.value.bind((_adm$proxy_ = adm.proxy_) != null ? _adm$proxy_ : adm.target_);
		}
		return observableAnnotation.make_(adm, key, descriptor, source);
	}
	function extend_(adm, key, descriptor, proxyTrap) {
		var _this$options_5, _this$options_6;
		if (descriptor.get) return computed.extend_(adm, key, descriptor, proxyTrap);
		if (descriptor.set) return adm.defineProperty_(key, {
			configurable: globalState.safeDescriptors ? adm.isPlainObject_ : true,
			set: createAction(key.toString(), descriptor.set)
		}, proxyTrap);
		if (typeof descriptor.value === "function" && (_this$options_5 = this.options_) != null && _this$options_5.autoBind) {
			var _adm$proxy_2;
			descriptor.value = descriptor.value.bind((_adm$proxy_2 = adm.proxy_) != null ? _adm$proxy_2 : adm.target_);
		}
		return (((_this$options_6 = this.options_) == null ? void 0 : _this$options_6.deep) === false ? observableRef : observable).extend_(adm, key, descriptor, proxyTrap);
	}
	function createDecoratorAnnotation(annotation, decorate) {
		return assign(function decoratorAnnotation(value, context) {
			if (context && typeof context.kind === "string") return decorate(annotation, value, context);
			if (__MOBX_DEV__) die(\`Invalid arguments for \\\`\${annotation.annotationType_}\\\`\`);
		}, annotation);
	}
	var OBSERVABLE = "observable";
	var OBSERVABLE_REF = "observable.ref";
	var OBSERVABLE_SHALLOW = "observable.shallow";
	var defaultCreateObservableOptions = {
		deep: true,
		name: void 0,
		defaultDecorator: void 0
	};
	Object.freeze(defaultCreateObservableOptions);
	function asCreateObservableOptions(thing) {
		return thing || defaultCreateObservableOptions;
	}
	var observableAnnotation = /*#__PURE__*/ createObservableAnnotation(OBSERVABLE);
	var observableRefAnnotation = /*#__PURE__*/ createObservableAnnotation(OBSERVABLE_REF, { enhancer_: referenceEnhancer });
	var observableShallowAnnotation = /*#__PURE__*/ createObservableAnnotation(OBSERVABLE_SHALLOW, { enhancer_: shallowEnhancer });
	function createObservableDecoratorAnnotation(annotation) {
		return createDecoratorAnnotation(annotation, decorateObservable20223_);
	}
	function getEnhancerFromOptions(options) {
		return options.deep === true ? deepEnhancer : options.deep === false ? referenceEnhancer : getEnhancerFromAnnotation(options.defaultDecorator);
	}
	function getAnnotationFromOptions(options) {
		var _options$defaultDecor;
		return options ? (_options$defaultDecor = options.defaultDecorator) != null ? _options$defaultDecor : createAutoAnnotation(options) : void 0;
	}
	function getEnhancerFromAnnotation(annotation) {
		var _annotation$options_$, _annotation$options_;
		return !annotation ? deepEnhancer : (_annotation$options_$ = (_annotation$options_ = annotation.options_) == null ? void 0 : _annotation$options_.enhancer_) != null ? _annotation$options_$ : deepEnhancer;
	}
	/**
	* Turns an object, array or function into a reactive structure.
	* @param v the value which should become observable.
	*/
	function createObservable(v, arg2, arg3) {
		if (arg2 && typeof arg2.kind === "string") return decorateObservable20223_(observableAnnotation, v, arg2);
		if (isObservable(v)) return v;
		if (isPlainObject(v)) return observable.object(v, arg2, arg3);
		if (Array.isArray(v)) return observable.array(v, arg2);
		if (isES6Map(v)) return observable.map(v, arg2);
		if (isES6Set(v)) return observable.set(v, arg2);
		if (typeof v === "object" && v !== null) return v;
		return observable.box(v, arg2);
	}
	var observableFactories = {
		box(value, options) {
			const o = asCreateObservableOptions(options);
			return new ObservableValue(value, getEnhancerFromOptions(o), o.name, true, o.equals);
		},
		array(initialValues, options) {
			const o = asCreateObservableOptions(options);
			return createObservableArray(initialValues, getEnhancerFromOptions(o), o.name);
		},
		map(initialValues, options) {
			const o = asCreateObservableOptions(options);
			return new ObservableMap(initialValues, getEnhancerFromOptions(o), o.name);
		},
		set(initialValues, options) {
			const o = asCreateObservableOptions(options);
			return new ObservableSet(initialValues, getEnhancerFromOptions(o), o.name);
		},
		object(props, annotations, options) {
			return initObservable(() => extendObservable(asDynamicObservableObject({}, options), props, annotations));
		}
	};
	var observableRef = /*#__PURE__*/ createObservableDecoratorAnnotation(observableRefAnnotation);
	var observableShallow = /*#__PURE__*/ createObservableDecoratorAnnotation(observableShallowAnnotation);
	var observable = /*#__PURE__*/ assign(createObservable, observableAnnotation, observableFactories);
	var COMPUTED = "computed";
	function createComputedDecoratorAnnotation(annotation) {
		return createDecoratorAnnotation(annotation, decorateComputed20223_);
	}
	var computedAnnotation = /*#__PURE__*/ createComputedAnnotation(COMPUTED);
	var computed = function computed(arg1, arg2) {
		if (arg2 && typeof arg2.kind === "string") return decorateComputed20223_(computedAnnotation, arg1, arg2);
		if (isPlainObject(arg1)) return createComputedDecoratorAnnotation(createComputedAnnotation(COMPUTED, arg1));
		if (__MOBX_DEV__) {
			if (!isFunction(arg1)) die("First argument to \`computed\` should be an expression.");
			if (isFunction(arg2)) die("A setter as second argument is no longer supported, use \`{ set: fn }\` option instead");
		}
		const opts = isPlainObject(arg2) ? arg2 : {};
		opts.get = arg1;
		opts.name || (opts.name = arg1.name || "");
		return new ComputedValue(opts);
	};
	assign(computed, computedAnnotation);
	var _getDescriptor$config;
	var _getDescriptor;
	var currentActionId = 0;
	var nextActionId = 1;
	var isFunctionNameConfigurable = (_getDescriptor$config = (_getDescriptor = /*#__PURE__*/ getDescriptor(() => {}, "name")) == null ? void 0 : _getDescriptor.configurable) != null ? _getDescriptor$config : false;
	var tmpNameDescriptor = {
		value: "action",
		configurable: true,
		writable: false,
		enumerable: false
	};
	function createAction(actionName, fn, autoAction = false, ref) {
		if (__MOBX_DEV__) {
			if (!isFunction(fn)) die("\`action\` can only be invoked on functions");
			if (typeof actionName !== "string" || !actionName) die(\`actions should have valid names, got: '\${actionName}'\`);
		}
		function res() {
			return executeAction(actionName, autoAction, fn, ref || this, arguments);
		}
		res.isMobxAction = true;
		res.toString = () => fn.toString();
		if (isFunctionNameConfigurable) {
			tmpNameDescriptor.value = actionName;
			defineProperty(res, "name", tmpNameDescriptor);
		}
		return res;
	}
	function executeAction(actionName, canRunAsDerivation, fn, scope, args) {
		const runInfo = _startAction(actionName, canRunAsDerivation, scope, args);
		try {
			return fn.apply(scope, args);
		} catch (err) {
			runInfo.error_ = err;
			throw err;
		} finally {
			_endAction(runInfo);
		}
	}
	function _startAction(actionName, canRunAsDerivation, scope, args) {
		const notifySpy_ = __MOBX_DEV__ && isSpyEnabled() && !!actionName;
		let startTime_ = 0;
		if (notifySpy_) {
			startTime_ = Date.now();
			spyReportStart({
				type: ACTION,
				name: actionName,
				object: scope,
				arguments: args ? Array.from(args) : EMPTY_ARRAY
			});
		}
		const prevDerivation_ = globalState.trackingDerivation;
		const runAsAction = !canRunAsDerivation || !prevDerivation_;
		startBatch();
		let prevAllowStateChanges_ = globalState.allowStateChanges;
		if (runAsAction) {
			untrackedStart();
			if (__MOBX_DEV__) prevAllowStateChanges_ = allowStateChangesStart(true);
		}
		const prevAllowStateReads_ = globalState.allowStateReads;
		if (__MOBX_DEV__) allowStateReadsStart(true);
		const runInfo = {
			runAsAction_: runAsAction,
			prevDerivation_,
			prevAllowStateChanges_,
			prevAllowStateReads_,
			notifySpy_,
			startTime_,
			actionId_: nextActionId++,
			parentActionId_: currentActionId
		};
		currentActionId = runInfo.actionId_;
		return runInfo;
	}
	function _endAction(runInfo) {
		if (currentActionId !== runInfo.actionId_) die(30);
		currentActionId = runInfo.parentActionId_;
		if (runInfo.error_ !== void 0) globalState.suppressReactionErrors = true;
		if (__MOBX_DEV__) {
			allowStateChangesEnd(runInfo.prevAllowStateChanges_);
			allowStateReadsEnd(runInfo.prevAllowStateReads_);
		}
		endBatch();
		if (runInfo.runAsAction_) untrackedEnd(runInfo.prevDerivation_);
		if (__MOBX_DEV__ && runInfo.notifySpy_) spyReportEnd({ time: Date.now() - runInfo.startTime_ });
		globalState.suppressReactionErrors = false;
	}
	function allowStateChangesStart(allowStateChanges) {
		const prev = globalState.allowStateChanges;
		globalState.allowStateChanges = allowStateChanges;
		return prev;
	}
	function allowStateChangesEnd(prev) {
		globalState.allowStateChanges = prev;
	}
	var CREATE = "create";
	var ObservableValue = class extends Atom {
		constructor(value, enhancer_, name_ = __MOBX_DEV__ ? "ObservableValue@" + getNextId() : "ObservableValue", notifySpy = true, equals_ = compareDefault) {
			super(name_);
			this.enhancer_ = void 0;
			this.name_ = void 0;
			this.equals_ = void 0;
			this.hasUnreportedChange_ = false;
			this.interceptors_ = void 0;
			this.changeListeners_ = void 0;
			this.value_ = void 0;
			this.dehancer = void 0;
			this.enhancer_ = enhancer_;
			this.name_ = name_;
			this.equals_ = equals_;
			this.value_ = enhancer_(value, void 0, name_);
			if (__MOBX_DEV__ && notifySpy && isSpyEnabled()) {
				var _this$value_;
				spyReport({
					type: CREATE,
					object: this,
					observableKind: "value",
					debugObjectName: this.name_,
					newValue: "" + ((_this$value_ = this.value_) == null ? void 0 : _this$value_.toString())
				});
			}
		}
		dehanceValue(value) {
			if (this.dehancer !== void 0) return this.dehancer(value);
			return value;
		}
		set(newValue) {
			const oldValue = this.value_;
			newValue = this.prepareNewValue_(newValue);
			if (newValue !== globalState.UNCHANGED) {
				const notifySpy = __MOBX_DEV__ && isSpyEnabled();
				if (__MOBX_DEV__ && notifySpy) spyReportStart({
					type: UPDATE,
					object: this,
					observableKind: "value",
					debugObjectName: this.name_,
					newValue,
					oldValue
				});
				this.setNewValue_(newValue);
				if (__MOBX_DEV__ && notifySpy) spyReportEnd();
			}
		}
		prepareNewValue_(newValue) {
			checkIfStateModificationsAreAllowed(this);
			if (hasInterceptors(this)) {
				const change = interceptChange(this, {
					object: this,
					type: UPDATE,
					newValue
				});
				if (!change) return globalState.UNCHANGED;
				newValue = change.newValue;
			}
			newValue = this.enhancer_(newValue, this.value_, this.name_);
			return this.equals_(this.value_, newValue) ? globalState.UNCHANGED : newValue;
		}
		setNewValue_(newValue) {
			const oldValue = this.value_;
			this.value_ = newValue;
			this.reportChanged();
			if (hasListeners(this)) notifyListeners(this, {
				type: UPDATE,
				object: this,
				newValue,
				oldValue
			});
		}
		get() {
			this.reportObserved();
			return this.dehanceValue(this.value_);
		}
		raw() {
			return this.value_;
		}
		toJSON() {
			return this.get();
		}
		toString() {
			return \`\${this.name_}[\${this.value_}]\`;
		}
		valueOf() {
			return toPrimitive(this.get());
		}
		[Symbol.toPrimitive]() {
			return this.valueOf();
		}
	};
	var ComputedValue = class {
		/**
		* Create a new computed value based on a function expression.
		*
		* The \`name\` property is for debug purposes only.
		*
		* The \`equals\` property specifies the comparer function used to determine if a newly produced
		* value differs from the previous value. Structural comparison can be convenient if you always
		* produce a new aggregated object and don't want to notify observers if it is structurally the same.
		* This is useful for working with vectors, mouse coordinates etc.
		*/
		constructor(options) {
			this.dependenciesState_ = -1;
			this.observing_ = [];
			this.newObserving_ = null;
			this.observers_ = null;
			this.runId_ = 0;
			this.lastAccessedBy_ = 0;
			this.lowestObserverState_ = 0;
			this.unboundDepsCount_ = 0;
			this.value_ = new CaughtException(null);
			this.name_ = void 0;
			this.triggeredBy_ = void 0;
			this.flags_ = 0;
			this.derivation = void 0;
			this.setter_ = void 0;
			this.scope_ = void 0;
			this.equals_ = void 0;
			this.requiresReaction_ = void 0;
			this.keepAlive_ = void 0;
			this.onBOL = void 0;
			this.onBUOL = void 0;
			if (!options.get) die(31);
			this.derivation = options.get;
			this.name_ = options.name || (__MOBX_DEV__ ? "ComputedValue@" + getNextId() : "ComputedValue");
			if (options.set) this.setter_ = createAction(__MOBX_DEV__ ? this.name_ + "-setter" : "ComputedValue-setter", options.set);
			this.equals_ = options.equals || compareDefault;
			this.scope_ = options.context;
			this.requiresReaction_ = options.requiresReaction;
			this.keepAlive_ = !!options.keepAlive;
		}
		onBecomeStale_() {
			propagateMaybeChanged(this);
		}
		onBO() {
			if (this.onBOL) this.onBOL.forEach((listener) => listener());
		}
		onBUO() {
			if (this.onBUOL) this.onBUOL.forEach((listener) => listener());
		}
		get isComputing() {
			return getFlag(this.flags_, 1);
		}
		set isComputing(newValue) {
			this.flags_ = setFlag(this.flags_, 1, newValue);
		}
		get isRunningSetter() {
			return getFlag(this.flags_, 2);
		}
		set isRunningSetter(newValue) {
			this.flags_ = setFlag(this.flags_, 2, newValue);
		}
		get isBeingObserved() {
			return getFlag(this.flags_, 4);
		}
		set isBeingObserved(newValue) {
			this.flags_ = setFlag(this.flags_, 4, newValue);
		}
		get isPendingUnobservation() {
			return getFlag(this.flags_, 8);
		}
		set isPendingUnobservation(newValue) {
			this.flags_ = setFlag(this.flags_, 8, newValue);
		}
		get diffValue() {
			return getFlag(this.flags_, 16) ? 1 : 0;
		}
		set diffValue(newValue) {
			this.flags_ = setFlag(this.flags_, 16, newValue === 1 ? true : false);
		}
		/**
		* Returns the current value of this computed value.
		* Will evaluate its computation first if needed.
		*/
		get() {
			if (this.isComputing) die(32, this.name_, this.derivation);
			if (globalState.inBatch === 0 && (!this.observers_ || this.observers_.size === 0) && !this.keepAlive_) {
				if (shouldCompute(this)) {
					this.warnAboutUntrackedRead_();
					startBatch();
					this.value_ = this.computeValue_(false);
					endBatch();
				}
			} else {
				const wasBeingObserved = this.isBeingObserved;
				reportObserved(this);
				if (shouldCompute(this)) {
					let prevTrackingContext = globalState.trackingContext;
					if (this.keepAlive_ && !prevTrackingContext) globalState.trackingContext = this;
					if (this.trackAndCompute()) propagateChangeConfirmed(this);
					globalState.trackingContext = prevTrackingContext;
				} else if (!wasBeingObserved && this.isBeingObserved) this.observing_.forEach(markObserved);
			}
			const result = this.value_;
			if (isCaughtException(result)) throw result.cause;
			return result;
		}
		set(value) {
			if (this.setter_) {
				if (this.isRunningSetter) die(33, this.name_);
				this.isRunningSetter = true;
				try {
					this.setter_.call(this.scope_, value);
				} finally {
					this.isRunningSetter = false;
				}
			} else die(34, this.name_);
		}
		trackAndCompute() {
			const oldValue = this.value_;
			const wasSuspended = this.dependenciesState_ === -1;
			const newValue = this.computeValue_(true);
			const changed = wasSuspended || isCaughtException(oldValue) || isCaughtException(newValue) || !this.equals_(oldValue, newValue);
			if (changed) {
				this.value_ = newValue;
				if (__MOBX_DEV__ && isSpyEnabled()) spyReport({
					observableKind: "computed",
					debugObjectName: this.name_,
					object: this.scope_,
					type: "update",
					oldValue,
					newValue
				});
			}
			return changed;
		}
		computeValue_(track) {
			this.isComputing = true;
			const prev = __MOBX_DEV__ ? allowStateChangesStart(false) : false;
			let res;
			if (track) res = trackDerivedFunction(this, this.derivation, this.scope_);
			else if (globalState.disableErrorBoundaries === true) res = this.derivation.call(this.scope_);
			else try {
				res = this.derivation.call(this.scope_);
			} catch (e) {
				res = new CaughtException(e);
			}
			if (__MOBX_DEV__) allowStateChangesEnd(prev);
			this.isComputing = false;
			return res;
		}
		suspend_() {
			if (!this.keepAlive_) {
				clearObserving(this);
				this.value_ = void 0;
			}
		}
		warnAboutUntrackedRead_() {
			if (!__MOBX_DEV__) return;
			if (typeof this.requiresReaction_ === "boolean" ? this.requiresReaction_ : globalState.computedRequiresReaction) console.warn(\`[mobx] Computed value '\${this.name_}' is being read outside a reactive context. Doing a full recompute.\`);
		}
		toString() {
			return \`\${this.name_}[\${this.derivation.toString()}]\`;
		}
		valueOf() {
			return toPrimitive(this.get());
		}
		[Symbol.toPrimitive]() {
			return this.valueOf();
		}
	};
	var isComputedValue = /*#__PURE__*/ createInstanceofPredicate("ComputedValue", ComputedValue);
	var CaughtException = class {
		constructor(cause) {
			this.cause = void 0;
			this.cause = cause;
		}
	};
	function isCaughtException(e) {
		return e instanceof CaughtException;
	}
	/**
	* Finds out whether any dependency of the derivation has actually changed.
	* If dependenciesState is 1 then it will recalculate dependencies,
	* if any dependency changed it will propagate it by changing dependenciesState to 2.
	*
	* By iterating over the dependencies in the same order that they were reported and
	* stopping on the first change, all the recalculations are only called for ComputedValues
	* that will be tracked by derivation. That is because we assume that if the first x
	* dependencies of the derivation doesn't change then the derivation should run the same way
	* up until accessing x-th dependency.
	*/
	function shouldCompute(derivation) {
		switch (derivation.dependenciesState_) {
			case 0: return false;
			case -1:
			case 2: return true;
			case 1: {
				const prevAllowStateReads = __MOBX_DEV__ ? allowStateReadsStart(true) : true;
				const prevUntracked = untrackedStart();
				const obs = derivation.observing_, l = obs.length;
				for (let i = 0; i < l; i++) {
					const obj = obs[i];
					if (isComputedValue(obj)) {
						if (globalState.disableErrorBoundaries) obj.get();
						else try {
							obj.get();
						} catch (e) {
							untrackedEnd(prevUntracked);
							if (__MOBX_DEV__) allowStateReadsEnd(prevAllowStateReads);
							return true;
						}
						if (derivation.dependenciesState_ === 2) {
							untrackedEnd(prevUntracked);
							if (__MOBX_DEV__) allowStateReadsEnd(prevAllowStateReads);
							return true;
						}
					}
				}
				changeDependenciesStateTo0(derivation);
				untrackedEnd(prevUntracked);
				if (__MOBX_DEV__) allowStateReadsEnd(prevAllowStateReads);
				return false;
			}
		}
	}
	function checkIfStateModificationsAreAllowed(atom) {
		if (!__MOBX_DEV__) return;
		const hasObservers = !!atom.observers_ && atom.observers_.size > 0;
		if (!globalState.allowStateChanges && (hasObservers || globalState.enforceActions === "always")) console.warn("[MobX] " + (globalState.enforceActions ? "Since strict-mode is enabled, changing (observed) observable values without using an action is not allowed. Tried to modify: " : "Side effects like changing state are not allowed at this point. Are you trying to modify state from, for example, a computed value or the render function of a React component? You can wrap side effects in 'runInAction' (or decorate functions with 'action') if needed. Tried to modify: ") + atom.name_);
	}
	function checkIfStateReadsAreAllowed(observable) {
		if (__MOBX_DEV__ && !globalState.allowStateReads && globalState.observableRequiresReaction) console.warn(\`[mobx] Observable '\${observable.name_}' being read outside a reactive context.\`);
	}
	/**
	* Executes the provided function \`f\` and tracks which observables are being accessed.
	* The tracking information is stored on the \`derivation\` object and the derivation is registered
	* as observer of any of the accessed observables.
	*/
	function trackDerivedFunction(derivation, f, context) {
		const prevAllowStateReads = __MOBX_DEV__ ? allowStateReadsStart(true) : true;
		changeDependenciesStateTo0(derivation);
		derivation.newObserving_ = new Array(derivation.runId_ === 0 ? 100 : derivation.observing_.length);
		derivation.unboundDepsCount_ = 0;
		derivation.runId_ = ++globalState.runId;
		const prevTracking = globalState.trackingDerivation;
		globalState.trackingDerivation = derivation;
		globalState.inBatch++;
		let result;
		if (globalState.disableErrorBoundaries === true) result = f.call(context);
		else try {
			result = f.call(context);
		} catch (e) {
			result = new CaughtException(e);
		}
		globalState.inBatch--;
		globalState.trackingDerivation = prevTracking;
		bindDependencies(derivation);
		warnAboutDerivationWithoutDependencies(derivation);
		if (__MOBX_DEV__) allowStateReadsEnd(prevAllowStateReads);
		return result;
	}
	function warnAboutDerivationWithoutDependencies(derivation) {
		if (!__MOBX_DEV__) return;
		if (derivation.observing_.length !== 0) return;
		if (typeof derivation.requiresObservable_ === "boolean" ? derivation.requiresObservable_ : globalState.reactionRequiresObservable) console.warn(\`[mobx] Derivation '\${derivation.name_}' is created/updated without reading any observable value.\`);
	}
	/**
	* diffs newObserving with observing.
	* update observing to be newObserving with unique observables
	* notify observers that become observed/unobserved
	*/
	function bindDependencies(derivation) {
		const prevObserving = derivation.observing_;
		const observing = derivation.observing_ = derivation.newObserving_;
		let lowestNewObservingDerivationState = 0;
		let i0 = 0, l = derivation.unboundDepsCount_;
		for (let i = 0; i < l; i++) {
			const dep = observing[i];
			if (dep.diffValue === 0) {
				dep.diffValue = 1;
				if (i0 !== i) observing[i0] = dep;
				i0++;
			}
			if (dep.dependenciesState_ > lowestNewObservingDerivationState) lowestNewObservingDerivationState = dep.dependenciesState_;
		}
		observing.length = i0;
		derivation.newObserving_ = null;
		l = prevObserving.length;
		while (l--) {
			const dep = prevObserving[l];
			if (dep.diffValue === 0) removeObserver(dep, derivation);
			dep.diffValue = 0;
		}
		while (i0--) {
			const dep = observing[i0];
			if (dep.diffValue === 1) {
				dep.diffValue = 0;
				addObserver(dep, derivation);
			}
		}
		if (lowestNewObservingDerivationState !== 0) {
			derivation.dependenciesState_ = lowestNewObservingDerivationState;
			derivation.onBecomeStale_();
		}
	}
	function clearObserving(derivation) {
		const obs = derivation.observing_;
		derivation.observing_ = [];
		let i = obs.length;
		while (i--) removeObserver(obs[i], derivation);
		derivation.dependenciesState_ = -1;
	}
	function untracked(action) {
		const prev = untrackedStart();
		try {
			return action();
		} finally {
			untrackedEnd(prev);
		}
	}
	function untrackedStart() {
		const prev = globalState.trackingDerivation;
		globalState.trackingDerivation = null;
		return prev;
	}
	function untrackedEnd(prev) {
		globalState.trackingDerivation = prev;
	}
	function allowStateReadsStart(allowStateReads) {
		const prev = globalState.allowStateReads;
		globalState.allowStateReads = allowStateReads;
		return prev;
	}
	function allowStateReadsEnd(prev) {
		globalState.allowStateReads = prev;
	}
	/**
	* needed to keep \`lowestObserverState\` correct. when changing from (2 or 1) to 0
	*
	*/
	function changeDependenciesStateTo0(derivation) {
		if (derivation.dependenciesState_ === 0) return;
		derivation.dependenciesState_ = 0;
		const obs = derivation.observing_;
		let i = obs.length;
		while (i--) obs[i].lowestObserverState_ = 0;
	}
	var MOBX_GLOBALS_VERSION = 7;
	var MobXGlobals = class {
		constructor() {
			/**
			* MobXGlobals version.
			* MobX compatiblity with other versions loaded in memory as long as this version matches.
			* It indicates that the global state still stores similar information
			*
			* N.B: this version is unrelated to the package version of MobX, and is only the version of the
			* internal state storage of MobX, and can be the same across many different package versions
			*/
			this.version = MOBX_GLOBALS_VERSION;
			/**
			* globally unique token to signal unchanged
			*/
			this.UNCHANGED = {};
			/**
			* Currently running derivation
			*/
			this.trackingDerivation = null;
			/**
			* Currently running reaction. This determines if we currently have a reactive context.
			* (Tracking derivation is also set for temporal tracking of computed values inside actions,
			* but trackingReaction can only be set by a form of Reaction)
			*/
			this.trackingContext = null;
			/**
			* Each time a derivation is tracked, it is assigned a unique run-id
			*/
			this.runId = 0;
			/**
			* 'guid' for general purpose. Will be persisted amongst resets.
			*/
			this.mobxGuid = 0;
			/**
			* Are we in a batch block? (and how many of them)
			*/
			this.inBatch = 0;
			/**
			* Observables that don't have observers anymore, and are about to be
			* suspended, unless somebody else accesses it in the same batch
			*
			* @type {IObservable[]}
			*/
			this.pendingUnobservations = [];
			/**
			* List of scheduled, not yet executed, reactions.
			*/
			this.pendingReactions = [];
			/**
			* Are we currently processing reactions?
			*/
			this.isRunningReactions = false;
			/**
			* Are we currently draining pendingUnobservations in endBatch?
			* An onBecomeUnobserved handler can dispose a Reaction, which calls
			* startBatch/endBatch again; this guards against re-entering the same
			* drain loop recursively (see endBatch in observable.ts).
			*/
			this.isRunningUnobservations = false;
			/**
			* Is it allowed to change observables at this point?
			* In general, MobX doesn't allow that when running computations and React.render.
			* To ensure that those functions stay pure.
			*/
			this.allowStateChanges = false;
			/**
			* Is it allowed to read observables at this point?
			* Used to hold the state needed for \`observableRequiresReaction\`
			*/
			this.allowStateReads = true;
			/**
			* If strict mode is enabled, state changes are by default not allowed
			*/
			this.enforceActions = true;
			/**
			* Spy callbacks
			*/
			this.spyListeners = [];
			/**
			* Globally attached error handlers that react specifically to errors in reactions
			*/
			this.globalReactionErrorHandlers = [];
			/**
			* Warn if computed values are accessed outside a reactive context
			*/
			this.computedRequiresReaction = false;
			/**
			* (Experimental)
			* Warn if you try to create to derivation / reactive context without accessing any observable.
			*/
			this.reactionRequiresObservable = false;
			/**
			* (Experimental)
			* Warn if observables are accessed outside a reactive context
			*/
			this.observableRequiresReaction = false;
			this.disableErrorBoundaries = false;
			this.suppressReactionErrors = false;
			/**
			* False forces all object's descriptors to
			* writable: true
			* configurable: true
			*/
			this.safeDescriptors = true;
		}
	};
	var canMergeGlobalState = true;
	var isolateCalled = false;
	var globalState = /*#__PURE__*/ function() {
		let global = globalThis;
		if (global.__mobxInstanceCount > 0 && !global.__mobxGlobals) canMergeGlobalState = false;
		if (global.__mobxGlobals && global.__mobxGlobals.version !== MOBX_GLOBALS_VERSION) canMergeGlobalState = false;
		if (!canMergeGlobalState) {
			setTimeout(() => {
				if (!isolateCalled) die(35);
			}, 1);
			return new MobXGlobals();
		} else if (global.__mobxGlobals) {
			global.__mobxInstanceCount += 1;
			if (!global.__mobxGlobals.UNCHANGED) global.__mobxGlobals.UNCHANGED = {};
			return global.__mobxGlobals;
		} else {
			global.__mobxInstanceCount = 1;
			return global.__mobxGlobals = /*#__PURE__*/ new MobXGlobals();
		}
	}();
	function addObserver(observable, node) {
		var _observable$observers2;
		((_observable$observers2 = observable.observers_) != null ? _observable$observers2 : observable.observers_ = /* @__PURE__ */ new Set()).add(node);
		if (observable.lowestObserverState_ > node.dependenciesState_) observable.lowestObserverState_ = node.dependenciesState_;
	}
	function removeObserver(observable, node) {
		const observers = observable.observers_;
		if (!observers) return;
		observers.delete(node);
		if (observers.size === 0) queueForUnobservation(observable);
	}
	function queueForUnobservation(observable) {
		if (observable.isPendingUnobservation === false) {
			observable.isPendingUnobservation = true;
			globalState.pendingUnobservations.push(observable);
		}
	}
	/**
	* Batch starts a transaction, at least for purposes of memoizing ComputedValues when nothing else does.
	* During a batch \`onBecomeUnobserved\` will be called at most once per observable.
	* Avoids unnecessary recalculations.
	*/
	function startBatch() {
		globalState.inBatch++;
	}
	function endBatch() {
		if (--globalState.inBatch === 0) {
			runReactions();
			if (!globalState.isRunningUnobservations) {
				globalState.isRunningUnobservations = true;
				try {
					const list = globalState.pendingUnobservations;
					for (let i = 0; i < list.length; i++) {
						const observable = list[i];
						observable.isPendingUnobservation = false;
						if (!observable.observers_ || observable.observers_.size === 0) {
							if (observable.isBeingObserved) {
								observable.isBeingObserved = false;
								observable.onBUO();
							}
							if (observable instanceof ComputedValue) observable.suspend_();
						}
					}
					globalState.pendingUnobservations = [];
				} finally {
					globalState.isRunningUnobservations = false;
				}
			}
		}
	}
	/**
	* Marks an observable as observed, cascading into the dependencies of a ComputedValue.
	* Unobservation already cascades (\`suspend_\` -> \`clearObserving\`), observation normally
	* only does so by accident: a newly observed computed usually recomputes and re-reports
	* its dependencies. When it serves a cached value instead nothing re-reports them, so the
	* transition has to be propagated by hand. See #4547.
	*/
	function markObserved(observable) {
		var _observable$observing;
		if (observable.isBeingObserved) return;
		observable.isBeingObserved = true;
		observable.onBO();
		(_observable$observing = observable.observing_) == null || _observable$observing.forEach(markObserved);
	}
	function reportObserved(observable) {
		checkIfStateReadsAreAllowed(observable);
		const derivation = globalState.trackingDerivation;
		if (derivation !== null) {
			/**
			* Simple optimization, give each derivation run an unique id (runId)
			* Check if last time this observable was accessed the same runId is used
			* if this is the case, the relation is already known
			*/
			if (derivation.runId_ !== observable.lastAccessedBy_) {
				observable.lastAccessedBy_ = derivation.runId_;
				derivation.newObserving_[derivation.unboundDepsCount_++] = observable;
				if (!observable.isBeingObserved && globalState.trackingContext) {
					observable.isBeingObserved = true;
					observable.onBO();
				}
			}
			return observable.isBeingObserved;
		} else if ((!observable.observers_ || observable.observers_.size === 0) && globalState.inBatch > 0) queueForUnobservation(observable);
		return false;
	}
	/**
	* NOTE: current propagation mechanism will in case of self reruning autoruns behave unexpectedly
	* It will propagate changes to observers from previous run
	* It's hard or maybe impossible (with reasonable perf) to get it right with current approach
	* Hopefully self reruning autoruns aren't a feature people should depend on
	* Also most basic use cases should be ok
	*/
	function propagateChanged(observable) {
		var _observable$observers3;
		if (observable.lowestObserverState_ === 2) return;
		observable.lowestObserverState_ = 2;
		(_observable$observers3 = observable.observers_) == null || _observable$observers3.forEach((d) => {
			if (d.dependenciesState_ === 0) d.onBecomeStale_();
			d.dependenciesState_ = 2;
		});
	}
	function propagateChangeConfirmed(observable) {
		var _observable$observers4;
		if (observable.lowestObserverState_ === 2) return;
		observable.lowestObserverState_ = 2;
		(_observable$observers4 = observable.observers_) == null || _observable$observers4.forEach((d) => {
			if (d.dependenciesState_ === 1) d.dependenciesState_ = 2;
			else if (d.dependenciesState_ === 0) observable.lowestObserverState_ = 0;
		});
	}
	function propagateMaybeChanged(observable) {
		var _observable$observers5;
		if (observable.lowestObserverState_ !== 0) return;
		observable.lowestObserverState_ = 1;
		(_observable$observers5 = observable.observers_) == null || _observable$observers5.forEach((d) => {
			if (d.dependenciesState_ === 0) {
				d.dependenciesState_ = 1;
				d.onBecomeStale_();
			}
		});
	}
	var Reaction = class {
		constructor(name_ = __MOBX_DEV__ ? "Reaction@" + getNextId() : "Reaction", onInvalidate_, errorHandler_, requiresObservable_) {
			this.name_ = void 0;
			this.onInvalidate_ = void 0;
			this.errorHandler_ = void 0;
			this.requiresObservable_ = void 0;
			this.observing_ = [];
			this.newObserving_ = [];
			this.dependenciesState_ = -1;
			this.runId_ = 0;
			this.unboundDepsCount_ = 0;
			this.flags_ = 0;
			this.name_ = name_;
			this.onInvalidate_ = onInvalidate_;
			this.errorHandler_ = errorHandler_;
			this.requiresObservable_ = requiresObservable_;
		}
		get isDisposed() {
			return getFlag(this.flags_, 1);
		}
		set isDisposed(newValue) {
			this.flags_ = setFlag(this.flags_, 1, newValue);
		}
		get isScheduled() {
			return getFlag(this.flags_, 2);
		}
		set isScheduled(newValue) {
			this.flags_ = setFlag(this.flags_, 2, newValue);
		}
		get isTrackPending() {
			return getFlag(this.flags_, 4);
		}
		set isTrackPending(newValue) {
			this.flags_ = setFlag(this.flags_, 4, newValue);
		}
		get isRunning() {
			return getFlag(this.flags_, 8);
		}
		set isRunning(newValue) {
			this.flags_ = setFlag(this.flags_, 8, newValue);
		}
		get diffValue() {
			return getFlag(this.flags_, 16) ? 1 : 0;
		}
		set diffValue(newValue) {
			this.flags_ = setFlag(this.flags_, 16, newValue === 1 ? true : false);
		}
		onBecomeStale_() {
			this.schedule_();
		}
		schedule_() {
			if (!this.isScheduled) {
				this.isScheduled = true;
				globalState.pendingReactions.push(this);
				runReactions();
			}
		}
		/**
		* internal, use schedule() if you intend to kick off a reaction
		*/
		runReaction_() {
			if (!this.isDisposed) {
				startBatch();
				this.isScheduled = false;
				const prev = globalState.trackingContext;
				globalState.trackingContext = this;
				if (shouldCompute(this)) {
					this.isTrackPending = true;
					try {
						this.onInvalidate_();
						if (__MOBX_DEV__ && this.isTrackPending && isSpyEnabled()) spyReport({
							name: this.name_,
							type: "scheduled-reaction"
						});
					} catch (e) {
						this.reportExceptionInDerivation_(e);
					}
				}
				globalState.trackingContext = prev;
				endBatch();
			}
		}
		track(fn) {
			if (this.isDisposed) return;
			startBatch();
			const notify = __MOBX_DEV__ && isSpyEnabled();
			let startTime;
			if (__MOBX_DEV__ && notify) {
				startTime = Date.now();
				spyReportStart({
					name: this.name_,
					type: "reaction"
				});
			}
			this.isRunning = true;
			const prevReaction = globalState.trackingContext;
			globalState.trackingContext = this;
			const result = trackDerivedFunction(this, fn, void 0);
			globalState.trackingContext = prevReaction;
			this.isRunning = false;
			this.isTrackPending = false;
			if (this.isDisposed) clearObserving(this);
			if (isCaughtException(result)) this.reportExceptionInDerivation_(result.cause);
			if (__MOBX_DEV__ && notify) spyReportEnd({ time: Date.now() - startTime });
			endBatch();
		}
		reportExceptionInDerivation_(error) {
			if (this.errorHandler_) {
				this.errorHandler_(error, this);
				return;
			}
			if (globalState.disableErrorBoundaries) throw error;
			const message = __MOBX_DEV__ ? \`[mobx] Encountered an uncaught exception that was thrown by a reaction or observer component, in: '\${this}'\` : \`[mobx] uncaught error in '\${this}'\`;
			if (!globalState.suppressReactionErrors) console.error(message, error);
			else if (__MOBX_DEV__) console.warn(\`[mobx] (error in reaction '\${this.name_}' suppressed, fix error of causing action below)\`);
			if (__MOBX_DEV__ && isSpyEnabled()) spyReport({
				type: "error",
				name: this.name_,
				message,
				error: "" + error
			});
			globalState.globalReactionErrorHandlers.forEach((f) => f(error, this));
		}
		dispose() {
			if (!this.isDisposed) {
				this.isDisposed = true;
				if (!this.isRunning) {
					startBatch();
					clearObserving(this);
					endBatch();
				}
			}
		}
		getDisposer_(abortSignal) {
			const dispose = () => {
				this.dispose();
				abortSignal == null || abortSignal.removeEventListener == null || abortSignal.removeEventListener("abort", dispose);
			};
			abortSignal == null || abortSignal.addEventListener == null || abortSignal.addEventListener("abort", dispose);
			dispose[$mobx] = this;
			if ("dispose" in Symbol && typeof Symbol.dispose === "symbol") dispose[Symbol.dispose] = dispose;
			return dispose;
		}
		toString() {
			return \`Reaction[\${this.name_}]\`;
		}
	};
	/**
	* Magic number alert!
	* Defines within how many times a reaction is allowed to re-trigger itself
	* until it is assumed that this is gonna be a never ending loop...
	*/
	var MAX_REACTION_ITERATIONS = 100;
	var reactionScheduler = (f) => f();
	function runReactions() {
		if (globalState.inBatch > 0 || globalState.isRunningReactions) return;
		reactionScheduler(runReactionsHelper);
	}
	function runReactionsHelper() {
		globalState.isRunningReactions = true;
		const allReactions = globalState.pendingReactions;
		let iterations = 0;
		while (allReactions.length > 0) {
			if (++iterations === MAX_REACTION_ITERATIONS) {
				console.error(__MOBX_DEV__ ? \`Reaction doesn't converge to a stable state after \${MAX_REACTION_ITERATIONS} iterations. Probably there is a cycle in the reactive function: \${allReactions[0]}\` : \`[mobx] cycle in reaction: \${allReactions[0]}\`);
				allReactions.splice(0);
			}
			let remainingReactions = allReactions.splice(0);
			for (let i = 0, l = remainingReactions.length; i < l; i++) remainingReactions[i].runReaction_();
		}
		globalState.isRunningReactions = false;
	}
	var isReaction = /*#__PURE__*/ createInstanceofPredicate("Reaction", Reaction);
	function isSpyEnabled() {
		return __MOBX_DEV__ && !!globalState.spyListeners.length;
	}
	function spyReport(event) {
		if (!__MOBX_DEV__) return;
		if (!globalState.spyListeners.length) return;
		const listeners = globalState.spyListeners;
		for (let i = 0, l = listeners.length; i < l; i++) listeners[i](event);
	}
	function spyReportStart(event) {
		if (!__MOBX_DEV__) return;
		spyReport(assign({}, event, { spyReportStart: true }));
	}
	var END_EVENT = {
		type: "report-end",
		spyReportEnd: true
	};
	function spyReportEnd(change) {
		if (!__MOBX_DEV__) return;
		if (change) spyReport(assign({}, change, {
			type: "report-end",
			spyReportEnd: true
		}));
		else spyReport(END_EVENT);
	}
	function spy(listener) {
		if (!__MOBX_DEV__) {
			console.warn(\`[mobx.spy] Is a no-op in production builds\`);
			return function() {};
		} else {
			globalState.spyListeners.push(listener);
			return once(() => {
				globalState.spyListeners = globalState.spyListeners.filter((l) => l !== listener);
			});
		}
	}
	var ACTION = "action";
	var AUTOACTION = "autoAction";
	var AUTOACTION_BOUND = "autoAction.bound";
	var DEFAULT_ACTION_NAME = "<unnamed action>";
	var actionAnnotation = /*#__PURE__*/ createActionAnnotation(ACTION);
	var autoActionAnnotation = /*#__PURE__*/ createActionAnnotation(AUTOACTION, { autoAction: true });
	var autoActionBoundAnnotation = /*#__PURE__*/ createActionAnnotation(AUTOACTION_BOUND, {
		autoAction: true,
		bound: true
	});
	function createActionDecoratorAnnotation(annotation) {
		return createDecoratorAnnotation(annotation, decorateAction20223_);
	}
	function createActionFactory(autoAction) {
		return function action(arg1, arg2) {
			if (arg2 && typeof arg2.kind === "string") return decorateAction20223_(autoAction ? autoActionAnnotation : actionAnnotation, arg1, arg2);
			if (isFunction(arg1)) return createAction(arg1.name || DEFAULT_ACTION_NAME, arg1, autoAction);
			if (isFunction(arg2)) return createAction(arg1, arg2, autoAction);
			if (isStringish(arg1)) return createActionDecoratorAnnotation(createActionAnnotation(autoAction ? AUTOACTION : ACTION, {
				name: arg1,
				autoAction
			}));
			if (__MOBX_DEV__) die("Invalid arguments for \`action\`");
		};
	}
	var action = /*#__PURE__*/ createActionFactory(false);
	assign(action, actionAnnotation);
	var autoAction = /*#__PURE__*/ createActionFactory(true);
	assign(autoAction, autoActionAnnotation);
	var autoActionBound = /*#__PURE__*/ createActionDecoratorAnnotation(autoActionBoundAnnotation);
	function runInAction(fn) {
		return executeAction(fn.name || DEFAULT_ACTION_NAME, false, fn, this, void 0);
	}
	function isAction(thing) {
		return isFunction(thing) && thing.isMobxAction === true;
	}
	/**
	* Creates a named reactive view and keeps it alive, so that the view is always
	* updated if one of the dependencies changes, even when the view is not further used by something else.
	* @param view The reactive view
	* @returns disposer function, which can be used to stop the view from being updated in the future.
	*/
	function autorun(view, opts = EMPTY_OBJECT) {
		var _opts$name, _opts$signal;
		if (__MOBX_DEV__) {
			if (!isFunction(view)) die("Autorun expects a function as first argument");
			if (isAction(view)) die("Autorun does not accept actions since actions are untrackable");
		}
		const name = (_opts$name = opts == null ? void 0 : opts.name) != null ? _opts$name : __MOBX_DEV__ ? view.name || "Autorun@" + getNextId() : "Autorun";
		const runSync = !opts.scheduler && !opts.delay;
		let reaction;
		if (runSync) reaction = new Reaction(name, function() {
			this.track(reactionRunner);
		}, opts.onError, opts.requiresObservable);
		else {
			const scheduler = createSchedulerFromOptions(opts);
			let isScheduled = false;
			reaction = new Reaction(name, () => {
				if (!isScheduled) {
					isScheduled = true;
					scheduler(() => {
						isScheduled = false;
						if (!reaction.isDisposed) reaction.track(reactionRunner);
					});
				}
			}, opts.onError, opts.requiresObservable);
		}
		function reactionRunner() {
			view(reaction);
		}
		if (!(opts != null && (_opts$signal = opts.signal) != null && _opts$signal.aborted)) reaction.schedule_();
		return reaction.getDisposer_(opts == null ? void 0 : opts.signal);
	}
	var run = (f) => f();
	function createSchedulerFromOptions(opts) {
		return opts.scheduler ? opts.scheduler : opts.delay ? (f) => setTimeout(f, opts.delay) : run;
	}
	function extendObservable(target, properties, annotations, options) {
		if (__MOBX_DEV__) {
			if (arguments.length > 4) die("'extendObservable' expected 2-4 arguments");
			if (typeof target !== "object") die("'extendObservable' expects an object as first argument");
			if (isObservableMap(target)) die("'extendObservable' should not be used on maps, use map.merge instead");
			if (!isPlainObject(properties)) die(\`'extendObservable' only accepts plain objects as second argument\`);
			if (isObservable(properties) || isObservable(annotations)) die(\`Extending an object with another observable (object) is not supported\`);
		}
		const descriptors = getOwnPropertyDescriptors(properties);
		initObservable(() => {
			const adm = asObservableObject(target, options)[$mobx];
			ownKeys(descriptors).forEach((key) => {
				adm.extend_(key, descriptors[key], !annotations ? true : key in annotations ? annotations[key] : true);
			});
		});
		return target;
	}
	var generatorId = 0;
	var FlowCancellationError = class extends Error {
		constructor() {
			super("FLOW_CANCELLED");
			Object.setPrototypeOf(this, new.target.prototype);
			this.name = "FlowCancellationError";
		}
		toString() {
			return \`Error: \${this.message}\`;
		}
	};
	function createFlowDecoratorAnnotation(annotation) {
		return createDecoratorAnnotation(annotation, decorateFlow20223_);
	}
	var flowAnnotation = /*#__PURE__*/ createFlowAnnotation("flow");
	var flowBoundAnnotation = /*#__PURE__*/ createFlowAnnotation("flow.bound", { bound: true });
	var flow = /*#__PURE__*/ assign(function flow(arg1, arg2) {
		if (arg2 && typeof arg2.kind === "string") return decorateFlow20223_(flowAnnotation, arg1, arg2);
		if (__MOBX_DEV__ && arguments.length !== 1) die(\`Flow expects single argument with generator function\`);
		const generator = arg1;
		const name = generator.name || (__MOBX_DEV__ ? "<unnamed flow>" : "flow");
		const res = function res() {
			const ctx = this;
			const args = arguments;
			const runId = __MOBX_DEV__ ? ++generatorId : 0;
			const gen = action(__MOBX_DEV__ ? \`\${name} - runid: \${runId} - init\` : name, generator).apply(ctx, args);
			let rejector;
			let pendingPromise = void 0;
			const promise = new Promise(function(resolve, reject) {
				let stepId = 0;
				rejector = reject;
				function onFulfilled(res) {
					pendingPromise = void 0;
					let ret;
					try {
						ret = action(__MOBX_DEV__ ? \`\${name} - runid: \${runId} - yield \${stepId++}\` : name, gen.next).call(gen, res);
					} catch (e) {
						return reject(e);
					}
					next(ret);
				}
				function onRejected(err) {
					pendingPromise = void 0;
					let ret;
					try {
						ret = action(__MOBX_DEV__ ? \`\${name} - runid: \${runId} - yield \${stepId++}\` : name, gen.throw).call(gen, err);
					} catch (e) {
						return reject(e);
					}
					next(ret);
				}
				function next(ret) {
					if (isFunction(ret == null ? void 0 : ret.then)) {
						ret.then(next, reject);
						return;
					}
					if (ret.done) return resolve(ret.value);
					pendingPromise = Promise.resolve(ret.value);
					return pendingPromise.then(onFulfilled, onRejected);
				}
				onFulfilled(void 0);
			});
			promise.cancel = action(__MOBX_DEV__ ? \`\${name} - runid: \${runId} - cancel\` : name, function() {
				try {
					if (pendingPromise) cancelPromise(pendingPromise);
					const res = gen.return(void 0);
					const yieldedPromise = Promise.resolve(res.value);
					yieldedPromise.then(noop, noop);
					cancelPromise(yieldedPromise);
					rejector(new FlowCancellationError());
				} catch (e) {
					rejector(e);
				}
			});
			return promise;
		};
		res.isMobXFlow = true;
		return res;
	}, flowAnnotation);
	var flowBound = /*#__PURE__*/ createFlowDecoratorAnnotation(flowBoundAnnotation);
	function cancelPromise(promise) {
		if (isFunction(promise.cancel)) promise.cancel();
	}
	function isFlow(fn) {
		return (fn == null ? void 0 : fn.isMobXFlow) === true;
	}
	function _isObservable(value, property) {
		if (!value) return false;
		if (property !== void 0) {
			if (__MOBX_DEV__ && (isObservableMap(value) || isObservableArray(value))) return die("isObservable(object, propertyName) is not supported for arrays and maps. Use map.has or array.length instead.");
			if (isObservableObject(value)) {
				var _adm$lazyComputedKeys, _adm$lazyObservableKe;
				const adm = value[$mobx];
				return adm.values_.has(property) || !!((_adm$lazyComputedKeys = adm.lazyComputedKeys_) != null && _adm$lazyComputedKeys.has(property)) || !!((_adm$lazyObservableKe = adm.lazyObservableKeys_) != null && _adm$lazyObservableKe.has(property));
			}
			return false;
		}
		return isObservableObject(value) || !!value[$mobx] || isAtom(value) || isReaction(value) || isComputedValue(value);
	}
	function isObservable(value) {
		if (__MOBX_DEV__ && arguments.length !== 1) die(\`isObservable expects only 1 argument. Use isObservableProp to inspect the observability of a property\`);
		return _isObservable(value);
	}
	/**
	* During a transaction no views are updated until the end of the transaction.
	* The transaction will be run synchronously nonetheless.
	*
	* @param action a function that updates some reactive state
	* @returns any value that was returned by the 'action' parameter.
	*/
	function transaction(action, thisArg = void 0) {
		startBatch();
		try {
			return action.apply(thisArg);
		} finally {
			endBatch();
		}
	}
	function getAdm(target) {
		return target[$mobx];
	}
	var objectProxyTraps = {
		has(target, name) {
			return getAdm(target).has_(name);
		},
		get(target, name) {
			return getAdm(target).get_(name);
		},
		set(target, name, value) {
			var _getAdm$set_;
			if (!isStringish(name)) return false;
			return (_getAdm$set_ = getAdm(target).set_(name, value, true)) != null ? _getAdm$set_ : true;
		},
		deleteProperty(target, name) {
			var _getAdm$delete_;
			if (!isStringish(name)) return false;
			return (_getAdm$delete_ = getAdm(target).delete_(name, true)) != null ? _getAdm$delete_ : true;
		},
		defineProperty(target, name, descriptor) {
			var _getAdm$definePropert;
			return (_getAdm$definePropert = getAdm(target).defineProperty_(name, descriptor)) != null ? _getAdm$definePropert : true;
		},
		ownKeys(target) {
			return getAdm(target).ownKeys_();
		},
		preventExtensions(target) {
			die(13);
		}
	};
	function asDynamicObservableObject(target, options) {
		var _target$$mobx, _target$$mobx$proxy_;
		target = asObservableObject(target, options);
		return (_target$$mobx$proxy_ = (_target$$mobx = target[$mobx]).proxy_) != null ? _target$$mobx$proxy_ : _target$$mobx.proxy_ = new Proxy(target, objectProxyTraps);
	}
	function hasInterceptors(interceptable) {
		return interceptable.interceptors_ !== void 0 && interceptable.interceptors_.length > 0;
	}
	function interceptChange(interceptable, change) {
		const prevU = untrackedStart();
		try {
			const interceptors = [...interceptable.interceptors_ || []];
			for (let i = 0, l = interceptors.length; i < l; i++) {
				change = interceptors[i](change);
				if (change && !change.type) die(14);
				if (!change) break;
			}
			return change;
		} finally {
			untrackedEnd(prevU);
		}
	}
	function hasListeners(listenable) {
		return listenable.changeListeners_ !== void 0 && listenable.changeListeners_.length > 0;
	}
	function notifyListeners(listenable, change) {
		const prevU = untrackedStart();
		let listeners = listenable.changeListeners_;
		if (!listeners) return;
		listeners = listeners.slice();
		for (let i = 0, l = listeners.length; i < l; i++) listeners[i](change);
		untrackedEnd(prevU);
	}
	var SPLICE = "splice";
	var UPDATE = "update";
	var MAX_SPLICE_SIZE = 1e4;
	var arrayTraps = {
		get(target, name) {
			const adm = target[$mobx];
			if (name === $mobx) return adm;
			if (name === "length") return adm.getArrayLength_();
			if (typeof name === "string" && !isNaN(name)) return adm.get_(parseInt(name));
			if (hasProp(arrayExtensions, name)) return arrayExtensions[name];
			return target[name];
		},
		set(target, name, value) {
			const adm = target[$mobx];
			if (name === "length") adm.setArrayLength_(value);
			if (typeof name === "symbol" || isNaN(name)) target[name] = value;
			else adm.set_(parseInt(name), value);
			return true;
		},
		preventExtensions() {
			die(15);
		}
	};
	var ObservableArrayAdministration = class {
		constructor(name = __MOBX_DEV__ ? "ObservableArray@" + getNextId() : "ObservableArray", enhancer, owned_) {
			this.owned_ = void 0;
			this.atom_ = void 0;
			this.values_ = [];
			this.interceptors_ = void 0;
			this.changeListeners_ = void 0;
			this.enhancer_ = void 0;
			this.dehancer = void 0;
			this.proxy_ = void 0;
			this.lastKnownLength_ = 0;
			this.owned_ = owned_;
			this.atom_ = new Atom(name);
			this.enhancer_ = (newV, oldV) => enhancer(newV, oldV, __MOBX_DEV__ ? name + "[..]" : "ObservableArray[..]");
		}
		dehanceValue_(value) {
			if (this.dehancer !== void 0) return this.dehancer(value);
			return value;
		}
		dehanceValues_(values) {
			if (this.dehancer !== void 0 && values.length > 0) return values.map(this.dehancer);
			return values;
		}
		getArrayLength_() {
			this.atom_.reportObserved();
			return this.values_.length;
		}
		setArrayLength_(newLength) {
			if (typeof newLength !== "number" || isNaN(newLength) || newLength < 0) die(40, newLength);
			let currentLength = this.values_.length;
			if (newLength === currentLength) return;
			else if (newLength > currentLength) {
				const newItems = Array.from({ length: newLength - currentLength });
				this.spliceWithArray_(currentLength, 0, newItems);
			} else this.spliceWithArray_(newLength, currentLength - newLength);
		}
		updateArrayLength_(oldLength, delta) {
			if (oldLength !== this.lastKnownLength_) die(16);
			this.lastKnownLength_ += delta;
		}
		spliceWithArray_(index, deleteCount, newItems) {
			checkIfStateModificationsAreAllowed(this.atom_);
			const length = this.values_.length;
			if (index === void 0) index = 0;
			else if (index > length) index = length;
			else if (index < 0) index = Math.max(0, length + index);
			if (arguments.length === 1) deleteCount = length - index;
			else if (deleteCount === void 0 || deleteCount === null) deleteCount = 0;
			else deleteCount = Math.max(0, Math.min(deleteCount, length - index));
			if (newItems === void 0) newItems = EMPTY_ARRAY;
			if (hasInterceptors(this)) {
				const change = interceptChange(this, {
					object: this.proxy_,
					type: SPLICE,
					index,
					removedCount: deleteCount,
					added: newItems
				});
				if (!change) return EMPTY_ARRAY;
				deleteCount = change.removedCount;
				newItems = change.added;
			}
			newItems = newItems.length === 0 ? newItems : newItems.map((v) => this.enhancer_(v, void 0));
			if (__MOBX_DEV__) {
				const lengthDelta = newItems.length - deleteCount;
				this.updateArrayLength_(length, lengthDelta);
			}
			const res = this.spliceItemsIntoValues_(index, deleteCount, newItems);
			if (deleteCount !== 0 || newItems.length !== 0) this.notifyArraySplice_(index, newItems, res);
			return this.dehanceValues_(res);
		}
		spliceItemsIntoValues_(index, deleteCount, newItems) {
			if (newItems.length < MAX_SPLICE_SIZE) return this.values_.splice(index, deleteCount, ...newItems);
			else {
				const res = this.values_.slice(index, index + deleteCount);
				let oldItems = this.values_.slice(index + deleteCount);
				this.values_.length += newItems.length - deleteCount;
				for (let i = 0; i < newItems.length; i++) this.values_[index + i] = newItems[i];
				for (let i = 0; i < oldItems.length; i++) this.values_[index + newItems.length + i] = oldItems[i];
				return res;
			}
		}
		notifyArrayChildUpdate_(index, newValue, oldValue) {
			const notifySpy = __MOBX_DEV__ && !this.owned_ && isSpyEnabled();
			const notify = hasListeners(this);
			const change = notify || notifySpy ? {
				observableKind: "array",
				object: this.proxy_,
				type: UPDATE,
				debugObjectName: this.atom_.name_,
				index,
				newValue,
				oldValue
			} : null;
			if (__MOBX_DEV__ && notifySpy) spyReportStart(change);
			this.atom_.reportChanged();
			if (notify) notifyListeners(this, change);
			if (__MOBX_DEV__ && notifySpy) spyReportEnd();
		}
		notifyArraySplice_(index, added, removed) {
			const notifySpy = __MOBX_DEV__ && !this.owned_ && isSpyEnabled();
			const notify = hasListeners(this);
			const change = notify || notifySpy ? {
				observableKind: "array",
				object: this.proxy_,
				debugObjectName: this.atom_.name_,
				type: SPLICE,
				index,
				removed,
				added,
				removedCount: removed.length,
				addedCount: added.length
			} : null;
			if (__MOBX_DEV__ && notifySpy) spyReportStart(change);
			this.atom_.reportChanged();
			if (notify) notifyListeners(this, change);
			if (__MOBX_DEV__ && notifySpy) spyReportEnd();
		}
		get_(index) {
			this.atom_.reportObserved();
			return this.dehanceValue_(this.values_[index]);
		}
		set_(index, newValue) {
			const values = this.values_;
			if (index < values.length) {
				checkIfStateModificationsAreAllowed(this.atom_);
				const oldValue = values[index];
				if (hasInterceptors(this)) {
					const change = interceptChange(this, {
						type: UPDATE,
						object: this.proxy_,
						index,
						newValue
					});
					if (!change) return;
					newValue = change.newValue;
				}
				newValue = this.enhancer_(newValue, oldValue);
				if (newValue !== oldValue) {
					values[index] = newValue;
					this.notifyArrayChildUpdate_(index, newValue, oldValue);
				}
			} else {
				const newItems = Array.from({ length: index + 1 - values.length });
				newItems[newItems.length - 1] = newValue;
				this.spliceWithArray_(values.length, 0, newItems);
			}
		}
	};
	function createObservableArray(initialValues, enhancer, name = __MOBX_DEV__ ? "ObservableArray@" + getNextId() : "ObservableArray", owned = false) {
		return initObservable(() => {
			const adm = new ObservableArrayAdministration(name, enhancer, owned);
			addHiddenFinalProp(adm.values_, $mobx, adm);
			const proxy = new Proxy(adm.values_, arrayTraps);
			adm.proxy_ = proxy;
			if (initialValues && initialValues.length) adm.spliceWithArray_(0, 0, initialValues);
			return proxy;
		});
	}
	var arrayExtensions = {
		clear() {
			return this.splice(0);
		},
		replace(newItems) {
			const adm = this[$mobx];
			return adm.spliceWithArray_(0, adm.values_.length, newItems);
		},
		toJSON() {
			return this.slice();
		},
		splice(index, deleteCount, ...newItems) {
			const adm = this[$mobx];
			switch (arguments.length) {
				case 0: return [];
				case 1: return adm.spliceWithArray_(index);
				case 2: return adm.spliceWithArray_(index, deleteCount);
			}
			return adm.spliceWithArray_(index, deleteCount, newItems);
		},
		spliceWithArray(index, deleteCount, newItems) {
			return this[$mobx].spliceWithArray_(index, deleteCount, newItems);
		},
		push(...items) {
			const adm = this[$mobx];
			adm.spliceWithArray_(adm.values_.length, 0, items);
			return adm.values_.length;
		},
		pop() {
			return this.splice(Math.max(this[$mobx].values_.length - 1, 0), 1)[0];
		},
		shift() {
			return this.splice(0, 1)[0];
		},
		unshift(...items) {
			const adm = this[$mobx];
			adm.spliceWithArray_(0, 0, items);
			return adm.values_.length;
		},
		reverse() {
			if (globalState.trackingDerivation) die(37, "reverse");
			this.replace(this.slice().reverse());
			return this;
		},
		sort() {
			if (globalState.trackingDerivation) die(37, "sort");
			const copy = this.slice();
			copy.sort.apply(copy, arguments);
			this.replace(copy);
			return this;
		},
		remove(value) {
			const adm = this[$mobx];
			const idx = adm.dehanceValues_(adm.values_).indexOf(value);
			if (idx > -1) {
				this.splice(idx, 1);
				return true;
			}
			return false;
		}
	};
	/**
	* Wrap function from prototype
	* Without this, everything works as well, but this works
	* faster as everything works on unproxied values
	*/
	addArrayExtension("at", simpleFunc);
	addArrayExtension("concat", simpleFunc);
	addArrayExtension("flat", simpleFunc);
	addArrayExtension("includes", simpleFunc);
	addArrayExtension("indexOf", simpleFunc);
	addArrayExtension("join", simpleFunc);
	addArrayExtension("lastIndexOf", simpleFunc);
	addArrayExtension("slice", simpleFunc);
	addArrayExtension("toString", simpleFunc);
	addArrayExtension("toLocaleString", simpleFunc);
	addArrayExtension("toSorted", simpleFunc);
	addArrayExtension("toSpliced", simpleFunc);
	addArrayExtension("with", simpleFunc);
	addArrayExtension("every", mapLikeFunc);
	addArrayExtension("filter", mapLikeFunc);
	addArrayExtension("find", mapLikeFunc);
	addArrayExtension("findIndex", mapLikeFunc);
	addArrayExtension("findLast", mapLikeFunc);
	addArrayExtension("findLastIndex", mapLikeFunc);
	addArrayExtension("flatMap", mapLikeFunc);
	addArrayExtension("forEach", mapLikeFunc);
	addArrayExtension("map", mapLikeFunc);
	addArrayExtension("some", mapLikeFunc);
	addArrayExtension("toReversed", mapLikeFunc);
	addArrayExtension("reduce", reduceLikeFunc);
	addArrayExtension("reduceRight", reduceLikeFunc);
	function addArrayExtension(funcName, funcFactory) {
		if (typeof Array.prototype[funcName] === "function") arrayExtensions[funcName] = funcFactory(funcName);
	}
	function simpleFunc(funcName) {
		return function() {
			const adm = this[$mobx];
			adm.atom_.reportObserved();
			const dehancedValues = adm.dehanceValues_(adm.values_);
			return dehancedValues[funcName].apply(dehancedValues, arguments);
		};
	}
	function mapLikeFunc(funcName) {
		return function(callback, thisArg) {
			const adm = this[$mobx];
			adm.atom_.reportObserved();
			return adm.dehanceValues_(adm.values_)[funcName]((element, index) => {
				return callback.call(thisArg, element, index, this);
			});
		};
	}
	function reduceLikeFunc(funcName) {
		return function() {
			const adm = this[$mobx];
			adm.atom_.reportObserved();
			const dehancedValues = adm.dehanceValues_(adm.values_);
			const callback = arguments[0];
			arguments[0] = (accumulator, currentValue, index) => {
				return callback(accumulator, currentValue, index, this);
			};
			return dehancedValues[funcName].apply(dehancedValues, arguments);
		};
	}
	var isObservableArrayAdministration = /*#__PURE__*/ createInstanceofPredicate("ObservableArrayAdministration", ObservableArrayAdministration);
	function isObservableArray(thing) {
		return isObject(thing) && isObservableArrayAdministration(thing[$mobx]);
	}
	var ObservableMapMarker = {};
	var ADD = "add";
	var DELETE = "delete";
	var ObservableMap = class {
		constructor(initialData, enhancer_ = deepEnhancer, name_ = __MOBX_DEV__ ? "ObservableMap@" + getNextId() : "ObservableMap") {
			this.enhancer_ = void 0;
			this.name_ = void 0;
			this[$mobx] = ObservableMapMarker;
			this.data_ = void 0;
			this.hasMap_ = void 0;
			this.keysAtom_ = void 0;
			this.interceptors_ = void 0;
			this.changeListeners_ = void 0;
			this.dehancer = void 0;
			this.enhancer_ = enhancer_;
			this.name_ = name_;
			initObservable(() => {
				this.keysAtom_ = createAtom(__MOBX_DEV__ ? \`\${this.name_}.keys()\` : "ObservableMap.keys()");
				this.data_ = /* @__PURE__ */ new Map();
				this.hasMap_ = /* @__PURE__ */ new Map();
				if (initialData) this.merge(initialData);
			});
		}
		has_(key) {
			return this.data_.has(key);
		}
		has(key) {
			if (!globalState.trackingDerivation) return this.has_(key);
			let entry = this.hasMap_.get(key);
			if (!entry) {
				const newEntry = entry = new ObservableValue(this.has_(key), referenceEnhancer, __MOBX_DEV__ ? \`\${this.name_}.\${stringifyKey(key)}?\` : "ObservableMap.key?", false);
				this.hasMap_.set(key, newEntry);
				newEntry.onBUOL = /* @__PURE__ */ new Set([() => this.hasMap_.delete(key)]);
			}
			return entry.get();
		}
		set(key, value) {
			const hasKey = this.has_(key);
			if (hasInterceptors(this)) {
				const change = interceptChange(this, {
					type: hasKey ? UPDATE : ADD,
					object: this,
					newValue: value,
					name: key
				});
				if (!change) return this;
				value = change.newValue;
			}
			if (hasKey) this.updateValue_(key, value);
			else this.addValue_(key, value);
			return this;
		}
		delete(key) {
			checkIfStateModificationsAreAllowed(this.keysAtom_);
			if (hasInterceptors(this)) {
				if (!interceptChange(this, {
					type: DELETE,
					object: this,
					name: key
				})) return false;
			}
			if (this.has_(key)) {
				const notifySpy = __MOBX_DEV__ && isSpyEnabled();
				const notify = hasListeners(this);
				const change = notify || notifySpy ? {
					observableKind: "map",
					debugObjectName: this.name_,
					type: DELETE,
					object: this,
					oldValue: this.data_.get(key).value_,
					name: key
				} : null;
				if (__MOBX_DEV__ && notifySpy) spyReportStart(change);
				transaction(() => {
					var _this$hasMap_$get;
					this.keysAtom_.reportChanged();
					(_this$hasMap_$get = this.hasMap_.get(key)) == null || _this$hasMap_$get.setNewValue_(false);
					this.data_.get(key).setNewValue_(void 0);
					this.data_.delete(key);
				});
				if (notify) notifyListeners(this, change);
				if (__MOBX_DEV__ && notifySpy) spyReportEnd();
				return true;
			}
			return false;
		}
		updateValue_(key, newValue) {
			const observable = this.data_.get(key);
			newValue = observable.prepareNewValue_(newValue);
			if (newValue !== globalState.UNCHANGED) {
				const notifySpy = __MOBX_DEV__ && isSpyEnabled();
				const notify = hasListeners(this);
				const change = notify || notifySpy ? {
					observableKind: "map",
					debugObjectName: this.name_,
					type: UPDATE,
					object: this,
					oldValue: observable.value_,
					name: key,
					newValue
				} : null;
				if (__MOBX_DEV__ && notifySpy) spyReportStart(change);
				observable.setNewValue_(newValue);
				if (notify) notifyListeners(this, change);
				if (__MOBX_DEV__ && notifySpy) spyReportEnd();
			}
		}
		addValue_(key, newValue) {
			checkIfStateModificationsAreAllowed(this.keysAtom_);
			transaction(() => {
				var _this$hasMap_$get2;
				const observable = new ObservableValue(newValue, this.enhancer_, __MOBX_DEV__ ? \`\${this.name_}.\${stringifyKey(key)}\` : "ObservableMap.key", false);
				this.data_.set(key, observable);
				newValue = observable.value_;
				(_this$hasMap_$get2 = this.hasMap_.get(key)) == null || _this$hasMap_$get2.setNewValue_(true);
				this.keysAtom_.reportChanged();
			});
			const notifySpy = __MOBX_DEV__ && isSpyEnabled();
			const notify = hasListeners(this);
			const change = notify || notifySpy ? {
				observableKind: "map",
				debugObjectName: this.name_,
				type: ADD,
				object: this,
				name: key,
				newValue
			} : null;
			if (__MOBX_DEV__ && notifySpy) spyReportStart(change);
			if (notify) notifyListeners(this, change);
			if (__MOBX_DEV__ && notifySpy) spyReportEnd();
		}
		get(key) {
			if (this.has(key)) return this.dehanceValue_(this.data_.get(key).get());
			return this.dehanceValue_(void 0);
		}
		getOrInsert(key, value) {
			if (!this.has(key)) this.set(key, value);
			return this.get(key);
		}
		getOrInsertComputed(key, callback) {
			if (!this.has(key)) this.set(key, callback(key));
			return this.get(key);
		}
		dehanceValue_(value) {
			if (this.dehancer !== void 0) return this.dehancer(value);
			return value;
		}
		keys() {
			this.keysAtom_.reportObserved();
			return this.data_.keys();
		}
		values() {
			const self = this;
			const keys = this.keys();
			return makeIterableForMap({ next() {
				const { done, value } = keys.next();
				return {
					done,
					value: done ? void 0 : self.get(value)
				};
			} });
		}
		entries() {
			const self = this;
			const keys = this.keys();
			return makeIterableForMap({ next() {
				const { done, value } = keys.next();
				return {
					done,
					value: done ? void 0 : [value, self.get(value)]
				};
			} });
		}
		[Symbol.iterator]() {
			return this.entries();
		}
		forEach(callback, thisArg) {
			for (const [key, value] of this) callback.call(thisArg, value, key, this);
		}
		/** Merge another object into this object, returns this. */
		merge(other) {
			if (isObservableMap(other)) other = new Map(other);
			transaction(() => {
				if (isPlainObject(other)) getPlainObjectKeys(other).forEach((key) => this.set(key, other[key]));
				else if (Array.isArray(other)) other.forEach(([key, value]) => this.set(key, value));
				else if (isES6Map(other)) {
					if (!isPlainES6Map(other)) die(19, other);
					other.forEach((value, key) => this.set(key, value));
				} else if (other !== null && other !== void 0) die(20, other);
			});
			return this;
		}
		clear() {
			transaction(() => {
				untracked(() => {
					for (const key of this.keys()) this.delete(key);
				});
			});
		}
		replace(values) {
			transaction(() => {
				const replacementMap = convertToMap(values);
				const orderedData = /* @__PURE__ */ new Map();
				let keysReportChangedCalled = false;
				for (const key of this.data_.keys()) if (!replacementMap.has(key)) {
					if (this.delete(key)) keysReportChangedCalled = true;
					else {
						const value = this.data_.get(key);
						orderedData.set(key, value);
					}
				}
				for (const [key, value] of replacementMap.entries()) {
					const keyExisted = this.data_.has(key);
					this.set(key, value);
					if (this.data_.has(key)) {
						const _value = this.data_.get(key);
						orderedData.set(key, _value);
						if (!keyExisted) keysReportChangedCalled = true;
					}
				}
				if (!keysReportChangedCalled) {
					if (this.data_.size !== orderedData.size) this.keysAtom_.reportChanged();
					else {
						const iter1 = this.data_.keys();
						const iter2 = orderedData.keys();
						let next1 = iter1.next();
						let next2 = iter2.next();
						while (!next1.done) {
							if (next1.value !== next2.value) {
								this.keysAtom_.reportChanged();
								break;
							}
							next1 = iter1.next();
							next2 = iter2.next();
						}
					}
				}
				this.data_ = orderedData;
			});
			return this;
		}
		get size() {
			this.keysAtom_.reportObserved();
			return this.data_.size;
		}
		toString() {
			return "[object ObservableMap]";
		}
		toJSON() {
			return Array.from(this);
		}
		get [Symbol.toStringTag]() {
			return "Map";
		}
	};
	var isObservableMap = /*#__PURE__*/ createInstanceofPredicate("ObservableMap", ObservableMap);
	function makeIterableForMap(iterator) {
		iterator[Symbol.toStringTag] = "MapIterator";
		return makeIterable(iterator);
	}
	function convertToMap(dataStructure) {
		if (isES6Map(dataStructure) || isObservableMap(dataStructure)) return dataStructure;
		else if (Array.isArray(dataStructure)) return new Map(dataStructure);
		else if (isPlainObject(dataStructure)) {
			const map = /* @__PURE__ */ new Map();
			for (const key in dataStructure) map.set(key, dataStructure[key]);
			return map;
		} else return die(21, dataStructure);
	}
	var ObservableSetMarker = {};
	var ObservableSet = class {
		constructor(initialData, enhancer = deepEnhancer, name_ = __MOBX_DEV__ ? "ObservableSet@" + getNextId() : "ObservableSet") {
			this.name_ = void 0;
			this[$mobx] = ObservableSetMarker;
			this.data_ = /* @__PURE__ */ new Set();
			this.atom_ = void 0;
			this.changeListeners_ = void 0;
			this.interceptors_ = void 0;
			this.dehancer = void 0;
			this.enhancer_ = void 0;
			this.name_ = name_;
			this.enhancer_ = (newV, oldV) => enhancer(newV, oldV, name_);
			initObservable(() => {
				this.atom_ = createAtom(this.name_);
				if (initialData) this.replace(initialData);
			});
		}
		dehanceValue_(value) {
			if (this.dehancer !== void 0) return this.dehancer(value);
			return value;
		}
		clear() {
			transaction(() => {
				untracked(() => {
					for (const value of this.data_.values()) this.delete(value);
				});
			});
		}
		forEach(callbackFn, thisArg) {
			for (const value of this) callbackFn.call(thisArg, value, value, this);
		}
		get size() {
			this.atom_.reportObserved();
			return this.data_.size;
		}
		add(value) {
			checkIfStateModificationsAreAllowed(this.atom_);
			if (hasInterceptors(this)) {
				const change = interceptChange(this, {
					type: ADD,
					object: this,
					newValue: value
				});
				if (!change) return this;
				value = change.newValue;
			}
			if (!this.has(value)) {
				transaction(() => {
					this.data_.add(this.enhancer_(value, void 0));
					this.atom_.reportChanged();
				});
				const notifySpy = __MOBX_DEV__ && isSpyEnabled();
				const notify = hasListeners(this);
				const change = notify || notifySpy ? {
					observableKind: "set",
					debugObjectName: this.name_,
					type: ADD,
					object: this,
					newValue: value
				} : null;
				if (notifySpy && __MOBX_DEV__) spyReportStart(change);
				if (notify) notifyListeners(this, change);
				if (notifySpy && __MOBX_DEV__) spyReportEnd();
			}
			return this;
		}
		delete(value) {
			if (hasInterceptors(this)) {
				if (!interceptChange(this, {
					type: DELETE,
					object: this,
					oldValue: value
				})) return false;
			}
			if (this.has(value)) {
				const notifySpy = __MOBX_DEV__ && isSpyEnabled();
				const notify = hasListeners(this);
				const change = notify || notifySpy ? {
					observableKind: "set",
					debugObjectName: this.name_,
					type: DELETE,
					object: this,
					oldValue: value
				} : null;
				if (notifySpy && __MOBX_DEV__) spyReportStart(change);
				transaction(() => {
					this.atom_.reportChanged();
					this.data_.delete(value);
				});
				if (notify) notifyListeners(this, change);
				if (notifySpy && __MOBX_DEV__) spyReportEnd();
				return true;
			}
			return false;
		}
		has(value) {
			this.atom_.reportObserved();
			return this.data_.has(this.dehanceValue_(value));
		}
		entries() {
			const values = this.values();
			return makeIterableForSet({ next() {
				const { value, done } = values.next();
				return !done ? {
					value: [value, value],
					done
				} : {
					value: void 0,
					done
				};
			} });
		}
		keys() {
			return this.values();
		}
		values() {
			this.atom_.reportObserved();
			const self = this;
			const values = this.data_.values();
			return makeIterableForSet({ next() {
				const { value, done } = values.next();
				return !done ? {
					value: self.dehanceValue_(value),
					done
				} : {
					value: void 0,
					done
				};
			} });
		}
		intersection(otherSet) {
			return new Set(this).intersection(otherSet);
		}
		union(otherSet) {
			return new Set(this).union(otherSet);
		}
		difference(otherSet) {
			return new Set(this).difference(otherSet);
		}
		symmetricDifference(otherSet) {
			return new Set(this).symmetricDifference(otherSet);
		}
		isSubsetOf(otherSet) {
			return new Set(this).isSubsetOf(otherSet);
		}
		isSupersetOf(otherSet) {
			return new Set(this).isSupersetOf(otherSet);
		}
		isDisjointFrom(otherSet) {
			return new Set(this).isDisjointFrom(otherSet);
		}
		replace(other) {
			if (isObservableSet(other)) other = new Set(other);
			if (Array.isArray(other) || isES6Set(other)) transaction(() => {
				const replacementValues = isES6Set(other) ? other : new Set(other);
				if (replacementValues.size === 0) {
					this.clear();
					return;
				}
				if (this.data_.size === 0) {
					replacementValues.forEach((value) => this.add(value));
					return;
				}
				for (const value of this.data_.values()) if (!replacementValues.has(this.dehanceValue_(value))) this.delete(value);
				replacementValues.forEach((value) => this.add(value));
			});
			else if (other !== null && other !== void 0) die(41, other);
			return this;
		}
		toJSON() {
			return Array.from(this);
		}
		toString() {
			return "[object ObservableSet]";
		}
		[Symbol.iterator]() {
			return this.values();
		}
		get [Symbol.toStringTag]() {
			return "Set";
		}
	};
	var isObservableSet = /*#__PURE__*/ createInstanceofPredicate("ObservableSet", ObservableSet);
	function makeIterableForSet(iterator) {
		iterator[Symbol.toStringTag] = "SetIterator";
		return makeIterable(iterator);
	}
	var descriptorCache = /*#__PURE__*/ Object.create(null);
	var REMOVE = "remove";
	var ObservableObjectAdministration = class {
		constructor(target_, values_ = /* @__PURE__ */ new Map(), name_, defaultAnnotation_ = autoAnnotation) {
			this.target_ = void 0;
			this.values_ = void 0;
			this.name_ = void 0;
			this.defaultAnnotation_ = void 0;
			this.keysAtom_ = void 0;
			this.changeListeners_ = void 0;
			this.interceptors_ = void 0;
			this.proxy_ = void 0;
			this.isPlainObject_ = void 0;
			this.appliedAnnotations_ = void 0;
			this.pendingKeys_ = void 0;
			this.lazyComputedKeys_ = void 0;
			this.lazyObservableKeys_ = void 0;
			this.target_ = target_;
			this.values_ = values_;
			this.name_ = name_;
			this.defaultAnnotation_ = defaultAnnotation_;
			this.keysAtom_ = new Atom(__MOBX_DEV__ ? \`\${this.name_}.keys\` : "ObservableObject.keys");
			this.isPlainObject_ = isPlainObject(this.target_);
			if (__MOBX_DEV__ && !isAnnotation(this.defaultAnnotation_)) die(\`defaultAnnotation must be valid annotation\`);
			if (__MOBX_DEV__) this.appliedAnnotations_ = {};
		}
		getObservablePropValue_(key) {
			var _ref, _this$values_$get;
			return ((_ref = (_this$values_$get = this.values_.get(key)) != null ? _this$values_$get : this.materializeLazyComputed_(key)) != null ? _ref : this.materializeLazyObservable_(key)).get();
		}
		materializeLazyComputed_(key) {
			var _this$lazyComputedKey;
			const factory = (_this$lazyComputedKey = this.lazyComputedKeys_) == null ? void 0 : _this$lazyComputedKey.get(key);
			if (!factory) return;
			this.lazyComputedKeys_.delete(key);
			if (this.lazyComputedKeys_.size === 0) this.lazyComputedKeys_ = void 0;
			const computed = factory();
			this.values_.set(key, computed);
			return computed;
		}
		materializeLazyObservable_(key) {
			var _this$lazyObservableK;
			const factory = (_this$lazyObservableK = this.lazyObservableKeys_) == null ? void 0 : _this$lazyObservableK.get(key);
			if (!factory) return;
			this.lazyObservableKeys_.delete(key);
			if (this.lazyObservableKeys_.size === 0) this.lazyObservableKeys_ = void 0;
			const observable = factory();
			this.values_.set(key, observable);
			return observable;
		}
		setObservablePropValue_(key, newValue) {
			var _ref2, _this$values_$get2;
			const observable = (_ref2 = (_this$values_$get2 = this.values_.get(key)) != null ? _this$values_$get2 : this.materializeLazyComputed_(key)) != null ? _ref2 : this.materializeLazyObservable_(key);
			if (observable instanceof ComputedValue) {
				observable.set(newValue);
				return true;
			}
			if (hasInterceptors(this)) {
				const change = interceptChange(this, {
					type: UPDATE,
					object: this.proxy_ || this.target_,
					name: key,
					newValue
				});
				if (!change) return null;
				newValue = change.newValue;
			}
			newValue = observable.prepareNewValue_(newValue);
			if (newValue !== globalState.UNCHANGED) {
				const notify = hasListeners(this);
				const notifySpy = __MOBX_DEV__ && isSpyEnabled();
				const change = notify || notifySpy ? {
					type: UPDATE,
					observableKind: "object",
					debugObjectName: this.name_,
					object: this.proxy_ || this.target_,
					oldValue: observable.value_,
					name: key,
					newValue
				} : null;
				if (__MOBX_DEV__ && notifySpy) spyReportStart(change);
				observable.setNewValue_(newValue);
				if (notify) notifyListeners(this, change);
				if (__MOBX_DEV__ && notifySpy) spyReportEnd();
			}
			return true;
		}
		get_(key) {
			if (globalState.trackingDerivation && !hasProp(this.target_, key)) this.has_(key);
			return this.target_[key];
		}
		/**
		* @param {PropertyKey} key
		* @param {any} value
		* @param {Annotation|boolean} annotation true - use default annotation, false - copy as is
		* @param {boolean} proxyTrap whether it's called from proxy trap
		* @returns {boolean|null} true on success, false on failure (proxyTrap + non-configurable), null when cancelled by interceptor
		*/
		set_(key, value, proxyTrap = false) {
			if (hasProp(this.target_, key)) {
				if (this.values_.has(key)) return this.setObservablePropValue_(key, value);
				else if (proxyTrap) return Reflect.set(this.target_, key, value);
				else {
					this.target_[key] = value;
					return true;
				}
			} else return this.extend_(key, {
				value,
				enumerable: true,
				writable: true,
				configurable: true
			}, this.defaultAnnotation_, proxyTrap);
		}
		has_(key) {
			if (!globalState.trackingDerivation) return key in this.target_;
			this.pendingKeys_ || (this.pendingKeys_ = /* @__PURE__ */ new Map());
			let entry = this.pendingKeys_.get(key);
			if (!entry) {
				entry = new ObservableValue(key in this.target_, referenceEnhancer, __MOBX_DEV__ ? \`\${this.name_}.\${stringifyKey(key)}?\` : "ObservableObject.key?", false);
				this.pendingKeys_.set(key, entry);
			}
			return entry.get();
		}
		/**
		* @param {PropertyKey} key
		* @param {PropertyDescriptor} descriptor
		* @param {Annotation|boolean} annotation true - use default annotation, false - copy as is
		* @param {boolean} proxyTrap whether it's called from proxy trap
		* @returns {boolean|null} true on success, false on failure (proxyTrap + non-configurable), null when cancelled by interceptor
		*/
		extend_(key, descriptor, annotation, proxyTrap = false) {
			if (annotation === true) annotation = this.defaultAnnotation_;
			if (annotation === false) return this.defineProperty_(key, descriptor, proxyTrap);
			assertAnnotable(this, annotation, key);
			const outcome = annotation.extend_(this, key, descriptor, proxyTrap);
			if (outcome) recordAnnotationApplied(this, annotation, key);
			return outcome;
		}
		/**
		* @param {PropertyKey} key
		* @param {PropertyDescriptor} descriptor
		* @param {boolean} proxyTrap whether it's called from proxy trap
		* @returns {boolean|null} true on success, false on failure (proxyTrap + non-configurable), null when cancelled by interceptor
		*/
		defineProperty_(key, descriptor, proxyTrap = false) {
			checkIfStateModificationsAreAllowed(this.keysAtom_);
			try {
				startBatch();
				const deleteOutcome = this.delete_(key);
				if (!deleteOutcome) return deleteOutcome;
				if (hasInterceptors(this)) {
					const change = interceptChange(this, {
						object: this.proxy_ || this.target_,
						name: key,
						type: ADD,
						newValue: descriptor.value
					});
					if (!change) return null;
					const { newValue } = change;
					if (descriptor.value !== newValue) descriptor = assign({}, descriptor, { value: newValue });
				}
				if (proxyTrap) {
					if (!Reflect.defineProperty(this.target_, key, descriptor)) return false;
				} else defineProperty(this.target_, key, descriptor);
				this.notifyPropertyAddition_(key, descriptor.value);
			} finally {
				endBatch();
			}
			return true;
		}
		defineObservableProperty_(key, value, enhancer, proxyTrap = false) {
			checkIfStateModificationsAreAllowed(this.keysAtom_);
			try {
				startBatch();
				const deleteOutcome = this.delete_(key);
				if (!deleteOutcome) return deleteOutcome;
				if (hasInterceptors(this)) {
					const change = interceptChange(this, {
						object: this.proxy_ || this.target_,
						name: key,
						type: ADD,
						newValue: value
					});
					if (!change) return null;
					value = change.newValue;
				}
				const cachedDescriptor = getCachedObservablePropDescriptor(key);
				const descriptor = {
					configurable: globalState.safeDescriptors ? this.isPlainObject_ : true,
					enumerable: true,
					get: cachedDescriptor.get,
					set: cachedDescriptor.set
				};
				if (proxyTrap) {
					if (!Reflect.defineProperty(this.target_, key, descriptor)) return false;
				} else defineProperty(this.target_, key, descriptor);
				const observable = new ObservableValue(value, enhancer, __MOBX_DEV__ ? \`\${this.name_}.\${key.toString()}\` : "ObservableObject.key", false);
				this.values_.set(key, observable);
				this.notifyPropertyAddition_(key, observable.value_);
			} finally {
				endBatch();
			}
			return true;
		}
		defineComputedProperty_(key, options, proxyTrap = false) {
			checkIfStateModificationsAreAllowed(this.keysAtom_);
			try {
				startBatch();
				const deleteOutcome = this.delete_(key);
				if (!deleteOutcome) return deleteOutcome;
				if (hasInterceptors(this)) {
					if (!interceptChange(this, {
						object: this.proxy_ || this.target_,
						name: key,
						type: ADD,
						newValue: void 0
					})) return null;
				}
				options.name || (options.name = __MOBX_DEV__ ? \`\${this.name_}.\${key.toString()}\` : "ObservableObject.key");
				options.context = this.proxy_ || this.target_;
				const cachedDescriptor = getCachedObservablePropDescriptor(key);
				const descriptor = {
					configurable: globalState.safeDescriptors ? this.isPlainObject_ : true,
					enumerable: false,
					get: cachedDescriptor.get,
					set: cachedDescriptor.set
				};
				if (proxyTrap) {
					if (!Reflect.defineProperty(this.target_, key, descriptor)) return false;
				} else defineProperty(this.target_, key, descriptor);
				this.values_.set(key, new ComputedValue(options));
				this.notifyPropertyAddition_(key, void 0);
			} finally {
				endBatch();
			}
			return true;
		}
		/**
		* @param {PropertyKey} key
		* @param {PropertyDescriptor} descriptor
		* @param {boolean} proxyTrap whether it's called from proxy trap
		* @returns {boolean|null} true on success, false on failure (proxyTrap + non-configurable), null when cancelled by interceptor
		*/
		delete_(key, proxyTrap = false) {
			checkIfStateModificationsAreAllowed(this.keysAtom_);
			if (!hasProp(this.target_, key)) return true;
			if (hasInterceptors(this)) {
				if (!interceptChange(this, {
					object: this.proxy_ || this.target_,
					name: key,
					type: REMOVE
				})) return null;
			}
			try {
				var _this$pendingKeys_;
				startBatch();
				const notify = hasListeners(this);
				const notifySpy = __MOBX_DEV__ && isSpyEnabled();
				const observable = this.values_.get(key);
				let value = void 0;
				if (!observable && (notify || notifySpy)) {
					var _getDescriptor;
					value = (_getDescriptor = getDescriptor(this.target_, key)) == null ? void 0 : _getDescriptor.value;
				}
				if (proxyTrap) {
					if (!Reflect.deleteProperty(this.target_, key)) return false;
				} else delete this.target_[key];
				if (__MOBX_DEV__) delete this.appliedAnnotations_[key];
				if (observable) {
					this.values_.delete(key);
					if (observable instanceof ObservableValue) value = observable.value_;
					propagateChanged(observable);
				}
				this.keysAtom_.reportChanged();
				(_this$pendingKeys_ = this.pendingKeys_) == null || (_this$pendingKeys_ = _this$pendingKeys_.get(key)) == null || _this$pendingKeys_.set(key in this.target_);
				if (notify || notifySpy) {
					const change = {
						type: REMOVE,
						observableKind: "object",
						object: this.proxy_ || this.target_,
						debugObjectName: this.name_,
						oldValue: value,
						name: key
					};
					if (__MOBX_DEV__ && notifySpy) spyReportStart(change);
					if (notify) notifyListeners(this, change);
					if (__MOBX_DEV__ && notifySpy) spyReportEnd();
				}
			} finally {
				endBatch();
			}
			return true;
		}
		notifyPropertyAddition_(key, value) {
			var _this$pendingKeys_2;
			const notify = hasListeners(this);
			const notifySpy = __MOBX_DEV__ && isSpyEnabled();
			if (notify || notifySpy) {
				const change = notify || notifySpy ? {
					type: ADD,
					observableKind: "object",
					debugObjectName: this.name_,
					object: this.proxy_ || this.target_,
					name: key,
					newValue: value
				} : null;
				if (__MOBX_DEV__ && notifySpy) spyReportStart(change);
				if (notify) notifyListeners(this, change);
				if (__MOBX_DEV__ && notifySpy) spyReportEnd();
			}
			(_this$pendingKeys_2 = this.pendingKeys_) == null || (_this$pendingKeys_2 = _this$pendingKeys_2.get(key)) == null || _this$pendingKeys_2.set(true);
			this.keysAtom_.reportChanged();
		}
		ownKeys_() {
			this.keysAtom_.reportObserved();
			return ownKeys(this.target_);
		}
		keys_() {
			this.keysAtom_.reportObserved();
			return Object.keys(this.target_);
		}
	};
	function asObservableObject(target, options) {
		var _options$name;
		if (__MOBX_DEV__ && options && isObservableObject(target)) die(\`Options can't be provided for already observable objects.\`);
		if (hasProp(target, $mobx)) {
			if (__MOBX_DEV__ && !(getAdministration(target) instanceof ObservableObjectAdministration)) die(\`Cannot convert '\${getDebugName(target)}' into observable object:\\nThe target is already observable of different type.\\nExtending builtins is not supported.\`);
			return target;
		}
		if (__MOBX_DEV__ && !Object.isExtensible(target)) die("Cannot make the designated object observable; it is not extensible");
		const name = (_options$name = options == null ? void 0 : options.name) != null ? _options$name : __MOBX_DEV__ ? \`\${isPlainObject(target) ? "ObservableObject" : target.constructor.name}@\${getNextId()}\` : "ObservableObject";
		addHiddenProp(target, $mobx, new ObservableObjectAdministration(target, /* @__PURE__ */ new Map(), String(name), getAnnotationFromOptions(options)));
		return target;
	}
	var isObservableObjectAdministration = /*#__PURE__*/ createInstanceofPredicate("ObservableObjectAdministration", ObservableObjectAdministration);
	function getCachedObservablePropDescriptor(key) {
		return descriptorCache[key] || (descriptorCache[key] = {
			get() {
				return this[$mobx].getObservablePropValue_(key);
			},
			set(value) {
				return this[$mobx].setObservablePropValue_(key, value);
			}
		});
	}
	function isObservableObject(thing) {
		if (isObject(thing)) return isObservableObjectAdministration(thing[$mobx]);
		return false;
	}
	function recordAnnotationApplied(adm, annotation, key) {
		if (__MOBX_DEV__) adm.appliedAnnotations_[key] = annotation;
	}
	function assertAnnotable(adm, annotation, key) {
		if (__MOBX_DEV__ && !isAnnotation(annotation)) die(\`Cannot annotate '\${adm.name_}.\${key.toString()}': Invalid annotation.\`);
		if (__MOBX_DEV__ && !isOverride(annotation) && hasProp(adm.appliedAnnotations_, key)) {
			const fieldName = \`\${adm.name_}.\${key.toString()}\`;
			const currentAnnotationType = adm.appliedAnnotations_[key].annotationType_;
			const requestedAnnotationType = annotation.annotationType_;
			die(\`Cannot apply '\${requestedAnnotationType}' to '\${fieldName}':\\nThe field is already annotated with '\${currentAnnotationType}'.\\nRe-annotating fields is not allowed.\\nUse 'override' annotation for methods overridden by subclass.\`);
		}
	}
	function getAtom(thing, property) {
		if (typeof thing === "object" && thing !== null) {
			if (isObservableArray(thing)) {
				if (property !== void 0) die(23);
				return thing[$mobx].atom_;
			}
			if (isObservableSet(thing)) return thing.atom_;
			if (isObservableMap(thing)) {
				if (property === void 0) return thing.keysAtom_;
				const observable = thing.data_.get(property) || thing.hasMap_.get(property);
				if (!observable) die(25, property, getDebugName(thing));
				return observable;
			}
			if (isObservableObject(thing)) {
				var _ref, _adm$values_$get;
				if (!property) return die(26);
				const adm = thing[$mobx];
				const observable = (_ref = (_adm$values_$get = adm.values_.get(property)) != null ? _adm$values_$get : adm.materializeLazyComputed_(property)) != null ? _ref : adm.materializeLazyObservable_(property);
				if (!observable) die(27, property, getDebugName(thing));
				return observable;
			}
			if (isAtom(thing) || isComputedValue(thing) || isReaction(thing)) return thing;
		} else if (isFunction(thing)) {
			if (isReaction(thing[$mobx])) return thing[$mobx];
		}
		die(28);
	}
	function getAdministration(thing, property) {
		if (!thing) die(29);
		if (property !== void 0) return getAdministration(getAtom(thing, property));
		if (isAtom(thing) || isComputedValue(thing) || isReaction(thing)) return thing;
		if (isObservableMap(thing) || isObservableSet(thing)) return thing;
		if (thing[$mobx]) return thing[$mobx];
		die(24, thing);
	}
	function getDebugName(thing, property) {
		let named;
		if (property !== void 0) named = getAtom(thing, property);
		else if (isAction(thing)) return thing.name;
		else if (isObservableObject(thing) || isObservableMap(thing) || isObservableSet(thing)) named = getAdministration(thing);
		else named = getAtom(thing);
		return named.name_;
	}
	/**
	* Helper function for initializing observable structures, it applies:
	* 1. allowStateChanges so we don't violate enforceActions.
	* 2. untracked so we don't accidentaly subscribe to anything observable accessed during init in case the observable is created inside derivation.
	* 3. batch to avoid state version updates
	*/
	function initObservable(cb) {
		const derivation = untrackedStart();
		const allowStateChanges = __MOBX_DEV__ ? allowStateChangesStart(true) : true;
		startBatch();
		try {
			return cb();
		} finally {
			endBatch();
			if (__MOBX_DEV__) allowStateChangesEnd(allowStateChanges);
			untrackedEnd(derivation);
		}
	}
	objectPrototype.toString;
	var _globalThis$Iterator;
	var maybeIteratorPrototype = ((_globalThis$Iterator = globalThis.Iterator) == null ? void 0 : _globalThis$Iterator.prototype) || {};
	function makeIterable(iterator) {
		iterator[Symbol.iterator] = getSelf;
		return assign(Object.create(maybeIteratorPrototype), iterator);
	}
	function getSelf() {
		return this;
	}
	function isAnnotation(thing) {
		return thing instanceof Object && typeof thing.annotationType_ === "string" && isFunction(thing.make_) && isFunction(thing.extend_);
	}
	/**
	* (c) Michel Weststrate 2015 - 2020
	* MIT Licensed
	*
	* Welcome to the mobx sources! To get a global overview of how MobX internally works,
	* this is a good place to start:
	* https://medium.com/@mweststrate/becoming-fully-reactive-an-in-depth-explanation-of-mobservable-55995262a254#.xvbh6qd74
	*
	* Source folders:
	* ===============
	*
	* - api/     Most of the public static methods exposed by the module can be found here.
	* - core/    Implementation of the MobX algorithm; atoms, derivations, reactions, dependency trees, optimizations. Cool stuff can be found here.
	* - types/   All the magic that is need to have observable objects, arrays and values is in this folder. Including the modifiers like \`asFlat\`.
	* - utils/   Utility stuff.
	*
	*/
	if (__MOBX_DEV__) {
		const g = globalThis;
		[
			"Symbol",
			"Map",
			"Set",
			"Proxy"
		].forEach((m) => {
			if (typeof g[m] === "undefined") die(\`MobX requires global '\${m}' to be available or polyfilled\`);
		});
	}
	if (__MOBX_DEV__ && typeof __MOBX_DEVTOOLS_GLOBAL_HOOK__ === "object") __MOBX_DEVTOOLS_GLOBAL_HOOK__.injectMobx({
		spy,
		extras: { getDebugName },
		$mobx
	});
	//#endregion
	//#region src/widgets/widget-base.ts
	/**
	* WidgetBase — shared MobX observable foundation for interactive widgets.
	* [LAW:one-type-per-behavior] All widgets share the same base; differences
	* are in configuration and state, not in infrastructure.
	*
	* Reactive state is declared with TC39 decorators, which MobX 7 requires on
	* \`accessor\` members. Each decorator registers its own member, so there is no
	* makeObservable call and subclasses add observables the same way.
	*/
	var __runInitializers$8 = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var __esDecorate$8 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	var WidgetBase = (() => {
		let _instanceExtraInitializers = [];
		let _focused_decorators;
		let _focused_initializers = [];
		let _focused_extraInitializers = [];
		let _hovered_decorators;
		let _hovered_initializers = [];
		let _hovered_extraInitializers = [];
		let _active_decorators;
		let _active_initializers = [];
		let _active_extraInitializers = [];
		let _disabled_decorators;
		let _disabled_initializers = [];
		let _disabled_extraInitializers = [];
		let _visible_decorators;
		let _visible_initializers = [];
		let _visible_extraInitializers = [];
		let _handleFocus_decorators;
		let _focus_decorators;
		let _blur_decorators;
		let _setDisabled_decorators;
		let _setHovered_decorators;
		return class WidgetBase {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
				_focused_decorators = [observable];
				_hovered_decorators = [observable];
				_active_decorators = [observable];
				_disabled_decorators = [observable];
				_visible_decorators = [observable];
				_handleFocus_decorators = [action];
				_focus_decorators = [action];
				_blur_decorators = [action];
				_setDisabled_decorators = [action];
				_setHovered_decorators = [action];
				__esDecorate$8(this, null, _focused_decorators, {
					kind: "accessor",
					name: "focused",
					static: false,
					private: false,
					access: {
						has: (obj) => "focused" in obj,
						get: (obj) => obj.focused,
						set: (obj, value) => {
							obj.focused = value;
						}
					},
					metadata: _metadata
				}, _focused_initializers, _focused_extraInitializers);
				__esDecorate$8(this, null, _hovered_decorators, {
					kind: "accessor",
					name: "hovered",
					static: false,
					private: false,
					access: {
						has: (obj) => "hovered" in obj,
						get: (obj) => obj.hovered,
						set: (obj, value) => {
							obj.hovered = value;
						}
					},
					metadata: _metadata
				}, _hovered_initializers, _hovered_extraInitializers);
				__esDecorate$8(this, null, _active_decorators, {
					kind: "accessor",
					name: "active",
					static: false,
					private: false,
					access: {
						has: (obj) => "active" in obj,
						get: (obj) => obj.active,
						set: (obj, value) => {
							obj.active = value;
						}
					},
					metadata: _metadata
				}, _active_initializers, _active_extraInitializers);
				__esDecorate$8(this, null, _disabled_decorators, {
					kind: "accessor",
					name: "disabled",
					static: false,
					private: false,
					access: {
						has: (obj) => "disabled" in obj,
						get: (obj) => obj.disabled,
						set: (obj, value) => {
							obj.disabled = value;
						}
					},
					metadata: _metadata
				}, _disabled_initializers, _disabled_extraInitializers);
				__esDecorate$8(this, null, _visible_decorators, {
					kind: "accessor",
					name: "visible",
					static: false,
					private: false,
					access: {
						has: (obj) => "visible" in obj,
						get: (obj) => obj.visible,
						set: (obj, value) => {
							obj.visible = value;
						}
					},
					metadata: _metadata
				}, _visible_initializers, _visible_extraInitializers);
				__esDecorate$8(this, null, _handleFocus_decorators, {
					kind: "method",
					name: "handleFocus",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleFocus" in obj,
						get: (obj) => obj.handleFocus
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$8(this, null, _focus_decorators, {
					kind: "method",
					name: "focus",
					static: false,
					private: false,
					access: {
						has: (obj) => "focus" in obj,
						get: (obj) => obj.focus
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$8(this, null, _blur_decorators, {
					kind: "method",
					name: "blur",
					static: false,
					private: false,
					access: {
						has: (obj) => "blur" in obj,
						get: (obj) => obj.blur
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$8(this, null, _setDisabled_decorators, {
					kind: "method",
					name: "setDisabled",
					static: false,
					private: false,
					access: {
						has: (obj) => "setDisabled" in obj,
						get: (obj) => obj.setDisabled
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$8(this, null, _setHovered_decorators, {
					kind: "method",
					name: "setHovered",
					static: false,
					private: false,
					access: {
						has: (obj) => "setHovered" in obj,
						get: (obj) => obj.setHovered
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			#focused_accessor_storage = (__runInitializers$8(this, _instanceExtraInitializers), __runInitializers$8(this, _focused_initializers, false));
			get focused() {
				return this.#focused_accessor_storage;
			}
			set focused(value) {
				this.#focused_accessor_storage = value;
			}
			#hovered_accessor_storage = (__runInitializers$8(this, _focused_extraInitializers), __runInitializers$8(this, _hovered_initializers, false));
			get hovered() {
				return this.#hovered_accessor_storage;
			}
			set hovered(value) {
				this.#hovered_accessor_storage = value;
			}
			#active_accessor_storage = (__runInitializers$8(this, _hovered_extraInitializers), __runInitializers$8(this, _active_initializers, false));
			get active() {
				return this.#active_accessor_storage;
			}
			set active(value) {
				this.#active_accessor_storage = value;
			}
			#disabled_accessor_storage = (__runInitializers$8(this, _active_extraInitializers), __runInitializers$8(this, _disabled_initializers, false));
			get disabled() {
				return this.#disabled_accessor_storage;
			}
			set disabled(value) {
				this.#disabled_accessor_storage = value;
			}
			#visible_accessor_storage = (__runInitializers$8(this, _disabled_extraInitializers), __runInitializers$8(this, _visible_initializers, true));
			get visible() {
				return this.#visible_accessor_storage;
			}
			set visible(value) {
				this.#visible_accessor_storage = value;
			}
			#bounds_accessor_storage = (__runInitializers$8(this, _visible_extraInitializers), null);
			get bounds() {
				return this.#bounds_accessor_storage;
			}
			set bounds(value) {
				this.#bounds_accessor_storage = value;
			}
			changeHandlers = /* @__PURE__ */ new Set();
			submitHandlers = /* @__PURE__ */ new Set();
			handleMouse(_event) {}
			handleFocus(event) {
				this.focused = event.type === "focus";
			}
			focus() {
				this.handleFocus({ type: "focus" });
			}
			blur() {
				this.handleFocus({ type: "blur" });
			}
			setDisabled(value) {
				this.disabled = value;
			}
			setHovered(value) {
				this.hovered = value;
			}
			containsPoint(x, y) {
				const b = this.bounds;
				if (!b) return false;
				return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
			}
			onChange(handler) {
				this.changeHandlers.add(handler);
				return () => this.changeHandlers.delete(handler);
			}
			onSubmit(handler) {
				this.submitHandlers.add(handler);
				return () => this.submitHandlers.delete(handler);
			}
			emitChange() {
				for (const handler of this.changeHandlers) handler(this);
			}
			emitSubmit() {
				for (const handler of this.submitHandlers) handler(this);
			}
		};
	})();
	//#endregion
	//#region src/widgets/static-item.ts
	/**
	* StaticItem — a non-focusable, non-interactive Renderable wrapped to fit
	* the InteractiveWidget surface so it can be mounted by Screen alongside
	* real widgets.
	*
	* [LAW:one-type-per-behavior] Screen.mount accepts a uniform array of
	* InteractiveWidget. Static text, panels, swatches, and other display-only
	* Renderables flow through the same pipeline by being expressed as the
	* same type. The differences (no focus, no event handling) are configured
	* via \`focusable: false\` plus the no-op handlers WidgetBase already
	* provides — there is no second type, no "static vs interactive" branch in
	* Screen's render loop.
	*
	* The wrapped renderable can be a function that re-evaluates each frame
	* (so the host can read MobX observables inside \`render\` and have Screen
	* re-render reactively) or a plain object that returns the same segments
	* every time.
	*/
	var StaticItem = class extends WidgetBase {
		id;
		focusable = false;
		renderFn;
		measureFn;
		constructor(options) {
			super();
			this.id = options.id;
			const r = options.render;
			this.renderFn = typeof r === "function" ? (opts) => r(opts) : (opts) => r.render(opts);
			this.measureFn = options.measure;
		}
		handleKey(_event) {}
		render(options) {
			return this.renderFn(options);
		}
		measure(options) {
			if (this.measureFn) return this.measureFn(options);
			const segments = Array.from(this.renderFn(options));
			const lines = Segment.splitLines(segments);
			let max = 0;
			for (const line of lines) {
				const w = Segment.getLineLength(line);
				if (w > max) max = w;
			}
			return {
				minimum: max,
				maximum: max
			};
		}
	};
	//#endregion
	//#region src/widgets/focus-manager.ts
	/**
	* FocusManager — flat focus cycling over registered widgets.
	* [LAW:one-source-of-truth] single authority for which widget has focus.
	* [LAW:dataflow-not-control-flow] focus transitions are observable state;
	* widgets react to focus/blur events, the manager never skips dispatch.
	*/
	var __runInitializers$7 = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var __esDecorate$7 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	var DefaultFocusManager = (() => {
		let _instanceExtraInitializers = [];
		let _widgetList_decorators;
		let _widgetList_initializers = [];
		let _widgetList_extraInitializers = [];
		let _currentWidget_decorators;
		let _currentWidget_initializers = [];
		let _currentWidget_extraInitializers = [];
		let _register_decorators;
		let _unregister_decorators;
		let _next_decorators;
		let _prev_decorators;
		let _focus_decorators;
		let _blur_decorators;
		let _setFocus_decorators;
		return class DefaultFocusManager {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
				_widgetList_decorators = [observableShallow];
				_currentWidget_decorators = [observableRef];
				_register_decorators = [action];
				_unregister_decorators = [action];
				_next_decorators = [action];
				_prev_decorators = [action];
				_focus_decorators = [action];
				_blur_decorators = [action];
				_setFocus_decorators = [action];
				__esDecorate$7(this, null, _widgetList_decorators, {
					kind: "accessor",
					name: "widgetList",
					static: false,
					private: false,
					access: {
						has: (obj) => "widgetList" in obj,
						get: (obj) => obj.widgetList,
						set: (obj, value) => {
							obj.widgetList = value;
						}
					},
					metadata: _metadata
				}, _widgetList_initializers, _widgetList_extraInitializers);
				__esDecorate$7(this, null, _currentWidget_decorators, {
					kind: "accessor",
					name: "currentWidget",
					static: false,
					private: false,
					access: {
						has: (obj) => "currentWidget" in obj,
						get: (obj) => obj.currentWidget,
						set: (obj, value) => {
							obj.currentWidget = value;
						}
					},
					metadata: _metadata
				}, _currentWidget_initializers, _currentWidget_extraInitializers);
				__esDecorate$7(this, null, _register_decorators, {
					kind: "method",
					name: "register",
					static: false,
					private: false,
					access: {
						has: (obj) => "register" in obj,
						get: (obj) => obj.register
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$7(this, null, _unregister_decorators, {
					kind: "method",
					name: "unregister",
					static: false,
					private: false,
					access: {
						has: (obj) => "unregister" in obj,
						get: (obj) => obj.unregister
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$7(this, null, _next_decorators, {
					kind: "method",
					name: "next",
					static: false,
					private: false,
					access: {
						has: (obj) => "next" in obj,
						get: (obj) => obj.next
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$7(this, null, _prev_decorators, {
					kind: "method",
					name: "prev",
					static: false,
					private: false,
					access: {
						has: (obj) => "prev" in obj,
						get: (obj) => obj.prev
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$7(this, null, _focus_decorators, {
					kind: "method",
					name: "focus",
					static: false,
					private: false,
					access: {
						has: (obj) => "focus" in obj,
						get: (obj) => obj.focus
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$7(this, null, _blur_decorators, {
					kind: "method",
					name: "blur",
					static: false,
					private: false,
					access: {
						has: (obj) => "blur" in obj,
						get: (obj) => obj.blur
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$7(this, null, _setFocus_decorators, {
					kind: "method",
					name: "setFocus",
					static: false,
					private: false,
					access: {
						has: (obj) => "setFocus" in obj,
						get: (obj) => obj.setFocus
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			#widgetList_accessor_storage = (__runInitializers$7(this, _instanceExtraInitializers), __runInitializers$7(this, _widgetList_initializers, []));
			get widgetList() {
				return this.#widgetList_accessor_storage;
			}
			set widgetList(value) {
				this.#widgetList_accessor_storage = value;
			}
			#currentWidget_accessor_storage = (__runInitializers$7(this, _widgetList_extraInitializers), __runInitializers$7(this, _currentWidget_initializers, null));
			get currentWidget() {
				return this.#currentWidget_accessor_storage;
			}
			set currentWidget(value) {
				this.#currentWidget_accessor_storage = value;
			}
			changeHandlers = (__runInitializers$7(this, _currentWidget_extraInitializers), /* @__PURE__ */ new Set());
			get current() {
				return this.currentWidget;
			}
			get widgets() {
				return this.widgetList;
			}
			register(widget) {
				if (this.widgetList.includes(widget)) return;
				this.widgetList = [...this.widgetList, widget];
				if (!this.currentWidget && widget.focusable && !widget.disabled) this.setFocus(widget);
			}
			unregister(widget) {
				if (this.widgetList.indexOf(widget) === -1) return;
				this.widgetList = this.widgetList.filter((w) => w !== widget);
				if (this.currentWidget === widget) {
					widget.blur();
					const next = this.widgetList.find((w) => w.focusable && !w.disabled) ?? null;
					if (next) next.focus();
					this.currentWidget = next;
					this.emitChange();
				}
			}
			next() {
				const focusable = this.focusableWidgets();
				if (focusable.length === 0) return;
				const nextIdx = ((this.currentWidget ? focusable.indexOf(this.currentWidget) : -1) + 1) % focusable.length;
				this.setFocus(focusable[nextIdx]);
			}
			prev() {
				const focusable = this.focusableWidgets();
				if (focusable.length === 0) return;
				const currentIdx = this.currentWidget ? focusable.indexOf(this.currentWidget) : -1;
				const prevIdx = currentIdx <= 0 ? focusable.length - 1 : currentIdx - 1;
				this.setFocus(focusable[prevIdx]);
			}
			focus(widget) {
				if (!widget.focusable || widget.disabled) return;
				if (!this.widgetList.includes(widget)) return;
				this.setFocus(widget);
			}
			blur() {
				if (!this.currentWidget) return;
				this.currentWidget.blur();
				this.currentWidget = null;
				this.emitChange();
			}
			onChange(handler) {
				this.changeHandlers.add(handler);
				return () => this.changeHandlers.delete(handler);
			}
			handleKey(event) {
				if (event.key !== "tab") return;
				if (event.shift) this.prev();
				else this.next();
				event.stop();
			}
			focusableWidgets() {
				return this.widgetList.filter((w) => w.focusable && !w.disabled);
			}
			setFocus(widget) {
				if (this.currentWidget === widget) return;
				if (this.currentWidget) this.currentWidget.blur();
				this.currentWidget = widget;
				widget.focus();
				this.emitChange();
			}
			emitChange() {
				for (const handler of this.changeHandlers) handler(this.currentWidget);
			}
		};
	})();
	//#endregion
	//#region src/widgets/screen.ts
	/**
	* Screen — owns the render loop and ANSI output for interactive widgets.
	*
	* [LAW:dataflow-not-control-flow] Same pipeline runs every frame: render
	* widgets to Segment[], split into lines, encode to ANSI, write to stdout
	* with cursor-up + overwrite. Variability lives in the values (which widgets
	* are visible, what they render), never in whether the pipeline runs.
	*
	* [LAW:one-source-of-truth] Layout (widget bounds) is computed here and
	* written to widget.bounds. Mouse hit-testing reads the same bounds — the
	* Screen is the single authority on where each widget is drawn.
	*
	* [LAW:single-enforcer] Cursor management lives in one place: \`draw()\`
	* tracks \`lastLineCount\` and emits a single \`\\x1b[<n>A\` to reposition.
	* Per-line \`\\x1b[K\` (erase to end of line) overwrites old content without
	* flicker — no clear-and-redraw cycle.
	*
	* Reactivity: \`mobx.autorun\` re-fires on any observable read during render
	* (label, focused, hovered, active, disabled, visible, the widget list
	* itself). Renders are debounced to a microtask so a burst of state changes
	* within one tick produces one frame.
	*
	* Layout (per-widget Placement):
	*
	*   flow   — vertical stack at x=0; advances the layout cursor by the
	*            widget's measured height. Default placement; preserves the
	*            historical single-column behavior so existing consumers
	*            (and the screen tests) need no migration.
	*   inline — same row as the preceding flow/inline neighbor; x packs
	*            after that neighbor's right edge plus a one-cell gap. The
	*            row's height is the max of its members; the cursor advances
	*            past the tallest member when the next non-inline item is
	*            placed (or at end of frame).
	*   fixed  — absolute (x, y); independent of the cursor. Used for
	*            anchored content like status/log rows that the host wants
	*            placed at a known coordinate regardless of flow growth.
	*
	* The overlay pass (single enforcer) runs after base layout: any widget
	* implementing OverlayRenderable contributes overlay segments anchored
	* directly below its inline footprint, and Screen unions the overlay
	* area into the widget's bounds for hit-testing.
	*
	* Design alternatives considered:
	*   1. Per-widget Placement (chosen) — smallest type that covers the legal
	*      variability; one total switch in computeFrame; back-compat default.
	*   2. Named regions (header/body/status as flow containers) — adds a
	*      two-step API surface (declare regions, then mount into them) and
	*      another concept; rejected as larger than the problem requires.
	*   3. Host-supplied layout function — pushes layout out of Screen,
	*      defeating single-enforcer; rejected.
	*/
	var __esDecorate$6 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	var __runInitializers$6 = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var DefaultScreen = (() => {
		let _widgetList_decorators;
		let _widgetList_initializers = [];
		let _widgetList_extraInitializers = [];
		return class DefaultScreen {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
				_widgetList_decorators = [observableShallow];
				__esDecorate$6(this, null, _widgetList_decorators, {
					kind: "accessor",
					name: "widgetList",
					static: false,
					private: false,
					access: {
						has: (obj) => "widgetList" in obj,
						get: (obj) => obj.widgetList,
						set: (obj, value) => {
							obj.widgetList = value;
						}
					},
					metadata: _metadata
				}, _widgetList_initializers, _widgetList_extraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			focusManager;
			#widgetList_accessor_storage = __runInitializers$6(this, _widgetList_initializers, []);
			get widgetList() {
				return this.#widgetList_accessor_storage;
			}
			set widgetList(value) {
				this.#widgetList_accessor_storage = value;
			}
			placements = (__runInitializers$6(this, _widgetList_extraInitializers), /* @__PURE__ */ new Map());
			_activeOverlays = /* @__PURE__ */ new Set();
			_running = false;
			autorunDispose;
			renderScheduled = false;
			pendingFrame = null;
			lastLineCount = 0;
			host;
			widthOverride;
			destination;
			manageCursor;
			constructor(options) {
				this.host = options.host;
				this.widthOverride = options.width;
				this.focusManager = options.focusManager ?? new DefaultFocusManager();
				const isTTY = this.host.isTTY;
				this.destination = resolveDestination(options.colorSystem === void 0 ? "auto" : options.colorSystem, { isTTY });
				this.manageCursor = options.manageCursor ?? isTTY;
			}
			get running() {
				return this._running;
			}
			get widgets() {
				if (this._activeOverlays.size === 0) return this.widgetList;
				const base = [];
				const top = [];
				for (const w of this.widgetList) (this._activeOverlays.has(w) ? top : base).push(w);
				return [...base, ...top];
			}
			mount(...entries) {
				runInAction(() => {
					const next = [...this.widgetList];
					for (const entry of entries) {
						const { widget, placement } = normalizeEntry(entry);
						if (next.includes(widget)) continue;
						next.push(widget);
						this.placements.set(widget, placement);
						this.focusManager.register(widget);
					}
					this.widgetList = next;
				});
			}
			unmount(widget) {
				runInAction(() => {
					if (this.widgetList.indexOf(widget) === -1) return;
					this.widgetList = this.widgetList.filter((w) => w !== widget);
					this.placements.delete(widget);
					this.focusManager.unregister(widget);
					this._activeOverlays.delete(widget);
				});
			}
			start() {
				if (this._running) return;
				this._running = true;
				this.lastLineCount = 0;
				if (this.manageCursor) this.host.write("\\x1B[?25l");
				this.autorunDispose = autorun(() => {
					this.pendingFrame = this.computeFrame();
					this.scheduleRender();
				});
			}
			stop() {
				if (!this._running) return;
				this._running = false;
				if (this.autorunDispose) {
					this.autorunDispose();
					this.autorunDispose = void 0;
				}
				this.pendingFrame = null;
				this.renderScheduled = false;
				this._activeOverlays = /* @__PURE__ */ new Set();
				if (this.manageCursor) this.host.write("\\x1B[?25h");
				if (this.lastLineCount > 0) this.host.write("\\n");
			}
			get width() {
				if (this.widthOverride !== void 0) return this.widthOverride;
				return this.host.size().cols;
			}
			computeFrame() {
				const width = this.width;
				const renderOptions = {
					maxWidth: width,
					isTerminal: true,
					encoding: "utf-8",
					colorSystem: this.destination.colorSystem
				};
				const lines = [];
				const boundsList = [];
				const activeOverlays = /* @__PURE__ */ new Set();
				let cursorY = 0;
				let lastFlowRow = null;
				for (const widget of this.widgetList) {
					const visible = widget.visible;
					const segments = visible ? Array.from(widget.render(renderOptions)) : [];
					const rawLines = visible ? Segment.splitLines(segments) : [];
					const placement = this.placements.get(widget) ?? FLOW;
					let x;
					let y;
					let prevAtPlacement = null;
					switch (placement.kind) {
						case "flow":
							x = 0;
							y = cursorY;
							break;
						case "inline":
							prevAtPlacement = lastFlowRow;
							if (prevAtPlacement === null) {
								x = 0;
								y = cursorY;
							} else {
								x = prevAtPlacement.rightX + (prevAtPlacement.rightX > 0 ? 1 : 0);
								y = prevAtPlacement.startY;
							}
							break;
						case "fixed":
							x = placement.x;
							y = placement.y;
					}
					const available = Math.max(0, width - x);
					const widgetLines = available > 0 ? rawLines.map((line) => Segment.adjustLineLength(line, available, void 0, false)) : [];
					const [w, h] = Segment.getShape(widgetLines);
					paintLines(lines, widgetLines, x, y);
					if (placement.kind === "flow" && h > 0) {
						cursorY = y + h;
						lastFlowRow = {
							startY: y,
							height: h,
							rightX: x + w
						};
					} else if (placement.kind === "inline" && h > 0) {
						const rowStart = prevAtPlacement?.startY ?? y;
						const rowHeight = Math.max(prevAtPlacement?.height ?? 0, h);
						cursorY = Math.max(cursorY, rowStart + rowHeight);
						lastFlowRow = {
							startY: rowStart,
							height: rowHeight,
							rightX: x + w
						};
					}
					boundsList.push({
						widget,
						bounds: {
							x,
							y,
							width: w,
							height: h
						}
					});
				}
				for (const entry of boundsList) {
					const widget = entry.widget;
					if (!widget.visible) continue;
					if (!hasOverlay(widget)) continue;
					const overlaySegs = widget.renderOverlay(renderOptions);
					if (overlaySegs === null) continue;
					const overlayRawLines = Segment.splitLines(Array.from(overlaySegs));
					if (overlayRawLines.length === 0) continue;
					const overlayAvailable = Math.max(0, width - entry.bounds.x);
					const overlayLines = overlayAvailable > 0 ? overlayRawLines.map((line) => Segment.adjustLineLength(line, overlayAvailable, void 0, false)) : [];
					if (overlayLines.length === 0) continue;
					const startY = entry.bounds.y + entry.bounds.height;
					paintLines(lines, overlayLines, entry.bounds.x, startY);
					const [overlayW] = Segment.getShape(overlayLines);
					entry.bounds = {
						x: entry.bounds.x,
						y: entry.bounds.y,
						width: Math.max(entry.bounds.width, overlayW),
						height: entry.bounds.height + overlayLines.length
					};
					activeOverlays.add(widget);
				}
				return {
					width,
					lines,
					bounds: boundsList,
					activeOverlays
				};
			}
			scheduleRender() {
				if (this.renderScheduled) return;
				this.renderScheduled = true;
				queueMicrotask(() => {
					this.renderScheduled = false;
					if (this._running) this.draw();
				});
			}
			draw() {
				const frame = this.pendingFrame ?? this.computeFrame();
				this.pendingFrame = null;
				const { width, lines, bounds, activeOverlays } = frame;
				for (const { widget, bounds: b } of bounds) widget.bounds = b;
				this._activeOverlays = activeOverlays;
				const newCount = lines.length;
				const drawCount = Math.max(newCount, this.lastLineCount);
				let buf = "";
				if (this.lastLineCount > 1) buf += \`\\x1b[\${this.lastLineCount - 1}A\`;
				buf += "\\r";
				for (let i = 0; i < drawCount; i++) {
					const line = lines[i];
					if (line) {
						const clipped = Segment.adjustLineLength(line, width, void 0, false);
						buf += segmentsToString(clipped, this.destination);
					}
					buf += "\\x1B[K";
					if (i < drawCount - 1) buf += "\\n";
				}
				this.host.write(buf);
				this.lastLineCount = drawCount;
			}
		};
	})();
	function normalizeEntry(entry) {
		if ("widget" in entry && "placement" in entry) {
			validatePlacement(entry.placement);
			return {
				widget: entry.widget,
				placement: entry.placement
			};
		}
		return {
			widget: entry,
			placement: FLOW
		};
	}
	function validatePlacement(p) {
		if (p.kind !== "fixed") return;
		if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0) throw new RangeError(\`fixed Placement requires non-negative integer x and y; got (\${p.x}, \${p.y})\`);
	}
	function paintLines(lines, widgetLines, x, y) {
		if (widgetLines.length === 0) return;
		while (lines.length < y + widgetLines.length) lines.push([]);
		for (let i = 0; i < widgetLines.length; i++) {
			const target = lines[y + i];
			const source = widgetLines[i];
			const sourceWidth = lineCellLength(source);
			if (sourceWidth === 0) continue;
			if (x === 0 && target.length === 0) {
				lines[y + i] = source.slice();
				continue;
			}
			lines[y + i] = spliceCells(target, asCellCol(x), sourceWidth, source);
		}
	}
	function lineCellLength(line) {
		let total = 0;
		for (const s of line) total += s.cellLength;
		return asCellCol(total);
	}
	function spliceCells(row, start, length, replacement) {
		const rowWidth = lineCellLength(row);
		const padded = row.slice();
		if (rowWidth < start) padded.push(new Segment(" ".repeat(start - rowWidth)));
		const prefix = [];
		const suffix = [];
		let cursor = 0;
		for (const seg of padded) {
			const segEnd = cursor + seg.cellLength;
			if (segEnd <= start) prefix.push(seg);
			else if (cursor >= start + length) suffix.push(seg);
			else {
				if (cursor < start) {
					const [head] = seg.splitCells(asCellCol(start - cursor));
					if (head.hasText) prefix.push(head);
				}
				if (segEnd > start + length) {
					const [, tail] = seg.splitCells(asCellCol(start + length - cursor));
					if (tail.hasText) suffix.push(tail);
				}
			}
			cursor = segEnd;
		}
		return [
			...prefix,
			...replacement,
			...suffix
		];
	}
	//#endregion
	//#region src/widgets/button.ts
	/**
	* Button widget — labeled action trigger with variant styling.
	* [LAW:dataflow-not-control-flow] rendering is a pure function of observable state.
	* [LAW:one-type-per-behavior] shared widget infrastructure lives on WidgetBase.
	*
	* Four visual states:
	*   normal  — variant colors from theme semantic palette (muted)
	*   hover   — full variant accent bg + on-accent fg (WCAG contrast)
	*   focus   — brackets [ label ] surrounding the button
	*   active  — same color pair as hover, plus bold (pressed cue)
	*
	* States compose: active > focus > hover > normal. Active and hover
	* deliberately share colors — active differentiates via bold rather
	* than fg/bg inversion, because inversion produces mostly-accent text
	* on bg-tinted surface, which is unreadable for accents whose contrast
	* partner depends on luminance.
	*/
	var __runInitializers$5 = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var __esDecorate$5 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	var VARIANT_KEYS$1 = {
		default: {
			bg: "surface",
			fg: "foreground",
			hover: "primary",
			hoverFg: "on-primary"
		},
		primary: {
			bg: "primary-muted",
			fg: "text-primary",
			hover: "primary",
			hoverFg: "on-primary"
		},
		success: {
			bg: "success-muted",
			fg: "text-success",
			hover: "success",
			hoverFg: "on-success"
		},
		warning: {
			bg: "warning-muted",
			fg: "text-warning",
			hover: "warning",
			hoverFg: "on-warning"
		},
		danger: {
			bg: "error-muted",
			fg: "text-error",
			hover: "error",
			hoverFg: "on-error"
		}
	};
	var Button = (() => {
		let _classSuper = WidgetBase;
		let _instanceExtraInitializers = [];
		let _label_decorators;
		let _label_initializers = [];
		let _label_extraInitializers = [];
		let _variant_decorators;
		let _variant_initializers = [];
		let _variant_extraInitializers = [];
		let __theme_decorators;
		let __theme_initializers = [];
		let __theme_extraInitializers = [];
		let _setTheme_decorators;
		let _handleKey_decorators;
		let _handleMouse_decorators;
		let _setActive_decorators;
		return class Button extends _classSuper {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
				_label_decorators = [observable];
				_variant_decorators = [observableRef];
				__theme_decorators = [observableRef];
				_setTheme_decorators = [action];
				_handleKey_decorators = [action];
				_handleMouse_decorators = [action];
				_setActive_decorators = [action];
				__esDecorate$5(this, null, _label_decorators, {
					kind: "accessor",
					name: "label",
					static: false,
					private: false,
					access: {
						has: (obj) => "label" in obj,
						get: (obj) => obj.label,
						set: (obj, value) => {
							obj.label = value;
						}
					},
					metadata: _metadata
				}, _label_initializers, _label_extraInitializers);
				__esDecorate$5(this, null, _variant_decorators, {
					kind: "accessor",
					name: "variant",
					static: false,
					private: false,
					access: {
						has: (obj) => "variant" in obj,
						get: (obj) => obj.variant,
						set: (obj, value) => {
							obj.variant = value;
						}
					},
					metadata: _metadata
				}, _variant_initializers, _variant_extraInitializers);
				__esDecorate$5(this, null, __theme_decorators, {
					kind: "accessor",
					name: "_theme",
					static: false,
					private: false,
					access: {
						has: (obj) => "_theme" in obj,
						get: (obj) => obj._theme,
						set: (obj, value) => {
							obj._theme = value;
						}
					},
					metadata: _metadata
				}, __theme_initializers, __theme_extraInitializers);
				__esDecorate$5(this, null, _setTheme_decorators, {
					kind: "method",
					name: "setTheme",
					static: false,
					private: false,
					access: {
						has: (obj) => "setTheme" in obj,
						get: (obj) => obj.setTheme
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$5(this, null, _handleKey_decorators, {
					kind: "method",
					name: "handleKey",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleKey" in obj,
						get: (obj) => obj.handleKey
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$5(this, null, _handleMouse_decorators, {
					kind: "method",
					name: "handleMouse",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleMouse" in obj,
						get: (obj) => obj.handleMouse
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$5(this, null, _setActive_decorators, {
					kind: "method",
					name: "setActive",
					static: false,
					private: false,
					access: {
						has: (obj) => "setActive" in obj,
						get: (obj) => obj.setActive
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			id = __runInitializers$5(this, _instanceExtraInitializers);
			focusable = true;
			#label_accessor_storage = __runInitializers$5(this, _label_initializers, void 0);
			get label() {
				return this.#label_accessor_storage;
			}
			set label(value) {
				this.#label_accessor_storage = value;
			}
			#variant_accessor_storage = (__runInitializers$5(this, _label_extraInitializers), __runInitializers$5(this, _variant_initializers, void 0));
			get variant() {
				return this.#variant_accessor_storage;
			}
			set variant(value) {
				this.#variant_accessor_storage = value;
			}
			#_theme_accessor_storage = (__runInitializers$5(this, _variant_extraInitializers), __runInitializers$5(this, __theme_initializers, void 0));
			get _theme() {
				return this.#_theme_accessor_storage;
			}
			set _theme(value) {
				this.#_theme_accessor_storage = value;
			}
			constructor(options) {
				super();
				__runInitializers$5(this, __theme_extraInitializers);
				this.id = options.id ?? \`button-\${options.label.toLowerCase().replace(/\\s+/g, "-")}\`;
				this.label = options.label;
				this.variant = options.variant ?? "default";
				this.disabled = options.disabled ?? false;
				this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
			}
			setTheme(theme) {
				this._theme = theme;
			}
			handleKey(event) {
				if (this.disabled) return;
				if (event.key === "enter" || event.key === "space") {
					this.active = true;
					this.emitSubmit();
					queueMicrotask(() => {
						if (this.active) this.setActive(false);
					});
					event.stop();
				}
			}
			handleMouse(event) {
				if (this.disabled) return;
				if (event.type === "mouse_down") this.active = true;
				if (event.type === "mouse_up") {
					if (this.active) {
						this.active = false;
						this.emitSubmit();
					}
				}
			}
			setActive(value) {
				this.active = value;
			}
			render(_options) {
				const focused = this.focused;
				const left = focused ? "[" : " ";
				const right = focused ? "]" : " ";
				const text = \`\${left} \${this.label} \${right}\`;
				if (this.disabled) return [new Segment(text, new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}))];
				if (this.active || this.hovered) return [new Segment(text, new Style({
					color: this.resolvePalette(VARIANT_KEYS$1[this.variant].hoverFg),
					bgcolor: this.resolvePalette(VARIANT_KEYS$1[this.variant].hover),
					bold: this.active
				}))];
				const { fg, bg } = this.resolveColors("bg");
				return [new Segment(text, new Style({
					color: fg,
					bgcolor: bg
				}))];
			}
			measure(_options) {
				const width = cellLen(this.label) + 4;
				return {
					minimum: width,
					maximum: width
				};
			}
			resolveColors(bgKey) {
				const keys = VARIANT_KEYS$1[this.variant];
				return {
					fg: this.resolvePalette(keys.fg),
					bg: this.resolvePalette(bgKey === "hover" ? keys.hover : keys.bg)
				};
			}
			resolvePalette(key) {
				const rgba = this._theme.palette.get(key);
				return ColorSpec.fromRgba(rgba);
			}
		};
	})();
	//#endregion
	//#region src/widgets/checkbox.ts
	/**
	* Checkbox widget — boolean toggle with label.
	* [LAW:dataflow-not-control-flow] one Segment of fixed width every render;
	* the indicator character and style come from observable state.
	* [LAW:one-type-per-behavior] shared widget infrastructure lives on WidgetBase.
	*
	* Visual states:
	*   unchecked — "[ ] label"
	*   checked   — "[✓] label"  (ASCII fallback "[x] label" when options.asciiOnly)
	*   focused   — underline on the rendered segment (no width change)
	*   disabled  — dimmed
	*/
	var __runInitializers$4 = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var __esDecorate$4 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	var Checkbox = (() => {
		let _classSuper = WidgetBase;
		let _instanceExtraInitializers = [];
		let _label_decorators;
		let _label_initializers = [];
		let _label_extraInitializers = [];
		let _checked_decorators;
		let _checked_initializers = [];
		let _checked_extraInitializers = [];
		let __theme_decorators;
		let __theme_initializers = [];
		let __theme_extraInitializers = [];
		let _setTheme_decorators;
		let _handleKey_decorators;
		let _handleMouse_decorators;
		return class Checkbox extends _classSuper {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
				_label_decorators = [observable];
				_checked_decorators = [observable];
				__theme_decorators = [observableRef];
				_setTheme_decorators = [action];
				_handleKey_decorators = [action];
				_handleMouse_decorators = [action];
				__esDecorate$4(this, null, _label_decorators, {
					kind: "accessor",
					name: "label",
					static: false,
					private: false,
					access: {
						has: (obj) => "label" in obj,
						get: (obj) => obj.label,
						set: (obj, value) => {
							obj.label = value;
						}
					},
					metadata: _metadata
				}, _label_initializers, _label_extraInitializers);
				__esDecorate$4(this, null, _checked_decorators, {
					kind: "accessor",
					name: "checked",
					static: false,
					private: false,
					access: {
						has: (obj) => "checked" in obj,
						get: (obj) => obj.checked,
						set: (obj, value) => {
							obj.checked = value;
						}
					},
					metadata: _metadata
				}, _checked_initializers, _checked_extraInitializers);
				__esDecorate$4(this, null, __theme_decorators, {
					kind: "accessor",
					name: "_theme",
					static: false,
					private: false,
					access: {
						has: (obj) => "_theme" in obj,
						get: (obj) => obj._theme,
						set: (obj, value) => {
							obj._theme = value;
						}
					},
					metadata: _metadata
				}, __theme_initializers, __theme_extraInitializers);
				__esDecorate$4(this, null, _setTheme_decorators, {
					kind: "method",
					name: "setTheme",
					static: false,
					private: false,
					access: {
						has: (obj) => "setTheme" in obj,
						get: (obj) => obj.setTheme
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$4(this, null, _handleKey_decorators, {
					kind: "method",
					name: "handleKey",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleKey" in obj,
						get: (obj) => obj.handleKey
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$4(this, null, _handleMouse_decorators, {
					kind: "method",
					name: "handleMouse",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleMouse" in obj,
						get: (obj) => obj.handleMouse
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			id = __runInitializers$4(this, _instanceExtraInitializers);
			focusable = true;
			#label_accessor_storage = __runInitializers$4(this, _label_initializers, void 0);
			get label() {
				return this.#label_accessor_storage;
			}
			set label(value) {
				this.#label_accessor_storage = value;
			}
			#checked_accessor_storage = (__runInitializers$4(this, _label_extraInitializers), __runInitializers$4(this, _checked_initializers, void 0));
			get checked() {
				return this.#checked_accessor_storage;
			}
			set checked(value) {
				this.#checked_accessor_storage = value;
			}
			#_theme_accessor_storage = (__runInitializers$4(this, _checked_extraInitializers), __runInitializers$4(this, __theme_initializers, void 0));
			get _theme() {
				return this.#_theme_accessor_storage;
			}
			set _theme(value) {
				this.#_theme_accessor_storage = value;
			}
			constructor(options) {
				super();
				__runInitializers$4(this, __theme_extraInitializers);
				this.id = options.id ?? \`checkbox-\${options.label.toLowerCase().replace(/\\s+/g, "-")}\`;
				this.label = options.label;
				this.checked = options.checked ?? false;
				this.disabled = options.disabled ?? false;
				this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
			}
			setTheme(theme) {
				this._theme = theme;
			}
			handleKey(event) {
				if (this.disabled) return;
				if (event.key === "space") {
					this.checked = !this.checked;
					this.emitChange();
					event.stop();
					return;
				}
				if (event.key === "enter") {
					this.emitSubmit();
					event.stop();
				}
			}
			handleMouse(event) {
				if (this.disabled) return;
				if (event.type === "mouse_up") {
					this.checked = !this.checked;
					this.emitChange();
				}
			}
			render(options) {
				const text = \`[\${this.checked ? options.asciiOnly ? "x" : "✓" : " "}] \${this.label}\`;
				if (this.disabled) return [new Segment(text, new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}))];
				return [new Segment(text, new Style({
					color: this.checked ? this.resolvePalette("primary") : this.resolvePalette("foreground"),
					underline: this.focused
				}))];
			}
			measure(_options) {
				const width = cellLen(this.label) + 4;
				return {
					minimum: width,
					maximum: width
				};
			}
			resolvePalette(key) {
				const rgba = this._theme.palette.get(key);
				return ColorSpec.fromRgba(rgba);
			}
		};
	})();
	//#endregion
	//#region src/widgets/toggle.ts
	/**
	* Toggle widget — on/off switch with label and variant colour.
	* [LAW:dataflow-not-control-flow] one Segment of fixed width every render;
	* indicator and palette keys come from observable state via lookup tables.
	* [LAW:one-type-per-behavior] shared infrastructure inherited from WidgetBase.
	*
	* Visual states:
	*   off       — "[OFF] label" with muted variant background
	*   on        — "[ON]  label" with full variant accent background
	*   focused   — underline on the segment (no width change)
	*   disabled  — dimmed
	*/
	var __runInitializers$3 = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var __esDecorate$3 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	var VARIANT_KEYS = {
		default: {
			onBg: "primary",
			onFg: "on-primary",
			offBg: "surface",
			offFg: "foreground"
		},
		primary: {
			onBg: "primary",
			onFg: "on-primary",
			offBg: "primary-muted",
			offFg: "text-primary"
		},
		success: {
			onBg: "success",
			onFg: "on-success",
			offBg: "success-muted",
			offFg: "text-success"
		},
		warning: {
			onBg: "warning",
			onFg: "on-warning",
			offBg: "warning-muted",
			offFg: "text-warning"
		},
		danger: {
			onBg: "error",
			onFg: "on-error",
			offBg: "error-muted",
			offFg: "text-error"
		}
	};
	var Toggle = (() => {
		let _classSuper = WidgetBase;
		let _instanceExtraInitializers = [];
		let _label_decorators;
		let _label_initializers = [];
		let _label_extraInitializers = [];
		let _on_decorators;
		let _on_initializers = [];
		let _on_extraInitializers = [];
		let _variant_decorators;
		let _variant_initializers = [];
		let _variant_extraInitializers = [];
		let __theme_decorators;
		let __theme_initializers = [];
		let __theme_extraInitializers = [];
		let _setTheme_decorators;
		let _handleKey_decorators;
		let _handleMouse_decorators;
		return class Toggle extends _classSuper {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
				_label_decorators = [observable];
				_on_decorators = [observable];
				_variant_decorators = [observableRef];
				__theme_decorators = [observableRef];
				_setTheme_decorators = [action];
				_handleKey_decorators = [action];
				_handleMouse_decorators = [action];
				__esDecorate$3(this, null, _label_decorators, {
					kind: "accessor",
					name: "label",
					static: false,
					private: false,
					access: {
						has: (obj) => "label" in obj,
						get: (obj) => obj.label,
						set: (obj, value) => {
							obj.label = value;
						}
					},
					metadata: _metadata
				}, _label_initializers, _label_extraInitializers);
				__esDecorate$3(this, null, _on_decorators, {
					kind: "accessor",
					name: "on",
					static: false,
					private: false,
					access: {
						has: (obj) => "on" in obj,
						get: (obj) => obj.on,
						set: (obj, value) => {
							obj.on = value;
						}
					},
					metadata: _metadata
				}, _on_initializers, _on_extraInitializers);
				__esDecorate$3(this, null, _variant_decorators, {
					kind: "accessor",
					name: "variant",
					static: false,
					private: false,
					access: {
						has: (obj) => "variant" in obj,
						get: (obj) => obj.variant,
						set: (obj, value) => {
							obj.variant = value;
						}
					},
					metadata: _metadata
				}, _variant_initializers, _variant_extraInitializers);
				__esDecorate$3(this, null, __theme_decorators, {
					kind: "accessor",
					name: "_theme",
					static: false,
					private: false,
					access: {
						has: (obj) => "_theme" in obj,
						get: (obj) => obj._theme,
						set: (obj, value) => {
							obj._theme = value;
						}
					},
					metadata: _metadata
				}, __theme_initializers, __theme_extraInitializers);
				__esDecorate$3(this, null, _setTheme_decorators, {
					kind: "method",
					name: "setTheme",
					static: false,
					private: false,
					access: {
						has: (obj) => "setTheme" in obj,
						get: (obj) => obj.setTheme
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$3(this, null, _handleKey_decorators, {
					kind: "method",
					name: "handleKey",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleKey" in obj,
						get: (obj) => obj.handleKey
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$3(this, null, _handleMouse_decorators, {
					kind: "method",
					name: "handleMouse",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleMouse" in obj,
						get: (obj) => obj.handleMouse
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			id = __runInitializers$3(this, _instanceExtraInitializers);
			focusable = true;
			#label_accessor_storage = __runInitializers$3(this, _label_initializers, void 0);
			get label() {
				return this.#label_accessor_storage;
			}
			set label(value) {
				this.#label_accessor_storage = value;
			}
			#on_accessor_storage = (__runInitializers$3(this, _label_extraInitializers), __runInitializers$3(this, _on_initializers, void 0));
			get on() {
				return this.#on_accessor_storage;
			}
			set on(value) {
				this.#on_accessor_storage = value;
			}
			#variant_accessor_storage = (__runInitializers$3(this, _on_extraInitializers), __runInitializers$3(this, _variant_initializers, void 0));
			get variant() {
				return this.#variant_accessor_storage;
			}
			set variant(value) {
				this.#variant_accessor_storage = value;
			}
			#_theme_accessor_storage = (__runInitializers$3(this, _variant_extraInitializers), __runInitializers$3(this, __theme_initializers, void 0));
			get _theme() {
				return this.#_theme_accessor_storage;
			}
			set _theme(value) {
				this.#_theme_accessor_storage = value;
			}
			constructor(options) {
				super();
				__runInitializers$3(this, __theme_extraInitializers);
				this.id = options.id ?? \`toggle-\${options.label.toLowerCase().replace(/\\s+/g, "-")}\`;
				this.label = options.label;
				this.on = options.on ?? false;
				this.variant = options.variant ?? "default";
				this.disabled = options.disabled ?? false;
				this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
			}
			setTheme(theme) {
				this._theme = theme;
			}
			handleKey(event) {
				if (this.disabled) return;
				if (event.key === "space") {
					this.on = !this.on;
					this.emitChange();
					event.stop();
					return;
				}
				if (event.key === "enter") {
					this.emitSubmit();
					event.stop();
				}
			}
			handleMouse(event) {
				if (this.disabled) return;
				if (event.type === "mouse_up") {
					this.on = !this.on;
					this.emitChange();
				}
			}
			render(_options) {
				const text = \`\${this.on ? "[ON] " : "[OFF]"} \${this.label}\`;
				if (this.disabled) return [new Segment(text, new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}))];
				const keys = VARIANT_KEYS[this.variant];
				return [new Segment(text, new Style({
					color: this.resolvePalette(this.on ? keys.onFg : keys.offFg),
					bgcolor: this.resolvePalette(this.on ? keys.onBg : keys.offBg),
					underline: this.focused
				}))];
			}
			measure(_options) {
				const width = 6 + cellLen(this.label);
				return {
					minimum: width,
					maximum: width
				};
			}
			resolvePalette(key) {
				const rgba = this._theme.palette.get(key);
				return ColorSpec.fromRgba(rgba);
			}
		};
	})();
	//#endregion
	//#region src/widgets/text-input.ts
	/**
	* TextInput widget — editable text field with cursor.
	*
	* Two modes:
	*   - single-line (default): Enter submits; newlines in value are rendered
	*                            as a literal \`↵\` glyph if they ever appear.
	*   - multi-line  (\`multiline: true\`): Enter inserts a \`\\n\`; \`value\` may
	*                            contain logical line breaks; Up/Down navigate
	*                            between logical lines preserving column intent.
	*
	* [LAW:dataflow-not-control-flow] cursor and value are observable data; the
	* keymap dispatches to small \`@action\` mutators that all flow through the
	* same value/cursor update path. There is no per-key bespoke branch in the
	* render loop or the change-emit path.
	*
	* [LAW:one-source-of-truth] The cursor's logical line — and therefore "what
	* Home/End/Up/Down mean" — is derived from \`value\` and \`cursorPosition\` via
	* \`_lineStart()\` / \`_lineEnd()\`. Multi-line behavior is the same code path
	* as single-line; with no \`\\n\` in \`value\`, line bounds collapse to value
	* bounds, so single-line semantics are recovered without a special case.
	*
	* [LAW:types-are-the-program] Three integer spaces coexist: \`CellCol\` (terminal
	* cell columns), \`CodeUnit\` (JS UTF-16 indices), and \`CodePoint\` (code-unit
	* offsets that are additionally on a Unicode code-point boundary — a subtype of
	* \`CodeUnit\`). \`cursorPosition\` is \`CodePoint\`; it is never inside a surrogate
	* pair by construction. Visual positions are \`CellCol\`. The three are never
	* interchangeable — the type system enforces this at every crossing point.
	*
	* Keymap (readline / emacs compatible):
	*
	*   ─── motion ───
	*   left | Ctrl+B               char left
	*   right | Ctrl+F              char right
	*   up | Ctrl+P                 line up   (preserves preferred column)
	*   down | Ctrl+N               line down (preserves preferred column)
	*   home | Ctrl+A               line start
	*   end | Ctrl+E                line end
	*   Ctrl+Home                   document start
	*   Ctrl+End                    document end
	*   Ctrl+Left | Alt+Left | Alt+B   word left
	*   Ctrl+Right | Alt+Right | Alt+F word right
	*
	*   ─── editing ───
	*   backspace | Ctrl+H          delete char back
	*   delete | Ctrl+D             delete char forward
	*   Ctrl+W | Alt+Backspace      delete word back  (whitespace-bounded; readline parity)
	*   Alt+D                       delete word forward
	*   Ctrl+U                      kill to line start (stores in kill buffer)
	*   Ctrl+K                      kill to line end   (stores in kill buffer)
	*   Ctrl+Y                      yank kill buffer at cursor
	*   Ctrl+T                      transpose chars (swap pre-cursor/at-cursor, advance)
	*   enter                       submit (single-line) or insert \`\\n\` (multiline)
	*
	* Motion and editing primitives are also exposed as public methods
	* (\`moveCharLeft\`, \`killLineForward\`, etc.) so a host can bind custom keys
	* or invoke them programmatically.
	*/
	var __runInitializers$2 = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var __esDecorate$2 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	/**
	* Character-greedy soft wrap. Breaks at any character once \`firstWidth\`
	* (or \`continuationWidth\` for continuation rows) cells are exhausted. The
	* textarea default when a consumer says "wrap, I don't care how" — no syntax
	* awareness, just fits the line to the width.
	*
	* Wide characters (CJK, emoji) are treated as atomic: a char that would
	* straddle the budget is moved to the next row rather than split, and one too
	* wide for the whole budget is force-taken — see \`cellStepFrom\`.
	*/
	var charGreedyWrap = (line, { firstWidth, continuationWidth }) => {
		if (line.length === 0) return [{
			content: "",
			start: asCodePoint(0)
		}];
		const rows = [];
		let pos = asCodePoint(0);
		let isFirst = true;
		while (pos < line.length) {
			const cap = isFirst ? firstWidth : continuationWidth;
			if (cap <= 0) break;
			const end = cellStepFrom(line, pos, cap);
			rows.push({
				content: line.slice(pos, end),
				start: pos
			});
			pos = end;
			isFirst = false;
		}
		return rows;
	};
	var MIN_CONTENT_WIDTH = 8;
	var NEWLINE_GLYPH = "↵";
	var WORD_CHAR_RE = /[A-Za-z0-9_]/;
	var WHITESPACE_RE = /\\s/;
	function isWordChar(c) {
		return c !== void 0 && WORD_CHAR_RE.test(c);
	}
	function isWhitespace(c) {
		return c !== void 0 && WHITESPACE_RE.test(c);
	}
	var TextInput = (() => {
		let _classSuper = WidgetBase;
		let _instanceExtraInitializers = [];
		let _value_decorators;
		let _value_initializers = [];
		let _value_extraInitializers = [];
		let _cursorPosition_decorators;
		let _cursorPosition_initializers = [];
		let _cursorPosition_extraInitializers = [];
		let _placeholder_decorators;
		let _placeholder_initializers = [];
		let _placeholder_extraInitializers = [];
		let _indicatorStyleOverride_decorators;
		let _indicatorStyleOverride_initializers = [];
		let _indicatorStyleOverride_extraInitializers = [];
		let _cursorStyleOverride_decorators;
		let _cursorStyleOverride_initializers = [];
		let _cursorStyleOverride_extraInitializers = [];
		let _contentStyleOverride_decorators;
		let _contentStyleOverride_initializers = [];
		let _contentStyleOverride_extraInitializers = [];
		let _handleKey_decorators;
		let _handleMouse_decorators;
		let _setHovered_decorators;
		let _moveCharLeft_decorators;
		let _moveCharRight_decorators;
		let _moveLineUp_decorators;
		let _moveLineDown_decorators;
		let _moveLineStart_decorators;
		let _moveLineEnd_decorators;
		let _moveDocStart_decorators;
		let _moveDocEnd_decorators;
		let _moveWordLeft_decorators;
		let _moveWordRight_decorators;
		let _deleteCharBack_decorators;
		let _deleteCharForward_decorators;
		let _deleteWordBack_decorators;
		let _deleteWordForward_decorators;
		let _killLineBack_decorators;
		let _killLineForward_decorators;
		let _yank_decorators;
		let _transposeChars_decorators;
		let __insertText_decorators;
		return class TextInput extends _classSuper {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
				_value_decorators = [observable];
				_cursorPosition_decorators = [observable];
				_placeholder_decorators = [observableRef];
				_indicatorStyleOverride_decorators = [observableRef];
				_cursorStyleOverride_decorators = [observableRef];
				_contentStyleOverride_decorators = [observableRef];
				_handleKey_decorators = [action];
				_handleMouse_decorators = [action];
				_setHovered_decorators = [action];
				_moveCharLeft_decorators = [action];
				_moveCharRight_decorators = [action];
				_moveLineUp_decorators = [action];
				_moveLineDown_decorators = [action];
				_moveLineStart_decorators = [action];
				_moveLineEnd_decorators = [action];
				_moveDocStart_decorators = [action];
				_moveDocEnd_decorators = [action];
				_moveWordLeft_decorators = [action];
				_moveWordRight_decorators = [action];
				_deleteCharBack_decorators = [action];
				_deleteCharForward_decorators = [action];
				_deleteWordBack_decorators = [action];
				_deleteWordForward_decorators = [action];
				_killLineBack_decorators = [action];
				_killLineForward_decorators = [action];
				_yank_decorators = [action];
				_transposeChars_decorators = [action];
				__insertText_decorators = [action];
				__esDecorate$2(this, null, _value_decorators, {
					kind: "accessor",
					name: "value",
					static: false,
					private: false,
					access: {
						has: (obj) => "value" in obj,
						get: (obj) => obj.value,
						set: (obj, value) => {
							obj.value = value;
						}
					},
					metadata: _metadata
				}, _value_initializers, _value_extraInitializers);
				__esDecorate$2(this, null, _cursorPosition_decorators, {
					kind: "accessor",
					name: "cursorPosition",
					static: false,
					private: false,
					access: {
						has: (obj) => "cursorPosition" in obj,
						get: (obj) => obj.cursorPosition,
						set: (obj, value) => {
							obj.cursorPosition = value;
						}
					},
					metadata: _metadata
				}, _cursorPosition_initializers, _cursorPosition_extraInitializers);
				__esDecorate$2(this, null, _placeholder_decorators, {
					kind: "accessor",
					name: "placeholder",
					static: false,
					private: false,
					access: {
						has: (obj) => "placeholder" in obj,
						get: (obj) => obj.placeholder,
						set: (obj, value) => {
							obj.placeholder = value;
						}
					},
					metadata: _metadata
				}, _placeholder_initializers, _placeholder_extraInitializers);
				__esDecorate$2(this, null, _indicatorStyleOverride_decorators, {
					kind: "accessor",
					name: "indicatorStyleOverride",
					static: false,
					private: false,
					access: {
						has: (obj) => "indicatorStyleOverride" in obj,
						get: (obj) => obj.indicatorStyleOverride,
						set: (obj, value) => {
							obj.indicatorStyleOverride = value;
						}
					},
					metadata: _metadata
				}, _indicatorStyleOverride_initializers, _indicatorStyleOverride_extraInitializers);
				__esDecorate$2(this, null, _cursorStyleOverride_decorators, {
					kind: "accessor",
					name: "cursorStyleOverride",
					static: false,
					private: false,
					access: {
						has: (obj) => "cursorStyleOverride" in obj,
						get: (obj) => obj.cursorStyleOverride,
						set: (obj, value) => {
							obj.cursorStyleOverride = value;
						}
					},
					metadata: _metadata
				}, _cursorStyleOverride_initializers, _cursorStyleOverride_extraInitializers);
				__esDecorate$2(this, null, _contentStyleOverride_decorators, {
					kind: "accessor",
					name: "contentStyleOverride",
					static: false,
					private: false,
					access: {
						has: (obj) => "contentStyleOverride" in obj,
						get: (obj) => obj.contentStyleOverride,
						set: (obj, value) => {
							obj.contentStyleOverride = value;
						}
					},
					metadata: _metadata
				}, _contentStyleOverride_initializers, _contentStyleOverride_extraInitializers);
				__esDecorate$2(this, null, _handleKey_decorators, {
					kind: "method",
					name: "handleKey",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleKey" in obj,
						get: (obj) => obj.handleKey
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _handleMouse_decorators, {
					kind: "method",
					name: "handleMouse",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleMouse" in obj,
						get: (obj) => obj.handleMouse
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _setHovered_decorators, {
					kind: "method",
					name: "setHovered",
					static: false,
					private: false,
					access: {
						has: (obj) => "setHovered" in obj,
						get: (obj) => obj.setHovered
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveCharLeft_decorators, {
					kind: "method",
					name: "moveCharLeft",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveCharLeft" in obj,
						get: (obj) => obj.moveCharLeft
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveCharRight_decorators, {
					kind: "method",
					name: "moveCharRight",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveCharRight" in obj,
						get: (obj) => obj.moveCharRight
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveLineUp_decorators, {
					kind: "method",
					name: "moveLineUp",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveLineUp" in obj,
						get: (obj) => obj.moveLineUp
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveLineDown_decorators, {
					kind: "method",
					name: "moveLineDown",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveLineDown" in obj,
						get: (obj) => obj.moveLineDown
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveLineStart_decorators, {
					kind: "method",
					name: "moveLineStart",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveLineStart" in obj,
						get: (obj) => obj.moveLineStart
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveLineEnd_decorators, {
					kind: "method",
					name: "moveLineEnd",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveLineEnd" in obj,
						get: (obj) => obj.moveLineEnd
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveDocStart_decorators, {
					kind: "method",
					name: "moveDocStart",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveDocStart" in obj,
						get: (obj) => obj.moveDocStart
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveDocEnd_decorators, {
					kind: "method",
					name: "moveDocEnd",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveDocEnd" in obj,
						get: (obj) => obj.moveDocEnd
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveWordLeft_decorators, {
					kind: "method",
					name: "moveWordLeft",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveWordLeft" in obj,
						get: (obj) => obj.moveWordLeft
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _moveWordRight_decorators, {
					kind: "method",
					name: "moveWordRight",
					static: false,
					private: false,
					access: {
						has: (obj) => "moveWordRight" in obj,
						get: (obj) => obj.moveWordRight
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _deleteCharBack_decorators, {
					kind: "method",
					name: "deleteCharBack",
					static: false,
					private: false,
					access: {
						has: (obj) => "deleteCharBack" in obj,
						get: (obj) => obj.deleteCharBack
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _deleteCharForward_decorators, {
					kind: "method",
					name: "deleteCharForward",
					static: false,
					private: false,
					access: {
						has: (obj) => "deleteCharForward" in obj,
						get: (obj) => obj.deleteCharForward
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _deleteWordBack_decorators, {
					kind: "method",
					name: "deleteWordBack",
					static: false,
					private: false,
					access: {
						has: (obj) => "deleteWordBack" in obj,
						get: (obj) => obj.deleteWordBack
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _deleteWordForward_decorators, {
					kind: "method",
					name: "deleteWordForward",
					static: false,
					private: false,
					access: {
						has: (obj) => "deleteWordForward" in obj,
						get: (obj) => obj.deleteWordForward
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _killLineBack_decorators, {
					kind: "method",
					name: "killLineBack",
					static: false,
					private: false,
					access: {
						has: (obj) => "killLineBack" in obj,
						get: (obj) => obj.killLineBack
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _killLineForward_decorators, {
					kind: "method",
					name: "killLineForward",
					static: false,
					private: false,
					access: {
						has: (obj) => "killLineForward" in obj,
						get: (obj) => obj.killLineForward
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _yank_decorators, {
					kind: "method",
					name: "yank",
					static: false,
					private: false,
					access: {
						has: (obj) => "yank" in obj,
						get: (obj) => obj.yank
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, _transposeChars_decorators, {
					kind: "method",
					name: "transposeChars",
					static: false,
					private: false,
					access: {
						has: (obj) => "transposeChars" in obj,
						get: (obj) => obj.transposeChars
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$2(this, null, __insertText_decorators, {
					kind: "method",
					name: "_insertText",
					static: false,
					private: false,
					access: {
						has: (obj) => "_insertText" in obj,
						get: (obj) => obj._insertText
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			id = __runInitializers$2(this, _instanceExtraInitializers);
			focusable = true;
			#value_accessor_storage = __runInitializers$2(this, _value_initializers, void 0);
			get value() {
				return this.#value_accessor_storage;
			}
			set value(value) {
				this.#value_accessor_storage = value;
			}
			#cursorPosition_accessor_storage = (__runInitializers$2(this, _value_extraInitializers), __runInitializers$2(this, _cursorPosition_initializers, void 0));
			get cursorPosition() {
				return this.#cursorPosition_accessor_storage;
			}
			set cursorPosition(value) {
				this.#cursorPosition_accessor_storage = value;
			}
			#placeholder_accessor_storage = (__runInitializers$2(this, _cursorPosition_extraInitializers), __runInitializers$2(this, _placeholder_initializers, void 0));
			get placeholder() {
				return this.#placeholder_accessor_storage;
			}
			set placeholder(value) {
				this.#placeholder_accessor_storage = value;
			}
			_theme = __runInitializers$2(this, _placeholder_extraInitializers);
			_maxLength;
			_password;
			_multiline;
			_wrap;
			_continuationMarker;
			_markerWidth;
			_maxRows;
			_minRows;
			_scrollIndicator;
			#indicatorStyleOverride_accessor_storage = __runInitializers$2(this, _indicatorStyleOverride_initializers, void 0);
			get indicatorStyleOverride() {
				return this.#indicatorStyleOverride_accessor_storage;
			}
			set indicatorStyleOverride(value) {
				this.#indicatorStyleOverride_accessor_storage = value;
			}
			#cursorStyleOverride_accessor_storage = (__runInitializers$2(this, _indicatorStyleOverride_extraInitializers), __runInitializers$2(this, _cursorStyleOverride_initializers, void 0));
			get cursorStyleOverride() {
				return this.#cursorStyleOverride_accessor_storage;
			}
			set cursorStyleOverride(value) {
				this.#cursorStyleOverride_accessor_storage = value;
			}
			#contentStyleOverride_accessor_storage = (__runInitializers$2(this, _cursorStyleOverride_extraInitializers), __runInitializers$2(this, _contentStyleOverride_initializers, void 0));
			get contentStyleOverride() {
				return this.#contentStyleOverride_accessor_storage;
			}
			set contentStyleOverride(value) {
				this.#contentStyleOverride_accessor_storage = value;
			}
			/**
			* Last computed visual-row decomposition. Cached at the end of \`render()\`
			* so vertical motion (Up/Down) can step row-by-row without re-running the
			* wrap strategy. Null before the first render — vertical motion falls
			* back to logical-line motion in that case.
			*
			* [LAW:dataflow-not-control-flow] One source of truth for "what does Up
			* mean right now": the row table the renderer just produced. No parallel
			* "where would the cursor go" math; both the renderer and the keymap
			* read from the same array.
			*/
			_visualRows = (__runInitializers$2(this, _contentStyleOverride_extraInitializers), null);
			_preferredColumn = null;
			_killBuffer = "";
			_scrollStart = 0;
			_singleLineViewportStart = asCellCol(0);
			multiline;
			constructor(options = {}) {
				super();
				this.id = options.id ?? \`text-input-\${Math.random().toString(36).slice(2, 8)}\`;
				this.value = options.value ?? "";
				this.placeholder = options.placeholder ?? "";
				this.cursorPosition = options.multiline ?? false ? asCodePoint(0) : asCodePoint(this.value.length);
				this.disabled = options.disabled ?? false;
				this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
				this._maxLength = options.maxLength;
				this._password = options.password ?? false;
				this._multiline = options.multiline ?? false;
				this._wrap = options.wrap;
				this._continuationMarker = options.continuationMarker ?? "↳ ";
				this._markerWidth = asCellCol(cellLen(this._continuationMarker));
				this._maxRows = options.maxRows;
				this._minRows = options.minRows;
				this._scrollIndicator = options.scrollIndicator ?? "arrows";
				this.indicatorStyleOverride = options.indicatorStyle;
				this.cursorStyleOverride = options.cursorStyle;
				this.contentStyleOverride = options.contentStyle;
				this.multiline = this._multiline;
			}
			setTheme(theme) {
				this._theme = theme;
			}
			handleKey(event) {
				if (this.disabled) return;
				if (event.key === "backspace") {
					if (event.meta || event.ctrl) this.deleteWordBack();
					else this.deleteCharBack();
					event.stop();
					return;
				}
				if (event.key === "delete") {
					this.deleteCharForward();
					event.stop();
					return;
				}
				if (event.key === "enter") {
					if (this._multiline && !event.ctrl) this._insertText("\\n");
					else this.emitSubmit();
					event.stop();
					return;
				}
				if (event.key === "escape") return;
				if (!event.ctrl && !event.meta) switch (event.key) {
					case "left":
						this.moveCharLeft();
						event.stop();
						return;
					case "right":
						this.moveCharRight();
						event.stop();
						return;
					case "up":
						this.moveLineUp();
						event.stop();
						return;
					case "down":
						this.moveLineDown();
						event.stop();
						return;
					case "home":
						this.moveLineStart();
						event.stop();
						return;
					case "end":
						this.moveLineEnd();
						event.stop();
						return;
				}
				if (event.ctrl && !event.meta) switch (event.key) {
					case "left":
						this.moveWordLeft();
						event.stop();
						return;
					case "right":
						this.moveWordRight();
						event.stop();
						return;
					case "home":
						this.moveDocStart();
						event.stop();
						return;
					case "end":
						this.moveDocEnd();
						event.stop();
						return;
					case "a":
						this.moveLineStart();
						event.stop();
						return;
					case "e":
						this.moveLineEnd();
						event.stop();
						return;
					case "b":
						this.moveCharLeft();
						event.stop();
						return;
					case "f":
						this.moveCharRight();
						event.stop();
						return;
					case "p":
						this.moveLineUp();
						event.stop();
						return;
					case "n":
						this.moveLineDown();
						event.stop();
						return;
					case "d":
						this.deleteCharForward();
						event.stop();
						return;
					case "h":
						this.deleteCharBack();
						event.stop();
						return;
					case "w":
						this.deleteWordBack();
						event.stop();
						return;
					case "u":
						this.killLineBack();
						event.stop();
						return;
					case "k":
						this.killLineForward();
						event.stop();
						return;
					case "y":
						this.yank();
						event.stop();
						return;
					case "t":
						this.transposeChars();
						event.stop();
						return;
				}
				if (event.meta && !event.ctrl) switch (event.key) {
					case "left":
						this.moveWordLeft();
						event.stop();
						return;
					case "right":
						this.moveWordRight();
						event.stop();
						return;
					case "b":
						this.moveWordLeft();
						event.stop();
						return;
					case "f":
						this.moveWordRight();
						event.stop();
						return;
					case "d":
						this.deleteWordForward();
						event.stop();
						return;
				}
				if (event.character.length === 1 && !event.ctrl && !event.meta && event.character >= " " && event.character !== "") {
					this._insertText(event.character);
					event.stop();
				}
			}
			handleMouse(event) {
				if (this.disabled) return;
				if (event.type !== "mouse_down") return;
				const b = this.bounds;
				if (!b) return;
				if (this._multiline) {
					const rows = this._visualRows;
					if (!rows || rows.length === 0) return;
					const relY = event.y - b.y;
					const rawRowIdx = this._scrollStart + relY;
					if (rawRowIdx >= rows.length) {
						this.cursorPosition = asCodePoint(this.value.length);
						this._preferredColumn = null;
						return;
					}
					const row = rows[Math.max(0, rawRowIdx)];
					const contentXOff = asCellCol(row.isContinuation ? this._markerWidth : 0);
					const relX = asCellCol(Math.max(0, event.x - b.x - contentXOff));
					const pos = cellColToCodeUnitOffset(row.content, relX);
					const absPos = row.valueStart + pos;
					const chu = absPos < this.value.length ? this.value.charCodeAt(absPos) : 0;
					const prevChu = absPos > 0 ? this.value.charCodeAt(absPos - 1) : 0;
					this.cursorPosition = asCodePoint(chu >= 56320 && chu <= 57343 && prevChu >= 55296 && prevChu <= 56319 ? absPos + 1 : absPos);
				} else {
					const relX = asCellCol(Math.max(0, event.x - b.x - 1) + this._singleLineViewportStart);
					const pos = cellColToCodeUnitOffset(this._password ? "•".repeat(this.value.length) : this.value.indexOf("\\n") >= 0 ? this.value.replace(/\\n/g, NEWLINE_GLYPH) : this.value, relX);
					const chu = pos < this.value.length ? this.value.charCodeAt(pos) : 0;
					const prevChu = pos > 0 ? this.value.charCodeAt(pos - 1) : 0;
					this.cursorPosition = asCodePoint(chu >= 56320 && chu <= 57343 && prevChu >= 55296 && prevChu <= 56319 ? pos + 1 : pos);
				}
				this._preferredColumn = null;
			}
			setHovered(value) {
				this.hovered = value;
			}
			moveCharLeft() {
				this.cursorPosition = prevCodePoint(this.value, this.cursorPosition);
				this._preferredColumn = null;
			}
			moveCharRight() {
				this.cursorPosition = nextCodePoint(this.value, this.cursorPosition);
				this._preferredColumn = null;
			}
			moveLineUp() {
				if (this._visualRows !== null && this._visualRows.length > 1) {
					const rowIdx = this._cursorVisualRow();
					if (rowIdx === 0) return;
					const col = this._preferredColumn ?? this._cursorVisualCol();
					const target = this._visualRows[rowIdx - 1];
					this.cursorPosition = asCodePoint(target.valueStart + this._clampColForRow(col, rowIdx - 1));
					this._preferredColumn = col;
					return;
				}
				const lineStart = this._lineStart();
				if (lineStart === 0) return;
				const col = this._preferredColumn ?? asCellCol(cellLen(this.value.slice(lineStart, this.cursorPosition)));
				const prevLineEnd = lineStart - 1;
				let prevLineStart = prevLineEnd;
				while (prevLineStart > 0 && this.value[prevLineStart - 1] !== "\\n") prevLineStart--;
				const prevLineContent = this.value.slice(prevLineStart, prevLineEnd);
				this.cursorPosition = asCodePoint(prevLineStart + cellColToCodeUnitOffset(prevLineContent, asCellCol(Math.min(col, cellLen(prevLineContent)))));
				this._preferredColumn = col;
			}
			moveLineDown() {
				if (this._visualRows !== null && this._visualRows.length > 1) {
					const rowIdx = this._cursorVisualRow();
					if (rowIdx === this._visualRows.length - 1) return;
					const col = this._preferredColumn ?? this._cursorVisualCol();
					this.cursorPosition = asCodePoint(this._visualRows[rowIdx + 1].valueStart + this._clampColForRow(col, rowIdx + 1));
					this._preferredColumn = col;
					return;
				}
				const lineEnd = this._lineEnd();
				if (lineEnd === this.value.length) return;
				const lineStart = this._lineStart();
				const col = this._preferredColumn ?? asCellCol(cellLen(this.value.slice(lineStart, this.cursorPosition)));
				const nextLineStart = lineEnd + 1;
				let nextLineEnd = nextLineStart;
				while (nextLineEnd < this.value.length && this.value[nextLineEnd] !== "\\n") nextLineEnd++;
				const nextLineContent = this.value.slice(nextLineStart, nextLineEnd);
				this.cursorPosition = asCodePoint(nextLineStart + cellColToCodeUnitOffset(nextLineContent, asCellCol(Math.min(col, cellLen(nextLineContent)))));
				this._preferredColumn = col;
			}
			_clampColForRow(col, targetIdx) {
				const rows = this._visualRows;
				const target = rows[targetIdx];
				const nextIsContinuation = targetIdx + 1 < rows.length && rows[targetIdx + 1].isContinuation;
				const contentCellWidth = asCellCol(cellLen(target.content));
				const capCells = nextIsContinuation ? asCellCol(Math.max(0, contentCellWidth - 1)) : contentCellWidth;
				return cellColToCodeUnitOffset(target.content, asCellCol(Math.min(col, capCells)));
			}
			_cursorVisualRow() {
				const rows = this._visualRows;
				let idx = 0;
				for (let i = rows.length - 1; i >= 0; i--) if (rows[i].valueStart <= this.cursorPosition) {
					idx = i;
					break;
				}
				return idx;
			}
			_cursorVisualCol() {
				const row = this._visualRows[this._cursorVisualRow()];
				return asCellCol(cellLen(row.content.slice(0, this.cursorPosition - row.valueStart)));
			}
			moveLineStart() {
				this.cursorPosition = this._lineStart();
				this._preferredColumn = null;
			}
			moveLineEnd() {
				this.cursorPosition = this._lineEnd();
				this._preferredColumn = null;
			}
			moveDocStart() {
				this.cursorPosition = asCodePoint(0);
				this._preferredColumn = null;
			}
			moveDocEnd() {
				this.cursorPosition = asCodePoint(this.value.length);
				this._preferredColumn = null;
			}
			moveWordLeft() {
				let p = this.cursorPosition;
				while (p > 0) {
					const prev = prevCodePoint(this.value, p);
					if (isWordChar(this.value.slice(prev, p))) break;
					p = prev;
				}
				while (p > 0) {
					const prev = prevCodePoint(this.value, p);
					if (!isWordChar(this.value.slice(prev, p))) break;
					p = prev;
				}
				this.cursorPosition = p;
				this._preferredColumn = null;
			}
			moveWordRight() {
				let p = this.cursorPosition;
				while (p < this.value.length) {
					const next = nextCodePoint(this.value, p);
					if (isWordChar(this.value.slice(p, next))) break;
					p = next;
				}
				while (p < this.value.length) {
					const next = nextCodePoint(this.value, p);
					if (!isWordChar(this.value.slice(p, next))) break;
					p = next;
				}
				this.cursorPosition = p;
				this._preferredColumn = null;
			}
			deleteCharBack() {
				if (this.cursorPosition === 0) return;
				const newPos = prevCodePoint(this.value, this.cursorPosition);
				this.value = this.value.slice(0, newPos) + this.value.slice(this.cursorPosition);
				this.cursorPosition = newPos;
				this._preferredColumn = null;
				this.emitChange();
			}
			deleteCharForward() {
				if (this.cursorPosition >= this.value.length) return;
				const nextPos = nextCodePoint(this.value, this.cursorPosition);
				this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(nextPos);
				this._preferredColumn = null;
				this.emitChange();
			}
			deleteWordBack() {
				let p = this.cursorPosition;
				while (p > 0) {
					const prev = prevCodePoint(this.value, p);
					if (!isWhitespace(this.value.slice(prev, p))) break;
					p = prev;
				}
				while (p > 0) {
					const prev = prevCodePoint(this.value, p);
					if (isWhitespace(this.value.slice(prev, p))) break;
					p = prev;
				}
				if (p === this.cursorPosition) return;
				this._killBuffer = this.value.slice(p, this.cursorPosition);
				this.value = this.value.slice(0, p) + this.value.slice(this.cursorPosition);
				this.cursorPosition = p;
				this._preferredColumn = null;
				this.emitChange();
			}
			deleteWordForward() {
				let p = this.cursorPosition;
				while (p < this.value.length) {
					const next = nextCodePoint(this.value, p);
					if (isWordChar(this.value.slice(p, next))) break;
					p = next;
				}
				while (p < this.value.length) {
					const next = nextCodePoint(this.value, p);
					if (!isWordChar(this.value.slice(p, next))) break;
					p = next;
				}
				if (p === this.cursorPosition) return;
				this._killBuffer = this.value.slice(this.cursorPosition, p);
				this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(p);
				this._preferredColumn = null;
				this.emitChange();
			}
			killLineBack() {
				const start = this._lineStart();
				if (start === this.cursorPosition) return;
				this._killBuffer = this.value.slice(start, this.cursorPosition);
				this.value = this.value.slice(0, start) + this.value.slice(this.cursorPosition);
				this.cursorPosition = start;
				this._preferredColumn = null;
				this.emitChange();
			}
			killLineForward() {
				const end = this._lineEnd();
				if (end > this.cursorPosition) {
					this._killBuffer = this.value.slice(this.cursorPosition, end);
					this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(end);
					this._preferredColumn = null;
					this.emitChange();
					return;
				}
				if (this.cursorPosition < this.value.length) {
					this._killBuffer = "\\n";
					this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(this.cursorPosition + 1);
					this._preferredColumn = null;
					this.emitChange();
				}
			}
			yank() {
				if (this._killBuffer.length === 0) return;
				this._insertText(this._killBuffer);
			}
			transposeChars() {
				const len = this.value.length;
				if (len < 2 || this.cursorPosition === 0) return;
				const p = this.cursorPosition;
				if (p === len) {
					const cp2 = prevCodePoint(this.value, p);
					const cp1 = prevCodePoint(this.value, cp2);
					this.value = this.value.slice(0, cp1) + this.value.slice(cp2) + this.value.slice(cp1, cp2);
					this._preferredColumn = null;
					this.emitChange();
					return;
				}
				const cpBefore = prevCodePoint(this.value, p);
				const cpAfter = nextCodePoint(this.value, p);
				const charBefore = this.value.slice(cpBefore, p);
				const charAt = this.value.slice(p, cpAfter);
				this.value = this.value.slice(0, cpBefore) + charAt + charBefore + this.value.slice(cpAfter);
				this.cursorPosition = asCodePoint(cpAfter);
				this._preferredColumn = null;
				this.emitChange();
			}
			_lineStart() {
				let p = this.cursorPosition;
				while (p > 0 && this.value[p - 1] !== "\\n") p--;
				return asCodePoint(p);
			}
			_lineEnd() {
				let p = this.cursorPosition;
				while (p < this.value.length && this.value[p] !== "\\n") p++;
				return asCodePoint(p);
			}
			_insertText(text) {
				let toInsert = text;
				if (this._maxLength !== void 0) {
					const room = this._maxLength - this.value.length;
					if (room <= 0) return;
					if (toInsert.length > room) toInsert = toInsert.slice(0, room);
				}
				this.value = this.value.slice(0, this.cursorPosition) + toInsert + this.value.slice(this.cursorPosition);
				this.cursorPosition = asCodePoint(this.cursorPosition + toInsert.length);
				this._preferredColumn = null;
				this.emitChange();
			}
			render(options) {
				if (this._multiline) return this._renderMultiline(options);
				return this._renderSingleLine(options);
			}
			_renderSingleLine(options) {
				const showPlaceholder = this.focused && this.value.length === 0 && this.placeholder.length > 0;
				const rawDisplay = showPlaceholder ? this.placeholder : this._password ? "•".repeat(this.value.length) : this.value.indexOf("\\n") >= 0 ? this.value.replace(/\\n/g, NEWLINE_GLYPH) : this.value;
				const rawCellWidth = asCellCol(cellLen(rawDisplay));
				const cursorCellCol = asCellCol(cellLen(rawDisplay.slice(0, this.cursorPosition)));
				const maxAvailable = asCellCol(Math.max(MIN_CONTENT_WIDTH, options.maxWidth - 2));
				const desiredWidth = asCellCol(Math.max(MIN_CONTENT_WIDTH, rawCellWidth, cursorCellCol + 1));
				const contentWidth = asCellCol(Math.min(maxAvailable, desiredWidth));
				const [, afterStart] = splitText(rawDisplay, asCellCol(Math.max(0, Math.min(rawCellWidth - contentWidth, cursorCellCol - contentWidth + 1))));
				const actualStartCell = asCellCol(rawCellWidth - cellLen(afterStart));
				this._singleLineViewportStart = actualStartCell;
				const [visible] = splitText(afterStart, contentWidth);
				const display = setCellSize(visible, contentWidth);
				const cursorDisplayCellCol = asCellCol(cursorCellCol - actualStartCell);
				const bracketStyle = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}) : new Style({ color: this.resolvePalette("foreground") });
				const contentStyle = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}) : showPlaceholder ? new Style({
					color: this.resolvePalette("foreground"),
					dim: true
				}) : this.contentStyleOverride ?? new Style({ color: this.resolvePalette("foreground") });
				const cursorStyle = this.cursorStyleOverride ?? new Style({
					color: this.resolvePalette("on-primary"),
					bgcolor: this.resolvePalette("primary")
				});
				const segments = [new Segment("[", bracketStyle)];
				if (this.focused && !this.disabled && cursorDisplayCellCol >= 0 && cursorDisplayCellCol < contentWidth) {
					const [before, rest] = splitText(display, cursorDisplayCellCol);
					let firstCh = "";
					for (const ch of rest) {
						firstCh = ch;
						break;
					}
					const at = firstCh || " ";
					const after = rest.slice(firstCh.length);
					if (before.length > 0) segments.push(new Segment(before, contentStyle));
					segments.push(new Segment(at, cursorStyle));
					if (after.length > 0) segments.push(new Segment(after, contentStyle));
				} else segments.push(new Segment(display, contentStyle));
				segments.push(new Segment("]", bracketStyle));
				return segments;
			}
			_renderMultiline(options) {
				const visualRows = this._computeVisualRows(options.maxWidth);
				this._visualRows = visualRows;
				const total = visualRows.length;
				const cursorRow = this._cursorVisualRow();
				let scrollStart = 0;
				let visibleCount = total;
				if (this._maxRows !== void 0 && total > this._maxRows) {
					const maxStart = total - this._maxRows;
					if (cursorRow < this._scrollStart) this._scrollStart = cursorRow;
					else if (cursorRow >= this._scrollStart + this._maxRows) this._scrollStart = cursorRow - this._maxRows + 1;
					this._scrollStart = Math.max(0, Math.min(maxStart, this._scrollStart));
					scrollStart = this._scrollStart;
					visibleCount = this._maxRows;
				} else this._scrollStart = 0;
				let padRows = 0;
				if (this._minRows !== void 0 && total < this._minRows && this._maxRows === void 0) padRows = this._minRows - total;
				const contentStyle = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}) : this.contentStyleOverride ?? new Style({ color: this.resolvePalette("foreground") });
				const markerStyle = new Style({
					color: this.resolvePalette("foreground"),
					dim: true
				});
				const cursorStyle = this.cursorStyleOverride ?? new Style({
					color: this.resolvePalette("on-primary"),
					bgcolor: this.resolvePalette("primary")
				});
				const scrollable = this._maxRows !== void 0 && total > this._maxRows;
				const arrowsMode = this._scrollIndicator === "arrows";
				const canScrollUp = arrowsMode && scrollable && this._scrollStart > 0;
				const canScrollDown = arrowsMode && scrollable && this._scrollStart + this._maxRows < total;
				const indicatorStyle = this.indicatorStyleOverride ?? new Style({ color: this.resolvePalette("primary") });
				const segments = [];
				const showCursor = this.focused && !this.disabled;
				for (let i = 0; i < visibleCount; i++) {
					const rowIdx = scrollStart + i;
					const row = visualRows[rowIdx];
					if (i > 0) segments.push(new Segment("\\n"));
					if (row.isContinuation) segments.push(new Segment(this._continuationMarker, markerStyle));
					let indicator;
					if (i === 0 && canScrollUp) indicator = {
						ch: "▲",
						style: indicatorStyle
					};
					else if (i === visibleCount - 1 && canScrollDown) indicator = {
						ch: "▼",
						style: indicatorStyle
					};
					const rowPrintWidth = row.isContinuation ? asCellCol(Math.max(0, options.maxWidth - this._markerWidth)) : asCellCol(options.maxWidth);
					this._emitRowContent(segments, row, rowIdx === cursorRow && showCursor, contentStyle, cursorStyle, indicator, rowPrintWidth);
				}
				for (let i = 0; i < padRows; i++) {
					segments.push(new Segment("\\n"));
					segments.push(new Segment(setCellSize("", asCellCol(options.maxWidth)), contentStyle));
				}
				return segments;
			}
			_emitRowContent(out, row, cursorOnRow, contentStyle, cursorStyle, indicator, rowPrintWidth) {
				const content = row.content;
				const cursorCol = cursorOnRow ? this.cursorPosition - row.valueStart : -1;
				if (indicator === void 0) {
					if (!cursorOnRow) {
						if (content.length > 0) out.push(new Segment(content, contentStyle));
						return;
					}
					const before = content.slice(0, cursorCol);
					const nextCp = nextCodePoint(content, asCodePoint(cursorCol));
					const at = content.slice(cursorCol, nextCp) || " ";
					const after = content.slice(nextCp);
					if (before.length > 0) out.push(new Segment(before, contentStyle));
					out.push(new Segment(at, cursorStyle));
					if (after.length > 0) out.push(new Segment(after, contentStyle));
					return;
				}
				const indicatorWidth = asCellCol(cellLen(indicator.ch));
				const contentCellWidth = asCellCol(Math.max(0, rowPrintWidth - indicatorWidth));
				const [visibleContent] = splitText(content, contentCellWidth);
				const paddedContent = setCellSize(visibleContent, contentCellWidth);
				const cursorCellColInRow = cursorOnRow && cursorCol >= 0 ? cellLen(content.slice(0, cursorCol)) : -1;
				if (cursorCellColInRow >= 0 && cursorCellColInRow < contentCellWidth) {
					const [before, rest] = splitText(paddedContent, asCellCol(cursorCellColInRow));
					let firstCh = "";
					for (const ch of rest) {
						firstCh = ch;
						break;
					}
					const at = firstCh || " ";
					const after = rest.slice(firstCh.length);
					if (before.length > 0) out.push(new Segment(before, contentStyle));
					out.push(new Segment(at, cursorStyle));
					if (after.length > 0) out.push(new Segment(after, contentStyle));
				} else if (paddedContent.length > 0) out.push(new Segment(paddedContent, contentStyle));
				out.push(new Segment(indicator.ch, indicator.style));
			}
			_computeVisualRows(maxWidth) {
				const firstWidth = asCellCol(Math.max(1, maxWidth));
				const continuationWidth = asCellCol(Math.max(1, firstWidth - this._markerWidth));
				const rows = [];
				const lines = this.value.split("\\n");
				let pos = 0;
				for (let li = 0; li < lines.length; li++) {
					const line = lines[li];
					if (this._wrap !== void 0) {
						const wrapRows = this._wrap(line, {
							firstWidth,
							continuationWidth
						});
						if (wrapRows.length === 0) rows.push({
							content: "",
							valueStart: asCodePoint(pos),
							isContinuation: false
						});
						else for (let ri = 0; ri < wrapRows.length; ri++) {
							const wr = wrapRows[ri];
							rows.push({
								content: wr.content,
								valueStart: asCodePoint(pos + wr.start),
								isContinuation: ri > 0
							});
						}
					} else rows.push({
						content: line,
						valueStart: asCodePoint(pos),
						isContinuation: false
					});
					pos += line.length + 1;
				}
				return rows;
			}
			measure(_options) {
				const minimum = 10;
				return {
					minimum,
					maximum: Math.max(minimum, Math.max(cellLen(this.value), cellLen(this.placeholder)) + 2)
				};
			}
			/**
			* \`[X/Y]\` scroll-position string when there's actually something to
			* scroll, else \`undefined\`. X is the cursor's 1-indexed visual row; Y is
			* the total visual row count. Reads cached state populated by the most
			* recent \`render()\` — call from a \`Panel.bottomRightAccessory\` thunk so
			* it evaluates after content has been rendered for the current frame.
			*
			* Returns \`undefined\` when:
			*   - \`scrollIndicator\` is not \`"indices"\`, or
			*   - \`maxRows\` is unset, or total visual rows ≤ maxRows (nothing to
			*     scroll), or
			*   - no render has happened yet (cache is empty).
			*/
			get scrollIndicatorText() {
				if (this._scrollIndicator !== "indices") return void 0;
				if (this._maxRows === void 0) return void 0;
				const rows = this._visualRows;
				if (rows === null || rows.length <= this._maxRows) return void 0;
				return \`[\${this._cursorVisualRow() + 1}/\${rows.length}]\`;
			}
			resolvePalette(key) {
				const rgba = this._theme.palette.get(key);
				return ColorSpec.fromRgba(rgba);
			}
		};
	})();
	//#endregion
	//#region src/widgets/dropdown.ts
	/**
	* Dropdown widget — single-select from option list, with built-in filter.
	*
	* [LAW:one-source-of-truth] Inline footprint (always 1 row, the header)
	* is independent of rendered shape (1 row collapsed, 1 + M rows expanded
	* where M = filteredOptions.length, or 1 when no matches). render() emits
	* the header row only; renderOverlay() emits option rows or a
	* "(no matches)" placeholder.
	*
	* [LAW:dataflow-not-control-flow] \`expanded\` and \`filter\` are data;
	* layout never reserves space for the option list; the overlay pass
	* paints over whatever is below.
	*
	* [LAW:one-source-of-truth] \`options\` and \`selectedIndex\` are canonical.
	* \`filter\` is internal view state. \`filteredOptions\` is the derived
	* subsequence (case-insensitive substring match). \`highlightedIndex\`
	* indexes into \`filteredOptions\`. Commit maps the filtered position
	* back to canonical idx by reference, so selection survives any filter
	* mutation.
	*
	* Width invariant: measure() always returns maxLabelLen(options) + 4
	* regardless of filter state — the query is right-clipped, never wider
	* than the header. See docs/widgets.md → Dropdown.
	*/
	var __runInitializers$1 = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var __esDecorate$1 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	var Dropdown = (() => {
		let _classSuper = WidgetBase;
		let _instanceExtraInitializers = [];
		let _options_decorators;
		let _options_initializers = [];
		let _options_extraInitializers = [];
		let _selectedIndex_decorators;
		let _selectedIndex_initializers = [];
		let _selectedIndex_extraInitializers = [];
		let _expanded_decorators;
		let _expanded_initializers = [];
		let _expanded_extraInitializers = [];
		let _highlightedIndex_decorators;
		let _highlightedIndex_initializers = [];
		let _highlightedIndex_extraInitializers = [];
		let _filter_decorators;
		let _filter_initializers = [];
		let _filter_extraInitializers = [];
		let __theme_decorators;
		let __theme_initializers = [];
		let __theme_extraInitializers = [];
		let _setTheme_decorators;
		let _handleKey_decorators;
		let _handleMouse_decorators;
		let _handleFocus_decorators;
		return class Dropdown extends _classSuper {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
				_options_decorators = [observableShallow];
				_selectedIndex_decorators = [observable];
				_expanded_decorators = [observable];
				_highlightedIndex_decorators = [observable];
				_filter_decorators = [observable];
				__theme_decorators = [observableRef];
				_setTheme_decorators = [action];
				_handleKey_decorators = [action];
				_handleMouse_decorators = [action];
				_handleFocus_decorators = [action];
				__esDecorate$1(this, null, _options_decorators, {
					kind: "accessor",
					name: "options",
					static: false,
					private: false,
					access: {
						has: (obj) => "options" in obj,
						get: (obj) => obj.options,
						set: (obj, value) => {
							obj.options = value;
						}
					},
					metadata: _metadata
				}, _options_initializers, _options_extraInitializers);
				__esDecorate$1(this, null, _selectedIndex_decorators, {
					kind: "accessor",
					name: "selectedIndex",
					static: false,
					private: false,
					access: {
						has: (obj) => "selectedIndex" in obj,
						get: (obj) => obj.selectedIndex,
						set: (obj, value) => {
							obj.selectedIndex = value;
						}
					},
					metadata: _metadata
				}, _selectedIndex_initializers, _selectedIndex_extraInitializers);
				__esDecorate$1(this, null, _expanded_decorators, {
					kind: "accessor",
					name: "expanded",
					static: false,
					private: false,
					access: {
						has: (obj) => "expanded" in obj,
						get: (obj) => obj.expanded,
						set: (obj, value) => {
							obj.expanded = value;
						}
					},
					metadata: _metadata
				}, _expanded_initializers, _expanded_extraInitializers);
				__esDecorate$1(this, null, _highlightedIndex_decorators, {
					kind: "accessor",
					name: "highlightedIndex",
					static: false,
					private: false,
					access: {
						has: (obj) => "highlightedIndex" in obj,
						get: (obj) => obj.highlightedIndex,
						set: (obj, value) => {
							obj.highlightedIndex = value;
						}
					},
					metadata: _metadata
				}, _highlightedIndex_initializers, _highlightedIndex_extraInitializers);
				__esDecorate$1(this, null, _filter_decorators, {
					kind: "accessor",
					name: "filter",
					static: false,
					private: false,
					access: {
						has: (obj) => "filter" in obj,
						get: (obj) => obj.filter,
						set: (obj, value) => {
							obj.filter = value;
						}
					},
					metadata: _metadata
				}, _filter_initializers, _filter_extraInitializers);
				__esDecorate$1(this, null, __theme_decorators, {
					kind: "accessor",
					name: "_theme",
					static: false,
					private: false,
					access: {
						has: (obj) => "_theme" in obj,
						get: (obj) => obj._theme,
						set: (obj, value) => {
							obj._theme = value;
						}
					},
					metadata: _metadata
				}, __theme_initializers, __theme_extraInitializers);
				__esDecorate$1(this, null, _setTheme_decorators, {
					kind: "method",
					name: "setTheme",
					static: false,
					private: false,
					access: {
						has: (obj) => "setTheme" in obj,
						get: (obj) => obj.setTheme
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$1(this, null, _handleKey_decorators, {
					kind: "method",
					name: "handleKey",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleKey" in obj,
						get: (obj) => obj.handleKey
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$1(this, null, _handleMouse_decorators, {
					kind: "method",
					name: "handleMouse",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleMouse" in obj,
						get: (obj) => obj.handleMouse
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate$1(this, null, _handleFocus_decorators, {
					kind: "method",
					name: "handleFocus",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleFocus" in obj,
						get: (obj) => obj.handleFocus
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			id = __runInitializers$1(this, _instanceExtraInitializers);
			focusable = true;
			#options_accessor_storage = __runInitializers$1(this, _options_initializers, void 0);
			get options() {
				return this.#options_accessor_storage;
			}
			set options(value) {
				this.#options_accessor_storage = value;
			}
			#selectedIndex_accessor_storage = (__runInitializers$1(this, _options_extraInitializers), __runInitializers$1(this, _selectedIndex_initializers, void 0));
			get selectedIndex() {
				return this.#selectedIndex_accessor_storage;
			}
			set selectedIndex(value) {
				this.#selectedIndex_accessor_storage = value;
			}
			#expanded_accessor_storage = (__runInitializers$1(this, _selectedIndex_extraInitializers), __runInitializers$1(this, _expanded_initializers, false));
			get expanded() {
				return this.#expanded_accessor_storage;
			}
			set expanded(value) {
				this.#expanded_accessor_storage = value;
			}
			#highlightedIndex_accessor_storage = (__runInitializers$1(this, _expanded_extraInitializers), __runInitializers$1(this, _highlightedIndex_initializers, void 0));
			get highlightedIndex() {
				return this.#highlightedIndex_accessor_storage;
			}
			set highlightedIndex(value) {
				this.#highlightedIndex_accessor_storage = value;
			}
			#filter_accessor_storage = (__runInitializers$1(this, _highlightedIndex_extraInitializers), __runInitializers$1(this, _filter_initializers, ""));
			get filter() {
				return this.#filter_accessor_storage;
			}
			set filter(value) {
				this.#filter_accessor_storage = value;
			}
			get filteredOptions() {
				const f = this.filter.toLowerCase();
				const result = [];
				for (let i = 0; i < this.options.length; i++) {
					const label = this.options[i];
					if (label.toLowerCase().includes(f)) result.push({
						label,
						idx: i
					});
				}
				return result;
			}
			#_theme_accessor_storage = (__runInitializers$1(this, _filter_extraInitializers), __runInitializers$1(this, __theme_initializers, void 0));
			get _theme() {
				return this.#_theme_accessor_storage;
			}
			set _theme(value) {
				this.#_theme_accessor_storage = value;
			}
			constructor(options) {
				super();
				__runInitializers$1(this, __theme_extraInitializers);
				this.id = options.id ?? \`dropdown-\${Math.random().toString(36).slice(2, 8)}\`;
				this.options = [...options.options];
				this.selectedIndex = this.clampIndex(options.selectedIndex ?? 0);
				this.highlightedIndex = this.selectedIndex;
				this.disabled = options.disabled ?? false;
				this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
			}
			clampIndex(n) {
				if (this.options.length === 0) return 0;
				return Math.max(0, Math.min(n, this.options.length - 1));
			}
			setTheme(theme) {
				this._theme = theme;
			}
			handleKey(event) {
				if (this.disabled) return;
				const isPrintable = event.character.length === 1 && !event.ctrl && !event.meta && event.character >= " " && event.character !== "";
				if (!this.expanded) {
					if (event.key === "enter" || event.key === "space") {
						this.expanded = true;
						this.highlightedIndex = this.clampIndex(this.selectedIndex);
						event.stop();
						return;
					}
					if (isPrintable) {
						this.expanded = true;
						this.filter = this.filter + event.character;
						this.highlightedIndex = 0;
						event.stop();
					}
					return;
				}
				switch (event.key) {
					case "up":
						this.highlightedIndex = Math.max(0, this.highlightedIndex - 1);
						event.stop();
						return;
					case "down": {
						const max = Math.max(0, this.filteredOptions.length - 1);
						this.highlightedIndex = Math.min(max, this.highlightedIndex + 1);
						event.stop();
						return;
					}
					case "enter": {
						const picked = this.filteredOptions[this.highlightedIndex];
						event.stop();
						if (picked === void 0) return;
						this.selectedIndex = picked.idx;
						this.filter = "";
						this.expanded = false;
						this.emitChange();
						this.emitSubmit();
						return;
					}
					case "escape":
						this.filter = "";
						this.expanded = false;
						event.stop();
						return;
					case "backspace":
						this.filter = this.filter.slice(0, -1);
						this.highlightedIndex = 0;
						event.stop();
						return;
					case "tab":
						this.filter = "";
						this.expanded = false;
						event.stop();
						return;
				}
				if (isPrintable) {
					this.filter = this.filter + event.character;
					this.highlightedIndex = 0;
					event.stop();
				}
			}
			handleMouse(event) {
				if (this.disabled) return;
				if (event.type !== "mouse_up") return;
				const b = this.bounds;
				if (!b) return;
				const inside = event.x >= b.x && event.x < b.x + b.width && event.y >= b.y && event.y < b.y + b.height;
				if (!this.expanded) {
					if (inside) {
						this.expanded = true;
						this.highlightedIndex = this.clampIndex(this.selectedIndex);
					}
					return;
				}
				if (!inside) {
					this.filter = "";
					this.expanded = false;
					return;
				}
				const rowOffset = event.y - b.y;
				if (rowOffset === 0) {
					this.filter = "";
					this.expanded = false;
					return;
				}
				const picked = this.filteredOptions[rowOffset - 1];
				if (picked === void 0) return;
				this.selectedIndex = picked.idx;
				this.filter = "";
				this.expanded = false;
				this.emitChange();
				this.emitSubmit();
			}
			handleFocus(event) {
				super.handleFocus(event);
				if (event.type === "blur") {
					this.filter = "";
					this.expanded = false;
				}
			}
			render(options) {
				const arrowChar = options.asciiOnly ? "v" : "▾";
				const caret = this.focused ? options.asciiOnly ? "|" : "│" : "";
				const maxLabelLen = this.maxLabelLen();
				const baseStyle = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}) : new Style({
					color: this.resolvePalette("foreground"),
					bgcolor: this.resolvePalette("surface"),
					underline: this.focused
				});
				const headerLabel = this.headerText(maxLabelLen, caret);
				return [
					new Segment("[", baseStyle),
					new Segment(\`\${headerLabel} \${arrowChar}\`, baseStyle),
					new Segment("]", baseStyle)
				];
			}
			headerText(maxLabelLen, caret) {
				if (this.filter === "") {
					const raw = this.options[this.selectedIndex] ?? "";
					const w = cellLen(raw);
					if (w >= maxLabelLen) return setCellSize(raw, asCellCol(maxLabelLen));
					const pad = maxLabelLen - w;
					const left = Math.floor(pad / 2);
					const right = pad - left;
					return " ".repeat(left) + raw + " ".repeat(right);
				}
				const filterRoom = Math.max(0, maxLabelLen - cellLen(caret) - 1);
				const [filterText] = splitText(this.filter, asCellCol(filterRoom));
				return setCellSize(" " + filterText + caret, asCellCol(maxLabelLen));
			}
			renderOverlay(_options) {
				if (!this.expanded) return null;
				const maxLabelLen = this.maxLabelLen();
				const fopts = this.filteredOptions;
				if (fopts.length === 0) return this.renderNoMatchRow(maxLabelLen);
				const segments = [];
				for (let i = 0; i < fopts.length; i++) {
					if (i > 0) segments.push(new Segment("\\n"));
					segments.push(...this.renderOptionRow(fopts[i], i, maxLabelLen));
				}
				return segments;
			}
			renderNoMatchRow(maxLabelLen) {
				const inner = \` \${setCellSize("(no matches)", asCellCol(maxLabelLen))} \`;
				const style = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}) : new Style({
					color: this.resolvePalette("foreground"),
					bgcolor: this.resolvePalette("surface"),
					dim: true
				});
				return [
					new Segment(" ", style),
					new Segment(inner, style),
					new Segment(" ", style)
				];
			}
			renderOptionRow(entry, fpos, maxLabelLen) {
				const inner = \` \${setCellSize(entry.label, asCellCol(maxLabelLen))} \`;
				const isSelected = entry.idx === this.selectedIndex;
				const isHighlighted = fpos === this.highlightedIndex;
				const rowStyle = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true
				}) : isHighlighted ? new Style({
					color: this.resolvePalette("text-primary"),
					bgcolor: this.resolvePalette("primary-muted")
				}) : isSelected ? new Style({
					color: this.resolvePalette("on-primary"),
					bgcolor: this.resolvePalette("primary")
				}) : new Style({
					color: this.resolvePalette("foreground"),
					bgcolor: this.resolvePalette("surface")
				});
				return [
					new Segment(" ", rowStyle),
					new Segment(inner, rowStyle),
					new Segment(" ", rowStyle)
				];
			}
			maxLabelLen() {
				let m = 0;
				for (const label of this.options) {
					const w = cellLen(label);
					if (w > m) m = w;
				}
				return m;
			}
			measure(_options) {
				const width = this.maxLabelLen() + 4;
				return {
					minimum: width,
					maximum: width
				};
			}
			resolvePalette(key) {
				const rgba = this._theme.palette.get(key);
				return ColorSpec.fromRgba(rgba);
			}
		};
	})();
	//#endregion
	//#region src/widgets/slider.ts
	/**
	* Slider widget — numeric value within [min, max] with step increments.
	* [LAW:dataflow-not-control-flow] every render emits exactly \`width\`
	* track cells; the marker cell index is data, not a branch.
	* [LAW:one-type-per-behavior] shared infrastructure inherited from
	* WidgetBase.
	*
	* Visual:
	*   track    — \`width\` cells of "─" (ASCII fallback "-")
	*   marker   — "●" (ASCII fallback "*") at round((value - min) / range * (width - 1))
	*   filled   — cells left of and including the marker use primary fg
	*              on the default terminal bg
	*   unfilled — cells right of the marker use surface fg on the default
	*              terminal bg (no explicit bgcolor — the unfilled track
	*              should sit transparently against whatever the panel /
	*              parent paints underneath)
	*   focused  — underline on the segments
	*   disabled — dim
	*/
	var __runInitializers = function(thisArg, initializers, value) {
		var useValue = arguments.length > 2;
		for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
		return useValue ? value : void 0;
	};
	var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
		function accept(f) {
			if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
			return f;
		}
		var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
		var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
		var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
		var _, done = false;
		for (var i = decorators.length - 1; i >= 0; i--) {
			var context = {};
			for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
			for (var p in contextIn.access) context.access[p] = contextIn.access[p];
			context.addInitializer = function(f) {
				if (done) throw new TypeError("Cannot add initializers after decoration has completed");
				extraInitializers.push(accept(f || null));
			};
			var result = (0, decorators[i])(kind === "accessor" ? {
				get: descriptor.get,
				set: descriptor.set
			} : descriptor[key], context);
			if (kind === "accessor") {
				if (result === void 0) continue;
				if (result === null || typeof result !== "object") throw new TypeError("Object expected");
				if (_ = accept(result.get)) descriptor.get = _;
				if (_ = accept(result.set)) descriptor.set = _;
				if (_ = accept(result.init)) initializers.unshift(_);
			} else if (_ = accept(result)) {
				if (kind === "field") initializers.unshift(_);
				else descriptor[key] = _;
			}
		}
		if (target) Object.defineProperty(target, contextIn.name, descriptor);
		done = true;
	};
	var DEFAULT_WIDTH = 20;
	var Slider = (() => {
		let _classSuper = WidgetBase;
		let _instanceExtraInitializers = [];
		let _value_decorators;
		let _value_initializers = [];
		let _value_extraInitializers = [];
		let _min_decorators;
		let _min_initializers = [];
		let _min_extraInitializers = [];
		let _max_decorators;
		let _max_initializers = [];
		let _max_extraInitializers = [];
		let _step_decorators;
		let _step_initializers = [];
		let _step_extraInitializers = [];
		let _width_decorators;
		let _width_initializers = [];
		let _width_extraInitializers = [];
		let __theme_decorators;
		let __theme_initializers = [];
		let __theme_extraInitializers = [];
		let _setTheme_decorators;
		let _handleKey_decorators;
		let _handleMouse_decorators;
		let _setValue_decorators;
		return class Slider extends _classSuper {
			static {
				const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
				_value_decorators = [observable];
				_min_decorators = [observableRef];
				_max_decorators = [observableRef];
				_step_decorators = [observableRef];
				_width_decorators = [observableRef];
				__theme_decorators = [observableRef];
				_setTheme_decorators = [action];
				_handleKey_decorators = [action];
				_handleMouse_decorators = [action];
				_setValue_decorators = [action];
				__esDecorate(this, null, _value_decorators, {
					kind: "accessor",
					name: "value",
					static: false,
					private: false,
					access: {
						has: (obj) => "value" in obj,
						get: (obj) => obj.value,
						set: (obj, value) => {
							obj.value = value;
						}
					},
					metadata: _metadata
				}, _value_initializers, _value_extraInitializers);
				__esDecorate(this, null, _min_decorators, {
					kind: "accessor",
					name: "min",
					static: false,
					private: false,
					access: {
						has: (obj) => "min" in obj,
						get: (obj) => obj.min,
						set: (obj, value) => {
							obj.min = value;
						}
					},
					metadata: _metadata
				}, _min_initializers, _min_extraInitializers);
				__esDecorate(this, null, _max_decorators, {
					kind: "accessor",
					name: "max",
					static: false,
					private: false,
					access: {
						has: (obj) => "max" in obj,
						get: (obj) => obj.max,
						set: (obj, value) => {
							obj.max = value;
						}
					},
					metadata: _metadata
				}, _max_initializers, _max_extraInitializers);
				__esDecorate(this, null, _step_decorators, {
					kind: "accessor",
					name: "step",
					static: false,
					private: false,
					access: {
						has: (obj) => "step" in obj,
						get: (obj) => obj.step,
						set: (obj, value) => {
							obj.step = value;
						}
					},
					metadata: _metadata
				}, _step_initializers, _step_extraInitializers);
				__esDecorate(this, null, _width_decorators, {
					kind: "accessor",
					name: "width",
					static: false,
					private: false,
					access: {
						has: (obj) => "width" in obj,
						get: (obj) => obj.width,
						set: (obj, value) => {
							obj.width = value;
						}
					},
					metadata: _metadata
				}, _width_initializers, _width_extraInitializers);
				__esDecorate(this, null, __theme_decorators, {
					kind: "accessor",
					name: "_theme",
					static: false,
					private: false,
					access: {
						has: (obj) => "_theme" in obj,
						get: (obj) => obj._theme,
						set: (obj, value) => {
							obj._theme = value;
						}
					},
					metadata: _metadata
				}, __theme_initializers, __theme_extraInitializers);
				__esDecorate(this, null, _setTheme_decorators, {
					kind: "method",
					name: "setTheme",
					static: false,
					private: false,
					access: {
						has: (obj) => "setTheme" in obj,
						get: (obj) => obj.setTheme
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate(this, null, _handleKey_decorators, {
					kind: "method",
					name: "handleKey",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleKey" in obj,
						get: (obj) => obj.handleKey
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate(this, null, _handleMouse_decorators, {
					kind: "method",
					name: "handleMouse",
					static: false,
					private: false,
					access: {
						has: (obj) => "handleMouse" in obj,
						get: (obj) => obj.handleMouse
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				__esDecorate(this, null, _setValue_decorators, {
					kind: "method",
					name: "setValue",
					static: false,
					private: false,
					access: {
						has: (obj) => "setValue" in obj,
						get: (obj) => obj.setValue
					},
					metadata: _metadata
				}, null, _instanceExtraInitializers);
				if (_metadata) Object.defineProperty(this, Symbol.metadata, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: _metadata
				});
			}
			id = __runInitializers(this, _instanceExtraInitializers);
			focusable = true;
			#value_accessor_storage = __runInitializers(this, _value_initializers, void 0);
			get value() {
				return this.#value_accessor_storage;
			}
			set value(value) {
				this.#value_accessor_storage = value;
			}
			#min_accessor_storage = (__runInitializers(this, _value_extraInitializers), __runInitializers(this, _min_initializers, void 0));
			get min() {
				return this.#min_accessor_storage;
			}
			set min(value) {
				this.#min_accessor_storage = value;
			}
			#max_accessor_storage = (__runInitializers(this, _min_extraInitializers), __runInitializers(this, _max_initializers, void 0));
			get max() {
				return this.#max_accessor_storage;
			}
			set max(value) {
				this.#max_accessor_storage = value;
			}
			#step_accessor_storage = (__runInitializers(this, _max_extraInitializers), __runInitializers(this, _step_initializers, void 0));
			get step() {
				return this.#step_accessor_storage;
			}
			set step(value) {
				this.#step_accessor_storage = value;
			}
			#width_accessor_storage = (__runInitializers(this, _step_extraInitializers), __runInitializers(this, _width_initializers, void 0));
			get width() {
				return this.#width_accessor_storage;
			}
			set width(value) {
				this.#width_accessor_storage = value;
			}
			#_theme_accessor_storage = (__runInitializers(this, _width_extraInitializers), __runInitializers(this, __theme_initializers, void 0));
			get _theme() {
				return this.#_theme_accessor_storage;
			}
			set _theme(value) {
				this.#_theme_accessor_storage = value;
			}
			_dragging = (__runInitializers(this, __theme_extraInitializers), false);
			constructor(options = {}) {
				super();
				this.id = options.id ?? \`slider-\${Math.random().toString(36).slice(2, 8)}\`;
				this.min = options.min ?? 0;
				this.max = options.max ?? 100;
				this.step = options.step ?? 1;
				const width = options.width ?? DEFAULT_WIDTH;
				if (!Number.isInteger(width) || width < 1) throw new RangeError(\`Slider width must be a positive integer; got \${width}\`);
				this.width = width;
				this.value = clampSnap(options.value ?? this.min, this.min, this.max, this.step);
				this.disabled = options.disabled ?? false;
				this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
			}
			setTheme(theme) {
				this._theme = theme;
			}
			handleKey(event) {
				if (this.disabled) return;
				switch (event.key) {
					case "left":
						this.setValue(this.value - this.step);
						event.stop();
						return;
					case "right":
						this.setValue(this.value + this.step);
						event.stop();
						return;
					case "home":
						this.setValue(this.min);
						event.stop();
						return;
					case "end":
						this.setValue(this.max);
						event.stop();
						return;
				}
			}
			handleMouse(event) {
				if (this.disabled) return;
				if (event.type === "mouse_down") {
					this._dragging = true;
					this.setValueFromMouseX(event.x);
					return;
				}
				if (event.type === "mouse_move") {
					if (this._dragging) this.setValueFromMouseX(event.x);
					return;
				}
				if (event.type === "mouse_up") {
					const wasDragging = this._dragging;
					this._dragging = false;
					if (wasDragging) {
						this.setValueFromMouseX(event.x);
						this.emitSubmit();
					}
					return;
				}
			}
			setValue(next) {
				const snapped = clampSnap(next, this.min, this.max, this.step);
				if (snapped === this.value) return;
				this.value = snapped;
				this.emitChange();
			}
			setValueFromMouseX(x) {
				const b = this.bounds;
				if (!b) return;
				const cellsAvailable = Math.max(1, this.width - 1);
				const fraction = Math.max(0, Math.min(this.width - 1, x - b.x)) / cellsAvailable;
				const next = this.min + fraction * (this.max - this.min);
				this.setValue(next);
			}
			render(options) {
				const trackChar = options.asciiOnly ? "-" : "─";
				const markerChar = options.asciiOnly ? "*" : "●";
				const range = this.max - this.min;
				const fraction = range === 0 ? 0 : (this.value - this.min) / range;
				const markerIdx = Math.round(fraction * (this.width - 1));
				const baseAttrs = { underline: this.focused };
				const filledStyle = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true,
					...baseAttrs
				}) : new Style({
					color: this.resolvePalette("primary"),
					...baseAttrs
				});
				const unfilledStyle = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true,
					...baseAttrs
				}) : new Style({
					color: this.resolvePalette("surface"),
					...baseAttrs
				});
				const markerStyle = this.disabled ? new Style({
					color: "#666666",
					bgcolor: "#333333",
					dim: true,
					bold: true,
					...baseAttrs
				}) : new Style({
					color: this.resolvePalette("primary"),
					bold: true,
					...baseAttrs
				});
				const segments = [];
				if (markerIdx > 0) segments.push(new Segment(trackChar.repeat(markerIdx), filledStyle));
				segments.push(new Segment(markerChar, markerStyle));
				const tail = this.width - markerIdx - 1;
				if (tail > 0) segments.push(new Segment(trackChar.repeat(tail), unfilledStyle));
				return segments;
			}
			measure(_options) {
				return {
					minimum: this.width,
					maximum: this.width
				};
			}
			resolvePalette(key) {
				const rgba = this._theme.palette.get(key);
				return ColorSpec.fromRgba(rgba);
			}
		};
	})();
	function clampSnap(value, min, max, step) {
		const clamped = Math.max(min, Math.min(max, value));
		if (step <= 0) return clamped;
		const snapped = min + Math.round((clamped - min) / step) * step;
		return Math.max(min, Math.min(max, snapped));
	}
	//#endregion
	//#region src/widgets/event-router.ts
	/**
	* EventRouter — parses raw stdin into KeyEvent / WidgetMouseEvent values
	* and dispatches them to widgets via the Screen's FocusManager and bounds.
	*
	* [LAW:single-enforcer] ANSI escape parsing lives only here — widgets never
	* see raw bytes. One parser, one dispatch surface.
	*
	* [LAW:dataflow-not-control-flow] The same parse pipeline runs for every
	* input chunk: append → consume one event at a time until the buffer can't
	* yield more. The byte's value, not a side-mode, decides which event is
	* emitted. There is no "are we mid-sequence" mode flag — the buffer head
	* carries all the state we need.
	*
	* Lone-ESC handling: a bare \`\\x1b\` is ambiguous (escape key vs. start of a
	* CSI sequence). When the buffer is drained but ends with a lone ESC, the
	* router defers emission via setTimeout(0). The next chunk cancels the timer
	* if it extends the sequence. Tests can call \`flush()\` to drain synchronously.
	*/
	var SINGLE_BYTE_KEYS = {
		9: "tab",
		10: "enter",
		13: "enter",
		27: "escape",
		8: "backspace",
		127: "backspace",
		32: "space"
	};
	var CSI_LETTER_KEYS = {
		A: "up",
		B: "down",
		C: "right",
		D: "left",
		H: "home",
		F: "end",
		Z: "tab"
	};
	var CSI_TILDE_KEYS = {
		"1": "home",
		"2": "insert",
		"3": "delete",
		"4": "end",
		"5": "pageup",
		"6": "pagedown",
		"7": "home",
		"8": "end",
		"11": "f1",
		"12": "f2",
		"13": "f3",
		"14": "f4",
		"15": "f5",
		"17": "f6",
		"18": "f7",
		"19": "f8",
		"20": "f9",
		"21": "f10",
		"23": "f11",
		"24": "f12"
	};
	var SS3_KEYS = {
		P: "f1",
		Q: "f2",
		R: "f3",
		S: "f4",
		A: "up",
		B: "down",
		C: "right",
		D: "left",
		H: "home",
		F: "end"
	};
	var ESC = 27;
	var LBRACKET = 91;
	var LANGLE = 60;
	var O_BYTE = 79;
	var M_UPPER = 77;
	var M_LOWER = 109;
	var MOUSE_TRACK_ON = "\\x1B[?1006h\\x1B[?1000h\\x1B[?1003h";
	var MOUSE_TRACK_OFF = "\\x1B[?1003l\\x1B[?1000l\\x1B[?1006l";
	var UTF8_ENCODER = new TextEncoder();
	var UTF8_DECODER = new TextDecoder("utf-8");
	var ASCII_DECODER = new TextDecoder("ascii");
	var EMPTY_BYTES = /* @__PURE__ */ new Uint8Array(0);
	function concatBytes(a, b) {
		if (a.length === 0) return b;
		if (b.length === 0) return a;
		const merged = new Uint8Array(a.length + b.length);
		merged.set(a, 0);
		merged.set(b, a.length);
		return merged;
	}
	var EventRouter = class {
		source;
		host;
		manageMouse;
		manageRawMode;
		buffer = EMPTY_BYTES;
		running = false;
		dataUnsubscribe;
		escTimer;
		capturedWidget = null;
		keyChain = [];
		mouseHandlers = /* @__PURE__ */ new Set();
		constructor(options) {
			const { screen } = options;
			this.source = isWidgetSource(screen) ? screen : {
				focusManager: screen.focusManager,
				getWidgets: () => screen.widgets
			};
			this.host = options.host;
			const isTTY = this.host.isTTY;
			this.manageRawMode = options.manageRawMode ?? isTTY;
			this.manageMouse = options.manageMouse ?? isTTY;
			this.onKey((event) => this.source.focusManager.handleKey(event));
		}
		start() {
			if (this.running) return;
			this.running = true;
			if (this.manageRawMode) this.host.setRawMode(true);
			if (this.manageMouse) this.host.write(MOUSE_TRACK_ON);
			this.dataUnsubscribe = this.host.onData((chunk) => this.feed(chunk));
		}
		stop() {
			if (this.running) {
				this.running = false;
				if (this.dataUnsubscribe) {
					this.dataUnsubscribe();
					this.dataUnsubscribe = void 0;
				}
				if (this.manageMouse) this.host.write(MOUSE_TRACK_OFF);
				if (this.manageRawMode) this.host.setRawMode(false);
			}
			if (this.escTimer) {
				clearTimeout(this.escTimer);
				this.escTimer = void 0;
			}
			this.buffer = EMPTY_BYTES;
			this.capturedWidget = null;
		}
		onKey(handler, options) {
			const entry = {
				handler,
				priority: options?.priority ?? "normal"
			};
			this.keyChain.push(entry);
			return () => {
				const idx = this.keyChain.indexOf(entry);
				if (idx !== -1) this.keyChain.splice(idx, 1);
			};
		}
		onMouse(handler) {
			this.mouseHandlers.add(handler);
			return () => this.mouseHandlers.delete(handler);
		}
		/** Feed a chunk of bytes (or a string of bytes) into the parser. */
		feed(chunk) {
			const next = typeof chunk === "string" ? UTF8_ENCODER.encode(chunk) : chunk;
			this.buffer = concatBytes(this.buffer, next);
			if (this.escTimer) {
				clearTimeout(this.escTimer);
				this.escTimer = void 0;
			}
			this.drain();
			if (this.buffer.length === 1 && this.buffer[0] === ESC) this.escTimer = setTimeout(() => {
				this.escTimer = void 0;
				this.flush();
			}, 0);
		}
		/** Force any pending lone ESC out of the buffer. */
		flush() {
			if (this.escTimer) {
				clearTimeout(this.escTimer);
				this.escTimer = void 0;
			}
			if (this.buffer.length > 0 && this.buffer[0] === ESC && this.buffer.length === 1) {
				this.buffer = this.buffer.subarray(1);
				this.dispatchKey(new KeyEvent({
					key: "escape",
					character: "",
					shift: false,
					ctrl: false,
					meta: false
				}));
			}
		}
		drain() {
			while (this.buffer.length > 0) {
				const result = this.consumeOne(this.buffer);
				if (result.kind === "incomplete") return;
				this.buffer = this.buffer.subarray(result.bytes);
				if (result.kind === "key") this.dispatchKey(result.event);
				else if (result.kind === "mouse") this.dispatchMouse(result.event);
			}
		}
		consumeOne(buf) {
			const b0 = buf[0];
			if (b0 === ESC) return this.consumeEscape(buf);
			if (b0 === 3) return {
				kind: "key",
				bytes: 1,
				event: new KeyEvent({
					key: "c",
					character: "",
					shift: false,
					ctrl: true,
					meta: false
				})
			};
			const named = SINGLE_BYTE_KEYS[b0];
			if (named && named !== "escape") return {
				kind: "key",
				bytes: 1,
				event: new KeyEvent({
					key: named,
					character: named === "space" ? " " : "",
					shift: false,
					ctrl: false,
					meta: false
				})
			};
			if (b0 < 32) return {
				kind: "key",
				bytes: 1,
				event: new KeyEvent({
					key: String.fromCharCode(b0 + 96),
					character: "",
					shift: false,
					ctrl: true,
					meta: false
				})
			};
			return this.consumePrintable(buf);
		}
		consumePrintable(buf) {
			const b0 = buf[0];
			let len = 1;
			if (b0 >= 192 && b0 < 224) len = 2;
			else if (b0 >= 224 && b0 < 240) len = 3;
			else if (b0 >= 240) len = 4;
			if (buf.length < len) return { kind: "incomplete" };
			const character = UTF8_DECODER.decode(buf.subarray(0, len));
			return {
				kind: "key",
				bytes: len,
				event: new KeyEvent({
					key: character.toLowerCase(),
					character,
					shift: character.length === 1 && character !== character.toLowerCase(),
					ctrl: false,
					meta: false
				})
			};
		}
		consumeEscape(buf) {
			if (buf.length === 1) return { kind: "incomplete" };
			const b1 = buf[1];
			if (b1 === LBRACKET) return this.consumeCSI(buf);
			if (b1 === O_BYTE) return this.consumeSS3(buf);
			if (b1 === ESC) return {
				kind: "key",
				bytes: 2,
				event: new KeyEvent({
					key: "escape",
					character: "",
					shift: false,
					ctrl: false,
					meta: false
				})
			};
			const namedAlt = SINGLE_BYTE_KEYS[b1];
			if (namedAlt && namedAlt !== "escape") return {
				kind: "key",
				bytes: 2,
				event: new KeyEvent({
					key: namedAlt,
					character: "",
					shift: false,
					ctrl: false,
					meta: true
				})
			};
			if (b1 >= 32 && b1 <= 126) {
				const ch = String.fromCharCode(b1);
				return {
					kind: "key",
					bytes: 2,
					event: new KeyEvent({
						key: ch.toLowerCase(),
						character: "",
						shift: ch !== ch.toLowerCase(),
						ctrl: false,
						meta: true
					})
				};
			}
			return {
				kind: "key",
				bytes: 1,
				event: new KeyEvent({
					key: "escape",
					character: "",
					shift: false,
					ctrl: false,
					meta: false
				})
			};
		}
		consumeSS3(buf) {
			if (buf.length < 3) return { kind: "incomplete" };
			const name = SS3_KEYS[String.fromCharCode(buf[2])];
			if (!name) return {
				kind: "skip",
				bytes: 3
			};
			return {
				kind: "key",
				bytes: 3,
				event: new KeyEvent({
					key: name,
					character: "",
					shift: false,
					ctrl: false,
					meta: false
				})
			};
		}
		consumeCSI(buf) {
			const next = buf[2];
			if (next === void 0) return { kind: "incomplete" };
			if (next === M_UPPER) {
				if (buf.length < 6) return { kind: "incomplete" };
				return {
					kind: "mouse",
					bytes: 6,
					event: decodeMouseFromCb(buf[3] - 32, buf[4] - 32 - 1, buf[5] - 32 - 1, true)
				};
			}
			if (next === LANGLE) {
				for (let i = 3; i < buf.length; i++) {
					const b = buf[i];
					if (b === M_UPPER || b === M_LOWER) {
						const parts = ASCII_DECODER.decode(buf.subarray(3, i)).split(";");
						if (parts.length !== 3) return {
							kind: "skip",
							bytes: i + 1
						};
						const cb = parseInt(parts[0], 10);
						const col = parseInt(parts[1], 10) - 1;
						const row = parseInt(parts[2], 10) - 1;
						if (Number.isNaN(cb) || Number.isNaN(col) || Number.isNaN(row)) return {
							kind: "skip",
							bytes: i + 1
						};
						return {
							kind: "mouse",
							bytes: i + 1,
							event: decodeMouseFromCb(cb, col, row, b === M_UPPER)
						};
					}
				}
				return { kind: "incomplete" };
			}
			let params = "";
			for (let i = 2; i < buf.length; i++) {
				const b = buf[i];
				if (b >= 64 && b <= 126) return decodeCSI(params, String.fromCharCode(b), i + 1);
				params += String.fromCharCode(b);
			}
			return { kind: "incomplete" };
		}
		dispatchKey(event) {
			const chain = [...this.keyChain];
			for (const entry of chain) {
				if (event.stopped) return;
				if (entry.priority === "high") entry.handler(event);
			}
			if (event.stopped) return;
			this.source.focusManager.current?.handleKey(event);
			if (event.stopped) return;
			for (const entry of chain) {
				if (event.stopped) return;
				if (entry.priority === "normal") entry.handler(event);
			}
		}
		dispatchMouse(event) {
			for (const handler of this.mouseHandlers) handler(event);
			const widgets = this.source.getWidgets();
			if (event.type === "mouse_move") for (const w of widgets) {
				if (!w.visible) continue;
				const inside = w.containsPoint(event.x, event.y);
				if (inside !== w.hovered) w.setHovered(inside);
			}
			const target = this.capturedWidget !== null && (event.type === "mouse_move" || event.type === "mouse_up") ? this.capturedWidget : topmostHit(widgets, event.x, event.y);
			if (target) target.handleMouse(event);
			if (event.type === "mouse_down") this.capturedWidget = target;
			else if (event.type === "mouse_up") this.capturedWidget = null;
		}
	};
	function isWidgetSource(value) {
		return !!value && typeof value === "object" && "getWidgets" in value && typeof value.getWidgets === "function";
	}
	function decodeMouseFromCb(cb, x, y, isPress) {
		const isMotion = (cb & 32) !== 0;
		const isScroll = (cb & 64) !== 0;
		const button = cb & 3;
		const shift = !!(cb & 4);
		const ctrl = !!(cb & 16);
		if (isScroll) return {
			type: button === 0 ? "scroll_up" : "scroll_down",
			x,
			y,
			button: 0,
			shift,
			ctrl
		};
		if (isMotion) return {
			type: "mouse_move",
			x,
			y,
			button,
			shift,
			ctrl
		};
		return {
			type: isPress ? "mouse_down" : "mouse_up",
			x,
			y,
			button,
			shift,
			ctrl
		};
	}
	function decodeCSI(params, final, bytes) {
		const parts = params.split(";");
		const first = parts[0] ?? "";
		const { shift, ctrl, meta } = decodeModifier(parseInt(parts[1] ?? "", 10));
		if (final === "~") {
			const name = CSI_TILDE_KEYS[first];
			if (!name) return {
				kind: "skip",
				bytes
			};
			return {
				kind: "key",
				bytes,
				event: new KeyEvent({
					key: name,
					character: "",
					shift,
					ctrl,
					meta
				})
			};
		}
		const name = CSI_LETTER_KEYS[final];
		if (!name) return {
			kind: "skip",
			bytes
		};
		if (final === "Z") return {
			kind: "key",
			bytes,
			event: new KeyEvent({
				key: "tab",
				character: "",
				shift: true,
				ctrl: false,
				meta: false
			})
		};
		return {
			kind: "key",
			bytes,
			event: new KeyEvent({
				key: name,
				character: "",
				shift,
				ctrl,
				meta
			})
		};
	}
	function decodeModifier(mod) {
		if (!Number.isFinite(mod) || mod <= 1) return {
			shift: false,
			ctrl: false,
			meta: false
		};
		const bits = mod - 1;
		return {
			shift: (bits & 1) !== 0,
			meta: (bits & 2) !== 0,
			ctrl: (bits & 4) !== 0
		};
	}
	function topmostHit(widgets, x, y) {
		for (let i = widgets.length - 1; i >= 0; i--) {
			const w = widgets[i];
			if (!w.visible) continue;
			if (w.containsPoint(x, y)) return w;
		}
		return null;
	}
	//#endregion
	return {
		"@promptctl/rich-js": src_exports,
		"@promptctl/rich-js/node/terminal-host": terminal_host_exports,
		"@promptctl/rich-js/widgets": /* @__PURE__ */ __exportAll({
			Button: () => Button,
			Checkbox: () => Checkbox,
			DefaultFocusManager: () => DefaultFocusManager,
			DefaultScreen: () => DefaultScreen,
			Dropdown: () => Dropdown,
			EventRouter: () => EventRouter,
			FLOW: () => FLOW,
			KeyEvent: () => KeyEvent,
			Slider: () => Slider,
			StaticItem: () => StaticItem,
			TextInput: () => TextInput,
			Toggle: () => Toggle,
			WidgetBase: () => WidgetBase,
			charGreedyWrap: () => charGreedyWrap,
			hasOverlay: () => hasOverlay
		})
	};
})();
`,e=n+`
const { NodeTerminalHost } = __richLibrary["@promptctl/rich-js/node/terminal-host"];
const { Button, Checkbox, DefaultFocusManager, DefaultScreen, EventRouter, StaticItem, TextInput } = __richLibrary["@promptctl/rich-js/widgets"];
const { Console } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const host = new NodeTerminalHost();
	const screen = new DefaultScreen({ host });
	new EventRouter({
		screen,
		host
	});
	new StaticItem({
		id: "header",
		render: () => []
	});
	new TextInput({ id: "name" });
	new Button({ label: "Save" });
	new StaticItem({
		id: "status",
		render: () => []
	});
	{
		const host = new NodeTerminalHost();
		const focusManager = new DefaultFocusManager();
		const screen = new DefaultScreen({
			host,
			focusManager
		});
		const router = new EventRouter({
			screen,
			host
		});
		const name = new TextInput({ placeholder: "your name" });
		const subscribe = new Checkbox({ label: "Subscribe to updates" });
		const submit = new Button({
			label: "Submit",
			variant: "primary"
		});
		const quit = () => {
			router.stop();
			screen.stop();
			host.write("\\n");
		};
		submit.onSubmit(() => {
			quit();
			host.write(\`\${name.value} — subscribed: \${subscribe.checked}\\n\`);
			process.exit(0);
		});
		router.onKey((event) => {
			if (event.ctrl && event.key === "c") {
				event.stop();
				quit();
				process.exit(0);
			}
		}, { priority: "high" });
		screen.mount(name, subscribe, submit);
		screen.start();
		router.start();
	}
}
//#endregion
`;export{e as default};
