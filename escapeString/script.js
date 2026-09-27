const $ = (id)=> document.getElementById(id);
const input = $("input");
const output = $("output");
const languageSelect = $("language");
const quoteSelect = $("quote");
const nonAsciiSelect = $("non-ascii");
const checks = {
	wrap: $("wrap"),
	split: $("split"),
	invisible: $("invisible"),
	upper: $("upper"),
	both: $("both"),
	es6: $("es6"),
	slash: $("slash"),
	trigraph: $("trigraph"),
};

// Language profiles.
//   quotes:     quote characters that can delimit a literal (first is the default)
//   simple:     code point -> letter for short escapes (\n, \t, ...)
//   ctrl:       escape for remaining control characters (U+0000-U+001F, U+007F)
//   uni:        escape for a valid code point above U+007F
//   utf8:       how UTF-8 byte escapes are written ("octal" | "hex"), if supported
//   surrogates: whether a lone surrogate can be written as \uXXXX
//   both:       whether \' and \" are both valid escapes
//   join:       how split lines are combined into one expression
const u4 = (cp, h)=> "\\u" + h(cp, 4);
const pairs = (cp, h)=> {
	if (cp <= 0xFFFF) return u4(cp, h);
	const c = cp - 0x10000;
	return u4(0xD800 + (c >> 10), h) + u4(0xDC00 + (c & 0x3FF), h);
};
const braces = (cp, h)=> "\\u{" + h(cp, 1) + "}";
const uOrU = (cp, h)=> cp <= 0xFFFF ? u4(cp, h) : "\\U" + h(cp, 8);
const hex2 = (cp, h)=> "\\x" + h(cp, 2);
const octal3 = (cp)=> "\\" + cp.toString(8).padStart(3, "0");
const plusJoin = { sep: " +\n" };

const LANGUAGES = {
	c: {
		name: "C / C++",
		quotes: ['"', "'"],
		simple: { 7: "a", 8: "b", 9: "t", 10: "n", 11: "v", 12: "f", 13: "r" },
		ctrl: octal3,
		// Universal character names are not allowed below U+00A0, so use UTF-8 bytes there.
		uni: (cp, h)=> cp < 0xA0 ? new TextEncoder().encode(String.fromCodePoint(cp)).reduce((s, b)=> s + octal3(b), "") : uOrU(cp, h),
		utf8: "octal",
		surrogates: false,
		both: true,
		join: { sep: "\n" },
		trigraph: true,
	},
	csharp: {
		name: "C#",
		quotes: ['"', "'"],
		simple: { 0: "0", 7: "a", 8: "b", 9: "t", 10: "n", 11: "v", 12: "f", 13: "r" },
		ctrl: (cp, h)=> u4(cp, h),
		uni: uOrU,
		surrogates: true,
		both: true,
		join: plusJoin,
	},
	java: {
		name: "Java",
		quotes: ['"', "'"],
		simple: { 8: "b", 9: "t", 10: "n", 12: "f", 13: "r" },
		// \u escapes are processed before lexing in Java, so control characters use octal.
		ctrl: octal3,
		uni: pairs,
		surrogates: true,
		both: true,
		join: plusJoin,
	},
	js: {
		name: "JavaScript / TypeScript",
		quotes: ['"', "'", "`"],
		simple: { 8: "b", 9: "t", 10: "n", 11: "v", 12: "f", 13: "r" },
		ctrl: hex2,
		uni: (cp, h, o)=> o.es6 ? (cp > 0xFFFF ? braces(cp, h) : u4(cp, h)) : pairs(cp, h),
		surrogates: true,
		both: true,
		join: plusJoin,
		lineSeparators: true,
	},
	json: {
		name: "JSON",
		quotes: ['"'],
		simple: { 8: "b", 9: "t", 10: "n", 12: "f", 13: "r" },
		ctrl: u4,
		uni: pairs,
		surrogates: true,
		both: false,
		join: null,
	},
	python: {
		name: "Python",
		quotes: ['"', "'"],
		simple: { 7: "a", 8: "b", 9: "t", 10: "n", 11: "v", 12: "f", 13: "r" },
		ctrl: hex2,
		uni: uOrU,
		surrogates: true,
		both: true,
		join: { open: "(\n    ", sep: "\n    ", close: "\n)" },
	},
	go: {
		name: "Go",
		quotes: ['"', "'"],
		simple: { 7: "a", 8: "b", 9: "t", 10: "n", 11: "v", 12: "f", 13: "r" },
		ctrl: hex2,
		uni: uOrU,
		utf8: "hex",
		surrogates: false,
		both: false,
		join: plusJoin,
	},
	rust: {
		name: "Rust",
		quotes: ['"', "'"],
		simple: { 0: "0", 9: "t", 10: "n", 13: "r" },
		ctrl: hex2,
		uni: braces,
		surrogates: false,
		both: true,
		join: { open: "concat!(\n    ", sep: ",\n    ", close: "\n)" },
	},
	swift: {
		name: "Swift",
		quotes: ['"'],
		simple: { 0: "0", 9: "t", 10: "n", 13: "r" },
		ctrl: braces,
		uni: braces,
		surrogates: false,
		both: true,
		join: plusJoin,
	},
	php: {
		name: "PHP",
		quotes: ['"'],
		simple: { 9: "t", 10: "n", 11: "v", 12: "f", 13: "r", 27: "e" },
		ctrl: hex2,
		uni: braces,
		surrogates: false,
		both: false,
		join: { sep: " .\n" },
		dollar: true,
	},
};

