# Build the grammar and deploys the vs-code extension locally
# cf. docs/build.md
yarn run build
rm -rf $HOME/.vscode/extensions/vscode-xjs
mkdir $HOME/.vscode/extensions/vscode-xjs
cp ./package.json $HOME/.vscode/extensions/vscode-xjs/package.json
cp -a ./syntaxes $HOME/.vscode/extensions/vscode-xjs/syntaxes