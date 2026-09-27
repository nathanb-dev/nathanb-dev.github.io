const pasteBox = document.getElementById("paste-box");
const htmlOutput = document.getElementById("html-output");
/* const markdownOutput = document.getElementById("markdown-output"); */
pasteBox.onblur =
pasteBox.onpaste = ()=> {
	setTimeout(()=> {
		const html = pasteBox.innerHTML;
		htmlOutput.value = html;
		/* markdownOutput.value = html; */
	});
};
pasteBox.focus();

const copyBtn = document.getElementById("copy-btn");
const pasteBtn = document.getElementById("paste-btn");
const toast = document.getElementById("toast");
let toastTimer;

const showToast = (message)=> {
	toast.textContent = message;
	toast.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(()=> toast.classList.remove("show"), 1500);
};

pasteBtn.onclick = async ()=> {
	try {
		let html = "";
		for (const item of await navigator.clipboard.read()) {
			if (item.types.includes("text/html")) {
				html = await (await item.getType("text/html")).text();
				break;
			}
		}
		if (html) {
			pasteBox.innerHTML = html;
		} else {
			pasteBox.textContent = await navigator.clipboard.readText();
		}
	} catch (e) {
		showToast("Couldn't read clipboard");
		return;
	}
	htmlOutput.value = pasteBox.innerHTML;
	showToast("Pasted!");
};
copyBtn.onclick = async ()=> {
	try {
		await navigator.clipboard.writeText(htmlOutput.value);
	} catch (e) {
		// Clipboard API unavailable: select the text so the user can copy manually.
		htmlOutput.select();
		return;
	}
	showToast("Copied!");
};

