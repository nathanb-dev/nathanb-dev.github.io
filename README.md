# nathanb-dev.github.io

Small, single-purpose web tools that run entirely in the browser. No build step and no dependencies: each tool is plain HTML, CSS and JavaScript.

## Tools

| Tool | Description |
| --- | --- |
| [Rich Text to HTML](richtextToHtml/) | Paste formatted text and get the HTML markup. |
| [String Escaper](escapeString/) | Turn plain text into an escaped string literal for C, C++, C#, Java, JavaScript/TypeScript, JSON, Python, Go, Rust, Swift and PHP. Options cover quote style, Unicode handling, splitting lines into separate literals, and more. |

## Privacy

Nothing you type or paste is sent anywhere. The String Escaper can remember its option choices (never your text) in a cookie, but only after you accept the consent banner. You can change your choice at any time with the "Cookie preferences" link.

## Running locally

Open `index.html` in a browser, or serve the folder for full functionality (the clipboard buttons and cookies need `http://localhost` or HTTPS, not `file://`):

```sh
python3 -m http.server
```

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
