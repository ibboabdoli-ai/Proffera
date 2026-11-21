// Valid-looking receipts in non-authoritative document contexts.
// Used by actual CI, AutoMerge, Wakeup and direct Live Adapter regressions.
export function codeContextExamples(receipt: string) {
  return [
    "```text\n" + receipt + "\n```",
    "```\n    ```\n" + receipt + "\n```",
    "```\n\t```\n" + receipt + "\n```",
    "`\n" + receipt + "\n`",
    "``\n" + receipt + "\n``",
    "<pre>\n" + receipt + "\n</pre>",
    "<pre><code>\n" + receipt + "\n</code></pre>",
    receipt.split("\n").map(line => "> " + line).join("\n"),
    receipt.split("\n").map(line => "    " + line).join("\n"),
  ].flatMap(body => [body, body.replaceAll("\n", "\r\n")]);
}
