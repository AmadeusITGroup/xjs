#!/bin/bash

# Build the grammar and deploys the vs-code extension locally
# cf. docs/build.md
yarn build
rm -rf $HOME/.vscode/extensions/vscode-xjs
mkdir -p $HOME/.vscode/extensions/vscode-xjs/dist/tm-grammar
cp ./package.json $HOME/.vscode/extensions/vscode-xjs/package.json
cp -a ./dist/tm-grammar/xjs.tmLanguage.json $HOME/.vscode/extensions/vscode-xjs/dist/tm-grammar/xjs.tmLanguage.json