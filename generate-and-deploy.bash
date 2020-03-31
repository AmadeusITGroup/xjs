#!/bin/bash
yarn run build
rm -rf $HOME/.vscode/extensions/vscode-xjs
mkdir $HOME/.vscode/extensions/vscode-xjs
cp ./package.json $HOME/.vscode/extensions/vscode-xjs/package.json
cp -a ./dist/syntaxes $HOME/.vscode/extensions/vscode-xjs/syntaxes