const NON_ASCII_MODES = [
	["keep", "Keep as-is"],
	["escape", "Unicode escapes"],
	["utf8", "UTF-8 byte escapes"],
];

const INVISIBLE =/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/u;

function escapeString(text, o, p) {
	const h = (n, w)=> {
		const s = n.toString(16).padStart(w, "0");
		return o.upper ? s.toUpperCase() : s;
	};
	const chars = Array.from(text);
	const pieces = [];
	let cur = "";

	chars.forEach((s, i)=> {
		let cp = s.codePointAt(0);
		const next = chars[i + 1];
		let out;
		if (s === "\\") {
			out = "\\\\";
		} else if (s === o.quote || (o.both && p.both && (s === '"' || s === "'"))) {
			out = "\\" + s;
		} else if (o.quote === "`" && s === "$" && next === "{") {
			out = "\\$";
		} else if (p.dollar && s === "$") {
			out = "\\$";
		} else if (s === "/" && o.slash) {
			out = "\\/";
		} else if (s === "?" && o.trigraph && next === "?") {
			out = "\\?";
		} else if (p.simple[cp]) {
			out = "\\" + p.simple[cp];
		} else if (cp < 0x20 || cp === 0x7F) {
			out = p.ctrl(cp, h, o);
		} else if (cp > 0x7F) {
			const forced = (o.invisible && INVISIBLE.test(s)) || (p.lineSeparators && (cp === 0x2028 || cp === 0x2029));
			if (o.nonAscii === "keep" && !forced) {
				out = s;
			} else if (cp >= 0xD800 && cp <= 0xDFFF && p.surrogates) {
				out = u4(cp, h);
			} else {
				// Lone surrogates cannot be expressed here; substitute U+FFFD.
				if (cp >= 0xD800 && cp <= 0xDFFF) cp = 0xFFFD;
				if (o.nonAscii === "utf8" && p.utf8) {
					out = new TextEncoder().encode(String.fromCodePoint(cp)).reduce((acc, b)=> {
						return acc + (p.utf8 === "octal" ? octal3(b) : hex2(b, h));
					}, "");
				} else {
					out = p.uni(cp, h, o);
				}
			}
		} else {
			out = s;
		}

		cur += out;
		if (o.split && o.wrap && p.join && cp === 10) {
			pieces.push(cur);
			cur = "";
		}
	});
	if (cur !== "" || !pieces.length) pieces.push(cur);

	if (!o.wrap) return pieces.join("");
	const literals = pieces.map((piece)=> o.quote + piece + o.quote);
	if (literals.length === 1 || !p.join) return literals[0];
	const { open = "", sep, close = "" } = p.join;
	return open + literals.join(sep) + close;
}

function currentLanguageKey() {
	return languageSelect.value;
}

function syncOptions() {
	const key = currentLanguageKey();
	const p = LANGUAGES[key];

	// Quote choices depend on the language.
	const previous = quoteSelect.value;
	quoteSelect.replaceChildren(...p.quotes.map((q)=> {
		const opt = document.createElement("option");
		opt.value = q;
		opt.textContent = q === '"' ? 'Double (")' : q === "'" ? "Single (')" : "Backtick (`)";
		return opt;
	}));
	if (p.quotes.includes(previous)) quoteSelect.value = previous;

	// UTF-8 byte escapes only make sense where \x / octal escapes are bytes.
	const previousNonAscii = nonAsciiSelect.value;
	nonAsciiSelect.replaceChildren(...NON_ASCII_MODES.filter(([value])=> value !== "utf8" || p.utf8).map(([value, label])=> {
		const opt = document.createElement("option");
		opt.value = value;
		opt.textContent = label;
		return opt;
	}));
	if ([...nonAsciiSelect.options].some((o)=> o.value === previousNonAscii)) {
		nonAsciiSelect.value = previousNonAscii;
	} else if (previousNonAscii === "utf8") {
		nonAsciiSelect.value = "escape";
	}

	// Language-specific checkboxes.
	document.querySelectorAll("[data-langs]").forEach((el)=> {
		el.hidden = !el.dataset.langs.split(",").includes(key);
	});

	// Options the language can't support are hidden...
	checks.split.parentElement.hidden = !p.join;
	checks.both.parentElement.hidden = !p.both;

	// ...and options that depend on another option are disabled: splitting needs quotes to wrap.
	checks.split.disabled = !checks.wrap.checked;
	checks.split.parentElement.classList.toggle("disabled", !checks.wrap.checked);
}

