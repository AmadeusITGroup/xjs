
## Unit tests

The grammar can be built tested through the following command:
```
    yarn test
```

## Validating the grammar in VS Code

Testing the syntax highlighting in VS Code requires 2 steps:
1. Redeploying the extension locally when changes are made in the project (e.g. on the TM grammar file or on package.json)
2. Refreshing Visual studio code

To deploy this extension locally, the project needs to be copied to the following folder:
- On Windows: %USERPROFILE%\.vscode\extensions
- On MacOS/Linux: $HOME/.vscode/extensions (or simply run `bash generate-and-deploy.bash` in the project root folder)

To refresh VS Code, simply reload the window through the **Reload Window** option in the Command palette (or install the shortcut below)

To view the text mate scope, use **Developer: Inspect TM Scopes** in the command palette

The XJS grammar is generated from the TypeScript grammar through the *src/grammar/ts-grammar* script. To update the grammar, simply modify *ts-grammar.ts* and run `bash generate-and-deploy.bash` (or `yarn grammar`)

## Shortcuts

It quickly comes handy to edit your visual studio keybindings.json file to add 2 shortcuts to a/ reload the window and b/ inspect the TextMate scope:

```
// shortcuts for window reload and TM scope inspection
// > to be added to your keybindings.json configuration 
// > "Preferences: Open Keyboard Shortcuts" in the vscode command palette
{
    "key": "ctrl+f5",
    "command": "workbench.action.reloadWindow",
    "when": "editorTextFocus"
},
{
    "key": "ctrl+f4",
    "command": "editor.action.inspectTMScopes",
    "when": "editorTextFocus"
}
```

## Miscellaneous notes

Text mate grammar introduction: 
- vscode extension [documentation](https://code.visualstudio.com/docs/extensions/themes-snippets-colorizers)
- official textmate [documentation](https://macromates.com/manual/en/language_grammars) 
- [Hello World](https://code.visualstudio.com/docs/extensions/example-hello-world) vscode extension

<!--
Note about grammar injection:
The L: part means left injection, i.e., the grammar rules are injected to the left of the existing rules for the scope being highlighted. When doing syntax highlighting, the left-most rule has higher precedence than the rules to it's right. So the L: ensures that this syntax highlighting will override the default ones.
(cf. [here](https://github.com/Microsoft/vscode-textmate/issues/41))
-->