function update() {
	const p = LANGUAGES[currentLanguageKey()];
	const options = {
		quote: quoteSelect.value,
		nonAscii: nonAsciiSelect.value,
		wrap: checks.wrap.checked,
		split: checks.split.checked && !checks.split.disabled && !checks.split.parentElement.hidden,
		invisible: checks.invisible.checked,
		upper: checks.upper.checked,
		both: checks.both.checked && !checks.both.parentElement.hidden,
		es6: checks.es6.checked && !checks.es6.parentElement.hidden,
		slash: checks.slash.checked && !checks.slash.parentElement.hidden,
		trigraph: checks.trigraph.checked && !checks.trigraph.parentElement.hidden,
	};
	output.value = escapeString(input.value, options, p);
}

for (const [key, p] of Object.entries(LANGUAGES)) {
	const opt = document.createElement("option");
	opt.value = key;
	opt.textContent = p.name;
	languageSelect.appendChild(opt);
}

// Cookies: the consent choice is always remembered; settings only after consent.
const COOKIE_PATH = location.pathname.replace(/[^/]*$/, "");
// Cookies can't last forever; ask for ~10 years. Browsers may cap this (Chrome: 400 days),
// so cookies are also re-written on every visit to keep pushing the expiry forward.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10;

const getCookie = (name)=> {
	const match = document.cookie.split("; ").find((c)=> c.startsWith(name + "="));
	return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};
const setCookie = (name, value)=> {
	document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=${COOKIE_PATH}; SameSite=Lax`;
};
const deleteCookie = (name)=> {
	document.cookie = `${name}=; max-age=0; path=${COOKIE_PATH}; SameSite=Lax`;
};

const saveSettings = ()=> {
	if (getCookie("consent") !== "yes") return;
	const settings = {
		language: languageSelect.value,
		quote: quoteSelect.value,
		nonAscii: nonAsciiSelect.value,
		checks: Object.fromEntries(Object.entries(checks).map(([k, el])=> [k, el.checked])),
	};
	setCookie("settings", JSON.stringify(settings));
};

const loadSettings = ()=> {
	if (getCookie("consent") !== "yes") return;
	let s;
	try {
		s = JSON.parse(getCookie("settings"));
	} catch (e) {
		return;
	}
	if (!s) return;
	if (LANGUAGES[s.language]) languageSelect.value = s.language;
	syncOptions();
	if (s.quote) quoteSelect.value = s.quote;
	if (s.nonAscii) nonAsciiSelect.value = s.nonAscii;
	for (const [k, el] of Object.entries(checks)) {
		if (s.checks && typeof s.checks[k] === "boolean") el.checked = s.checks[k];
	}
};

const banner = $("consent-banner");
const setConsent = (accepted)=> {
	setCookie("consent", accepted ? "yes" : "no");
	if (accepted) saveSettings();
	else deleteCookie("settings");
	banner.hidden = true;
};
$("consent-accept").onclick = ()=> setConsent(true);
$("consent-decline").onclick = ()=> setConsent(false);
$("cookie-prefs").onclick = ()=> {
	banner.hidden = false;
};
banner.hidden = getCookie("consent") !== null;

const onOptionChange = ()=> {
	syncOptions();
	update();
	saveSettings();
};
[languageSelect, quoteSelect, nonAsciiSelect, ...Object.values(checks)].forEach((el)=> {
	el.onchange = onOptionChange;
});
input.oninput = update;

const copyBtn = $("copy-btn");
const toast = $("toast");
let toastTimer;

const showToast = (message)=> {
	toast.textContent = message;
	toast.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(()=> toast.classList.remove("show"), 1500);
};

copyBtn.onclick = async ()=> {
	try {
		await navigator.clipboard.writeText(output.value);
	} catch (e) {
		// Clipboard API unavailable: select the text so the user can copy manually.
		output.select();
		return;
	}
	showToast("Copied!");
};

$("reset-btn").onclick = ()=> {
	languageSelect.selectedIndex = 0;
	syncOptions();
	quoteSelect.selectedIndex = 0;
	nonAsciiSelect.value = "keep";
	for (const el of Object.values(checks)) el.checked = el.defaultChecked;
	onOptionChange();
	showToast("Preferences reset");
};

$("paste-btn").onclick = async ()=> {
	try {
		input.value = await navigator.clipboard.readText();
	} catch (e) {
		showToast("Couldn't read clipboard");
		return;
	}
	update();
	showToast("Pasted!");
};

syncOptions();
loadSettings();
syncOptions();
// Refresh the cookies' expiry on each visit.
if (getCookie("consent") !== null) setCookie("consent", getCookie("consent"));
saveSettings();
update();
input.focus();
